# 108 — Przegląd list kasztelana XIV–XV — gałąź `gpt/108-i18n-review-lists-xiv-xv`

Zostały otwarte tylko **listy** (D-210, D-212) we wszystkich 15 językach (klucze `menu.m14*`, `menu.m15*`, `*.unwanted` są już przejrzane: `docs/reviews/i18n-66-105-latin.md`, `-other.md`).
Języki: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi. Listy w `src/content/letters.ts` (misje XIV i XV), kontekst `docs/missions/` i D-210..D-212.

**Zadanie:** sprawdź naturalność, rejestr (kasztelan pisze do gracza uprzejmie, średniowieczny ton bez archaizmów utrudniających zrozumienie), zgodność liczb i nazw towarów ze słownikiem w `docs/i18n/`, długość ±20 % względem en. Popraw tylko listy XIV–XV.

**Oddaj:** poprawiony `src/content/letters.ts` (tylko te listy) i `docs/reviews/i18n-lists-xiv-xv.md` (język, fragment, było → jest, powód). `npm run typecheck`, `npm test`, `npm run build` zielone. Wypchnij gałąź i otwórz PR do bazy.
