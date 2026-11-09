import { describe, expect, it } from 'vitest';
import { applyAction, botAction, contributionShares, createGame, sicboStake, type GameState } from '../src';
import { D, G, has } from './helpers';

// Numbers come from characters.json so balancing never breaks these tests.
const CH = D.characters;
const num = (v: unknown) => v as number;
const pos = (ref: string) => D.board.findIndex((t) => t.ref === ref);
const gambleRule = CH.C09.passives[0];
const up = (x: number) => Math.ceil(x - 1e-9);
const start09 = () => num(CH.C09.drawbacks[0].value);

describe('C09 Con bạc', () => {
  it('starting_cash drawback', () => {
    expect(G.create(['C09', null]).cash('p1')).toBe(start09());
  });

  it('gamble_payment on a purchase: Tài wins → pays less', () => {
    const g = G.create(['C09', null]);
    g.setCurrent('p1').at('p1', 0).roll('p1', 1, 2); // → P02
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'P02' });
    g.rig(4, 4, 5); // 13 = Tài
    const ev = g.do({ type: 'buy', player: 'p1', gamble: 'tai' });
    const price = up(D.ownables.P02.price * (1 - num(gambleRule.winRate)));
    expect(has(ev, 'sicbo', { outcome: 'win', result: 'tai', to: price })).toBe(true);
    expect(g.cash('p1')).toBe(start09() - price);
    expect(g.owner('P02')).toBe('p1');
  });

  it('a lost bet costs more; bão (three of a kind) is a jackpot', () => {
    const lose = G.create(['C09', null]);
    lose.setCurrent('p1').at('p1', 0).roll('p1', 1, 2);
    lose.rig(1, 2, 3); // 6 = Xỉu
    lose.do({ type: 'buy', player: 'p1', gamble: 'tai' });
    expect(lose.cash('p1')).toBe(start09() - up(D.ownables.P02.price * (1 + num(gambleRule.loseRate))));
    const bao = G.create(['C09', null]);
    bao.setCurrent('p1').at('p1', 0).roll('p1', 1, 2);
    bao.rig(5, 5, 5);
    const ev = bao.do({ type: 'buy', player: 'p1', gamble: 'tai' });
    expect(has(ev, 'sicbo', { result: 'bao', outcome: 'jackpot' })).toBe(true);
    expect(bao.cash('p1')).toBe(start09() - up(D.ownables.P02.price * (1 - num(gambleRule.jackpotRate))));
  });

  it('cannot bet on a purchase when a lost bet is unaffordable, or without the trait', () => {
    const g = G.create(['C09', null]);
    g.setCurrent('p1').at('p1', 0).roll('p1', 1, 2);
    g.setCash('p1', D.ownables.P02.price + 1);
    expect(() => g.do({ type: 'buy', player: 'p1', gamble: 'tai' })).toThrow(/lost bet/);
    const h = G.create([null, null]);
    h.setCurrent('p1').at('p1', 0).roll('p1', 1, 2);
    expect(() => h.do({ type: 'buy', player: 'p1', gamble: 'xiu' })).toThrow(/gamble/);
  });

  it('taxes ask first: a winning bet pays less into the Quỹ, declining pays in full', () => {
    const g = G.create(['C09', null]);
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2); // → TAX1
    expect(g.s.pending).toMatchObject({ type: 'gamble', player: 'p1', task: { amount: D.economy.taxes.TAX1 } });
    g.rig(1, 1, 2); // 4 = Xỉu
    g.do({ type: 'gamble', player: 'p1', pick: 'xiu' });
    const paid = up(D.economy.taxes.TAX1 * (1 - num(gambleRule.winRate)));
    expect(g.cash('p1')).toBe(start09() - paid);
    expect(g.s.fund).toBe(paid);
    const h = G.create(['C09', null]);
    h.setCurrent('p1').at('p1', 1).roll('p1', 1, 2);
    h.do({ type: 'gamble', player: 'p1', pick: null });
    expect(h.cash('p1')).toBe(start09() - D.economy.taxes.TAX1);
  });

  it('the server timeout on the prompt pays the normal amount; rent never asks', () => {
    const g = G.create(['C09', null]);
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2);
    g.do({ type: 'timeout' });
    expect(g.s.pending).toBeNull();
    expect(g.s.fund).toBe(D.economy.taxes.TAX1);
    const r = G.create(['C09', null]).give('p2', ['P21', 'P22']);
    r.auto = false;
    r.setCurrent('p1').at('p1', 36).roll('p1', 1, 2);
    expect(r.s.pending?.type).toBe('payRent');
    r.do({ type: 'payRent', player: 'p1' });
    expect(r.s.pending).toBeNull();
  });

  it('host_sicbo (Mở sòng): opponents bet in turn order, losers pay the house, winners get stake minus commission', () => {
    const g = G.create(['C09', null, null]);
    const sk = CH.C09.skill;
    const stake = sicboStake(sk, 2);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    expect(g.s.pending).toMatchObject({ stake });
    expect(g.s.pending).toMatchObject({ type: 'sicboBet', player: 'p2', host: 'p1' });
    expect(() => g.do({ type: 'placeBet', player: 'p3', pick: 'tai' })).toThrow(/Not your bet/);
    g.do({ type: 'placeBet', player: 'p2', pick: 'tai' });
    expect(g.s.pending).toMatchObject({ type: 'sicboBet', player: 'p3' });
    g.rig(6, 5, 1); // 12 = Tài
    const ev = g.do({ type: 'placeBet', player: 'p3', pick: 'xiu' });
    const payout = stake - up(stake * num(sk.commission));
    expect(has(ev, 'sicboRolled', { result: 'tai' })).toBe(true);
    expect(g.cash('p2')).toBe(1500 + payout);
    expect(g.cash('p3')).toBe(1500 - stake);
    expect(g.cash('p1')).toBe(start09() + stake - payout);
    expect(g.p('p1').skillUsed).toBe(true);
  });

  it('bão: the house takes every bet; a timed-out bet is placed at random', () => {
    const g = G.create(['C09', null, null]);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    g.do({ type: 'timeout' });
    expect(g.s.pending).toMatchObject({ type: 'sicboBet', player: 'p3' });
    g.rig(3, 3, 3);
    g.do({ type: 'placeBet', player: 'p3', pick: 'tai' });
    expect(g.cash('p1')).toBe(start09() + 2 * sicboStake(CH.C09.skill, 2));
  });

  it('the pot is split among the opponents (rounded up to tens) so table size does not matter', () => {
    const sk = { type: 'host_sicbo', pot: 240, roundTo: 10 };
    expect([1, 3, 5, 7].map((n) => sicboStake(sk, n))).toEqual([240, 80, 50, 40]);
    expect(sicboStake({ type: 'host_sicbo', stake: 50 }, 7)).toBe(50);
  });
});

describe('C10 Thợ xây', () => {
  it('build_discount: houses cost less', () => {
    const g = G.create(['C10', null]).give('p1', ['P01', 'P02']);
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    const start = g.cash('p1');
    g.do({ type: 'build', player: 'p1', propertyId: 'P01' });
    const cost = up(D.ownables.P01.buildCost! * (1 - num(CH.C10.passives[0].rate)));
    expect(g.cash('p1')).toBe(start - cost);
  });

  it('free_build (Tự tay xây): one house for free, following the normal build rules', () => {
    const g = G.create(['C10', null]).give('p1', ['P01', 'P02']);
    const start = g.cash('p1');
    g.setCurrent('p1');
    const ev = g.do({ type: 'useSkill', player: 'p1', propertyId: 'P01' });
    expect(has(ev, 'built', { propertyId: 'P01', free: true, cost: 0 })).toBe(true);
    expect(g.cash('p1')).toBe(start);
    expect(g.s.ownables.P01.level).toBe(1);
    expect(g.p('p1').skillUsed).toBe(true);
  });

  it('anyTile: the free house may go on a tile without the full group, but only as its first house', () => {
    expect(CH.C10.skill.anyTile).toBe(true);
    const g = G.create(['C10', null]).give('p1', ['P03']).give('p2', ['P04']);
    g.setCurrent('p1');
    g.do({ type: 'useSkill', player: 'p1', propertyId: 'P03' });
    expect(g.s.ownables.P03.level).toBe(1);
    g.p('p1').skillUsed = false;
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P03' })).toThrow(/needFullGroup/);
    g.s.turn.phase = 'end';
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P03' })).toThrow(/full colour group/);
    const q = G.create(['C10', null]).give('p1', ['P05'], { mortgaged: true });
    q.setCurrent('p1');
    expect(() => q.do({ type: 'useSkill', player: 'p1', propertyId: 'P05' })).toThrow(/groupMortgaged/);
  });

  it('starting_cash drawback', () => {
    expect(G.create(['C10', null]).cash('p1')).toBe(num(CH.C10.drawbacks[0].value));
  });
});

describe('C11 F0 chứng khoán', () => {
  it('dividend: share of unmortgaged holdings on every GO pass', () => {
    const g = G.create(['C11', null]).give('p1', ['P01', 'P02', 'T01']).give('p1', ['P03'], { mortgaged: true });
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    const held = D.ownables.P01.price + D.ownables.P02.price + D.ownables.T01.price;
    const div = up(held * num(CH.C11.passives[0].rate));
    expect(g.cash('p1')).toBe(1500 + D.economy.goSalary + div);
    expect(has(g.events, 'gain', { reason: 'dividend', amount: div })).toBe(true);
  });

  it("buy_mortgaged (Bắt đáy): takes an opponent's mortgaged tile for mortgage + premium; it stays mortgaged", () => {
    const g = G.create(['C11', null]).give('p2', ['P03'], { mortgaged: true }).give('p2', ['P04']);
    g.setCurrent('p1');
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P04' })).toThrow(/mortgaged/);
    g.do({ type: 'useSkill', player: 'p1', propertyId: 'P03' });
    const cost = up(D.ownables.P03.mortgage * (1 + num(CH.C11.skill.premium)));
    expect(g.owner('P03')).toBe('p1');
    expect(g.s.ownables.P03.mortgaged).toBe(true);
    expect(g.cash('p1')).toBe(1500 - cost);
    expect(g.cash('p2')).toBe(1500 + cost);
  });

  it('card_payment_multiplier drawback on card payments', () => {
    expect(CH.C11.drawbacks[0]).toMatchObject({ type: 'card_payment_multiplier' });
  });
});

describe('C12 Tổ trưởng dân phố', () => {
  it('tax_override: the parking fee (TAX2) is free', () => {
    const g = G.create(['C12', null]);
    g.setCurrent('p1').at('p1', pos('TAX2') - 3).roll('p1', 1, 2);
    expect(g.p('p1').position).toBe(pos('TAX2'));
    expect(g.cash('p1')).toBe(1500);
  });

  it('go_donation: gives to the Quỹ on every GO pass', () => {
    const g = G.create(['C12', null]);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    const don = num(CH.C12.drawbacks[0].amount);
    expect(g.cash('p1')).toBe(1500 + D.economy.goSalary - don);
    expect(g.s.fund).toBe(don);
  });

  it('collect_contribution (Họp tổ dân phố): every opponent pays the leader and the Quỹ', () => {
    const g = G.create(['C12', null, null]);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    const { toSelf, toFund } = contributionShares(CH.C12.skill, 2);
    expect(toSelf).toBeGreaterThan(0);
    expect(g.cash('p1')).toBe(1500 + 2 * toSelf);
    expect(g.cash('p2')).toBe(1500 - toSelf - toFund);
    expect(g.s.fund).toBe(2 * toFund);
    expect(() => g.do({ type: 'useSkill', player: 'p1' })).toThrow();
  });
});

describe('bots with the new characters', () => {
  it('finish games using every new skill, on every board', () => {
    const used = new Set<string>();
    for (const [board, n] of [['standard', 4], ['extended', 6], ['large', 8]] as const) {
      for (let seed = 1; seed <= 4; seed++) {
        const chars = ['C09', 'C10', 'C11', 'C12', 'C01', 'C02', 'C03', 'C04'].slice(0, n);
        let s: GameState = createGame({ players: chars.map((c, i) => ({ id: `p${i}`, character: c })), seed, config: { board } }).state;
        for (let k = 0; k < 30000 && s.status === 'playing' && s.turn.number <= 400; k++) {
          const r = applyAction(s, botAction(s)!);
          s = r.state;
          for (const e of r.events) if (e.type === 'skillUsed' || e.type === 'sicbo') used.add(String(e.skill ?? e.type));
        }
      }
    }
    for (const t of ['host_sicbo', 'sicbo', 'free_build', 'collect_contribution']) expect(used).toContain(t);
  });
});

describe('shared colour groups (Thợ xây builds without the full group)', () => {
  it('only your own buildings in a group block mortgaging and trading your tiles', () => {
    const g = G.create(['C10', null]).give('p1', ['P03'], { level: 1 }).give('p2', ['P04']);
    g.setCurrent('p2');
    g.s.turn.phase = 'end';
    g.do({ type: 'mortgage', player: 'p2', propertyId: 'P04' });
    expect(g.s.ownables.P04.mortgaged).toBe(true);
    g.setCurrent('p1');
    g.s.turn.phase = 'end';
    expect(() => g.do({ type: 'mortgage', player: 'p1', propertyId: 'P03' })).toThrow(/Sell all buildings/);
    g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P03' });
    expect(g.s.ownables.P03.level).toBe(0);
  });
});
