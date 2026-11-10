import { useState } from 'react';
import { TutorialSetting } from '../components/Coach';
import { D } from '../lib/gameData';
import { Chat } from '../components/Side';
import { Token } from '../components/Token';
import { TeamTag } from '../components/TeamTag';
import { TEAM_COLORS } from '../lib/board';
import { MuteButton } from '../sound/MuteButton';
import { charName, t } from '../i18n/vi';
import { colorOf, nameOf } from '../lib/selectors';
import { leaveRoom, send } from '../net/connection';
import type { RoomSettings, RoomView, SeatView } from '../net/protocol';

/** S2 — players, room settings, ready, chat. */
export function Lobby({ room }: { room: RoomView }) {
  const mySeat = room.seats.find((s) => s.id === room.you);
  const host = !!mySeat?.host;
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const s = room.settings;
  const teamCount = s.teams ?? 0;
  const teamSizes = Array.from({ length: teamCount }, (_, i) => room.seats.filter((x) => x.team === i).length);
  const teamsOk = !teamCount || (Math.min(...teamSizes) >= 1 && Math.max(...teamSizes) - Math.min(...teamSizes) <= 1);
  const allReady = room.seats.length >= D.config.room.minPlayers && room.seats.every((x) => x.host || x.ready) && teamsOk;
  const set = (patch: Partial<RoomSettings>) => send('setConfig', patch);
  const seatRow = (seat: SeatView) => (
    <div key={seat.id} className="player">
      <Token character={null} name={nameOf(room, seat.id)} color={colorOf(room, seat.id)} size={30} />
      <span className="player-main">
        {nameOf(room, seat.id)}
        {seat.id === room.you && <span className="tag">{t.you}</span>}
        {seat.host && <span className="tag">{t.host}</span>}
        {!seat.connected && <span className="tag">{t.board.disconnected}</span>}
        {seat.learner && (
          <span className="tag tag-learner" title={t.tutorial.learnerTitle}>
            {t.tutorial.learnerTag}
          </span>
        )}
      </span>
      <span className={`ready-state ${seat.host || seat.ready ? 'ok' : 'muted'}`}>{seat.host || seat.ready ? t.lobby.ready : t.lobby.notReady}</span>
    </div>
  );
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
          {teamCount === 0 && room.seats.map(seatRow)}
          {teamCount > 0 && (
            <div className="teams">
              {teamSizes.map((n, team) => (
                <div key={team} className="team" style={{ borderColor: TEAM_COLORS[team % TEAM_COLORS.length] }}>
                  <div className="team-head">
                    <TeamTag team={team} />
                    <span className="muted">{n}</span>
                    {mySeat && mySeat.team !== team && (
                      <button className="small" onClick={() => send('setTeam', { team })}>
                        {t.lobby.joinTeam}
                      </button>
                    )}
                  </div>
                  {room.seats.filter((x) => x.team === team).map(seatRow)}
                </div>
              ))}
              {host && <button onClick={() => send('shuffleTeams')}>🔀 {t.lobby.shuffleTeams}</button>}
              {!teamsOk && <p className="warn">{t.lobby.unevenTeams}</p>}
            </div>
          )}
          {room.spectators > 0 && <p className="muted">{t.lobby.spectators(room.spectators)}</p>}
          {mySeat && <Rename current={mySeat.name ?? ''} />}
          {mySeat && <TutorialSetting label={t.tutorial.lobbyToggle} />}
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
          <Setting label={t.lobby.teams}>
            <select disabled={!host} value={teamCount} onChange={(e) => set({ teams: Number(e.target.value) })}>
              {[0, ...D.config.room.teamCounts].map((n) => (
                <option key={n} value={n}>
                  {t.lobby.teamOptions(n)}
                </option>
              ))}
            </select>
          </Setting>
          {teamCount > 0 && <p className="muted setting-hint">{t.lobby.teamHint}</p>}
          {s.characters && (
            <Setting label={t.lobby.draft}>
              <select disabled={!host} value={s.draft ?? 'pick'} onChange={(e) => set({ draft: e.target.value as RoomSettings['draft'] })}>
                <option value="pick">{t.lobby.drafts.pick}</option>
                <option value="random">{t.lobby.drafts.random}</option>
              </select>
            </Setting>
          )}
          {s.characters && s.draft === 'random' && <p className="muted setting-hint">{t.lobby.draftHint}</p>}
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
