# @hanoi-monopoly/sim

Bot vs bot simulator (GDD 7.4). Bots come from `@hanoi-monopoly/engine` (`botAction`), games run with `applyActionInPlace` and are spread over worker threads. Game `i` of a batch uses seed `--seed + i`, so results do not depend on the worker count.

```bash
npx -y pnpm@9.15.0 sim --games 10000 --players 4
npx -y pnpm@9.15.0 sim --games 10000 --players 2-6 --json reports/run.json
npx -y pnpm@9.15.0 sim --mode quick --quick-rounds 40
npx -y pnpm@9.15.0 sim --help
```

Report: win rate per character vs. fair share (Σ 1/players), flagged outside ±3 points; win rate per seat; game length; landing frequency per tile; rent, investment and rent/investment per colour group.

`--json` paths are relative to `packages/sim` when run from the root.

Assumptions:
- Classic games stop after `--max-rounds` (default 200) and are ranked by net worth — the share is shown as "chạm giới hạn vòng".
- Quick mode's 60-minute clock is modelled as `--quick-rounds` (default 40).
- Bots trade only swaps that complete a colour group for both sides (the only offers GDD 7.4 bots accept).
