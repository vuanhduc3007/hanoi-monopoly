import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface HttpOptions {
  /** Built client (packages/client/dist). Omit to serve only /health. */
  staticDir?: string;
  startedAt?: number;
}

/**
 * Plain Node handler for everything Colyseus does not handle itself
 * (it answers /matchmake/* first): GET /health, then the built client with
 * an index.html fallback so invite links like /?room=ABC234 work.
 */
export function createHttpHandler(o: HttpOptions = {}) {
  const root = o.staticDir ? resolve(o.staticDir) : null;
  const startedAt = o.startedAt ?? Date.now();
  return (req: IncomingMessage, res: ServerResponse): void => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, uptimeSec: Math.round((Date.now() - startedAt) / 1000) }));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    if (!root) {
      res.writeHead(404).end();
      return;
    }
    let path: string;
    try {
      path = normalize(join(root, decodeURIComponent(url.pathname)));
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let file = path;
    let stat = safeStat(file);
    if (stat?.isDirectory()) {
      file = join(file, 'index.html');
      stat = safeStat(file);
    }
    if (!stat || !stat.isFile()) {
      // Unknown route → the single-page app.
      file = join(root, 'index.html');
      stat = safeStat(file);
      if (!stat) {
        res.writeHead(404).end();
        return;
      }
    }
    const hashed = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  };
}

function safeStat(p: string) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}
