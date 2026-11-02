# Budżet replanowania wozów po zmianie sieci (netVersion) — pomiar i rekomendacja

Data: 2026-11-02 · branch `claude/w-research2` · skrypt: `npx tsx tools/perf-replan.ts [runs] [interwał s]`

## TL;DR

- Problem z backlogu ("wszystkie wozy replanują w jednej klatce") jest **przeszacowany**: `ensurePath` woła się tylko dla wozu stojącego w węźle (`next < 0`), więc fala replanów po komendzie rozlewa się naturalnie na ~10 ticków (ok. 36/55/58 replanów w 10 ticków dla 50/100/200 wozów; w pierwszym ticku mediana 4/10/13, maks 27/32/42).
- Koszt jednego `findPath` na mapie benchmarku to ok. **0,02–0,04 ms** (cloud), przebudowa `net()` ok. 0,1 ms + tablice kosztów ok. 0,3-0,5 ms. Pierwszy tick po komendzie: mediana z 7 uruchomień maks. **2,0 / 2,5 / 7,0 ms** (200 / 100 / 50 wozów); to nie jest wyraźnie gorsze od ticków bez zmiany sieci (patrz niżej: ticki dispatchu i zwykłe replany nowych zadań).
- Teoretyczny najgorszy przypadek (wszystkie 200 wozów replanuje w jednym ticku): **ok. 4,2 ms** (po rozgrzaniu; pierwszy raz 21 ms z JIT).
- Rekomendacja: **nie robić teraz** jako P1. Zostawić jako P3 z gotowym, tanim projektem (niżej); ważniejsze źródła skoków to tick z `dispatch` i replany po zmianie zadań, nie netVersion.

## Założenia pomiaru

- Kontener chmurowy, 4 vCPU, Node 22.23, `tsx`. Telefon jest ok. **4-6x wolniejszy** (założenie, nie pomiar) — wartości "mobile" to mnożenie, nie wynik z urządzenia.
- Świat: `benchWorld(n)` (mapa "lab", 2 mosty, 2 rzędy dróg, spichlerze i konsumenci), 60 s rozgrzewki, potem 5 minut gry (3000 ticków), komenda sieciowa co 10 s (30 komend). Siedem uruchomień (determinizm sym: te same ticki, zmienia się tylko szum czasowy), podawane **mediany z uruchomień**.
- Cykl komend (7 kroków): most drewniany C, droga-odnoga, `place` magazynu, ulepszenie odnogi do bruku, wyburzenie końcówki odnogi, wyburzenie komórki mostu C (próbuje komórek bez wozu), ponowne postawienie mostu. 3 z 30 komend odrzucone (wóz na drodze `WAGON_ON_ROAD` / blokada) i nie liczone.
- Liczba `findPath` na tick: liczona jako liczba wozów, którym `pathVer` skoczył na bieżący `netVersion` (nie obejmuje rzadkich replanów w korku mostowym i ponowień NO_ROUTE).
- "tick po zmianie" = pierwszy `step` po komendzie; "fala" = ticki 1-10 po komendzie; "spokojne" = pozostałe.

## Wyniki (komenda co 10 s, mediana z 7 uruchomień, ms/tick)

| wozy | spokojne p50 | spokojne p99 | spokojne max | 1. tick po zmianie (max) | fala p99 | fala max | replany w 1. ticku (med/maks) | replany w 10 tickach (med) | koszt komendy | ms/replan |
|---|---|---|---|---|---|---|---|---|---|---|
| 50 | 0,02 | 4,77 | 30,9 | 7,04 | 4,36 | 12,1 | 4 / 27 | 36 | 0,03 | 0,04 |
| 100 | 0,03 | 1,14 | 7,7 | 2,45 | 1,84 | 2,45 | 10 / 32 | 55 | 0,01 | 0,04 |
| 200 | 0,04 | 0,78 | 6,3 | 1,97 | 1,53 | 3,48 | 13 / 42 | 58 | 0,01 | 0,04 |

Przy komendzie co 3 s (5 uruchomień): 1. tick maks 9,2 / 3,6 / 4,0 ms, fala maks 11,3 / 4,1 / 6,7 ms (50/100/200 wozów).

Referencja `npm run perf:sim` (bez komend): max/tick 18,2 / 8,8 / 9,7 ms, p99 6,3 / 2,1 / 0,8 ms.

Spostrzeżenia:

1. Spiki zależą od **fazy dispatchu** (co 5 tick; mediana tego ticku 0,76 ms przy 50 wozach, maks 10,8 ms), nie od netVersion. Wysokie "spokojne max" przy 50 wozach (31 ms) to GC/JIT i dispatch, występuje bez komend.
2. W ticku **bez** zmiany sieci replanuje się też do 34 wozów naraz (10-20% ticków ma >=1 replan; 27-40% przy komendzie co 3 s) — to replany po zmianie zadania/celu (`pathVer = -1`), których budżet z backlogu nie obejmuje.
3. Mniej wozów nie znaczy taniej: w benchu przy 200 wozach wiele stoi (korki/oczekiwanie), tylko ok. 109 jedzie.
4. Mobile (x4-6): typowy pierwszy tick 2-2,5 ms => ok. 8-15 ms; wersja 50-wozowa 7 ms => 28-42 ms (głównie zbieżność z dispatchem). Budżet klatki 16,6 ms na x1 to 1 tick sim na ~6 klatek, więc pojedyncza klatka z ciężkim tickiem = jeden zauważalny przycisk (frame hitch), nie ciągłe spowolnienie. Przy 4x (40 tick/s) prawie każda klatka ma 0-1 tick.

## Ocena: czy warto

Dla realistycznych rozmiarów (do 200 wozów) replan po komendzie to ok. 0,5-2 ms desktop, czyli 3-12 ms mobile — mieści się w jednej klatce i jest rzadkim zdarzeniem wywołanym przez gracza (po komendzie gracz i tak ogląda zmianę). Największy dostępny zysk (zdjęcie 30-40% szczytów) leży w dispatchu i w replanach zadaniowych. **Rekomendacja: odłożyć (P3), najpierw pomiar na urządzeniu.** Wrócić, jeśli profil na telefonie pokaże tick > 25 ms po komendzie albo gdy MAX_WAGONS wzrośnie powyżej 200.

## Minimalny deterministyczny projekt (gdyby jednak)

1. **Bez kolejki w stanie.** Kolejność jest już deterministyczna (iteracja `st.wagons` po kolei). Wystarczy licznik budżetu `replansLeft` w scratchu świata, zerowany w `stepWagons` na początku ticku (nie jest częścią stanu, nie trafia do zapisu ani do hasha). Zapobieganie głodzeniu: start iteracji od `st.tick % wagons.length` (obrót deterministyczny z tickiem), albo rotacja po id.
2. **Reguła w `ensurePath`**: jeśli `pathVer !== netVersion`, ale `path.length > 0`, `path[last] === dest` i `hasEdge(at, path[0])` — oraz budżet wyczerpany — wóz jedzie dalej starą ścieżką do następnego węzła (`pathVer` zostaje stary, więc spróbuje ponownie w kolejnym węźle/ticku). Bez ścieżki, ze zmienionym celem (`dest`) lub bez krawędzi — replan natychmiast i poza budżetem (to wozy faktycznie dotknięte).
3. **Wóz na usuniętej drodze**: demolish już teraz odmawia, gdy `w.at` lub `w.next` równa się komórce (`WAGON_ON_ROAD`), a w węźle pierwszy krok ścieżki jest zawsze sprawdzany `hasEdge`; wóz więc nigdy nie wjedzie na wyburzoną drogę. Wyburzony most/odcinek dalej na starej ścieżce wykryje się w kolejnym węźle (`hasEdge` fałsz => replan obowiązkowy poza budżetem). Dodatkowo test: stara ścieżka przez wyburzoną drogę, 200 wozów, żaden `edgeT` na nieistniejącej krawędzi.
4. **Zachowanie towarów**: ścieżka nie wpływa na `job`, `reservedOut`, `incoming` ani `cargoQty`; zmienia się tylko czas dojazdu. Testy zachowania (invariants co tick) pozostają prawdziwe. Uwaga na `NO_ROUTE`: nie opóźniać ponowień wozów w NO_ROUTE po naprawie sieci (pozostawić poza budżetem, jest ich mało).
5. **Determinizm i golden hash**: zmiana nie dodaje pól stanu. Wozy w misjach I-VI jest niewiele (<= ok. 10), więc przy N = 8-16 replanów/tick budżet nigdy się nie wyczerpie, zachowanie bit-w-bit takie samo i golden hashe (`chains.test.ts`, v4) zostają. Przy mniejszym N lub scenariuszach z dużą flotą hashe się zmienią (inna trajektoria) i trzeba je świadomie przegenerować z wpisem D-NN. Do zastosowania także w testach save/load: scratch zerowany co tick, więc zapis w połowie ticku niczego nie gubi.
6. **Cena**: wozy mogą przez kilka ticków (przy N = 8 i 200 wozach najwyżej ok. 2,5 s) nie korzystać z nowego skrótu; wyścig dwóch wozów o most może zmienić się w stosunku do dzisiaj — do przetestowania pod kątem `BRIDGE_JAM` (rywal ustalany po `since`/id, więc bez zmian, ale stare ścieżki mogą dłużej kierować do zapchanego mostu).

## Ryzyka

- Zmiana zachowania (opóźnione skróty) w grze, w której gracz ocenia trasę natychmiast po budowie; diagnoza ("dlaczego wóz jedzie tamtędy") może pokazywać starą trasę — `diagnose.ts` już sprawdza `pathVer`, więc pokaże świeży plan (rozbieżność z faktyczną jazdą: trzeba to ujednolicić).
- Zysk niewielki względem kosztu testów determinizmu; wymaga nowego testu mierzącego max replanów/tick i testu "żaden wóz na usuniętej krawędzi".
- Pomiar jest na jednej mapie/scenariuszu (bench "lab"); realny gracz ma więcej węzłów i dłuższe ścieżki — `findPath` rośnie z liczbą komórek dróg, więc koszt per replan może być 2-3x większy w dużych osadach. Przed rozstrzygnięciem warto ponowić na zapisie z dużej osady.
