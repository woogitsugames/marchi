# 106 — Tłumaczenie oczekujących kluczy (D-393, D-410) — gałąź `gpt/106-i18n-pending-keys`

Siedem kluczy z `PENDING_KEYS` (`src/i18n/pl.ts`) ma tylko pl i en; pozostałe języki czytają angielski. Oryginał: `pl.ts`, pomoc: `en.ts`.
15 języków: de, es, fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi (pliki `src/i18n/<kod>.ts`).

**Klucze** (przeczytaj ich teksty w pl.ts/en.ts i kontekst w D-393 i D-410..D-412 w `docs/DECISIONS.md`):
- D-393 (spichlerz, który się napełnia — spokojny stan bez leku): `cause.filling`, `fix.filling`, `cause.granaryFilling`, `fix.granaryFilling`;
- D-410 (budynek odcięty od drogi, przycisk „Rozbierz”): `cause.cutOff`, `fix.cutOff` (placeholder `{name}`), `fix.cutOffWhy`.

**Co zrobić:**
1. Dopisz tłumaczenie każdego klucza w każdym z 15 plików języka (obok sąsiednich kluczy `cause.*` / `fix.*`).
2. W `src/i18n/pl.ts` usuń te klucze z `PENDING_KEYS` dopiero, gdy **wszystkie 15 języków** je mają (wtedy testy `tests/i18n-*.test.ts` je sprawdzą).
3. Zachowaj placeholdery (`{name}`, ICU `plural`) bez zmian. Długość ±20 % względem en (karta mieści ok. 3 zdań przy 915×412).
4. Uwaga: ru/uk — przypadki i liczebniki; tr/ko/ja — szyk zdania z placeholderem; ar — kierunek tekstu; de — długość.
5. Dozwolone ścieżki: `src/i18n/*.ts` (tylko te klucze), `docs/reviews/i18n-pending-keys.md`.

**Oddaj:** poprawione pliki i `docs/reviews/i18n-pending-keys.md` (tabela: język, klucz, tekst, uwagi).
`npm run typecheck`, `npm test` (SUMMARY failed=0) i `npm run build` zielone. Potem **wypchnij gałąź i otwórz PR** (patrz README).
