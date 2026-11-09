import { describe, expect, it } from 'vitest';
import { applyAction, createGame, rollTurnOrder } from '../src';
import { D, G, has } from './helpers';

const two = () => G.create([null, null]);
const three = () => G.create([null, null, null]);

describe('setup', () => {
  it('starting cash, positions, decks and determinism', () => {
    const a = G.create(['C07', 'C08', null]);
    expect(a.s.players.map((p) => p.cash)).toEqual([1400, 1600, 1500]);
    expect(a.s.players.every((p) => p.position === 0)).toBe(true);
    const b = G.create(['C07', 'C08', null]);
    expect(b.s.decks).toEqual(a.s.decks);
    const c = G.create(['C07', 'C08', null], {}, 7);
    expect(c.s.decks).not.toEqual(a.s.decks);
    expect(a.s.seed).toBe(42);
  });

  it('validates player count and unique characters', () => {
    expect(() => G.create([null])).toThrow();
    expect(() => G.create([null, null, null, null, null, null, null])).toThrow();
    expect(() => G.create(['C01', 'C01'])).toThrow(/unique/);
  });

  it('rollTurnOrder is a deterministic permutation', () => {
    const r1 = rollTurnOrder(['a', 'b', 'c', 'd'], 9);
    expect([...r1.order].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(rollTurnOrder(['a', 'b', 'c', 'd'], 9)).toEqual(r1);
  });

  it('applyAction is pure (input state untouched)', () => {
    const { state } = createGame({ players: [{ id: 'a' }, { id: 'b' }], seed: 1 });
    const snapshot = JSON.stringify(state);
    applyAction(state, { type: 'roll', player: 'a' });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('rejects out-of-turn actions', () => {
    const g = two();
    expect(() => g.do({ type: 'roll', player: 'p2' })).toThrow(/turn/);
    g.roll('p1', 3, 4); // → 7 Cơ hội
    expect(() => g.do({ type: 'roll', player: 'p1' })).toThrow();
  });
});

describe('movement, salary, doubles', () => {
  it('passing GO pays 200', () => {
    const g = two();
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1700);
  });

  it('doubles roll again; three doubles draw a Hanoi Event then go to jail without moving', () => {
    const g = two().give('p2', Object.keys(D.ownables), { mortgaged: true });
    g.setCurrent('p1').at('p1', 10).top('EV01');
    g.roll('p1', 3, 3); // → 16
    expect(g.s.turn.phase).toBe('roll');
    g.roll('p1', 2, 2); // → 20
    g.roll('p1', 5, 5); // triple
    expect(has(g.events, 'tripleDoubles')).toBe(true);
    expect(g.p('p1')).toMatchObject({ position: 10, inJail: true, cash: 1550 });
    expect(g.s.turn.phase).toBe('end');
  });

  it('landing on CSGT thổi còi sends to jail', () => {
    const g = two();
    g.setCurrent('p1').at('p1', 27).roll('p1', 1, 2);
    expect(g.p('p1')).toMatchObject({ position: 10, inJail: true });
  });
});

describe('Bãi giữ xe', () => {
  const jailed = (mode: 'classic' | 'quick' = 'classic') => {
    const g = G.create([null, null], { mode });
    g.p('p1').inJail = true;
    g.p('p1').position = 10;
    return g;
  };

  it('rolling doubles leaves and moves, with no extra roll', () => {
    const g = jailed();
    g.roll('p1', 3, 3);
    expect(g.p('p1')).toMatchObject({ inJail: false, position: 16 });
    g.do({ type: 'declineBuy', player: 'p1' });
    g.do({ type: 'closeAuction' });
    expect(g.s.turn.phase).toBe('end');
  });

  it('a miss stays; the 3rd miss pays 50 into the Quỹ and moves', () => {
    const g = jailed();
    g.roll('p1', 1, 2);
    expect(g.p('p1')).toMatchObject({ inJail: true, jailTurns: 1, position: 10 });
    g.p('p1').jailTurns = 2;
    g.s.turn.phase = 'roll';
    g.roll('p1', 1, 2);
    expect(g.p('p1')).toMatchObject({ inJail: false, position: 13, cash: 1450 });
    expect(g.s.fund).toBe(50);
  });

  it('quick mode: at most 2 turns', () => {
    const g = jailed('quick');
    g.p('p1').jailTurns = 1;
    g.roll('p1', 1, 2);
    expect(g.p('p1').inJail).toBe(false);
  });

  it('pay the fine, then roll normally (doubles continue)', () => {
    const g = jailed();
    g.do({ type: 'payJailFine', player: 'p1' });
    expect(g.p('p1')).toMatchObject({ inJail: false, cash: 1450 });
    g.roll('p1', 2, 2); // → 14, buy decision first
    g.do({ type: 'declineBuy', player: 'p1' });
    g.do({ type: 'closeAuction' });
    expect(g.s.turn.phase).toBe('roll');
  });

  it('CH11 frees the player and returns to the bottom of Cơ hội', () => {
    const g = jailed();
    g.p('p1').jailCards = ['CH11'];
    g.s.decks.chance = g.s.decks.chance.filter((x) => x !== 'CH11');
    g.do({ type: 'useJailCard', player: 'p1' });
    expect(g.p('p1').inJail).toBe(false);
    expect(g.s.decks.chance[g.s.decks.chance.length - 1]).toBe('CH11');
  });
});

describe('Quỹ khuyến học', () => {
  it('taxes go in, landing exactly on 20 empties it', () => {
    const g = two();
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2); // TAX1
    g.do({ type: 'endTurn', player: 'p1' });
    g.at('p2', 35).roll('p2', 1, 2); // TAX2
    expect(g.s.fund).toBe(300);
    g.do({ type: 'endTurn', player: 'p2' });
    g.at('p1', 17).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1300 + 300);
    expect(g.s.fund).toBe(0);
  });

  it('fund off: taxes go to the bank', () => {
    const g = G.create([null, null], { scholarshipFund: false });
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2);
    expect(g.s.fund).toBe(0);
    expect(g.cash('p1')).toBe(1300);
  });
});

describe('buying and auctions', () => {
  it('buy at list price', () => {
    const g = two();
    g.roll('p1', 1, 2);
    g.do({ type: 'buy', player: 'p1' });
    expect(g.owner('P02')).toBe('p1');
    expect(g.cash('p1')).toBe(1440);
  });

  it('declining starts an auction for everyone; min bid 10, step 10, ≤ cash', () => {
    const g = two().setCash('p2', 25);
    g.roll('p1', 1, 2);
    g.do({ type: 'declineBuy', player: 'p1' });
    expect(g.s.pending).toMatchObject({ type: 'auction', propertyId: 'P02', eligible: ['p1', 'p2'] });
    expect(() => g.do({ type: 'bid', player: 'p2', amount: 5 })).toThrow(/at least 10/);
    g.do({ type: 'bid', player: 'p2', amount: 10 });
    expect(() => g.do({ type: 'bid', player: 'p1', amount: 15 })).toThrow(/at least 20/);
    expect(() => g.do({ type: 'bid', player: 'p2', amount: 30 })).toThrow(/cash/);
    g.do({ type: 'bid', player: 'p1', amount: 20 });
    g.do({ type: 'closeAuction' });
    expect(g.owner('P02')).toBe('p1');
    expect(g.cash('p1')).toBe(1480);
  });

  it('no bids: stays with the bank', () => {
    const g = two();
    g.roll('p1', 1, 2);
    g.do({ type: 'declineBuy', player: 'p1' });
    g.do({ type: 'closeAuction' });
    expect(g.owner('P02')).toBeNull();
    expect(g.s.turn.phase).toBe('end');
  });
});

describe('rent', () => {
  const landOn = (g: G, pos: number) => g.setCurrent('p1').at('p1', pos - 3).roll('p1', 1, 2);

  it('base, ×2 full group (even with one mortgaged), houses, hotel', () => {
    const g = two().give('p2', ['P04']);
    landOn(g, 8);
    expect(g.cash('p1')).toBe(1494);

    const h = two().give('p2', ['P03', 'P04']).give('p2', ['P05'], { mortgaged: true });
    landOn(h, 8);
    expect(h.cash('p1')).toBe(1488);

    const k = two().give('p2', ['P03', 'P04', 'P05'], { level: 3 });
    landOn(k, 8);
    expect(k.cash('p1')).toBe(1500 - 270);

    const m = two().give('p2', ['P03', 'P04', 'P05'], { level: 5 });
    landOn(m, 8);
    expect(m.cash('p1')).toBe(1500 - 550);
  });

  it('mortgaged: no rent; owner in jail still collects', () => {
    const g = two().give('p2', ['P04'], { mortgaged: true });
    landOn(g, 8);
    expect(g.cash('p1')).toBe(1500);
    const h = two().give('p2', ['P04']);
    h.p('p2').inJail = true;
    landOn(h, 8);
    expect(h.cash('p2')).toBe(1506);
  });

  it('transports: 25 / 50 / 100 / 200 by count', () => {
    const g = two().give('p2', ['T01', 'T02', 'T03']);
    landOn(g, 15);
    expect(g.cash('p1')).toBe(1400);
  });

  it('utilities: 4 × dice with one, 10 × with both', () => {
    const g = two().give('p2', ['U01']);
    landOn(g, 12); // dice 1+2
    expect(g.cash('p1')).toBe(1488);
    const h = two().give('p2', ['U01', 'U02']);
    landOn(h, 12);
    expect(h.cash('p1')).toBe(1470);
  });

  it('cash short → liquidation, then pay', () => {
    const g = two().give('p2', ['P22'], { level: 1 }).give('p1', ['T01']).setCash('p1', 150);
    landOn(g, 39);
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p1' });
    expect(() => g.do({ type: 'payDebt', player: 'p1' })).toThrow(/not enough/);
    g.do({ type: 'mortgage', player: 'p1', propertyId: 'T01' });
    g.do({ type: 'payDebt', player: 'p1' });
    expect(g.cash('p1')).toBe(50);
    expect(g.cash('p2')).toBe(1700);
  });
});

describe('building', () => {
  it('needs the full group and own turn; builds evenly', () => {
    const g = two().give('p1', ['P01']);
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow(/full colour group/);
    g.give('p1', ['P02']);
    expect(() => g.do({ type: 'build', player: 'p2', propertyId: 'P01' })).toThrow(/own turn/);
    g.do({ type: 'build', player: 'p1', propertyId: 'P01' });
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow(/evenly/);
    g.do({ type: 'build', player: 'p1', propertyId: 'P02' });
    expect(g.cash('p1')).toBe(1400);
  });

  it('a mortgaged tile in the group blocks building', () => {
    const g = two().give('p1', ['P01']).give('p1', ['P02'], { mortgaged: true });
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow(/mortgaged/);
  });

  it('4 houses → hotel, houses go back to stock', () => {
    const g = two().give('p1', ['P01', 'P02'], { level: 4 });
    g.do({ type: 'build', player: 'p1', propertyId: 'P01' });
    expect(g.s.ownables.P01.level).toBe(5);
    expect(has(g.events, 'built', { hotel: true })).toBe(true);
  });

  it('house stock limit (32)', () => {
    const g = three().give('p1', ['P01', 'P02']);
    g.give('p3', ['P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10'], { level: 4 });
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow(/No houses/);
    const h = G.create([null, null, null], { buildingLimit: false }).give('p1', ['P01', 'P02']);
    h.give('p3', ['P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10'], { level: 4 });
    h.do({ type: 'build', player: 'p1', propertyId: 'P01' });
  });

  it('sell evenly for 50%; a hotel with no houses in stock drops to 0', () => {
    const g = two().give('p1', ['P01']).give('p1', ['P02'], { level: 1 });
    g.s.ownables.P01.level = 2;
    expect(() => g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P02' })).toThrow(/evenly/);
    g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P01' });
    expect(g.cash('p1')).toBe(1525);

    const h = three().give('p1', ['P01', 'P02'], { level: 5 });
    h.give('p3', ['P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10'], { level: 4 });
    h.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P01' });
    expect(h.s.ownables.P01.level).toBe(0);
    expect(h.cash('p1')).toBe(1500 + 5 * 25);
  });
});

describe('mortgage', () => {
  it('needs no buildings in the group; unmortgage costs +10% rounded up', () => {
    const g = two().give('p1', ['P01']).give('p1', ['P02'], { level: 1 });
    expect(() => g.do({ type: 'mortgage', player: 'p1', propertyId: 'P01' })).toThrow(/buildings/);
    g.s.ownables.P02.level = 0;
    g.do({ type: 'mortgage', player: 'p1', propertyId: 'P01' });
    expect(g.cash('p1')).toBe(1530);
    g.do({ type: 'unmortgage', player: 'p1', propertyId: 'P01' });
    expect(g.cash('p1')).toBe(1497);
  });
});

describe('trades', () => {
  it('swap properties and cash, any time', () => {
    const g = two().give('p1', ['P01']).give('p2', ['P03']);
    g.do({
      type: 'proposeTrade',
      player: 'p2',
      to: 'p1',
      offer: { properties: ['P03'] },
      request: { properties: ['P01'], cash: 50 },
    });
    const id = g.s.trades[0].id;
    g.do({ type: 'respondTrade', player: 'p1', tradeId: id, accept: true });
    expect([g.owner('P01'), g.owner('P03')]).toEqual(['p2', 'p1']);
    expect([g.cash('p1'), g.cash('p2')]).toEqual([1450, 1550]);
  });

  it('receiving a mortgaged property: pay 10% now, or unmortgage now', () => {
    const g = two().give('p1', ['P01', 'P02'], { mortgaged: true });
    g.do({ type: 'proposeTrade', player: 'p1', to: 'p2', offer: { properties: ['P01', 'P02'] }, request: {} });
    g.do({ type: 'respondTrade', player: 'p2', tradeId: g.s.trades[0].id, accept: true, unmortgage: ['P02'] });
    expect(g.s.ownables.P01).toMatchObject({ owner: 'p2', mortgaged: true });
    expect(g.s.ownables.P02).toMatchObject({ owner: 'p2', mortgaged: false });
    expect(g.cash('p2')).toBe(1500 - 3 - 33);
  });

  it('cannot trade a property whose group has buildings; reject and cancel', () => {
    const g = two().give('p1', ['P01', 'P02'], { level: 1 });
    expect(() =>
      g.do({ type: 'proposeTrade', player: 'p1', to: 'p2', offer: { properties: ['P01'] }, request: {} }),
    ).toThrow(/buildings/);
    g.do({ type: 'proposeTrade', player: 'p1', to: 'p2', offer: { cash: 10 }, request: {} });
    g.do({ type: 'respondTrade', player: 'p2', tradeId: g.s.trades[0].id, accept: false });
    expect(g.s.trades).toHaveLength(0);
    g.do({ type: 'proposeTrade', player: 'p1', to: 'p2', offer: { cash: 10 }, request: {} });
    g.do({ type: 'cancelTrade', tradeId: g.s.trades[0].id });
    expect(g.s.trades).toHaveLength(0);
  });
});

describe('bankruptcy', () => {
  it('to a player: buildings sold 50%, cash + land + cards go to the creditor, mortgages are resolved', () => {
    const g = three()
      .give('p1', ['P01', 'P02'], { level: 1 })
      .give('p1', ['P03'], { mortgaged: true })
      .give('p2', ['P22'], { level: 5 })
      .setCash('p1', 10);
    g.p('p1').jailCards = ['CH11'];
    g.setCurrent('p1').at('p1', 36).roll('p1', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.p('p1').bankrupt).toBe(true);
    // 10 + 2×25 (houses) + 2×30 (auto-mortgage P01, P02) = 120 to p2
    expect(g.cash('p2')).toBe(1620);
    expect(g.p('p2').jailCards).toEqual(['CH11']);
    expect(g.s.pending).toMatchObject({ type: 'inheritMortgage', player: 'p2' });
    g.do({ type: 'resolveMortgage', player: 'p2', unmortgage: false });
    g.do({ type: 'resolveMortgage', player: 'p2', unmortgage: true });
    g.do({ type: 'timeout' });
    expect(['P01', 'P02', 'P03'].map((id) => g.owner(id))).toEqual(['p2', 'p2', 'p2']);
    expect(g.s.turn.current).toBe(1); // play passed to p2
  });

  it('to the bank: everything returns unmortgaged and is auctioned', () => {
    const g = three().give('p1', ['P01'], { mortgaged: true }).setCash('p1', 0);
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2); // TAX1
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.s.pending).toMatchObject({ type: 'auction', propertyId: 'P01', eligible: ['p2', 'p3'] });
    expect(g.s.ownables.P01.mortgaged).toBe(false);
    g.do({ type: 'bid', player: 'p3', amount: 10 });
    g.do({ type: 'closeAuction' });
    expect(g.owner('P01')).toBe('p3');
  });

  it('classic: last player standing wins', () => {
    const g = two().give('p2', ['P22'], { level: 5 }).setCash('p1', 0);
    g.setCurrent('p1').at('p1', 36).roll('p1', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.s).toMatchObject({ status: 'over', winner: 'p2' });
    expect(() => g.do({ type: 'roll', player: 'p2' })).toThrow(/over/);
  });
});

describe('quick mode', () => {
  it('deals 2 properties per player at list price, Quỹ off by default', () => {
    const g = G.create([null, null, null], { mode: 'quick' });
    expect(g.s.config.scholarshipFund).toBe(false);
    for (const p of g.s.players) {
      const owned = Object.keys(g.s.ownables).filter((id) => g.s.ownables[id].owner === p.id);
      expect(owned).toHaveLength(2);
      const paid = owned.reduce((a, id) => a + D.ownables[id].price, 0);
      expect(p.cash).toBe(1500 - paid);
    }
  });

  it('Nghiện Tarot is never dealt a forbidden tile', () => {
    for (let seed = 1; seed < 30; seed++) {
      const g = G.create(['C06', null, null, null, null, null], { mode: 'quick' }, seed);
      for (const id of ['P08', 'P14', 'P20']) expect(g.owner(id)).not.toBe('p1');
    }
  });

  it('hotel after 3 houses', () => {
    const g = G.create([null, null], { mode: 'quick' });
    for (const id of Object.keys(g.s.ownables)) g.s.ownables[id].owner = null;
    g.give('p1', ['P01', 'P02'], { level: 3 });
    g.do({ type: 'build', player: 'p1', propertyId: 'P01' });
    expect(has(g.events, 'built', { hotel: true, level: 4 })).toBe(true);
  });

  it('ends at the 2nd bankruptcy and ranks by net worth', () => {
    const g = G.create([null, null, null, null], { mode: 'quick' });
    for (const id of Object.keys(g.s.ownables)) g.s.ownables[id] = { owner: null, mortgaged: false, level: 0 };
    g.give('p3', ['P21', 'P22'], { level: 4 }).give('p4', ['P01'], { mortgaged: true });
    g.setCash('p1', 0).setCash('p2', 0).setCash('p3', 100).setCash('p4', 100);
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.s.status).toBe('playing');
    g.setCurrent('p2').at('p2', 1).roll('p2', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p2' });
    expect(g.s.status).toBe('over');
    // p3: 100 + 350 + 400 + hotel 4×200 + 4×200 ; p4: 100 + 30
    expect(g.s.ranking).toEqual([
      { player: 'p3', score: 100 + 750 + 1600 },
      { player: 'p4', score: 130 },
      { player: 'p2', score: 0 },
      { player: 'p1', score: 0 },
    ]);
    expect(g.s.winner).toBe('p3');
  });

  it('endGame (time limit) finishes with a ranking', () => {
    const g = G.create([null, null], { mode: 'quick' });
    g.do({ type: 'endGame' });
    expect(g.s.status).toBe('over');
    expect(g.s.ranking).toHaveLength(2);
  });
});

describe('timeouts', () => {
  it('roll → auto roll; buy → auction; auction → close; end → next turn', () => {
    const g = two();
    g.rig(1, 2).do({ type: 'timeout' });
    expect(g.s.pending?.type).toBe('buy');
    g.do({ type: 'timeout' });
    expect(g.s.pending?.type).toBe('auction');
    g.do({ type: 'timeout' });
    expect(g.s.turn.phase).toBe('end');
    g.do({ type: 'timeout' });
    expect(g.s.turn.current).toBe(1);
  });

  it('liquidation → auto-sell buildings then mortgage, cheapest first', () => {
    const g = two()
      .give('p1', ['P01', 'P02'], { level: 1 })
      .give('p1', ['P22'])
      .give('p2', ['P21'])
      .setCash('p1', 0);
    g.setCurrent('p1').at('p1', 34).roll('p1', 1, 2); // P21 rent 35
    g.do({ type: 'timeout' });
    // sells P01/P02 houses (+50) → pays 35 → 15 left, no mortgage needed
    expect(g.cash('p1')).toBe(15);
    expect(g.s.ownables.P22.mortgaged).toBe(false);
  });
});

describe('face-down cards and the pay button', () => {
  it('a drawn card waits face down until the drawer flips it', () => {
    const g = G.create([null, null]);
    g.auto = false;
    g.setCurrent('p1').at('p1', 4).top('CH12');
    g.rig(1, 2).do({ type: 'roll', player: 'p1' });
    expect(g.s.pending).toMatchObject({ type: 'revealCard', player: 'p1', deck: 'chance', cardId: 'CH12' });
    expect(g.cash('p1')).toBe(1500);
    expect(() => g.do({ type: 'revealCard', player: 'p2' })).toThrow();
    g.do({ type: 'revealCard', player: 'p1' });
    expect(g.cash('p1')).toBe(1650);
  });

  it('rent waits for "Trả tiền"; timeout pays it', () => {
    const g = G.create([null, null]).give('p2', ['P02']);
    g.auto = false;
    g.setCurrent('p1').rig(1, 2).do({ type: 'roll', player: 'p1' });
    expect(g.s.pending).toMatchObject({ type: 'payRent', player: 'p1', propertyId: 'P02', discount: false });
    expect(g.cash('p1')).toBe(1500);
    g.do({ type: 'payRent', player: 'p1' });
    expect(g.cash('p1')).toBe(1496);

    const h = G.create([null, null]).give('p2', ['P02']);
    h.auto = false;
    h.setCurrent('p1').rig(1, 2).do({ type: 'roll', player: 'p1' });
    h.do({ type: 'timeout' });
    expect(h.cash('p2')).toBe(1504);
  });

  it('whyCantBuild explains blocked builds', async () => {
    const { whyCantBuild } = await import('../src');
    const g = G.create([null, null]).give('p1', ['P01']);
    expect(whyCantBuild(g.s, 'p1', 'P01')).toBe('needFullGroup');
    g.give('p1', ['P02']);
    expect(whyCantBuild(g.s, 'p1', 'P01')).toBeNull();
    g.s.ownables.P02.level = 1;
    expect(whyCantBuild(g.s, 'p1', 'P02')).toBe('buildEvenly');
    expect(whyCantBuild(g.s, 'p2', 'P01')).toBe('notYourTurn');
  });
});
