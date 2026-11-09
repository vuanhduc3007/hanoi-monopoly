/** Pure helpers for token movement on the 3D layer (tested). */

import { D } from '../lib/gameData';

/**
 * Tiles a token walks through from `from` to `to` (excluding `from`).
 * Normal moves walk forward; a short step back (CH09) walks back; anything
 * else (jail, long card jumps) is a direct hop.
 */
export function walkPath(from: number, to: number, jumped = false, TILES: number = D.board.length): { tiles: number[]; direct: boolean } {
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

// ---------------------------------------------------------------- choreography

/** How long the dice take to fall and settle before anyone moves. */
export const DICE_MS = 1100;

/** One step of a piece's choreography. */
export interface Step {
  tile: number;
  mode: 'walk' | 'hop' | 'pause';
  ms?: number;
  /** Pause with the police beacon (CSGT thổi còi) before going to jail. */
  arrest?: boolean;
}

interface EventLike {
  type: string;
  [key: string]: unknown;
}

/**
 * Turns one server update's events into dice + per-player steps:
 * walk the dice move (or card move) tile by tile, and for "jailed" first
 * stop where the player was caught, show the arrest, then hop to jail.
 */
export function planFromEvents(
  events: EventLike[],
  positions: Record<string, number>,
  jailTile: number,
): { dice?: number[]; steps: Record<string, Step[]> } {
  const pos = { ...positions };
  const steps: Record<string, Step[]> = {};
  let dice: number[] | undefined;
  const push = (id: string, ...s: Step[]) => (steps[id] ??= []).push(...s);
  for (const e of events) {
    const id = e.player as string;
    switch (e.type) {
      case 'diceRolled':
        if (e.purpose === 'normal' || e.purpose === 'jail' || e.purpose === 'reroll') dice = e.dice as number[];
        break;
      case 'moved': {
        const from = (e.from as number) ?? pos[id];
        const to = e.to as number;
        const back = (e.steps as number) < 0;
        const { tiles, direct } = back ? walkPath(from, to) : walkPath(from, to, false);
        if (direct) push(id, { tile: to, mode: 'hop' });
        else push(id, ...tiles.map((tile) => ({ tile, mode: 'walk' as const })));
        pos[id] = to;
        break;
      }
      case 'jailed':
        push(id, { tile: pos[id] ?? jailTile, mode: 'pause', arrest: true }, { tile: jailTile, mode: 'hop' });
        pos[id] = jailTile;
        break;
    }
  }
  return { dice, steps };
}
