# Zlecenia GPT-6 — paczka 13 (MARCHIA — Szlaki Królestwa)

**Repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`** — `git fetch` przed każdym zleceniem (baza zmienia się kilka razy dziennie).
Każde zlecenie = osobna gałąź `gpt/<nr>-<skrót>` i PR do bazy. Zasady wspólne jak w paczce 12 (`docs/orders/gpt6-12/00-README.md`):
- NIE edytuj: `src/ui/**`, `src/render/**`, `src/styles/**`, `src/sim/**`, `src/main.ts`, `src/platform/**`, `src/audio/sounds.ts`, `.github/workflows/**`, `package.json` — chyba że zlecenie wprost pozwala (i18n, `letters.ts`, `tests/`, `tools/`, `docs/`, zasoby).
- Zasoby własne lub CC0/OFL z wpisem w `docs/ASSETS.md`. Bez emoji, bez kopiowania z innych gier.
- `npm test` (`failed=0`) i `npm run typecheck` zielone przed PR. Opis PR po polsku. **Zlecenie bez plików jest nieoddane.**
- Kolejność: od góry; zlecenia są niezależne, rób równolegle, ile możesz. Paczka 12 (66–70) ma pierwszeństwo, jeśli jeszcze otwarta.

| Nr | Plik | Temat |
|---|---|---|
| 71 | 71-letters-14-15.md | Listy XIV i XV na 15 języków |
| 72 | 72-codex-new.md | Księga przestojów: wpisy dla nowych stanów |
| 73 | 73-events-late.md | Zdarzenia doliny dla rang 4–5 (tekst) |
| 74 | 74-chronicle-late.md | Kronika doliny: wpisy rang 4–5 i posterunku |
| 75 | 75-save-tests.md | Testy migracji zapisu v9 |
| 76 | 76-i18n-length.md | Narzędzie: długości tłumaczeń |
| 77 | 77-playtest-aggregate.md | Narzędzie: zbiorcze wyniki playtestu |
| 78 | 78-help-text.md | Pomoc w grze (tekst) |
| 79 | 79-audio-winter.md | Dźwięki zimy (CC0) |
| 80 | 80-audio-post.md | Dźwięki posterunku (CC0) |
| 81 | 81-goods-shape-audit.md | Audyt rozróżnialności towarów kształtem |
| 82 | 82-a11y-audit.md | Audyt dostępności bieżącej wersji |
| 83 | 83-layout-17.md | Layout we wszystkich 17 językach |
| 84 | 84-perf-desktop.md | Pomiar wydajności (przeglądarka desktop) |
| 85 | 85-pl-proof.md | Korekta polszczyzny `pl.ts` |
| 86 | 86-en-proof.md | Korekta angielskiego `en.ts` |
| 87 | 87-missions-docs.md | Spójność `docs/missions/*.md` z danymi |
| 88 | 88-decisions-index.md | Indeks decyzji |
| 89 | 89-glossary.md | Słownik terminów dla tłumaczy |
| 90 | 90-tutorial-build-script.md | Scenariusz samouczka budowania |
| 91 | 91-menu-cold.md | Menu na zimno — propozycja tekstów |
| 92 | 92-valley-bot-report.md | Raport: dolina 3 h z botem |
| 93 | 93-fuzz-long.md | Długi fuzz |
| 94 | 94-difficulty-curve.md | Krzywa trudności misji |
| 95 | 95-privacy-review.md | Przegląd polityki prywatności |
| 96 | 96-assets-audit.md | Audyt licencji zasobów |
| 97 | 97-readme.md | README repozytorium |
| 98 | 98-music-cues.md | Arkusz muzyki (dla Suno) |
| 99 | 99-aria-review.md | Przegląd tekstów czytnika ekranu |
| 100 | 100-rtl-review.md | Przegląd arabskiego RTL |
