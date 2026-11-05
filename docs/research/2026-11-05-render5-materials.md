# Render #5: osobne materiały dla części InstancedMesh — przed/po (do decyzji)

Data: 2026-11-05, gałąź `claude/research-day9a`. Prototyp: `docs/research/2026-11-05-render5-materials.patch`
(**nie** wgrany do `src/`, cofnięty po buildzie; zawiera też test-strażnika `tests/materials-mirror.test.ts`).
Narzędzia: `tools/render5-materials.mjs` (liczniki, CPU, alokacje, zrzuty i przełączenia stanu na jednej stronie),
`tools/render5-diff.py` (diff pikseli). Surowe liczby: `docs/research/render5-data/*.json`. Pozycja #5 z
`2026-11-04-render-scale.md` (tam: „`getParameters` −40–65 %, alloc render() −25–45 %, 0 nowych programów”).

**Wynik w skrócie:** przebudowy parametrów programu na `renderer.render()` 10 → 6 (kamera 60 m) i 10 → 2 (320 m),
alokacje `getParameters`+klucz −41 % / −80 %, cała alokacja render() −17…−59 %, **0 nowych programów**, obraz
**bit w bit** na low / high / ultra (także zima nocą), **0** linków shaderów w klatce przy nocy, zimie i zmianie
jakości (poza istniejącym wcześniej przypadkiem low → high, patrz niżej). Rekomendacja: **wdrożyć ze strażnikiem**.

## Co zmienia #5

three.js (r181) trzyma dla każdego materiału jeden „bieżący program” i w `setProgram` porównuje m.in.
`materialProperties.instancing` z `object.isInstancedMesh`. Gdy ten sam materiał rysuje raz `InstancedMesh`, a raz
zwykły `Mesh`, przy każdej zmianie woła `getProgram` → `getParameters` (obiekt ~100 pól) + `getProgramCacheKey`
(sklejanie stringa). Program jest już w cache (nic się nie kompiluje), ale CPU i alokacje płacimy co klatkę.

Dziś (`src/render/models/materials.ts`) jest **jeden** `MeshStandardMaterial` na rodzaj (`modelMaterial(key)`),
używany przez:
- `Parts` (`instancedParts.ts`) — `InstancedMesh`: wozy (skrzynia, koła, woźnica, LOD1), ładunki (`cargo-*`,
  `cargo-far-*`), pracownicy przy budynkach (`worker-*`). Koń ma własny materiał (`hide` + pozy) — bez zmian.
- `buildingsView.ts`, `bridgesView.ts` — zwykłe `Mesh` (budynki, stosy, mosty);
- `vegetation.ts`, `groundCover.ts` — `InstancedMesh` z materiałami drzew / trawy (tych #5 nie dotyka).

Spis ze sceny (sandbox, 200 wozów, high, 60 m): materiały rysowane **jednocześnie** przez `InstancedMesh` i `Mesh`:
`model-wood` (16 inst. / 8 zwykłych siatek), `model-cloth` (31/1), `model-bark` (2/2), `model-stone` (4/1),
`model-metal` (2/1), `model-hide` (4/1), `model-skin` (2/1). Po łatce: **żaden**.

Łatka (61 siatek dostaje lustro; 3 pliki + test):
- `instancedMaterial(key)` — klon materiału rodzaju z tym samym `onBeforeCompile` i `customProgramCacheKey`
  (nazwa `model-<key>-inst`); `Parts` używa go zamiast `modelMaterial` (gdy nie podano własnego `mat`).
- `syncInstanced(key)` — kopiuje do lustra stan, od którego zależy program: `map`, `normalMap`, `roughnessMap`,
  `aoMap`, `alphaToCoverage`, `alphaTest`, `side`, `shadowSide`, `defines` (i `needsUpdate`, tylko gdy coś się
  zmieniło). Wołane z `applyTextures` i `setTreeQuality`.
- `materialsFor(key)` — baza + lustro; `view.ts` buduje z niego mapę dla `prewarmMaterialSwap` (podmiana tekstur,
  D-65), `treeQualityVariants` dopisuje lustra do mapy wariantów jakości.
- `tests/materials-mirror.test.ts` — lustro ma ten sam klucz i hook, idzie za `applyTextures` (dodanie i usunięcie
  map), `materialsFor` zwraca oba.

## Metoda

Jak w render #4: SwiftShader, 412×915, DPR 1, sandbox z `frame-cost-bench.json` + deterministyczne rozrzucenie
200 wozów (60 % z ładunkiem), symulacja zatrzymana, czas renderu zamrożony (`view.frame(a, 0)`), deszcz i UI wyłączone,
kamera nad najgęstszym skupiskiem (37 wozów w kadrze przy 60 m), yaw 0,6.

- **Przebudowy programu:** `getParameters` woła `material.customProgramCacheKey()` dokładnie raz, więc ta metoda jest
  owinięta (prototyp `Material` + własne nadpisania) i liczona w jednym `renderer.render()`; osobno materiały głębi
  cienia (`MeshDepthMaterial`).
- **CPU:** mediana `renderer.render()` z 8 bloków po 3 wywołania; alokacje: CDP `HeapProfiler` (256 B) na 20
  wywołań, KB/wywołanie, osobno ramki `getParameters` + `getProgramCacheKey` z potomkami.
- **„Przed” i „po” na jednej klatce:** w buildzie z łatką narzędzie (`TOGGLE=1`) zakłada z powrotem materiał bazowy
  na 61 siatek z lustrem (= stan obecny), mierzy i robi zrzut, potem wraca do luster i robi trzeci zrzut. Dodatkowo
  osobne strony z buildem bez łatki (`before`) dla liczników i startu.
- **Linki shaderów:** owinięty `linkProgram`; link, którego stos przechodzi przez `setProgram`, to kompilacja przy
  rysowaniu (zatrzymuje klatkę) — liczone od nawigacji; osobno linki wewnątrz `App.frame` (kryterium D-65).
  Przełączenia: noc (lato), zima nocą (`seasons` włączone), zima w dzień, zmiana jakości na drugą i z powrotem
  (z przeładowaniem tekstur).

## CPU klatki: `renderer.render()`

| jakość / kamera | przebudowy programu przed → po (z tego cień) | alloc render() KB | alloc `getParameters`+klucz KB | ms mediana (min) |
|---|---|---|---|---|
| high 60 m (jedna strona) | 10 → **6** (4 → 4) | 99,5 → **82,2** (−17 %) | 48,5 → **28,9** (−40 %) | 0,87 → 0,87 (0,6 → 0,7) |
| high 320 m (jedna strona) | 10 → **2** (2 → 2) | 86,3 → **35,1** (−59 %) | 49,2 → **9,7** (−80 %) | 2,27 → 0,67 (0,4 → 0,3) |
| high 60 m (osobne buildy) | 10 → 6 | 102,8 → 81,3 (−21 %) | 48,8 → 28,7 (−41 %) | 3,73 → 2,07 (0,8 → 0,7) |
| high 320 m (osobne buildy) | 10 → 2 | 90,5 → 50,0 (−45 %) | 48,7 → 9,9 (−80 %) | 2,30 → 2,07 (0,5 → 0,3) |
| low 60 m (jedna strona) | 8 → **4** (4 → 4) | 83,5 → **67,5** (−19 %) | 39,2 → **19,8** (−49 %) | 1,30 → 1,60 (0,47 → 0,43) |
| ultra 60 m (jedna strona) | 10 → **6** (4 → 4) | 82,2 → 82,0 (0 %) | 45,6 → **28,9** (−37 %) | 3,10 → 3,07 (0,63 → 1,83) |

- Znikają dokładnie przebudowy `model-wood`, `model-cloth` (przy 320 m też `model-bark`). Zostają: **głębia cienia**
  (wspólny `_depthMaterial` w `WebGLShadowMap` rysuje i instancje, i budynki — 4 przy 60 m, 2 przy 320 m) oraz
  **`model-grass`** (2; kępy trawy mają `instanceColor`, łaty trawy nie — ten sam materiał, inny `instancingColor`).
- Alokacje: `getParameters` z kluczem to dziś 40–57 % alokacji render(); po łatce 12–35 %. Ultra 60 m: całość
  render() bez zmiany mimo −17 KB w `getParameters` — w tym oknie wpadła zwykła klatka aplikacji (tło 5–15 KB, jak
  w render-scale); liczba przebudów i KB `getParameters` są pewne, suma — w szumie.
- **ms są w szumie** (kontener z load 13–16 przez inne sesje; `performance.now()` 0,1 ms). Na telefonie liczyć
  zysk z liczników: 4–8 przebudów mniej na klatkę i 17–40 KB mniej śmieci na klatkę → przy 60 fps 1–2,4 MB/s mniej
  dla młodej generacji. Zgodne z szacunkiem z render-scale (−40–65 % `getParameters`, −25–45 % alloc), przy 320 m
  lepiej.
- Draw calls i trójkąty identyczne przed/po (te same surowe liczniki GL w obu trybach).

## Programy i kompilacje

| | przed | po |
|---|---|---|
| programy po starcie (low / high / ultra) | 44 / 47 / — (ultra przed nie mierzone osobno; na jednej stronie 48 w obu trybach) | 44 / 47 / 48 |
| linki łącznie do końca pomiaru, high | 56 | 56 |
| linki przy rysowaniu na starcie, high (pierwsze ~3 s, przed pre-warmem) | 22 | 22 (te same programy) |
| linki w klatce: noc / zima nocą / zima w dzień | 0 / 0 / 0 | 0 / 0 / 0 |
| linki w klatce: high → low → high / ultra → low → ultra | 0 / — | 0 / 0 |
| linki w klatce: low → high → low | **2** / 0 | **2** / 0 |

Lustro ma ten sam `customProgramCacheKey` i ten sam stan, więc dostaje **ten sam** `WebGLProgram` z cache
(liczba programów i lista linków na starcie bez zmian; jedyna różnica to nazwa — program bierze nazwę materiału,
który poprosił o niego pierwszy, np. `model-cloth-inst` zamiast `model-cloth`).

**low → high (2 linki w klatce) jest także bez łatki** (build `before`, ta sama liczba i te same programy:
`billboard-depth` ×2 — cień dalekich drzew włącza się dopiero na high, a `treeQualityVariants` nie przygotowuje
wariantu głębi). To osobny, istniejący wcześniej przypadek D-65 (pomiar D-65 startował z high) — do BACKLOG, nie
blokuje #5.

**Ablacja (dowód, że strażnik jest potrzebny):** build z łatką, ale bez dopisania luster do mapy
`prewarmMaterialSwap` w `view.ts`. Po załadowaniu tekstur (`applyTextures('wood', normal+roughness)`) program
`model-wood-inst` linkuje się **przy rysowaniu** (36,5 s od startu; łącznie dalej 56 linków — ten sam program, tylko
skompilowany w klatce zamiast w pre-warmie). To dokładnie ryzyko „rozjechania się kopii”: lustro z nową mapą ma
inny klucz niż wariant przygotowany tylko dla bazy. Z pełną łatką tego linku nie ma.

## Obraz

Diff pikseli (dowolny kanał, dowolna różnica), ta sama zamrożona klatka, materiały bazowe vs lustra:

| zrzut | różne piksele | max różnica kanału |
|---|---:|---:|
| low 60 m | **0** | 0 |
| high 60 m | **0** | 0 |
| high 320 m | **0** | 0 |
| ultra 60 m | **0** | 0 |
| low / high / ultra zima nocą 60 m | **0** / **0** / **0** | 0 |
| kontrola: lustra → baza → lustra (trzeci zrzut vs pierwszy), wszystkie | 0 | 0 |

Obraz bit w bit, więc par zrzutów nie dołączam. Uwaga metodyczna: porównanie **między stronami** (build przed vs
build po) daje 4–7 % różnych pikseli — ale tyle samo (12,7 %) daje ten sam build `before` na dwóch stronach: czas
renderu (woda, wiatr, bezczynne konie) płynie w realnym czasie, zanim klatka zostanie zamrożona, i każda strona
zamraża go w innym momencie. Dlatego dowodem jest para na jednej stronie.

## Ryzyka (dokładna lista)

1. **Rozjechanie stanu lustra i bazy.** Wszystko, co zmienia materiał bazowy po utworzeniu, musi przejść przez
   `syncInstanced`. Dziś: `applyTextures` i `setTreeQuality` — obsłużone. **Poza modułem** jest jedna mutacja:
   `bakeTreeBillboards` (`models/trees.ts`) ustawia `map`, `alphaTest`, `defines` na `modelMaterial('billboard')`
   wprost — dziś bez skutków (billboard nie ma lustra, drzewa nie idą przez `Parts`), ale to wzór, który zepsułby
   lustro. Pola **nie** synchronizowane: `color`, `roughness`, `metalness`, `emissive`, `opacity`, `transparent`,
   `vertexColors`, `depthWrite`, `polygonOffset`, `fog` — nikt ich dziś nie zmienia po utworzeniu; zmiana któregoś
   dałaby różnicę obrazu (wóz inny niż budynek), nie crash.
2. **Pre-warm (D-65).** Każda mapa „materiał → wariant” dla `prewarmMaterialSwap` musi zawierać lustra
   (`materialsFor`). Bez tego: link w klatce przy pierwszym załadowaniu tekstur i przy każdej zmianie zestawu map
   (zmierzone w ablacji). Nowe miejsca budujące takie mapy muszą o tym pamiętać.
3. **Przełączniki jakości.** `setTreeQuality` i `treeQualityVariants` obsługują lustra — dziś jałowo (rodzaje drzew
   nie mają luster). Jeśli kiedyś przełącznik jakości zacznie zmieniać materiały wozów/budynków (np. `normalMap`
   tylko na ultra), musi przejść przez ten sam moduł.
4. **Zima / noc / mgła.** Działają przez uniformy wspólne (światła, mgła sceny, `treeUniforms`, `foliageLift`,
   uniformy terenu) — lustro dostaje je tak samo; zmierzone 0 linków i 0 różnych pikseli. Ryzyko pojawi się tylko,
   gdyby ktoś dodał uniform per-materiał w `onBeforeCompile` przez *closure na materiale* (np. `m.userData.uX` czytane
   z `this`): hook jest wspólny, ale `this`/`userData` lustra to inny obiekt. Dziś żaden hook materiałów modeli tak
   nie robi (teren robi, ale teren nie ma lustra).
5. **`onBeforeCompile` per materiał.** Lustro dzieli funkcję hooka i klucz z bazą; gdyby hook kiedyś zależał od
   tożsamości materiału (np. `if (m === modelMaterial(...))`), lustro dostałoby inny shader przy tym samym kluczu
   programu — błąd trudny do zauważenia (cache zwróciłby program bazy). Reguła: hooki zależne tylko od `key`.
6. **Pamięć / dispose.** +1 obiekt materiału na rodzaj użyty przez `Parts` (kilka) (bez nowych programów i tekstur — mapy współdzielone). Nikt nie
   woła `dispose()` na materiałach modeli; gdyby zaczął, musi zwolnić też lustro (inaczej `WebGLShadowMap`
   trzyma kopię głębi dla alfa-materiałów).
7. **Zysk zostaje częściowy.** Pozostałe przebudowy: wspólny materiał głębi cienia (instancje + budynki) i trawa
   (`instanceColor`). Pierwsze da się zdjąć wspólnym `customDepthMaterial` dla siatek `Parts` (prewarm już obsługuje
   `customDepthMaterial`), drugie — osobnym materiałem trawy dla kęp. Osobne pozycje, nie w tej łatce.

## Rekomendacja: **wdrożyć ze strażnikiem**

- Zysk mierzalny i darmowy dla obrazu: −4…−8 przebudów programu na klatkę, −17…−40 KB alokacji na klatkę
  (−40…−80 % w `getParameters`), 0 nowych programów, obraz bit w bit na każdej jakości, noc i zima bez kompilacji.
- Strażnik (w łatce lub dopisać przy wdrożeniu):
  1. test `tests/materials-mirror.test.ts` (już w łatce) — rozszerzyć o porównanie wszystkich pól z listy
     `syncInstanced` po każdej publicznej funkcji modułu;
  2. `instancedMaterial` odmawia rodzajów drzew (`billboard`, `leaves`, `needles`, `trunk`) albo
     `bakeTreeBillboards` przechodzi na funkcję modułu z `syncInstanced` — zamyka jedyną mutację spoza modułu;
  3. w trybie `?debug=1` po pre-warmie sprawdzać, że każdy materiał ze sceny o nazwie `*-inst` ma te same mapy /
     `defines` / `alphaToCoverage` co baza (asercja w konsoli; koszt zerowy w produkcji);
  4. przy wdrożeniu powtórzyć `TOGGLE=1 node tools/render5-materials.mjs …` dla low/high/ultra (oczekiwane: 0
     pikseli, 0 linków w klatce) i `npm run shots`.
- Zapis w DECISIONS: „materiały modeli dla `InstancedMesh` to lustra; zmiany materiałów tylko przez
  `models/materials.ts`”.

## Odtwarzanie

```bash
npx vite build --base ./ --sourcemap --minify false --outDir <r5>/before
git apply docs/research/2026-11-05-render5-materials.patch
npx vite build --base ./ --sourcemap --minify false --outDir <r5>/after && git checkout src/ && rm tests/materials-mirror.test.ts
(cd <r5> && python3 -m http.server 5199)
TOGGLE=1 node tools/render5-materials.mjs http://127.0.0.1:5199/after/ high <out> 60,320 200 1   # pary na jednej stronie + przełączenia
node tools/render5-materials.mjs http://127.0.0.1:5199/before/ low <out> "" 200 1                 # sam start + przełączenia
python3 tools/render5-diff.py <out> <out> high-60.png   # albo porównanie par *-base.png
```

Ablacja: łatka bez zmiany w `src/render/view.ts` (`git apply …; git checkout src/render/view.ts`). Czas na
SwiftShader przy load 13–16: ok. 10–12 min na odległość (pomiar + zrzuty), 10–15 min przełączenia.
