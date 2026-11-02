# 48 — Tłumaczenia paczka 06 (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/48-i18n-06`. Klucze do przetłumaczenia: **wszystkie wymienione w `PENDING_KEYS` w `src/i18n/pl.ts`**
(ok. 24: `menu.m7`–`menu.m9` z podtytułami, pory roku, roztopy, jarmark, ostrzeżenia `nextChange`).
Źródło znaczenia: `pl.ts` (oryginał) + `en.ts`. Języki: de, fr, es, it, pt_BR, nl, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi.
- Edytuj tylko `src/i18n/<lang>.ts` (+ glosariusze `docs/i18n/`); NIE edytuj `pl.ts`, `en.ts`, `index.ts`, `tests/i18n-keys.ts`.
- Kolejność kluczy jak w `pl.ts`; placeholdery `{n}`, `{rank}`, `{time}` itd. bez zmian; bloki `{n, plural, …}` z
  kategoriami właściwymi dla języka (Intl.PluralRules).
- Pory roku i nazwy zjawisk: spójnie z glosariuszem (zima/roztopy/jarmark); ton: kasztelański, rzeczowy, bez emoji.
- Długość: tytuły misji ≤ 28 znaków, podtytuły ≤ 48 (mieszczą się na 412 px szerokości).
- W PR podaj listę kluczy i dla każdego języka uwagi (np. skróty). NIE usuwaj kluczy z PENDING_KEYS — zrobi to integrator.
