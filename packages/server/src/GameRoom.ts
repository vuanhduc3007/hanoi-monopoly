import { Room, ServerError, type Client } from '@colyseus/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultData } from '@hanoi-monopoly/engine';
import { allocateCode, releaseCode } from './codes';
import { GameController, RoomError, type GameLog, type Timer } from './controller';

export interface GameRoomOptions {
  name?: string;
  /** Test hook: bot delay in ms. */
  botDelayMs?: number;
}

const SPECTATOR_SLOTS = 50;

/** Thin Colyseus adapter: the rules of the room live in GameController. */
export class GameRoom extends Room {
  maxClients = defaultData.config.room.maxPlayers + SPECTATOR_SLOTS;
  private ctl!: GameController;
  private timers = new Set<NodeJS.Timeout>();

  onCreate(options: GameRoomOptions = {}): void {
    this.roomId = allocateCode(defaultData.config.room.roomCodeLength);
    void this.setPrivate(true); // join by code / invite link only
    const timers = this.timers;
    this.ctl = new GameController({
      code: this.roomId,
      botDelayMs: options.botDelayMs ?? Number(process.env.BOT_DELAY_MS ?? 800),
      clock: {
        now: () => Date.now(),
        setTimeout: (fn, ms): Timer => {
          const h = setTimeout(() => {
            timers.delete(h);
            try {
              fn();
            } catch (e) {
              console.error(`[${this.roomId}] timer error`, e);
            }
          }, ms);
          timers.add(h);
          return { clear: () => (clearTimeout(h), timers.delete(h)) };
        },
      },
      outbox: {
        send: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
        broadcast: (type, message) => this.broadcast(type, message),
      },
      onFinished: (log) => this.saveLog(log),
    });
    this.onMessage('*', (client, type, message) => {
      try {
        this.ctl.message(client.sessionId, String(type), message);
      } catch (e) {
        console.error(`[${this.roomId}] message error`, e);
        client.send('error', { code: 'INTERNAL' });
      }
    });
  }

  onJoin(client: Client, options: { name?: unknown; spectator?: unknown } = {}): void {
    try {
      const role = this.ctl.join(client.sessionId, options);
      client.send('joined', { role, code: this.roomId });
    } catch (e) {
      if (e instanceof RoomError) throw new ServerError(4000, e.code);
      throw e;
    }
  }

  async onLeave(client: Client, consented?: boolean): Promise<void> {
    const hold = this.ctl.leave(client.sessionId, !!consented);
    if (hold === 0) return;
    try {
      await this.allowReconnection(client, hold === 'forever' ? 'manual' : hold);
      this.ctl.rejoin(client.sessionId);
    } catch {
      this.ctl.dropSeat(client.sessionId);
    }
  }

  onDispose(): void {
    this.ctl.dispose();
    for (const h of this.timers) clearTimeout(h);
    releaseCode(this.roomId);
  }

  private saveLog(log: GameLog): void {
    const dir = process.env.LOG_DIR;
    if (!dir) return;
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${log.code}-${log.startedAt}.json`), JSON.stringify(log));
    } catch (e) {
      console.error(`[${this.roomId}] could not write log`, e);
    }
  }
}
