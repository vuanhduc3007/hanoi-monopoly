import { defaultData as D } from '@hanoi-monopoly/engine';
import { Avatar } from '../art/icons';
import { Clock } from '../components/Side';
import { describeCharacter, t } from '../i18n/vi';
import { nameOf } from '../lib/selectors';
import { send } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';

/** S3 — 8 character cards, countdown, pick order (last player picks first). */
export function Pick({ room }: { room: RoomView }) {
  const turnOrder = useStore((s) => s.turnOrder);
  const pick = room.picking;
  if (!pick) return null;
  const mine = pick.current === room.you;
  const takenBy = (id: string) => room.seats.find((s) => s.character === id);
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
      <div className="characters">
        {Object.keys(D.characters).map((id) => {
          const c = describeCharacter(id);
          const owner = takenBy(id);
          const free = pick.available.includes(id);
          return (
            <article key={id} className={`character${owner ? ' taken' : ''}`}>
              <header className="character-head">
                <Avatar character={id} size={56} label={c.name} />
                <h3>
                  <span className="muted">{id}</span> {c.name}
                </h3>
              </header>
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
