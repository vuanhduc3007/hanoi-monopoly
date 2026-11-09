import { dataFor, type BoardId, type GameData } from '@hanoi-monopoly/engine';

let current: GameData = dataFor('standard');

/** Switch the board every screen reads (set from the game state as it arrives). */
export function setBoard(board: BoardId | undefined): void {
  const next = dataFor(board);
  if (next !== current) current = next;
}

export const currentBoard = (): BoardId => current.id;

/**
 * Game data for the board being played. A live view: property reads always go to the
 * current board, so modules can keep `D.board[...]` style lookups.
 */
export const D: GameData = new Proxy({} as GameData, {
  get: (_t, key) => current[key as keyof GameData],
});
