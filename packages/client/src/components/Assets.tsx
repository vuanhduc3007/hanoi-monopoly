import { whyCantBuild, type PublicState } from '@hanoi-monopoly/engine';
import { D } from '../lib/gameData';
import { groupName, money, t, tileName } from '../i18n/vi';
import { groupColor, groupedOwnables } from '../lib/board';
import { hotelLevel, isMyTurn, me, nameOf, ownedBy, ownedBySide, unmortgageCost } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { Coach } from './Coach';
import { Modal } from './Modal';

/** S8 — build, sell, mortgage, unmortgage by colour group. The server checks the rules. */
export function Assets({ state, room, onClose }: { state: PublicState; room: RoomView; onClose: () => void }) {
  const self = me(room, state);
  if (!self) return null;
  const mine = ownedBy(state, self.id);
  // Team games: a colour group is shared, so show the teammates' tiles of my groups too (read-only).
  const myGroups = new Set(mine.map((id) => D.ownables[id].group).filter(Boolean));
  const shown = [
    ...mine,
    ...Object.keys(state.ownables).filter(
      (id) => !mine.includes(id) && myGroups.has(D.ownables[id].group) && ownedBySide(state, id, self.id),
    ),
  ];
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
      {!canManage && <p className="muted">{t.assets.onlyYourTurn}</p>}
      {mine.length === 0 && <p className="muted">{t.assets.nothing}</p>}
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
            if (own.owner !== self.id) {
              return (
                <div key={id} className={`asset asset-mate${own.mortgaged ? ' mortgaged' : ''}`}>
                  <span className="asset-name">{tileName(id)}</span>
                  <span className="asset-level">
                    {own.mortgaged ? t.tile.mortgaged : own.level === H ? t.tile.hotel : own.level > 0 ? t.tile.house(own.level) : ''}
                  </span>
                  <span className="muted">{t.assets.teammateTile(nameOf(room, own.owner))}</span>
                </div>
              );
            }
            const block = def.kind === 'property' ? whyCantBuild(state, self.id, id) : null;
            return (
              <div key={id} className={`asset${own.mortgaged ? ' mortgaged' : ''}`}>
                <span className="asset-name">{tileName(id)}</span>
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
                {block && block !== 'notYourTurn' && block !== 'maxLevel' && <span className="asset-why">{t.assets.why[block]}</span>}
              </div>
            );
          })}
        </div>
      ))}
    </Modal>
  );
}
