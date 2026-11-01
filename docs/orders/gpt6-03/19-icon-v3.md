# 19 — Ikona aplikacji v3 (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Obecna v2 (koło + pieczęć): `art/app-icon*.svg`, `tools/make-icons.mjs`, `tools/check-icons.mjs`, `docs/shots/app-icon*.png`.
Poprawki: (1) litera na pieczęci w kroju **Grenze Gotisch** (OFL; npm `@fontsource/grenze-gotisch` jest w repo — zamień glif na ścieżki SVG),
nie geometryczny sans; (2) kreskowanie drzeworytowe na kole (jak `src/ui/icons.ts`, `docs/shots/icons.png`), bez utraty czytelności w 48 px;
(3) delikatna nieregularność krawędzi pieczęci (wosk). Uwaga: NIE nadpisuj `android/**` w PR — wygeneruj zasoby do katalogu
`art/out/` i opisz komendę; zasoby natywne podmienimy sami (inny agent pracuje teraz w android/). Zrzuty porównawcze v2 vs v3.
