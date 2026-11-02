# Zlecenia GPT-6 — paczka 08 (MARCHIA — Szlaki Królestwa)

**Repo `woogitsugames/marchi`, gałąź bazowa `claude/eager-cori-08wt8e`** (nie `main`). Zrób `git fetch` — baza
poszła do przodu: sloty zapisu na misję (D-36), układ RTL dla arabskiego (D-37), poprawka tekstur łąki.
Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>` i **PR do bazy** (nie pushuj bezpośrednio na bazę).

Przeczytaj: `CLAUDE.md`, `docs/UI_STYLE.md`, `docs/DECISIONS.md` (zwł. D-21, D-29, D-36, D-37),
`docs/reviews/gpt-integration-3.md` (co poprawiono w paczce 07 i dlaczego).

## Zasady wspólne (jak w 07)
- NIE edytuj: `src/ui/**`, `src/render/**`, `src/styles/**`, `src/main.ts`, `src/platform/**`, istniejących plików
  `src/sim/**`, `src/audio/sounds.ts`, `.github/workflows/**`, `package.json`.
- Zasoby tylko własne (wygenerowane przez Ciebie na potrzeby tej gry) lub CC0/OFL, z wpisem w `docs/ASSETS.md`.
- `npm test` (`SUMMARY … failed=0`) i `npm run typecheck` zielone przed PR. Opis PR po polsku.
- **Zlecenie bez plików jest nieoddane** (w paczce 07 zlecenie 50 wróciło bez dźwięków).

| Nr | Plik | Temat |
|---|---|---|
| 55 | 55-ui-art-kit.md | **Najważniejsze.** Ręcznie malowany zestaw grafik UI (ramki, wstęga, przyciski, pieczęcie) wg makiety D |
| 56 | 56-audio-files.md | Powtórka 50: 13 plików dźwięków CC0 — tym razem same pliki |
| 57 | 57-i18n-batch-07.md | Tłumaczenia 13 nowych kluczy na 15 języków |

Z paczki 06 wciąż otwarte: **44 zdarzenia w dolinie**, **47 protokół playtestu v2** — jeśli masz czas, dokończ.
