import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyAction, createGame, defaultData, publicView, type GameState } from '@hanoi-monopoly/engine';
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
  setTutorial: () => undefined,
}));

afterEach(() => {
  cleanup();
  store.reset();
  sent.length = 0;
});

const seats = (n: number, you = 'u1'): RoomView => ({
  code: 'ABC234',
  phase: 'playing',
  settings: {
    mode: 'classic',
    board: 'auto',
    characters: true,
    scholarshipFund: true,
    buildingLimit: true,
    maxPlayers: 6,
    allowSpectators: true,
    teams: 0,
    draft: 'pick',
  },
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
    team: null,
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

  it('S3 pick: one card per character', () => {
    store.set({
      room: { ...seats(2), phase: 'picking', picking: { order: ['u2', 'u1'], current: 'u1', available: ['C01', 'C02'], clock: null } },
    });
    render(<App />);
    expect(screen.getAllByText(t.pick.choose)).toHaveLength(Object.keys(defaultData.characters).length);
  });

  it('S3 pick: the player on the clock can pick at random; Bốc thăm hides the choose buttons', () => {
    const picking = { order: ['u2', 'u1'], current: 'u1', available: ['C01', 'C02'], clock: null };
    store.set({ room: { ...seats(2), phase: 'picking', picking } });
    render(<App />);
    fireEvent.click(screen.getByText(new RegExp(t.pick.random)));
    expect(sent).toContainEqual({ type: 'pick', payload: { random: true } });
    cleanup();
    const draw = seats(2);
    store.set({ room: { ...draw, settings: { ...draw.settings, draft: 'random' }, phase: 'picking', picking } });
    render(<App />);
    expect(screen.queryByText(new RegExp(t.pick.random))).toBeNull();
    expect(screen.getByText(t.pick.drawing('Người 1'))).toBeTruthy();
    for (const b of screen.getAllByText(t.pick.choose)) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('S2 lobby with teams: seats listed per team, join another team, host shuffles; uneven teams block start', () => {
    const r = seats(4);
    r.seats.forEach((x, i) => (x.team = i < 3 ? 0 : 1));
    store.set({ room: { ...r, settings: { ...r.settings, teams: 2 }, phase: 'lobby' } });
    render(<App />);
    expect(screen.getAllByText(t.teams.names[0]).length).toBeGreaterThan(0);
    expect(screen.getByText(t.lobby.unevenTeams)).toBeTruthy();
    expect((screen.getByText(t.lobby.start) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText(t.lobby.joinTeam));
    expect(sent).toContainEqual({ type: 'setTeam', payload: { team: 1 } });
    fireEvent.click(screen.getByText(new RegExp(t.lobby.shuffleTeams)));
    expect(sent).toContainEqual({ type: 'shuffleTeams', payload: undefined });
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

  it('S6 rent: a pay button, not just a log line', () => {
    const s = playing((st) => {
      st.riggedDice = [1, 2];
      st.ownables.P02.owner = 'u2';
    });
    const r = applyAction(s, { type: 'roll', player: 'u1' });
    receiveGame({ state: publicView(r.state), events: r.events, clock: null });
    store.set({ animUntil: 0 });
    render(<App />);
    fireEvent.click(screen.getByText(t.act.payRent('4 tỷ')));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'payRent' } } });
  });

  it('card draw: face-down card, the drawer clicks to flip', () => {
    const s = playing((st) => {
      st.riggedDice = [3, 4];
    });
    const r = applyAction(s, { type: 'roll', player: 'u1' });
    receiveGame({ state: publicView(r.state), events: r.events, clock: null });
    store.set({ animUntil: 0 });
    render(<App />);
    fireEvent.click(screen.getByRole('dialog', { name: t.cardDraw.title }).querySelector('button')!);
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'revealCard' } } });
  });

  it('S8 explains why a tile cannot be built yet', () => {
    playing((st) => {
      st.ownables.P01.owner = 'u1';
    });
    render(<App />);
    fireEvent.click(screen.getByText(t.board.assets));
    expect(screen.getByText(t.assets.why.needFullGroup)).toBeTruthy();
    expect(screen.getByText(t.assets.rulesTitle)).toBeTruthy();
  });

  it('when a bot plays for you, "Tôi chơi tiếp" takes the seat back', () => {
    playing();
    const room = store.get().room!;
    store.set({ room: { ...room, seats: room.seats.map((x) => (x.id === 'u1' ? { ...x, control: 'bot', botReason: 'afk' } : x)) } });
    render(<App />);
    fireEvent.click(screen.getByText(t.act.reclaim));
    expect(sent).toContainEqual({ type: 'reclaim', payload: undefined });
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

  it('S9 team game: the winning team and its players are named', () => {
    const s = createGame({ players: [0, 1, 0, 1].map((team, i) => ({ id: `u${i + 1}`, team })), seed: 3 }).state;
    const r = applyAction(s, { type: 'endGame' });
    receiveGame({ state: publicView(r.state), events: r.events, clock: null });
    store.set({ room: seats(4), gameOver: { winner: r.state.winner, winnerTeam: r.state.winnerTeam, ranking: r.state.ranking, seed: 3 } });
    render(<App />);
    const team = r.state.winnerTeam!;
    const names = r.state.players.filter((p) => p.team === team).map((p) => `Người ${p.id.slice(1)}`);
    expect(screen.getByText(t.teams.won(t.teams.names[team], names.join(', ')))).toBeTruthy();
  });

  it('Nhân vật button: reads every character at the table, with skill status and the duel numbers', () => {
    playing((st) => {
      st.players[1].skillUsed = true;
      st.players[1].skillCooldown = 2;
    });
    render(<App />);
    fireEvent.click(screen.getByText(t.characters.button));
    expect(screen.getByText(t.characters.title)).toBeTruthy();
    expect(screen.getAllByText(/Nô lệ tư bản|Cò đất/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(t.characters.cooldown(2))).toBeTruthy();
    expect(screen.getByText(t.characters.ready)).toBeTruthy();
    expect(screen.getAllByText('Chỉ số riêng cho bàn 2 người').length).toBeGreaterThan(0);
    expect(screen.getByText(t.characters.others)).toBeTruthy();
  });
});
