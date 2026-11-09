import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '@hanoi-monopoly/engine';
import { charName, formatEvent, money, t } from '../i18n/vi';
import { colorOf, currentPlayer, nameOf, who } from '../lib/selectors';
import { Token } from './Token';
import { send } from '../net/connection';
import type { ClockInfo, RoomView } from '../net/protocol';
import { useStore } from '../store';
import { money as fmtMoney } from '../i18n/vi';

export function PlayerList({ state, room }: { state: PublicState; room: RoomView }) {
  const current = currentPlayer(state).id;
  return (
    <section className="panel players">
      <h3>{t.board.players}</h3>
      {state.players.map((p) => {
        const seat = room.seats.find((s) => s.id === p.id);
        return (
          <div key={p.id} className={`player${p.id === current ? ' player-current' : ''}${p.bankrupt ? ' player-out' : ''}`}>
            <Token character={p.character} name={nameOf(room, p.id)} color={colorOf(room, p.id)} size={34} />
            <div className="player-main">
              <div className="player-name">
                {nameOf(room, p.id)}
                {p.id === room.you && <span className="tag">{t.you}</span>}
                {seat?.control === 'bot' && (
                  <span className="tag tag-bot" title={t.botReason[seat.botReason ?? ''] ?? ''}>
                    {t.bot}
                  </span>
                )}
                {seat && !seat.connected && seat.control === 'human' && <span className="tag">{t.board.disconnected}</span>}
              </div>
              <div className="muted">
                {state.config.characters ? charName(p.character) : ''}
                {p.inJail && ` · ${t.board.inJail}`}
                {p.bankrupt && ` · ${t.board.bankrupt}`}
                {p.jailCards.length > 0 && ' · 🪪'}
              </div>
            </div>
            <div className="player-cash">
              {p.bankrupt ? '—' : money(p.cash)}
              <CashDelta player={p.id} />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function Log({ state, room }: { state: PublicState; room: RoomView }) {
  const log = useStore((s) => s.log);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => stickToBottom(box.current), [log.length]);
  const w = who(room, state);
  return (
    <section className="panel log">
      <h3>{t.board.log}</h3>
      <div className="scroll" ref={box}>
        {log.map((l) => {
          const text = formatEvent(l.event, w);
          return text ? (
            <div key={l.id} className={`log-line log-${l.event.type}`}>
              {text}
            </div>
          ) : null;
        })}
      </div>
    </section>
  );
}

export function Chat({ room }: { room: RoomView }) {
  const chat = useStore((s) => s.chat);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => stickToBottom(box.current), [chat.length]);
  return (
    <section className="panel chat">
      <h3>{t.board.chat}</h3>
      <div className="scroll" ref={box}>
        {chat.map((m, i) => (
          <div key={i} className="chat-line">
            <strong>{m.spectator ? t.spectator : nameOf(room, m.from)}:</strong> {m.text ?? m.emote}
          </div>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send('chat', { text });
          setText('');
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.board.chatPlaceholder} maxLength={200} />
        <button type="submit">{t.board.send}</button>
      </form>
    </section>
  );
}

/** Countdown to a server deadline. */
export function Clock({ clock }: { clock: ClockInfo | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!clock) return null;
  if (clock.paused) return <div className="clock clock-paused">⏸ {t.board.clockPaused}</div>;
  const left = Math.max(0, Math.ceil((clock.deadline - now) / 1000));
  return (
    <div className={`clock${left <= 5 ? ' clock-low' : ''}`}>
      ⏱ {t.clockKind[clock.kind] ?? ''} {t.board.seconds(left)}
      {clock.extended && <span className="clock-extra"> {t.board.clockExtended}</span>}
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className="toast">
          {t.errors[x.code] ?? x.code}
          {x.code === 'RULE' && x.message ? <span className="muted"> ({x.message})</span> : null}
        </div>
      ))}
    </div>
  );
}


function stickToBottom(el: HTMLElement | null): void {
  if (el) el.scrollTop = el.scrollHeight;
}

/** "−200 tỷ" / "+200 tỷ" next to a player's cash while the change is fresh. */
function CashDelta({ player }: { player: string }) {
  const changes = useStore((s) => s.money);
  const c = [...changes].reverse().find((x) => x.player === player && x.showAt <= Date.now());
  if (!c) return null;
  return (
    <span key={c.id} className={`cash-delta ${c.delta < 0 ? 'minus' : 'plus'}`}>
      {c.delta < 0 ? '−' : '+'}
      {fmtMoney(Math.abs(c.delta))}
    </span>
  );
}
