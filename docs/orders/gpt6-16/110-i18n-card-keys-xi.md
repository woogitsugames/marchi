# 110 — Tłumaczenie kluczy kart zastojów z 10–11 XI — gałąź `gpt/110-i18n-card-keys`

Klucze z `PENDING_KEYS` (`src/i18n/pl.ts`) dodane po zleceniu 109: `status.STORAGE_FULL.filling`, `why.full.storeFilling` (D-454), `cause.stoneWagon`, `fix.stoneWagon`, `cause.yardRoom` (D-591/592), `deadEnd.noSource`, `fix.producerMissing` (D-613/615), `cause.stoneYard`, `fix.stoneYard` (D-633), `deadEnd.noSilver`, `deadEnd.late` (D-638/639). Dziś mają tylko pl i en; pozostałe języki czytają angielski.
Języki: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi (`src/i18n/<kod>.ts`). Kontekst: `docs/DECISIONS.md` (numery D- jak wyżej).

**Zrób:** dopisz tłumaczenia tych kluczy w każdym z 15 języków; zachowaj placeholdery i ICU bez zmian (długość ±20 % względem en; karty mają mało miejsca). Gdy wszystkie 15 języków ma komplet danego klucza, usuń go z `PENDING_KEYS`.
**Oddaj:** poprawione `src/i18n/*.ts` i `docs/reviews/i18n-card-keys-xi.md` (język, klucz, tekst, uwagi). `npm run typecheck`, `npm test`, `npm run build` zielone. **Wypchnij gałąź na GitHub i otwórz PR do bazy `claude/eager-cori-08wt8e`** (nie scalaj sam).
