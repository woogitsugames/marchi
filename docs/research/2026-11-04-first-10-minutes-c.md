# Pierwsze 10 minut — przebieg C na obecnym buildzie (2026-11-04)

**Status: pomiar pełny w obu orientacjach.** Oba przebiegi przeszły całą ścieżkę: zimny start, menu, list, samouczek (kroki 1–6 z mostem), 10 pętli „karta przestoju → oko → arkusz »Dlaczego« → Naprawa”, koniec zlecenia, list końcowy i start misji II. Wynik misji I zależy od orientacji. **W portrecie zlecenie przepadło** (30/30 desek, 18/20 chleba przy 12:00, kupione 3 wozy). **W krajobrazie zlecenie wykonano** (11:23/12:00, 1 z 3 pieczęci, kupione 4 wozy), a „Następna misja” zaprowadziła do misji II jednym dotknięciem.

Narzędzie: `tools/first10-minutes.mjs` (Playwright, Chromium ze SwiftShaderem, `?debug=1&lang=pl&quality=low`, nowy kontekst, więc pusta IndexedDB). Build `npm run build`, `vite preview --port 5195`. Przebiegi szły **po kolei, nie równolegle**. Zrzuty (JPG, 26–41 KB): `docs/research/shots-first10c/`. Pełne JSON-y audytu (słowa, cele < 48 px, przycięcia, zasłonięcia, luki) są tym razem zapisane: `shots-first10c/first10c-412x915.json` i `first10c-915x412.json`.

## Poprawka narzędzia (ważne dla porównań z A i B)

Pierwszy przebieg C pokazał 0 słów na każdym liście i arkuszu i ani razu nie znalazł przycisku „Naprawa”. Przyczyna: `deepVis()` w audycie wymagał niezerowego prostokąta u **każdego przodka**. Warstwy HUD, arkuszy i listów mają jednak wysokość 0 px, a ich dzieci z nich wystają. Audyt nie widział więc treści arkuszy i przycisków `.fix-btn`, a skrypt nie kupował wozów. Prawdopodobnie ta sama wada zaniżała liczby słów i stan „srebro nietknięte” w przebiegu B (tam pętla napraw też „nie działała”). Poprawka w commicie `f1eb4b4`: przodkowie są sprawdzani tylko pod kątem `visibility/display/opacity/hidden/aria-hidden`, bez rozmiaru. Druga zmiana: gdy oko karty przestoju leży pod otwartym arkuszem, skrypt najpierw go zamyka (liczone jako 1 gest). Dodano też zrzut trzech pierwszych arkuszy „Dlaczego”. Wyniki pierwszego, wadliwego przebiegu C odrzucono.

Zastrzeżenie co do czasu jak w B: czas ściany to czas narzędzia pod SwiftShaderem (klatka 0,5–3 s), a nie czas gracza. Czas gry liczy symulacja (`tick/10`).

## Tabela kroków

| # | Krok | Dotknięcia | Ściana port / land (s) | Gra (s) | Uwagi |
|---|---|---|---|---|---|
| 0 | zimny start → menu | 0 | 37 / 24 (`ready` 3,0 / 5,5) | — | 110 / 101 słów. „Zacznij tutaj” przy I. Zobacz ustalenie 5. |
| 1 | menu → list kasztelana | 1 | 59 / 35 | — | List 57 słów, „Do dzieła” na wierzchu. |
| 2 | list → krok 1 | 1 | 82 / 70 | 6,8 / 7,2 | Notatka 18 słów, nie zasłania listu przewozowego. |
| 3 | krok 2 (karta zamku) | 1 | 54 / 51 | 5,9 / 6,9 | Arkusz z łańcuchem i dwoma zwiniętymi wierszami, 46 / 51 słów na ekranie. |
| 4 | krok 3 (wóz) | 1 | 17 / — | 2,7 / — | W krajobrazie krok 3 minął w trakcie oczekiwania kroku 2. W portrecie link „Chata drwala” ma 74×40 px. |
| 5 | krok 4 („Droga”) | 1 | 67 / 53 | 7,4 / 6,4 | Obrys „Droga” mieści się na ekranie (x = 0). |
| 6 | krok 5 (most) | 1 przeciągnięcie | 139 / 152 | 17,5 / 17,5 | Duch w całości na ekranie, most przy pierwszym przeciągnięciu. W portrecie 1 z 17 pól ducha leży pod pinezką przestoju. |
| 7 | krok 6 → koniec samouczka | 1 | 59 / 56 | 8,3 / 7,6 | Karta przestoju pojawia się dopiero teraz. |
| — | **samouczek razem** | **7 + 1 przeciągnięcie** | 350 / 321 | **43,3 / 40,1** | B: ~55 s gry. |
| 8 | koniec samouczka → pierwszy przestój | 0 (+1 zamknięcie w portrecie) | 43 / 43 | 5,7 / 5,8 | Gra zostaje na ×1. **Portret: karta zamku zostaje otwarta i zasłania kartę przestoju** (ustalenie N1). |
| 9 | oko → „Dlaczego” | 1 | 93 / 73 | 26,7 / 24,3 | Pierwszy przestój to „Gospodarstwo: czekanie na odbiór”: łańcuch „Pełno zboża → Wóz 2 jedzie po ładunek”, **brak naprawy** (ustalenie N2). |
| 10 | przestoje #2–#10 | 1–2 każdy | 40–116 | 22–71 | Portret: 4 razy „Kup wóz”, 3 zakupy weszły (150 → 60). Krajobraz: 4 razy, 4 zakupy (150 → 30). |
| 11 | koniec zlecenia | 0 (×4) | 461 / 547 | 292 / 289 | Portret: **przepadło**, 30/30 desek i 18/20 chleba. Krajobraz: **wykonane** 11:23, 1/3 pieczęci. |
| 12 | list końcowy → misja II | 3 / 2 | 61 / 85 | — | Krajobraz: „Następna misja · II. Korek na moście” (primary) → list II. Portret po porażce: „Jeszcze raz” / „Do menu”, potem menu → II. |

Łącznie: portret 27 dotknięć, krajobraz 24. Luki > 10 s bez jasnej czynności: portret 2 (19 s i 48 s ściany przy ×4, w końcówce, gdy karta przestoju zniknęła), krajobraz 0.

## Ustalenia z A i B: stan teraz

| # | Ustalenie (A/B) | Stan | Dowód |
|---|---|---|---|
| A1 | Krok 5 (most) utyka | **Naprawione** | Most przy pierwszym przeciągnięciu w obu orientacjach (`port-06-tut5.jpg`, `land-06-tut5.jpg`). Krok 5 zajmuje 17,5 s gry. |
| A2 | Notatka samouczka zasłania listę przewozową | **Naprawione** | `noteCovers` puste w krokach 1, 4 i 6 w obu orientacjach (`port-08-tut6.jpg`). Drobiazg: w kroku 2 portretu notatka zasłania dymek mapy „Zamek: brak zapasów desek” (`port-04-tut2.jpg`), a w kroku 4 krajobrazu stoper wozu „0:34”. |
| A3 | Karta „Najgorszy zastój” w trakcie samouczka | **Naprawione** | W krokach 1–5 karta ukryta, pojawia się w kroku 6. |
| A4 | Brak „Następna misja” na liście końcowym | **Naprawione** (po wygranej) | `land-14-end.jpg`: duży przycisk „Następna misja · II. Korek na moście”, 1 dotknięcie do listu misji II (`land-15-m2-letter.jpg`). Po porażce go nie ma, co jest zgodne z zamysłem. |
| A5 | Zimne menu bez kierunku, „Ustawienia” poza ekranem | **Częściowo** | „Zacznij tutaj” jest i „Ustawienia” są widoczne. W portrecie przycisk „Ustawienia” przykrywa jednak wiersz XIII, a „Wolna dolina” leży pod fałdą (`port-01-menu.jpg`). W krajobrazie przykrywa wiersze IV–V lewej kolumny (`land-01-menu.jpg`, audyt: nakładka „Jarmark × Ustawienia”). Menu ma wciąż 14 równorzędnych pozycji. |
| A6 | Gęsta karta zamku w kroku 2 (~45 słów) | **Naprawione** | Zamówienie i tempo są zwinięte w jeden wiersz 48 px na czas samouczka (`port-04-tut2.jpg`). Na ekranie widać łańcuch z 3 ogniw. |
| B1 | Nowy gracz nie kończy misji I przez „oko → Naprawa” | **Częściowo** | „Kup wóz” działa (srebro spada o 30). Krajobraz wygrywa, portret przegrywa o 2 chleby. Przyczyna leży gdzie indziej, zob. N2. |
| B2 | „Naprawa” pod fałdą w krajobrazie | **Naprawione** | `land-12-why3.jpg`: „Kup wóz −30” widać bez przewijania. |
| B3 | Notatka w kroku 5 w poziomie zasłania pasek narzędzi | **Naprawione** | `land-06-tut5.jpg`: notatka wisi nad rzeką, a pasek narzędzi jest wolny. |
| B4 | Po samouczku „Droga” zostaje włączona | **Naprawione** | Narzędzie jest odłożone (`land-09-stall.jpg`, „Droga” nieaktywna). |
| B5 | Przycisk naprawy znika pod palcem | **Rzadko** | 1 na 8 zakupów (portret, przestój #3) nie wszedł. Zanim dotknięcie doszło, przyczyna rozwiązała się sama (wóz się zwolnił), a arkusz przeszedł na „Deski w drodze” (`port-12-why3.jpg` → `port-13-fixed.jpg`). To nie błąd, ale przy ×4 tak bywa. |
| B6 | Obrys „Droga” 1 px poza ekranem | **Naprawione** | `ringOff: false` w obu orientacjach. |

## Nowe ustalenia

**N1. Portret: po samouczku karta zamku zostaje otwarta i zasłania kartę „Najgorszy zastój” oraz pasek narzędzi** (`port-09-stall.jpg`). Krok 6 każe otworzyć kartę zamku, a samouczek kończy się z kartą na wierzchu. Gra zostaje na ×1, a pierwszy przestój jest niewidoczny, dopóki gracz sam nie zamknie arkusza. Audyt: `stall card shown: false`. Gracz nie dostaje polecenia, co dalej. W krajobrazie arkusz jest boczny i karta przestoju zostaje widoczna (`land-09-stall.jpg`).

**N2. Największy złodziej czasu w misji I, „czekanie na odbiór”, nie ma naprawy.** Na obu listach końcowych „Gdzie stracono czas” prowadzą zastoje *czekanie na odbiór*:
- portret: Gospodarstwo 4:12;
- krajobraz: Chata drwala 5:17, Gospodarstwo 4:56.

Arkusz „Dlaczego” pokazuje wtedy „Pełno zboża — odbiór: wóz 2 → Wóz 2 jedzie po ładunek” i nic więcej (`port-10-why1.jpg`). Gracz rozumie to w kilka sekund, ale wniosek brzmi „czekaj”. Tego stanu dotyczyło 3 z 10 otwarć oka w portrecie i 6 z 10 w krajobrazie, a żadne nie dało czynności. W kodzie `WAITING_PICKUP` jest zawsze „minor” i nigdy krytyczny (`src/ui/stallKinds.ts`, `isCritical`). Mimo to wygrywa kartę „Najgorszy zastój” i trafia na list końcowy jako strata nr 1. Przy tym lekarstwo istnieje: więcej wozów. Krajobraz z 4 wozami wygrał, portret z 3 przegrał o 2 chleby, bot z 4 wygrywa w 8,85 min. Gracz dostaje „Kup wóz” tylko przy „wszystkie wozy zajęte” / „pełny magazyn, brak wozu”, czyli później.

**N3. Tekst porażki misji I nie odpowiada na pytanie „dlaczego”.** „Sprawdź, czy oba brzegi mają drogę i czy wozy odbierają towar” (`src/content/letters.ts`) radzi zbudować most, który już stoi (`port-14-end.jpg`). Tabela „Gdzie stracono czas” tuż pod nim jest dobra, ale nie ma czynności „co zrobić następnym razem”.

**N4. Krajobraz: ogniwo „sam budynek” w skróconym łańcuchu ma 26 px wysokości** (`button.link.cf` 328×26, `body.is-short .chain .c-first .link.is-self`, D-111). To przycisk, więc formalnie łamie zasadę ≥ 48 dp. Ten sam budynek jest tytułem arkusza, więc prościej zrobić z niego zwykły wiersz zamiast przycisku. W portrecie podobny przypadek: link „Chata drwala” w karcie wozu ma 74×40 (`min-height: 40px` w `.shared-hint/.thin-hint .linkish`).

**N5. Anomalia do sprawdzenia ręcznie:** w portrecie przy przestojach #6–#8 („Gospodarstwo: pełny magazyn, brak wozu”, pieczęć 6) audyt po dotknięciu oka widział 0 słów na całym ekranie i żadnego przycisku naprawy. W krajobrazie ten sam stan dawał „Kup wóz”. Zrzutu nie ma, bo narzędzie robi tylko 3 pierwsze. Może to być chwilowe przejście arkusza, ale wynik mógł kosztować portret jeden wóz.

## Czy „zrozumiane w < 30 s”?

- Samouczek: 7 dotknięć + 1 przeciągnięcie, ~42 s gry, notatki po 16–22 słowa. Cel spełniony.
- Pętla przestoju: arkusz „Dlaczego” ma 21–53 słowa, przyczyna jest w pierwszej linii, a „Kup wóz” widać bez przewijania w obu orientacjach. Gdy jest naprawa, czynność zajmuje 2 dotknięcia, więc cel spełniony.
- Słabe miejsca:
  - (N1) w portrecie gracz nie widzi pierwszego przestoju;
  - (N2) najczęstszy przestój ma diagnozę bez czynności, więc gracz rozumie, ale nie wie, co zrobić;
  - (N3) po porażce list nie podaje lekarstwa.

## Poprawki (priorytet; żadna nie dotyka `src/sim/`)

1. **„Czekanie na odbiór” z lekarstwem „Kup wóz”, gdy trwa długo** (N2). W `src/ui/panels.ts` funkcja `cureHtml(world, b, chain)` ma dla `WAITING_PICKUP` dawać sekcję „Naprawa” z `buy:<stable>`. Warunki: zastój trwa > ~30 s albo magazyn wyjścia jest pełny („Pełno zboża 8/8”), a przypisany wóz ma ETA dłuższe niż czas zapełnienia. Podpowiedź: „Wóz 2 dojedzie za 0:40, drugi wóz odbierze wcześniej”. Spójnie z tym `isCritical` (`src/ui/stallKinds.ts`) może po tym progu przestać traktować go jako „minor”. Efekt: lekarstwo pojawia się przy pierwszym otwarciu oka po samouczku, a nie po 3–4 przestojach. W portrecie +1 wóz wcześniej to dokładnie brakujące 2 chleby. Dla < 30 s: diagnoza i czynność w tym samym arkuszu.
2. **Koniec samouczka zamyka kartę zamku i wskazuje kartę przestoju** (N1). W `src/ui/tutorial.ts` przy przejściu z kroku 6 na koniec (lub w `host.finish` w `src/ui/app.ts`, obok odkładania narzędzia „Droga”) wywołać zamknięcie arkuszy. Opcjonalnie ostatnia krótka notatka z obrysem oka: „Gdy coś stanie, tu zobaczysz najgorszy zastój”. Efekt: pierwszy przestój jest widoczny od razu w portrecie, a pętla „przestój → Dlaczego → naprawa” zostaje domknięta w samouczku.
3. **List porażki z lekarstwem** (N3). W `buildEndLetter` (`src/ui/menu.ts`) pod „Gdzie stracono czas” dodać jedną linię czynności dla straty nr 1, przez i18n. Przykład: „Gospodarstwo czekało na wóz 4:12 — następnym razem kup wóz wcześniej (Stajnia, −30)”. Tekst misji I w `src/content/letters.ts` nie może sugerować mostu, gdy most stoi. Efekt: porażka uczy w < 30 s zamiast odsyłać do zgadywania.
4. **Menu: „Ustawienia” nie przykrywa wierszy** (A5). W `buildMainMenu` (`src/ui/menu.ts`) i stylach menu dodać dolny `padding` listy równy wysokości przycisku „Ustawienia” (portret: XIII, krajobraz: IV–V). Drobne, ale to pierwszy ekran.
5. **Cele < 48 px** (N4). `body.is-short .chain .c-first .link.is-self` zamienić na element nieinteraktywny (albo `min-height: 48px`), a `.shared-hint/.thin-hint .linkish` podnieść z 40 do 48 px (`src/styles/main.css`).
6. **Narzędzie:** robić zrzut każdego arkusza „Dlaczego” bez naprawy przy pieczęci ≥ 5 i powtórzyć portret, żeby wyjaśnić N5.
