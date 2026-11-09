import { useState } from 'react';
import { defaultData as D, type PublicState } from '@hanoi-monopoly/engine';
import { cardName, describeCard, groupName, money, t, tileName } from '../i18n/vi';
import { hasTrait, isMyTurn, me, nameOf, skillOf, unmortgageCost, waitingFor } from '../lib/selectors';
import { act } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useAnimSettled } from '../store';

interface Props {
  state: PublicState;
  room: RoomView;
  openAssets: () => void;
  openTrade: () => void;
}

/** S6 — whatever the game is waiting for, from the viewer's side. */
export function Decision({ state, room, openAssets, openTrade }: Props) {
  const self = me(room, state);
  const pend = state.pending;
  const waiting = waitingFor(state);
  const settled = useAnimSettled();
  if (state.status !== 'playing') return null;
  // Let the dice land and the piece arrive before asking anything.
  if (!settled && pend && pend.type !== 'postRoll') {
    return (
      <section className="panel decision">
        <p className="muted">{t.act.moving}</p>
      </section>
    );
  }

  if (pend?.type === 'auction') return <Auction state={state} room={room} />;

  const mine = !!self && waiting === self.id && !self.bankrupt;
  if (!mine) {
    return (
      <section className="panel decision">
        <p className="muted">{t.act.waitingFor(nameOf(room, waiting))}</p>
      </section>
    );
  }

  let body: JSX.Element;
  switch (pend?.type) {
    case 'buy':
      body = (
        <>
          <p>{t.act.buyPrompt(tileName(pend.propertyId))}</p>
          <div className="buttons">
            <button className="primary" disabled={self.cash < pend.price} onClick={() => act({ type: 'buy' })}>
              {t.act.buy(money(pend.price))}
            </button>
            <button onClick={() => act({ type: 'declineBuy' })}>{t.act.decline}</button>
          </div>
        </>
      );
      break;
    case 'postRoll': {
      const sum = pend.dice.reduce((a, b) => a + b, 0);
      const adjust = hasTrait(self.character, 'adjust_roll');
      const canAdjust = !!adjust && !self.lapAdjustUsed && self.adjustUses < ((adjust.maxUses as number) ?? Infinity);
      const dirs: number[] = (adjust?.directions as number[]) ?? [1, -1];
      const canReroll = skillOf(self.character)?.type === 'reroll' && !self.skillUsed;
      body = (
        <>
          <p>{t.act.postRoll(sum)}</p>
          <div className="buttons">
            {canAdjust && dirs.includes(-1) && <button onClick={() => act({ type: 'adjustStep', delta: -1 })}>{t.act.stepMinus}</button>}
            {canAdjust && dirs.includes(1) && <button onClick={() => act({ type: 'adjustStep', delta: 1 })}>{t.act.stepPlus}</button>}
            {canReroll && <button onClick={() => act({ type: 'useSkill' })}>{t.act.reroll}</button>}
            <button className="primary" onClick={() => act({ type: 'confirmRoll' })}>
              {t.act.confirm}
            </button>
          </div>
        </>
      );
      break;
    }
    case 'chooseCard':
      body = (
        <>
          <p>{t.act.chooseCard}</p>
          <div className="card-choice">
            {pend.options.map((id) => (
              <button key={id} className={`card-flip deck-${D.cards[id].deck}`} onClick={() => act({ type: 'chooseCard', cardId: id })}>
                <div className="card-name">{cardName(id)}</div>
                <div className="card-text">{describeCard(id)}</div>
              </button>
            ))}
          </div>
        </>
      );
      break;
    case 'payRent': {
      const owner = state.ownables[pend.propertyId]?.owner;
      body = (
        <>
          <p className="rent-due">
            {t.act.rentDue(tileName(pend.propertyId), nameOf(room, owner), money(pend.task.amount))}
          </p>
          <div className="buttons">
            <button className="primary pay" onClick={() => act({ type: 'payRent' })}>
              {t.act.payRent(money(pend.task.amount))}
            </button>
            {pend.discount && (
              <button onClick={() => act({ type: 'useSkill' })}>{t.act.rentDiscountUse(money(Math.ceil(pend.raw * (1 - ((skillOf(self.character)?.rate as number) ?? 0)) - 1e-9)))}</button>
            )}
          </div>
        </>
      );
      break;
    }
    case 'revealCard':
      body = <p>{t.act.flipHint}</p>;
      break;
    case 'eventCancel':
      body = (
        <>
          <p>{t.act.eventCancel(cardName(pend.cardId))}</p>
          <p className="muted">{describeCard(pend.cardId)}</p>
          <div className="buttons">
            <button className="primary" onClick={() => act({ type: 'useSkill' })}>
              {t.act.useSkill}
            </button>
            <button onClick={() => act({ type: 'declineSkill' })}>{t.act.skip}</button>
          </div>
        </>
      );
      break;
    case 'liquidation':
      body = (
        <>
          <p>{t.act.liquidation(money(pend.task.amount), money(self.cash))}</p>
          <div className="buttons">
            <button onClick={openAssets}>{t.board.assets}</button>
            <button onClick={openTrade}>{t.board.trade}</button>
            <button className="primary" disabled={self.cash < pend.task.amount} onClick={() => act({ type: 'payDebt' })}>
              {t.act.payDebt}
            </button>
            <button className="danger" onClick={() => act({ type: 'declareBankruptcy' })}>
              {t.act.bankrupt}
            </button>
          </div>
        </>
      );
      break;
    case 'inheritMortgage': {
      const full = unmortgageCost(state, self.id, pend.propertyId);
      const interest = full - D.ownables[pend.propertyId].mortgage;
      body = (
        <>
          <p>{t.act.inherit(tileName(pend.propertyId))}</p>
          <div className="buttons">
            <button disabled={self.cash < full} onClick={() => act({ type: 'resolveMortgage', unmortgage: true })}>
              {t.act.inheritUnmortgage(money(full))}
            </button>
            <button className="primary" onClick={() => act({ type: 'resolveMortgage', unmortgage: false })}>
              {t.act.inheritKeep(money(interest))}
            </button>
          </div>
        </>
      );
      break;
    }
    default:
      body = <TurnActions state={state} room={room} />;
  }
  return <section className="panel decision">{body}</section>;
}

function TurnActions({ state, room }: { state: PublicState; room: RoomView }) {
  const self = me(room, state)!;
  const roll = state.turn.phase === 'roll';
  if (!isMyTurn(room, state)) return null;
  return (
    <>
      {self.inJail && roll && <p>{t.act.jailPrompt}</p>}
      <div className="buttons">
        {self.inJail && roll && (
          <>
            <button disabled={self.cash < D.economy.jailFine} onClick={() => act({ type: 'payJailFine' })}>
              {t.act.payFine(money(D.economy.jailFine))}
            </button>
            {self.jailCards.length > 0 && <button onClick={() => act({ type: 'useJailCard' })}>{t.act.useJailCard}</button>}
            {skillOf(self.character)?.type === 'free_jail_exit' && !self.skillUsed && (
              <button onClick={() => act({ type: 'useSkill' })}>{skillOf(self.character)!.name}</button>
            )}
          </>
        )}
        {roll ? (
          <button className="primary" onClick={() => act({ type: 'roll' })}>
            {t.act.roll}
          </button>
        ) : (
          <button className="primary" onClick={() => act({ type: 'endTurn' })}>
            {t.act.endTurn}
          </button>
        )}
      </div>
      <TurnSkill state={state} room={room} />
    </>
  );
}

/** Bóc phốt (choose an opponent) and Tung tin quy hoạch (choose a group) during one's own turn. */
function TurnSkill({ state, room }: { state: PublicState; room: RoomView }) {
  const self = me(room, state)!;
  const skill = skillOf(self.character);
  const [open, setOpen] = useState(false);
  if (!skill || self.skillUsed || !state.config.characters) return null;
  if (skill.type !== 'block_rent' && skill.type !== 'rent_multiplier') return null;
  const opponents = state.players.filter((p) => p.id !== self.id && !p.bankrupt);
  return (
    <div className="skill">
      <button onClick={() => setOpen(!open)}>
        {t.act.skills}: {skill.name}
      </button>
      {open && skill.type === 'block_rent' && (
        <div className="buttons">
          <span className="muted">{t.act.chooseTarget}</span>
          {opponents.map((p) => (
            <button key={p.id} onClick={() => act({ type: 'useSkill', target: p.id })}>
              {nameOf(room, p.id)}
            </button>
          ))}
        </div>
      )}
      {open && skill.type === 'rent_multiplier' && (
        <div className="buttons">
          <span className="muted">{t.act.chooseGroup}</span>
          {Object.keys(D.groups).map((g) => (
            <button key={g} onClick={() => act({ type: 'useSkill', group: g })} style={{ borderColor: D.groups[g].color }}>
              {groupName(g)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Auction({ state, room }: { state: PublicState; room: RoomView }) {
  const pend = state.pending as Extract<PublicState['pending'], { type: 'auction' }>;
  const self = me(room, state);
  const { startBid, minIncrement } = D.economy.auction;
  const min = pend.highBidder ? pend.highBid + minIncrement : startBid;
  const [amount, setAmount] = useState(min);
  const eligible = !!self && pend.eligible.includes(self.id) && !self.bankrupt;
  const value = Math.max(amount, min);
  return (
    <section className="panel decision">
      <p>
        <strong>{t.act.auction(tileName(pend.propertyId))}</strong> · {money(D.ownables[pend.propertyId].price)}
      </p>
      <p>{pend.highBidder ? t.act.highBid(money(pend.highBid), nameOf(room, pend.highBidder)) : t.act.noBid}</p>
      {eligible && (
        <div className="buttons">
          {[0, 40, 90].map((extra) => (
            <button key={extra} disabled={min + extra > self!.cash} onClick={() => act({ type: 'bid', amount: min + extra })}>
              {money(min + extra)}
            </button>
          ))}
          <input
            type="number"
            min={min}
            step={minIncrement}
            value={value}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label={t.act.bid}
          />
          <button className="primary" disabled={value > self!.cash} onClick={() => act({ type: 'bid', amount: value })}>
            {t.act.bid}
          </button>
        </div>
      )}
    </section>
  );
}
