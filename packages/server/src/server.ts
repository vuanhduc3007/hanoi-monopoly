import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { GameRoom } from './GameRoom';

export const ROOM_NAME = 'hanoi';

export function createServer(): Server {
  const server = new Server({ transport: new WebSocketTransport() });
  server.define(ROOM_NAME, GameRoom);
  return server;
}
