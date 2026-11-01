# Zlecenie 10 — korekta PL i British English

**Repo:** `woogitsugames/marchi`. **Migawka:** `b209db4701bf8da8b6e8d91f6e973fa839187eaf` (1 listopada 2026). **Przeczytane bez modyfikowania:** `src/i18n/pl.ts` (blob `265418393e307cfc4bb8bfb51edf347d2f1462ac`) i `src/i18n/en.ts` (blob `4c26783797f9283e44c7e3ece5133e1f3b25953a`). Przejrzano też dostępne obrazy `docs/shots/ui-*.png`.

**Wynik:** 155 wspólnych kluczy; 41 rekomendacji w tabeli, 24 korekt PL i 37 EN w osobnej łatce `docs/i18n/proposed.patch`. Zachowano klucze, format TypeScript, układ słowników i **zbiory placeholderów w każdym języku**. PL celowo używa niekiedy `{goodGen}` i `{goodAcc}`, podczas gdy EN używa `{good}` — to istniejąca, poprawna różnica między językami.

## Lista korekt

| Klucz | Obecnie PL | Proponowane PL | Obecnie EN | Proponowane EN | Powód |
|---|---|---|---|---|---|
| `building.woodcutter` | Drwal | Chata drwala | Woodcutter | Woodcutter's hut | Budynek, a nie zawód. |
| `status.WORKING` | Pracuje | Produkuje | Working | Producing | Stan budynku, nie człowieka. |
| `status.IDLE` | Czeka bez zajęcia | Bezczynny | Waiting, nothing to do | Idle | Krócej i bez kalki. |
| `status.NO_INPUT.NONE_AVAILABLE` | Brak {goodGen} — nikt jeszcze nie wyrobił | Brak {goodGen} — nie ma jeszcze zapasów | Out of {good}. Nobody has made any yet | No {good} available yet | Obecne „wyrobił” nie pasuje do zboża ani drewna. |
| `status.NO_INPUT.UNREACHABLE` | Brak {goodGen} — jest, ale nie ma dojazdu | Brak dojazdu do zapasów {goodGen} | Out of {good}. There is some, but no road to it | Cannot reach stored {good} | Zamiast sprzecznego „brak — jest”. |
| `status.NO_WAGON.NONE_CAN_REACH` | Żaden wóz nie dojedzie po {goodAcc} | Żaden wóz nie dojedzie po {goodAcc} | No wagon can reach the {good} | No wagon can collect {good} | W angielskim nie „reach the grain”. |
| `status.OUTPUT_FULL.NO_WAGON` | Pełno {goodGen} — brak wozu do odbioru | Pełno {goodGen} — brak wozu do odbioru | Full of {good}. No wagon to collect | Storage full: no wagon to collect {good} | Naturalny komunikat przyczyny. |
| `status.OUTPUT_FULL.NO_DESTINATION` | Pełno {goodGen} — nie ma dokąd wieźć | Pełno {goodGen} — nie ma dokąd wieźć | Full of {good}. Nowhere to take it | Storage full: nowhere to deliver {good} | Bez niezgodnego zaimka „it” przy deskach. |
| `status.WAITING_PICKUP` | Pełno {goodGen} — wóz {wagon} jedzie odebrać | Pełno {goodGen} — wóz {wagon} w drodze | Full of {good}. Wagon {wagon} is coming | Full of {good} — wagon {wagon} on its way | Krótszy dymek z zachowaniem parametrów. |
| `wagon.IDLE` | Stoi w stajni | Stoi w stajni | Standing in the stable | At the stable | Zwięzły stan, bez „standing”. |
| `wagon.TO_PICKUP` | Jedzie po ładunek | Jedzie po ładunek | Going to load | En route to collect cargo | Naturalny opis odbioru towaru. |
| `wagon.TO_DROPOFF` | Wiezie ładunek | Wiezie ładunek | Hauling cargo | Delivering cargo | Rzeczowy brytyjski angielski. |
| `wagon.BRIDGE_JAM` | Czeka przed mostem — jedzie wóz {blocker} | Czeka przed mostem — wóz {blocker} przejeżdża | Waiting at the bridge — wagon {blocker} is crossing | Waiting at the bridge — wagon {blocker} is crossing | Naturalny szyk zdania. |
| `wagon.NO_ROUTE` | Brak drogi do: {target} | Brak drogi do celu: {target} | No road to: {target} | No route to {target} | Bez dwukropka po angielskim „to”; cel w mianowniku. |
| `wagon.dest` | Cel | Cel | Heading to | Destination | Stała etykieta pola. |
| `wagon.eta` | Dojazd | Dojazd | Arrives in | Arrival in | Poprawne znaczenie czasu do dojazdu. |
| `wagon.etaFinish` | Dostawa | Dostawa | Delivered in | Delivery in | „Delivered in” to nieprawidłowy status ETA. |
| `why.stalledFor` | stoi od {time} | Przestój: {time} | stalled for {time} | stalled for {time} | Czas trwania, nie data rozpoczęcia. |
| `tool.road` | Droga | Droga | Track | Road | Droga; bez pomylenia z torowiskiem. |
| `err.TOO_STEEP` | Za stromo: {grade}% (najwyżej {max}%) | Za stromo: {grade}% (maks. {max}%) | Too steep: {grade}% (at most {max}%) | Too steep: {grade}% (max {max}%) | Krótszy komunikat dymka. |
| `err.BLOCKED` | Tu stoi budynek | Tu stoi budynek | A building stands here | A building blocks the way | Naturalny angielski. |
| `err.NO_COINS` | Brak srebra: trzeba {need}, jest {have} | Za mało srebra: potrzeba {need}, masz {have} | Not enough silver: need {need}, have {have} | Not enough silver: need {need}, have {have} | Poprawa składni kosztu i salda. |
| `err.IS_GATE` | To brama budynku | To brama budynku | That is a building gate | This is a building entrance | Naturalny opis przeszkody. |
| `err.WAGON_ON_ROAD` | Na tym odcinku stoi wóz | Na tym odcinku drogi jest wóz | A wagon is standing on this stretch | A wagon is on this stretch of road | Wóz nie musi stać. |
| `err.CANNOT_DEMOLISH` | Tego nie rozbierzemy | Tego nie można rozebrać | This cannot be demolished | This cannot be demolished | Rzeczowy ton zamiast „nie rozbierzemy”. |
| `err.TOO_MANY_WAGONS` | Stajnia nie pomieści więcej wozów | Stajnia nie pomieści więcej wozów | The stable cannot hold more wagons | No room for another wagon in the stable | Naturalna informacja o pojemności. |
| `err.BAD_TARGET` | Tu nie można | Nieprawidłowe miejsce | Not here | Invalid location | Usunięcie urwanego „Tu nie można”. |
| `contract.lost` | Spadł śnieg. Kontrakt przepadł | Spadł pierwszy śnieg. Kontrakt przepadł | The snow came. The contract is lost | The first snow has fallen. Contract failed. | Termin jest związany z pierwszym śniegiem. |
| `contract.again` | Jeszcze raz | Jeszcze raz | Once more | Try again | Powszechna etykieta przycisku. |
| `contract.menu` | Do menu | Do menu | To the menu | Main menu | Krótsza i jednoznaczna etykieta. |
| `hud.rain` | Deszcz — błoto spowalnia wozy na gruncie | Deszcz — wozy zwalniają na drogach gruntowych | Rain — mud slows wagons on tracks | Rain — wagons slow on unpaved roads | Doprecyzowanie podłoża, bez niezręcznego „na gruncie”. |
| `menu.toMenu` | Zapisz i wyjdź do menu | Zapisz i wróć do menu | Save and leave to the menu | Save and return to menu | Naturalniej i krócej. |
| `menu.quality` | Jakość obrazu | Jakość obrazu | Picture quality | Graphics quality | Standardowa etykieta ustawień graficznych. |
| `menu.qualityHint` | Niska oszczędza baterię na starszych telefonach | Niska jakość oszczędza baterię | Low saves battery on older phones | Low graphics quality saves battery | Krócej, bez długiego wtrącenia. |
| `menu.leftHanded` | Narzędzia pod lewą ręką | Układ dla leworęcznych | Tools under the left hand | Left-handed layout | Brak kalki „under the left hand”. |
| `why.makes` | Wyrabia | Produkuje | Makes | Produces | Dla wszystkich budynków: drwalnia, gospodarstwo, młyn, tartak. |
| `why.cycle` | Wypiek w toku | Produkcja w toku | Work in progress | Production in progress | Pasek postępu nie zawsze dotyczy wypieku. |
| `why.ok` | Nic tu nie stoi | Brak przestoju | Nothing is stuck here | No issues here | „Nic tu nie stoi” jest dwuznaczne. |
| `hud.collapse` | Zwiń list do pieczęci | Zwiń list przewozowy | Fold the waybill to its seal | Collapse waybill | Krótsza etykieta dostępności: obecna EN ma 28 znaków. |
| `contract.wonText` | Deski i chleb dotarły do zamku przed śniegiem. | Deski i chleb dotarły do zamku przed śniegiem. | The planks and the bread reached the castle before the snow. | Planks and bread reached the castle before the first snow. | Zwięźlejszy, naturalny EN w karcie wyniku. |
| `contract.lostText` | Do zamku nie dotarło wszystko, o co proszono. | Nie wszystkie zamówione towary dotarły do zamku. | Not everything that was asked for reached the castle. | Not all the requested goods reached the castle. | Poprawna, konkretna konstrukcja. |

## Słowniczek do stałego użycia

| Polski | British English | Zasada |
|---|---|---|
| wóz | wagon | Pojazd konny (nie „cart”, „truck” ani PL „wagon”) |
| spichlerz | granary | Budynek i magazyn; nie „warehouse” w etykiecie budynku |
| srebro | silver | Waluta; bez zamiany na „coins”, „gold” |
| list przewozowy | waybill | HUD i jego zwijanie; nie mylić z kontraktem |
| przestój | stall | Zatrzymanie pracy; odróżniać od bezczynnego „idle” |
| kontrakt | contract | Cel misji i rozliczenie |
| ładunek | cargo | Zawartość wozu w transporcie |
| drewno | logs | Ustalona nazwa towaru w obecnym słowniku |
| deski | planks | Rzeczownik w liczbie mnogiej |
| zboże | grain | Niepoliczalne EN |
| mąka | flour | Niepoliczalne EN |
| chleb | bread | Niepoliczalne EN; w polskim wymagana odmiana przy liczbach |
| droga / gruntowa | road / unpaved road | Odróżniać od drogi brukowanej |
| bruk | cobbles | Narzędzie budowy nawierzchni |
| stajnia | stable | Miejsce postoju wozu |
| pieczęć | seal | Ocena kontraktu, list przewozowy |
| dostawa | delivery | Moment dotarcia towaru |
| odbiór | collection | Moment podjęcia towaru |
| produkcja | production | Proces nie tylko w piekarni |
| most drewniany | wooden bridge | Spójna nazwa mostu |

## Ryzyko przepełnienia

Wymagane progi audytu: **przyciski ≥28 znaków**, **dymki ≥60 znaków**. To wartości surowych szablonów (przed podstawieniem zmiennych); mieszczące się teksty nadal mogą wymagać przełamania w zależności od fontu, szerokości komponentu i liczby `{n}`.

### Przyciski — ≥28 znaków

| Klucz | Język | Znaki | Aktualna wartość |
|---|---|---:|---|
| `hud.collapse` | EN | 28 | Fold the waybill to its seal |

Po zmianie `hud.collapse` EN skraca się z 28 do 16 znaków. To etykieta przycisku dostępności, nawet jeśli zamiast napisu pokazany jest symbol pieczęci.

### Przyciski blisko progu — 20–27 znaków

| Klucz | Język | Znaki | Aktualna wartość |
|---|---|---:|---|
| `menu.contract` | PL | 23 | Kontrakt: chleb i deski |
| `menu.contract` | EN | 26 | Contract: bread and planks |
| `menu.toMenu` | PL | 22 | Zapisz i wyjdź do menu |
| `menu.toMenu` | EN | 26 | Save and leave to the menu |
| `hud.expand` | PL | 22 | Rozwiń list przewozowy |
| `hud.collapse` | PL | 21 | Zwiń list do pieczęci |

### Dymki i komunikaty — ≥60 znaków

| Klucz | Język | Znaki | Aktualna wartość |
|---|---|---:|---|
| — | — | — | Nie znaleziono. |

Brak pewnych przekroczeń w wartościach statycznych. Nie oznacza to braku ryzyka po podstawieniu `{target}`, `{good}`, `{blocker}`, `{grade}`, `{max}`, `{need}` i `{have}`.

### Dymki blisko progu — 42–59 znaków

| Klucz | Język | Znaki szablonu | Aktualna wartość |
|---|---|---:|---|
| `wagon.BRIDGE_JAM` | EN | 51 | Waiting at the bridge — wagon {blocker} is crossing |
| `status.NO_INPUT.UNREACHABLE` | EN | 47 | Out of {good}. There is some, but no road to it |
| `status.WAITING_PICKUP` | PL | 44 | Pełno {goodGen} — wóz {wagon} jedzie odebrać |
| `err.NO_COINS` | EN | 43 | Not enough silver: need {need}, have {have} |

**Dodatkowo:** EN `contract.wonText` ma 60 znaków, ale to **akapit na karcie wyników**, nie dymek. W łatce jest skrócony.

## Przegląd obrazów UI i ograniczenia

Przejrzano **22 z 23** zrzutów `docs/shots/ui-*.png`, obejmujących rozmiary **412×915, 915×412 i 904×1000**. Jedyny nieotwarty obraz `ui-menu-904x1000.png` ma ponad 1 MB i jego zawartość binarna nie została udostępniona przez narzędzie odczytu; pozostałe dwa warianty menu zweryfikowano.

| Zrzuty | Obserwacja | Wniosek |
|---|---|---|
| `ui-why-bakery-412x915.png`, `ui-why-bakery-915x412.png` | „Brak mąki — nikt jeszcze nie wyrobił” brzmi nienaturalnie i zajmuje dwie linie. | Korekta `status.NO_INPUT.NONE_AVAILABLE`, test dla każdego towaru. |
| `ui-wagon-412x915.png`, `ui-wagon-915x412.png` | Widok PL jest czytelny; angielski ma niejasne `Heading to` i `Delivered in`. | Doprecyzowano labelki `wagon.dest` i ETA. |
| `ui-game-3min-412x915.png`, `ui-game-3min-915x412.png` | Dymek o deszczu zawija się na ekranie 412 px. | Proponowany tekst jest bardziej precyzyjny; zmierzyć po zastosowaniu patcha. |
| `ui-road-steep-412x915.png`, `ui-road-steep-915x412.png` | Błąd nachylenia mieści się na typowym ekranie; koszt i typ mostu są składane w osobnym wierszu. | Skrócono oba warianty błędu, zachowując parametry. |
| `ui-road-steep-904x1000.png` | Ostrzeżenie na płaskiej mapie ma niski kontrast do terenu i wygląda jak tekst bez tła. | **Poza zakresem lokalizacji**: poprawić styl/kontrast rendererów. |
| `ui-settings-915x412.png` | **Kolizja paneli:** ustawienia wizualnie nakładają się na menu w tle, teksty przebijają się przez modal. | **Poza zakresem lokalizacji**: naprawić układ i zasłonięcie tła; samo skrócenie fraz nie wystarczy. |
| `ui-settings-412x915.png` | „Tools under the left hand” jest nienaturalne. | `menu.leftHanded` → „Left-handed layout”. |
| `ui-end-412x915.png`, `ui-end-915x412.png`, `ui-end-904x1000.png` | Błąd odmiany liczebników: „30/30 deski”, „20/20 chleb”. | **Poza zakresem patcha**: `src/ui/menu.ts` buduje podpis jako liczba + `goodName(g)`. Należy zastosować „Deski: 30/30”, „Chleb: 20/20” albo osobne formy liczbowe. Nie psuć `good.*` tylko dla wyniku. |
| `ui-menu-412x915.png`, `ui-menu-915x412.png` | PL jest czytelny; EN musi zostać ponownie sprawdzony po korekcie. | Test wizualny po zastosowaniu patcha. |

## Walidacja i sposób użycia

- `proposed.patch` to poprawna łatka tekstowa w formacie unified diff obejmująca **wyłącznie** `src/i18n/pl.ts` i `src/i18n/en.ts`. Raport oraz patch można zmergować od razu bez dotykania dwóch plików będących w edycji.
- Zachowano wszystkie klucze i oryginalne zestawy zmiennych w każdej wartości. Część angielskich wartości ma `{good}`, podczas gdy ich polski odpowiednik ma `{goodGen}` lub `{goodAcc}`; to jest świadome i nie wymaga zmian w `src/ui/format.ts`.
- Po zakończeniu równoległych zmian: `git apply --check docs/i18n/proposed.patch`, następnie `git apply docs/i18n/proposed.patch`. Jeśli kontekst w plikach zmieni się, przenieść tylko zweryfikowane wartości; nie stosować patcha na siłę.
- Po nałożeniu: `npm run build` oraz powtórzyć screenshoty w PL/EN na 412×915, 915×412, 904×1000. Osobno sprawdzić błędy fleksji na ekranie wyniku oraz modal ustawień w poziomie.
- Nie modyfikowano ani nie commitowano `src/i18n/pl.ts` i `src/i18n/en.ts`.
