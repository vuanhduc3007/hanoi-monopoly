export type PlayerId = string;
export type DeckName = 'chance' | 'community' | 'event';
export type Mode = 'classic' | 'quick';
/** standard = 40 tiles (GDD §2), extended = 48 tiles for 5–6 players, large = 56 tiles for 7–8. */
export type BoardId = 'standard' | 'extended' | 'large';
/** Tài xỉu bet. */
export type SicboPick = 'tai' | 'xiu';

export interface GameConfig {
  mode: Mode;
  /** Board layout (default standard). */
  board?: BoardId;
  /** Character system on/off ("Cổ điển" = off). */
  characters: boolean;
  /** Quỹ khuyến học. */
  scholarshipFund: boolean;
  /** 32 houses / 12 hotels stock. */
  buildingLimit: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  character: string | null;
  cash: number;
  position: number;
  inJail: boolean;
  /** Failed attempts to roll out of jail during the current stay. */
  jailTurns: number;
  /** Kept cards (CH11). */
  jailCards: string[];
  bankrupt: boolean;
  /** One-shot character skill already consumed. */
  skillUsed: boolean;
  /** Own turns left until a used skill is ready again (rechargeable skills only). */
  skillCooldown?: number;
  /** How many times this player has collected GO salary. */
  goPasses: number;
  /** Tài xế Grab: ±1 step already used this lap. */
  lapAdjustUsed: boolean;
  /** Tài xế Grab: ±1 uses this game (for an optional `maxUses`). */
  adjustUses: number;
  doublesCount: number;
  /** Team games only: players sharing a team never pay each other and win together. */
  team?: number;
}

export interface OwnableState {
  owner: PlayerId | null;
  mortgaged: boolean;
  /** 0 = empty, 1..H = houses, H+1 = hotel (H = housesForHotel of the mode). */
  level: number;
}

/** Card / character effect description, straight from JSON. */
export type Effect = { type: string; [key: string]: any };

export interface ActiveEffect {
  uid: number;
  source: { kind: 'card'; cardId: string } | { kind: 'skill'; character: string };
  /** The player whose next turn start ends this effect. */
  activator: PlayerId;
  effect: Effect;
  /** Players for whom the effect is cancelled (Giải hạn). */
  exempt: PlayerId[];
}

export type PayTarget = { kind: 'player'; id: PlayerId } | { kind: 'bank' } | { kind: 'fund' };

export type PayKind =
  | 'rent'
  | 'card'
  | 'tax'
  | 'fee'
  | 'jail'
  | 'interest'
  | 'other';

export interface PayTask {
  t: 'pay';
  from: PlayerId;
  to: PayTarget;
  amount: number;
  kind: PayKind;
  reason: string;
  /** For rent: the property owner (receives Idol bonus). */
  owner?: PlayerId;
  /** Con bạc already chose whether to gamble on this payment. */
  gambled?: boolean;
}

export interface LandContext {
  /** CH06/CH07: transport rent multiplier. */
  transportMultiplier?: number;
  /** CH08: pay N × fresh dice roll at utility. */
  utilityRollMultiplier?: number;
}

export type Task =
  | PayTask
  | { t: 'move'; player: PlayerId; steps: number }
  | { t: 'moveTo'; player: PlayerId; position: number; ctx?: LandContext }
  | { t: 'land'; player: PlayerId; ctx?: LandContext }
  | { t: 'rent'; player: PlayerId; propertyId: string; ctx?: LandContext }
  | { t: 'drawCard'; player: PlayerId; deck: DeckName }
  | { t: 'resolveCard'; player: PlayerId; cardId: string; exempt: PlayerId[] }
  | { t: 'effect'; player: PlayerId; cardId: string; effect: Effect; exempt: PlayerId[] }
  | { t: 'returnCard'; cardId: string }
  | { t: 'goToJail'; player: PlayerId }
  | { t: 'leaveJail'; player: PlayerId }
  | { t: 'offerBuy'; player: PlayerId; propertyId: string }
  | { t: 'auction'; propertyId: string }
  | { t: 'gain'; player: PlayerId; amount: number; reason: string }
  | { t: 'inheritMortgage'; player: PlayerId; propertyId: string }
  | { t: 'afterRoll'; player: PlayerId };

export type Pending =
  | { type: 'buy'; player: PlayerId; propertyId: string; price: number }
  | {
      type: 'auction';
      propertyId: string;
      highBid: number;
      highBidder: PlayerId | null;
      eligible: PlayerId[];
    }
  | { type: 'postRoll'; player: PlayerId; dice: number[]; context: 'normal' | 'jail' }
  | { type: 'chooseCard'; player: PlayerId; deck: DeckName; options: string[] }
  /** Landed on someone's property: the payer presses "Trả tiền" (or uses Ăn vạ when `discount`). */
  | { type: 'payRent'; player: PlayerId; task: PayTask; raw: number; propertyId: string; discount: boolean }
  /** A card is drawn face down; the drawer flips it (its effect applies after). */
  | { type: 'revealCard'; player: PlayerId; deck: DeckName; cardId: string }
  | { type: 'eventCancel'; player: PlayerId; drawer: PlayerId; cardId: string }
  | { type: 'liquidation'; player: PlayerId; task: PayTask }
  | { type: 'inheritMortgage'; player: PlayerId; propertyId: string }
  /** Con bạc: bet on this tax / fine / card payment (Liều ăn nhiều)? */
  | { type: 'gamble'; player: PlayerId; task: PayTask }
  /** Con bạc's Mở sòng: opponents bet one after another (`player` = whose bet it is). */
  | {
      type: 'sicboBet';
      player: PlayerId;
      host: PlayerId;
      stake: number;
      commission: number;
      bets: Record<PlayerId, SicboPick>;
      order: PlayerId[];
    };

export interface TradeBundle {
  cash: number;
  properties: string[];
  jailCards: string[];
}

export interface Trade {
  id: string;
  from: PlayerId;
  to: PlayerId;
  /** What `from` gives. */
  offer: TradeBundle;
  /** What `from` wants from `to`. */
  request: TradeBundle;
  /** Mortgaged properties `from` receives and wants to unmortgage immediately. */
  unmortgage: string[];
}

export interface GameState {
  seed: number;
  rng: number;
  config: GameConfig;
  players: PlayerState[];
  turn: {
    current: number;
    number: number;
    phase: 'roll' | 'end';
    /** Real dice of the last movement roll (before Grab ±1). */
    dice: number[] | null;
    /** Rolled doubles this turn and may roll again. */
    extraRoll: boolean;
    /** Players the current player already sent a trade offer to this turn (bots offer once each). */
    offeredTo?: PlayerId[];
  };
  ownables: Record<string, OwnableState>;
  decks: Record<DeckName, string[]>;
  fund: number;
  activeEffects: ActiveEffect[];
  pending: Pending | null;
  queue: Task[];
  trades: Trade[];
  nextUid: number;
  bankruptOrder: PlayerId[];
  status: 'playing' | 'over';
  winner: PlayerId | null;
  /** Team games: the winning team (winner is its best-placed player). */
  winnerTeam?: number | null;
  ranking: { player: PlayerId; score: number }[] | null;
  /** Forced dice values (tests / replay). Consumed before the RNG. */
  riggedDice: number[];
}

export type Action =
  | { type: 'roll'; player: PlayerId }
  | { type: 'confirmRoll'; player: PlayerId }
  | { type: 'adjustStep'; player: PlayerId; delta: number }
  | { type: 'buy'; player: PlayerId; gamble?: SicboPick }
  | { type: 'declineBuy'; player: PlayerId }
  | { type: 'bid'; player: PlayerId; amount: number }
  | { type: 'closeAuction' }
  | { type: 'build'; player: PlayerId; propertyId: string }
  | { type: 'sellBuilding'; player: PlayerId; propertyId: string }
  | { type: 'mortgage'; player: PlayerId; propertyId: string }
  | { type: 'unmortgage'; player: PlayerId; propertyId: string }
  | {
      type: 'proposeTrade';
      player: PlayerId;
      to: PlayerId;
      offer: Partial<TradeBundle>;
      request: Partial<TradeBundle>;
      unmortgage?: string[];
    }
  | { type: 'respondTrade'; player: PlayerId; tradeId: string; accept: boolean; unmortgage?: string[] }
  | { type: 'cancelTrade'; player?: PlayerId; tradeId: string }
  | { type: 'payJailFine'; player: PlayerId }
  | { type: 'useJailCard'; player: PlayerId }
  | { type: 'useSkill'; player: PlayerId; target?: PlayerId; group?: string; propertyId?: string }
  | { type: 'gamble'; player: PlayerId; pick: SicboPick | null }
  | { type: 'placeBet'; player: PlayerId; pick: SicboPick }
  | { type: 'declineSkill'; player: PlayerId }
  | { type: 'chooseCard'; player: PlayerId; cardId: string }
  | { type: 'revealCard'; player: PlayerId }
  | { type: 'payRent'; player: PlayerId }
  | { type: 'payDebt'; player: PlayerId }
  | { type: 'declareBankruptcy'; player: PlayerId }
  | { type: 'resolveMortgage'; player: PlayerId; unmortgage: boolean }
  | { type: 'endTurn'; player: PlayerId }
  /** Server: the active timer ran out; engine applies the default. */
  | { type: 'timeout' }
  /** Server: quick-mode clock ran out (or host ends the game). */
  | { type: 'endGame' };

export interface GameEvent {
  type: string;
  [key: string]: unknown;
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
