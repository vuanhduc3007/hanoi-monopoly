import {
  applyAction,
  createGame,
  dataFor,
  defaultData,
  type GameData,
  type Action,
  type GameConfig,
  type GameEvent,
  type GameState,
  type PlayerState,
} from '../src';

/**
 * Board data with the characters' table-size and mode overrides (`byTableSize`, `byMode`)
 * removed, so the trait tests check the base numbers whatever the test table size or
 * mode. The overrides have their own tests (test/tablesize.test.ts).
 */
export function baseCharacters(d: GameData): GameData {
  const characters = Object.fromEntries(
    Object.entries(d.characters).map(([id, ch]) => [id, { ...ch, byTableSize: undefined, byMode: undefined }]),
  );
  return { ...d, characters };
}

export const D = baseCharacters(defaultData);

/** `D` with one character's fields replaced. */
export function withCharacter(id: string, fields: Partial<GameData['characters'][string]>, base: GameData = D): GameData {
  return { ...base, characters: { ...base.characters, [id]: { ...base.characters[id], ...fields } } };
}

const CARD_TILE: Record<string, number> = { chance: 7, community: 33, event: 17 };

/** Small mutable wrapper around the pure engine for readable tests. */
export class G {
  s: GameState;
  events: GameEvent[] = [];
  /** Flip drawn cards and pay plain rents automatically (Ăn vạ prompts still stop). */
  auto = true;

  d: GameData;

  constructor(s: GameState, d: GameData = baseCharacters(dataFor(s.config.board))) {
    this.s = s;
    this.d = d;
  }

  /** A game on custom data (e.g. a character given a trait no shipped character has). */
  static createWith(d: GameData, chars: (string | null)[], config: Partial<GameConfig> = {}, seed = 42): G {
    const players = chars.map((character, i) => ({ id: `p${i + 1}`, character }));
    return new G(createGame({ players, seed, config }, d).state, d);
  }

  static create(chars: (string | null)[], config: Partial<GameConfig> = {}, seed = 42): G {
    const players = chars.map((character, i) => ({ id: `p${i + 1}`, character }));
    const d = baseCharacters(dataFor(config.board));
    return new G(createGame({ players, seed, config }, d).state, d);
  }

  do(a: Action): GameEvent[] {
    const r = applyAction(this.s, a, this.d);
    this.s = r.state;
    this.events.push(...r.events);
    const out = [...r.events];
    for (let guard = 0; this.auto && guard < 20; guard++) {
      const p = this.s.pending;
      let next: Action | null = null;
      if (p?.type === 'revealCard') next = { type: 'revealCard', player: p.player };
      else if (p?.type === 'payRent' && !p.discount) next = { type: 'payRent', player: p.player };
      if (!next) break;
      const r2 = applyAction(this.s, next, this.d);
      this.s = r2.state;
      this.events.push(...r2.events);
      out.push(...r2.events);
    }
    return out;
  }

  p(id: string): PlayerState {
    return this.s.players.find((x) => x.id === id)!;
  }

  cash(id: string): number {
    return this.p(id).cash;
  }

  rig(...dice: number[]): this {
    this.s.riggedDice.push(...dice);
    return this;
  }

  setCurrent(id: string): this {
    this.s.turn.current = this.s.players.findIndex((x) => x.id === id);
    this.s.turn.phase = 'roll';
    return this;
  }

  at(id: string, pos: number): this {
    this.p(id).position = pos;
    return this;
  }

  give(id: string, props: string[], opts: { level?: number; mortgaged?: boolean } = {}): this {
    for (const pr of props) {
      this.s.ownables[pr] = { owner: id, mortgaged: opts.mortgaged ?? false, level: opts.level ?? 0 };
    }
    return this;
  }

  setCash(id: string, cash: number): this {
    this.p(id).cash = cash;
    return this;
  }

  /** Put a card on top of its deck. */
  top(cardId: string, second?: string): this {
    for (const id of [second, cardId]) {
      if (!id) continue;
      const deck = this.s.decks[D.cards[id].deck];
      const i = deck.indexOf(id);
      if (i >= 0) deck.splice(i, 1);
      deck.unshift(id);
    }
    return this;
  }

  /** Current player rolls the given dice (auto-confirms Grab's post-roll prompt). */
  roll(id: string, d1: number, d2?: number): GameEvent[] {
    this.rig(d1);
    if (d2 !== undefined) this.rig(d2);
    const ev = this.do({ type: 'roll', player: id });
    if (this.s.pending?.type === 'postRoll') ev.push(...this.do({ type: 'confirmRoll', player: id }));
    return ev;
  }

  /**
   * Make `id` draw `cardId` by rolling 1+2 onto the matching card tile.
   * Tarot's two-card choice is answered with `cardId`.
   */
  draw(id: string, cardId: string, extraDice: number[] = []): GameEvent[] {
    const deck = D.cards[cardId].deck;
    this.setCurrent(id).at(id, CARD_TILE[deck] - 3).top(cardId);
    this.rig(1, 2, ...extraDice);
    const ev = this.do({ type: 'roll', player: id });
    if (this.s.pending?.type === 'postRoll') ev.push(...this.do({ type: 'confirmRoll', player: id }));
    if (this.s.pending?.type === 'chooseCard') ev.push(...this.do({ type: 'chooseCard', player: id, cardId }));
    return ev;
  }

  owner(prop: string): string | null {
    return this.s.ownables[prop].owner;
  }
}

export function has(events: GameEvent[], type: string, match: Record<string, unknown> = {}): boolean {
  return events.some((e) => e.type === type && Object.entries(match).every(([k, v]) => e[k] === v));
}
