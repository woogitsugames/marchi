// Music provenance gate (BACKLOG P1, D-16): a music file without a provenance entry does not ship.
// Every file in public/assets/music/ has an entry in docs/legal/music_provenance.json with its SHA-256, a Suno id
// that the shipped file still carries in its container COMMENT tag, a source and rights line; every entry points at
// a shipped file; every track the player can pick (src/audio/music.ts TRACKS) exists; docs/ASSETS.md lists them all.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { assert, eq, test } from './harness';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = 'public/assets/music';

interface Entry {
  file: string; sha256: string; title: string; source: string; sourceSha256: string;
  sourceTags: { comment?: string }; tool: string; rights: string;
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/legal/music_provenance.json'), 'utf8')) as { tracks: Entry[] };
const shipped = readdirSync(join(ROOT, DIR)).filter((f) => !f.startsWith('.')).sort();
const byFile = new Map(manifest.tracks.map((e) => [e.file, e]));
const sha = (p: string): string => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex');
const SUNO_ID = /\bid=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/;

test('music provenance: every shipped music file has a manifest entry with a matching SHA-256', () => {
  assert(shipped.length > 0, 'no music files found');
  for (const f of shipped) {
    const e = byFile.get(`${DIR}/${f}`);
    assert(e !== undefined, `${DIR}/${f} has no entry in docs/legal/music_provenance.json (no entry = not in the package)`);
    eq(sha(e!.file), e!.sha256, `${e!.file}: shipped file changed without updating its provenance (node tools/music-provenance.mjs --write)`);
  }
});

test('music provenance: every entry names a shipped file once, with source, tool and rights', () => {
  const seen = new Set<string>();
  for (const e of manifest.tracks) {
    assert(!seen.has(e.file), `${e.file}: listed twice`);
    seen.add(e.file);
    assert(e.file.startsWith(`${DIR}/`) && existsSync(join(ROOT, e.file)), `${e.file}: listed but not shipped`);
    assert(/^[0-9a-f]{64}$/.test(e.sha256) && /^[0-9a-f]{64}$/.test(e.sourceSha256), `${e.file}: malformed hashes`);
    for (const k of ['title', 'source', 'tool', 'rights'] as const) assert(e[k].trim().length > 0, `${e.file}: empty ${k}`);
    assert(/suno/i.test(e.tool), `${e.file}: tool must say how the track was made (Suno AI, D-16)`);
  }
});

test('music provenance: shipped files still carry their Suno id (container COMMENT tag)', () => {
  for (const e of manifest.tracks) {
    const id = SUNO_ID.exec(e.sourceTags.comment ?? '')?.[1];
    assert(id !== undefined, `${e.file}: sourceTags.comment has no Suno id`);
    assert(readFileSync(join(ROOT, e.file)).includes(`id=${id}`), `${e.file}: Suno id ${id} not found in the shipped file`);
  }
});

test('music provenance: every track the player can hear exists and ASSETS.md lists every file', () => {
  const src = readFileSync(join(ROOT, 'src/audio/music.ts'), 'utf8');
  const block = /const TRACKS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src)?.[1] ?? '';
  const names = [...block.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  assert(names.length > 0, 'TRACKS table not found in src/audio/music.ts');
  for (const n of names) assert(shipped.includes(`${n}.webm`), `music.ts plays ${n}.webm, which is not shipped`);
  for (const f of shipped) assert(names.includes(f.replace(/\.webm$/, '')), `${f} is shipped but never played (dead weight)`);
  const assets = readFileSync(join(ROOT, 'docs/ASSETS.md'), 'utf8');
  for (const f of shipped) assert(assets.includes(`| ${f} |`), `docs/ASSETS.md (Music table) does not list ${f}`);
});
