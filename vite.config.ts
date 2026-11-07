import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** The build's git short sha: the playtest results row's apk_commit (D-190). '' outside a git checkout. */
function buildSha(): string {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

/** Runs tools/bake-models.ts in a fresh process (the model functions cache what they built) and returns the file. */
function bakeModels(root: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'marchia-baked-'));
  try {
    const out = join(dir, 'models.bin');
    execFileSync(process.execPath, ['--import', 'tsx', 'tools/bake-models.ts', out], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
    return readFileSync(out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The prebaked model catalogue (D-331). Build: baked from the current model code and emitted as a hashed asset;
 * `virtual:baked-models` is its URL. Dev server: the module is null (models are built, so model edits show at
 * once), and `/__baked-models.bin` bakes a fresh file per request for the view harness (`?baked=1`).
 */
function bakedModels(): Plugin {
  const id = 'virtual:baked-models';
  let ref = '';
  let serve = false;
  let root = process.cwd();
  return {
    name: 'baked-models',
    configResolved(c) { serve = c.command === 'serve'; root = c.root; },
    buildStart() {
      if (serve) return;
      ref = this.emitFile({ type: 'asset', name: 'models.bin', source: bakeModels(root) });
    },
    resolveId(s) { return s === id ? '\0' + id : null; },
    load(s) {
      if (s !== '\0' + id) return null;
      return serve || !ref ? 'export default null;' : `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
    configureServer(server) {
      server.middlewares.use('/__baked-models.bin', (_req, res) => {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(bakeModels(root));
      });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD_SHA__: JSON.stringify(buildSha()) },
  plugins: [bakedModels()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true },
});
