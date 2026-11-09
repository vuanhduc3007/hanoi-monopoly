import { applyAction, createGame, dataFor, type GameData, type GameState } from '@hanoi-monopoly/engine';
import type { GameLog } from './controller';

/** Rebuilds the final state of a game from its log (seed + actions). */
export function replay(log: GameLog, data?: GameData): GameState {
  const d = data ?? dataFor(log.config.board);
  let s = createGame(
    { players: log.players.map((p) => ({ id: p.id, name: p.name ?? undefined, character: p.character })), seed: log.seed, config: log.config },
    d,
  ).state;
  for (const { action } of log.actions) s = applyAction(s, action, d).state;
  return s;
}
