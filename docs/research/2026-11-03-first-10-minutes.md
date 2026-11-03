# Pierwsze 10 minut nowego gracza na telefonie (2026-11-03)

**Status: pomiar częściowy.** Przebieg przerwano z powodu limitu użycia. Zmierzono portret 412×915: od zimnego startu do kroku 5 samouczka (most). Krajobraz 915×412, pierwszy przestój, arkusz „Dlaczego”, naprawę, koniec zlecenia i start misji II oznaczono jako **nie zmierzone**.

Narzędzie: `tools/first10-minutes.mjs` (Playwright, Chromium z SwiftShader, `?debug=1&lang=pl&quality=low`, nowy kontekst przeglądarki, więc IndexedDB i localStorage są puste). Skrypt dotyka środka obrysu samouczka, a krok 5 wykonuje przeciągnięciem po „duchu” przeprawy. Liczy słowa PL na ekranie, elementy dotykowe < 48 px, przycięcia, zasłonięcia i przerwy > 10 s bez jasnej czynności. Zrzuty: `docs/research/shots-first10/` (7 plików JPG). Uruchomienie: `npm run build && npx vite preview --port 5195 --strictPort`, potem `node tools/first10-minutes.mjs 412x915 915x412`.

Zastrzeżenie: SwiftShader renderuje wolno, więc czasy „na ekranie” to czas zegara gry (zegar w HUD), a nie czas ściany.

## Tabela kroków (portret 412×915)

| # | Krok | Dotknięcia | Czas (gra) | Słowa PL do przeczytania | Uwagi z ekranu |
|---|---|---|---|---|---|
| 0 | Zimny start → menu | 0 | ładowanie ~2,5 s do `ready` | ~75 (13 pozycji × tytuł + podtytuł) | Wszystkie 12 misji i Wolna dolina od razu dostępne, bez wskazania „zacznij tu”. „Ustawienia” poza ekranem (y = 882–930 przy wysokości 915). Misja I: podtytuł powtarza tytuł („Chleb i deski / Chleb i deski dla zamku…”). |
| 1 | Menu → list kasztelana | 1 | gra wstrzymana | ~50 (list) + przycisk | Na zrzucie po 600 ms **listu nie widać**: HUD jest wstrzymany (pauza aktywna), a mapa pusta. List albo jeszcze się pojawia, albo zniknął pod nakładką. Do ponownego sprawdzenia (`port-02-letter.jpg`). |
| 2 | „Do dzieła” → krok 1 samouczka | 1 | 6:28 → 6:29 | 16 (notatka) + ~20 HUD | **Notatka kasztelana leży na liście przewozowym**: zasłania wiersz chleba „0/20” i część obrysu, w który trzeba trafić (`port-03-tut1.jpg`). Strzałka wskazuje od dołu przez notatkę. |
| 3 | Krok 1 → karta zamku (krok 2) | 1 | ~5 s | 18 (notatka) + ~45 (arkusz) | Arkusz czytelny, obrys „Tartak — Drewno w drodze — wóz 1” poprawny. W arkuszu jest ~45 słów naraz: łańcuch, „Co to znaczy?”, zamówienie, tempo. |
| 4 | Krok 2 → krok 3 (wóz) | 1 | ~3 s | 16 + ~35 (karta wozu) | Krok 3 minął szybko. Obrys objął wiersz „Cel: Chata drwala” (link do budynku, nie do przyczyny). |
| 5 | Krok 3 → krok 4 („Droga”) | 1 | ~6 s | 15 | W chwili zrzutu (`port-05-tut4.jpg`) karta wozu wciąż **zasłania pasek narzędzi** (2 s zwłoki `CLOSE_SHEET_DELAY_MS`). Notatka znowu leży na liście przewozowym, półprzezroczysta w czasie wejścia. Na arkuszu i pod nim przenikają się dwie warstwy tekstu: „Najgorszy zastój” pod „Śledź wóz / Sprzedaj”. |
| 6 | Krok 4 → krok 5 (most) | 1 + przeciągnięcia | 6:47 → 7:04+ (**nie ukończono**) | 15 | **Krok utknął**: w notatce wciąż był tekst kroku 4, a obrys stał na „Droga”, choć `tutorial.current` zwracał 5. Sześć prób przeciągnięcia po duchu przeprawy nie zbudowało mostu (`port-06/07`). W tym czasie pojawiła się karta „Najgorszy zastój: Młyn wodny: żaden wóz nie dojedzie” z pieczęcią „3”, czyli przestój, który samouczek dopiero każe naprawić. |
| 7 | Pierwszy przestój → „Dlaczego” → naprawa | — | nie zmierzone | — | — |
| 8 | Koniec zlecenia (list końcowy) | — | nie zmierzone | — | Z kodu: list końcowy ma tylko „Jeszcze raz” i „Do menu” (`buildEndLetter`, `src/ui/menu.ts`), **brak „Następna misja”**. Do misji II potrzeba więc co najmniej 2 dotknięć przez menu. |
| 9 | Start misji II | — | nie zmierzone | — | — |
| — | Krajobraz 915×412 | — | nie zmierzone | — | — |

Suma dotknięć do kroku 5: **6** (bez przeciągnięć). Samouczek do tej chwili: ~35 s gry. Treści do przeczytania przed pierwszą czynnością na mapie: ok. **200 słów** (list + 4 notatki + 2 arkusze).

## Ocena względem listy zakazów UI (CLAUDE.md)

- Nie ma gradientów fioletowo-niebieskich, glassmorphismu, neonu ani emoji. Pergamin, wstęga i pieczęcie trzymają własny system (UI_STYLE). Typografia ma dwa kroje, zgodnie z zasadą.
- Ryzyko: menu to jedna wąska kolumna 13 jednakowych wierszy na lewym brzegu. Na zimnym starcie czyta się to jak lista z szablonu: brak hierarchii i brak „od czego zacząć”.
- Półprzezroczysta notatka nałożona na listę przewozowy w czasie animacji wygląda jak błąd warstw, a nie jak efekt zamierzony.
- Nie zauważono celów dotykowych < 48 px w HUD na zrzutach. Pełny audyt JSON przepadł razem z przerwanym przebiegiem, więc tę część trzeba **powtórzyć**.

## Najważniejsze problemy (według wpływu na nowego gracza)

1. **Krok 5 (most) utyka.** Notatka pokazuje stary tekst, a przeciąganie po duchu nie buduje mostu. Gracz nie ma jak skończyć samouczka i nie zbuduje przeprawy, bez której misji I nie da się wygrać. Wymaga potwierdzenia na urządzeniu: może to artefakt dotyku z CDP albo wolnego renderu, ale skutek byłby krytyczny.
2. **Notatka samouczka zasłania własny cel** (lista przewozowa w krokach 1 i 4). `placeNote` zaczyna od pasma `y0 = waybill.y`, a pozycję liczy co 150 ms. W pierwszych klatkach notatka ląduje na liście, zanim zmierzy się przeszkody.
3. **Przestój pojawia się przed lekcją o przestojach.** W trakcie kroku 4–5 wyskakuje „Najgorszy zastój” z oczkiem i pieczęcią „3”. To trzeci konkurencyjny wskaźnik obok obrysu i notatki, a samouczek o nim milczy.
4. **Brak „Następna misja” na liście końcowym.** Ścieżka do misji II przechodzi przez menu z 13 równorzędnymi pozycjami.
5. **Zimne menu bez kierunku**: wszystkie misje odblokowane, nic nie wyróżnia I, a „Ustawienia” są poza ekranem przy 915 px.
6. **Gęstość tekstu w arkuszach**: około 45 słów w karcie zamku podczas kroku 2, gdzie potrzebny jest tylko jeden wiersz łańcucha.

## Poprawki (4–6)

1. **Krok 5: zbadać i uodpornić.** W `src/ui/tutorial.ts` w `update()`/`render()` sprawdzić rozjazd `step` i `textSig`. Teraz `go(5)` zmienia krok, a tekst wciąż jest z kroku 4. Do tego test Playwright z prawdziwym przeciągnięciem po `ghosts.tut` (wzorem `tools/first10-minutes.mjs`). Jeśli przeciągnięcie z ducha nie przechodzi walidacji `RoadDraft`, zacząć ducha od najbliższej komórki drogi. Bez zmian w sim (`suggestConnection` tylko czyta stan).
2. **`placeNote`: lista przewozowa jako twarda przeszkoda od pierwszej klatki.** Zaczynać pasmo pod `waybill.y + waybill.h`, a nie na `waybill.y`. Notatkę pokazywać dopiero po pierwszym poprawnym `placeNote` (klasa `is-new` po ustaleniu pozycji). Plik `src/ui/tutorial.ts`, bez zmian w sim.
3. **Wyciszyć kartę przestoju w krokach 1–5 samouczka.** W `src/ui/hud.ts` ukryć `stallRow`, gdy `app.tutorial` żyje i `current < 6`. Alternatywa: krok 6 samouczka niech wskazuje oko karty przestoju zamiast listy przewozowego. To naturalnie zamyka pętlę „przestój → Dlaczego → naprawa”. Bez zmian w sim.
4. **„Następna misja” na liście końcowym po wygranej.** W `buildEndLetter` (`src/ui/menu.ts`) dodać `data-a="next"` i `EndActions.next`, a w `src/ui/app.ts` wywołać `newGame(nextId)`. Teksty przez i18n (`pl.ts`/`en.ts`). Bez zmian w sim.
5. **Menu zimnego startu.** W `buildMainMenu` (`src/ui/menu.ts`) wyróżnić misję I („Zacznij tutaj”, pieczęć) przy pustym profilu i zwinąć misje III–XII do jednego wiersza. Naprawić duplikat podtytułu misji I w i18n. Dopilnować, żeby „Ustawienia” mieściły się przy 412×915 (przewijanie albo ikona w nagłówku). Bez zmian w sim.
6. **Karta zamku podczas kroku 2:** zwinąć sekcje „Zamówienie zamku” i „Tempo dostaw”, gdy działa samouczek (`src/ui/panels.ts`), żeby zostało ~15 słów. Bez zmian w sim.

Żadna z poprawek nie zmienia symulacji (`src/sim/`).

## Do dokończenia

Uruchomić ponownie `tools/first10-minutes.mjs 412x915 915x412` po naprawie kroku 5 (albo z ręcznym mostem). Zmierzyć: pierwszy przestój → „Dlaczego” → naprawa, koniec zlecenia, start misji II, krajobraz oraz pełny audyt celów < 48 px i przycięć (JSON).
