import { emit, hotelLevel, ownsFullGroup, ownedBy, pushFront, teammates, type Ctx } from './ctx';
import { onPayRent } from './characters';
import { rentBlocked, rentMultipliers } from './effects';
import { payTask } from './money';
import { rollDice } from './rng';
import type { LandContext, PlayerState } from './types';

export interface RentQuote {
  /** Unrounded amount after multipliers (before Ăn vạ). */
  raw: number;
  amount: number;
  owner: string | null;
  note?: 'unowned' | 'self' | 'mortgaged' | 'blocked' | 'team';
}

/**
 * Rent order (GDD 4.4): base → ×2 full group → card multipliers (in order)
 * → skill discount (applied later, on `raw`) → round up.
 */
export function quoteRent(c: Ctx, payer: PlayerState, id: string, ctx: LandContext = {}, diceSum?: number): RentQuote {
  const own = c.s.ownables[id];
  const def = c.d.ownables[id];
  const owner = own.owner;
  if (!owner) return { raw: 0, amount: 0, owner, note: 'unowned' };
  if (owner === payer.id) return { raw: 0, amount: 0, owner, note: 'self' };
  if (teammates(c, owner, payer.id)) return { raw: 0, amount: 0, owner, note: 'team' };
  if (own.mortgaged) return { raw: 0, amount: 0, owner, note: 'mortgaged' };
  if (rentBlocked(c, owner)) return { raw: 0, amount: 0, owner, note: 'blocked' };

  let raw: number;
  if (def.kind === 'property') {
    const rent = def.rent!;
    if (own.level === 0) {
      raw = rent.base;
      if (ownsFullGroup(c, owner, def.group!)) raw *= c.d.economy.monopolyBaseRentMultiplier;
    } else if (own.level === hotelLevel(c)) {
      raw = rent.hotel;
    } else {
      raw = rent[`h${own.level}` as 'h1'];
    }
  } else if (def.kind === 'transport') {
    const count = ownedBy(c, owner).filter((x) => c.d.ownables[x].kind === 'transport').length;
    raw = c.d.economy.transportRent[count - 1];
    if (ctx.transportMultiplier) raw *= ctx.transportMultiplier;
  } else {
    const count = ownedBy(c, owner).filter((x) => c.d.ownables[x].kind === 'utility').length;
    const mult = ctx.utilityRollMultiplier ?? c.d.economy.utilityMultiplier[String(count)];
    const sum = diceSum ?? (c.s.turn.dice ?? []).reduce((a, b) => a + b, 0);
    raw = mult * sum;
  }
  for (const m of rentMultipliers(c, id, payer, owner)) raw *= m;
  return { raw, amount: Math.ceil(raw - 1e-9), owner };
}

/** Landed on someone else's property: compute and queue rent (may ask Ăn vạ). */
export function execRent(c: Ctx, payer: PlayerState, id: string, ctx: LandContext = {}): void {
  let diceSum: number | undefined;
  if (ctx.utilityRollMultiplier && c.s.ownables[id].owner && c.s.ownables[id].owner !== payer.id) {
    const dice = rollDice(c.s, 2);
    diceSum = dice[0] + dice[1];
    emit(c, 'diceRolled', { player: payer.id, dice, purpose: 'utilityRent' });
  }
  const q = quoteRent(c, payer, id, ctx, diceSum);
  if (q.amount === 0) {
    if (q.owner && q.note !== 'self') emit(c, 'rentWaived', { player: payer.id, propertyId: id, why: q.note });
    return;
  }
  const task = payTask(payer.id, { kind: 'player', id: q.owner! }, q.amount, 'rent', id, q.owner!);
  emit(c, 'rentDue', { player: payer.id, owner: q.owner, propertyId: id, amount: q.amount });
  if (onPayRent(c, payer, task, q.raw, id)) return;
  pushFront(c, task);
}
