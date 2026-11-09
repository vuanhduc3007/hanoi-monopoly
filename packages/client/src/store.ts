import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameEvent } from '@hanoi-monopoly/engine';
import { setBoard, setTablePlayers } from './lib/gameData';
import type { ChatMsg, ClockInfo, GameMsg, GameOverMsg, RoomView } from './net/protocol';

export interface LogLine {
  id: number;
  event: GameEvent;
}

/** A cash change to float over the board / player list. */
export interface MoneyChange {
  id: number;
  player: string;
  delta: number;
  reason: string;
  showAt: number;
}

export interface Toast {
  id: number;
  code: string;
  message?: string;
}

export interface AppState {
  conn: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  role: 'player' | 'spectator' | null;
  room: RoomView | null;
  game: GameMsg | null;
  clock: ClockInfo | null;
  log: LogLine[];
  chat: ChatMsg[];
  toasts: Toast[];
  turnOrder: { order: string[]; rolls: Record<string, number[][]> } | null;
  gameOver: GameOverMsg | null;
  /** Last card drawn, for the flip animation. */
  lastCard: { cardId: string; player: string; at: number } | null;
  /** Board animations (dice, walking) run until this time; prompts wait for it. */
  animUntil: number;
  /** A piece is being arrested right now (CSGT banner). */
  arrest: { player: string; at: number } | null;
  /** The 3D board layer is running (it drives arrests and dice). */
  board3d: boolean;
  money: MoneyChange[];
}

export const initialState: AppState = {
  conn: 'idle',
  role: null,
  room: null,
  game: null,
  clock: null,
  log: [],
  chat: [],
  toasts: [],
  turnOrder: null,
  gameOver: null,
  lastCard: null,
  animUntil: 0,
  arrest: null,
  board3d: false,
  money: [],
};

const LOG_MAX = 300;
let state: AppState = initialState;
const listeners = new Set<() => void>();
let seq = 1;

export const store = {
  get: () => state,
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...p };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  reset() {
    state = initialState;
    listeners.forEach((l) => l());
  },
};

/** Applies a `game` message: new state, appended log, card flip. */
export function receiveGame(msg: GameMsg, now = Date.now()): void {
  setBoard(msg.state.config.board);
  setTablePlayers(msg.state.players.length);
  store.set((s) => {
    const lines = msg.events.map((event) => ({ id: seq++, event }));
    const card = [...msg.events].reverse().find((e) => e.type === 'cardDrawn');
    // A new game (rematch) starts with gameCreated: clear the old log.
    const fresh = msg.events.some((e) => e.type === 'gameCreated');
    return {
      game: msg,
      clock: msg.clock,
      log: [...(fresh ? [] : s.log), ...lines].slice(-LOG_MAX),
      gameOver: fresh ? null : s.gameOver,
      lastCard: card ? { cardId: card.cardId as string, player: card.player as string, at: now } : s.lastCard,
    };
  });
}

export function pushToast(code: string, message?: string): void {
  const id = seq++;
  store.set((s) => ({ toasts: [...s.toasts, { id, code, message }].slice(-4) }));
  setTimeout(() => store.set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4000);
}

export function useStore<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state));
}

/** True once the board animations announced via `animUntil` are over (re-renders when they end). */
export function useAnimSettled(): boolean {
  const until = useStore((s) => s.animUntil);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const left = until - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), left + 20);
    return () => clearTimeout(id);
  }, [until]);
  return Math.max(now, Date.now()) >= until;
}
