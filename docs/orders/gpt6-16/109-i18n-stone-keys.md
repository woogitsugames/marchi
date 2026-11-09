# 109 — Tłumaczenie kluczy D-420 (karta „kamieniołom jeszcze kopie”) — gałąź `gpt/109-i18n-stone-keys`

Cztery klucze z `PENDING_KEYS` (`src/i18n/pl.ts`): `cause.stoneDig`, `cause.stoneComing`, `fix.stoneDig`, `fix.stoneComing`. Dziś mają tylko pl i en; pozostałe języki czytają angielski.
Języki: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi (`src/i18n/<kod>.ts`). Kontekst: D-420..D-422 w `docs/DECISIONS.md`.

**Zrób:** dopisz tłumaczenia 4 kluczy w każdym z 15 języków, zachowaj placeholdery i ICU bez zmian (długość ±20 % względem en). Gdy wszystkie 15 języków ma komplet, usuń te klucze z `PENDING_KEYS`.
**Oddaj:** poprawione `src/i18n/*.ts` i `docs/reviews/i18n-stone-keys.md` (język, klucz, tekst, uwagi). `npm run typecheck`, `npm test`, `npm run build` zielone. **Wypchnij gałąź na GitHub i otwórz PR do bazy `claude/eager-cori-08wt8e`** (nie scalaj sam).
