// Vite's import.meta.glob is unavailable under Node/tsx, so inspect the authored TS
// literals without importing the game's i18n runtime. The compiler verifies the
// Record<Lang, ContractLetterSet> type separately.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';
import { assert, test } from './harness';

const root = fileURLToPath(new URL('..', import.meta.url));
function source(path: string): ts.SourceFile {
  const text = readFileSync(root + '/' + path, 'utf8');
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function initializer(file: ts.SourceFile, name: string): ts.Expression {
  for (const stmt of file.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer) {
        let expr = decl.initializer;
        while (ts.isSatisfiesExpression(expr) || ts.isAsExpression(expr)) expr = expr.expression;
        return expr;
      }
    }
  }
  throw new Error(`missing constant ${name}`);
}
function prop(obj: ts.ObjectLiteralExpression, key: string): ts.Expression {
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const name = p.name;
    if ((ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) && name.text === key) {
      return p.initializer;
    }
  }
  throw new Error(`missing object property ${key}`);
}
function object(expr: ts.Expression, label: string): ts.ObjectLiteralExpression {
  assert(ts.isObjectLiteralExpression(expr), `${label}: expected an object literal`);
  return expr;
}
function string(expr: ts.Expression, label: string): string {
  assert(ts.isStringLiteral(expr), `${label}: expected a string literal`);
  return expr.text;
}
function validate(phase: string, value: string, max: number, mission: string, lang: string): void {
  assert(value.trim().length > 0, `missing ${mission}/${lang}/${phase}`);
  assert(value.length <= max, `over budget ${mission}/${lang}/${phase}: ${value.length} > ${max}`);
  assert(value.includes('\n— Wszebor'), `missing signed newline ${mission}/${lang}/${phase}`);
  if (lang === 'ar') {
    assert(!/[\u202a-\u202e\u2066-\u2069]/.test(value),
      `manual direction control in ${mission}/${lang}/${phase}`);
  }
}

const langsExpr = initializer(source('src/i18n/index.ts'), 'LANGS');
assert(ts.isArrayLiteralExpression(langsExpr), 'LANGS must be a literal tuple');
const langs = langsExpr.elements.map((x) => string(x, 'LANGS member'));
const letters = object(initializer(source('src/content/letters.ts'), 'CONTRACT_LETTERS'), 'CONTRACT_LETTERS');
const missions = Array.from({ length: 17 }, (_, i) => 'm' + (i + 1));

test('all missions have five signed letters in every supported language, within 400/200 characters', () => {
  assert(letters.properties.length === 17, 'unexpected number of contract missions');
  assert(langs.length === 17, 'unexpected number of supported languages');
  for (const mission of missions) {
    const byLang = object(prop(letters, mission), mission);
    assert(byLang.properties.length === langs.length, `unexpected locales in ${mission}`);
    for (const lang of langs) {
      const label = mission + '/' + lang;
      const byPhase = object(prop(byLang, lang), label);
      const opening = string(prop(byPhase, 'opening'), label + '/opening');
      validate('opening', opening, 400, mission, lang);
      const won = object(prop(byPhase, 'won'), label + '/won');
      for (const seal of ['1', '2', '3']) {
        validate('won.' + seal, string(prop(won, seal), label + '/won.' + seal), 200, mission, lang);
      }
      validate('lost', string(prop(byPhase, 'lost'), label + '/lost'), 200, mission, lang);
      if (mission === 'm1') {
        assert(lang === 'pl' ? opening.includes('Łozinnego Brodu') : opening.includes('Łozinny Bród'), `place name changed: ${label}`);
        for (const n of ['30', '20']) assert(opening.includes(n), `missing ${n}: ${label}`);
      }
      if (mission === 'm13') {
        for (const n of ['24', '16', '10:00']) assert(opening.includes(n), `missing ${n}: ${label}`);
      }
      // D-210: the order and its times as registered (30 charcoal by 14:00; 30 grain by 5:30, 40 wood by 8:30, 12:00)
      if (mission === 'm14') {
        for (const n of ['30', '14:00']) assert(opening.includes(n), `missing ${n}: ${label}`);
      }
      if (mission === 'm15') {
        for (const n of ['30', '40', '5:30', '8:30', '12:00']) assert(opening.includes(n), `missing ${n}: ${label}`);
      }
      // D-288: the two castles' orders and times (24 planks by 5:00, 30 by 9:00, everything by 12:00)
      if (mission === 'm16') {
        for (const n of ['24', '30', '5:00', '9:00', '12:00']) assert(opening.includes(n), `missing ${n}: ${label}`);
      }
      // D-356: the two castles' goods and times (24 planks by 5:30, 6 charcoal by 8:00, everything by 12:00)
      if (mission === 'm17') {
        for (const n of ['24', '6', '5:30', '8:00', '12:00']) assert(opening.includes(n), `missing ${n}: ${label}`);
      }
      if (mission === 'm12') {
        for (const n of ['40', '48', '32', '6:00', '8', '12', '9:00', '36', '12:00']) {
          assert(opening.includes(n), `missing ${n}: ${label}`);
        }
      }
    }
  }
});
