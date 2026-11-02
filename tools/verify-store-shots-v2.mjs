// Verify and merge independently captured real-game screenshots before release.
import { readdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = 'docs/store/shots';
const langs = ['pl', 'en'];
const variants = ['portrait', 'landscape', 'app'];
const dims = { portrait: [1080, 1920], landscape: [1920, 1080], app: [1290, 2796] };
const expected = new Set();
for (const lang of langs) {
  for (const shot of [1, 2, 3, 4, 5, 6]) {
    for (const kind of variants) {
      if (kind === 'landscape' && shot !== 1 && shot !== 5) continue;
      const [w, h] = dims[kind];
      expected.add(`${root}/${lang}/${String(shot).padStart(2, '0')}-${w}x${h}.png`);
    }
  }
  expected.add(`${root}/${lang}/feature-1024x500.png`);
}
const logs = join(root, 'logs');
const files = new Map();
for (const lang of langs) for (const orientation of variants) {
  const logName = join(logs, `${lang}-${orientation}.json`);
  if (!existsSync(logName)) throw Error(`Missing capture manifest: ${logName}`);
  const record = JSON.parse(readFileSync(logName, 'utf8'));
  if (record.failures?.length) throw Error(`Capture failed: ${logName}: ${record.failures.join('; ')}`);
  for (const shot of record.shots) {
    if (!expected.has(shot.file)) throw Error(`Unexpected path: ${shot.file}`);
    if (files.has(shot.file)) throw Error(`Duplicate capture: ${shot.file}`);
    if (shot.kind !== 'feature') {
      if (shot.ok !== true || ![1,2,3,4,5,6].includes(shot.scene)) {
        throw Error(`Unverified game state: ${shot.file}`);
      }
      if (shot.scene === 1 && shot.loaded < 1) throw Error(`No cargo: ${shot.file}`);
      if (shot.scene === 3 && shot.jamWagon === null) throw Error(`No bridge jam: ${shot.file}`);
      if (shot.scene === 4 && !shot.iceActive) throw Error(`No ice: ${shot.file}`);
      if (shot.scene === 5 && (!shot.storePrices || !Number.isInteger(shot.rank))) throw Error(`No market: ${shot.file}`);
      if (shot.scene === 6 && (shot.result !== 'won' || !shot.letterVisible)) throw Error(`No victory letter: ${shot.file}`);
    }
    files.set(shot.file, shot);
  }
}
if (files.size !== 30 || expected.size !== 30) throw Error(`Expected 30 PNGs, got ${files.size}`);
let bytes = 0;
for (const file of expected) {
  if (!files.has(file) || !existsSync(file)) throw Error(`Missing final PNG: ${file}`);
  const meta = await sharp(file).metadata();
  const name = file.match(/(\d+)x(\d+)\.png$/);
  if (!name || meta.format !== 'png' || meta.width !== +name[1] || meta.height !== +name[2]) {
    throw Error(`Invalid PNG size/format: ${file}`);
  }
  bytes += statSync(file).size;
}
if (bytes > 25_000_000) throw Error(`PNG total exceeds 25 MB: ${bytes} bytes`);
writeFileSync(join(root, 'manifest.json'), JSON.stringify({
  source: 'real Marchia WebGL gameplay', validated: true,
  totalFiles: files.size, totalBytes: bytes,
  files: [...files.values()].sort((a,b) => a.file.localeCompare(b.file)),
}, null, 2) + '\n');
console.log(`VERIFIED: 30 authentic screenshots, ${bytes} bytes (max 25,000,000), PL/EN`);
