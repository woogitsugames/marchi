# Audyt wizualny i układu UI z dni 8c–9 (przed kolejnym APK) — 2026-11-05

Zakres: karta tempa w czterech odmianach (producent VII D-115, błoto III D-116/D-132 z duchem bruku, lód przed nami IV
D-117, flota XI D-127) w slocie karty HUD i w „Naprawie” arkusza; wskazówka odbioru na arkuszu podwórza (D-128); linia
działania w liście przegranej (D-130, misja I); pieczęć pinezki (D-121) i pierścień fokusu (D-123); wyłączone
„Sprzedaj za 15” na karcie wozu (D-131); łańcuch w krótkim poziomie z wierszem podmiotu (teraz `div`). Brak zmian w `src/`.

Urządzenia: Fold wewnętrzny 904x1000 (`is-split`), Fold cover / Flip 360x380 (`is-mini`, tryb zegarka), telefon 412x915
i 915x412 (`is-short` dla arkuszy bocznych). Języki: pl, de, ar (RTL), pseudo (+40 %).

## Metoda
- Narzędzie `tools/ui9-audit.mjs` (nowe): stany wzięte z `tools/day8c-shots.mjs`, `day9a-shots.mjs`, `day9b-shots.mjs`,
  `day8d-shots.mjs` (pierścień, piny) i `chain-shots.mjs` (łańcuch m6/m13). Pomiar = funkcja `measure()` z
  `tools/layout-check.mjs` (czytana z pliku, nie kopiowana: offscreen, overlap, cele < 48, overflow, covered, hscroll)
  plus sonda per scena (prostokąty karty, arkusza, doku „Naprawa”, wiersza podmiotu, linii działania, przycisku
  sprzedaży, styl fokusu).
- Build produkcyjny, `vite preview` :5195, `quality=low&dynres=0`. Macierz na płaskiej mapie (`view=flat`, Chromium
  `--disable-gpu`; HUD/arkusze/listy to ten sam DOM): **166 przebiegów** (pl wszędzie; pseudo bez scen pinów/fokusu;
  ar na 412x915 i 904x1000; de na 412x915 i 915x412 dla 6 scen). Do tego **9 przebiegów three.js** (duch bruku m3,
  piny, pierścień na mapie; 412/915/904, pl). **Konsola: 0 błędów** (poza jednym przebiegiem, w którym padł serwer —
  powtórzony, artefakt odrzucony).
- `tools/ui9-ring-probe.mjs`: prawdziwe naciśnięcia Tab do przycisku „Naprawa” i wycinek zrzutu (dowód P1).
- `LAYOUT_URL=http://127.0.0.1:5195/ npm run layout -- --quick`: **84 zadania, 0 błędów, kontrola pozytywna OK**.
  Uwaga: scen `layout-check` nie obejmuje żaden z nowych stanów (karta tempa, list przegranej, krótki poziom z łańcuchem)
  — stąd znaleziska niżej, których quick nie widzi.
- Dane: `docs/research/ui9-data/ui9-report-flat.json`, `ui9-report-3d.json`. Zrzuty: `docs/research/shots-ui9/`.

Zastrzeżenia: safe-area w Playwright = 0 (nie do sprawdzenia bez urządzenia, kod używa `--safe-*` jak w audycie Fold).
**de i ar nie mają tłumaczeń kluczy dni 5–9** (PENDING_KEYS, zlecenie tłumaczeń z 271a234) — nowe teksty idą po
angielsku; prawdziwą długość niemieckiego zastępuje pseudo. Wskazówki D-128 na *innym* podwórzu niż nazwane przez kartę
nie da się pokazać w XI przy 5:00 (czeka tylko gospodarstwo); pokazana jest na arkuszu gospodarstwa (ten sam kod
`paceCureHtml`).

## Tabela: ekran × urządzenie
OK = pomiar bez uwag i zrzut obejrzany. Języki w komórce, gdy coś zależy od języka.

| Ekran | 412x915 | 915x412 | 904x1000 | Flip 360x380 |
|---|---|---|---|---|
| Karta tempa VII (producent) | OK pl/de/ar/pseudo (91–111 px, 3–4 linie, bez przycięcia; `m7-card-412x915-pseudo.jpg`) | OK, 318 px, oko 52 px | OK | ukryta (tryb zegarka, D-16) — zob. P3-4 |
| Arkusz VII „Postaw jeszcze: Chata rybaka” | OK | **P2**: drugie ogniwo pod dokiem, notka „Bez przerwy… 6,7/min” niewidoczna bez przewijania; wiersz podmiotu ściśnięty (P2-3) | OK, ale arkusz 800 px wysokości z ~350 px pustego pergaminu (`m7-sheet-904x1000-pl.jpg`, P3-1) | OK, dok na dole, przewijanie 463/286 |
| Karta błota III | OK (ar: angielski tekst z arabskimi wstawkami) | OK | OK | ukryta |
| Arkusz III „Wybrukuj odcinek” + duch bruku (3D) | OK, kostka widoczna nad arkuszem, wychodzi za prawą krawędź | **OK** — odcinek obok arkusza (`m3-sheet-3d-915x412-pl.jpg`) | **P2**: odcinek biegnie pod arkuszem (520–880 px), kamera go nie kadruje w wolnej części (`m3-sheet-3d-904x1000-pl.jpg`) | **P3**: arkusz kryje cały ekran, odcinka nie widać (`m3-sheet-flip360x380-pl.jpg`) |
| Karta IV (lód przed nami; slot „Najgorszy zastój”) | OK pl/pseudo | OK | OK | ukryta |
| Arkusz IV „Wyłóż most kamieniem −72” | OK | OK (dok) | OK | OK, przewijanie 380/286 |
| Karta floty XI | OK pl/pseudo; ar bidi (`m11-card-412x915-ar.jpg`) | OK | OK | ukryta |
| Arkusz XI / wskazówka odbioru D-128 „Kup wóz −30” + „Wóz 1 dojedzie… za 1:19” | OK (4 linie notki 13 px) | **P2**: jak VII — notka z czasem dojazdu (sedno D-128) poza widokiem, podmiot obcięty wielokropkiem w pseudo (`m11-sheet-subject-915x412-pseudo.jpg`) | OK | OK |
| List przegranej I, linia działania | OK pl/pseudo; de/ar po angielsku (`dir=auto`, wyrównana do lewej w ar) | pl: przyciski mieszczą się, dolny ornament ramy ucięty o 14 px (`m1-lost-915x412-pl.jpg`); **P2** pseudo: przyciski 393–452 px, poza ekranem, trzeba przewinąć (`m1-lost-915x412-pseudo.jpg`) | OK (ar: list po prawej, lustrzanie) | **P2**: linia działania na y=493, przyciski na 567–626 przy oknie 380 — oba pod zgięciem, bez wskazówki przewijania; fokus na „Jeszcze raz” poza ekranem (`m1-lost-flip360x380-pl.jpg`) |
| Pieczęć pinezki D-121 (3D) | OK, ząbkowana czerwona pieczęć czytelna na trawie i wodzie (`pins-ring-412-904-pl.jpg`) | OK | OK | — |
| Pierścień fokusu D-123 — oko karty, pinezka | OK (dwutonowy, widoczny) | **P2**: Tab trafia w pinezkę gospodarstwa schowaną pod szyną narzędzi (`is-under`, 112–160 × 340–396) — fokus niewidoczny (`ring-map-hidden-pin-915x412-pl.jpg`) | OK | OK |
| Pierścień fokusu D-123 — przyciski główne (wino) | **P1**: niewidoczny (`ring-fix-primary-412x915-pl.jpg`) | **P1** | **P1** | **P1** |
| Karta wozu, „Sprzedaj za 15” wyłączone | OK pl/de/ar/pseudo: kreskowana karta, napis na pergaminowej plakietce, 176x48, powód pod spodem; RTL lustrzane (`wagon-sell-412x915-pseudo-ar.jpg`) | OK (przycisk w przewijanym ciele) | OK | OK (przycisk 341–389, przewijanie) |
| Łańcuch krótki poziom, m6/m13 złożony „+N” | OK | podmiot 26 px OK w pl; **P2** wygląd (P2-3) | OK | **P2**: brak składania — korzeń „PRZYCZYNA” pod dokiem „Zbuduj drogę” (`chain-m6-flip360x380-pl.jpg`) |
| Łańcuch m6 po rozwinięciu „+1” | OK | **P3**: ciało przewija się o 12 px — podmiot ucięty pod nagłówkiem, korzeń pod dokiem; żadnego końca łańcucha nie widać (`chain-m6-open-915x412-pl.jpg`) | OK | jak wyżej |

Pozostałe pomiary: poziomy scroll strony — nigdzie; cele < 48 px — **0** we wszystkich 166 przebiegach (subject row nie
jest już celem, „+N” 48 px); nakładanie komponentów HUD — 0; przepełnienia tekstu poza „covered by fix-dock” (zamierzone
przewijanie pod dok) i wielokropkiem podmiotu w krótkim poziomie — brak. RTL: karta tempa ma oko po lewej, pieczęć
alarmu zostaje po stronie ręki (D-37), arkusz po lewej na 904 — zgodnie z zasadą. Niemiecki: „Wa-gen kaufen” dzieli się
na karcie narzędzia czysto (`m11-sheet-915x412-de.jpg`).

„Generyczny szablon”: nic nowego nie wygląda jak szablon — karta tempa na zwykłym panelu bez winnego paska dobrze
odróżnia spokój od alarmu, plakietka „Sprzedaj” trzyma styl „brak N”. Dwie rzeczy zbliżają się do „pustego okna”:
arkusz boczny 904x1000 rozciągnięty na pełną wysokość przy krótkiej treści (P3-1) i kwadratowy pierścień wokół okrągłej
pieczęci/oka (P3-3).

## Lista poprawek (wg wagi)

1. **P1 — pierścień fokusu niewidoczny na każdym przycisku głównym (wino).** `.cf` ma `clip-path: var(--chamfer)`
   (`src/styles/main.css:135-139`), a `.btn.primary` w arkuszach i listach jest `.cf`; `clip-path` obcina zarówno
   `outline`, jak i `box-shadow` z D-123 (`main.css:93-97`). Styl jest policzony (`:focus-visible` = true, outline
   2 px ink), ale piksele go nie pokazują: „Naprawa” (Kup wóz, Postaw jeszcze, Wybrukuj, Wyłóż most), „Jeszcze raz”,
   „Do dzieła”, „Następna misja”. To akurat przyciski, na które D-118 przenosi fokus. Poprawka: przenieść fazowanie
   z hosta na pseudo-elementy (`.cf { clip-path: none }`, ramka `--frame` jako `::after` z `clip-path: var(--chamfer)`,
   wypełnienie jak dziś w `::before`) albo w minimum
   `.cf:focus-visible { clip-path: none; background: none; }` + `.cf:focus-visible::before { inset: 0; clip-path: var(--chamfer); }`.
   Sprawdzić `tools/ui9-ring-probe.mjs` i dodać do `tools/a11y-focus-probe.mjs` pomiar pikseli, nie tylko stylu.
2. **P2 — krótki poziom (915x412): „Naprawa” bez powodu.** Dok przykrywa notkę pod przyciskiem i drugie ogniwo
   (`.fix-dock`, `main.css:1008`; `body.is-short .fix-dock`, `main.css:2388`). Dla kart tempa notka *jest* uzasadnieniem
   (D-115 „bez przerwy najwyżej 6,7/min”, D-128 „Wóz 1 dojedzie po ładunek za 1:19”, D-116 „błoto to nie przestój”).
   Poprawka: w `is-short` przenieść `.fix-note`/`.fix-why` do doku jako jedną linię (`-webkit-line-clamp: 1`, pełny tekst
   po przewinięciu) albo dać przyciskowi `aria-describedby` i wiersz „Dlaczego?” rozwijany w doku.
3. **P2 — wiersz podmiotu w krótkim poziomie wygląda na przycisk i jest ściśnięty.** `body.is-short .chain .c-first
   .link.is-self` (`main.css:2380-2386`): 26 px wysokości w 9-slice karty (`card-normal`, 10 px ramki) — szyny ramki
   dotykają liter, w pseudo tekst przechodzi wielokropkiem w środku przyczyny („…collection: wàĝö…”). Skoro to już `div`
   (fa5676f), w `is-short` zdjąć ramę karty (`border-image: none`), zostawić ikonę, tekst i czas na pergaminie z cienką
   linią pod spodem; `white-space: normal; -webkit-line-clamp: 2` zamiast `nowrap` + ellipsis.
4. **P2 — Flip: łańcuch nie składa się, korzeń pod dokiem.** Składanie środkowych ogniw „+N” (D-111) działa tylko przy
   `is-short` (`layout.ts:152`, warunek `l.side`). Flip ma arkusz od dołu (nie `side`), wysokość 380 → trzy ogniwa +
   dok nie mieszczą się i „PRZYCZYNA” stoi pod „Zbuduj drogę”. Poprawka: `is-short` także dla `is-mini`
   (`b.toggle('is-short', (l.side && …) || l.mini)`) i sprawdzić `chain-shots.mjs 360x380`.
5. **P2 — list przegranej: linia działania i przyciski pod zgięciem na Flip i w poziomie przy dłuższym tekście.**
   Flip: list 23–664 px w oknie 380 (przewija się scrim), D-130 na y=493, fokus D-118 na „Jeszcze raz” (567) poza ekranem
   bez przewinięcia. 915x412: pl mieści się o włos (rama ucięta o 14 px), pseudo/de po tłumaczeniu wypycha przyciski.
   Poprawka: `.letter` w poziomie — linię `.lg-act` (`menu.ts:498`, `main.css:1057`) i przyciski przenieść do lewej
   kolumny pod podpis (tam jest ~150 px wolnego miejsca); na `is-mini` skrócić list (ukryć ledger „Gdzie stracono czas”
   do 1 pozycji albo zwijać tekst listu) i `focus()` z `scrollIntoView({block:'nearest'})` w `modal.ts`.
6. **P2 — fokus klawiatury na pinezce schowanej pod HUD.** Piny `.bubble.is-under` (pod szyną/kartą) zostają w kolejności
   Tab (`ring-map-hidden-pin-915x412-pl.jpg`). Poprawka w kodzie znaczników: `tabindex=-1` (lub `inert`) dla `is-under`,
   albo przy `focus` pinezki przesunąć kamerę tak, by pin wyszedł nad HUD (jak `focusCell`).
7. **P2 — Fold 904x1000: odcinek błota pod arkuszem bocznym.** Duch bruku D-132 (49 pól) biegnie pod arkuszem; kamera
   nie kadruje odcinka w wolnej części mapy. Poprawka: przy `nav.setGhost(cells, true)` (`panels.ts:610`) dopasować kamerę
   do prostokąta komórek w widocznym obszarze (ten sam mechanizm, co „subject visible” z D-45), na 412 też (odcinek
   wychodzi za prawą krawędź).
8. **P3-1 — arkusz boczny na 904x1000 zawsze pełnej wysokości.** VII/III/wóz: treść kończy się ~500–600 px, arkusz do
   908 px (`body.is-side .sheet-paper`, `main.css:421`). Dać `max-height` + wysokość wg treści (`height: auto`,
   `align-self: start`) na `is-split`; mniej „pustego okna”, więcej mapy pod duchem z p. 7.
9. **P3-2 — bidi tekstów zastępczych w ar.** Angielskie stringi D-115…D-130 w arabskim: notka „Naprawy” w kontenerze
   RTL zaczyna się kropką („.delivery is 53% faster…”, `m3-sheet-904x1000-ar.jpg`), karta tempa miesza kierunki. Do
   czasu tłumaczeń: `dir="auto"` na `.fix-note`/`.fix-why` i `.sc-text` (jak `.lg-act`). Właściwa poprawka = tłumaczenia
   (zlecenie PENDING_KEYS).
10. **P3-3 — kwadratowy pierścień wokół okrągłych elementów.** Oko karty (52 px) i pinezka (48x56) dostają prostokątny
    pierścień 6 px — czytelny, ale „szablonowy” przy woskowych pieczęciach. `border-radius: 50%` na `.stall-eye` i
    `.bubble .bb` (outline w Chromium/WebView idzie za promieniem) albo pierścień jako `::after` w kształcie pieczęci.
11. **P3-4 — Flip: rady tempa (VII/III/XI) niewidoczne.** Zgodnie z D-16 karta zastoju/tempa jest ukryta w trybie
    zegarka; karta tempa nie ma własnej pinezki, więc na okładce gracz nie dowie się o „postaw drugiego rybaka” ani
    „kup wóz”. Decyzja właściciela: zostawić (otwórz telefon) albo dodać do pieczęci kontraktu linię „tempo: …” jak
    sugerowano w audycie Fold (P3-4 z 2026-11-02).
12. **P3-5 — po rozwinięciu „+N” w krótkim poziomie** ciało przewija się o 12 px: podmiot ucięty pod nagłówkiem,
    korzeń pod dokiem. Po rozwinięciu przewinąć tak, by korzeń stał nad dokiem (`scrollIntoView({block:'nearest'})`
    na `.chain > li:last-child` z `scroll-padding-block-end`), podmiot może zejść.

## Co jest dobrze (nie ruszać)
- Wszystkie nowe cele ≥ 48 px na wszystkich czterech klasach urządzeń, w tym `+N` i przycisk sprzedaży.
- Karta tempa: 3–4 linie bez przycięcia w pseudo, spokojny panel wyraźnie inny niż winny „Najgorszy zastój”; RTL lustrzane.
- „Sprzedaj za 15” wyłączone: czytelne w pl/de/ar/pseudo, powód tuż pod spodem, hatch nie przecina liter.
- Ząbkowana pieczęć krytycznej pinezki czytelna bez koloru; pierścień na pinezce i oku dobrze widoczny nad mapą.
- Duch bruku w krótkim poziomie leży obok arkusza i czyta się jako kostka (D-132).
- `npm run layout -- --quick` zielony (84/84).

## Zrzuty (`docs/research/shots-ui9/`, JPEG)
`ring-fix-primary-412x915-pl` (P1), `chain-m6-flip360x380-pl` (P2-4), `m11-sheet-subject-915x412-pseudo` (P2-2/3),
`chain-m6-open-915x412-pl` (P3-5), `m3-sheet-3d-904x1000-pl` (P2-7, P3-1), `m3-sheet-3d-915x412-pl` (OK),
`m3-sheet-flip360x380-pl`, `m1-lost-flip360x380-pl`, `m1-lost-915x412-pl`, `m1-lost-915x412-pseudo` (P2-5),
`m11-card-412x915-ar`, `m3-sheet-904x1000-ar` (P3-2), `ring-map-hidden-pin-915x412-pl` (P2-6),
`wagon-sell-412x915-pseudo-ar`, `m7-sheet-904x1000-pl`, `m7-card-412x915-pseudo`, `pins-ring-412-904-pl`,
`m11-sheet-915x412-de`.

Powtórzenie: `npm run build; npx vite preview --port 5195 --strictPort`, potem
`node tools/ui9-audit.mjs <outdir>` (płaska mapa, ~4 min na 4 rdzeniach) lub `--three --only '<regex>'` (3D, wolno),
`node tools/ui9-ring-probe.mjs out.png`.
