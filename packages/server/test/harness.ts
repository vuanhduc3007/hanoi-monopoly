import { GameController, type ClockLike, type ControllerOptions, type GameLog, type Outbox, type Timer } from '../src';

export class FakeClock implements ClockLike {
  t = 1_000_000;
  private seq = 0;
  private timers: { at: number; seq: number; fn: () => void; live: boolean }[] = [];

  now(): number {
    return this.t;
  }

  setTimeout(fn: () => void, ms: number): Timer {
    const entry = { at: this.t + ms, seq: this.seq++, fn, live: true };
    this.timers.push(entry);
    return {
      clear: () => {
        entry.live = false;
        const i = this.timers.indexOf(entry);
        if (i >= 0) this.timers.splice(i, 1);
      },
    };
  }

  /** Advance time, firing due timers in order (including ones they schedule). */
  advance(ms: number): void {
    const end = this.t + ms;
    for (let guard = 0; ; guard++) {
      if (guard > 200_000) throw new Error('FakeClock: too many timers at one instant (infinite loop?)');
      let due: (typeof this.timers)[number] | undefined;
      for (const x of this.timers) {
        if (x.at <= end && (!due || x.at < due.at || (x.at === due.at && x.seq < due.seq))) due = x;
      }
      if (!due) break;
      this.timers.splice(this.timers.indexOf(due), 1);
      due.live = false;
      this.t = Math.max(this.t, due.at);
      due.fn();
    }
    this.t = end;
  }

  pending(): number {
    return this.timers.filter((x) => x.live).length;
  }
}

export interface Sent {
  to: string | '*';
  type: string;
  message: any;
}

export class FakeOutbox implements Outbox {
  sent: Sent[] = [];
  send(sessionId: string, type: string, message: unknown): void {
    this.sent.push({ to: sessionId, type, message });
  }
  broadcast(type: string, message: unknown): void {
    this.sent.push({ to: '*', type, message });
  }
  last(type: string, to?: string): any {
    for (let i = this.sent.length - 1; i >= 0; i--) {
      const m = this.sent[i];
      if (m.type === type && (to === undefined || m.to === to || m.to === '*')) return m.message;
    }
    return undefined;
  }
  errors(to: string): string[] {
    return this.sent.filter((m) => m.to === to && m.type === 'error').map((m) => m.message.code);
  }
  clear(): void {
    this.sent = [];
  }
}

export function harness(opts: Partial<ControllerOptions> = {}) {
  const clock = new FakeClock();
  const out = new FakeOutbox();
  const finished: GameLog[] = [];
  let r = 0.123;
  const ctl = new GameController({
    code: 'ABC234',
    clock,
    outbox: out,
    botDelayMs: 0,
    random: () => (r = (r * 9301 + 0.49297) % 1),
    onFinished: (log) => finished.push(log),
    ...opts,
  });
  return { ctl, clock, out, finished };
}

/** Lobby with n players (sessions s1..sn), all ready, characters off unless asked. */
export function lobby(n: number, characters = false, opts: Partial<ControllerOptions> = {}) {
  const h = harness(opts);
  for (let i = 1; i <= n; i++) h.ctl.join(`s${i}`, { name: `Người ${i}` });
  if (!characters) h.ctl.message('s1', 'setConfig', { characters: false });
  for (let i = 2; i <= n; i++) h.ctl.message(`s${i}`, 'ready', { ready: true });
  return h;
}

export function started(n: number, opts: Partial<ControllerOptions> = {}) {
  const h = lobby(n, false, opts);
  h.ctl.message('s1', 'start', {});
  return h;
}

/** Session id of the player whose turn it is. */
export function currentSession(h: ReturnType<typeof harness>): string {
  const s = h.ctl.state!;
  const id = s.players[s.turn.current].id;
  return h.ctl.seats.find((x) => x.id === id)!.sessionId;
}
