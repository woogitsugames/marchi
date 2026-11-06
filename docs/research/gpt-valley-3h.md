# Dolina — trzy godziny z botem

Stan: `b020c577debddb24cdacba06b11dbbf005f7c0d1`, 6 listopada 2026. Uruchomiono `node --import tsx tools/valley-3h.ts --seeds 1301,1302,1303,1304 --json …` i `node --import tsx tools/sandbox-first30.ts --minutes 90 --only card-10,card-30,card-60,decent`. Odpowiada to zleceniu przez inny sposób uruchomienia TypeScript (CLI tsx nie może utworzyć gniazda IPC). To symulacja, nie test z ludźmi.

Pierwszy program zakończył się kodem 1: cztery przebiegi strategii `grow` zgłaszają `road to the trading post: BLOCKED, cell 2439`. Pozostałe raportują zero naruszeń. Drugi zakończył się kodem 0.

**Sprzedaż w posterunku:** podstawowy program nie eksportuje jej w raporcie, więc dla strategii `decent` powtórzono cztery symulacje z tymczasowym odczytem końcowego `st.tradePost.sold`. Wynik to liczba jednostek towarów, nie srebro; sprzedaż wędrownego kupca (`merchantSilver`) jest odrębna.

| Strategia | Seed | Ranga | Zarobione srebro | Monety na koniec | Wozy | Kupiec: srebro | Naruszenia |
|---|---:|---:|---:|---:|---:|---:|---|
| passive | 1301 | 0 | 1803 | 2063 | 2 | 0 | — |
| passive | 1302 | 0 | 1940 | 2200 | 2 | 0 | — |
| passive | 1303 | 0 | 1807 | 2067 | 2 | 0 | — |
| passive | 1304 | 0 | 1880 | 2140 | 2 | 0 | — |
| decent | 1301 | 5 | 31358 | 29908 | 30 | 0 | — |
| decent | 1302 | 5 | 31763 | 30313 | 30 | 0 | — |
| decent | 1303 | 5 | 31239 | 29789 | 30 | 0 | — |
| decent | 1304 | 5 | 31677 | 30227 | 30 | 0 | — |
| decent-nopost | 1301 | 5 | 24944 | 23541 | 30 | 0 | — |
| decent-nopost | 1302 | 5 | 25193 | 23790 | 30 | 0 | — |
| decent-nopost | 1303 | 5 | 24931 | 23528 | 30 | 0 | — |
| decent-nopost | 1304 | 5 | 25053 | 23650 | 30 | 0 | — |
| decent+eye | 1301 | 5 | 31555 | 30078 | 30 | 0 | — |
| decent+eye | 1302 | 5 | 31926 | 30449 | 30 | 0 | — |
| decent+eye | 1303 | 5 | 31270 | 29793 | 30 | 0 | — |
| decent+eye | 1304 | 5 | 31732 | 30255 | 30 | 0 | — |
| orders | 1301 | 5 | 33552 | 32102 | 30 | 0 | — |
| orders | 1302 | 5 | 33634 | 32184 | 30 | 0 | — |
| orders | 1303 | 5 | 34616 | 33166 | 30 | 0 | — |
| orders | 1304 | 5 | 33530 | 32080 | 30 | 0 | — |
| merchant | 1301 | 5 | 31560 | 30110 | 30 | 105 | — |
| merchant | 1302 | 5 | 31810 | 30360 | 30 | 81 | — |
| merchant | 1303 | 5 | 31791 | 30341 | 30 | 155 | — |
| merchant | 1304 | 5 | 32001 | 30551 | 30 | 167 | — |
| eager | 1301 | 5 | 33838 | 32388 | 30 | 208 | — |
| eager | 1302 | 5 | 33805 | 32355 | 30 | 162 | — |
| eager | 1303 | 5 | 34579 | 33129 | 30 | 139 | — |
| eager | 1304 | 5 | 34584 | 33134 | 30 | 185 | — |
| small | 1301 | 3 | 11133 | 10555 | 6 | 0 | — |
| small | 1302 | 3 | 11195 | 10829 | 6 | 0 | — |
| small | 1303 | 3 | 10885 | 10519 | 6 | 0 | — |
| small | 1304 | 3 | 11062 | 10696 | 6 | 0 | — |
| eye | 1301 | 5 | 31358 | 29908 | 30 | 0 | — |
| eye | 1302 | 5 | 31763 | 30313 | 30 | 0 | — |
| eye | 1303 | 5 | 31239 | 29789 | 30 | 0 | — |
| eye | 1304 | 5 | 31677 | 30227 | 30 | 0 | — |
| passive+granary | 1301 | 0 | 1734 | 1964 | 2 | 0 | — |
| passive+granary | 1302 | 0 | 1867 | 2097 | 2 | 0 | — |
| passive+granary | 1303 | 0 | 1738 | 1968 | 2 | 0 | — |
| passive+granary | 1304 | 0 | 1816 | 2046 | 2 | 0 | — |
| passive+wagon | 1301 | 0 | 2350 | 2580 | 3 | 0 | — |
| passive+wagon | 1302 | 1 | 2529 | 2759 | 3 | 0 | — |
| passive+wagon | 1303 | 1 | 2415 | 2645 | 3 | 0 | — |
| passive+wagon | 1304 | 0 | 2425 | 2655 | 3 | 0 | — |
| passive+2wagons | 1301 | 1 | 2365 | 2565 | 4 | 0 | — |
| passive+2wagons | 1302 | 1 | 2423 | 2623 | 4 | 0 | — |
| passive+2wagons | 1303 | 1 | 2364 | 2564 | 4 | 0 | — |
| passive+2wagons | 1304 | 1 | 2395 | 2595 | 4 | 0 | — |
| small+granary | 1301 | 3 | 10892 | 10284 | 6 | 0 | — |
| small+granary | 1302 | 3 | 10999 | 10391 | 6 | 0 | — |
| small+granary | 1303 | 3 | 10811 | 10203 | 6 | 0 | — |
| small+granary | 1304 | 3 | 11283 | 10675 | 6 | 0 | — |
| small+2wagons | 1301 | 3 | 13394 | 12756 | 8 | 0 | — |
| small+2wagons | 1302 | 3 | 13378 | 12740 | 8 | 0 | — |
| small+2wagons | 1303 | 3 | 12924 | 12286 | 8 | 0 | — |
| small+2wagons | 1304 | 3 | 13383 | 12745 | 8 | 0 | — |
| passive+wagon-on-red | 1301 | 1 | 2336 | 2536 | 4 | 0 | — |
| passive+wagon-on-red | 1302 | 1 | 2361 | 2561 | 4 | 0 | — |
| passive+wagon-on-red | 1303 | 1 | 2394 | 2594 | 4 | 0 | — |
| passive+wagon-on-red | 1304 | 1 | 2403 | 2603 | 4 | 0 | — |
| small+wagon-on-red | 1301 | 5 | 23364 | 22124 | 23 | 0 | — |
| small+wagon-on-red | 1302 | 5 | 22508 | 21268 | 23 | 0 | — |
| small+wagon-on-red | 1303 | 5 | 19922 | 18802 | 19 | 0 | — |
| small+wagon-on-red | 1304 | 5 | 20785 | 19695 | 18 | 0 | — |
| grow | 1301 | 5 | 28123 | 26455 | 34 | 0 | step "road to the trading post" failed: {"k":"BLOCKED","cell":2439} |
| grow | 1302 | 5 | 28252 | 26584 | 34 | 0 | step "road to the trading post" failed: {"k":"BLOCKED","cell":2439} |
| grow | 1303 | 5 | 27952 | 26284 | 34 | 0 | step "road to the trading post" failed: {"k":"BLOCKED","cell":2439} |
| grow | 1304 | 5 | 28110 | 26442 | 34 | 0 | step "road to the trading post" failed: {"k":"BLOCKED","cell":2439} |
| decent+market7 | 1301 | 5 | 32105 | 30655 | 30 | 0 | — |
| decent+market7 | 1302 | 5 | 32338 | 30888 | 30 | 0 | — |
| decent+market7 | 1303 | 5 | 32099 | 30649 | 30 | 0 | — |
| decent+market7 | 1304 | 5 | 32543 | 31093 | 30 | 0 | — |
| decent+market5 | 1301 | 5 | 34296 | 32846 | 30 | 0 | — |
| decent+market5 | 1302 | 5 | 34456 | 33006 | 30 | 0 | — |
| decent+market5 | 1303 | 5 | 33726 | 32276 | 30 | 0 | — |
| decent+market5 | 1304 | 5 | 34052 | 32602 | 30 | 0 | — |
| greedy | 1301 | 5 | 31879 | 27279 | 135 | 0 | — |
| greedy | 1302 | 5 | 32056 | 27426 | 136 | 0 | — |
| greedy | 1303 | 5 | 31839 | 27209 | 136 | 0 | — |
| greedy | 1304 | 5 | 32001 | 27341 | 137 | 0 | — |
| orders-r1x | 1301 | 5 | 32449 | 30999 | 30 | 0 | — |
| orders-r1x | 1302 | 5 | 32494 | 31044 | 30 | 0 | — |
| orders-r1x | 1303 | 5 | 32367 | 30917 | 30 | 0 | — |
| orders-r1x | 1304 | 5 | 31722 | 30272 | 30 | 0 | — |
| orders-r0.5x | 1301 | 5 | 31070 | 29620 | 30 | 0 | — |
| orders-r0.5x | 1302 | 5 | 31641 | 30191 | 30 | 0 | — |
| orders-r0.5x | 1303 | 5 | 31806 | 30356 | 30 | 0 | — |
| orders-r0.5x | 1304 | 5 | 31790 | 30340 | 30 | 0 | — |
| orders-r0x | 1301 | 5 | 30880 | 29430 | 30 | 0 | — |
| orders-r0x | 1302 | 5 | 30416 | 28966 | 30 | 0 | — |
| orders-r0x | 1303 | 5 | 30104 | 28654 | 30 | 0 | — |
| orders-r0x | 1304 | 5 | 28964 | 27514 | 30 | 0 | — |

## Sprzedaż posterunku: strategia decent po 180 minutach

| Seed | Drewno | Deski | Zboże | Mąka | Chleb | Ryby | Kamień | Węgiel | Słód | Piwo |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1301 | 216 | 654 | 210 | 234 | 780 | 588 | 480 | 282 | 276 | 594 |
| 1302 | 246 | 672 | 180 | 234 | 828 | 600 | 492 | 288 | 330 | 612 |
| 1303 | 264 | 666 | 222 | 198 | 786 | 588 | 492 | 276 | 300 | 594 |
| 1304 | 252 | 642 | 150 | 264 | 822 | 612 | 496 | 282 | 306 | 606 |

Odtworzenie: w tymczasowej kopii `tools/valley-3h.ts` dodać pole `postSold: { ...st.tradePost?.sold }` do obiektu zwracanego przez `runValley`, następnie uruchomić kopię z `decent --seeds 1301,1302,1303,1304 --json …`. Modyfikacja tylko odczytuje licznik symulacji i nie jest częścią repozytorium.

## Sterowanie według karty — 90 minut

Wyniki poniżej przepisano z podsumowania drugiego narzędzia; wartości w nawiasach to minuty osiągnięcia rang 1–5, `-1` oznacza brak rangi.

```text
card-10            seed default rank 4 [9.5 / 23.9 / 40 / 72.7 / -1] earned 9891 coins 4850 wagons 142 bld 38 orders 2/0 merch 1 chron 24 paceWrong 0 fleetWrong 0 {"build:farm":1,"wagon":113,"wagon:card":27,"build:mill":1,"build:bakery":1,"grow:farm":2,"grow:mill":2,"grow:bakery":1,"grow:woodcutter":2,"grow:sawmill":2,"build:fisher":1,"build:quarry":1,"grow:fisher":8,"granary":10}
card-30            seed default rank 4 [8.9 / 24.9 / 40.5 / 72.4 / -1] earned 10398 coins 9049 wagons 30 bld 26 orders 2/0 merch 1 chron 24 paceWrong 0 fleetWrong 0 {"build:farm":1,"wagon:card":23,"wagon":5,"build:mill":1,"build:bakery":1,"grow:farm":2,"grow:mill":2,"grow:bakery":2,"grow:woodcutter":2,"grow:sawmill":2,"build:fisher":1,"build:quarry":1,"grow:fisher":3,"granary":2,"road":1}
card-60            seed default rank 3 [10.4 / 28 / 50.8 / -1 / -1] earned 7097 coins 6375 wagons 20 bld 18 orders 2/0 merch 1 chron 22 paceWrong 0 fleetWrong 0 {"build:farm":1,"wagon:card":18,"build:mill":1,"build:bakery":1,"grow:farm":1,"grow:mill":1,"grow:bakery":1,"grow:woodcutter":2,"grow:sawmill":1,"build:fisher":1,"grow:fisher":1,"build:quarry":1}
decent             seed default rank 4 [6.8 / 20.3 / 40.4 / 74.2 / -1] earned 11005 coins 9555 wagons 30 bld 24 orders 2/0 merch 1 chron 29 paceWrong 0 fleetWrong 0 {}
```

## Obserwacje

- Dla `decent`, we wszystkich czterech seedach bot osiąga rangę 5 w ciągu trzech godzin; w wariancie 90-minutowym pozostaje na randze 4. Jest to wynik zaprogramowanej strategii, a nie estymata zachowania przeciętnego gracza.
- Wszystkie cztery przebiegi `grow` nie zrealizowały planowanego odcinka drogi do posterunku. Trzeba sprawdzić konflikt planu budowy z komórką 2439 przed wyciąganiem wniosków o potencjale posterunku.
- W 90-minutowym przebiegu `card-10` bot kończy ze 142 wozami, wobec 30 i 20 w `card-30` i `card-60`; należy zbadać powtarzane zakupy przed uznaniem tej strategii za reprezentatywną.
- Tabela sprzedaży dotyczy tylko strategii `decent`; sprzedaży pozostałych strategii nie zmierzono.
