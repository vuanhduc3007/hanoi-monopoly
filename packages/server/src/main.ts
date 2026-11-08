import { createServer } from './server';

const port = Number(process.env.PORT ?? 2567);
const server = createServer();
await server.listen(port);
console.log(`Hanoi Monopoly server listening on ws://localhost:${port}`);
