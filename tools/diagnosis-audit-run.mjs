// Bundles tools/diagnosis-audit.ts with esbuild so the game's UI modules (i18n uses Vite's
// import.meta.glob, unavailable under tsx) run headless in Node, then runs it.
// node tools/diagnosis-audit-run.mjs [args...]   (args go to the audit: mission ids, --quick)
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const entry = process.env.AUDIT_ENTRY ?? join(here, 'diagnosis-audit.ts');
const out = join(process.env.AUDIT_OUT_DIR ?? '/tmp', 'diagnosis-audit.bundle.mjs');
const noGlob = {
  name: 'no-import-meta-glob',
  setup(b) {
    b.onLoad({ filter: /src[\\/]i18n[\\/]index\.ts$/ }, (args) => {
      const src = readFileSync(args.path, 'utf8').replace(/import\.meta\.glob<[\s\S]*?\]\)/, '({} as Record<string, () => Promise<any>>)');
      return { contents: src, loader: 'ts' };
    });
    // CSS / assets imported by UI modules are irrelevant headless
    b.onResolve({ filter: /\.(css|png|svg|ogg|mp3|woff2?)(\?.*)?$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default ""', loader: 'js' }));
  },
};
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, plugins: [noGlob], external: ['three', 'node:*'], logLevel: 'warning' });
await import(pathToFileURL(out).href);
