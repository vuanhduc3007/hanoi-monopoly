import type { EndReason, GameRecord } from './runGame';

export interface WinBucket {
  games: number;
  wins: number;
  /** Σ 1/players over the games played — the fair-share number of wins. */
  expected: number;
  rankSum: number;
}

export interface Totals {
  games: number;
  byPlayers: Record<string, number>;
  endedBy: Record<EndReason, number>;
  turns: number[];
  rounds: number[];
  characters: Record<string, WinBucket>;
  seats: Record<string, WinBucket>;
  landings: number[];
  rent: Record<string, number>;
  invested: Record<string, number>;
}

export function newTotals(tiles = 40): Totals {
  return {
    games: 0,
    byPlayers: {},
    endedBy: { lastStanding: 0, quickBankrupt: 0, roundLimit: 0 },
    turns: [],
    rounds: [],
    characters: {},
    seats: {},
    landings: new Array(tiles).fill(0),
    rent: {},
    invested: {},
  };
}

const bucket = (m: Record<string, WinBucket>, k: string) =>
  (m[k] ??= { games: 0, wins: 0, expected: 0, rankSum: 0 });

export function addRecord(t: Totals, r: GameRecord): void {
  t.games++;
  t.byPlayers[r.players] = (t.byPlayers[r.players] ?? 0) + 1;
  t.endedBy[r.endedBy]++;
  t.turns.push(r.turns);
  t.rounds.push(r.rounds);
  for (const p of r.result) {
    // Team games: a player wins with their team; the fair share is one team in `teams`.
    const won = r.teams ? (p.team === r.winnerTeam ? 1 : 0) : p.seat === r.winnerSeat ? 1 : 0;
    for (const b of [bucket(t.characters, p.character ?? 'none'), bucket(t.seats, String(p.seat))]) {
      b.games++;
      b.wins += won;
      b.expected += r.teams ? 1 / r.teams : 1 / r.players;
      b.rankSum += p.rank;
    }
  }
  r.landings.forEach((n, i) => (t.landings[i] += n));
  for (const [k, v] of Object.entries(r.rent)) t.rent[k] = (t.rent[k] ?? 0) + v;
  for (const [k, v] of Object.entries(r.invested)) t.invested[k] = (t.invested[k] ?? 0) + v;
}

export function mergeTotals(a: Totals, b: Totals): Totals {
  const out = newTotals(a.landings.length);
  const mergeBuckets = (x: Record<string, WinBucket>, y: Record<string, WinBucket>, into: Record<string, WinBucket>) => {
    for (const src of [x, y]) {
      for (const [k, v] of Object.entries(src)) {
        const t = bucket(into, k);
        t.games += v.games;
        t.wins += v.wins;
        t.expected += v.expected;
        t.rankSum += v.rankSum;
      }
    }
  };
  out.games = a.games + b.games;
  for (const src of [a, b]) {
    for (const [k, v] of Object.entries(src.byPlayers)) out.byPlayers[k] = (out.byPlayers[k] ?? 0) + v;
    for (const k of Object.keys(src.endedBy) as EndReason[]) out.endedBy[k] += src.endedBy[k];
    for (const [k, v] of Object.entries(src.rent)) out.rent[k] = (out.rent[k] ?? 0) + v;
    for (const [k, v] of Object.entries(src.invested)) out.invested[k] = (out.invested[k] ?? 0) + v;
    src.landings.forEach((n, i) => (out.landings[i] += n));
  }
  out.turns = [...a.turns, ...b.turns];
  out.rounds = [...a.rounds, ...b.rounds];
  mergeBuckets(a.characters, b.characters, out.characters);
  mergeBuckets(a.seats, b.seats, out.seats);
  return out;
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((x, y) => x - y);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export interface CharacterRow {
  id: string;
  games: number;
  winRate: number;
  fairRate: number;
  /** Percentage points above / below the fair share. */
  diffPP: number;
  /** 95% confidence half-width of winRate, in percentage points. */
  ci95: number;
  avgRank: number;
  balanced: boolean;
}

export function characterRows(t: Totals, tolerancePP: number): CharacterRow[] {
  return Object.entries(t.characters)
    .map(([id, b]) => {
      const winRate = b.wins / b.games;
      const fairRate = b.expected / b.games;
      const diffPP = (winRate - fairRate) * 100;
      return {
        id,
        games: b.games,
        winRate,
        fairRate,
        diffPP,
        ci95: 1.96 * Math.sqrt((winRate * (1 - winRate)) / b.games) * 100,
        avgRank: b.rankSum / b.games,
        balanced: Math.abs(diffPP) <= tolerancePP,
      };
    })
    .sort((a, b) => b.diffPP - a.diffPP);
}
