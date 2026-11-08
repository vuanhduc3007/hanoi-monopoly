import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyAction, createGame, publicView, type GameState } from '@hanoi-monopoly/engine';
import { App } from '../src/App';
import { t } from '../src/i18n/vi';
import type { RoomView } from '../src/net/protocol';
import { receiveGame, store } from '../src/store';

const sent: { type: string; payload: unknown }[] = [];
vi.mock('../src/net/connection', () => ({
  send: (type: string, payload: unknown) => sent.push({ type, payload }),
  act: (action: unknown) => sent.push({ type: 'action', payload: { action } }),
  reconnect: async () => false,
  leaveRoom: async () => undefined,
  createRoom: async () => undefined,
  joinRoom: async () => undefined,
  savedName: () => '',
}));

afterEach(() => {
  cleanup();
  store.reset();
  sent.length = 0;
});

const seats = (n: number, you = 'u1'): RoomView => ({
  code: 'ABC234',
  phase: 'playing',
  settings: { mode: 'classic', characters: true, scholarshipFund: true, buildingLimit: true, maxPlayers: 6, allowSpectators: true },
  you,
  seats: Array.from({ length: n }, (_, i) => ({
    id: `u${i + 1}`,
    name: `Người ${i + 1}`,
    host: i === 0,
    ready: true,
    character: null,
    connected: true,
    control: 'human',
    botReason: null,
  })),
  spectators: 0,
  picking: null,
});

function playing(mutate?: (s: GameState) => void) {
  const { state } = createGame({ players: [{ id: 'u1', character: 'C08' }, { id: 'u2', character: 'C05' }], seed: 3 });
  mutate?.(state);
  store.set({ room: seats(2), conn: 'connected' });
  receiveGame({ state: publicView(state), events: [], clock: { kind: 'roll', deadline: Date.now() + 15000 } });
  return state;
}

describe('screens', () => {
  it('S1 home when not in a room', () => {
    render(<App />);
    expect(screen.getByText(t.home.create)).toBeTruthy();
  });

  it('S2 lobby: host sees settings and start', () => {
    store.set({ room: { ...seats(2), phase: 'lobby' } });
    render(<App />);
    expect(screen.getByText(t.lobby.start)).toBeTruthy();
    fireEvent.click(screen.getByText(t.lobby.start));
    expect(sent).toContainEqual({ type: 'start', payload: undefined });
  });

  it('S3 pick: 8 character cards', () => {
    store.set({
      room: { ...seats(2), phase: 'picking', picking: { order: ['u2', 'u1'], current: 'u1', available: ['C01', 'C02'], clock: null } },
    });
    render(<App />);
    expect(screen.getAllByText(t.pick.choose)).toHaveLength(8);
  });

  it('S4 board: 40 tiles, roll button on my turn sends roll', () => {
    playing();
    render(<App />);
    expect(document.querySelectorAll('.tile')).toHaveLength(40);
    fireEvent.click(screen.getByText(t.act.roll));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'roll' } } });
  });

  it('S5 tile detail opens on click', () => {
    playing();
    render(<App />);
    fireEvent.click(screen.getByTitle('Hồ Gươm'));
    expect(screen.getByRole('dialog', { name: 'Hồ Gươm' })).toBeTruthy();
    expect(screen.getAllByText(/2\.000 tỷ/).length).toBeGreaterThan(0);
  });

  it('S6 buy decision', () => {
    const s = playing((st) => {
      st.riggedDice = [1, 2];
    });
    const r = applyAction(s, { type: 'roll', player: 'u1' });
    receiveGame({ state: publicView(r.state), events: r.events, clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(t.act.buy('60 tỷ')));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'buy' } } });
  });

  it('S7 trade and S8 assets open from the side panel', () => {
    playing((st) => {
      st.ownables.P01.owner = 'u1';
    });
    render(<App />);
    fireEvent.click(screen.getByText(t.board.assets));
    expect(screen.getByRole('dialog', { name: t.assets.title })).toBeTruthy();
    fireEvent.click(screen.getByText(t.assets.mortgage + ' (+30 tỷ)'));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'mortgage', propertyId: 'P01' } } });
    fireEvent.click(screen.getByLabelText(t.tile.close));
    fireEvent.click(screen.getByText(t.board.trade));
    expect(screen.getByRole('dialog', { name: t.trade.title })).toBeTruthy();
  });

  it('S9 game over shows ranking and rematch for the host', () => {
    const s = playing();
    const r = applyAction(s, { type: 'endGame' });
    receiveGame({ state: publicView(r.state), events: r.events, clock: null });
    store.set({ gameOver: { winner: r.state.winner, ranking: r.state.ranking, seed: 3, stats: { rentPaid: {}, rentEarned: {}, rentByTile: { P22: 50 } } } });
    render(<App />);
    expect(screen.getByRole('dialog', { name: t.over.title })).toBeTruthy();
    fireEvent.click(screen.getByText(t.over.rematch));
    expect(sent).toContainEqual({ type: 'rematch', payload: undefined });
  });
});
