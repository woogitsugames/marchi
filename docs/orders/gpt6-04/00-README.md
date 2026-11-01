# Zlecenia GPT-6 — paczka 04: tłumaczenia (MARCHIA — Szlaki Królestwa)

## Repozytorium
- **GitHub: `woogitsugames/marchi`** — https://github.com/woogitsugames/marchi
- **Gałąź bazowa: `claude/eager-cori-08wt8e`** (NIE `main`, NIE `woogitsu/osadale`).
- Każde zlecenie = gałąź `gpt/i18n-<kod>` i PR do `claude/eager-cori-08wt8e`. **Nie pushuj bezpośrednio na gałąź bazową.**
- Bez dostępu do push → ZIP z plikami w strukturze repo + `INTEGRACJA.md`.

## Kontekst
Średniowieczna gra logistyczna na telefony (ok. 1300–1400 r., pogranicze — „Marchia”). Filar: gracz diagnozuje przestoje
(„Dlaczego stoi?”). Przeczytaj `CLAUDE.md`, `docs/DESIGN.md`, `docs/DECISIONS.md` (zwł. **D-11, D-18**), `docs/UI_STYLE.md`
(sekcja „Words”), `docs/i18n/REVIEW.md` (słowniczek PL↔EN), zrzuty `docs/shots/ui-*.png`, `fold-*.png`.

## Format pliku (obowiązkowy, D-18)
- Plik: `src/i18n/<kod>.ts`, gdzie `<kod>` z myślnikiem zamienionym na `_`: `de.ts`, `fr.ts`, `es.ts`, `it.ts`, `pt_BR.ts`, `nl.ts`,
  `sv.ts`, `tr.ts`, `ru.ts`, `uk.ts`, `ja.ts`, `ko.ts`, `zh_Hans.ts`, `ar.ts`, `hi.ts`.
- Treść: `import type { Dict } from './pl';` i `export const <kod_z_podkreślnikiem>: Dict = { ... };` — nazwa eksportu = nazwa pliku
  (`export const pt_BR: Dict`, `export const zh_Hans: Dict`). **Pełny `Dict`** (wszystkie klucze z `pl.ts`, ta sama kolejność).
- Źródło znaczenia: **en.ts** (rzeczowy British English) + kontekst z pl.ts. Nie tłumacz kluczy, tylko wartości.
- **Placeholdery** `{...}` zachowaj dokładnie. Klucze `goodGen.*`/`goodAcc.*` (polskie przypadki) — w Twoim języku wpisz formy
  potrzebne w zdaniach, które ich używają (jeśli język nie ma przypadków: ta sama forma co `good.*`). Sprawdź w `src/ui/format.ts`
  (`buildingStatusText`), które placeholdery są przekazywane.
- **Liczba mnoga**: gdzie wartość zawiera liczbę zmienną (`{n}`, `{need}`, `{have}` itd.) i rzeczownik zależny od liczby, użyj
  bloku ICU-lite: `{n, plural, one {# wóz} few {# wozy} many {# wozów} other {# wozu}}` (`#` = liczba; kategorie wg
  `Intl.PluralRules` Twojego języka; `other` obowiązkowe; bez zagnieżdżonych nawiasów w gałęziach). Języki bez liczby mnogiej
  (ja, ko, zh) — bez bloków.
- Długości: przyciski i etykiety narzędzi ≤ 14 znaków (szerokość jak „Rozbiórka”), dymki przestoju ≤ 60, linie panelu ≤ 90.
  Dla CJK liczy się szerokość: ≤ 7 znaków w przyciskach.
- Ton: rzeczowy, z lekkim posmakiem epoki, bez archaizmów na siłę, bez fantasy; gracz to zarządca (forma bezosobowa lub
  grzecznościowa zwyczajowa dla gier w danym języku). Nazwy własne gry: „Marchia” zostaje (transkrypcja w alfabetach
  niełacińskich: dodaj w słowniczku).
- Słowniczek: `docs/i18n/glossary-<kod>.md` (wóz, ładunek, przestój, most drewniany/kamienny, grunt/bruk, spichlerz, kontrakt,
  list przewozowy, pieczęć, srebro, Dlaczego stoi?) — spójnie w całym pliku.
- Test kompletności: `tests/i18n-<kod>.test.ts` porównujący klucze z `pl.ts` i zestaw placeholderów (poza `goodGen`/`goodAcc`)
  z `en.ts` dla każdego klucza. `npm test` i `npm run typecheck` zielone.
- **Nie edytuj** `src/i18n/pl.ts`, `en.ts`, `index.ts` ani niczego poza swoimi plikami. Rejestracja jest automatyczna (lazy glob).
- Dodatkowo: przetłumacz opis do sklepu z `docs/store/play-en.md` → `docs/store/play-<kod>.md` (te same limity znaków)
  oraz politykę prywatności `docs/store/privacy-en.md` → `docs/store/privacy-<kod>.md`.

## Zlecenia
Każdy plik `NN-<kod>.md` = jeden język. Zlecenie 23 (DE+FR z paczki 03) — jeśli już zrobione, dostosuj do formatu wyżej
(pełny `Dict`, plural, nazwa eksportu) w ramach 27/28.
