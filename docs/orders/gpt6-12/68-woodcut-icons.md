# 68 — Ikony drzeworytowe dla nowych stanów — gałąź `gpt/68-icons`

Gra rysuje ikony w kodzie (`src/ui/icons.ts`, styl drzeworytu: gruba linia, kreskowanie, jeden kolor `currentColor`,
viewBox 24×24, czytelne przy 18 i 32 px, rozróżnialne **kształtem**). Nowe stany i karty nie mają własnych ikon:
1. `wagon_due` — „wóz przyjedzie” (wóz + strzałka czasu/klepsydra),
2. `market_full` — „rynek nasycony” (stragan z pełnymi skrzyniami / waga przechylona),
3. `grow` — „rozbuduj łańcuch” (dwa domki + plus z belek),
4. `trade_post` — posterunek handlowy za rzeką (budka z daszkiem i proporcem),
5. `bottleneck` — „wąskie gardło” (lejek / zwężenie drogi),
6. `cut_road` — „przetnie drogę” (ukośny odcinek drogi przecięty).
**Nie edytuj `src/ui/icons.ts`.** Oddaj pliki `assets-in/icons-68/<nazwa>.svg` (ścieżki SVG bez gradientów i filtrów,
`stroke`/`fill="currentColor"`), arkusz podglądu `assets-in/icons-68/preview.png` (każda ikona 18/32/64 px na pergaminie
i na ciemnym tle) i wpis w `docs/ASSETS.md` (własne, wygenerowane dla tej gry). Wzorce stylu: obecne ikony w
`src/ui/icons.ts` i `npm run icons:check`. Integrację zrobi koordynator.
