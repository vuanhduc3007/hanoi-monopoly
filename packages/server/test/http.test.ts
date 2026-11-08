import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'colyseus.js';
import type { Server } from '@colyseus/core';
import { createServer, ROOM_NAME } from '../src';

const PORT = 30_000 + Math.floor(Math.random() * 5000);
let server: Server;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hanoi-static-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Cờ Tỷ Phú Hà Nội</title>');
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app-123.js'), 'console.log(1)');
  server = createServer({ staticDir: dir });
  await server.listen(PORT);
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

function get(path: string): Promise<{ status: number; type: string; cache: string; body: string }> {
  return new Promise((resolve, reject) => {
    // Raw path (no URL normalisation) so traversal attempts reach the server as-is.
    const req = request({ host: 'localhost', port: PORT, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          type: String(res.headers['content-type'] ?? ''),
          cache: String(res.headers['cache-control'] ?? ''),
          body,
        }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

describe('HTTP on the game server', () => {
  it('answers /health', async () => {
    const r = await get('/health');
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toMatchObject({ ok: true });
  });

  it('serves the client, with SPA fallback for invite links', async () => {
    const index = await get('/');
    expect(index.status).toBe(200);
    expect(index.type).toContain('text/html');
    expect(index.body).toContain('Cờ Tỷ Phú Hà Nội');
    expect((await get('/?room=ABC234')).body).toContain('<title>');
    expect((await get('/some/route')).body).toContain('<title>');
  });

  it('caches hashed assets for long, index.html not at all', async () => {
    const asset = await get('/assets/app-123.js');
    expect(asset.type).toContain('javascript');
    expect(asset.cache).toContain('immutable');
    expect((await get('/')).cache).toBe('no-cache');
  });

  it('refuses path traversal', async () => {
    const r = await get('/..%2f..%2fpackage.json');
    expect([403, 404]).toContain(r.status);
    expect(r.body).not.toContain('"name"');
  });

  it('still hosts game rooms on the same port', async () => {
    const room = await new Client(`ws://localhost:${PORT}`).create(ROOM_NAME, { name: 'A' });
    expect(room.roomId).toHaveLength(6);
    await room.leave();
  });
});
