# Zlecenie 10 — Korekta tekstów PL i EN

Przejrzyj `src/i18n/pl.ts` i `src/i18n/en.ts` (tylko czytanie — trwa tam praca) oraz teksty na zrzutach
`docs/shots/ui-*.png`. Cel: polszczyzna naturalna i poprawna (odmiana, interpunkcja, długość na wąskim
ekranie), angielski na poziomie native (British English, rzeczowy ton gry strategicznej), spójna terminologia
(wóz/wagon, spichlerz/granary, srebro/silver, list przewozowy/waybill, przestój/stall).

Dostarcz:
- `docs/i18n/REVIEW.md`: tabela klucz | obecnie PL | proponowane PL | obecnie EN | proponowane EN | powód;
  słowniczek terminów (PL ↔ EN) do stałego użycia;
- `docs/i18n/proposed.patch` — łatka `git diff` na oba pliki (zastosujemy po zakończeniu prac nad UI);
- lista tekstów, które mogą się nie zmieścić (≥ 28 znaków w przyciskach, ≥ 60 w dymkach).
