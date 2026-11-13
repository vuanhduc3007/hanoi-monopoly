import { Client, type Room } from 'colyseus.js';
import { tutorial } from '../lib/tutorialStore';
import { pushToast, receiveGame, store } from '../store';
import type { ChatMsg, ClientAction, ClockInfo, GameOverMsg, RoomView } from './protocol';

const ROOM_NAME = 'hanoi';
const TOKEN_KEY = 'hanoi-monopoly:reconnect';
const NAME_KEY = 'hanoi-monopoly:name';
/** Per-tab player secret: lets a reloaded page take its seat back. */
const SECRET_KEY = 'hanoi-monopoly:secret';
/** Last room + secret, for browsers that lose sessionStorage on reload (in-app webviews). */
const LAST_KEY = 'hanoi-monopoly:last';
/** Room code → seat secret for recent rooms, so re-entering a code in a new tab takes the seat back. */
const SEATS_KEY = 'hanoi-monopoly:seats';
/** Colyseus close code for a deliberate leave. */
const CONSENTED = 4000;

/**
 * Game server address: VITE_SERVER_URL if set; in a production build the
 * page's own origin (the server also serves the client, e.g. on Render);
 * in development the Vite page talks to the game server on port 2567.
 */
export function serverUrl(env: { VITE_SERVER_URL?: string; PROD?: boolean } = import.meta.env, loc: Location = location): string {
  if (env.VITE_SERVER_URL) return env.VITE_SERVER_URL;
  const ws = loc.protocol === 'https:' ? 'wss' : 'ws';
  return env.PROD ? `${ws}://${loc.host}` : `${ws}://${loc.hostname}:2567`;
}

/**
 * Invite link for a room: VITE_PUBLIC_URL if set (packaged apps, whose own
 * origin is the app shell rather than the website), else the current page.
 */
export function inviteLink(code: string, env: { VITE_PUBLIC_URL?: string } = import.meta.env, loc: Location = location): string {
  return `${env.VITE_PUBLIC_URL || `${loc.origin}${loc.pathname}`}?room=${code}`;
}

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

function local(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function seatSecrets(): Record<string, string> {
  try {
    const v = JSON.parse(local()?.getItem(SEATS_KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function rememberSeat(code: string, secret: string): void {
  const all = Object.entries(seatSecrets()).filter(([c]) => c !== code);
  try {
    local()?.setItem(SEATS_KEY, JSON.stringify(Object.fromEntries([...all.slice(-9), [code, secret]])));
  } catch {
    /* ignore */
  }
}

function randomSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** This tab's secret (created on first use). */
export function mySecret(): string {
  const ss = storage();
  let secret = ss?.getItem(SECRET_KEY) ?? null;
  if (!secret) {
    secret = randomSecret();
    ss?.setItem(SECRET_KEY, secret);
  }
  return secret;
}

/** Where to go back to after a reload: this tab's room, else the last room in this browser. */
export function resumeTarget(): { code: string; secret: string } | null {
  const token = storage()?.getItem(TOKEN_KEY);
  const secret = storage()?.getItem(SECRET_KEY);
  if (token && secret) return { code: token.split(':')[0], secret };
  // The browser-wide fallback is only for a real reload — a new tab is a new player.
  if (!wasReload()) return null;
  try {
    const last = JSON.parse(local()?.getItem(LAST_KEY) ?? 'null') as { code?: string; secret?: string } | null;
    if (last?.code && last.secret) return { code: last.code, secret: last.secret };
  } catch {
    /* ignore */
  }
  return null;
}

function wasReload(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'reload';
  } catch {
    return false;
  }
}

function forget(): void {
  storage()?.removeItem(TOKEN_KEY);
  local()?.removeItem(LAST_KEY);
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

function attach(r: Room, secret: string = mySecret()): void {
  room = r;
  storage()?.setItem(TOKEN_KEY, r.reconnectionToken);
  storage()?.setItem(SECRET_KEY, secret);
  local()?.setItem(LAST_KEY, JSON.stringify({ code: r.roomId, secret }));
  r.onMessage('joined', (m: { role: 'player' | 'spectator' }) => {
    // Only a seat is worth coming back to (a spectator must not overwrite it).
    if (m.role === 'player') {
      rememberSeat(r.roomId, secret);
      r.send('learner', { on: tutorial.get().enabled });
    }
    store.set({ role: m.role });
  });
  r.onMessage('room', (m: RoomView) =>
    store.set((s) =>
      m.phase === 'lobby' && s.room?.phase !== 'lobby'
        ? { room: m, game: null, clock: null, log: [], gameOver: null, turnOrder: null, lastCard: null }
        : { room: m },
    ),
  );
  r.onMessage('game', receiveGame);
  r.onMessage('clock', (m: { clock: ClockInfo | null }) => store.set({ clock: m.clock }));
  r.onMessage('turnOrder', (m: { order: string[]; rolls: Record<string, number[][]> }) => store.set({ turnOrder: m }));
  r.onMessage('picked', () => undefined);
  r.onMessage('botTakeover', () => undefined);
  r.onMessage('humanBack', () => undefined);
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
    attach(await getClient().create(ROOM_NAME, { name, secret: mySecret() }));
  } catch (e) {
    failed(e);
  }
}

export async function joinRoom(code: string, name: string, spectator = false): Promise<void> {
  saveName(name);
  store.set({ conn: 'connecting' });
  const id = code.trim().toUpperCase();
  // Played in this room from this browser before (tab closed, phone restarted…)? Take that seat back.
  const saved = seatSecrets()[id];
  if (saved && saved !== mySecret() && !spectator) {
    try {
      attach(await getClient().joinById(id, { secret: saved, reclaim: true }), saved);
      return;
    } catch {
      /* seat gone, or still open in another tab: join as usual */
    }
  }
  try {
    attach(await getClient().joinById(id, { name, spectator, secret: mySecret() }));
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
  const target = resumeTarget();
  if ((!token && !target) || store.get().conn === 'connected') return !!(token || target);
  store.set({ conn: 'reconnecting' });
  for (let i = 0; i < attempts; i++) {
    // 1. Colyseus reconnection token (works when the server already saw the old socket close).
    if (token) {
      try {
        attach(await getClient().reconnect(token));
        return true;
      } catch {
        /* fall through */
      }
    }
    // 2. Take the seat back with this player's secret. Behind a proxy (Render) the
    //    old socket can look alive for a while, which blocks plain reconnection.
    if (target) {
      try {
        attach(await getClient().joinById(target.code, { secret: target.secret, resume: true }), target.secret);
        return true;
      } catch (e) {
        if (String((e as Error)?.message ?? e).includes('NO_SEAT')) break;
      }
    }
    if (store.get().conn === 'connected') return true;
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  if (room || store.get().conn === 'connected') return true;
  forget();
  store.reset();
  return false;
}

export async function leaveRoom(): Promise<void> {
  forget();
  const r = room;
  room = null;
  store.reset();
  await r?.leave(true);
}

export function send(type: string, payload: unknown = {}): void {
  room?.send(type, payload);
}

/** Tutorial on/off (or start over): saved in this browser and shown to the table as 🎓. */
export function setTutorial(on: boolean, restart = false): void {
  if (restart) tutorial.restart();
  else tutorial.setEnabled(on);
  if (store.get().role === 'player') send('learner', { on: tutorial.get().enabled });
}

export function act(action: ClientAction): void {
  send('action', { action });
}
