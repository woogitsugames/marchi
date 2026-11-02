# Audyt UI na składanych i małych ekranach (P1 Fold) — 2026-11-02

Zakres: nowe UI z D-36 (zapis per misja, "zacznij od nowa"), D-39 (menu 12 misji), D-38 (tempo dostaw: waybill + karta zamku),
linia "bierze też" (karta tartaku m9), arabski RTL (`&lang=ar`). Brak zmian w `src/`.
Narzędzie: `tools/fold-audit.mjs` (Playwright, pomiar `getBoundingClientRect`, `scrollWidth`, cele dotykowe, konsola).
Build produkcyjny, `vite preview` :5201, `quality=low&dynres=0`, Chromium + swiftshader, `isMobile/hasTouch`.
Surowe dane: 84 przebiegi (run 1) + 45 po wygaszeniu animacji sheetów (run 2) + 9 (sawmill). **Konsola: 0 błędów / 0 pageerror we wszystkich.**

## Jak emulować (z kodu)
`src/ui/layout.ts::computeLayout`: `mini` = krótszy bok < 400 i dłuższy < 560 (Flip cover, klasa `is-mini`); `narrow` = w < 400 (`is-narrow`);
`split` = w >= 720 i nie landscape-phone (`is-split`, `is-side`); `flex` = poziomy zawias z >= 200 px segmentem nad i pod (`is-flex`).
Zawias bez Androida: `window.__marchiaFold = {state:'HALF_OPENED',orientation:'HORIZONTAL',x:0,y:490,w:904,h:20}` + `dispatchEvent(new Event('marchia:fold'))`.
Same rozmiary viewportu wystarczą dla mini/narrow/split. Uwaga: 1000x904 ma h >= 700, więc NIE jest `is-landscape`; dostaje `is-split` (jak 904x1000).

Widoki: `ref412` 412x915, `phone360` 360x740 (`is-narrow`), `fold904` 904x1000 (`is-split`), `fold1000` 1000x904 (`is-split`),
`flip360` 360x380 (`is-mini`), `foldflex` 904x1000 + zawias y=490..510 (`is-flex is-split`).

## Metoda i zastrzeżenia
- Pomiar pozycji sheetów tuż po otwarciu bywał fałszywy (animacja wjazdu; przy 8+ procesach Chromium na maszynie CPU stał). Run 2 czeka na `document.getAnimations()`; w tabelach używam run 2, a "poza ekranem" sheetów z run 1 pomijam jako artefakt.
- Nie udało się pokazać linii "Drewno bierze też" na karcie tartaku m9: w ~5 min gry tartak ma `NO_WAGON`, ale `sharedInput` nie znajduje rywala z zapasem (węglarz bez drewna), więc `.shared-hint` = 0 w 9/9 przebiegach. Nie oceniam tej linii (do powtórzenia z `ff` do chwili, gdy węglarz ma drewno albo na scenariuszu m9 z botem). Karta tartaku bez linii mieści się na wszystkich widokach (patrz tabela).
- Tempo dostaw w m7: `?play=m7&ff=120&speed=0` wystarcza (`PaceLog` próbkuje także przy `ff`), pace pokazuje się od ok. 60 s.

## Tabela: ekran x widok (pl; ar tam gdzie napisano)
OK = brak problemu w pomiarze. "cel" = element interaktywny < 48 px.

| Ekran | 412x915 | 360x740 | 904x1000 | 1000x904 | Flip 360x380 | Fold flex |
|---|---|---|---|---|---|---|
| Menu 12 misji (14 pozycji) | OK | OK | OK, 320 px szerokości, wszystkie widoczne | OK | **P2**: widać 6 z 14 pozycji, reszta tylko przez przewijanie `.menu-strip`; brak wskazówki (dolna krawędź "postrzępiona" tnie wiersz VII) | OK, 2 kolumny, wszystkie 14 widoczne w 490 px |
| Arkusz zapisu misji (Kontynuuj / Zacznij od nowa) | OK, sheet nad paskiem menu (nakładanie sheet/menu 70 720 px² celowe) | OK | OK, sheet prawy dół, bez nakładania | OK | OK, ale pokrywa pasek menu (61 360 px²), 1 gest zamyka | OK, kolumna po prawej od zawiasu |
| Pytanie "Zacząć od nowa?" (w wierszu) | OK, przyciski >= 48 px | OK | OK | OK | OK | OK (tytuł zawija się na 2 linie, bez przycinania) |
| Menu pauzy + pytanie przy restarcie | OK | OK | OK | OK | **P3**: sheet przewija się (scrollHeight 325 / client 297), "Zapisz i wróć do menu" wystaje częściowo; waybill/rail pod sheetem (modal, akceptowalne) | OK |
| Waybill z tempem (m7) | OK; **P2** wiersze `.wb-pace-eta`/`.wb-pace-sup` 188x32,5 / 188x30 (cel < 48) | j.w., 170x32,5 / 170x30 | j.w. 188x30 | j.w. | ukryty (tryb zegarka: pieczęć) -> brak tempa na Flip bez otwarcia zamku | j.w. |
| Karta zamku "Tempo dostaw" (m7) | OK, 412 px, wszystko w jednym ekranie | OK, waybill zachodzi na sheet o 588 px² (kilka px) | OK | OK | OK, ale sheet scrolluje (396/297); tempo w pierwszym ekranie | OK, sheet scrolluje 396/393 (przycięcie o 3 px) |
| Karta tartaku m9 (bez linii "bierze też") | OK | OK | OK | OK | OK (po wygaszeniu animacji bez przycięcia) | OK |
| Arabski RTL, te same ekrany | OK | OK, przycisk "شراء عربة" scrollWidth 50 > 48 (2 px, bez widocznego przycięcia) | OK, sheet po lewej nad padem narzędzi, tempo po prawej | OK | OK | OK |

Pozostałe pomiary (wszystkie widoki):
- **Poziomy scroll strony**: brak (`hscroll=false`) wszędzie.
- **Nakładanie HUD vs sheet vs dymki**: split/flex bez nakładania paneli. 412/360: pas `.rail` (cały dół) kryje się z sheetem docked-bottom (zamierzone, sheet jest nad torem). Dymki (`#markers`) na Flip nakładają się na sheet w 2 scenach (sawmill-shared, bubble@3,267 vs sheet, 2 496 px²) — sheet jest modalny, nie problem.
- **Przepełnienie tekstu**: 412 `.rail-line` scrollWidth 400 > 396 (4 px) w m7/m9 przy liczniku monet 3-cyfrowym + czas `8:28`; w ar (czas `08:28` = 85 px) bez przepełnienia, bo rail jest `row-reverse`. Widocznie bez przycięcia na zrzutach (padding), ale bufor 0 px.
- **Cele dotykowe**: poza wierszami tempa (30 px) wszystkie przyciski/narzędzia/pozycje menu >= 48 px. `.rail-stat` (22-34 px) nie są interaktywne.
- **Safe-area**: w Playwright `--safe-*` = 0; kod używa `--safe-t/b/s/e` w menu, rail, sheet (`main.css` 176-190, 910-1030). Nie weryfikowalne w emulacji; wymaga urządzenia (Flip: kamery tną dół, rail jest u góry — zgodnie z D-16).

## Lista poprawek (wg wagi)
1. **P2 — arabski: brak tłumaczeń D-38.** `src/i18n/ar.ts` nie ma `contract.pace.eta/late/supply`, `why.pace.*`, `why.shared*` (są w `pl.ts:410-419`, `en.ts:409-411`), więc w AR waybill i karta zamku pokazują angielski: "At this pace: done in", "Delivery pace", "now 4.9/min, at most 6.7/min". Dodatkowo bidi: `9:10 At this pace: done in` i `min/4.9` (jednostka odwrócona) — po dodaniu tłumaczeń owinąć liczbę/jednostkę w `<bdi>` (`src/ui/pace.ts:55-56`, `format.ts` `tHtml`). Dotyczy też innych 15 języków poza pl/en (sprawdzić te same klucze).
2. **P2 — cele dotykowe wierszy tempa < 48 px**: `src/styles/main.css:1654` (`min-height: 30px` dla `.wb-pace-eta`, `.wb-pace-sup`; `role=button` w `src/ui/pace.ts:55-56`). Podnieść do 48 px (dodać padding albo `::before` rozszerzający trafienie), waybill urośnie o ~36 px; na 360x740 sprawdzić kolizję z kartą zamku (patrz 5).
3. **P2 — Flip, menu 12 misji bez wskazówki przewijania**: `src/styles/main.css:176-190` (`.menu-strip` ma `overflow-y:auto`), `main.css:991-998` (`body.is-mini .menu-strip`). Widać 6 z 14 pozycji. Dodać cień/fade albo ukryć `mi-sub` już ukryte; rozważyć dolny pasek "ˇ" lub zwinięty tytuł. Zasada CLAUDE.md "ekran zamykany jednym gestem" jest spełniona, ale odkrywalność nie.
4. **P3 — Flip: tempo dostaw niewidoczne w trybie zegarka.** `body.is-mini .waybill-wrap` pokazuje tylko pieczęć (`main.css:982`). Tempo (D-38) dostępne po otwarciu karty zamku (sheet 396 px w oknie 297 px scrolluje, tempo na górze, OK). Zdecydować, czy pieczęć ma dostać jedną linię ETA.
5. **P3 — 360x740: waybill z wierszami tempa (ok. +70 px) styka się z kartą zamku** (588 px² nakładania, `waybill/sheet`). `body.is-narrow .waybill { width:196px }` (`main.css:963`) — przy otwartym sheet zwijać waybill do pieczęci (`.is-collapsed`, `main.css:306`) albo ukrywać wiersz dostawcy.
6. **P3 — pasek monet/czasu/prędkości 4 px za wąski na 412**: `.rail-line` scrollWidth 400 > 396 (`main.css:331`). Zmniejszyć `gap`/`padding` rail-stat przy `w < 420`.
7. **P3 — Flip, menu pauzy przewija się** (325/297): `body.is-mini .sheet` (`main.css:983`). Przycisk "Zapisz i wróć do menu" częściowo pod krawędzią; skrócić odstępy sekcji pytania o restart (`.sheet-actions`, `main.css:757`) w `is-mini`.
8. **P3 — Fold flex, karta zamku scrolluje 396/393** (3 px) — zmniejszyć `padding` sekcji w `body.is-flex .sheet` (`main.css:1015`) albo `max-height`.
9. **Do powtórzenia**: linia "bierze też" (sawmill m9) — wymaga stanu z rywalem (patrz zastrzeżenia); safe-area na urządzeniu; Flip cover z fizycznym wycięciem.

## Zrzuty (docs/research/shots-fold/, JPEG)
`menu-flip360-pl` (6 z 14 pozycji), `pauseask-flip360-pl` (sheet przewijany), `saveask-phone360-pl`, `castle-m7-phone360-pl` (waybill styka się z kartą),
`waybill-m7-phone360-ar` (angielskie tempo w AR), `castle-m7-fold904-ar` (RTL, sheet po lewej, mieszany bidi), `saveask-foldflex-pl`,
`castle-m7-foldflex-pl`, `pauseask-fold904-pl`, `menu-fold1000-pl`.
