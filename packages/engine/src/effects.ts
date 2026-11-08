import { emit, groupProperties, type Ctx } from './ctx';
import type { ActiveEffect, Effect, PlayerId, PlayerState } from './types';

/** Is the player immune to this card (character passive or card's own immune list)? */
export function isImmune(c: Ctx, p: PlayerState, cardId: string | null, effect: Effect): boolean {
  if (!c.s.config.characters || !p.character) return false;
  if (Array.isArray(effect.immune) && effect.immune.includes(p.character)) return true;
  if (!cardId) return false;
  const def = c.d.characters[p.character];
  return [...def.passives, ...def.drawbacks].some(
    (t) => t.type === 'immune_events' && Array.isArray(t.cards) && t.cards.includes(cardId),
  );
}

function cardIdOf(e: ActiveEffect): string | null {
  return e.source.kind === 'card' ? e.source.cardId : null;
}

/** Active ⏳ effects of a type that apply to `p` (not exempt, not immune). */
export function effectsFor(c: Ctx, type: string, p: PlayerState): ActiveEffect[] {
  return c.s.activeEffects.filter(
    (e) => e.effect.type === type && !e.exempt.includes(p.id) && !isImmune(c, p, cardIdOf(e), e.effect),
  );
}

export function singleDieActive(c: Ctx, p: PlayerState): boolean {
  return effectsFor(c, 'single_die', p).length > 0;
}

export function buildFreezeActive(c: Ctx, p: PlayerState): boolean {
  return effectsFor(c, 'build_freeze', p).length > 0;
}

/** EV14/EV29: the most recently drawn interest card wins. */
export function unmortgageInterestRate(c: Ctx, p: PlayerState): number {
  const list = effectsFor(c, 'unmortgage_interest', p);
  if (list.length === 0) return c.d.economy.unmortgageInterest;
  return list[list.length - 1].effect.value as number;
}

export function rentBlocked(c: Ctx, ownerId: PlayerId): boolean {
  return c.s.activeEffects.some((e) => e.effect.type === 'block_rent' && e.effect.target === ownerId);
}

/** Rent multipliers (cards ⏳ and Tung tin quy hoạch) for a property, in draw order. */
export function rentMultipliers(c: Ctx, propertyId: string, payer: PlayerState, ownerId: PlayerId): number[] {
  const def = c.d.ownables[propertyId];
  const out: number[] = [];
  for (const e of c.s.activeEffects) {
    if (e.effect.type !== 'rent_multiplier') continue;
    if (e.exempt.includes(payer.id) || e.exempt.includes(ownerId)) continue;
    const props: string[] = e.effect.properties ?? [];
    const groups: string[] = e.effect.groups ?? [];
    const hit =
      props.includes(propertyId) ||
      (def.group !== undefined && groups.includes(def.group)) ||
      groups.some((g) => groupProperties(c, g).includes(propertyId));
    if (hit) out.push(e.effect.multiplier as number);
  }
  return out;
}

export function addActiveEffect(c: Ctx, e: Omit<ActiveEffect, 'uid'>): void {
  const uid = c.s.nextUid++;
  c.s.activeEffects.push({ uid, ...e });
  emit(c, 'effectStarted', {
    uid,
    source: e.source,
    activator: e.activator,
    effect: e.effect.type,
    exempt: e.exempt,
  });
}

export function expireEffectsOf(c: Ctx, playerId: PlayerId): void {
  const keep: ActiveEffect[] = [];
  for (const e of c.s.activeEffects) {
    if (e.activator === playerId) emit(c, 'effectExpired', { uid: e.uid, source: e.source });
    else keep.push(e);
  }
  c.s.activeEffects = keep;
}
