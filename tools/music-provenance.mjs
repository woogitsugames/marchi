#!/usr/bin/env node
// Music provenance scanner (D-16, BACKLOG P1). Reads every file in public/assets/music/, its SHA-256 and the Suno
// COMMENT tag the container keeps (ffprobe when installed, else a byte search), and compares them with
// docs/legal/music_provenance.json.
//   node tools/music-provenance.mjs           report; exit 1 on any mismatch (same rules as tests/music-provenance)
//   node tools/music-provenance.mjs --write   after re-encoding: refresh `sha256` of existing entries; a new file
//                                             gets a stub entry (title/source to fill in by hand — the test fails
//                                             until `source` and `sourceSha256` are real)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = 'public/assets/music';
const MANIFEST = join(ROOT, 'docs/legal/music_provenance.json');
const write = process.argv.includes('--write');

const sha = (p) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');
function comment(p) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags=comment', '-of', 'default=nw=1:nk=1', join(ROOT, p)], { encoding: 'utf8' });
    return out.trim();
  } catch {
    const b = readFileSync(join(ROOT, p)).toString('latin1');
    return /made with suno[^\0]{0,120}/.exec(b)?.[0] ?? '';
  }
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const byFile = new Map(manifest.tracks.map((e) => [e.file, e]));
const files = readdirSync(join(ROOT, DIR)).filter((f) => !f.startsWith('.')).sort().map((f) => `${DIR}/${f}`);
let bad = 0, changed = 0;
for (const f of files) {
  const h = sha(f), c = comment(f), e = byFile.get(f);
  const id = /id=([0-9a-f-]{36})/.exec(c)?.[1] ?? '-';
  if (!e) {
    console.log(`NEW      ${f}  ${h.slice(0, 12)}  suno ${id}`);
    if (write) {
      manifest.tracks.push({ file: f, sha256: h, title: '', source: '', sourceSha256: '', sourceTags: { comment: c },
        tool: 'Suno AI (per shipped COMMENT tag)', rights: '' });
      changed++;
    } else bad++;
    continue;
  }
  const idOk = id !== '-' && (e.sourceTags?.comment ?? '').includes(id);
  if (e.sha256 !== h) {
    console.log(`CHANGED  ${f}  ${e.sha256.slice(0, 12)} -> ${h.slice(0, 12)}`);
    if (write) { e.sha256 = h; changed++; } else bad++;
  } else console.log(`ok       ${f}  ${h.slice(0, 12)}  suno ${id}${idOk ? '' : '  (id differs from manifest!)'}`);
  if (!idOk) bad++;
}
for (const e of manifest.tracks) if (!files.includes(e.file)) { console.log(`MISSING  ${e.file} (listed, not shipped)`); bad++; }
if (write && changed) {
  manifest.tracks.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  console.log(`wrote ${changed} change(s) to docs/legal/music_provenance.json`);
}
console.log(bad ? `FAIL: ${bad} problem(s)` : `PASS: ${files.length} music files`);
process.exit(bad ? 1 : 0);
