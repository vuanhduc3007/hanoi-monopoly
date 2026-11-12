import { useEffect, useState } from 'react';
import { Assets } from '../components/Assets';
import { Characters } from '../components/Characters';
import { Coach, TutorialButton } from '../components/Coach';
import { Board } from '../components/Board';
import { Decision, type PickMode } from '../components/Decision';
import { Chat, Clock, Log, PlayerList } from '../components/Side';
import { TileDetail } from '../components/TileDetail';
import { Trade } from '../components/Trade';
import { t } from '../i18n/vi';
import { D } from '../lib/gameData';
import { whyCantFlashSale } from '@hanoi-monopoly/engine';
import { isMyTurn, me } from '../lib/selectors';
import { act, leaveRoom, send } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';
import { GameOver } from './GameOver';
import { MuteButton } from '../sound/MuteButton';
import { useGameSounds } from '../sound/useSounds';

/** Room code for coming back later; a click copies the invite link. */
function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="room-code"
      title={t.lobby.copyLink}
      onClick={() => {
        void navigator.clipboard?.writeText(`${location.origin}${location.pathname}?room=${code}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? t.lobby.copied : (
        <>
          <span className="room-code-label">{t.board.roomCode} </span>
          <strong>{code}</strong>
        </>
      )}
    </button>
  );
}

/** S4 layout: board on the left, panels on the right (drawer on mobile). */
export function Game({ room }: { room: RoomView }) {
  const game = useStore((s) => s.game);
  const clock = useStore((s) => s.clock);
  const over = useStore((s) => s.gameOver);
  const [tile, setTile] = useState<number | null>(null);
  const [pick, setPick] = useState<PickMode>(null);
  const [panel, setPanel] = useState<'assets' | 'trade' | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [chars, setChars] = useState(false);
  const [zoom, setZoom] = useState(1);
  useGameSounds(room.you);
  // Tài sản → +2 minutes on your clock; Giao dịch → your clock waits (server side).
  useEffect(() => {
    send('thinking', { mode: panel });
  }, [panel]);
  if (!game) return null;
  const state = game.state;
  const self = me(room, state);
  const incoming = self ? state.trades.filter((x) => x.to === self.id).length : 0;
  const playing = !!self && !self.bankrupt;
  // Choosing a tile on the board: Du lịch (only while it is still this player's roll) or
  // Flash sale (an unowned tile, any time in the turn).
  const picking =
    pick !== null && !!self && isMyTurn(room, state) && !state.pending && (pick === 'flash' || state.turn.phase === 'roll');
  const onTile = (pos: number) => {
    if (!picking) return setTile(pos);
    if (pick === 'travel') {
      if (pos === self!.position) return;
      setPick(null);
      return act({ type: 'useSkill', position: pos });
    }
    const ref = D.board[pos].ref;
    if (!ref || whyCantFlashSale(state, self!.id, ref, D) !== null) return setTile(pos);
    setPick(null);
    act({ type: 'useSkill', propertyId: ref });
  };
  return (
    <main className="game">
      <div className={`board-wrap${picking ? ' picking' : ''}`} data-coach="board">
        <div className="board-scroll">
          <div className="board-scale" style={{ width: `${zoom * 100}%` }}>
            <Board state={state} room={room} onTile={onTile} />
          </div>
        </div>
        <div className="zoom-controls">
          <button onClick={() => setZoom(Math.max(1, zoom - 0.5))} disabled={zoom <= 1} aria-label={t.mobile.zoomOut}>
            −
          </button>
          <button onClick={() => setZoom(Math.min(2.5, zoom + 0.5))} disabled={zoom >= 2.5} aria-label={t.mobile.zoomIn}>
            +
          </button>
        </div>
      </div>
      <aside className="side">
        <div className="side-top">
          <div className="side-status">
            <RoomCode code={room.code} />
            <div className="side-clock">
              <Clock clock={clock} />
            </div>
            <TutorialButton />
            <MuteButton />
            <button className="link" onClick={() => void leaveRoom()}>
              {t.lobby.leave}
            </button>
          </div>
          {/* Fixed three-column row: the buttons never move, whatever the clock says. */}
          <div className="side-actions" data-coach="actions">
            <button data-coach="assets" onClick={() => setPanel('assets')} disabled={!playing}>
              {t.board.assets}
            </button>
            <button data-coach="trade" onClick={() => setPanel('trade')} disabled={!playing}>
              {t.board.trade}
              {incoming > 0 && <span className="badge">{incoming}</span>}
            </button>
            <button data-coach="chars" onClick={() => setChars(true)}>
              {t.characters.button}
            </button>
          </div>
        </div>
        {playing && <Coach state={state} room={room} scope="game" />}
        <Decision
          state={state}
          room={room}
          openAssets={() => setPanel('assets')}
          openTrade={() => setPanel('trade')}
          pick={picking ? pick : null}
          setPick={setPick}
        />
        <button className="drawer-toggle" onClick={() => setDrawer(!drawer)} aria-expanded={drawer}>
          {drawer ? t.mobile.less : t.mobile.more}
        </button>
        <div className={`drawer${drawer ? ' open' : ''}`}>
          <PlayerList state={state} room={room} />
          <Log state={state} room={room} />
          <Chat room={room} />
        </div>
      </aside>
      {tile !== null && <TileDetail pos={tile} state={state} room={room} onClose={() => setTile(null)} />}
      {chars && <Characters state={state} room={room} onClose={() => setChars(false)} />}
      {panel === 'assets' && <Assets state={state} room={room} onClose={() => setPanel(null)} />}
      {panel === 'trade' && <Trade state={state} room={room} onClose={() => setPanel(null)} />}
      {(state.status === 'over' || over) && <GameOver room={room} />}
    </main>
  );
}
