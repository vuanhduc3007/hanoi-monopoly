import { useSyncExternalStore } from 'react';
import type { GameEvent } from '@hanoi-monopoly/engine';
import type { ChatMsg, ClockInfo, GameMsg, GameOverMsg, RoomView } from './net/protocol';

export interface LogLine {
  id: number;
  event: GameEvent;
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
