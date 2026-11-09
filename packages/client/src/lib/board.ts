import { D } from './gameData';

export type Side = 'bottom' | 'right' | 'top' | 'left' | 'corner';

/** Tiles between two corners (9 on the 40-tile board, 11 on the 48-tile one). */
export const sideLength = (tiles: number = D.board.length): number => (tiles - 4) / 4;

/**
 * Square grid (side + 2 cells), classic layout players know: GO bottom-right, then
 * left along the bottom, up the left side, right along the top, down the right side.
 */
export function tileCell(pos: number, tiles: number = D.board.length): { row: number; col: number; side: Side } {
  const n = sideLength(tiles) + 1; // last row / column index
  if (pos === 0) return { row: n, col: n, side: 'corner' };
  if (pos < n) return { row: n, col: n - pos, side: 'bottom' };
  if (pos === n) return { row: n, col: 0, side: 'corner' };
  if (pos < 2 * n) return { row: n - (pos - n), col: 0, side: 'left' };
  if (pos === 2 * n) return { row: 0, col: 0, side: 'corner' };
  if (pos < 3 * n) return { row: 0, col: pos - 2 * n, side: 'top' };
  if (pos === 3 * n) return { row: 0, col: n, side: 'corner' };
  return { row: pos - 3 * n, col: n, side: 'right' };
}

export const groupColor = (group?: string): string | undefined => (group ? D.groups[group]?.color : undefined);

/** Token colours for up to 6 players (seat order). */
export const PLAYER_COLORS = ['#B8312F', '#2E4A7D', '#5F7F3A', '#E3A72F', '#7A3E9D', '#2B2522'];

export const ownableIds = (): string[] => Object.keys(D.ownables);

/** Ownables grouped for the asset / trade screens: colour groups, then transport, utility. */
export function groupedOwnables(ids: string[]): { key: string; ids: string[] }[] {
  const out: { key: string; ids: string[] }[] = [];
  for (const key of [...Object.keys(D.groups), 'transport', 'utility']) {
    const inGroup = ids
      .filter((id) => (D.ownables[id].group ?? D.ownables[id].kind) === key)
      .sort((a, b) => D.ownables[a].position - D.ownables[b].position);
    if (inGroup.length) out.push({ key, ids: inGroup });
  }
  return out;
}
