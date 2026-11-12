/**
 * Tín dụng đen: loans between players.
 *
 * - `loan_shark` (passive): a player short of cash for a debt may borrow the shortfall
 *   (up to `maxAmount`) from the lender, owing `1 + rate` times it.
 * - `forced_loan` (skill Giải ngân): the lender pushes `amount` onto a random opponent,
 *   who owes `amount × repayRate`.
 *
 * What is owed is repaid automatically the next time the debtor passes the start, before
 * the tile they reach is handled. If they cannot pay it is an ordinary debt to the lender
 * (sell, mortgage, or go bankrupt to the lender). Teammates never lend to each other: they
 * pass money with a trade.
 */
import { trait } from './characters';
import { activePlayers, emit, fail, getPlayer, opponentsOf, teammates, type Ctx } from './ctx';
import { randomInt } from './rng';
import type { Effect, PayTask, PlayerId, PlayerState } from './types';

const up = (x: number) => Math.ceil(x - 1e-9);

export interface LoanOffer {
  lender: PlayerId;
  amount: number;
  owed: number;
}

/** The loan `debtorId` may take right now to settle the pending debt, if any. */
export function loanOffer(c: Ctx, debtorId: PlayerId): LoanOffer | null {
  const pend = c.s.pending;
  if (pend?.type !== 'liquidation' || pend.player !== debtorId) return null;
  const debtor = getPlayer(c, debtorId);
  const shortfall = pend.task.amount - debtor.cash;
  if (shortfall <= 0) return null;
  for (const p of activePlayers(c)) {
    // Teammates pass money with a trade instead.
    if (p.id === debtorId || teammates(c, p.id, debtorId)) continue;
    // Never to pay the lender himself (that would just roll the debt over).
    if (pend.task.to.kind === 'player' && pend.task.to.id === p.id) continue;
    const t = trait(c, p, 'loan_shark');
    if (!t || shortfall > (t.maxAmount as number) || p.cash < shortfall) continue;
    return { lender: p.id, amount: shortfall, owed: up(shortfall * (1 + (t.rate as number))) };
  }
  return null;
}

function addDebt(debtor: PlayerState, lender: PlayerId, owed: number): void {
  const list = (debtor.debts ??= []);
  const d = list.find((x) => x.to === lender);
  if (d) d.amount += owed;
  else list.push({ to: lender, amount: owed });
}

/** Vay nóng: borrow the shortfall, then pay the pending debt. */
export function borrow(c: Ctx, debtor: PlayerState): void {
  const offer = loanOffer(c, debtor.id);
  if (!offer) fail('No loan available');
  const lender = getPlayer(c, offer.lender);
  lender.cash -= offer.amount;
  debtor.cash += offer.amount;
  addDebt(debtor, lender.id, offer.owed);
  emit(c, 'loan', { player: debtor.id, lender: lender.id, amount: offer.amount, owed: offer.owed });
}

/** Giải ngân: lend `amount` to a random opponent. Returns the borrower. */
export function forcedLoan(c: Ctx, lender: PlayerState, sk: Effect): PlayerState {
  const pool = forcedLoanTargets(c, lender);
  if (pool.length === 0) fail('No opponent to lend to');
  const amount = sk.amount as number;
  if (lender.cash < amount) fail('Not enough cash');
  const q = pool[randomInt(c.s, pool.length)];
  const owed = up(amount * (sk.repayRate as number));
  lender.cash -= amount;
  q.cash += amount;
  addDebt(q, lender.id, owed);
  emit(c, 'loan', { player: q.id, lender: lender.id, amount, owed, forced: true });
  return q;
}

export function forcedLoanTargets(c: Ctx, lender: PlayerState): PlayerState[] {
  return opponentsOf(c, lender);
}

/** Passing the start: what the player owes becomes payments to the lenders. */
export function repayTasks(c: Ctx, p: PlayerState): PayTask[] {
  const debts = p.debts ?? [];
  delete p.debts;
  return debts
    .filter((d) => !getPlayer(c, d.to).bankrupt && d.amount > 0)
    .map((d) => ({ t: 'pay', from: p.id, to: { kind: 'player', id: d.to }, amount: d.amount, kind: 'other', reason: 'loanRepay' }));
}

/** A bankrupt player's loans are gone, both ways. */
export function dropLoansOf(c: Ctx, playerId: PlayerId): void {
  for (const p of c.s.players) {
    if (p.id === playerId) delete p.debts;
    else if (p.debts) {
      p.debts = p.debts.filter((d) => d.to !== playerId);
      if (p.debts.length === 0) delete p.debts;
    }
  }
}

/** Net loan position for scoring: owed to `p` minus what `p` owes. */
export function loanBalance(c: Ctx, p: PlayerState): number {
  let total = -(p.debts ?? []).reduce((a, d) => a + d.amount, 0);
  for (const q of c.s.players) {
    if (q.bankrupt || q.id === p.id) continue;
    for (const d of q.debts ?? []) if (d.to === p.id) total += d.amount;
  }
  return total;
}
