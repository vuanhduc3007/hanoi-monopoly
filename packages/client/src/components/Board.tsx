import type { CSSProperties } from 'react';
import { type PublicState } from '@hanoi-monopoly/engine';
import { D } from '../lib/gameData';
import { cardName, describeCard, describeEffect, groupName, money, t } from '../i18n/vi';
import { groupColor, HEX_H, hexPlace, sideLength, tileCell } from '../lib/board';
import { colorOf, currentPlayer, hotelLevel, nameOf } from '../lib/selectors';
import type { RoomView } from '../net/protocol';
import { useStore } from '../store';
import { CardBack, Hotel, House, TileIcon } from '../art/icons';
import { artFor } from '../art/tileArt';
import { Dice } from './Dice';
import { Token } from './Token';
import { useCallback, useState } from 'react';
import { Board3D } from '../three/Board3D';
import { Celebration } from './Celebration';
import { ArrestBanner, CardDraw, DiceResult, MoneyFloaters, SicboResult, useMoneyChanges } from './BoardFx';

interface Props {
  state: PublicState;
  room: RoomView;
  onTile: (pos: number) => void;
}

/** S4 — the tiles around the centre panel: a square (40 / 48 tiles) or a hexagon (60 tiles). */
export function Board({ state, room, onTile }: Props) {
  const current = currentPlayer(state).id;
  const [threeD, setThreeD] = useState(false);
  const onActive = useCallback((on: boolean) => setThreeD(on), []);
  useMoneyChanges(state);
  const hex = D.shape === 'hexagon';
  return (
    <div
      className={`board board-${D.id}${hex ? ' board-hex' : ''}${threeD ? ' board-3d-on' : ''}`}
      style={hex ? undefined : ({ '--side': sideLength() } as CSSProperties)}
      role="grid"
      aria-label={t.appTitle}
    >
      {D.board.map((tile) => {
        const { row, col, side } = hex ? { row: 0, col: 0, side: 'hex' } : tileCell(tile.position);
        const place = hex ? hexPlace(tile.position) : null;
        const own = state.ownables[tile.ref];
        const def = D.ownables[tile.ref];
        const tokens = state.players.filter((p) => !p.bankrupt && p.position === tile.position);
        const hotel = own && own.level === hotelLevel(state);
        return (
          <button
            key={tile.position}
            data-pos={tile.position}
            className={`tile tile-${place?.corner ? 'corner' : side} tile-${tile.type}${place?.flip ? ' tile-flip' : ''}`}
            style={
              place
                ? {
                    left: `${place.x * 100}%`,
                    top: `${(place.y / HEX_H) * 100}%`,
                    width: `${place.w * 100}%`,
                    height: `${(place.h / HEX_H) * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${place.angle}deg)`,
                  }
                : { gridRow: row + 1, gridColumn: col + 1 }
            }
            onClick={() => onTile(tile.position)}
            title={tile.name}
          >
            {def?.group && <span className="tile-band" style={{ background: groupColor(def.group) }} />}
            {artFor(tile.ref) && (
              <span className="tile-art">
                <TileIcon kind={artFor(tile.ref)!} />
              </span>
            )}
            <span className="tile-name">{tile.name}</span>
            {def && !own?.owner && <span className="tile-price">{money(def.price)}</span>}
            {own?.owner && (
              <span
                className={`tile-owner${own.mortgaged ? ' mortgaged' : ''}`}
                style={{ background: colorOf(room, own.owner) }}
                title={nameOf(room, own.owner)}
              />
            )}
            {own && own.level > 0 && (
              <span className="tile-buildings" aria-label={hotel ? t.tile.hotel : t.tile.house(own.level)}>
                {hotel ? (
                  <Hotel color={colorOf(room, own.owner!)} />
                ) : (
                  Array.from({ length: own.level }, (_, i) => <House key={i} color={colorOf(room, own.owner!)} />)
                )}
              </span>
            )}
            {tokens.length > 0 && (
              <span className="tile-tokens">
                {tokens.map((p) => (
                  <Token
                    key={p.id}
                    character={p.character}
                    name={nameOf(room, p.id)}
                    color={colorOf(room, p.id)}
                    size={p.id === room.you ? 24 : 18}
                    className={`${p.id === current ? 'token-current' : ''}${p.inJail ? ' token-jail' : ''}${p.id === room.you ? ' token-me' : ''}`}
                  />
                ))}
              </span>
            )}
          </button>
        );
      })}
      <Center state={state} room={room} />
      <Board3D state={state} room={room} onActive={onActive} />
      <Celebration state={state} room={room} />
      <CardDraw state={state} room={room} />
      <ArrestBanner room={room} />
      <DiceResult room={room} />
      <SicboResult room={room} />
      <MoneyFloaters state={state} room={room} />
    </div>
  );
}

function Center({ state, room }: { state: PublicState; room: RoomView }) {
  const lastCard = useStore((s) => s.lastCard);
  const current = currentPlayer(state);
  return (
    <div className="board-center">
      <div className="center-title">{t.appTitle}</div>
      <div className="center-row">
        <div className="fund">
          <div className="label">{t.board.fund}</div>
          <div className="fund-amount">{state.config.scholarshipFund ? money(state.fund) : t.board.fundOff}</div>
        </div>
        <Dice dice={state.turn.dice} />
      </div>
      <div className="center-turn">
        {t.board.turn(state.turn.number)} · {t.board.turnOf(nameOf(room, current.id))}
      </div>
      {lastCard && (
        <div key={lastCard.at} className={`card-flip deck-${D.cards[lastCard.cardId]?.deck}`}>
          <CardBack deck={D.cards[lastCard.cardId].deck} size={34} />
          <div className="card-name">{cardName(lastCard.cardId)}</div>
          <div className="card-text">{describeCard(lastCard.cardId)}</div>
          <div className="card-who">{nameOf(room, lastCard.player)}</div>
        </div>
      )}
      <div className="effects">
        <div className="label">{t.board.active}</div>
        {state.activeEffects.length === 0 && <div className="muted">{t.board.noEffects}</div>}
        {state.activeEffects.map((e) => (
          <div key={e.uid} className="effect">
            <strong>
              {e.source.kind === 'card' ? cardName(e.source.cardId) : D.characters[e.source.character]?.skill.name}
            </strong>{' '}
            — {effectText(e.effect)} <span className="muted">({t.board.until(nameOf(room, e.activator))})</span>
          </div>
        ))}
      </div>
      <div className="decks muted">
        {t.board.decks}: {t.board.deckNames.chance} {state.deckSizes.chance} · {t.board.deckNames.community}{' '}
        {state.deckSizes.community} · {t.board.deckNames.event} {state.deckSizes.event}
      </div>
    </div>
  );
}

function effectText(e: { type: string; [k: string]: unknown }): string {
  if (e.type === 'block_rent') return t.board.blockRent;
  if (e.type === 'rent_multiplier' && Array.isArray(e.groups) && !e.properties) {
    return t.board.groupRent((e.groups as string[]).map(groupName).join(', '), e.multiplier as number);
  }
  return describeEffect(e as never);
}
