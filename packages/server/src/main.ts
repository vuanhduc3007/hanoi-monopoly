import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from './server';

const port = Number(process.env.PORT ?? 2567);
// The bundle lives in packages/server/dist; the client build in packages/client/dist.
const staticDir = process.env.STATIC_DIR ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
const server = createServer({ staticDir: existsSync(staticDir) ? staticDir : undefined });
await server.listen(port);
console.log(
  `Hanoi Monopoly server on port ${port}` + (existsSync(staticDir) ? ` (serving ${staticDir})` : ' (no client build found)'),
);
