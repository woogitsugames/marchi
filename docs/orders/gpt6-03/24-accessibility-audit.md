# 24 — Audyt dostępności (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Na zrzutach `docs/shots/ui-*.png`, `fold-*.png` i stylach `src/styles/main.css`: (1) symulacja daltonizmu (deuteranopia, protanopia,
tritanopia) — przetwórz zrzuty i sprawdź, czy statusy/ikony towarów/nakładka ruchu są rozróżnialne (ikony towarów mają różnić się
kształtem — zweryfikuj); (2) kontrast tekstu WCAG 2.2 (AA) dla kolorów z UI_STYLE; (3) minimalne rozmiary tekstu i celów dotyku (≥ 48 dp);
(4) obsługa czytnika ekranu (role/aria w HTML generowanym przez `src/ui/*.ts` — tylko czytanie); (5) ruch: czy jest opcja ograniczenia animacji
(`prefers-reduced-motion`). Raport `docs/a11y/AUDIT.md` z listą problemów (plik:linia, waga, propozycja), zrzuty symulacji w `docs/a11y/`.
Bez zmian w `src/`.
