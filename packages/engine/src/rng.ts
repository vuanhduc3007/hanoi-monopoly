import type { GameState } from './types';

/** mulberry32 — the RNG state lives inside GameState so applyAction stays pure. */
export function nextRandom(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rollDie(s: GameState): number {
  const rigged = s.riggedDice.shift();
  if (rigged !== undefined) return rigged;
  return Math.floor(nextRandom(s) * 6) + 1;
}

export function rollDice(s: GameState, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(rollDie(s));
  return out;
}

export function shuffle<T>(s: GameState, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomInt(s: GameState, maxExclusive: number): number {
  return Math.floor(nextRandom(s) * maxExclusive);
}
