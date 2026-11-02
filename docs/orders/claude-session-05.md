Repozytorium: woogitsugames/marchi, gałąź bazowa: claude/eager-cori-08wt8e (zrób `git fetch` — baza poszła do przodu:
stan v6, misje I–IX, pory roku, Twoje PR-y #48 i #49 są już scalone lokalnie do bazy; D-31 od odstępów przenumerowane
na D-35). Pracuj na gałęzi claude/s5-rtl, na końcu PR do bazy. Komunikacja po polsku, kod po angielsku. Zasady: CLAUDE.md.
Przeczytaj docs/DECISIONS.md (D-18, D-31), docs/UI_STYLE.md, docs/BACKLOG.md (pozycja RTL).
NIE edytuj src/sim/** ani src/render/** (poza ewentualną lustrzaną ikoną kierunku w src/ui/icons.ts).

ZADANIE — Układ od prawej do lewej dla arabskiego (claude/s5-rtl)
1. CSS: przejdź na właściwości logiczne (margin/padding/inset-inline-start/end, text-align: start/end, border-inline-*)
   we wszystkich arkuszach stylów UI; `dir="rtl"` już ustawia src/i18n/index.ts — sprawdź.
2. Lustrzane ułożenie: listwa narzędzi, arkusze (Dlaczego stoi?, karta wozu, rynek, budowanie, menu, Księgi osad),
   list przewozowy, tabliczka osady, toasty, przycisk „Pokaż przyciski”. Gesty i kamera BEZ zmian (mapa się nie odbija).
3. Ikony kierunkowe (strzałki „dalej/wstecz”, łańcuch przyczyn →) odbite w RTL; ikony towarów i budynków bez odbicia.
4. Liczby i czasy w tekście arabskim: sprawdź, czy izolacja `iso()` (format.ts) poprawnie trzyma liczby/jednostki
   (bidi), m.in. „30 srebra · 4 kamienie (masz 2)”, czasy ETA, „Zima · rok 2”.
5. Zrzuty Playwright `?lang=ar&quality=low&dynres=0` (412×915, 915×412, fold-inner-land; Chromium preinstalowany,
   nie instaluj): menu, misja I z otwartym „Dlaczego stoi?”, karta wozu, rynek, budowanie w Wolnej dolinie → docs/shots/rtl-*.png;
   obejrzyj, 2 rundy poprawek wg zakazów z CLAUDE.md. Porównaj z `?lang=pl` (nic nie może się zepsuć w LTR —
   zrzuty pl przed/po).
6. Test headless (jeśli wykonalny): brak fizycznych left/right w CSS UI (grep-test z listą wyjątków).
typecheck/test/build zielone. Raport po polsku z linkiem do PR-a, listą zmienionych plików i 3 zrzutami do obejrzenia.
