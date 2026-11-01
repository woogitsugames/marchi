# Performance

## Simulation (headless, Node 22, container CPU)

`npm run perf:sim` — stress scenario `tools/bench.ts`: mission valley + 21 consumer buildings fed
from 15 stocked granaries across the river, two wooden one-lane bridges (deliberately overloaded),
1 minute warm-up, then 3 minutes measured (1800 ticks at 10 Hz).

| wagons | avg ms/tick | p99 ms | max ms | ms/frame at ×4 (60 fps) | moving | heap Δ MB | save KB | invariant errors |
|---|---|---|---|---|---|---|---|---|
| 50 | 0.330 | 4.62 | 51.77* | 0.22 | 40 | 0.8 | 63 | 0 |
| 100 | 0.133 | 1.65 | 6.93 | 0.09 | 48 | -0.4 | 85 | 0 |
| 200 | 0.122 | 1.20 | 5.97 | 0.08 | 74 | 3.4 | 114 | 0 |

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

### APK (propozycja integracji otwierania)

`npm run apk` zawiera plik `dist/tools/device-bench.html` w zasobach Capacitor,
ale **nie dodaje przycisku** do menu gry. Propozycja dla diagnostycznej wersji APK:
ukryty przełącznik w ustawieniach lub parametr `?deviceBench=1` w `src/main.ts`,
który **przed** uruchomieniem aplikacji wykona `location.replace('/tools/device-bench.html')`.
Potrzebny jest również sposób przekazania tego parametru do WebView (np. osobny debug build
lub deep link). Samo wpisanie parametru w zewnętrznej przeglądarce **nie uruchamia** strony w APK.
W Capacitor pobieranie pliku JSON może być blokowane przez WebView; kopiowanie lub zaznaczenie
surowego JSON pozostaje alternatywą.

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
