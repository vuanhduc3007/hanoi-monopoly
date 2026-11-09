import { useState } from 'react';
import { autoBoard } from '@hanoi-monopoly/engine';
import { D, setBoard, setTablePlayers } from '../lib/gameData';
import { Avatar } from '../art/icons';
import { Clock } from '../components/Side';
import { describeCharacter, t } from '../i18n/vi';
import { colorOf, nameOf } from '../lib/selectors';
import { makeCharacter } from '../three/models';
import { Model3D } from '../three/Model3D';
import { send } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';

/** S3 — character cards, countdown, pick order (last player picks first). */
export function Pick({ room }: { room: RoomView }) {
  const turnOrder = useStore((s) => s.turnOrder);
  const pick = room.picking;
  const [preview, setPreview] = useState(Object.keys(D.characters)[0]);
  if (!pick) return null;
  const myColor = colorOf(room, room.you ?? '');
  const mine = pick.current === room.you;
  const takenBy = (id: string) => room.seats.find((s) => s.character === id);
  // Characters have their own numbers at 2–3 player tables, and bigger boards scale salary / cash.
  const players = room.seats.length;
  setBoard(room.settings.board === 'auto' || !room.settings.board ? autoBoard(players) : room.settings.board);
  setTablePlayers(players);
  return (
    <main className="pick">
      <header className="lobby-head">
        <h1>{t.pick.title}</h1>
        <Clock clock={pick.clock} />
      </header>
      <p className={mine ? 'your-turn' : 'muted'}>{mine ? t.pick.yourTurn : t.pick.waiting(nameOf(room, pick.current))}</p>
      <p className="muted">
        {t.pick.order}: {pick.order.map((id) => nameOf(room, id)).join(' → ')}
      </p>
      {turnOrder && (
        <p className="muted">
          {t.pick.turnOrder}:{' '}
          {turnOrder.order
            .map((id) => `${nameOf(room, id)} (${(turnOrder.rolls[id] ?? []).map((r) => r[0] + r[1]).join('/')})`)
            .join(', ')}
        </p>
      )}
      <section className="pick-preview panel" aria-label={t.pick3d}>
        <Model3D
          id={preview}
          make={() => makeCharacter(preview, myColor)}
          size={190}
          fallback={<Avatar character={preview} size={120} label={describeCharacter(preview, players).name} />}
        />
        <div>
          <h2>{describeCharacter(preview, players).name}</h2>
          <p className="muted">{describeCharacter(preview, players).skill}</p>
        </div>
      </section>
      <div className="characters">
        {Object.keys(D.characters).map((id) => {
          const c = describeCharacter(id, players);
          const owner = takenBy(id);
          const free = pick.available.includes(id);
          return (
            <article
              key={id}
              className={`character${owner ? ' taken' : ''}${preview === id ? ' previewing' : ''}`}
              onMouseEnter={() => setPreview(id)}
              onFocus={() => setPreview(id)}
              onClick={() => setPreview(id)}
            >
              <header className="character-head">
                <Avatar character={id} size={56} label={c.name} />
                <h3>
                  <span className="muted">{id}</span> {c.name}
                </h3>
              </header>
              {c.tableNote && <p className="table-note">{c.tableNote}</p>}
              <h4>{t.pick.passive}</h4>
              <ul>
                {c.passives.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h4>{t.pick.drawback}</h4>
              <ul>
                {c.drawbacks.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h4>{t.pick.skill}</h4>
              <p>{c.skill}</p>
              {owner ? (
                <p className="ok">{t.pick.taken(nameOf(room, owner.id))}</p>
              ) : (
                <button className="primary" disabled={!mine || !free} onClick={() => send('pick', { character: id })}>
                  {t.pick.choose}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
