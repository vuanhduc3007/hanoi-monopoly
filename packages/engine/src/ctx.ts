import type { GameData, OwnableDef } from './data';
import {
  RuleError,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PlayerState,
  type Task,
} from './types';

/** Mutable working context for one applyAction call (state is a private clone). */
export interface Ctx {
  s: GameState;
  ev: GameEvent[];
  d: GameData;
}

export function fail(message: string): never {
  throw new RuleError(message);
}

export function emit(c: Ctx, type: string, payload: Record<string, unknown> = {}): void {
  c.ev.push({ type, ...payload });
}

export function pushFront(c: Ctx, ...tasks: Task[]): void {
  c.s.queue.unshift(...tasks);
}

export function getPlayer(c: Ctx, id: PlayerId): PlayerState {
  const p = c.s.players.find((x) => x.id === id);
  if (!p) fail(`Unknown player ${id}`);
  return p;
}

export function activePlayers(c: Ctx): PlayerState[] {
  return c.s.players.filter((p) => !p.bankrupt);
}

/** Active players in turn order starting from `fromId` (inclusive). */
export function playersFrom(c: Ctx, fromId: PlayerId): PlayerState[] {
  const idx = c.s.players.findIndex((p) => p.id === fromId);
  const ordered = [...c.s.players.slice(idx), ...c.s.players.slice(0, idx)];
  return ordered.filter((p) => !p.bankrupt);
}

export function currentPlayer(c: Ctx): PlayerState {
  return c.s.players[c.s.turn.current];
}

export function ownableDef(c: Ctx, id: string): OwnableDef {
  const def = c.d.ownables[id];
  if (!def) fail(`Unknown ownable ${id}`);
  return def;
}

export function ownedBy(c: Ctx, playerId: PlayerId): string[] {
  return Object.keys(c.s.ownables).filter((id) => c.s.ownables[id].owner === playerId);
}

export function groupProperties(c: Ctx, group: string): string[] {
  return c.d.groups[group]?.properties ?? [];
}

export function ownsFullGroup(c: Ctx, playerId: PlayerId, group: string): boolean {
  const props = groupProperties(c, group);
  return props.length > 0 && props.every((id) => c.s.ownables[id].owner === playerId);
}

export function housesForHotel(c: Ctx): number {
  return c.d.economy.housesForHotel[c.s.config.mode];
}

export function hotelLevel(c: Ctx): number {
  return housesForHotel(c) + 1;
}

export function jailMaxTurns(c: Ctx): number {
  return c.d.economy.jailMaxTurns[c.s.config.mode];
}

/** Houses and hotels standing on a property. */
export function buildingsOn(c: Ctx, id: string): { houses: number; hotels: number } {
  const level = c.s.ownables[id].level;
  if (level === hotelLevel(c)) return { houses: 0, hotels: 1 };
  return { houses: level, hotels: 0 };
}

export function countBuildings(c: Ctx, playerId: PlayerId): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const id of ownedBy(c, playerId)) {
    const b = buildingsOn(c, id);
    houses += b.houses;
    hotels += b.hotels;
  }
  return { houses, hotels };
}

/**
 * Buildings anywhere in the colour group — or, with `owner`, on that owner's tiles of it
 * (a group can be shared when Thợ xây builds without the full group).
 */
export function groupHasBuildings(c: Ctx, group: string | undefined, owner?: PlayerId): boolean {
  if (!group) return false;
  return groupProperties(c, group).some(
    (id) => c.s.ownables[id].level > 0 && (owner === undefined || c.s.ownables[id].owner === owner),
  );
}

export function isMyTurn(c: Ctx, playerId: PlayerId): boolean {
  return currentPlayer(c).id === playerId;
}

export function nextUid(c: Ctx): number {
  return c.s.nextUid++;
}
