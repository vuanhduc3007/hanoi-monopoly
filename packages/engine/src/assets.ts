import { buildCostFor, canOwn, maxLevel, skillOf } from './characters';
import {
  emit,
  fail,
  getPlayer,
  groupProperties,
  hotelLevel,
  housesForHotel,
  isMyTurn,
  ownableDef,
  ownedBy,
  ownedBySide,
  ownsFullGroup,
  sideHasBuildings,
  type Ctx,
} from './ctx';
import { buildFreezeActive, unmortgageInterestRate } from './effects';
import { execPay, payTask } from './money';
import type { PlayerState, Trade, TradeBundle } from './types';

// ---------------------------------------------------------------- stock

export function buildingStock(c: Ctx): { houses: number; hotels: number } {
  const H = housesForHotel(c);
  let houses = 0;
  let hotels = 0;
  for (const own of Object.values(c.s.ownables)) {
    if (own.level === H + 1) hotels++;
    else houses += own.level;
  }
  const limit = c.d.economy.buildingLimit;
  return { houses: limit.houses - houses, hotels: limit.hotels - hotels };
}

/**
 * Own turn (free phase or deciding on a purchase), or raising cash for something the
 * player owes: a debt, a rent prompt (Ăn vạ) or a tài xỉu bet (selling / mortgaging only).
 */
function canManage(c: Ctx, p: PlayerState, allowLiquidation: boolean): boolean {
  const pend = c.s.pending;
  const owing = pend?.type === 'liquidation' || pend?.type === 'payRent' || pend?.type === 'gamble';
  if (allowLiquidation && owing && pend.player === p.id) return true;
  if (!isMyTurn(c, p.id)) return false;
  return pend === null || (pend.type === 'buy' && pend.player === p.id);
}

function sellValue(c: Ctx, buildCost: number): number {
  return Math.floor(buildCost * c.d.economy.buildingSellRate);
}

// ---------------------------------------------------------------- build / sell

/** Why a player may not build on a tile right now (codes the client explains in Vietnamese). */
export type BuildBlock =
  | 'notYourTurn'
  | 'notBuildable'
  | 'notOwner'
  | 'needFullGroup'
  | 'groupMortgaged'
  | 'frozen'
  | 'maxLevel'
  | 'buildEvenly'
  | 'noCash'
  | 'noHousesLeft'
  | 'noHotelsLeft';

const BUILD_BLOCK_TEXT: Record<BuildBlock, string> = {
  notYourTurn: 'Can only build during your own turn',
  notBuildable: 'Cannot build here',
  notOwner: 'Not your property',
  needFullGroup: 'Need the full colour group',
  groupMortgaged: 'A property in the group is mortgaged',
  frozen: 'Building is frozen (EV15)',
  maxLevel: 'Maximum building level reached',
  buildEvenly: 'Must build evenly',
  noCash: 'Not enough cash',
  noHousesLeft: 'No houses left in stock',
  noHotelsLeft: 'No hotels left in stock',
};

/**
 * `cost` overrides the price (Thợ xây's free house); by default the player's building cost.
 * `partial` (Thợ xây's Tự tay xây) also allows a first house without the full colour group.
 */
export function buildBlock(c: Ctx, p: PlayerState, id: string, cost?: number, partial = false): BuildBlock | null {
  if (!canManage(c, p, false)) return 'notYourTurn';
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  if (def.kind !== 'property' || !def.group || !def.buildCost) return 'notBuildable';
  if (!ownedBySide(c, id, p.id)) return 'notOwner';
  const full = ownsFullGroup(c, p.id, def.group);
  if (!full && !(partial && own.level === 0)) return 'needFullGroup';
  const group = groupProperties(c, def.group);
  if (full ? group.some((g) => c.s.ownables[g].mortgaged) : own.mortgaged) return 'groupMortgaged';
  if (buildFreezeActive(c, p)) return 'frozen';
  if (own.level >= maxLevel(c, p)) return 'maxLevel';
  const minLevel = Math.min(...group.map((g) => c.s.ownables[g].level));
  if (full && own.level !== minLevel) return 'buildEvenly';
  if (p.cash < (cost ?? buildCostFor(c, p, id))) return 'noCash';
  if (c.s.config.buildingLimit) {
    const stock = buildingStock(c);
    const toHotel = own.level + 1 === hotelLevel(c);
    if (toHotel && stock.hotels < 1) return 'noHotelsLeft';
    if (!toHotel && stock.houses < 1) return 'noHousesLeft';
  }
  return null;
}

/**
 * Thợ xây's free house may go on a tile without the full group (`anyTile` on the skill),
 * while he has fewer than `anyTileMax` such houses standing.
 */
export function partialFreeBuild(c: Ctx, p: PlayerState): boolean {
  const sk = skillOf(c, p);
  if (sk?.type !== 'free_build' || sk.anyTile !== true) return false;
  const max = (sk.anyTileMax as number | undefined) ?? Infinity;
  const standing = ownedBy(c, p.id).filter((id) => {
    const g = c.d.ownables[id].group;
    return c.s.ownables[id].level > 0 && g !== undefined && !ownsFullGroup(c, p.id, g);
  }).length;
  return standing < max;
}

export type MoveHouseBlock = BuildBlock | 'sameTile' | 'noHouseToMove' | 'sellEvenly' | 'housesOnly';

/**
 * Thầy phong thủy's Dời nhà: may one house go from `from` to `to`? The house leaves `from`
 * as if sold (houses only, evenly over his own tiles) and arrives at `to` as if built (full
 * group, evenly, not past the last house), at no cost.
 */
export function moveHouseBlock(c: Ctx, p: PlayerState, from: string, to: string): MoveHouseBlock | null {
  if (!canManage(c, p, false)) return 'notYourTurn';
  if (from === to) return 'sameTile';
  const src = c.s.ownables[from];
  const def = ownableDef(c, from);
  if (!ownedBySide(c, from, p.id)) return 'notOwner';
  if (src.level === 0) return 'noHouseToMove';
  if (src.level >= hotelLevel(c)) return 'housesOnly';
  const mine = groupProperties(c, def.group!).filter((g) => ownedBySide(c, g, p.id));
  if (src.level !== Math.max(...mine.map((g) => c.s.ownables[g].level))) return 'sellEvenly';
  const dst = c.s.ownables[to];
  if (dst && dst.level + 1 >= hotelLevel(c)) return 'housesOnly';
  // Check the arrival with the house already gone (same group: still even after the move).
  src.level -= 1;
  try {
    return buildBlock(c, p, to, 0);
  } finally {
    src.level += 1;
  }
}

/** Why `p` may not build on `id` right now, or null if allowed. */
export function buildError(c: Ctx, p: PlayerState, id: string): string | null {
  const b = buildBlock(c, p, id);
  return b ? BUILD_BLOCK_TEXT[b] : null;
}

export function build(c: Ctx, p: PlayerState, id: string, free = false): void {
  const cost = free ? 0 : buildCostFor(c, p, id);
  const b = buildBlock(c, p, id, cost, free && partialFreeBuild(c, p));
  if (b) fail(BUILD_BLOCK_TEXT[b]);
  const own = c.s.ownables[id];
  const toHotel = own.level + 1 === hotelLevel(c);
  p.cash -= cost;
  own.level += 1;
  emit(c, 'built', { player: p.id, propertyId: id, level: own.level, hotel: toHotel, cost, ...(free ? { free: true } : {}) });
}

/** Sells one level back to the bank. A hotel becomes H houses, or fewer if the stock is short. */
export function sellOneLevel(c: Ctx, p: PlayerState, id: string): void {
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  const H = housesForHotel(c);
  let removed = 1;
  if (own.level === H + 1 && c.s.config.buildingLimit) {
    const available = Math.max(0, buildingStock(c).houses);
    const newLevel = Math.min(H, available);
    removed = H + 1 - newLevel;
  }
  own.level -= removed;
  const refund = sellValue(c, def.buildCost ?? 0) * removed;
  p.cash += refund;
  emit(c, 'buildingSold', { player: p.id, propertyId: id, level: own.level, refund });
}

export function sellBuilding(c: Ctx, p: PlayerState, id: string): void {
  if (!canManage(c, p, true)) fail('Can only sell during your own turn or to settle a debt');
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  if (!ownedBySide(c, id, p.id)) fail('Not your property');
  if (own.level === 0) fail('No buildings to sell');
  const group = groupProperties(c, def.group!).filter((g) => ownedBySide(c, g, p.id));
  const maxInGroup = Math.max(...group.map((g) => c.s.ownables[g].level));
  if (own.level !== maxInGroup) fail('Must sell evenly');
  sellOneLevel(c, p, id);
}

// ---------------------------------------------------------------- mortgage

export function mortgageProperty(c: Ctx, p: PlayerState, id: string): void {
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  if (!ownedBySide(c, id, p.id)) fail('Not your property');
  if (own.mortgaged) fail('Already mortgaged');
  if (sideHasBuildings(c, def.group, p.id)) fail('Sell all buildings in the group first');
  own.mortgaged = true;
  p.cash += def.mortgage;
  emit(c, 'mortgaged', { player: p.id, propertyId: id, amount: def.mortgage });
}

export function mortgage(c: Ctx, p: PlayerState, id: string): void {
  if (!canManage(c, p, true)) fail('Can only mortgage during your own turn or to settle a debt');
  mortgageProperty(c, p, id);
}

export function interestFor(c: Ctx, p: PlayerState, id: string): number {
  const m = c.d.ownables[id].mortgage;
  return Math.ceil(m * unmortgageInterestRate(c, p) - 1e-9);
}

export function unmortgageCost(c: Ctx, p: PlayerState, id: string): number {
  return c.d.ownables[id].mortgage + interestFor(c, p, id);
}

export function unmortgage(c: Ctx, p: PlayerState, id: string): void {
  if (!canManage(c, p, false)) fail('Can only unmortgage during your own turn');
  const own = c.s.ownables[id];
  if (!ownedBySide(c, id, p.id)) fail('Not your property');
  if (!own.mortgaged) fail('Not mortgaged');
  const cost = unmortgageCost(c, p, id);
  if (p.cash < cost) fail('Not enough cash');
  p.cash -= cost;
  own.mortgaged = false;
  emit(c, 'unmortgaged', { player: p.id, propertyId: id, amount: cost });
}

/** Creditor's choice for a mortgaged property inherited from a bankrupt player. */
export function resolveInheritedMortgage(c: Ctx, p: PlayerState, unmortgageNow: boolean): void {
  const pend = c.s.pending;
  if (pend?.type !== 'inheritMortgage' || pend.player !== p.id) fail('No inherited mortgage to resolve');
  const id = pend.propertyId;
  if (unmortgageNow) {
    const cost = unmortgageCost(c, p, id);
    if (p.cash < cost) fail('Not enough cash to unmortgage');
    c.s.pending = null;
    p.cash -= cost;
    c.s.ownables[id].mortgaged = false;
    emit(c, 'unmortgaged', { player: p.id, propertyId: id, amount: cost });
  } else {
    c.s.pending = null;
    execPay(c, payTask(p.id, { kind: 'bank' }, interestFor(c, p, id), 'interest', 'inheritedMortgage'));
  }
}

// ---------------------------------------------------------------- trades

function normBundle(b: Partial<TradeBundle>): TradeBundle {
  const cash = b.cash ?? 0;
  if (!Number.isInteger(cash) || cash < 0) fail('Trade cash must be a non-negative integer');
  return { cash, properties: [...(b.properties ?? [])], jailCards: [...(b.jailCards ?? [])] };
}

export function proposeTrade(
  c: Ctx,
  from: PlayerState,
  toId: string,
  offer: Partial<TradeBundle>,
  request: Partial<TradeBundle>,
  unmortgageIds: string[] = [],
): Trade {
  const to = getPlayer(c, toId);
  if (to.id === from.id || to.bankrupt || from.bankrupt) fail('Invalid trade partner');
  const trade: Trade = {
    id: `TR${c.s.nextUid++}`,
    from: from.id,
    to: to.id,
    offer: normBundle(offer),
    request: normBundle(request),
    unmortgage: [...unmortgageIds],
  };
  validateTrade(c, trade, []);
  c.s.trades.push(trade);
  if (c.s.players[c.s.turn.current].id === from.id) {
    c.s.turn.offeredTo = [...new Set([...(c.s.turn.offeredTo ?? []), to.id])];
  }
  emit(c, 'tradeProposed', { trade });
  return trade;
}

function transferCost(c: Ctx, receiver: PlayerState, ids: string[], unmortgageNow: string[]): number {
  let cost = 0;
  for (const id of ids) {
    if (!c.s.ownables[id].mortgaged) continue;
    cost += unmortgageNow.includes(id) ? unmortgageCost(c, receiver, id) : interestFor(c, receiver, id);
  }
  return cost;
}

function validateTrade(c: Ctx, t: Trade, toUnmortgage: string[]): void {
  const from = getPlayer(c, t.from);
  const to = getPlayer(c, t.to);
  const check = (giver: PlayerState, receiver: PlayerState, b: TradeBundle) => {
    for (const id of b.properties) {
      const def = ownableDef(c, id);
      if (c.s.ownables[id].owner !== giver.id) fail(`${giver.id} does not own ${id}`);
      if (sideHasBuildings(c, def.group, giver.id)) fail(`Cannot trade ${id}: its group has buildings`);
      if (!canOwn(c, receiver, id)) fail(`${receiver.id} may not own ${id}`);
    }
    for (const card of b.jailCards) if (!giver.jailCards.includes(card)) fail(`${giver.id} lacks ${card}`);
  };
  check(from, to, t.offer);
  check(to, from, t.request);
  const fromCash = from.cash - t.offer.cash + t.request.cash - transferCost(c, from, t.request.properties, t.unmortgage);
  const toCash = to.cash - t.request.cash + t.offer.cash - transferCost(c, to, t.offer.properties, toUnmortgage);
  if (from.cash < t.offer.cash || fromCash < 0) fail(`${from.id} cannot afford this trade`);
  if (to.cash < t.request.cash || toCash < 0) fail(`${to.id} cannot afford this trade`);
}

function moveBundle(c: Ctx, giver: PlayerState, receiver: PlayerState, b: TradeBundle, unmortgageNow: string[]) {
  giver.cash -= b.cash;
  receiver.cash += b.cash;
  for (const id of b.properties) {
    const own = c.s.ownables[id];
    if (own.mortgaged) {
      if (unmortgageNow.includes(id)) {
        receiver.cash -= unmortgageCost(c, receiver, id);
        own.mortgaged = false;
      } else {
        receiver.cash -= interestFor(c, receiver, id);
      }
    }
    own.owner = receiver.id;
  }
  for (const card of b.jailCards) {
    giver.jailCards.splice(giver.jailCards.indexOf(card), 1);
    receiver.jailCards.push(card);
  }
}

export function respondTrade(c: Ctx, p: PlayerState, tradeId: string, accept: boolean, toUnmortgage: string[] = []) {
  const t = c.s.trades.find((x) => x.id === tradeId);
  if (!t) fail('Unknown trade');
  if (t.to !== p.id) fail('Not your trade to answer');
  c.s.trades = c.s.trades.filter((x) => x.id !== tradeId);
  if (!accept) {
    emit(c, 'tradeRejected', { tradeId });
    return;
  }
  validateTrade(c, t, toUnmortgage);
  const from = getPlayer(c, t.from);
  moveBundle(c, from, p, t.offer, toUnmortgage);
  moveBundle(c, p, from, t.request, t.unmortgage);
  emit(c, 'tradeAccepted', { trade: t });
}

export function cancelTrade(c: Ctx, playerId: string | undefined, tradeId: string): void {
  const t = c.s.trades.find((x) => x.id === tradeId);
  if (!t) fail('Unknown trade');
  if (playerId !== undefined && t.from !== playerId) fail('Only the proposer can cancel');
  c.s.trades = c.s.trades.filter((x) => x.id !== tradeId);
  emit(c, 'tradeCancelled', { tradeId });
}

