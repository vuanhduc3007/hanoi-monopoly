/**
 * Basic bot (GDD 7.4), shared by the simulator and, later, the server's
 * disconnect / AFK replacement. Pure: reads a state, returns one action.
 *
 * - Buys when it keeps ≥ `buyReserve` after paying.
 * - Builds up to `maxHouses` per tile once it owns a full group, and on to a hotel when rich.
 * - Bids in auctions up to the list price (never more than its cash).
 * - Rejects trades unless they complete one of its colour groups.
 */
import { buildBlock, buildError, moveHouseBlock, partialFreeBuild, unmortgageCost } from './assets';
import {
  adjustRule,
  buildCostFor,
  canOwn,
  flashSalePrice,
  postRollOptions,
  purchasePrice,
  salaryFor,
  skillAvailable,
  skillOf,
  taxAmount,
  trait,
} from './characters';
import {
  activePlayers,
  type Ctx,
  getPlayer,
  sideHasBuildings,
  groupProperties,
  hotelLevel,
  jailMaxTurns,
  opponentsOf,
  ownedBy,
  ownedBySide,
  ownsFullGroup,
} from './ctx';
import { dataFor, type GameData } from './data';
import { applyActionInPlace, buyoutBlock, buyoutPrice, portalTargets } from './engine';
import { loanOffer } from './loans';
import { quoteRent } from './rent';
import { gambleRule, gambleWorst, sicboStake } from './sicbo';
import type { Action, GameState, PlayerState, Trade } from './types';

export interface BotOptions {
  /** Cash to keep after buying at list price. */
  buyReserve: number;
  /** Cash to keep after building. */
  buildReserve: number;
  /** Stop building at this many houses per tile. */
  maxHouses: number;
  /** Past maxHouses (up to a hotel) only while this much cash is left after building. */
  richReserve: number;
  /** Cash to keep after unmortgaging. */
  unmortgageReserve: number;
  /** Ăn vạ is worth it from this rent upward (or when the rent exceeds cash). */
  rentDiscountFrom: number;
  /** Giải hạn is worth it when it saves at least this much. */
  eventCancelFrom: number;
  /** Tài xế Grab spends a ±1 only when it improves the landing by this much. */
  adjustMinGain: number;
}

export const BOT_DEFAULTS: BotOptions = {
  buyReserve: 200,
  buildReserve: 200,
  maxHouses: 3,
  richReserve: 1000,
  unmortgageReserve: 500,
  rentDiscountFrom: 100,
  eventCancelFrom: 60,
  adjustMinGain: 25,
};

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

/**
 * Who must act next: the player a pending decision belongs to, or the
 * current player. Null during an auction (anyone eligible may bid; the
 * server's clock closes it), during Mở sòng (everyone bets at once) and
 * when the game is over.
 */
export function actorOf(s: GameState): string | null {
  if (s.status !== 'playing') return null;
  if (s.pending) return s.pending.type === 'auction' || s.pending.type === 'sicboBet' ? null : s.pending.player;
  return s.players[s.turn.current].id;
}

/** The next action in an all-bot game (simulator). Null when the game is over. */
export function botAction(s: GameState, data?: GameData, opts: Partial<BotOptions> = {}): Action | null {
  if (s.status !== 'playing') return null;
  const d = data ?? dataFor(s.config.board);
  const offer = s.trades[0];
  if (offer) return botActionFor(s, offer.to, d, opts);
  if (s.pending?.type === 'auction') return auctionAction({ s, ev: [], d });
  if (s.pending?.type === 'sicboBet') return botActionFor(s, s.pending.waiting[0], d, opts);
  return botActionFor(s, actorOf(s)!, d, opts);
}

/**
 * What the bot playing `playerId` does now, or null if that player has
 * nothing to do (server: disconnected / AFK players). In auctions it raises
 * by the minimum step while the price is below its valuation.
 */
export function botActionFor(
  s: GameState,
  playerId: string,
  data?: GameData,
  opts: Partial<BotOptions> = {},
): Action | null {
  if (s.status !== 'playing') return null;
  const d = data ?? dataFor(s.config.board);
  const o = { ...BOT_DEFAULTS, ...opts };
  const c: Ctx = { s, ev: [], d };
  const me = getPlayer(c, playerId);
  if (me.bankrupt) return null;
  // A teammate wants the team to surrender: the bot standing in goes along.
  const votes = me.team !== undefined ? s.surrenderVotes?.[String(me.team)] : undefined;
  if (votes?.length && !votes.includes(playerId)) return { type: 'teamSurrender', player: playerId, agree: true };
  const offer = s.trades.find((t) => t.to === playerId);
  if (offer) {
    return { type: 'respondTrade', player: playerId, tradeId: offer.id, accept: botAcceptsTrade(s, playerId, offer, d) };
  }
  const pend = s.pending;
  if (pend?.type === 'auction') {
    if (!pend.eligible.includes(playerId) || pend.highBidder === playerId) return null;
    const { startBid, minIncrement } = d.economy.auction;
    const minBid = pend.highBidder ? pend.highBid + minIncrement : startBid;
    const value = Math.min(d.ownables[pend.propertyId].price, me.cash);
    return value >= minBid ? { type: 'bid', player: playerId, amount: minBid } : null;
  }
  if (pend?.type === 'sicboBet') {
    return pend.waiting.includes(playerId) ? { type: 'placeBet', player: playerId, pick: botPick(s, playerId) } : null;
  }
  if (actorOf(s) !== playerId) return null;
  if (pend) {
    switch (pend.type) {
      case 'buy': {
        if (me.cash - pend.price < o.buyReserve) return { type: 'declineBuy', player: playerId };
        // Con bạc bets when even a lost bet leaves the reserve.
        const rule = gambleRule(c, me, 'buy', pend.price);
        const bet = rule && me.cash - gambleWorst(rule, pend.price) >= o.buyReserve;
        return bet ? { type: 'buy', player: playerId, gamble: botPick(s, playerId) } : { type: 'buy', player: playerId };
      }
      case 'gamble': {
        const rule = gambleRule(c, me, pend.task.kind, pend.task.amount);
        const bet = rule && me.cash - gambleWorst(rule, pend.task.amount) >= o.buildReserve;
        return { type: 'gamble', player: playerId, pick: bet ? botPick(s, playerId) : null };
      }
      case 'postRoll':
        return postRollAction(c, me, pend.dice, pend.context, o);
      case 'chooseCard':
        return chooseCardAction(c, playerId, pend.options);
      case 'revealCard':
        return { type: 'revealCard', player: playerId };
      case 'payRent': {
        const worth = pend.discount && (pend.task.amount >= o.rentDiscountFrom || pend.task.amount > me.cash);
        return { type: worth ? 'useSkill' : 'payRent', player: playerId };
      }
      case 'eventCancel':
        return eventCancelAction(c, playerId, pend.cardId, o);
      case 'liquidation':
        // Vay nóng beats selling houses and mortgaging (it is paid back from the next salary).
        if (loanOffer(c, playerId)) return { type: 'borrow', player: playerId };
        return { type: 'declareBankruptcy', player: playerId };
      case 'inheritMortgage': {
        const cost = unmortgageCost(c, me, pend.propertyId);
        return { type: 'resolveMortgage', player: playerId, unmortgage: me.cash - cost >= o.buildReserve };
      }
    }
  }
  return s.turn.phase === 'roll' ? beforeRoll(c, me) : endOfTurn(c, me, o);
}

// ---------------------------------------------------------------- own turn

function beforeRoll(c: Ctx, p: PlayerState): Action {
  if (p.inJail) {
    if (skillAvailable(c, p, 'free_jail_exit')) return { type: 'useSkill', player: p.id };
    if (p.jailCards.length > 0) return { type: 'useJailCard', player: p.id };
    const unowned = Object.values(c.s.ownables).filter((x) => !x.owner).length;
    if (unowned >= 10 && p.cash >= c.d.economy.jailFine + 300) return { type: 'payJailFine', player: p.id };
    return { type: 'roll', player: p.id };
  }
  if (c.s.turn.dice === null) {
    const skill = turnStartSkill(c, p);
    if (skill) return skill;
  }
  return { type: 'roll', player: p.id };
}

/** Tài or Xỉu: equal odds, so any deterministic choice will do. */
function botPick(s: GameState, playerId: string): 'tai' | 'xiu' {
  const seat = s.players.findIndex((x) => x.id === playerId);
  return (s.turn.number + seat + s.nextUid) % 2 === 0 ? 'tai' : 'xiu';
}

/** Bóc phốt / Tung tin quy hoạch / Mở sòng / Họp tổ / Bắt đáy at the start of the turn when worth it. */
function turnStartSkill(c: Ctx, p: PlayerState): Action | null {
  const sk = skillOf(c, p);
  if (sk && skillAvailable(c, p, sk.type)) {
    const opponents = opponentsOf(c, p);
    if (sk.type === 'collect_contribution' && opponents.length > 0) return { type: 'useSkill', player: p.id };
    if (sk.type === 'host_sicbo' && opponents.length > 0 && p.cash >= sicboStake(sk, opponents.length) * opponents.length) {
      return { type: 'useSkill', player: p.id };
    }
    if (sk.type === 'buy_mortgaged') {
      const pick = bestMortgagedBuy(c, p, sk.premium as number);
      if (pick) return { type: 'useSkill', player: p.id, propertyId: pick };
    }
    if (sk.type === 'travel') {
      const to = bestTravel(c, p);
      if (to !== null) return { type: 'useSkill', player: p.id, position: to };
    }
    if (sk.type === 'flash_sale') {
      const pick = bestUnowned(c, p, (id) => flashSalePrice(c, sk, id), undefined, sk.completesGroup === false);
      if (pick) return { type: 'useSkill', player: p.id, propertyId: c.d.board[pick.pos].ref };
    }
    if (sk.type === 'raise_rent') {
      const pick = bestRaise(c, p, sk.maxPerTile as number);
      if (pick) return { type: 'useSkill', player: p.id, propertyId: pick };
    }
    if (sk.type === 'forced_loan' && opponents.length > 0 && p.cash - (sk.amount as number) >= 300) {
      return { type: 'useSkill', player: p.id };
    }
    // Mở cổng gives up the roll (and its trip round the board): only for a clearly better tile.
    if (sk.type === 'scholarship') return { type: 'useSkill', player: p.id };
    if (sk.type === 'buyout') {
      const pick = bestBuyout(c, p, (id) => buyoutPrice(c, sk, id));
      if (pick) return { type: 'useSkill', player: p.id, propertyId: pick };
    }
    if (sk.type === 'portal') {
      const pick = bestPortal(c, p);
      if (pick && pick.value >= rollWorth(c, p) + 60) return { type: 'useSkill', player: p.id, target: pick.target };
    }
  }
  if (skillAvailable(c, p, 'block_rent')) {
    let best: { id: string; levels: number } | null = null;
    for (const opp of opponentsOf(c, p)) {
      const levels = ownedBy(c, opp.id).reduce((a, id) => a + c.s.ownables[id].level, 0);
      if (levels >= 6 && (!best || levels > best.levels)) best = { id: opp.id, levels };
    }
    if (best) return { type: 'useSkill', player: p.id, target: best.id };
  }
  if (skillAvailable(c, p, 'rent_multiplier')) {
    let best: { group: string; rent: number } | null = null;
    for (const [group, g] of Object.entries(c.d.groups)) {
      if (!ownsFullGroup(c, p.id, group)) continue;
      const levels = g.properties.map((id) => c.s.ownables[id].level);
      if (Math.min(...levels) < 2) continue;
      const rent = g.properties.reduce((a, id) => a + rentAtLevel(c, id), 0);
      if (!best || rent > best.rent) best = { group, rent };
    }
    if (best) return { type: 'useSkill', player: p.id, group: best.group };
  }
  return null;
}

/**
 * Du lịch: go and buy the unowned tile that does the most for the bot's colour groups
 * (completing one first), when it can pay and keep its reserve. Otherwise just roll.
 */
function bestTravel(c: Ctx, p: PlayerState): number | null {
  return bestUnowned(c, p, (id) => c.d.ownables[id].price, p.position)?.pos ?? null;
}

/**
 * The unowned tile (by board index) that does the most for the bot's colour groups at
 * `priceOf`, when it keeps its reserve; null below a useful score.
 */
function bestUnowned(
  c: Ctx,
  p: PlayerState,
  priceOf: (id: string) => number,
  skipPos?: number,
  noCompleting = false,
): { pos: number; score: number } | null {
  let best: { pos: number; score: number } | null = null;
  c.d.board.forEach((tile, pos) => {
    const id = tile.ref;
    if (!id || pos === skipPos || !c.s.ownables[id] || c.s.ownables[id].owner || !canOwn(c, p, id)) return;
    const def = c.d.ownables[id];
    if (p.cash - priceOf(id) < BOT_DEFAULTS.buyReserve) return;
    let score = 0;
    if (def.group) {
      const group = groupProperties(c, def.group);
      const held = group.filter((g) => ownedBySide(c, g, p.id)).length;
      if (held === 0 || (noCompleting && held === group.length - 1)) return;
      score = held === group.length - 1 ? 1000 + def.price : held * 100 + def.price / 10;
    } else {
      const kind = def.kind;
      const held = ownedBy(c, p.id).filter((x) => c.d.ownables[x].kind === kind).length;
      if (held === 0) return;
      score = held * 80;
    }
    if (!best || score > best.score) best = { pos, score };
  });
  const pick = best as { pos: number; score: number } | null;
  // Flash sale that may not complete a group: any tile joining a group already started.
  return pick && pick.score >= (noCompleting ? 100 : 200) ? pick : null;
}

/** Thiếu gia Vin: the lone opponent tile that does the most for his groups (completion first). */
function bestBuyout(c: Ctx, p: PlayerState, priceOf: (id: string) => number): string | null {
  let best: { id: string; score: number } | null = null;
  for (const id of Object.keys(c.s.ownables)) {
    if (buyoutBlock(c, p, id) !== null || p.cash - priceOf(id) < 300) continue;
    const def = c.d.ownables[id];
    let score: number;
    if (def.group) {
      const group = groupProperties(c, def.group);
      const held = group.filter((g) => ownedBySide(c, g, p.id)).length;
      if (held === 0) continue;
      score = held === group.length - 1 ? 1000 + def.price : held * 100;
    } else {
      const held = ownedBy(c, p.id).filter((x) => c.d.ownables[x].kind === def.kind).length;
      if (held === 0) continue;
      score = held * 80;
    }
    if (!best || score > best.score) best = { id, score };
  }
  // Paying 150%+ for a tile only pays off when it nearly completes a set (or completes one,
  // where allowed): a bot that bought every lone tile lost 6–13 points in Nhanh / Đội games.
  return best && best.score >= 200 ? best.id : null;
}

/** Chủ trọ: raise the tile that already earns the most. */
function bestRaise(c: Ctx, p: PlayerState, maxPerTile: number): string | null {
  let best: { id: string; rent: number } | null = null;
  for (const id of ownedBy(c, p.id)) {
    const def = c.d.ownables[id];
    if (def.kind !== 'property' || c.s.ownables[id].mortgaged || (p.rentBoosts?.[id] ?? 0) >= maxPerTile) continue;
    const full = def.group ? ownsFullGroup(c, p.id, def.group) : false;
    const rent = rentAtLevel(c, id) * (full && c.s.ownables[id].level === 0 ? 2 : 1);
    if (!best || rent > best.rent) best = { id, rent };
  }
  return best && best.rent >= 20 ? best.id : null;
}

/** Thầy phong thủy: the house move that raises rent the most (at least `minGain`). */
function bestHouseMove(c: Ctx, p: PlayerState, minGain: number): { from: string; to: string } | null {
  const mine = ownedBy(c, p.id).filter((id) => c.d.ownables[id].kind === 'property');
  let best: { from: string; to: string; gain: number } | null = null;
  for (const from of mine) {
    if (c.s.ownables[from].level === 0) continue;
    for (const to of mine) {
      if (moveHouseBlock(c, p, from, to) !== null) continue;
      const before = rentAtLevel(c, from) + rentAtLevel(c, to);
      c.s.ownables[from].level -= 1;
      c.s.ownables[to].level += 1;
      const after = rentAtLevel(c, from) + rentAtLevel(c, to);
      c.s.ownables[from].level += 1;
      c.s.ownables[to].level -= 1;
      const gain = after - before;
      if (gain >= minGain && (!best || gain > best.gain)) best = { from, to, gain };
    }
  }
  return best;
}

/**
 * Bác sĩ lạ: the best opponent to swap with — the tile he reaches (no salary on a swap)
 * plus what the opponent pays landing on his old tile (rent to his side).
 */
function bestPortal(c: Ctx, p: PlayerState): { target: string; value: number } | null {
  const salary = salaryFor(c, p);
  let best: { target: string; value: number } | null = null;
  for (const q of portalTargets(c, p)) {
    // landingValue counts the salary for a tile behind us; a swap never pays it.
    let value = landingValue(c, p, q.position, 7) - (q.position < p.position ? salary : 0);
    const ref = c.d.board[p.position].ref;
    const own = c.s.ownables[ref];
    if (own?.owner && ownedBySide(c, ref, p.id)) value += quoteRent(c, q, ref, {}, 7).amount;
    if (!best || value > best.value) best = { target: q.id, value };
  }
  return best;
}

/** Average worth of an ordinary roll's landing (two dice, salary included). */
function rollWorth(c: Ctx, p: PlayerState): number {
  const n = c.d.board.length;
  let total = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) total += landingValue(c, p, (p.position + a + b) % n, a + b);
  }
  return total / 36;
}

/** F0 chứng khoán: the opponent's mortgaged tile most worth buying (group completion first). */
function bestMortgagedBuy(c: Ctx, p: PlayerState, premium: number): string | null {
  let best: { id: string; score: number } | null = null;
  for (const [id, own] of Object.entries(c.s.ownables)) {
    if (!own.owner || own.owner === p.id || !own.mortgaged || !canOwn(c, p, id)) continue;
    const def = c.d.ownables[id];
    // Same rule as the engine: no buildings on the owner's side of the group (teammates' too).
    if (sideHasBuildings(c, def.group, own.owner)) continue;
    const cost = Math.ceil(def.mortgage * (1 + premium) - 1e-9);
    // Needs the unmortgage money later too.
    if (p.cash - cost - def.mortgage < 300) continue;
    let score = def.price;
    if (def.group) {
      const group = groupProperties(c, def.group);
      const mine = group.filter((g) => c.s.ownables[g].owner === p.id).length;
      score += mine * 400 + (mine === group.length - 1 ? 1000 : 0);
    }
    if (!best || score > best.score) best = { id, score };
  }
  return best?.id ?? null;
}

function rentAtLevel(c: Ctx, id: string): number {
  const def = c.d.ownables[id];
  const lvl = c.s.ownables[id].level;
  if (!def.rent) return 0;
  if (lvl === 0) return def.rent.base;
  if (lvl === hotelLevel(c)) return def.rent.hotel;
  return def.rent[`h${lvl}` as 'h1'];
}

function endOfTurn(c: Ctx, p: PlayerState, o: BotOptions): Action {
  // Mở cổng after the roll: a free second landing, worth it for a clearly good swap.
  if (skillAvailable(c, p, 'portal') && !p.inJail) {
    const pick = bestPortal(c, p);
    if (pick && pick.value >= 120) return { type: 'useSkill', player: p.id, target: pick.target };
  }
  // Unmortgage what completes a group first, then the cheapest.
  const mortgaged = ownedBy(c, p.id)
    .filter((id) => c.s.ownables[id].mortgaged)
    .sort((a, b) => {
      const ga = c.d.ownables[a].group;
      const gb = c.d.ownables[b].group;
      const fa = ga && ownsFullGroup(c, p.id, ga) ? 0 : 1;
      const fb = gb && ownsFullGroup(c, p.id, gb) ? 0 : 1;
      return fa - fb || c.d.ownables[a].price - c.d.ownables[b].price;
    });
  for (const id of mortgaged) {
    if (p.cash - unmortgageCost(c, p, id) >= o.unmortgageReserve) return { type: 'unmortgage', player: p.id, propertyId: id };
  }
  // One offer at a time, and at most one per partner each turn: an unanswered or refused
  // offer must not be sent again and again (the server asks bots in seat order).
  const swap = c.s.trades.some((t) => t.from === p.id) ? null : findSwap(c, p);
  if (swap && swap.type === 'proposeTrade' && !(c.s.turn.offeredTo ?? []).includes(swap.to)) return swap;
  // Build evenly, most valuable group first, up to maxHouses.
  const candidates = ownedBy(c, p.id)
    .filter((id) => c.d.ownables[id].kind === 'property')
    .sort((a, b) => c.d.ownables[b].price - c.d.ownables[a].price);
  // Thầy phong thủy: move a house where it earns more.
  if (skillAvailable(c, p, 'move_house')) {
    const mv = bestHouseMove(c, p, 30);
    if (mv) return { type: 'useSkill', player: p.id, from: mv.from, propertyId: mv.to };
  }
  // Thợ xây: the free house goes on the priciest tile that may take one.
  if (skillAvailable(c, p, 'free_build')) {
    for (const id of candidates) {
      if (c.s.ownables[id].level < o.maxHouses && buildBlock(c, p, id, 0, partialFreeBuild(c, p)) === null) {
        return { type: 'useSkill', player: p.id, propertyId: id };
      }
    }
  }
  for (const id of candidates) {
    const level = c.s.ownables[id].level;
    // Up to maxHouses with a small reserve; with money to spare, on to a hotel — which puts
    // its houses back in the bank (a bot holding at 3 houses everywhere starves the stock).
    const reserve = level >= o.maxHouses ? o.richReserve : o.buildReserve;
    if (p.cash - buildCostFor(c, p, id) < reserve) continue;
    if (buildError(c, p, id) === null) return { type: 'build', player: p.id, propertyId: id };
  }
  return { type: 'endTurn', player: p.id };
}

// ---------------------------------------------------------------- auctions

/**
 * English-auction shortcut: the bidder with the highest valuation bids just
 * above the runner-up's valuation, so an auction takes 1–2 actions.
 */
function auctionAction(c: Ctx): Action {
  const pend = c.s.pending;
  if (pend?.type !== 'auction') return { type: 'closeAuction' };
  const { startBid, minIncrement } = c.d.economy.auction;
  const price = c.d.ownables[pend.propertyId].price;
  const value = (p: PlayerState) => Math.min(price, p.cash);
  const bidders = c.s.players.filter((p) => pend.eligible.includes(p.id) && !p.bankrupt);
  const minBid = pend.highBidder ? pend.highBid + minIncrement : startBid;
  const challengers = bidders.filter((p) => p.id !== pend.highBidder && value(p) >= minBid);
  if (challengers.length === 0) return { type: 'closeAuction' };
  const top = challengers.reduce((a, b) => (value(b) > value(a) ? b : a));
  const others = bidders.filter((p) => p.id !== top.id).map(value);
  const runnerUp = Math.max(0, ...others);
  const target = Math.min(value(top), Math.max(minBid, runnerUp + minIncrement));
  const amount = Math.max(minBid, Math.floor(target / minIncrement) * minIncrement);
  return { type: 'bid', player: top.id, amount };
}

// ---------------------------------------------------------------- Tài xế Grab

/** Rough value of stopping on `pos` (positive = good). */
export function landingValue(c: Ctx, p: PlayerState, pos: number, diceSum: number): number {
  const n = c.d.board.length;
  let v = p.position + ((pos - p.position + n) % n) >= n && pos !== p.position ? salaryFor(c, p) : 0;
  const tile = c.d.board[pos];
  switch (tile.type) {
    case 'property':
    case 'transport':
    case 'utility': {
      const own = c.s.ownables[tile.ref];
      if (!own.owner) {
        const price = purchasePrice(c, p, tile.ref);
        if (canOwn(c, p, tile.ref) && p.cash - price >= BOT_DEFAULTS.buyReserve) v += Math.round(price * 0.3);
      } else if (own.owner !== p.id) {
        v -= quoteRent(c, p, tile.ref, {}, diceSum).amount;
      }
      break;
    }
    case 'tax':
      v -= taxAmount(c, p, tile.ref);
      break;
    case 'corner':
      if (tile.ref === 'GOTOJAIL' && !trait(c, p, 'ignore_go_to_jail_tile')) v -= 100;
      if (tile.ref === 'PARK' && c.s.config.scholarshipFund) v += c.s.fund;
      break;
    default:
      v -= 10;
  }
  return v;
}

function postRollAction(c: Ctx, p: PlayerState, dice: number[], context: 'normal' | 'jail', o: BotOptions): Action {
  const doubles = dice.length === 2 && dice[0] === dice[1];
  const sum = dice.reduce((a, b) => a + b, 0);
  const n = c.d.board.length;
  if (context === 'jail' && !doubles && p.jailTurns + 1 < jailMaxTurns(c)) {
    return skillAvailable(c, p, 'reroll') && p.cash < 200
      ? { type: 'useSkill', player: p.id }
      : { type: 'confirmRoll', player: p.id };
  }
  const rule = adjustRule(c, p);
  const deltas = rule && postRollOptions(c, p).adjust ? [0, ...rule.directions] : [0];
  const stay = landingValue(c, p, (p.position + sum + n) % n, sum);
  let best = { delta: 0, value: stay };
  for (const delta of deltas) {
    if (delta === 0) continue;
    const value = landingValue(c, p, (p.position + sum + delta + n) % n, sum) - rule!.cost;
    if (value - stay >= o.adjustMinGain && value > best.value) best = { delta, value };
  }
  if (best.value <= -200 && skillAvailable(c, p, 'reroll')) return { type: 'useSkill', player: p.id };
  if (best.delta !== 0) return { type: 'adjustStep', player: p.id, delta: best.delta };
  return { type: 'confirmRoll', player: p.id };
}

// ---------------------------------------------------------------- Nghiện Tarot

function outcomeValue(s: GameState, playerId: string): number {
  const p = s.players.find((x) => x.id === playerId)!;
  return p.cash - (p.inJail ? 100 : 0) - (p.bankrupt ? 10_000 : 0);
}

/** Try each card on a throwaway copy and keep the better one. */
function chooseCardAction(c: Ctx, playerId: string, options: string[]): Action {
  let best = { card: options[0], value: -Infinity };
  for (const card of options) {
    const sim = clone(c.s);
    applyActionInPlace(sim, { type: 'chooseCard', player: playerId, cardId: card }, c.d);
    const value = outcomeValue(sim, playerId);
    if (value > best.value) best = { card, value };
  }
  return { type: 'chooseCard', player: playerId, cardId: best.card };
}

function eventCancelAction(c: Ctx, playerId: string, cardId: string, o: BotOptions): Action {
  const p = getPlayer(c, playerId);
  const card = c.d.cards[cardId];
  let saved: number;
  if (card.kind === 'duration') {
    // Only the build freeze clearly hurts a bot that is about to build.
    const canBuild = Object.keys(c.d.groups).some(
      (g) => ownsFullGroup(c, p.id, g) && groupProperties(c, g).some((id) => c.s.ownables[id].level < o.maxHouses),
    );
    saved = card.effect.type === 'build_freeze' && canBuild ? o.eventCancelFrom : 0;
  } else {
    const use = clone(c.s);
    applyActionInPlace(use, { type: 'useSkill', player: playerId }, c.d);
    const decline = clone(c.s);
    applyActionInPlace(decline, { type: 'declineSkill', player: playerId }, c.d);
    saved = outcomeValue(use, playerId) - outcomeValue(decline, playerId);
  }
  return { type: saved >= o.eventCancelFrom ? 'useSkill' : 'declineSkill', player: playerId };
}

// ---------------------------------------------------------------- trades

/** Tiles of `group` not held by `playerId`'s side (teammates' tiles count as held). */
function missing(c: Ctx, playerId: string, group: string): string[] {
  return groupProperties(c, group).filter((id) => !ownedBySide(c, id, playerId));
}

function tradable(c: Ctx, group: string): boolean {
  return groupProperties(c, group).every((id) => c.s.ownables[id].level === 0);
}

/**
 * Propose a swap that completes a group for both sides — the only kind of
 * offer another bot accepts (GDD 7.4), so bot games still form monopolies.
 */
function findSwap(c: Ctx, p: PlayerState): Action | null {
  const groups = Object.keys(c.d.groups);
  for (const g of groups) {
    const need = missing(c, p.id, g);
    if (need.length === 0 || need.length === groupProperties(c, g).length || !tradable(c, g)) continue;
    // One other side holds them all (in team games: any of its members).
    const qId = c.s.ownables[need[0]].owner;
    if (!qId || need.some((id) => !ownedBySide(c, id, qId) || c.s.ownables[id].mortgaged || !canOwn(c, p, id))) continue;
    const q = getPlayer(c, qId);
    for (const h of groups) {
      if (h === g || !tradable(c, h)) continue;
      const give = missing(c, q.id, h);
      if (give.length === 0 || give.length === groupProperties(c, h).length) continue;
      if (!give.every((id) => ownedBySide(c, id, p.id) && !c.s.ownables[id].mortgaged && canOwn(c, q, id))) continue;
      return { type: 'proposeTrade', player: p.id, to: q.id, offer: { properties: give }, request: { properties: need } };
    }
  }
  return null;
}

/**
 * GDD 7.4: accept only if the trade completes one of the bot's colour groups (in team
 * games: its team's — teammates' tiles count together).
 */
export function botAcceptsTrade(s: GameState, playerId: string, trade: Trade, data?: GameData): boolean {
  const d = data ?? dataFor(s.config.board);
  if (trade.to !== playerId) return false;
  const c: Ctx = { s, ev: [], d };
  const side = Object.keys(c.s.ownables).filter((id) => ownedBySide(c, id, playerId));
  const after = new Set([...side.filter((id) => !trade.request.properties.includes(id)), ...trade.offer.properties]);
  return Object.entries(d.groups).some(
    ([g, def]) => !ownsFullGroup(c, playerId, g) && def.properties.every((id) => after.has(id)),
  );
}

