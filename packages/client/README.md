# @hanoi-monopoly/client

React 18 + Vite client. It only sends actions and displays the server's state; rules stay on the server. The engine package is imported for data (board, prices, card / character definitions) and types only.

```bash
npx -y pnpm@9.15.0 server   # ws://localhost:2567
npx -y pnpm@9.15.0 client   # http://localhost:5173  (VITE_SERVER_URL to point elsewhere)
```

| Screen | File |
| --- | --- |
| S1 Trang chủ | `src/screens/Home.tsx` (invite link: `?room=CODE`) |
| S2 Phòng chờ | `src/screens/Lobby.tsx` |
| S3 Chọn nhân vật | `src/screens/Pick.tsx` |
| S4 Bàn cờ | `src/screens/Game.tsx`, `src/components/Board.tsx`, `Side.tsx` |
| S5 Chi tiết ô | `src/components/TileDetail.tsx` |
| S6 Quyết định | `src/components/Decision.tsx` |
| S7 Giao dịch | `src/components/Trade.tsx` |
| S8 Tài sản | `src/components/Assets.tsx` |
| S9 Kết thúc | `src/screens/GameOver.tsx` |

All player-facing text is in `src/i18n/vi.ts`; card and character descriptions are generated from `data/*.json`. The reconnection token is kept in `sessionStorage` (per tab), so a page reload resumes the game.

Art (`src/art/`) is inline SVG keyed by name — replace an icon in `icons.tsx` or remap a tile in `tileArt.ts`. Sounds (`src/sound/`) are synthesised with Web Audio; `soundsFor(events)` decides which to play.
