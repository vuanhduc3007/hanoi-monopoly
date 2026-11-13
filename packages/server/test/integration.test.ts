import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, type Room } from 'colyseus.js';
import type { Server } from '@colyseus/core';
import { createServer, ROOM_NAME } from '../src';

const PORT = 25_000 + Math.floor(Math.random() * 5000);
let server: Server;

beforeAll(async () => {
  process.env.BOT_DELAY_MS = '0';
  server = createServer();
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

function inbox(room: Room) {
  const got: Record<string, any[]> = {};
  room.onMessage('*', (type, msg) => (got[String(type)] ??= []).push(msg));
  const next = (type: string, pred: (m: any) => boolean = () => true, ms = 3000) =>
    new Promise<any>((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const hit = (got[type] ?? []).find(pred);
        if (hit) return resolve(hit);
        if (Date.now() - t0 > ms) return reject(new Error(`timeout waiting for ${type}`));
        setTimeout(tick, 10);
      };
      tick();
    });
  return { got, next };
}

describe('Colyseus room (real server)', () => {
  it('create by code, join, pick characters, play, reconnect', async () => {
    const url = `ws://localhost:${PORT}`;
    const a = new Client(url);
    const b = new Client(url);
    const hostRoom = await a.create(ROOM_NAME, { name: 'Đức' });
    const ha = inbox(hostRoom);
    const code = hostRoom.roomId;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const guest = await b.joinById(code, { name: 'Lan' });
    const hb = inbox(guest);
    const room = await hb.next('room', (m) => m.seats.length === 2);
    expect(room).toMatchObject({ code, phase: 'lobby', you: 'u2' });

    await expect(new Client(url).joinById('ZZZZZZ')).rejects.toBeTruthy();

    guest.send('ready', { ready: true });
    await ha.next('room', (m) => m.seats[1]?.ready);
    hostRoom.send('start', {});
    const picking = await ha.next('room', (m) => m.phase === 'picking');
    const mine = (r: Room, id: string) => (picking.picking.current === id ? r : null);
    const first = mine(hostRoom, 'u1') ?? guest;
    first.send('pick', { character: 'C08' });
    const second = first === hostRoom ? guest : hostRoom;
    await ha.next('room', (m) => m.picking?.order && m.picking.current !== picking.picking.current);
    second.send('pick', { character: 'C07' });

    const game = await ha.next('game');
    expect(game.state.decks).toBeUndefined();
    expect(game.state.players.map((p: any) => p.character).sort()).toEqual(['C07', 'C08']);

    const currentId = game.state.players[game.state.turn.current].id;
    const current = currentId === 'u1' ? hostRoom : guest;
    current.send('action', { action: { type: 'roll' } });
    await ha.next('game', (m) => m.state.turn.dice !== null);

    // Drop the guest's connection and come back with the reconnection token.
    const token = guest.reconnectionToken;
    (guest as any).connection.close(3000); // abnormal close (4000 means consented in Colyseus)
    await ha.next('room', (m) => m.seats.find((s: any) => s.id === 'u2')?.connected === false);
    const back = await new Client(url).reconnect(token);
    const hc = inbox(back);
    const snapshot = await hc.next('room');
    expect(snapshot.you).toBe('u2');
    await hc.next('game');

    // Reload on a proxied host: the old socket is still open when the page comes back.
    const zombieWatch = inbox(back);
    void zombieWatch;
    const again = await new Client(url).joinById(code, { secret: 'g'.repeat(32), resume: true }).catch((e) => e);
    expect(String(again)).toMatch(/NO_SEAT/);

    hostRoom.send('chat', { text: 'chào' });
    await hc.next('chat', (m) => m.text === 'chào');
    await back.leave();
    await hostRoom.leave();
  }, 20_000);

  it('reload with the seat secret while the old socket is still open', async () => {
    const url = `ws://localhost:${PORT}`;
    const host = await new Client(url).create(ROOM_NAME, { name: 'A', secret: 'a'.repeat(32) });
    const code = host.roomId;
    const b = await new Client(url).joinById(code, { name: 'B', secret: 'b'.repeat(32) });
    const hb = inbox(b);
    const ha = inbox(host);
    await hb.next('room', (m) => m.seats.length === 2);
    host.send('setConfig', { characters: false });
    b.send('ready', { ready: true });
    await ha.next('room', (m) => m.seats[1]?.ready && m.settings.characters === false);
    host.send('start', {});
    await ha.next('game');
    let kicked = false;
    b.onLeave(() => (kicked = true));
    // The "reloaded page": new connection, same secret, old one never closed.
    const b2 = await new Client(url).joinById(code, { secret: 'b'.repeat(32), resume: true });
    const h2 = inbox(b2);
    const room = await h2.next('room');
    expect(room.you).toBe('u2');
    expect(room.phase).toBe('playing');
    await h2.next('game');
    await new Promise((r) => setTimeout(r, 300));
    expect(kicked).toBe(true);
    await b2.leave();
    await host.leave();
  }, 20_000);

  it('host kicks a lobby player: told, disconnected, refused when coming back', async () => {
    const url = `ws://localhost:${PORT}`;
    const host = await new Client(url).create(ROOM_NAME, { name: 'A', secret: 'a'.repeat(32) });
    const code = host.roomId;
    const b = await new Client(url).joinById(code, { name: 'B', secret: 'k'.repeat(32) });
    const ha = inbox(host);
    const hb = inbox(b);
    await ha.next('room', (m) => m.seats.length === 2);
    const left = new Promise<number>((resolve) => b.onLeave((c) => resolve(c)));
    host.send('kick', { seat: 'u2' });
    await hb.next('kicked');
    expect(await left).toBe(4000);
    await ha.next('room', (m) => m.seats.length === 1);
    const again = await new Client(url).joinById(code, { name: 'B', secret: 'k'.repeat(32) }).catch((e) => e);
    expect(String(again?.message ?? again)).toContain('KICKED');
    await host.leave();
  }, 20_000);
});
