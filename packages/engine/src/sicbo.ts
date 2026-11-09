/**
 * Tài xỉu (sic bo) for Con bạc: three separate dice (never the movement dice).
 * 11–17 = Tài, 4–10 = Xỉu, three of a kind = bão (the house wins every bet).
 *
 * - `gamble_payment` (Liều ăn nhiều): before buying from the bank or paying a
 *   tax / fine / card payment, the player may bet on Tài or Xỉu: win → pay
 *   less, lose → pay more, bão → jackpot.
 * - `host_sicbo` (Mở sòng): every opponent bets the stake in turn order with
 *   the player as the house; winners are paid the stake minus commission.
 */
import { trait } from './characters';
import { emit, fail, getPlayer, pushFront, type Ctx } from './ctx';
import { randomInt, rollDice } from './rng';
import type { Effect, PlayerState, SicboPick, Task } from './types';

export type SicboResult = SicboPick | 'bao';

export function rollSicbo(c: Ctx): { dice: number[]; total: number; result: SicboResult } {
  const dice = rollDice(c.s, 3);
  const total = dice[0] + dice[1] + dice[2];
  const result: SicboResult = dice[0] === dice[1] && dice[1] === dice[2] ? 'bao' : total >= 11 ? 'tai' : 'xiu';
  return { dice, total, result };
}

export function isPick(x: unknown): x is SicboPick {
  return x === 'tai' || x === 'xiu';
}

/** The player's Liều ăn nhiều rule when it covers this kind of payment (`buy`, `tax`, `jail`, `card`). */
export function gambleRule(c: Ctx, p: PlayerState, kind: string, amount: number): Effect | undefined {
  const t = trait(c, p, 'gamble_payment');
  if (!t || p.bankrupt) return undefined;
  if (!(t.kinds as string[]).includes(kind)) return undefined;
  if (amount < ((t.minAmount as number | undefined) ?? 0)) return undefined;
  return t;
}

/** What the payment becomes when the bet is lost. */
export function gambleWorst(rule: Effect, amount: number): number {
  return Math.ceil(amount * (1 + (rule.loseRate as number)) - 1e-9);
}

/** Rolls for a gambled payment and returns the new amount. */
export function gambleAmount(c: Ctx, p: PlayerState, rule: Effect, amount: number, pick: SicboPick, context: string, reason: string): number {
  const r = rollSicbo(c);
  let outcome: 'win' | 'lose' | 'jackpot';
  let to: number;
  if (r.result === 'bao') {
    outcome = 'jackpot';
    to = Math.ceil(amount * (1 - (rule.jackpotRate as number)) - 1e-9);
  } else if (r.result === pick) {
    outcome = 'win';
    to = Math.ceil(amount * (1 - (rule.winRate as number)) - 1e-9);
  } else {
    outcome = 'lose';
    to = gambleWorst(rule, amount);
  }
  emit(c, 'sicbo', { player: p.id, context, reason, pick, dice: r.dice, total: r.total, result: r.result, outcome, from: amount, to });
  return Math.max(0, to);
}

/** Answer to a `gamble` prompt: a pick rolls the dice, null pays the normal amount. */
export function resolveGamble(c: Ctx, p: PlayerState, pick: SicboPick | null): void {
  const pend = c.s.pending;
  if (pend?.type !== 'gamble' || pend.player !== p.id) fail('No payment to gamble on');
  if (pick !== null && !isPick(pick)) fail('Pick tai or xiu');
  c.s.pending = null;
  let amount = pend.task.amount;
  if (pick) {
    const rule = gambleRule(c, p, pend.task.kind, amount);
    if (rule) amount = gambleAmount(c, p, rule, amount, pick, 'payment', pend.task.reason);
  }
  pushFront(c, { ...pend.task, amount, gambled: true });
}

// ---------------------------------------------------------------- Mở sòng

/**
 * Each bettor's stake: a fixed `stake`, or a `pot` split among the opponents and rounded
 * up to `roundTo` (default 10) so the house's edge is worth the same at any table size.
 */
export function sicboStake(skill: Effect, opponents: number): number {
  if (skill.stake !== undefined) return skill.stake as number;
  const step = (skill.roundTo as number | undefined) ?? 10;
  return Math.ceil((skill.pot as number) / Math.max(1, opponents) / step - 1e-9) * step;
}

export function openSicbo(c: Ctx, host: PlayerState, skill: Effect): void {
  const n = c.s.players.length;
  const start = c.s.players.findIndex((x) => x.id === host.id);
  const order: string[] = [];
  for (let i = 1; i < n; i++) {
    const q = c.s.players[(start + i) % n];
    if (!q.bankrupt) order.push(q.id);
  }
  if (order.length === 0) fail('No opponents to play with');
  const stake = sicboStake(skill, order.length);
  c.s.pending = {
    type: 'sicboBet',
    player: order[0],
    host: host.id,
    stake,
    commission: (skill.commission as number | undefined) ?? 0,
    bets: {},
    order,
  };
  emit(c, 'sicboOpened', { host: host.id, stake, order });
  emit(c, 'decisionRequired', { decision: 'sicboBet', player: order[0], host: host.id, stake });
}

export function placeBet(c: Ctx, p: PlayerState, pick: SicboPick): void {
  const pend = c.s.pending;
  if (pend?.type !== 'sicboBet' || pend.player !== p.id) fail('Not your bet');
  if (!isPick(pick)) fail('Pick tai or xiu');
  pend.bets[p.id] = pick;
  emit(c, 'betPlaced', { player: p.id, pick, host: pend.host });
  const i = pend.order.indexOf(p.id);
  const next = pend.order.slice(i + 1).find((id) => !getPlayer(c, id).bankrupt);
  if (next) {
    pend.player = next;
    emit(c, 'decisionRequired', { decision: 'sicboBet', player: next, host: pend.host, stake: pend.stake });
    return;
  }
  c.s.pending = null;
  const r = rollSicbo(c);
  const payout = pend.stake - Math.ceil(pend.stake * pend.commission - 1e-9);
  const winners = Object.keys(pend.bets).filter((id) => pend.bets[id] === r.result);
  const losers = Object.keys(pend.bets).filter((id) => pend.bets[id] !== r.result);
  emit(c, 'sicboRolled', {
    host: pend.host,
    dice: r.dice,
    total: r.total,
    result: r.result,
    bets: pend.bets,
    winners,
    losers,
    stake: pend.stake,
    payout,
  });
  // Losers pay the house first, so it can pay the winners.
  const tasks: Task[] = [
    ...losers.map((id): Task => ({ t: 'pay', from: id, to: { kind: 'player', id: pend.host }, amount: pend.stake, kind: 'other', reason: 'sicbo' })),
    ...winners.map((id): Task => ({ t: 'pay', from: pend.host, to: { kind: 'player', id }, amount: payout, kind: 'other', reason: 'sicbo' })),
  ];
  pushFront(c, ...tasks);
}

/** Server timer ran out on a bet: pick at random. */
export function timeoutBet(c: Ctx): void {
  const pend = c.s.pending;
  if (pend?.type !== 'sicboBet') return;
  placeBet(c, getPlayer(c, pend.player), randomInt(c.s, 2) === 0 ? 'tai' : 'xiu');
}

