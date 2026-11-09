# @hanoi-monopoly/server

Colyseus 0.16 game server. Room rules live in `src/controller.ts` (no Colyseus dependency, tested with a fake clock); `src/GameRoom.ts` only adapts joins / leaves / messages.

```bash
npx -y pnpm@9.15.0 server            # ws://localhost:2567  (PORT, BOT_DELAY_MS, LOG_DIR env vars)
```

## Joining

```ts
import { Client } from 'colyseus.js';
const client = new Client('ws://localhost:2567');
const room = await client.create('hanoi', { name });            // host; room.roomId is the 6-char code
const room2 = await client.joinById(code, { name, secret });   // player (lobby) or spectator (game started / full)
const again2 = await client.joinById(code, { secret, resume: true }); // after a reload: take the same seat back
const watch = await client.joinById(code, { spectator: true });
const again = await client.reconnect(room.reconnectionToken);  // after a dropped connection
```

## Client → server messages

| Type | Payload | When |
| --- | --- | --- |
| `setName` | `{ name }` | any time |
| `thinking` | `{ mode: 'assets' \| 'trade' \| null }` — open panel: Tài sản adds time once, Giao dịch pauses your clock | playing |
| `ready` | `{ ready: boolean }` | lobby |
| `setConfig` | `{ mode?, board?, characters?, scholarshipFund?, buildingLimit?, maxPlayers?, allowSpectators? }` — `board`: `auto` (40 tiles for 2–4, 48 for 5–6, 56 for 7–8 players) \| `standard` \| `extended` \| `large`; `maxPlayers` 2–8 | lobby, host |
| `start` | `{}` | lobby, host (≥ 2 players, all ready) |
| `rematch` | `{}` | game over, host — back to the lobby with the connected players |
| `pick` | `{ character: 'C01'… }` | picking, your turn to pick |
| `action` | `{ action }` — an engine `Action`; `player` is filled in by the server (incl. `revealCard`, `payRent`, `gamble`, `placeBet`, `buy` with `gamble`, `useSkill` with `propertyId`) | playing |
| `chat` | `{ text }` | any time (≤ 200 chars, 1 / 0.5 s) |
| `emote` | `{ emote }` | any time |

`timeout`, `closeAuction` and `endGame` are server-only.

## Server → client messages

| Type | Payload |
| --- | --- |
| `joined` | `{ role: 'player' \| 'spectator', code }` |
| `room` | `{ code, phase, settings, you, seats[], spectators, picking: { order, current, available, clock } \| null }` |
| `turnOrder` | `{ order, rolls }` |
| `picked` | `{ seat, character, random }` |
| `clock` | `{ clock }` — the clock changed without a game update (paused / extended) |
| `game` | `{ state: PublicState, events: GameEvent[], clock: { kind, deadline } \| null }` — clock kinds: roll, buy, decision, reveal, rent, auction, turn, liquidation, pick; a face-down card has `pending.cardId = ''` |
| `botTakeover` | `{ seat, reason: 'disconnect' \| 'afk' \| 'left' }` |
| `gameOver` | `{ winner, ranking, seed, stats: { rentPaid, rentEarned, rentByTile }, log }` |
| `chat` / `emote` | `{ from, spectator, text \| emote, at }` |
| `error` | `{ code, message }` — codes in `ErrorCode` (`controller.ts`) |
