import { characterFor, dataFor, type BoardId, type CharacterDef, type GameData, type TableKind } from '@hanoi-monopoly/engine';

let current: GameData = dataFor('standard');
let players = 4;

/** Number of players at the table (characters have different numbers for 2–3 players). */
export function setTablePlayers(n: number): void {
  if (n > 0) players = n;
}

export const tablePlayers = (): number => players;

/** Team games: players per team (the opponents of a player are the other teams). 0 = no teams. */
let teamSize = 0;
export function setTeamSize(n: number): void {
  teamSize = n;
}
/** How many opponents a player has at this table. */
export const tableOpponents = (): number => Math.max(1, players - Math.max(1, teamSize));

/** Game mode and team-ness of the table (characters can have their own numbers for them). */
let kind: TableKind = {};
export function setTableKind(k: TableKind): void {
  kind = k;
}
export const tableKind = (): TableKind => kind;

/** A character as it plays at the current table size, mode and teams. */
export function charOf(id: string, n: number = players): CharacterDef {
  return characterFor(current, id, n, kind);
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
