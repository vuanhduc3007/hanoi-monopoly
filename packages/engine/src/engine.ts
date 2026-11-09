import {
  build,
  buildBlock,
  type BuildBlock,
  cancelTrade,
  mortgage,
  proposeTrade,
  resolveInheritedMortgage,
  respondTrade,
  sellBuilding,
  unmortgage,
} from './assets';
import {
  chooseCard,
  revealCard,
  execDrawCard,
  execEffect,
  execResolveCard,
  execReturnCard,
  resolveEventCancel,
} from './cards';
import {
  adjustRule,
  canOwn,
  onTurnStart,
  postRollOptions,
  requireSkill,
  skillOf,
  startingCash,
} from './characters';
import {
  activePlayers,
  currentPlayer,
  emit,
  fail,
  getPlayer,
  groupProperties,
  isMyTurn,
  jailMaxTurns,
  pushFront,
  type Ctx,
} from './ctx';
import { dataFor, defaultData, type GameData } from './data';
import { addActiveEffect, singleDieActive } from './effects';
import { declareBankruptcy, execPay, finishGame, payTask, settleDebt } from './money';
import {
  bid,
  buy,
  closeAuction,
  declineBuy,
  execAuction,
  execGain,
  execGoToJail,
  execLand,
  execMove,
  execMoveTo,
  execOfferBuy,
  leaveJail,
} from './movement';
import { execRent } from './rent';
import { randomInt, rollDice, shuffle } from './rng';
import type {
  Action,
  ActionResult,
  GameConfig,
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
  Task,
} from './types';

// ---------------------------------------------------------------- setup

export interface NewPlayer {
  id: PlayerId;
  name?: string;
  character?: string | null;
}

export interface CreateGameOptions {
  /** In turn order (see rollTurnOrder). */
  players: NewPlayer[];
  seed: number;
  config?: Partial<GameConfig>;
}

export function defaultConfig(d: GameData, mode?: GameConfig['mode']): GameConfig {
  const def = d.config.room.defaults;
  const m = mode ?? def.mode;
  return {
    mode: m,
    characters: def.characters,
    scholarshipFund: def.scholarshipFund[m],
    buildingLimit: def.buildingLimit,
  };
}

export function createGame(opts: CreateGameOptions, data?: GameData): ActionResult {
  const { minPlayers, maxPlayers } = (data ?? defaultData).config.room;
  if (opts.players.length < minPlayers || opts.players.length > maxPlayers) {
    fail(`Need ${minPlayers}-${maxPlayers} players`);
  }
  const config: GameConfig = { ...defaultConfig(defaultData, opts.config?.mode), ...opts.config };
  const d = data ?? dataFor(config.board);
  config.board = d.id;
  const chars = opts.players.map((p) => p.character ?? null).filter((x): x is string => !!x);
  if (config.characters) {
    if (new Set(chars).size !== chars.length) fail('Characters must be unique');
    for (const ch of chars) if (!d.characters[ch]) fail(`Unknown character ${ch}`);
  }
  const s: GameState = {
    seed: opts.seed >>> 0,
    rng: opts.seed >>> 0,
    config,
    players: opts.players.map((p) => ({
      id: p.id,
      name: p.name ?? p.id,
      character: config.characters ? p.character ?? null : null,
      cash: startingCash(d, p.character ?? null, config.characters),
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailCards: [],
      bankrupt: false,
      skillUsed: false,
      goPasses: 0,
      lapAdjustUsed: false,
      adjustUses: 0,
      doublesCount: 0,
    })),
    turn: { current: 0, number: 1, phase: 'roll', dice: null, extraRoll: false },
    ownables: Object.fromEntries(
      Object.keys(d.ownables).map((id) => [id, { owner: null, mortgaged: false, level: 0 }]),
    ),
    decks: { chance: [], community: [], event: [] },
    fund: d.config.fund.start,
    activeEffects: [],
    pending: null,
    queue: [],
    trades: [],
    nextUid: 1,
    bankruptOrder: [],
    status: 'playing',
    winner: null,
    ranking: null,
    riggedDice: [],
  };
  for (const deck of ['chance', 'community', 'event'] as const) {
    s.decks[deck] = shuffle(s, d.decks[deck].map((x) => x.id));
  }
  const c: Ctx = { s, ev: [], d };
  emit(c, 'gameCreated', { seed: s.seed, config });
  if (config.mode === 'quick') dealQuickProperties(c);
  startTurn(c);
  return { state: s, events: c.ev };
}

/** Quick mode: each player gets N random ownables at list price. */
function dealQuickProperties(c: Ctx): void {
  const pool = Object.keys(c.d.ownables).sort();
  const per = c.d.config.quickMode.dealPropertiesPerPlayer;
  for (let round = 0; round < per; round++) {
    for (const p of c.s.players) {
      const options = pool.filter((id) => !c.s.ownables[id].owner && canOwn(c, p, id));
      if (options.length === 0) continue;
      const id = options[randomInt(c.s, options.length)];
      const price = c.d.ownables[id].price;
      c.s.ownables[id].owner = p.id;
      p.cash -= price;
      emit(c, 'dealt', { player: p.id, propertyId: id, price });
    }
  }
}

/** Opening roll helper: highest 2-dice total first; ties re-roll among themselves. */
export function rollTurnOrder(ids: PlayerId[], seed: number): { order: PlayerId[]; rolls: Record<string, number[][]> } {
  const tmp = { rng: seed >>> 0, riggedDice: [] as number[] } as unknown as GameState;
  const rolls: Record<string, number[][]> = Object.fromEntries(ids.map((id) => [id, []]));
  const rank = (group: PlayerId[]): PlayerId[] => {
    if (group.length <= 1) return group;
    const totals = new Map<PlayerId, number>();
    for (const id of group) {
      const dice = rollDice(tmp, 2);
      rolls[id].push(dice);
      totals.set(id, dice[0] + dice[1]);
    }
    const distinct = [...new Set(totals.values())].sort((a, b) => b - a);
    return distinct.flatMap((v) => rank(group.filter((id) => totals.get(id) === v)));
  };
  return { order: rank(ids), rolls };
}

// ---------------------------------------------------------------- core loop

export function applyAction(state: GameState, action: Action, d?: GameData): ActionResult {
  return applyActionInPlace(JSON.parse(JSON.stringify(state)), action, d);
}

/**
 * Same as applyAction but mutates `state` (no clone) — for the simulator and
 * bots only. If it throws, `state` may be partially modified: only use it for
 * actions known to be legal, or on a state you can throw away.
 */
export function applyActionInPlace(s: GameState, action: Action, data?: GameData): ActionResult {
  const c: Ctx = { s, ev: [], d: data ?? dataFor(s.config.board) };
  if (s.status === 'over') fail('Game is over');
  dispatch(c, action);
  run(c);
  return { state: s, events: c.ev };
}

function run(c: Ctx): void {
  for (;;) {
    while (c.s.status === 'playing' && !c.s.pending && c.s.queue.length > 0) {
      execTask(c, c.s.queue.shift()!);
    }
    if (c.s.status !== 'playing' || c.s.pending || c.s.queue.length > 0) return;
    if (currentPlayer(c).bankrupt) {
      advanceTurn(c);
      continue;
    }
    return;
  }
}

function execTask(c: Ctx, t: Task): void {
  switch (t.t) {
    case 'pay':
      return execPay(c, t);
    case 'move':
      return execMove(c, getPlayer(c, t.player), t.steps);
    case 'moveTo':
      return execMoveTo(c, getPlayer(c, t.player), t.position, t.ctx);
    case 'land':
      return execLand(c, getPlayer(c, t.player), t.ctx);
    case 'rent':
      return execRent(c, getPlayer(c, t.player), t.propertyId, t.ctx);
    case 'drawCard':
      return execDrawCard(c, getPlayer(c, t.player), t.deck);
    case 'resolveCard':
      return execResolveCard(c, t.player, t.cardId, t.exempt);
    case 'effect':
      return execEffect(c, t.player, t.cardId, t.effect, t.exempt);
    case 'returnCard':
      return execReturnCard(c, t.cardId);
    case 'goToJail':
      return execGoToJail(c, getPlayer(c, t.player));
    case 'leaveJail':
      return leaveJail(c, getPlayer(c, t.player), 'fine');
    case 'offerBuy':
      return execOfferBuy(c, getPlayer(c, t.player), t.propertyId);
    case 'auction':
      return execAuction(c, t.propertyId);
    case 'gain':
      return execGain(c, getPlayer(c, t.player), t.amount, t.reason);
    case 'inheritMortgage':
      c.s.pending = { type: 'inheritMortgage', player: t.player, propertyId: t.propertyId };
      emit(c, 'decisionRequired', { decision: 'inheritMortgage', player: t.player, propertyId: t.propertyId });
      return;
    case 'afterRoll': {
      const p = getPlayer(c, t.player);
      if (p.bankrupt) return;
      c.s.turn.phase = c.s.turn.extraRoll && !p.inJail ? 'roll' : 'end';
      return;
    }
  }
}

function startTurn(c: Ctx): void {
  const p = currentPlayer(c);
  c.s.turn.phase = 'roll';
  c.s.turn.dice = null;
  c.s.turn.extraRoll = false;
  onTurnStart(c, p);
  emit(c, 'turnStarted', { player: p.id, turn: c.s.turn.number, inJail: p.inJail });
}

function advanceTurn(c: Ctx): void {
  const n = c.s.players.length;
  let idx = c.s.turn.current;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    if (!c.s.players[idx].bankrupt) break;
  }
  c.s.turn.current = idx;
  c.s.turn.number += 1;
  startTurn(c);
}

// ---------------------------------------------------------------- rolling

function requireTurn(c: Ctx, playerId: PlayerId): PlayerState {
  if (!isMyTurn(c, playerId)) fail('Not your turn');
  return getPlayer(c, playerId);
}

function requireFree(c: Ctx): void {
  if (c.s.pending) fail(`Waiting for decision: ${c.s.pending.type}`);
}

function doRoll(c: Ctx, p: PlayerState): void {
  if (c.s.turn.phase !== 'roll') fail('Cannot roll now');
  const context = p.inJail ? 'jail' : 'normal';
  const count = context === 'normal' && singleDieActive(c, p) ? 1 : 2;
  const dice = rollDice(c.s, count);
  c.s.turn.dice = dice;
  emit(c, 'diceRolled', { player: p.id, dice, purpose: context });
  const opts = postRollOptions(c, p);
  if (opts.adjust || opts.reroll) {
    c.s.pending = { type: 'postRoll', player: p.id, dice, context };
    emit(c, 'decisionRequired', { decision: 'postRoll', player: p.id, ...opts });
    return;
  }
  commitRoll(c, p, dice, 0, context);
}

function commitRoll(c: Ctx, p: PlayerState, dice: number[], adjust: number, context: 'normal' | 'jail'): void {
  const steps = dice.reduce((a, b) => a + b, 0) + adjust;
  const doubles = dice.length === 2 && dice[0] === dice[1];
  const tasks: Task[] = [];
  c.s.turn.extraRoll = false;
  c.s.turn.phase = 'end'; // until afterRoll decides on another roll
  if (context === 'jail') {
    if (doubles) {
      leaveJail(c, p, 'doubles');
      tasks.push({ t: 'move', player: p.id, steps });
    } else {
      p.jailTurns += 1;
      if (p.jailTurns >= jailMaxTurns(c)) {
        tasks.push(payTask(p.id, { kind: 'fund' }, c.d.economy.jailFine, 'jail', 'jailFine'));
        tasks.push({ t: 'leaveJail', player: p.id });
        tasks.push({ t: 'move', player: p.id, steps });
      } else {
        emit(c, 'stayedInJail', { player: p.id, attempts: p.jailTurns });
      }
    }
  } else if (doubles) {
    p.doublesCount += 1;
    if (p.doublesCount >= 3) {
      emit(c, 'tripleDoubles', { player: p.id });
      if (c.d.cardRules.tripleDoubleDrawsEvent) tasks.push({ t: 'drawCard', player: p.id, deck: 'event' });
      tasks.push({ t: 'goToJail', player: p.id });
    } else {
      c.s.turn.extraRoll = true;
      tasks.push({ t: 'move', player: p.id, steps });
    }
  } else {
    tasks.push({ t: 'move', player: p.id, steps });
  }
  tasks.push({ t: 'afterRoll', player: p.id });
  pushFront(c, ...tasks);
}

function requirePostRoll(c: Ctx, p: PlayerState) {
  const pend = c.s.pending;
  if (pend?.type !== 'postRoll' || pend.player !== p.id) fail('No roll to adjust');
  return pend;
}

// ---------------------------------------------------------------- skills

function useSkill(c: Ctx, p: PlayerState, a: Extract<Action, { type: 'useSkill' }>): void {
  const sk = skillOf(c, p);
  if (!sk) fail('No skill');
  requireSkill(c, p, sk.type);
  const pend = c.s.pending;
  switch (sk.type) {
    case 'reroll': {
      const pr = requirePostRoll(c, p);
      p.skillUsed = true;
      const dice = rollDice(c.s, pr.dice.length);
      c.s.turn.dice = dice;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type });
      emit(c, 'diceRolled', { player: p.id, dice, purpose: 'reroll' });
      if (postRollOptions(c, p).adjust) {
        pr.dice = dice;
      } else {
        c.s.pending = null;
        commitRoll(c, p, dice, 0, pr.context);
      }
      return;
    }
    case 'rent_discount': {
      if (pend?.type !== 'payRent' || pend.player !== p.id || !pend.discount) fail('No rent payment to discount');
      p.skillUsed = true;
      const amount = Math.ceil(pend.raw * (1 - (sk.rate as number)) - 1e-9);
      c.s.pending = null;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, from: pend.task.amount, to: amount });
      pushFront(c, { ...pend.task, amount });
      return;
    }
    case 'cancel_event_for_self': {
      if (pend?.type !== 'eventCancel' || pend.player !== p.id) fail('No event to cancel');
      resolveEventCancel(c, true);
      return;
    }
    case 'block_rent': {
      requireTurn(c, p.id);
      requireFree(c);
      const target = a.target ? getPlayer(c, a.target) : null;
      if (!target || target.id === p.id || target.bankrupt) fail('Choose an opponent');
      p.skillUsed = true;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, target: target.id });
      addActiveEffect(c, {
        source: { kind: 'skill', character: p.character! },
        activator: p.id,
        effect: { type: 'block_rent', target: target.id },
        exempt: [],
      });
      return;
    }
    case 'rent_multiplier': {
      requireTurn(c, p.id);
      requireFree(c);
      if (!a.group || groupProperties(c, a.group).length === 0) fail('Choose a colour group');
      p.skillUsed = true;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, group: a.group });
      addActiveEffect(c, {
        source: { kind: 'skill', character: p.character! },
        activator: p.id,
        effect: { type: 'rent_multiplier', groups: [a.group], multiplier: sk.multiplier },
        exempt: [],
      });
      return;
    }
    case 'free_jail_exit': {
      requireTurn(c, p.id);
      requireFree(c);
      if (!p.inJail || c.s.turn.phase !== 'roll') fail('Not in jail');
      p.skillUsed = true;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type });
      leaveJail(c, p, 'skill');
      return;
    }
    default:
      fail(`Skill ${sk.type} is automatic`);
  }
}

function declineSkill(c: Ctx, p: PlayerState): void {
  const pend = c.s.pending;
  if (pend?.type === 'payRent' && pend.player === p.id) {
    c.s.pending = null;
    pushFront(c, pend.task);
    return;
  }
  if (pend?.type === 'eventCancel' && pend.player === p.id) {
    resolveEventCancel(c, false);
    return;
  }
  fail('No skill prompt to decline');
}

// ---------------------------------------------------------------- dispatch

function dispatch(c: Ctx, a: Action): void {
  switch (a.type) {
    case 'roll': {
      const p = requireTurn(c, a.player);
      requireFree(c);
      return doRoll(c, p);
    }
    case 'confirmRoll': {
      const p = getPlayer(c, a.player);
      const pr = requirePostRoll(c, p);
      c.s.pending = null;
      return commitRoll(c, p, pr.dice, 0, pr.context);
    }
    case 'adjustStep': {
      const p = getPlayer(c, a.player);
      const pr = requirePostRoll(c, p);
      if (!postRollOptions(c, p).adjust) fail('Step adjustment not available');
      const rule = adjustRule(c, p)!;
      if (!rule.directions.includes(a.delta)) fail(`delta must be one of ${rule.directions.join(', ')}`);
      p.lapAdjustUsed = true;
      p.adjustUses += 1;
      c.s.pending = null;
      emit(c, 'stepAdjusted', { player: p.id, delta: a.delta, cost: rule.cost });
      commitRoll(c, p, pr.dice, a.delta, pr.context);
      if (rule.cost > 0) pushFront(c, payTask(p.id, { kind: 'fund' }, rule.cost, 'fee', 'adjustStep'));
      return;
    }
    case 'buy':
      return buy(c, getPlayer(c, a.player));
    case 'declineBuy':
      return declineBuy(c, getPlayer(c, a.player));
    case 'bid':
      return bid(c, getPlayer(c, a.player), a.amount);
    case 'closeAuction':
      return closeAuction(c);
    case 'build':
      return build(c, getPlayer(c, a.player), a.propertyId);
    case 'sellBuilding':
      return sellBuilding(c, getPlayer(c, a.player), a.propertyId);
    case 'mortgage':
      return mortgage(c, getPlayer(c, a.player), a.propertyId);
    case 'unmortgage':
      return unmortgage(c, getPlayer(c, a.player), a.propertyId);
    case 'proposeTrade':
      proposeTrade(c, getPlayer(c, a.player), a.to, a.offer, a.request, a.unmortgage);
      return;
    case 'respondTrade':
      return respondTrade(c, getPlayer(c, a.player), a.tradeId, a.accept, a.unmortgage);
    case 'cancelTrade':
      return cancelTrade(c, a.player, a.tradeId);
    case 'payJailFine': {
      const p = requireTurn(c, a.player);
      requireFree(c);
      if (!p.inJail || c.s.turn.phase !== 'roll') fail('Not in jail');
      if (p.cash < c.d.economy.jailFine) fail('Not enough cash');
      execPay(c, payTask(p.id, { kind: 'fund' }, c.d.economy.jailFine, 'jail', 'jailFine'));
      return leaveJail(c, p, 'fine');
    }
    case 'useJailCard': {
      const p = requireTurn(c, a.player);
      requireFree(c);
      if (!p.inJail || c.s.turn.phase !== 'roll') fail('Not in jail');
      const card = p.jailCards.shift();
      if (!card) fail('No jail-free card');
      c.s.decks[c.d.cards[card].deck].push(card);
      return leaveJail(c, p, 'card');
    }
    case 'useSkill':
      return useSkill(c, getPlayer(c, a.player), a);
    case 'declineSkill':
      return declineSkill(c, getPlayer(c, a.player));
    case 'chooseCard':
      return chooseCard(c, getPlayer(c, a.player), a.cardId);
    case 'revealCard':
      return revealCard(c, getPlayer(c, a.player));
    case 'payRent': {
      const pend = c.s.pending;
      if (pend?.type !== 'payRent' || pend.player !== a.player) fail('No rent to pay');
      c.s.pending = null;
      pushFront(c, pend.task);
      return;
    }
    case 'payDebt': {
      const pend = c.s.pending;
      if (pend?.type !== 'liquidation' || pend.player !== a.player) fail('No debt to pay');
      if (!settleDebt(c)) fail('Still not enough cash');
      return;
    }
    case 'declareBankruptcy': {
      const pend = c.s.pending;
      if (pend?.type !== 'liquidation' || pend.player !== a.player) fail('No debt pending');
      return declareBankruptcy(c);
    }
    case 'resolveMortgage':
      return resolveInheritedMortgage(c, getPlayer(c, a.player), a.unmortgage);
    case 'endTurn': {
      requireTurn(c, a.player);
      requireFree(c);
      if (c.s.turn.phase !== 'end') fail('Roll first');
      return advanceTurn(c);
    }
    case 'timeout':
      return timeout(c);
    case 'endGame':
      return finishGame(c);
    default:
      fail(`Unknown action ${(a as { type: string }).type}`);
  }
}

/** Default resolution when the server's timer for the current decision expires. */
function timeout(c: Ctx): void {
  const pend = c.s.pending;
  if (!pend) {
    const p = currentPlayer(c);
    if (c.s.turn.phase === 'roll') return doRoll(c, p);
    return advanceTurn(c);
  }
  switch (pend.type) {
    case 'buy':
      return declineBuy(c, getPlayer(c, pend.player));
    case 'auction':
      return closeAuction(c);
    case 'postRoll':
      c.s.pending = null;
      return commitRoll(c, getPlayer(c, pend.player), pend.dice, 0, pend.context);
    case 'chooseCard':
      return chooseCard(c, getPlayer(c, pend.player), pend.options[0]);
    case 'revealCard':
      return revealCard(c, getPlayer(c, pend.player));
    case 'payRent':
    case 'eventCancel':
      return declineSkill(c, getPlayer(c, pend.player));
    case 'liquidation':
      return declareBankruptcy(c);
    case 'inheritMortgage':
      return resolveInheritedMortgage(c, getPlayer(c, pend.player), false);
  }
}

export type { GameEvent };
export { activePlayers };

/**
 * Display helper for clients: why `playerId` cannot build on `propertyId`
 * right now (null = allowed). Works on a public state too.
 */
export function whyCantBuild(
  state: Pick<GameState, 'players' | 'turn' | 'pending' | 'ownables' | 'config' | 'activeEffects'>,
  playerId: PlayerId,
  propertyId: string,
  data?: GameData,
): BuildBlock | null {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  return buildBlock(c, getPlayer(c, playerId), propertyId);
}

export type { BuildBlock };
