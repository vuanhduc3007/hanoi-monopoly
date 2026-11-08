import type { Action, GameEvent, PublicState } from '@hanoi-monopoly/engine';

/** Mirrors packages/server/README.md. */
export interface ClockInfo {
  kind: string;
  deadline: number;
}

export interface SeatView {
  id: string;
  name: string | null;
  host: boolean;
  ready: boolean;
  character: string | null;
  connected: boolean;
  control: 'human' | 'bot';
  botReason: 'disconnect' | 'afk' | 'left' | null;
}

export interface RoomSettings {
  mode: 'classic' | 'quick';
  characters: boolean;
  scholarshipFund: boolean;
  buildingLimit: boolean;
  maxPlayers: number;
  allowSpectators: boolean;
}

export interface RoomView {
  code: string;
  phase: 'lobby' | 'picking' | 'playing' | 'over';
  settings: RoomSettings;
  you: string | null;
  seats: SeatView[];
  spectators: number;
  picking: { order: string[]; current: string; available: string[]; clock: ClockInfo | null } | null;
}

export interface GameMsg {
  state: PublicState;
  events: GameEvent[];
  clock: ClockInfo | null;
}

export interface GameStats {
  rentPaid: Record<string, number>;
  rentEarned: Record<string, number>;
  rentByTile: Record<string, number>;
}

export interface GameOverMsg {
  winner: string | null;
  ranking: { player: string; score: number }[] | null;
  seed: number;
  stats?: GameStats;
}

export interface ChatMsg {
  from: string | null;
  spectator: boolean;
  text?: string;
  emote?: string;
  at: number;
}

/** An engine action without `player` — the server fills it in. */
export type ClientAction = Action extends infer A ? (A extends { player: string } ? Omit<A, 'player'> : A) : never;
