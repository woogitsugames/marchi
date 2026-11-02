// Intl formatting per language (D-45): grouping, percent sign, durations and the 24 h clock; Latin digits.
import { fmtDayTime, fmtDuration, fmtInt, fmtPercent, fmtRatio, setFmtLang } from '../src/ui/fmt';
import { assert, eq, test } from './harness';

const strip = (s: string) => s.replace(/[‎‏؜⁨⁩]/g, ''); // bidi marks Intl may add in ar

const CASES: { lang: string; int: string; big: string; pct: string; day: string }[] = [
  { lang: 'en', int: '12,345', big: '1,234,567', pct: '90%', day: '06:05' },
  { lang: 'de', int: '12.345', big: '1.234.567', pct: '90 %', day: '6:05' },
  { lang: 'hi', int: '12,345', big: '12,34,567', pct: '90%', day: '06:05' },
  { lang: 'ar', int: '12,345', big: '1,234,567', pct: '90%', day: '06:05' },
];

test('fmt: numbers, percents, durations and times of day follow the language (Latin digits)', () => {
  for (const c of CASES) {
    setFmtLang(c.lang);
    eq(strip(fmtInt(12345)), c.int, `${c.lang} int`);
    eq(strip(fmtInt(1234567)), c.big, `${c.lang} grouping`);
    eq(strip(fmtPercent(0.9)).replace(/ | /g, ' '), c.pct, `${c.lang} percent`);
    eq(strip(fmtDuration(65)), '1:05', `${c.lang} duration`);
    eq(strip(fmtDuration(3725)), '1:02:05', `${c.lang} long duration`);
    eq(strip(fmtDayTime((6 * 60 + 5) / 1440)), c.day, `${c.lang} time of day`);
    eq(strip(fmtRatio(17, 200)), '17/200', `${c.lang} ratio`);
    assert(/^[0-9.,:%   /]+$/.test(strip(fmtInt(1234567) + fmtPercent(0.5) + fmtDuration(99))), `${c.lang}: Latin digits only`);
  }
  setFmtLang('pl');
  eq(fmtInt(12345).replace(/ /g, ' '), '12 345', 'pl int (cache dropped on the language change)');
});
