import { describe, expect, it } from 'vitest';
import { createGame, dataFor } from '../src';
import { baseCharacters, D, G, has } from './helpers';

function teams(chars: (string | null)[], team: number[]): G {
  const players = chars.map((character, i) => ({ id: `p${i + 1}`, character, team: team[i] }));
  const d = baseCharacters(dataFor(undefined));
  return new G(createGame({ players, seed: 42 }, d).state, d);
}

describe('surrender (Đầu hàng)', () => {
  it('leaves the game at once; money to the bank, tiles back on sale at auction', () => {
    const g = G.create([null, null, null]).give('p2', ['P01', 'P02'], { level: 1 });
    const ev = g.do({ type: 'surrender', player: 'p2' });
    expect(has(ev, 'surrendered', { player: 'p2' })).toBe(true);
    expect(g.p('p2')).toMatchObject({ bankrupt: true, cash: 0 });
    expect(g.s.ownables.P01.level).toBe(0);
    expect(g.s.pending).toMatchObject({ type: 'auction', propertyId: 'P01' });
    expect(g.s.status).toBe('playing');
  });

  it('on his own turn the turn passes to the next player', () => {
    const g = G.create([null, null, null]);
    g.setCurrent('p1').do({ type: 'surrender', player: 'p1' });
    expect(g.s.players[g.s.turn.current].id).toBe('p2');
    expect(g.s.turn.phase).toBe('roll');
  });

  it('the last opponent left wins', () => {
    const g = G.create([null, null]);
    g.do({ type: 'surrender', player: 'p2' });
    expect(g.s).toMatchObject({ status: 'over', winner: 'p1' });
  });

  it('owing money: everything goes to the creditor straight away, nothing is sold first', () => {
    const g = G.create([null, null]).give('p1', ['P22'], { level: 5 }).give('p2', ['P01']);
    g.setCash('p2', 0).setCurrent('p2').at('p2', D.ownables.P22.position - 3).roll('p2', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p2' });
    g.do({ type: 'surrender', player: 'p2' });
    expect(g.owner('P01')).toBe('p1');
    expect(g.s).toMatchObject({ status: 'over', winner: 'p1' });
  });

  it('not while another decision of his is waiting; an auction just goes on without him', () => {
    const g = G.create([null, null, null]);
    g.setCurrent('p1').at('p1', D.ownables.P01.position - 3).roll('p1', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'buy', player: 'p1' });
    expect(() => g.do({ type: 'surrender', player: 'p1' })).toThrow(/decision/);
    g.do({ type: 'declineBuy', player: 'p1' });
    g.do({ type: 'bid', player: 'p2', amount: D.economy.auction.startBid });
    g.do({ type: 'surrender', player: 'p2' });
    expect(g.s.pending).toMatchObject({ type: 'auction', highBidder: null });
    expect((g.s.pending as { eligible: string[] }).eligible).not.toContain('p2');
  });

  it('team games: his tiles and cards stay with a teammate, and so does the shared wallet', () => {
    const g = teams([null, null, null, null], [0, 1, 0, 1]).give('p1', ['P01']);
    g.p('p1').jailCards.push('CH09');
    const wallet = g.cash('p3');
    g.do({ type: 'surrender', player: 'p1' });
    expect(g.p('p1').bankrupt).toBe(true);
    expect(g.owner('P01')).toBe('p3');
    expect(g.p('p3').jailCards).toContain('CH09');
    expect(g.cash('p3')).toBe(wallet);
    expect(g.s.status).toBe('playing');
    // The last member of a team surrendering puts the team out.
    g.do({ type: 'surrender', player: 'p3' });
    expect(g.s).toMatchObject({ status: 'over', winnerTeam: 1 });
  });

  it('not twice', () => {
    const g = G.create([null, null, null]);
    g.do({ type: 'surrender', player: 'p3' });
    expect(() => g.do({ type: 'surrender', player: 'p3' })).toThrow(/out/);
  });
});
