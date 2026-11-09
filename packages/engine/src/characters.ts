/**
 * Character passives, drawbacks and skills — all driven by `characters.json`
 * entry types, never by character ID. Hooks are called by the engine at
 * fixed points: onTurnStart, onPassGo, onLand, onPayRent, onRentPaid,
 * onDrawCard, onPurchase, onBankrupt.
 */
import { activePlayers, emit, fail, hotelLevel, housesForHotel, ownedBy, type Ctx } from './ctx';
import type { GameData, TileDef } from './data';
import { expireEffectsOf, isImmune } from './effects';
import type { DeckName, Effect, PayTask, PlayerState, Task } from './types';

// ---------------------------------------------------------------- queries

/** Passives + drawbacks of the player's character (empty if characters are off). */
export function traits(c: Ctx, p: PlayerState): Effect[] {
  if (!c.s.config.characters || !p.character) return [];
  const def = c.d.characters[p.character];
  return [...def.passives, ...def.drawbacks];
}

export function trait(c: Ctx, p: PlayerState, type: string): Effect | undefined {
  return traits(c, p).find((t) => t.type === type);
}

export function traitsOf(c: Ctx, p: PlayerState, type: string): Effect[] {
  return traits(c, p).filter((t) => t.type === type);
}

export function skillOf(c: Ctx, p: PlayerState): (Effect & { name: string }) | undefined {
  if (!c.s.config.characters || !p.character) return undefined;
  return c.d.characters[p.character].skill;
}

/** The one-shot skill of this type is still available. */
export function skillAvailable(c: Ctx, p: PlayerState, type: string): boolean {
  const sk = skillOf(c, p);
  return !!sk && sk.type === type && !p.skillUsed && !p.bankrupt;
}

export function startingCash(d: GameData, characterId: string | null, charactersOn: boolean): number {
  if (charactersOn && characterId) {
    const def = d.characters[characterId];
    const t = [...def.passives, ...def.drawbacks].find((x) => x.type === 'starting_cash');
    if (t) return t.value as number;
  }
  return d.economy.startingCash;
}

export function salaryFor(c: Ctx, p: PlayerState): number {
  let salary = c.d.economy.goSalary;
  const override = trait(c, p, 'go_salary');
  if (override) salary = override.value as number;
  const sk = skillOf(c, p);
  if (sk?.type === 'auto_salary_upgrade' && p.goPasses >= (sk.afterGoPasses as number)) {
    salary = sk.value as number;
  }
  return salary;
}

/** Bank list price after character discounts (only for buying at list price). */
export function purchasePrice(c: Ctx, p: PlayerState, propertyId: string): number {
  const def = c.d.ownables[propertyId];
  let price = def.price;
  for (const t of traitsOf(c, p, 'purchase_discount')) {
    const props: string[] = t.properties ?? [];
    const groups: string[] = t.groups ?? [];
    if (props.includes(propertyId) || (def.group && groups.includes(def.group))) {
      price = price * (1 - (t.rate as number));
    }
  }
  return Math.ceil(price - 1e-9);
}

export function canOwn(c: Ctx, p: PlayerState, propertyId: string): boolean {
  return !traitsOf(c, p, 'forbidden_properties').some((t) => (t.properties as string[]).includes(propertyId));
}

/** Highest building level this player may reach (Cò đất: no hotels). */
export function maxLevel(c: Ctx, p: PlayerState): number {
  return trait(c, p, 'no_hotels') ? housesForHotel(c) : hotelLevel(c);
}

export function cardPayMultiplier(c: Ctx, p: PlayerState): number {
  const t = trait(c, p, 'card_payment_multiplier');
  return t ? (t.value as number) : 1;
}

export function taxAmount(c: Ctx, p: PlayerState, taxRef: string): number {
  const t = traitsOf(c, p, 'tax_override').find((x) => x.tax === taxRef);
  return t ? (t.amount as number) : c.d.economy.taxes[taxRef];
}

/** Percent for pay_percent_cash cards (EV10), honouring character overrides. */
export function eventPercent(c: Ctx, p: PlayerState, cardId: string, effect: Effect): number {
  const t = traitsOf(c, p, 'event_override').find((x) => x.card === cardId);
  if (t) return t.percent as number;
  if (c.s.config.characters && p.character && effect.overrides?.[p.character] !== undefined) {
    return effect.overrides[p.character] as number;
  }
  return effect.percent as number;
}

/** Tài xế Grab: options after a roll. */
/**
 * Tài xế Grab ±1 settings from `adjust_roll`: optional `directions` (default
 * [1, -1]), optional `cost` paid into the Quỹ per use (default 0) and
 * optional `maxUses` per game (default unlimited).
 */
export function adjustRule(
  c: Ctx,
  p: PlayerState,
): { directions: number[]; cost: number; maxUses: number } | null {
  const t = trait(c, p, 'adjust_roll');
  if (!t) return null;
  const step = (t.delta as number) ?? 1;
  const dirs = (t.directions as number[] | undefined) ?? [1, -1];
  return {
    directions: dirs.map((x) => Math.sign(x) * step),
    cost: (t.cost as number | undefined) ?? 0,
    maxUses: (t.maxUses as number | undefined) ?? Infinity,
  };
}

export function postRollOptions(c: Ctx, p: PlayerState): { adjust: boolean; reroll: boolean } {
  const rule = adjustRule(c, p);
  return {
    adjust: !!rule && !p.lapAdjustUsed && p.adjustUses < rule.maxUses && p.cash >= rule.cost,
    reroll: skillAvailable(c, p, 'reroll'),
  };
}

// ---------------------------------------------------------------- hooks

export function onTurnStart(c: Ctx, p: PlayerState): void {
  expireEffectsOf(c, p.id);
  p.doublesCount = 0;
}

export function onPassGo(c: Ctx, p: PlayerState): void {
  p.goPasses += 1;
  p.lapAdjustUsed = false;
  const sk = skillOf(c, p);
  if (sk?.type === 'auto_salary_upgrade' && p.goPasses === sk.afterGoPasses) {
    p.skillUsed = true;
    emit(c, 'skillTriggered', { player: p.id, skill: sk.type });
  }
  const salary = salaryFor(c, p);
  p.cash += salary;
  emit(c, 'salary', { player: p.id, amount: salary, passes: p.goPasses });
}

/** Extra tasks / overrides when a player stops on a tile. */
export function onLand(c: Ctx, p: PlayerState, tile: TileDef): { tasks: Task[]; ignoreGoToJail: boolean } {
  const tasks: Task[] = [];
  let ignoreGoToJail = false;
  if (tile.ref === 'GOTOJAIL' && trait(c, p, 'ignore_go_to_jail_tile')) ignoreGoToJail = true;
  for (const t of traitsOf(c, p, 'landing_fee')) {
    if ((t.properties as string[]).includes(tile.ref)) {
      tasks.push({
        t: 'pay',
        from: p.id,
        to: t.to === 'fund' ? { kind: 'fund' } : { kind: 'bank' },
        amount: t.amount as number,
        kind: 'fee',
        reason: 'characterFee',
      });
    }
  }
  if (tile.ref === 'PARK') {
    const bonus = trait(c, p, 'park_bonus');
    if (bonus) {
      const amount = c.s.config.scholarshipFund ? bonus.amount : bonus.amountWhenFundOff;
      tasks.push({ t: 'gain', player: p.id, amount: amount as number, reason: 'parkBonus' });
    }
  }
  return { tasks, ignoreGoToJail };
}

/**
 * Before rent is paid: the payer confirms with "Trả tiền" (and Ninja Lead may
 * use Ăn vạ instead). Returns true if a decision is pending.
 */
export function onPayRent(c: Ctx, payer: PlayerState, task: PayTask, raw: number, propertyId: string): boolean {
  if (task.amount <= 0) return false;
  const discount = skillAvailable(c, payer, 'rent_discount');
  c.s.pending = { type: 'payRent', player: payer.id, task, raw, propertyId, discount };
  emit(c, 'decisionRequired', { decision: 'payRent', player: payer.id, amount: task.amount, propertyId, discount });
  return true;
}

/** After rent was actually paid: Idol TikTok bonus from the bank. */
export function onRentPaid(c: Ctx, ownerId: string, paid: number): void {
  if (paid <= 0) return;
  const owner = c.s.players.find((x) => x.id === ownerId);
  if (!owner || owner.bankrupt) return;
  const t = trait(c, owner, 'rent_bonus_from_bank');
  if (!t) return;
  const bonus = Math.max(t.min as number, Math.ceil(paid * (t.rate as number) - 1e-9));
  owner.cash += bonus;
  emit(c, 'rentBonus', { player: owner.id, amount: bonus });
}

/** Nghiện Tarot: draw two, choose one, for the listed decks. */
export function onDrawCard(c: Ctx, p: PlayerState, deck: DeckName): 'drawTwo' | 'normal' {
  const t = trait(c, p, 'draw_two_choose_one');
  return t && (t.decks as string[]).includes(deck) ? 'drawTwo' : 'normal';
}

/** Cò đất: commission whenever an opponent buys from the bank. */
export function onPurchase(c: Ctx, buyerId: string): void {
  for (const p of activePlayers(c)) {
    if (p.id === buyerId) continue;
    const t = trait(c, p, 'commission_on_opponent_bank_purchase');
    if (t) {
      p.cash += t.amount as number;
      emit(c, 'commission', { player: p.id, amount: t.amount, buyer: buyerId });
    }
  }
}

/** Thiếu gia Vin: bank covers the shortfall (≤ max) once. Returns true if saved. */
export function onBankrupt(c: Ctx, p: PlayerState, shortfall: number): boolean {
  const sk = skillOf(c, p);
  if (!sk || sk.type !== 'bailout' || p.skillUsed) return false;
  if (shortfall > (sk.maxAmount as number)) return false;
  p.skillUsed = true;
  p.cash += shortfall;
  emit(c, 'skillUsed', { player: p.id, skill: sk.type, amount: shortfall });
  return true;
}

// ---------------------------------------------------------------- Giải hạn

/**
 * Can this event card hurt player p? Giải hạn is only offered for those —
 * nobody would cancel a gift (EV01, EV04, EV14…).
 */
export function eventHarms(c: Ctx, effect: Effect, p: PlayerState, drawerId: string, cardId: string): boolean {
  if (isImmune(c, p, cardId, effect)) return false;
  switch (effect.type) {
    case 'bank_pays_all':
    case 'bank_pays_owners':
    case 'richest_cash_gain':
    case 'drawer_gain':
    case 'bank_to_fund':
      return false;
    case 'unmortgage_interest':
      return (effect.value as number) > c.d.economy.unmortgageInterest;
    case 'repairs_all':
      return ownedBy(c, p.id).some((id) => c.s.ownables[id].level > 0);
    case 'owners_pay_bank':
      return ownedBy(c, p.id).some((id) => (effect.groups as string[]).includes(c.d.ownables[id].group ?? ''));
    case 'all_pay_owner':
      return c.s.ownables[effect.property as string].owner !== p.id;
    case 'composite':
      return (effect.effects as Effect[]).some((e) => eventHarms(c, e, p, drawerId, cardId));
    case 'all_pay_character': {
      const target = activePlayers(c).find((x) => x.character === effect.character);
      if (!target) return eventHarms(c, effect.fallback, p, drawerId, cardId);
      return target.id !== p.id;
    }
    default:
      return true;
  }
}

/** Active player who may cancel this event for themself, if any. */
export function eventCancelCandidate(c: Ctx, cardId: string, drawerId: string): PlayerState | undefined {
  const card = c.d.cards[cardId];
  return activePlayers(c).find(
    (p) => skillAvailable(c, p, 'cancel_event_for_self') && eventHarms(c, card.effect, p, drawerId, cardId),
  );
}

export function requireSkill(c: Ctx, p: PlayerState, type: string): void {
  if (!skillAvailable(c, p, type)) fail(`Skill ${type} not available for ${p.id}`);
}
