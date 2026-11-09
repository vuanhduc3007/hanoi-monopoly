import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { defaultData as D, type GameEvent } from '@hanoi-monopoly/engine';
import { AVATAR_IDS, Avatar, CardBack, Hotel, House, TILE_ICONS, TileIcon } from '../src/art/icons';
import { TILE_ART } from '../src/art/tileArt';
import { Die } from '../src/components/Dice';
import { isMuted, setMuted, soundsFor } from '../src/sound/sound';

afterEach(cleanup);

describe('Đông Hồ art', () => {
  it('every board tile has an illustration that exists', () => {
    for (const tile of D.board) {
      const key = TILE_ART[tile.ref];
      expect(key, tile.ref).toBeTruthy();
      expect(TILE_ICONS[key], key).toBeTypeOf('function');
    }
    for (const key of Object.keys(TILE_ICONS)) {
      const { container } = render(<TileIcon kind={key} />);
      expect(container.querySelector('svg')).toBeTruthy();
      cleanup();
    }
  });

  it('every character has a portrait (token avatar)', () => {
    expect(AVATAR_IDS.sort()).toEqual(Object.keys(D.characters).sort());
    const { container } = render(<Avatar character="C07" label="SVBK" />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('SVBK');
  });

  it('renders houses, hotels, card backs and dice pips', () => {
    const { container } = render(
      <>
        <House />
        <Hotel />
        <CardBack deck="chance" />
        <CardBack deck="community" />
        <CardBack deck="event" />
        <Die value={5} />
      </>,
    );
    expect(container.querySelectorAll('svg')).toHaveLength(6);
    expect(container.querySelectorAll('.die circle')).toHaveLength(5);
  });
});

describe('sounds', () => {
  const ev = (type: string, extra: Record<string, unknown> = {}): GameEvent => ({ type, ...extra });

  it('maps events to the GDD §8.3 sounds', () => {
    expect(soundsFor([ev('diceRolled', { purpose: 'normal' })], null)).toEqual(['dice']);
    expect(soundsFor([ev('diceRolled', { purpose: 'EV19' })], null)).toEqual([]);
    expect(soundsFor([ev('jailed')], null)).toEqual([]); // whistle plays with the arrest banner
    expect(soundsFor([ev('salary')], null)).toEqual(['bell']);
    expect(soundsFor([ev('purchased'), ev('auctionEnded', { winner: 'a' })], null)).toEqual(['ting']);
    expect(soundsFor([ev('auctionEnded', { winner: null })], null)).toEqual([]);
    expect(soundsFor([ev('cardDrawn', { cardId: 'EV01' })], null)).toEqual(['drum']);
    expect(soundsFor([ev('cardDrawn', { cardId: 'CH01' })], null)).toEqual(['flip']);
    expect(soundsFor([ev('gameOver')], null)).toEqual(['fireworks']);
    expect(soundsFor([ev('turnStarted', { player: 'me' })], 'me')).toEqual(['turn']);
    expect(soundsFor([ev('turnStarted', { player: 'x' })], 'me')).toEqual([]);
  });

  it('remembers the mute choice', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem('hanoi-monopoly:muted')).toBe('1');
    setMuted(false);
    expect(isMuted()).toBe(false);
  });
});
