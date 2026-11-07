// The codex must follow types.ts (including every cause variant), remain bilingual,
// obey mobile text limits, and match the Markdown editorial copy.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { STALL_CODEX, STALL_CODEX_CALM } from '../src/content/stallCodex';
import { TICK_HZ, createWorld, explainBuilding, explainWagon, step } from '../src/sim/index';
import { codexLink, isStallLink, isWagonWait } from '../src/ui/stallKinds';
import { calmWhy, codexCalm, rankStalls } from '../src/ui/stalls';
import { CODEX_SITUATIONS, situationKey, type CodexSituation } from '../src/ui/codexSituations';
import { pl as plDict } from '../src/i18n/pl';
import { en as enDict } from '../src/i18n/en';
import { assert, eq, test } from './harness';

function read(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

function literalValues(node: ts.TypeNode): string[] {
  if (ts.isUnionTypeNode(node)) return node.types.flatMap(literalValues);
  assert(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal),
    'Expected a string literal status/cause type in types.ts');
  return [node.literal.text];
}

function variants(typeName: string): { k: string; cause: string | null }[] {
  const file = ts.createSourceFile('types.ts', read('../src/sim/types.ts'), ts.ScriptTarget.Latest, true);
  const type = file.statements.find((s): s is ts.TypeAliasDeclaration =>
    ts.isTypeAliasDeclaration(s) && s.name.text === typeName);
  assert(type && ts.isUnionTypeNode(type.type), typeName + ' must be a union');
  const results: { k: string; cause: string | null }[] = [];
  for (const variant of type.type.types) {
    assert(ts.isTypeLiteralNode(variant), typeName + ' members must be object literals');
    const field = (name: string): ts.TypeNode | undefined => {
      const match = variant.members.find((m) =>
        ts.isPropertySignature(m) && m.name && ts.isIdentifier(m.name) && m.name.text === name);
      return match && ts.isPropertySignature(match) ? match.type : undefined;
    };
    const k = field('k');
    assert(k, typeName + ' variant is missing k');
    const causes = field('cause');
    for (const value of literalValues(k)) {
      if (!causes) results.push({ k: value, cause: null });
      else for (const cause of literalValues(causes)) results.push({ k: value, cause });
    }
  }
  return results;
}

function expectedKeys(): string[] {
  const buildings = variants('BuildingStatus')
    .map(({ k, cause }) => cause === null ? `status.${k}` : `status.${k}.${cause}`);
  const wagons = variants('WagonStatus').map(({ k, cause }) => {
    assert(cause === null, 'WagonStatus gained a cause; update codex key rules');
    return `wagon.${k}`;
  });
  return [...buildings, ...wagons];
}

function formatLocale(lang: 'pl' | 'en', e: (typeof STALL_CODEX)[string]['pl']): string {
  if (lang === 'pl') return `### PL — ${e.name}\n\n- **Co to znaczy:** ${e.meaning}\n- **Jak sprawdzić:** ${e.check}\n- **Naprawy / działania:**\n${e.fixes.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}\n- **Łańcuch:** ${e.chain}\n\n`;
  return `### EN — ${e.name}\n\n- **Meaning:** ${e.meaning}\n- **How to check:** ${e.check}\n- **Fixes / next steps:**\n${e.fixes.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}\n- **Chain:** ${e.chain}\n\n`;
}

/** Where the fold shows each situational entry (the Markdown heading, D-339). */
const SITUATION_WHERE: Record<CodexSituation, string> = {
  wagonDue: '`status.WAGON_DUE` (D-156)',
  marketFull: 'spichlerz pełny, rynek nasycony / granary full, market saturated (D-174, D-180)',
  surplus: 'nadwyżka / surplus (D-160)',
  postNoRoad: 'posterunek bez drogi / trading post without a road (D-170)',
  castleRival: 'XVI: drugi zamek zabiera towar / the other castle takes the goods (D-291)',
  castleEven: 'XVI: towar dzielony po równo / goods shared evenly (D-290)',
  castleFirst: 'XVI: przełącznik pierwszeństwa włączony / castle-first switch on (D-289)',
  tutorialNoRoad: 'samouczek budowania: chata bez drogi / build tutorial: hut without a road (D-259)',
};

function situationLocale(d: Record<string, string>, sit: CodexSituation): (typeof STALL_CODEX)[string]['pl'] {
  const f = (x: 'name' | 'meaning' | 'check' | 'fix1' | 'fix2' | 'chain'): string => d[situationKey(sit, x)]!;
  return { name: f('name'), meaning: f('meaning'), check: f('check'), fixes: [f('fix1'), f('fix2')], chain: f('chain') };
}

test('stall codex has exactly all BuildingStatus causes and WagonStatus variants', () => {
  const expected = expectedKeys();
  eq(new Set(expected).size, expected.length, 'types.ts defines unique codex variants');
  eq(Object.keys(STALL_CODEX).length, expected.length, 'codex key count');
  for (const key of expected) assert(Object.hasOwn(STALL_CODEX, key), 'Missing codex key: ' + key);
  for (const key of Object.keys(STALL_CODEX)) assert(expected.includes(key), 'Unknown codex key: ' + key);
});

test('each PL/EN codex entry is complete and every mobile field is at most 220 characters', () => {
  for (const [key, entry] of [...Object.entries(STALL_CODEX), ...Object.entries(STALL_CODEX_CALM)]) {
    assert(entry && Object.keys(entry).sort().join(',') === 'en,pl', 'PL/EN missing: ' + key);
    for (const lang of ['pl', 'en'] as const) {
      const e = entry[lang];
      assert(e && Object.keys(e).sort().join(',') === 'chain,check,fixes,meaning,name',
        'Invalid fields: ' + key + ' ' + lang);
      assert(Array.isArray(e.fixes) && e.fixes.length >= 2 && e.fixes.length <= 3,
        'Need 2–3 actions: ' + key + ' ' + lang);
      const fields = [e.name, e.meaning, e.check, ...e.fixes, e.chain];
      for (const [i, value] of fields.entries()) {
        assert(typeof value === 'string' && value.trim().length > 0,
          'Empty field: ' + key + ' ' + lang + ' #' + i);
        assert([...value].length <= 220,
          'Over 220 characters: ' + key + ' ' + lang + ' #' + i);
      }
      assert(/[.!?]$/.test(e.meaning), 'Meaning must be one sentence: ' + key + ' ' + lang);
    }
  }
});

test('Markdown stall codex matches the TypeScript source of truth', () => {
  const header = `# Księga przyczyn / Stall Codex

Teksty do poradnika w grze. Każde pole ma maksymalnie 220 znaków.
Klucze odpowiadają \`BuildingStatus\` / \`WagonStatus\` w \`src/sim/types.ts\`.
Stan \`wagon.NO_ROUTE\` obejmuje również powrót do stajni (\`target = -1\`).
Dla prawidłowych stanów „Naprawy / działania” to działania zapobiegawcze, nie awarie.

`;
  const calmHeader = `# Wersje spokojne / Calm variants

Gdy postój jest spokojny (nadwyżka, której nikt teraz nie potrzebuje, wypełnione zamówienie, kamień już w spichlerzu),
fałda „Co to znaczy?” pokazuje ten wariant zamiast zwykłego wpisu (D-98).

`;
  const situationHeader = `# Wpisy sytuacyjne / Situational entries

Stany, które karta czyta po swojemu (spokojna linia, linia zamku, samouczek), mają własny wpis fałdy
„Co to znaczy?” zamiast wpisu statusu (D-339, \`src/ui/codexSituations.ts\`). Teksty są kluczami i18n
\`codex.s.<wpis>.<pole>\` we wszystkich 17 językach; tu PL i EN.

`;
  const expected = header + Object.entries(STALL_CODEX).map(([key, entry]) =>
    `## \`${key}\`\n\n` + formatLocale('pl', entry.pl) + formatLocale('en', entry.en)).join('') +
    calmHeader + Object.entries(STALL_CODEX_CALM).map(([key, entry]) =>
    `## \`${key}\` — spokojny / calm\n\n` + formatLocale('pl', entry.pl) + formatLocale('en', entry.en)).join('') +
    situationHeader + CODEX_SITUATIONS.map((sit) =>
    `## \`${sit}\` — ${SITUATION_WHERE[sit]}\n\n` + formatLocale('pl', situationLocale(plDict, sit)) + formatLocale('en', situationLocale(enDict, sit))).join('');
  eq(read('../docs/content/stall-codex.md').replace(/\r\n/g, '\n'), expected,
    'Markdown content must stay in sync with src/content/stallCodex.ts');
});

test('audit fix 4: the codex fold explains the last stall of the chain, never a building at work or a moving wagon', () => {
  const key = (l: { kind: 'building' | 'wagon'; status: { k: string; cause?: string } }): string =>
    l.kind === 'wagon' ? `wagon.${l.status.k}` : l.status.cause ? `status.${l.status.k}.${l.status.cause}` : `status.${l.status.k}`;
  let past = 0, wagons = 0;
  for (const id of ['m2', 'm3', 'm11']) {
    const w = createWorld(id);
    while (w.state.mission.result === 'running' && w.state.tick < 12 * 60 * TICK_HZ) {
      step(w);
      if (w.state.tick % 50) continue;
      for (const e of rankStalls(w)) {
        const b = w.state.buildings.find((q) => q.id === e.id)!;
        const chain = explainBuilding(w, b.id, 5, true);
        const l = codexLink(chain, { kind: 'building', id: b.id, status: b.status });
        assert(isStallLink(l), `${id}: codex for a stall, got ${key(l)}`);
        assert(Object.hasOwn(STALL_CODEX, key(l)), 'entry exists: ' + key(l));
        // the old rule took the chain's end, which is often not a stall
        if (!isStallLink(chain[chain.length - 1]!)) past++;
      }
      for (const q of w.state.wagons) {
        if (!isWagonWait(q.status)) continue;
        const chain = explainWagon(w, q.id, 4, true);
        const l = codexLink(chain, { kind: 'wagon', id: q.id, status: q.status });
        assert(isStallLink(l), `${id}: wagon codex for a wait, got ${key(l)}`);
        wagons++;
      }
    }
  }
  assert(past > 20, `chains ending at a non-stall now explained by their last stall (${past})`);
  assert(wagons > 0, `waiting wagons sampled (${wagons})`);
});

test('D-98: calm variants exist only for real codex keys and never advise buying a wagon', () => {
  for (const [key, entry] of Object.entries(STALL_CODEX_CALM)) {
    assert(Object.hasOwn(STALL_CODEX, key), 'calm variant of a known key: ' + key);
    for (const f of entry.pl.fixes) assert(!/^Kup wóz/.test(f!), 'PL calm fix does not say "Kup wóz": ' + f);
    for (const f of entry.en.fixes) assert(!/^Buy a wagon/.test(f!), 'EN calm fix does not say "Buy a wagon": ' + f);
  }
});

test('D-98: a calm OUTPUT_FULL.NO_WAGON (filled order, surplus, stone stored) reads the calm codex; a stall worth a wagon does not', () => {
  let calm = 0, normal = 0;
  for (const id of ['m4', 'm8', 'm9']) {
    const w = createWorld(id);
    while (w.state.mission.result === 'running') {
      step(w);
      if (w.state.tick % 20) continue;
      for (const b of w.state.buildings) {
        if (b.status.k !== 'OUTPUT_FULL' || b.status.cause !== 'NO_WAGON') continue;
        const c = codexCalm(w, { kind: 'building', id: b.id, status: b.status });
        eq(c, calmWhy(w, b) !== null, 'the fold follows the calm line');
        if (c) calm++; else normal++;
      }
    }
  }
  assert(calm > 20, `calm samples (${calm})`);
  assert(normal > 0, `samples still worth a wagon (${normal})`);
});
