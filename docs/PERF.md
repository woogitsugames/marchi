# Performance

## Simulation (headless, Node 22, container CPU)

`npm run perf:sim` — stress scenario `tools/bench.ts`: mission valley + 21 consumer buildings fed
from 15 stocked granaries across the river, two wooden one-lane bridges (deliberately overloaded),
1 minute warm-up, then 3 minutes measured (1800 ticks at 10 Hz).

| wagons | avg ms/tick | p99 ms | max ms | ms/frame at ×4 (60 fps) | moving | heap Δ MB | save KB | invariant errors |
|---|---|---|---|---|---|---|---|---|
| 50 | 0.250 | 2.05–2.35 | 5.53 | 0.17 | 45 | ±1 | 62 | 0 |
| 100 | 0.120 | 1.18–1.38 | 4.32 | 0.08 | 95 | ±3 | 85 | 0 |
| 200 | 0.085 | 0.87–0.88 | 3.16 | 0.06 | 109 | ±2 | 108 | 0 |

Measured 2026-11-01 on `claude/s2-integration` (missions IV–VI, STATE_VERSION 3, save gate, replay),
three runs, ranges shown where they differ. Previous table (before D-13 queue-aware routing landed in
the measurement): 50 → p99 4.62, 100 → 1.65, 200 → 1.20 ms.

**Dispatch spreading (brief 03, task B): not needed.** The trigger was p99 > 1.5 ms at 200 wagons; it is
0.87 ms. With many wagons most are busy, so each dispatch matches few demands. The worst p99 is now at
**50 wagons (≈ 2.2 ms)**: many free wagons mean more Dijkstra runs per dispatch tick. If the device
benchmark confirms that case is a problem on phones (×3–5 → ~7–11 ms on a dispatch tick), spread
demands over the 5 ticks of a dispatch interval, or cache DistMaps per network version between dispatches.
\* first run in the process includes JIT warm-up.

Notes:
- Spikes come from dispatch ticks (every 5 ticks): Dijkstra per source building. Edge masks and
  cost tables are precomputed per network version and (loaded, rain) variant.
- Expect 3–5× slower on a mid-range Android CPU: ~0.5 ms average per tick, p99 ~5 ms. At ×4 that is
  ~2 ms per frame average. Further headroom if needed: incremental dispatch (spread sources over
  ticks), A* with landmarks for wagon re-plans, typed-array state for wagons.
- Save size stays ~100 KB at 200 wagons (JSON).

## Rendering

See the section below (filled after the three.js view lands).

## Pomiar na urządzeniu

Strona **/tools/device-bench.html** jest oddzielnym wejściem Vite. Domyślnie wykonuje **3 przebiegi × 60 s**
przy 50, 100 i 200 wozach, zawsze w rzeczywistej pętli symulacji **×4** (`GameLoop` + `benchWorld(n)`).
Wybierz `low`, `high` albo `ultra` (lub `Wszystkie`: 9 przebiegów).
Każdy przebieg tworzy nowy świat, czeka na tekstury i rozgrzewa renderer (45 klatek + 40 ticków)
**poza** 60-sekundowym pomiarem. Dynamiczne skalowanie rozdzielczości jest wyłączone.
Przez pierwsze 20 s kamera jest blisko (60 m), kolejne 20 s w średnim zbliżeniu (160 m),
ostatnie 20 s daleko (320 m); przesunięcie i obrót są skryptowane według czasu, nie liczby klatek.

### Chrome na telefonie (Galaxy Z Fold 8 Ultra)

Na komputerze z repozytorium (ta sama sieć Wi-Fi co telefon):

```bash
npm ci
npm run build
npm run preview -- --host 0.0.0.0
```

W Chrome na telefonie otwórz **http://<IP-komputera>:4173/tools/device-bench.html**.
Vite preview podaje stronę i tekstury pod ścieżką `/tools/…`; drugi build
(`vite.bench.config.ts`) dodaje ją do `dist/tools/device-bench.html` bez modyfikowania
`vite.config.ts`. Dla samego benchmarku można użyć `npm run build:bench`
**po** normalnym buildzie; ten krok nie usuwa pozostałej zawartości `dist`.

Ustaw wybraną orientację / rozłóż Fold **przed** startem; nie wygaszaj ekranu, wyłącz
oszczędzanie energii i zamknij inne ciężkie aplikacje. Zmiana viewportu albo DPR w trakcie
przebiegu powoduje jego odrzucenie. Gdy karta przejdzie do tła, czas pomiaru jest wstrzymany.
Przycisk **Zatrzymaj** zachowuje wyniki zakończonych przebiegów.

### APK i przeglądarka (ukryte wejście, D-56)

`npm run build` buduje też `dist/tools/device-bench.html` (drugi przebieg Vite z `vite.bench.config.ts`;
główny `vite.config.ts` i strona gry są bez zmian), więc `npm run apk` zawiera stronę w zasobach Capacitor.
W menu gry **nie ma** przycisku. Wejście: adres gry z `?debug=1&bench=device` — `src/main.ts` przed
uruchomieniem gry robi `location.replace('tools/device-bench.html')`. Bez `debug=1` parametr jest ignorowany.
W APK trzeba ten adres podać WebView (debug build, `chrome://inspect` → konsola: `location.search='?debug=1&bench=device'`).
W Capacitor pobieranie pliku JSON może być blokowane przez WebView; kopiowanie lub zaznaczenie
surowego JSON pozostaje alternatywą. Teksty strony są tylko po polsku (narzędzie diagnostyczne, nie UI gracza).

### Dane wyjściowe i interpretacja

`Kopiuj JSON` / `Zapisz JSON` zwraca obiekt `marchia.device-bench.v1` z `device`,
`setup` oraz `runs[]`. Każdy wiersz `runs[]` odpowiada kolumnom tabeli poniżej.
`fpsAvg` = liczba klatek / sumaryczny czas aktywnych klatek;
`fps1Low` = odwrotność **średniego czasu najwolniejszych 1% klatek** (nie pojedyncza najgorsza klatka).
`simCpuMsPerFrame` mierzy CPU `GameLoop.advance` wraz z `afterTick`,
`renderCpuMsPerFrame` — CPU `view.frame` (to **nie** pomiar czasu GPU).
`drawCallsAvg` i `trianglesAvg` to średnie z `renderer.info.render` na klatkę;
`texturesPeak` i `geometriesPeak` pochodzą z `renderer.info.memory`.
`heapStartMB`, `heapEndMB`, `heapPeakMB` i `heapDeltaMB` mają wartość `null`,
jeżeli przeglądarka nie udostępnia niestandardowego `performance.memory`.
`device.renderer` / `vendor` korzystają z `WEBGL_debug_renderer_info`, jeśli dostępne,
inaczej pokazują ograniczone dane WebGL. `viewport` obejmuje CSS px, rozmiar bufora i DPR.
`camera[]` zawiera także FPS osobno dla trzech poziomów zoomu.

`achievedSpeed` wynoszące mniej niż 4 oznacza, że urządzenie nie nadążało z tickami
(w grze jest limit ticków na klatkę). Nie porównuj bez tego wskaźnika samych FPS.

| Urządzenie | Jakość | Wozy | FPS śr. | 1% low | CPU sim ms/kl. | CPU render ms/kl. | Draw | Tris | Tex | Δ heap MB | × rzeczywiste |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Galaxy Z Fold 8 Ultra | high | 50 | — | — | — | — | — | — | — | — | — |
| Galaxy Z Fold 8 Ultra | high | 100 | — | — | — | — | — | — | — | — | — | — |
| Galaxy Z Fold 8 Ultra | high | 200 | — | — | — | — | — | — | — | — | — | — |

Uzupełnij wiersze danymi JSON z telefonu, zachowując rozmiar ekranu, DPR i wersję aplikacji
dla porównywalności. Wyniki innych jakości dopisuj jako osobne wiersze. Pomiary na
fizycznym Foldzie **nie są** zastępowane wynikami desktopowymi.

### Prawdziwa gra: `?diag=1` (czas klatki, noc 5)

Benchmark wyżej mierzy sceny syntetyczne. `?diag=1` mierzy **grę, w którą się gra** (ten sam adres, dowolna
misja; w APK przez `chrome://inspect` → `location.search='?diag=1&play=m7'`). Panel po lewej pokazuje dla
bieżącego kubełka tempa: liczbę sekund i klatek, p50/p95/p99 czasu klatki (ms), liczbę klatek > 33,4 ms
(dwa odświeżenia 60 Hz) i p95 CPU symulacji (`loop.advance`) oraz widoku (`view.frame`). Kubełki: `menu`,
`pause`, `x1`, `x2`, `x4` — każda klatka trafia do kubełka tempa, w którym była narysowana, więc pauza jest
pomiarem odniesienia (ta sama scena, bez ticków). Percentyle liczone z ostatnich 14 400 klatek kubełka (2 min
przy 120 Hz), histogram ze wszystkich od „Od nowa”. `Kopiuj JSON` (`marchia.frame-diag.v1`) kopiuje raport
wszystkich kubełków z urządzeniem, układem (`phone`/`fold-open`/…, `flex`), jakością, DPR, skalą dynamicznej
rozdzielczości, liczbą wozów i wywołań rysowania; gdy WebView nie da schowka — pokazuje JSON zaznaczony do
skopiowania. Z konsoli: `__marchiaDiag.report()`. Karta w tle nie jest liczona.

Protokół na składaku (osobno złożony / rozłożony / Flex; nie zmieniać orientacji w trakcie):
1. Otworzyć misję (m7 lub dolinę z ≥ 50 wozami), poczekać, aż tekstury dojdą (~20 s), **Od nowa**.
2. **Odniesienie**: pauza, 30 s bez dotykania ekranu.
3. **Pomiar**: ×4, 90 s bez dotykania (kamera stoi), potem 30 s przesuwania mapy palcem (nadal ×4).
4. Powtórzyć kroki 1–3 osiem razy (×8) na zmianę złożony/rozłożony; po każdym `Kopiuj JSON` i wkleić niżej.
Wniosek wyciągać z różnicy `x4` − `pause` (koszt symulacji i ruchu wozów) i z `jankShare`, nie z samego p50.

| Urządzenie | Układ | Jakość | Wozy | Kubełek | p50 ms | p95 ms | p99 ms | > 33 ms | sim p95 | view p95 |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| Galaxy Z Fold 8 Ultra | fold-open | high | — | pause | — | — | — | — | — | — |
| Galaxy Z Fold 8 Ultra | fold-open | high | — | x4 | — | — | — | — | — | — |
