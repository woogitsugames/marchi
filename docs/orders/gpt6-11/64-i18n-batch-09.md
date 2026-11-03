# 64 — Tłumaczenia, paczka 09 (15 języków) — gałąź `gpt/64-i18n-09`

Wszystkie klucze z `PENDING_KEYS` w `src/i18n/pl.ts` (ok. 178 w chwili wysłania: zdarzenia doliny `events.*`,
kronika `chron.*`, korek na moście `wagon.BRIDGE_JAM.*`, naprawa `fix.*`, kamienie milowe kontraktu
`contract.half/twoMin/lastMin`, `build.costRoad`, HUD i in.). Języki: de, fr, es, it, pt_BR, nl, sv, tr, ru, uk,
ja, ko, zh_Hans, ar, hi (arabski ma część — uzupełnij brakujące).
Pomoc: `npx tsx tools/i18n-coverage.ts` (raport pokrycia i generator paczki), `?lang=pseudo` i
`npm run layout -- --quick --lang=de` do sprawdzenia długości. Placeholdery i `{n, plural, …}` jak w `en.ts`.
Tłumacz aktualną wersję po `git fetch`. Kolejność kluczy jak w `pl.ts` (`npx tsx tools/i18n-reorder.ts --write`).
Usuń przetłumaczone klucze z `PENDING_KEYS`. Testy `tests/i18n-*.test.ts` zielone.
