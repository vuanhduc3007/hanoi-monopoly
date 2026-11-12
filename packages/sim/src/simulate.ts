import { dataFor, defaultData, type BoardId, type BotOptions, type CharacterDef, type GameData, type Mode } from '@hanoi-monopoly/engine';
import { runGame } from './runGame';
import { addRecord, newTotals, type Totals } from './stats';

export interface BatchOptions {
  games: number;
  /** First game seed; game i uses seed + i (reproducible regardless of worker count). */
  seed: number;
  /** Fixed count, or [min, max] picked per game from the seed. */
  players: number | [number, number];
  mode: Mode;
  /** Board layout (default standard). */
  board?: BoardId;
  characters: boolean;
  /** Only deal these characters (default: all). */
  pool?: string[];
  /** Team games: number of teams (seats alternate); 0 = none. */
  teams?: number;
  maxRounds: number;
  quickRounds: number;
  bot?: Partial<BotOptions>;
  /** Experiment overrides: replace fields of characters.json entries (balancing without editing data/). */
  patch?: DataPatch;
}

export interface DataPatch {
  /** Override fields of the board's economy (e.g. goSalaryBonus, transportRent). */
  economy?: Partial<GameData['economy']>;
  /** Override fields of characters.json → rules (e.g. skillCooldownRounds). */
  rules?: Partial<GameData['characterRules']>;
  characters?: Record<string, Partial<Pick<CharacterDef, 'passives' | 'drawbacks' | 'skill' | 'byTableSize'>>>;
}

export function patchedData(patch?: DataPatch, base: GameData = defaultData): GameData {
  if (!patch?.characters && !patch?.rules && !patch?.economy) return base;
  const characters = { ...base.characters };
  for (const [id, fields] of Object.entries(patch.characters ?? {})) {
    if (!characters[id]) throw new Error(`Patch: unknown character ${id}`);
    characters[id] = { ...characters[id], ...fields };
  }
  return {
    ...base,
    characters,
    characterRules: { ...base.characterRules, ...patch.rules },
    economy: { ...base.economy, ...patch.economy },
  };
}

export function playersFor(o: BatchOptions, gameSeed: number): number {
  if (typeof o.players === 'number') return o.players;
  const [lo, hi] = o.players;
  return lo + (((gameSeed * 2654435761) >>> 0) % (hi - lo + 1));
}

/** Runs games [from, to) of a batch and returns their totals. */
export function simulateRange(o: BatchOptions, from: number, to: number): Totals {
  const d = patchedData(o.patch, dataFor(o.board));
  const t = newTotals(d.board.length);
  for (let i = from; i < to; i++) {
    const seed = (o.seed + i) >>> 0;
    addRecord(
      t,
      runGame({
        seed,
        players: playersFor(o, seed),
        mode: o.mode,
        characters: o.characters,
        pool: o.pool,
        teams: o.teams,
        maxRounds: o.maxRounds,
        quickRounds: o.quickRounds,
        bot: o.bot,
      }, d),
    );
  }
  return t;
}
