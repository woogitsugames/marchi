# Render #4: cienie wozów „mid” i dalekich ładunków — przed/po (do decyzji właściciela)

Data: 2026-11-04, gałąź `claude/research-day8e`. Prototyp: `docs/research/2026-11-04-render4-shadows.patch`
(**nie** wgrany do `src/`). Narzędzia: `tools/render4-shadows.mjs` (zrzuty + liczniki GL na jednej stronie, przy
jednym ticku), `tools/render4-compose.py` (pary „przed/po” i wycinki 2×). Pozycja #4 z
`2026-11-04-render-scale.md`.

**Stan: gotowe do decyzji.** Liczniki dla low, high i ultra oraz pomiar builda bez łatki są zrobione; zrzuty
przed/po (DPR 2, 412×915 lub 915×412) i wycinki 2× są dla: high pion 50 / 80 / 110 m, low pion 50 m, ultra pion
50 m, high poziom 50 m. Surowe liczniki: `shots-render4/data/*.json`.

## Co zmienia prototyp

- Rig „mid” (koń, koła, woźnica; wóz w odległości 0,4–1,0 × `lodDist` od kamery: high 48–120 m, low 30–75 m) nie
  rzuca cienia. Skrzynia wozu (`body`, wspólna z near) i ładunek dalej rzucają cień.
- Ładunek jest dzielony jak rig: wozy za `lodDist` (LOD1) mają ładunek w osobnych siatkach `cargo-far-*` bez cienia
  (dziś ładunek rzucał cień także na LOD1).
- Wariant „proxy” (zmierzony, bez zrzutów): zamiast riga mid cień rzuca geometria LOD1 (sylwetka konia i kół),
  tylko w passie cienia (w passie głównym 0 instancji).
- Przełącznik w runtime `WagonsView.setShadowTiers(mid, farCargo)` — dzięki temu „przed” i „po” to ta sama klatka:
  symulacja zatrzymana, czas renderu zamrożony (woda, wiatr, bezczynne konie), deszcz wyłączony, UI ukryte.

## Scena

Sandbox, 200 wozów (`frame-cost-bench.json` + deterministyczne rozrzucenie jak w `render-scale.mjs`, 60 %
z ładunkiem), kamera nad najgęstszym skupiskiem (skrzyżowanie przy piekarni), odległość 50 / 80 / 110 m, yaw 0,6.

## Liczby (pass cienia; pass główny bez zmian: te same draw calls i trójkąty)

| jakość | kamera | wozy near/mid/far | draw cień przed → po (proxy) | tris cienia przed → po | zmiana | proxy |
|---|---:|---|---|---|---:|---:|
| high | 50 m | 6 / 30 / 0 | 73 → 67 (70) | 531k → 455k | **−14 %** | 473k (−11 %) |
| high | 80 m | 0 / 47 / 0 | 68 → 62 (65) | 496k → 377k | **−24 %** | 406k (−18 %) |
| high | 110 m | 0 / 51 / 5 | 68 → 60 (63) | 500k → 369k | **−26 %** | 401k (−20 %) |
| low | 50 m | 0 / 37 / 0 | 40 → 34 (37) | 353k → 259k | **−27 %** | 282k (−20 %) |
| low | 80 m | 0 / 4 / 44 | 45 → 33 (36) | 245k → 221k | **−10 %** | 223k (−9 %) |
| low | 110 m | 0 / 0 / 56 | 37 → 31 (31) | 234k → 217k | **−7 %** | 217k (−7 %) |

Ultra (pomiar DPR 0,5, pion):

| jakość | kamera | wozy near/mid/far | draw cień przed → po (proxy) | tris cienia przed → po | zmiana | proxy |
|---|---:|---|---|---|---:|---:|
| ultra | 50 m | 5 / 32 / 0 | 73 → 67 (70) | 532k → 451k | **−15 %** | 471k (−12 %) |
| ultra | 80 m | 0 / 48 / 0 | 67 → 61 (64) | 499k → 377k | **−24 %** | 407k (−18 %) |
| ultra | 110 m | 0 / 49 / 7 | 68 → 60 (63) | 493k → 367k | **−26 %** | 397k (−20 %) |

Ultra = high w liczbach (potwierdzone: te same ustawienia widoku, inne tylko tekstury/DPR i rozdzielczość mapy cienia,
która nie zmienia liczby trójkątów).

Build bez łatki (sanity, high pion, DPR 0,5): 50 m 73 draw / 525k tris cienia, 80 m 67 / 499k, 110 m 66 / 497k; pass
główny 84 / 666k, 76 / 634k, 76 / 634k. To jest to samo co tryb „przed” w buildzie z łatką — sama łatka (bez
przełączenia) nic nie kosztuje. Drobne różnice (±1–2 %) między przebiegami biorą się z tego, że kilka wozów stoi
inaczej względem progu LOD (near/mid 5/30 zamiast 6/30), nie z łatki.

Pass główny: high 50 m 84 draw / 672k tris, 80 m 76 / 630k, 110 m 78 / 637k; low 50 m 62 / 529k — identyczne
przed i po (proxy też: 0 instancji w passie głównym nie daje wywołania GL). Na wóz mid: ok. −2,5 tys. trójkątów
cienia (proxy: ok. −1,9 tys.).

Uwaga: na low `lodDist` = 75 m, więc przy 80 i 110 m prawie wszystkie wozy to już LOD1 — tam zmienia się tylko
cień ładunku (−7…−10 %).

## Co znika na obrazie

Wszystkie zrzuty: DPR 2, SwiftShader, ta sama klatka przed i po (symulacja i czas renderu zamrożone). „Skala
telefonu” = para obok siebie (każda połowa ≈ ekran telefonu), „2×” = wycinek 220×220 px z największą różnicą.
„Piksele” = odsetek pikseli zmienionych o więcej niż 6 poziomów.

| zrzut | piksele | skala telefonu | wycinek 2× |
|---|---:|---|---|
| `01-high-portrait-50.jpg` + `crop-high-50-horses.jpg` | 1,4 % | subtelnie: skrzyżowanie trochę jaśniejsze, widać dopiero przy porównaniu | oczywiste: znikają ciemne plamy pod końmi i kołami, grzbiety koni jaśniejsze |
| `02-high-portrait-80.jpg` + `crop-high-80.jpg` | 1,7 % | widać tylko jaśniejszy pas pod kolumną wozów na lewej drodze; pojedynczy wóz — nie | widać: cienie koni w kolumnie znikają, zostają cienie skrzyń |
| `03-high-portrait-110.jpg` + `crop-high-110.jpg` | 1,4 % | praktycznie niewidoczne | słabo: rozmyte plamy pod końmi bledną |
| `04-low-portrait-50.jpg` + `crop-low-50.jpg` | **2,9 %** | **widać**: na low przy 50 m wszystkie wozy to mid, więc całe skrzyżowanie traci cienie koni; wozy „lżej” stoją na drodze | oczywiste: konie bez cienia, tylko miękka plama skrzyni |
| `05-ultra-portrait-50.jpg` + `crop-ultra-50.jpg` | 1,4 % | **widać** (ostrzejsza mapa cienia niż na high): ciemne kałuże cienia pod końmi przy skrzyżowaniu znikają | oczywiste: koń i woźnica bez cienia na ziemi |
| `06-high-landscape-50.jpg` + `crop-high-landscape-50.jpg` | 1,7 % | subtelnie: pas cienia pod długą kolumną wozów jaśnieje | oczywiste, jak w pionie |

Wniosek ze zrzutów: przy 80–110 m na high zysk (−24…−26 % trójkątów cienia) jest praktycznie za darmo; przy 50 m
różnica jest do wychwycenia na telefonie na ultra i na low, na high — dopiero w wycinku. Skrzynie i ładunek mają
cień w każdym wariancie, więc wóz nigdzie nie „wisi” w powietrzu. Daleki ładunek bez cienia — na żadnym zrzucie
nie da się go wskazać.

## Pytanie do właściciela

Czy wyłączyć cień konia, kół i woźnicy wozów w średniej odległości (oraz cień ładunku dalekich wozów)?

- **A. Wdrożyć na wszystkich jakościach** — pass cienia −14…−27 % przy typowym zoomie, cienie koni znikają od ~48 m
  (high) / ~30 m (low).
- **B. Wdrożyć tylko na low i high** (ultra zostaje z pełnym cieniem) — ultra to i tak tryb „ładnie, kosztem”.
- **C. Nie wdrażać** — zostaje cień konia przy 48–120 m.
- (wariant pośredni: **proxy LOD1** — sylwetka cienia konia zostaje, zysk −11…−20 % zamiast −14…−27 %.)

**Rekomendacja: B** (zmieniona tylko w uzasadnieniu, poparta zrzutami):

- **high: wdrożyć** (bez proxy). Przy typowym zoomie 80–110 m różnicy na telefonie nie widać, a pass cienia jest
  lżejszy o ok. ¼; przy 50 m różnica jest tylko w wycinku 2×. Proxy (−11…−20 %) warto rozważyć dopiero, jeśli
  właściciel po `01`/`crop-high-50-horses` uzna brak cienia konia przy 50 m za przeszkadzający.
- **low: wdrożyć.** To tu różnica jest najbardziej widoczna (2,9 % pikseli przy 50 m), ale low wybiera gracz ze
  słabym telefonem, a zysk jest największy (−27 % przy 50 m). Jeśli to za dużo — proxy na low (−20 %) zachowuje
  sylwetkę cienia konia.
- **ultra: zostawić pełny cień.** Na ultra brak cienia konia przy 50 m widać na telefonie (`05`), a ultra jest
  z definicji „ładnie, kosztem”.
- **Daleki ładunek bez cienia: na wszystkich jakościach** (niewidoczny, −7…−10 % na low).

## Odtwarzanie

```bash
git apply docs/research/2026-11-04-render4-shadows.patch && npx vite build --outDir <after> && git checkout src/
python3 -m http.server 5199   # z katalogu nad <after>
DPR=0.5 node tools/render4-shadows.mjs http://127.0.0.1:5199/<after>/ high portrait 50,80,110 <out> 200 0   # liczniki
MEASURE=0 node tools/render4-shadows.mjs http://127.0.0.1:5199/<after>/ high portrait 50,80,110 <out> 200 1 # zrzuty
python3 tools/render4-compose.py pair <before.png> <after.png> <out.jpg> "<podpis>"
python3 tools/render4-compose.py crop <before.png> <after.png> <out.jpg> "<podpis>"
```

Build bez łatki (sanity): `npx vite build --base ./ --outDir <before>` przed `git apply`, potem ta sama komenda
liczników z `<before>` — skrypt sam wykrywa brak `setShadowTiers` i mierzy tylko tryb „unpatched”. Czas na
SwiftShader (4 rdzenie, dwa przebiegi naraz): pomiar DPR 0,5 ok. 1 min na odległość, zrzut DPR 2 ok. 1–5 min.
