import { describe, expect, it } from 'vitest';
import { characterRows, formatReport, mergeTotals, runGame, simulateRange, summarize, type BatchOptions } from '../src';

const base: BatchOptions = {
  games: 24,
  seed: 100,
  players: 4,
  mode: 'classic',
  characters: true,
  maxRounds: 200,
  quickRounds: 40,
};

describe('runGame', () => {
  it('is deterministic for a seed', () => {
    const o = { seed: 5, players: 4, mode: 'classic' as const, characters: true, maxRounds: 200, quickRounds: 40 };
    expect(runGame(o)).toEqual(runGame(o));
  });

  it('records a coherent result', () => {
    const r = runGame({ seed: 9, players: 3, mode: 'classic', characters: true, maxRounds: 200, quickRounds: 40 });
    expect(r.result).toHaveLength(3);
    expect(new Set(r.result.map((p) => p.character)).size).toBe(3);
    expect(r.result.map((p) => p.rank).sort()).toEqual([1, 2, 3]);
    expect(r.result.find((p) => p.rank === 1)!.seat).toBe(r.winnerSeat);
    expect(r.landings.reduce((a, b) => a + b, 0)).toBeGreaterThan(r.turns * 0.9);
  });

  it('respects the round limit', () => {
    const r = runGame({ seed: 3, players: 6, mode: 'classic', characters: true, maxRounds: 5, quickRounds: 40 });
    expect(r.endedBy).toBe('roundLimit');
    expect(r.rounds).toBeLessThanOrEqual(6);
  });

  it('quick mode ends by the 2nd bankruptcy or the round limit', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = runGame({ seed, players: 4, mode: 'quick', characters: true, maxRounds: 200, quickRounds: 40 });
      expect(['quickBankrupt', 'roundLimit']).toContain(r.endedBy);
      expect(r.result.filter((p) => p.bankruptAtTurn !== null).length).toBeLessThanOrEqual(2);
    }
  });

  it('can force a line-up and run without characters', () => {
    const r = runGame({ seed: 1, players: 2, mode: 'classic', characters: true, maxRounds: 50, quickRounds: 40, lineup: ['C07', 'C08'] });
    expect(r.result.map((p) => p.character)).toEqual(['C07', 'C08']);
    const n = runGame({ seed: 1, players: 2, mode: 'classic', characters: false, maxRounds: 50, quickRounds: 40 });
    expect(n.result.every((p) => p.character === null)).toBe(true);
  });
});

describe('batches', () => {
  it('splitting into chunks (workers) gives the same totals', { timeout: 60_000 }, () => {
    const whole = simulateRange(base, 0, base.games);
    const split = mergeTotals(simulateRange(base, 0, 10), simulateRange(base, 10, base.games));
    expect(split).toEqual(whole);
  });

  it('fair share accounts for mixed player counts', { timeout: 60_000 }, () => {
    const t = simulateRange({ ...base, players: [2, 6], games: 20 }, 0, 20);
    const rows = characterRows(t, 3);
    const games = Object.values(t.byPlayers).reduce((a, b) => a + b, 0);
    expect(games).toBe(20);
    for (const r of rows) expect(r.fairRate).toBeGreaterThan(1 / 6 - 1e-9);
    const wins = Object.values(t.characters).reduce((a, b) => a + b.wins, 0);
    expect(wins).toBe(20);
  });

  it('report renders every section', () => {
    const t = simulateRange({ ...base, games: 6 }, 0, 6);
    const text = formatReport(summarize(t, { tolerancePP: 3 }), { tolerancePP: 3 });
    for (const h of ['Tỉ lệ thắng theo nhân vật', 'vị trí đi', 'Lợi nhuận theo nhóm', 'Tần suất dừng từng ô', 'Hồ Gươm']) {
      expect(text).toContain(h);
    }
  });
});
