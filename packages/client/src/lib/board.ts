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

// ---------------------------------------------------------------- hexagon (8 players)

/** Height / width of a flat-top regular hexagon. */
export const HEX_H = Math.sqrt(3) / 2;
/** Vertices in board-width units, starting at GO (bottom-right) and going clockwise on screen: left along the bottom first. */
const HEX_V: [number, number][] = [
  [0.75, HEX_H],
  [0.25, HEX_H],
  [0, HEX_H / 2],
  [0.25, 0],
  [0.75, 0],
  [1, HEX_H / 2],
];
const HEX_C: [number, number] = [0.5, HEX_H / 2];
/** Share of each edge left free for the corner tiles at both ends. */
const HEX_CORNER = 0.15;
/** Tile depth (towards the centre), in board widths. */
export const HEX_DEPTH = 0.085;

export interface HexPlace {
  /** Centre, in board widths (x) and board widths (y; the board is HEX_H tall). */
  x: number;
  y: number;
  /** Size along the edge and towards the centre, in board widths. */
  w: number;
  h: number;
  /** Degrees; text never ends up upside down. */
  angle: number;
  corner: boolean;
  /** The inner (colour band) side is at the bottom of the rotated tile. */
  flip: boolean;
}

/** Where tile `pos` sits on the hexagon: six corners every tiles/6, the rest along the edges facing the centre. */
export function hexPlace(pos: number, tiles: number = D.board.length): HexPlace {
  const per = tiles / 6;
  const side = Math.floor(pos / per);
  const k = pos % per;
  const [ax, ay] = HEX_V[side];
  if (k === 0) {
    const dx = HEX_C[0] - ax;
    const dy = HEX_C[1] - ay;
    const len = Math.hypot(dx, dy);
    const size = HEX_DEPTH * 1.3;
    return { x: ax + (dx / len) * size * 0.72, y: ay + (dy / len) * size * 0.72, w: size, h: size, angle: 0, corner: true, flip: false };
  }
  const [bx, by] = HEX_V[(side + 1) % 6];
  const L = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  let nx = -uy;
  let ny = ux;
  if ((HEX_C[0] - ax) * nx + (HEX_C[1] - ay) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const span = 1 - 2 * HEX_CORNER;
  const t = HEX_CORNER + ((k - 0.5) * span) / (per - 1);
  let angle = (Math.atan2(nx, -ny) * 180) / Math.PI;
  let flip = false;
  if (angle > 90.5 || angle < -90.5) {
    angle -= Math.sign(angle) * 180;
    flip = true;
  }
  return {
    x: ax + ux * L * t + (nx * HEX_DEPTH) / 2,
    y: ay + uy * L * t + (ny * HEX_DEPTH) / 2,
    w: (L * span) / (per - 1),
    h: HEX_DEPTH,
    angle: Math.round(angle * 100) / 100 + 0,
    corner: false,
    flip,
  };
}

export const groupColor = (group?: string): string | undefined => (group ? D.groups[group]?.color : undefined);

/** Token colours for up to 6 players (seat order). */
export const PLAYER_COLORS = ['#B8312F', '#2E4A7D', '#5F7F3A', '#E3A72F', '#7A3E9D', '#2B2522', '#1F8A8A', '#D96C9E'];

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
