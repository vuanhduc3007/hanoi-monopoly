import { characterFor, dataFor, type BoardId, type CharacterDef, type GameData } from '@hanoi-monopoly/engine';

let current: GameData = dataFor('standard');
let players = 4;

/** Number of players at the table (characters have different numbers for 2–3 players). */
export function setTablePlayers(n: number): void {
  if (n > 0) players = n;
}

export const tablePlayers = (): number => players;

/** A character as it plays at the current table size. */
export function charOf(id: string, n: number = players): CharacterDef {
  return characterFor(current, id, n);
}

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
