/**
 * Renders every icon at 24 / 48 / 96 px on parchment into docs/shots/icons.html
 * and screenshots it to docs/shots/icons.png.  Run: npx tsx tools/render-icon-sheet.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GOOD_ICONS, ICON_IDS, iconSvg, struckIconSvg, type IconId } from '../src/ui/icons';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/shots');
mkdirSync(outDir, { recursive: true });

const cell = (id: IconId): string => `
  <figure>
    <div class="row">${[24, 48, 96].map((s) => iconSvg(id, s, id)).join('')}</div>
    <figcaption>${id}</figcaption>
  </figure>`;

const struck: IconId[] = [...GOOD_ICONS];
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MARCHIA icons</title>
<style>
  body { margin: 0; padding: 16px; background: #e4dccb; color: #2b2620; font: 13px/1.2 sans-serif; }
  h2 { font-size: 15px; margin: 12px 0 6px; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px 14px; }
  figure { margin: 0; padding: 6px; border: 1px solid #cfc5b0; }
  .row { display: flex; align-items: flex-end; gap: 10px; }
  figcaption { margin-top: 4px; font-size: 12px; }
  .strip { display: flex; gap: 14px; align-items: center; }
  .dark { background: #3b3127; color: #e4dccb; padding: 8px; display: flex; gap: 10px; flex-wrap: wrap; }
</style></head><body>
<div class="grid">${ICON_IDS.map(cell).join('')}</div>
<h2>Goods side by side at 24 px, struck variants, and on oak</h2>
<div class="strip">${struck.map((g) => iconSvg(g, 24)).join('')} &nbsp; ${struck
  .map((g) => struckIconSvg(g, 24))
  .join('')} &nbsp; ${struck.map((g) => struckIconSvg(g, 48)).join('')}</div>
<div class="dark">${ICON_IDS.map((id) => iconSvg(id, 24)).join('')}</div>
</body></html>`;

const htmlPath = resolve(outDir, 'icons.html');
writeFileSync(htmlPath, html);

const require = createRequire(import.meta.url);
// Playwright is preinstalled in the environment but is not a project dependency, so type it locally.
interface Pw {
  chromium: {
    launch(): Promise<{
      newPage(o: { viewport: { width: number; height: number } }): Promise<{
        goto(url: string): Promise<unknown>;
        screenshot(o: { path: string; fullPage: boolean }): Promise<unknown>;
      }>;
      close(): Promise<void>;
    }>;
  };
}
const { chromium } = require('playwright') as Pw;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await page.goto(pathToFileURL(htmlPath).href);
await page.screenshot({ path: resolve(outDir, 'icons.png'), fullPage: true });
await browser.close();
console.log('wrote', htmlPath, 'and icons.png');
