# 57 — Tłumaczenia, paczka 07 (15 języków) — gałąź `gpt/57-i18n-07`

Klucze z `PENDING_KEYS` w `src/i18n/pl.ts` (stan na wysłanie paczki — 13 kluczy; jeśli w chwili pracy jest ich
więcej, przetłumacz wszystkie z listy): `demolish.confirm`, `err.NO_STONE.coming`, `err.NO_STONE.mining`,
`err.NO_STONE.noQuarry`, `why.waitsCustomer`, `status.NO_INPUT.CONTESTED.to`, `road.stone`, `why.stoneReserve`,
`why.stoneAll`, `save.inProgress`, `save.unfinished`, `save.confirmFresh`, `save.confirmRestart`.
Języki: de, fr, es, it, pt_BR, nl, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi. Źródło znaczenia: `pl.ts`,
placeholdery i bloki `{n, plural, …}` jak w `en.ts`.
**Ważne (błąd z paczki 06):** tłumacz **aktualną** wersję z bazy po `git fetch` — w paczce 06 `season.when` zostało
przetłumaczone ze starej wersji („dzień {day}” zamiast „rok {year}”).
Kolejność kluczy w każdym słowniku = kolejność z `pl.ts` (narzędzie: `npx tsx tools/i18n-reorder.ts --write`).
Po tłumaczeniu usuń przetłumaczone klucze z `PENDING_KEYS`. Testy `tests/i18n-*.test.ts` zielone.
