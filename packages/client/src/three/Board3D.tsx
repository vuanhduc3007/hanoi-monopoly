import { useEffect, useRef } from 'react';
import { defaultData as D, type PublicState } from '@hanoi-monopoly/engine';
import { t } from '../i18n/vi';
import { colorOf, currentPlayer, hotelLevel } from '../lib/selectors';
import type { RoomView } from '../net/protocol';
import { store } from '../store';
import { BoardScene, type Anchor, type BuildingView, type PieceView } from './boardScene';
import { planFromEvents } from './path';
import { hasWebGL } from './models';

/** Extra canvas space above the board so tall pieces on the top row are not clipped. */
export const TOP_BLEED = 0.1;

/**
 * Transparent WebGL layer over the 2D board. Calls onActive(true) once it
 * runs, so the board can hide its 2D pieces; without WebGL it renders nothing.
 */
export function Board3D({ state, room, onActive }: { state: PublicState; room: RoomView; onActive: (on: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BoardScene | null>(null);
  /** Positions before the latest update (to plan walks). */
  const positions = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !hasWebGL()) return;
    let s: BoardScene;
    try {
      s = new BoardScene(el, t.you.toUpperCase());
    } catch {
      return;
    }
    scene.current = s;
    s.onArrest = (player) => store.set({ arrest: { player, at: Date.now() } });
    const board = el.parentElement!;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const anchors: Anchor[] = [];
      board.querySelectorAll<HTMLElement>('.tile[data-pos]').forEach((tile) => {
        const r = tile.getBoundingClientRect();
        anchors[Number(tile.dataset.pos)] = {
          x: r.left - box.left + r.width / 2,
          y: r.top - box.top + r.height / 2,
          w: r.width,
          h: r.height,
        };
      });
      const b = board.getBoundingClientRect();
      s.resize(box.width, box.height, anchors, { x: b.left - box.left + b.width / 2, y: b.top - box.top + b.height / 2 });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    measure();
    onActive(true);
    store.set({ board3d: true });
    const onVisibility = () => (document.hidden ? s.stop() : s.start());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      s.dispose();
      scene.current = null;
      positions.current = null;
      store.set({ board3d: false });
      onActive(false);
    };
  }, [onActive]);

  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    const current = currentPlayer(state).id;
    const H = hotelLevel(state);
    const pieces: PieceView[] = state.players
      .filter((p) => !p.bankrupt)
      .map((p) => ({
        id: p.id,
        character: p.character,
        color: colorOf(room, p.id),
        position: p.position,
        inJail: p.inJail,
        isMe: p.id === room.you,
        isCurrent: p.id === current && state.status === 'playing',
      }));
    const buildings: BuildingView[] = Object.entries(state.ownables)
      .filter(([, o]) => o.level > 0)
      .map(([id, o]) => ({
        id,
        position: positionOf(id),
        houses: o.level === H ? 0 : o.level,
        hotel: o.level === H,
      }));
    // Choreograph this update's events (dice first, then walking / arrests).
    const events = store.get().game?.events ?? [];
    const before = positions.current;
    const jail = D.board.findIndex((tile) => tile.ref === 'JAIL');
    const plan = before ? planFromEvents(events, before, jail) : { steps: {} };
    const busy = s.sync(pieces, buildings, plan);
    positions.current = Object.fromEntries(state.players.map((p) => [p.id, p.position]));
    store.set({ animUntil: Date.now() + busy });
  }, [state, room]);

  return <canvas ref={canvas} className="board-3d" aria-hidden style={{ top: `-${TOP_BLEED * 100}%`, height: `${(1 + TOP_BLEED) * 100}%` }} />;
}

const positionOf = (id: string) => D.ownables[id].position;
