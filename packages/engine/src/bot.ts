/**
 * Basic bot (GDD 7.4), shared by the simulator and, later, the server's
 * disconnect / AFK replacement. Pure: reads a state, returns one action.
 *
 * - Buys when it keeps ≥ `buyReserve` after paying.
 * - Builds up to `maxHouses` per tile once it owns a full group.
 * - Bids in auctions up to the list price (never more than its cash).
 * - Rejects trades unless they complete one of its colour groups.
 */
import { buildBlock, buildError, partialFreeBuild, unmortgageCost } from './assets';
import {
  adjustRule,
  buildCostFor,
  canOwn,
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
  groupHasBuildings,
  groupProperties,
  hotelLevel,
  jailMaxTurns,
  opponentsOf,
  ownedBy,
  ownsFullGroup,
  teammates,
} from './ctx';
import { dataFor, type GameData } from './data';
import { applyActionInPlace } from './engine';
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
  unmortgageReserve: 500,
  rentDiscountFrom: 100,
  eventCancelFrom: 60,
  adjustMinGain: 25,
};

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

/**
 * Who must act next: the player a pending decision belongs to, or the
 * current player. Null during an auction (anyone eligible may bid; the
 * server's clock closes it) and when the game is over.
 */
export function actorOf(s: GameState): string | null {
  if (s.status !== 'playing') return null;
  if (s.pending) return s.pending.type === 'auction' ? null : s.pending.player;
  return s.players[s.turn.current].id;
}

/** The next action in an all-bot game (simulator). Null when the game is over. */
export function botAction(s: GameState, data?: GameData, opts: Partial<BotOptions> = {}): Action | null {
  if (s.status !== 'playing') return null;
  const d = data ?? dataFor(s.config.board);
  const offer = s.trades[0];
  if (offer) return botActionFor(s, offer.to, d, opts);
  if (s.pending?.type === 'auction') return auctionAction({ s, ev: [], d });
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
      case 'sicboBet':
        return { type: 'placeBet', player: playerId, pick: botPick(s, playerId) };
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

/** F0 chứng khoán: the opponent's mortgaged tile most worth buying (group completion first). */
function bestMortgagedBuy(c: Ctx, p: PlayerState, premium: number): string | null {
  let best: { id: string; score: number } | null = null;
  for (const [id, own] of Object.entries(c.s.ownables)) {
    if (!own.owner || own.owner === p.id || !own.mortgaged || !canOwn(c, p, id)) continue;
    const def = c.d.ownables[id];
    if (groupHasBuildings(c, def.group, own.owner)) continue;
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
    if (level >= o.maxHouses) continue;
    if (p.cash - buildCostFor(c, p, id) < o.buildReserve) continue;
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

/** Tiles of `group` not owned by `playerId`. */
function missing(c: Ctx, playerId: string, group: string): string[] {
  return groupProperties(c, group).filter((id) => c.s.ownables[id].owner !== playerId);
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
  const gift = teamGift(c, p);
  if (gift) return gift;
  for (const g of groups) {
    const need = missing(c, p.id, g);
    if (need.length === 0 || need.length === groupProperties(c, g).length || !tradable(c, g)) continue;
    const owners = new Set(need.map((id) => c.s.ownables[id].owner));
    if (owners.size !== 1) continue;
    const qId = [...owners][0];
    if (!qId || need.some((id) => c.s.ownables[id].mortgaged || !canOwn(c, p, id))) continue;
    const q = getPlayer(c, qId);
    for (const h of groups) {
      if (h === g || !tradable(c, h)) continue;
      const give = missing(c, q.id, h);
      if (give.length === 0 || give.length === groupProperties(c, h).length) continue;
      if (!give.every((id) => c.s.ownables[id].owner === p.id && !c.s.ownables[id].mortgaged && canOwn(c, q, id))) continue;
      return { type: 'proposeTrade', player: p.id, to: q.id, offer: { properties: give }, request: { properties: need } };
    }
  }
  return null;
}

/**
 * Team games: hand a teammate the last tiles of a colour group it is closer to completing
 * (it holds more of the group than this bot, and this bot holds all it is missing).
 */
function teamGift(c: Ctx, p: PlayerState): Action | null {
  for (const q of activePlayers(c)) {
    if (!teammates(c, p.id, q.id)) continue;
    for (const g of Object.keys(c.d.groups)) {
      if (!tradable(c, g)) continue;
      const need = missing(c, q.id, g);
      const held = groupProperties(c, g).length - need.length;
      if (need.length === 0 || held === 0 || need.length >= held) continue;
      if (!need.every((id) => c.s.ownables[id].owner === p.id && !c.s.ownables[id].mortgaged && canOwn(c, q, id))) continue;
      return { type: 'proposeTrade', player: p.id, to: q.id, offer: { properties: need }, request: { properties: [] } };
    }
  }
  return null;
}

/**
 * GDD 7.4: accept only if the trade completes one of the bot's colour groups. In team games
 * a teammate's offer is also fine when it completes a group for the teammate and breaks none of ours.
 */
export function botAcceptsTrade(s: GameState, playerId: string, trade: Trade, data?: GameData): boolean {
  const d = data ?? dataFor(s.config.board);
  if (trade.to !== playerId) return false;
  const c: Ctx = { s, ev: [], d };
  if (teammates(c, playerId, trade.from)) {
    const mine = new Set([...ownedBy(c, playerId).filter((id) => !trade.request.properties.includes(id)), ...trade.offer.properties]);
    const theirs = new Set([...ownedBy(c, trade.from).filter((id) => !trade.offer.properties.includes(id)), ...trade.request.properties]);
    const breaks = Object.keys(d.groups).some((g) => ownsFullGroup(c, playerId, g) && !groupProperties(c, g).every((id) => mine.has(id)));
    const completes = Object.entries(d.groups).some(
      ([g, def]) =>
        (!ownsFullGroup(c, playerId, g) && def.properties.every((id) => mine.has(id))) ||
        (!ownsFullGroup(c, trade.from, g) && def.properties.every((id) => theirs.has(id))),
    );
    const cashOk = (trade.request.cash ?? 0) <= (trade.offer.cash ?? 0) + getPlayer(c, playerId).cash / 4;
    if (!breaks && completes && cashOk) return true;
  }
  const after = new Set([...ownedBy(c, playerId).filter((id) => !trade.request.properties.includes(id)), ...trade.offer.properties]);
  return Object.entries(d.groups).some(
    ([g, def]) => !ownsFullGroup(c, playerId, g) && def.properties.every((id) => after.has(id)),
  );
}

