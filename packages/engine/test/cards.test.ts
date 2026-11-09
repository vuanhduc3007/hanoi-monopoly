import { describe, expect, it } from 'vitest';
import { EFFECT_TYPES, perPlayer, type Effect } from '../src';
import { D, G, has } from './helpers';

const plain = () => G.create([null, null, null]);

describe('card data coverage', () => {
  it('every effect.type in cards.json has a handler', () => {
    const types = new Set<string>();
    const walk = (e: Effect) => {
      types.add(e.type);
      if (e.type === 'composite') (e.effects as Effect[]).forEach(walk);
      if (e.fallback) walk(e.fallback);
    };
    Object.values(D.cards).forEach((c) => walk(c.effect));
    for (const t of types) expect(EFFECT_TYPES).toContain(t);
  });

  it('deck sizes match the GDD (17 / 16 / 32)', () => {
    const g = plain();
    expect(g.s.decks.chance).toHaveLength(17);
    expect(g.s.decks.community).toHaveLength(16);
    expect(g.s.decks.event).toHaveLength(32);
  });

  it('every card resolves without error and non-kept cards return to the bottom', () => {
    for (const id of Object.keys(D.cards)) {
      const g = G.create(['C01', 'C02', 'C03', 'C04']);
      g.draw('p1', id);
      const deck = g.s.decks[D.cards[id].deck];
      if (D.cards[id].keep) expect(deck).not.toContain(id);
      else expect(deck).toContain(id);
    }
  });
});

describe('Cơ hội / Cộng đồng effects', () => {
  it('move_to: CH01 goes to Hồ Gươm and offers to buy', () => {
    const g = plain();
    g.draw('p1', 'CH01');
    expect(g.p('p1').position).toBe(39);
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'P22', price: 400 });
  });

  it('move_to: CH02 to GO pays salary once', () => {
    const g = plain();
    g.draw('p1', 'CH02');
    expect(g.p('p1').position).toBe(0);
    expect(g.cash('p1')).toBe(1700);
  });

  it('move_to: CH17 lands on Văn Miếu and collects the Quỹ; salary when wrapping past GO', () => {
    const g = plain();
    g.s.fund = 120;
    g.draw('p1', 'CH17'); // from 7 → 20, no GO
    expect(g.cash('p1')).toBe(1620);
    expect(g.s.fund).toBe(0);

    const h = plain();
    h.s.fund = 80;
    h.setCurrent('p1').at('p1', 19).top('CH17');
    h.roll('p1', 1, 2); // 22 = Cơ hội → 20 passes GO
    expect(h.cash('p1')).toBe(1500 + 200 + 80);
  });

  it('move_to_nearest transport: owned → rent ×2', () => {
    const g = plain().give('p2', ['T02', 'T03']);
    g.draw('p1', 'CH06');
    expect(g.p('p1').position).toBe(15);
    expect(g.cash('p1')).toBe(1500 - 100);
    expect(g.cash('p2')).toBe(1600);
  });

  it('move_to_nearest transport: unowned → may buy', () => {
    const g = plain();
    g.draw('p1', 'CH07');
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'T02' });
  });

  it('move_to_nearest utility: owned → roll fresh dice, pay 10 × total', () => {
    const g = plain().give('p2', ['U01']);
    g.draw('p1', 'CH08', [3, 4]);
    expect(g.p('p1').position).toBe(12);
    expect(g.cash('p1')).toBe(1500 - 70);
  });

  it('move_relative: CH09 back 3 to the tax tile, no salary', () => {
    const g = plain();
    g.draw('p1', 'CH09');
    expect(g.p('p1').position).toBe(4);
    expect(g.cash('p1')).toBe(1300);
    expect(g.s.fund).toBe(200);
  });

  it('go_to_jail: CH10 and CD16 jail without salary', () => {
    for (const card of ['CH10', 'CD16']) {
      const g = plain();
      g.draw('p1', card);
      expect(g.p('p1')).toMatchObject({ position: 10, inJail: true, cash: 1500 });
      expect(g.s.turn.phase).toBe('end');
    }
  });

  it('jail_free_card: CH11 is kept, out of the deck', () => {
    const g = plain();
    g.draw('p1', 'CH11');
    expect(g.p('p1').jailCards).toEqual(['CH11']);
    expect(g.s.decks.chance).not.toContain('CH11');
    expect(g.s.decks.chance).toHaveLength(16);
  });

  it('gain: CH12 +150, CD01 +200', () => {
    const g = plain();
    g.draw('p1', 'CH12');
    expect(g.cash('p1')).toBe(1650);
    const h = plain();
    h.draw('p1', 'CD01');
    expect(h.cash('p1')).toBe(1700);
  });

  it('pay_bank: CH14 goes into the Quỹ (or the bank when the Quỹ is off)', () => {
    const g = plain();
    g.draw('p1', 'CH14');
    expect(g.cash('p1')).toBe(1485);
    expect(g.s.fund).toBe(15);

    const h = G.create([null, null], { scholarshipFund: false });
    h.draw('p1', 'CH14');
    expect(h.cash('p1')).toBe(1485);
    expect(h.s.fund).toBe(0);
  });

  it('repairs: CH15 25/house 100/hotel, CD14 40/115', () => {
    const g = plain().give('p1', ['P01', 'P02'], { level: 2 }).give('p1', ['P03', 'P04', 'P05'], { level: 5 });
    g.draw('p1', 'CH15');
    expect(g.cash('p1')).toBe(1500 - (4 * 25 + 3 * 100));

    const h = plain().give('p1', ['P01', 'P02'], { level: 2 }).give('p1', ['P03', 'P04', 'P05'], { level: 5 });
    h.draw('p1', 'CD14');
    expect(h.cash('p1')).toBe(1500 - (4 * 40 + 3 * 115));
  });

  it('pay_each_player: CH16 splits its total among the other players (rounded up to tens)', () => {
    const g = plain();
    g.draw('p1', 'CH16');
    const each = perPlayer(D.cards.CH16.effect, 2);
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1500 - 2 * each, 1500 + each, 1500 + each]);
  });

  it('perPlayer: a total keeps the card the same size at any table; a plain amount is per player', () => {
    expect([1, 2, 3, 5, 7].map((n) => perPlayer({ type: 'x', total: 150 }, n))).toEqual([150, 80, 50, 30, 30]);
    expect(perPlayer({ type: 'x', amount: 50 }, 7)).toBe(50);
  });

  it('collect_from_each: CD10 collects its total split among the other players', () => {
    const g = plain();
    g.draw('p1', 'CD10');
    const each = perPlayer(D.cards.CD10.effect, 2);
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1500 + 2 * each, 1500 - each, 1500 - each]);
  });
});

describe('Hanoi Event ⚡ effects', () => {
  it('bank_pays_all: EV01 +50 each', () => {
    const g = plain();
    g.draw('p1', 'EV01');
    expect(g.s.players.map((p) => p.cash)).toEqual([1550, 1550, 1550]);
  });

  it('repairs_all: EV03 15/house 50/hotel for every owner; EV25 hotels only', () => {
    const g = plain().give('p2', ['P01', 'P02'], { level: 1 }).give('p3', ['P03'], { level: 5 });
    g.draw('p1', 'EV03');
    expect(g.cash('p2')).toBe(1500 - 30);
    expect(g.cash('p3')).toBe(1500 - 50);
    expect(g.s.fund).toBe(80);

    const h = plain().give('p2', ['P01', 'P02'], { level: 1 }).give('p3', ['P03'], { level: 5 });
    h.draw('p1', 'EV25');
    expect(h.cash('p2')).toBe(1500);
    expect(h.cash('p3')).toBe(1450);
  });

  it('bank_pays_owners: EV04 50 per owned tile; unowned pays nobody; EV28 unowned', () => {
    const g = plain().give('p2', ['P21', 'P22']);
    g.draw('p1', 'EV04');
    expect(g.cash('p2')).toBe(1600);

    const h = plain().give('p2', ['P21']);
    h.draw('p1', 'EV09'); // no transports owned
    expect(h.s.players.map((p) => p.cash)).toEqual([1500, 1500, 1500]);

    const k = plain();
    k.draw('p1', 'EV28');
    expect(k.s.players.map((p) => p.cash)).toEqual([1500, 1500, 1500]);
    expect(k.s.fund).toBe(0);
  });

  it('bank_pays_owners counts mortgaged tiles', () => {
    const g = plain().give('p2', ['T01', 'T02'], { mortgaged: true });
    g.draw('p1', 'EV09');
    expect(g.cash('p2')).toBe(1600);
  });

  it('all_pay_owner: EV07 everyone pays the Phố cổ owner, owner skips self', () => {
    const g = plain().give('p1', ['P21']);
    g.draw('p1', 'EV07');
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1520, 1490, 1490]);
  });

  it('all_pay_owner: unowned → payments go to the Quỹ', () => {
    const g = plain();
    g.draw('p1', 'EV20');
    expect(g.s.players.map((p) => p.cash)).toEqual([1480, 1480, 1480]);
    expect(g.s.fund).toBe(60);
  });

  it('pay_percent_cash: EV10 10% rounded down to tens', () => {
    const g = plain().setCash('p2', 1234).setCash('p3', 95);
    g.draw('p1', 'EV10');
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1350, 1114, 95]);
    expect(g.s.fund).toBe(270);
  });

  it('owners_pay_bank: EV13 orange owners 20 per tile; EV17 red', () => {
    const g = plain().give('p2', ['P09', 'P10']).give('p3', ['P12']);
    g.draw('p1', 'EV13');
    expect(g.cash('p2')).toBe(1460);
    expect(g.cash('p3')).toBe(1500);
    const h = plain().give('p3', ['P12', 'P13', 'P14']);
    h.draw('p1', 'EV17');
    expect(h.cash('p3')).toBe(1440);
  });

  it('each_roll_one_die: EV19 a 1 sends that player to jail', () => {
    const g = plain();
    g.draw('p1', 'EV19', [1, 2, 1]); // p1, p2, p3 faces
    expect(g.p('p1').inJail).toBe(true);
    expect(g.p('p2').inJail).toBe(false);
    expect(g.p('p3')).toMatchObject({ inJail: true, position: 10 });
  });

  it('each_roll_one_die: EV26 a 6 pays 50 into the Quỹ', () => {
    const g = plain();
    g.draw('p1', 'EV26', [6, 3, 6]);
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1450, 1500, 1450]);
    expect(g.s.fund).toBe(100);
  });

  it('richest_cash_gain: EV22 richest +100, ties split rounded down', () => {
    const g = plain().setCash('p2', 2000);
    g.draw('p1', 'EV22');
    expect(g.cash('p2')).toBe(2100);
    const h = plain().setCash('p3', 1000);
    h.draw('p1', 'EV22');
    expect([h.cash('p1'), h.cash('p2'), h.cash('p3')]).toEqual([1550, 1550, 1000]);
    const k = G.create([null, null, null, null]).setCash('p4', 0);
    k.draw('p1', 'EV22');
    expect(k.cash('p1')).toBe(1533);
  });

  it('composite: EV23 all +30, Hồ Gươm owner +50 more', () => {
    const g = plain().give('p2', ['P22']);
    g.draw('p1', 'EV23');
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1530, 1580, 1530]);
  });

  it('bank_to_fund (in composite EV24): +30 owners of P21/P20, +30 into the Quỹ', () => {
    const g = plain().give('p2', ['P21', 'P20']);
    g.draw('p1', 'EV24');
    expect(g.cash('p2')).toBe(1560);
    expect(g.s.fund).toBe(30);
    const h = G.create([null, null], { scholarshipFund: false });
    h.draw('p1', 'EV24');
    expect(h.s.fund).toBe(0);
  });

  it('all_pay_character: EV27 everyone pays Tài xế Grab 20', () => {
    const g = G.create([null, 'C03', null]);
    g.draw('p1', 'EV27');
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1480, 1540, 1480]);
  });

  it('all_pay_character fallback → all_pay: EV27 without Grab, everyone pays 20 into the Quỹ', () => {
    const g = plain();
    g.draw('p1', 'EV27');
    expect(g.s.players.map((p) => p.cash)).toEqual([1480, 1480, 1480]);
    expect(g.s.fund).toBe(60);
  });

  it('all_pay_character: EV31 pays Idol TikTok; fallback drawer_gain +50', () => {
    const g = G.create([null, 'C04', null]);
    g.draw('p1', 'EV31');
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1480, 1540, 1480]);
    const h = plain();
    h.draw('p1', 'EV31');
    expect([h.cash('p1'), h.cash('p2')]).toEqual([1550, 1500]);
  });

  it('all_pay: EV32 30 each into the Quỹ, Nô lệ tư bản 50', () => {
    const g = G.create([null, 'C08', null]);
    g.draw('p1', 'EV32');
    expect([g.cash('p1'), g.cash('p2'), g.cash('p3')]).toEqual([1470, (D.characters.C08.passives[0].value as number) - 50, 1470]);
    expect(g.s.fund).toBe(110);
  });

  it('a card payment the player cannot afford opens liquidation, then continues', () => {
    const h = plain().setCash('p2', 5).give('p2', ['P01']);
    h.draw('p1', 'CD10');
    expect(h.s.pending).toMatchObject({ type: 'liquidation', player: 'p2' });
    h.do({ type: 'mortgage', player: 'p2', propertyId: 'P01' });
    h.do({ type: 'payDebt', player: 'p2' });
    const each = perPlayer(D.cards.CD10.effect, 2);
    expect(h.cash('p2')).toBe(5 + D.ownables.P01.mortgage - each);
    expect(h.cash('p1')).toBe(1500 + 2 * each); // p3 then paid too
  });
});

describe('Hanoi Event ⏳ effects', () => {
  it('rent_multiplier: EV02 +50% on listed tiles until the drawer’s next turn', () => {
    const g = plain().give('p1', ['P22']);
    g.draw('p1', 'EV02');
    expect(g.s.activeEffects).toHaveLength(1);
    g.do({ type: 'endTurn', player: 'p1' });
    g.at('p2', 36).roll('p2', 1, 2); // → 39
    expect(g.cash('p2')).toBe(1500 - 75);
  });

  it('rent_multiplier expires at the drawer’s next turn start', () => {
    const g = G.create([null, null]).give('p1', ['P22']);
    g.draw('p1', 'EV02');
    g.do({ type: 'endTurn', player: 'p1' });
    g.at('p2', 7).roll('p2', 1, 2); // → 10, just visiting
    expect(g.s.activeEffects).toHaveLength(1);
    g.do({ type: 'endTurn', player: 'p2' });
    expect(g.s.activeEffects).toHaveLength(0);
    expect(has(g.events, 'effectExpired')).toBe(true);
  });

  it('rent_multiplier by group (EV08 ×2) multiplies house rent too', () => {
    const g = plain().give('p1', ['P01', 'P02'], { level: 1 });
    g.draw('p1', 'EV08');
    g.do({ type: 'endTurn', player: 'p1' });
    g.at('p2', 38).roll('p2', 1, 2); // → 1 (passes GO)
    expect(g.cash('p2')).toBe(1500 + 200 - 20);
  });

  it('single_die: EV05 others roll one die; jail attempts still use two', () => {
    const g = plain();
    g.draw('p1', 'EV05');
    g.do({ type: 'endTurn', player: 'p1' });
    const ev = g.roll('p2', 4);
    const rolled = ev.find((e) => e.type === 'diceRolled')!;
    expect(rolled.dice).toEqual([4]);
    expect(g.p('p2').position).toBe(4);
    expect(g.s.turn.phase).toBe('end');
    g.do({ type: 'endTurn', player: 'p2' });
    g.p('p3').inJail = true;
    g.p('p3').position = 10;
    const ev3 = g.roll('p3', 2, 3);
    expect(ev3.find((e) => e.type === 'diceRolled')!.dice).toEqual([2, 3]);
  });

  it('unmortgage_interest: EV14 0%, EV29 20%, latest wins', () => {
    const g = plain().give('p1', ['P01'], { mortgaged: true });
    g.draw('p1', 'EV14');
    g.do({ type: 'unmortgage', player: 'p1', propertyId: 'P01' });
    expect(g.cash('p1')).toBe(1470);

    const h = plain().give('p1', ['P01'], { mortgaged: true });
    h.draw('p1', 'EV14');
    h.s.decks.event.unshift('EV29');
    h.s.turn.phase = 'roll';
    h.at('p1', 33).roll('p1', 1, 2); // 36 = Event
    h.do({ type: 'unmortgage', player: 'p1', propertyId: 'P01' });
    expect(h.cash('p1')).toBe(1500 - 36);
  });

  it('build_freeze: EV15 blocks new building, not selling', () => {
    const g = plain().give('p1', ['P01', 'P02']).give('p1', ['P03', 'P04', 'P05'], { level: 1 });
    g.draw('p1', 'EV15');
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow(/frozen/);
    g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P03' });
    expect(g.s.ownables.P03.level).toBe(0);
  });

  it('landing_fee: EV18 extra 20 into the Quỹ on P21/P22/P19', () => {
    const g = plain();
    g.draw('p1', 'EV18');
    g.do({ type: 'endTurn', player: 'p1' });
    g.at('p2', 29).roll('p2', 1, 2); // → 32 Ba Đình
    expect(g.cash('p2')).toBe(1480);
    expect(g.s.fund).toBe(20);
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'P19' });
  });
});
