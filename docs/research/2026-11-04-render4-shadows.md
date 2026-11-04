# Render #4: cienie wozów „mid” i dalekich ładunków — przed/po (do decyzji właściciela)

Data: 2026-11-04, gałąź `claude/research-day8e`. Prototyp: `docs/research/2026-11-04-render4-shadows.patch`
(**nie** wgrany do `src/`). Narzędzia: `tools/render4-shadows.mjs` (zrzuty + liczniki GL na jednej stronie, przy
jednym ticku), `tools/render4-compose.py` (pary „przed/po” i wycinki 2×). Pozycja #4 z
`2026-11-04-render-scale.md`.

**Stan: niedokończone.** Liczniki dla low i high są gotowe; ze zrzutów gotowa jest tylko para high / pion / 50 m
(plus wycinek). Reszta zrzutów (low/ultra, 80 i 110 m, poziom) i pomiar ultra oraz builda bez łatki liczyły się w tle,
gdy sesja się kończyła (SwiftShader przy DPR 2: ok. 5 min na zrzut).

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

Pass główny: high 50 m 84 draw / 672k tris, 80 m 76 / 630k, 110 m 78 / 637k; low 50 m 62 / 529k — identyczne
przed i po (proxy też: 0 instancji w passie głównym nie daje wywołania GL). Na wóz mid: ok. −2,5 tys. trójkątów
cienia (proxy: ok. −1,9 tys.). Ultra = high w liczbach (te same ustawienia widoku; inne tylko tekstury/DPR) —
pomiar ultra niedokończony.

Uwaga: na low `lodDist` = 75 m, więc przy 80 i 110 m prawie wszystkie wozy to już LOD1 — tam zmienia się tylko
cień ładunku (−7…−10 %).

## Co znika na obrazie

- `shots-render4/01-high-portrait-50.jpg`, `shots-render4/crop-high-50-horses.jpg`: przy 50 m na high **widać** —
  znikają cienie koni (ciemne plamy pod końmi na drodze) i kół, a konie tracą własny cień (grzbiet jaśniejszy, koń
  „lżej” stoi na drodze). Skrzynie i ładunki dalej mają cień, więc wóz nie „wisi”. Różni się 1,4 % pikseli.
- Na zrzucie całego ekranu telefonu różnica jest subtelna (widać ją dopiero przy porównaniu obok siebie); w wycinku
  2× oczywista.
- 80 / 110 m: zrzuty niedokończone. Oczekiwanie (z geometrii): koń ma przy 110 m kilka tekseli mapy cienia —
  różnica mniejsza niż przy 50 m.

## Pytanie do właściciela

Czy wyłączyć cień konia, kół i woźnicy wozów w średniej odległości (oraz cień ładunku dalekich wozów)?

- **A. Wdrożyć na wszystkich jakościach** — pass cienia −14…−27 % przy typowym zoomie, cienie koni znikają od ~48 m
  (high) / ~30 m (low).
- **B. Wdrożyć tylko na low i high** (ultra zostaje z pełnym cieniem) — ultra to i tak tryb „ładnie, kosztem”.
- **C. Nie wdrażać** — zostaje cień konia przy 48–120 m.
- (wariant pośredni: **proxy LOD1** — sylwetka cienia konia zostaje, zysk −11…−20 % zamiast −14…−27 %.)

**Rekomendacja: B**, a dla high rozważyć proxy, jeśli brak cienia konia przy 50 m przeszkadza na telefonie.
Daleki ładunek bez cienia — na wszystkich jakościach (niewidoczne, −7…−10 % na low).

## Odtwarzanie

```bash
git apply docs/research/2026-11-04-render4-shadows.patch && npx vite build --outDir <after> && git checkout src/
python3 -m http.server 5199   # z katalogu nad <after>
DPR=0.5 node tools/render4-shadows.mjs http://127.0.0.1:5199/<after>/ high portrait 50,80,110 <out> 200 0   # liczniki
MEASURE=0 node tools/render4-shadows.mjs http://127.0.0.1:5199/<after>/ high portrait 50,80,110 <out> 200 1 # zrzuty
python3 tools/render4-compose.py pair <before.png> <after.png> <out.jpg> "<podpis>"
python3 tools/render4-compose.py crop <before.png> <after.png> <out.jpg> "<podpis>"
```
