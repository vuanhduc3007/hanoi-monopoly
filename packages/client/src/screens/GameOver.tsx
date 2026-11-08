import { charName, money, t, tileName } from '../i18n/vi';
import { colorOf, nameOf } from '../lib/selectors';
import { leaveRoom, send } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';
import { Token } from '../components/Token';

/** S9 — ranking, stats (most profitable tile, total rent paid), play again. */
export function GameOver({ room }: { room: RoomView }) {
  const over = useStore((s) => s.gameOver);
  const state = useStore((s) => s.game?.state);
  const ranking = over?.ranking ?? state?.ranking ?? [];
  const winner = over?.winner ?? state?.winner ?? null;
  const stats = over?.stats;
  const host = room.seats.find((s) => s.id === room.you)?.host;
  const best = stats ? Object.entries(stats.rentByTile).sort((a, b) => b[1] - a[1])[0] : undefined;
  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide gameover" role="dialog" aria-label={t.over.title}>
        <Fireworks />
        <h2>{t.over.title}</h2>
        {winner && <p className="winner">{t.over.winner(nameOf(room, winner))}</p>}
        <table className="ranking">
          <thead>
            <tr>
              <th>{t.over.rank}</th>
              <th />
              <th>{t.over.score}</th>
              {stats && <th>{t.over.rentPaid}</th>}
              {stats && <th>{t.over.rentEarned}</th>}
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => {
              const p = state?.players.find((x) => x.id === r.player);
              return (
                <tr key={r.player}>
                  <td>{i + 1}</td>
                  <td>
                    <Token character={p?.character ?? null} name={nameOf(room, r.player)} color={colorOf(room, r.player)} size={26} />{' '}
                    {nameOf(room, r.player)}{' '}
                    <span className="muted">{p?.character ? charName(p.character) : ''}</span>
                  </td>
                  <td>{p?.bankrupt ? t.over.bankruptAt : money(r.score)}</td>
                  {stats && <td>{money(stats.rentPaid[r.player] ?? 0)}</td>}
                  {stats && <td>{money(stats.rentEarned[r.player] ?? 0)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {best && (
          <p>
            {t.over.bestTile}: <strong>{tileName(best[0])}</strong> ({money(best[1])})
          </p>
        )}
        <div className="buttons">
          {host && (
            <button className="primary" onClick={() => send('rematch')}>
              {t.over.rematch}
            </button>
          )}
          <button onClick={() => void leaveRoom()}>{t.over.home}</button>
        </div>
      </div>
    </div>
  );
}

const SPARK_COLORS = ['#B8312F', '#E3A72F', '#2E4A7D', '#5F7F3A', '#E7A6A1'];

/** Pháo hoa: a few CSS bursts behind the ranking. */
function Fireworks() {
  const sparks = Array.from({ length: 36 }, (_, i) => {
    const burst = i % 3;
    const angle = (i / 12) * Math.PI * 2;
    return {
      left: `${20 + burst * 30}%`,
      top: `${18 + (burst % 2) * 14}%`,
      background: SPARK_COLORS[i % SPARK_COLORS.length],
      animationDelay: `${burst * 0.45}s`,
      ['--dx' as string]: `${Math.cos(angle) * 70}px`,
      ['--dy' as string]: `${Math.sin(angle) * 70}px`,
    };
  });
  return (
    <div className="fireworks" aria-hidden>
      {sparks.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  );
}
