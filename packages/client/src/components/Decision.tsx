import { useState } from 'react';
import {
  buyoutPriceFor,
  flashSalePrice,
  gambleWorst,
  loanOfferFor,
  portalTargetsFor,
  whyCantFreeBuild,
  whyCantMoveHouse,
  whyCantBuyout,
  type BuildBlock,
  type PublicState,
} from '@hanoi-monopoly/engine';
import { D } from '../lib/gameData';
import { cardName, describeCard, groupName, money, sicboName, t, tileName } from '../i18n/vi';
import { hasTrait, isMyTurn, me, nameOf, ownedBy, ownedBySide, skillOf, teammates, unmortgageCost, waitingFor } from '../lib/selectors';
import { act, send } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useAnimSettled } from '../store';

interface Props {
  state: PublicState;
  room: RoomView;
  openAssets: () => void;
  openTrade: () => void;
  /** Du lịch / Flash sale: the player is choosing a tile on the board. */
  pick?: PickMode;
  setPick?: (mode: PickMode) => void;
}

/** Choosing a tile on the board for a skill. */
export type PickMode = 'travel' | 'flash' | null;

/** S6 — whatever the game is waiting for, from the viewer's side. */
export function Decision({ state, room, openAssets, openTrade, pick = null, setPick = () => undefined }: Props) {
  const self = me(room, state);
  const pend = state.pending;
  const waiting = waitingFor(state);
  const settled = useAnimSettled();
  if (state.status !== 'playing') return null;
  const mySeat = room.seats.find((x) => x.id === room.you);
  if (mySeat?.control === 'bot' && self && !self.bankrupt) {
    return (
      <section className="panel decision bot-playing">
        <p>{t.act.botPlaying(t.botReason[mySeat.botReason ?? ''] ?? '')}</p>
        <button className="primary" onClick={() => send('reclaim')}>
          {t.act.reclaim}
        </button>
      </section>
    );
  }
  // Let the dice land and the piece arrive before asking anything.
  if (!settled && pend && pend.type !== 'postRoll') {
    return (
      <section className="panel decision">
        <p className="muted">{t.act.moving}</p>
      </section>
    );
  }

  if (pend?.type === 'auction') return <Auction state={state} room={room} />;

  if (pend?.type === 'sicboBet') return <SicboBet state={state} room={room} />;
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
    case 'buy': {
      // Con bạc may buy on a bet (Liều ăn nhiều) when a lost bet is still affordable.
      const rule = hasTrait(self.character, 'gamble_payment');
      const canBet =
        !!rule &&
        (rule.kinds as string[]).includes('buy') &&
        pend.price >= ((rule.minAmount as number) ?? 0) &&
        self.cash >= gambleWorst(rule, pend.price);
      body = (
        <>
          <p>{t.act.buyPrompt(tileName(pend.propertyId))}</p>
          <div className="buttons">
            <button className="primary" data-coach="buy" disabled={self.cash < pend.price} onClick={() => act({ type: 'buy' })}>
              {t.act.buy(money(pend.price))}
            </button>
            {canBet && (
              <>
                <button className="bet" onClick={() => act({ type: 'buy', gamble: 'tai' })}>{t.act.buyBet(sicboName('tai'))}</button>
                <button className="bet" onClick={() => act({ type: 'buy', gamble: 'xiu' })}>{t.act.buyBet(sicboName('xiu'))}</button>
              </>
            )}
            <button onClick={() => act({ type: 'declineBuy' })}>{t.act.decline}</button>
          </div>
          {canBet && <p className="muted">{betHint(rule!, pend.price)}</p>}
        </>
      );
      break;
    }
    case 'gamble': {
      const rule = hasTrait(self.character, 'gamble_payment');
      body = (
        <>
          <p className="rent-due">{t.act.gamblePrompt(money(pend.task.amount), reasonOf(pend.task.reason))}</p>
          {rule && <p className="muted">{betHint(rule, pend.task.amount)}</p>}
          <div className="buttons">
            <button className="bet" data-coach="bet" onClick={() => act({ type: 'gamble', pick: 'tai' })}>{t.act.betTai}</button>
            <button className="bet" data-coach="bet" onClick={() => act({ type: 'gamble', pick: 'xiu' })}>{t.act.betXiu}</button>
            <button className="primary pay" onClick={() => act({ type: 'gamble', pick: null })}>
              {t.act.payNormal(money(pend.task.amount))}
            </button>
          </div>
        </>
      );
      break;
    }
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
            <button className="primary pay" data-coach="pay" onClick={() => act({ type: 'payRent' })}>
              {t.act.payRent(money(pend.task.amount))}
            </button>
            {pend.discount && (
              <button data-coach="skill" onClick={() => act({ type: 'useSkill' })}>{t.act.rentDiscountUse(money(Math.ceil(pend.raw * (1 - ((skillOf(self.character)?.rate as number) ?? 0)) - 1e-9)))}</button>
            )}
            {/* Short of cash: raise it right here (sell, mortgage, trade) before choosing. */}
            {self.cash < pend.task.amount && (
              <>
                <button data-coach="assets" onClick={openAssets}>{t.board.assets}</button>
                <button data-coach="trade" onClick={openTrade}>{t.board.trade}</button>
              </>
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
    case 'liquidation': {
      const loan = loanOfferFor(state, self.id, D);
      body = (
        <>
          {pend.task.kind === 'rent' && D.ownables[pend.task.reason] && (
            <p className="rent-due">
              {t.act.rentDue(tileName(pend.task.reason), nameOf(room, pend.task.owner), money(pend.task.amount))}
            </p>
          )}
          <p>{t.act.liquidation(money(pend.task.amount), money(self.cash))}</p>
          <div className="buttons">
            {loan && (
              <button onClick={() => act({ type: 'borrow' })}>
                {t.act.borrow(nameOf(room, loan.lender), money(loan.amount), money(loan.owed))}
              </button>
            )}
            <button data-coach="assets" onClick={openAssets}>{t.board.assets}</button>
            <button data-coach="trade" onClick={openTrade}>{t.board.trade}</button>
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
    }
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
      body = <TurnActions state={state} room={room} pick={pick} setPick={setPick} />;
  }
  return <section className="panel decision">{body}</section>;
}

function TurnActions({
  state,
  room,
  pick,
  setPick,
}: {
  state: PublicState;
  room: RoomView;
  pick: PickMode;
  setPick: (mode: PickMode) => void;
}) {
  const self = me(room, state)!;
  const roll = state.turn.phase === 'roll';
  if (!isMyTurn(room, state)) return null;
  const sk = skillOf(self.character);
  const ready = state.config.characters && !self.skillUsed;
  // Du lịch and Mở cổng replace the roll.
  const canTravel = roll && !self.inJail && ready && sk?.type === 'travel';
  const canPortal = roll && !self.inJail && ready && sk?.type === 'portal';
  const portalOk = canPortal && portalTargetsFor(state, self.id, D).length > 0;
  if (pick === 'travel' && canTravel) {
    return (
      <>
        <p className="travel-hint">{t.act.travelPick}</p>
        <div className="buttons">
          <button onClick={() => setPick(null)}>{t.act.travelCancel}</button>
        </div>
      </>
    );
  }
  if (pick === 'flash' && ready && sk?.type === 'flash_sale') {
    return (
      <>
        <p className="travel-hint">{sk.completesGroup === false ? t.act.flashPickNoComplete : t.act.flashPick}</p>
        <div className="buttons">
          <button onClick={() => setPick(null)}>{t.act.flashCancel}</button>
        </div>
      </>
    );
  }
  return (
    <>
      {self.inJail && roll && <p>{t.act.jailPrompt}</p>}
      <div className="buttons">
        {self.inJail && roll && (
          <>
            <button data-coach="roll" disabled={self.cash < D.economy.jailFine} onClick={() => act({ type: 'payJailFine' })}>
              {t.act.payFine(money(D.economy.jailFine))}
            </button>
            {self.jailCards.length > 0 && <button onClick={() => act({ type: 'useJailCard' })}>{t.act.useJailCard}</button>}
            {skillOf(self.character)?.type === 'free_jail_exit' && !self.skillUsed && (
              <button onClick={() => act({ type: 'useSkill' })}>{skillOf(self.character)!.name}</button>
            )}
          </>
        )}
        {roll ? (
          <button className="primary" data-coach="roll" onClick={() => act({ type: 'roll' })}>
            {t.act.roll}
          </button>
        ) : null}
        {canTravel && (
          <button data-coach="skill" onClick={() => setPick('travel')}>
            ✈ {sk!.name}
          </button>
        )}
        {canPortal && (
          <button data-coach="skill" disabled={!portalOk} title={t.act.portalTitle} onClick={() => act({ type: 'useSkill' })}>
            {t.act.portal(sk!.name)}
          </button>
        )}
        {!roll && (
          <button className="primary" data-coach="endTurn" onClick={() => act({ type: 'endTurn' })}>
            {t.act.endTurn}
          </button>
        )}
      </div>
      <TurnSkill state={state} room={room} setPick={setPick} />
    </>
  );
}

/** Bóc phốt (choose an opponent) and Tung tin quy hoạch (choose a group) during one's own turn. */
function TurnSkill({ state, room, setPick }: { state: PublicState; room: RoomView; setPick: (mode: PickMode) => void }) {
  const self = me(room, state)!;
  const skill = skillOf(self.character);
  const [open, setOpen] = useState(false);
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  if (!skill || !state.config.characters) return null;
  if (self.skillUsed) {
    return self.skillCooldown ? <p className="muted skill-cooldown">{t.act.skillCooldown(skill.name, self.skillCooldown)}</p> : null;
  }
  if (state.pending) return null;
  if (skill.type === 'forced_loan') {
    const amount = skill.amount as number;
    const owed = Math.ceil(amount * (skill.repayRate as number) - 1e-9);
    const anyone = state.players.some((p) => p.id !== self.id && !p.bankrupt && !teammates(state, self.id, p.id));
    return (
      <div className="skill">
        <button data-coach="skill" disabled={self.cash < amount || !anyone} onClick={() => act({ type: 'useSkill' })}>
          {t.act.skills}: {t.act.forcedLoan(money(amount), money(owed))}
        </button>
      </div>
    );
  }
  if (skill.type === 'flash_sale') {
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => setPick('flash')}>
          {t.act.skills}: 🏷 {skill.name}
        </button>
      </div>
    );
  }
  if (skill.type === 'raise_rent') {
    const max = skill.maxPerTile as number;
    const mine = ownedBy(state, self.id).filter((id) => D.ownables[id].kind === 'property');
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => setOpen(!open)}>
          {t.act.skills}: {skill.name}
        </button>
        {open && (
          <div className="buttons">
            <span className="muted">{mine.length ? t.act.chooseRaise : t.act.noRaise}</span>
            {mine.map((id) => {
              const n = self.rentBoosts?.[id] ?? 0;
              return (
                <button
                  key={id}
                  disabled={n >= max}
                  style={{ borderColor: D.groups[D.ownables[id].group ?? '']?.color }}
                  onClick={() => act({ type: 'useSkill', propertyId: id })}
                >
                  {tileName(id)}
                  {n > 0 && ` · ${t.act.raised(n, max)}`}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  if (skill.type === 'move_house') {
    const mine = ownedBy(state, self.id).filter((id) => D.ownables[id].kind === 'property');
    const ok = (from: string, to: string) => whyCantMoveHouse(state, self.id, from, to, D) === null;
    const sources = mine.filter((from) => mine.some((to) => ok(from, to)));
    const targets = moveFrom ? mine.filter((to) => ok(moveFrom, to)) : [];
    const tileButton = (id: string, onClick: () => void) => (
      <button key={id} style={{ borderColor: D.groups[D.ownables[id].group ?? '']?.color }} onClick={onClick}>
        {tileName(id)} · {state.ownables[id].level} 🏠
      </button>
    );
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => (setOpen(!open), setMoveFrom(null))}>
          {t.act.skills}: {skill.name}
        </button>
        {open && !moveFrom && (
          <div className="buttons">
            <span className="muted">{sources.length ? t.act.moveFrom : t.act.noMoves}</span>
            {sources.map((id) => tileButton(id, () => setMoveFrom(id)))}
          </div>
        )}
        {open && moveFrom && (
          <div className="buttons">
            <span className="muted">{t.act.moveTo(tileName(moveFrom))}</span>
            {targets.map((id) =>
              tileButton(id, () => {
                setMoveFrom(null);
                setOpen(false);
                act({ type: 'useSkill', from: moveFrom, propertyId: id });
              }),
            )}
            <button className="link" onClick={() => setMoveFrom(null)}>
              {t.act.moveAgain}
            </button>
          </div>
        )}
      </div>
    );
  }
  if (skill.type === 'scholarship') {
    const fromFund = state.config.scholarshipFund ? Math.min(state.fund, skill.maxAmount as number) : 0;
    const amount = fromFund > 0 ? fromFund : (skill.fallbackAmount as number);
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => act({ type: 'useSkill' })}>
          {t.act.skills}: {t.act.scholarship(skill.name, money(amount), fromFund > 0)}
        </button>
      </div>
    );
  }
  if (skill.type === 'buyout') {
    const targets = Object.keys(state.ownables).filter((id) => whyCantBuyout(state, self.id, id, D) === null);
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => setOpen(!open)}>
          {t.act.skills}: {skill.name}
        </button>
        {open && (
          <div className="buttons">
            <span className="muted">{targets.length ? t.act.chooseBuyout : t.act.noBuyout}</span>
            {targets.map((id) => (
              <button
                key={id}
                style={{ borderColor: D.groups[D.ownables[id].group ?? '']?.color }}
                onClick={() => act({ type: 'useSkill', propertyId: id })}
              >
                {tileName(id)} · {nameOf(room, state.ownables[id].owner)} · {money(buyoutPriceFor(state, self.id, id, D))}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  // One-click skills.
  if (skill.type === 'host_sicbo' || skill.type === 'collect_contribution') {
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => act({ type: 'useSkill' })}>
          {t.act.skills}: {skill.name}
        </button>
      </div>
    );
  }
  if (skill.type === 'buy_mortgaged' || skill.type === 'free_build') {
    const targets =
      skill.type === 'buy_mortgaged'
        ? Object.keys(state.ownables).filter((id) => {
            const o = state.ownables[id];
            return o.owner && o.owner !== self.id && o.mortgaged;
          })
        : ownedBy(state, self.id).filter((id) => D.ownables[id].kind === 'property' && freeBuildBlock(state, self.id, id) === null);
  // Nothing to build on: say why (the most common reason over the player's land).
  const why = skill.type === 'free_build' && targets.length === 0 ? freeBuildReason(state, self.id) : null;
    return (
      <div className="skill">
        <button data-coach="skill" onClick={() => setOpen(!open)}>
          {t.act.skills}: {skill.name}
        </button>
        {open && (
          <div className="buttons">
            <span className="muted">{skill.type === 'buy_mortgaged' ? t.act.chooseMortgaged : t.act.chooseFreeBuild}</span>
            {targets.length === 0 && <span className="muted">{why ? t.act.noTargetsWhy(why) : t.act.noTargets}</span>}
            {targets.map((id) => (
              <button
                key={id}
                style={{ borderColor: D.groups[D.ownables[id].group ?? '']?.color }}
                onClick={() => act({ type: 'useSkill', propertyId: id })}
              >
                {tileName(id)}
                {skill.type === 'buy_mortgaged' && ` · ${money(Math.ceil(D.ownables[id].mortgage * (1 + (skill.premium as number)) - 1e-9))}`}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (skill.type !== 'block_rent' && skill.type !== 'rent_multiplier') return null;
  const opponents = state.players.filter((p) => p.id !== self.id && !p.bankrupt && !teammates(state, self.id, p.id));
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

/** Thợ xây: may the free house go here? "noCash" never blocks a free house. */
function freeBuildBlock(state: PublicState, playerId: string, id: string): BuildBlock | null {
  const why = whyCantFreeBuild(state, playerId, id, D);
  return why === 'noCash' ? null : why;
}

/** Why Tự tay xây has no tile: no land at all, or the most common block over the player's land. */
function freeBuildReason(state: PublicState, playerId: string): string {
  const land = ownedBy(state, playerId).filter((id) => D.ownables[id].kind === 'property');
  if (land.length === 0) return t.act.noLand;
  const counts = new Map<BuildBlock, number>();
  for (const id of land) {
    const b = freeBuildBlock(state, playerId, id);
    if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  if (top === 'needFullGroup') {
    // The lone-tile house ("nhà chui") is already standing somewhere: say where, not just "need the group".
    const fullGroup = (g: string) =>
      Object.keys(D.ownables)
        .filter((o) => D.ownables[o].group === g)
        .every((o) => ownedBySide(state, o, playerId));
    const chui = land.find((id) => state.ownables[id].level > 0 && !fullGroup(D.ownables[id].group!));
    if (chui) return t.act.chuiUsed(tileName(chui));
  }
  return top ? t.assets.why[top] : t.act.noTargets;
}

/** "Thắng chỉ trả … · thua trả … · ra bão trả …" for Con bạc's bets. */
function betHint(rule: Record<string, unknown>, amount: number): string {
  const up = (x: number) => Math.ceil(x - 1e-9);
  return t.act.buyBetHint(
    money(up(amount * (1 - (rule.winRate as number)))),
    money(gambleWorst(rule as { type: string }, amount)),
    money(Math.max(0, up(amount * (1 - (rule.jackpotRate as number))))),
  );
}

function reasonOf(reason: string): string {
  if (reason === 'TAX1' || reason === 'TAX2') return ` (${tileName(reason)})`;
  if (reason === 'jailFine') return ' (phạt Bãi giữ xe)';
  if (D.cards[reason]) return ` (${cardName(reason)})`;
  return '';
}

/** Mở sòng: every bettor picks Tài / Xỉu at the same time; everyone sees who has bet what. */
function SicboBet({ state, room }: { state: PublicState; room: RoomView }) {
  const pend = state.pending as Extract<PublicState['pending'], { type: 'sicboBet' }>;
  const self = me(room, state);
  const mine = !!self && !self.bankrupt && pend.waiting.includes(self.id);
  return (
    <section className="panel decision sicbo-table">
      <p>
        <strong>{t.sicboTitle(nameOf(room, pend.host))}</strong>
      </p>
      {mine ? (
        <>
          <p>{t.act.sicboBetPrompt(nameOf(room, pend.host), money(pend.stake))}</p>
          <div className="buttons">
            <button className="bet" data-coach="bet" onClick={() => act({ type: 'placeBet', pick: 'tai' })}>{t.act.betTai}</button>
            <button className="bet" data-coach="bet" onClick={() => act({ type: 'placeBet', pick: 'xiu' })}>{t.act.betXiu}</button>
          </div>
        </>
      ) : (
        <p className="muted">{t.act.sicboWaiting(pend.waiting.length)}</p>
      )}
      <ul className="sicbo-bets">
        {pend.order.map((id) => (
          <li key={id} className={pend.bets[id] ? 'bet-done' : 'muted'}>
            {nameOf(room, id)}: {pend.bets[id] ? sicboName(pend.bets[id]) : t.act.sicboChoosing}
          </li>
        ))}
      </ul>
    </section>
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
    <section className="panel decision" data-coach="auction">
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
