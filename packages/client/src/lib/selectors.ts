import { type PlayerState, type PublicState } from '@hanoi-monopoly/engine';
import { charOf, D } from './gameData';
import { t, type Who } from '../i18n/vi';
import type { RoomView } from '../net/protocol';
import { PLAYER_COLORS, TEAM_COLORS } from './board';

export function nameOf(room: RoomView | null, id: string | null | undefined): string {
  if (!id) return '';
  const i = room?.seats.findIndex((s) => s.id === id) ?? -1;
  if (i < 0) return id;
  return room!.seats[i].name ?? t.defaultName(i + 1);
}

export function colorOf(room: RoomView | null, id: string): string {
  const i = room?.seats.findIndex((s) => s.id === id) ?? 0;
  return PLAYER_COLORS[Math.max(0, i) % PLAYER_COLORS.length];
}

/**
 * Colour of an owner's flags and buildings: in team games the team colour, so a colour
 * group held by teammates together reads as one; otherwise the player's own colour.
 */
export function ownerColorOf(room: RoomView | null, state: PublicState | null, id: string): string {
  const team = state?.players.find((p) => p.id === id)?.team;
  return team !== undefined && team !== null ? TEAM_COLORS[team % TEAM_COLORS.length] : colorOf(room, id);
}

/** Tile is owned by this player or a teammate. */
export function ownedBySide(state: PublicState, id: string, playerId: string): boolean {
  const owner = state.ownables[id]?.owner;
  return !!owner && (owner === playerId || teammates(state, owner, playerId));
}

export function who(room: RoomView | null, state: PublicState | null): Who {
  return {
    name: (id) => nameOf(room, id),
    character: (id) => state?.players.find((p) => p.id === id)?.character ?? null,
  };
}

export function me(room: RoomView | null, state: PublicState | null): PlayerState | null {
  if (!room?.you || !state) return null;
  return state.players.find((p) => p.id === room.you) ?? null;
}

/** Two different players on the same team (team games only). */
export function teammates(state: PublicState, a: string, b: string): boolean {
  if (a === b) return false;
  const ta = state.players.find((p) => p.id === a)?.team;
  return ta !== undefined && ta === state.players.find((p) => p.id === b)?.team;
}

export function currentPlayer(state: PublicState): PlayerState {
  return state.players[state.turn.current];
}

export function isMyTurn(room: RoomView | null, state: PublicState | null): boolean {
  return !!state && !!room?.you && currentPlayer(state).id === room.you && state.status === 'playing';
}

/** Who the game waits for (null during auctions and Mở sòng — several players act at once). */
export function waitingFor(state: PublicState): string | null {
  if (state.status !== 'playing') return null;
  if (state.pending) return state.pending.type === 'auction' || state.pending.type === 'sicboBet' ? null : state.pending.player;
  return currentPlayer(state).id;
}

export function skillOf(character: string | null) {
  return character && D.characters[character] ? charOf(character).skill : undefined;
}

export function hasTrait(character: string | null, type: string) {
  if (!character || !D.characters[character]) return undefined;
  const c = charOf(character);
  return [...c.passives, ...c.drawbacks].find((x) => x.type === type);
}

/** Display-only: interest rate currently applied to unmortgaging (EV14 / EV29). */
export function interestRate(state: PublicState, playerId: string): number {
  const list = state.activeEffects.filter(
    (e) => e.effect.type === 'unmortgage_interest' && !e.exempt.includes(playerId),
  );
  return list.length ? (list[list.length - 1].effect.value as number) : D.economy.unmortgageInterest;
}

export function unmortgageCost(state: PublicState, playerId: string, id: string): number {
  const m = D.ownables[id].mortgage;
  return m + Math.ceil(m * interestRate(state, playerId) - 1e-9);
}

export function hotelLevel(state: PublicState): number {
  return D.economy.housesForHotel[state.config.mode] + 1;
}

/** The player and (team games) his living teammates. */
export function sideMembers(state: PublicState, playerId: string): PlayerState[] {
  return state.players.filter((p) => p.id === playerId || (!p.bankrupt && teammates(state, p.id, playerId)));
}

/** Tiles of the player's side: his own plus (team games) his teammates'. */
export function sideTiles(state: PublicState, playerId: string): string[] {
  return Object.keys(state.ownables).filter((id) => ownedBySide(state, id, playerId));
}

/** Trade offers this player's side may answer (in team games: sent to any member). */
export function offersFor(state: PublicState, playerId: string) {
  return state.trades.filter((x) => x.to === playerId || teammates(state, x.to, playerId));
}

export function ownedBy(state: PublicState, playerId: string): string[] {
  return Object.keys(state.ownables).filter((id) => state.ownables[id].owner === playerId);
}
