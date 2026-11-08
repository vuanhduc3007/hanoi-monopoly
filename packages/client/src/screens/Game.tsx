import { useState } from 'react';
import { Assets } from '../components/Assets';
import { Board } from '../components/Board';
import { Decision } from '../components/Decision';
import { Chat, Clock, Log, PlayerList } from '../components/Side';
import { TileDetail } from '../components/TileDetail';
import { Trade } from '../components/Trade';
import { t } from '../i18n/vi';
import { me } from '../lib/selectors';
import { leaveRoom } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';
import { GameOver } from './GameOver';
import { MuteButton } from '../sound/MuteButton';
import { useGameSounds } from '../sound/useSounds';

/** S4 layout: board on the left, panels on the right (drawer on mobile). */
export function Game({ room }: { room: RoomView }) {
  const game = useStore((s) => s.game);
  const clock = useStore((s) => s.clock);
  const over = useStore((s) => s.gameOver);
  const [tile, setTile] = useState<number | null>(null);
  const [panel, setPanel] = useState<'assets' | 'trade' | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [zoom, setZoom] = useState(1);
  useGameSounds(room.you);
  if (!game) return null;
  const state = game.state;
  const self = me(room, state);
  const incoming = self ? state.trades.filter((x) => x.to === self.id).length : 0;
  return (
    <main className="game">
      <div className="board-wrap">
        <div className="board-scroll">
          <div className="board-scale" style={{ width: `${zoom * 100}%` }}>
            <Board state={state} room={room} onTile={setTile} />
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
          <Clock clock={clock} />
          {self && !self.bankrupt && (
            <div className="buttons">
              <button onClick={() => setPanel('assets')}>{t.board.assets}</button>
              <button onClick={() => setPanel('trade')}>
                {t.board.trade}
                {incoming > 0 && <span className="badge">{incoming}</span>}
              </button>
            </div>
          )}
          <MuteButton />
          <button className="link" onClick={() => void leaveRoom()}>
            {t.lobby.leave}
          </button>
        </div>
        <Decision state={state} room={room} openAssets={() => setPanel('assets')} openTrade={() => setPanel('trade')} />
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
      {panel === 'assets' && <Assets state={state} room={room} onClose={() => setPanel(null)} />}
      {panel === 'trade' && <Trade state={state} room={room} onClose={() => setPanel(null)} />}
      {(state.status === 'over' || over) && <GameOver room={room} />}
    </main>
  );
}
