// Help from the map (D-254): the building, wagon and market cards carry a "?" into the help sheet on their own
// topic; menus and the help sheet itself do not. (i18n cannot load under tsx, so the modules are read as source.)
import { readFileSync } from 'node:fs';
import { assert, eq, test } from './harness';

const src = (f: string) => readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8');

test('help from the map: every card kind opens a real help topic', () => {
  const ids = [...src('help.ts').matchAll(/\{ id: '(\w+)', icon:/g)].map((m) => m[1]);
  eq(ids.length, 7, 'seven help topics');
  assert(ids.includes('castles'), 'Several castles (D-344)');
  const map = /HELP_TOPIC_OF_KIND[^{]*\{([^}]*)\}/.exec(src('sheets.ts'))?.[1] ?? '';
  const pairs = [...map.matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]] as const);
  eq(pairs.map(([k]) => k).sort().join(','), 'building,market,wagon', 'game cards only');
  for (const [kind, topic] of pairs) assert(ids.includes(topic), `${kind} -> ${topic}`);
});

test('help from the map: the app wires the sheet stack to the help sheet', () => {
  assert(/sheets\.onHelp = \(topic\) => this\.sheets\.open\(helpSheet\(topic\)\)/.test(src('app.ts')), 'onHelp wired');
});

test('help from the map: a two-castle castle card opens "Several castles" (D-344)', () => {
  const panels = src('panels.ts');
  assert(/helpTopic\(\) \{[^}]*twoCastleOrder\(nav\.world, b\) \? 'castles' : undefined/.test(panels), 'building card picks castles on a two-castle castle');
  const sheets = src('sheets.ts');
  assert(sheets.includes("content.helpTopic?.() ?? HELP_TOPIC_OF_KIND[kind]"), 'open() asks the content first');
  assert(sheets.includes("sheet.content.helpTopic?.() ?? HELP_TOPIC_OF_KIND["), 'the "?" press asks the content first');
});
