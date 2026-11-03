# Niepełne ładunki wozów (backlog P3) — pomiar, prototypy reguł, rekomendacja

Data: 2026-11-03, gałąź `claude/research-day4` (baza `0a92389`). Zmiany tylko w `tools/` i `docs/research/`; `src/` nietknięte.
Narzędzia: `tools/partial-loads-patch.mjs` (buduje kopię repo poza worktree z załatanym dyspozytorem i sondą tylko do
odczytu; reguła wybierana zmienną `LOAD_POLICY`), `tools/partial-loads.ts` (gra wszystkie strategie botów m1–m12 i plan
DECENT doliny, jedna linia JSON na bieg), `tools/partial-loads-summary.mjs` (tabele poniżej).

## 0. Najkrócej

- Wpis w backlogu jest częściowo nieaktualny: dziś `minQty = min(want, starving ? 2 : cap)` (logistics.ts:143), a liczby
  „5×1, 4×2, 2×3, 3×4, 2×5, 11×6” w m1 to **przydziały**. Przy załadunku wóz **dobiera** to, co producent zrobił w czasie
  dojazdu (`finishBusy`, wagons.ts:363), więc w `npm run bot` faktycznie wyjeżdża **0×1**, 4×2, 4×3, 1×4, 1×5, 14×6.
- Mimo dobierania: w misjach 54 % kursów wiezie 1–3 jedn., w dolinie 69 %. Prawie wszystkie to **dowóz wkładu do warsztatu**
  (1891 z 1973 małych kursów): warsztat ma `inCap` 8, wóz przywozi 6, potem każde zużycie jednej sztuki to nowe zlecenie na 1–2.
- Reguła „warsztat zamawia dopiero, gdy zmieści ≥ min(ładowność, 4)” (**d4**, bezstanowa) daje w dolinie **+30 % srebra
  w 60 min, +18 % w 150 min, −38 % metrów na dostarczoną jednostkę**, zero nowych przyczyn postoju. W misjach zmienia jednak
  wynik 20 z 44 biegów (9 w górę, 11 w dół, 3 wygrane → porażki; m8 przegrane przy „nic” i „częściowej”).
- Rekomendacja: **d4 tylko w wolnej dolinie** (misje bit-identyczne), z przestrojeniem okien rang doliny. Pytanie do właściciela — §6.

## 1. Co jest prawdą dzisiaj (kod)

- Popyt warsztatu: `want = inCap − stock − incoming` (logistics.ts:103). Źródło-producent musi mieć `avail ≥ minQty`
  (`minQty = min(want, cap)`, przy głodzie 2), źródło-spichlerz **dowolną** ilość ≥ 1. Ilość zlecenia `min(want, avail, cap)`.
- Głód (`starving`) = wkład poniżej jednego cyklu receptury i nic w drodze; wtedy wystarczy ładunek ≥ 2.
- Przy załadunku wóz dobiera wolne sztuki do ładowności, ile odbiorca przyjmie (`acceptsUpTo`) — przydział 1 często kończy
  się ładunkiem 2–3.
- Zamek (kontrakt, `prio 0`) i rezerwa kamienia w spichlerzach (`prio 2`, tylko pełne ładunki) nie są źródłem małych kursów
  (zamek: 26 z 454 kursów ≤ 3 jedn. — końcówki transz).
- Dyspozytor co 5 ticków (0,5 s); cykl warsztatu 7–20 s. Zużycie 1 sztuki zwalnia miejsce i w ciągu 0,5 s wolny wóz dostaje
  zlecenie na 1 sztukę. Przy nadmiarze wozów to nic nie kosztuje; przy niedoborze wozy są zajęte drobnicą, a producenci
  stoją z pełnym wyjściem (`OUTPUT_FULL.NO_WAGON` = 9,4 % próbek budynków w dolinie, 60 min).

## 2. Metoda

Kopia repo w katalogu tymczasowym; załatane `logistics.ts` (bramka reguły przed szukaniem źródła, opcjonalny próg dla
spichlerza), `wagons.ts` i `sim.ts` (sonda: histogram przydziałów i ładunków po dobraniu, jednostki rozładowane, odometr,
czas wozów ze zleceniem / bez, status budynków co 1 s). Sonda tylko czyta: reguła `base` daje **identyczne hasze stanu**
jak prawdziwe `src/` (sprawdzone: m1 ×3 strategie, m5 ×5, m10). Boty bez zmian.

Scenariusze (45 biegów na regułę): `npm run bot` (m1), wszystkie strategie `tools/balance.ts` m1–m6 (21),
`STRATEGIES` z `bot-missions-7-9.ts` i `bot-missions-10-12.ts` (18), dolina: plan DECENT 60 min (osobno 150 min).

Reguły (we wszystkich zamek i budynek głodny nigdy nie czekają):

| reguła | opis | nowy stan? |
|---|---|---|
| **base** | dziś | — |
| **d4** | popyt warsztatu (`prio 1`) czeka, dopóki `want < min(cap, 4)` | nie |
| **d6** | to samo z pełnym ładunkiem (`want < cap`) | nie |
| **d4t8** | d4, ale popyt wstrzymany 8 s z rzędu zostaje obsłużony | **tak** (wiek popytu) |
| **d4w** | d4 + spichlerz jako źródło musi mieć ≥ min(want, 4); zamek bierze każdą ilość, gdy do najbliższego terminu (transza / 3. pieczęć / kontrakt) ≤ 60 s | nie |
| **eta4** | d4, ale czeka tylko, gdy zapas wkładu (z tym w drodze) starcza na > 1,25 × kurs tam i z powrotem od najbliższego źródła | nie (Dijkstra w bramce) |
| **late4** | nic nie czeka; małe dowozy obsługiwane po wszystkich innych popytach przebiegu | nie |
| **sb4** | d4 tylko w wolnej dolinie, misje jak dziś | nie |

Metryki: kursy i rozkład ładunków (przydział → po dobraniu), m odometru na dostarczoną jednostkę, % czasu wozów bez
zlecenia, wynik / czas / pieczęcie każdej strategii; **wstrzymane decyzje** = dyspozytor dziś wysłałby wóz (źródło ma towar
i jest wolny wóz), a reguła nie wysłała — liczone w każdym przebiegu dyspozytora (co 0,5 s), więc to próbki, nie zdarzenia;
**status przy wstrzymaniu** = co pokazuje karta wstrzymanego budynku zaraz po decyzji; **mylący status** = budynek pokazuje
`NO_INPUT.NONE_AVAILABLE` albo `WAITING_UPSTREAM`, choć osiągalne źródło ma wolny towar (próbki co 1 s).

## 3. Wyniki

### 3.1 Rozkład ładunków i wykorzystanie wozów

| reguła | zakres | kursy | jedn. | śr. ładunek | kursy 1–3 jedn. | m / dostarczoną jedn. | czas wozów bez zlecenia | wstrzymane decyzje (z wolnym wozem) |
|---|---|---|---|---|---|---|---|---|
| base | m1–m12 (44 biegi) | 2022 | 7021 | 3,47 | 1087 (53,8 %) | 63,6 | 11,9 % | 0 |
| d4 | m1–m12 | 1453 | 7491 | 5,16 | 138 (9,5 %) | 47,9 | 33,0 % | 56 912 (36 100) |
| d6 | m1–m12 | 1353 | 7492 | 5,54 | 136 (10,1 %) | 45,4 | 41,8 % | 79 312 (57 474) |
| d4t8 | m1–m12 | 2019 | 7028 | 3,48 | 1084 (53,7 %) | 63,5 | 12,3 % | 2 920 (746) |
| d4w | m1–m12 | 1468 | 7602 | 5,18 | 128 (8,7 %) | 47,6 | 33,5 % | 58 812 (37 968) |
| eta4 | m1–m12 | 1808 | 7297 | 4,04 | 728 (40,3 %) | 58,5 | 16,4 % | 21 163 (9 045) |
| late4 | m1–m12 | 2019 | 7013 | 3,47 | 1082 (53,6 %) | 63,6 | 11,9 % | 0 |
| base | dolina 60 min | 1289 | 3486 | 2,70 | 886 (68,7 %) | 46,2 | 2,9 % | 0 |
| d4 = sb4 | dolina 60 min | 915 | 4953 | 5,41 | 26 (2,8 %) | 28,6 | 34,8 % | 22 041 (20 596) |
| d6 | dolina 60 min | 794 | 4455 | 5,61 | 42 (5,3 %) | 28,7 | 41,8 % | 20 224 (20 148) |
| d4t8 | dolina 60 min | 1328 | 3519 | 2,65 | 934 (70,3 %) | 45,8 | 3,6 % | 141 (58) |
| d4w | dolina 60 min | 917 | 4919 | 5,36 | 31 (3,4 %) | 28,9 | 34,7 % | 24 202 (22 975) |
| eta4 | dolina 60 min | 935 | 4875 | 5,21 | 81 (8,7 %) | 30,2 | 32,2 % | 20 671 (19 211) |

Rozkład (liczba kursów z 1/2/3/4/5/6 jedn.; przydział → po dobraniu przy załadunku):

| reguła | zakres | przydział | po dobraniu |
|---|---|---|---|
| base | m1 `npm run bot` | 5/4/2/3/2/11 | **0**/4/4/1/1/14 |
| base | m1–m12 | 767/445/107/150/36/644 | 502/434/151/182/48/705 |
| base | dolina 60 min | 764/141/10/46/5/340 | 621/227/38/57/7/339 |
| d4 | m1 `npm run bot` | 0/5/1/6/1/22 | 0/1/2/2/3/24 |
| d4 | m1–m12 | 9/160/37/491/69/761 | 5/82/51/321/79/915 |
| d4 | dolina 60 min | 2/20/24/307/42/525 | 2/6/18/182/85/622 |
| eta4 | dolina 60 min | 23/43/54/278/20/522 | 12/32/37/170/96/588 |

Skąd małe kursy (base, po dobraniu, ≤ 3 jedn. / wszystkie kursy danego rodzaju, misje + dolina): wkład warsztatu
**1891 / 2290**, zamek 26 / 454, spichlerz 56 / 240, rynek 0 / 327.

Obserwacje:
- **d4t8 ≈ base.** Cykl warsztatu (7–20 s) jest dłuższy niż 8 s, więc popyt na 1 sztukę czeka 8 s i i tak jedzie po 1.
  Ucieczka czasowa ma sens dopiero przy N ≥ cykl (≥ 20 s) i wymaga nowego pola w stanie — odrzucona.
- **late4 ≈ base.** Zmiana kolejności nic nie daje: wozy zwalniają się pojedynczo, a dyspozytor co 0,5 s ma zwykle jeden
  popyt naraz. Problem nie leży w kolejności, tylko w samym wysyłaniu drobnicy.
- **d4 / d6 / d4w** tną liczbę kursów o 28–33 % i m/jedn. o 25 % (misje) / 38 % (dolina). Wozy częściej stoją (33–42 % czasu
  bez zlecenia): ta sama praca potrzebuje mniej wozów.
- **eta4** jest pośrodku w misjach (wstrzymuje na krótkich trasach, na długich nie), w dolinie działa prawie jak d4.

### 3.2 Wynik misji (każda strategia każdego bota)

Format: minuty do końca / pieczęcie (dolina: ranga i srebro po 60 min); `*` = inny wynik niż base;
„spóźn.” = transze po terminie.

| scenariusz | strategia | base | d4 | d4t8 | eta4 | sb4 |
|---|---|---|---|---|---|---|
| m1 | npm run bot | 8,85 / 2 | 11,50 / 1* | 10,40 / 1* | 8,85 / 2 | 8,85 / 2 |
| m1 | nothing (no crossing) | lost / 0 | lost / 0 | lost / 0 | lost / 0 | lost / 0 |
| m1 | wooden bridge x=41 @0:10 | lost / 0 | lost / 0 | lost / 0 | lost / 0 | lost / 0 |
| m1 | bridge + 2 wagons @0:10 | 10,78 / 1 | lost / 0* | 10,78 / 1 | 10,78 / 1 | 10,78 / 1 |
| m2 | nothing | 10,81 / 1 | 9,77 / 1 | 11,48 / 1 | 10,81 / 1 | 10,81 / 1 |
| m2 | buy 2 wagons | 9,94 / 1 | 9,24 / 2* | 9,18 / 2* | 9,94 / 1 | 9,94 / 1 |
| m2 | buy 2 + stone bridge @45s | 8,51 / 3 | 8,25 / 3 | 8,26 / 3 | 8,51 / 3 | 8,51 / 3 |
| m2 | buy 2 + 2nd wooden bridge x=63 @45s | 9,52 / 2 | 9,03 / 2 | 9,21 / 2 | 9,52 / 2 | 9,52 / 2 |
| m3 | nothing | 8,57 / 1 | 9,85 / 1 | 8,57 / 1 | 8,57 / 1 | 8,57 / 1 |
| m3 | buy 2 wagons | 7,41 / 2 | 9,30 / 1* | 7,41 / 2 | 7,41 / 2 | 7,41 / 2 |
| m3 | buy 2 + cobble corridor @25s | 5,60 / 3 | 6,34 / 2* | 5,60 / 3 | 5,60 / 3 | 5,60 / 3 |
| m4 | nothing | 11,65 / 1 | 10,93 / 1 | 8,09 / 2* | 12,03 / 1 | 11,65 / 1 |
| m4 | buy 3 wagons @1:00 | 10,49 / 1 | 6,08 / 3* | 10,77 / 1 | 7,45 / 2* | 10,49 / 1 |
| m4 | stone bridge late @4:00 (iced) | 8,07 / 2 | 7,39 / 2 | 7,12 / 2 | 8,26 / 2 | 8,07 / 2 |
| m4 | stone bridge before ice @1:00 | 6,43 / 3 | 8,18 / 2* | 7,66 / 2* | 7,01 / 2* | 6,43 / 3 |
| m5 | nothing | 9,61 / 1 | 8,25 / 3* | 9,99 / 1 (spóźn. 1) | 9,30 / 2* | 9,61 / 1 |
| m5 | connect granary @0:30 | 9,41 / 1 (spóźn. 1) | 8,18 / 3* | 9,15 / 2* | 9,85 / 1 (spóźn. 1) | 9,41 / 1 (spóźn. 1) |
| m5 | buy 1 wagon @0:30 | 9,16 / 2 | 8,14 / 3* | 9,76 / 1 (spóźn. 1)* | 9,72 / 1* | 9,16 / 2 |
| m5 | buy 2 wagons @0:30 | 8,40 / 3 | 8,25 / 3 | 9,38 / 1* | 9,21 / 2* | 8,40 / 3 |
| m5 | connect granary + 1 wagon @0:30 | 8,04 / 3 | 7,17 / 3 | 9,12 / 1 (spóźn. 1)* | 8,53 / 2* | 8,04 / 3 |
| m6 | nothing | 8,92 / 1 | 9,94 / 1 | 9,53 / 1 | 9,08 / 1 | 8,92 / 1 |
| m6 | buy 1 wagon @0:30 | 8,80 / 2 | 9,94 / 1* | 8,95 / 1* | 9,10 / 1* | 8,80 / 2 |
| m6 | connect big granary @0:30 | 8,31 / 3 | 8,44 / 3 | 8,71 / 2* | 8,09 / 3 | 8,31 / 3 |
| m6 | build granary by the mill @0:30 | 8,40 / 3 | 8,58 / 2* | 8,81 / 2* | 7,86 / 3 | 8,40 / 3 |
| m6 | cut 3rd farm road @0:30 | 9,76 / 1 | 8,42 / 3* | 9,65 / 1 | 9,34 / 1 | 9,76 / 1 |
| m6 | connect big granary late @5:00 | 9,62 / 1 | 9,78 / 1 | 9,11 / 1 | 9,04 / 1 | 9,62 / 1 |
| m7 | nic / no action | 10,90 / 1 | 10,90 / 1 | 10,90 / 1 | 10,90 / 1 | 10,90 / 1 |
| m7 | czesciowa / bank-side fisher late @3:40 | 8,04 / 2 | 8,04 / 2 | 8,04 / 2 | 8,04 / 2 | 8,04 / 2 |
| m7 | wlasciwa / bank-side fisher @0:20 + wagon | 6,41 / 3 | 6,41 / 3 | 6,41 / 3 | 6,41 / 3 | 6,41 / 3 |
| m8 | nic / no action | 10,50 / 1 | lost / 0* | 10,50 / 1 | 10,50 / 1 | 10,50 / 1 |
| m8 | czesciowa / extra wagon @0:30 | 10,11 / 2 | lost / 0* | 10,11 / 2 | 10,11 / 2 | 10,11 / 2 |
| m8 | wlasciwa / wagon + cobble x45-56 from quarry | 9,48 / 3 | 12,75 / 1* | 9,48 / 3 | 9,48 / 3 | 9,48 / 3 |
| m9 | nic / no action | 11,22 / 1 | 12,14 / 1 | 11,22 / 1 | 11,22 / 1 | 11,22 / 1 |
| m9 | czesciowa / second woodcutter @0:30 | 10,06 / 2 | 9,07 / 3* | 9,81 / 2 | 9,00 / 3* | 10,06 / 2 |
| m9 | wlasciwa / second woodcutter @0:30 + wagons | 8,70 / 3 | 8,21 / 3 | 8,61 / 3 | 8,44 / 3 | 8,70 / 3 |
| m10 | nic / competing workshops | lost / 0 | 10,20 / 2* | lost / 0 | lost / 0 | lost / 0 |
| m10 | czesciowa / woodcutter late @2:30 | 10,14 / 2 | 9,40 / 2 | 10,14 / 2 | 10,33 / 1* | 10,14 / 2 |
| m10 | wlasciwa / woodcutter @0:20 | 8,34 / 3 | 8,10 / 3 | 8,59 / 3 | 8,54 / 3 | 8,34 / 3 |
| m11 | nic / three wagons for a long route | 10,94 / 1 | 10,94 / 1 | 10,79 / 1 | 10,94 / 1 | 10,94 / 1 |
| m11 | czesciowa / one wagon @1:00 | 10,06 / 2 | 9,56 / 2 | 10,06 / 2 | 10,06 / 2 | 10,06 / 2 |
| m11 | wlasciwa / five wagons @0:20 | 8,88 / 3 | 9,57 / 2* | 8,88 / 3 | 8,88 / 3 | 8,88 / 3 |
| m12 | nic / granary remains full | 10,36 / 1 | 10,48 / 1 | 10,80 / 1 | 10,05 / 2* | 10,36 / 1 |
| m12 | czesciowa / connect granary late @2:00 | 9,92 / 2 | 8,66 / 3* | 9,46 / 2 | 10,02 / 2 | 9,92 / 2 |
| m12 | wlasciwa / connect granary @0:20 | 8,60 / 3 | 7,70 / 3 | 8,81 / 3 | 8,19 / 3 | 8,60 / 3 |
| sandbox | decent 60 min | rank 3, 3941 sr | rank 3, 5143 sr | rank 3, 3910 sr | rank 3, 5086 sr | rank 3, 5143 sr |

Zmiany pieczęci względem base i zgodność z drabinką balansu (oczekiwane pieczęcie: `expect` z `tools/balance.ts`
dla m4–m6, dla m7–m12 kolejność strategii 1/2/3):

| reguła | biegi misji | pieczęć w górę | w dół | wygrana → porażka | porażka → wygrana | poza drabinką | Σ Δ minut (wygrane w obu) |
|---|---|---|---|---|---|---|---|
| base | 44 | 0 | 0 | 0 | 0 | 1¹ | 0 |
| d4 | 44 | 9 | 11 | 3 | 1 | 11 | −3,50 |
| d6 | 44 | 3 | 18 | 5 | 1 | 12 | +16,60 |
| d4t8 | 44 | 3 | 8 | 0 | 0 | 7 | +1,56 |
| d4w | 44 | 8 | 11 | 3 | 1 | 11 | +3,03 |
| eta4 | 44 | 4 | 6 | 0 | 0 | 9 | −2,79 |
| late4 | 44 | 1 | 0 | 0 | 0 | 2 | −0,47 |
| sb4 | 44 | 0 | 0 | 0 | 0 | 1¹ | 0 |

¹ m10 „nic” = porażka (0 pieczęci); test wymaga tylko ≤ 1, więc to nie błąd.

Wnioski:
- **Balans misji jest ostry jak brzytwa.** d4t8 zmienia logistykę o < 1 % (kursy 2019 vs 2022), a mimo to przestawia
  pieczęcie w 11 z 44 biegów. Każda zmiana dyspozytora w misjach = ponowne strojenie 12 misji, niezależnie od kierunku.
- d4 w misjach nie jest „lepsze” ani „gorsze” w sumie (Σ Δ −3,5 min), tylko inne: m4/m5/m10/m12 łatwiejsze (m5 „nic”
  dostaje 3 pieczęcie!), m1/m3/m8/m11 trudniejsze (przegrane: m1 „most + 2 wozy” oraz m8 „nic” i „częściowa”). Przyczyna:
  na długich trasach (most m1, droga z kamieniołomu m8) zapas 4 cykli nie starcza na dowóz, warsztat stoi
  (`WAITING_DELIVERY` +41 % próbek w m1 `npm run bot`, +49 % w m8 „nic”), a ratunek „głód” odpala dopiero przy pustym wkładzie.
- eta4 usuwa porażki, ale nadal łamie drabinkę 9 razy — w tym lekcję m4 (właściwa poprawka 3 → 2) i m5 (3 → 2).
- d4w (próg dla spichlerza + pilność zamku) nie różni się istotnie od d4: spichlerz z 1–3 szt. to rzadkość (56 kursów).

### 3.3 Wolna dolina, plan DECENT 150 min (okna rang z `tools/balance.ts`: 1: 8–12, 2: 20–30, 3: 40–50, 4: 70–90, 5: 105–135 min)

| reguła | srebro po 150 min | ranga 1 / 2 / 3 / 4 / 5 (min) | m / jedn. | czas wozów bez zlecenia | `OUTPUT_FULL.NO_WAGON` (próbki budynków) |
|---|---|---|---|---|---|
| base | 17 188 | 10,1 / 26,6 / 45,9 / 77,9 / 122,8 | 49,1 | 2,8 % | 6,9 % |
| d4 = sb4 | 20 264 (+17,9 %) | 10,4 / 22,3 / **38,1** / **66,9** / 105,4 | 29,8 | 40,4 % | 0,0 % |
| d4w | 20 326 (+18,3 %) | 10,4 / 22,3 / **38,1** / **66,7** / 105,2 | 29,9 | 40,4 % | 0,0 % |
| eta4 | 20 449 (+19,0 %) | 10,4 / 22,7 / **38,2** / **66,7** / 105,1 | 30,7 | 37,8 % | 0,0 % |

Pogrubione = poza oknem (za wcześnie o 2–3 min). Bot kupuje tę samą flotę (30 wozów), więc przy d4 ~40 % jej czasu stoi;
gracz kupiłby mniej wozów albo postawił więcej warsztatów. Udział `WORKING` w próbkach budynków: 71,6 % → 81,9 %.

### 3.4 Co zobaczy gracz (StallReason)

Status karty wstrzymanego budynku zaraz po decyzji „nie wysyłam” (suma próbek, wszystkie biegi):

| reguła | WORKING | WAITING_DELIVERY | OUTPUT_FULL.NO_DESTINATION | WAITING_PICKUP | OUTPUT_FULL.NO_WAGON | NO_INPUT / NO_WAGON |
|---|---|---|---|---|---|---|
| d4 | 33 043 (58 %) | 11 807 (21 %) | 8 959 (16 %) | 2 874 (5 %) | 13 | **0** |
| eta4 | 19 296 (68 %) | 2 160 (8 %) | 4 309 (15 %) | 2 451 (9 %) | 40 | **0** |
| sb4 | 16 024 (78 %) | 2 486 (12 %) | 0 | 2 086 (10 %) | 0 | **0** |

- Wstrzymanie **nigdy** nie daje nowego postoju: z definicji czeka tylko budynek, który ma wkład na ≥ 1 cykl, więc
  `statusFor` zwraca `WORKING` (albo `WAITING_DELIVERY`, gdy inny wóz już jedzie; `OUTPUT_FULL`/`WAITING_PICKUP` to jego
  własne wyjście, niezwiązane z regułą). Niewyjaśnione postoje i inwarianty: 0 we wszystkich 360 biegach.
- „Mylący status” (`NONE_AVAILABLE`/`WAITING_UPSTREAM`, a źródło ma towar): base 5 437 próbek, d4 5 367, d4w 5 654,
  eta4 5 443, sb4 5 444 — bez zmian. Wszystkie przypadki to istniejąca reguła producenta („czeka na pełny ładunek”,
  `avail < minQty`), żadnego ze spichlerzem (`@granary` = 0 nawet w d4w).
- Widoczny koszt d4 jest inny: **wóz stoi w stajni, a u drwala leżą 3 sztuki**, tartak ma 4/8 i pracuje. Nikt nie jest
  „w postoju”, więc dzisiejszy arkusz „Dlaczego?” nic nie powie. Jeśli to ma być czytelne w < 30 s, karta warsztatu
  potrzebuje jednego zdania UI (np. „zamówi dowóz przy 4 wolnych miejscach”) — tekst i18n, bez zmiany sim.
- Efekt uboczny w dolinie: przy d4 rywalizacja o zboże (młyn vs słodownia) prawie znika — `NO_INPUT.CONTESTED` w zimie
  0 próbek (test F1 w `stall-readability.test.ts` oczekuje > 10). Lekcja „sezonowy rywal” w dolinie słabnie;
  w m9 (CONTESTED jako lekcja misji) przy sb4 bez zmian.

## 4. Wpływ na testy, zapisy, determinizm

Pełne `npm test` w kopiach z regułą (base: `passed=412 failed=0`, czyli kopia z sondą jest neutralna):

| reguła | nieudane testy | które |
|---|---|---|
| d4 | 17 / 412 | golden: `chains` (misje I–VI vs v4), `valley-events-live` (misje vs v7), `dispatch-reachability` (hasze benchu); balans: `missions` m4/m5/m6, `missions-7-9` m8/m9, `missions-10-12` m10/m11/m12, `contract-pace` (F3 m9, D-78 m5/m6), `chains` dolina 90 min (ranga 3 za wcześnie), `stall-readability` F1 i F5 (m4 lód), `thin-delivery` (m10) |
| eta4 | 12 / 412 | jak d4 bez m8/m11, D-78, F5, thin-delivery |
| sb4 | **2 / 412** | `chains › decent bot plays 90 valley minutes` („rank 3 at 38.12”, okno 40–50) i `stall-readability › F1` (zimowy CONTESTED: 0 próbek) |

- **Hasze golden:** sb4 nie zmienia żadnego (misje I–XII, lab, bench `dispatch-reachability` — bench to nie dolina).
  Zmieniają się tylko przebiegi doliny (np. `chains` „determinism with ten goods” liczy hasz na bieżąco — przechodzi).
  d4/eta4 wymagają przeliczenia `V4_GOLDEN`, `valley-events-live` i hasz benchu 50/100 wozów oraz ponownego strojenia misji.
- **Zapisy:** d4 / sb4 / eta4 / d4w czytają tylko istniejący stan (`stock`, `incoming`, receptura, terminy kontraktu) →
  **bez nowego pola, bez podnoszenia `STATE_VERSION` (8), bez migracji**. Stary zapis doliny po wczytaniu po prostu
  zaczyna jeździć pełniej. d4t8 (licznik czasu popytu) wymagałby pola w stanie → v9 + migracja + `saveGate`; odrzucona.
- **Determinizm:** reguła to porównanie liczb całkowitych w dyspozytorze, bez `Math.random`/`Date`/trygonometrii;
  testy `determinism*`, `replay`, `save-chain` przechodzą przy każdej regule. Nagrane powtórki doliny (jeśli są poza
  repo) rozjadą się z nowym buildem — tak samo jak przy każdej zmianie dyspozytora.
- **Wydajność:** d4/sb4 to jedna nierówność na popyt — pomijalne, a mniej kursów = mniej przeplanowań. eta4 liczy
  Dijkstrę od źródeł dla każdego wstrzymanego popytu (DistCache) — niepotrzebny koszt przy podobnym zysku.

## 5. Rekomendacja

**sb4: w wolnej dolinie warsztat zamawia wkład dopiero, gdy zmieści ≥ min(ładowność, 4) sztuki (głodny — od razu, jak
dziś); misje bez zmian.** Szkic zmiany (logistics.ts, pętla popytu, ~4 linie + stała w defs):

```ts
// free valley: a producer tops up its input in fuller loads (D-NN); a starving one still gets any load
if (fair && d.prio === 1 && !starving && d.want < Math.min(cap, TOP_UP_MIN)) continue;
```

Za:
- dolina: +18 % srebra w 150 min (+30 % w 60 min), −38 % m na jednostkę, −29 % kursów, `OUTPUT_FULL.NO_WAGON` 6,9 % → 0 %;
- zero nowych przyczyn postoju i zero „mylących” statusów; bez nowego stanu, migracji i zmian haszy misji;
- 2 testy do świadomego przestrojenia zamiast 12–17 i ponownego strojenia 12 misji.

Przeciw:
- dolina robi się łatwiejsza: ranga 3 i 4 o ~8 i ~11 min wcześniej niż dziś (38 / 67 min wobec okien 40–50 / 70–90) →
  trzeba podnieść progi rang ~+10 % albo obniżyć ceny rynku i przemierzyć `balance.ts sandbox`;
- „Brak wozu” w dolinie praktycznie znika jako problem — gracz kupi mniej wozów (to zmienia pacing ekonomii doliny);
- zimowa rywalizacja o zboże (F1) słabnie — test do przestrojenia lub scenariusza z ciaśniejszą flotą;
- „wóz stoi, a towar leży” bez postoju — warto jedno zdanie na karcie warsztatu (UI, i18n).

Odrzucone: d4/d6/d4w/eta4 dla misji (łamią drabinkę 9–12 razy, porażki m1/m8), d4t8 (≈ base, a wymaga stanu),
late4 (≈ base). Gdyby właściciel chciał tej samej logiki w misjach — tylko jako osobne zadanie „przestrojenie misji I–XII
pod pełniejsze ładunki” z pełną tabelą balansu.

## 6. Decyzja właściciela

**Pytanie:** Czy w wolnej dolinie warsztaty mają zamawiać dowóz dopiero wtedy, gdy zmieszczą co najmniej 4 sztuki
(pełniejsze wozy: +18 % srebra, mniej kursów, ale rangi 3–4 przychodzą ~10 min wcześniej i trzeba przestroić ich progi)?

- **A — tak, tylko w dolinie; misje bez zmian** (+ przestrojenie progów rang i testu F1, zdanie na karcie warsztatu). **← rekomendowane**
- B — tak, w dolinie i w misjach (przestrojenie wszystkich 12 misji i haszy golden; kilka dni pracy).
- C — nie; zostaje dowóz po sztuce, poprawiamy tylko wpis w backlogu (realne kursy po 1 szt. są rzadsze, niż pisze wpis).

## 7. Jak powtórzyć

```bash
cd /workspace/marchi-research
node tools/partial-loads-patch.mjs /tmp/pl            # kopia z regułami i sondą (src/ nietknięte)
cd /tmp/pl
for p in base d4 d6 d4t8 d4w eta4 late4 sb4; do
  LOAD_POLICY=$p npx tsx tools/partial-loads.ts > /tmp/res-$p.jsonl          # 45 biegów, ~1 min na regułę
done
SANDBOX_MIN=150 LOAD_POLICY=sb4 npx tsx tools/partial-loads.ts sandbox      # dolina 150 min
node tools/partial-loads-summary.mjs /tmp/res-{base,d4,d6,d4t8,d4w,eta4,late4,sb4}.jsonl
LOAD_POLICY=sb4 npx tsx tests/run.ts                                         # wpływ na testy (SUMMARY w ostatniej linii)
```

Sanity: `LOAD_POLICY=base` musi dać te same hasze co prawdziwe `src/` (np. `runStrategy('m5', …)`) i `npm test` 412/0.
