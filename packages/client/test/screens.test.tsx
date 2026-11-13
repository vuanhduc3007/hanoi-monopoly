import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { applyAction, createGame, defaultData, publicView, type GameState } from '@hanoi-monopoly/engine';
import { App } from '../src/App';
import { money, t } from '../src/i18n/vi';
import { D } from '../src/lib/gameData';
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
  copyText: async () => true,
  inviteLink: (code: string) => `https://test.example/?room=${code}`,
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
    // The hotel rent row of the tile itself (from the board data).
    expect(screen.getAllByText(money(D.ownables.P22.rent!.hotel)).length).toBeGreaterThan(0);
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

  it('Thợ xây: a lone tile is offered for the "nhà chui"; once one stands, the reason names it', () => {
    const { state } = createGame({ players: [{ id: 'u1', character: 'C10' }, { id: 'u2', character: 'C05' }], seed: 3 });
    state.ownables.P01.owner = 'u1';
    state.ownables.P03.owner = 'u1';
    store.set({ room: seats(2), conn: 'connected' });
    receiveGame({ state: publicView(state), events: [], clock: null });
    render(<App />);
    const skill = new RegExp(`${t.act.skills}: Tự tay xây`);
    fireEvent.click(screen.getByText(skill));
    const offered = [...document.querySelectorAll('.skill .buttons button')].map((b) => b.textContent);
    expect(offered).toEqual(['Đông Anh', 'Hoàng Mai']);
    cleanup();
    state.ownables.P01.level = 1;
    receiveGame({ state: publicView(state), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(skill));
    expect(screen.getByText(t.act.noTargetsWhy(t.act.chuiUsed('Đông Anh')))).toBeTruthy();
  });

  it('Tín dụng đen: a short debtor sees Vay nóng; the player list shows what is owed', () => {
    const { state } = createGame({ players: [{ id: 'u1', character: null }, { id: 'u2', character: 'C16' }, { id: 'u3', character: null }], seed: 3 });
    state.ownables.P03 = { owner: 'u3', mortgaged: false, level: 2 };
    state.ownables.P04 = { owner: 'u3', mortgaged: false, level: 2 };
    state.ownables.P05 = { owner: 'u3', mortgaged: false, level: 2 };
    state.players[0].cash = 10;
    state.riggedDice = [2, 4];
    const r = applyAction(state, { type: 'roll', player: 'u1' });
    // Short of cash: straight to the raise-cash menu, no separate "Trả tiền" step.
    const r2 = r;
    expect(r2.state.pending?.type).toBe('liquidation');
    store.set({ room: seats(3), conn: 'connected' });
    receiveGame({ state: publicView(r2.state), events: [], clock: null });
    render(<App />);
    const rent = D.ownables.P03.rent!.h2;
    expect(screen.getByText(t.act.rentDue('Hoàng Mai', 'Người 3', money(rent)))).toBeTruthy();
    fireEvent.click(document.querySelector('.decision button[data-coach="assets"]')!);
    expect(screen.getByRole('dialog', { name: t.assets.title })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(t.tile.close));
    const owed = Math.ceil((rent - 10) * (1 + D.characters.C16.passives[0].rate) - 1e-9);
    fireEvent.click(screen.getByText(t.act.borrow('Người 2', money(rent - 10), money(owed))));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'borrow' } } });
    cleanup();
    const r3 = applyAction(r2.state, { type: 'borrow', player: 'u1' });
    receiveGame({ state: publicView(r3.state), events: [], clock: null });
    render(<App />);
    expect(screen.getAllByText(new RegExp(t.board.owes('Người 2', money(owed)))).length).toBeGreaterThan(0);
  });

  it('Bác sĩ lạ: Mở cổng picks the opponent to swap with; Thầy phong thủy picks from, then to', () => {
    const { state } = createGame({ players: [{ id: 'u1', character: 'C17' }, { id: 'u2', character: 'C05' }], seed: 3 });
    state.players[1].position = 11;
    store.set({ room: seats(2), conn: 'connected' });
    receiveGame({ state: publicView(state), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(`${t.act.skills}: ${t.act.portal('Mở cổng')}`));
    expect(screen.getByText(t.act.portalPick)).toBeTruthy();
    fireEvent.click(screen.getByText(new RegExp(`^Người 2 · `)));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'useSkill', target: 'u2' } } });
    cleanup();
    const g = createGame({ players: [{ id: 'u1', character: 'C15' }, { id: 'u2', character: 'C05' }], seed: 3 }).state;
    for (const id of ['P01', 'P02']) g.ownables[id] = { owner: 'u1', mortgaged: false, level: 2 };
    for (const id of ['P03', 'P04', 'P05']) g.ownables[id] = { owner: 'u1', mortgaged: false, level: 1 };
    receiveGame({ state: publicView(g), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(new RegExp(`${t.act.skills}: Dời nhà`)));
    const pickFirst = () => [...document.querySelectorAll('.skill .buttons button')];
    fireEvent.click(pickFirst().find((b) => b.textContent?.startsWith('Đông Anh'))!);
    expect(screen.getByText(t.act.moveTo('Đông Anh'))).toBeTruthy();
    fireEvent.click(pickFirst().find((b) => b.textContent?.startsWith('Hoàng Mai'))!);
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'useSkill', from: 'P01', propertyId: 'P03' } } });
  });

  it('Thánh săn sale: Flash sale picks an unowned tile on the board', () => {
    const { state } = createGame({ players: [{ id: 'u1', character: 'C13' }, { id: 'u2', character: 'C05' }], seed: 3 });
    state.ownables.P21.owner = 'u2';
    store.set({ room: seats(2), conn: 'connected' });
    receiveGame({ state: publicView(state), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(new RegExp(`${t.act.skills}: 🏷 Flash sale`)));
    expect(screen.getByText(t.act.flashPick)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Phố cổ Hà Nội')); // owned: just opens the tile
    expect(sent.some((m) => m.type === 'action')).toBe(false);
    fireEvent.click(screen.getByLabelText(t.tile.close));
    fireEvent.click(screen.getByTitle('Hồ Gươm'));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'useSkill', propertyId: 'P22' } } });
  });

  it('Thiếu gia Vin: Mua đứt lists only lone opponent tiles; SVBK: Săn học bổng is one click', () => {
    const { state } = createGame({ players: [{ id: 'u1', character: 'C01' }, { id: 'u2', character: 'C07' }], seed: 3 });
    state.ownables.P06.owner = 'u1';
    state.ownables.P07.owner = 'u2'; // lone tile of a group u1 started: offered
    state.ownables.P03.owner = 'u2';
    state.ownables.P04.owner = 'u2'; // u2 holds two of the group: not offered
    store.set({ room: seats(2), conn: 'connected' });
    receiveGame({ state: publicView(state), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(new RegExp(`${t.act.skills}: Mua đứt`)));
    const offered = [...document.querySelectorAll('.skill .buttons button')].map((b) => b.textContent ?? '');
    expect(offered.some((x) => x.startsWith('Mỹ Đình'))).toBe(true);
    expect(offered.some((x) => x.startsWith('Hoàng Mai') || x.startsWith('Hà Đông'))).toBe(false);
    cleanup();
    const g = createGame({ players: [{ id: 'u1', character: 'C07' }, { id: 'u2', character: 'C01' }], seed: 3 }).state;
    g.fund = 500;
    receiveGame({ state: publicView(g), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(new RegExp(`${t.act.skills}: Săn học bổng`)));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'useSkill' } } });
  });

  it('the character sheet says when a mode uses its own numbers', () => {
    const r = seats(2);
    store.set({
      room: { ...r, settings: { ...r.settings, mode: 'quick' }, phase: 'picking', picking: { order: ['u2', 'u1'], current: 'u1', available: ['C01'], clock: null } },
    });
    render(<App />);
    expect(screen.getAllByText(/Chỉ số riêng cho .*chế độ Nhanh/).length).toBeGreaterThan(0);
  });

  it('S8: the Sell button says what selling a house brings back', () => {
    playing((st) => {
      for (const id of ['P01', 'P02']) st.ownables[id] = { owner: 'u1', mortgaged: false, level: 1 };
    });
    render(<App />);
    fireEvent.click(screen.getByText(t.board.assets));
    const back = money(Math.floor(D.ownables.P01.buildCost! * D.economy.buildingSellRate));
    expect(screen.getAllByText(`${t.assets.sell} (+${back})`).length).toBeGreaterThan(0);
  });

  it('clicking a player in the list lights up the tile they stand on', () => {
    playing((st) => {
      st.players[1].position = 11;
    });
    render(<App />);
    const row = [...document.querySelectorAll('.players .player')].find((x) => x.textContent?.includes('Người 2'))!;
    fireEvent.click(row);
    const tile = document.querySelector('.tile[data-pos="11"]')!;
    expect(tile.classList.contains('tile-spotlight')).toBe(true);
    expect(tile.textContent).toContain(t.board.here('Người 2'));
  });

  it('team game: one wallet shown for the team; Tài sản manages a teammate’s tile too', () => {
    const s = createGame({ players: [0, 1, 0, 1].map((team, i) => ({ id: `u${i + 1}`, team })), seed: 3 }).state;
    s.ownables.P01.owner = 'u3';
    s.turn.current = s.players.findIndex((p) => p.id === 'u1');
    store.set({ room: seats(4), conn: 'connected' });
    receiveGame({ state: publicView(s), events: [], clock: null });
    render(<App />);
    expect(screen.getAllByText(t.teams.wallet(money(s.players[0].cash))).length).toBe(2);
    fireEvent.click(screen.getByText(t.board.assets));
    expect(screen.getByText(new RegExp(t.assets.teammateTile('Người 3')))).toBeTruthy();
    fireEvent.click(screen.getByText(`${t.assets.mortgage} (+${money(D.ownables.P01.mortgage)})`));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'mortgage', propertyId: 'P01' } } });
  });

  it('team game: Giao dịch lists the other teams only; an offer to a teammate shows for me too', () => {
    const s = createGame({ players: [0, 1, 0, 1, 2, 2].map((team, i) => ({ id: `u${i + 1}`, team })), seed: 3 }).state;
    s.ownables.P01.owner = 'u3';
    s.ownables.P06.owner = 'u4';
    s.turn.current = s.players.findIndex((p) => p.id === 'u1');
    s.trades = [
      { id: 'TR1', from: 'u5', to: 'u3', offer: { cash: 20, properties: [], jailCards: [] }, request: { cash: 0, properties: ['P01'], jailCards: [] }, unmortgage: [] },
    ];
    const room = seats(6);
    room.seats.forEach((x, i) => (x.team = [0, 1, 0, 1, 2, 2][i]));
    room.seats[1].control = 'bot';
    store.set({ room, conn: 'connected' });
    receiveGame({ state: publicView(s), events: [], clock: null });
    render(<App />);
    fireEvent.click(screen.getByText(t.board.trade));
    const options = [...screen.getByRole('combobox').querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toEqual([`${t.teams.names[1]} (Người 2, Người 4)`, `${t.teams.names[2]} (Người 5, Người 6)`]);
    // My teammate's tile is mine to offer; theirs (any member's) to ask for.
    expect(screen.getByText(new RegExp('· Người 3'))).toBeTruthy();
    expect(screen.getByText(new RegExp('· Người 4'))).toBeTruthy();
    fireEvent.click(screen.getByText(t.trade.send));
    // Sent to the team's human member, not the bot.
    expect(sent).toContainEqual(expect.objectContaining({ payload: { action: expect.objectContaining({ type: 'proposeTrade', to: 'u4' }) } }));
    fireEvent.click(screen.getByText(t.trade.accept));
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'respondTrade', tradeId: 'TR1', accept: true, unmortgage: [] } } });
  });

  it('Đầu hàng asks first, then sends surrender; blocked while a decision of mine waits', () => {
    playing();
    render(<App />);
    fireEvent.click(screen.getByLabelText(t.surrender.button));
    expect(screen.getByRole('dialog', { name: t.surrender.title })).toBeTruthy();
    fireEvent.click(screen.getByText(t.surrender.cancel));
    expect(sent.some((m) => (m.payload as { action?: { type: string } })?.action?.type === 'surrender')).toBe(false);
    fireEvent.click(screen.getByLabelText(t.surrender.button));
    fireEvent.click(document.querySelector('.modal button.danger')!);
    expect(sent).toContainEqual({ type: 'action', payload: { action: { type: 'surrender' } } });
    cleanup();
    playing((st) => {
      st.pending = { type: 'buy', player: 'u1', propertyId: 'P01', price: 60 };
    });
    render(<App />);
    expect((screen.getByLabelText(t.surrender.button) as HTMLButtonElement).disabled).toBe(true);
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
