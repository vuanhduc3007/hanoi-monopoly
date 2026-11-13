import { useState } from 'react';
import { type PlayerState, type PublicState, type Trade as TradeT, type TradeBundle } from '@hanoi-monopoly/engine';
import { money, t, teamName, tileName } from '../i18n/vi';
import { groupColor, groupedOwnables } from '../lib/board';
import { me, nameOf, offersFor, sideMembers, sideTiles, teammates, unmortgageCost } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { Coach } from './Coach';
import { Modal } from './Modal';

interface Partner {
  /** Player id, or `t<team>` in team games. */
  key: string;
  /** Who the offer is addressed to (any member of his team may answer it). */
  to: string;
  label: string;
}

/**
 * Who you can trade with: every opponent, or in team games every other team. A team's
 * offer goes to one member (a connected human when there is one) and the whole team sees it.
 */
function partnersOf(state: PublicState, room: RoomView, self: PlayerState): Partner[] {
  const others = state.players.filter((p) => p.id !== self.id && !p.bankrupt && !teammates(state, self.id, p.id));
  if (self.team === undefined || self.team === null) return others.map((p) => ({ key: p.id, to: p.id, label: nameOf(room, p.id) }));
  const teams = [...new Set(others.map((p) => p.team!))];
  return teams.map((team) => {
    const members = others.filter((p) => p.team === team);
    const seat = (id: string) => room.seats.find((x) => x.id === id);
    const to = members.find((m) => seat(m.id)?.control === 'human' && seat(m.id)?.connected) ?? members[0];
    return { key: `t${team}`, to: to.id, label: `${teamName(team)} (${members.map((m) => nameOf(room, m.id)).join(', ')})` };
  });
}

/** "Đội Phượng (crazy)" in team games, the player's name otherwise. */
function sideLabel(state: PublicState, room: RoomView, id: string): string {
  const team = state.players.find((p) => p.id === id)?.team;
  return team !== undefined && team !== null ? `${teamName(team)} (${nameOf(room, id)})` : nameOf(room, id);
}

/** S7 — two columns (land + cash + CH11), send / accept / reject / cancel. */
export function Trade({ state, room, onClose }: { state: PublicState; room: RoomView; onClose: () => void }) {
  const self = me(room, state);
  const partners = self ? partnersOf(state, room, self) : [];
  const [partnerKey, setPartnerKey] = useState(partners[0]?.key ?? '');
  const [give, setGive] = useState<TradeBundle>({ cash: 0, properties: [], jailCards: [] });
  const [get, setGet] = useState<TradeBundle>({ cash: 0, properties: [], jailCards: [] });
  const [unmortgage, setUnmortgage] = useState<string[]>([]);
  if (!self) return null;
  const partner = partners.find((x) => x.key === partnerKey) ?? partners[0];
  const other = partner && state.players.find((p) => p.id === partner.to);
  const team = self.team !== undefined && self.team !== null;
  const incoming = offersFor(state, self.id);
  const outgoing = state.trades.filter((x) => x.from === self.id || teammates(state, x.from, self.id));

  const send = () => {
    if (!partner) return;
    act({ type: 'proposeTrade', to: partner.to, offer: give, request: get, unmortgage: unmortgage.filter((id) => get.properties.includes(id)) });
    setGive({ cash: 0, properties: [], jailCards: [] });
    setGet({ cash: 0, properties: [], jailCards: [] });
    setUnmortgage([]);
  };

  return (
    <Modal title={t.trade.title} onClose={onClose} wide>
      <Coach state={state} room={room} scope="trade" />
      {team && <p className="muted">{t.trade.teamHint}</p>}
      {incoming.map((x) => (
        <Incoming key={x.id} trade={x} state={state} room={room} />
      ))}
      {outgoing.map((x) => (
        <div key={x.id} className="trade-offer">
          <strong>{t.trade.outgoing}</strong> → {sideLabel(state, room, x.to)}: <Summary trade={x} />
          <button onClick={() => act({ type: 'cancelTrade', tradeId: x.id })}>{t.trade.cancel}</button>
        </div>
      ))}
      {partners.length > 0 && (
        <>
          <label className="row">
            {team ? t.trade.withTeam : t.trade.with}{' '}
            <select
              value={partner?.key ?? ''}
              onChange={(e) => (setPartnerKey(e.target.value), setGet({ cash: 0, properties: [], jailCards: [] }), setUnmortgage([]))}
            >
              {partners.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <div className="trade-cols">
            <Column
              title={team ? t.trade.teamGives : t.trade.youGive}
              owner={self.id}
              state={state}
              room={room}
              bundle={give}
              setBundle={setGive}
              maxCash={self.cash}
            />
            {other && (
              <Column
                title={team ? t.trade.teamGets : t.trade.youGet}
                owner={other.id}
                state={state}
                room={room}
                bundle={get}
                setBundle={setGet}
                maxCash={other.cash}
                unmortgage={unmortgage}
                setUnmortgage={setUnmortgage}
              />
            )}
          </div>
          <p className="muted">{t.trade.expires}</p>
          <button className="primary" disabled={!partner} onClick={send}>
            {t.trade.send}
          </button>
        </>
      )}
    </Modal>
  );
}

/** One side's tiles, jail cards and cash (in team games: the whole team's). */
function Column(props: {
  title: string;
  owner: string;
  state: PublicState;
  room: RoomView;
  bundle: TradeBundle;
  setBundle: (b: TradeBundle) => void;
  maxCash: number;
  unmortgage?: string[];
  setUnmortgage?: (ids: string[]) => void;
}) {
  const { state, bundle, setBundle } = props;
  const ids = sideTiles(state, props.owner);
  const members = sideMembers(state, props.owner);
  const jailCards = members.flatMap((m) => m.jailCards);
  // Team games: whose tile it is.
  const tag = (id: string) => (members.length > 1 ? nameOf(props.room, state.ownables[id].owner) : null);
  const toggle = (id: string) =>
    setBundle({
      ...bundle,
      properties: bundle.properties.includes(id) ? bundle.properties.filter((x) => x !== id) : [...bundle.properties, id],
    });
  return (
    <div className="trade-col">
      <h4>{props.title}</h4>
      {ids.length === 0 && <p className="muted">{t.trade.none}</p>}
      {groupedOwnables(ids).map(({ key, ids: group }) =>
        group.map((id) => {
          const own = state.ownables[id];
          return (
            <label key={id} className="trade-item" style={{ borderLeftColor: groupColor(key) ?? 'var(--ink)' }}>
              <input type="checkbox" checked={bundle.properties.includes(id)} onChange={() => toggle(id)} />
              {tileName(id)}
              {tag(id) && <span className="muted"> · {tag(id)}</span>}
              {own.mortgaged && <span className="muted"> ({t.tile.mortgaged})</span>}
              {own.mortgaged && props.unmortgage && bundle.properties.includes(id) && (
                <span className="muted">
                  {' '}
                  <input
                    type="checkbox"
                    checked={props.unmortgage.includes(id)}
                    onChange={() =>
                      props.setUnmortgage!(
                        props.unmortgage!.includes(id) ? props.unmortgage!.filter((x) => x !== id) : [...props.unmortgage!, id],
                      )
                    }
                  />
                  {t.trade.unmortgageNow}
                </span>
              )}
            </label>
          );
        }),
      )}
      {jailCards.map((c) => (
        <label key={c} className="trade-item">
          <input
            type="checkbox"
            checked={bundle.jailCards.includes(c)}
            onChange={() =>
              setBundle({
                ...bundle,
                jailCards: bundle.jailCards.includes(c) ? bundle.jailCards.filter((x) => x !== c) : [...bundle.jailCards, c],
              })
            }
          />
          {t.trade.jailCard}
        </label>
      ))}
      <label className="row">
        {t.trade.cash}{' '}
        <input
          type="number"
          min={0}
          max={props.maxCash}
          step={10}
          value={bundle.cash}
          onChange={(e) => setBundle({ ...bundle, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
        />
      </label>
    </div>
  );
}

export function bundleText(b: TradeBundle): string {
  return (
    [...b.properties.map(tileName), ...(b.cash ? [money(b.cash)] : []), ...b.jailCards.map(() => t.trade.jailCard)].join(', ') ||
    t.trade.none
  );
}

function Summary({ trade }: { trade: TradeT }) {
  return (
    <span>
      {bundleText(trade.offer)} ⇄ {bundleText(trade.request)}
    </span>
  );
}

function Incoming({ trade, state, room }: { trade: TradeT; state: PublicState; room: RoomView }) {
  const self = me(room, state)!;
  const mortgaged = trade.offer.properties.filter((id) => state.ownables[id].mortgaged);
  const [unmortgage, setUnmortgage] = useState<string[]>([]);
  return (
    <div className="trade-offer incoming">
      <div>
        <strong>{t.trade.from(sideLabel(state, room, trade.from))}</strong>: {t.trade.youGet} {bundleText(trade.offer)} ·{' '}
        {t.trade.youGive} {bundleText(trade.request)}
      </div>
      {mortgaged.map((id) => (
        <label key={id} className="row">
          <input
            type="checkbox"
            checked={unmortgage.includes(id)}
            onChange={() => setUnmortgage(unmortgage.includes(id) ? unmortgage.filter((x) => x !== id) : [...unmortgage, id])}
          />
          {t.trade.unmortgageNow} {tileName(id)} ({money(unmortgageCost(state, self.id, id))})
        </label>
      ))}
      <div className="buttons">
        <button className="primary" onClick={() => act({ type: 'respondTrade', tradeId: trade.id, accept: true, unmortgage })}>
          {t.trade.accept}
        </button>
        <button onClick={() => act({ type: 'respondTrade', tradeId: trade.id, accept: false })}>{t.trade.reject}</button>
      </div>
    </div>
  );
}

