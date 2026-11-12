import { charName, money, t, teamName, tileName } from '../i18n/vi';
import { TeamTag } from '../components/TeamTag';
import { colorOf, nameOf } from '../lib/selectors';
import { leaveRoom, send } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';
import { Token } from '../components/Token';
import { TEAM_COLORS } from '../lib/board';

/** S9 — ranking, stats (most profitable tile, total rent paid), play again. */
export function GameOver({ room }: { room: RoomView }) {
  const over = useStore((s) => s.gameOver);
  const state = useStore((s) => s.game?.state);
  const ranking = over?.ranking ?? state?.ranking ?? [];
  const winner = over?.winner ?? state?.winner ?? null;
  const winnerTeam = over?.winnerTeam ?? state?.winnerTeam ?? null;
  const teamMates = winnerTeam !== null && state ? state.players.filter((p) => p.team === winnerTeam).map((p) => nameOf(room, p.id)) : [];
  const stats = over?.stats;
  const host = room.seats.find((s) => s.id === room.you)?.host;
  const best = stats ? Object.entries(stats.rentByTile).sort((a, b) => b[1] - a[1])[0] : undefined;
  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide gameover" role="dialog" aria-label={t.over.title}>
        <Fireworks />
        <h2>{t.over.title}</h2>
        {winnerTeam !== null ? (
          <p className="winner">{t.teams.won(teamName(winnerTeam), teamMates.join(', '))}</p>
        ) : (
          winner && <p className="winner">{t.over.winner(nameOf(room, winner))}</p>
        )}
        {winnerTeam !== null && state && <TeamTotals ranking={ranking} players={state.players} />}
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
                    {nameOf(room, r.player)} <TeamTag team={p?.team} short />{' '}
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

/** Team games: each team's summed net worth (eliminated teams last), as the result was decided. */
function TeamTotals({
  ranking,
  players,
}: {
  ranking: { player: string; score: number }[];
  players: { id: string; team?: number | null; bankrupt: boolean }[];
}) {
  const order: number[] = [];
  const totals = new Map<number, { worth: number; left: number }>();
  for (const r of ranking) {
    const p = players.find((x) => x.id === r.player);
    if (p?.team === undefined || p.team === null) continue;
    if (!order.includes(p.team)) order.push(p.team);
    const x = totals.get(p.team) ?? { worth: 0, left: 0 };
    if (!p.bankrupt) {
      x.worth += Math.max(0, r.score);
      x.left++;
    }
    totals.set(p.team, x);
  }
  return (
    <div className="team-totals team-totals-over">
      {order.map((team, i) => (
        <div key={team} className={`team-total${totals.get(team)!.left === 0 ? ' player-out' : ''}`} style={{ borderColor: TEAM_COLORS[team % TEAM_COLORS.length] }}>
          <span className="team-total-name">
            {i + 1}. {teamName(team)}
          </span>
          <span />
          <span className="team-total-worth">{totals.get(team)!.left === 0 ? t.board.bankrupt : money(totals.get(team)!.worth)}</span>
        </div>
      ))}
    </div>
  );
}
