/**
 * Room logic, independent of Colyseus: lobby, turn-order roll, character
 * picks, the game clocks (GDD 7.2), bots replacing disconnected / AFK
 * players, chat, and the replay log. The Colyseus room only forwards
 * joins, leaves and messages here, so all of this is testable with a fake clock.
 */
import {
  type Action,
  actorOf,
  applyAction,
  autoBoard,
  type BoardId,
  botActionFor,
  createGame,
  dataFor,
  defaultConfig,
  defaultData,
  type GameConfig,
  type GameData,
  type GameEvent,
  type GameState,
  interleaveTeams,
  publicView,
  rollTurnOrder,
  RuleError,
} from '@hanoi-monopoly/engine';

export interface Timer {
  clear(): void;
}

export interface ClockLike {
  now(): number;
  setTimeout(fn: () => void, ms: number): Timer;
}

export interface Outbox {
  send(sessionId: string, type: string, message: unknown): void;
  broadcast(type: string, message: unknown): void;
}

export type BoardChoice = BoardId | 'auto';

export interface RoomSettings extends Omit<GameConfig, 'board'> {
  /** Board picked in the lobby; 'auto' resolves at start by the number of seats. */
  board: BoardChoice;
  maxPlayers: number;
  allowSpectators: boolean;
  /** Number of teams; 0 = no teams. */
  teams: number;
  /** 'pick': choose characters in reverse turn order; 'random': draw them for everyone. */
  draft: 'pick' | 'random';
}

export type Phase = 'lobby' | 'picking' | 'playing' | 'over';
export type BotReason = 'disconnect' | 'afk' | 'left';

export interface Seat {
  id: string;
  sessionId: string;
  name: string | null;
  host: boolean;
  ready: boolean;
  character: string | null;
  connected: boolean;
  control: 'human' | 'bot';
  botReason: BotReason | null;
  /** Consecutive own turns in which a timer ran out. */
  afkTurns: number;
  timedOutThisTurn: boolean;
  /** Per-player secret from the browser; lets a reloaded page take its seat back. Never sent to clients. */
  secret: string | null;
  /** Panel the player has open: Tài sản (+2 min once) or Giao dịch (clock paused). */
  thinking: 'assets' | 'trade' | null;
  /** Tutorial on: the player is new, so their decision clocks run a little longer. */
  learner: boolean;
  /** Team games: 0-based team, null when teams are off. */
  team: number | null;
}

export interface GameStats {
  rentPaid: Record<string, number>;
  rentEarned: Record<string, number>;
  rentByTile: Record<string, number>;
}

export interface GameLog {
  code: string;
  seed: number;
  config: GameConfig;
  players: { id: string; name: string | null; character: string | null; team?: number }[];
  turnOrderRolls: Record<string, number[][]>;
  actions: { at: number; action: Action }[];
  startedAt: number;
  finishedAt?: number;
  winner?: string | null;
}

/** Error codes sent to clients (the client translates them; no player-facing text here). */
export type ErrorCode =
  | 'ROOM_FULL'
  | 'GAME_STARTED'
  | 'NO_SPECTATORS'
  | 'NOT_HOST'
  | 'NOT_READY'
  | 'NOT_ENOUGH_PLAYERS'
  | 'BAD_CONFIG'
  | 'BAD_MESSAGE'
  | 'NOT_YOUR_PICK'
  | 'CHARACTER_TAKEN'
  | 'NOT_A_PLAYER'
  | 'BOT_CONTROLLED'
  | 'WRONG_PHASE'
  | 'RULE'
  | 'RATE_LIMIT'
  | 'NO_SEAT';

export class RoomError extends Error {
  constructor(public code: ErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface ControllerOptions {
  code: string;
  clock: ClockLike;
  outbox: Outbox;
  data?: GameData;
  /** Delay before a bot acts, so humans can follow (0 in tests). */
  botDelayMs?: number;
  /** Randomness for seeds and timed-out picks (default Math.random). */
  random?: () => number;
  /** End a running game (ranked by net worth) when nobody has been connected this long. Default 10 min. */
  abandonAfterMs?: number;
  onFinished?: (log: GameLog) => void;
  /** A seat moved to a new connection (page reload): drop the old one. */
  onReplaced?: (oldSessionId: string) => void;
}

type TimerKind = 'roll' | 'buy' | 'decision' | 'auction' | 'turn' | 'liquidation' | 'pick' | 'reveal' | 'rent';

const NAME_MAX = 20;
const CHAT_MAX = 200;
const CHAT_GAP_MS = 500;
const SYSTEM_ACTIONS = new Set(['timeout', 'closeAuction', 'endGame']);

export class GameController {
  phase: Phase = 'lobby';
  seats: Seat[] = [];
  spectators = new Set<string>();
  settings: RoomSettings;
  state: GameState | null = null;
  log: GameLog | null = null;

  private d: GameData;
  private clock: ClockLike;
  private out: Outbox;
  private random: () => number;
  private botDelayMs: number;
  private nextSeat = 1;
  private lastChat = new Map<string, number>();

  // picking
  private turnOrder: string[] = [];
  private pickOrder: string[] = [];
  private pickIndex = 0;

  // clocks
  private decision: {
    key: string;
    kind: TimerKind;
    deadline: number;
    timer: Timer | null;
    fire: () => void;
    /** Seat whose clock this is (for Tài sản / Giao dịch). */
    actor: string | null;
    extended: boolean;
    /** Remaining ms while paused (Giao dịch open). */
    paused: number | null;
  } | null = null;
  private tradeTimers = new Map<string, Timer>();
  private disconnectTimers = new Map<string, Timer>();
  private botTimer: Timer | null = null;
  /** Bumped on every applied action; a bot whose action was refused waits for the next change. */
  private version = 0;
  private botBlockedAt = -1;
  private quickTimer: Timer | null = null;
  /** Quick mode: when the game ends on time (server clock, ms). */
  private quickEndsAt: number | null = null;
  private abandonTimer: Timer | null = null;
  private turnNumber = 0;
  private turnStartedAt = 0;
  /** Whose turn `turnNumber` is (for AFK accounting). */
  private turnPlayer: string | null = null;
  stats: GameStats = { rentPaid: {}, rentEarned: {}, rentByTile: {} };

  constructor(private o: ControllerOptions) {
    this.d = o.data ?? defaultData;
    this.clock = o.clock;
    this.out = o.outbox;
    this.random = o.random ?? Math.random;
    this.botDelayMs = o.botDelayMs ?? 800;
    const room = this.d.config.room;
    this.settings = {
      ...defaultConfig(this.d, room.defaults.mode),
      board: room.defaults.board,
      maxPlayers: room.maxPlayers,
      allowSpectators: room.defaults.allowSpectators,
      teams: room.defaults.teams ?? 0,
      draft: room.defaults.draft ?? 'pick',
    };
  }

  private get timers() {
    return this.d.config.timers;
  }

  // ------------------------------------------------------------ membership

  /** Returns the role given to the new connection. Throws RoomError to refuse it. */
  join(
    sessionId: string,
    options: { name?: unknown; spectator?: unknown; secret?: unknown; resume?: unknown; reclaim?: unknown } = {},
  ): 'player' | 'spectator' {
    const secret = cleanSecret(options.secret);
    const mine = secret ? this.seats.find((s) => s.secret === secret) : undefined;
    // `reclaim`: a new tab in the same browser re-entering the room code. It may only
    // take a seat nobody is using, so it never kicks out a tab that is still open.
    if (mine && !(options.reclaim === true && mine.connected)) {
      this.takeOver(mine, sessionId);
      return 'player';
    }
    if (options.resume === true || options.reclaim === true) throw new RoomError('NO_SEAT');
    const wantsSpectator = options.spectator === true;
    if (!wantsSpectator && this.phase === 'lobby') {
      if (this.seats.length >= this.settings.maxPlayers) {
        if (!this.settings.allowSpectators) throw new RoomError('ROOM_FULL');
      } else {
        this.seats.push({
          id: `u${this.nextSeat++}`,
          sessionId,
          name: cleanName(options.name),
          host: this.seats.length === 0,
          ready: false,
          character: null,
          connected: true,
          control: 'human',
          botReason: null,
          afkTurns: 0,
          timedOutThisTurn: false,
          secret,
          thinking: null,
          learner: false,
          team: this.smallestTeam(),
        });
        this.broadcastRoom();
        return 'player';
      }
    }
    if (!this.settings.allowSpectators) throw new RoomError(this.phase === 'lobby' ? 'ROOM_FULL' : 'GAME_STARTED');
    this.spectators.add(sessionId);
    this.syncAbandonTimer();
    this.sendSnapshot(sessionId);
    return 'spectator';
  }

  /**
   * A connection dropped. Returns how long to hold the seat for reconnection:
   * 'forever' (in game — a bot plays meanwhile), seconds (lobby), or 0.
   */
  leave(sessionId: string, consented: boolean): 'forever' | number {
    const hold = this.leaveInner(sessionId, consented);
    this.syncAbandonTimer();
    return hold;
  }

  private leaveInner(sessionId: string, consented: boolean): 'forever' | number {
    if (this.spectators.delete(sessionId)) return 0;
    const seat = this.seatBySession(sessionId);
    if (!seat) return 0;
    if (this.phase === 'lobby') {
      if (!consented) {
        seat.connected = false;
        this.broadcastRoom();
        return 20;
      }
      this.removeSeat(seat);
      return 0;
    }
    if (this.phase === 'over') return 0;
    seat.connected = false;
    if (seat.thinking) {
      seat.thinking = null;
      this.applyThinking();
    }
    if (consented) {
      this.toBot(seat, 'left');
    } else {
      this.disconnectTimers.set(
        seat.id,
        this.clock.setTimeout(() => {
          this.disconnectTimers.delete(seat.id);
          if (!seat.connected) this.toBot(seat, 'disconnect');
        }, this.timers.disconnectBotSec * 1000),
      );
    }
    this.broadcastRoom();
    return consented ? 0 : 'forever';
  }

  /** Lobby reconnection window expired. */
  dropSeat(sessionId: string): void {
    const seat = this.seatBySession(sessionId);
    if (seat && this.phase === 'lobby') this.removeSeat(seat);
  }

  /** The same player came back on a new connection (page reload): give them their seat. */
  private takeOver(seat: Seat, sessionId: string): void {
    const old = seat.sessionId;
    seat.sessionId = sessionId;
    if (old !== sessionId) this.o.onReplaced?.(old);
    this.rejoin(sessionId);
  }

  rejoin(sessionId: string): void {
    const seat = this.seatBySession(sessionId);
    if (!seat) return;
    seat.connected = true;
    this.disconnectTimers.get(seat.id)?.clear();
    this.disconnectTimers.delete(seat.id);
    // The player is back: they play again, whatever made the bot take over
    // (disconnect, AFK timeouts, or an earlier "Rời phòng").
    this.reclaim(seat, false);
    this.syncAbandonTimer();
    this.broadcastRoom();
    this.sendSnapshot(sessionId);
  }

  /** Nobody watching or playing: stop an endless all-bot game after a while. */
  private syncAbandonTimer(): void {
    const running = this.phase === 'playing' || this.phase === 'picking';
    const someone = this.spectators.size > 0 || this.seats.some((s) => s.connected);
    if (running && !someone) {
      this.abandonTimer ??= this.clock.setTimeout(() => {
        this.abandonTimer = null;
        if (this.phase === 'picking') {
          while (this.phase === 'picking') this.randomPick();
        }
        this.systemAction({ type: 'endGame' });
      }, this.o.abandonAfterMs ?? 10 * 60_000);
    } else {
      this.abandonTimer?.clear();
      this.abandonTimer = null;
    }
  }

  private removeSeat(seat: Seat): void {
    this.seats = this.seats.filter((s) => s !== seat);
    if (seat.host && this.seats[0]) this.seats[0].host = true;
    this.broadcastRoom();
  }

  private toBot(seat: Seat, reason: BotReason): void {
    if (seat.control === 'bot' && seat.botReason !== 'disconnect') return;
    seat.control = 'bot';
    seat.botReason = reason;
    this.out.broadcast('botTakeover', { seat: seat.id, reason });
    this.broadcastRoom();
    if (this.phase === 'picking') this.schedulePickBot();
    if (this.phase === 'playing') this.scheduleBots();
  }

  // ------------------------------------------------------------ messages

  message(sessionId: string, type: string, payload: unknown): void {
    try {
      this.handle(sessionId, type, (payload ?? {}) as Record<string, unknown>);
    } catch (e) {
      if (e instanceof RoomError) this.out.send(sessionId, 'error', { code: e.code, message: e.message });
      else if (e instanceof RuleError) this.out.send(sessionId, 'error', { code: 'RULE', message: e.message });
      else throw e;
    }
  }

  private handle(sessionId: string, type: string, m: Record<string, unknown>): void {
    if (type === 'chat' || type === 'emote') return this.chat(sessionId, type, m);
    const seat = this.seatBySession(sessionId);
    if (!seat) throw new RoomError('NOT_A_PLAYER');
    switch (type) {
      case 'reclaim':
        if (this.phase !== 'playing' && this.phase !== 'picking') throw new RoomError('WRONG_PHASE');
        this.reclaim(seat);
        return;
      case 'thinking': {
        const mode = m.mode === 'assets' || m.mode === 'trade' ? m.mode : null;
        seat.thinking = mode;
        this.applyThinking();
        return;
      }
      case 'learner':
        seat.learner = m.on === true;
        return this.broadcastRoom();
      case 'setName':
        seat.name = cleanName(m.name);
        return this.broadcastRoom();
      case 'ready':
        this.requirePhase('lobby');
        seat.ready = m.ready !== false;
        return this.broadcastRoom();
      case 'setConfig':
        this.requirePhase('lobby');
        if (!seat.host) throw new RoomError('NOT_HOST');
        this.applySettings(m);
        return this.broadcastRoom();
      case 'setTeam': {
        this.requirePhase('lobby');
        const t = m.team;
        if (!this.settings.teams || !Number.isInteger(t) || (t as number) < 0 || (t as number) >= this.settings.teams) {
          throw new RoomError('BAD_CONFIG', 'team');
        }
        seat.team = t as number;
        seat.ready = seat.host;
        return this.broadcastRoom();
      }
      case 'shuffleTeams':
        this.requirePhase('lobby');
        if (!seat.host) throw new RoomError('NOT_HOST');
        if (!this.settings.teams) throw new RoomError('BAD_CONFIG', 'teams');
        this.balanceTeams(true);
        return this.broadcastRoom();
      case 'start':
        this.requirePhase('lobby');
        if (!seat.host) throw new RoomError('NOT_HOST');
        return this.start();
      case 'rematch':
        this.requirePhase('over');
        if (!seat.host) throw new RoomError('NOT_HOST');
        return this.rematch();
      case 'pick':
        this.requirePhase('picking');
        if (m.random === true) {
          if (this.currentPicker()?.id !== seat.id) throw new RoomError('NOT_YOUR_PICK');
          return this.randomPick();
        }
        return this.pick(seat, m.character);
      case 'action':
        this.requirePhase('playing');
        return this.playerAction(seat, m.action);
      default:
        throw new RoomError('BAD_MESSAGE', `Unknown message ${type}`);
    }
  }

  private requirePhase(p: Phase): void {
    if (this.phase !== p) throw new RoomError('WRONG_PHASE');
  }

  private applySettings(m: Record<string, unknown>): void {
    const next = { ...this.settings };
    const room = this.d.config.room;
    if (m.mode !== undefined) {
      if (m.mode !== 'classic' && m.mode !== 'quick') throw new RoomError('BAD_CONFIG', 'mode');
      if (m.mode !== next.mode) next.scholarshipFund = room.defaults.scholarshipFund[m.mode];
      next.mode = m.mode;
    }
    if (m.board !== undefined) {
      if (m.board !== 'auto' && !room.boards.includes(m.board as BoardId)) throw new RoomError('BAD_CONFIG', 'board');
      next.board = m.board as BoardChoice;
    }
    for (const k of ['characters', 'scholarshipFund', 'buildingLimit', 'allowSpectators'] as const) {
      if (m[k] === undefined) continue;
      if (typeof m[k] !== 'boolean') throw new RoomError('BAD_CONFIG', k);
      next[k] = m[k] as boolean;
    }
    if (m.teams !== undefined) {
      const n = m.teams;
      if (n !== 0 && !room.teamCounts.includes(n as number)) throw new RoomError('BAD_CONFIG', 'teams');
      next.teams = n as number;
    }
    if (m.draft !== undefined) {
      if (m.draft !== 'pick' && m.draft !== 'random') throw new RoomError('BAD_CONFIG', 'draft');
      next.draft = m.draft;
    }
    if (m.maxPlayers !== undefined) {
      const n = m.maxPlayers;
      if (!Number.isInteger(n) || (n as number) < room.minPlayers || (n as number) > room.maxPlayers) {
        throw new RoomError('BAD_CONFIG', 'maxPlayers');
      }
      if ((n as number) < this.seats.length) throw new RoomError('BAD_CONFIG', 'maxPlayers below current players');
      next.maxPlayers = n as number;
    }
    const teamsChanged = next.teams !== this.settings.teams;
    this.settings = next;
    if (teamsChanged) this.balanceTeams(false);
  }

  // ------------------------------------------------------------ teams

  /** Team with the fewest seats (lowest number on ties), or null with teams off. */
  private smallestTeam(): number | null {
    const n = this.settings.teams;
    if (!n) return null;
    const counts = Array.from({ length: n }, (_, t) => this.seats.filter((s) => s.team === t).length);
    return counts.indexOf(Math.min(...counts));
  }

  /** Deal every seat into teams evenly: in seat order, or shuffled. */
  private balanceTeams(shuffle: boolean): void {
    const n = this.settings.teams;
    const seats = [...this.seats];
    if (shuffle) {
      for (let i = seats.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [seats[i], seats[j]] = [seats[j], seats[i]];
      }
    }
    seats.forEach((s, i) => (s.team = n ? i % n : null));
  }

  /** Teams must each have a player and differ by at most one. */
  private teamsValid(): boolean {
    const n = this.settings.teams;
    if (!n) return true;
    if (this.seats.some((s) => s.team === null || s.team < 0 || s.team >= n)) return false;
    const counts = Array.from({ length: n }, (_, t) => this.seats.filter((s) => s.team === t).length);
    return Math.min(...counts) >= 1 && Math.max(...counts) - Math.min(...counts) <= 1;
  }

  private chat(sessionId: string, type: 'chat' | 'emote', m: Record<string, unknown>): void {
    const now = this.clock.now();
    if (now - (this.lastChat.get(sessionId) ?? -Infinity) < CHAT_GAP_MS) throw new RoomError('RATE_LIMIT');
    const raw = type === 'chat' ? m.text : m.emote;
    if (typeof raw !== 'string') throw new RoomError('BAD_MESSAGE');
    const text = raw.trim().slice(0, type === 'chat' ? CHAT_MAX : 32);
    if (!text) throw new RoomError('BAD_MESSAGE');
    this.lastChat.set(sessionId, now);
    const seat = this.seatBySession(sessionId);
    this.out.broadcast(type, { from: seat?.id ?? null, spectator: !seat, [type === 'chat' ? 'text' : 'emote']: text, at: now });
  }

  // ------------------------------------------------------------ start & picks

  /** The board this game is played on: the lobby choice, or by table size for 'auto'. */
  private resolveBoard(): BoardId {
    if (this.settings.board !== 'auto') return this.settings.board;
    return autoBoard(this.seats.length, this.d);
  }

  private start(): void {
    const room = this.d.config.room;
    if (this.seats.length < room.minPlayers) throw new RoomError('NOT_ENOUGH_PLAYERS');
    if (this.seats.some((s) => !s.host && !s.ready)) throw new RoomError('NOT_READY');
    // A fixed board must seat everyone (40 and 48 tiles: up to 6, 56 tiles: 8).
    if (!this.o.data && this.seats.length > dataFor(this.resolveBoard()).maxPlayers) {
      throw new RoomError('BAD_CONFIG', 'board too small for this many players');
    }
    if (!this.teamsValid()) throw new RoomError('BAD_CONFIG', 'teams');
    const seed = Math.floor(this.random() * 2 ** 32) >>> 0;
    const order = rollTurnOrder(
      this.seats.map((s) => s.id),
      seed ^ 0x5bd1e995,
    );
    // Team games alternate teams around the table.
    this.turnOrder = this.settings.teams
      ? interleaveTeams(order.order, (id) => this.seats.find((s) => s.id === id)!.team!)
      : order.order;
    this.seats.sort((a, b) => this.turnOrder.indexOf(a.id) - this.turnOrder.indexOf(b.id));
    this.log = {
      code: this.o.code,
      seed,
      config: {
        mode: this.settings.mode,
        characters: this.settings.characters,
        scholarshipFund: this.settings.scholarshipFund,
        buildingLimit: this.settings.buildingLimit,
        board: this.resolveBoard(),
      },
      players: [],
      turnOrderRolls: order.rolls,
      actions: [],
      startedAt: this.clock.now(),
    };
    this.out.broadcast('turnOrder', { order: this.turnOrder, rolls: order.rolls, teams: this.settings.teams > 0 });
    if (this.settings.characters) {
      this.phase = 'picking';
      this.pickOrder = [...this.turnOrder].reverse();
      this.pickIndex = 0;
      this.startPickTimer();
      this.broadcastRoom();
      this.schedulePickBot();
    } else {
      this.beginGame();
    }
  }

  availableCharacters(): string[] {
    const taken = new Set(this.seats.map((s) => s.character));
    return Object.keys(this.d.characters).filter((c) => !taken.has(c));
  }

  private currentPicker(): Seat | undefined {
    return this.seats.find((s) => s.id === this.pickOrder[this.pickIndex]);
  }

  private startPickTimer(): void {
    // Bốc thăm: nobody chooses; each draw is revealed after a short pause.
    if (this.settings.draft === 'random') {
      const index = this.pickIndex;
      this.clock.setTimeout(() => {
        if (this.phase === 'picking' && this.pickIndex === index) this.randomPick();
      }, this.timers.drawRevealSec * 1000);
      return;
    }
    this.setDecision(`pick:${this.pickIndex}`, 'pick', this.d.characterRules.pickTimerSec * 1000, () => this.randomPick());
  }

  private pick(seat: Seat, character: unknown): void {
    if (this.currentPicker()?.id !== seat.id) throw new RoomError('NOT_YOUR_PICK');
    if (typeof character !== 'string' || !this.d.characters[character]) throw new RoomError('BAD_MESSAGE');
    if (!this.availableCharacters().includes(character)) throw new RoomError('CHARACTER_TAKEN');
    this.assignPick(seat, character, false);
  }

  private randomPick(): void {
    const seat = this.currentPicker();
    if (!seat || this.phase !== 'picking') return;
    const free = this.availableCharacters();
    this.assignPick(seat, free[Math.floor(this.random() * free.length)], true);
  }

  private assignPick(seat: Seat, character: string, random: boolean): void {
    seat.character = character;
    this.out.broadcast('picked', { seat: seat.id, character, random });
    this.pickIndex++;
    if (this.pickIndex >= this.pickOrder.length) {
      this.clearDecision();
      this.beginGame();
      return;
    }
    this.startPickTimer();
    this.broadcastRoom();
    this.schedulePickBot();
  }

  private schedulePickBot(): void {
    const seat = this.currentPicker();
    if (!seat || seat.control !== 'bot' || this.settings.draft === 'random') return;
    const index = this.pickIndex;
    this.clock.setTimeout(() => {
      if (this.phase === 'picking' && this.pickIndex === index) this.randomPick();
    }, this.botDelayMs);
  }

  // ------------------------------------------------------------ game

  private beginGame(): void {
    const log = this.log!;
    const team = (s: Seat) => (this.settings.teams && s.team !== null ? { team: s.team } : {});
    const players = this.seats.map((s) => ({ id: s.id, name: s.name ?? undefined, character: s.character, ...team(s) }));
    log.players = this.seats.map((s) => ({ id: s.id, name: s.name, character: s.character, ...team(s) }));
    if (!this.o.data) this.d = dataFor(log.config.board);
    const created = createGame({ players, seed: log.seed, config: log.config }, this.d);
    this.state = created.state;
    this.phase = 'playing';
    this.turnNumber = this.state.turn.number;
    this.turnStartedAt = this.clock.now();
    this.turnPlayer = this.state.players[this.state.turn.current].id;
    if (log.config.mode === 'quick') {
      this.quickEndsAt = this.clock.now() + this.d.config.quickMode.timeLimitMin * 60_000;
      this.quickTimer = this.clock.setTimeout(
        () => this.systemAction({ type: 'endGame' }),
        this.d.config.quickMode.timeLimitMin * 60_000,
      );
    }
    this.broadcastRoom();
    this.afterChange(created.events);
  }

  /** Hand a seat back from the bot to its (connected) human. */
  private reclaim(seat: Seat, announce = true): void {
    if (seat.control !== 'bot') return;
    seat.control = 'human';
    seat.botReason = null;
    seat.afkTurns = 0;
    seat.timedOutThisTurn = false;
    this.out.broadcast('humanBack', { seat: seat.id });
    if (announce) this.broadcastRoom();
  }

  private playerAction(seat: Seat, raw: unknown): void {
    // Acting in the game means the player is here again.
    if (seat.control === 'bot') this.reclaim(seat);
    if (!raw || typeof raw !== 'object' || typeof (raw as { type?: unknown }).type !== 'string') {
      throw new RoomError('BAD_MESSAGE');
    }
    const action = { ...(raw as Action), player: seat.id } as Action;
    if (SYSTEM_ACTIONS.has(action.type)) throw new RoomError('BAD_MESSAGE', `${action.type} is server-only`);
    this.apply(action);
  }

  private systemAction(action: Action): void {
    if (this.phase !== 'playing' || !this.state) return;
    try {
      this.apply(action);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
    }
  }

  private apply(action: Action): void {
    const r = applyAction(this.state!, action, this.d);
    this.state = r.state;
    this.version++;
    this.log!.actions.push({ at: this.clock.now(), action });
    this.afterChange(r.events);
  }

  private afterChange(events: GameEvent[]): void {
    const s = this.state!;
    this.collectStats(events);
    if (s.turn.number !== this.turnNumber) this.onTurnPassed();
    this.syncTradeTimers();
    if (s.status === 'over') {
      this.finish(events);
      return;
    }
    this.syncDecisionTimer();
    this.out.broadcast('game', { state: publicView(s), events, clock: this.clockInfo() });
    this.scheduleBots();
  }

  /** AFK accounting for the player whose turn just ended (GDD 7.2: 3 timed-out turns → bot). */
  private onTurnPassed(): void {
    const s = this.state!;
    const seat = this.seats.find((x) => x.id === this.turnPlayer);
    if (seat) {
      seat.afkTurns = seat.timedOutThisTurn ? seat.afkTurns + 1 : 0;
      seat.timedOutThisTurn = false;
      if (seat.control === 'human' && seat.afkTurns >= this.timers.afkTurnsBeforeBot) this.toBot(seat, 'afk');
    }
    this.turnNumber = s.turn.number;
    this.turnStartedAt = this.clock.now();
    this.turnPlayer = s.players[s.turn.current].id;
  }

  private syncTradeTimers(): void {
    const s = this.state!;
    const live = new Set(s.trades.map((t) => t.id));
    for (const [id, t] of this.tradeTimers) {
      if (!live.has(id)) {
        t.clear();
        this.tradeTimers.delete(id);
      }
    }
    for (const id of live) {
      if (this.tradeTimers.has(id)) continue;
      this.tradeTimers.set(
        id,
        this.tradeExpiry(id),
      );
    }
  }

  /** Offers lapse after tradeOfferSec — but never while the recipient has Giao dịch open. */
  private tradeExpiry(id: string): Timer {
    return this.clock.setTimeout(() => {
      const t = this.state?.trades.find((x) => x.id === id);
      const to = t && this.seats.find((x) => x.id === t.to);
      if (to?.thinking === 'trade') {
        this.tradeTimers.set(id, this.tradeExpiry(id));
        return;
      }
      this.tradeTimers.delete(id);
      this.systemAction({ type: 'cancelTrade', tradeId: id });
    }, this.timers.tradeOfferSec * 1000);
  }

  /** One decision clock at a time; it only restarts when the decision changes. */
  private syncDecisionTimer(): void {
    const s = this.state!;
    const pend = s.pending;
    const t = this.timers;
    const a = this.d.economy.auction;
    if (pend?.type === 'auction') {
      const key = `auction:${pend.propertyId}:${pend.highBid}:${pend.highBidder}`;
      const ms = (pend.highBidder ? a.resetSec : a.timerSec) * 1000;
      this.setDecision(key, 'auction', ms, () => this.systemAction({ type: 'closeAuction' }));
      return;
    }
    const base = `${s.turn.number}:${s.turn.phase}:${JSON.stringify(s.turn.dice)}:${s.players[s.turn.current].position}`;
    let kind: TimerKind;
    let ms: number;
    if (pend) {
      const byType: Partial<Record<string, [TimerKind, number]>> = {
        buy: ['buy', t.buyDecisionSec],
        liquidation: ['liquidation', t.liquidationSec],
        revealCard: ['reveal', t.revealCardSec ?? t.buyDecisionSec],
        payRent: ['rent', t.payRentSec ?? t.buyDecisionSec],
        gamble: ['decision', t.gambleSec ?? t.buyDecisionSec],
        sicboBet: ['decision', t.sicboBetSec ?? t.buyDecisionSec],
      };
      const [k, sec] = byType[pend.type] ?? ['decision', t.buyDecisionSec];
      kind = k;
      ms = sec * 1000;
    } else if (s.turn.phase === 'roll') {
      kind = 'roll';
      ms = t.rollSec * 1000;
    } else {
      kind = 'turn';
      ms = Math.max(1000, this.turnStartedAt + t.turnSec * 1000 - this.clock.now());
    }
    const key = pend
      ? `${base}:${pend.type}:${'player' in pend ? pend.player : ''}:${'propertyId' in pend ? pend.propertyId : ''}:${pend.type === 'liquidation' ? pend.task.amount : ''}`
      : `${base}:${kind}`;
    this.setDecision(key, kind, ms, () => this.onDecisionTimeout());
  }

  private onDecisionTimeout(): void {
    const s = this.state;
    if (!s) return;
    const actor = actorOf(s);
    const seat = this.seats.find((x) => x.id === actor);
    if (seat && seat.control === 'human' && actor === s.players[s.turn.current].id) seat.timedOutThisTurn = true;
    this.systemAction({ type: 'timeout' });
  }

  private setDecision(key: string, kind: TimerKind, ms: number, fire: () => void): void {
    if (this.decision?.key === key) return;
    this.clearDecision();
    const actor =
      this.phase === 'picking' ? (this.currentPicker()?.id ?? null) : this.state ? actorOf(this.state) : null;
    // New players (tutorial on) read a hint before answering: a few extra seconds per decision.
    const seat = this.seats.find((x) => x.id === actor);
    if (seat?.learner && seat.control === 'human' && kind !== 'turn' && kind !== 'pick') ms += (this.timers.learnerExtraSec ?? 0) * 1000;
    this.decision = { key, kind, deadline: this.clock.now() + ms, timer: null, fire, actor, extended: false, paused: null };
    this.armDecision();
    this.applyThinking(false);
  }

  private armDecision(): void {
    const d = this.decision;
    if (!d) return;
    d.timer?.clear();
    const key = d.key;
    d.timer = this.clock.setTimeout(() => {
      if (this.decision?.key === key) this.decision = null;
      d.fire();
    }, Math.max(0, d.deadline - this.clock.now()));
  }

  /**
   * The actor's open panel bends their clock: Tài sản adds assetsExtraSec once
   * per decision, Giao dịch pauses it until the panel closes.
   */
  private applyThinking(announce = true): void {
    const d = this.decision;
    if (!d || !d.actor) return;
    const mode = this.seats.find((x) => x.id === d.actor)?.thinking ?? null;
    const now = this.clock.now();
    let changed = false;
    if (mode === 'trade' && d.paused === null) {
      d.timer?.clear();
      d.timer = null;
      d.paused = Math.max(0, d.deadline - now);
      changed = true;
    } else if (mode !== 'trade' && d.paused !== null) {
      d.deadline = now + d.paused;
      d.paused = null;
      this.armDecision();
      changed = true;
    }
    if (mode === 'assets' && !d.extended && d.paused === null) {
      d.extended = true;
      d.deadline += (this.timers.assetsExtraSec ?? 120) * 1000;
      if (d.kind === 'turn') this.turnStartedAt += (this.timers.assetsExtraSec ?? 120) * 1000;
      this.armDecision();
      changed = true;
    }
    if (changed && announce) this.out.broadcast('clock', { clock: this.clockInfo() });
  }

  private clearDecision(): void {
    this.decision?.timer?.clear();
    this.decision = null;
  }

  clockInfo(): { kind: TimerKind; deadline: number; paused?: boolean; extended?: boolean } | null {
    const d = this.decision;
    if (!d) return null;
    return {
      kind: d.kind,
      deadline: d.paused !== null ? this.clock.now() + d.paused : d.deadline,
      ...(d.paused !== null ? { paused: true } : {}),
      ...(d.extended ? { extended: true } : {}),
    };
  }

  // ------------------------------------------------------------ bots

  private scheduleBots(): void {
    if (this.botTimer || this.phase !== 'playing') return;
    if (!this.nextBotAction()) return;
    this.botTimer = this.clock.setTimeout(() => {
      this.botTimer = null;
      if (this.phase !== 'playing') return;
      const a = this.nextBotAction();
      if (!a) return;
      try {
        this.apply(a);
      } catch (e) {
        if (!(e instanceof RuleError)) throw e;
        console.warn(`[${this.o.code}] bot action refused: ${JSON.stringify(a)} — ${e.message}`);
        this.botBlockedAt = this.version; // the decision clock will move the game on
        return;
      }
      this.scheduleBots();
    }, this.botDelayMs);
  }

  private nextBotAction(): Action | null {
    const s = this.state;
    if (!s || this.botBlockedAt === this.version) return null;
    for (const seat of this.seats) {
      if (seat.control !== 'bot') continue;
      const a = botActionFor(s, seat.id, this.d);
      if (a) return a;
    }
    return null;
  }

  // ------------------------------------------------------------ end

  private collectStats(events: GameEvent[]): void {
    const add = (m: Record<string, number>, k: string, v: number) => (m[k] = (m[k] ?? 0) + v);
    for (const e of events) {
      if (e.type !== 'payment' || e.kind !== 'rent') continue;
      const amount = e.amount as number;
      add(this.stats.rentPaid, e.from as string, amount);
      add(this.stats.rentEarned, (e.to as { id: string }).id, amount);
      add(this.stats.rentByTile, e.reason as string, amount);
    }
  }

  /** Host starts over in the same room: back to the lobby with the players still here. */
  private rematch(): void {
    this.dispose();
    this.seats = this.seats.filter((s) => s.connected && s.botReason !== 'left' && s.botReason !== 'afk');
    if (this.seats.length && !this.seats.some((s) => s.host)) this.seats[0].host = true;
    for (const s of this.seats) {
      Object.assign(s, { ready: false, character: null, control: 'human', botReason: null, afkTurns: 0, timedOutThisTurn: false });
    }
    this.state = null;
    this.log = null;
    this.stats = { rentPaid: {}, rentEarned: {}, rentByTile: {} };
    this.version = 0;
    this.botBlockedAt = -1;
    this.phase = 'lobby';
    this.broadcastRoom();
  }

  private finish(events: GameEvent[]): void {
    const s = this.state!;
    this.phase = 'over';
    this.clearDecision();
    this.botTimer?.clear();
    this.botTimer = null;
    this.quickTimer?.clear();
    this.quickEndsAt = null;
    this.abandonTimer?.clear();
    this.abandonTimer = null;
    for (const t of this.tradeTimers.values()) t.clear();
    this.tradeTimers.clear();
    for (const t of this.disconnectTimers.values()) t.clear();
    this.disconnectTimers.clear();
    const log = this.log!;
    log.finishedAt = this.clock.now();
    log.winner = s.winner;
    this.out.broadcast('game', { state: publicView(s), events, clock: null });
    this.out.broadcast('gameOver', {
      winner: s.winner,
      winnerTeam: s.winnerTeam ?? null,
      ranking: s.ranking,
      seed: s.seed,
      stats: this.stats,
      log,
    });
    this.broadcastRoom();
    this.o.onFinished?.(log);
  }

  dispose(): void {
    this.abandonTimer?.clear();
    this.abandonTimer = null;
    this.clearDecision();
    this.botTimer?.clear();
    this.botTimer = null;
    this.quickTimer?.clear();
    this.quickEndsAt = null;
    this.quickTimer = null;
    for (const t of this.tradeTimers.values()) t.clear();
    this.tradeTimers.clear();
    for (const t of this.disconnectTimers.values()) t.clear();
    this.disconnectTimers.clear();
  }

  // ------------------------------------------------------------ views

  seatBySession(sessionId: string): Seat | undefined {
    return this.seats.find((s) => s.sessionId === sessionId);
  }

  roomView(sessionId?: string) {
    const picker = this.phase === 'picking' ? this.currentPicker() : undefined;
    return {
      code: this.o.code,
      phase: this.phase,
      settings: this.settings,
      you: sessionId ? (this.seatBySession(sessionId)?.id ?? null) : null,
      seats: this.seats.map((s) => ({
        id: s.id,
        name: s.name,
        host: s.host,
        ready: s.ready,
        character: s.character,
        connected: s.connected,
        control: s.control,
        botReason: s.botReason,
        team: s.team,
        learner: s.learner,
      })),
      spectators: this.spectators.size,
      quickEndsAt: this.phase === 'playing' ? this.quickEndsAt : null,
      picking: picker
        ? { order: this.pickOrder, current: picker.id, available: this.availableCharacters(), clock: this.clockInfo() }
        : null,
    };
  }

  private broadcastRoom(): void {
    for (const s of this.seats) if (s.connected) this.out.send(s.sessionId, 'room', this.roomView(s.sessionId));
    for (const id of this.spectators) this.out.send(id, 'room', this.roomView(id));
  }

  private sendSnapshot(sessionId: string): void {
    this.out.send(sessionId, 'room', this.roomView(sessionId));
    if (this.state) this.out.send(sessionId, 'game', { state: publicView(this.state), events: [], clock: this.clockInfo() });
  }
}

function cleanSecret(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length >= 16 && raw.length <= 128 ? raw : null;
}

function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return name || null;
}
