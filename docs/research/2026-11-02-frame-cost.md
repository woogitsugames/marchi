# Koszt klatki po dzisiejszych zmianach wizualnych (P1)

Data: 2026-11-02. Porównanie: `9618287` (przed: stare drzewa/konie/HUD) vs HEAD `370733d` (D-40 chód + 3 LOD koni,
D-41 nowe drzewa z alpha-to-coverage/wiatrem/crossfade, D-43 HUD v3 ze spritami border-image, D-45 stabilne parkowanie).
Uwaga: HEAD zawiera też inne zmiany z tego dnia (D-46..D-52: listy, Intl, IDB, itd.), więc różnica nie jest czysto wizualna.

## Zastrzeżenie (ważne)

- Playwright Chromium + **SwiftShader** (GPU w CPU), CDP `Emulation.setCPUThrottlingRate=4`, viewport 412x915.
  Czasy klatek rAF (p50 1.1-1.6 s przy quality=low, 3-4.4 s przy high) to koszt **emulacji GPU**, nie telefonu.
  **Nie wnioskować z nich o FPS na urządzeniu.** Wnioski dotyczą wyłącznie CPU / głównego wątku (JS).
- Okno 20 s przy ~1 klatce/s to tylko 5-17 klatek na przebieg, więc rozrzut jest duży (sim/tick 0.5-10 ms
  między powtórkami tej samej konfiguracji). Różnice poniżej ok. 30% są w szumie.
- JS na klatkę mierzony wrapperami w stronie (`?debug=1`): `loop.advance` (sim + `view.afterTick`),
  `view.frame` (render, wraz z synchronicznym kosztem sterownika GL), `hud.update + markers.update` (DOM-HUD).
  Przy ~1 fps na klatkę przypada 0.2-2.5 ticka, więc sim podaję **na tick**.
- Profil CDP (próbkowanie 0.5 ms, mapowanie sourcemapą na pliki): ok. 96-98% czasu to `(program)` = natywne
  GL/SwiftShader na głównym wątku; sam JS to 2-4% (300-900 ms z 20 s).
- Sceny: m1 bot ff=170; sandbox z drabiną bench (tools/frame-cost-bench.json: mosty, 16 magazynów, 24 konsumentów)
  + 48 / 98 kupionych wozów (razem ~50 / ~100; w ruchu tylko 12-13, reszta stoi przy stajni, więc to też test D-45).
  dpr 2, 1.5 i 0.5 (0.5 = mało pikseli, żeby odsłonić koszt CPU). Skrypt: `tools/frame-cost.mjs`.

## Tabela przed / po (przed / po, throttle 4x)

| scena | rAF p50 ms | rAF p95 ms | JS/klatkę ms | z tego render ms | DOM-HUD ms | sim ms/tick | draw calls | trójkąty | węzły DOM | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|
| m1 low dpr2 | 1167 / 1533 | 1917 / 2183 | 18.9 / 22.6 | 15.6 / 17.8 | 1.4 / 1.0 | 0.5 / 0.9 | 31 / 31 | 235k / 236k | 174 / 186 | 64 / 63 |
| m1 low dpr1.5 | 1300 / 1383 | 2050 / 1967 | 20.5 / 22.8 | 16.2 / 18.5 | 1.0 / 1.2 | 0.8 / 0.7 | 31 / 31 | 235k / 236k | 174 / 186 | 64 / 65 |
| m1 high dpr2 | 4150 / 4433 | 4683 / 5200 | 25.0 / 15.4 | 16.5 / 11.7 | 3.0 / 1.4 | 1.8 / 0.5 | 34 / 36 | 262k / 262k | 174 / 186 | 64 / 77 |
| m1 high dpr1.5 | 2983 / 3283 | 3217 / 3433 | 24.9 / 25.8 | 17.7 / 12.6 | 1.6 / 1.5 | 2.3 / 5.2 | 34 / 36 | 262k / 262k | 174 / 186 | 57 / 56 |
| m1 high dpr0.5 | 1383 / 1583 | 2217 / 1867 | 29.1 / 40.8 | 18.9 / 30.8 | 2.9 / 2.5 | 2.3 / 2.7 | 34 / 36 | 262k / 262k | 174 / 186 | 83 / 103 |
| sandbox ~50 w. low dpr2 | 1417 / 1550 | 2117 / 2183 | 31.0 / 31.4 | 22.6 / 19.4 | 1.7 / 2.1 | 1.7 / 2.1 | 35 / 38 | 398k / 386k | 303 / 349 | 108 / 70 |
| sandbox ~50 w. high dpr2 | 4433 / 4067 | 4816 / 4700 | 30.5 / 16.6 | 16.8 / 7.2 | 1.6 / 2.0 | 3.6 / 1.5 | 40 / 39 | 420k / 400k | 303 / 349 | 93 / 87 |
| sandbox ~100 w. low dpr2 | 1533 / 1567 | 2067 / 2083 | 32.9 / 32.0 | 24.2 / 19.6 | 1.7 / 2.1 | 1.3 / 1.8 | 35 / 38 | 398k / 386k | 303 / 349 | 67 / 102 |
| sandbox ~100 w. high dpr2 | 4050 / 4100 | 5550 / 4467 | 26.7 / 36.8 | 17.4 / 15.5 | 1.7 / 4.1 | 1.9 / 6.0 | 40 / 38 | 420k / 395k | 303 / 349 | 71 / 88 |
| sandbox ~100 w. high dpr0.5 | 1600 / 1517 | 2250 / 2350 | 39.2 / 40.5 | 25.1 / 27.9 | 3.5 / 3.1 | 2.5 / 1.9 | 38 / 39 | 419k / 399k | 303 / 349 | 101 / 104 |

p99 pokrywa się z p95 (mniej niż 100 klatek na przebieg). JS/klatkę = cały `App.frame` (sim + render + HUD + reszta).

Wnioski z tabeli:

- **Średnio po wszystkich 10 scenach: 27.9 ms (przed) vs 28.5 ms (po) JS na klatkę, czyli +2%, w szumie.**
  Nie widać regresji CPU od D-40/D-41/D-43/D-45 w skali, którą ten pomiar rozróżnia.
- Draw calls +0..+3 (31 -> 31, 34 -> 36, 35 -> 38), trójkąty w m1 bez zmian, w sandboxie **-3..-6%** (398k -> 386k,
  420k -> 400k; LOD koni i drzew robi swoje).
- DOM: +12 węzłów w m1 (174 -> 186), +46 w sandboxie (303 -> 349) po HUD v3. Koszt HUD na klatkę 1-4 ms w obu wersjach.
- Jedyne powtarzalne pogorszenie: **m1 high dpr0.5 render 18.9 -> 30.8 ms** (dwa przebiegi: 38.3 i 30.8 vs 18.6 i 18.9).
  Profil wskazuje przyczynę: `getProgramInfoLog` 167 ms (po) vs 28 ms (przed) w oknie pomiaru. To **jednorazowa
  kompilacja/linkowanie shaderów** (nowe warianty materiałów: alpha-to-coverage, wiatr, crossfade LOD) trafiająca w
  pierwsze sekundy gry, a nie koszt stały każdej klatki; przy 13 klatkach w oknie rozkłada się na ok. 13 ms/klatkę.
  Hipoteza, niezweryfikowana osobnym przebiegiem po rozgrzaniu (wymagałoby dłuższego okna).
- quality=high jest ok. 3x wolniejsze w rAF niż low w obu wersjach (MSAA/A2C na programowym GL) - to nie regresja.

## Top 5 funkcji (po, self-time JS z profilu CDP, 20 s, throttle 4x)

Łącznie JS to ok. 2-4% okna; reszta to natywne GL. Wartości z dwóch scen (m1 / sandbox 100 w.).

1. three.js link/compile programów: `getProgramInfoLog` 167 / 60 ms, `setProgram` three.module.js:17279 11-20 ms - jednorazowe.
2. `(anon)` `src/render/terrainTextures.ts:185` (składanie mipmap KTX2) 26-53 ms - jednorazowe przy ładowaniu.
3. `dijkstra` `src/sim/network.ts:301` 44 ms (sandbox 100 w.) - sim, skok na ticku dyspozytora.
4. `WagonsView.frame` `src/render/wagonsView.ts:389` 37 ms (sandbox) + `markOpposing` :339 13 ms.
5. `(garbage collector)` 117 ms (sandbox po) vs 61 ms (przed) - więcej alokacji; warto sprawdzić.

## Zoptymalizować (ranking, szacowany zysk; wartości z throttle 4x, na telefonie proporcjonalnie)

1. **Pre-warm shaderów** po `setWorld` (`src/render/view.ts:222`): `renderer.compileAsync(scene, camera)` dla materiałów
   drzew (`models/trees.ts:477`), wozów (`models/wagon.ts:563,572`), `models/materials.ts:257`, terenu (`terrain.ts:637`),
   także wariant quality high (A2C przełączane w `materials.ts:290`). Zysk: usuwa ok. 150 ms jednorazowego zacięcia
   (ok. 13 ms/klatkę w pierwszych 20 s przy 4x). Najpewniejszy punkt.
2. **`markOpposing` tylko raz na tick**, nie co klatkę (`src/render/wagonsView.ts:339`, wywołanie z `frame` :389):
   zysk ok. 0.5-1 ms/klatkę przy 100 wozach (O(wozów) + lookup Map `snaps` co klatkę).
3. **`rankStalls` raz na tick** (`src/ui/app.ts:570` -> `src/ui/stalls.ts:41`): wywoływane co klatkę, a w środku
   `JSON.stringify(b.status)` na każdy zablokowany budynek; cache po `tick`. Zysk ok. 0.2-1 ms/klatkę (`src/ui` w profilu 28-50 ms/20 s).
4. **Rozłożenie dyspozytora / cache DistMap** (`src/sim/network.ts:301`, `src/sim/logistics.ts:84`): już opisane w
   `docs/PERF.md`; dijkstra to najgorętsza funkcja sim w profilu (44 ms/20 s), skoki na tickach dyspozytora x4 throttle
   ok. 4-6 ms/tick w sandboxie 100 w. Zysk: spłaszczenie p99 ticka, nie średniej.
5. **GC: sprawdzić alokacje na klatkę** w render (117 vs 61 ms): kandydaci `wagonsView.ts:339-372` (`touched`, domknięcie `ins` tworzone co wywołanie),
   `view.ts:311`. Zysk: mniej pauz GC, ok. 1-2 ms/klatkę uśrednione (niska pewność).
6. **Składanie tekstur terenu** (`terrainTextures.ts:185`) przenieść na czas menu/ekranu ładowania lub do workera:
   26-53 ms jednorazowo, bez wpływu na klatki w trakcie gry.
7. Dla GPU (poza zakresem tego pomiaru): `quality=high` + A2C + dpr 2 jest ciężkie; dźwignią pozostaje dynres, nie JS.

## Odtwarzanie

```
npx vite build --sourcemap --minify false --outDir dist-perf && npx vite preview --outDir dist-perf --port 5202
node tools/frame-cost.mjs http://127.0.0.1:5202 new sandbox high 2 98 1 20   # label scene quality dpr wagons profile seconds
```

Surowe wyniki: 20 przebiegów (10 par przed/po) + 8 przebiegów dpr0.5 (w tym 4 z profilem).
