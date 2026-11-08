import { createServer as createHttpServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';
import { createHttpHandler, type HttpOptions } from './http';

export const ROOM_NAME = 'hanoi';

/** One HTTP server for the game (WebSocket + /matchmake), /health and the built client. */
export function createServer(o: HttpOptions = {}): Server {
  const http = createHttpServer(createHttpHandler(o));
  const server = new Server({ transport: new WebSocketTransport({ server: http }) });
  server.define(ROOM_NAME, GameRoom);
  return server;
}
