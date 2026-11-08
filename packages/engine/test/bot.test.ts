import { describe, expect, it } from 'vitest';
import { applyActionInPlace, botAcceptsTrade, botAction, createGame } from '../src';
import { D, G } from './helpers';

describe('bot policy (GDD 7.4)', () => {
  it('only ever chooses legal actions and finishes games', { timeout: 60_000 }, () => {
    const chars = Object.keys(D.characters);
    let finished = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const n = 2 + (seed % 5);
      const players = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, character: chars[(seed * 3 + i) % 8] }));
      const mode = seed % 3 === 0 ? 'quick' : 'classic';
      const s = createGame({ players, seed, config: { mode } }).state;
      for (let k = 0; k < 20_000 && s.status === 'playing'; k++) {
        const a = botAction(s)!;
        expect(() => applyActionInPlace(s, a), `seed ${seed}: ${JSON.stringify(a)}`).not.toThrow();
      }
      if (s.status === 'over') finished++;
    }
    expect(finished).toBeGreaterThanOrEqual(20);
  });

  it('buys only when ≥ 200 stays in hand', () => {
    const g = G.create([null, null]);
    g.roll('p1', 1, 2); // P02, 60
    expect(botAction(g.s)).toEqual({ type: 'buy', player: 'p1' });
    g.s.pending = { type: 'buy', player: 'p1', propertyId: 'P02', price: 60 };
    g.setCash('p1', 259);
    expect(botAction(g.s)).toEqual({ type: 'declineBuy', player: 'p1' });
  });

  it('bids up to the list price, capped by cash', () => {
    const g = G.create([null, null, null]).setCash('p2', 45);
    g.s.pending = { type: 'auction', propertyId: 'P02', highBid: 0, highBidder: null, eligible: ['p1', 'p2', 'p3'] };
    const a = botAction(g.s)!;
    expect(a).toMatchObject({ type: 'bid', amount: 60 });
    g.do(a);
    expect(botAction(g.s)).toEqual({ type: 'closeAuction' });
  });

  it('builds up to 3 houses when it owns a full group, keeping a reserve', () => {
    const g = G.create([null, null]).give('p1', ['P01', 'P02'], { level: 3 });
    g.s.turn.phase = 'end';
    expect(botAction(g.s)).toEqual({ type: 'endTurn', player: 'p1' });
    g.s.ownables.P01.level = 2;
    expect(botAction(g.s)).toEqual({ type: 'build', player: 'p1', propertyId: 'P01' });
    g.setCash('p1', 240);
    expect(botAction(g.s)).toEqual({ type: 'endTurn', player: 'p1' });
  });

  it('accepts a trade only if it completes one of its groups', () => {
    const g = G.create([null, null]).give('p2', ['P01']).give('p1', ['P02', 'P05']);
    const t = { id: 'x', from: 'p1', to: 'p2', unmortgage: [], request: { cash: 0, properties: [], jailCards: [] } };
    expect(botAcceptsTrade(g.s, 'p2', { ...t, offer: { cash: 0, properties: ['P02'], jailCards: [] } })).toBe(true);
    expect(botAcceptsTrade(g.s, 'p2', { ...t, offer: { cash: 500, properties: ['P05'], jailCards: [] } })).toBe(false);
  });

  it('proposes a swap that completes a group for both sides', () => {
    const g = G.create([null, null]).give('p1', ['P01', 'P03', 'P04']).give('p2', ['P02', 'P05']);
    g.s.turn.phase = 'end';
    const a = botAction(g.s)!;
    expect(a).toMatchObject({ type: 'proposeTrade', to: 'p2', offer: { properties: ['P03', 'P04'] }, request: { properties: ['P02'] } });
    g.do(a);
    g.do(botAction(g.s)!); // p2 answers: completes light blue → accept
    expect([g.owner('P02'), g.owner('P03'), g.owner('P04')]).toEqual(['p1', 'p2', 'p2']);
  });

  it('Ăn vạ only for big rents', () => {
    const g = G.create(['C02', null]).give('p2', ['P01']);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(botAction(g.s)).toEqual({ type: 'declineSkill', player: 'p1' });
  });

  it('Giải hạn when it saves enough cash (EV10)', () => {
    const g = G.create([null, 'C06']);
    g.draw('p1', 'EV10');
    expect(botAction(g.s)).toEqual({ type: 'useSkill', player: 'p2' });
  });

  it('Nghiện Tarot keeps the better card', () => {
    const g = G.create(['C06', null]);
    g.setCurrent('p1').at('p1', 4).top('CH14', 'CH12');
    g.roll('p1', 1, 2);
    expect(botAction(g.s)).toEqual({ type: 'chooseCard', player: 'p1', cardId: 'CH12' });
  });

  it('Tài xế Grab steps away from a costly rent', () => {
    const g = G.create(['C03', null]).give('p2', ['P21', 'P22'], { level: 3 });
    g.setCurrent('p1').at('p1', 30).rig(4, 5).do({ type: 'roll', player: 'p1' }); // 39 = Hồ Gươm
    const a = botAction(g.s)!;
    expect(a.type === 'adjustStep' || a.type === 'useSkill').toBe(true);
  });
});

describe('botActionFor / actorOf / publicView', () => {
  it('acts only for the player who must act; raises by the minimum step in auctions', async () => {
    const { actorOf, botActionFor } = await import('../src');
    const g = G.create([null, null, null]);
    expect(actorOf(g.s)).toBe('p1');
    expect(botActionFor(g.s, 'p2')).toBeNull();
    expect(botActionFor(g.s, 'p1')).toEqual({ type: 'roll', player: 'p1' });
    g.s.pending = { type: 'auction', propertyId: 'P02', highBid: 50, highBidder: 'p1', eligible: ['p1', 'p2', 'p3'] };
    expect(actorOf(g.s)).toBeNull();
    expect(botActionFor(g.s, 'p1')).toBeNull();
    expect(botActionFor(g.s, 'p2')).toEqual({ type: 'bid', player: 'p2', amount: 60 });
    g.s.pending.highBid = 60;
    expect(botActionFor(g.s, 'p3')).toBeNull(); // 70 > list price 60
  });

  it('publicView hides deck order, RNG and seed until the game is over', async () => {
    const { publicView } = await import('../src');
    const g = G.create([null, null]);
    const v = publicView(g.s) as unknown as Record<string, unknown>;
    expect(v.decks).toBeUndefined();
    expect(v.rng).toBeUndefined();
    expect(v.seed).toBeNull();
    expect(v.deckSizes).toEqual({ chance: 17, community: 16, event: 32 });
    g.do({ type: 'endGame' });
    expect(publicView(g.s).seed).toBe(42);
  });
});
