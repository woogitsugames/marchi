// Verify the bilingual codex against the live simulation definitions and locale dictionaries.
// Run from the repository root: npx tsx tools/codex-check.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as defs from '../src/sim/defs';
import { pl } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { STALL_CODEX } from '../src/content/stallCodex';

type Locale = { pl: string; en: string };
type Ref<T> = { value: T; source: string; conversion?: 'ticksToSeconds' };
type Qty = { good: string; quantity: Ref<number> };
type Recipe = { inputs: Qty[]; outputs: Qty[]; cycle: Ref<number | null> };
type Entry = { id: string; nameKey: string; name: Locale; description: Locale; recipe: Recipe };
type GoodEntry = Entry & { producer: string; wagonLoad: Ref<number>; castleBasePrice: Ref<number> };
type BuildingEntry = Entry & {
  footprint: { width: Ref<number>; height: Ref<number> };
  storage: { inputPerGood: Ref<number>; outputPerGood: Ref<number>; total: Ref<number> };
  constructionPrice: Ref<number>;
  site: { rule: Ref<string | null>; pl: string; en: string; minimumHeightAboveWater?: Ref<number> };
  unlock: { rank: Ref<number | null>; name: Locale };
  stalls: { key: string; fix: Locale }[];
};
type Codex = { schemaVersion: number; goods: GoodEntry[]; buildings: BuildingEntry[] };
const file = fileURLToPath(new URL('../docs/content/codex.json', import.meta.url));
const data = JSON.parse(readFileSync(file, 'utf8')) as Codex;

function fail(message: string): never { throw new Error('codex-check: ' + message); }
function check(value: unknown, message: string): asserts value { if (!value) fail(message); }
function equal(a: unknown, b: unknown, message: string): void {
  if (!Object.is(a, b)) fail(message + ': expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function resolved(source: string): unknown {
  check(source.startsWith('defs.'), 'invalid source: ' + source);
  let current: unknown = defs;
  for (const key of source.slice(5).split('.')) {
    check(current !== null && (typeof current === 'object' || typeof current === 'function'),
      'source path missing: ' + source);
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
function verifyRefs(node: unknown, path = 'codex'): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((item: unknown, i: number) => verifyRefs(item, path + '[' + i + ']'));
    return;
  }
  const obj = node as Record<string, unknown>;
  if (Object.hasOwn(obj, 'source') && Object.hasOwn(obj, 'value')) {
    check(typeof obj.source === 'string', path + ': non-string source');
    const source = obj.source as string;
    if (!source.startsWith('defs.RANKS')) {
      const raw = resolved(source);
      let expected: unknown = raw === undefined ? null : raw;
      if (obj.conversion !== undefined) {
        equal(obj.conversion, 'ticksToSeconds', path + ': unknown conversion');
        check(typeof raw === 'number', path + ': cycle ticks are not numeric');
        expected = raw / defs.TICK_HZ;
      }
      equal(obj.value, expected, path + ' (' + source + ')');
    }
  }
  for (const [key, value] of Object.entries(obj)) verifyRefs(value, path + '.' + key);
}
function checkLocale(entry: Entry, category: 'good' | 'building'): void {
  equal(entry.nameKey, category + '.' + entry.id, 'name key ' + entry.id);
  const key = entry.nameKey as keyof typeof pl;
  check(Object.hasOwn(pl, key) && Object.hasOwn(en, key), 'missing i18n key ' + key);
  equal(entry.name.pl, pl[key], 'PL name ' + entry.id);
  equal(entry.name.en, en[key], 'EN name ' + entry.id);
  for (const lang of ['pl', 'en'] as const) {
    const description = entry.description[lang];
    check(typeof description === 'string' && description.length > 0, 'empty description: ' + entry.id + ' ' + lang);
    check([...description].length <= 160, 'description over 160 chars: ' + entry.id + ' ' + lang);
    check(!/\p{Extended_Pictographic}/u.test(description), 'emoji in ' + entry.id);
  }
}
function checkRecipe(entry: Entry, buildingType: keyof typeof defs.BUILDINGS): void {
  const definition = defs.BUILDINGS[buildingType];
  const rec = definition.recipe;
  for (const direction of ['inputs', 'outputs'] as const) {
    const actual = entry.recipe[direction];
    const expected = defs.GOODS.filter(g => (rec?.[direction][g] ?? 0) > 0);
    equal(actual.map(x => x.good).join(','), expected.join(','),
      'recipe ' + direction + ' keys in ' + entry.id);
    for (const row of actual) {
      equal(row.quantity.source, 'defs.BUILDINGS.' + buildingType + '.recipe.' + direction + '.' + row.good,
        'quantity source in ' + entry.id);
    }
  }
  equal(entry.recipe.cycle.source, 'defs.BUILDINGS.' + buildingType + '.recipe' + (rec ? '.ticks' : ''),
    'cycle source in ' + entry.id);
  if (rec) equal(entry.recipe.cycle.conversion, 'ticksToSeconds', 'cycle conversion in ' + entry.id);
  else equal(entry.recipe.cycle.value, null, 'no recipe in ' + entry.id);
}

check(data.schemaVersion === 1, 'unsupported codex schema');
check(Array.isArray(data.goods) && Array.isArray(data.buildings), 'missing goods or buildings');
equal(data.goods.map(g => g.id).join(','), defs.GOODS.join(','), 'goods coverage and order');
const actualBuildings = data.buildings.map(b => b.id);
const allBuildings = Object.keys(defs.BUILDINGS);
equal(new Set(actualBuildings).size, allBuildings.length, 'duplicate or missing buildings');
equal([...actualBuildings].sort().join(','), allBuildings.sort().join(','), 'building coverage');
verifyRefs(data);
for (const g of data.goods) {
  checkLocale(g, 'good');
  check(defs.GOODS.includes(g.id as (typeof defs.GOODS)[number]), 'unknown good ' + g.id);
  const producer = defs.producerOf(g.id as (typeof defs.GOODS)[number]);
  equal(g.producer, producer, 'producer of ' + g.id);
  check(producer !== null, 'good has no producer: ' + g.id);
  checkRecipe(g, producer);
  equal(g.wagonLoad.source, 'defs.WAGON_CAPACITY_BY_GOOD.' + g.id, 'wagon capacity source ' + g.id);
  equal(g.castleBasePrice.source, 'defs.MARKET.base.' + g.id, 'market price source ' + g.id);
}
for (const b of data.buildings) {
  checkLocale(b, 'building');
  const type = b.id as keyof typeof defs.BUILDINGS;
  const def = defs.BUILDINGS[type];
  check(def, 'unknown building ' + b.id);
  checkRecipe(b, type);
  equal(b.footprint.width.source, 'defs.BUILDINGS.' + type + '.w', 'footprint width source ' + type);
  equal(b.footprint.height.source, 'defs.BUILDINGS.' + type + '.h', 'footprint height source ' + type);
  equal(b.storage.inputPerGood.source, 'defs.BUILDINGS.' + type + '.inCap', 'input cap source ' + type);
  equal(b.storage.outputPerGood.source, 'defs.BUILDINGS.' + type + '.outCap', 'output cap source ' + type);
  equal(b.storage.total.source, 'defs.BUILDINGS.' + type + '.storeCap', 'store cap source ' + type);
  equal(b.constructionPrice.source, 'defs.BUILDINGS.' + type + '.price', 'price source ' + type);
  equal(b.site.rule.source, 'defs.SITE_RULE.' + type, 'site rule source ' + type);
  equal(b.site.rule.value, defs.SITE_RULE[type] ?? null, 'site rule ' + type);
  if (type === 'quarry') {
    check(b.site.minimumHeightAboveWater, 'missing quarry rock height');
    equal(b.site.minimumHeightAboveWater.source, 'defs.QUARRY_MIN_HEIGHT', 'quarry height source');
  } else check(!b.site.minimumHeightAboveWater, 'unexpected rock height ' + type);
  const rank = defs.RANKS.findIndex(r => r.unlocks.includes(type));
  if (rank < 0) {
    equal(type, 'castle', 'unexpected unplaceable building');
    equal(b.unlock.rank.value, null, 'castle rank');
    equal(b.unlock.rank.source, 'defs.RANKS', 'castle rank source');
  } else {
    equal(b.unlock.rank.value, rank, 'unlock rank ' + type);
    equal(b.unlock.rank.source, 'defs.RANKS.' + rank + '.unlocks', 'rank source ' + type);
    const rankKey = ('rank.' + rank) as keyof typeof pl;
    equal(b.unlock.name.pl, pl[rankKey], 'rank name PL ' + type);
    equal(b.unlock.name.en, en[rankKey], 'rank name EN ' + type);
  }
  check(Array.isArray(b.stalls) && b.stalls.length > 0, 'no stall causes ' + type);
  const statusKeys = new Set<string>();
  for (const stall of b.stalls) {
    check(Object.hasOwn(STALL_CODEX, stall.key), 'unknown stall key ' + type + ': ' + stall.key);
    check(!statusKeys.has(stall.key), 'duplicate stall ' + type + ': ' + stall.key);
    statusKeys.add(stall.key);
    check(stall.key.startsWith('status.'), 'not a building status: ' + stall.key);
    if (!def.recipe?.inputs || Object.keys(def.recipe.inputs).length === 0) {
      check(type === 'castle' || !stall.key.startsWith('status.NO_INPUT.'),
        'input-related stall on input-free building ' + type);
    }
    for (const lang of ['pl', 'en'] as const) {
      check(typeof stall.fix[lang] === 'string' && stall.fix[lang].trim().length > 0,
        'missing fix ' + type + ' ' + stall.key + ' ' + lang);
      check([...stall.fix[lang]].length <= 160, 'fix over 160 chars ' + type + ' ' + lang);
    }
  }
}
console.log('codex-check OK: ' + data.goods.length + ' goods, ' + data.buildings.length
  + ' buildings; numeric values, sources, i18n, recipes, rank gates and stall keys match.');
