# Zlecenia GPT-6 — paczka 03 (MARCHIA — Szlaki Królestwa)

## Repozytorium
- **GitHub: `woogitsugames/marchi`** — https://github.com/woogitsugames/marchi
- **Gałąź bazowa: `claude/eager-cori-08wt8e`** (NIE `main`). Sklonuj: `git clone -b claude/eager-cori-08wt8e https://github.com/woogitsugames/marchi`
- Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>` i osobny PR **do `claude/eager-cori-08wt8e`**.
- Brak możliwości pushowania → oddaj ZIP z plikami w strukturze repo + `INTEGRACJA.md`.
- To NIE jest repo `woogitsu/osadale` (tamto to inna gra; z niego pochodzi tylko muzyka).

## Przeczytaj najpierw (wiążące)
`CLAUDE.md`, `docs/DESIGN.md`, `docs/ART_DIRECTION.md`, `docs/UI_STYLE.md`, `docs/DECISIONS.md`, `docs/BACKLOG.md`.
Gra: średniowieczna logistyka na telefony; filar = **diagnozowanie przestojów** (każdy przestój ma przyczynę
czytelną jednym dotknięciem w < 30 s). Kontrakty 5–12 min. Bez walki, dyplomacji, multiplayera, life-simu.

## Zasady wspólne
- **Nie edytuj** (trwają równoległe prace): `src/sim/**` (poza nowymi plikami, jeśli zlecenie wprost pozwala),
  `src/render/**`, `src/ui/**`, `src/main.ts`, `src/i18n/pl.ts`, `src/i18n/en.ts`, `android/**`, `public/assets/textures/**`.
- Kod i komentarze po angielsku; teksty dla gracza PL + EN; komunikacja w PR po polsku.
- Zasoby z zewnątrz: tylko CC0/OFL (lub własne), każdy plik w `docs/ASSETS.md` (źródło, autor, licencja, link, zmiany).
- Przed PR: `npm ci && npm test && npm run typecheck` (zielone). Nowe testy: `tests/*.test.ts` przez `tests/harness.ts`.
- Bez kopiowania nazw/grafik/UI z innych gier — tylko mechaniki.
- Opis PR: co, dlaczego, jak sprawdzić, zrzuty jeśli dotyczy, czego nie zrobiono.

## Zlecenia w tej paczce
| Nr | Plik | Temat |
|---|---|---|
| 11 | 11-playtest-protocol.md | Protokół playtestu „< 30 s” (ponowienie 08) |
| 12 | 12-mission-4.md | Misja IV „Zima na przeprawie” — projekt + dane + bot |
| 13 | 13-mission-5.md | Misja V „Jarmark” — fale popytu — projekt + dane + bot |
| 14 | 14-mission-6.md | Misja VI „Ciasny spichlerz” — projekt + dane + bot |
| 15 | 15-missions-json.md | Format misji jako dane JSON + walidacja + loader |
| 16 | 16-stall-codex.md | „Księga przyczyn” — treści PL/EN dla każdej przyczyny przestoju |
| 17 | 17-contract-letters.md | Listy od kasztelana — fabularne teksty kontraktów PL/EN |
| 18 | 18-audio-recordings-2.md | Nagrania CC0: turkot wozu, siekiera, piła, koń, młyn |
| 19 | 19-icon-v3.md | Ikona aplikacji v3 (litera w Grenze Gotisch, kreskowanie) |
| 20 | 20-store-graphics.md | Grafika do sklepów: feature graphic, ramki zrzutów |
| 21 | 21-store-screenshots-tool.md | Narzędzie do zrzutów sklepowych (Playwright) |
| 22 | 22-device-bench.md | Strona benchmarku na telefon (FPS/pamięć 50/100/200 wozów) |
| 23 | 23-translations-de-fr.md | Tłumaczenia DE i FR (nowe pliki) |
| 24 | 24-accessibility-audit.md | Audyt dostępności (daltonizm, kontrast, rozmiary) |
| 25 | 25-billing-design.md | Projekt pełnej wersji: Google Play Billing / StoreKit (dokument + szkic modułu) |
| 26 | 26-balance-grid.md | Narzędzie do siatkowego balansu misji |
