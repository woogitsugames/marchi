# Pierwsze 10 minut — przebieg B po poprawkach dnia 6 (2026-11-03)

**Status: pomiar częściowy, przerwany limitem użycia.** Przeszliśmy cały samouczek misji I (kroki 1–6, z mostem) w obu orientacjach. W krajobrazie doszliśmy też do pierwszego przestoju, arkusza „Dlaczego” i 10 kolejnych przestojów. **Zlecenie nie skończyło się** w czasie pomiaru: zegar 12:40, 12/30 desek, 0/20 chleba, 5:49 „do śniegu”. Z tego powodu list końcowy, „Następna misja” i start misji II są **nie zmierzone**. Dla portretu mamy kroki do 4. przestoju, potem skrypt się wywrócił. Pełne JSON-y audytu (słowa i cele < 48 px na każdy krok) przepadły w obu przebiegach razem z awarią skryptu. Liczby poniżej pochodzą z logów kroków i ze zrzutów.

Narzędzie: `tools/first10-minutes.mjs` (rozszerzone):
- `settle()`: po każdym dotknięciu czeka dwie klatki rAF, aż sygnatura UI przestanie się zmieniać, więc skrypt nie ściga się z samouczkiem;
- krok 4: jedno dotknięcie „Droga”, potem czekanie na zmianę kroku;
- krok 5: przeciągnięcie tylko po brakujących polach ducha, najpierw dotykiem, w razie potrzeby myszą;
- przed dotknięciem sprawdza, czy cel nie leży pod fałdą arkusza, i liczy przewinięcie jako gest;
- sprawdza, czy srebro spadło po „Naprawie”;
- zapisuje częściowy JSON po każdym kroku (`FIRST10_OUT.partial`);
- awarie zrzutów nie przerywają przebiegu.

Zimny start (nowy kontekst przeglądarki). Build `npm run build`, `vite preview --port 5195`, SwiftShader, `?debug=1&lang=pl&quality=low`. Zrzuty: `docs/research/shots-first10b/` (12 JPG, krajobraz; zrzuty portretu usunięto przed powtórką, która nie doszła do końca).

**Zastrzeżenie co do czasu:** pod SwiftShaderem klatka trwa 1–4 s, a dwa przebiegi równolegle dzieliły CPU. Czas ściany to więc czas *narzędzia*, nie gracza. Czas gry liczy zegar HUD. Przy ×1 gra biegnie w trakcie oczekiwania skryptu, więc jest zawyżony względem szybkiego gracza.

## Tabela kroków — krajobraz 915×412

| # | Krok | Dotknięcia | Ściana (s) | Zegar gry | Obserwacje |
|---|---|---|---|---|---|
| 0 | zimny start → menu | 0 | 44–56 (ready 3,7 s) | — | „Zacznij tutaj” przy I działa (D-93). 13 wierszy, ~100 słów. Audyt menu: 1 przycięcie, 2 nakładki tekstu (szczegóły nie zmierzone). |
| 1 | menu → list kasztelana | 1 | 53–86 | — | list widoczny, „Do dzieła” |
| 2 | list → krok 1 | 1 | 108–138 | 6:30 | Notatka **nie leży** już na liście przewozowym (`land-03`), strzałka czytelna. Poprawka D-91 działa. |
| 3 | krok 2 (karta zamku, ogniwo) | 1 | 109 | — | Obrys ogniwa na arkuszu bocznym, notatka obok, bez zasłonięć. |
| 4 | krok 3 (wóz) | 1 | 21 | — | — |
| 5 | krok 4 („Droga”) | 1 | 126 | 6:47 | Obrys „Droga” wychodzi 1 px za lewą krawędź (`ringOff`, kosmetyka). Karta wozu zostaje zadokowana po prawej. |
| 6 | **krok 5 (most)** | 1 przeciągnięcie (+powtórki) | **384** | 6:54 → 7:14 | **Notatka zasłania pasek narzędzi** („Droga” jako aktywne, „Bruk”, „Rozbiórka”, „Kup wóz”, `land-06`). Duch przeprawy jest na ekranie, przeciągnięcie buduje most (−30 srebra). Otwarty problem z BACKLOG potwierdzony. |
| 7 | krok 6 → koniec samouczka | 1 | 161 | 7:14 → 7:24 | Strzałka na liście przewozowym. Karta „Najgorszy zastój” pojawia się dopiero teraz (D-92 działa). **Po samouczku narzędzie „Droga” zostaje włączone** (`land-09`). |
| 8 | pierwszy przestój | 0 | 109 | 7:24 | „Gospodarstwo: czekanie na odbiór” (pieczęć 1) |
| 9 | oko → arkusz „Dlaczego” | 1 | ~70 | 7:31 | **W krajobrazie arkusz ma ~200 px treści**: widać nagłówek i pierwsze ogniwo, sekcja „Naprawa” jest pod fałdą (`land-10`, `land-11`). |
| 10 | „Naprawa” (Kup wóz) | 1–2 (+przewinięcie) | — | 8:48 | **Po „naprawie” srebro dalej 150** (`land-11`, `land-12`): w przebiegu 1 dotknięcie nie trafiło w przycisk pod fałdą, a wóz nie został kupiony. W przebiegu 2 dodano pomiar `silver a -> b`, ale nie zdążył dojść do tego kroku. |
| 11 | przestoje #2–#10 | 2 każdy | 60–75 każdy | do 12:40 | Kolejne „Dlaczego” bez skutku. Na końcu „Gospodarstwo: pełny magazyn, brak wozu”, pieczęć 6. |
| 12 | koniec zlecenia / „Następna misja” / misja II | — | — | — | **nie zmierzone** (zlecenie trwało dalej, 12/30 desek, 0/20 chleba) |

## Tabela kroków — portret 412×915

| # | Krok | Dotknięcia | Ściana (s) | Obserwacje |
|---|---|---|---|---|
| 0–1 | zimny start → menu → list | 1 | 65 + 86 | — |
| 2 | krok 1 | 1 | 110 | — |
| 3 | krok 2 | 1 | 79 | Notatka u góry (84,124), obrys ogniwa nisko (y 556), bez zasłonięć. |
| 4 | krok 3 | 1 | 23 | Obrys y 659, OK. |
| 5 | krok 4 | 1 | 88 | Obrys „Droga” x = −1 (1 px poza ekranem), strzałka nad nim. Notatka na środku (y 320–430), nic nie zasłania. |
| 6 | krok 5 (most) | 1 przeciągnięcie (+powtórki) | **316** | Duch na ekranie, notatka nic nie zasłania. Most zbudowany, przejście do kroku 6. **Poprawka D-91 potwierdzona w portrecie.** |
| 7 | krok 6 → koniec samouczka | 1 | 124 | Obrys listu (25,201), notatka pod nim, OK. |
| 8 | pierwszy przestój | 0 | 87 | — |
| 9 | „Dlaczego” → naprawa, przestoje #2–#4 | 2 każdy | 60–140 | Przy 4. przestoju przycisk „Naprawa” zniknął między audytem a dotknięciem (arkusz przerysował się sam). Skrypt się wywrócił, dalej **nie zmierzone**. |

Suma do końca samouczka: **7 dotknięć + 1 przeciągnięcie** w obu orientacjach. W pierwszym przebiegu było 6 dotknięć, a samouczek utknął na kroku 5. Samouczek zajmuje ~55 s zegara gry (6:30 → 7:24), z czego krok 5 trwa ~20 s.

Przerwy > 10 s bez jasnej czynności: po końcu samouczka do pierwszej karty przestoju (~10 s gry przy ×1). W fazie przestojów karta była zawsze widoczna, ale jej „Naprawa” w krajobrazie leżała pod fałdą. Pełny pomiar luk: nie zmierzone (JSON utracony).

## Porównanie z przebiegiem A

| Problem z A | Teraz |
|---|---|
| Krok 5 utyka, most się nie buduje | **Naprawione**: most powstaje w obu orientacjach. |
| Notatka na liście przewozowym (kroki 1, 4) | **Naprawione** w obu orientacjach. |
| Przestój przed lekcją o przestojach | **Naprawione**: karta pojawia się od kroku 6. |
| Brak „Następna misja” | W kodzie jest (D-93), na ekranie **nie zmierzone**. |
| Menu bez kierunku, „Ustawienia” poza ekranem | „Zacznij tutaj” jest; „Ustawienia” w portrecie nie zmierzone. |
| Notatka w kroku 5 w poziomie na pasku narzędzi | **Wciąż otwarte** (`land-06`). |

## Problemy (ranking)

1. **Nowy gracz nie kończy misji I ścieżką „oko → Naprawa”.** Po moście zlecenie stoi: 12/30 desek i 0/20 chleba przy 12:40, srebro nietknięte (150). Lekarstwo „Kup wóz” jest w arkuszu, ale w krajobrazie pod fałdą, a dotknięcie po przewinięciu nie zadziałało. Bot z 4 dodatkowymi wozami wygrywa w 8,85 min, więc brak wozów to właśnie ta przyczyna. Uwaga: wkład artefaktu skryptu (przewinięcie z animacją) **nie jest wykluczony**. Warto sprawdzić ręcznie na telefonie.
2. **Arkusz „Dlaczego” w krajobrazie ma ~200 px wysokości**: łańcuch i „Naprawa” leżą pod fałdą. Gracz widzi tylko nagłówek i pierwsze ogniwo.
3. **Notatka samouczka w poziomie w kroku 5 zasłania pasek narzędzi**, w tym aktywną „Drogę”. Zadokowana karta wozu z kroku 3 zjada prawą połowę ekranu i nie zostawia notatce wolnego pasma.
4. **Po samouczku „Droga” zostaje włączona**: dotknięcie mapy rysuje drogę zamiast otworzyć kartę budynku.
5. **Arkusz przerysowuje się pod palcem**: przycisk „Naprawa” znika lub przesuwa się między odczytem a dotknięciem. Na telefonie przy wolnej klatce grozi to chybieniem.
6. Kosmetyka: obrys „Droga” wychodzi 1 px poza ekran (`ringOff`).

## Poprawki (żadna nie dotyka `src/sim/`)

1. **„Naprawa” nad łańcuchem albo przyklejona do dołu arkusza „Dlaczego”.** W `src/ui/panels.ts` (budowa arkusza budynku, linie ~387–389) przesunąć `fixHtml`/`cureHtml` przed `lead`, gdy budynek stoi. Druga opcja: owinąć sekcję `.fix` w `position: sticky; bottom: 0` w CSS arkusza (`src/styles/`). Wtedy przycisk jest widoczny bez przewijania w 915×412.
2. **Krok 5 w poziomie: zamknąć zadokowaną kartę wozu i zważyć pasek narzędzi.** W `src/ui/tutorial.ts` w `update()` przy `go(5)` wywołać `this.host.closeSheets()` także dla arkusza bocznego. W `placeNote()` w krokach 4–5 dać `.rail-tools` wagę ≥ 20 (jak `target`) i dodać pasek narzędzi do pasm odrzucanych w `tryBand`.
3. **Koniec samouczka wyłącza narzędzie „Droga”.** W `Tutorial.end()` / `host.finish` (`src/ui/app.ts`) ustawić narzędzie na brak (`setTool(null)`), żeby dotknięcie mapy po samouczku otwierało karty.
4. **Stabilny przycisk naprawy.** W `src/ui/panels.ts` przerysowywać arkusz tylko przy zmianie przyczyny lub naprawy (porównać sygnaturę HTML przed `setHtml`) i nie podmieniać `fix-btn` pod palcem w trakcie `pointerdown`.
5. **Domknąć pomiar.** Uruchomić `node tools/first10-minutes.mjs 915x412`, potem osobno `412x915` (nie równolegle: CPU). `FIRST10_OUT=…` daje JSON z `.partial`. Zmierzyć: srebro po „Naprawie”, list końcowy, „Następna misja”, start misji II, audyt słów i celów < 48 px.
