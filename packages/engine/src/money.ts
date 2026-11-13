import { mortgageProperty, sellOneLevel } from './assets';
import { canOwn, cardPayMultiplier, onBankrupt, onRentPaid } from './characters';
import {
  activePlayers,
  aliveSides,
  type Ctx,
  emit,
  fail,
  getPlayer,
  hotelLevel,
  ownedBy,
  pushFront,
  sideTiles,
  teammates,
} from './ctx';
import { expireEffectsOf } from './effects';
import { dropLoansOf, loanBalance } from './loans';
import { gambleRule, gambleWorst } from './sicbo';
import type { PayKind, PayTarget, PayTask, PlayerState, Task } from './types';

/** Fund payments fall back to the bank when Quỹ khuyến học is off. */
export function resolveTarget(c: Ctx, to: PayTarget): PayTarget {
  if (to.kind === 'fund' && !c.s.config.scholarshipFund) return { kind: 'bank' };
  return to;
}

export function credit(c: Ctx, to: PayTarget, amount: number): void {
  const t = resolveTarget(c, to);
  if (t.kind === 'player') getPlayer(c, t.id).cash += amount;
  else if (t.kind === 'fund') c.s.fund += amount;
}

export function payTask(
  from: string,
  to: PayTarget,
  amount: number,
  kind: PayKind,
  reason: string,
  owner?: string,
): PayTask {
  return { t: 'pay', from, to, amount, kind, reason, ...(owner ? { owner } : {}) };
}

/**
 * A payment demanded by a card. Idol TikTok pays ×1.5 (rounded up); card
 * payments to the bank go to the Quỹ when it is enabled.
 */
export function cardPay(
  c: Ctx,
  from: PlayerState,
  to: PayTarget,
  base: number,
  reason: string,
  opts: { noMultiplier?: boolean } = {},
): PayTask {
  const mult = opts.noMultiplier ? 1 : cardPayMultiplier(c, from);
  const amount = Math.ceil(base * mult - 1e-9);
  let target = to;
  if (to.kind === 'bank' && c.d.cardRules.cardPaymentsToBankGoToFundWhenEnabled) target = { kind: 'fund' };
  return payTask(from.id, target, amount, 'card', reason);
}

export function gain(c: Ctx, p: PlayerState, amount: number, reason: string): void {
  if (amount <= 0 || p.bankrupt) return;
  p.cash += amount;
  emit(c, 'gain', { player: p.id, amount, reason });
}

/** Executes a payment; opens a liquidation decision when cash is short. */
export function execPay(c: Ctx, task: PayTask): void {
  const from = getPlayer(c, task.from);
  if (from.bankrupt || task.amount <= 0) return;
  const to = resolveTarget(c, task.to);
  if (to.kind === 'player') {
    const rec = getPlayer(c, to.id);
    if (rec.id === from.id || rec.bankrupt) {
      emit(c, 'paymentSkipped', { from: from.id, to, amount: task.amount, reason: task.reason });
      return;
    }
  }
  // Con bạc may bet on taxes, fines and card payments (Liều ăn nhiều).
  if (!task.gambled && to.kind !== 'player') {
    const rule = gambleRule(c, from, task.kind, task.amount);
    if (rule) {
      c.s.pending = { type: 'gamble', player: from.id, task };
      emit(c, 'decisionRequired', {
        decision: 'gamble',
        player: from.id,
        amount: task.amount,
        reason: task.reason,
        worst: gambleWorst(rule, task.amount),
      });
      return;
    }
  }
  if (from.cash >= task.amount) {
    from.cash -= task.amount;
    credit(c, to, task.amount);
    emit(c, 'payment', { from: from.id, to, amount: task.amount, kind: task.kind, reason: task.reason });
    if (task.kind === 'rent' && task.owner) onRentPaid(c, task.owner, task.amount);
    return;
  }
  c.s.pending = { type: 'liquidation', player: from.id, task: { ...task, to } };
  emit(c, 'debt', { player: from.id, amount: task.amount, cash: from.cash, to, reason: task.reason });
}

/** Debtor raised enough cash: pay and continue. */
export function settleDebt(c: Ctx): boolean {
  const pend = c.s.pending;
  if (!pend || pend.type !== 'liquidation') return false;
  const p = getPlayer(c, pend.player);
  if (p.cash < pend.task.amount) return false;
  c.s.pending = null;
  execPay(c, pend.task);
  return true;
}

/** Total cash a player could still raise by selling buildings and mortgaging. */
export function liquidationValue(c: Ctx, p: PlayerState): number {
  let total = p.cash;
  for (const id of sideTiles(c, p.id)) {
    const def = c.d.ownables[id];
    const own = c.s.ownables[id];
    if (own.level > 0 && def.buildCost) {
      const levels = own.level === hotelLevel(c) ? hotelLevel(c) : own.level;
      total += Math.floor(levels * def.buildCost * c.d.economy.buildingSellRate);
    }
    if (!own.mortgaged) total += def.mortgage;
  }
  return total;
}

/**
 * Automatic liquidation (timeout / declare bankruptcy): sell buildings, then
 * mortgage, cheapest group first, until `target` cash is reached.
 */
export function autoLiquidate(c: Ctx, p: PlayerState, target: number): void {
  const byPrice = () =>
    sideTiles(c, p.id).sort((a, b) => c.d.ownables[a].price - c.d.ownables[b].price || a.localeCompare(b));
  // 1. Buildings: always take from the highest-level property of the cheapest group (keeps even rule).
  while (p.cash < target) {
    const built = byPrice().filter((id) => c.s.ownables[id].level > 0);
    if (built.length === 0) break;
    const group = c.d.ownables[built[0]].group;
    const inGroup = built.filter((id) => c.d.ownables[id].group === group);
    const top = inGroup.reduce((a, b) => (c.s.ownables[b].level > c.s.ownables[a].level ? b : a));
    sellOneLevel(c, p, top);
  }
  // 2. Mortgage.
  while (p.cash < target) {
    const free = byPrice().filter((id) => !c.s.ownables[id].mortgaged);
    if (free.length === 0) break;
    mortgageProperty(c, p, free[0]);
  }
}

/** Debtor gives up (or liquidation timer ran out). */
export function declareBankruptcy(c: Ctx): void {
  const pend = c.s.pending;
  if (!pend || pend.type !== 'liquidation') return;
  const p = getPlayer(c, pend.player);
  autoLiquidate(c, p, pend.task.amount);
  if (p.cash >= pend.task.amount) {
    settleDebt(c);
    return;
  }
  if (onBankrupt(c, p, pend.task.amount - p.cash)) {
    settleDebt(c);
    return;
  }
  c.s.pending = null;
  goBankrupt(c, p, pend.task);
}

/** Transfers everything to the creditor (player) or the bank, per GDD 4.10. */
export function goBankrupt(c: Ctx, p: PlayerState, task: PayTask): void {
  const target = resolveTarget(c, task.to);
  const followUps: Task[] = [];
  // Team games: the wallet is shared, so the whole team falls together. The teammates'
  // tiles and cards go with the debtor's; the money is already in his copy of the wallet.
  const fallen = activePlayers(c).filter((q) => teammates(c, q.id, p.id));
  for (const q of fallen) {
    for (const id of ownedBy(c, q.id)) c.s.ownables[id].owner = p.id;
    p.jailCards.push(...q.jailCards);
    q.jailCards = [];
    q.cash = 0;
    expireEffectsOf(c, q.id);
  }

  // Buildings back to the bank at the sell rate, cash goes with the rest.
  for (const id of ownedBy(c, p.id)) {
    const own = c.s.ownables[id];
    const def = c.d.ownables[id];
    if (own.level > 0 && def.buildCost) {
      const levels = own.level === hotelLevel(c) ? hotelLevel(c) : own.level;
      p.cash += Math.floor(levels * def.buildCost * c.d.economy.buildingSellRate);
      own.level = 0;
    }
  }
  const paid = p.cash;
  expireEffectsOf(c, p.id);
  const out = new Set([p.id, ...fallen.map((q) => q.id)]);
  c.s.trades = c.s.trades.filter((t) => !out.has(t.from) && !out.has(t.to));

  const creditor = target.kind === 'player' ? getPlayer(c, target.id) : null;
  if (creditor && !creditor.bankrupt) {
    creditor.cash += paid;
    if (task.kind === 'rent' && task.owner) onRentPaid(c, task.owner, paid);
    for (const id of ownedBy(c, p.id)) {
      const own = c.s.ownables[id];
      if (!canOwn(c, creditor, id)) {
        own.owner = null;
        own.mortgaged = false;
        followUps.push({ t: 'auction', propertyId: id });
        continue;
      }
      own.owner = creditor.id;
      if (own.mortgaged) followUps.push({ t: 'inheritMortgage', player: creditor.id, propertyId: id });
    }
    creditor.jailCards.push(...p.jailCards);
  } else {
    credit(c, target, paid);
    for (const id of ownedBy(c, p.id)) {
      const own = c.s.ownables[id];
      own.owner = null;
      own.mortgaged = false;
      own.level = 0;
      followUps.push({ t: 'auction', propertyId: id });
    }
    for (const card of p.jailCards) c.s.decks[c.d.cards[card].deck].push(card);
  }

  p.cash = 0;
  p.jailCards = [];
  for (const q of [p, ...fallen]) {
    q.bankrupt = true;
    dropLoansOf(c, q.id);
    q.inJail = false;
    c.s.bankruptOrder.push(q.id);
  }
  c.s.queue = c.s.queue.filter((t) => {
    if (t.t === 'pay') return !out.has(t.from);
    if ('player' in t) return !out.has(t.player);
    return true;
  });
  emit(c, 'bankrupt', { player: p.id, creditor: creditor?.id ?? target.kind, paid });
  for (const q of fallen) emit(c, 'bankrupt', { player: q.id, creditor: creditor?.id ?? target.kind, paid: 0, team: true });
  if (!checkGameEnd(c)) pushFront(c, ...followUps);
}

/**
 * Đầu hàng: the player leaves the game for good, at any time. Owing money (liquidation),
 * everything goes to the creditor at once, as a bankruptcy without selling first.
 * Otherwise his money and tiles go to the bank (tiles are auctioned) — or, in team games
 * with teammates still playing, his tiles and cards stay with the team, the shared
 * wallet too. Not while another decision of his is waiting.
 */
export function surrender(c: Ctx, p: PlayerState): void {
  if (p.bankrupt) fail('Already out of the game');
  const pend = c.s.pending;
  if (pend?.type === 'liquidation' && pend.player === p.id) {
    c.s.pending = null;
    emit(c, 'surrendered', { player: p.id });
    goBankrupt(c, p, pend.task);
    return;
  }
  if (pend && 'player' in pend && pend.player === p.id) fail('Finish your decision first');
  if (pend?.type === 'sicboBet' && (pend.host === p.id || pend.waiting.includes(p.id))) fail('Finish your decision first');
  if (pend?.type === 'auction') {
    pend.eligible = pend.eligible.filter((id) => id !== p.id);
    if (pend.highBidder === p.id) {
      pend.highBidder = null;
      pend.highBid = 0;
    }
  }
  const heir = activePlayers(c).find((q) => teammates(c, q.id, p.id));
  emit(c, 'surrendered', { player: p.id, ...(heir ? { heir: heir.id } : {}) });
  if (!heir) {
    goBankrupt(c, p, payTask(p.id, { kind: 'bank' }, 0, 'fee', 'surrender'));
    return;
  }
  for (const id of ownedBy(c, p.id)) c.s.ownables[id].owner = heir.id;
  heir.jailCards.push(...p.jailCards);
  p.jailCards = [];
  expireEffectsOf(c, p.id);
  // Offers stay open for the team: the heir sends or answers them now.
  c.s.trades = c.s.trades.map((t) => (t.from === p.id ? { ...t, from: heir.id } : t.to === p.id ? { ...t, to: heir.id } : t));
  // The wallet stays with the team (the sync skips players who are out).
  p.cash = 0;
  p.bankrupt = true;
  p.inJail = false;
  dropLoansOf(c, p.id);
  c.s.bankruptOrder.push(p.id);
  c.s.queue = c.s.queue.filter((t) => {
    if (t.t === 'pay') return t.from !== p.id;
    if ('player' in t) return t.player !== p.id;
    return true;
  });
  checkGameEnd(c);
}

// ---------------------------------------------------------------- game end

/** Quick-mode net worth: cash + list price (mortgaged 50%) + build cost, ± loans owed. */
export function score(c: Ctx, p: PlayerState): number {
  let total = p.cash + loanBalance(c, p);
  for (const id of ownedBy(c, p.id)) {
    const def = c.d.ownables[id];
    const own = c.s.ownables[id];
    total += own.mortgaged ? Math.ceil(def.price * c.d.economy.mortgageRate) : def.price;
    if (def.buildCost) total += own.level * def.buildCost;
  }
  return total;
}

export function finishGame(c: Ctx): void {
  const ranking = c.s.players
    .map((p) => ({ player: p.id, score: p.bankrupt ? -1 : score(c, p) }))
    .sort((a, b) => b.score - a.score);
  // Bankrupt players ranked by reverse elimination order.
  const out = ranking.filter((r) => r.score >= 0);
  const busted = [...c.s.bankruptOrder].reverse().map((id) => ({ player: id, score: 0 }));
  c.s.ranking = [...out, ...busted];
  if (c.s.players.some((p) => p.team !== undefined)) rankTeams(c);
  c.s.winner = out.length ? c.s.ranking[0].player : null;
  c.s.status = 'over';
  c.s.pending = null;
  c.s.queue = [];
  emit(c, 'gameOver', {
    winner: c.s.winner,
    ranking: c.s.ranking,
    ...(c.s.winnerTeam !== undefined ? { team: c.s.winnerTeam } : {}),
  });
}

/**
 * Team games: teams ranked by their net worth (the shared wallet once, plus every member's
 * tiles and loans; a team
 * still standing beats an eliminated one; eliminated teams by how long they lasted);
 * players keep their order inside a team.
 */
function rankTeams(c: Ctx): void {
  const totals = new Map<number, { worth: number; alive: number; lastOut: number }>();
  for (const p of c.s.players) {
    const t = totals.get(p.team!) ?? { worth: 0, alive: 0, lastOut: -1 };
    if (!p.bankrupt) {
      // The wallet is shared: count it once for the team.
      t.worth += score(c, p) - (t.alive > 0 ? p.cash : 0);
      t.alive++;
    } else t.lastOut = Math.max(t.lastOut, c.s.bankruptOrder.indexOf(p.id));
    totals.set(p.team!, t);
  }
  const order = [...totals.entries()]
    .sort(([, a], [, b]) => Number(b.alive > 0) - Number(a.alive > 0) || b.worth - a.worth || b.lastOut - a.lastOut)
    .map(([team]) => team);
  const teamRank = (id: string) => order.indexOf(getPlayer(c, id).team!);
  c.s.ranking = c.s.ranking!
    .map((r, i) => ({ r, i }))
    .sort((a, b) => teamRank(a.r.player) - teamRank(b.r.player) || a.i - b.i)
    .map(({ r }) => r);
  c.s.winnerTeam = order[0] ?? null;
}

export function checkGameEnd(c: Ctx): boolean {
  if (c.s.status === 'over') return true;
  const quickEnd =
    c.s.config.mode === 'quick' && c.s.bankruptOrder.length >= c.d.config.quickMode.endWhenBankrupt;
  if (aliveSides(c) <= 1 || quickEnd) {
    finishGame(c);
    return true;
  }
  return false;
}
