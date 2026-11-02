# 61 — Grafiki sklepowe z nowym wyglądem — gałąź `gpt/61-store-graphics`

Obecne materiały w `docs/store/` i `docs/shots/` pokazują stary HUD. Nowy wygląd: `ref/*.jpg` (prawdziwe zrzuty gry).
Zrób zrzuty **z prawdziwej gry**, nie malowane makiety: `npm run build`, `npx vite preview`, Playwright (Chromium jest
preinstalowany w środowisku Claude; u Ciebie dowolny Chromium), parametry `?play=mN&quality=high&dynres=0&bot=1&ff=…`
(sprawdź w `src/ui/app.ts`; pełny uchwyt debug tylko z `&debug=1`).
1. **Google Play:** 6 zrzutów 1080×1920 (pion) + 2 poziome 1920×1080 wg slotów z `docs/store/screenshots-plan.md`
   (zaktualizuj plan): 1) dolina z wozami i kontraktem pod wstęgą, 2) karta „Najgorszy zastój” + arkusz „Dlaczego
   stoi?” w ramie, 3) korek na moście (m2), 4) zima / kra (m4), 5) Wolna dolina z rangą i targiem, 6) list kasztelana
   z pieczęciami. Krótki podpis na każdym (PL i EN, osobne zestawy), typografia gry (Grenze Gotisch + Alegreya Sans),
   bez „Welcome!”, bez strzałek-emoji, bez ramek telefonu.
2. **Grafika wyróżniająca** 1024×500 (Play) — scena z gry + tytuł „Marchia” i podtytuł „Szlaki Królestwa”
   (PL) / „Roads of the Kingdom” (EN).
3. **App Store:** te same sceny w 1290×2796 (6,7").
Pliki: `docs/store/shots/<lang>/<slot>-<w>x<h>.png` (PNG zoptymalizowane, łącznie ≤ 25 MB), skrypt
`tools/store-shots-v2.mjs`, wpis w `docs/ASSETS.md`. W PR miniatury wszystkich plików.
