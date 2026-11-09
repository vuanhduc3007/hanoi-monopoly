import { describe, expect, it } from 'vitest';
import { defaultData as D } from '@hanoi-monopoly/engine';
import { RoomError, replay } from '../src';
import { currentSession, harness, lobby, started } from './harness';

const T = D.config.timers;
const sec = (n: number) => n * 1000;

describe('lobby', () => {
  it('first player hosts; extra joiners become spectators; host passes on', () => {
    const { ctl } = harness();
    for (let i = 1; i <= 6; i++) expect(ctl.join(`s${i}`, { name: `  A${i}  ` })).toBe('player');
    expect(ctl.seats[0]).toMatchObject({ host: true, name: 'A1' });
    expect(ctl.join('s7')).toBe('spectator');
    ctl.leave('s1', true);
    expect(ctl.seats).toHaveLength(5);
    expect(ctl.seats[0].host).toBe(true);
  });

  it('refuses joins when full and spectators are off', () => {
    const { ctl } = harness();
    ctl.join('s1');
    ctl.message('s1', 'setConfig', { maxPlayers: 2, allowSpectators: false });
    ctl.join('s2');
    expect(() => ctl.join('s3')).toThrow(RoomError);
  });

  it('only the host configures; bad values are rejected; quick mode turns the Quỹ off', () => {
    const { ctl, out } = harness();
    ctl.join('s1');
    ctl.join('s2');
    ctl.message('s2', 'setConfig', { mode: 'quick' });
    expect(out.errors('s2')).toEqual(['NOT_HOST']);
    ctl.message('s1', 'setConfig', { maxPlayers: 9 });
    expect(out.errors('s1')).toEqual(['BAD_CONFIG']);
    ctl.message('s1', 'setConfig', { mode: 'quick' });
    expect(ctl.settings).toMatchObject({ mode: 'quick', scholarshipFund: false });
  });

  it('start needs 2+ players, all ready', () => {
    const { ctl, out } = harness();
    ctl.join('s1');
    ctl.message('s1', 'start', {});
    expect(out.errors('s1')).toEqual(['NOT_ENOUGH_PLAYERS']);
    ctl.join('s2');
    ctl.message('s1', 'start', {});
    expect(out.errors('s1')).toContain('NOT_READY');
    ctl.message('s2', 'ready', { ready: true });
    ctl.message('s1', 'start', {});
    expect(ctl.phase).toBe('picking');
  });

  it('lobby disconnect holds the seat briefly, then drops it', () => {
    const { ctl } = harness();
    ctl.join('s1');
    ctl.join('s2');
    expect(ctl.leave('s2', false)).toBe(20);
    expect(ctl.seats[1].connected).toBe(false);
    ctl.dropSeat('s2');
    expect(ctl.seats).toHaveLength(1);
  });
});

describe('turn order and character picks', () => {
  it('picks go in reverse turn order; taken / out-of-turn picks fail; timeout picks at random', () => {
    const { ctl, out, clock } = lobby(3, true);
    ctl.message('s1', 'start', {});
    const order = out.last('turnOrder').order as string[];
    expect([...order].sort()).toEqual(['u1', 'u2', 'u3']);
    const room = out.last('room', 's1');
    expect(room.picking.order).toEqual([...order].reverse());
    const sessionOf = (id: string) => ctl.seats.find((s) => s.id === id)!.sessionId;
    const [first, second] = room.picking.order;
    ctl.message(sessionOf(second), 'pick', { character: 'C01' });
    expect(out.errors(sessionOf(second))).toEqual(['NOT_YOUR_PICK']);
    ctl.message(sessionOf(first), 'pick', { character: 'C01' });
    ctl.message(sessionOf(second), 'pick', { character: 'C01' });
    expect(out.errors(sessionOf(second))).toContain('CHARACTER_TAKEN');
    ctl.message(sessionOf(second), 'pick', { character: 'C02' });
    clock.advance(sec(D.characterRules.pickTimerSec));
    expect(ctl.phase).toBe('playing');
    const chars = ctl.state!.players.map((p) => p.character);
    expect(new Set(chars).size).toBe(3);
    expect(out.last('picked').random).toBe(true);
    expect(ctl.state!.players.map((p) => p.id)).toEqual(order);
  });

  it('characters off → game starts immediately with the room config', () => {
    const { ctl } = started(2);
    expect(ctl.phase).toBe('playing');
    expect(ctl.state!.config.characters).toBe(false);
    expect(ctl.log!.seed).toBe(ctl.state!.seed);
  });
});

describe('playing', () => {
  it('broadcasts a public view (no deck order / seed) with the clock', () => {
    const { out } = started(2);
    const g = out.last('game');
    expect(g.state.decks).toBeUndefined();
    expect(g.state.seed).toBeNull();
    expect(g.clock).toMatchObject({ kind: 'roll' });
  });

  it('actions are bound to the sender; server-only actions and rule errors are refused', () => {
    const h = started(2);
    const cur = currentSession(h);
    const other = cur === 's1' ? 's2' : 's1';
    h.ctl.message(other, 'action', { action: { type: 'roll', player: h.ctl.seatBySession(cur)!.id } });
    expect(h.out.errors(other)).toEqual(['RULE']); // rolled as itself → not its turn
    h.ctl.message(cur, 'action', { action: { type: 'timeout' } });
    expect(h.out.errors(cur)).toEqual(['BAD_MESSAGE']);
    h.ctl.state!.riggedDice = [3, 4];
    h.ctl.message(cur, 'action', { action: { type: 'roll' } });
    expect(h.ctl.state!.turn.dice).toEqual([3, 4]);
    expect(h.ctl.log!.actions).toHaveLength(1);
  });

  it('roll clock: auto-roll after 15s, then the turn clock ends the turn', () => {
    const h = started(2);
    const first = h.ctl.state!.turn.current;
    h.ctl.state!.riggedDice = [3, 4]; // → Cơ hội, no purchase decision
    h.clock.advance(sec(T.rollSec));
    expect(h.ctl.state!.turn.dice).toEqual([3, 4]);
    expect(h.ctl.state!.turn.phase).toBe('end');
    h.clock.advance(sec(T.turnSec));
    expect(h.ctl.state!.turn.current).not.toBe(first);
  });

  it('buy clock → auction; each bid resets the auction clock to 5s', () => {
    const h = started(3);
    const cur = currentSession(h);
    h.ctl.state!.riggedDice = [1, 2]; // → P02
    h.ctl.message(cur, 'action', { action: { type: 'roll' } });
    expect(h.out.last('game').clock.kind).toBe('buy');
    h.clock.advance(sec(T.buyDecisionSec));
    expect(h.ctl.state!.pending?.type).toBe('auction');
    h.clock.advance(sec(D.economy.auction.timerSec) - 100);
    h.ctl.message('s2', 'action', { action: { type: 'bid', amount: 10 } });
    h.clock.advance(sec(D.economy.auction.resetSec) - 100);
    expect(h.ctl.state!.pending?.type).toBe('auction');
    h.clock.advance(200);
    expect(h.ctl.state!.ownables.P02.owner).toBe(h.ctl.seatBySession('s2')!.id);
  });

  it('a drawn card stays face down for clients, flips on click or after the reveal clock', () => {
    const h = started(2);
    const cur = currentSession(h);
    h.ctl.state!.riggedDice = [3, 4]; // → 7 Cơ hội
    h.ctl.message(cur, 'action', { action: { type: 'roll' } });
    const g = h.out.last('game');
    expect(g.state.pending).toMatchObject({ type: 'revealCard', cardId: '' });
    expect(g.clock.kind).toBe('reveal');
    h.clock.advance(sec(T.revealCardSec));
    expect(h.ctl.state!.pending?.type).not.toBe('revealCard');
    expect(h.out.sent.some((m) => m.type === 'game' && m.message.events.some((e: any) => e.type === 'cardDrawn'))).toBe(true);
  });

  it('rent waits for the pay button, then pays itself when the clock runs out', () => {
    const h = started(2);
    const cur = currentSession(h);
    const me = h.ctl.seatBySession(cur)!.id;
    const other = h.ctl.seats.find((x) => x.id !== me)!.id;
    h.ctl.state!.ownables.P02 = { owner: other, mortgaged: false, level: 0 };
    h.ctl.state!.riggedDice = [1, 2];
    h.ctl.message(cur, 'action', { action: { type: 'roll' } });
    expect(h.out.last('game').clock.kind).toBe('rent');
    const before = h.ctl.state!.players.find((p) => p.id === me)!.cash;
    h.clock.advance(sec(T.payRentSec));
    expect(h.ctl.state!.players.find((p) => p.id === me)!.cash).toBe(before - 4);
  });

  it('trade offers expire after 30s', () => {
    const h = started(2);
    h.ctl.message('s1', 'action', {
      action: { type: 'proposeTrade', to: h.ctl.seatBySession('s2')!.id, offer: { cash: 10 }, request: {} },
    });
    expect(h.ctl.state!.trades).toHaveLength(1);
    h.clock.advance(sec(T.tradeOfferSec) - 1);
    expect(h.ctl.state!.trades).toHaveLength(1);
    h.clock.advance(1);
    expect(h.ctl.state!.trades).toHaveLength(0);
  });

  it('3 timed-out turns in a row → a bot takes over for the rest of the game', () => {
    const h = started(2);
    const afk = h.ctl.seats.find((s) => s.id === h.ctl.state!.players[h.ctl.state!.turn.current].id)!;
    const otherSession = h.ctl.seats.find((s) => s !== afk)!.sessionId;
    for (let turn = 0; turn < 3; turn++) {
      // AFK player's turn: let every clock run out.
      while (h.ctl.seats.find((s) => s.id === afk.id)!.control === 'human' && currentSession(h) === afk.sessionId) {
        h.clock.advance(sec(T.turnSec));
      }
      if (afk.control === 'bot') break;
      // Other player plays quickly.
      while (currentSession(h) === otherSession && h.ctl.phase === 'playing') {
        const s = h.ctl.state!;
        if (s.pending) h.clock.advance(sec(T.liquidationSec));
        else h.ctl.message(otherSession, 'action', { action: { type: s.turn.phase === 'roll' ? 'roll' : 'endTurn' } });
      }
    }
    expect(afk).toMatchObject({ control: 'bot', botReason: 'afk' });
    expect(h.out.last('botTakeover')).toEqual({ seat: afk.id, reason: 'afk' });
    h.ctl.message(afk.sessionId, 'action', { action: { type: 'roll' } });
    expect(h.out.errors(afk.sessionId)).toContain('BOT_CONTROLLED');
  });

  it('disconnect: bot after 60s, human again on reconnection', () => {
    const h = started(2);
    const s2 = h.ctl.seatBySession('s2')!;
    expect(h.ctl.leave('s2', false)).toBe('forever');
    h.clock.advance(sec(T.disconnectBotSec) - 1);
    expect(s2.control).toBe('human');
    h.clock.advance(1);
    expect(s2).toMatchObject({ control: 'bot', botReason: 'disconnect' });
    h.ctl.rejoin('s2');
    expect(s2).toMatchObject({ control: 'human', connected: true, botReason: null });
    expect(h.out.last('game', 's2')).toBeTruthy();
  });

  it('leaving on purpose hands the seat to a bot right away', () => {
    const h = started(2);
    expect(h.ctl.leave('s2', true)).toBe(0);
    expect(h.ctl.seatBySession('s2')).toMatchObject({ control: 'bot', botReason: 'left' });
  });

  it('bots play an abandoned game; it ends after 10 min alone; the log replays to the same state', () => {
    const h = started(4, { botDelayMs: 500 });
    for (const s of ['s1', 's2', 's3', 's4']) h.ctl.leave(s, true);
    h.clock.advance(sec(60) * 10 - 1);
    if (h.ctl.phase === 'playing') {
      expect(h.ctl.log!.actions.length).toBeGreaterThan(100);
      h.clock.advance(1);
    }
    expect(h.ctl.phase).toBe('over');
    expect(h.finished).toHaveLength(1);
    const log = JSON.parse(JSON.stringify(h.finished[0]));
    const final = replay(log);
    expect(final.winner).toBe(h.ctl.state!.winner);
    expect(final.players).toEqual(h.ctl.state!.players);
    expect(h.out.last('gameOver').seed).toBe(log.seed);
  });

  it('quick mode ends at the time limit (or the 2nd bankruptcy)', () => {
    const h = lobby(2, false, { botDelayMs: 500, abandonAfterMs: 24 * 3_600_000 });
    h.ctl.message('s1', 'setConfig', { mode: 'quick' });
    h.ctl.message('s1', 'start', {});
    h.ctl.leave('s1', false);
    h.ctl.leave('s2', false);
    // Nobody plays: clocks + bots (after 60s) keep it moving until the 60-minute limit.
    h.clock.advance(D.config.quickMode.timeLimitMin * 60_000 + 1);
    expect(h.ctl.phase).toBe('over');
    expect(h.ctl.state!.ranking).toHaveLength(2);
  });
});

describe('end of game', () => {
  it('gameOver carries rent stats; host can start a rematch with the players still here', () => {
    const h = started(3, { botDelayMs: 500 });
    for (const sid of ['s1', 's2', 's3']) h.ctl.leave(sid, false);
    h.clock.advance(sec(T.disconnectBotSec));
    h.ctl.rejoin('s1');
    h.ctl.rejoin('s2');
    // s1 and s2 are back but let the bots finish quickly: end by host-less time limit
    (h.ctl as any).systemAction({ type: 'endGame' });
    expect(h.ctl.phase).toBe('over');
    const over = h.out.last('gameOver');
    expect(over.stats).toHaveProperty('rentByTile');
    h.ctl.message('s2', 'rematch', {});
    expect(h.out.errors('s2')).toContain('NOT_HOST');
    h.ctl.message('s1', 'rematch', {});
    expect(h.ctl.phase).toBe('lobby');
    expect(h.ctl.seats.map((s) => s.sessionId)).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(h.ctl.seats).toHaveLength(2);
    expect(h.ctl.seats.every((s) => !s.character && s.control === 'human' && !s.ready)).toBe(true);
    h.ctl.message(h.ctl.seats.find((s) => !s.host)!.sessionId, 'ready', { ready: true });
    h.ctl.message('s1', 'setConfig', { characters: false });
    h.ctl.message('s1', 'start', {});
    expect(h.ctl.phase).toBe('playing');
    expect(h.ctl.log!.actions).toHaveLength(0);
  });
});

describe('chat', () => {
  it('trims, limits length and rate', () => {
    const { ctl, out, clock } = harness();
    ctl.join('s1');
    ctl.join('v', { spectator: true });
    ctl.message('s1', 'chat', { text: '  xin chào  ' });
    expect(out.last('chat')).toMatchObject({ from: 'u1', text: 'xin chào', spectator: false });
    ctl.message('s1', 'chat', { text: 'spam' });
    expect(out.errors('s1')).toEqual(['RATE_LIMIT']);
    clock.advance(1000);
    ctl.message('s1', 'chat', { text: 'x'.repeat(500) });
    expect(out.last('chat').text).toHaveLength(200);
    ctl.message('v', 'emote', { emote: 'clap' });
    expect(out.last('emote')).toMatchObject({ from: null, spectator: true, emote: 'clap' });
  });
});
