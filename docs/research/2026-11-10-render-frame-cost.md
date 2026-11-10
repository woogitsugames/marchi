# Koszt klatki 3D — gorące miejsca renderu i trzy poprawki bez zmiany wyglądu (D-570..D-574)

Data: 2026-11-10 · branch `claude/w-rperf` · Chromium headless + SwiftShader (`--use-gl=swiftshader`), 412×915,
dpr 1, kontener 4 vCPU współdzielony z innymi agentami. SwiftShader rysuje jedną klatkę w ~1–1,8 s, więc czasy
są tylko względne (przeplatane A/B, 3 powtórzenia, mediana); rozstrzygają liczniki z poziomu GL.

## Narzędzia (nowe)

- `tools/rperf-probe.mjs <urlA> [urlB] [rounds] [s] [sceny] [jakości] [profile]` — skrypt startowy owija wywołania
  WebGL: `drawElements/Arrays(Instanced)` (wywołania i trójkąty, osobno główny przebieg — domyślny framebuffer — i
  inne cele: mapa cieni, bake), `useProgram`, `bindTexture`, `uniform*`, bajty `bufferData/SubData`, rozmiar
  wszystkich żywych tekstur GL (z formatów: ASTC/ETC2 liczone jako skompresowane). Do tego `renderer.info`
  (programy, geometrie, tekstury), liczba obiektów sceny, rAF (średnia) i czas JS `App.frame`. Mapa cieni odświeża
  się co 2. klatkę (D-150), więc przebieg cieni raportuję **na odświeżenie**, nie na klatkę (inaczej liczba skacze o
  ±15 zależnie od parzystości klatek w oknie). `RP_SPLIT=1` drukuje rozbicie wywołań i trójkątów na obiekty
  (`onBeforeRender`/`onBeforeShadow`). Czeka na `view.texturesReady` (KTX2 high transkoduje się tu > 12 s — bez
  tego pierwsze pomiary high mierzyły scenę bez tekstur PBR).
- `tools/rperf-shots.mjs <url> <katalog>` — zrzuty PNG do porównania piksel w piksel: `speed=0` w adresie (z
  `speed=1` stan symulacji zależy od tego, ile ticków zdążyło przejść przed konfiguracją sceny — to dawało
  różnice pozy robotników i położenia wozów między dwoma przebiegami tej samej wersji), pętla gry zatrzymana, zegary
  widoku, robotników, kół młyńskich, marszu oracza i gestu kupca ustawione na stałe, 4 klatki z dt = 0.
  Porównanie: `python3 tools/render5-diff.py <A> <B>`.

Sceny: wolna dolina z siecią `tools/frame-cost-bench.json` (38 budynków na ~350 m) latem i zimą z 110 m, ta sama
z 50 i 200 wozami (kupione w stajni, 10 min gry, kamera 160 m), misja I z botem po 150 s (kamera przeglądowa
200 m); presety low i high.

## Gdzie idzie klatka (przed)

Przełączniki w jednej stronie (dolina lato, low, 3 powtórzenia, mediana rAF): całość 1339 ms; bez terenu 742,
bez drzew 800, bez budynków 1046, bez przebiegu cieni 1192, bez trzciny 1167, bez wody 1196, połowa rozdzielczości
617. SwiftShader jest ograniczony wypełnianiem (fill) — teren i drzewa to głównie koszt pikseli, którego nie da się
zmniejszyć bez zmiany wyglądu (LOD terenu, mniej kart drzew, niższa rozdzielczość: poza zakresem tego zadania).

Liczniki (dolina lato, low, na klatkę): główny przebieg 47 wywołań / **404 k trójkątów**, cienie 30 wywołań /
**223 k trójkątów na odświeżenie**, 46 programów, 23 tekstury (~34 MB, w tym atlasy dalekich drzew 2 × 640×2048 i
mapa cieni 1024² RGBA8; high: mapa 2048²). Rozbicie na obiekty:

| obiekt | główny | cienie |
|---|---:|---:|
| `buildings-wood` (1 siatka na mapę) | 95 k | 95 k |
| `buildings-stone` | 54 k | 54 k |
| `buildings-plaster` + `thatch` | 25 k | 25 k |
| teren (5 widocznych kawałków + fartuch) | 124 k | — |
| `reeds` (776 kęp, jedna partia) | 23 k | — |
| woda | 21 k | — |
| robotnicy (`yard-workers`, ~45 szt., `frustumCulled = false`) | ~32 k | ~16 k |

W kadrze z 110 m jest **7 z 38 budynków**, w ramie cieni 18 (`frustum` z kamery i z `sun.shadow.camera`).
Budynki są scalone w jedną siatkę na materiał (D-255) — wszystkie rysowały się zawsze, w obu przebiegach.

## Trzy gorące miejsca i poprawki

1. **Scalone budynki bez odcinania (D-570).** Siatki ciężkich materiałów (≥ 4000 trójkątów na całą mapę; w dolinie m.in.
   drewno, kamień, tynk, strzecha) są dzielone na kafle terenu 64 m (budynek → kafel środka podstawy).
   Lekkie materiały (metal, skóra, …) zostają jedną siatką. Te same wierzchołki i macierze, tylko inne bufory.
2. **Robotnicy rysowani poza kadrem (D-571).** `BuildingsView.update` dostaje frustum kamery i kamery cieni (te
   same macierze, które policzy `WebGLShadowMap`: `sun.shadow.updateMatrices(sun)`); robotnik, którego kula 3 m nie
   dotyka żadnego, nie trafia do partii instancji. Zegary pozy biegną dalej.
3. **Trzcina jedną partią na całą rzekę (D-572).** Jedna `InstancedMesh` na kafel 64 m (wspólna geometria),
   każda z własną sferą — trzcina poza kadrem odpada.

Odrzucone / niezrobione: LOD terenu, mniej kart drzew, rzadsza mapa cieni dla trzciny i drzew, mniejsza mapa cieni
(zmieniają wygląd); `BatchedMesh` dla budynków (inny program i macierze z tekstury — ryzyko różnic
zmiennoprzecinkowych w pozycjach); kolejność rysowania (front-to-back przez `renderOrder`) — trójkąty i wywołania
bez zmian, zysk tylko na GPU z wczesnym testem głębi, nie do zmierzenia na SwiftShaderze.

## Piksele

`tools/rperf-shots.mjs`, 18 ujęć: dolina lato / zima / blisko (38 m) / daleko (230 m), misja I; low i high; 412×915
(wszystkie), 915×412 i 904×1000 (dolina lato, misja I). **15 ujęć 0 px.** Trzy ujęcia high (blisko, daleko,
lato 915×412) różnią się 0,2–0,4 % pikseli w jednym rogu — **tak samo między dwoma przebiegami wersji sprzed zmian**
(A↔A: 768 / 828 / 1302 px w tych samych prostokątach; po↔drugi przebieg A: 0 / 0 / 1484 px). To niedeterminizm
ujęć high (wiatr / bliskie drzewa zależne od historii klatek), nie zmiana wyglądu.

## Wyniki (przed → po)

`node tools/rperf-probe.mjs <A> <B> 3 6 "" low,high` — A = `a10af8b`, B = ta gałąź; wywołania i trójkąty na
klatkę (główny) i na odświeżenie mapy cieni (co 2. klatkę); czas = mediana z 3 przeplatanych średnich rAF.

| scena | preset | wywołania główny | trójkąty główny | wywołania cienie | trójkąty cienie | rAF ms (mediana) |
|---|---|---:|---:|---:|---:|---:|
| dolina lato 110 m | low | 47 → 51 | 404 k → 268 k | 30 → 42 | 223 k → 134 k | 1192 → 1117 (−6 %) |
| dolina zima 110 m | low | 47 → 58 | 404 k → 273 k | 30 → 41 | 223 k → 132 k | 1122 → 1014 (−10 %) |
| dolina 50 wozów 160 m | low | 54 → 59 | 400 k → 270 k | 31 → 50 | 224 k → 176 k | 1206 → 1189 (−1 %) |
| dolina 200 wozów 160 m | low | 54 → 59 | 400 k → 270 k | 31 → 50 | 224 k → 176 k | 1313 → 1181 (−10 %) |
| misja I, 200 m | low | 47 → 51 | 242 k → 192 k | 27 → 43 | 60 k → 60 k | 1108 → 1050 (−5 %) |
| dolina lato 110 m | high | 60 → 64 | 461 k → 325 k | 55 → 67 | 319 k → 230 k | 2012 → 2156 (+7 %) |
| dolina zima 110 m | high | 60 → 64 | 461 k → 325 k | 55 → 67 | 319 k → 230 k | 2200 → 2004 (−9 %) |
| dolina 50 wozów 160 m | high | 55 → 60 | 438 k → 307 k | 40 → 59 | 271 k → 223 k | 2056 → 1850 (−10 %) |
| dolina 200 wozów 160 m | high | 55 → 60 | 438 k → 307 k | 40 → 59 | 271 k → 223 k | 1846 → 1871 (+1 %) |
| misja I, 200 m | high | 52 → 56 | 278 k → 229 k | 36 → 52 | 97 k → 97 k | 1754 → 1742 (−1 %) |

Bez zmian: programy (46 low / 48 high), przełączenia programów, wiązania tekstur, wywołania `uniform*`, pamięć
tekstur (33,8 MB low, 175,8 MB high — w high 4 zestawy 2048 albedo/ORM), przesył buforów (≤ 7 KB/klatkę). Geometrii
+15..22 (kafle budynków i trzciny; ta sama pamięć wierzchołków, inaczej podzielona). Czas JS `App.frame` 2–5 ms w
obu wersjach (w szumie).

Wniosek: trójkąty w dolinie **−33 %** w głównym przebiegu i **−18..−41 %** w cieniach; misja I (8 budynków, mała
mapa) **−20 %** w głównym, cienie bez zmian. Cena: +4..+11 wywołań w głównym i +12..+19 na odświeżenie cieni (kafle
widoczne dla słońca). Czas SwiftShadera spada w 7 z 10 par, mediana zmian −5,5 %, rozrzut powtórzeń ±10 % —
SwiftShader jest ograniczony wypełnianiem, więc trójkąty przekładają się na czas słabo; na telefonie (Adreno / Mali,
wierzchołki liczone na GPU z tym samym shaderem PBR i drugi raz w przebiegu cieni) zysk z 130–220 k trójkątów mniej na
klatkę powinien być wyraźniejszy niż koszt ~10 dodatkowych wywołań. Do potwierdzenia na urządzeniu
(`tools/device-bench.html`, BACKLOG).

Wariant kafla 96 m i progu 8000 trójkątów (1 przebieg, liczniki): dolina lato low główny 64 wywołania / 296 k,
cienie 42 / 143 k; misja I główny 50 / 197 k, cienie 37 / 60 k — w dolinie gorszy od 64 m (więcej trójkątów, nie
mniej wywołań), w misji I o 6 wywołań cieni lepszy. Zostaje 64 m / 4000.
