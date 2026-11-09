import { describe, expect, it } from 'vitest';
import { applyAction, botAction, perPlayer } from '../src';
import { D, G, has, withCharacter } from './helpers';

// Character numbers come from characters.json so balancing never breaks the tests.
const CH = D.characters;
const num = (v: unknown) => v as number;

describe('character data', () => {
  it('every passive/drawback/skill type in characters.json is covered by this suite', () => {
    const covered = new Set([
      'go_salary', 'purchase_discount', 'event_override', 'tax_override', 'bailout',
      'ignore_go_to_jail_tile', 'immune_events', 'landing_fee', 'rent_discount',
      'adjust_roll', 'reroll', 'rent_bonus_from_bank', 'card_payment_multiplier', 'block_rent',
      'commission_on_opponent_bank_purchase', 'no_hotels', 'rent_multiplier',
      'draw_two_choose_one', 'forbidden_properties', 'cancel_event_for_self', 'park_bonus',
      'starting_cash', 'auto_salary_upgrade', 'free_jail_exit',
      // C09–C12: test/newcharacters.test.ts
      'gamble_payment', 'host_sicbo', 'build_discount', 'free_build', 'dividend', 'buy_mortgaged',
      'go_donation', 'collect_contribution',
    ]);
    for (const ch of Object.values(D.characters)) {
      for (const t of [...ch.passives, ...ch.drawbacks, ch.skill]) expect(covered).toContain(t.type);
    }
  });

  it('characters off (Cổ điển): no passives apply', () => {
    const g = G.create(['C01', 'C08'], { characters: false });
    expect(g.cash('p2')).toBe(1500);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1700);
  });
});

describe('C01 Thiếu gia Vin', () => {
  it('go_salary (onPassGo)', () => {
    const g = G.create(['C01', null]);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1500 + num(CH.C01.passives[0].value));
  });

  it('purchase_discount on P10/P11/P13/P14 at list price only', () => {
    const g = G.create(['C01', null]);
    g.setCurrent('p1').at('p1', 15).roll('p1', 1, 2);
    const price = D.ownables.P10.price - Math.ceil(D.ownables.P10.price * num(CH.C01.passives[1].rate));
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'P10', price });
    g.do({ type: 'buy', player: 'p1' });
    expect(g.cash('p1')).toBe(1500 - price);
  });

  it('tax_override: TAX1 costs 300', () => {
    const g = G.create(['C01', null]);
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1200);
    expect(g.s.fund).toBe(300);
  });

  it('event_override: EV10 takes 20%', () => {
    const g = G.create([null, 'C01']);
    g.draw('p1', 'EV10');
    expect(g.cash('p2')).toBe(1200);
  });

  it('bailout (onBankrupt): bank covers a shortfall up to maxAmount', () => {
    const g = G.create(['C01', null]).give('p2', ['P01']).give('p2', ['P02'], { level: 5 }).setCash('p1', 100);
    g.setCurrent('p1').at('p1', 0).roll('p1', 1, 2); // → P02 hotel, rent 450
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p1' });
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.p('p1')).toMatchObject({ bankrupt: false, skillUsed: true, cash: 0 });
    expect(g.cash('p2')).toBe(1950);
  });

  it('bailout does not save a shortfall above maxAmount', () => {
    const g = G.create(['C01', null, null]).give('p2', ['P21']).give('p2', ['P22'], { level: 5 }).setCash('p1', 0);
    expect(D.ownables.P22.rent!.hotel).toBeGreaterThan(num(CH.C01.skill.maxAmount));
    g.setCurrent('p1').at('p1', 36).roll('p1', 1, 2); // → Hồ Gươm hotel
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.p('p1').bankrupt).toBe(true);
  });
});

describe('C02 Ninja Lead', () => {
  it('ignore_go_to_jail_tile: stays on 30 (onLand)', () => {
    const g = G.create(['C02', null]);
    g.setCurrent('p1').at('p1', 27).roll('p1', 1, 2);
    expect(g.p('p1')).toMatchObject({ position: 30, inJail: false });
    expect(has(g.events, 'goToJailIgnored')).toBe(true);
  });

  it('still jailed by CH10', () => {
    const g = G.create(['C02', null]);
    g.draw('p1', 'CH10');
    expect(g.p('p1').inJail).toBe(true);
  });

  it('immune_events: EV05 (keeps two dice) and EV19 (does not roll)', () => {
    const g = G.create(['C02', null]);
    g.draw('p2', 'EV05');
    g.do({ type: 'endTurn', player: 'p2' });
    const ev = g.roll('p1', 1, 2);
    expect(ev.find((e) => e.type === 'diceRolled')!.dice).toEqual([1, 2]);

    const h = G.create(['C02', null]);
    h.draw('p2', 'EV19', [1]); // only p2 rolls
    expect(h.p('p2').inJail).toBe(true);
    expect(h.p('p1').inJail).toBe(false);
  });

  it('landing_fee drawback: +30 into the Quỹ on P21/P22', () => {
    const g = G.create(['C02', null]);
    g.setCurrent('p1').at('p1', 34).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1470);
    expect(g.s.fund).toBe(30);
  });

  it('rent_discount (Ăn vạ, onPayRent): halves one rent payment after card multipliers, rounding up', () => {
    const g = G.create(['C02', null]).give('p2', ['P21', 'P22']);
    for (const id of ['EV02', 'EV06']) {
      g.s.activeEffects.push({
        uid: g.s.nextUid++,
        source: { kind: 'card', cardId: id },
        activator: 'p2',
        effect: D.cards[id].effect,
        exempt: [],
      });
    }
    g.setCurrent('p1').at('p1', 36).roll('p1', 1, 2); // → 39, 50×2×1.5×1.5 = 225
    expect(g.s.pending).toMatchObject({ type: 'payRent', discount: true, raw: 225 });
    g.do({ type: 'useSkill', player: 'p1' });
    expect(g.cash('p1')).toBe(1500 - 30 - 113);
    expect(g.cash('p2')).toBe(1613);
    expect(g.p('p1').skillUsed).toBe(true);
  });

  it('declining Ăn vạ pays in full and keeps the skill', () => {
    const g = G.create(['C02', null]).give('p2', ['P01']);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'payRent', discount: true });
    g.do({ type: 'declineSkill', player: 'p1' });
    expect(g.cash('p1')).toBe(1500 + 200 - 2);
    expect(g.p('p1').skillUsed).toBe(false);
  });
});

describe('C03 Tài xế Grab', () => {
  it('go_salary drawback: 150', () => {
    const g = G.create(['C03', null]);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1650);
  });

  it('adjust_roll: ±1 once per lap, resets when passing GO, keeps doubles', () => {
    const g = G.create(['C03', null]);
    g.setCurrent('p1').rig(3, 3).do({ type: 'roll', player: 'p1' });
    expect(g.s.pending?.type).toBe('postRoll');
    g.do({ type: 'adjustStep', player: 'p1', delta: 1 });
    expect(g.p('p1').position).toBe(7);
    expect(g.s.turn.phase).toBe('roll'); // still doubles
    g.rig(1, 2).do({ type: 'roll', player: 'p1' });
    expect(() => g.do({ type: 'adjustStep', player: 'p1', delta: -1 })).toThrow(/not available/);
    g.do({ type: 'confirmRoll', player: 'p1' });
    expect(g.p('p1').position).toBe(10);

    g.p('p1').position = 38;
    g.s.turn.phase = 'roll';
    g.rig(1, 2).do({ type: 'roll', player: 'p1' });
    g.do({ type: 'confirmRoll', player: 'p1' });
    expect(g.p('p1').lapAdjustUsed).toBe(false);
  });

  it('adjust_roll maxUses: limited adjustments per game', () => {
    const g = G.create(['C03', null]);
    const max = num(CH.C03.passives[0].maxUses);
    g.p('p1').adjustUses = max - 1;
    g.setCurrent('p1').rig(1, 2).do({ type: 'roll', player: 'p1' });
    g.do({ type: 'adjustStep', player: 'p1', delta: 1 });
    expect(g.p('p1').adjustUses).toBe(max);
    g.p('p1').lapAdjustUsed = false; // new lap
    g.s.pending = null;
    g.s.queue = [];
    g.s.turn.phase = 'roll';
    g.rig(1, 2).do({ type: 'roll', player: 'p1' });
    expect(() => g.do({ type: 'adjustStep', player: 'p1', delta: 1 })).toThrow(/not available/);
  });

  it('adjust_roll optional directions / cost fields', () => {
    const g = G.create(['C03', null]);
    const def = JSON.parse(JSON.stringify(D.characters.C03));
    def.passives[0] = { ...def.passives[0], directions: [1], cost: 20 };
    const data = { ...D, characters: { ...D.characters, C03: def } };
    let s = applyAction(g.s, { type: 'roll', player: 'p1' }, data).state;
    s.pending = { type: 'postRoll', player: 'p1', dice: [1, 2], context: 'normal' };
    expect(() => applyAction(s, { type: 'adjustStep', player: 'p1', delta: -1 }, data)).toThrow(/one of 1/);
    s = applyAction(s, { type: 'adjustStep', player: 'p1', delta: 1 }, data).state;
    expect(s.players[0]).toMatchObject({ position: 4, cash: 1500 - 20 - 200 });
    expect(s.fund).toBe(220);
  });

  it('reroll (Chạy cuốc đêm): new dice replace the old ones', () => {
    const g = G.create(['C03', null]);
    g.setCurrent('p1').rig(1, 2, 5, 6).do({ type: 'roll', player: 'p1' });
    g.do({ type: 'useSkill', player: 'p1' });
    expect(g.s.pending).toMatchObject({ type: 'postRoll', dice: [5, 6] });
    g.do({ type: 'confirmRoll', player: 'p1' });
    expect(g.p('p1')).toMatchObject({ position: 11, skillUsed: true });
  });

  it('immune_events: EV18 landing fee', () => {
    const g = G.create([null, 'C03']);
    g.draw('p1', 'EV18');
    g.do({ type: 'endTurn', player: 'p1' });
    g.at('p2', 29).roll('p2', 1, 2);
    expect(g.cash('p2')).toBe(1500);
  });
});

describe('C04 Idol TikTok', () => {
  it('rent_bonus_from_bank (onRentPaid): +10% of rent, minimum 10', () => {
    const g = G.create([null, 'C04']).give('p2', ['P01']);
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p2')).toBe(1500 + 2 + 10);

    const h = G.create([null, 'C04']).give('p2', ['P01']).give('p2', ['P02'], { level: 5 });
    h.setCurrent('p1').at('p1', 0).roll('p1', 1, 2);
    expect(h.cash('p2')).toBe(1500 + 450 + 45);
  });

  it('card_payment_multiplier ×1.5 on card payments', () => {
    const g = G.create(['C04', null, null]);
    g.draw('p1', 'CH14');
    expect(g.cash('p1')).toBe(1500 - 23);

    const h = G.create(['C04', null, null]);
    h.draw('p1', 'CH16');
    const each = Math.ceil(perPlayer(D.cards.CH16.effect, 2) * num(CH.C04.drawbacks[0].value));
    expect([h.cash('p1'), h.cash('p2')]).toEqual([1500 - 2 * each, 1500 + each]);

    const k = G.create([null, 'C04']);
    k.draw('p1', 'EV10'); // 15% of 1500 = 225 → 220
    expect(k.cash('p2')).toBe(1280);
  });

  it('block_rent (Bóc phốt): target collects no rent until the Idol’s next turn start', () => {
    const g = G.create(['C04', null, null]).give('p2', ['P01']);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1', target: 'p2' });
    expect(g.s.activeEffects).toHaveLength(1);

    g.setCurrent('p3').at('p3', 38).roll('p3', 1, 2); // → P01
    expect(has(g.events, 'rentWaived', { why: 'blocked' })).toBe(true);
    expect([g.cash('p2'), g.cash('p3')]).toEqual([1500, 1700]);

    g.do({ type: 'endTurn', player: 'p3' }); // → p1's turn starts
    expect(g.s.activeEffects).toHaveLength(0);
  });
});

describe('C05 Cò đất', () => {
  it('commission when an opponent buys from the bank, including auctions', () => {
    const g = G.create(['C05', null, null]);
    g.setCurrent('p2').at('p2', 0).roll('p2', 1, 2);
    g.do({ type: 'buy', player: 'p2' });
    expect(g.cash('p1')).toBe(1510);

    g.setCurrent('p3').at('p3', 3).roll('p3', 1, 2); // → P03
    g.do({ type: 'declineBuy', player: 'p3' });
    g.do({ type: 'bid', player: 'p3', amount: 10 });
    g.do({ type: 'closeAuction' });
    expect(g.owner('P03')).toBe('p3');
    expect(g.cash('p1')).toBe(1520);

    g.setCurrent('p1').at('p1', 5).roll('p1', 1, 2); // → P04, own purchase: no commission
    g.do({ type: 'buy', player: 'p1' });
    expect(g.cash('p1')).toBe(1520 - 100);
  });

  it('no_hotels: cannot build past 4 houses', () => {
    const g = G.create(['C05', null]).give('p1', ['P01', 'P02'], { level: 4 });
    expect(() => g.setCurrent('p1').do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow(/Maximum/);
  });

  it('rent_multiplier skill (Tung tin quy hoạch): chosen group ×2 for every owner', () => {
    const g = G.create(['C05', null, null]).give('p2', ['P01', 'P02']);
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1', group: 'brown' });
    g.setCurrent('p3').at('p3', 38).roll('p3', 1, 2); // → P01: 2 ×2 (group) ×2 (skill)
    expect(g.cash('p2')).toBe(1508);
  });
});

describe('C06 Nghiện Tarot', () => {
  it('draw_two_choose_one (onDrawCard): pick one, the other goes to the bottom', () => {
    const g = G.create(['C06', null]);
    g.setCurrent('p1').at('p1', 4).top('CH12', 'CH13');
    g.roll('p1', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'chooseCard', options: ['CH12', 'CH13'] });
    g.do({ type: 'chooseCard', player: 'p1', cardId: 'CH13' });
    expect(g.cash('p1')).toBe(1550);
    expect(g.s.decks.chance.slice(-2)).toEqual(['CH12', 'CH13']);
  });

  it('Hanoi Event is drawn as a single card', () => {
    const g = G.create(['C06', null]);
    g.draw('p1', 'EV01');
    expect(g.s.pending).toBeNull();
    expect(g.cash('p1')).toBe(1550);
  });

  // No shipped character has forbidden tiles any more; the trait stays supported.
  const forbidden = () => withCharacter('C06', { drawbacks: [{ type: 'forbidden_properties', properties: ['P08'] }] });

  it('forbidden_properties: cannot buy or bid; tile auctions immediately', () => {
    const g = G.createWith(forbidden(), ['C06', null]);
    g.setCurrent('p1').at('p1', 11).roll('p1', 1, 2); // → P08
    expect(g.s.pending).toMatchObject({ type: 'auction', eligible: ['p2'] });
    expect(() => g.do({ type: 'bid', player: 'p1', amount: 10 })).toThrow(/eligible/);
  });

  it('forbidden_properties: cannot receive them in a trade', () => {
    const g = G.createWith(forbidden(), ['C06', null]).give('p2', ['P08']);
    expect(() =>
      g.do({ type: 'proposeTrade', player: 'p2', to: 'p1', offer: { properties: ['P08'] }, request: { cash: 100 } }),
    ).toThrow(/may not own/);
  });

  it('cancel_event_for_self (Giải hạn): EV10 skips the Tarot player', () => {
    const g = G.create([null, 'C06']);
    g.draw('p1', 'EV10');
    expect(g.s.pending).toMatchObject({ type: 'eventCancel', player: 'p2', cardId: 'EV10' });
    g.do({ type: 'useSkill', player: 'p2' });
    expect([g.cash('p1'), g.cash('p2')]).toEqual([1350, 1500]);
    expect(g.p('p2').skillUsed).toBe(true);
  });

  it('declining Giải hạn applies the event normally (with the card-payment drawback)', () => {
    const g = G.create([null, 'C06']);
    g.draw('p1', 'EV10');
    g.do({ type: 'declineSkill', player: 'p2' });
    expect(g.cash('p2')).toBe(1500 - Math.ceil(150 * num(CH.C06.drawbacks[0].value)));
  });

  it('Giải hạn on a ⏳ card exempts the Tarot player for its duration (EV15)', () => {
    const g = G.create([null, 'C06']).give('p2', ['P01', 'P02']);
    g.draw('p1', 'EV15');
    g.do({ type: 'useSkill', player: 'p2' });
    g.do({ type: 'endTurn', player: 'p1' });
    g.do({ type: 'build', player: 'p2', propertyId: 'P01' });
    expect(g.s.ownables.P01.level).toBe(1);
  });

  it('no prompt for an event that cannot hurt the Tarot player', () => {
    for (const card of ['EV01', 'EV04', 'EV14', 'EV22', 'EV31']) {
      const g = G.create([null, 'C06']);
      g.draw('p1', card);
      expect(g.s.pending).toBeNull();
    }
    const h = G.create([null, 'C06']).give('p2', ['P21']);
    h.draw('p1', 'EV07'); // Tarot owns Phố cổ → only receives
    expect(h.s.pending).toBeNull();
    expect(h.cash('p2')).toBe(1510);
  });
});

describe('C07 SVBK', () => {
  it('starting_cash 1400', () => {
    expect(G.create(['C07', null]).cash('p1')).toBe(1400);
  });

  it('park_bonus: +100 on top of the Quỹ; 150 when the Quỹ is off', () => {
    const g = G.create(['C07', null]);
    g.s.fund = 60;
    g.setCurrent('p1').at('p1', 17).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1400 + 60 + 100);

    const h = G.create(['C07', null], { scholarshipFund: false });
    h.setCurrent('p1').at('p1', 17).roll('p1', 1, 2);
    expect(h.cash('p1')).toBe(1550);
  });

  it('purchase_discount 20% on the pink group', () => {
    const g = G.create(['C07', null]);
    g.setCurrent('p1').at('p1', 8).roll('p1', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'P06', price: 112 });
  });

  it('auto_salary_upgrade (Tốt nghiệp): the Nth GO pass already pays the upgrade', () => {
    const g = G.create(['C07', null]);
    g.p('p1').goPasses = num(CH.C07.skill.afterGoPasses) - 2;
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1600);
    g.s.pending = null;
    g.s.turn.phase = 'roll';
    g.at('p1', 38).roll('p1', 1, 2);
    expect(g.cash('p1')).toBe(1600 + num(CH.C07.skill.value));
    expect(g.p('p1').skillUsed).toBe(true);
  });
});

describe('C08 Nô lệ tư bản', () => {
  it('starting_cash', () => {
    expect(G.create(['C08', null]).cash('p1')).toBe(num(CH.C08.passives[0].value));
  });

  it('free_jail_exit (Xin nghỉ phép)', () => {
    const g = G.create(['C08', null]);
    g.p('p1').inJail = true;
    g.p('p1').position = 10;
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    expect(g.p('p1')).toMatchObject({ inJail: false, skillUsed: true, cash: num(CH.C08.passives[0].value) });
    g.roll('p1', 1, 2);
    expect(g.p('p1').position).toBe(13);
  });
});

describe('skill recharge (skillCooldownRounds)', () => {
  /** Let bots play until p1 has started `n` more turns. */
  const turnsOfP1 = (g: G, n: number) => {
    let seen = 0;
    for (let k = 0; k < 5000 && seen < n && g.s.status === 'playing'; k++) {
      const r = applyAction(g.s, botAction(g.s)!);
      g.s = r.state;
      seen += r.events.filter((e) => e.type === 'turnStarted' && e.player === 'p1').length;
    }
    return seen;
  };

  it('a used skill comes back after its cooldown of own turns, with a skillReady event', () => {
    const g = G.create(['C08', null]);
    g.p('p1').inJail = true;
    g.p('p1').position = 10;
    g.setCurrent('p1').do({ type: 'useSkill', player: 'p1' });
    const rounds = num(CH.C08.skill.cooldownRounds ?? D.characterRules.skillCooldownRounds);
    expect(rounds).toBeGreaterThan(0);
    expect(g.p('p1')).toMatchObject({ skillUsed: true, skillCooldown: rounds });
    turnsOfP1(g, rounds - 1);
    expect(g.p('p1').skillUsed).toBe(true);
    const before = g.p('p1').skillCooldown;
    let ready = false;
    for (let k = 0; k < 5000 && !ready; k++) {
      const r = applyAction(g.s, botAction(g.s)!);
      g.s = r.state;
      ready = r.events.some((e) => e.type === 'skillReady' && e.player === 'p1');
    }
    expect(before).toBe(1);
    expect(ready).toBe(true);
    expect(g.p('p1').skillUsed).toBe(false);
  });

  it('per-skill cooldownRounds overrides the shared rule', () => {
    expect(CH.C03.skill.cooldownRounds).toBeGreaterThan(D.characterRules.skillCooldownRounds);
  });

  it('recharge: false skills (SVBK Tốt nghiệp) stay used', () => {
    expect(CH.C07.skill.recharge).toBe(false);
    const g = G.create(['C07', null]);
    g.p('p1').goPasses = num(CH.C07.skill.afterGoPasses) - 1;
    g.setCurrent('p1').at('p1', 38).roll('p1', 1, 2);
    expect(g.p('p1').skillUsed).toBe(true);
    expect(g.p('p1').skillCooldown).toBeUndefined();
  });
});
