# MARCHIA — 6 kadrów sklepowych (rzeczywista gra, HUD v3/v4)

**Weryfikacja przed publikacją:** wszystkie ujęcia muszą pochodzić z działającej gry uruchomionej w Playwright/Chromium. Generator odrzuca brakujące stany zamiast rysować fikcyjne panele, zatory, teksty czy elementy mapy. Pliki `docs/shots/*` oraz załączone referencje są tylko wzorem stylu.

## Kadry i podpisy (PL / EN)

| Nr | Rzeczywista scena i warunek | Podpis PL | Caption EN | Poziom |
| --- | --- | --- | --- | --- |
| 1 | **Misja I:** prawdziwa dolina, wozy z towarami, lista kontraktu pod wstęgą. Nie mylić z Wolną doliną, bo ta nie ma terminu kontraktu. | Trasy, wozy, kontrakty | Roads, wagons, contracts | tak |
| 2 | **Misja I:** przycisk oka przy karcie „Najgorszy zastój” otwiera autentyczny arkusz „Dlaczego stoi?”. Nie zmieniaj na potrzeby zdjęcia statusów ani magazynów. | Najgorszy zastój. Znajdź przyczynę | Find the cause of the worst stall | nie |
| 3 | **Misja II:** prawdziwy status `BRIDGE_JAM` po ruchu wozów przez drewniany most; panel wybranego wozu pokazuje oczekiwanie. | Odetkaj most, uwolnij dostawy | Clear the bridge, free deliveries | nie |
| 4 | **Misja IV:** aktywne, rzeczywiste okno kry na rzece. Pokazać zamkniętą drewnianą przeprawę i realną planszę. | Kra zamyka drewniany most | River ice closes the wooden bridge | nie |
| 5 | **Wolna dolina:** ranga osady w HUD, rzeczywisty otwarty targ, pory roku; trzy Księgi osad dokumentować osobnym kadrem pomocniczym, nie udawać ich obecności na scenie. | Wolna dolina. Targ i ranga | Free Valley. Market and rank | tak |
| 6 | **Misja I:** autentyczny list kasztelana z pieczęcią; nie dodawać wymyślonych pieczęci ani podrabianych nagród. | List kasztelana i królewski kontrakt | A castellan's letter and contract | nie |

## Rozmiary i lokalizacje

- **Google Play:** w każdym języku 6 PNG **1080 × 1920** i 2 PNG **1920 × 1080** (kadry 1 oraz 5).
- **Google Play — grafika wyróżniająca:** **1024 × 500** w PL i EN; wycinek autentycznej sceny #1 z napisem „Marchia” i odpowiednio „Szlaki Królestwa” / „Roads of the Kingdom”.
- **Apple App Store:** w każdym języku 6 PNG **1290 × 2796** (6,7 cala).
- **Łącznie:** 30 plików PNG (15 PL i 15 EN), rozmiar sumaryczny nie większy niż **25 MiB**.
- Nazwy: `docs/store/shots/<lang>/<nr>-<szerokość>x<wysokość>.png`, np. `docs/store/shots/pl/03-1080x1920.png`. Dodatkowo `feature-1024x500.png`.
- Ewidencja autentycznych scen, aktywnych okien i błędów: `docs/store/shots/manifest.json`.

## Sposób generowania

```bash
npm ci
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
node tools/store-shots-v2.mjs
# wybiórczo:
node tools/store-shots-v2.mjs --lang=pl --shot=3 --orientation=portrait
```

Skrypt uruchamia `npm run build` oraz własny `vite preview`, następnie wyświetla **faktyczne WebGL** i sprawdza warunki w stanie prawdziwej symulacji, zanim zapisze PNG. Nie nadpisuje statusów, poziomu osady, zasobów ani treści w UI. W misji II dokupuje dwa wozy istniejącą komendą gry, zgodnie z `tools/bot-m2.ts`.

**Ciężar i jakość:** podpisy wykorzystują lokalne fonty gry (Grenze Gotisch + Alegreya Sans), a PNG są optymalizowane paletowo przez `sharp`; przekroczenie limitu 25 MiB przerywa zadanie. Bez makiet, ramek telefonów, „Welcome!” i strzałek-emoji. Przy miniaturze zweryfikować czytelność napisów.

## QA i wiarygodność

- [ ] 30 PNG z prawdziwej gry, z obu języków i prawidłowymi wymiarami.
- [ ] Brak błędów WebGL, `pageerror`, paneli debug, fałszywych ładunków i zmienionych statusów.
- [ ] Kontrakt #1, powód zatrzymania #2, rzeczywisty korek #3, aktywna kra #4, targ i ranga #5, list #6 sprawdzone w manifeście.
- [ ] Podpisy PL/EN po maksymalnie 40 znaków.
- [ ] Wszystkie 30 miniatur obejrzane przy docelowym rozmiarze i na telefonie; UI nie powinno zasłaniać ważnego obiektu.
- [ ] Pliki PNG mieszczą się razem w 25 MiB.
- [ ] Ostateczne pakiety wysyłane do sklepów odpowiadają pokazanym mechanikom i zasadom platform.
