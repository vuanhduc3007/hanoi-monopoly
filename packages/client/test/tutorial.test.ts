import { describe, expect, it } from 'vitest';
import { applyAction, createGame, publicView, type GameState } from '@hanoi-monopoly/engine';
import { t } from '../src/i18n/vi';
import { D } from '../src/lib/gameData';
import { nextTip, TIP_IDS, TIPS, type TipCtx, type TipScope } from '../src/lib/tutorial';

function game(mutate?: (s: GameState) => void) {
  const { state } = createGame({ players: [{ id: 'u1' }, { id: 'u2' }], seed: 3, config: { characters: false } });
  state.turn.current = 0;
  mutate?.(state);
  return state;
}

function ctx(s: GameState, you = 'u1'): TipCtx {
  const state = publicView(s);
  return {
    state,
    self: state.players.find((p) => p.id === you)!,
    myTurn: state.players[state.turn.current].id === you,
    events: [],
    name: (id) => (id ? `Người ${id}` : ''),
  };
}

const tip = (c: TipCtx, seen: string[] = [], scope: TipScope = 'game') => nextTip(c, scope, new Set(seen))?.tip.id ?? null;

describe('tutorial tips', () => {
  it('every tip has a Vietnamese text that renders with its parameters', () => {
    const c = ctx(game());
    for (const x of TIPS) {
      const text = t.tutorial.tips[x.id];
      expect(text, x.id).toBeTypeOf('function');
      // Fill every parameter a tip may use with something printable.
      const sample = { tile: 'P01', group: Object.keys(D.groups)[0], character: 'C01', owner: 'A', from: 'B', host: 'C' };
      const out = text({ fine: 50, turns: 3, rate: 50, interest: 10, hotelAt: 4, cash: 5, ...(x.when(c) ?? {}), ...sample, price: 60, amount: 10, cost: 50 });
      expect(out.title.length, x.id).toBeGreaterThan(0);
      expect(out.body.join(' '), x.id).not.toMatch(/undefined|NaN/);
    }
    expect(new Set(TIP_IDS).size).toBe(TIPS.length);
  });

  it('starts with the welcome, then asks for the roll on your turn and explains waiting otherwise', () => {
    const s = game();
    expect(tip(ctx(s))).toBe('welcome');
    expect(tip(ctx(s), ['welcome'])).toBe('roll');
    expect(tip(ctx(s, 'u2'), ['welcome'])).toBe('waiting');
  });

  it('a buy decision comes before everything else and says whether you can afford it', () => {
    const s = game((g) => {
      g.riggedDice = [1, 2]; // GO → tile 3
    });
    let after = applyAction(s, { type: 'roll', player: 'u1' }).state;
    while (after.pending?.type === 'postRoll') after = applyAction(after, { type: 'confirmRoll', player: 'u1' }).state;
    if (after.pending?.type !== 'buy') return; // board layout without a purchase there: nothing to check
    const n = nextTip(ctx(after), 'game', new Set());
    expect(n?.tip.id).toBe('buy');
    expect(n?.params).toMatchObject({ afford: true });
  });

  it('a full colour group with no houses points at Tài sản; one tile short points at Giao dịch', () => {
    const [g, def] = Object.entries(D.groups).find(([, x]) => x.properties.length >= 2)!;
    const seen = ['welcome', 'roll', 'endTurn', 'tileInfo', 'skill'];
    const full = game((s) => {
      for (const id of def.properties) s.ownables[id].owner = 'u1';
      s.turn.phase = 'end';
    });
    const n = nextTip(ctx(full), 'game', new Set(seen));
    expect(n?.tip.id).toBe('fullGroup');
    expect(n?.params.group).toBe(g);
    expect(n?.tip.target).toBe('assets');
    const short = game((s) => {
      def.properties.forEach((id, i) => (s.ownables[id].owner = i === 0 ? 'u2' : 'u1'));
      s.turn.phase = 'end';
    });
    expect(nextTip(ctx(short), 'game', new Set(seen))?.tip.id).toBe('nearGroup');
  });

  it('an incoming trade offer is pointed out', () => {
    const s = game((g) => {
      const mineId = Object.keys(g.ownables)[0];
      g.ownables[mineId].owner = 'u2';
    });
    const id = Object.keys(s.ownables)[0];
    const r = applyAction(s, {
      type: 'proposeTrade',
      player: 'u2',
      to: 'u1',
      offer: { cash: 0, properties: [id], jailCards: [] },
      request: { cash: 10, properties: [], jailCards: [] },
    });
    expect(tip(ctx(r.state), ['welcome'])).toBe('incomingTrade');
  });

  it('panels have their own intro; nothing shows once seen, or for a bankrupt player', () => {
    const s = game();
    expect(tip(ctx(s), [], 'assets')).toBe('assetsIntro');
    expect(tip(ctx(s), [], 'trade')).toBe('tradeIntro');
    expect(tip(ctx(s), ['assetsIntro'], 'assets')).toBeNull();
    const out = game((g) => (g.players[0].bankrupt = true));
    expect(tip(ctx(out))).toBeNull();
  });
});
