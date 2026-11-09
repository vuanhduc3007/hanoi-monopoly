import type { DeckName, GameState } from './types';

/** What clients may see: no deck order, RNG state or seed (they would reveal future dice and cards). */
export type PublicState = Omit<GameState, 'decks' | 'rng' | 'seed' | 'riggedDice' | 'queue'> & {
  deckSizes: Record<DeckName, number>;
  /** Revealed once the game is over, for replays. */
  seed: number | null;
};

export function publicView(s: GameState): PublicState {
  const { decks, rng: _rng, seed, riggedDice: _r, queue: _q, ...rest } = s;
  const view = JSON.parse(JSON.stringify(rest));
  // The card under a face-down draw stays secret until it is flipped.
  if (view.pending?.type === 'revealCard') view.pending.cardId = '';
  return {
    ...view,
    deckSizes: { chance: decks.chance.length, community: decks.community.length, event: decks.event.length },
    seed: s.status === 'over' ? seed : null,
  };
}
