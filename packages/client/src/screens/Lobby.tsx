import { useState } from 'react';
import { D } from '../lib/gameData';
import { Chat } from '../components/Side';
import { Token } from '../components/Token';
import { MuteButton } from '../sound/MuteButton';
import { charName, t } from '../i18n/vi';
import { colorOf, nameOf } from '../lib/selectors';
import { leaveRoom, send } from '../net/connection';
import type { RoomSettings, RoomView } from '../net/protocol';

/** S2 — players, room settings, ready, chat. */
export function Lobby({ room }: { room: RoomView }) {
  const mySeat = room.seats.find((s) => s.id === room.you);
  const host = !!mySeat?.host;
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const allReady = room.seats.length >= D.config.room.minPlayers && room.seats.every((s) => s.host || s.ready);
  const set = (patch: Partial<RoomSettings>) => send('setConfig', patch);
  const s = room.settings;
  return (
    <main className="lobby">
      <header className="lobby-head">
        <h1>{t.lobby.title}</h1>
        <div className="code">
          {t.lobby.code}: <strong>{room.code}</strong>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t.lobby.copied : t.lobby.copyLink}
          </button>
        </div>
        <MuteButton />
        <button onClick={() => void leaveRoom()}>{t.lobby.leave}</button>
      </header>
      <div className="lobby-body">
        <section className="panel">
          <h3>
            {t.lobby.players} ({room.seats.length}/{s.maxPlayers})
          </h3>
          {room.seats.map((seat) => (
            <div key={seat.id} className="player">
              <Token character={null} name={nameOf(room, seat.id)} color={colorOf(room, seat.id)} size={30} />
              <span className="player-main">
                {nameOf(room, seat.id)}
                {seat.id === room.you && <span className="tag">{t.you}</span>}
                {seat.host && <span className="tag">{t.host}</span>}
                {!seat.connected && <span className="tag">{t.board.disconnected}</span>}
              </span>
              <span className={`ready-state ${seat.host || seat.ready ? 'ok' : 'muted'}`}>{seat.host || seat.ready ? t.lobby.ready : t.lobby.notReady}</span>
            </div>
          ))}
          {room.spectators > 0 && <p className="muted">{t.lobby.spectators(room.spectators)}</p>}
          {mySeat && <Rename current={mySeat.name ?? ''} />}
          <div className="buttons">
            {mySeat && !host && (
              <button className="primary" onClick={() => send('ready', { ready: !mySeat.ready })}>
                {mySeat.ready ? t.lobby.cancelReady : t.lobby.toggleReady}
              </button>
            )}
            {host && (
              <button className="primary" disabled={!allReady} onClick={() => send('start')}>
                {t.lobby.start}
              </button>
            )}
            {!host && <span className="muted">{t.lobby.waitingHost}</span>}
          </div>
        </section>
        <section className="panel settings">
          <h3>{t.lobby.settings}</h3>
          <Setting label={t.lobby.mode}>
            <select disabled={!host} value={s.mode} onChange={(e) => set({ mode: e.target.value as 'classic' | 'quick' })}>
              <option value="classic">{t.lobby.modes.classic}</option>
              <option value="quick">{t.lobby.modes.quick}</option>
            </select>
          </Setting>
          <Setting label={t.lobby.board}>
            <select disabled={!host} value={s.board ?? 'auto'} onChange={(e) => set({ board: e.target.value as RoomSettings['board'] })}>
              <option value="auto">{t.lobby.boards.auto}</option>
              <option value="standard">{t.lobby.boards.standard}</option>
              <option value="extended">{t.lobby.boards.extended}</option>
              <option value="large">{t.lobby.boards.large}</option>
            </select>
          </Setting>
          <p className="muted setting-hint">
            {t.lobby.boards.hint(D.config.room.autoBoardFrom.extended ?? 5, D.config.room.autoBoardFrom.large ?? 7)}
          </p>
          {(['characters', 'scholarshipFund', 'buildingLimit', 'allowSpectators'] as const).map((k) => (
            <Setting key={k} label={t.lobby[k]}>
              <input type="checkbox" disabled={!host} checked={s[k]} onChange={(e) => set({ [k]: e.target.checked })} />
            </Setting>
          ))}
          <Setting label={t.lobby.maxPlayers}>
            <select disabled={!host} value={s.maxPlayers} onChange={(e) => set({ maxPlayers: Number(e.target.value) })}>
              {Array.from({ length: D.config.room.maxPlayers - D.config.room.minPlayers + 1 }, (_, i) => i + D.config.room.minPlayers).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Setting>
          {s.characters && (
            <p className="muted">
              {Object.keys(D.characters)
                .map((id) => charName(id))
                .join(' · ')}
            </p>
          )}
        </section>
        <Chat room={room} />
      </div>
    </main>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="setting">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Rename({ current }: { current: string }) {
  const [name, setName] = useState(current);
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        send('setName', { name });
      }}
    >
      <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} aria-label={t.home.yourName} />
      <button type="submit">{t.lobby.rename}</button>
    </form>
  );
}
