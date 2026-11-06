import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** The build's git short sha: the playtest results row's apk_commit (D-190). '' outside a git checkout. */
function buildSha(): string {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

export default defineConfig({
  base: './',
  define: { __BUILD_SHA__: JSON.stringify(buildSha()) },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  server: { host: true },
});
