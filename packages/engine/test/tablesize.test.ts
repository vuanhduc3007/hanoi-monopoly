import { describe, expect, it } from 'vitest';
import { autoBoard, characterFor, createGame, dataFor, defaultData, hexData as H } from '../src';

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
      expect(characterFor(defaultData, ch.id, 6)).toBe(defaultData.characters[ch.id]);
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

describe('60-tile hexagon board', () => {
  it('has 60 tiles, six corners every 10 tiles, and every ref once', () => {
    expect(H.id).toBe('hex');
    expect(H.shape).toBe('hexagon');
    expect(H.maxPlayers).toBe(8);
    expect(H.board).toHaveLength(60);
    expect([0, 10, 20, 30, 40, 50].map((i) => H.board[i].type)).toEqual(Array(6).fill('corner'));
    expect([0, 10, 30, 40].map((i) => H.board[i].ref)).toEqual(['GO', 'JAIL', 'PARK', 'GOTOJAIL']);
    const owned = H.board.map((t) => t.ref).filter((r) => /^[PTU]\d/.test(r));
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.sort()).toEqual(Object.keys(H.ownables).sort());
    for (const [id, o] of Object.entries(H.ownables)) expect(H.board[o.position].ref, id).toBe(id);
  });

  it('every card that moves to a tile finds it on every board', () => {
    for (const d of [defaultData, dataFor('extended'), H]) {
      for (const card of Object.values(d.cards)) {
        if (card.effect.type === 'move_to') expect(d.board.some((t) => t.ref === card.effect.tile), `${d.id} ${card.id}`).toBe(true);
      }
    }
  });

  it('seats 8; the 40- and 48-tile boards stop at 6', () => {
    const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
    expect(createGame({ players: players(8), seed: 1, config: { board: 'hex' } }).state.players).toHaveLength(8);
    expect(() => createGame({ players: players(7), seed: 1, config: { board: 'standard' } })).toThrow(/2-6/);
    expect(() => createGame({ players: players(7), seed: 1, config: { board: 'extended' } })).toThrow(/2-6/);
  });

  it("'auto' picks the board by table size", () => {
    expect([2, 3, 4, 5, 6, 7, 8].map((n) => autoBoard(n))).toEqual([
      'standard', 'standard', 'standard', 'extended', 'extended', 'hex', 'hex',
    ]);
  });

  it('a salary multiplier makes the longer lap pay more', () => {
    const g = createGame({ players: [{ id: 'a' }, { id: 'b' }], seed: 3, config: { board: 'hex', characters: false } }).state;
    expect(H.economy.goSalaryMultiplier).toBeGreaterThan(1);
    expect(g.players[0].cash).toBe(defaultData.economy.startingCash);
  });
});
