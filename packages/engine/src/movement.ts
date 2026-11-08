import { canOwn, onLand, onPassGo, onPurchase, purchasePrice, taxAmount } from './characters';
import { deckOfTile } from './cards';
import { activePlayers, emit, fail, getPlayer, pushFront, type Ctx } from './ctx';
import { effectsFor } from './effects';
import { cardPay, gain, payTask } from './money';
import type { LandContext, PlayerState, Task } from './types';

export function execMove(c: Ctx, p: PlayerState, steps: number): void {
  const n = c.d.board.length;
  const from = p.position;
  if (steps >= 0 && from + steps >= n) onPassGo(c, p);
  p.position = (((from + steps) % n) + n) % n;
  emit(c, 'moved', { player: p.id, from, to: p.position, steps });
  pushFront(c, { t: 'land', player: p.id });
}

/** "Đi đến ô X": always forward, salary when passing or reaching GO. */
export function execMoveTo(c: Ctx, p: PlayerState, position: number, ctx?: LandContext): void {
  const n = c.d.board.length;
  const from = p.position;
  const steps = (position - from + n) % n;
  if (steps > 0 && from + steps >= n) onPassGo(c, p);
  p.position = position;
  emit(c, 'moved', { player: p.id, from, to: position, steps, direct: true });
  pushFront(c, { t: 'land', player: p.id, ctx });
}

export function execGoToJail(c: Ctx, p: PlayerState): void {
  p.position = c.d.board.findIndex((t) => t.ref === 'JAIL');
  p.inJail = true;
  p.jailTurns = 0;
  p.doublesCount = 0;
  if (c.s.players[c.s.turn.current].id === p.id) c.s.turn.extraRoll = false;
  emit(c, 'jailed', { player: p.id });
}

export function leaveJail(c: Ctx, p: PlayerState, how: string): void {
  p.inJail = false;
  p.jailTurns = 0;
  emit(c, 'leftJail', { player: p.id, how });
}

export function execLand(c: Ctx, p: PlayerState, ctx: LandContext = {}): void {
  const tile = c.d.board[p.position];
  emit(c, 'landed', { player: p.id, position: p.position, tile: tile.ref });
  const hook = onLand(c, p, tile);
  const tasks: Task[] = [...hook.tasks];

  switch (tile.type) {
    case 'corner':
      if (tile.ref === 'PARK' && c.s.config.scholarshipFund && c.s.fund > 0) {
        const amount = c.s.fund;
        c.s.fund = 0;
        p.cash += amount;
        emit(c, 'fundCollected', { player: p.id, amount });
      } else if (tile.ref === 'GOTOJAIL') {
        if (hook.ignoreGoToJail) emit(c, 'goToJailIgnored', { player: p.id });
        else tasks.push({ t: 'goToJail', player: p.id });
      }
      break;
    case 'tax':
      tasks.push(payTask(p.id, { kind: 'fund' }, taxAmount(c, p, tile.ref), 'tax', tile.ref));
      break;
    case 'card':
      tasks.push({ t: 'drawCard', player: p.id, deck: deckOfTile(tile.ref) });
      break;
    default: {
      // EV18-style landing fees (⏳ card payments).
      for (const e of effectsFor(c, 'landing_fee', p)) {
        if ((e.effect.properties as string[]).includes(tile.ref)) {
          const to = e.effect.to === 'fund' ? { kind: 'fund' as const } : { kind: 'bank' as const };
          tasks.push(cardPay(c, p, to, e.effect.amount, e.source.kind === 'card' ? e.source.cardId : 'landingFee'));
        }
      }
      const own = c.s.ownables[tile.ref];
      if (!own.owner) {
        if (canOwn(c, p, tile.ref)) tasks.push({ t: 'offerBuy', player: p.id, propertyId: tile.ref });
        else tasks.push({ t: 'auction', propertyId: tile.ref });
      } else if (own.owner !== p.id) {
        tasks.push({ t: 'rent', player: p.id, propertyId: tile.ref, ctx });
      }
    }
  }
  pushFront(c, ...tasks);
}

// ---------------------------------------------------------------- buying / auctions

export function execOfferBuy(c: Ctx, p: PlayerState, id: string): void {
  const price = purchasePrice(c, p, id);
  c.s.pending = { type: 'buy', player: p.id, propertyId: id, price };
  emit(c, 'decisionRequired', { decision: 'buy', player: p.id, propertyId: id, price });
}

export function buy(c: Ctx, p: PlayerState): void {
  const pend = c.s.pending;
  if (pend?.type !== 'buy' || pend.player !== p.id) fail('No purchase pending');
  if (p.cash < pend.price) fail('Not enough cash');
  c.s.pending = null;
  p.cash -= pend.price;
  c.s.ownables[pend.propertyId].owner = p.id;
  emit(c, 'purchased', { player: p.id, propertyId: pend.propertyId, price: pend.price });
  onPurchase(c, p.id);
}

export function declineBuy(c: Ctx, p: PlayerState): void {
  const pend = c.s.pending;
  if (pend?.type !== 'buy' || pend.player !== p.id) fail('No purchase pending');
  c.s.pending = null;
  emit(c, 'purchaseDeclined', { player: p.id, propertyId: pend.propertyId });
  pushFront(c, { t: 'auction', propertyId: pend.propertyId });
}

export function execAuction(c: Ctx, id: string): void {
  if (c.s.ownables[id].owner) return;
  const eligible = activePlayers(c)
    .filter((p) => canOwn(c, p, id))
    .map((p) => p.id);
  if (eligible.length === 0) {
    emit(c, 'auctionEnded', { propertyId: id, winner: null });
    return;
  }
  c.s.pending = { type: 'auction', propertyId: id, highBid: 0, highBidder: null, eligible };
  emit(c, 'auctionStarted', { propertyId: id, eligible, startBid: c.d.economy.auction.startBid });
}

export function bid(c: Ctx, p: PlayerState, amount: number): void {
  const pend = c.s.pending;
  if (pend?.type !== 'auction') fail('No auction running');
  if (!pend.eligible.includes(p.id) || p.bankrupt) fail('Not eligible to bid');
  const { startBid, minIncrement } = c.d.economy.auction;
  const min = pend.highBidder ? pend.highBid + minIncrement : startBid;
  if (!Number.isInteger(amount) || amount < min) fail(`Bid must be at least ${min}`);
  if (amount > p.cash) fail('Cannot bid more than your cash');
  pend.highBid = amount;
  pend.highBidder = p.id;
  emit(c, 'bid', { player: p.id, amount, propertyId: pend.propertyId });
}

export function closeAuction(c: Ctx): void {
  const pend = c.s.pending;
  if (pend?.type !== 'auction') fail('No auction running');
  c.s.pending = null;
  const winner = pend.highBidder ? getPlayer(c, pend.highBidder) : null;
  if (!winner || winner.bankrupt || winner.cash < pend.highBid) {
    emit(c, 'auctionEnded', { propertyId: pend.propertyId, winner: null });
    return;
  }
  winner.cash -= pend.highBid;
  c.s.ownables[pend.propertyId].owner = winner.id;
  emit(c, 'auctionEnded', { propertyId: pend.propertyId, winner: winner.id, price: pend.highBid });
  onPurchase(c, winner.id);
}

export function execGain(c: Ctx, p: PlayerState, amount: number, reason: string): void {
  gain(c, p, amount, reason);
}
