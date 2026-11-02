# Marchia — zestaw grafik UI (poprawki 55b)

Zestaw jest propozycją artystyczną, **bez integracji z kodem gry**. Pliki (`public/assets/ui/kit/`) są bez napisów i ikon; napisy widoczne na makietach są przykładami. Grafiki małych elementów zostały **przerysowane natywnie** osobno w rozdzielczościach @2x i @3x, bez interpolowania z mniejszych bitmap.

## Wymiary i 9-slice

Kolumny L / T / R / B w poniższej tabeli są **pikselami pliku** (nie dp), liczone od krawędzi. Narożniki wewnątrz tych marginesów muszą być nierozciągane.

| Element (bez sufiksu @2x.png / @3x.png) | dp | Marginesy @2x px L / T / R / B | Marginesy @3x px L / T / R / B |
|---|---|---|---|
| `panel`, `panel-dim`, `panel-alert` | 120 × 80 | 24 / 24 / 24 / 24 | 36 / 36 / 36 / 36 |
| `ribbon` | 120 × 34 | 46 / 16 / 46 / 16 | 69 / 24 / 69 / 24 |
| **`stat` (poprawiony)** | 120 × 40 | **24 / 20 / 24 / 20** | **36 / 30 / 36 / 30** |
| `button-normal`, `button-pressed`, `button-active`, `button-disabled` | 56 × 56 | — | — |
| `card-normal`, `card-pressed`, `card-active`, `card-disabled`, `card-highlight` | 64 × 72 | 20 / 20 / 20 / 20 | 30 / 30 / 30 / 30 |
| `badge`, `badge-red` | 24 × 24 | — | — |
| `seal-alert` | 72 × 72 | — | — |
| `seal-empty`, `seal-full` | 28 × 28 | — | — |
| `progress-track`, `progress-fill` | 120 × 8 | 12 / 4 / 12 / 4 | 18 / 6 / 18 / 6 |
| **`segment-bg` (ciemny mosiądz)** | 160 × 44 | 24 / 18 / 24 / 18 | 36 / 27 / 36 / 27 |
| `segment-active` | 40 × 44 | 18 / 18 / 18 / 18 | 27 / 27 / 27 / 27 |
| `pin-red`, `pin-brass` | 40 × 48 | — | — |
| `eta` | 120 × 40 | 40 / 20 / 40 / 20 | 60 / 30 / 60 / 30 |
| `menu` | 48 × 48 | — | — |
| **`frame-sheet`, `frame-sheet-dim` (nowe)** | **320 × 224** | **76 / 72 / 76 / 72** | **114 / 108 / 114 / 108** |

## Zachowanie i czytelność

- Żeton `stat`: dekoracyjne okucia kończą się na 12 dp od lewej/prawej krawędzi, środek ma 96 dp w pliku bazowym. 9-slice rozciąga tylko środkową część, więc nie zjada miejsca na czas `09:18` na wąskich żetonach 60–90 dp. Dla 60 dp stosuj krój o szerokości pięciu znaków nie większej niż 34 dp (np. cyfry 10 dp, monospaced), bez paddingu narzucanego w szablonie.
- `segment-bg`: zamiast prawie czarnego wnętrza zastosowano ciemny, oksydowany mosiądz / przygaszony pergamin; `segment-active` pozostaje bez zmian. Przy aktywnym x2 i pozostałych wartościach zachować kontrast tekstu.
- `frame-sheet`: wzór od właściciela `ref/frame-owner.webp`; ornamenty z liliami i nity w narożnikach należą do pól 9-slice i nie mogą się skalować niezależnie. Środkowy poziomy/ pionowy pas jest ciągły i **rozciągany**, nie kafelkowany, więc nie wprowadza powtarzającego się ornamentu. Minimalny obszar renderowania: **280 × 180 dp**. Wersja `frame-sheet-dim` przyciemnia pergamin, nie nity i mosiądz.
- Użytkowe ramy, żetony i pasek dopuszczają 9-slice. Przyciski okrągłe, pieczęcie, plakietki i piny renderować bez zmiany proporcji. Wypełnienie paska jest osobną warstwą. W RTL sprawdzić odbicie krawędzi `panel-alert`.
- Testy wizualne: podgląd @2x oraz @3x przy skali 100%, ostre obrzeża, brak sączenia przezroczystości, pięcioznakowy czas bez obcięcia, wąski żeton stat 60/75/90 dp, arkusz 280 × 180 dp i 400 × 505 dp.

## Makiety (nie są screenshotami gry)

- [Arkusz wszystkich elementów](ui-kit-sheet.png) — elementy zmienione pokazano z faktycznych nowych PNG; miniatury elementów niezmienianych są jedynie poglądowe (rzeczywiste pliki pozostały na gałęzi).
- [Makieta pionowa D, 412 × 915](ui-kit-D-412x915.png)
- [Makieta pozioma D, 915 × 412](ui-kit-D-915x412.png)
- [Nowa makieta „Dlaczego stoi?”, 412 × 915](ui-kit-sheet-why-412x915.png) — rama arkusza zajmuje ~55% wysokości od dołu, tytuł „Młyn”, dwa wiersze łańcucha przyczyn, CTA „Kup wóz 30”.

Makiety są kompozycjami przygotowanymi z dostarczonej referencji i grafik konceptowych. **Nie były testowane w działającej grze**. Przed integracją sprawdzić układy w runtime, zachowanie 9-slice, fokus, ikony, lokalizację i RTL.
