import {
  build,
  buildBlock,
  moveHouseBlock,
  partialFreeBuild,
  type BuildBlock,
  type MoveHouseBlock,
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
  flashSalePrice,
  onPurchase,
  onTurnStart,
  useUpSkill,
  postRollOptions,
  requireSkill,
  skillOf,
  startingCash,
} from './characters';
import {
  activePlayers,
  type Ctx,
  currentPlayer,
  emit,
  fail,
  getPlayer,
  groupHasBuildings,
  sideHasBuildings,
  groupProperties,
  isMyTurn,
  ownedBySide,
  jailMaxTurns,
  opponentsOf,
  pushFront,
  openTeamWallets,
  syncTeamCash,
  teammates,
} from './ctx';
import { dataFor, defaultData, type GameData } from './data';
import { addActiveEffect, singleDieActive } from './effects';
import { borrow, forcedLoan, loanOffer, type LoanOffer } from './loans';
import { checkTeamSurrender, declareBankruptcy, execPay, finishGame, payTask, settleDebt, score, surrender, voteTeamSurrender } from './money';
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
import { openSicbo, placeBet, resolveGamble, timeoutBet } from './sicbo';
import { randomInt, rollDice, shuffle } from './rng';
import type {
  Action,
  ActionResult,
  Effect,
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
  /** Team games: every player has a team number, at least two different ones. */
  team?: number;
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
  const config: GameConfig = { ...defaultConfig(defaultData, opts.config?.mode), ...opts.config };
  const d = data ?? dataFor(config.board);
  config.board = d.id;
  const { minPlayers } = d.config.room;
  const maxPlayers = Math.min(d.maxPlayers, d.config.room.maxPlayers);
  if (opts.players.length < minPlayers || opts.players.length > maxPlayers) {
    fail(`Need ${minPlayers}-${maxPlayers} players on this board`);
  }
  const teams = opts.players.map((p) => p.team);
  if (teams.some((t) => t !== undefined)) {
    if (teams.some((t) => !Number.isInteger(t))) fail('Every player needs a team');
    if (new Set(teams).size < 2) fail('Need at least two teams');
  }
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
      cash: startingCash(d, p.character ?? null, config.characters, opts.players.length, {
        mode: config.mode,
        teams: opts.players.some((x) => x.team !== undefined),
      }),
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
      ...(p.team !== undefined ? { team: p.team } : {}),
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
  openTeamWallets(c);
  startTurn(c);
  syncTeamCash(c);
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
/**
 * Team games: reorder a rolled turn order so teams alternate. Teams go in the order their
 * best roller appears; inside a team the rolled order is kept. Uneven teams simply run out.
 */
export function interleaveTeams(order: PlayerId[], teamOf: (id: PlayerId) => number): PlayerId[] {
  const queues = new Map<number, PlayerId[]>();
  for (const id of order) {
    const t = teamOf(id);
    if (!queues.has(t)) queues.set(t, []);
    queues.get(t)!.push(id);
  }
  const out: PlayerId[] = [];
  while (out.length < order.length) {
    for (const q of queues.values()) {
      const id = q.shift();
      if (id !== undefined) out.push(id);
    }
  }
  return out;
}

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
  syncTeamCash(c);
  run(c);
  // A team that agreed to surrender leaves as soon as none of its members is mid-decision.
  if (checkTeamSurrender(c)) {
    syncTeamCash(c);
    run(c);
  }
  return { state: s, events: c.ev };
}

function run(c: Ctx): void {
  for (;;) {
    while (c.s.status === 'playing' && !c.s.pending && c.s.queue.length > 0) {
      execTask(c, c.s.queue.shift()!);
      syncTeamCash(c);
    }
    if (c.s.status !== 'playing' || c.s.pending || c.s.queue.length > 0) return;
    if (currentPlayer(c).bankrupt) {
      advanceTurn(c);
      syncTeamCash(c);
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
  delete c.s.turn.offeredTo;
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
      useUpSkill(c, p);
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
      useUpSkill(c, p);
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
      if (!target || target.id === p.id || target.bankrupt || teammates(c, p.id, target.id)) fail('Choose an opponent');
      useUpSkill(c, p);
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
      useUpSkill(c, p);
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, group: a.group });
      addActiveEffect(c, {
        source: { kind: 'skill', character: p.character! },
        activator: p.id,
        effect: { type: 'rent_multiplier', groups: [a.group], multiplier: sk.multiplier },
        exempt: [],
      });
      return;
    }
    case 'host_sicbo': {
      requireTurn(c, p.id);
      requireFree(c);
      useUpSkill(c, p);
      emit(c, 'skillUsed', { player: p.id, skill: sk.type });
      openSicbo(c, p, sk);
      return;
    }
    case 'free_build': {
      if (!a.propertyId || !c.s.ownables[a.propertyId]) fail('Choose a property to build on');
      const why = buildBlock(c, p, a.propertyId, 0, partialFreeBuild(c, p));
      if (why) fail(`Cannot build: ${why}`);
      useUpSkill(c, p);
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, propertyId: a.propertyId });
      build(c, p, a.propertyId, true);
      return;
    }
    case 'buy_mortgaged': {
      requireTurn(c, p.id);
      requireFree(c);
      const id = a.propertyId;
      const own = id ? c.s.ownables[id] : undefined;
      if (!id || !own || !own.owner || own.owner === p.id || !own.mortgaged) fail("Choose an opponent's mortgaged property");
      const def = c.d.ownables[id];
      if (!canOwn(c, p, id)) fail('This character may not own that property');
      if (sideHasBuildings(c, def.group, own.owner)) fail('Its group has buildings');
      const cost = Math.ceil(def.mortgage * (1 + (sk.premium as number)) - 1e-9);
      if (p.cash < cost) fail('Not enough cash');
      const seller = getPlayer(c, own.owner);
      useUpSkill(c, p);
      p.cash -= cost;
      seller.cash += cost;
      own.owner = p.id;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, propertyId: id, from: seller.id, amount: cost });
      return;
    }
    case 'collect_contribution': {
      requireTurn(c, p.id);
      requireFree(c);
      useUpSkill(c, p);
      emit(c, 'skillUsed', { player: p.id, skill: sk.type });
      const tasks: Task[] = [];
      const others = opponentsOf(c, p);
      const { toSelf, toFund } = contributionShares(sk, others.length);
      for (const q of others) {
        tasks.push(payTask(q.id, { kind: 'player', id: p.id }, toSelf, 'other', 'contribution'));
        tasks.push(payTask(q.id, { kind: 'fund' }, toFund, 'other', 'contribution'));
      }
      pushFront(c, ...tasks);
      return;
    }
    case 'travel': {
      // Du lịch: instead of rolling, go to any tile. Walks there (salary when passing
      // the start), then the tile is handled as after a roll.
      requireTurn(c, p.id);
      requireFree(c);
      if (c.s.turn.phase !== 'roll' || p.inJail) fail('Travel replaces a roll (not from jail)');
      const n = c.d.board.length;
      const to = a.position;
      if (to === undefined || !Number.isInteger(to) || to < 0 || to >= n || to === p.position) fail('Choose another tile');
      useUpSkill(c, p);
      c.s.turn.extraRoll = false;
      c.s.turn.phase = 'end';
      c.s.turn.dice = null;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, position: to });
      pushFront(c, { t: 'move', player: p.id, steps: (to - p.position + n) % n }, { t: 'afterRoll', player: p.id });
      return;
    }
    case 'flash_sale': {
      // Flash sale: buy any unowned tile on the board at a discount, without going there.
      requireTurn(c, p.id);
      requireFree(c);
      const id = a.propertyId;
      if (!id || !c.s.ownables[id] || c.s.ownables[id].owner) fail('Choose an unowned tile');
      if (!canOwn(c, p, id)) fail('This character may not own that property');
      if (sk.completesGroup === false && flashCompletesGroup(c, p, id)) fail('Flash sale cannot complete a colour group');
      const price = flashSalePrice(c, sk, id);
      if (p.cash < price) fail('Not enough cash');
      useUpSkill(c, p);
      p.cash -= price;
      c.s.ownables[id].owner = p.id;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, propertyId: id, amount: price });
      emit(c, 'purchased', { player: p.id, propertyId: id, price });
      onPurchase(c, p.id);
      return;
    }
    case 'raise_rent': {
      // Tăng giá phòng: one of his properties earns more rent for good (while he owns it).
      requireTurn(c, p.id);
      requireFree(c);
      const id = a.propertyId;
      if (!id || c.s.ownables[id]?.owner !== p.id || c.d.ownables[id].kind !== 'property') fail('Choose one of your properties');
      const raises = p.rentBoosts?.[id] ?? 0;
      if (raises >= (sk.maxPerTile as number)) fail('This tile cannot be raised further');
      useUpSkill(c, p);
      (p.rentBoosts ??= {})[id] = raises + 1;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, propertyId: id, raises: raises + 1 });
      return;
    }
    case 'move_house': {
      // Dời nhà: a house goes from one of his tiles to another, still building evenly.
      const from = a.from;
      const to = a.propertyId;
      if (!from || !to || !c.s.ownables[from] || !c.s.ownables[to]) fail('Choose where the house goes from and to');
      const why = moveHouseBlock(c, p, from, to);
      if (why) fail(`Cannot move the house: ${why}`);
      useUpSkill(c, p);
      c.s.ownables[from].level -= 1;
      c.s.ownables[to].level += 1;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, from, propertyId: to });
      return;
    }
    case 'forced_loan': {
      requireTurn(c, p.id);
      requireFree(c);
      useUpSkill(c, p);
      const q = forcedLoan(c, p, sk);
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, target: q.id, amount: sk.amount });
      return;
    }
    case 'portal': {
      // Mở cổng: swap places with an opponent he picks, before rolling (instead of the
      // roll) or after it. Both handle the tile they arrive on like any landing: he first,
      // then the opponent (rent, tax, cards, a purchase…). Nobody passes GO; nobody in jail.
      requireTurn(c, p.id);
      requireFree(c);
      if (p.inJail) fail('Not from jail');
      const q = portalTargets(c, p).find((x) => x.id === a.target);
      if (!q) fail('Choose an opponent to swap with (not in jail, not on your tile)');
      useUpSkill(c, p);
      const beforeRoll = c.s.turn.phase === 'roll';
      if (beforeRoll) {
        c.s.turn.extraRoll = false;
        c.s.turn.phase = 'end';
        c.s.turn.dice = null;
      }
      const mine = p.position;
      p.position = q.position;
      q.position = mine;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, target: q.id, position: p.position });
      emit(c, 'moved', { player: p.id, from: mine, to: p.position, steps: 0, direct: true, portal: true });
      emit(c, 'moved', { player: q.id, from: p.position, to: mine, steps: 0, direct: true, portal: true });
      pushFront(
        c,
        { t: 'land', player: p.id },
        { t: 'land', player: q.id },
        ...(beforeRoll ? [{ t: 'afterRoll' as const, player: p.id }] : []),
      );
      return;
    }
    case 'buyout': {
      // Mua đứt: buy an opponent's lone tile of a group (they hold nothing else in it, no
      // buildings), paying them `premium` × the list price.
      requireTurn(c, p.id);
      requireFree(c);
      const id = a.propertyId;
      const why = id ? buyoutBlock(c, p, id) : 'notOwned';
      if (why) fail(`Cannot buy out: ${why}`);
      const own = c.s.ownables[id!];
      const seller = getPlayer(c, own.owner!);
      const cost = buyoutPrice(c, sk, id!);
      useUpSkill(c, p);
      p.cash -= cost;
      seller.cash += cost;
      own.owner = p.id;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, propertyId: id, from: seller.id, amount: cost });
      return;
    }
    case 'scholarship': {
      // Săn học bổng: take up to `maxAmount` from the Quỹ khuyến học; with the Quỹ off or
      // empty the bank gives `fallbackAmount`.
      requireTurn(c, p.id);
      requireFree(c);
      useUpSkill(c, p);
      const fromFund = c.s.config.scholarshipFund ? Math.min(c.s.fund, sk.maxAmount as number) : 0;
      const amount = fromFund > 0 ? fromFund : (sk.fallbackAmount as number);
      if (fromFund > 0) c.s.fund -= fromFund;
      p.cash += amount;
      emit(c, 'skillUsed', { player: p.id, skill: sk.type, amount, fromFund: fromFund > 0 });
      return;
    }
    case 'free_jail_exit': {
      requireTurn(c, p.id);
      requireFree(c);
      if (!p.inJail || c.s.turn.phase !== 'roll') fail('Not in jail');
      useUpSkill(c, p);
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

/**
 * Họp tổ dân phố: what each opponent pays. `totalToSelf` / `totalToFund` are split
 * among the opponents (rounded up) so the skill is worth the same at any table size;
 * fixed `toSelf` / `toFund` per opponent are also accepted.
 */
export function contributionShares(sk: Effect, opponents: number): { toSelf: number; toFund: number } {
  const share = (total: unknown, each: unknown) =>
    each !== undefined ? (each as number) : Math.ceil((total as number) / Math.max(1, opponents) - 1e-9);
  return { toSelf: share(sk.totalToSelf, sk.toSelf), toFund: share(sk.totalToFund, sk.toFund) };
}

/** Mua đứt price for `id`. */
export function buyoutPrice(c: Ctx, sk: Effect, id: string): number {
  return Math.ceil(c.d.ownables[id].price * (sk.premium as number) - 1e-9);
}

/**
 * Why Thiếu gia Vin may not buy out `id`: it must be an opponent's (not a teammate's),
 * unmortgaged, the only tile of its group on the owner's side, with no buildings in the
 * group, and affordable. Transport / utilities count as a lone tile when the owner has one.
 */
export function buyoutBlock(c: Ctx, p: PlayerState, id: string): string | null {
  const own = c.s.ownables[id];
  if (!own || !own.owner || own.owner === p.id || teammates(c, p.id, own.owner)) return 'notOpponent';
  if (own.mortgaged) return 'mortgaged';
  if (!canOwn(c, p, id)) return 'forbidden';
  const def = c.d.ownables[id];
  const owner = own.owner;
  const same = def.group
    ? groupProperties(c, def.group).filter((x) => ownedBySide(c, x, owner))
    : Object.keys(c.s.ownables).filter((x) => c.d.ownables[x].kind === def.kind && ownedBySide(c, x, owner));
  if (same.length > 1) return 'notLone';
  if (def.group && groupProperties(c, def.group).some((x) => c.s.ownables[x].level > 0)) return 'buildings';
  const sk = skillOf(c, p);
  if (sk?.completesGroup === false && flashCompletesGroup(c, p, id)) return 'completesGroup';
  if (!sk || p.cash < buyoutPrice(c, sk, id)) return 'noCash';
  return null;
}

/** Would buying `id` give `p`'s side the whole colour group? */
export function flashCompletesGroup(c: Ctx, p: PlayerState, id: string): boolean {
  const g = c.d.ownables[id].group;
  return !!g && groupProperties(c, g).every((x) => x === id || ownedBySide(c, x, p.id));
}

/** Mở cổng: opponents Bác sĩ lạ may pick to swap with (not in jail, not on his tile). */
export function portalTargets(c: Ctx, p: PlayerState): PlayerState[] {
  return opponentsOf(c, p).filter((q) => !q.inJail && q.position !== p.position);
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
      return buy(c, getPlayer(c, a.player), a.gamble);
    case 'gamble':
      return resolveGamble(c, getPlayer(c, a.player), a.pick);
    case 'placeBet':
      return placeBet(c, getPlayer(c, a.player), a.pick);
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
    case 'borrow': {
      const pend = c.s.pending;
      if (pend?.type !== 'liquidation' || pend.player !== a.player) fail('No debt to borrow for');
      borrow(c, getPlayer(c, a.player));
      settleDebt(c);
      return;
    }
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
    case 'surrender':
      return surrender(c, getPlayer(c, a.player));
    case 'teamSurrender':
      return voteTeamSurrender(c, getPlayer(c, a.player), a.agree);
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
    case 'gamble':
      return resolveGamble(c, getPlayer(c, pend.player), null);
    case 'sicboBet':
      return timeoutBet(c);
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

/** Net worth as the quick mode scores it (cash + land at list price, mortgaged at half + buildings). */
export function netWorth(state: GameState | PublicLike, playerId: PlayerId, data?: GameData): number {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  return score(c, getPlayer(c, playerId));
}
type PublicLike = Pick<GameState, 'players' | 'ownables' | 'config'>;

/** Thợ xây's Tự tay xây on this tile: why not, or null if allowed (a "nhà chui" counts). */
export function whyCantFreeBuild(
  state: Pick<GameState, 'players' | 'turn' | 'pending' | 'ownables' | 'config' | 'activeEffects'>,
  playerId: PlayerId,
  propertyId: string,
  data?: GameData,
): BuildBlock | null {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  const p = getPlayer(c, playerId);
  return buildBlock(c, p, propertyId, 0, partialFreeBuild(c, p));
}

type StateLike = Pick<GameState, 'players' | 'turn' | 'pending' | 'ownables' | 'config' | 'activeEffects'>;

/** Dời nhà from `from` to `to`: why not, or null if allowed. */
export function whyCantMoveHouse(state: StateLike, playerId: PlayerId, from: string, to: string, data?: GameData): MoveHouseBlock | null {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  if (!c.s.ownables[from] || !c.s.ownables[to]) return 'notBuildable';
  return moveHouseBlock(c, getPlayer(c, playerId), from, to);
}

/** Vay nóng the debtor could take now (lender, amount, owed), or null. */
export function loanOfferFor(state: StateLike, debtorId: PlayerId, data?: GameData): LoanOffer | null {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  return loanOffer(c, debtorId);
}

/** Flash sale on `propertyId`: why not ('owned', 'forbidden', 'completesGroup', 'noCash'), or null. */
export function whyCantFlashSale(state: StateLike, playerId: PlayerId, propertyId: string, data?: GameData): string | null {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  const p = getPlayer(c, playerId);
  const sk = skillOf(c, p);
  if (!c.s.ownables[propertyId] || c.s.ownables[propertyId].owner) return 'owned';
  if (!canOwn(c, p, propertyId)) return 'forbidden';
  if (sk?.completesGroup === false && flashCompletesGroup(c, p, propertyId)) return 'completesGroup';
  if (sk && p.cash < flashSalePrice(c, sk, propertyId)) return 'noCash';
  return null;
}

/** Mua đứt on `propertyId`: why not, or null (then `price` is what it costs). */
export function whyCantBuyout(state: StateLike, playerId: PlayerId, propertyId: string, data?: GameData): string | null {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  return buyoutBlock(c, getPlayer(c, playerId), propertyId);
}

/** Mua đứt price of `propertyId` for this player's skill. */
export function buyoutPriceFor(state: StateLike, playerId: PlayerId, propertyId: string, data?: GameData): number {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  const sk = skillOf(c, getPlayer(c, playerId));
  return sk ? buyoutPrice(c, sk, propertyId) : 0;
}

/** Mở cổng: ids of the opponents Bác sĩ lạ could land a swap with. */
export function portalTargetsFor(state: StateLike, playerId: PlayerId, data?: GameData): PlayerId[] {
  const c = { s: state as GameState, ev: [], d: data ?? dataFor(state.config.board) };
  return portalTargets(c, getPlayer(c, playerId)).map((q) => q.id);
}

export type { BuildBlock, MoveHouseBlock, LoanOffer };
