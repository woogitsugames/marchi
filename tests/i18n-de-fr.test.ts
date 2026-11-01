// Translation contract tests: source keys, runtime parameters and mobile action labels.
import { test, assert, eq } from './harness';
import { pl, type Dict, type MessageKey } from '../src/i18n/pl';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import { fr } from '../src/i18n/fr';

const locales: ReadonlyArray<readonly [string, Dict]> = [['de', de], ['fr', fr]];
const sourceKeys = Object.keys(pl).sort() as MessageKey[];

const PLURAL_BLOCK = /\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g;

/** ICU-lite plural blocks (D-18) count as their {name} placeholder. */
function flattenPlurals(value: string): string {
  return value.replace(PLURAL_BLOCK, (_m, name: string) => '{' + name + '}');
}

function params(value: string): string[] {
  return [...new Set([...flattenPlurals(value).matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((m) => m[1]!))].sort();
}

// {cells} is the PL/EN count word; a language that uses a plural block on {n} instead may drop it.
const OPTIONAL_PARAMS = new Set(['cells']);
// Any case form of the good may be used (goodGen/goodAcc are Polish case helpers).
const GOOD_FORMS = new Set(['good', 'goodGen', 'goodAcc']);
function required(value: string): string[] {
  return [...new Set(params(value).filter((p) => !OPTIONAL_PARAMS.has(p)).map((p) => GOOD_FORMS.has(p) ? 'good' : p))].sort();
}

// Every parameter below is supplied by the UI (format.ts, menu.ts, panels.ts,
// hud.ts, roadTool.ts, app.ts). The three "good" variants are all supplied by
// buildingStatusText(), even when a particular language uses only one of them.
const sampleParams: Record<string, string | number> = {
  good: 'Brot', goodGen: 'Brot', goodAcc: 'Brot', wagon: 12,
  blocker: 14, target: 'Burg', id: 3, pct: 55, time: '1:30',
  grade: 15, max: 14, need: 40, have: 10, n: 30,
  what: 'I. Brot und Bretter', q: 'Hoch', cells: 'Felder',
};

test('DE and FR contain exactly all source-language keys', () => {
  for (const [locale, dict] of locales) {
    const keys = Object.keys(dict).sort();
    eq(keys.length, sourceKeys.length, locale + ': number of keys');
    eq(JSON.stringify(keys), JSON.stringify(sourceKeys), locale + ': exact key set');
    for (const key of sourceKeys) {
      assert(typeof dict[key] === 'string' && dict[key].trim().length > 0,
        locale + ': empty translation at ' + key);
    }
  }
});

test('DE and FR preserve the EN placeholders for each message key', () => {
  for (const [locale, dict] of locales) {
    for (const key of sourceKeys) {
      eq(JSON.stringify(required(dict[key])), JSON.stringify(required(en[key])),
        locale + ': placeholders at ' + key);
      for (const p of params(dict[key])) {
        assert(GOOD_FORMS.has(p) || params(en[key]).includes(p), locale + ': extra placeholder {' + p + '} at ' + key);
      }
    }
  }
});

test('every DE/FR placeholder can be interpolated by the current UI', () => {
  for (const [locale, dict] of locales) {
    for (const key of sourceKeys) {
      const rendered = flattenPlurals(dict[key]).replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g,
        (_match, name: string) => {
          assert(Object.hasOwn(sampleParams, name), locale + ': unknown UI parameter {' + name + '} at ' + key);
          return String(sampleParams[name]);
        });
      assert(!/\{[A-Za-z][A-Za-z0-9]*\}/.test(rendered),
        locale + ': unsubstituted parameter at ' + key);
    }
  }
});

test('building status parameters match the values supplied by buildingStatusText()', () => {
  const allowed = new Set(['good', 'goodGen', 'goodAcc', 'wagon']);
  const withGoods = [
    'status.NO_INPUT.NONE_AVAILABLE', 'status.NO_INPUT.UNREACHABLE',
    'status.WAITING_DELIVERY', 'status.NO_WAGON.ALL_BUSY',
    'status.NO_WAGON.NONE_CAN_REACH', 'status.OUTPUT_FULL.NO_WAGON',
    'status.OUTPUT_FULL.NO_DESTINATION', 'status.WAITING_PICKUP',
  ] as const;
  for (const [locale, dict] of locales) {
    for (const key of withGoods) {
      for (const name of params(dict[key])) {
        assert(allowed.has(name), locale + ': unsupported status parameter {' + name + '} at ' + key);
      }
    }
  }
});

// Tests action labels, not the separate descriptive subtitles in the
// multi-line mission cards, long diagnostics or screen-reader hints.
const actionKeys: MessageKey[] = [
  'menu.continue', 'menu.contract', 'menu.sandbox', 'menu.settings',
  'menu.m1', 'menu.m2', 'menu.m3', 'menu.resume', 'menu.toMenu',
  'menu.restart', 'menu.saveBrokenNew', 'menu.on', 'menu.off',
  'menu.music', 'menu.effects', 'quality.high', 'quality.low',
  'quality.auto', 'quality.ultra', 'sheet.close',
  'wagon.sell', 'wagon.follow', 'wagon.unfollow',
  'tool.road', 'tool.cobble', 'tool.demolish', 'tool.wagon',
  'tool.overlay', 'tool.inspect', 'tool.menu',
  'speed.pause', 'speed.x1', 'speed.x2', 'speed.x4',
  'contract.again', 'contract.menu', 'lang.pl', 'lang.en',
];

test('DE and FR action button labels fit within 28 characters', () => {
  for (const [locale, dict] of locales) {
    for (const key of actionKeys) {
      // 4 digits are deliberately more than the standard wagon sale price.
      const value = dict[key].replace(/\{n\}/g, '9999');
      const length = [...value].length;
      assert(length <= 28, locale + ': ' + key + ' has ' + length + ' characters: ' + value);
    }
  }
});

test('DE and FR plural blocks are well-formed and pick the right form', () => {
  for (const [locale, dict] of locales) {
    for (const key of sourceKeys) {
      const v = dict[key];
      if (!v.includes(', plural,')) continue;
      assert(!v.replace(PLURAL_BLOCK, '').includes(', plural,'), locale + ': malformed plural block at ' + key);
      for (const m of v.matchAll(PLURAL_BLOCK)) {
        assert(/(^|\s)other\s*\{/.test(m[2]!), locale + ': plural block without other at ' + key);
      }
    }
  }
  const pick = (lang: string, value: string, n: number) => value.replace(PLURAL_BLOCK, (_m, _name, body: string) => {
    const branches = new Map([...body.matchAll(/(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g)].map((b) => [b[1]!, b[2]!]));
    return (branches.get(new Intl.PluralRules(lang).select(n)) ?? branches.get('other')!).split('#').join(String(n));
  });
  eq(pick('de', de['road.cells'], 1), '1 Feld', 'de one');
  eq(pick('de', de['road.cells'], 5), '5 Felder', 'de other');
  eq(pick('fr', fr['contract.stars'], 1), '1 sceau sur 3', 'fr one');
  eq(pick('fr', fr['contract.stars'], 3), '3 sceaux sur 3', 'fr other');
});
