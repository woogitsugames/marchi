# HUD — palety × style (makiety)

Jeden układ, ten sam stan gry, portret 412×915 (@2x). Różnią się tylko paleta i styl.
Pliki: `P1-S1.jpg` … `P4-S3.jpg`, zestawienie `matrix.jpg` (wiersze = palety, kolumny = style, z prawej obecny HUD).
Źródło: `pxs.html?p=P1&s=S1` (palety jako zmienne CSS w `palettes.js`, style jako klasy), render `node render-pxs.cjs`, `node render-matrix.cjs`, kontrast `node contrast.cjs`.
Ikony to oryginalne drzeworyty z `src/ui/icons.ts` (tylko przekolorowane), fonty Grenze Gotisch + Alegreya Sans.

## Palety
- **P1 Iluminowany rękopis** — jasny pergamin, czarny atrament, cynober tylko dla przestojów, lapis dla aktywnej prędkości i chleba, cienka złota linia.
- **P2 Żelazo i grafit** — chłodny grafit, tekst w kolorze pergaminu, czerwony wosk wyłącznie przy przestojach (pieczęć kontraktu jest tu ołowiana).
- **P3 Heraldyczny granat i złoto** — granatowe pole, złoto-ochrowe linie i liczby, kremowy tekst, czerwień (gules) dla przestojów.
- **P4 Ciemna zieleń i mosiądz** — butelkowa zieleń, mosiężne okucia i liczby, kremowy tekst.

## Style
- **S1 Płaski, ostry, heraldyczny** — płaskie pola, ścięte narożniki, podwójna cienka linia, duże cyfry tabelaryczne.
- **S2 Rękopis z ornamentem** — inicjał „L”, narożne ornamenty, rubryki kapitalikami, pas z rombami nad paskiem narzędzi.
- **S3 Materiałowy** — kuta rama z nitami, przeszycie, lekko wypukłe przyciski; cieniowanie tylko materiałowe, bez rozmyć.

## Kontrast (WCAG, minimum w każdej palecie ≥ 4.5:1)
| Paleta | tekst/panel | drugorzędny | liczby | przestój na panelu | tekst na czerwieni | aktywny przycisk | panel vs łąka / las |
|---|---|---|---|---|---|---|---|
| P1 | 14.0 | 7.6 | 14.0 | 5.7 | 5.9 | 8.4 | 5.5 / 7.2 |
| P2 | 12.2 | 6.7 | 12.2 | 5.3 | 6.5 | 12.2 | 2.3 / 1.7 (rama 1.9 / 2.5) |
| P3 | 12.3 | 7.9 | 8.8 | 6.6 | 5.6 | 6.8 | 2.2 / 1.6 (rama 2.9 / 3.8) |
| P4 | 10.0 | 6.6 | 6.8 | 5.5 | 5.9 | 5.8 | 1.8 / 1.4 (rama 2.9 / 3.8) |

P4 na tle lasu prawie się zlewa (1.4:1) — od mapy oddziela go tylko mosiężna rama; P2 ma najsłabszą ramę na mapie.
Stan nigdy nie jest oznaczony samym kolorem: przestój = ikona przyczyny + tekst + licznik, aktywna prędkość = wypełnienie + znacznik ▲.

## Rekomendacja
1. **P1 · S1** — najczytelniejszy (14:1), jedyny, który wyraźnie odcina się od zielonej mapy (5.5–7.2:1), czerwień znaczy tylko „przestój”, więc oko od razu ją łapie. Najbliżej idei listu przewozowego, a zupełnie inny niż odrzucony dąb.
2. **P3 · S1** — najmocniejszy charakter (heraldyczne pole i złote cyfry), dobrze czytelny w nocnych/ciemnych scenach; S3 tej palety też działa, ale ramy z nitami zajmują miejsce bez zysku informacyjnego.
S2 najlepiej użyć jako akcentu tylko na liście przewozowym i ekranie kontraktu, nie na całym HUD-zie.
