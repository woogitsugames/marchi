# Marchia — zestaw grafik UI do oceny

Zestaw jest propozycją wizualną, bez podłączenia do gry. Pliki znajdują się w `public/assets/ui/kit/` i nie zawierają ikon ani tekstu; na makietach użyto ikon z `src/ui/icons.ts`. Wymiary poniżej podano w dp; rzeczywiste pliki mają dwukrotne lub trzykrotne wymiary. Przyciski i znaczniki mapy nie są przeznaczone do rozciągania.

| Element i stany — nazwy plików bez sufiksu `@2x.png` / `@3x.png` | Rozmiar bazowy | 9-slice L/T/R/B @2x | 9-slice L/T/R/B @3x |
|---|---:|---:|---:|
| `panel`, `panel-dim`, `panel-alert` | 120 × 80 | 24 / 24 / 24 / 24 | 36 / 36 / 36 / 36 |
| `ribbon` | 120 × 34 | 46 / 16 / 46 / 16 | 69 / 24 / 69 / 24 |
| `stat` | 120 × 40 | 40 / 20 / 40 / 20 | 60 / 30 / 60 / 30 |
| `button-normal`, `button-pressed`, `button-active`, `button-disabled` | 56 × 56 | — | — |
| `card-normal`, `card-pressed`, `card-active`, `card-disabled`, `card-highlight` | 64 × 72 | 20 / 20 / 20 / 20 | 30 / 30 / 30 / 30 |
| `badge`, `badge-red` | 24 × 24 | — | — |
| `seal-alert` | 72 × 72 | — | — |
| `seal-empty`, `seal-full` | 28 × 28 | — | — |
| `progress-track`, `progress-fill` | 120 × 8 | 12 / 4 / 12 / 4 | 18 / 6 / 18 / 6 |
| `segment-bg` | 160 × 44 | 24 / 18 / 24 / 18 | 36 / 27 / 36 / 27 |
| `segment-active` | 40 × 44 | 18 / 18 / 18 / 18 | 27 / 27 / 27 / 27 |
| `pin-red`, `pin-brass` | 40 × 48 | — | — |
| `eta` | 120 × 40 | 40 / 20 / 40 / 20 | 60 / 30 / 60 / 30 |
| `menu` | 48 × 48 | — | — |

Marginesy są w pikselach danego pliku, w kolejności lewa/góra/prawa/dół. Wstęgę, plakietki, pasek i przełącznik należy rozciągać przede wszystkim poziomo. Wypełnienie postępu jest niezależną warstwą nad rowkiem; jego szerokość powinna odpowiadać postępowi, przy zachowaniu końcówek. Stany `disabled` mają kreskowanie. `panel-alert` ma winną krawędź po lewej; przy układzie RTL integracja powinna rozważyć jej odbicie.

- [Arkusz wszystkich elementów](ui-kit-sheet.png)
- [Makieta pionowa 412 × 915](ui-kit-D-412x915.png)
- [Makieta pozioma 915 × 412](ui-kit-D-915x412.png)

Makiety pokazują koncepcję na dostarczonym obrazie D; fragmenty pod istniejącym HUD zostały zakryte przed nałożeniem nowych elementów. Nie są zrzutami z działającej gry ani dowodem testu na urządzeniu. Integracja powinna osobno sprawdzić czytelność, marginesy przy różnych proporcjach, stany klawiatury i RTL.
