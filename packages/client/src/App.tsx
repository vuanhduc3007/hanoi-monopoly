import { useEffect } from 'react';
import { Toasts } from './components/Side';
import { t } from './i18n/vi';
import { reconnect } from './net/connection';
import { Game } from './screens/Game';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Pick } from './screens/Pick';
import { useStore } from './store';

export function App() {
  const room = useStore((s) => s.room);
  const conn = useStore((s) => s.conn);
  useEffect(() => {
    void reconnect(4);
  }, []);
  return (
    <>
      {conn === 'reconnecting' && room && <div className="banner">{t.home.reconnecting}</div>}
      {!room && <Home />}
      {room?.phase === 'lobby' && <Lobby room={room} />}
      {room?.phase === 'picking' && <Pick room={room} />}
      {(room?.phase === 'playing' || room?.phase === 'over') && <Game room={room} />}
      <Toasts />
    </>
  );
}
