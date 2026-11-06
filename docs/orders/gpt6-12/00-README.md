# Zlecenia GPT-6 — paczka 12 (MARCHIA — Szlaki Królestwa)

**Repo `woogitsugames/marchi`, gałąź bazowa `claude/eager-cori-08wt8e`** (nie `main`). Zrób `git fetch` — od paczki 11
baza poszła mocno do przodu: dyspozytor 2 (D-156), misja VIII przeprojektowana (D-165..D-167), Wolna dolina: list
otwierający, karta rangi, karta „rozbuduj”, posterunek handlowy za rzeką od rangi 4, zapis v9 (D-151..D-192),
fixtury i ekran moderatora do playtestu (D-185..D-191). Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>` i **PR do bazy**.

Przeczytaj: `CLAUDE.md`, `docs/UI_STYLE.md`, `docs/DECISIONS.md` (od D-150), `docs/ASSETS.md`.

## Zasady wspólne
- NIE edytuj: `src/ui/**`, `src/render/**`, `src/styles/**`, `src/sim/**`, `src/main.ts`, `src/platform/**`,
  `src/audio/sounds.ts`, `.github/workflows/**`, `package.json`. Wyjątki nazywa samo zlecenie (i18n, `letters.ts`, docs).
- Zasoby tylko własne (wygenerowane na potrzeby tej gry) lub CC0/OFL, każdy z wpisem w `docs/ASSETS.md`.
- Zakazy z `CLAUDE.md`: bez kopiowania z innych gier, bez emoji, bez pasteli/neonów/„AI slop”, ikony drzeworytowe.
- `npm test` (`SUMMARY … failed=0`) i `npm run typecheck` zielone przed PR. Opis PR po polsku.
- **Zlecenie bez plików jest nieoddane.** Commity małe, po angielsku.

| Nr | Plik | Temat | Priorytet |
|---|---|---|---|
| 66 | 66-i18n-review.md | Przegląd jakości ~130 kluczy i listów pisanych przez agenty w 15 językach | **1** |
| 67 | 67-letters-edit.md | Redakcja listów kasztelana VIII, XIII i doliny (pl/en) | 2 |
| 68 | 68-woodcut-icons.md | 6 ikon drzeworytowych (SVG) dla nowych stanów i kart | 3 |
| 69 | 69-audio-cues.md | 5 krótkich sygnałów dźwiękowych CC0/własnych | 4 |
| 70 | 70-store-update.md | Aktualizacja opisów sklepu (Play/App Store) o nowe funkcje, 17 języków | 5 |
