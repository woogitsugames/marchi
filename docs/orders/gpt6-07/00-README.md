# Zlecenia GPT-6 — paczka 07 (MARCHIA — Szlaki Królestwa)

**Repo `woogitsugames/marchi`, gałąź bazowa `claude/eager-cori-08wt8e`** (nie `main`, nie `woogitsu/osadale`).
Zrób `git fetch` — baza poszła do przodu: stan symulacji **v6**, misje I–IX w menu, pory roku w Wolnej dolinie.
Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>` i **PR do bazy** (nie pushuj bezpośrednio na bazę).

Przeczytaj: `CLAUDE.md`, `docs/DESIGN.md`, `docs/DECISIONS.md` (zwł. **D-21, D-26–D-33**), `docs/design/sandbox.md`,
`docs/design/seasons.md`, `docs/BACKLOG.md`, `docs/reviews/gpt-integration-2.md` (co przyjęto/odrzucono z paczki 06
i dlaczego — **nie powtarzaj tych błędów**: żadnych `mission.id === 'mX'` w kodzie sim, żadnych wpisów w `sounds.ts`
bez istniejących plików, żadnych zmian w `tests/i18n-keys.ts` usuwających filtr PENDING_KEYS).

Gra jest **darmowa, bez reklam** (D-21/D-29). Tytuł „Marchia” we wszystkich językach (D-31).
Towary: wood, planks, grain, flour, bread, fish, stone, charcoal, malt, beer. Rangi 0–5.

## Zasady wspólne
- NIE edytuj: `src/ui/**`, `src/render/**`, `src/main.ts`, `src/platform/**`, istniejących plików `src/sim/**`,
  `.github/workflows/**`, `package.json` (bez nowych zależności). Nowe pliki w `src/sim/proposals/`, `tools/`,
  `tests/`, `docs/` — wolno.
- Symulacja: tylko `+ - * /`, `Math.sqrt/abs/min/max/floor/round`; bez `Math.random`, `Date`, trygonometrii, `pow`, `exp`.
- Nie dopisuj numerów decyzji D-NN do `docs/DECISIONS.md` — zaproponuj treść decyzji w opisie PR.
- Teksty dla gracza: PL + EN. Zasoby tylko CC0/OFL z wpisem w `docs/ASSETS.md`.
- `npm test` (linia `SUMMARY … failed=0`) i `npm run typecheck` zielone przed PR.
- Opis PR po polsku: co, dlaczego, jak sprawdzić, czego nie zrobiono, liczby z pomiarów.

| Nr | Plik | Temat |
|---|---|---|
| 48 | 48-i18n-batch-06.md | Tłumaczenia nowych kluczy (misje VII–IX, pory roku) na 15 języków |
| 49 | 49-missions-10-12.md | Misje X–XII: węglarz, słodownia, browar — projekt + dane + boty |
| 50 | 50-audio-binaries.md | Wyrenderowanie 13 oczekujących dźwięków CC0 (`pending_tracks`) |
| 51 | 51-valley-chronicle.md | Kronika doliny: kamienie milowe trybu swobodnego (czyste funkcje + teksty) |
| 52 | 52-sandbox-balance.md | Pomiar balansu Wolnej doliny z porami roku (narzędzie + raport) |
| 53 | 53-tests-seasons-m7-9.md | Testy odporności: fuzz pór roku, zapis/odczyt v6, misje VII–IX |
| 54 | 54-goods-codex.md | Księga towarów i budynków — teksty PL/EN (treść do przyszłego ekranu) |

Z paczki 06 wciąż otwarte (jeśli jeszcze nie wysłane): **44 zdarzenia w dolinie**, **47 protokół playtestu v2**.
