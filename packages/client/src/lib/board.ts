import { defaultData as D } from '@hanoi-monopoly/engine';

export type Side = 'bottom' | 'right' | 'top' | 'left' | 'corner';

/**
 * 11×11 grid. GO bottom-left, movement counter-clockwise on screen (GDD §2):
 * along the bottom to the right, up the right side, along the top to the left,
 * down the left side.
 */
export function tileCell(pos: number): { row: number; col: number; side: Side } {
  if (pos === 0) return { row: 10, col: 0, side: 'corner' };
  if (pos < 10) return { row: 10, col: pos, side: 'bottom' };
  if (pos === 10) return { row: 10, col: 10, side: 'corner' };
  if (pos < 20) return { row: 10 - (pos - 10), col: 10, side: 'right' };
  if (pos === 20) return { row: 0, col: 10, side: 'corner' };
  if (pos < 30) return { row: 0, col: 10 - (pos - 20), side: 'top' };
  if (pos === 30) return { row: 0, col: 0, side: 'corner' };
  return { row: pos - 30, col: 0, side: 'left' };
}

export const groupColor = (group?: string): string | undefined => (group ? D.groups[group]?.color : undefined);

/** Token colours for up to 6 players (seat order). */
export const PLAYER_COLORS = ['#B8312F', '#2E4A7D', '#5F7F3A', '#E3A72F', '#7A3E9D', '#2B2522'];

export const ownableIds = Object.keys(D.ownables);

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
