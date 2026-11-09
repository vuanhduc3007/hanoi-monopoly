import { describe, expect, it } from 'vitest';
import { defaultData as D } from '@hanoi-monopoly/engine';
import { momentsFrom } from '../src/components/Celebration';
import { CHARACTER_MODEL_IDS, makeCharacter, makeDeed, makeHotel, makeHouse, makeYouMarker } from '../src/three/models';
import { easeOutBack, slotOffset, stepMs, walkPath } from '../src/three/path';

describe('token paths', () => {
  it('walks forward through every tile, wrapping past GO', () => {
    expect(walkPath(37, 2)).toEqual({ tiles: [38, 39, 0, 1, 2], direct: false });
    expect(walkPath(5, 5)).toEqual({ tiles: [], direct: false });
  });

  it('walks back for CH09 (3 steps) and hops directly for jail / long card jumps', () => {
    expect(walkPath(7, 4)).toEqual({ tiles: [6, 5, 4], direct: false });
    expect(walkPath(30, 10, true)).toEqual({ tiles: [10], direct: true });
    expect(walkPath(7, 39)).toEqual({ tiles: [39], direct: true });
  });

  it('spreads tokens sharing a tile and keeps long walks short', () => {
    expect(slotOffset(0, 1)).toEqual({ dx: 0, dy: 0 });
    const a = slotOffset(0, 3);
    const b = slotOffset(1, 3);
    expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThan(0.2);
    expect(stepMs(12) * 12).toBeLessThanOrEqual(1700);
    expect(stepMs(2)).toBe(230);
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
  });
});

describe('3D models', () => {
  it('every character has a model with its accessory', () => {
    expect([...CHARACTER_MODEL_IDS].sort()).toEqual(Object.keys(D.characters).sort());
    const plain = makeCharacter(null, '#B8312F').children.length;
    for (const id of CHARACTER_MODEL_IDS) {
      const g = makeCharacter(id, '#2E4A7D');
      expect(g.name).toBe(`character:${id}`);
      expect(g.children.length).toBeGreaterThan(plain);
    }
  });

  it('builds houses, hotels, the purchase plot and the "you" marker', () => {
    for (const m of [makeHouse(), makeHotel(), makeDeed('#5F7F3A'), makeYouMarker('#B8312F')]) {
      expect(m.children.length).toBeGreaterThan(0);
    }
    expect(makeDeed('#5F7F3A').getObjectByName('house')).toBeTruthy();
  });
});

describe('purchase / build pop-ups', () => {
  it('fires for purchases, auction wins and buildings only', () => {
    const m = momentsFrom([
      { type: 'purchased', player: 'a', propertyId: 'P01', price: 60 },
      { type: 'auctionEnded', winner: null, propertyId: 'P02' },
      { type: 'auctionEnded', winner: 'b', propertyId: 'P03', price: 40 },
      { type: 'built', player: 'a', propertyId: 'P01', hotel: false },
      { type: 'built', player: 'a', propertyId: 'P02', hotel: true },
      { type: 'payment', from: 'a' },
    ]);
    expect(m.map((x) => [x.kind, x.player, x.propertyId])).toEqual([
      ['buy', 'a', 'P01'],
      ['buy', 'b', 'P03'],
      ['house', 'a', 'P01'],
      ['hotel', 'a', 'P02'],
    ]);
    expect(new Set(m.map((x) => x.key)).size).toBe(4);
  });
});

describe('choreography from server events', () => {
  it('dice first, then walk tile by tile', async () => {
    const { planFromEvents } = await import('../src/three/path');
    const plan = planFromEvents(
      [
        { type: 'diceRolled', player: 'a', dice: [2, 3], purpose: 'normal' },
        { type: 'moved', player: 'a', from: 0, to: 5, steps: 5 },
      ],
      { a: 0 },
      10,
    );
    expect(plan.dice).toEqual([2, 3]);
    expect(plan.steps.a.map((s) => s.tile)).toEqual([1, 2, 3, 4, 5]);
    expect(plan.steps.a.every((s) => s.mode === 'walk')).toBe(true);
  });

  it('CSGT: walk onto tile 30, arrest pause, then hop to the parking lot', async () => {
    const { planFromEvents } = await import('../src/three/path');
    const plan = planFromEvents(
      [
        { type: 'diceRolled', player: 'a', dice: [1, 2], purpose: 'normal' },
        { type: 'moved', player: 'a', from: 27, to: 30, steps: 3 },
        { type: 'landed', player: 'a', position: 30 },
        { type: 'jailed', player: 'a' },
      ],
      { a: 27 },
      10,
    );
    expect(plan.steps.a).toEqual([
      { tile: 28, mode: 'walk' },
      { tile: 29, mode: 'walk' },
      { tile: 30, mode: 'walk' },
      { tile: 30, mode: 'pause', arrest: true },
      { tile: 10, mode: 'hop' },
    ]);
  });

  it('card move: walk to the card tile, then on to the destination; CH09 walks back', async () => {
    const { planFromEvents } = await import('../src/three/path');
    const plan = planFromEvents(
      [
        { type: 'moved', player: 'a', from: 4, to: 7, steps: 3 },
        { type: 'moved', player: 'a', from: 7, to: 4, steps: -3 },
      ],
      { a: 4 },
      10,
    );
    expect(plan.steps.a.map((s) => s.tile)).toEqual([5, 6, 7, 6, 5, 4]);
  });
});

describe('money reasons', () => {
  it('names the biggest reason a player paid or received', async () => {
    const { moneyReason } = await import('../src/components/BoardFx');
    const events = [
      { type: 'payment', from: 'a', to: { kind: 'player', id: 'b' }, amount: 50, kind: 'rent', reason: 'P22' },
      { type: 'salary', player: 'c', amount: 200 },
      { type: 'payment', from: 'c', to: { kind: 'fund' }, amount: 200, kind: 'tax', reason: 'TAX1' },
    ];
    expect(moneyReason(events, 'a')).toBe('Thuê Hồ Gươm');
    expect(moneyReason(events, 'b')).toBe('Thuê Hồ Gươm');
    expect(['Lương', 'Thuế thu nhập cá nhân']).toContain(moneyReason(events, 'c'));
    expect(moneyReason(events, 'z')).toBe('');
  });
});

describe('dice faces', () => {
  it('the rolled value faces up for every value and any yaw on the holder', async () => {
    const THREE = await import('three');
    const { DIE_FACES, dieRotationFor } = await import('../src/three/models');
    const normals = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];
    for (const yaw of [0, 0.22, -0.22, 1.3]) {
      for (let value = 1; value <= 6; value++) {
        const holder = new THREE.Group();
        const cube = new THREE.Group();
        holder.add(cube);
        const [rx, , rz] = dieRotationFor(value);
        cube.rotation.set(rx, 0, rz);
        holder.rotation.set(0, yaw, 0);
        holder.updateMatrixWorld(true);
        const q = new THREE.Quaternion();
        cube.getWorldQuaternion(q);
        const up = normals.map((n) => n.clone().applyQuaternion(q).y);
        const top = up.indexOf(Math.max(...up));
        expect(DIE_FACES[top], `value ${value} yaw ${yaw}`).toBe(value);
        expect(Math.max(...up)).toBeCloseTo(1, 5);
      }
    }
  });
});
