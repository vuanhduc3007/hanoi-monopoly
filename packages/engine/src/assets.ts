import { canOwn, maxLevel } from './characters';
import {
  emit,
  fail,
  getPlayer,
  groupHasBuildings,
  groupProperties,
  hotelLevel,
  housesForHotel,
  isMyTurn,
  ownableDef,
  ownsFullGroup,
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

/** Own turn (free phase or deciding on a purchase), or settling one's own debt. */
function canManage(c: Ctx, p: PlayerState, allowLiquidation: boolean): boolean {
  const pend = c.s.pending;
  if (allowLiquidation && pend?.type === 'liquidation' && pend.player === p.id) return true;
  if (!isMyTurn(c, p.id)) return false;
  return pend === null || (pend.type === 'buy' && pend.player === p.id);
}

function sellValue(c: Ctx, buildCost: number): number {
  return Math.floor(buildCost * c.d.economy.buildingSellRate);
}

// ---------------------------------------------------------------- build / sell

/** Why `p` may not build on `id` right now, or null if allowed. */
export function buildError(c: Ctx, p: PlayerState, id: string): string | null {
  if (!canManage(c, p, false)) return 'Can only build during your own turn';
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  if (def.kind !== 'property' || !def.group || !def.buildCost) return 'Cannot build here';
  if (own.owner !== p.id) return 'Not your property';
  if (!ownsFullGroup(c, p.id, def.group)) return 'Need the full colour group';
  const group = groupProperties(c, def.group);
  if (group.some((g) => c.s.ownables[g].mortgaged)) return 'A property in the group is mortgaged';
  if (buildFreezeActive(c, p)) return 'Building is frozen (EV15)';
  if (own.level >= maxLevel(c, p)) return 'Maximum building level reached';
  const minLevel = Math.min(...group.map((g) => c.s.ownables[g].level));
  if (own.level !== minLevel) return 'Must build evenly';
  if (p.cash < def.buildCost) return 'Not enough cash';
  if (c.s.config.buildingLimit) {
    const stock = buildingStock(c);
    const toHotel = own.level + 1 === hotelLevel(c);
    if (toHotel && stock.hotels < 1) return 'No hotels left in stock';
    if (!toHotel && stock.houses < 1) return 'No houses left in stock';
  }
  return null;
}

export function build(c: Ctx, p: PlayerState, id: string): void {
  const err = buildError(c, p, id);
  if (err) fail(err);
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  const toHotel = own.level + 1 === hotelLevel(c);
  p.cash -= def.buildCost!;
  own.level += 1;
  emit(c, 'built', { player: p.id, propertyId: id, level: own.level, hotel: toHotel, cost: def.buildCost });
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
  if (own.owner !== p.id) fail('Not your property');
  if (own.level === 0) fail('No buildings to sell');
  const group = groupProperties(c, def.group!);
  const maxInGroup = Math.max(...group.map((g) => c.s.ownables[g].level));
  if (own.level !== maxInGroup) fail('Must sell evenly');
  sellOneLevel(c, p, id);
}

// ---------------------------------------------------------------- mortgage

export function mortgageProperty(c: Ctx, p: PlayerState, id: string): void {
  const def = ownableDef(c, id);
  const own = c.s.ownables[id];
  if (own.owner !== p.id) fail('Not your property');
  if (own.mortgaged) fail('Already mortgaged');
  if (groupHasBuildings(c, def.group)) fail('Sell all buildings in the group first');
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
  if (own.owner !== p.id) fail('Not your property');
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
      if (groupHasBuildings(c, def.group)) fail(`Cannot trade ${id}: its group has buildings`);
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

