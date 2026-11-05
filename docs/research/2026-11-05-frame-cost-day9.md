# Koszt klatki po render #1–#6, D-126 i D-133 — dzień 9d

Data: 2026-11-05, gałąź `claude/research-day9d`. Narzędzia: `tools/frame9-cost.mjs` (pomiar jednej sceny),
`tools/frame9-table.mjs` (tabele), `tools/frame9-m13-peak.ts` (jak bardzo zajęta jest każda misja),
`tools/frame9-sim50.ts` (tick symulacji w fazie dyspozycji i poza nią). Surowe dane: `docs/research/frame9-data/`
(`*-r1.json`, `*-r2.json`, `tables.md`, `perf-sim.txt`, `run.sh`). **Nic w `src/` nie zmienione.**

**W skrócie:**
- `renderer.render()` to nadal **48–66 % CPU klatki** (kamera 60 m) i 37–59 % (160 m). Z tego przebieg cienia to
  13–28 % całej klatki.
- Wozy (`wagons.frame` + `afterTick`) to 4–30 % i rosną z liczbą wozów.
- UI (HUD, pinezki, ranking, arkusze, próbki tempa/floty) to 12–30 %.
- Symulacja to tylko **0–9 %**.
- Alokacje: **3,4–12 MB na sekundę gry** (×4, 60 kl./s). Największe źródła: three.js w `render()`, w tym przebudowy
  programu (wciąż 4–6 na render przy 60 m), oraz `roads.walkBack` (kolejki wozów, przy 200 wozach źródło nr 1–2).
- Trzy następne kroki bez zmiany obrazu:
  - #1: przebudowy programu w przebiegu cienia i trawie;
  - #2: kolejki wozów liczone raz na tick zamiast O(k²) co klatkę;
  - #3: wymuszony layout co 250 ms (arkusz z „Naprawą” i prostokąty przeszkód) oraz budowanie HTML listu przewozowego co klatkę.
- Największa pojedyncza pula to CPU przebiegu cienia. Jej obniżenie (cień co 2. klatkę albo cache statycznych
  rzucających) **zmienia obraz** i wymaga zrzutów oraz decyzji właściciela.

## Zastrzeżenia (czytać przed liczbami)

- Chromium headless + SwiftShader, 412×915, DPR 0,5, CPU kontenera bez throttlingu. Kontener był obciążony przez
  inną sesję: load average 13 → 8 w trakcie pomiarów (4 rdzenie). **ms mają rozrzut ×1,5–3 między przebiegami**,
  dlatego każda konfiguracja ma dwa przebiegi (osobne procesy) i w tabelach są obie mediany oraz min–max.
  **Liczniki** (draw, trójkąty, przebudowy programu, upload, MB alokacji) są powtarzalne: różnice między przebiegami
  wynoszą < 3 %.
- **Metoda „syntetycznej sekundy”.** Pod SwiftShaderem klatka z rasteryzacją trwa sekundy, a ciąg wywołań szybko
  blokuje główny wątek (pierwsza próba: 10+ min na jedną scenę). Dlatego narzędzie woła **prawdziwe `App.frame`**
  60× z rzędu (`now += 16,67 ms`) przy tempie ×4, czyli dokładnie 40 ticków na sekundę z `onTick`, próbkami
  tempa/floty, HUD, pinezkami, arkuszami i rendererem.
  - Własny `requestAnimationFrame` przeglądarki jest w tym czasie wstrzymany.
  - Wywołania `draw*` WebGL są liczone, ale **nie przekazywane** do sterownika. Cała praca CPU three.js (sortowanie,
    culling, `setProgram`, uniformy, wiązanie VAO, upload buforów) idzie normalnie, GPU nic nie rasteryzuje.
  - Wynik to **ms CPU desktopu na sekundę gry przy 60 fps ×4**. Kolumna „ms/kl.” to ta wartość / 60. Na średnim
    Androidzie liczyć ×3–5.
- Owinięcie **każdego** wywołania GL (~500 na klatkę) do liczników dodaje narzut. Udział „three: draw submit” i
  „(program)” (natywne wiązania GL i IPC do procesu GPU) jest przez to zawyżony. Porównania między scenami są uczciwe.
- Profil CPU (próbkowanie 0,2 ms) sam spowalnia stronę o ~×2 (suma próbek 150–330 ms/s przy 65–260 ms/s bez
  profilera). Z profilu czytać **udziały**, nie ms.
- Styl i layout: ta pętla nie maluje, więc koszt stylu i layoutu przy malowaniu mierzy osobne 6-sekundowe okno
  prawdziwych klatek (0,02–2,3 ms na klatkę, kilka klatek w oknie — orientacyjne). **Wymuszony** layout w klatce
  (odczyt `offsetHeight` / `getBoundingClientRect` po zapisach DOM) jest widoczny w profilu i opisany niżej.
- **Sceny:**
  - **Piaskownica:** `frame-cost-bench.json` + N wozów, rozrzuconych po drogach jak w `render-scale.mjs` (60 %
    z ładunkiem, 120 ticków jazdy, korki na mostach). To sztucznie duże kolejki przy mostach, a więc **górna granica**
    kosztu kolejek. W piaskownicy jest otwarty arkusz z doku „Naprawa” (`.sheet +dock`), co odpowiada graczowi,
    który czyta przyczynę.
  - **Misja XIII (`m13`):** 3 wozy kupione w 0:20 (strategia „wlasciwa” z `tools/bot-m13.ts`), pomiar od 3:30,
    czyli szczytu przestojów (~2 budynki). **XIII nie jest najbardziej zajętą misją:** w szczycie jadą 4 wozy
    (`tools/frame9-m13-peak.ts`).
  - **Misja XII (`m12`):** dołożona jako rzeczywisty szczyt. Ma 11 budynków i 12 wozów, ~10,5 jadących przez minuty
    1–8, 4–6 przestojów. Pomiar od 4:00, bez komend gracza.
  - Kamera 60 m (wozy w LOD „mid”) i 160 m (LOD1), nad największym skupiskiem wozów, odchylenie 0,6.
  - Jakość low i high. Ultra i 320 m nie mierzone. Pominięto tylko te dwie rzeczy, cała macierz z polecenia ma po
    2 przebiegi.

## Gdzie idzie klatka — udziały (szybszy z dwóch przebiegów)

| scena | jakość | ms/s (ms/kl.) 60 m | render() | z tego cień | wozy (frame) | afterTick | sim | UI* | view inne |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| piaskownica 50 | low | 129 (2,1) | 61 % | 21 % | 8 % | 2 % | 9 % | 20 % | 5 % |
| piaskownica 50 | high | 169 (2,8) | 66 % | 28 % | 8 % | 2 % | 4 % | 17 % | 5 % |
| piaskownica 100 | low | 116 (1,9) | 54 % | 13 % | 14 % | 3 % | 8 % | 19 % | 5 % |
| piaskownica 100 | high | 170 (2,8) | 59 % | 22 % | 12 % | 3 % | 5 % | 17 % | 5 % |
| piaskownica 200 | low | 216 (3,6) | 57 % | 14 % | 26 % | 4 % | 7 % | 16 % | 6 % |
| piaskownica 200 | high | 257 (4,3) | 48 % | 19 % | 15 % | 3 % | 5 % | 12 % | 5 % |
| XIII 3:30 | high | 104 (1,7) | 61 % | 24 % | 4 % | 1 % | 0 % | 21 % | 6 % |
| XII 4:00 | low | 81 (1,3) | 64 % | 18 % | 5 % | 1 % | 3 % | 24 % | 7 % |
| XII 4:00 | high | 95 (1,6) | 62 % | 22 % | 5 % | 1 % | 2 % | 22 % | 6 % |

| scena | jakość | ms/s (ms/kl.) 160 m | render() | z tego cień | wozy (frame) | afterTick | sim | UI* | view inne |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| piaskownica 50 | low | 90 (1,5) | 59 % | 22 % | 7 % | 2 % | 6 % | 23 % | 5 % |
| piaskownica 50 | high | 98 (1,6) | 52 % | 18 % | 6 % | 2 % | 6 % | 28 % | 7 % |
| piaskownica 100 | low | 74 (1,2) | 48 % | 19 % | 14 % | 4 % | 7 % | 24 % | 4 % |
| piaskownica 100 | high | 102 (1,7) | 41 % | 16 % | 13 % | 3 % | 5 % | 29 % | 5 % |
| piaskownica 200 | low | 98 (1,6) | 37 % | 15 % | 21 % | 5 % | 6 % | 30 % | 4 % |
| piaskownica 200 | high | 117 (1,9) | 38 % | 15 % | 19 % | 4 % | 6 % | 27 % | 4 % |
| XIII 3:30 | high | 65 (1,1) | 57 % | 26 % | 11 % | 1 % | 2 % | 20 % | 4 % |
| XII 4:00 | low | 61 (1,0) | 58 % | 21 % | 5 % | 2 % | 3 % | 22 % | 5 % |
| XII 4:00 | high | 64 (1,1) | 59 % | 24 % | 3 % | 1 % | 3 % | 23 % | 6 % |

\* UI = `hud.update` + `markers.update` + `ranking.get` + reszta `App.frame` (podpowiedź tempa, arkusze co 250 ms,
prostokąty przeszkód, duch) + `onTick` poza widokiem (próbki tempa, czekania na wejście, floty D-127, obserwator
audio, kronika).

Na telefonie (×3–5): misje 3–9 ms/klatkę CPU, piaskownica 200 przy 60 m **13–22 ms** — powyżej budżetu 16,7 ms
jeszcze przed GPU. Przy 160 m 5–10 ms.

## Tabele szczegółowe

ms CPU na sekundę gry (×4, 60 kl.). W komórce: mediana przebiegu 1 / przebiegu 2. „Rozrzut” = min–max
wszystkich syntetycznych sekund obu przebiegów. Pełne tabele z licznikami: `frame9-data/tables.md`.

### Kamera 60 m

| scena | jakość | razem | rozrzut | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 129 / 169 | 122–186 | 11,8 / 6,6 | 2,0 / 2,1 | 0,3 / 0,4 | 9,7 / 12,7 | 78 / 94 | 27 / 32 | 5,8 / 11,4 | 6,5 / 8,2 | 1,8 / 4,5 | 2,7 / 2,5 | 13,8 / 14,9 |
| sandbox50 | high | 561 / 169 | 153–755 | 9,5 / 6,8 | 5,2 / 2,8 | 0,9 / 0,5 | 20,5 / 13,2 | 428 / 111 | 149 / 47 | 11,4 / 7,7 | 24,2 / 7,0 | 2,5 / 2,7 | 3,7 / 2,5 | 18,1 / 15,3 |
| sandbox100 | low | 137 / 116 | 108–258 | 7,1 / 9,2 | 4,7 / 4,0 | 0,6 / 0,3 | 23,5 / 15,7 | 71 / 63 | 27 / 16 | 9,6 / 5,7 | 7,0 / 7,0 | 1,3 / 2,0 | 2,2 / 2,8 | 15,4 / 9,5 |
| sandbox100 | high | 245 / 170 | 162–397 | 16,5 / 9,3 | 5,5 / 5,2 | 0,6 / 0,5 | 28,9 / 19,6 | 140 / 101 | 69 / 37 | 16,1 / 8,4 | 8,2 / 10,2 | 3,3 / 2,9 | 4,0 / 3,2 | 17,5 / 12,5 |
| sandbox200 | low | 462 / 216 | 205–651 | 12,2 / 15,9 | 60,6 / 7,9 | 1,0 / 0,9 | 91 / 56 | 148 / 123 | 30 / 30 | 8,2 / 13,2 | 24,6 / 7,7 | 6,9 / 4,1 | 29,2 / 4,8 | 18,6 / 16,5 |
| sandbox200 | high | 307 / 257 | 150–313 | 8,8 / 11,9 | 8,8 / 8,6 | 0,5 / 0,7 | 33,6 / 38,5 | 110 / 123 | 46 / 49 | 8,3 / 12,0 | 9,4 / 7,4 | 3,5 / 3,1 | 4,4 / 4,5 | 14,1 / 14,3 |
| m13 | high | 104 / 104 | 71–113 | 0,5 / 1,0 | 0,8 / 0,5 | 0,5 / 5,1 | 4,1 / 4,5 | 63 / 72 | 25 / 23 | 6,1 / 3,8 | 14,3 / 7,2 | 0,7 / 0,9 | 0,5 / 0,4 | 5,8 / 4,2 |
| m12 | low | 118 / 81 | 74–178 | 2,4 / 2,6 | 1,0 / 1,1 | 2,8 / 0,5 | 14,5 / 4,0 | 71 / 52 | 19 / 14 | 7,8 / 5,3 | 8,6 / 10,3 | 4,4 / 1,6 | 1,0 / 0,6 | 8,4 / 6,4 |
| m12 | high | 178 / 95 | 92–181 | 2,5 / 2,1 | 3,6 / 1,1 | 0,5 / 0,2 | 12,1 / 4,7 | 117 / 59 | 32 / 21 | 11,6 / 6,0 | 18,4 / 10,5 | 3,6 / 1,6 | 0,7 / 0,9 | 5,3 / 7,8 |

### Kamera 160 m

| scena | jakość | razem | rozrzut | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 116 / 90 | 76–116 | 12,3 / 5,0 | 2,5 / 2,1 | 0,5 / 0,4 | 9,8 / 6,7 | 54 / 53 | 18 / 20 | 5,2 / 4,9 | 7,1 / 6,1 | 2,9 / 2,3 | 3,4 / 2,6 | 13,0 / 9,1 |
| sandbox50 | high | 203 / 98 | 73–215 | 5,7 / 5,9 | 2,3 / 2,2 | 0,3 / 0,2 | 13,0 / 6,3 | 113 / 51 | 41 / 18 | 4,9 / 6,6 | 5,2 / 11,7 | 2,1 / 1,5 | 3,0 / 2,4 | 11,7 / 12,2 |
| sandbox100 | low | 151 / 74 | 68–229 | 10,3 / 5,0 | 4,0 / 2,8 | 0,6 / 0,3 | 14,8 / 10,3 | 67 / 35 | 19 / 14 | 6,8 / 3,2 | 20,8 / 5,2 | 2,6 / 2,1 | 2,4 / 2,1 | 11,5 / 7,9 |
| sandbox100 | high | 102 / 116 | 76–172 | 5,5 / 7,4 | 3,3 / 3,5 | 0,2 / 0,4 | 13,4 / 14,0 | 41 / 58 | 17 / 25 | 4,7 / 4,3 | 6,1 / 11,9 | 2,6 / 2,5 | 2,1 / 2,1 | 18,0 / 11,7 |
| sandbox200 | low | 117 / 98 | 81–127 | 6,6 / 5,7 | 5,7 / 5,1 | 0,2 / 0,4 | 17,6 / 20,3 | 54 / 37 | 11 / 14 | 4,5 / 4,0 | 5,0 / 5,2 | 6,9 / 11,6 | 2,6 / 2,5 | 8,0 / 9,3 |
| sandbox200 | high | 117 / 152 | 95–190 | 6,7 / 9,8 | 4,8 / 7,9 | 0,6 / 0,3 | 21,8 / 27,3 | 45 / 58 | 18 / 21 | 4,8 / 4,5 | 7,0 / 7,2 | 9,6 / 13,0 | 2,8 / 4,5 | 11,8 / 15,0 |
| m13 | high | 74 / 65 | 55–75 | 1,1 / 1,0 | 0,6 / 0,4 | 0,3 / 0,3 | 3,8 / 6,9 | 49 / 37 | 20 / 17 | 3,7 / 2,4 | 8,3 / 6,4 | 0,9 / 1,1 | 0,4 / 0,6 | 5,6 / 4,3 |
| m12 | low | 115 / 61 | 53–128 | 2,2 / 1,6 | 1,2 / 1,2 | 0,6 / 0,3 | 3,9 / 3,2 | 48 / 35 | 11 / 13 | 4,1 / 3,2 | 7,2 / 6,2 | 1,6 / 2,0 | 1,4 / 0,7 | 5,4 / 3,9 |
| m12 | high | 64 / 66 | 41–71 | 2,1 / 1,2 | 0,8 / 0,8 | 0,2 / 0,6 | 2,0 / 2,3 | 38 / 38 | 15 / 14 | 3,9 / 3,6 | 6,9 / 8,0 | 1,3 / 1,8 | 0,6 / 1,0 | 5,8 / 3,0 |

Duże wartości w jednym przebiegu (sandbox50 high 561, sandbox200 low 462) to wywłaszczenie przez drugą sesję.
Drugi przebieg i liczniki są spójne z resztą.

### Liczniki (przebieg 1; przebieg 2 w granicach 3 %)

| scena | jakość | kamera | wozy (jedzie) | rys. mid/far | piny | draw main/cień | tris main/cień | przebudowy programu / render | upload KB/kl. | alloc MB/s gry (r1 / r2) | KB/kl. |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 60 m | 52 (19) | 5/7 | 2 | 79/37 | 438k/223k | 4 | 13,5 | 7,78 / 7,73 | 133 |
| sandbox50 | high | 60 m | 52 (19) | 12/0 | 2 | 83/64 | 558k/373k | 6 | 16,5 | 8,82 / 8,80 | 151 |
| sandbox100 | low | 60 m | 102 (29) | 9/0 | 1 | 63/34 | 458k/237k | 4 | 22,6 | 8,03 / 8,07 | 137 |
| sandbox100 | high | 60 m | 102 (29) | 9/0 | 1 | 79/61 | 586k/397k | 6 | 22,6 | 9,14 / 9,09 | 156 |
| sandbox200 | low | 60 m | 202 (51) | 14/4 | 1 | 67/34 | 522k/256k | 4 | 37,0 | 10,9 / 10,9 | 186 |
| sandbox200 | high | 60 m | 202 (51) | 18/0 | 1 | 80/61 | 628k/396k | 6 | 37,3 | 12,0 / 12,0 | 205 |
| m13 | high | 60 m | 4 (4) | 1/0 | 0 | 62/46 | 349k/184k | 4 | 1,9 | 4,21 / 4,26 | 72 |
| m12 | low | 60 m | 12 (12) | 2/0 | 0 | 59/19 | 310k/87k | 2 | 4,2 | 4,13 / 4,35 | 71 |
| m12 | high | 60 m | 12 (12) | 2/0 | 0 | 62/42 | 401k/224k | 4 | 4,4 | 5,05 / 5,11 | 86 |
| sandbox100 | high | 160 m | 102 (24) | 0/29 | 3 | 62/41 | 481k/269k | 4 | 20,8 | 7,73 / 7,76 | 132 |
| sandbox200 | low | 160 m | 202 (37) | 0/62 | 60 | 49/29 | 407k/216k | 2 | 29,4 | 8,72 / 8,57 | 149 |
| sandbox200 | high | 160 m | 202 (36) | 0/60 | 59 | 52/37 | 433k/244k | 4 | 28,8 | 9,25 / 9,11 | 158 |
| m12 | high | 160 m | 12 (12) | 0/3 | 1 | 41/25 | 303k/139k | 2 | 2,5 | 3,45 / 3,37 | 59 |

- Upload do GPU to już tylko 2–37 KB na klatkę (przed render #1: 640–850). Po #1 to nie jest problem.
- Przebudowy programu: **D-133 zrobił swoje** (z 10 na render), ale zostały **4–6 na render przy 60 m i 2–4 przy
  160 m**. To wspólna `MeshDepthMaterial` w przebiegu cienia i kępy trawy (BACKLOG P1, render #5).
- GC w profilu: 0–8 ms na sekundę gry w piaskownicy. W XII high w przebiegu 1 jeden duży GC dał 19 ms/s, w
  przebiegu 2 tylko 1,3 ms/s. Przy 4–12 MB/s młoda generacja (scavenge ~1–8 MB) czyści się mniej więcej co 1–2 s.

## Kto alokuje (przebieg 2, z poprawionym przypisaniem three.js; KB na sekundę gry)

| scena | razem MB/s | three: render (inne) | three: getProgram/getParameters | three: cień | `roads.walkBack` | `wagonsView.frame` | `markers.update` | inne większe |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| sandbox100 high 60 m | 9,1 | 1225 | **1574** | 572 | 512 | 610 | 360 | `dispatch` 318, `wagonDrawLag` 242, `hash3` 237 |
| sandbox200 high 60 m | 12,0 | 1228 | **1565** | 509 | **1416** | 1055 | 628 | `hash3` 441, `wagonDrawLag` 434, `dispatch` 363 |
| sandbox200 low 160 m | 8,6 | 831 | 536 | — | **1167** | 927 | **1065** | `anchorOf` 365, `calmStall` 237 |
| XIII high 60 m | 4,3 | 939 | **1038** | 374 | — | 299 | — | `updateContract` 269, `lerpKey` 123 |
| XII high 60 m | 5,1 | 1091 | **1042** | 357 | — | 256 | — | `updateContract` 206, `buildingById` 188 |

W przebiegu 1 alokacje three.js poza `getProgram` były błędnie przypisane do `view.ts frame` (wywołujący).
Od przebiegu 2 narzędzie ma osobne kubełki. Test bez inliningu (`JSFLAGS=--no-turbo-inlining`,
`frame9-data/noinline-m12-high.json`) potwierdził, że to nie inlining.

## Top kosztów (CPU i alokacje, wszystkie sceny)

1. **`renderer.render()` stały koszt three.js:** 37–66 % klatki, nie rośnie z liczbą wozów (60–80 draw main,
   34–64 cień). W profilu w kolejności:
   - natywne wiązania GL / IPC („(program)”, `bindVertexArray`, `bufferSubData`, `bindTexture`);
   - `renderBufferDirect`/`setProgram`/uniformy;
   - **przebieg cienia (13–28 % całej klatki** — cała scena drugi raz, na high 61–64 draw);
   - `projectObject` (przejście sceny, ~3–5 %);
   - `getProgram`/`getParameters` (3–5 % CPU, **15–20 % wszystkich alokacji**).
2. **Wozy przy ≥ 100 i korkach:** `wagonsView.frame` 12–26 % przy 60 m. Z tego `roads.cellPoint`/`walkBack` dają
   13–22 ms/s w profilu przy 200 wozach (5–10 %), a `walkBack` jest **największym alokatorem przy 200 wozach**
   (1,2–1,4 MB/s). Przyczyna: każdy stojący wóz w kolejce w każdej klatce chodzi od węzła wstecz o `k · QUEUE_GAP`
   (`wagonsView.ts:488`), więc kolejka k wozów kosztuje O(k²) kroków na klatkę, choć zmienia się tylko na ticku.
3. **Wymuszony layout co 250 ms:** `sheets.update` → `syncDock` czyta `offsetHeight` doku „Naprawa”
   (`sheets.ts:38`), a `occluderRects` czyta `getBoundingClientRect` (`app.ts:995`). Oba odczyty idą **po**
   zapisach HUD i pinezek w tej samej klatce, więc przeglądarka liczy layout synchronicznie.
   - W profilu: `src/ui/sheets.ts` 6–22 ms/s w piaskownicy z otwartym arkuszem (4–8 %), `src/ui/app.ts` 4–9 ms/s
     w misjach (bez arkusza).
   - To dokładnie moment, w którym gracz czyta przyczynę przestoju.
4. **`Hud.updateContract` co klatkę:** buduje HTML pigułki listu przewozowego (`iconSvg` + `tHtml`), tablice
   `goods`/`have` i podpisy, po czym `setHtml` porównuje stringi. hud to 7–18 ms/s w misjach (7–14 % klatki),
   0,2–0,3 MB/s alokacji.
5. **Pinezki przy wielu przestojach:** `markers.update` 0,6–1,1 MB/s przy 59–60 pinezkach (200 wozów, 160 m),
   6–13 ms/s.
6. Mniejsze:
   - `hash3`/`detail` (teren pod wozem) 0,2–0,5 MB/s;
   - `wagonDrawLag`/`stableParking` 0,25–0,45 MB/s;
   - `dispatch` w symulacji ~0,35 MB/s;
   - `calmStall`/`rankStalls` (ranking raz na tick) 0,2–0,4 MB/s;
   - `buildingById` w XII 0,19 MB/s.
   - Próbkowanie floty z D-127 (`sampleFleet`) jest pomijalne: „onTick UI” 0,2–0,9 ms/s; jeden odczyt 5,1 w XIII
     to szum.

## Symulacja (`npm run perf:sim`, 4 przebiegi, load 14 → 8)

| wozy | avg ms/tick | p99 ms | PERF.md (2026-11-01) |
|---|---:|---:|---:|
| 50 | 0,33–0,61 | **6,6–8,5** | 0,25 / p99 2,05–2,35 |
| 100 | 0,10–0,21 | 1,1–1,8 | 0,12 / 1,18–1,38 |
| 200 | 0,08–0,25 | 0,85–1,8 | 0,085 / 0,87 |

Wszystkie przebiegi: 0 błędów niezmienników. 100 i 200 wozów mieszczą się w szumie bazy, ale **p99 przy 50 wozach
jest ~3–4× wyższe we wszystkich 4 przebiegach**. `tools/frame9-sim50.ts`: ticki fazy dyspozycji (tick % 5 = 0)
mają p50 0,16 ms, p90 0,88 ms, p99 24,6 ms (50 wozów), a pozostałe ticki p99 2,9 ms. Tak wysoki p99 także poza
dyspozycją wskazuje na obciążenie kontenera (wywłaszczenie, GC).

`tools/perf-dispatch.ts` jest nieaktualny (łatka nie pasuje do `logistics.ts`). **Do potwierdzenia na spokojnej
maszynie, zanim ktoś nazwie to regresją.** W grze symulacja to 0–9 % klatki, więc nie jest celem optymalizacji.

## Ranking następnych optymalizacji

| # | co (plik / funkcja) | oczekiwany zysk | ryzyko | obraz? |
|---|---|---|---|---|
| 1 | **Ostatnie przebudowy programu:** `customDepthMaterial` dla `InstancedMesh` części (jeden na rodzaj, wspólny z lustrem D-133) albo osobna głębia dla instancji, żeby `WebGLShadowMap` nie przełączał wspólnej `MeshDepthMaterial` między instancjami a zwykłymi siatkami. Kępy trawy: osobny materiał dla wariantu z `instanceColor`. BACKLOG P1 „Dalsze przebudowy”. | Przebudowy 4–6 → ~0–2 na render. Alokacje −1,0–1,6 MB/s (**−15–20 % wszystkich**, 17–26 KB/kl.). CPU −3–5 % klatki. Działa w każdej scenie, także w misjach z 4–12 wozami. | niskie–średnie: głębia musi dostać te same `defines`/`onBeforeCompile` co cień dziś; strażnik jak `mirrorDrift`; pre-warm (D-65/D-136) musi znać nowe warianty | nie (bit w bit, sprawdzić diffem jak w render #5) |
| 2 | **Kolejki wozów raz na tick:** `WagonsView.frame` — pozycje w kolejce (`roads.walkBack(at, …, k·QUEUE_GAP)`) liczyć w `afterTick` (lub leniwie przy zmianie `(at, k, kierunek głowy, netVersion)`), jednym przejściem wstecz na węzeł dla k = 1..n, zamiast O(k²) co klatkę. Przy okazji `RoadPoint` jako `Float64Array`/pola zainicjowane liczbami zmiennoprzecinkowymi (mniej boxingu w `cellPoint`). | Przy 200 wozach z korkami: −1,2–1,4 MB/s (największy alokator), −5–10 % CPU klatki. Przy 100: −0,5 MB/s, −3–4 %. W misjach z małą flotą ≈ 0. | niskie (kolejka stoi między tickami; kierunek głowy brać z tej samej klatki co dziś albo zamrozić na tick — wtedy porównać `jam-diff`) | nie przy pełnym kluczu; przy zamrożonym kierunku różnice subpikselowe — `tools/jam-diff.mjs` |
| 3 | **Bez wymuszonego layoutu i bez HTML co klatkę w HUD:** (a) blok co 250 ms (`sheets.update`, `occluderRects`) przenieść na **początek** `App.frame`, przed zapisy HUD i pinezek (odczyt czystego layoutu z poprzedniej klatki), albo `syncDock` przez `ResizeObserver` na `.fix-dock`; (b) `Hud.updateContract`: podpis `(sekunda zegara, cur, toTranche, late, lang)` **przed** budowaniem HTML pigułki i linii; `goods`/`have` w buforach. | (a) −4–8 % klatki przy otwartym arkuszu z „Naprawą” i −2–5 % w misjach (2–4 synchroniczne layouty na sekundę mniej, każdy rośnie z DOM). (b) hud w misjach −50–70 % (7–18 → ~3–5 ms/s), −0,2–0,3 MB/s. | niskie. (a) prostokąty przeszkód o klatkę starsze (dziś i tak co 250 ms). (b) czysto mechaniczne; test `pace-card`/`fleet-card` bez zmian | nie |
| 4 | **CPU przebiegu cienia:** (a) cień co 2. klatkę przy stojącej kamerze i słońcu; (b) osobna mapa dla statycznych rzucających (teren, budynki, drzewa) odświeżana przy ruchu kamery lub słońca, a wozy i ładunki w małej mapie dynamicznej; (c) mniejszy zasięg cienia przy 160 m. | Cień to 13–28 % klatki. (a) to ~−7–14 %, (b) więcej, ale to duża zmiana. | średnie–wysokie | **TAK:** (a) cień wozu „skacze” 30 Hz przy ×4, (b) granica dwóch map, (c) krótszy cień w oddali. Zrzuty i decyzja właściciela |
| 5 | **Pinezki przy wielu przestojach:** `markers.update` — bez stringów `toFixed` / obiektów na pinezkę; przycinanie puli (z render-scale #6, niezrobione). | −0,6–1 MB/s przy ~60 pinezkach, −5–8 % klatki przy 160 m i 200 wozach. Przy typowej liczbie pinezek (0–5) ≈ 0. | niskie | nie |
| 6 | **Drobne alokacje terenu:** `vnoise` z całkowitym haszem (render-scale: identyczne bity, −57 % scavenge w mikroteście), `wagonDrawLag`/`stableParking` bez tablic krawędzi na tick. | −0,4–0,9 MB/s przy 100–200 wozach | bardzo niskie | nie (bit w bit, zmierzone wcześniej) |

**Kolejność wdrażania:** 1 → 3 → 2 (bez zmiany obrazu; 1 i 3 pomagają we wszystkich misjach, 2 przy dużych flotach),
potem 5 i 6. Pozycja 4 tylko ze zrzutami i decyzją właściciela. Żadna pozycja nie dotyka `src/sim/`, haszy ani zapisu.

Szacunek po 1–3 przy 200 wozach / 60 m / high: alokacje 12 → ~8,5 MB/s, CPU klatki −15–20 % (~4,3 → ~3,5 ms
desktopu, czyli na telefonie ~11–17 zamiast 13–22 ms). W misjach (XII/XIII): alokacje 4,2–5,1 → ~3 MB/s, CPU −8–12 %.

## Czego ten pomiar nie mówi

- Czasu GPU (fill rate, MSAA, A2C, rozmiar mapy cienia). Do tego `tools/device-bench.html` i `?diag=1` na Foldzie
  (tabele w `docs/PERF.md` dalej puste).
- Kosztu stylu i layoutu przy malowaniu w prawdziwej przeglądarce: okno prawdziwych klatek ma pod SwiftShaderem
  kilka klatek (0,02–2,3 ms/kl., orientacyjnie).
- Ultra i kamery 320 m (pomiar 320 m po render #1–#6: `2026-11-04-render-scale.md`, sekcja „Po poprawkach”).

## Odtwarzanie

```bash
npm run build                                                    # typecheck + build (sprawdzone, zielone)
npx vite build --sourcemap --minify false --outDir dist-perf9    # ten sam kod + mapy (profil, alokacje)
npx vite preview --outDir dist-perf9 --port 5199 --strictPort
node tools/frame9-cost.mjs http://127.0.0.1:5199 sandbox200 high near,mid 3 > out.json   # scena jakość kamery powtórzenia
bash docs/research/frame9-data/run.sh                            # cała macierz × 2 przebiegi (~28 min przy load 8–13)
node tools/frame9-table.mjs docs/research/frame9-data            # tabele
npx tsx tools/frame9-m13-peak.ts m13=3 m12=0                     # szczyty misji
npx tsx tools/frame9-sim50.ts 50                                 # tick sim: dyspozycja vs reszta
```

Jedna scena (2 kamery × 3 syntetyczne sekundy × timing / profil / alokacje + 6 s realnych klatek) trwa 1,5–2 min.
