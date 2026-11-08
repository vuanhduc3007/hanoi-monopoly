import { defaultData, type GameData } from '@hanoi-monopoly/engine';
import { characterRows, quantile, type Totals } from './stats';

export interface ReportOptions {
  tolerancePP: number;
  seconds?: number;
  title?: string;
}

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);
const fmt = (n: number) => Math.round(n).toLocaleString('vi-VN');

function table(header: string[], rows: (string | number)[][], align: ('l' | 'r')[]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells: (string | number)[]) =>
    cells.map((c, i) => (align[i] === 'r' ? lpad(c, widths[i]) : pad(c, widths[i]))).join('  ');
  return [line(header), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

export function groupLabel(d: GameData, key: string): string {
  if (key === 'transport') return 'Giao thông';
  if (key === 'utility') return 'Tiện ích';
  return d.groups[key]?.name ?? key;
}

export function summarize(t: Totals, o: ReportOptions, d: GameData = defaultData) {
  const chars = characterRows(t, o.tolerancePP);
  const seats = Object.entries(t.seats)
    .map(([seat, b]) => ({ seat: Number(seat), games: b.games, winRate: b.wins / b.games, fairRate: b.expected / b.games }))
    .sort((a, b) => a.seat - b.seat);
  const totalLandings = t.landings.reduce((a, b) => a + b, 0);
  const tiles = d.board.map((tile, i) => ({
    position: i,
    ref: tile.ref,
    name: tile.name,
    share: totalLandings ? t.landings[i] / totalLandings : 0,
  }));
  const groupKeys = [...Object.keys(d.groups), 'transport', 'utility'];
  const groups = groupKeys.map((key) => {
    const positions = Object.values(d.ownables)
      .filter((x) => (x.group ?? x.kind) === key)
      .map((x) => x.position);
    const landed = positions.reduce((a, p) => a + t.landings[p], 0);
    const rent = t.rent[key] ?? 0;
    const invested = t.invested[key] ?? 0;
    return {
      key,
      name: groupLabel(d, key),
      landingShare: totalLandings ? landed / totalLandings : 0,
      rentPerGame: rent / t.games,
      investedPerGame: invested / t.games,
      roi: invested ? rent / invested : 0,
    };
  });
  return {
    games: t.games,
    byPlayers: t.byPlayers,
    endedBy: t.endedBy,
    length: {
      avgTurns: t.turns.reduce((a, b) => a + b, 0) / t.games,
      medianTurns: quantile(t.turns, 0.5),
      p90Turns: quantile(t.turns, 0.9),
      avgRounds: t.rounds.reduce((a, b) => a + b, 0) / t.games,
      medianRounds: quantile(t.rounds, 0.5),
    },
    tolerancePP: o.tolerancePP,
    characters: chars.map((c) => ({ ...c, name: d.characters[c.id]?.name ?? '—' })),
    seats,
    tiles,
    groups,
  };
}

export type Summary = ReturnType<typeof summarize>;

export function formatReport(sum: Summary, o: ReportOptions): string {
  const out: string[] = [];
  out.push(`# ${o.title ?? 'Hanoi Monopoly — mô phỏng bot'}`);
  const speed = o.seconds ? ` trong ${o.seconds.toFixed(1)}s (${Math.round(sum.games / o.seconds)} ván/s)` : '';
  out.push(`${fmt(sum.games)} ván${speed}`);
  const byP = Object.entries(sum.byPlayers).map(([n, g]) => `${n} người: ${fmt(g)}`).join(', ');
  out.push(`Số người: ${byP}`);
  const e = sum.endedBy;
  out.push(
    `Kết thúc: còn 1 người ${pct(e.lastStanding / sum.games)}, phá sản thứ 2 (Nhanh) ${pct(e.quickBankrupt / sum.games)}, chạm giới hạn vòng ${pct(e.roundLimit / sum.games)}`,
  );
  out.push(
    `Độ dài: trung bình ${sum.length.avgTurns.toFixed(0)} lượt (${sum.length.avgRounds.toFixed(0)} vòng), trung vị ${sum.length.medianTurns}, p90 ${sum.length.p90Turns}`,
  );

  out.push('', `## Tỉ lệ thắng theo nhân vật (mục tiêu ±${o.tolerancePP} điểm % quanh mức công bằng)`);
  out.push(
    table(
      ['ID', 'Nhân vật', 'Ván', 'Thắng', 'Công bằng', 'Lệch (đ%)', '±95%', 'Hạng TB', ''],
      sum.characters.map((c) => [
        c.id,
        c.name,
        fmt(c.games),
        pct(c.winRate),
        pct(c.fairRate),
        (c.diffPP >= 0 ? '+' : '') + c.diffPP.toFixed(1),
        c.ci95.toFixed(1),
        c.avgRank.toFixed(2),
        c.balanced ? 'OK' : 'LỆCH',
      ]),
      ['l', 'l', 'r', 'r', 'r', 'r', 'r', 'r', 'l'],
    ),
  );
  const off = sum.characters.filter((c) => !c.balanced);
  out.push(off.length ? `→ Cần chỉnh: ${off.map((c) => c.id).join(', ')}` : '→ Mọi nhân vật nằm trong ngưỡng.');

  out.push('', '## Tỉ lệ thắng theo vị trí đi');
  out.push(
    table(
      ['Vị trí', 'Ván', 'Thắng', 'Công bằng'],
      sum.seats.map((s) => [s.seat + 1, fmt(s.games), pct(s.winRate), pct(s.fairRate)]),
      ['r', 'r', 'r', 'r'],
    ),
  );

  out.push('', '## Lợi nhuận theo nhóm');
  out.push(
    table(
      ['Nhóm', 'Tần suất dừng', 'Thuê/ván', 'Đầu tư/ván', 'Thuê/đầu tư'],
      sum.groups.map((g) => [g.name, pct(g.landingShare), fmt(g.rentPerGame), fmt(g.investedPerGame), g.roi.toFixed(2)]),
      ['l', 'r', 'r', 'r', 'r'],
    ),
  );

  out.push('', '## Tần suất dừng từng ô');
  out.push(
    table(
      ['Ô', 'ID', 'Tên', 'Tỉ lệ'],
      sum.tiles.map((t) => [t.position, t.ref, t.name, pct(t.share, 2)]),
      ['r', 'l', 'l', 'r'],
    ),
  );
  return out.join('\n');
}
