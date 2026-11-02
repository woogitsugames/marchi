# 53 — Testy odporności (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/53-robustness-tests`. Tylko nowe pliki w `tests/` (+ ewentualnie `tests/regressions/`).
1. `tests/seasons-fuzz.test.ts` — losowe (seedowane) komendy w Wolnej dolinie przez pełny rok gry (36 000 ticków),
   5 seedów: inwarianty co tick (zachowanie towarów — patrz `checkInvariants`), brak przestoju bez przyczyny
   (`unexplainedStalls`), brak wozu zablokowanego > 10 min poza oknem lodu; hash determinizmu dwóch przebiegów równy.
   Czas testu ≤ 25 s (jeśli dłużej — skróć i opisz).
2. `tests/save-v6.test.ts` — zapis/odczyt w każdej porze roku i w trakcie roztopów; po odczycie te same efekty
   (`effectsAt`) i ten sam hash po N tickach co bez zapisu; misja VIII: zapis w trakcie budowy bruku (kamień w drodze).
3. `tests/missions-7-9-edge.test.ts` — przypadki brzegowe: rozbiórka kamieniołomu w VIII, sprzedaż wozu z ładunkiem,
   bruk bez kamienia → `NO_STONE{need,have}` z poprawnymi liczbami; IX: CONTESTED wskazuje właściwego rywala.
Jeśli znajdziesz błąd — test oznacz w `tests/known-failing` (zobacz istniejący mechanizm) i opisz w PR z krokami
odtworzenia; NIE poprawiaj kodu sim w tym PR.
