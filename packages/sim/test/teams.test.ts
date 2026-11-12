import { describe, expect, it } from 'vitest';
import { defaultData } from '@hanoi-monopoly/engine';
import { runGame } from '../src/runGame';
import { addRecord, newTotals } from '../src/stats';

describe('team games in the simulator', () => {
  it('seats alternate teams; a player wins with the team; the fair share is one team', () => {
    const t = newTotals(defaultData.board.length);
    for (let seed = 1; seed <= 6; seed++) {
      const r = runGame({ seed, players: 4, mode: 'quick', characters: true, maxRounds: 200, quickRounds: 15, teams: 2 });
      expect(r.teams).toBe(2);
      expect(r.result.map((p) => p.team)).toEqual([0, 1, 0, 1]);
      addRecord(t, r);
    }
    const seats = Object.values(t.seats);
    const wins = seats.reduce((a, b) => a + b.wins, 0);
    expect(wins).toBe(6 * 2); // two winners per game
    expect(seats.reduce((a, b) => a + b.expected, 0)).toBeCloseTo(6 * 2);
  });
});
