import { describe, expect, it } from 'vitest';
import { defaultData as D } from '@hanoi-monopoly/engine';
import { RoomError, replay } from '../src';
import { currentSession, harness, lobby, started } from './harness';

const T = D.config.timers;
const sec = (n: number) => n * 1000;

describe('lobby', () => {
  it('first player hosts; extra joiners become spectators; host passes on', () => {
    const { ctl } = harness();
    const max = D.config.room.maxPlayers;
    for (let i = 1; i <= max; i++) expect(ctl.join(`s${i}`, { name: `  A${i}  ` })).toBe('player');
    expect(ctl.seats[0]).toMatchObject({ host: true, name: 'A1' });
    expect(ctl.join(`s${max + 1}`)).toBe('spectator');
    ctl.leave('s1', true);
    expect(ctl.seats).toHaveLength(max - 1);
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

describe('kick', () => {
  const secret = (n: number) => `secret-of-player-${n}`;

  it('host removes a lobby player, who is told, disconnected and cannot come back', () => {
    const kickedSessions: string[] = [];
    const { ctl, out } = harness({ onKicked: (id) => kickedSessions.push(id) });
    ctl.join('s1', { name: 'A', secret: secret(1) });
    ctl.join('s2', { name: 'B', secret: secret(2) });
    ctl.join('s3', { name: 'C', secret: secret(3) });
    ctl.message('s1', 'kick', { seat: 'u2' });
    expect(ctl.seats.map((s) => s.id)).toEqual(['u1', 'u3']);
    expect(out.sent.some((x) => x.to === 's2' && x.type === 'kicked')).toBe(true);
    expect(kickedSessions).toEqual(['s2']);
    expect(out.last('room', 's1').seats).toHaveLength(2);
    // Same browser: refused as a player, on resume and as a spectator.
    for (const o of [{ name: 'B' }, { resume: true }, { spectator: true }]) {
      expect(() => ctl.join('s2b', { ...o, secret: secret(2) })).toThrow(expect.objectContaining({ code: 'KICKED' }));
    }
    // Someone else can still take the free seat.
    expect(ctl.join('s4', { name: 'D', secret: secret(4) })).toBe('player');
  });

  it('only the host kicks, never themselves, and only in the lobby', () => {
    const { ctl, out } = lobby(3, true);
    ctl.message('s2', 'kick', { seat: 'u3' });
    expect(out.errors('s2')).toEqual(['NOT_HOST']);
    ctl.message('s1', 'kick', { seat: 'u1' });
    ctl.message('s1', 'kick', { seat: 'nobody' });
    expect(out.errors('s1')).toEqual(['BAD_MESSAGE', 'BAD_MESSAGE']);
    expect(ctl.seats).toHaveLength(3);
    ctl.message('s1', 'start', {});
    ctl.message('s1', 'kick', { seat: 'u3' });
    expect(out.errors('s1')).toContain('WRONG_PHASE');
    expect(ctl.seats).toHaveLength(3);
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

  it('quick mode: the room tells everyone when the game ends on time, and it does end then', () => {
    const h = lobby(2, false);
    h.ctl.message('s1', 'setConfig', { mode: 'quick' });
    h.ctl.message('s2', 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    const ms = D.config.quickMode.timeLimitMin * 60_000;
    expect(h.out.last('room', 's2').quickEndsAt).toBe(h.clock.now() + ms);
    h.clock.advance(ms + 10);
    expect(h.out.last('game').state.status).toBe('over');
    expect(h.out.last('room', 's2').quickEndsAt).toBeNull();
  });

  it('a learner (tutorial on) is marked for the table and gets learnerExtraSec more on decisions', () => {
    const h = lobby(2, false);
    h.ctl.message('s1', 'learner', { on: true });
    h.ctl.message('s2', 'learner', { on: true });
    expect(h.out.last('room', 's1').seats.map((x: { learner: boolean }) => x.learner)).toEqual([true, true]);
    h.ctl.message('s1', 'start', {});
    h.ctl.state!.riggedDice = [3, 4];
    h.clock.advance(sec(T.rollSec) + 10);
    expect(h.ctl.state!.turn.dice).toBeNull(); // still thinking
    h.clock.advance(sec(T.learnerExtraSec));
    expect(h.ctl.state!.turn.dice).toEqual([3, 4]);
    h.ctl.message('s1', 'learner', { on: false });
    expect(h.ctl.seatBySession('s1')!.learner).toBe(false);
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
    // Coming back and pressing anything (or "Tôi chơi tiếp") gives the seat back.
    h.ctl.message(afk.sessionId, 'reclaim', {});
    expect(afk).toMatchObject({ control: 'human', botReason: null, afkTurns: 0 });
    expect(h.out.last('humanBack')).toEqual({ seat: afk.id });
  });

  it('a player who pressed Rời phòng and comes back with the same browser plays again', () => {
    const h = harness();
    h.ctl.join('s1', { secret: 'a'.repeat(32) });
    h.ctl.join('s2', { secret: 'b'.repeat(32) });
    h.ctl.message('s1', 'setConfig', { characters: false });
    h.ctl.message('s2', 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    h.ctl.leave('s2', true);
    expect(h.ctl.seats.find((x) => x.id === 'u2')).toMatchObject({ control: 'bot', botReason: 'left' });
    h.ctl.join('s2b', { secret: 'b'.repeat(32), resume: true });
    expect(h.ctl.seats.find((x) => x.id === 'u2')).toMatchObject({ control: 'human', botReason: null, connected: true });
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
    // Everyone left: the room is back in an empty lobby.
    expect(h.ctl.phase).toBe('lobby');
    expect(h.finished).toHaveLength(1);
    const log = JSON.parse(JSON.stringify(h.finished[0]));
    const final = replay(log);
    expect(final.winner).toBe(h.out.last('gameOver').winner);
    expect(final.players).toEqual(h.out.last('game').state.players);
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
    expect(h.ctl.phase).toBe('lobby');
    expect(h.out.last('gameOver').ranking).toHaveLength(2);
  });
});

describe('end of game', () => {
  it('gameOver carries rent stats; the room goes straight back to its lobby with the players still here', () => {
    const h = started(3, { botDelayMs: 500 });
    for (const sid of ['s1', 's2', 's3']) h.ctl.leave(sid, false);
    h.clock.advance(sec(T.disconnectBotSec));
    h.ctl.rejoin('s1');
    h.ctl.rejoin('s2');
    // s1 and s2 are back but let the bots finish quickly: end by host-less time limit
    (h.ctl as any).systemAction({ type: 'endGame' });
    const over = h.out.last('gameOver');
    expect(over.stats).toHaveProperty('rentByTile');
    expect(h.ctl.phase).toBe('lobby');
    expect(h.out.last('room', 's2').phase).toBe('lobby');
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

describe('thinking time', () => {
  it('opening Tài sản adds 2 minutes to your clock, once per decision', () => {
    const h = started(2);
    const cur = currentSession(h);
    const before = h.ctl.clockInfo()!.deadline;
    h.ctl.message(cur, 'thinking', { mode: 'assets' });
    expect(h.ctl.clockInfo()!.deadline - before).toBe(sec(T.assetsExtraSec));
    expect(h.out.last('clock').clock).toMatchObject({ extended: true });
    h.ctl.message(cur, 'thinking', { mode: null });
    h.ctl.message(cur, 'thinking', { mode: 'assets' });
    expect(h.ctl.clockInfo()!.deadline - before).toBe(sec(T.assetsExtraSec)); // not twice
    h.clock.advance(sec(T.rollSec));
    expect(h.ctl.state!.turn.dice).toBeNull(); // still thinking
    h.clock.advance(sec(T.assetsExtraSec));
    expect(h.ctl.state!.turn.dice).not.toBeNull(); // then the roll clock fires
  });

  it('opening Giao dịch pauses your clock until you close it', () => {
    const h = started(2);
    const cur = currentSession(h);
    h.ctl.message(cur, 'thinking', { mode: 'trade' });
    expect(h.out.last('clock').clock).toMatchObject({ paused: true });
    h.clock.advance(sec(600));
    expect(h.ctl.state!.turn.dice).toBeNull();
    h.ctl.message(cur, 'thinking', { mode: null });
    h.clock.advance(sec(T.rollSec) - 100);
    expect(h.ctl.state!.turn.dice).toBeNull();
    h.clock.advance(200);
    expect(h.ctl.state!.turn.dice).not.toBeNull();
  });

  it('only the player on the clock bends it; offers wait while the recipient is in Giao dịch', () => {
    const h = started(2);
    const cur = currentSession(h);
    const other = cur === 's1' ? 's2' : 's1';
    const before = h.ctl.clockInfo()!.deadline;
    h.ctl.message(other, 'thinking', { mode: 'assets' });
    expect(h.ctl.clockInfo()!.deadline).toBe(before);
    h.ctl.message(cur, 'action', {
      action: { type: 'proposeTrade', to: h.ctl.seatBySession(other)!.id, offer: { cash: 10 }, request: {} },
    });
    h.ctl.message(other, 'thinking', { mode: 'trade' });
    h.ctl.message(cur, 'thinking', { mode: 'trade' });
    h.clock.advance(sec(T.tradeOfferSec) * 3);
    expect(h.ctl.state!.trades).toHaveLength(1);
    h.ctl.message(other, 'thinking', { mode: null });
    h.clock.advance(sec(T.tradeOfferSec));
    expect(h.ctl.state!.trades).toHaveLength(0);
  });
});

describe('page reload', () => {
  it('the same secret takes the seat back on a new connection, even mid-game', () => {
    const replaced: string[] = [];
    const h = harness({ onReplaced: (old) => replaced.push(old) });
    h.ctl.join('s1', { secret: 'a'.repeat(32) });
    h.ctl.join('s2', { secret: 'b'.repeat(32) });
    h.ctl.message('s1', 'setConfig', { characters: false });
    h.ctl.message('s2', 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    // Old socket still "alive" (proxy did not report the close yet): reload joins with the secret.
    expect(h.ctl.join('s2-new', { secret: 'b'.repeat(32), resume: true })).toBe('player');
    expect(replaced).toEqual(['s2']);
    expect(h.ctl.seats.find((x) => x.id === 'u2')).toMatchObject({ sessionId: 's2-new', connected: true });
    expect(h.out.last('room', 's2-new').you).toBe('u2');
    expect(h.out.last('game', 's2-new')).toBeTruthy();
    // The old connection closing later changes nothing.
    expect(h.ctl.leave('s2', false)).toBe(0);
  });

  it('re-entering the room code (reclaim) takes back an empty seat but never one still open in another tab', () => {
    const h = harness();
    h.ctl.join('s1', { secret: 'a'.repeat(32) });
    h.ctl.join('s2', { secret: 'b'.repeat(32) });
    h.ctl.message('s1', 'setConfig', { characters: false });
    h.ctl.message('s2', 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    // The other tab is still connected: refused, and it keeps its seat.
    expect(() => h.ctl.join('tab2', { secret: 'b'.repeat(32), reclaim: true })).toThrow(RoomError);
    expect(h.ctl.seats.find((x) => x.id === 'u2')).toMatchObject({ sessionId: 's2', connected: true });
    // Tab closed (and a bot took over meanwhile): the code brings the player back to their seat.
    h.ctl.leave('s2', true);
    expect(h.ctl.join('tab3', { secret: 'b'.repeat(32), reclaim: true })).toBe('player');
    expect(h.ctl.seats.find((x) => x.id === 'u2')).toMatchObject({ sessionId: 'tab3', connected: true, control: 'human' });
    // An unknown secret never becomes a spectator through reclaim.
    expect(() => h.ctl.join('x', { secret: 'z'.repeat(32), reclaim: true })).toThrow(RoomError);
  });

  it('resume with an unknown secret is refused (no seat stolen, no spectator)', () => {
    const h = started(2);
    expect(() => h.ctl.join('x', { secret: 'z'.repeat(32), resume: true })).toThrow(RoomError);
  });

  it('a player replaced by a bot after disconnecting gets control back', () => {
    const h = harness();
    h.ctl.join('s1', { secret: 'a'.repeat(32) });
    h.ctl.join('s2', { secret: 'b'.repeat(32) });
    h.ctl.message('s1', 'setConfig', { characters: false });
    h.ctl.message('s2', 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    h.ctl.leave('s2', false);
    h.clock.advance(sec(T.disconnectBotSec));
    expect(h.ctl.seats[1].control === 'bot' || h.ctl.seats[0].control === 'bot').toBe(true);
    h.ctl.join('s2b', { secret: 'b'.repeat(32), resume: true });
    expect(h.ctl.seats.find((x) => x.sessionId === 's2b')).toMatchObject({ control: 'human', botReason: null });
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

describe('board choice', () => {
  it('auto: standard board for up to 4 players, 48 tiles from 5', () => {
    const four = started(4);
    expect(four.ctl.state!.config.board).toBe('standard');
    const five = started(5);
    expect(five.ctl.state!.config.board).toBe('extended');
    expect(Object.keys(five.ctl.state!.ownables)).toHaveLength(35);
  });

  it('the host can force a board; bad values are rejected', () => {
    const h = lobby(2);
    h.ctl.message('s1', 'setConfig', { board: 'huge' });
    expect(h.out.errors('s1')).toEqual(['BAD_CONFIG']);
    h.ctl.message('s1', 'setConfig', { board: 'extended' });
    expect(h.ctl.settings.board).toBe('extended');
    h.ctl.message('s1', 'start', {});
    expect(h.ctl.state!.config.board).toBe('extended');
    expect(h.ctl.state!.players.every((p) => p.position === 0)).toBe(true);
  });
});

describe('eight seats and the 56-tile board', () => {
  it('auto: 7–8 players get the 56-tile board', () => {
    const h = started(8);
    expect(h.ctl.state!.config.board).toBe('large');
    expect(h.ctl.state!.players).toHaveLength(8);
    expect(started(7).ctl.state!.config.board).toBe('large');
  });

  it('a fixed board too small for the table refuses to start', () => {
    const h = lobby(7);
    h.ctl.message('s1', 'setConfig', { board: 'standard' });
    h.ctl.message('s1', 'start', {});
    expect(h.out.errors('s1')).toEqual(['BAD_CONFIG']);
    expect(h.ctl.phase).toBe('lobby');
  });

  it('Con bạc’s Mở sòng: everyone bets at once on one clock; undecided bets are placed when it runs out', () => {
    const h = started(3);
    const s = h.ctl.state!;
    const host = s.players[s.turn.current];
    host.character = 'C09';
    s.config.characters = true;
    const hostSession = currentSession(h);
    h.ctl.message(hostSession, 'action', { action: { type: 'useSkill' } });
    const pend = h.ctl.state!.pending;
    expect(pend?.type).toBe('sicboBet');
    const waiting = (pend as { waiting: string[] }).waiting;
    expect(waiting).toHaveLength(2);
    // The last bettor answers first; the table still waits for the other one.
    const last = h.ctl.seats.find((x) => x.id === waiting[1])!;
    h.ctl.message(last.sessionId, 'action', { action: { type: 'placeBet', pick: 'tai' } });
    expect(h.ctl.state!.pending).toMatchObject({ type: 'sicboBet', waiting: [waiting[0]] });
    h.clock.advance(D.config.timers.sicboBetSec * 1000 + 10);
    expect(h.ctl.state!.pending?.type ?? null).not.toBe('sicboBet');
  });
});

describe('teams', () => {
  it('turning teams on deals seats evenly; newcomers join the smallest team; players switch teams', () => {
    const h = lobby(4);
    h.ctl.message('s1', 'setConfig', { teams: 2 });
    expect(h.ctl.seats.map((s) => s.team)).toEqual([0, 1, 0, 1]);
    h.ctl.join('s5');
    expect(h.ctl.seats[4].team).toBe(0);
    h.ctl.message('s5', 'setTeam', { team: 1 });
    expect(h.ctl.seats[4].team).toBe(1);
    h.ctl.message('s5', 'setTeam', { team: 2 });
    expect(h.out.errors('s5')).toEqual(['BAD_CONFIG']);
    h.ctl.message('s1', 'setConfig', { teams: 5 });
    expect(h.out.errors('s1')).toEqual(['BAD_CONFIG']);
    h.ctl.message('s1', 'setConfig', { teams: 0 });
    expect(h.ctl.seats.every((s) => s.team === null)).toBe(true);
  });

  it('uneven teams cannot start; the host shuffle evens them out', () => {
    const h = lobby(4);
    h.ctl.message('s1', 'setConfig', { teams: 2 });
    h.ctl.message('s3', 'setTeam', { team: 1 });
    h.ctl.message('s3', 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    expect(h.out.errors('s1')).toEqual(['BAD_CONFIG']);
    h.ctl.message('s2', 'shuffleTeams', {});
    expect(h.out.errors('s2')).toEqual(['NOT_HOST']);
    h.ctl.message('s1', 'shuffleTeams', {});
    const counts = [0, 1].map((t) => h.ctl.seats.filter((s) => s.team === t).length);
    expect(counts).toEqual([2, 2]);
    for (let i = 2; i <= 4; i++) h.ctl.message(`s${i}`, 'ready', { ready: true });
    h.ctl.message('s1', 'start', {});
    expect(h.ctl.phase).toBe('playing');
  });

  it('teams alternate around the table and carry into the game and its log', () => {
    const h = lobby(6);
    h.ctl.message('s1', 'setConfig', { teams: 3 });
    h.ctl.message('s1', 'start', {});
    const st = h.ctl.state!;
    const teamsInOrder = st.players.map((p) => p.team);
    expect(new Set(teamsInOrder.slice(0, 3)).size).toBe(3);
    expect(teamsInOrder.slice(3)).toEqual(teamsInOrder.slice(0, 3));
    for (const p of st.players) expect(p.team).toBe(h.ctl.seats.find((s) => s.id === p.id)!.team);
    expect(h.ctl.log!.players.every((p) => p.team !== undefined)).toBe(true);
  });

  it('a team game played out by bots ends with a winning team and replays to the same state', () => {
    const h = lobby(4);
    h.ctl.message('s1', 'setConfig', { teams: 2, mode: 'quick' });
    h.ctl.message('s1', 'start', {});
    for (let i = 1; i <= 4; i++) h.ctl.leave(`s${i}`, true);
    h.clock.advance(sec(D.config.quickMode.timeLimitMin * 60));
    expect(h.ctl.phase).toBe('lobby');
    const over = h.out.last('gameOver');
    expect([0, 1]).toContain(over.winnerTeam);
    expect(replay(h.finished[0]).winnerTeam).toBe(over.winnerTeam);
  });
});

describe('Bốc thăm (random draft)', () => {
  it('draws a character for everyone, one by one, without anyone choosing', () => {
    const h = lobby(3, true);
    h.ctl.message('s1', 'setConfig', { draft: 'random' });
    h.ctl.message('s1', 'start', {});
    expect(h.ctl.phase).toBe('picking');
    const picker = h.ctl.seats.find((s) => s.id === h.out.last('room', 's1').picking.current)!;
    h.ctl.message(picker.sessionId, 'pick', { character: 'C01' });
    expect(h.out.errors(picker.sessionId)).toEqual([]); // still allowed to take one early
    h.clock.advance(sec(T.drawRevealSec) * 3);
    expect(h.ctl.phase).toBe('playing');
    const chars = h.ctl.seats.map((s) => s.character);
    expect(new Set(chars).size).toBe(3);
    expect(chars.every((c) => c && D.characters[c])).toBe(true);
  });

  it('in normal picks, the player on the clock can ask for a random character', () => {
    const h = lobby(2, true);
    h.ctl.message('s1', 'start', {});
    const room = h.out.last('room', 's1');
    const first = h.ctl.seats.find((s) => s.id === room.picking.current)!;
    const other = h.ctl.seats.find((s) => s.id !== first.id)!;
    h.ctl.message(other.sessionId, 'pick', { random: true });
    expect(h.out.errors(other.sessionId)).toEqual(['NOT_YOUR_PICK']);
    h.ctl.message(first.sessionId, 'pick', { random: true });
    expect(first.character).not.toBeNull();
    expect(h.out.last('picked')).toMatchObject({ seat: first.id, random: true });
  });
});
