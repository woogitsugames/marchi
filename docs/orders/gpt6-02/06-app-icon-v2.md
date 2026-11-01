# Zlecenie 06 — Ikona aplikacji v2

Punkt wyjścia: `art/app-icon.svg`, `tools/make-icons.mjs`, `tools/check-icons.mjs`, `docs/shots/app-icon.png` (wersja 1 jest w repo).

Uwagi do v1:
1. Motyw zajmuje ~50 % kafelka — w 48 px jest za mały. Wypełnij ~75–80 % (w granicach safe-zone Androida 66/108 dp).
2. Ukośne pasy na burcie wyglądają jak taśma ostrzegawcza / oznakowanie BHP. Zastąp je deskami burty
   (poziome klepki z cięciami drzeworytu) — jak w ikonach `src/ui/icons.ts` (`wagon`, `planks`).
3. Bez konia wóz czyta się jak wózek górniczy/lodziarnia. Dodaj sylwetkę konia (z profilu lub 3/4) ALBO zmień
   kadr na koło wozu + pieczęć woskową (Glina `#8c4a2f`) — zrób oba warianty i wybierz lepszy w 48 px.
4. Ładunek: wyraźne sylwetki (worki/kłody/deski), nie „bańki”.
5. Rozważ jeden akcent Gliny lub Ochry (np. pieczęć, chorągiewka) na tle Torf — tylko jeden.

Dostarcz: nowe `art/*.svg`, regenerowane zasoby (`npm run icons`), `npm run icons:check` zielony,
`docs/shots/app-icon.png` (48/96/192/512 na jasnym i ciemnym tle + pod okrągłą maską Androida) oraz
`docs/shots/app-icon-variants.png` z porównaniem wariantów.
