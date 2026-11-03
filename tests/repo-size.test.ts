// Repository size gate (BACKLOG P3 docs gates): a new tracked file over 1 MiB has to live with the game's assets
// (assets-ultra/, public/assets/, tools/audio-src/); screenshots and docs stay small (JPEG, <= 4 per night).
// Files that were already larger on 2026-11-03 are listed by name (regenerate them as JPEG when touched).
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { assert, test } from './harness';

const LIMIT = 1024 * 1024;
const ASSET_DIRS = ['assets-ultra/', 'public/assets/', 'tools/audio-src/'];
const GRANDFATHERED = new Set([
  'docs/shots/fold-tablet-menu.png',
  'docs/shots/fold-tablet-wagon.png',
  'docs/shots/menu-m7-9.png',
  'docs/shots/models-trees.png',
  'docs/shots/pace-m7-waybill-412x915.png',
  'docs/shots/pace-m7-waybill-915x412.png',
  'docs/shots/textures.png',
  'docs/shots/tier-high-close.png',
  'docs/shots/tier-high-far.png',
  'docs/shots/tier-low-close.png',
  'docs/shots/tier-low-far.png',
  'docs/shots/tier-ultra-close.png',
  'docs/shots/tier-ultra-far.png',
  'docs/shots/ui-road-steep-904x1000.png',
  'docs/shots/ui-settings-904x1000.png',
  'docs/shots/view-close-fold.png',
  'docs/shots/view-far-fold.png',
  'docs/shots/view-menu-fold.png',
  'docs/shots/view-rain-fold.png',
  'docs/shots/view-stress-fold.png',
  'docs/shots/view-traffic-fold.png',
  'docs/shots/view-village-fold.png',
]);

test('no new tracked file over 1 MiB outside the asset folders', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  let files: string[];
  try {
    files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    return; // not a git checkout (release tarball): nothing to gate
  }
  const big: string[] = [];
  for (const f of files) {
    if (ASSET_DIRS.some((d) => f.startsWith(d)) || GRANDFATHERED.has(f)) continue;
    let size = 0;
    try { size = statSync(join(root, f)).size; } catch { continue; } // deleted in the work tree
    if (size > LIMIT) big.push(`${f} (${(size / LIMIT).toFixed(2)} MiB)`);
  }
  assert(big.length === 0, `files over 1 MiB outside the asset folders (use JPEG / smaller shots):\n${big.join('\n')}`);
});
