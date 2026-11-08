import { Client, type Room } from 'colyseus.js';
import { pushToast, receiveGame, store } from '../store';
import type { ChatMsg, ClientAction, GameOverMsg, RoomView } from './protocol';

const ROOM_NAME = 'hanoi';
const TOKEN_KEY = 'hanoi-monopoly:reconnect';
const NAME_KEY = 'hanoi-monopoly:name';
/** Colyseus close code for a deliberate leave. */
const CONSENTED = 4000;

export const serverUrl = (): string =>
  import.meta.env.VITE_SERVER_URL ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:2567`;

let client: Client | null = null;
let room: Room | null = null;

function getClient(): Client {
  client ??= new Client(serverUrl());
  return client;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

function attach(r: Room): void {
  room = r;
  storage()?.setItem(TOKEN_KEY, r.reconnectionToken);
  r.onMessage('joined', (m: { role: 'player' | 'spectator' }) => store.set({ role: m.role }));
  r.onMessage('room', (m: RoomView) =>
    store.set((s) =>
      m.phase === 'lobby' && s.room?.phase !== 'lobby'
        ? { room: m, game: null, clock: null, log: [], gameOver: null, turnOrder: null, lastCard: null }
        : { room: m },
    ),
  );
  r.onMessage('game', receiveGame);
  r.onMessage('turnOrder', (m: { order: string[]; rolls: Record<string, number[][]> }) => store.set({ turnOrder: m }));
  r.onMessage('picked', () => undefined);
  r.onMessage('botTakeover', () => undefined);
  r.onMessage('gameOver', (m: GameOverMsg) => store.set({ gameOver: m }));
  r.onMessage('chat', (m: ChatMsg) => store.set((s) => ({ chat: [...s.chat, m].slice(-100) })));
  r.onMessage('emote', (m: ChatMsg) => store.set((s) => ({ chat: [...s.chat, m].slice(-100) })));
  r.onMessage('error', (m: { code: string; message?: string }) => pushToast(m.code, m.message));
  r.onLeave((code: number) => {
    if (room !== r) return;
    room = null;
    if (code === CONSENTED) return;
    store.set({ conn: 'reconnecting' });
    void reconnect();
  });
  store.set({ conn: 'connected' });
}

function failed(e: unknown): void {
  store.set({ conn: 'error' });
  const msg = String((e as Error)?.message ?? e);
  pushToast(/^[A-Z_]+$/.test(msg) ? msg : 'CONNECT');
}

export async function createRoom(name: string): Promise<void> {
  saveName(name);
  store.set({ conn: 'connecting' });
  try {
    attach(await getClient().create(ROOM_NAME, { name }));
  } catch (e) {
    failed(e);
  }
}

export async function joinRoom(code: string, name: string, spectator = false): Promise<void> {
  saveName(name);
  store.set({ conn: 'connecting' });
  try {
    attach(await getClient().joinById(code.trim().toUpperCase(), { name, spectator }));
  } catch (e) {
    failed(e);
  }
}

let reconnecting: Promise<boolean> | null = null;

/**
 * Resume a dropped session (also after a page reload). Only one attempt runs
 * at a time (React StrictMode mounts effects twice in development).
 */
export function reconnect(attempts = 5): Promise<boolean> {
  reconnecting ??= doReconnect(attempts).finally(() => {
    reconnecting = null;
  });
  return reconnecting;
}

async function doReconnect(attempts: number): Promise<boolean> {
  const token = storage()?.getItem(TOKEN_KEY);
  if (!token || store.get().conn === 'connected') return !!token;
  store.set({ conn: 'reconnecting' });
  for (let i = 0; i < attempts; i++) {
    try {
      attach(await getClient().reconnect(token));
      return true;
    } catch {
      // Right after a reload the server may not have seen the old socket close yet.
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      if (store.get().conn === 'connected') return true;
    }
  }
  if (room || store.get().conn === 'connected') return true;
  storage()?.removeItem(TOKEN_KEY);
  store.reset();
  return false;
}

export async function leaveRoom(): Promise<void> {
  storage()?.removeItem(TOKEN_KEY);
  const r = room;
  room = null;
  store.reset();
  await r?.leave(true);
}

export function send(type: string, payload: unknown = {}): void {
  room?.send(type, payload);
}

export function act(action: ClientAction): void {
  send('action', { action });
}
