import { useEffect, useRef, useState } from 'react';
import { type GameEvent, type PublicState } from '@hanoi-monopoly/engine';
import { D } from '../lib/gameData';
import { Hotel, House, TileIcon } from '../art/icons';
import { artFor } from '../art/tileArt';
import { money, t, tileName } from '../i18n/vi';
import { colorOf, nameOf } from '../lib/selectors';
import type { RoomView } from '../net/protocol';
import { store, useAnimSettled } from '../store';
import { makeDeed, makeHotel, makeHouse } from '../three/models';
import { Model3D } from '../three/Model3D';

export interface Moment {
  key: number;
  kind: 'buy' | 'house' | 'hotel';
  player: string;
  propertyId: string;
  price?: number;
}

/** Which board events deserve the 3D pop-up (pure — tested). */
export function momentsFrom(events: GameEvent[], startKey = 0): Moment[] {
  const out: Moment[] = [];
  let key = startKey;
  for (const e of events) {
    if (e.type === 'purchased') {
      out.push({ key: key++, kind: 'buy', player: e.player as string, propertyId: e.propertyId as string, price: e.price as number });
    } else if (e.type === 'auctionEnded' && e.winner) {
      out.push({ key: key++, kind: 'buy', player: e.winner as string, propertyId: e.propertyId as string, price: e.price as number });
    } else if (e.type === 'built') {
      out.push({ key: key++, kind: e.hotel ? 'hotel' : 'house', player: e.player as string, propertyId: e.propertyId as string });
    }
  }
  return out;
}

const SHOW_MS = 2400;

/** Pop-up in the middle of the board with a turning 3D model when land is bought or built on. */
export function Celebration({ room }: { state: PublicState; room: RoomView }) {
  const [queue, setQueue] = useState<Moment[]>([]);
  const seen = useRef(Number.POSITIVE_INFINITY);
  const keys = useRef(0);

  useEffect(() => {
    const log = store.get().log;
    seen.current = log.length ? log[log.length - 1].id : 0;
    return store.subscribe(() => {
      const fresh = store.get().log.filter((l) => l.id > seen.current);
      if (!fresh.length) return;
      seen.current = fresh[fresh.length - 1].id;
      const moments = momentsFrom(
        fresh.map((l) => l.event),
        keys.current,
      );
      keys.current += moments.length;
      if (moments.length) setQueue((q) => [...q, ...moments].slice(-4));
    });
  }, []);

  const settled = useAnimSettled();
  const current = settled ? queue[0] : undefined;
  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(id);
  }, [current?.key]);

  if (!current) return null;
  const who = nameOf(room, current.player);
  const tile = tileName(current.propertyId);
  const color = colorOf(room, current.player);
  const text =
    current.kind === 'buy' ? t.celebrate.bought(who, tile) : current.kind === 'hotel' ? t.celebrate.hotel(who, tile) : t.celebrate.house(who, tile);
  const group = D.ownables[current.propertyId]?.group;
  return (
    <div className="celebration" key={current.key} role="status" onClick={() => setQueue((q) => q.slice(1))}>
      {group && <div className="celebration-band" style={{ background: D.groups[group].color }} />}
      <Model3D
        id={`${current.key}`}
        make={() => (current.kind === 'buy' ? makeDeed(color) : current.kind === 'hotel' ? makeHotel(color) : makeHouse(color))}
        height={current.kind === 'hotel' ? 1.3 : current.kind === 'house' ? 0.75 : 1.05}
        size={170}
        fallback={current.kind === 'buy' ? <TileIcon kind={artFor(current.propertyId) ?? 'district'} size={96} /> : current.kind === 'hotel' ? <Hotel size={64} /> : <House size={56} />}
      />
      <div className="celebration-text" style={{ borderColor: color }}>
        {text}
        {current.price !== undefined && <span className="muted"> · {money(current.price)}</span>}
      </div>
    </div>
  );
}
