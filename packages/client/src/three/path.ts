/** Pure helpers for token movement on the 3D layer (tested). */

export const TILES = 40;

/**
 * Tiles a token walks through from `from` to `to` (excluding `from`).
 * Normal moves walk forward; a short step back (CH09) walks back; anything
 * else (jail, long card jumps) is a direct hop.
 */
export function walkPath(from: number, to: number, jumped = false): { tiles: number[]; direct: boolean } {
  if (from === to) return { tiles: [], direct: false };
  const forward = (to - from + TILES) % TILES;
  const backward = (from - to + TILES) % TILES;
  if (!jumped && forward <= 28) {
    return { tiles: Array.from({ length: forward }, (_, i) => (from + i + 1) % TILES), direct: false };
  }
  if (!jumped && backward <= 3) {
    return { tiles: Array.from({ length: backward }, (_, i) => (from - i - 1 + TILES) % TILES), direct: false };
  }
  return { tiles: [to], direct: true };
}

/** Offset (in tile fractions) of the i-th of n tokens sharing a tile. */
export function slotOffset(i: number, n: number): { dx: number; dy: number } {
  if (n <= 1) return { dx: 0, dy: 0 };
  const r = n <= 2 ? 0.2 : 0.26;
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.7 };
}

/** Per-step duration so long walks stay under ~1.6 s. */
export function stepMs(steps: number): number {
  return Math.max(70, Math.min(230, 1600 / Math.max(1, steps)));
}

/** Small overshoot ease for buildings popping up. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
