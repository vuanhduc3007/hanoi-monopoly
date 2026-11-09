import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { dataFor } from '@hanoi-monopoly/engine';
import { formatReport, summarize } from './report';
import { simulateRange, type BatchOptions } from './simulate';
import { mergeTotals, newTotals, type Totals } from './stats';

const HELP = `Hanoi Monopoly — mô phỏng bot vs bot

  --games N          số ván (mặc định 10000)
  --players N|A-B    số người mỗi ván, hoặc khoảng ngẫu nhiên (mặc định 4)
  --mode M           classic | quick (mặc định classic)
  --board B          standard (40 ô) | extended (48 ô) | large (56 ô) (mặc định standard)
  --seed S           seed ván đầu; ván i dùng S+i (mặc định 1)
  --max-rounds R     Truyền thống: dừng sau R vòng, xếp hạng theo tài sản (mặc định 200)
  --quick-rounds R   Nhanh: số vòng thay cho 60 phút (mặc định 40)
  --no-characters    tắt nhân vật (Cổ điển)
  --pool C01,C02,…   chỉ chia các nhân vật này
  --tolerance P      ngưỡng lệch tỉ lệ thắng, điểm % (mặc định 3)
  --workers K        số luồng (mặc định số CPU - 1)
  --json FILE        ghi kết quả dạng JSON
  --patch FILE       thử số liệu nhân vật khác: {"characters": {"C03": {"drawbacks": [...]}}}
`;

interface CliOptions extends BatchOptions {
  workers: number;
  tolerance: number;
  json?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions = {
    games: 10_000,
    seed: 1,
    players: 4,
    mode: 'classic',
    characters: true,
    maxRounds: 200,
    quickRounds: 40,
    workers: Math.max(1, availableParallelism() - 1),
    tolerance: 3,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = () => {
      const x = argv[++i];
      if (x === undefined) throw new Error(`Missing value for ${a}`);
      return x;
    };
    const int = () => {
      const x = Number(v());
      if (!Number.isInteger(x) || x < 0) throw new Error(`${a} expects a non-negative integer`);
      return x;
    };
    switch (a) {
      case '--':
        break;
      case '--games': o.games = int(); break;
      case '--seed': o.seed = int(); break;
      case '--players': {
        const x = v();
        const m = /^(\d)-(\d)$/.exec(x);
        o.players = m ? [Number(m[1]), Number(m[2])] : Number(x);
        break;
      }
      case '--mode': {
        const m = v();
        if (m !== 'classic' && m !== 'quick') throw new Error('--mode must be classic or quick');
        o.mode = m;
        break;
      }
      case '--board': {
        const b = v();
        if (b !== 'standard' && b !== 'extended' && b !== 'large') throw new Error('--board must be standard, extended or large');
        o.board = b;
        break;
      }
      case '--max-rounds': o.maxRounds = int(); break;
      case '--quick-rounds': o.quickRounds = int(); break;
      case '--no-characters': o.characters = false; break;
      case '--pool': o.pool = v().split(',').map((x) => x.trim()).filter(Boolean); break;
      case '--tolerance': o.tolerance = Number(v()); break;
      case '--workers': o.workers = Math.max(1, int()); break;
      case '--json': o.json = v(); break;
      case '--patch': o.patch = JSON.parse(readFileSync(v(), 'utf8')); break;
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        process.exit(0);
      default:
        throw new Error(`Unknown option ${a}\n\n${HELP}`);
    }
  }
  const counts = typeof o.players === 'number' ? [o.players] : o.players;
  if (counts.some((n) => n < 2 || n > 8)) throw new Error('--players must be within 2-8');
  return o;
}

function runInWorker(o: BatchOptions, from: number, to: number): Promise<Totals> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { o, from, to } });
    w.once('message', resolve);
    w.once('error', reject);
    w.once('exit', (code) => code !== 0 && reject(new Error(`worker exited with ${code}`)));
  });
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const k = Math.min(o.workers, o.games || 1);
  let totals: Totals;
  if (k <= 1) {
    totals = simulateRange(o, 0, o.games);
  } else {
    const chunk = Math.ceil(o.games / k);
    const parts = await Promise.all(
      Array.from({ length: k }, (_, i) => runInWorker(o, i * chunk, Math.min(o.games, (i + 1) * chunk))),
    );
    totals = parts.reduce(mergeTotals, newTotals(dataFor(o.board).board.length));
  }
  const seconds = (Date.now() - started) / 1000;
  const players = typeof o.players === 'number' ? `${o.players}` : o.players.join('-');
  const title = `Hanoi Monopoly — ${o.mode === 'quick' ? 'Nhanh' : 'Truyền thống'}, ${players} người, ${dataFor(o.board).board.length} ô, ${o.characters ? 'có' : 'không'} nhân vật, seed ${o.seed}`;
  const sum = summarize(totals, { tolerancePP: o.tolerance }, dataFor(o.board));
  process.stdout.write(formatReport(sum, { tolerancePP: o.tolerance, seconds, title }) + '\n');
  if (o.json) {
    const { workers: _w, json: _j, ...options } = o;
    writeFileSync(o.json, JSON.stringify({ options, seconds, ...sum }, null, 2));
    process.stdout.write(`\nĐã ghi ${o.json}\n`);
  }
}

if (isMainThread) {
  main().catch((e) => {
    process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
    process.exit(1);
  });
} else {
  const { o, from, to } = workerData as { o: BatchOptions; from: number; to: number };
  parentPort!.postMessage(simulateRange(o, from, to));
}
