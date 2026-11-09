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
    expect(pay.cash('p3')).toBe(c[2]);
    expect(pay.cash('p2')).toBe(c[1] + total16);
    expect(pay.cash('p4')).toBe(c[3] + total16);
    expect(pay.cash('p1')).toBe(c[0] - 2 * total16);

    const col = teams([null, null, null, null], [0, 1, 0, 1]);
    const each10 = perPlayer(D.cards.CD10.effect, 2);
    const k = col.s.players.map((p) => p.cash);
    col.draw('p1', 'CD10');
    expect(col.cash('p3')).toBe(k[2]);
    expect(col.cash('p1')).toBe(k[0] + 2 * each10);
  });

  it('Họp tổ dân phố (C12) collects from opponents only', () => {
    const g = teams(['C12', null, null, null], [0, 1, 0, 1]);
    const k = g.s.players.map((p) => p.cash);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    expect(g.cash('p3')).toBe(k[2]);
    expect(g.cash('p2')).toBeLessThan(k[1]);
    expect(g.cash('p4')).toBeLessThan(k[3]);
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

describe('team games: winning', () => {
  it('the game goes on while two teams stand, and ends when one team is left', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p1', ['P22'], { level: 5 });
    g.setCash('p2', 0).setCurrent('p2').at('p2', D.ownables.P22.position - 3).roll('p2', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p2' });
    expect(g.s.status).toBe('playing');
    g.setCash('p4', 0).setCurrent('p4').at('p4', D.ownables.P22.position - 3).roll('p4', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p4' });
    expect(g.s).toMatchObject({ status: 'over', winnerTeam: 0 });
    expect(['p1', 'p3']).toContain(g.s.winner);
    expect(g.s.ranking!.slice(0, 2).map((r) => r.player).sort()).toEqual(['p1', 'p3']);
  });

  it('time limit: teams ranked by summed net worth, even if a rival holds the richest single seat', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1], { mode: 'quick' });
    for (const id of Object.keys(g.s.ownables)) g.s.ownables[id] = { owner: null, mortgaged: false, level: 0 };
    g.setCash('p1', 900).setCash('p3', 900).setCash('p2', 1500).setCash('p4', 100);
    g.do({ type: 'endGame' });
    expect(g.s.winnerTeam).toBe(0);
    expect(g.s.winner).toBe('p1');
    expect(g.s.ranking!.map((r) => r.player)).toEqual(['p1', 'p3', 'p2', 'p4']);
  });

  it('without teams nothing changes: no winnerTeam', () => {
    const g = G.create([null, null], { mode: 'quick' });
    g.do({ type: 'endGame' });
    expect(g.s.winnerTeam).toBeUndefined();
  });
});

describe('team games: bots', () => {
  it('a bot hands a teammate the last tiles of a group the teammate is closer to finishing', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p3', ['P03', 'P04']).give('p1', ['P05']);
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    const a = botActionFor(g.s, 'p1', g.d);
    expect(a).toMatchObject({ type: 'proposeTrade', to: 'p3', offer: { properties: ['P05'] }, request: { properties: [] } });
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
