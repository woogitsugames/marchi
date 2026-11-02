# 49 — Misje X–XII (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/49-missions-10-12`. Wzór: `src/sim/proposals/missions-7-9.ts` (po integracji: misje w `missions.ts`),
`docs/missions/m7.md…m9.md`, `tools/bot-m7.ts…`, `tests/missions-7-9.test.ts`, `docs/reviews/gpt-integration-2.md`.
Każda misja uczy JEDNEJ przyczyny przestoju (D-30), tym razem na łańcuchach węgla, słodu i piwa:
- X „Węgiel dla kowala” — węglarz zjada drewno, tartak głoduje: NO_INPUT cause CONTESTED; lekcja: dwa odbiorcy jednego surowca.
- XI „Słód na zimę” — słodownia za daleko od farmy, wozy wiecznie w drodze: WAITING_DELIVERY / NO_WAGON(ALL_BUSY);
  lekcja: odległość = wozy (kup wóz albo skróć drogę).
- XII „Wielkie piwowarstwo” — kontrakt w transzach (jak misja V) na piwo + chleb; spichlerz pełny (STORAGE_FULL)
  blokuje odbiór słodu; lekcja: magazyn jako bufor.
Dostarcz: `src/sim/proposals/missions-10-12.ts` (MissionDef, istniejące `mapId`: valley1 / valley-m2 / valley-m3 albo
własny ValleySpec; pole `buildable` z D-28; jeśli potrzebna nowa mechanika — tylko jako POLE DANYCH MissionDef
opisane w PR, bez zmian w istniejącym sim), boty `tools/bot-m10.ts…m12.ts` (3 strategie: nic / częściowa / właściwa),
`docs/missions/m10.md…m12.md` (cel, mapa ASCII, kontrakt, tabela pomiarów, progi pieczęci), test
`tests/missions-10-12.test.ts`, teksty PL+EN w `docs/content/letters-10-12.md`: nazwa, podtytuł, list otwierający,
listy po wygranej 1/2/3 pieczęci i po przegranej.
Wymagania: każda misja wygrywalna w 5–12 min; strategia „nic” ≤ 1 pieczęć; różnica częściowa/właściwa ≥ 0,8 min.
NIE importuj wartości (funkcji) z `missions.ts` w pliku proposals — tylko `import type` (cykl modułów, patrz raport 2).
W PR podaj linie rejestracji.
