import { useState } from 'react';
import { type PublicState, type Trade as TradeT, type TradeBundle } from '@hanoi-monopoly/engine';
import { money, t, tileName } from '../i18n/vi';
import { groupColor, groupedOwnables } from '../lib/board';
import { me, nameOf, ownedBy, unmortgageCost } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { Modal } from './Modal';

/** S7 — two columns (land + cash + CH11), send / accept / reject / cancel. */
export function Trade({ state, room, onClose }: { state: PublicState; room: RoomView; onClose: () => void }) {
  const self = me(room, state);
  const others = state.players.filter((p) => p.id !== self?.id && !p.bankrupt);
  const [partner, setPartner] = useState(others[0]?.id ?? '');
  const [give, setGive] = useState<TradeBundle>({ cash: 0, properties: [], jailCards: [] });
  const [get, setGet] = useState<TradeBundle>({ cash: 0, properties: [], jailCards: [] });
  const [unmortgage, setUnmortgage] = useState<string[]>([]);
  if (!self) return null;
  const other = state.players.find((p) => p.id === partner);
  const incoming = state.trades.filter((x) => x.to === self.id);
  const outgoing = state.trades.filter((x) => x.from === self.id);

  const send = () => {
    act({ type: 'proposeTrade', to: partner, offer: give, request: get, unmortgage: unmortgage.filter((id) => get.properties.includes(id)) });
    setGive({ cash: 0, properties: [], jailCards: [] });
    setGet({ cash: 0, properties: [], jailCards: [] });
    setUnmortgage([]);
  };

  return (
    <Modal title={t.trade.title} onClose={onClose} wide>
      {incoming.map((x) => (
        <Incoming key={x.id} trade={x} state={state} room={room} />
      ))}
      {outgoing.map((x) => (
        <div key={x.id} className="trade-offer">
          <strong>{t.trade.outgoing}</strong> → {nameOf(room, x.to)}: <Summary trade={x} />
          <button onClick={() => act({ type: 'cancelTrade', tradeId: x.id })}>{t.trade.cancel}</button>
        </div>
      ))}
      {others.length > 0 && (
        <>
          <label className="row">
            {t.trade.with}{' '}
            <select value={partner} onChange={(e) => (setPartner(e.target.value), setGet({ cash: 0, properties: [], jailCards: [] }))}>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameOf(room, p.id)}
                </option>
              ))}
            </select>
          </label>
          <div className="trade-cols">
            <Column
              title={t.trade.youGive}
              owner={self.id}
              state={state}
              bundle={give}
              setBundle={setGive}
              maxCash={self.cash}
              jailCards={self.jailCards}
            />
            {other && (
              <Column
                title={t.trade.youGet}
                owner={other.id}
                state={state}
                bundle={get}
                setBundle={setGet}
                maxCash={other.cash}
                jailCards={other.jailCards}
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

function Column(props: {
  title: string;
  owner: string;
  state: PublicState;
  bundle: TradeBundle;
  setBundle: (b: TradeBundle) => void;
  maxCash: number;
  jailCards: string[];
  unmortgage?: string[];
  setUnmortgage?: (ids: string[]) => void;
}) {
  const { state, bundle, setBundle } = props;
  const ids = ownedBy(state, props.owner);
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
      {props.jailCards.map((c) => (
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
        <strong>{t.trade.from(nameOf(room, trade.from))}</strong>: {t.trade.youGet} {bundleText(trade.offer)} ·{' '}
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

