/**
 * Tutorial for new players: short tips that show up as the situations they
 * explain come up in a real game (first purchase, first rent, a full colour
 * group, low cash…). Pure — the Coach component renders the first tip that
 * applies and has not been seen yet; the texts live in i18n/vi.ts.
 */
import type { GameEvent, PlayerState, PublicState } from '@hanoi-monopoly/engine';
import { D } from './gameData';
import { hotelLevel, offersFor, ownedBy, ownedBySide, unmortgageCost } from './selectors';

/** Where a tip is shown: the side panel during play, or inside an open panel. */
export type TipScope = 'game' | 'assets' | 'trade';

export type TipParams = Record<string, string | number | boolean>;

export interface TipCtx {
  state: PublicState;
  self: PlayerState;
  myTurn: boolean;
  /** Game events so far (newest last). */
  events: GameEvent[];
  name: (id: string | null | undefined) => string;
}

export interface Tip {
  id: string;
  scope: TipScope;
  /** `data-coach` key(s) of the buttons to highlight, space-separated. */
  target?: string;
  /** Null when the tip does not apply now; otherwise the values its text needs. */
  when: (c: TipCtx) => TipParams | null;
}

const yes: TipParams = {};

function pendingMine(c: TipCtx, type: string) {
  const p = c.state.pending;
  return p && p.type === type && 'player' in p && p.player === c.self.id ? p : null;
}

/** Nothing for the player to answer right now, during their own turn. */
function freeTurn(c: TipCtx): boolean {
  return c.myTurn && !c.state.pending;
}

/** Per colour group: its tiles, the ones my side holds (teammates count), and whether I hold any myself. */
function groupsOf(c: TipCtx) {
  return Object.entries(D.groups).map(([g, def]) => ({
    g,
    ids: def.properties,
    mine: def.properties.filter((id) => ownedBySide(c.state, id, c.self.id)),
    own: def.properties.some((id) => c.state.ownables[id]?.owner === c.self.id),
  }));
}

/** In priority order: things to answer right now first, then general advice. */
export const TIPS: Tip[] = [
  // ------------------------------------------------ answer now
  {
    id: 'liquidation',
    scope: 'game',
    target: 'assets',
    when: (c) => {
      const p = pendingMine(c, 'liquidation');
      return p && p.type === 'liquidation' ? { amount: p.task.amount, cash: c.self.cash } : null;
    },
  },
  {
    id: 'buy',
    scope: 'game',
    target: 'buy',
    when: (c) => {
      const p = pendingMine(c, 'buy');
      if (!p || p.type !== 'buy') return null;
      return { tile: p.propertyId, price: p.price, afford: c.self.cash >= p.price, land: D.ownables[p.propertyId].kind === 'property' };
    },
  },
  {
    id: 'auction',
    scope: 'game',
    target: 'auction',
    when: (c) => {
      const p = c.state.pending;
      return p?.type === 'auction' && p.eligible.includes(c.self.id) ? { tile: p.propertyId } : null;
    },
  },
  {
    id: 'payRent',
    scope: 'game',
    target: 'pay',
    when: (c) => {
      const p = pendingMine(c, 'payRent');
      if (!p || p.type !== 'payRent') return null;
      return { tile: p.propertyId, owner: c.name(c.state.ownables[p.propertyId]?.owner), amount: p.task.amount };
    },
  },
  { id: 'revealCard', scope: 'game', target: 'card', when: (c) => (pendingMine(c, 'revealCard') ? yes : null) },
  { id: 'chooseCard', scope: 'game', when: (c) => (pendingMine(c, 'chooseCard') ? yes : null) },
  {
    id: 'sicbo',
    scope: 'game',
    target: 'bet',
    when: (c) => {
      const p = c.state.pending;
      return p?.type === 'sicboBet' && p.waiting.includes(c.self.id) ? { host: c.name(p.host) } : null;
    },
  },
  { id: 'gamble', scope: 'game', target: 'bet', when: (c) => (pendingMine(c, 'gamble') ? yes : null) },
  { id: 'postRoll', scope: 'game', when: (c) => (pendingMine(c, 'postRoll') ? yes : null) },
  {
    id: 'inheritMortgage',
    scope: 'game',
    when: (c) => {
      const p = pendingMine(c, 'inheritMortgage');
      return p && p.type === 'inheritMortgage' ? { tile: p.propertyId } : null;
    },
  },
  {
    id: 'incomingTrade',
    scope: 'game',
    target: 'trade',
    when: (c) => {
      const x = offersFor(c.state, c.self.id)[0];
      return x ? { from: c.name(x.from) } : null;
    },
  },
  // ------------------------------------------------ start of the game
  {
    id: 'welcome',
    scope: 'game',
    when: (c) => ({
      quick: c.state.config.mode === 'quick',
      minutes: D.config.quickMode.timeLimitMin,
      salary: D.economy.goSalary,
      start: D.board[0].name,
    }),
  },
  { id: 'team', scope: 'game', when: (c) => (c.self.team !== undefined && c.self.team !== null ? yes : null) },
  {
    id: 'jail',
    scope: 'game',
    target: 'roll',
    when: (c) =>
      freeTurn(c) && c.self.inJail && c.state.turn.phase === 'roll'
        ? { fine: D.economy.jailFine, turns: D.economy.jailMaxTurns[c.state.config.mode] }
        : null,
  },
  {
    id: 'doubles',
    scope: 'game',
    target: 'roll',
    when: (c) => (freeTurn(c) && c.state.turn.extraRoll && c.state.turn.phase === 'roll' && !c.self.inJail ? yes : null),
  },
  { id: 'roll', scope: 'game', target: 'roll', when: (c) => (freeTurn(c) && c.state.turn.phase === 'roll' ? yes : null) },
  // ------------------------------------------------ growing
  {
    id: 'fullGroup',
    scope: 'game',
    target: 'assets',
    when: (c) => {
      if (!freeTurn(c)) return null;
      const full = groupsOf(c).find(
        ({ ids, mine, own }) =>
          own && mine.length === ids.length && ids.every((id) => c.state.ownables[id].level === 0 && !c.state.ownables[id].mortgaged),
      );
      if (!full) return null;
      const cost = D.ownables[full.ids[0]].buildCost ?? 0;
      return c.self.cash >= cost ? { group: full.g, cost } : null;
    },
  },
  {
    id: 'built',
    scope: 'game',
    target: 'assets',
    when: (c) =>
      freeTurn(c) && ownedBy(c.state, c.self.id).some((id) => c.state.ownables[id].level > 0)
        ? { hotelAt: hotelLevel(c.state) - 1 }
        : null,
  },
  {
    id: 'nearGroup',
    scope: 'game',
    target: 'trade',
    when: (c) => {
      if (c.state.pending) return null;
      for (const { g, ids, mine } of groupsOf(c)) {
        if (ids.length < 2 || mine.length !== ids.length - 1) continue;
        const missing = ids.find((id) => !mine.includes(id))!;
        const owner = c.state.ownables[missing].owner;
        if (owner && owner !== c.self.id) return { group: g, tile: missing, owner: c.name(owner) };
      }
      return null;
    },
  },
  {
    id: 'lowCash',
    scope: 'game',
    target: 'assets',
    when: (c) => {
      if (c.self.cash >= D.economy.goSalary) return null;
      const canMortgage = ownedBy(c.state, c.self.id).some((id) => !c.state.ownables[id].mortgaged && c.state.ownables[id].level === 0);
      return canMortgage ? { rate: Math.round(D.economy.mortgageRate * 100) } : null;
    },
  },
  {
    id: 'mortgaged',
    scope: 'game',
    target: 'assets',
    when: (c) => {
      if (!freeTurn(c)) return null;
      const id = ownedBy(c.state, c.self.id).find(
        (x) => c.state.ownables[x].mortgaged && c.self.cash >= unmortgageCost(c.state, c.self.id, x) + D.economy.goSalary,
      );
      return id ? { tile: id, interest: Math.round(D.economy.unmortgageInterest * 100) } : null;
    },
  },
  {
    id: 'rentIncome',
    scope: 'game',
    when: (c) => {
      for (let i = c.events.length - 1; i >= 0; i--) {
        const e = c.events[i];
        if (e.type === 'payment' && e.kind === 'rent' && (e.to as { id?: string } | undefined)?.id === c.self.id) {
          return { from: c.name(e.from as string), amount: e.amount as number };
        }
      }
      return null;
    },
  },
  {
    id: 'skill',
    scope: 'game',
    target: 'chars skill',
    when: (c) =>
      c.state.config.characters && c.self.character && freeTurn(c) && c.state.turn.phase === 'end' ? { character: c.self.character } : null,
  },
  {
    id: 'endTurn',
    scope: 'game',
    target: 'endTurn',
    when: (c) => (freeTurn(c) && c.state.turn.phase === 'end' ? yes : null),
  },
  { id: 'tileInfo', scope: 'game', target: 'board', when: (c) => (ownedBy(c.state, c.self.id).length > 0 ? yes : null) },
  { id: 'waiting', scope: 'game', target: 'actions', when: (c) => (!c.myTurn && !c.state.pending ? yes : null) },
  // ------------------------------------------------ inside the panels
  {
    id: 'assetsIntro',
    scope: 'assets',
    when: (c) => ({
      hotelAt: hotelLevel(c.state) - 1,
      rate: Math.round(D.economy.mortgageRate * 100),
      interest: Math.round(D.economy.unmortgageInterest * 100),
      sellRate: Math.round(D.economy.buildingSellRate * 100),
      minutes: Math.round((D.config.timers.assetsExtraSec ?? 120) / 60),
    }),
  },
  { id: 'tradeIntro', scope: 'trade', when: () => ({ sec: D.config.timers.tradeOfferSec }) },
];

export const TIP_IDS = TIPS.map((x) => x.id);

export function tipById(id: string): Tip | undefined {
  return TIPS.find((x) => x.id === id);
}

/** The tip to show now in this scope: the first one that applies and has not been seen. */
export function nextTip(c: TipCtx, scope: TipScope, seen: ReadonlySet<string>): { tip: Tip; params: TipParams } | null {
  if (c.self.bankrupt || c.state.status !== 'playing') return null;
  for (const tip of TIPS) {
    if (tip.scope !== scope || seen.has(tip.id)) continue;
    const params = tip.when(c);
    if (params) return { tip, params };
  }
  return null;
}
