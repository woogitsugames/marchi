# 107 — Przegląd tłumaczeń misji XVII — gałąź `gpt/107-i18n-review-xvii`

Przegląd natywny tłumaczeń agenta (D-356..D-359, `docs/missions/m17.md`). 15 języków: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi. Oryginał: `pl.ts`, pomoc: `en.ts`.

**Zakres:** listy misji XVII (`src/content/letters.ts`, `m17`) oraz 22 klucze: `status.NO_INPUT.CHAIN_FIRST*`, `cause.NO_INPUT.CHAIN_FIRST`, `castle.for.*`, `castle.chain*`, `castle.splitChainAfter`, `castle.splitEvenChain`, `fix.castleChain*`, `fix.castleLegNote`, `hud.castleChain`, `menu.m17*`, `codex.s.castleChain.*`.

**Zwróć uwagę:** `castle.chainRival` — szyk i odmiana w ru/uk/tr/ko/ja, liczba mnoga `{input}` w fr/es/it/pt_BR/nl; ar — liczba mnoga i kierunek tekstu z liczbami; długość ±20 % względem en. Placeholdery i ICU bez zmian.

**Oddaj:** poprawione `src/i18n/*.ts` i `src/content/letters.ts` (tylko te klucze/listy), `docs/reviews/i18n-xvii.md` (język, klucz, było → jest, powód). `npm run typecheck`, `npm test`, `npm run build` zielone. Wypchnij gałąź i otwórz PR do bazy (patrz README).
