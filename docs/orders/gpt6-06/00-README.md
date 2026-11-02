# Zlecenia GPT-6 — paczka 06 (MARCHIA — Szlaki Królestwa)

**Repo `woogitsugames/marchi`, gałąź bazowa `claude/eager-cori-08wt8e`** (nie `main`, nie `woogitsu/osadale`).
Każde zlecenie = gałąź `gpt/<nr>-<skrót>` i **PR do bazy** (nie pushuj bezpośrednio na bazę).
Przeczytaj: `CLAUDE.md`, `docs/DESIGN.md`, `docs/DECISIONS.md` (zwł. **D-21, D-26, D-27, D-29, D-30, D-31**),
`docs/design/sandbox.md`, `docs/BACKLOG.md`. Gra jest **darmowa, bez reklam** (D-21/D-29). Tytuł „Marchia” we
wszystkich językach (D-31). Stan symulacji: wersja 5, 10 towarów (wood, planks, grain, flour, bread, fish, stone,
charcoal, malt, beer), budynki m.in. fisher, quarry, charcoalBurner, malthouse, brewery, rangi 0–5.

Zasady wspólne: nie edytuj `src/ui/**`, `src/render/**`, `src/main.ts`, `src/platform/**`, istniejących plików
`src/sim/**` (nowe pliki w `src/sim/proposals/` wolno); teksty PL+EN; zasoby tylko CC0/OFL z wpisem w `docs/ASSETS.md`;
`npm test` i `npm run typecheck` zielone. Opis PR po polsku: co, dlaczego, jak sprawdzić, czego nie zrobiono.

| Nr | Plik | Temat |
|---|---|---|
| 42 | 42-missions-7-9.md | Misje VII–IX na nowych łańcuchach (projekt + dane + boty) |
| 43 | 43-seasons.md | Pory roku w Wolnej dolinie (projekt + czyste funkcje + testy) |
| 44 | 44-valley-events.md | Zdarzenia w dolinie: zamówienia królewskie, jarmarki, kupcy |
| 45 | 45-store-refresh.md | Opisy sklepu i polityka po D-21/D-29 (darmowa, bez reklam, city builder) |
| 46 | 46-audio-chains.md | Dźwięki nowych budynków (CC0) |
| 47 | 47-playtest-v2.md | Protokół playtestu v2 (misje I–VI + dolina) |

Uwaga: paczka 05 (tłumaczenia 143 nowych kluczy) jest osobno: `docs/orders/gpt6-orders-05.zip`.
