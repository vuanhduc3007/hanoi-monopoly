# @hanoi-monopoly/engine

Pure TypeScript rules engine. No network, no UI, no timers. Rules: `docs/GDD.md` + `docs/decisions.md`; numbers: `data/*.json`.

```ts
import { createGame, applyAction } from '@hanoi-monopoly/engine';

let { state, events } = createGame({ players: [{ id: 'a', character: 'C01' }, { id: 'b', character: 'C06' }], seed: 1234 });
({ state, events } = applyAction(state, { type: 'roll', player: 'a' }));
```

- `applyAction(state, action) → { state, events }` never mutates its input; invalid actions throw `RuleError`.
- State is plain JSON (RNG state included), so it can be stored, sent and replayed from `seed` + action log.
- When `state.pending` is set the game waits for that decision (`buy`, `auction`, `postRoll`, `chooseCard`, `rentDiscount`, `eventCancel`, `liquidation`, `inheritMortgage`). Otherwise `state.turn.phase` is `roll` or `end`.
- The server owns the clocks and sends `timeout` / `closeAuction` / `cancelTrade` / `endGame`.

## Layout

| File | Role |
| --- | --- |
| `engine.ts` | `createGame`, `applyAction`, task loop, turns, dice, skills dispatch |
| `characters.ts` | character queries + hooks `onTurnStart`, `onPassGo`, `onLand`, `onPayRent`, `onRentPaid`, `onDrawCard`, `onPurchase`, `onBankrupt` |
| `cards.ts` | one handler per card `effect.type` |
| `effects.ts` | ⏳ active effects (expire at the activator's next turn start) |
| `rent.ts` | rent order: base → ×2 group → card multipliers → Ăn vạ → round up |
| `money.ts` | payments, Quỹ routing, liquidation, bankruptcy, scoring |
| `assets.ts` | build / sell / mortgage / trades |
| `movement.ts` | moving, landing, jail, buying, auctions |

## Scripts

```bash
npx pnpm@9.15.0 --filter @hanoi-monopoly/engine test
```
