# "Sklejka" na terenie z oddali — diagnoza (2026-11-02)

Skarga właściciela: tekstury z daleka wyglądają jak sklejka (regularna kratka/siatka i smugi/słoje na łące).

## Werdykt w skrócie

1. **Główny winowajca: pola orne (furrows) w shaderze terenu** — `src/render/terrain.ts` (blok `wField`, ok. l. 400-415 przed zmianą). To idealnie równoległe, wysokokontrastowe prążki `sin()` co 0,8 m, widoczne na dużych polach z średniego/dalekiego dystansu; wyglądają dokładnie jak słoje sklejki/forniru (zdjęcie 1). Najsilniej na `ultra` (większe ostrzejsze mipy), ale jest na każdym tierze.
2. **Powtarzalność albedo łąki**: kafel 3,2 m (`uv = wxz / 3.2`, terrain.ts), a „drugi poziom” (skala 0,29 = 11 m) jest tą samą teksturą, bez obrotu, tylko 35% mix. Sama tekstura `meadow/albedo` ma wyraźne ciemne plamy układające się w siatkę po sklejeniu 2x2 (zdjęcie 3) — to źródło "kratki". Maskuje to makro-szum (`nzM/nzL`), więc w moim repro jest słabo widoczne, ale na telefonie (sRGB ASTC/ETC2, dynres < 1, inne mip) może być wyraźniejsze.
3. **Poboczne**: panel HUD "Waybill" ma poziome smugi (SVG feTurbulence w `src/styles/main.css`) — wygląda jak drewno/sklejka (zdjęcie 4). Warto zapytać właściciela, czy nie o to też chodzi. Las z dala (impostory drzew) daje pionowe smugi — nie ruszałem.

## Jak próbkowane są tekstury (terrain.ts, terrainTextures.ts, textures.ts)

- 3 `sampler2DArray` (albedo/normal/ORM), 5 warstw; `RepeatWrapping`, `LinearMipmapLinearFilter`, mip z KTX2/GPU. Próbkowanie przez `textureGrad` (bez bias LOD).
- Anizotropia: `TIER_ANISOTROPY = {low:2, high:8, ultra:16}` min GPU max (`textures.ts:78`). OK; nie jest przyczyną.
- Tiery: low = JPG 512, bez normal/ORM, jedna skala łąki; high = KTX2 2048; ultra = 4096; normalne zawsze 1024.
- Łąka: skala 1.0 (3,2 m) + 0.29 (11 m) mix 0.35 — bez obrotu → siatka. Makro: `nzM` (61 m) mnoży jasność 0.86..1.12, plamy mokre/suche `nzL` (197 m). To dobry kierunek, ale amplituda jasności jest mała względem plam w teksturze.
- Pola: `MUD(1.3)` + `sin(ph)` o okresie 0,8 m, `fade` dopiero od `fwidth/0.8 = 0.25..0.6` (czyli przy 0,2-0,5 m/piksel prążki są jeszcze w pełni widoczne i aliasują), amplituda `mix(0.62, 1.0, ridge)` + ciemne plamki. Brak zniekształcenia fazy w dużej skali → perfekcyjnie równoległe.

## Repro

Build + `vite preview :5198`, Playwright 412x915 DPR2, `?play=m1&bot=1&ff=170&quality=low|high|ultra&dynres=0`, kamera przez `__marchia.app.view.rig.set(x,z,dist,yaw)` na 60/150/300. 

Uwaga: swiftshader (programowy GL) zgłasza MAX_ANISOTROPY 16 i inne ścieżki transkodowania KTX2 niż telefon (ASTC/ETC2). Anizotropia, kompresja i filtrowanie mogą więc na telefonie wyglądać inaczej; łąka w repro NIE pokazała wyraźnej kratki, pola — pokazały "słoje" jednoznacznie. Nie mam telefonu właściciela, więc kratka na łące pozostaje hipotezą (powtarzalność albedo, p. 2).

## Plan naprawy (wpływ / koszt)

| # | Działanie | Wpływ | Koszt GPU |
|---|-----------|-------|-----------|
| 1 | Pola: wcześniejszy fade prążków (0.08..0.3), słabszy kontrast (0.8..1.0), zakłócenie fazy szumem 61 m, losowa amplituda — **zrobione w prototypie** | wysoki | ~0 (+1 fetch szumu 4-kanałowego, tylko na polach) |
| 2 | Łąka: drugi poziom obrócony o ~37° i skala 0.23, mix 0.5 — **zrobione w prototypie** | średni | 0 (te same próbki, mat2) |
| 3 | Łąka: pełny anti-tiling (stochastic/hex tiling, Mikkelsen/Heitz) | wysoki | +2 próbki albedo (3 zamiast 1) na pierwszą skalę; na mid-range ~+5-8% frame na fill-limited; stosować tylko `high`/`ultra`, po kafelku fade do 1 próbki na dystansie |
| 4 | Tekstura: przegenerować meadow albedo z usuniętymi dużymi ciemnymi plamami (high-pass / podzielić przez blur 64 px), `tools/textures/process.py` | wysoki, jednorazowy | 0 |
| 5 | Dystansowy fade detalu: od ~120 m mieszać do uśrednionego koloru warstwy + makro szum | średni | 0 / oszczędza |
| 6 | Panel HUD: przeskalować/zmniejszyć kontrast grain (feTurbulence baseFrequency x:y bliżej 1:1) | zależnie od intencji właściciela | 0 |

## Prototyp (ta gałąź, tylko `src/render/terrain.ts`, sim nietknięty)

- Pola: patrz #1. Łąka: patrz #2. `npm run build` przechodzi; nie uruchamiałem pełnych testów sim (nie dotykam sim).
- Zdjęcia: `shots-terrain/1-before-ultra-300-field.jpg` vs `2-after-ultra-300-field.jpg` (ultra, kamera 300 m, swiftshader; różnice barw wynikają z innej pogody/pory dnia sesji), `3-meadow-albedo-2x2.jpg` (albedo 512 kafelkowane 2x2 — widać siatkę plam), `4-hud-panel-grain.jpg`.
- Do zweryfikowania na prawdziwym telefonie: czy "kratka" jest na łące, czy tylko pola/panel; zrobić screenshot z `?quality=high` z `dynres=0` i porównać.
