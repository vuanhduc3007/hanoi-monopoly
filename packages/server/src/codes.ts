import { randomInt } from 'node:crypto';

/** No I, O, 0, 1 — easy to read aloud and type. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const active = new Set<string>();

/** Allocates a unique room code for this process (multi-process deployments need shared presence). */
export function allocateCode(length: number, rand: (n: number) => number = randomInt): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < length; i++) code += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
    if (!active.has(code)) {
      active.add(code);
      return code;
    }
  }
  throw new Error('Could not allocate a room code');
}

export function releaseCode(code: string): void {
  active.delete(code);
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}
