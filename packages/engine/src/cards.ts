/**
 * Card effects. One handler per `effect.type` in cards.json.
 * Every card payment goes through `cardPay` (Idol ×1.5, bank → Quỹ).
 */
import { cardPayMultiplier, eventCancelCandidate, eventPercent, onDrawCard, useUpSkill } from './characters';
import {
  activePlayers,
  countBuildings,
  type Ctx,
  emit,
  fail,
  getPlayer,
  ownedBy,
  playersFrom,
  pushFront,
  teammates,
} from './ctx';
import { addActiveEffect, isImmune } from './effects';
import { cardPay, gain } from './money';
import { rollDie } from './rng';
import type { DeckName, Effect, PlayerId, PlayerState, Task } from './types';

const DECK_OF_REF: Record<string, DeckName> = { CH: 'chance', CD: 'community', EV: 'event' };

export function deckOfTile(ref: string): DeckName {
  const d = DECK_OF_REF[ref];
  if (!d) fail(`Not a card tile: ${ref}`);
  return d;
}

function finishCardTasks(c: Ctx, player: PlayerId, cardId: string, exempt: PlayerId[]): Task[] {
  const card = c.d.cards[cardId];
  // The card goes to the bottom right away (GDD 4.5), then its effect resolves.
  const tasks: Task[] = card.keep ? [] : [{ t: 'returnCard', cardId }];
  tasks.push({ t: 'resolveCard', player, cardId, exempt });
  return tasks;
}

export function execDrawCard(c: Ctx, p: PlayerState, deck: DeckName): void {
  const pile = c.s.decks[deck];
  if (pile.length === 0) {
    emit(c, 'deckEmpty', { deck });
    return;
  }
  if (onDrawCard(c, p, deck) === 'drawTwo' && pile.length >= 2) {
    const options = [pile.shift()!, pile.shift()!];
    c.s.pending = { type: 'chooseCard', player: p.id, deck, options };
    emit(c, 'decisionRequired', { decision: 'chooseCard', player: p.id, options });
    return;
  }
  const cardId = pile.shift()!;
  // Face down until the drawer flips it (revealCard / timeout).
  c.s.pending = { type: 'revealCard', player: p.id, deck, cardId };
  emit(c, 'cardDrawing', { player: p.id, deck });
}

/** The drawer flipped the card: show it, then apply it. */
export function revealCard(c: Ctx, p: PlayerState): void {
  const pend = c.s.pending;
  if (pend?.type !== 'revealCard' || pend.player !== p.id) fail('No card to reveal');
  c.s.pending = null;
  const { deck, cardId } = pend;
  emit(c, 'cardDrawn', { player: p.id, deck, cardId });
  if (deck === 'event') {
    const tarot = eventCancelCandidate(c, cardId, p.id);
    if (tarot) {
      execReturnCard(c, cardId);
      c.s.pending = { type: 'eventCancel', player: tarot.id, drawer: p.id, cardId };
      emit(c, 'decisionRequired', { decision: 'eventCancel', player: tarot.id, cardId });
      return;
    }
  }
  pushFront(c, ...finishCardTasks(c, p.id, cardId, []));
}

/** Nghiện Tarot picked one of two cards. */
export function chooseCard(c: Ctx, p: PlayerState, cardId: string): void {
  const pend = c.s.pending;
  if (pend?.type !== 'chooseCard' || pend.player !== p.id) fail('No card choice pending');
  if (!pend.options.includes(cardId)) fail('Card not among the options');
  c.s.pending = null;
  for (const other of pend.options) if (other !== cardId) c.s.decks[pend.deck].push(other);
  emit(c, 'cardDrawn', { player: p.id, deck: pend.deck, cardId, discarded: pend.options.filter((x) => x !== cardId) });
  pushFront(c, ...finishCardTasks(c, p.id, cardId, []));
}

/** Giải hạn answered (used = true → cancelled for the Tarot player). */
export function resolveEventCancel(c: Ctx, used: boolean): void {
  const pend = c.s.pending;
  if (pend?.type !== 'eventCancel') fail('No event-cancel decision pending');
  c.s.pending = null;
  const exempt: PlayerId[] = [];
  if (used) {
    const tarot = getPlayer(c, pend.player);
    useUpSkill(c, tarot);
    exempt.push(tarot.id);
    emit(c, 'skillUsed', { player: tarot.id, skill: 'cancel_event_for_self', cardId: pend.cardId });
  }
  pushFront(c, { t: 'resolveCard', player: pend.drawer, cardId: pend.cardId, exempt });
}

export function execResolveCard(c: Ctx, player: PlayerId, cardId: string, exempt: PlayerId[]): void {
  const card = c.d.cards[cardId];
  pushFront(c, { t: 'effect', player, cardId, effect: card.effect, exempt });
}

export function execReturnCard(c: Ctx, cardId: string): void {
  c.s.decks[c.d.cards[cardId].deck].push(cardId);
}

// ---------------------------------------------------------------- effect handlers

interface EffectArgs {
  c: Ctx;
  drawer: PlayerState;
  cardId: string;
  effect: Effect;
  exempt: PlayerId[];
}

/** Active players the card touches, in turn order from the drawer. */
function affected(a: EffectArgs): PlayerState[] {
  return playersFrom(a.c, a.drawer.id).filter((p) => !a.exempt.includes(p.id));
}

function nearestForward(c: Ctx, from: number, kind: string): number {
  for (let i = 1; i <= c.d.board.length; i++) {
    const pos = (from + i) % c.d.board.length;
    if (c.d.board[pos].type === kind) return pos;
  }
  fail(`No ${kind} tile on board`);
}

function ownerOf(c: Ctx, id: string): PlayerState | null {
  const o = c.s.ownables[id].owner;
  return o ? getPlayer(c, o) : null;
}

/** The active player playing `character`, if characters are on and someone has it. */
function characterAtTable(a: EffectArgs, character: string): PlayerState | undefined {
  if (!a.c.s.config.characters) return undefined;
  return playersFrom(a.c, a.drawer.id).find((p) => p.character === character);
}

function fallback(a: EffectArgs): void {
  if (a.effect.fallback) pushFront(a.c, { t: 'effect', player: a.drawer.id, cardId: a.cardId, effect: a.effect.fallback, exempt: a.exempt });
}

type Handler = (a: EffectArgs) => void;

const handlers: Record<string, Handler> = {
  // ---- Cơ hội / Cộng đồng
  move_to: ({ c, drawer, effect }) => {
    // Cards name a tile (`tile: 'P22'`) so one deck works on every board.
    const position = effect.tile !== undefined ? c.d.board.findIndex((t) => t.ref === effect.tile) : (effect.position as number);
    if (position < 0) fail(`Card target ${effect.tile} is not on this board`);
    pushFront(c, { t: 'moveTo', player: drawer.id, position });
  },
  move_to_nearest: ({ c, drawer, effect }) => {
    const position = nearestForward(c, drawer.position, effect.target);
    pushFront(c, {
      t: 'moveTo',
      player: drawer.id,
      position,
      ctx: { transportMultiplier: effect.rentMultiplier, utilityRollMultiplier: effect.rollRentMultiplier },
    });
  },
  move_relative: ({ c, drawer, effect }) => {
    pushFront(c, { t: 'move', player: drawer.id, steps: effect.steps });
  },
  go_to_jail: ({ c, drawer }) => {
    pushFront(c, { t: 'goToJail', player: drawer.id });
  },
  jail_free_card: ({ c, drawer, cardId }) => {
    drawer.jailCards.push(cardId);
    emit(c, 'cardKept', { player: drawer.id, cardId });
  },
  gain: ({ c, drawer, effect, cardId }) => {
    gain(c, drawer, effect.amount, cardId);
  },
  pay_bank: ({ c, drawer, effect, cardId }) => {
    pushFront(c, cardPay(c, drawer, { kind: 'bank' }, effect.amount, cardId));
  },
  repairs: ({ c, drawer, effect, cardId }) => {
    const b = countBuildings(c, drawer.id);
    const base = b.houses * effect.perHouse + b.hotels * effect.perHotel;
    if (base > 0) pushFront(c, cardPay(c, drawer, { kind: 'bank' }, base, cardId));
  },
  pay_each_player: (a) => {
    const others = affected(a).filter((p) => p.id !== a.drawer.id && !teammates(a.c, p.id, a.drawer.id));
    const amount = perPlayer(a.effect, others.length);
    pushFront(a.c, ...others.map((p) => cardPay(a.c, a.drawer, { kind: 'player', id: p.id }, amount, a.cardId)));
  },
  collect_from_each: (a) => {
    const others = affected(a).filter((p) => p.id !== a.drawer.id && !teammates(a.c, p.id, a.drawer.id));
    const amount = perPlayer(a.effect, others.length);
    pushFront(a.c, ...others.map((p) => cardPay(a.c, p, { kind: 'player', id: a.drawer.id }, amount, a.cardId)));
  },

  // ---- Hanoi Event: ⚡
  bank_pays_all: (a) => {
    for (const p of affected(a)) gain(a.c, p, a.effect.amount, a.cardId);
  },
  bank_pays_owners: (a) => {
    for (const id of a.effect.properties as string[]) {
      const owner = ownerOf(a.c, id);
      if (owner && !a.exempt.includes(owner.id)) gain(a.c, owner, a.effect.amountPerProperty, a.cardId);
    }
  },
  owners_pay_bank: (a) => {
    const tasks: Task[] = [];
    for (const p of affected(a)) {
      const n = ownedBy(a.c, p.id).filter((id) =>
        (a.effect.groups as string[]).includes(a.c.d.ownables[id].group ?? ''),
      ).length;
      if (n > 0) tasks.push(cardPay(a.c, p, { kind: 'bank' }, n * a.effect.amountPerProperty, a.cardId));
    }
    pushFront(a.c, ...tasks);
  },
  repairs_all: (a) => {
    // `toCharacter` (e.g. Thợ xây): that character is paid instead of the bank when at the table.
    const builder = a.effect.toCharacter ? characterAtTable(a, a.effect.toCharacter) : undefined;
    const to = builder ? { kind: 'player' as const, id: builder.id } : { kind: 'bank' as const };
    const tasks: Task[] = [];
    for (const p of affected(a)) {
      if (builder && p.id === builder.id) continue;
      const b = countBuildings(a.c, p.id);
      const base = b.houses * a.effect.perHouse + b.hotels * a.effect.perHotel;
      if (base <= 0) continue;
      // The builder's teammates pay the bank instead: money never moves between teammates.
      if (builder && !teammates(a.c, p.id, builder.id)) tasks.push(cardPay(a.c, p, to, base, a.cardId, { noMultiplier: true }));
      else tasks.push(cardPay(a.c, p, { kind: 'bank' }, base, a.cardId));
    }
    pushFront(a.c, ...tasks);
  },
  /** A named character pays (into the Quỹ / bank); without them at the table, the fallback applies. */
  character_pays: (a) => {
    const who = characterAtTable(a, a.effect.character);
    if (!who) return fallback(a);
    if (a.exempt.includes(who.id)) return;
    const to = a.effect.to === 'fund' ? { kind: 'fund' as const } : { kind: 'bank' as const };
    pushFront(a.c, cardPay(a.c, who, to, a.effect.amount, a.cardId));
  },
  /** The bank pays a named character; without them at the table, the fallback applies. */
  character_gain: (a) => {
    const who = characterAtTable(a, a.effect.character);
    if (!who) return fallback(a);
    if (!a.exempt.includes(who.id)) gain(a.c, who, a.effect.amount, a.cardId);
  },
  all_pay_owner: (a) => {
    const owner = ownerOf(a.c, a.effect.property);
    if (owner && a.exempt.includes(owner.id)) return; // Giải hạn: the owner neither receives
    const to = owner ? { kind: 'player' as const, id: owner.id } : { kind: 'bank' as const };
    const tasks = affected(a)
      .filter((p) => p.id !== owner?.id && !(owner && teammates(a.c, p.id, owner.id)))
      .map((p) => cardPay(a.c, p, to, a.effect.amount, a.cardId));
    pushFront(a.c, ...tasks);
  },
  pay_percent_cash: (a) => {
    const tasks: Task[] = [];
    for (const p of affected(a)) {
      const pct = eventPercent(a.c, p, a.cardId, a.effect);
      const mult = cardPayMultiplier(a.c, p);
      const step = a.effect.roundDownTo as number;
      const amount = Math.floor((p.cash * pct * mult + 1e-9) / step) * step;
      if (amount > 0) tasks.push(cardPay(a.c, p, { kind: 'bank' }, amount, a.cardId, { noMultiplier: true }));
    }
    pushFront(a.c, ...tasks);
  },
  each_roll_one_die: (a) => {
    const tasks: Task[] = [];
    for (const p of affected(a)) {
      if (isImmune(a.c, p, a.cardId, a.effect)) continue;
      const face = rollDie(a.c.s);
      emit(a.c, 'diceRolled', { player: p.id, dice: [face], purpose: a.cardId });
      if (face !== a.effect.onFace) continue;
      const then = a.effect.then;
      if (then === 'go_to_jail') tasks.push({ t: 'goToJail', player: p.id });
      else if (then?.type === 'pay') {
        const to = then.to === 'fund' ? { kind: 'fund' as const } : { kind: 'bank' as const };
        tasks.push(cardPay(a.c, p, to, then.amount, a.cardId));
      }
    }
    pushFront(a.c, ...tasks);
  },
  richest_cash_gain: (a) => {
    const pool = affected(a);
    if (pool.length === 0) return;
    const max = Math.max(...pool.map((p) => p.cash));
    const winners = pool.filter((p) => p.cash === max);
    const share = a.effect.tieSplit ? Math.floor(a.effect.amount / winners.length) : a.effect.amount;
    for (const p of winners) gain(a.c, p, share, a.cardId);
  },
  composite: (a) => {
    const tasks: Task[] = (a.effect.effects as Effect[]).map((effect) => ({
      t: 'effect',
      player: a.drawer.id,
      cardId: a.cardId,
      effect,
      exempt: a.exempt,
    }));
    pushFront(a.c, ...tasks);
  },
  bank_to_fund: ({ c, effect }) => {
    if (!c.s.config.scholarshipFund) return;
    c.s.fund += effect.amount;
    emit(c, 'fundDeposit', { amount: effect.amount, reason: 'bank' });
  },
  all_pay_character: (a) => {
    const target = a.c.s.config.characters
      ? playersFrom(a.c, a.drawer.id).find((p) => p.character === a.effect.character)
      : undefined;
    if (!target) {
      pushFront(a.c, { t: 'effect', player: a.drawer.id, cardId: a.cardId, effect: a.effect.fallback, exempt: a.exempt });
      return;
    }
    const tasks = affected(a)
      .filter((p) => p.id !== target.id && !teammates(a.c, p.id, target.id))
      .map((p) => cardPay(a.c, p, { kind: 'player', id: target.id }, a.effect.amount, a.cardId));
    pushFront(a.c, ...tasks);
  },
  all_pay: (a) => {
    const to = a.effect.to === 'fund' ? { kind: 'fund' as const } : { kind: 'bank' as const };
    const tasks = affected(a).map((p) => {
      const override = a.c.s.config.characters && p.character ? a.effect.overrides?.[p.character] : undefined;
      return cardPay(a.c, p, to, override ?? a.effect.amount, a.cardId);
    });
    pushFront(a.c, ...tasks);
  },
  drawer_gain: (a) => {
    if (!a.exempt.includes(a.drawer.id)) gain(a.c, a.drawer, a.effect.amount, a.cardId);
  },

  // ---- Hanoi Event: ⏳ (stored, read by rent / roll / build / landing code)
  rent_multiplier: (a) => durationEffect(a),
  single_die: (a) => durationEffect(a),
  unmortgage_interest: (a) => durationEffect(a),
  build_freeze: (a) => durationEffect(a),
  landing_fee: (a) => durationEffect(a),
};

function durationEffect(a: EffectArgs): void {
  addActiveEffect(a.c, {
    source: { kind: 'card', cardId: a.cardId },
    activator: a.drawer.id,
    effect: a.effect,
    exempt: a.exempt,
  });
}

/**
 * Amount per other player for "each player" cards: a fixed `amount`, or a `total`
 * split among them (rounded up to `roundTo`, default 10) so bigger tables do not
 * multiply the card's weight.
 */
export function perPlayer(effect: Effect, others: number): number {
  if (effect.total === undefined) return effect.amount as number;
  const step = (effect.roundTo as number | undefined) ?? 10;
  return Math.ceil((effect.total as number) / Math.max(1, others) / step - 1e-9) * step;
}

export const EFFECT_TYPES = Object.keys(handlers);

export function execEffect(c: Ctx, drawerId: PlayerId, cardId: string, effect: Effect, exempt: PlayerId[]): void {
  const h = handlers[effect.type];
  if (!h) fail(`Unknown effect type ${effect.type}`);
  const drawer = getPlayer(c, drawerId);
  // Characters immune to this card (immune_events): a card that only touches the drawer does
  // nothing, otherwise they are left out like a Giải hạn.
  const immune = activePlayers(c)
    .filter((p) => !exempt.includes(p.id) && isImmune(c, p, cardId, effect))
    .map((p) => p.id);
  if (immune.includes(drawerId) && DRAWER_ONLY.has(effect.type)) {
    emit(c, 'cardImmune', { player: drawerId, cardId });
    return;
  }
  emit(c, 'cardEffect', { player: drawerId, cardId, effect: effect.type });
  h({ c, drawer, cardId, effect, exempt: [...exempt, ...immune] });
}

/** Card effects that only touch the player who drew them. */
const DRAWER_ONLY = new Set(['pay_bank', 'repairs', 'go_to_jail', 'move_to', 'move_to_nearest', 'move_relative']);
