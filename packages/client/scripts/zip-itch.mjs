// Packs dist-itch into hanoi-monopoly-itch.zip for upload to itch.io
// (index.html at the root, forward-slash paths). No dependencies.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('../dist-itch', import.meta.url));
const out = fileURLToPath(new URL('../hanoi-monopoly-itch.zip', import.meta.url));

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

const files = walk(root).sort();
const local = [];
const central = [];
let offset = 0;
for (const path of files) {
  const name = Buffer.from(relative(root, path).split(sep).join('/'), 'utf8');
  const data = readFileSync(path);
  const body = deflateRawSync(data, { level: 9 });
  // Fields shared by the local and the central header.
  const head = Buffer.alloc(26);
  head.writeUInt16LE(20, 0); // version needed
  head.writeUInt16LE(0x0800, 2); // flags: UTF-8 names
  head.writeUInt16LE(8, 4); // method: deflate
  head.writeUInt16LE(0, 6); // time
  head.writeUInt16LE(0x0021, 8); // date 1980-01-01: reproducible output
  head.writeUInt32LE(crc32(data), 10);
  head.writeUInt32LE(body.length, 14);
  head.writeUInt32LE(data.length, 18);
  head.writeUInt16LE(name.length, 22);
  head.writeUInt16LE(0, 24); // extra length
  local.push(u32(0x04034b50), head, name, body);
  // Central entry: comment length, disk, internal + external attributes, then the local header offset.
  const tail = Buffer.alloc(14);
  tail.writeUInt32LE(offset, 10);
  const madeBy = Buffer.alloc(2);
  madeBy.writeUInt16LE(20);
  central.push(u32(0x02014b50), madeBy, head, tail, name);
  offset += 4 + head.length + name.length + body.length;
}
const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
writeFileSync(out, Buffer.concat([...local, ...central, end]));
console.log(`${out}: ${files.length} files, ${Math.round((offset + centralSize + 22) / 1024)} kB`);
