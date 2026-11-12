import { describe, expect, it } from 'vitest';
import {
  botAction,
  createGame,
  loanOfferFor,
  netWorth,
  portalTargetsFor,
  whyCantMoveHouse,
  defaultData,
  whyCantFlashSale,
  type Effect,
} from '../src';
import { D, G, has } from './helpers';

// C13–C17. Numbers come from characters.json so balancing never breaks these tests.
const CH = D.characters;
const num = (v: unknown) => v as number;
const up = (x: number) => Math.ceil(x - 1e-9);
const pos = (ref: string) => D.board.findIndex((t) => t.ref === ref);
const traitOf = (id: string, type: string): Effect => [...CH[id].passives, ...CH[id].drawbacks].find((t) => t.type === type)!;
/** A two-team game (teams 0,1,0,1) on the base character data. */
const teamGame = (chars: (string | null)[]) =>
  new G(createGame({ players: chars.map((character, i) => ({ id: `p${i + 1}`, character, team: i % 2 })), seed: 42 }, D).state, D);
/** Make the skill ready again (skip the cooldown). */
const ready = (g: G, id: string) => {
  g.p(id).skillUsed = false;
  delete g.p(id).skillCooldown;
};

describe('C13 Thánh săn sale', () => {
  it('starting_cash drawback', () => {
    expect(G.create(['C13', null]).cash('p1')).toBe(num(traitOf('C13', 'starting_cash').value));
  });

  it('auction_discount: the winner pays less than the winning bid', () => {
    const g = G.create(['C13', null]);
    g.setCurrent('p2').at('p2', 0).roll('p2', 1, 2); // → P02
    g.do({ type: 'declineBuy', player: 'p2' });
    expect(g.s.pending?.type).toBe('auction');
    const before = g.cash('p1');
    g.do({ type: 'bid', player: 'p1', amount: 50 });
    const ev = g.do({ type: 'closeAuction' });
    const paid = up(50 * (1 - num(traitOf('C13', 'auction_discount').rate)));
    expect(g.owner('P02')).toBe('p1');
    expect(g.cash('p1')).toBe(before - paid);
    expect(has(ev, 'auctionEnded', { winner: 'p1', price: paid, bid: 50 })).toBe(true);
  });

  it('flash_sale: buys any unowned tile at a discount without moving (Cò đất still earns); not an owned tile', () => {
    const g = G.create(['C13', 'C05']);
    const sk = CH.C13.skill;
    g.give('p2', ['P21']);
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P21' })).toThrow(/unowned/);
    const before = g.cash('p1');
    const ev = g.do({ type: 'useSkill', player: 'p1', propertyId: 'P22' });
    const price = up(D.ownables.P22.price * (1 - num(sk.rate)));
    expect(g.owner('P22')).toBe('p1');
    expect(g.cash('p1')).toBe(before - price);
    expect(g.p('p1').position).toBe(0);
    expect(has(ev, 'commission', { player: 'p2' })).toBe(true);
    expect(g.p('p1').skillCooldown).toBe(num(sk.cooldownRounds));
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P20' })).toThrow(/not available/);
  });

  it('flash_sale may not complete a colour group (completesGroup: false), except where a table size allows it', () => {
    expect(CH.C13.skill.completesGroup).toBe(false);
    const g = G.create(['C13', null]);
    g.give('p1', ['P21']);
    expect(whyCantFlashSale(g.s, 'p1', 'P22', g.d)).toBe('completesGroup');
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P22' })).toThrow(/complete/);
    expect(whyCantFlashSale(g.s, 'p1', 'P20', g.d)).toBeNull();
    // The shipped data lets small tables complete a group.
    const small = new G(createGame({ players: [{ id: 'p1', character: 'C13' }, { id: 'p2', character: null }], seed: 1 }).state);
    small.give('p1', ['P21']);
    small.d = defaultData;
    expect(whyCantFlashSale(small.s, 'p1', 'P22', defaultData)).toBeNull();
  });

  it('flash_sale needs the cash and the turn', () => {
    const g = G.create(['C13', null]);
    g.setCash('p1', 10);
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P22' })).toThrow(/cash/);
    g.setCash('p1', 2000).setCurrent('p2');
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P22' })).toThrow(/turn/);
  });
});

describe('C14 Chủ trọ', () => {
  const bonus = () => traitOf('C14', 'rent_bonus_groups');

  it('rent_bonus_groups: tenants pay more on the cheap groups only', () => {
    const g = G.create(['C14', null]);
    g.give('p1', ['P03', 'P06']);
    expect((bonus().groups as string[]).includes('lightblue')).toBe(true);
    g.setCurrent('p2').at('p2', 0);
    let before = g.cash('p2');
    g.roll('p2', 2, 4); // → P03
    expect(before - g.cash('p2')).toBe(up(D.ownables.P03.rent!.base * (1 + num(bonus().rate))));
    g.setCurrent('p2').at('p2', pos('P06') - 6);
    before = g.cash('p2');
    g.roll('p2', 2, 4); // → P06 (pink: plain rent)
    expect(before - g.cash('p2')).toBe(D.ownables.P06.rent!.base);
  });

  it('tax_override drawback: pays more tax', () => {
    const g = G.create(['C14', null]);
    const before = g.cash('p1');
    g.setCurrent('p1').at('p1', 1).roll('p1', 1, 2); // → TAX1
    const t = CH.C14.drawbacks.find((x) => x.type === 'tax_override' && x.tax === 'TAX1')!;
    expect(before - g.cash('p1')).toBe(num(t.amount));
  });

  it('raise_rent: a chosen property earns more for good, up to maxPerTile, only his own', () => {
    const g = G.create(['C14', null]);
    const sk = CH.C14.skill;
    g.give('p1', ['P06'], { level: 1 }).give('p1', ['P07', 'P08'], { level: 1 }).give('p2', ['P09']);
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P09' })).toThrow(/your properties/);
    for (let i = 1; i <= num(sk.maxPerTile); i++) {
      ready(g, 'p1');
      const ev = g.do({ type: 'useSkill', player: 'p1', propertyId: 'P06' });
      expect(has(ev, 'skillUsed', { skill: 'raise_rent', propertyId: 'P06', raises: i })).toBe(true);
    }
    ready(g, 'p1');
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P06' })).toThrow(/further/);
    g.setCurrent('p2').at('p2', pos('P06') - 6);
    const before = g.cash('p2');
    g.roll('p2', 2, 4);
    expect(before - g.cash('p2')).toBe(up(D.ownables.P06.rent!.h1 * (1 + num(sk.maxPerTile) * num(sk.rate))));
  });
});

describe('C15 Thầy phong thủy', () => {
  it('immune_events: no repair bill from his own card (CH15)', () => {
    const g = G.create(['C15', null]);
    g.give('p1', ['P01', 'P02'], { level: 2 });
    const before = g.cash('p1');
    const ev = g.draw('p1', 'CH15');
    expect(g.cash('p1')).toBe(before);
    expect(has(ev, 'cardImmune', { player: 'p1', cardId: 'CH15' })).toBe(true);
  });

  it('immune_events: an event repair bill (EV03) skips him, others pay', () => {
    const g = G.create(['C15', null]);
    g.give('p1', ['P01', 'P02'], { level: 1 }).give('p2', ['P03', 'P04', 'P05'], { level: 1 });
    const mine = g.cash('p1');
    const theirs = g.cash('p2');
    g.draw('p2', 'EV03');
    expect(g.cash('p1')).toBe(mine);
    expect(theirs - g.cash('p2')).toBe(3 * num(D.cards.EV03.effect.perHouse));
  });

  it('move_house: a house goes to another full group for free', () => {
    const g = G.create(['C15', null]);
    g.give('p1', ['P01', 'P02'], { level: 2 }).give('p1', ['P03', 'P04', 'P05'], { level: 1 });
    const before = g.cash('p1');
    const ev = g.do({ type: 'useSkill', player: 'p1', from: 'P01', propertyId: 'P03' });
    expect(g.s.ownables.P01.level).toBe(1);
    expect(g.s.ownables.P03.level).toBe(2);
    expect(g.cash('p1')).toBe(before);
    expect(has(ev, 'skillUsed', { skill: 'move_house', from: 'P01', propertyId: 'P03' })).toBe(true);
    expect(g.p('p1').skillCooldown).toBe(num(CH.C15.skill.cooldownRounds));
  });

  it('move_house keeps both groups even, houses only, full group needed', () => {
    const g = G.create(['C15', null]);
    g.give('p1', ['P01', 'P02'], { level: 2 }).give('p1', ['P03', 'P04', 'P05'], { level: 1 }).give('p1', ['P06']);
    const why = (from: string, to: string) => whyCantMoveHouse(g.s, 'p1', from, to, g.d);
    expect(why('P01', 'P02')).toBe('buildEvenly'); // 2/2 → 1/3
    g.s.ownables.P02.level = 1;
    expect(why('P02', 'P03')).toBe('sellEvenly'); // P01 has more
    expect(why('P01', 'P04')).toBeNull();
    expect(why('P01', 'P06')).toBe('needFullGroup');
    expect(why('P03', 'P03')).toBe('sameTile');
    expect(why('P06', 'P01')).toBe('noHouseToMove');
    g.s.ownables.P03.level = 4;
    g.s.ownables.P04.level = 4;
    g.s.ownables.P05.level = 4;
    expect(why('P01', 'P03')).toBe('housesOnly'); // would become a hotel
    g.s.ownables.P03.level = 5;
    expect(why('P03', 'P01')).toBe('housesOnly'); // a hotel does not move
  });
});

describe('C16 Tín dụng đen', () => {
  const sk = () => CH.C16.skill;
  const shark = () => traitOf('C16', 'loan_shark');

  it('forced_loan: lends to the opponent, who repays at the next pass of the start before the tile', () => {
    const g = G.create(['C16', null]);
    const amount = num(sk().amount);
    const owed = up(amount * num(sk().repayRate));
    const l0 = g.cash('p1');
    const b0 = g.cash('p2');
    const ev = g.do({ type: 'useSkill', player: 'p1' });
    expect(g.cash('p1')).toBe(l0 - amount);
    expect(g.cash('p2')).toBe(b0 + amount);
    expect(g.p('p2').debts).toEqual([{ to: 'p1', amount: owed }]);
    expect(has(ev, 'loan', { player: 'p2', lender: 'p1', amount, owed, forced: true })).toBe(true);
    expect(netWorth(g.s, 'p1', g.d)).toBe(l0 - amount + owed);
    g.setCurrent('p2').at('p2', 38);
    const roll = g.roll('p2', 1, 2); // passes the start → P01
    const salary = num(roll.find((e) => e.type === 'salary')!.amount);
    expect(g.cash('p1')).toBe(l0 - amount + owed);
    expect(g.cash('p2')).toBe(b0 + amount + salary - owed);
    expect(g.p('p2').debts).toBeUndefined();
    expect(g.s.pending).toMatchObject({ type: 'buy', propertyId: 'P01' });
  });

  it('a debtor who cannot repay owes the lender: bankruptcy goes to Tín dụng đen', () => {
    const g = G.create(['C16', null]);
    g.do({ type: 'useSkill', player: 'p1' });
    g.give('p2', ['P05'], { mortgaged: true });
    g.setCash('p2', 0).setCurrent('p2').at('p2', 38);
    g.roll('p2', 1, 2);
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p2', task: { to: { kind: 'player', id: 'p1' }, reason: 'loanRepay' } });
    // No Vay nóng to pay the lender himself.
    expect(loanOfferFor(g.s, 'p2', g.d)).toBeNull();
    g.do({ type: 'declareBankruptcy', player: 'p2' });
    expect(g.p('p2').bankrupt).toBe(true);
    expect(g.owner('P05')).toBe('p1');
  });

  it('loan_shark: short of cash for rent, borrow the shortfall (Vay nóng)', () => {
    const g = G.create(['C16', null, null]);
    g.give('p3', ['P03', 'P04', 'P05'], { level: 2 });
    g.setCash('p2', 10).setCurrent('p2').at('p2', 0);
    g.roll('p2', 2, 4); // → P03
    const rent = D.ownables.P03.rent!.h2;
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p2' });
    const amount = rent - 10;
    expect(amount).toBeLessThanOrEqual(num(shark().maxAmount));
    const owed = up(amount * (1 + num(shark().rate)));
    expect(loanOfferFor(g.s, 'p2', g.d)).toEqual({ lender: 'p1', amount, owed });
    const l0 = g.cash('p1');
    const r0 = g.cash('p3');
    const ev = g.do({ type: 'borrow', player: 'p2' });
    expect(g.s.pending).toBeNull();
    expect(g.cash('p3')).toBe(r0 + rent);
    expect(g.cash('p1')).toBe(l0 - amount);
    expect(g.cash('p2')).toBe(0);
    expect(g.p('p2').debts).toEqual([{ to: 'p1', amount: owed }]);
    expect(has(ev, 'loan', { player: 'p2', lender: 'p1', amount, owed })).toBe(true);
  });

  it('no Vay nóng above maxAmount, without the lender having the cash, or between teammates', () => {
    const g = G.create(['C16', null, null]);
    g.give('p3', ['P03', 'P04', 'P05'], { level: 4 });
    g.setCash('p2', 0).setCurrent('p2').at('p2', 0);
    g.roll('p2', 2, 4);
    expect(D.ownables.P03.rent!.h4).toBeGreaterThan(num(shark().maxAmount));
    expect(loanOfferFor(g.s, 'p2', g.d)).toBeNull();
    expect(() => g.do({ type: 'borrow', player: 'p2' })).toThrow(/No loan/);
    const t = teamGame(['C16', null, null, null]); // p1 and p3 are teammates
    t.give('p2', ['P03', 'P04', 'P05'], { level: 1 });
    t.setCash('p3', 0).setCurrent('p3').at('p3', 0);
    t.roll('p3', 2, 4);
    expect(t.s.pending).toMatchObject({ type: 'liquidation', player: 'p3' });
    // Teammates pass money with a trade instead.
    expect(loanOfferFor(t.s, 'p3', t.d)).toBeNull();
  });

  it('forced_loan never lands on a teammate; a bankrupt lender’s loans are gone', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const t = new G(
        createGame({ players: ['C16', null, null, null].map((character, i) => ({ id: `p${i + 1}`, character, team: i % 2 })), seed }, D).state,
        D,
      );
      t.do({ type: 'useSkill', player: 'p1' });
      expect(t.p('p3').debts).toBeUndefined();
      expect([t.p('p2').debts, t.p('p4').debts].filter(Boolean)).toHaveLength(1);
    }
    const g = G.create(['C16', null, null]);
    g.do({ type: 'useSkill', player: 'p1' });
    const debtor = g.p('p2').debts ? 'p2' : 'p3';
    g.give('p2', ['P03', 'P04', 'P05'], { level: 4 });
    g.setCash('p1', 0).setCurrent('p1').at('p1', 0);
    g.roll('p1', 2, 4);
    if (g.s.pending?.type === 'liquidation') g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.p('p1').bankrupt).toBe(true);
    expect(g.p(debtor).debts).toBeUndefined();
  });

  it('bots: Giải ngân when cash allows, Vay nóng when short', () => {
    const g = G.create(['C16', null, null]);
    expect(botAction(g.s, g.d)).toEqual({ type: 'useSkill', player: 'p1' });
    g.give('p3', ['P03', 'P04', 'P05'], { level: 2 });
    g.setCash('p2', 10).setCurrent('p2').at('p2', 0);
    g.roll('p2', 2, 4);
    expect(botAction(g.s, g.d)).toEqual({ type: 'borrow', player: 'p2' });
  });

  it('EV41: Tín dụng đen pays into the Quỹ', () => {
    const g = G.create(['C16', null]);
    const before = g.cash('p1');
    const fund = g.s.fund;
    g.draw('p2', 'EV41');
    expect(before - g.cash('p1')).toBe(num(D.cards.EV41.effect.amount));
    expect(g.s.fund).toBe(fund + num(D.cards.EV41.effect.amount));
  });
});

describe('C17 Bác sĩ lạ', () => {
  it('portal: swaps with the opponent he picks; he handles his new tile first, no salary', () => {
    const g = G.create(['C17', null, null]);
    g.at('p1', 5).at('p2', pos('P06')).at('p3', pos('P08'));
    const before = g.cash('p1');
    const ev = g.do({ type: 'useSkill', player: 'p1', target: 'p2' });
    expect(g.p('p1').position).toBe(pos('P06'));
    expect(g.p('p2').position).toBe(5);
    expect(g.p('p3').position).toBe(pos('P08'));
    expect(g.s.pending).toMatchObject({ type: 'buy', player: 'p1', propertyId: 'P06' });
    expect(g.cash('p1')).toBe(before);
    expect(has(ev, 'skillUsed', { skill: 'portal', target: 'p2' })).toBe(true);
    expect(g.s.turn.phase).toBe('end');
    expect(g.p('p1').skillCooldown).toBe(num(CH.C17.skill.cooldownRounds));
  });

  it('portal: a target is required, and must be an opponent he may swap with', () => {
    const g = G.create(['C17', null]);
    g.at('p2', 7);
    expect(() => g.do({ type: 'useSkill', player: 'p1' })).toThrow(/Choose an opponent/);
    expect(() => g.do({ type: 'useSkill', player: 'p1', target: 'p1' })).toThrow(/Choose an opponent/);
  });

  it('portal: the opponent lands on his old tile for real and pays him rent', () => {
    const g = G.create(['C17', null]);
    g.give('p1', ['P06'], { level: 2 });
    g.at('p1', pos('P06')).at('p2', pos('P08'));
    g.s.ownables.P08 = { owner: 'p1', mortgaged: false, level: 0 };
    const other = g.cash('p2');
    const ev = g.do({ type: 'useSkill', player: 'p1', target: 'p2' });
    expect(has(ev, 'landed', { player: 'p2', position: pos('P06') })).toBe(true);
    expect(other - g.cash('p2')).toBe(D.ownables.P06.rent!.h2);
  });

  it('portal: the opponent reaching an unowned tile is offered it, in Bác sĩ lạ’s turn', () => {
    const g = G.create(['C17', null]);
    g.at('p1', pos('P06')).at('p2', pos('P08'));
    g.give('p2', ['P08']);
    g.do({ type: 'useSkill', player: 'p1', target: 'p2' });
    expect(g.s.pending).toMatchObject({ type: 'buy', player: 'p2', propertyId: 'P06' });
    g.do({ type: 'buy', player: 'p2' });
    expect(g.owner('P06')).toBe('p2');
    expect(g.s.players[g.s.turn.current].id).toBe('p1');
    expect(g.s.turn.phase).toBe('end');
  });

  it('portal: he lands on rent too', () => {
    const g = G.create(['C17', null, null]);
    g.give('p3', ['P06']);
    g.at('p1', 1).at('p2', pos('P06')).at('p3', pos('P06'));
    const before = g.cash('p1');
    g.do({ type: 'useSkill', player: 'p1', target: 'p2' });
    expect(before - g.cash('p1')).toBe(D.ownables.P06.rent!.base);
  });

  it('portal works after rolling too (a second landing), but not from jail or with nobody to swap', () => {
    const g = G.create(['C17', null]);
    g.at('p2', pos('P08'));
    g.p('p1').inJail = true;
    expect(() => g.do({ type: 'useSkill', player: 'p1', target: 'p2' })).toThrow(/jail/);
    g.p('p1').inJail = false;
    g.p('p2').inJail = true;
    expect(portalTargetsFor(g.s, 'p1', g.d)).toEqual([]);
    expect(() => g.do({ type: 'useSkill', player: 'p1', target: 'p2' })).toThrow(/Choose an opponent/);
    g.p('p2').inJail = false;
    g.rig(1, 2).do({ type: 'roll', player: 'p1' });
    if (g.s.pending?.type === 'buy') g.do({ type: 'declineBuy', player: 'p1' });
    if (g.s.pending?.type === 'auction') g.do({ type: 'closeAuction' });
    expect(g.s.turn.phase).toBe('end');
    const at = g.p('p1').position;
    const ev = g.do({ type: 'useSkill', player: 'p1', target: 'p2' });
    expect(g.p('p1').position).toBe(pos('P08'));
    expect(g.p('p2').position).toBe(at);
    expect(has(ev, 'landed', { player: 'p1', position: pos('P08') })).toBe(true);
    // He decides on his tile first; then the opponent lands.
    expect(g.s.pending).toMatchObject({ type: 'buy', player: 'p1' });
    g.do({ type: 'declineBuy', player: 'p1' });
    if (g.s.pending?.type === 'auction') g.do({ type: 'closeAuction' });
    expect(has(g.events, 'landed', { player: 'p2', position: at })).toBe(true);
    expect(g.s.turn.phase).toBe('end');
  });

  it('portal never swaps with a teammate', () => {
    const t = teamGame(['C17', null, null, null]);
    t.at('p2', 5).at('p3', 6).at('p4', 7);
    expect(portalTargetsFor(t.s, 'p1', t.d).sort()).toEqual(['p2', 'p4']);
  });

  it('immune_events: no doctor’s bill (CD11)', () => {
    const g = G.create(['C17', null]);
    const before = g.cash('p1');
    g.draw('p1', 'CD11');
    expect(g.cash('p1')).toBe(before);
  });
});

describe('EV42 Chủ trọ card', () => {
  it('pays Chủ trọ when at the table', () => {
    const g = G.create(['C14', null]);
    const before = g.cash('p1');
    g.draw('p2', 'EV42');
    expect(g.cash('p1') - before).toBe(num(D.cards.EV42.effect.amount));
  });
});

describe('bots use the new skills', () => {
  it('Flash sale joins a started group (not the completing tile); Tăng giá phòng goes on the best tile; Dời nhà moves to richer rent', () => {
    const sale = G.create(['C13', null]);
    sale.give('p1', ['P21']);
    expect(botAction(sale.s, sale.d)).toEqual({ type: 'roll', player: 'p1' }); // P22 would complete the group
    sale.give('p1', ['P18']);
    expect(botAction(sale.s, sale.d)).toMatchObject({ type: 'useSkill', player: 'p1' });
    const raise = G.create(['C14', null]);
    raise.give('p1', ['P01', 'P02'], { level: 1 }).give('p1', ['P21', 'P22'], { level: 1 });
    expect(botAction(raise.s, raise.d)).toEqual({ type: 'useSkill', player: 'p1', propertyId: 'P22' });
    const move = G.create(['C15', null]);
    move.give('p1', ['P01', 'P02'], { level: 1 }).give('p1', ['P21', 'P22'], { level: 1 });
    move.s.turn.phase = 'end';
    expect(botAction(move.s, move.d)).toMatchObject({ type: 'useSkill', player: 'p1', propertyId: 'P22' });
  });

  it('Mở cổng when the swap lands somewhere worth buying, not onto a hotel', () => {
    const good = G.create(['C17', null]);
    good.at('p2', pos('P22'));
    expect(botAction(good.s, good.d)).toEqual({ type: 'useSkill', player: 'p1', target: 'p2' });
    const bad = G.create(['C17', null, null]);
    bad.give('p3', ['P21', 'P22'], { level: 5 });
    bad.at('p2', pos('P22'));
    expect(botAction(bad.s, bad.d)).toEqual({ type: 'roll', player: 'p1' });
  });

  it('Mở cổng picks the opponent whose swap pays most: one that will land on his hotel', () => {
    const g = G.create(['C17', null, null]);
    g.give('p1', ['P21', 'P22'], { level: 5 }).at('p1', pos('P22'));
    g.at('p2', 12).at('p3', 14);
    expect(botAction(g.s, g.d)).toMatchObject({ type: 'useSkill', player: 'p1' });
  });
});

describe('C01 Thiếu gia Vin — Mua đứt', () => {
  const sk = () => CH.C01.skill;

  it('buys an opponent’s lone tile at premium × list price, the owner is paid; not the tile completing a group', () => {
    const g = G.create(['C01', null]);
    g.give('p1', ['P06']).give('p2', ['P07']);
    const cost = up(D.ownables.P07.price * num(sk().premium));
    const mine = g.cash('p1');
    const theirs = g.cash('p2');
    const ev = g.do({ type: 'useSkill', player: 'p1', propertyId: 'P07' });
    expect(g.owner('P07')).toBe('p1');
    expect(g.cash('p1')).toBe(mine - cost);
    expect(g.cash('p2')).toBe(theirs + cost);
    expect(has(ev, 'skillUsed', { skill: 'buyout', propertyId: 'P07', from: 'p2', amount: cost })).toBe(true);
    expect(sk().completesGroup).toBe(false);
    const h = G.create(['C01', null]);
    h.give('p1', ['P21']).give('p2', ['P22']);
    expect(() => h.do({ type: 'useSkill', player: 'p1', propertyId: 'P22' })).toThrow(/completesGroup/);
    expect(g.p('p1').skillCooldown).toBe(num(sk().cooldownRounds));
  });

  it('not a tile whose owner holds more of the group, a group with buildings, a mortgaged tile or a teammate’s', () => {
    const g = G.create(['C01', null]);
    g.give('p2', ['P03', 'P04']);
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P03' })).toThrow(/notLone/);
    g.give('p2', ['P06']).give('p1', ['P07'], { level: 1 });
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P06' })).toThrow(/buildings/);
    g.give('p2', ['P12'], { mortgaged: true });
    expect(() => g.do({ type: 'useSkill', player: 'p1', propertyId: 'P12' })).toThrow(/mortgaged/);
    const t = teamGame(['C01', null, null, null]);
    t.give('p3', ['P22']);
    expect(() => t.do({ type: 'useSkill', player: 'p1', propertyId: 'P22' })).toThrow(/notOpponent/);
  });

  it('Bố ơi cứu con is a passive now: it saves once, the active skill stays ready', () => {
    const g = G.create(['C01', null]).give('p2', ['P01']).give('p2', ['P02'], { level: 5 }).setCash('p1', 100);
    g.setCurrent('p1').at('p1', 0).roll('p1', 1, 2);
    g.do({ type: 'declareBankruptcy', player: 'p1' });
    expect(g.p('p1')).toMatchObject({ bankrupt: false, bailoutUsed: true, skillUsed: false });
  });

  it('bot: does not overpay for a tile that only starts a pair; buys the last transport', () => {
    const g = G.create(['C01', null]);
    g.give('p1', ['P06']).give('p2', ['P07']);
    expect(botAction(g.s, g.d)).toEqual({ type: 'roll', player: 'p1' });
    g.give('p1', ['T01', 'T02', 'T03']).give('p2', ['T04']);
    expect(botAction(g.s, g.d)).toEqual({ type: 'useSkill', player: 'p1', propertyId: 'T04' });
  });
});

describe('C07 SVBK — Săn học bổng', () => {
  const sk = () => CH.C07.skill;

  it('takes up to maxAmount from the Quỹ khuyến học', () => {
    const g = G.create(['C07', null]);
    g.s.fund = 500;
    const before = g.cash('p1');
    g.do({ type: 'useSkill', player: 'p1' });
    expect(g.cash('p1')).toBe(before + num(sk().maxAmount));
    expect(g.s.fund).toBe(500 - num(sk().maxAmount));
  });

  it('a small Quỹ gives what it has; an empty or switched-off Quỹ means the bank’s fallback', () => {
    const g = G.create(['C07', null]);
    g.s.fund = 30;
    let before = g.cash('p1');
    g.do({ type: 'useSkill', player: 'p1' });
    expect(g.cash('p1')).toBe(before + 30);
    expect(g.s.fund).toBe(0);
    ready(g, 'p1');
    before = g.cash('p1');
    g.do({ type: 'useSkill', player: 'p1' });
    expect(g.cash('p1')).toBe(before + num(sk().fallbackAmount));
    const off = G.create(['C07', null], { scholarshipFund: false });
    before = off.cash('p1');
    off.do({ type: 'useSkill', player: 'p1' });
    expect(off.cash('p1')).toBe(before + num(sk().fallbackAmount));
  });
});

describe('team games: F0 Bắt đáy bot follows the side rule', () => {
  it('no Bắt đáy on a tile whose owner’s teammate has houses in the group', () => {
    const t = teamGame(['C11', null, null, null]); // p2 and p4 are teammates
    t.give('p2', ['P03'], { mortgaged: true }).give('p4', ['P04', 'P05'], { level: 1 });
    t.give('p1', ['P01']);
    const a = botAction(t.s, t.d)!;
    expect(a.type === 'useSkill' && a.propertyId === 'P03').toBe(false);
  });
});

describe('new cards (CH22–CH26, CD21–CD24, EV43–EV47)', () => {
  it('every new move card names a tile on every board', async () => {
    const { dataFor } = await import('../src');
    for (const board of ['standard', 'extended', 'large'] as const) {
      const d = dataFor(board);
      for (const id of ['CH22', 'CH23', 'CH24']) {
        expect(d.board.some((t) => t.ref === D.cards[id].effect.tile), `${id} on ${board}`).toBe(true);
      }
    }
  });

  it('EV44: everyone pays Bác sĩ lạ; CD23: he does not pay the dentist', () => {
    const g = G.create(['C17', null, null]);
    const doc = g.cash('p1');
    g.draw('p2', 'EV44');
    expect(g.cash('p1')).toBe(doc + 2 * num(D.cards.EV44.effect.amount));
    const before = g.cash('p1');
    g.draw('p1', 'CD23');
    expect(g.cash('p1')).toBe(before);
  });

  it('EV43 / EV45 pay Thánh săn sale and Thầy phong thủy; EV46 raises orange and red rent', () => {
    const g = G.create(['C13', 'C15']);
    const a = g.cash('p1');
    const b = g.cash('p2');
    g.draw('p1', 'EV43');
    expect(g.cash('p1')).toBe(a + num(D.cards.EV43.effect.amount));
    g.draw('p1', 'EV45');
    expect(g.cash('p2')).toBe(b + num(D.cards.EV45.effect.amount));
    g.draw('p1', 'EV46');
    expect(g.s.activeEffects.some((e) => e.effect.type === 'rent_multiplier' && e.effect.multiplier === 1.5)).toBe(true);
  });
});

describe('C14 Tăng giá phòng and hotels', () => {
  it('a raise does not count once the tile has a hotel', () => {
    const g = G.create(['C14', null]);
    g.give('p1', ['P06', 'P07', 'P08'], { level: 5 });
    g.p('p1').rentBoosts = { P06: 2 };
    g.setCurrent('p2').at('p2', pos('P06') - 6);
    const before = g.cash('p2');
    g.roll('p2', 2, 4);
    expect(before - g.cash('p2')).toBe(D.ownables.P06.rent!.hotel);
  });
});

describe('raising cash for rent', () => {
  it('short of cash (no Ăn vạ): straight to the raise-cash decision, where selling and mortgaging work', () => {
    const g = G.create([null, null]);
    g.auto = false;
    g.give('p2', ['P06', 'P07', 'P08'], { level: 2 }).give('p1', ['P01', 'P02'], { level: 1 });
    g.setCash('p1', 10).setCurrent('p1').at('p1', pos('P06') - 6);
    g.roll('p1', 2, 4);
    expect(g.s.pending).toMatchObject({ type: 'liquidation', player: 'p1', task: { kind: 'rent', reason: 'P06' } });
    g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P01' });
    g.do({ type: 'sellBuilding', player: 'p1', propertyId: 'P02' });
    g.do({ type: 'mortgage', player: 'p1', propertyId: 'P01' });
    expect(g.p('p1').cash).toBeGreaterThan(10);
  });

  it('with Ăn vạ to decide, the rent prompt stays and selling / mortgaging work during it', () => {
    const g = G.create(['C02', null]);
    g.auto = false;
    g.give('p2', ['P06', 'P07', 'P08'], { level: 2 }).give('p1', ['P01']);
    g.setCash('p1', 10).setCurrent('p1').at('p1', pos('P06') - 6);
    g.roll('p1', 2, 4);
    expect(g.s.pending).toMatchObject({ type: 'payRent', player: 'p1', discount: true });
    g.do({ type: 'mortgage', player: 'p1', propertyId: 'P01' });
    expect(g.p('p1').cash).toBe(10 + D.ownables.P01.mortgage);
    expect(() => g.do({ type: 'build', player: 'p1', propertyId: 'P01' })).toThrow();
  });
});
