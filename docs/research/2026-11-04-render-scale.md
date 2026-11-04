# Koszt renderu przy 50 / 100 / 200 wozach (BACKLOG P1, headless)

Data: 2026-11-04 (noc), gałąź `claude/research-night6b` (baza `0346ffc`). Narzędzia: `tools/render-scale.mjs`
(pomiar jednej sceny), `tools/render-scale-table.mjs` (tabele), prototypy: `docs/research/2026-11-04-render-scale-proto.patch`
(**nie** wgrane do `src/`, cofnięte po pomiarze). Żadna z propozycji nie dotyka symulacji.

## Zastrzeżenia (czytać przed liczbami)

- Chromium headless + **SwiftShader**, 412×915, DPR 0,5, bez throttlingu CPU. Klatka trwa 1–4 s, bo rasteryzacja
  ~0,6–1,1 mln trójkątów blokuje główny wątek — **FPS i ms z prawdziwych klatek nic nie mówią o telefonie**.
  Dlatego koszty JS mierzę osobno („micro”): każda funkcja klatki/ticku wołana 60× z rzędu na tej samej scenie po
  rozgrzaniu (mediana bloków po 5 wywołań; `performance.now()` ma tu rozdzielczość 0,1 ms). To czasy desktopowego
  CPU; na średnim Androidzie liczyć ×3–5.
- Kontener był współdzielony (load average 5–14 przez inne sesje): czasy ms mają rozrzut ±50 %. **Liczby pewne** to
  liczniki: wywołania GL, trójkąty, bajty wysyłane do GPU, pamięć GPU, KB alokacji, węzły DOM, liczba pinezek.
- Liczniki GL z owinięcia całego `WebGL2RenderingContext` (init script): draw w passie głównym vs offscreen (cień),
  trójkąty z `count × instancje`, bajty `bufferData/bufferSubData`, pamięć tekstur/buforów/renderbufferów
  (texStorage/texImage/compressed*, minus delete). `renderer.info` liczy tylko pass główny.
- Alokacje: CDP `HeapProfiler.startSampling` (256 B) wokół 200 wywołań funkcji (render 20, tick 40), KB na wywołanie.
  W liczbach jest ~5–10 KB tła (jedna zwykła klatka, która wpadła w okno).
- **Scena.** Własny ruch drabiny `frame-cost-bench.json` trzyma na drogach tylko 10–35 wozów niezależnie od floty
  (reszta czeka niewidoczna w stajni — dlatego wcześniejsze pomiary „100 wozów” w praktyce mierzyły ~13).
  `render-scale.mjs` przed każdym oknem rozrzuca bezczynne wozy po komórkach dróg (deterministycznie), 60 % z ładunkiem
  4 szt., i puszcza 120 ticków: symulacja wiezie je realnymi ścieżkami do stajni przez mosty (korki, `NO_ROUTE` na
  odciętych odcinkach → pinezki wozów). Ładunki łamią zachowanie towarów — to strona do wyrzucenia, nie zapis gry.
  W ruchu: 28–31 (50), 60–64 (100), 122–124 (200) wozów.
- Kamera: **near** = 60 m nad najgęstszym skupiskiem (rysuje wozy w LOD „mid”; pełny „near” zaczyna się < 44 m),
  **far** = 320 m nad środkiem floty (LOD1). Jakości low/high/ultra; ultra tylko przy 200 (czas maszyny).

## Wyniki per scenariusz

Kolumny: wozy narysowane (mid/far) i w ruchu; GL draw = wywołania rysowania na klatkę (pass główny / pass cienia);
tris = trójkąty na klatkę; upload = KB wysyłane do GPU na klatkę (bufferSubData/bufferData); micro ms = desktop,
bez throttle; alloc = KB na klatkę (`wagons.frame` + `renderer.render`) i KB na tick (`loop.tickOnce` z `onTick`);
piny = widoczne pinezki (z tego wozów).

### Kamera near (60 m)

| jakość | wozy | wozy (rys. mid/far) | GL draw main | GL draw cień | tris main | tris cień | upload KB/kl. | wywołań GL/kl. | wagons.frame ms | render() ms | afterTick ms/tick | markers ms | autosave sync ms | alloc KB/kl. | alloc KB/tick | piny (wozy) | DOM | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| low | 0 | 0/0 (1 jedzie) | 52 | 25 | 373k | 202k | 104 | 441 | 0.04 | 1.06 | 0 | 0.02 | 3.5 | 110 | 26 | 2 (0) | 468 | 77 |
| low | 50 | 4/4 (28 jedzie) | 69 | 36 | 431k | 231k | 716 | 557 | 0.16 | 0.86 | 0.04 | 0.02 | 1.4 | 164 | 54 | 2 (0) | 439 | 100 |
| low | 100 | 17/0 (60 jedzie) | 56 | 33 | 453k | 279k | 669 | 489 | 0.26 | 0.68 | 0.08 | 0.02 | 1.5 | 174 | 69 | 1 (0) | 445 | 79 |
| low | 200 | 39/2 (122 jedzie) | 60 | 33 | 510k | 332k | 716 | 510 | 0.42 | 0.76 | 0.16 | 0.06 | 3.1 | 250 | 113 | 1 (0) | 493 | 104 |
| high | 0 | 1/0 (2 jedzie) | 68 | 56 | 516k | 375k | 201 | 774 | 0.04 | 1.82 | 0 | 0.02 | 0.9 | 131 | 27 | 2 (0) | 468 | 105 |
| high | 50 | 12/0 (31 jedzie) | 76 | 63 | 554k | 392k | 669 | 814 | 0.28 | 2.36 | 0.04 | 0.02 | 1.5 | 179 | 57 | 2 (0) | 434 | 107 |
| high | 100 | 23/0 (64 jedzie) | 78 | 66 | 582k | 441k | 853 | 936 | 0.34 | 1.38 | 0.12 | 0.08 | 1.9 | 191 | 82 | 1 (0) | 445 | 107 |
| high | 200 | 37/0 (124 jedzie) | 73 | 60 | 619k | 477k | 670 | 800 | 0.44 | 1 | 0.16 | 0.02 | 3.4 | 272 | 123 | 1 (0) | 493 | 107 |
| ultra | 200 | 37/0 (124 jedzie) | 73 | 60 | 619k | 477k | 670 | 800 | 0.92 | 1.3 | 0.18 | 0.04 | 4.1 | 272 | 126 | 1 (0) | 493 | 107 |

### Kamera far (320 m)

| jakość | wozy | wozy (rys. mid/far) | GL draw main | GL draw cień | tris main | tris cień | upload KB/kl. | wywołań GL/kl. | wagons.frame ms | render() ms | afterTick ms/tick | markers ms | autosave sync ms | alloc KB/kl. | alloc KB/tick | piny (wozy) | DOM | heap MB |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| low | 0 | 0/2 (1 jedzie) | 47 | 27 | 406k | 204k | 169 | 402 | 0.02 | 0.46 | 0 | 0.02 | 3.4 | 78 | 24 | 9 (0) | 466 | 77 |
| low | 50 | 0/26 (24 jedzie) | 50 | 32 | 407k | 211k | 637 | 428 | 0.1 | 1.08 | 0.12 | 0.04 | 1.9 | 139 | 46 | 22 (11) | 501 | 79 |
| low | 100 | 0/54 (41 jedzie) | 50 | 32 | 432k | 220k | 638 | 431 | 0.44 | 1.46 | 0.08 | 0.06 | 5.4 | 179 | 64 | 29 (18) | 529 | 79 |
| low | 200 | 0/105 (77 jedzie) | 50 | 32 | 482k | 236k | 638 | 432 | 0.88 | 1.84 | 0.16 | 0.12 | 2.7 | 273 | 98 | 43 (33) | 613 | 79 |
| high | 0 | 0/2 (2 jedzie) | 48 | 32 | 420k | 218k | 169 | 427 | 0.02 | 1.9 | 0 | 0.02 | 5.5 | 90 | 34 | 9 (0) | 467 | 105 |
| high | 50 | 0/31 (20 jedzie) | 51 | 37 | 424k | 226k | 638 | 455 | 0.1 | 0.98 | 0.04 | 0.04 | 1.5 | 141 | 48 | 22 (11) | 502 | 107 |
| high | 100 | 0/58 (40 jedzie) | 51 | 37 | 450k | 234k | 636 | 455 | 0.24 | 0.84 | 0.06 | 0.06 | 5.2 | 181 | 67 | 26 (15) | 513 | 107 |
| high | 200 | 0/97 (74 jedzie) | 51 | 37 | 482k | 242k | 638 | 456 | 0.56 | 0.94 | 0.18 | 0.08 | 4 | 269 | 100 | 37 (26) | 579 | 108 |
| ultra | 200 | 0/97 (75 jedzie) | 51 | 37 | 482k | 242k | 638 | 456 | 0.52 | 0.7 | 0.14 | 0.08 | 94* | 275 | 101 | 38 (27) | 585 | 107 |

\* pojedynczy pomiar autozapisu (jedno wywołanie na scenę); 94 ms to odstający wynik w obciążonym kontenerze,
pozostałe 0,9–5,5 ms bez wyraźnego trendu względem liczby wozów.

### Pamięć GPU (z wywołań GL, MB) — nie rośnie z liczbą wozów

| jakość | wozy | tekstury | bufory | renderbuffery | canvas (szac.) | info.geometries | info.textures | programy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| low | 0 | 33.4 | 16.2 | 14.0 | 3.2 | 71 | 23 | 45 |
| low | 200 | 33.4 | 16.5 | 14.0 | 3.2 | 72 | 23 | 45 |
| high | 0 | 82.1 | 17.2 | 26.0 | 3.2 | 77 | 25 | 48 |
| high | 100 | 82.1 | 17.9 | 26.0 | 3.2 | 88 | 25 | 48 |
| high | 200 | 82.1 | 17.6 | 26.0 | 3.2 | 82 | 25 | 48 |
| ultra | 200 | 112.1 | 17.6 | 56.0 | 3.2 | 82 | 25 | 48 |

Bufory instancji są zaalokowane z góry na `MAX_WAGONS = 250` (ładunki: 1500 instancji × 64 B na siatkę), więc
pamięć GPU i liczba programów są płaskie w N. Renderbuffery ultra (56 MB) to atlas drzew 256 px z MSAA (D-58).
Sterta JS: 77–108 MB, bez trendu w N w oknie pomiaru.

### Pinezki (100 dodatkowych piekarni bez drogi = `NO_ROAD`, 100 wozów, high, far)

| wariant | piny widoczne (wozy) | pula pinezek | węzły DOM (z tego markery) | markers.update ms | alloc KB/wywołanie |
|---|---:|---:|---:|---:|---:|
| bez zmian | 71 (10) | 110 | 1033 (763) | 0.12 | 43 |
| prototyp C (pomiń zapis, gdy pin stoi) | 71 (10) | 110 | 1033 (763) | 0.10 | 27.7 |

~7 węzłów DOM na pinezkę; pula nigdy się nie kurczy (110 elementów przy 71 widocznych). Recalc stylu z CDP przy
0,2 fps (1 recalc na klatkę) jest w szumie — nie da się tu rozróżnić 1,2 vs 2,4 ms/klatkę.

## Krzywe skalowania (wyprowadzone z tabel)

| koszt | 0 → 200 wozów | na wóz | uwagi |
|---|---|---|---|
| draw calls (main / cień) | 48→51 / 32→37 (far), 68→73 / 56→60 (near high) | ~0 | instancing działa; stała ~+5 po pojawieniu się pierwszych części |
| trójkąty main, far (LOD1 + ładunek) | 420k → 482k | **~640** | LOD1 622 + ładunek |
| trójkąty cienia, far | 218k → 242k | **~250** | LOD1 bez cienia (D-64), ale **ładunek dalekich wozów nadal rzuca cień** |
| trójkąty main, near (mid) | 516k → 619k | **~2,8 tys.** / wóz mid | mid: korpus 840 + koń 1214 + koła 744 + woźnica 584 |
| trójkąty cienia, near (mid) | 375k → 477k | **~2,8 tys.** / wóz mid | pełny rig mid w passie cienia: +27 % passu cienia przy 37 wozach |
| upload do GPU | 104–201 → 640–850 KB/kl. | skok, potem stała | całe bufory o pojemności `cap` wysyłane co klatkę (ładunki 96 KB/siatkę) |
| `wagons.frame` CPU | 0.02–0.04 → 0.44–0.9 ms | **~2–4 µs** | liczy teren dla **każdego** wozu przed testem frustum |
| `wagons.frame` alloc | 5–7 → 153–159 KB/kl. | **~0,77 KB** | `hash3`/`vnoise`/`detail` (boxing liczb) przez `hf.height` ×3 na wóz |
| `view.afterTick` | 0 → 0.16–0.18 ms/tick, 5 → 72–101 KB/tick | ~0,8 µs, ~0,45 KB | `surf` → `hf.height`, `wagonDrawLag`/`stableParking` (nowe Mapy co tick) |
| `renderer.render` CPU / alloc | ~1 ms / ~100–120 KB/kl. | ~0 | **stały**, ale `getParameters` (three.js) 30–40 KB/kl. — przełączanie programu |
| `markers.update` | 0.02 → 0.08–0.12 ms | ~1,7 µs / pin | 0,6 KB / pin / klatkę; DOM +7 węzłów / pin |

Przeliczenie na telefon przy ×4 i 60 fps (0,67 ticka na klatkę), 200 wozów, desktop ×3–5:
`wagons.frame` 1,5–4 ms + `afterTick` 0,3–0,6 ms + `markers` 0,3 ms + render() 3–5 ms (stały) na klatkę;
alokacje ≈ (155 + 115) KB × 60 + 100 KB × 40 ticków ≈ **20 MB/s** → scavenge młodej generacji mniej więcej co sekundę.
Upload 640–850 KB/klatkę ≈ **40–50 MB/s** przez sterownik GL.

## Top 5 kosztów rosnących z liczbą wozów / pinezek

1. **`WagonsView.frame` — teren dla wszystkich wozów, co klatkę** (`src/render/wagonsView.ts` `frame`, pętla po `order`):
   3× `hf.height` na wóz przed `_frustum.intersectsSphere`, czyli także dla wozów poza ekranem i stojących w kolejce.
   CPU ~2–4 µs i ~0,77 KB alokacji na wóz na klatkę (największy alokator w grze przy 200 wozach: 153 KB/kl.).
2. **Trójkąty wozów „mid” w obu passach** (kamera 45–110 m, typowy zoom gry): ~2,8 tys. w passie głównym i drugie
   tyle w cieniu na wóz. 37 wozów = +100k (main) i +100k (cień); w passie cienia to +27 %.
3. **Upload całych buforów instancji co klatkę** (`src/render/instancedParts.ts` `end`, pozy koni w `wagonsView.ts`
   na końcu `frame`): rośnie skokowo z pierwszym ładunkiem (każdy rodzaj ładunku = 96 KB/siatkę niezależnie od liczby
   sztuk); 640–850 KB/klatkę przy 50–200 wozach. Przy 0 wozach już 104–201 KB (stosy przy budynkach, D-71).
4. **`view.afterTick` na każdy tick** (`wagonsView.ts` `afterTick` → `surf`, `wagonSpacing.ts` `wagonDrawLag`,
   `stableParking`): ~0,8 µs i 0,45 KB na wóz na tick; przy ×4 to 40 ticków/s.
5. **Pinezki** (`src/ui/markers.ts` `update`/`place`): ~1,7 µs, 0,6 KB i 7 węzłów DOM na pinezkę; zapis
   `style.transform` (+ string `toFixed`) dla każdej pinezki w każdej klatce, także gdy kamera stoi → recalc stylu
   tych elementów. Przy 71 pinezkach 0,12 ms JS; koszt stylu w przeglądarce nieczytelny w SwiftShader.

Stałe, ale duże (nie rosną z N, warto przy okazji): `renderer.render` alokuje 100–120 KB/klatkę, z czego 30–40 KB
w `getParameters`/`getProgramCacheKey` (three.js liczy klucz programu od nowa, bo ten sam materiał
`modelMaterial(...)` jest na `InstancedMesh` wozów i na zwykłych siatkach budynków — każde przejście zmienia
`instancing`); autozapis 1–5 ms synchronicznie co 30 s gry.

## Prototypy (lokalnie, zmierzone, cofnięte)

Jeden build z flagami `globalThis.__protoX` (patch obok raportu), 200 wozów, high:

| prototyp | metryka | przed → po (near / far) |
|---|---|---|
| A: `addUpdateRange(0, count*16)` w `Parts.end`, `count*4` dla póz koni | upload KB/klatkę | 670 → **35** / 638 → **38** (−95 %) |
| B: osobna kopia materiału dla `InstancedMesh` (`instancedMaterial(key)`, ten sam `customProgramCacheKey`) | `getParameters` KB/kl.; alloc render() | 34 → 20 / 41 → 14; 119 → 88 / 114 → 62 KB; programy 48 → 48 (zero nowych kompilacji) |
| D: ponowne użycie y/pitch, gdy rig nie ruszył się od ostatniej próbki terenu | alloc `wagons.frame` | 153 → **68** / 155 → **63** KB/kl. (−57 %) |
| C: pomiń zapis transformu i test zasłonięcia, gdy pin stoi (zaokr. 0,1 px, te same `occluders`) | alloc `markers.update` (71 pin.) | 43 → 28 KB/wywołanie (−36 %); ms 0,12 → 0,10 |

Czasy ms przed/po są w szumie obciążonego kontenera (np. render() 1,0 → 1,44 i 0,94 → 0,82) — wynik prototypów to
liczniki. Trójkąty, draw calls i obraz bez zmian w liczbach (619k/73 vs 620k/73; różnica to ruch wozów między
przebiegami). Zrzutów porównawczych nie robiłem — przed wdrożeniem B i D: `tools/jam-diff.mjs` (0 różnych pikseli
oczekiwane dla A, C, D) i zrzuty dla B.

Dodatkowo sprawdzone poza przeglądarką (Node 22, ten sam V8): `vnoise` z haszem całkowitoliczbowym (`hashI` zwraca
int32, dzielenie przez 2³² w `vnoise`) daje **identyczne bity** na 100 000 próbek i ~57 % mniej scavenge’y na 2·10⁷
wywołań `detail`.

## Poprawki — ranking

| # | co (plik / funkcja) | oczekiwany zysk | ryzyko | sim? |
|---|---|---|---|---|
| 1 | **Zakresy aktualizacji buforów instancji**: `src/render/instancedParts.ts` `Parts.end()` → `instanceMatrix.clearUpdateRanges(); addUpdateRange(0, count*16)`; to samo dla `poseAttrs` w `WagonsView.frame` (`count*4`), a przy okazji `groundCover.ts`/`vegetation.ts` (ten sam wzór). | upload −95 % (≈ 640 → 35 KB/kl., 40 MB/s → 2 MB/s przy 60 fps); mniej pracy sterownika GL na każdym telefonie, niezależnie od N | niskie (API three r181; bufor dalej pełnej pojemności) | nie |
| 2 | **Teren tylko dla widocznych i tylko po ruchu**: `WagonsView.frame` — test frustum na `s.fy`/`s.cy` z poprzedniej klatki *przed* `hf.height`; cache y/pitch, gdy (x, z, kierunek) się nie zmieniły (prototyp D); `Heightfield`/`kit.ts` `vnoise` z całkowitym haszem (bit w bit). | alloc `wagons.frame` 155 → ≤ 60 KB/kl. przy 200 wozach (−60 % zmierzone dla samego D; z cullingiem i haszem więcej), CPU proporcjonalnie do udziału wozów poza ekranem / stojących; ≈ 1–2 ms/kl. na telefonie przy 200 | niskie (D: identyczny obraz; culling: wóz tuż za krawędzią może mieć y z poprzedniej klatki — margines sfery 5 m wystarcza) | nie |
| 3 | **Stała wysokość komórek w `afterTick`**: `WagonsView.surf(c)` liczy `hf.height` środka komórki — wartość stała dla mapy; tablica `Float32Array(w*h)` wypełniana leniwie (NaN). Do tego `wagonDrawLag`/`stableParking` (`wagonSpacing.ts`) piszą do Map trzymanych w instancji zamiast tworzyć nowe co tick. | `afterTick` −40–60 % alloc (~100 → ~40 KB/tick przy 200; surf+hash3 to połowa), −30 % CPU; przy ×4 to 2–3 MB/s mniej | bardzo niskie | nie (render czyta stan, nie pisze) |
| 4 | **Cienie wozów mid i dalekich ładunków**: w `WagonsView.setShadows` / `applyQuality` (`view.ts`) rig mid (koń, koła, woźnica) bez `castShadow` albo cień z geometrii LOD1 (osobny `Parts` tylko do cienia, `colorWrite=false`); ładunek dzielony na near/far jak rig, daleki bez cienia (dziś `cargo` ma `setShadow(near)` także na LOD1). | pass cienia przy kamerze 60 m i 37 wozach: −~70–85k z 477k trójkątów (−15–18 %); far: −~250 trójkątów cienia/wóz (−24k przy 97) | średnie (wizualne: brak cienia kół/konia 45–110 m — sprawdzić `SHOT=` w `tools/wagon-shadow-calls.mjs` jak przy D-64) | nie |
| 5 | **Osobne materiały dla InstancedMesh**: `models/materials.ts` `instancedMaterial(key)` (kopia z tym samym `onBeforeCompile`/`customProgramCacheKey`), `Parts` jej używa; `applyTextures` i przełączniki jakości muszą aktualizować obie kopie. | `getParameters` −40–65 %, alloc render() −25–45 % (115 → 62–88 KB/kl.), 0 nowych programów; resztę churnu (14–20 KB) szukać w pozostałych współdzielonych materiałach (pracownicy przy budynkach, mosty) | średnie (każda późniejsza zmiana wspólnego materiału musi trafić do kopii; zrzuty low/high/ultra) | nie |
| 6 | **Pinezki: zapis tylko przy zmianie** (`markers.ts` `place`, prototyp C) + przycinanie puli do np. 2× widocznych. | alloc −36 %, brak zapisów stylu przy stojącej kamerze (główny przypadek: gracz czyta przyczynę); DOM −7 węzłów na nadmiarowy pin | niskie | nie |

Kolejność wdrażania: 1 → 3 → 2 (czysto mechaniczne, bez zmiany obrazu), potem 6, a 4 i 5 ze zrzutami.
Żadna pozycja nie zmienia `src/sim/`, haszy stanu ani zapisu.

## Czego ten pomiar nie mówi

- Czasu GPU na telefonie (fill rate, MSAA, A2C) — to tylko liczba trójkątów i wywołań. Do tego dalej
  `tools/device-bench.html` i `?diag=1` na Foldzie (tabele w `docs/PERF.md` puste).
- Ruchu pełnego LOD „near” (< 44 m): kamera 60 m rysuje „mid”. Near to ~5,6 tys. trójkątów + ładunek na wóz.
- Kosztu recalc stylu pinezek w prawdziwej przeglądarce (przy 0,2 fps w SwiftShader nieczytelny).

## Odtwarzanie

```bash
npx vite build --sourcemap --minify false --outDir <dir>
npx vite preview --outDir <dir> --port 5197 --strictPort
node tools/render-scale.mjs http://127.0.0.1:5197 200 high near,far 6 0 1 > w200-high.json   # wagons quality cams secs pins throttle
node tools/render-scale.mjs http://127.0.0.1:5197 100 high far 5 100 1 > pins100-high.json    # pin stress
PRE='globalThis.__protoA=true' node tools/render-scale.mjs ...                                # build with the patch applied
node tools/render-scale-table.mjs <dir> [<dir-po>]
```

Jeden przebieg (2 kamery) trwa 3–5 min na spokojnej maszynie, do 17 min przy obciążonym kontenerze.
