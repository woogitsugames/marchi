# 42 — Misje VII–IX (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Wzór: `src/sim/missions-s2.ts` (m4–m6), `docs/missions/m4.md…m6.md`, `tools/balance.ts`, `tests/missions*.test.ts`.
Każda misja uczy JEDNEJ nowej przyczyny przestoju z nowych łańcuchów (D-30):
- VII „Ryby na post” — rybak musi stać przy wodzie (NOT_NEAR_WATER), ryby przez most do zamku; lekcja: lokalizacja.
- VIII „Bruk przed burzą” — kamień z kamieniołomu (NOT_ON_ROCK, ładunek 4) jako materiał na bruk/most kamienny
  (NO_STONE); lekcja: materiał budowlany też trzeba przywieźć.
- IX „Piwo na wesele” — długi łańcuch zboże→słód→piwo + węglarz konkuruje z tartakiem o drewno (CONTESTED).
Dostarcz: `src/sim/proposals/missions-7-9.ts` (MissionDef + ValleySpec, z `buildable` jeśli trzeba), boty
`tools/bot-m7.ts…m9.ts`, `docs/missions/m7.md…m9.md` (cel, mapa ASCII 96×72, kontrakt, progi pieczęci z pomiarów
3 strategii: nic / częściowa / właściwa naprawa — tabela), test akceptacyjny `tests/missions-7-9.test.ts` (na danych
z proposals, bez rejestracji w `missions.ts` — opisz 3 linie rejestracji w PR). Teksty misji (nazwy, podtytuły, listy
kasztelana) PL+EN w `docs/content/letters-7-9.md`.
