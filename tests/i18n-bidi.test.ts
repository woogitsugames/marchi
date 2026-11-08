// Number parameters in right-to-left messages are isolated by t() itself (D-340): signs and percent go inside the
// isolate, marks written by the translator are not doubled, names are never wrapped (Arabic joining).
import { assert, eq, test } from './harness';
import { isNumberParam, isolateNumberParams } from '../src/i18n/bidi';
import { ar } from '../src/i18n/ar';

const F = '⁨';
const P = '⁩';

test('bidi: number parameters get FSI/PDI, signs and percent inside', () => {
  eq(isolateNumberParams('حتى {time}', { time: '3:30' }), `حتى ${F}{time}${P}`, 'isolated');
  eq(isolateNumberParams('في الطريق: +{n}', { n: 2 }), `في الطريق: ${F}+{n}${P}`, 'isolated');
  eq(isolateNumberParams('({cost}−)', { cost: 30 }), `(${F}{cost}${P}−)`, 'isolated');
  eq(isolateNumberParams('شراء −{price}', { price: '30' }), `شراء ${F}−{price}${P}`, 'isolated');
  eq(isolateNumberParams('{pct}% من السرعة', { pct: 90 }), `${F}{pct}%${P} من السرعة`, 'isolated');
  eq(isolateNumberParams('{have}/{need} ألواح', { have: 3, need: 30 }), `${F}{have}/{need}${P} ألواح`, 'isolated');
});

test('bidi: existing marks, names and iso() values are left alone', () => {
  eq(isolateNumberParams(`حتى ${F}{time}${P}`, { time: '3:30' }), `حتى ${F}{time}${P}`, 'isolated');
  eq(isolateNumberParams(`${F}+{n}${P}`, { n: 2 }), `${F}+{n}${P}`, 'isolated');
  eq(isolateNumberParams('للـ{good} {n}', { good: 'دقيق', n: 4 }), `للـ{good} ${F}{n}${P}`, 'isolated');
  assert(!isNumberParam('المخبز'), 'Arabic name is not a number');
  assert(!isNumberParam('Pixel 7'), 'Latin name is not a number');
  assert(!isNumberParam(`${F}3${P}`), 'an iso() value is already isolated');
  assert(!isNumberParam('\u0000n\u0000'), 'a tHtml marker is not a number');
  assert(isNumberParam('−30') && isNumberParam('1:30') && isNumberParam(7), 'numbers, prices and times are');
});

test('bidi: every Arabic message stays balanced with number parameters', () => {
  let n = 0;
  for (const [key, raw] of Object.entries(ar as Record<string, string>)) {
    const names = [...new Set([...raw.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
    if (!names.length) continue;
    const params = Object.fromEntries(names.map((k) => [k, 5]));
    const s = isolateNumberParams(raw, params);
    const open = s.split(/[⁦-⁨]/).length - 1;
    const close = s.split(P).length - 1;
    eq(open, close, `${key}: isolates balanced`);
    assert(!s.includes(F + F) && !s.includes(P + P), `${key}: no doubled isolate`);
    n++;
  }
  assert(n > 100, `checked ${n} Arabic messages with parameters`);
});
