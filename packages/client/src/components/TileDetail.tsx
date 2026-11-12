import { type PublicState } from '@hanoi-monopoly/engine';
import { D } from '../lib/gameData';
import { money, t } from '../i18n/vi';
import { groupColor } from '../lib/board';
import { hotelLevel, nameOf } from '../lib/selectors';
import type { RoomView } from '../net/protocol';
import { Modal } from './Modal';
import { TeamTag } from './TeamTag';

/** S5 — price, rent table, owner, buildings, mortgage. */
export function TileDetail({ pos, state, room, onClose }: { pos: number; state: PublicState; room: RoomView; onClose: () => void }) {
  const tile = D.board[pos];
  const def = D.ownables[tile.ref];
  const own = state.ownables[tile.ref];
  const H = hotelLevel(state) - 1;
  return (
    <Modal title={tile.name} onClose={onClose}>
      {def?.group && <div className="detail-band" style={{ background: groupColor(def.group) }}>{D.groups[def.group].name}</div>}
      {!def && (tile.ref === 'GO' || tile.ref === 'PARK') && <p className="muted">{t.tile.heritage}</p>}
      {def && (
        <table className="detail">
          <tbody>
            <tr>
              <th>{t.tile.price}</th>
              <td>{money(def.price)}</td>
            </tr>
            <tr>
              <th>{t.tile.owner}</th>
              <td>
                {own.owner ? nameOf(room, own.owner) : t.tile.noOwner}
                {own.owner && <TeamTag team={state.players.find((p) => p.id === own.owner)?.team} short />}
              </td>
            </tr>
            {def.rent && (
              <>
                <tr className="section">
                  <th colSpan={2}>{t.tile.rent}</th>
                </tr>
                <tr className={own.level === 0 ? 'current' : ''}>
                  <th>{t.tile.base}</th>
                  <td>{money(def.rent.base)}</td>
                </tr>
                <tr>
                  <th>{state.players.some((p) => p.team !== undefined && p.team !== null) ? t.tile.baseGroupTeam : t.tile.baseGroup}</th>
                  <td>{money(def.rent.base * D.economy.monopolyBaseRentMultiplier)}</td>
                </tr>
                {Array.from({ length: H }, (_, i) => i + 1).map((n) => (
                  <tr key={n} className={own.level === n ? 'current' : ''}>
                    <th>{t.tile.house(n)}</th>
                    <td>{money(def.rent![`h${n}` as 'h1'])}</td>
                  </tr>
                ))}
                <tr className={own.level === H + 1 ? 'current' : ''}>
                  <th>{t.tile.hotel}</th>
                  <td>{money(def.rent.hotel)}</td>
                </tr>
                <tr>
                  <th>{t.tile.buildCost}</th>
                  <td>{money(def.buildCost!)}</td>
                </tr>
              </>
            )}
            {def.kind === 'transport' &&
              D.economy.transportRent.map((r, i) => (
                <tr key={i}>
                  <th>{t.tile.transportRent(i + 1)}</th>
                  <td>{money(r)}</td>
                </tr>
              ))}
            {def.kind === 'utility' &&
              Object.entries(D.economy.utilityMultiplier).map(([n, m]) => (
                <tr key={n}>
                  <th colSpan={2}>{t.tile.utilityRent(Number(n), m)}</th>
                </tr>
              ))}
            <tr className="section">
              <th>{t.tile.mortgage}</th>
              <td>
                {money(def.mortgage)}
                {own.mortgaged && <strong> · {t.tile.mortgaged}</strong>}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Modal>
  );
}
