// The codex must follow types.ts (including every cause variant), remain bilingual,
// obey mobile text limits, and match the Markdown editorial copy.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { STALL_CODEX } from '../src/content/stallCodex';
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

test('stall codex has exactly all BuildingStatus causes and WagonStatus variants', () => {
  const expected = expectedKeys();
  eq(new Set(expected).size, expected.length, 'types.ts defines unique codex variants');
  eq(Object.keys(STALL_CODEX).length, expected.length, 'codex key count');
  for (const key of expected) assert(Object.hasOwn(STALL_CODEX, key), 'Missing codex key: ' + key);
  for (const key of Object.keys(STALL_CODEX)) assert(expected.includes(key), 'Unknown codex key: ' + key);
});

test('each PL/EN codex entry is complete and every mobile field is at most 220 characters', () => {
  for (const [key, entry] of Object.entries(STALL_CODEX)) {
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
  const expected = header + Object.entries(STALL_CODEX).map(([key, entry]) =>
    `## \`${key}\`\n\n` + formatLocale('pl', entry.pl) + formatLocale('en', entry.en)).join('');
  eq(read('../docs/content/stall-codex.md').replace(/\r\n/g, '\n'), expected,
    'Markdown content must stay in sync with src/content/stallCodex.ts');
});
