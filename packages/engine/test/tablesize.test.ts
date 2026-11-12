import { describe, expect, it } from 'vitest';
import { autoBoard, characterFor, createGame, dataFor, defaultData, largeData as L } from '../src';

describe('character numbers by table size (byTableSize)', () => {
  it('the first matching override replaces passives / drawbacks and merges into the skill', () => {
    const withOverride = Object.values(defaultData.characters).filter((c) => c.byTableSize?.length);
    expect(withOverride.length).toBeGreaterThan(0);
    for (const ch of withOverride) {
      for (const o of ch.byTableSize!) {
        for (const n of o.players) {
          const at = characterFor(defaultData, ch.id, n);
          const first = ch.byTableSize!.find((x) => x.players.includes(n))!;
          if (first.passives) expect(at.passives).toEqual(first.passives);
          if (first.drawbacks) expect(at.drawbacks).toEqual(first.drawbacks);
          expect(at.skill).toMatchObject({ ...ch.skill, ...first.skill });
        }
      }
      // A table size no override lists plays the base character.
      const plain = [2, 3, 4, 5, 6, 7, 8].find((n) => !ch.byTableSize!.some((o) => o.players.includes(n)));
      if (plain !== undefined) expect(characterFor(defaultData, ch.id, plain)).toBe(defaultData.characters[ch.id]);
    }
  });

  it('a real game uses the override for its own table size', () => {
    const c08 = defaultData.characters.C08;
    const duel = c08.byTableSize!.find((o) => o.players.includes(2))!;
    const cash = (n: number) =>
      createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, character: i === 0 ? 'C08' : null })), seed: 1 }).state.players[0].cash;
    expect(cash(2)).toBe(duel.passives!.find((t) => t.type === 'starting_cash')!.value);
    expect(cash(4)).toBe(c08.passives.find((t) => t.type === 'starting_cash')!.value);
  });
});

describe('56-tile board for 7–8 players', () => {
  it('has 56 tiles, corners at 0 / 14 / 28 / 42, every ref once', () => {
    expect(L.id).toBe('large');
    expect(L.maxPlayers).toBe(8);
    expect(L.board).toHaveLength(56);
    expect([0, 14, 28, 42].map((i) => L.board[i].ref)).toEqual(['GO', 'JAIL', 'PARK', 'GOTOJAIL']);
    expect(L.board.filter((t) => t.type === 'corner')).toHaveLength(4);
    const owned = L.board.map((t) => t.ref).filter((r) => /^[PTU]\d/.test(r));
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.sort()).toEqual(Object.keys(L.ownables).sort());
    expect(owned).toHaveLength(41);
    for (const [id, o] of Object.entries(L.ownables)) expect(L.board[o.position].ref, id).toBe(id);
    for (const g of Object.values(L.groups)) for (const id of g.properties) expect(L.ownables[id].group).toBeDefined();
  });

  it('every card that moves to a tile finds it on every board', () => {
    for (const d of [defaultData, dataFor('extended'), L]) {
      for (const card of Object.values(d.cards)) {
        if (card.effect.type === 'move_to') expect(d.board.some((t) => t.ref === card.effect.tile), `${d.id} ${card.id}`).toBe(true);
      }
    }
  });

  it('seats 8; the 40- and 48-tile boards stop at 6', () => {
    const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
    expect(createGame({ players: players(8), seed: 1, config: { board: 'large' } }).state.players).toHaveLength(8);
    expect(() => createGame({ players: players(7), seed: 1, config: { board: 'standard' } })).toThrow(/2-6/);
    expect(() => createGame({ players: players(7), seed: 1, config: { board: 'extended' } })).toThrow(/2-6/);
  });

  it("'auto' picks the board by table size", () => {
    expect([2, 3, 4, 5, 6, 7, 8].map((n) => autoBoard(n))).toEqual([
      'standard', 'standard', 'standard', 'extended', 'extended', 'large', 'large',
    ]);
  });

  it('bigger boards start richer: starting cash × multiplier, rounded up to tens, character overrides too', () => {
    const cash = (board: 'standard' | 'extended' | 'large', n: number, character: string | null = null) =>
      createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, character: i === 0 ? character : null })), seed: 1, config: { board } }).state.players[0].cash;
    expect(cash('standard', 4)).toBe(defaultData.economy.startingCash);
    for (const [board, n] of [['extended', 6], ['large', 8]] as const) {
      const m = dataFor(board).economy.startingCashMultiplier!;
      expect(m).toBeGreaterThan(1);
      expect(cash(board, n)).toBe(Math.ceil((1500 * m) / 10) * 10);
      const c08 = characterFor(defaultData, 'C08', n).passives[0].value as number;
      expect(cash(board, n, 'C08')).toBe(Math.ceil((c08 * m) / 10) * 10);
    }
  });

  it('a salary multiplier makes the longer lap pay more', () => {
    expect(L.economy.goSalaryMultiplier).toBeGreaterThan(1);
  });
});

describe('byMode: own numbers for Nhanh and team games', () => {
  it('matching entries apply after byTableSize, in order; others are ignored', async () => {
    const { characterFor, defaultData } = await import('../src');
    const base = defaultData.characters.C02;
    const d = {
      ...defaultData,
      characters: {
        ...defaultData.characters,
        C02: {
          ...base,
          byTableSize: [{ players: [4], skill: { rate: 0.4 } }],
          byMode: [
            { mode: 'quick' as const, skill: { cooldownRounds: 9 } },
            { teams: true, players: [4], skill: { rate: 0.3 } },
            { mode: 'classic' as const, teams: false, drawbacks: [] },
          ],
        },
      },
    };
    expect(characterFor(d, 'C02', 4).skill).toMatchObject({ rate: 0.4, cooldownRounds: base.skill.cooldownRounds });
    expect(characterFor(d, 'C02', 4).drawbacks).toEqual([]);
    expect(characterFor(d, 'C02', 4, { mode: 'quick' }).skill).toMatchObject({ rate: 0.4, cooldownRounds: 9 });
    expect(characterFor(d, 'C02', 4, { mode: 'quick', teams: true }).skill).toMatchObject({ rate: 0.3, cooldownRounds: 9 });
    expect(characterFor(d, 'C02', 6, { teams: true }).skill).toMatchObject({ rate: base.skill.rate });
    expect(characterFor(d, 'C02', 4, { teams: true }).drawbacks).toEqual(base.drawbacks);
  });

  it('a game applies the overrides of its own mode (starting cash included)', async () => {
    const { createGame, defaultData } = await import('../src');
    const base = defaultData.characters.C07;
    const d = {
      ...defaultData,
      characters: {
        ...defaultData.characters,
        C07: { ...base, byMode: [{ mode: 'quick' as const, drawbacks: [{ type: 'starting_cash', value: 1234 }] }] },
      },
    };
    const players = [{ id: 'a', character: 'C07' }, { id: 'b', character: null }];
    expect(createGame({ players, seed: 1, config: { mode: 'quick' } }, d).state.players[0].cash).toBeLessThan(1234);
    expect(createGame({ players, seed: 1, config: { mode: 'classic' } }, d).state.players[0].cash).toBe(base.drawbacks[0].value);
  });
});
