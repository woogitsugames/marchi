# Tłumaczenia — paczka uzupełnień (wygenerowana: `npx tsx tools/i18n-coverage.ts --pack docs/i18n/pending-pack`)

Klucze: **177** (wszystkie z `PENDING_KEYS` w `src/i18n/pl.ts` + brakujące poza nią). Lista z oryginałem PL,
angielskim i limitem długości: `keys.json` (pole `missing` = języki, którym brakuje klucza).
Grupy: `wagon.*` 3, `fix.*` 4, `events.*` 95, `err.*` 2, `chron.*` 66, `contract.*` 3, `build.*` 1, `diag.*` 3.
Języki: ar, de, es, fr, hi, it, ja, ko, nl, pt_BR, ru, sv, tr, uk, zh_Hans.

- Edytuj tylko `src/i18n/<lang>.ts` (+ glosariusze `docs/i18n/glossary-<lang>.md`); NIE edytuj `pl.ts`, `en.ts`, `index.ts`, `tests/i18n-keys.ts`.
- Kolejność kluczy jak w `pl.ts`; placeholdery `{n}`, `{good}`, `{time}` itd. bez zmian; bloki `{n, plural, …}` z kategoriami
  właściwymi dla języka (Intl.PluralRules; `tests/i18n-plural` sprawdza każdy blok).
- `maxChars` to budżet układu (dłuższy z PL/EN + 40 %, jak `?lang=pseudo`); notatki samouczka ≤ 140 znaków.
- Ton: kasztelański, rzeczowy, bez emoji; nazwy zjawisk zgodnie z glosariuszem.
- Sprawdzenie: `npx tsx tools/i18n-coverage.ts` (kolumna „placeholder!” = 0), `npm test`, `npm run layout -- --quick`.
- NIE usuwaj kluczy z `PENDING_KEYS` — zrobi to integrator, gdy wszystkie języki je mają.
