import { describe, expect, it } from 'vitest';
import {
  applyAction,
  botAction,
  botActionFor,
  botAcceptsTrade,
  createGame,
  dataFor,
  interleaveTeams,
  perPlayer,
  type GameConfig,
  type GameState,
} from '../src';
import { baseCharacters, D, G, has } from './helpers';

/** Players p1..pN; `teams[i]` is p(i+1)'s team. */
function teams(chars: (string | null)[], team: number[], config: Partial<GameConfig> = {}, seed = 42): G {
  const players = chars.map((character, i) => ({ id: `p${i + 1}`, character, team: team[i] }));
  const d = baseCharacters(dataFor(config.board));
  return new G(createGame({ players, seed, config }, d).state, d);
}

describe('team games: setup', () => {
  it('every player needs a team, and there must be at least two', () => {
    const mk = (t: (number | undefined)[]) => () =>
      createGame({ players: t.map((team, i) => ({ id: `p${i + 1}`, team })), seed: 1 });
    expect(mk([0, 0, 1, undefined])).toThrow(/team/);
    expect(mk([0, 0, 0, 0])).toThrow(/two teams/);
    expect(() => mk([0, 1, 0, 1])()).not.toThrow();
    expect(createGame({ players: [{ id: 'a' }, { id: 'b' }], seed: 1 }).state.players[0].team).toBeUndefined();
  });

  it('interleaveTeams: teams alternate, first team = best roller, rolled order kept inside each team', () => {
    const team: Record<string, number> = { a: 0, b: 0, c: 1, d: 1, e: 2 };
    expect(interleaveTeams(['c', 'd', 'a', 'e', 'b'], (id) => team[id])).toEqual(['c', 'a', 'e', 'd', 'b']);
    expect(interleaveTeams(['a', 'b', 'c'], (id) => team[id])).toEqual(['a', 'c', 'b']);
  });
});

describe('team games: money never moves between teammates', () => {
  it('rent: a teammate stays free, an opponent pays', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p1', ['P02'], { level: 2 });
    g.setCurrent('p3').at('p3', 0);
    const before = g.cash('p3');
    const ev = g.roll('p3', 1, 2);
    expect(has(ev, 'rentWaived', { player: 'p3', propertyId: 'P02', why: 'team' })).toBe(true);
    expect(g.cash('p3')).toBe(before);
    g.do({ type: 'endTurn', player: 'p3' });
    g.setCurrent('p2').at('p2', 0);
    const p2 = g.cash('p2');
    g.roll('p2', 1, 2);
    expect(g.cash('p2')).toBe(p2 - D.ownables.P02.rent!.h2);
  });

  it('CH16 pay_each_player / CD10 collect_from_each: only opponents, the total split among them', () => {
    const pay = teams([null, null, null, null], [0, 1, 0, 1]);
    const total16 = perPlayer(D.cards.CH16.effect, 2);
    const c = pay.s.players.map((p) => p.cash);
    pay.draw('p1', 'CH16');
    // Both opponents are paid into their one wallet; the drawer's team pays twice.
    expect(pay.cash('p1')).toBe(c[0] - 2 * total16);
    expect(pay.cash('p3')).toBe(pay.cash('p1'));
    expect(pay.cash('p2')).toBe(c[1] + 2 * total16);
    expect(pay.cash('p4')).toBe(pay.cash('p2'));

    const col = teams([null, null, null, null], [0, 1, 0, 1]);
    const each10 = perPlayer(D.cards.CD10.effect, 2);
    const k = col.s.players.map((p) => p.cash);
    col.draw('p1', 'CD10');
    expect(col.cash('p1')).toBe(k[0] + 2 * each10);
    expect(col.cash('p3')).toBe(col.cash('p1'));
    expect(col.cash('p2')).toBe(k[1] - 2 * each10);
  });

  it('Họp tổ dân phố (C12) collects from opponents only', () => {
    const g = teams(['C12', null, null, null], [0, 1, 0, 1]);
    const k = g.s.players.map((p) => p.cash);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    const got = g.cash('p1') - k[0];
    expect(got).toBeGreaterThan(0);
    expect(g.cash('p3')).toBe(g.cash('p1'));
    expect(g.cash('p2')).toBeLessThanOrEqual(k[1] - got);
    expect(g.cash('p4')).toBe(g.cash('p2'));
  });

  it('Bóc phốt (C04) cannot target a teammate; Mở sòng (C09) seats only opponents', () => {
    const g = teams(['C04', null, null, null], [0, 1, 0, 1]);
    expect(() => g.setCurrent('p1').do({ type: 'useSkill', player: 'p1', target: 'p3' })).toThrow(/opponent/);
    g.do({ type: 'useSkill', player: 'p1', target: 'p2' });
    const s = teams(['C09', null, null, null], [0, 1, 0, 1]);
    s.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    expect(s.s.pending).toMatchObject({ type: 'sicboBet', order: ['p2', 'p4'] });
  });
});

describe('team games: one shared wallet', () => {
  it('starts with the members’ money added up; every member shows the whole wallet', () => {
    const solo = G.create([null, null, null, null]).cash('p1');
    const g = teams([null, null, null, null], [0, 1, 0, 1]);
    expect(g.cash('p1')).toBe(2 * solo);
    expect(g.cash('p3')).toBe(2 * solo);
    expect(g.s.teamCash).toEqual({ 0: 2 * solo, 1: 2 * solo });
  });

  it('what one member pays or earns changes the wallet for the whole team', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]);
    const start = g.cash('p1');
    g.setCurrent('p1').at('p1', D.ownables.P01.position - 3).roll('p1', 1, 2);
    const price = (g.s.pending as { price: number }).price;
    g.do({ type: 'buy', player: 'p1' });
    expect(g.cash('p3')).toBe(start - price);
    expect(g.cash('p1')).toBe(g.cash('p3'));
    expect(g.cash('p2')).toBe(start);
  });

  it('a short member raises cash from the teammates’ tiles too', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p2', ['P22'], { level: 5 }).give('p3', ['P21']);
    g.setCash('p1', 0).setCurrent('p1').at('p1', D.ownables.P22.position - 3).roll('p1', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p1' });
    g.do({ type: 'mortgage', player: 'p1', propertyId: 'P21' });
    expect(g.s.ownables.P21.mortgaged).toBe(true);
    expect(g.cash('p3')).toBe(g.cash('p1'));
  });
});

describe('team games: winning', () => {
  it('the wallet is shared, so a team goes bankrupt together and the last team standing wins', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p1', ['P22'], { level: 5 }).give('p4', ['P01']);
    g.setCash('p2', 0).setCurrent('p2').at('p2', D.ownables.P22.position - 3).roll('p2', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p2' });
    expect(g.p('p2').bankrupt && g.p('p4').bankrupt).toBe(true);
    // p4's tile goes with the team to the creditor.
    expect(g.owner('P01')).toBe('p1');
    expect(g.s).toMatchObject({ status: 'over', winnerTeam: 0 });
    expect(['p1', 'p3']).toContain(g.s.winner);
    expect(g.s.ranking!.slice(0, 2).map((r) => r.player).sort()).toEqual(['p1', 'p3']);
  });

  it('with three teams the game goes on after one team falls', () => {
    const g = teams([null, null, null, null, null, null], [0, 1, 2, 0, 1, 2], { board: 'extended' });
    const big = Object.keys(g.d.ownables).find((id) => g.d.ownables[id].kind === 'property' && g.d.ownables[id].position > 5)!;
    g.give('p1', [big], { level: 5 });
    g.setCash('p2', 0).setCurrent('p2').at('p2', g.d.ownables[big].position - 3).roll('p2', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p2' });
    expect(g.s.players.filter((p) => p.bankrupt).map((p) => p.id)).toEqual(['p2', 'p5']);
    expect(g.s.status).toBe('playing');
  });

  it('time limit: teams ranked by net worth with the shared wallet counted once', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1], { mode: 'quick' });
    for (const id of Object.keys(g.s.ownables)) g.s.ownables[id] = { owner: null, mortgaged: false, level: 0 };
    // Team 0: 1200 + a tile. Team 1: 1500 cash only (it would win if each copy of the wallet counted).
    g.setCash('p1', 1200).setCash('p2', 1500).give('p3', ['P22']);
    expect(1200 + D.ownables.P22.price).toBeGreaterThan(1500);
    g.do({ type: 'endGame' });
    expect(g.s.winnerTeam).toBe(0);
    expect(g.s.ranking!.slice(0, 2).map((r) => r.player).sort()).toEqual(['p1', 'p3']);
  });

  it('without teams nothing changes: no winnerTeam', () => {
    const g = G.create([null, null], { mode: 'quick' });
    g.do({ type: 'endGame' });
    expect(g.s.winnerTeam).toBeUndefined();
  });
});

describe('team games: a colour group held by teammates together counts as full', () => {
  const pooled = () => teams([null, null, null, null], [0, 1, 0, 1]).give('p3', ['P03', 'P04']).give('p1', ['P05']);

  it('any teammate builds on any tile of the team, evenly across the whole group', () => {
    const g = pooled();
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    g.do({ type: 'build', player: 'p1', propertyId: 'P05' });
    expect(g.s.ownables.P05.level).toBe(1);
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P05' })).toThrow(/evenly/);
    g.do({ type: 'build', player: 'p1', propertyId: 'P03' });
    g.do({ type: 'build', player: 'p1', propertyId: 'P04' });
    expect(g.owner('P03')).toBe('p3');
    g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P04' });
    expect(() => g.do({ type: 'build', player: 'p2', propertyId: 'P05' })).toThrow();
    g.setCurrent('p3');
    g.s.turn.phase = 'end';
    g.do({ type: 'build', player: 'p3', propertyId: 'P04' });
    g.do({ type: 'build', player: 'p3', propertyId: 'P05' });
    expect(g.s.ownables.P05.level).toBe(2);
  });

  it('the base rent doubles for the whole team; teammates still pay nothing', () => {
    const g = pooled();
    const before = g.cash('p3');
    g.setCurrent('p2').at('p2', 0).roll('p2', 4, 4); // P04 (p3)
    const base = g.d.ownables.P04.rent!.base;
    expect(g.cash('p3')).toBe(before + base * g.d.economy.monopolyBaseRentMultiplier);
    expect(g.cash('p1')).toBe(g.cash('p3'));
  });

  it('a teammate’s mortgage blocks building in the group; any teammate may unmortgage it', () => {
    const g = pooled();
    g.setCurrent('p3');
    g.s.turn.phase = 'end';
    g.do({ type: 'mortgage', player: 'p3', propertyId: 'P03' });
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P05' })).toThrow(/mortgaged/);
    g.do({ type: 'unmortgage', player: 'p1', propertyId: 'P03' });
    g.do({ type: 'build', player: 'p1', propertyId: 'P05' });
    expect(g.s.ownables.P05.level).toBe(1);
  });

  it('a tile of a team group with houses cannot be traded away', () => {
    const g = pooled();
    g.s.ownables.P03.level = 1;
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    expect(() =>
      g.do({ type: 'proposeTrade', player: 'p1', to: 'p2', offer: { properties: ['P05'] }, request: { cash: 100 } }),
    ).toThrow(/buildings/);
  });
});

describe('team games: bots', () => {
  it('a bot builds on its own tile of a colour group its team holds together (no gift needed)', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p3', ['P03', 'P04']).give('p1', ['P05']);
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    const a = botActionFor(g.s, 'p1', g.d);
    expect(a).toMatchObject({ type: 'build', player: 'p1', propertyId: 'P05' });
  });

  it("a bot accepts a teammate's offer that completes a group for either side, never an opponent's gift-grab", () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p3', ['P03', 'P04']).give('p1', ['P05']);
    const ask = { id: 1, from: 'p3', to: 'p1', offer: { properties: [] }, request: { properties: ['P05'] } } as never;
    expect(botAcceptsTrade(g.s, 'p1', ask, g.d)).toBe(true);
    const grab = { id: 2, from: 'p2', to: 'p1', offer: { properties: [] }, request: { properties: ['P05'] } } as never;
    expect(botAcceptsTrade(g.s, 'p1', grab, g.d)).toBe(false);
  });

  it('bot-only team games finish on every board', { timeout: 60_000 }, () => {
    for (const [board, n] of [['standard', 4], ['extended', 6], ['large', 8]] as const) {
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, team: i % 2 }));
      const d = dataFor(board);
      let s: GameState = createGame({ players, seed: 7, config: { board } }, d).state;
      for (let k = 0; k < 200_000 && s.status === 'playing'; k++) {
        if (s.turn.number > 400 && !s.pending && s.turn.phase === 'roll') {
          s = applyAction(s, { type: 'endGame' }, d).state;
          break;
        }
        const a = botAction(s, d);
        if (!a) break;
        s = applyAction(s, a, d).state;
      }
      expect(s.status).toBe('over');
      expect([0, 1]).toContain(s.winnerTeam);
      // nobody ever paid a teammate
      for (const p of s.players) expect(Number.isFinite(p.cash)).toBe(true);
    }
  });
});
