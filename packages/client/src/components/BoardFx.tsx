/**
 * Board overlays that make the important moments readable: drawing a card
 * (face down → the drawer flips it), being arrested by CSGT, and money
 * changing hands (who pays, how much, why).
 */
import { useEffect, useRef, useState } from 'react';
import { defaultData as D, type GameEvent, type PublicState } from '@hanoi-monopoly/engine';
import { CardBack } from '../art/icons';
import { cardName, describeCard, money, t, tileName } from '../i18n/vi';
import { colorOf, nameOf } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { play } from '../sound/sound';
import { store, useAnimSettled, useStore, type MoneyChange } from '../store';
import { DICE_MS } from '../three/path';

// ---------------------------------------------------------------- cards

const FACE_UP_MS = 3600;

export function CardDraw({ state, room }: { state: PublicState; room: RoomView }) {
  const settled = useAnimSettled();
  const lastCard = useStore((s) => s.lastCard);
  const [flipping, setFlipping] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const pend = state.pending;

  useEffect(() => setFlipping(false), [pend?.type]);
  // A freshly revealed card stays face up for a few seconds.
  useEffect(() => {
    if (!lastCard) return;
    setShownAt(lastCard.at);
    const id = setTimeout(() => setNow(Date.now()), FACE_UP_MS + 50);
    return () => clearTimeout(id);
  }, [lastCard?.at]);

  if (pend?.type === 'revealCard') {
    if (!settled) return null;
    const mine = pend.player === room.you;
    return (
      <div className={`card-draw${flipping ? ' flipping' : ''}`} role="dialog" aria-label={t.cardDraw.title}>
        <button
          className={`card-big face-down deck-${pend.deck}`}
          disabled={!mine || flipping}
          onClick={() => {
            setFlipping(true);
            act({ type: 'revealCard' });
          }}
        >
          <CardBack deck={pend.deck} size={110} />
          <span className="card-deck">{t.board.deckNames[pend.deck]}</span>
        </button>
        <div className="card-draw-text">{mine ? t.cardDraw.flip : t.cardDraw.waiting(nameOf(room, pend.player))}</div>
      </div>
    );
  }

  if (!lastCard || Math.max(now, Date.now()) - shownAt > FACE_UP_MS || shownAt !== lastCard.at) return null;
  const deck = D.cards[lastCard.cardId]?.deck ?? 'chance';
  return (
    <div className="card-draw" role="status" onClick={() => setShownAt(0)}>
      <div className={`card-big face-up deck-${deck}`}>
        <span className="card-deck">{t.board.deckNames[deck]}</span>
        <strong className="card-title">{cardName(lastCard.cardId)}</strong>
        <span className="card-body">{describeCard(lastCard.cardId)}</span>
      </div>
      <div className="card-draw-text">{nameOf(room, lastCard.player)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- arrest

const ARREST_SHOW_MS = 1700;

export function ArrestBanner({ room }: { room: RoomView }) {
  const arrest = useStore((s) => s.arrest);
  const board3d = useStore((s) => s.board3d);
  const [visible, setVisible] = useState<{ player: string; at: number } | null>(null);

  // Without the 3D layer, arrests come straight from the log.
  useEffect(() => {
    if (board3d) return;
    let seen = store.get().log.at(-1)?.id ?? 0;
    return store.subscribe(() => {
      const fresh = store.get().log.filter((l) => l.id > seen);
      if (!fresh.length) return;
      seen = fresh[fresh.length - 1].id;
      const jailed = fresh.find((l) => l.event.type === 'jailed');
      if (jailed) store.set({ arrest: { player: jailed.event.player as string, at: Date.now() } });
    });
  }, [board3d]);

  useEffect(() => {
    if (!arrest) return;
    setVisible(arrest);
    play('whistle');
    const id = setTimeout(() => setVisible(null), ARREST_SHOW_MS);
    return () => clearTimeout(id);
  }, [arrest?.at]);

  if (!visible) return null;
  return (
    <div className="arrest" role="alert" key={visible.at}>
      <div className="arrest-lights" aria-hidden />
      <strong>{t.arrest.title}</strong>
      <span>{t.arrest.body(nameOf(room, visible.player))}</span>
    </div>
  );
}

// ---------------------------------------------------------------- money

/** A short "why" for a player's cash change, from this update's events (pure — tested). */
export function moneyReason(events: GameEvent[], player: string): string {
  let best: { amount: number; text: string } | null = null;
  const consider = (amount: number, text: string) => {
    if (!best || amount > best.amount) best = { amount, text };
  };
  for (const e of events) {
    const amount = Math.abs((e.amount as number) ?? (e.price as number) ?? 0);
    switch (e.type) {
      case 'payment': {
        const to = e.to as { kind: string; id?: string };
        if (e.from !== player && to?.id !== player) break;
        const r = String(e.reason);
        if (e.kind === 'rent') consider(amount, t.money.rent(tileName(r)));
        else if (D.cards[r]) consider(amount, cardName(r));
        else if (r === 'TAX1' || r === 'TAX2') consider(amount, tileName(r));
        else if (r === 'jailFine') consider(amount, t.money.jailFine);
        else consider(amount, t.money.fee);
        break;
      }
      case 'salary':
        if (e.player === player) consider(amount, t.money.salary);
        break;
      case 'purchased':
        if (e.player === player) consider(amount, t.money.bought(tileName(e.propertyId as string)));
        break;
      case 'auctionEnded':
        if (e.winner === player) consider(amount, t.money.bought(tileName(e.propertyId as string)));
        break;
      case 'built':
        if (e.player === player) consider(Math.abs(e.cost as number), t.money.built);
        break;
      case 'gain':
        if (e.player === player) consider(amount, D.cards[String(e.reason)] ? cardName(String(e.reason)) : t.money.bank);
        break;
      case 'fundCollected':
        if (e.player === player) consider(amount, t.money.fund);
        break;
      case 'mortgaged':
      case 'unmortgaged':
        if (e.player === player) consider(amount, t.money.mortgage);
        break;
    }
  }
  return (best as { text: string } | null)?.text ?? '';
}

/** Watches cash and records every change (shown once the pieces have arrived). */
export function useMoneyChanges(state: PublicState): void {
  const prev = useRef<Record<string, number> | null>(null);
  const next = useRef(1);
  useEffect(() => {
    const before = prev.current;
    prev.current = Object.fromEntries(state.players.map((p) => [p.id, p.cash]));
    if (!before) return;
    const events = store.get().game?.events ?? [];
    const showAt = Math.max(Date.now(), store.get().animUntil);
    const changes: MoneyChange[] = [];
    for (const p of state.players) {
      const delta = p.cash - (before[p.id] ?? p.cash);
      if (delta !== 0) changes.push({ id: next.current++, player: p.id, delta, reason: moneyReason(events, p.id), showAt });
    }
    if (!changes.length) return;
    store.set((s) => ({ money: [...s.money, ...changes].slice(-12) }));
    for (const c of changes) {
      setTimeout(() => store.set((s) => ({ money: s.money.filter((m) => m.id !== c.id) })), c.showAt - Date.now() + 2600);
    }
  }, [state]);
}

/** Floating "−200 tỷ" over the player's piece on the board. */
export function MoneyFloaters({ state, room }: { state: PublicState; room: RoomView }) {
  const changes = useStore((s) => s.money);
  const [, tick] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pending = changes.filter((c) => c.showAt > Date.now());
    if (!pending.length) return;
    const id = setTimeout(() => tick((n) => n + 1), Math.min(...pending.map((c) => c.showAt)) - Date.now() + 10);
    return () => clearTimeout(id);
  }, [changes]);
  const board = box.current?.parentElement;
  const now = Date.now();
  return (
    <div className="money-layer" ref={box} aria-live="polite">
      {changes
        .filter((c) => c.showAt <= now)
        .map((c) => {
          const p = state.players.find((x) => x.id === c.player);
          const tile = p && board?.querySelector<HTMLElement>(`.tile[data-pos="${p.position}"]`);
          const b = board?.getBoundingClientRect();
          const r = tile?.getBoundingClientRect();
          const style = r && b ? { left: r.left - b.left + r.width / 2, top: r.top - b.top } : { left: '50%', top: '45%' };
          return (
            <div key={c.id} className={`money-float ${c.delta < 0 ? 'minus' : 'plus'}`} style={{ ...style, borderColor: colorOf(room, c.player) }}>
              <strong>
                {c.delta < 0 ? '−' : '+'}
                {money(Math.abs(c.delta))}
              </strong>
              <span>
                {nameOf(room, c.player)}
                {c.reason ? ` · ${c.reason}` : ''}
              </span>
            </div>
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------- dice result

const RESULT_MS = 2600;

/** "Lan tung 3 + 4 = 7" in big type once the dice have landed (no misreading the 3D dice). */
export function DiceResult({ room }: { room: RoomView }) {
  const game = useStore((s) => s.game);
  const board3d = useStore((s) => s.board3d);
  const [shown, setShown] = useState<{ player: string; dice: number[]; at: number } | null>(null);
  useEffect(() => {
    const roll = [...(game?.events ?? [])]
      .reverse()
      .find((e) => e.type === 'diceRolled' && ['normal', 'jail', 'reroll'].includes(String(e.purpose)));
    if (!roll) return;
    const show = setTimeout(() => setShown({ player: roll.player as string, dice: roll.dice as number[], at: Date.now() }), board3d ? DICE_MS : 0);
    return () => clearTimeout(show);
  }, [game, board3d]);
  useEffect(() => {
    if (!shown) return;
    const hide = setTimeout(() => setShown(null), RESULT_MS);
    return () => clearTimeout(hide);
  }, [shown?.at]);
  if (!shown) return null;
  const sum = shown.dice.reduce((a, b) => a + b, 0);
  const doubles = shown.dice.length === 2 && shown.dice[0] === shown.dice[1];
  return (
    <div className="dice-result" key={shown.at} role="status">
      <span>{t.diceResult(nameOf(room, shown.player), shown.dice, sum)}</span>
      {doubles && <strong>{t.doubles}</strong>}
    </div>
  );
}
