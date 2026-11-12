import {
  applyActionInPlace,
  botAction,
  createGame,
  defaultData,
  type BotOptions,
  type GameData,
  type GameEvent,
  type Mode,
} from '@hanoi-monopoly/engine';

export interface SimGameOptions {
  seed: number;
  players: number;
  mode: Mode;
  characters: boolean;
  /** Classic: stop after this many rounds and rank by net worth. */
  maxRounds: number;
  /** Quick: rounds standing in for the 60-minute clock. */
  quickRounds: number;
  bot?: Partial<BotOptions>;
  /** Force these characters (in seat order); otherwise random distinct ones. */
  lineup?: string[];
  /** Only deal these characters (default: all). */
  pool?: string[];
  /** Team games: this many teams, seats alternate (seat i plays for team i % teams). 0 = no teams. */
  teams?: number;
}

export type EndReason = 'lastStanding' | 'quickBankrupt' | 'roundLimit';

export interface PlayerRecord {
  seat: number;
  character: string | null;
  rank: number;
  score: number;
  bankruptAtTurn: number | null;
  team?: number;
}

export interface GameRecord {
  seed: number;
  players: number;
  mode: Mode;
  endedBy: EndReason;
  turns: number;
  rounds: number;
  winnerSeat: number | null;
  /** Team games: number of teams and the winning team. */
  teams?: number;
  winnerTeam?: number | null;
  result: PlayerRecord[];
  landings: number[];
  rent: Record<string, number>;
  invested: Record<string, number>;
}

/** Small seeded RNG for line-ups (independent of the game's own RNG). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function groupKey(d: GameData, id: string): string {
  const def = d.ownables[id];
  return def.group ?? def.kind;
}

const MAX_ACTIONS = 200_000;

export function runGame(o: SimGameOptions, d: GameData = defaultData): GameRecord {
  const rand = rng(o.seed ^ 0x9e3779b9);
  const pool = o.pool ? [...o.pool] : Object.keys(d.characters);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const lineup = o.characters ? (o.lineup ?? pool.slice(0, o.players)) : [];
  const teams = o.teams ?? 0;
  const players = Array.from({ length: o.players }, (_, i) => ({
    id: `s${i}`,
    character: lineup[i] ?? null,
    ...(teams > 1 ? { team: i % teams } : {}),
  }));

  const created = createGame(
    { players, seed: o.seed, config: { mode: o.mode, characters: o.characters, board: d.id } },
    d,
  );
  const s = created.state;
  const rec: GameRecord = {
    seed: o.seed,
    players: o.players,
    mode: o.mode,
    endedBy: 'lastStanding',
    turns: 0,
    rounds: 0,
    winnerSeat: null,
    result: [],
    landings: new Array(d.board.length).fill(0),
    rent: {},
    invested: {},
  };
  const bankruptAt = new Map<string, number>();
  const add = (bucket: Record<string, number>, key: string, v: number) => {
    bucket[key] = (bucket[key] ?? 0) + v;
  };
  const absorb = (events: GameEvent[]) => {
    for (const e of events) {
      switch (e.type) {
        case 'landed':
          rec.landings[e.position as number]++;
          break;
        case 'payment':
          if (e.kind === 'rent') add(rec.rent, groupKey(d, e.reason as string), e.amount as number);
          break;
        case 'purchased':
        case 'dealt':
          add(rec.invested, groupKey(d, e.propertyId as string), e.price as number);
          break;
        case 'auctionEnded':
          if (e.winner) add(rec.invested, groupKey(d, e.propertyId as string), e.price as number);
          break;
        case 'built':
          add(rec.invested, groupKey(d, e.propertyId as string), e.cost as number);
          break;
        case 'bankrupt':
          bankruptAt.set(e.player as string, s.turn.number);
          break;
      }
    }
  };
  absorb(created.events);

  const limitRounds = o.mode === 'quick' ? o.quickRounds : o.maxRounds;
  const turnLimit = limitRounds * o.players;
  let hitLimit = false;
  for (let n = 0; s.status === 'playing'; n++) {
    if (n > MAX_ACTIONS) throw new Error(`Game ${o.seed} exceeded ${MAX_ACTIONS} actions`);
    if (s.turn.number > turnLimit && !s.pending && s.turn.phase === 'roll') {
      hitLimit = true;
      absorb(applyActionInPlace(s, { type: 'endGame' }, d).events);
      break;
    }
    const action = botAction(s, d, o.bot);
    if (!action) break;
    absorb(applyActionInPlace(s, action, d).events);
  }

  rec.turns = s.turn.number;
  rec.rounds = Math.ceil(s.turn.number / o.players);
  const alive = s.players.filter((p) => !p.bankrupt).length;
  rec.endedBy = hitLimit ? 'roundLimit' : alive > 1 ? 'quickBankrupt' : 'lastStanding';
  const ranking = s.ranking ?? [];
  rec.result = s.players.map((p, seat) => ({
    seat,
    character: p.character,
    rank: ranking.findIndex((r) => r.player === p.id) + 1,
    score: ranking.find((r) => r.player === p.id)?.score ?? 0,
    bankruptAtTurn: bankruptAt.get(p.id) ?? null,
    ...(p.team !== undefined ? { team: p.team } : {}),
  }));
  if (teams > 1) {
    rec.teams = teams;
    rec.winnerTeam = s.winnerTeam ?? null;
  }
  rec.winnerSeat = s.winner ? s.players.findIndex((p) => p.id === s.winner) : null;
  return rec;
}
