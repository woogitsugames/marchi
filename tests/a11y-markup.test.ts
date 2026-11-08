// Accessibility of new UI markup (audit 2026-11-08, D-347). i18n cannot load under tsx, so the modules are read as
// source (as tests/help-map.test.ts); the built page is checked by tools/a11y-audit.mjs (scenes castle16, playtest).
import { readFileSync } from 'node:fs';
import { assert, test } from './harness';

const src = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('a11y: the XVI castle switch is two action buttons, no aria-pressed (its label changes with the state)', () => {
  const castles = src('ui/castles.ts');
  const sw = castles.slice(castles.indexOf('export function castleSwitchHtml'));
  assert(sw.includes('data-act="first:-1"') && sw.includes('data-act="first:${b.id}"'), 'both buttons found');
  assert(!/aria-pressed=/.test(sw), 'no aria-pressed: "Share evenly, pressed" would say the opposite of the state');
  assert(!/castle-switch[^{]*aria-pressed/.test(src('styles/main.css')), 'the stylesheet does not style the switch by aria-pressed');
});

test('a11y: a playtest start is named "<id>: <mission>" plus its tags (S16 decision, fixtures)', () => {
  const pt = src('ui/playtestSheet.ts');
  const fn = pt.slice(pt.indexOf('export function playtestStartHtml'), pt.indexOf('export function playtestSheet'));
  assert(fn.length > 0, 'playtestStartHtml found');
  assert(/const label = \[`\$\{s\.id\}: \$\{missionTitle\(s\.mission\)\}`, \.\.\.tags\]/.test(fn), 'the label joins the tags');
  assert(fn.includes("t('playtest.fixture')") && fn.includes("t('playtest.decision')"), 'both tags');
  assert(fn.includes('aria-label="${esc(label)}"'), 'the button is named by the label');
});
