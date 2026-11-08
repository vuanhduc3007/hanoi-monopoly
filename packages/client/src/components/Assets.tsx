import { defaultData as D, type PublicState } from '@hanoi-monopoly/engine';
import { groupName, money, t, tileName } from '../i18n/vi';
import { groupColor, groupedOwnables } from '../lib/board';
import { hotelLevel, isMyTurn, me, ownedBy, unmortgageCost } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { Modal } from './Modal';

/** S8 — build, sell, mortgage, unmortgage by colour group. The server checks the rules. */
export function Assets({ state, room, onClose }: { state: PublicState; room: RoomView; onClose: () => void }) {
  const self = me(room, state);
  if (!self) return null;
  const mine = ownedBy(state, self.id);
  const H = hotelLevel(state);
  const liquidating = state.pending?.type === 'liquidation' && state.pending.player === self.id;
  const canManage = isMyTurn(room, state) || liquidating;
  return (
    <Modal title={t.assets.title} onClose={onClose} wide>
      {!canManage && <p className="muted">{t.assets.onlyYourTurn}</p>}
      {mine.length === 0 && <p className="muted">{t.assets.nothing}</p>}
      {groupedOwnables(mine).map(({ key, ids }) => (
        <div key={key} className="asset-group">
          <h4 style={{ borderColor: groupColor(key) ?? 'var(--ink)' }}>
            {key === 'transport' ? t.assets.transport : key === 'utility' ? t.assets.utility : groupName(key)}
            {D.groups[key] && <span className="muted"> · {D.groups[key].properties.filter((id) => mine.includes(id)).length}/{D.groups[key].properties.length}</span>}
          </h4>
          {ids.map((id) => {
            const own = state.ownables[id];
            const def = D.ownables[id];
            return (
              <div key={id} className={`asset${own.mortgaged ? ' mortgaged' : ''}`}>
                <span className="asset-name">{tileName(id)}</span>
                <span className="asset-level">
                  {own.mortgaged ? t.tile.mortgaged : own.level === H ? t.tile.hotel : own.level > 0 ? t.tile.house(own.level) : ''}
                </span>
                <span className="buttons">
                  {def.kind === 'property' && (
                    <>
                      <button disabled={!isMyTurn(room, state) || own.mortgaged} onClick={() => act({ type: 'build', propertyId: id })}>
                        {t.assets.build} ({money(def.buildCost!)})
                      </button>
                      <button disabled={!canManage || own.level === 0} onClick={() => act({ type: 'sellBuilding', propertyId: id })}>
                        {t.assets.sell}
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
              </div>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
