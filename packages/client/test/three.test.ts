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
