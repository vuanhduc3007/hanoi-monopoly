import { describe, expect, it } from 'vitest';
import { applyAction, createGame, RuleError, type GameState } from '../src';
import { D } from './helpers';

/** Very small bot: buys when it keeps ≥ 200, builds when it can, otherwise lets timers expire. */
function step(s: GameState, k: number): GameState {
  const pend = s.pending;
  const cur = s.players[s.turn.current];
  const tryDo = (a: Parameters<typeof applyAction>[1]) => {
    try {
      return applyAction(s, a).state;
    } catch (e) {
      if (e instanceof RuleError) return null;
      throw e;
    }
  };
  if (pend?.type === 'buy') {
    const p = s.players.find((x) => x.id === pend.player)!;
    if (p.cash - pend.price >= 200) return applyAction(s, { type: 'buy', player: p.id }).state;
  }
  if (pend?.type === 'auction' && !pend.highBidder && k % 2 === 0) {
    const bidder = s.players.find((x) => pend.eligible.includes(x.id) && x.cash > 300);
    if (bidder) return applyAction(s, { type: 'bid', player: bidder.id, amount: 10 }).state;
  }
  if (!pend && k % 3 === 0) {
    for (const id of Object.keys(D.ownables)) {
      if (s.ownables[id].owner !== cur.id) continue;
      const next = tryDo({ type: 'build', player: cur.id, propertyId: id });
      if (next) return next;
    }
  }
  return applyAction(s, { type: 'timeout' }).state;
}

describe('random self-play', () => {
  it('keeps invariants over many seeded games', { timeout: 60_000 }, () => {
    const chars = Object.keys(D.characters);
    let finished = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const board = (['standard', 'extended', 'large'] as const)[seed % 3];
      const n = board === 'large' ? 7 + (seed % 2) : 2 + (seed % 5);
      const mode = seed % 4 === 0 ? 'quick' : 'classic';
      const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, character: chars[(seed + i) % chars.length] }));
      let s = createGame({ players, seed, config: { mode, board } }).state;
      for (let k = 0; k < 2500 && s.status === 'playing'; k++) {
        s = step(s, k);
        if (k % 5 !== 0) continue;
        for (const p of s.players) {
          if (!p.bankrupt) expect(p.cash, `seed ${seed} step ${k}`).toBeGreaterThanOrEqual(0);
        }
        for (const [id, own] of Object.entries(s.ownables)) {
          if (own.owner) expect(s.players.find((p) => p.id === own.owner)!.bankrupt, id).toBe(false);
          expect(own.level).toBeGreaterThanOrEqual(0);
        }
        const cards = s.decks.chance.length + s.decks.community.length + s.decks.event.length;
        const kept = s.players.reduce((a, p) => a + p.jailCards.length, 0);
        const inHand = s.pending?.type === 'chooseCard' ? 2 : s.pending?.type === 'revealCard' ? 1 : 0;
        expect(cards + kept + inHand, `seed ${seed} step ${k}`).toBe(Object.keys(D.cards).length);
      }
      expect(s.fund).toBeGreaterThanOrEqual(0);
      if (s.status === 'over') finished++;
    }
    expect(finished).toBeGreaterThan(0);
  });
});
