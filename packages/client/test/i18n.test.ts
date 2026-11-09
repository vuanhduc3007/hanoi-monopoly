import { describe, expect, it } from 'vitest';
import { applyActionInPlace, botAction, createGame, defaultData as D, type GameEvent } from '@hanoi-monopoly/engine';
import { describeCard, describeCharacter, describeEffect, ENGINE_EVENT_TYPES_HANDLED, formatEvent, money } from '../src/i18n/vi';
import { tileCell } from '../src/lib/board';

const who = { name: (id: string) => `[${id}]`, character: () => 'C02' };

describe('vi.ts', () => {
  it('formats money with the currency from economy.json', () => {
    expect(money(1500)).toBe('1.500 tỷ');
  });

  it('describes every card from its effect data (no raw effect types)', () => {
    for (const id of Object.keys(D.cards)) {
      const text = describeCard(id);
      expect(text).not.toMatch(/undefined|NaN|_/);
      expect(text).not.toBe(D.cards[id].effect.type);
    }
    expect(describeCard('CH01')).toContain('Hồ Gươm');
    expect(describeCard('EV02')).toContain('+50%');
    expect(describeCard('EV02')).toContain('⏳');
    expect(describeEffect(D.cards.EV10.effect)).toContain('Thiếu gia Vin 20%');
  });

  it('describes every character trait with the numbers from characters.json', () => {
    for (const id of Object.keys(D.characters)) {
      const c = describeCharacter(id);
      for (const line of [...c.passives, ...c.drawbacks, c.skill]) expect(line).not.toMatch(/undefined|NaN|_/);
    }
    expect(describeCharacter('C07').drawbacks).toContain('Bắt đầu 1.400 tỷ');
    expect(describeCharacter('C03').passives[0]).toContain(`tối đa ${D.characters.C03.passives[0].maxUses} lần/ván`);
    expect(describeCharacter('C03').skill).toContain(`dùng lại sau ${D.characters.C03.skill.cooldownRounds} lượt`);
    expect(describeCharacter('C07').skill).toContain('tự kích hoạt');
    expect(describeCharacter('C01').drawbacks[1]).toBe('Thuế thu nhập cá nhân trả 300 tỷ');
  });

  it('formats every event a real game produces, without crashing or leaking placeholders', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 6; seed++) {
      const players = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06'].slice(0, 2 + (seed % 5)).map((c, i) => ({ id: `p${i}`, character: c }));
      const created = createGame({ players, seed });
      const s = created.state;
      const all: GameEvent[] = [...created.events];
      for (let k = 0; k < 4000 && s.status === 'playing'; k++) all.push(...applyActionInPlace(s, botAction(s)!).events);
      for (const e of all) {
        seen.add(e.type);
        const line = formatEvent(e, who);
        if (line) expect(line, e.type).not.toMatch(/undefined|NaN|\[object/);
      }
    }
    for (const type of seen) expect(ENGINE_EVENT_TYPES_HANDLED).toContain(type);
  });
});

describe('board layout', () => {
  it('places 40 tiles on distinct border cells: GO bottom-right, then left, up, right, down', () => {
    const cells = new Set<string>();
    for (let p = 0; p < 40; p++) {
      const { row, col } = tileCell(p);
      expect(row === 0 || row === 10 || col === 0 || col === 10).toBe(true);
      cells.add(`${row},${col}`);
    }
    expect(cells.size).toBe(40);
    expect(tileCell(0)).toMatchObject({ row: 10, col: 10 });
    expect(tileCell(1)).toMatchObject({ row: 10, col: 9, side: 'bottom' });
    expect(tileCell(10)).toMatchObject({ row: 10, col: 0 });
    expect(tileCell(11)).toMatchObject({ row: 9, col: 0, side: 'left' });
    expect(tileCell(20)).toMatchObject({ row: 0, col: 0 });
    expect(tileCell(21)).toMatchObject({ row: 0, col: 1, side: 'top' });
    expect(tileCell(30)).toMatchObject({ row: 0, col: 10 });
    expect(tileCell(39)).toMatchObject({ row: 9, col: 10, side: 'right' });
  });
});

describe('trade summary', () => {
  it('lists each side once', async () => {
    const { bundleText } = await import('../src/components/Trade');
    expect(bundleText({ cash: 120, properties: [], jailCards: [] })).toBe('120 tỷ');
    expect(bundleText({ cash: 0, properties: ['P03'], jailCards: ['CH11'] })).toBe('Hoàng Mai, Giấy tờ xe (CH11)');
    expect(bundleText({ cash: 0, properties: [], jailCards: [] })).toBe('Không có');
  });
});

describe('server address', () => {
  it('uses the page origin in production and port 2567 in development', async () => {
    const { serverUrl } = await import('../src/net/connection');
    const https = { protocol: 'https:', host: 'hanoi.onrender.com', hostname: 'hanoi.onrender.com' } as Location;
    const dev = { protocol: 'http:', host: 'localhost:5173', hostname: 'localhost' } as Location;
    expect(serverUrl({ PROD: true }, https)).toBe('wss://hanoi.onrender.com');
    expect(serverUrl({ PROD: false }, dev)).toBe('ws://localhost:2567');
    expect(serverUrl({ VITE_SERVER_URL: 'wss://x.example' }, dev)).toBe('wss://x.example');
  });
});

describe('48-tile board layout', () => {
  it('places 48 tiles on a 13×13 ring with corners at 0 / 12 / 24 / 36', async () => {
    const { extendedData: X } = await import('@hanoi-monopoly/engine');
    const cells = new Set<string>();
    for (let p = 0; p < 48; p++) {
      const { row, col } = tileCell(p, 48);
      expect(row === 0 || row === 12 || col === 0 || col === 12).toBe(true);
      cells.add(`${row},${col}`);
    }
    expect(cells.size).toBe(48);
    expect([0, 12, 24, 36].map((p) => tileCell(p, 48).side)).toEqual(['corner', 'corner', 'corner', 'corner']);
    expect(tileCell(12, 48)).toMatchObject({ row: 12, col: 0 });
    expect(tileCell(47, 48)).toMatchObject({ row: 11, col: 12, side: 'right' });
    const { artFor } = await import('../src/art/tileArt');
    for (const t of X.board) expect(artFor(t.ref), t.ref).toBeTruthy();
  });

  it('client data follows the game board; walks wrap at 48', async () => {
    const { setBoard, D } = await import('../src/lib/gameData');
    const { walkPath } = await import('../src/three/path');
    setBoard('extended');
    expect(D.board).toHaveLength(48);
    expect(walkPath(46, 1).tiles).toEqual([47, 0, 1]);
    setBoard('standard');
    expect(D.board).toHaveLength(40);
  });
});

describe('56-tile board and new characters', () => {
  it('places 56 tiles on a 15×15 ring with corners at 0 / 14 / 28 / 42, every tile illustrated', async () => {
    const { largeData: L } = await import('@hanoi-monopoly/engine');
    const { artFor } = await import('../src/art/tileArt');
    const cells = new Set<string>();
    for (let p = 0; p < 56; p++) {
      const { row, col } = tileCell(p, 56);
      expect(row === 0 || row === 14 || col === 0 || col === 14).toBe(true);
      cells.add(`${row},${col}`);
    }
    expect(cells.size).toBe(56);
    expect([0, 14, 28, 42].map((p) => tileCell(p, 56).side)).toEqual(['corner', 'corner', 'corner', 'corner']);
    for (const t of L.board) expect(artFor(t.ref), t.ref).toBeTruthy();
  });

  it('describes the new characters and splits CH16 / CD10 by table size', async () => {
    const { describeCharacter, describeCard } = await import('../src/i18n/vi');
    for (const id of ['C09', 'C10', 'C11', 'C12']) {
      const c = describeCharacter(id);
      for (const line of [...c.passives, ...c.drawbacks, c.skill]) expect(line).not.toMatch(/^[a-z_]+$/);
    }
    expect(describeCharacter('C09').skill).toContain('tài xỉu');
    expect(describeCharacter('C03', 2).tableNote).toBeTruthy();
    expect(describeCharacter('C03', 5).tableNote).toBeNull();
    expect(describeCard('CH16')).toContain('chia đều');
  });
});
