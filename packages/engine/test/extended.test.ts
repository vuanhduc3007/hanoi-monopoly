import { describe, expect, it } from 'vitest';
import { applyActionInPlace, botAction, createGame, dataFor, defaultData, extendedData as X } from '../src';
import { G } from './helpers';

const refAt = (ref: string) => X.board.findIndex((t) => t.ref === ref);

describe('48-tile extended board', () => {
  it('has 48 tiles with corners at 0 / 12 / 24 / 36 and every ref defined once', () => {
    expect(X.id).toBe('extended');
    expect(X.board).toHaveLength(48);
    expect([0, 12, 24, 36].map((i) => X.board[i].ref)).toEqual(['GO', 'JAIL', 'PARK', 'GOTOJAIL']);
    const owned = X.board.map((t) => t.ref).filter((r) => /^[PTU]\d/.test(r));
    expect(new Set(owned).size).toBe(owned.length);
    expect(owned.sort()).toEqual(Object.keys(X.ownables).sort());
    expect(Object.keys(X.ownables)).toHaveLength(35);
    expect(Object.keys(X.groups)).toHaveLength(10);
    for (const g of Object.values(X.groups)) for (const id of g.properties) expect(refAt(id)).toBeGreaterThan(0);
  });

  it('keeps the standard board unchanged', () => {
    expect(defaultData.id).toBe('standard');
    expect(defaultData.board).toHaveLength(40);
    expect(dataFor(undefined)).toBe(defaultData);
    expect(dataFor('extended')).toBe(X);
  });

  it('applies its economy overrides (salary, five-transport rents)', () => {
    expect(X.economy.goSalary).toBe(defaultData.economy.goSalary);
    expect(X.economy.goSalaryBonus).toBeGreaterThan(0);
    expect(X.economy.transportRent).toHaveLength(5);
    expect(X.economy.jailFine).toBe(defaultData.economy.jailFine);
  });

  it('the salary bonus stacks on character salaries (Thiếu gia Vin keeps his edge)', () => {
    for (const [chars, base] of [[[null, null], X.economy.goSalary], [['C01', null], X.characters.C01.passives[0].value as number]] as const) {
      const g = G.create([...chars], { board: 'extended' });
      g.setCurrent('p1').at('p1', 46);
      g.rig(1, 2);
      const before = g.s.players[0].cash;
      g.do({ type: 'roll', player: 'p1' });
      const salary = g.events.filter((e) => e.type === 'salary').reduce((a, e) => a + (e.amount as number), 0);
      expect(salary, `${chars[0]}`).toBe(base + X.economy.goSalaryBonus!);
      expect(g.s.players[0].cash).toBeGreaterThan(before);
    }
  });

  it('a game created with board: extended records it and uses the 48-tile data', () => {
    const g = G.create([null, null, null, null, null, null], { board: 'extended' });
    expect(g.s.config.board).toBe('extended');
    expect(Object.keys(g.s.ownables)).toHaveLength(35);
    expect(G.create([null, null]).s.config.board).toBe('standard');
  });

  it('card moves resolve tile refs on the extended board (CH01 → Hồ Gươm at 47)', () => {
    const g = G.create([null, null, null], { board: 'extended' });
    g.setCurrent('p1').at('p1', refAt('CH') - 3).top('CH01');
    g.rig(1, 2);
    g.do({ type: 'roll', player: 'p1' });
    if (g.s.pending?.type === 'postRoll') g.do({ type: 'confirmRoll', player: 'p1' });
    expect(g.s.players.find((p) => p.id === 'p1')!.position).toBe(refAt('P22'));
  });

  it('CSGT sends you to the jail at 12', () => {
    const g = G.create([null, null], { board: 'extended' });
    g.setCurrent('p1').at('p1', 33);
    g.rig(1, 2);
    g.do({ type: 'roll', player: 'p1' });
    if (g.s.pending?.type === 'postRoll') g.do({ type: 'confirmRoll', player: 'p1' });
    const p = g.s.players.find((x) => x.id === 'p1')!;
    expect(p.position).toBe(12);
    expect(p.jailTurns).toBeDefined();
  });

  it('bots finish 6-player games on the extended board', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const chars = Object.keys(X.characters);
      const s = createGame({ players: chars.slice(0, 6).map((c, i) => ({ id: `p${i}`, character: c })), seed, config: { board: 'extended', mode: 'quick' } }).state;
      for (let k = 0; k < 40000 && s.status === 'playing'; k++) applyActionInPlace(s, botAction(s)!);
      for (const p of s.players) expect(p.position).toBeLessThan(48);
    }
  });
});
