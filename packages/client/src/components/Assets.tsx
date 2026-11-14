import { whyCantBuild, type PublicState } from '@hanoi-monopoly/engine';
import { D } from '../lib/gameData';
import { groupName, money, t, tileName } from '../i18n/vi';
import { groupColor, groupedOwnables } from '../lib/board';
import { hotelLevel, isMyTurn, me, nameOf, ownedBySide, unmortgageCost } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { Coach } from './Coach';
import { Modal } from './Modal';

/**
 * What the bank still has to build with (when the room limits buildings). Houses and hotels
 * are separate stocks: a hotel puts its houses back, so a board of hotels can still have
 * every house out on tiles that stop at 1–4 houses — the list says whose.
 */
function BankStock({ state, room }: { state: PublicState; room: RoomView }) {
  if (!state.config.buildingLimit) return null;
  const H = hotelLevel(state);
  const limit = D.economy.buildingLimit;
  let houses = 0;
  let hotels = 0;
  const holders: Record<string, number> = {};
  for (const o of Object.values(state.ownables)) {
    if (o.level === H) hotels++;
    else if (o.level > 0 && o.owner) {
      houses += o.level;
      holders[o.owner] = (holders[o.owner] ?? 0) + o.level;
    }
  }
  const left = Math.max(0, limit.houses - houses);
  const who = Object.entries(holders)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => t.assets.holder(nameOf(room, id), n))
    .join(', ');
  return (
    <p className={`bank-stock${left === 0 ? ' bank-stock-out' : ''}`}>
      {t.assets.stock(left, limit.houses, Math.max(0, limit.hotels - hotels), limit.hotels)}
      {left === 0 && who && <span className="muted"> — {t.assets.housesOn(who)}</span>}
    </p>
  );
}

/** S8 — build, sell, mortgage, unmortgage by colour group. The server checks the rules. */
export function Assets({ state, room, onClose }: { state: PublicState; room: RoomView; onClose: () => void }) {
  const self = me(room, state);
  if (!self) return null;
  // Team games share one wallet and every tile: any member builds, sells and mortgages them.
  const shown = Object.keys(state.ownables).filter((id) => ownedBySide(state, id, self.id));
  const H = hotelLevel(state);
  const liquidating = state.pending?.type === 'liquidation' && state.pending.player === self.id;
  const canManage = isMyTurn(room, state) || liquidating;
  return (
    <Modal title={t.assets.title} onClose={onClose} wide>
      <Coach state={state} room={room} scope="assets" />
      <details className="build-rules">
        <summary>{t.assets.rulesTitle}</summary>
        <ul>
          {t.assets.rules(D.economy.housesForHotel[state.config.mode]).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
      <BankStock state={state} room={room} />
      {!canManage && <p className="muted">{t.assets.onlyYourTurn}</p>}
      {shown.length === 0 && <p className="muted">{t.assets.nothing}</p>}
      {groupedOwnables(shown).map(({ key, ids }) => (
        <div key={key} className="asset-group">
          <h4 style={{ borderColor: groupColor(key) ?? 'var(--ink)' }}>
            {key === 'transport' ? t.assets.transport : key === 'utility' ? t.assets.utility : groupName(key)}
            {D.groups[key] && (
              <span className="muted">
                {' '}
                · {D.groups[key].properties.filter((id) => ownedBySide(state, id, self.id)).length}/{D.groups[key].properties.length}
              </span>
            )}
          </h4>
          {ids.map((id) => {
            const own = state.ownables[id];
            const def = D.ownables[id];
            const mate = own.owner !== self.id;
            const block = def.kind === 'property' ? whyCantBuild(state, self.id, id) : null;
            return (
              <div key={id} className={`asset${mate ? ' asset-mate' : ''}${own.mortgaged ? ' mortgaged' : ''}`}>
                <span className="asset-name">
                  {tileName(id)}
                  {mate && <span className="muted asset-mate-owner"> · {t.assets.teammateTile(nameOf(room, own.owner))}</span>}
                </span>
                <span className="asset-level">
                  {own.mortgaged ? t.tile.mortgaged : own.level === H ? t.tile.hotel : own.level > 0 ? t.tile.house(own.level) : ''}
                </span>
                <span className="buttons">
                  {def.kind === 'property' && (
                    <>
                      <button
                        disabled={!!block}
                        title={block ? t.assets.why[block] : undefined}
                        onClick={() => act({ type: 'build', propertyId: id })}
                      >
                        {own.level + 1 === H ? t.assets.buildHotel : t.assets.build} ({money(def.buildCost!)})
                      </button>
                      <button disabled={!canManage || own.level === 0} onClick={() => act({ type: 'sellBuilding', propertyId: id })}>
                        {t.assets.sell}
                        {own.level > 0 && ` (+${money(Math.floor(def.buildCost! * D.economy.buildingSellRate))})`}
                      </button>
                    </>
                  )}
                  {own.mortgaged ? (
                    <button
                      disabled={!isMyTurn(room, state) || self.cash < unmortgageCost(state, self.id, id)}
                      onClick={() => act({ type: 'unmortgage', propertyId: id })}
                    >
                      {t.assets.unmortgage} ({money(unmortgageCost(state, self.id, id))})
                    </button>
                  ) : (
                    <button disabled={!canManage || own.level > 0} onClick={() => act({ type: 'mortgage', propertyId: id })}>
                      {t.assets.mortgage} (+{money(def.mortgage)})
                    </button>
                  )}
                </span>
                {block && block !== 'notYourTurn' && (block !== 'maxLevel' || own.level < H) && (
                  <span className="asset-why">{block === 'maxLevel' ? t.assets.noHotelCharacter : t.assets.why[block]}</span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
