import boardJson from '../../../data/board.json';
import boardExtendedJson from '../../../data/board-extended.json';
import economyJson from '../../../data/economy.json';
import cardsJson from '../../../data/cards.json';
import charactersJson from '../../../data/characters.json';
import configJson from '../../../data/config.json';
import type { BoardId, DeckName, Effect } from './types';

export type TileType = 'corner' | 'property' | 'transport' | 'utility' | 'card' | 'tax';

export interface TileDef {
  position: number;
  type: TileType;
  ref: string;
  name: string;
}

export interface RentTable {
  base: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  hotel: number;
}

export interface OwnableDef {
  id: string;
  kind: 'property' | 'transport' | 'utility';
  position: number;
  name: string;
  price: number;
  mortgage: number;
  group?: string;
  rent?: RentTable;
  buildCost?: number;
}

export interface GroupDef {
  name: string;
  color: string;
  properties: string[];
}

export interface CardDef {
  id: string;
  name: string;
  effect: Effect;
  keep?: boolean;
  kind?: 'instant' | 'duration';
  deck: DeckName;
}

export interface CharacterDef {
  id: string;
  name: string;
  passives: Effect[];
  drawbacks: Effect[];
  skill: Effect & { name: string };
}

export interface Economy {
  currency: string;
  startingCash: number;
  goSalary: number;
  /** Added to every salary (incl. character overrides) on longer boards. */
  goSalaryBonus?: number;
  taxes: Record<string, number>;
  jailFine: number;
  jailMaxTurns: Record<'classic' | 'quick', number>;
  mortgageRate: number;
  unmortgageInterest: number;
  buildingSellRate: number;
  monopolyBaseRentMultiplier: number;
  buildingLimit: { houses: number; hotels: number };
  transportRent: number[];
  utilityMultiplier: Record<string, number>;
  housesForHotel: Record<'classic' | 'quick', number>;
  auction: { startBid: number; minIncrement: number; timerSec: number; resetSec: number };
}

export interface CardRules {
  unownedPaymentsGoTo: string;
  selfPaymentSkipped: boolean;
  cardPaymentsToBankGoToFundWhenEnabled: boolean;
  durationEndsAt: string;
  tripleDoubleDrawsEvent: boolean;
}

export interface RoomConfigData {
  room: {
    modes: string[];
    maxPlayers: number;
    minPlayers: number;
    defaults: {
      mode: 'classic' | 'quick';
      characters: boolean;
      scholarshipFund: Record<'classic' | 'quick', boolean>;
      buildingLimit: boolean;
      allowSpectators: boolean;
      /** 'auto' picks the extended board from `extendedBoardFromPlayers` seats. */
      board: BoardId | 'auto';
    };
    roomCodeLength: number;
    boards: BoardId[];
    extendedBoardFromPlayers: number;
  };
  timers: Record<string, number>;
  quickMode: {
    dealPropertiesPerPlayer: number;
    housesForHotel: number;
    jailMaxTurns: number;
    timeLimitMin: number;
    endWhenBankrupt: number;
    scoring: string;
  };
  fund: { inflows: string[]; payout: string; start: number };
}

export interface GameData {
  /** Which board this data describes. */
  id: BoardId;
  board: TileDef[];
  groups: Record<string, GroupDef>;
  ownables: Record<string, OwnableDef>;
  economy: Economy;
  cardRules: CardRules;
  decks: Record<DeckName, CardDef[]>;
  cards: Record<string, CardDef>;
  characters: Record<string, CharacterDef>;
  characterRules: CharacterRules;
  config: RoomConfigData;
}

export interface CharacterRules {
  pickOrder: string;
  unique: boolean;
  pickTimerSec: number;
  skillUsesPerGame: number;
  /** Skills recharge this many of the player's own turns after use (0 = once per game). */
  skillCooldownRounds: number;
  discountsApplyTo: string;
}

export interface RawData {
  board: unknown;
  economy: unknown;
  cards: unknown;
  characters: unknown;
  config: unknown;
}

/** Normalises the raw JSON files into lookup tables the engine uses. */
export function buildGameData(raw: RawData): GameData {
  const board = raw.board as {
    id?: BoardId;
    /** Board-specific economy overrides (salary, transport rents, building stock). */
    economy?: Partial<Economy>;
    board: TileDef[];
    groups: Record<string, GroupDef>;
    properties: Omit<OwnableDef, 'kind'>[];
    transports: Omit<OwnableDef, 'kind'>[];
    utilities: Omit<OwnableDef, 'kind'>[];
  };
  const ownables: Record<string, OwnableDef> = {};
  for (const p of board.properties) ownables[p.id] = { ...p, kind: 'property' };
  for (const t of board.transports) ownables[t.id] = { ...t, kind: 'transport' };
  for (const u of board.utilities) ownables[u.id] = { ...u, kind: 'utility' };

  const cardsRaw = raw.cards as {
    rules: CardRules;
    chance: Omit<CardDef, 'deck'>[];
    community: Omit<CardDef, 'deck'>[];
    event: Omit<CardDef, 'deck'>[];
  };
  const decks = {} as Record<DeckName, CardDef[]>;
  const cards: Record<string, CardDef> = {};
  for (const deck of ['chance', 'community', 'event'] as DeckName[]) {
    decks[deck] = cardsRaw[deck].map((c) => ({ ...c, deck }));
    for (const c of decks[deck]) cards[c.id] = c;
  }

  const chars = raw.characters as { rules: CharacterRules; characters: CharacterDef[] };
  const characters: Record<string, CharacterDef> = {};
  for (const ch of chars.characters) characters[ch.id] = ch;

  return {
    id: board.id ?? 'standard',
    board: board.board,
    groups: board.groups,
    ownables,
    economy: { ...(raw.economy as Economy), ...(board.economy ?? {}) },
    cardRules: cardsRaw.rules,
    decks,
    cards,
    characters,
    characterRules: chars.rules,
    config: raw.config as RoomConfigData,
  };
}

export const defaultData: GameData = buildGameData({
  board: boardJson,
  economy: economyJson,
  cards: cardsJson,
  characters: charactersJson,
  config: configJson,
});

/** 48-tile board for 5–6 players: two more colour groups, a fifth transport, a third Hanoi Event. */
export const extendedData: GameData = buildGameData({
  board: boardExtendedJson,
  economy: economyJson,
  cards: cardsJson,
  characters: charactersJson,
  config: configJson,
});

export const BOARDS: Record<BoardId, GameData> = { standard: defaultData, extended: extendedData };

/** Game data for a board (states without a board field are standard games). */
export function dataFor(board: BoardId | undefined): GameData {
  return BOARDS[board ?? 'standard'] ?? defaultData;
}
