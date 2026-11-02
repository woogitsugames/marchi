# Skok kosztu ticku dispatchu — przyczyna i minimalna poprawka

Data: 2026-11-02 · branch `claude/w-research3` · narzędzie: `npx tsx tools/perf-dispatch.ts [scenariusze]` (nie zmienia `src/`)
Kontynuacja `docs/research/2026-11-02-replan-budget.md` (tam: dispatch co 5. tick do 10,8 ms przy 50 wozach).

## TL;DR

- **Przyczyna:** `dispatch()` (co `DISPATCH_INTERVAL = 5` ticków) buduje `DistCache` od zera i uruchamia **pełne Dijkstry po całej mapie** (6912 komórek, 2 świeże tablice typed array na wywołanie) dla każdego źródła kandydującego i każdej fabryki z nadwyżką. Dijkstra to **ok. 60-80% czasu ticku dispatchu**.
- **Większość tych Dijkstr jest zbędna:** przy 50 wozach średnio 18,6 Dijkstr na dispatch, z czego **12,2 z 13,7 w pętli przydziału liczy się, gdy nie ma ani jednego wolnego wozu** (nic nie da się przydzielić; liczy się tylko `best != null`, czyli osiągalność). Przy 100 wozach 5,6 z 8,6. W m1/m5/m9/sandbox to 1,4-2,7 z 1,7-2,7 wywołań.
- Nie to jest `findPath` nowych zadań: w ticku dispatchu `findPath` kosztuje średnio 0,00-0,09 ms, a `stepWagons` w tym samym ticku p50 0,01-0,02 ms.
- **Minimalna poprawka A ("free0")**: gdy `free.length === 0`, odpowiedź "czy źródło jest osiągalne" brać z etykiet spójnych składowych sieci (BFS raz na `netVersion`) zamiast Dijkstry. Wynik dispatchu **bit-w-bit ten sam** (273 skrótów stanu identycznych w 3 benchach + 17 strategii misji + sandbox 60 min). Zysk: średni czas ticku dispatchu przy 50 wozach **2,57 -> 0,58 ms**, p95 **9,98 -> 1,05 ms**, p50 1,18 -> 0,10 ms.
- **Poprawka B ("pool")**: recykling tablic `dist/prev` między dispatchami (zero alokacji w Dijkstrze). Również bez zmiany wyniku. Samodzielnie: p95 bench100 5,09 -> 1,11 ms; razem z A: bench50 avg **0,31 ms**, p95 **0,86 ms**, p99 4,76 ms.
- Rekomendacja: wdrożyć A (+ B), P2. Koszt: ok. 40 linii w `network.ts`/`logistics.ts`, zero zmian stanu i hashy.

## Metoda

`tools/perf-dispatch.ts` kopiuje `src/` i `tools/` do katalogu tymczasowego, wstawia w KOPII `performance.now()` w `step`, `dispatch` (fazy), `DistCache` (każde Dijkstra: kierunek, czas, powtarzalność wyniku) i `findPath`, po czym uruchamia scenariusze z tymi samymi botami co `tools/balance.ts` i `tools/bot-sandbox.ts`. Logika nie jest zmieniana (sprawdzone: skrót stanu kopii = oryginał, patrz niżej). Scenariusze:

- `bench50/100/200` — `benchWorld(n)` (mapa lab, 41 budynków), 60 s rozgrzewki + 4 min, 3 uruchomienia scalone (1440 ticków dispatchu na scenariusz);
- `m1` (most + 2 wozy), `m5` (połączenie spichlerza + wóz), `m9` (strategia "właściwa") — pełna misja do końca;
- `sandbox` — bot DECENT, 60 min (21600 dispatchów). Nie ma fixtury dużej osady; sandbox z DECENT ma kilkanaście wozów, więc **duża osada jest niepokryta** (patrz Ryzyka).

**Zastrzeżenie o szumie:** w trakcie pomiarów load average kontenera wynosił ok. 18 na 4 vCPU (inne worktree uruchamiały testy). Wartości **max** są zanieczyszczone (zwykłe ticki bez dispatchu miały max do 165-220 ms, a pojedyncze Dijkstry po 100-300 ms), dlatego decyzje opieram na p50/p95/p99 i na średnich oraz na licznikach wywołań, które są deterministyczne. Wartość 10,8 ms z poprzedniego raportu (spokojniejsza maszyna) zgadza się z p95-p99 poniżej.

## Wyniki bazowe (kod bez zmian), tick dispatchu

| scenariusz | p50 / p95 / p99 / max ms | ticki bez dispatchu p50 / p95 ms | Dijkstra: ms śr. (udział) | wywołań Dijkstry śr. / max | z tego w pętli przydziału bez wolnego wozu | ten sam wynik co w poprzednim dispatchu |
|---|---|---|---|---|---|---|
| bench50 | 1,18 / 9,98 / 21,62 / 113 | 0,02 / 0,06 | 1,62 (63%) | 18,58 / 30 | 12,24 | 76% |
| bench100 | 0,73 / 5,09 / 20,94 / 176 | 0,02 / 0,07 | 0,99 (58%) | 11,20 / 27 | 5,61 | 53% |
| bench200 | 0,06 / 0,87 / 4,34 / 41 | 0,03 / 0,07 | 0,16 (48%) | 3,56 / 24 | 0,00 | 29% |
| m1 | 0,10 / 0,22 / 4,24 / 128 | 0,00 / 0,00 | 0,25 (71%) | 3,60 / 6 | 2,65 | 97% |
| m5 | 0,08 / 0,18 / 4,18 / 107 | 0,00 / 0,01 | 0,17 (60%) | 3,46 / 8 | 1,67 | 99% |
| m9 | 0,09 / 0,18 / 3,72 / 287 | 0,00 / 0,01 | 0,31 (73%) | 3,05 / 7 | 1,60 | 99% |
| sandbox | 0,10 / 0,24 / 1,59 / 105 | 0,00 / 0,01 | 0,10 (53%) | 3,43 / 12 | 1,38 | 97% |

(Kolumna "ten sam wynik" = ten sam wektor odległości dla tego samego (start, kierunek) co w poprzednim dispatchu — miara szansy trafienia dla pamięci podręcznej między dispatchami.)

### Fazy wewnątrz dispatchu (p50 / p95 / max ms; max zaszumione)

| scenariusz | demands+sort | pętla przydziału (szukanie źródła + pickWagon) | market | surplus push | diagnose | razem |
|---|---|---|---|---|---|---|
| bench50 | 0,01 / 0,02 / 60 | 0,75 / 6,56 / 73 | 0,00 / 0,00 / 4,6 | 0,23 / 1,78 / 31 | 0,02 / 0,04 / 5,3 | 1,14 / 9,50 / 73 |
| bench100 | 0,01 / 0,01 / 88 | 0,54 / 1,35 / 107 | 0,00 / 0,00 / 0,0 | 0,01 / 0,46 / 176 | 0,01 / 0,03 / 2,7 | 0,69 / 3,49 / 176 |
| bench200 | 0,01 / 0,01 / 40 | 0,00 / 0,72 / 16 | 0,00 / 0,00 / 0,0 | 0,00 / 0,02 / 4,3 | 0,01 / 0,02 / 0,1 | 0,02 / 0,79 / 41 |
| m1 | 0,00 / 0,01 / 1,2 | 0,07 / 0,14 / 128 | 0,00 / 0,00 / 0,0 | 0,00 / 0,00 / 4,1 | 0,02 / 0,08 / 46 | 0,10 / 0,20 / 128 |
| m5 | 0,00 / 0,01 / 5,8 | 0,03 / 0,12 / 80 | 0,00 / 0,00 / 0,2 | 0,02 / 0,08 / 107 | 0,00 / 0,05 / 6,9 | 0,08 / 0,17 / 107 |
| m9 | 0,00 / 0,01 / 29 | 0,04 / 0,12 / 287 | 0,00 / 0,00 / 0,1 | 0,00 / 0,03 / 56 | 0,00 / 0,08 / 142 | 0,08 / 0,16 / 287 |
| sandbox | 0,00 / 0,01 / 4,1 | 0,04 / 0,14 / 105 | 0,00 / 0,03 / 17 | 0,02 / 0,11 / 33 | 0,00 / 0,01 / 15 | 0,09 / 0,23 / 105 |

Wniosek: koszt siedzi w **pętli przydziału** (szukanie najbliższego źródła dla każdego niezaspokojonego popytu) i w **surplus push** (`dc.from(b.gate)` dla każdego producenta z prawie pełnym magazynem); `demands`, `market` i `diagnose` są śladowe. Zadania nowych wozów (`findPath`) w ticku dispatchu: 0,00-0,09 ms średnio, `stepWagons` p50 0,01-0,02 ms.

## Top funkcje i złożoność

| funkcja | rola | koszt |
|---|---|---|
| `dijkstra` (przez `DistCache.from/to`) | pełny przebieg po 6912 komórkach, `new Float64Array(n)` + `new Int32Array(n)` (83 KB) na wywołanie, bez wczesnego stopu | ok. 0,05-0,09 ms/wywołanie + alokacja/GC; 60-80% ticku |
| pętla `for d of demands` x `sourcesOf(g)` | dla każdego popytu każde źródło daje `dc.from(s.gate)` | O(popyty x źródła) wywołań, ale z cache `DistCache` ograniczone do liczby **różnych bramek źródeł** (ok. 18 przy 50 wozach) |
| surplus push | `dc.from(b.gate)` dla każdego producenta (cache) | do liczby producentów |
| `sourcesOf` | `buildings.filter` po każdym popycie | O(popyty x budynki), pomijalne przy 41 budynkach |
| `findPath`, `diagnose`, `pickWagon`, market | | < 0,1 ms |

Złożoność dispatchu: O(D x S) sprawdzeń kandydatów, ale dominuje **O(G_źródeł x N_komórek x log)** — liczba różnych bramek x pełna mapa — bo `DistCache` żyje tylko w obrębie jednego dispatchu i jest budowany od zera co 5 ticków (1 s sim = 8 ticków/s... tu: co 5 ticków). Najbardziej marnotrawny przypadek to **brak wolnych wozów**: dokładnie wtedy gracz ma najwięcej niespełnionych popytów (`NO_WAGON/ALL_BUSY`), a mimo to każdy z nich liczy pełne odległości, choć wynik nie wpływa na przydział (tylko na rozróżnienie `NO_INPUT` vs `ALL_BUSY`, czyli na osiągalność). Dlatego "mniej wozów = więcej Dijkstr na dispatch" (18,6 / 11,2 / 3,6 dla 50 / 100 / 200 wozów).

Spike w p95/p99 to więc nie pojedyncza wolna funkcja, tylko **dispatchy, w których równocześnie kilkanaście bramek źródeł nie było jeszcze policzonych** (30 Dijkstr to ok. 2-3 ms bez szumu, a świeże 83 KB alokacje dodatkowo wyzwalają GC — wariant "pool" zbija p95 bench100 z 5,09 do 1,11 ms).

## Proponowane poprawki

### A. Osiągalność z etykiet składowych, gdy nie ma wolnego wozu (zalecana)

W `logistics.ts` (trzy miejsca): pętla kandydatów popytu (`const t = dc.from(s.gate).dist[d.b.gate]`) i surplus push (`const fwd = dc.from(b.gate)`, `fwd.dist[wh.gate]`). Gdy `free.length === 0` używać `reachable(world, a, b)` (nowa funkcja w `network.ts`: etykiety składowych spójności z `edgeMask`, liczone raz na `netVersion`, trzymane w `NetCache`, nie w stanie) i traktować wynik jako `0` lub `Infinity`. Wartość `best` bez wolnych wozów służy tylko do sprawdzenia `best !== null`, więc rozstrzygnięcia `unmet` / `pushFail` i `diagnose` zostają takie same.

Założenia, które sprawdza `PERF_CHECK=1` (rzuca wyjątek przy rozbieżności `reachable` vs `dist < Infinity` w każdym użyciu, wszystkie scenariusze przeszły): krawędzie symetryczne (maska budowana z `hasEdge`), koszty skończone dla każdej krawędzi maski, `dist[start]=0` tylko gdy start jest drogą (etykieta -1 poza drogą). Kontrola: jeśli kiedyś pojawią się jednokierunkowe krawędzie lub koszt `Infinity` dla krawędzi z maski (np. lód na moście), `reachable` trzeba zastąpić dwukierunkowym BFS.

Zysk (pomiar w kopii, 3 uruchomienia, ticki dispatchu; ms średnio / p95 / p99):

| scenariusz | baza | A | A + B (pool) |
|---|---|---|---|
| bench50 | 2,57 / 9,98 / 21,6 | 0,58 / 1,05 / 8,2 | 0,31 / 0,86 / 4,8 |
| bench100 | 1,72 / 5,09 / 20,9 | 0,31 / 0,94 / 2,7 | 0,28 / 0,92 / 3,2 |
| bench200 | 0,34 / 0,87 / 4,3 | 0,41 / 1,02 / 2,4 | 0,27 / 0,72 / 1,4 |
| m1 | 0,36 / 0,22 / 4,2 | 0,16 / 0,17 / 1,8 | 0,09 / 0,08 / 1,6 |
| m5 | 0,29 / 0,18 / 4,2 | 0,16 / 0,11 / 1,5 | 0,04 / 0,06 / 0,14 |
| m9 | 0,43 / 0,18 / 3,7 | 0,18 / 0,13 / 1,8 | 0,10 / 0,11 / 0,60 |
| sandbox | 0,18 / 0,24 / 1,6 | 0,08 / 0,13 / 0,38 | 0,09 / 0,11 / 0,25 |

(Średnie bazowe m1-sandbox w tej tabeli są zawyżone pojedynczymi zatrzymaniami hosta; kolumny p95/p99 są wiarygodniejsze. Pozostałe Dijkstry w A to dispatche, w których wolne wozy istnieją i faktycznie wybierają najbliższe źródło.)

Na telefonie (założone x4-6): p95 bench50 z ok. 40-60 ms do ok. 4-6 ms — spike znika z zakresu "zauważalny przycisk".

### B. Recykling tablic odległości (opcjonalnie, tani)

`DistCache.release()` na końcu `dispatch` oddaje `dist`/`prev` do puli (lista wolnych w `network.ts`), `dijkstra` bierze z puli zamiast `new`. Nie zmienia żadnej wartości. Pomiar samodzielnie: bench100 avg 1,72 -> 0,56 ms, p95 5,09 -> 1,11 ms. Uwaga: mapy zwrócone przez `DistCache` nie mogą wychodzić poza `dispatch` (dziś nie wychodzą — `diagnose` używa ich tylko w obrębie wywołania).

### C. Nie robić teraz: pamięć podręczna między dispatchami

76% / 53% / 29% Dijkstr daje ten sam wynik co w poprzednim dispatchu (97-99% w misjach), więc cache kluczowany `(netVersion, deszcz, odwilż, lód, mapa kar mostów)` dałby dalszą redukcję. Jest to jednak niepusta zmiana (klucz musi obejmować kary kolejek z `spanPenalties`, zależne od tick i pozycji wozów), z ryzykiem cichej rozbieżności. Po A+B zostaje ok. 0,3 ms avg, więc zysk jest mały.

## Wpływ na determinizm i golden hashe

- A i B nie dodają pól stanu, nie zmieniają kolejności ani wyniku jakiejkolwiek decyzji: czysta optymalizacja → **skróty stanu muszą zostać identyczne**, golden hashe (`chains.test.ts`, v4) bez regeneracji.
- Zweryfikowano: `PERF_HASHES=1` liczy 273 skróty stanu (bench 50/100/200 co 500 ticków do 3000, wszystkie strategie `plans` misji m1-m6 co 600 ticków i na końcu, sandbox DECENT 60 min co 3000 ticków). Oryginał, kopia z samymi licznikami, `pool`, `free0` i `pool,free0` dają ten sam skrót zbiorczy `a4dc648ba12e5618`.
- Jak powtórzyć: `PERF_DISPATCH_CHILD=1 PERF_HASHES=1 PERF_RUNS=0 npx tsx tools/perf-dispatch.ts none` (oryginał), oraz `PERF_VARIANT=pool,free0 PERF_CHECK=1 PERF_HASHES=1 PERF_RUNS=0 npx tsx tools/perf-dispatch.ts none` (wariant). Porównać linię `DIGEST`.
- Pomiary wariantów: `PERF_VARIANT=free0|pool|pool,free0 PERF_RUNS=3 npx tsx tools/perf-dispatch.ts` (zmienna `PERF_DIR` zmienia katalog tymczasowy; nie uruchamiać dwóch kopii naraz bez własnego `PERF_DIR`).

## Plan testów przy wdrożeniu (w `src/`, poza zakresem tego raportu)

1. `npm test` całość (golden hashe v4, determinism, saveload, replay) — musi przejść bez zmian oczekiwanych wartości.
2. Nowy test `dispatch-reachability.test.ts`: dla `benchWorld(50)` i sandboxa co dispatch sprawdzić `reachable(a,b) === (dijkstra(a).dist[b] < Infinity)` dla wszystkich par bramek (ochrona założenia o symetrii i skończonych kosztach), również po komendach sieciowych (most, wyburzenie, lód w m4).
3. Test równości skrótów: ta sama sekwencja ticków (bench 50/100) przed i po zmianie — skrót co 500 ticków (wartości zapisane w teście z oryginału).
4. `npm run fuzz` (invarianty towarów i `unexplainedStalls`), `npm run perf:sim` i `tools/perf-dispatch.ts` jako pomiar po zmianie (oczekiwane: dispatch p95 <= 1,1 ms przy 50 wozach).
5. Oddzielny test na NO_ROUTE: odcięty spichlerz, brak wolnych wozów → `unmet` nadal `NO_INPUT/UNREACHABLE` (nie `ALL_BUSY`).

## Ryzyka i ograniczenia

- Brak fixtury dużej osady: sandbox DECENT ma tylko kilkanaście wozów, a benche mają 41 budynków. Przy większej liczbie bramek źródeł (np. 100 budynków) liczba Dijkstr w ticku dispatchu rośnie liniowo z liczbą różnych bramek, więc po A zostaje koszt "z wolnymi wozami" (wariant C wtedy wart rozważenia). Warto powtórzyć pomiar na zapisie dużej osady.
- Pomiary max są zaszumione (kontener współdzielony); liczniki wywołań i skróty stanu są deterministyczne i to na nich opiera się wniosek o przyczynie.
- Kopia instrumentowana mierzy własny narzut `performance.now()` (kilkaset ns na wywołanie, głównie w Dijkstrach), więc bezwzględne ms są lekko zawyżone, proporcje nie.
