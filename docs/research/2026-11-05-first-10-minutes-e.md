# Pierwsze 10 minut — przebieg E na dzisiejszym buildzie (2026-11-05)

**Status: pomiar w obu orientacjach plus 5 minut wolnej doliny.** Build `7a940d8` (po D-156). Od przebiegu D weszły: dyspozytor 2 L1 (D-156), sygnał floty i „Kup wóz” przy długim czekaniu na odbiór (D-127/D-128), dok naprawy w niskim krajobrazie (D-138/D-146), list końcowy (D-142), koniec samouczka zamyka arkusze (D-129), list i karta rangi w dolinie (D-151/D-152).

**Wyniki w skrócie:**
- Misja I w **krajobrazie: wykonana** (11:35/12:00, 1 z 3 pieczęci, 4 kupione wozy).
- Misja I w **portrecie: przepadła** (30/30 desek, 18/20 chleba). Wynik jest ten sam co w portrecie C. Jest jednak skażony narzędziem (zastrzeżenie 2).
- **Dolina:** gospodarstwo stoi po 4 dotknięciach od listu i 0,4 s gry. Do 5:00 ranga 0, 6 wozów na jedno gospodarstwo, karta rangi znika po pierwszym budynku.

Narzędzia:
- `tools/first10-minutes.mjs`: Playwright, Chromium ze SwiftShaderem, `?debug=1&lang=pl&quality=low`, nowy kontekst. Ten przebieg dodał tylko log awarii strony.
- Nowe `tools/valley-first5.mjs`: gracz w dolinie, który robi wyłącznie to, co podsuwa gra. Ścieżka: list → karta rangi → oko → „Postaw: …” → „Postaw”, potem co 30 s gry spojrzenie na kartę i naprawa, jeśli jest.

Zrzuty: `docs/research/shots-first10e/` (JPG 37–47 KB). JSON-y audytu: `first10e-412x915.json`, `first10e-915x412.json`, `valley5-412x915.json`.

## Zastrzeżenia pomiaru (ważne)

1. **Portret i dolina szły równolegle z krajobrazem**, czyli 3 przeglądarki SwiftShader na 4 rdzeniach. Ściana jest 2–3× wolniejsza niż w D (portret 3384 s, D: 1874 s). Czas gry (`tick/10`) liczony jest niezależnie od tego i to on jest miarą.
2. **Portret przegrał przez limit narzędzia, nie z wyboru gracza.** Pętla „karta → oko → naprawa” ma limit 14 min ściany. Pod obciążeniem skończyła się po 7 spojrzeniach (ostatnie w 4:33 gry). Od 4:58 do śniegu (12:00) skrypt tylko czekał na ×4, z 60 srebra w kieszeni. Karta przez cały ten czas mówiła „Gospodarstwo: pełny magazyn, brak wozu”. Dla porównania:
   - D (solo): 10 spojrzeń do 6:46, 5 wozów, wygrana;
   - E: 3 wozy, porażka o 2 chleby.

   To potwierdza wniosek z C/D: misję I wygrywa gracz, który *wraca do karty* i kupuje 4–5 wozów. Sam portretowy UI tu nie zawiódł (zob. tabelę).
3. **Pierwszy krajobraz** (równoległy) zgubił `window.__marchia` w połowie pętli przestojów (`DRIVER: Cannot read properties of undefined`). Strona się przeładowała albo padł renderer. Drugi krajobraz przerwałem sam po fałszywym alarmie: wpisy historii arkuszy wyglądały jak nawigacja. **Trzeci krajobraz, solo, przeszedł bez błędu** i to jego wyniki są w tabeli. Do sprawdzenia w P5, możliwe, że to tylko przeciążenie środowiska.
4. Audyt nadal czasem czyta arkusz w trakcie wejścia (D-135). W krajobrazie przy przestoju #8 audyt nie widział aktywnej naprawy, a zrzut pokazuje „Kup wóz −30” (`land-14-why8-nofix.jpg`). Skrypt nie kupił wozu, choć gracz by kupił.

## Tabela kroków (czas gry w s; port / land)

| # | Krok | Dotknięcia | Gra port / land | D (port) | Uwagi |
|---|---|---|---|---|---|
| 0 | zimny start → menu | 0 | — | — | `ready` 3,8 / 2,4 s. Brak celów < 48 px, brak zasłonięć. |
| 1 | menu → list | 1 | — | — | 57 słów. |
| 2 | list → krok 1 | 2 | 7,0 / 7,0 | 7,3 | **Czas do pierwszej poprawnej czynności: 7 s gry, 2 dotknięcia** („Do dzieła” + obrys). |
| 3 | kroki 2–6 | 5 + 1 przeciągnięcie | 42,8 / 35,1 | 41,6 | Krajobraz: krok 4 („Droga”) minął w trakcie czekania na krok 3. Most od pierwszego przeciągnięcia. Portret: 1 z 17 pól ducha pod HUD (jak w D). |
| — | **samouczek razem** | 7 + 1 | **44,3 / 36,6** | 43,7 | Bez zmian względem C/D. |
| 4 | koniec samouczka → karta przestoju | 0 | 6,0 / 5,6 | 6,5 | **Karta widoczna w obu orientacjach** (D-129). |
| 5 | pierwsze oko | 2 | 19,6 / 22,9 | 27,5 | „Gospodarstwo: czekanie na odbiór”, brak naprawy (okno samouczka, D-128 świadomie). |
| 6 | **pierwsza własna poprawna czynność („Kup wóz”)** | +2 | **207 / 186** | 125 | Portret: #5 „pełny magazyn, brak wozu”. Krajobraz: #5 „Piekarnia: wszystkie wozy zajęte”. W D była przy #3. |
| 7 | przestoje razem | | 7 / 9 spojrzeń | 10 | Portret 3 zakupy (150 → 60), krajobraz 3 + 1 przez kartę (150 → 30). |
| 8 | koniec zlecenia | 0 | **przepadło 12:00 / wykonane 11:35** | wygrana 11:57 | |
| 9 | list → misja II | 3 / 2 | — | 2 | Krajobraz: „Następna misja · II” (1 dotknięcie). Portret po porażce: „Do menu” → II. |

Łącznie dotknięć: portret 22, krajobraz 23 (D: 26). Luki > 10 s bez jasnej czynności pojawiły się tylko w fazie czekania na ×4 (narzędzie już nie patrzy).

## Ustalenia C/D: co naprawione, co zostało

| # | Ustalenie | Stan teraz | Dowód |
|---|---|---|---|
| N1 (C) | Portret: karta zamku po samouczku zasłania kartę przestoju | **Naprawione** (D-129) | `port-09-stall.jpg`: czysto, karta „Najgorszy zastój” na dole, `stall card shown: true`. |
| N1' | Krajobraz: po samouczku zostaje otwarty arkusz | **Częściowo** | Pierwszy krajobraz: po kroku 6 otwarta karta „Wóz 1” (`land1-09-stall.jpg`). Nie zasłania karty przestoju. W solo-przebiegu arkusza już nie ma (`land-08-stall.jpg`). Najpewniej drugie dotknięcie obrysu w trakcie zamykania. Drobiazg. |
| N2 (C) | „Czekanie na odbiór” bez lekarstwa | **Świadomie bez zmian w misji I** | D-128 daje „Kup wóz” dopiero po bramce floty (prognoza gotowa, ≥ 3:30 zapasu). W I nie zadziałała ani razu: 3 z 7 (port) i 4 z 9 (land) spojrzeń dały „czekanie na odbiór” bez czynności. Strata nr 1 na liście krajobrazu to nadal „Gospodarstwo czekanie na odbiór 4:11” (`land-16-end.jpg`). Pierwszy „Kup wóz” przyszedł później niż w D (186–207 s zamiast 125 s). |
| N3 (C) | List porażki bez lekarstwa | **Naprawione** (D-130) | `port-15-end.jpg`: „Następnym razem: Chata drwala — 4:16 czekania na wóz. Kup wóz wcześniej (−30).” Tekst misji nie radzi już mostu. |
| A5 (C) | „Ustawienia” przykrywa wiersze menu | **Naprawione** | Audyt menu: 0 zasłonięć w obu orientacjach. **Uwaga:** „Wolna dolina” nadal leży pod fałdą portretu (`valley-port-01-menu.jpg`, wiersz XIII ucięty). |
| N4 (C) | Cele < 48 px („Chata drwala” 74×40, ogniwo 26 px) | **Naprawione** (D-138) | Audyt: 0 celów < 48 px na wszystkich krokach w obu orientacjach. |
| N5 (C) | 0 słów na arkuszu | **Naprawione w grze** (D-135). W narzędziu zostaje przy obciążeniu. | Zastrzeżenie 4. |
| D-142 | List końcowy w krajobrazie | **Dobrze** | `land-16-end.jpg`: przyciski pod podpisem w lewej kolumnie, tabela strat w prawej, wszystko bez przewijania. |
| D-138/146 | Dok naprawy w niskim krajobrazie | **Dobrze, z jednym błędem** (N6) | `land-13-fixed.jpg`: „Kup wóz −30” z uzasadnieniem obok, bez przewijania. |

## Nowe ustalenia

**N6. Krajobraz: przycisk „Kup wóz” w doku przykrywa link „Młyn wodny” w łańcuchu przyczyn.** Audyt przy #6 i #7 („Gospodarstwo: pełny magazyn, brak wozu”): `button.linkish "Młyn wodny" under button.btn.primary "Kup wóz−30"`. Ogniwo łańcucha przewija się pod przyklejony dok. Dotknięcie w nie trafia w zakup za 30 srebra. Dok jest przyklejony z założenia (D-100), więc albo przewijany obszar musi kończyć się nad dokiem (`padding-bottom` = wysokość doku), albo zasłonięte ogniwo nie może przyjmować dotknięć.

**N7. Sprzeczny arkusz „nadwyżki”: nagłówek mówi „brak wozu”, treść mówi „wóz nie pomoże”.** Portret #4, `port-13-why4-nofix.jpg`, karta „Gospodarstwo: nadwyżka, nikt jej teraz nie potrzebuje”:
- tytuł przestoju: „Pełno zboża — brak wozu do odbioru”;
- niżej: „Nadwyżka: nikt teraz nie potrzebuje zboża, poczeka na placu. Nowy wóz tego nie przyspieszy.”

Gracz w < 30 s nie wie, czy kupić wóz. Najpewniej nagłówek bierze ogólny tekst `OUTPUT_FULL`, a wiersz pod nim podaje wariant „brak odbiorcy”. Nagłówek powinien iść za wariantem: „Pełno zboża — nikt go teraz nie potrzebuje”.

**N8. Karta „Zamek: wszystkie wozy zajęte” otwiera arkusz bez naprawy.** Krajobraz #4, `land-12-why4-nofix.jpg`: karta mówi „wszystkie wozy zajęte”, a oko otwiera kartę zamku z „Tempo dostaw — prognoza po pierwszej minucie” i „Deski w drodze — wóz 1”, bez „Kup wóz”. W D ta sama karta (portret #3) dawała „Kup wóz −30”. Albo przyczyna rozwiązała się w czasie otwierania (jak B5 w C, przy ×4), albo arkusz zamku nie pokazuje naprawy dla `NO_WAGON.ALL_BUSY`, gdy zamek jest odbiorcą. Do sprawdzenia: `buildingSheet` zamku przy tym przestoju.

**N9. Pierwszy „Kup wóz” w misji I przyszedł później niż w D (186–207 s zamiast 125 s).** Dyspozytor L1 (D-156) w misji I nie działa przy 2–3 wozach (bramka: start + 2). Różnica wynika więc raczej z kolejności przestojów: trzy spojrzenia z rzędu na „czekanie na odbiór” i jedno na „nadwyżkę” (N7). Kara jest jednak realna. Portret do 3:27 nie dostał ani jednej czynności, a krajobraz do 3:06. Dla ucznia misji I to 2 minuty „rozumiem, ale nic nie mogę zrobić”.

## Wolna dolina — pierwsze 5 minut (412×915)

| t gry | Co widzi gracz | Czynność | Dowód |
|---|---|---|---|
| menu | „Wolna dolina” **pod fałdą** (lista kończy się na uciętym XIII) | przewinięcie + 1 dotknięcie | `valley-port-01-menu.jpg` |
| księga | „Księgi osad”, 3 puste | „Nowa osada” | — |
| 0:00 | **List Wszebora** (61 słów, jedna myśl: renoma, różne towary, zacznij od gospodarstwa przy drodze zamkowej), gra wstrzymana | „Do dzieła” | `valley-port-03-letter.jpg` |
| 0:00 | Kadr na zamku (D-151). **Karta rangi** u dołu: „Do rangi 1 (Wieś targowa) brakuje towaru — postaw: Gospodarstwo” | oko | `valley-port-04-start.jpg` |
| 0:00 | Arkusz zamku: „Naprawa — Postaw: Gospodarstwo −30” + uzasadnienie („targ nie widział zboża”) | Postaw | `valley-port-05-sheet.jpg` |
| 0:00 | Duch gospodarstwa przy zamku, półka „Wróć / Postaw”, dymek „30 srebra + droga 5 · Brama bez drogi — potrzebny dojazd” | Postaw | `valley-port-06-ghost.jpg` |
| **0:00** | **Gospodarstwo stoi: 4 dotknięcia od listu** (Do dzieła, oko, Postaw: Gospodarstwo, Postaw). Arkusz farmy od razu proponuje „Zbuduj drogę: 4 srebra” | Zbuduj drogę | `valley-port-07-placed.jpg` |
| 0:00 | Arkusz się zamyka, kamera ucieka nad rzekę, **droga nie powstała** (srebro 230, nie 226) | — | `valley-port-08-road.jpg` |
| 0:25–1:10 | Karta: „Tartak / Chata drwala: czekanie na odbiór”, potem „Gospodarstwo: brak drogi do bramy” | — | `valley-port-09-min1.jpg` |
| 1:37 | Oko → „Zbuduj drogę: 4 srebra” → droga jest | 2 | — |
| 2:00–4:37 | Karta floty (D-140): „pełno zboża od 0:50, wszystkie 2 wozy w trasie — kup wóz”, potem 3, 4, 5 wozów | 4× „Kup wóz” | — |
| 5:00 | Ranga 0, 155 srebra, **6 wozów, 1 gospodarstwo**. Karta: „Chata drwala: czekanie na odbiór”. Karta rangi nie wróciła ani razu po 0:00. | — | — |

Wnioski z doliny:
- **D-151/D-152 działają.** Od listu do pierwszego budynku są 4 dotknięcia i każde jest podpowiedziane. Kadr na zamku i duch przy zamku nie wymagają szukania.
- **V1. Droga do farmy z arkusza po postawieniu nie weszła.** Dotknięcie „Zbuduj drogę” zamknęło arkusz i przesunęło kamerę, ale srebro i drogi się nie zmieniły. Skrypt był wtedy na pauzie (szybkość 0), a komenda poszła do kolejki. Możliwe, że to artefakt narzędzia: Escape zamykający narzędzie budowy tuż przed dotknięciem, w trakcie zanikania arkusza. Ta sama naprawa 1:37 później zadziałała. Potrzebny ręczny test na urządzeniu. Jeśli to się potwierdzi, gracz dostaje 1,5 min „brak drogi do bramy” zaraz po pierwszym budynku. Do tego dymek ducha mówi „30 srebra + droga 5”, co sugeruje, że droga wchodzi w cenę, a nie wchodzi.
- **V2. Karta floty zjada slot karty rangi.** Priorytet `fleetCard ?? mud ?? rankCard` (D-152) ma skutek: gracz, który idzie za kartą, przez 5 minut kupuje 4 wozy do jednego gospodarstwa. Nie stawia młyna, bo karta rangi nie wraca. Ranga 0 w 5:00, a do rangi 1 brakuje drugiego towaru. Rezerwa D-140 (cena + 40) chroni srebro na jeden budynek, ale gracz o tym budynku się nie dowie. D-140/D-149 mierzyły rangę 1 po ~11 min. Tutaj w 5 min nie widać postępu do rangi, a flota rośnie szybciej niż produkcja.
- **V3. Plakietka „Osada” (cele rangi) zasłania lewą górną ćwiartkę mapy w portrecie** i zakrywa część ducha gospodarstwa przy zamku razem z „Wieści z doliny” (`valley-port-06-ghost.jpg`). Po zamknięciu listu zostaje rozwinięta. W kroku arkusza sama się zwija (`valley-port-05-sheet.jpg`). Kandydat do zwinięcia w trybie budowy.

## Czy „zrozumiane w < 30 s”?

- **Samouczek: tak.** 7 dotknięć i 1 przeciągnięcie, 37–44 s gry, 0 celów < 48 px, karta przestoju widoczna po końcu w obu orientacjach.
- **Pierwsze 2–3 minuty po samouczku w misji I: rozumiem, ale nie mam czynności.** „Czekanie na odbiór” i „nadwyżka” bez naprawy. Do tego sprzeczny tekst nadwyżki (N7) i karta „wszystkie wozy zajęte” bez naprawy (N8).
- **Porażka uczy:** linia „Następnym razem…” celnie wskazuje lekarstwo.
- **Dolina: tak, do pierwszego budynku.** Potem karta prowadzi w flotę zamiast w rangę.

## Lista poprawek (priorytet; nic w `src/sim/`)

1. **N7: nagłówek przestoju idzie za wariantem „nadwyżka”** (`src/ui/stallKinds.ts` / tytuł w arkuszu „Dlaczego”, i18n pl/en). Zamiast „brak wozu do odbioru” ma być „nikt go teraz nie potrzebuje”, spójnie z „nowy wóz tego nie przyspieszy”. Tani, a sprzeczność trafia w sedno gry (diagnoza w < 30 s).
2. **V2: karta rangi wraca, gdy flota wystarcza.** Gdy wozów ≥ 2× liczba produkujących budynków albo karta floty pokazała się już 2 razy w ciągu ostatnich 2 min, slot dostaje karta rangi („postaw: Młyn”). Alternatywa: karta floty w dolinie dopiero, gdy czeka ≥ 2 budynki. Zmierzyć w `tools/sandbox-first30.mjs` / `valley-first5.mjs` (cel: ranga 1 < 8 min, bez nadmiaru wozów).
3. **N6: przewijany łańcuch kończy się nad dokiem naprawy w niskim krajobrazie** (`src/styles/main.css`, sekcja doku z D-100/D-138). `padding-bottom` ciała arkusza = wysokość doku albo `pointer-events` odcięte pod dokiem. Test układu: żadne ogniwo `.linkish` pod `.fix-btn`.
4. **V1: sprawdzić ręcznie „Zbuduj drogę” w arkuszu świeżo postawionego budynku** (i na pauzie). Jeśli to błąd: komenda drogi z arkusza ma przejść także w oknie „Cofnij (30 s)”. Dymek ducha nie może sugerować, że droga 5 jest w cenie, chyba że naprawdę wchodzi w cenę (`buildTool.ts`).
5. **N8: arkusz zamku przy „wszystkie wozy zajęte” zawsze z „Kup wóz”**, gdy wóz jest do kupienia (albo karta nie powinna wtedy mówić „wszystkie zajęte”). Sprawdzić `buildingSheet` dla zamku jako odbiorcy.
6. **N2/N9 (decyzja właściciela, otwarta w D-128):** okno 2:00–5:00 misji I bez sygnału wozu. Pomiar E dokłada argument: pierwszy własny ruch gracza dopiero po 3:06–3:27 gry. Gdyby ograniczyć regułę do misji I (bramka w samouczkowej misji, bez wpływu na inne), straty pieczęci z D-128 nie dotyczyłyby innych map.
7. **A5': „Wolna dolina” nad fałdą portretu** (menu): np. przypięty wiersz doliny pod „Zacznij tutaj” albo obok „Ustawień”.
8. **V3:** plakietka „Osada” zwija się w trybie budowy (portret).
9. **Narzędzia:** first10 ma czekać na pełne wejście arkusza także przy ponownym odczycie naprawy (zastrzeżenie 4). Limit pętli przestojów liczyć w czasie gry, nie ściany (zastrzeżenie 2). Przebiegi puszczać po kolei, nie równolegle.
