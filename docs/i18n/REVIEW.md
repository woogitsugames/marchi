# Zlecenie 10 — korekta PL i British English

**Status: przegląd zakończony; łatka do późniejszego zastosowania.** Plików źródłowych `src/i18n/pl.ts` i `src/i18n/en.ts` nie edytowano. W repozytorium dostarczane są wyłącznie ten raport i `proposed.patch`.

## Zakres i wersja źródeł

- Repozytorium: [woogitsugames/marchi](https://github.com/woogitsugames/marchi).
- Migawka: [`249c6813b6d6121b2faf168a988298192b745052`](https://github.com/woogitsugames/marchi/tree/249c6813b6d6121b2faf168a988298192b745052) — 1 listopada 2026; gałąź źródłowa `claude/eager-cori-08wt8e`.
- Przeczytano **164/164 klucze PL i 164/164 klucze EN** (328 wartości), a także miejsca ich użycia w `src/ui` i warunki komunikatów w `src/sim`.
- Obejrzano **27/27 zrzutów `docs/shots/ui-*.png`**: 21 PL i 6 EN; po 9 plików w rozmiarach 412×915, 915×412 i 904×1000. Manifest poniżej opisuje rzeczywistą zawartość, nie tylko nazwy plików.
- Liczba kluczy z korektą: **27**. Zmieniono **20 wartości PL i 20 wartości EN**. Bez zmian pozostawiono 137 par kluczy. Zachowano kolejność, nazwy kluczy, komentarze i parametry interpolacji.
- Bloby wejściowe: PL `9e5e876b3cd451d3c23f2a235d9418146466ed2f`; EN `17504e45000300fdd05acb929537ffde16d884ad`. Wcześniejszy PR #6 został scalony, jego propozycje zastosowano, a do słowników dodano 9 kluczy. Niniejszy raport i łatka bazują już na nowszej migawce; nie ponawiają wdrożonych zmian. Zachowano poprawne warianty Producing, Delivering cargo, Road i Arrival in.
- Obrazy `ui-*.png` pozostały binarnie takie same jak w migawce `899af58cf98097239b6d1be1c10f91e9f3a49f36`; pokazują starsze teksty i menu sprzed M2/M3. Pomiary bieżącego kodu oraz obserwacje historycznych obrazów są poniżej oznaczone osobno.

## Najważniejsze wnioski

1. Komunikaty muszą opisywać stan faktycznie sprawdzany przez symulację: brak **dostępnych** zapasów nie dowodzi braku wcześniejszej produkcji; limit wozów jest globalny; wóz blokujący most może czekać na pierwszeństwo.
2. Poprawiono odmianę i znaczenie nowych komunikatów: Bezczynność pasuje także do stajni, Do odbioru: {n} obsługuje różne ilości, a opisy spowolnienia nie zakładają ładunku w pustym wozie ani błota po ustaniu deszczu.
3. Progi długości są listą do kontroli układu, nie automatycznym błędem. Złożone przyciski menu i łańcucha przekraczają 28 znaków. Istniejący dymek drogi PL ma łącznie 63 znaki w dwóch wierszach i mieści się na trzech zrzutach.
4. Potwierdzono błędne podpisy „30/30 deski” / „20/20 chleb” na karcie wyniku. Ich naprawa wymaga zmiany składania tekstu w UI; globalne nazwy towarów zostają poprawne.
5. Cztery pliki nie pokazują widoku sugerowanego nazwą. Nie potwierdzono wcześniejszych zarzutów kolizji ustawień w poziomie ani braku tła dymka na 904×1000.

## Tabela proponowanych korekt

Tabela i łatka są generowane z tego samego zestawu propozycji. Wiersz może zmieniać tylko jeden język; identyczna wartość w obu kolumnach oznacza brak zmiany w danym języku. Część zmian to świadome doprecyzowanie lub skrócenie poprawnego tekstu, nie błąd gramatyczny.

| Klucz | Obecnie PL | Proponowane PL | Obecnie EN | Proponowane EN | Powód |
| --- | --- | --- | --- | --- | --- |
| `status.IDLE` | Bezczynny | Bezczynność | Idle | Idle | Bezczynny nie zgadza się ze stajnią; rzeczownik Bezczynność działa dla każdego typu budynku i odróżnia IDLE od przestoju. |
| `status.NO_INPUT.NONE_AVAILABLE` | Brak {goodGen} — nie ma jeszcze zapasów | Brak dostępnych zapasów {goodGen} | No {good} available yet | No {good} available | Brak zapasu dostępnego do dostawy nie dowodzi początkowego braku produkcji. Usunięto jeszcze / yet; zapas mógł zostać zużyty lub zarezerwowany. |
| `status.NO_INPUT.UNREACHABLE` | Brak dojazdu do zapasów {goodGen} | Brak dojazdu do zapasów {goodGen} | Cannot reach stored {good} | {good} available — no road access | Jawna przyczyna: towar jest dostępny, lecz nie ma do niego drogi. Odróżnia ten stan od braku wolnego wozu; działa dla mnogich i niepoliczalnych nazw towarów. |
| `status.NO_WAGON.NONE_CAN_REACH` | Żaden wóz nie dojedzie po {goodAcc} | Żaden wolny wóz nie dojedzie po {goodAcc} | No wagon can collect {good} | No free wagon can reach the {good} | Dyspozytor sprawdza dojazd wolnych wozów. Przywrócono konkretną przyczynę braku dojazdu i doprecyzowano wolny / free. |
| `status.WAITING_PICKUP` | Pełno {goodGen} — wóz {wagon} w drodze | Pełno {goodGen} — odbiór: wóz {wagon} | Full of {good} — wagon {wagon} on its way | Full of {good} — collection: wagon {wagon} | Przypisany wóz może już się ładować albo być zablokowany; samo przypisanie odbioru nie gwarantuje jazdy. |
| `status.CONTRACT_DONE` | Kontrakt wypełniony | Kontrakt wykonany | Contract fulfilled | Contract fulfilled | Naturalna kolokacja wykonać kontrakt; identyczny status i nagłówek wyniku. |
| `wagon.LOADING` | Ładuje | Załadunek | Loading | Loading | Rzeczowa nazwa czynności: wóz jest ładowany. |
| `wagon.UNLOADING` | Rozładowuje | Rozładunek | Unloading | Unloading | Rzeczowa nazwa czynności; spójna para z Załadunek. |
| `wagon.BRIDGE_JAM` | Czeka przed mostem — wóz {blocker} przejeżdża | Czeka przy moście na wóz {blocker} | Waiting at the bridge — wagon {blocker} is crossing | Waiting at the bridge for wagon {blocker} | Blocker może przejeżdżać albo czekać z pierwszeństwem po drugiej stronie. Nie należy zapewniać, że już jedzie. |
| `wagon.NO_ROUTE.home` | Brak drogi do stajni | Brak drogi do stajni | No road to the stable | No route to the stable | Spójne route z wagon.NO_ROUTE. Osobno opisano błąd przeciążenia target=-1; zmiana słownika go nie rozwiązuje. |
| `wagon.pace` | Tempo | Prędkość | Pace | Speed | Fizyczna prędkość wozu jest bardziej jednoznaczna niż tempo; w PL odróżnia ją to również od tempa całej symulacji. W EN Speed jest standardową etykietą dla względnej prędkości pojazdu. Pace nie jest błędem gramatycznym. |
| `wagon.slowMud` | błoto po deszczu — {pct}% prędkości; bruk pomoże | błoto — {pct}% normalnej prędkości; bruk pomoże | mud after rain — {pct}% speed; cobbles would help | mud — {pct}% of normal speed; cobbles help | mud zachodzi wyłącznie podczas aktualnego deszczu na gruntowej nawierzchni: raining && surface === dirt. Kod nie modeluje błota utrzymującego się po deszczu, więc po deszczu / after rain jest nieprawdziwe. Dodanie normalnej / of normal wyjaśnia, że {pct} oznacza pozostałą prędkość względem suchej, płaskiej drogi o tej samej nawierzchni, a nie procent utraconej prędkości. Wskazówka o bruku pozostaje prawdziwa również, gdy dodatkowo działa nachylenie. |
| `wagon.slowUphill` | pod górę z ładunkiem — {pct}% prędkości | pod górę — {pct}% normalnej prędkości | uphill with a load — {pct}% speed | uphill — {pct}% of normal speed | UI wybiera ten tekst dla slow.grade > 0.02, bez sprawdzania cargoQty. Także pusty wóz zwalnia pod górę, więc z ładunkiem / with a load trzeba usunąć. Procent opisuje udział normalnej prędkości, nie wielkość spowolnienia. |
| `wagon.slowOther` | {pct}% prędkości | {pct}% normalnej prędkości | {pct}% speed | {pct}% of normal speed | Zachowuje neutralny opis dla innych przyczyn, np. deszczu na bruku lub drewnianym moście, a dopowiada podstawę porównania procentowego. Nie przypisuje wszystkich przypadków błotu ani przewożonemu ładunkowi. |
| `wagon.etaFinish` | Dostawa | Dostawa za | Delivery in | Delivery in | Doprecyzowanie, że wyświetlana wartość to czas pozostały do zakończenia dostawy. |
| `err.BLOCKED` | Tu stoi budynek | Nie można tu budować | A building blocks the way | Cannot build here | Wspólny błąd budowy obejmuje również wodę, istniejącą drogę, bramę i przecięcie narożnika. Nie zawsze oznacza budynek w danym miejscu. |
| `err.NO_COINS` | Za mało srebra: potrzeba {need}, masz {have} | Potrzeba {need} srebra, masz {have} | Not enough silver: need {need}, have {have} | Need {need} silver; have {have} | Krótsza informacja na wąskim ekranie; oba parametry kosztu i posiadanego srebra pozostają jawne. |
| `err.IS_GATE` | To brama budynku | To brama budynku | This is a building entrance | This is a building gate | Stały termin gate, zgodny z status.NO_ROAD i polską bramą; obecne entrance jest zrozumiałe, lecz niespójne terminologicznie. |
| `err.TOO_MANY_WAGONS` | Stajnia nie pomieści więcej wozów | Osiągnięto limit wozów | No room for another wagon in the stable | Wagon limit reached | Sprawdzany jest globalny MAX_WAGONS, nie pojemność konkretnej stajni. Nowy tekst nie sugeruje, że druga stajnia rozwiąże problem. |
| `err.BAD_TARGET` | Nieprawidłowe miejsce | Wybierz stajnię | Invalid location | Choose a stable | Ten błąd dotyczy zakupu wozu w obiekcie, który nie istnieje albo nie jest stajnią. Nie jest błędem wyboru terenu. |
| `contract.won` | Kontrakt wypełniony | Kontrakt wykonany | Contract fulfilled | Contract fulfilled | Naturalna kolokacja i spójność z status.CONTRACT_DONE. |
| `contract.again` | Jeszcze raz | Jeszcze raz | Try again | Play again | Etykieta działa po zwycięstwie i po porażce; Try again silniej sugeruje wcześniejsze niepowodzenie. |
| `menu.qualityHint` | Niska jakość oszczędza baterię | Niska jakość oszczędza baterię | Low graphics quality saves battery | Low quality uses less battery | Krótszy, naturalny opis korzyści z niskiej jakości. Doprecyzowanie stylistyczne, nie błąd gramatyczny oryginału. |
| `why.reserved` | {n} czeka na wóz | Do odbioru: {n} | {n} waiting for a wagon | {n} waiting for a wagon | Etykieta z liczbą po dwukropku działa dla każdego towaru i każdej liczby; usuwa konstrukcję 2 czeka. |
| `why.ok` | Brak przestoju | Brak przestoju | No issues here | Nothing is stalled here | No issues here obiecuje więcej niż brak przestoju. Zachowano termin stalled; klucz obecnie nieużywany w UI. |
| `hud.collapse` | Zwiń list przewozowy | Zwiń list przewozowy | Collapse waybill | Fold the waybill | Naturalna para Fold / Unfold the waybill, spójna z metaforą pergaminu. To aria-label, nie widoczny napis. |
| `hud.clearHint` | Dwa palce: ukryj lub pokaż wszystko | Stuknij dwoma palcami, by ukryć lub pokazać interfejs | Two fingers: hide or show everything | Tap with two fingers to hide or show the interface | Podaje konkretny gest stuknięcia i właściwy zakres: ukrycie interfejsu. Dwa palce służą też do innych gestów, a mapa pozostaje widoczna. |

## Słowniczek do stałego użycia

| Polski | British English | Zasada użycia |
|---|---|---|
| wóz; wozy; wozów | wagon; wagons | Pojazd transportowy. Nie mieszać z PL „wagon” ani z EN „cart” w nazwie tego samego obiektu. |
| spichlerz | granary | Ustalona nazwa budynku `warehouse`, również wtedy, gdy przechowuje inne towary niż zboże. Identyfikator kodu pozostaje bez zmian. |
| srebro | silver | Waluta. Nie zastępować jej monetami ani złotem; `coins` to wyłącznie istniejący identyfikator techniczny. |
| list przewozowy | waybill | Dokument w HUD. Kontrakt to zobowiązanie, list przewozowy to jego widoczna reprezentacja. |
| przestój | stall; stalled | Wstrzymanie pracy wskutek konkretnej przeszkody. Nie używać zamiennie z bezczynnością. |
| bezczynność | idle | Brak aktywnej pracy; `IDLE` nie jest automatycznie przestojem w `isStall()`. |
| kontrakt | contract | Cel dostawy i jej rozliczenie. |
| kontrakt wykonany | contract fulfilled | Jednolite zakończenie w statusie budynku i na ekranie wyniku. |
| ładunek | cargo | Towar przewożony wozem. |
| drewno; drewna; drewno | logs | Nazwa zasobu oraz formy PL: mianownik, dopełniacz, biernik. EN `logs` jest liczbą mnogą. |
| deski; desek; deski | planks | EN liczba mnoga; unikać odwołań do niej przez „it”. |
| zboże; zboża; zboże | grain | EN rzeczownik niepoliczalny. |
| mąka; mąki; mąkę | flour | EN rzeczownik niepoliczalny; PL po „po” wymaga „mąkę”. |
| chleb; chleba; chleb | bread | EN rzeczownik niepoliczalny. Przy potrzebie podawania sztuk używać jawnej jednostki lub konstrukcji „Chleb: 20/20”. |
| chata drwala | woodcutter's hut | Nazwa budynku, nie osoby. |
| tartak | sawmill | Zakład przerabiający drewno na deski. |
| gospodarstwo | farmstead | Istniejąca nazwa budynku produkującego zboże. |
| młyn wodny | watermill | Nie skracać do innego typu młyna w słowniku. |
| piekarnia | bakery | Budynek, którego cykl rzeczywiście jest wypiekiem; wspólna etykieta postępu używa jednak słowa „produkcja”. |
| stajnia | stable | Baza wozów; nie sugerować indywidualnej pojemności stajni przy globalnym limicie pojazdów. |
| zamek | castle | Odbiorca zamówienia. |
| droga / droga gruntowa | road / track; unpaved road | `Road` jest obecną etykietą narzędzia; track i unpaved road doprecyzowują nawierzchnię w opisach. |
| bruk | cobbles | Etykieta nawierzchni/narzędzia. |
| most drewniany | wooden bridge | Zachować rozróżnienie materiału. |
| most kamienny | stone bridge | Zachować rozróżnienie materiału. |
| brama | gate | Stałe określenie punktu dojazdu do budynku; nie zmieniać bez potrzeby na „entrance”. |
| pole; pola; pól | cell; cells | Jednostka siatki mapy; formy PL wybiera `cellsWord()`. |
| dostawa | delivery | Dotarcie i zakończenie wyładunku towaru. |
| odbiór; do odbioru | collection; awaiting collection | Podjęcie towaru u dostawcy. |
| załadunek / rozładunek | loading / unloading | Rozróżniać od jazdy po ładunek i jazdy z ładunkiem. |
| zapasy | stock | Towar w budynku; „dostępne” wyklucza już zarezerwowaną ilość. |
| produkcja | production | Wspólny termin dla cyklu dowolnego budynku z recepturą. |
| pieczęć | seal | Ocena wykonania kontraktu i element listu przewozowego. |

## Odmiana, parametry i zasady redakcyjne

- Zachować wszystkie klucze i nazwy parametrów. `src/ui/format.ts` przekazuje równocześnie `{good}`, `{goodGen}` i `{goodAcc}`; inny zestaw używany w PL i EN jest zamierzony. Walidacja porównuje parametry **przed i po zmianie w obrębie danego języka**, a nie wymaga identycznych parametrów obu języków.
- PL po „brak”, „zapasy” i „przewóz” wymaga form zgodnych z konstrukcją zdania; po „jedzie po” używać biernika. Przykłady: „Brak dostępnych zapasów **mąki**”, „Żaden wolny wóz nie dojedzie po **mąkę**”, „Brak dojazdu do zapasów **desek**”.
- Dla liczników preferować etykietę i liczbę: „Do odbioru: 2”, „Deski: 30/30”, „Chleb: 20/20”. Nie zmieniać globalnego `good.planks` na „desek” tylko po to, by naprawić jeden ekran.
- W EN unikać zaimków zależnych od liczby w komunikatach obsługujących jednocześnie `logs`/`planks` i `grain`/`flour`/`bread`. Powtórzenie `{good}` bywa krótsze i bezpieczniejsze od rozbudowanego zdania.
- Etykiety i krótkie statusy bez końcowej kropki; pytania z pytajnikiem; pełne zdania na kartach wyniku z kropką. Duże litery zgodnie z istniejącym układem (sentence case), bez wymuszania Title Case we wszystkich przyciskach.
- Zachować sens parametrów czasowych: `why.stalledFor` to **czas trwania** przestoju; `wagon.eta` i `wagon.etaFinish` to **pozostały czas**, nie godzina zegarowa.
- Zachować metaforę pergaminu w parze EN „Fold the waybill” / „Unfold the waybill” oraz PL „Zwiń list przewozowy” / „Rozwiń list przewozowy”. `hud.collapse` i `hud.expand` są nazwami dostępności przycisków ikonowych.
- Nie odwracać zaakceptowanych zmian wyłącznie dlatego, że poprzedni wariant też był poprawny. Bieżące `Producing`, `Delivering cargo`, `Road` i `Arrival in` pozostają; nazwy trybu „Wolna dolina” / `Free valley` oraz pięć nowych tekstów misji również pozostają.
- `wagon.slow*` podaje procent normalnej prędkości na tej samej nawierzchni przy suchej, płaskiej drodze. **55% prędkości oznacza o 45% wolniej**, nie „o 55% wolniej”. Nie tłumaczyć tego jako procent maksymalnej prędkości na wszystkich nawierzchniach.

## Problemy wymagające zmian poza słownikami

1. **Odmiana towarów na karcie wyniku i karcie wozu.** `buildEndLetter()` w `src/ui/menu.ts` dokleja `goodName(g)` do ułamka, dając widoczne na zrzutach „30/30 deski” i „20/20 chleb”. `wagonSheet()` w `src/ui/panels.ts` analogicznie łączy `× {qty}` z formą podstawową. Zalecenie do osobnej zmiany UI: „Deski: 30/30”, „Chleb: 20/20” i np. „Mąka: ×6”; ewentualnie osobny formatter ilości. Bez zmiany wspólnych nazw towarów.
2. **Dwa różne przypadki `NO_ROUTE` ze `target = -1`.** `src/sim/wagons.ts` może wytworzyć ten stan zarówno przy braku drogi do stajni, jak i przy utracie odbiorcy przewożonego ładunku. `wagonStatusText()` w `src/ui/format.ts` wybiera w obu przypadkach `wagon.NO_ROUTE.home`, co może błędnie wskazywać stajnię. Zachować poprawne tłumaczenie `.home`; w osobnej zmianie rozróżnić przyczynę w stanie/formatterze.
3. **Etykieta ETA podczas obsługi ładunku.** `wagonEta()` w `src/sim/diagnose.ts` dolicza `busyTicks` do `toDest`, także gdy wóz już stoi u dostawcy lub odbiorcy. Wtedy pole „Dojazd” / „Arrival in” pokazuje pozostały czas obsługi. Niedawna zmiana brzmienia etykiety nie naprawia tej rozbieżności; osobno skorygować wyliczenie lub ukrywać/przełączać etykietę w stanach `LOADING` i `UNLOADING`. Łatka nie zmienia `wagon.eta`.
4. **Braki pokrycia zrzutami.** Pliki nazwane „settings” nie we wszystkich rozmiarach pokazują panel ustawień; analogicznie część „end-lost” nie pokazuje listu porażki. Pełna macierz widoków i języków wymaga ponownego wykonania zrzutów po wdrożeniu łatki. Szczegóły w tabeli inwentaryzacyjnej.

Żaden z tych punktów nie został ukryty przez zmianę znaczenia istniejącego klucza. Łatka pozostaje ograniczona do wartości tekstów w `pl.ts` i `en.ts`.

## Lista tekstów do kontroli szerokości

Progi zlecenia: **przyciski ≥28 znaków, dymki ≥60 znaków**. Liczenie obejmuje punkty kodowe Unicode, spacje i interpunkcję, bez HTML oraz wcięć kodu. Dla szablonu liczone są również klamry i nazwy parametrów; osobno pokazano przykłady po interpolacji. Nie jest to pomiar szerokości w pikselach.

W elementach złożonych podajemy sumę faktycznie widocznych fragmentów, bez sztucznej spacji/LF pomiędzy elementami DOM. W dymku dwuwierszowym dodanie jednego LF zwiększa sumę o 1. Osiągnięcie progu nie oznacza ucięcia: część komponentów od początku ma wiele wierszy.

### Przyciski menu ≥28 znaków po złożeniu

Poniższe teksty pozostają bez zmian: są poprawne językowo, a ich wielowierszowy układ trzeba sprawdzić w aktualnym UI. Istniejące obrazy nie pokazują nowego menu M1/M2/M3. Warianty „Kontynuuj” są jawnymi przykładami z kodu; na obrazach nie ma zapisanej gry.

| Język | Klucze | Tekst / fragmenty | Znaki fragmentów | Suma |
| --- | --- | --- | --- | --- |
| PL | `menu.m1`, `menu.contractSub` | I. Chleb i deski / Chleb i deski dla zamku przed zimą | 16 + 34 | 50 |
| PL | `menu.m2`, `menu.m2Sub` | II. Korek na moście / Jeden wąski most, ruch w obie strony | 19 + 36 | 55 |
| PL | `menu.m3`, `menu.m3Sub` | III. Deszczowa jesień / Ulewa zamienia trakty w błoto | 21 + 29 | 50 |
| PL | `menu.sandbox`, `menu.sandboxSub` | Wolna dolina / Bez terminu, więcej srebra | 12 + 26 | 38 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m1` | Kontynuuj / I. Chleb i deski, 1:30 | 9 + 22 | 31 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m1` | Kontynuuj / I. Chleb i deski, 10:00 | 9 + 23 | 32 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m1` | Kontynuuj / I. Chleb i deski, 12:00 | 9 + 23 | 32 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m2` | Kontynuuj / II. Korek na moście, 1:30 | 9 + 25 | 34 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m2` | Kontynuuj / II. Korek na moście, 10:00 | 9 + 26 | 35 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m2` | Kontynuuj / II. Korek na moście, 12:00 | 9 + 26 | 35 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m3` | Kontynuuj / III. Deszczowa jesień, 1:30 | 9 + 27 | 36 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m3` | Kontynuuj / III. Deszczowa jesień, 10:00 | 9 + 28 | 37 |
| PL | `menu.continue`, `menu.continueSub`, `menu.m3` | Kontynuuj / III. Deszczowa jesień, 11:00 | 9 + 28 | 37 |
| PL | `menu.continue`, `menu.continueSub`, `menu.sandbox` | Kontynuuj / Wolna dolina, 12:00 | 9 + 19 | 28 |
| PL | `menu.continue`, `menu.continueSub`, `menu.sandbox` | Kontynuuj / Wolna dolina, 1:23:45 | 9 + 21 | 30 |
| EN | `menu.m1`, `menu.contractSub` | I. Bread and planks / Bread and planks for the castle before winter | 19 + 45 | 64 |
| EN | `menu.m2`, `menu.m2Sub` | II. Jam on the bridge / One narrow bridge, traffic both ways | 21 + 36 | 57 |
| EN | `menu.m3`, `menu.m3Sub` | III. A rainy autumn / The downpour turns tracks to mud | 19 + 32 | 51 |
| EN | `menu.sandbox`, `menu.sandboxSub` | Free valley / No deadline, more silver | 11 + 24 | 35 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m1` | Continue / I. Bread and planks, 1:30 | 8 + 25 | 33 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m1` | Continue / I. Bread and planks, 10:00 | 8 + 26 | 34 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m1` | Continue / I. Bread and planks, 12:00 | 8 + 26 | 34 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m2` | Continue / II. Jam on the bridge, 1:30 | 8 + 27 | 35 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m2` | Continue / II. Jam on the bridge, 10:00 | 8 + 28 | 36 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m2` | Continue / II. Jam on the bridge, 12:00 | 8 + 28 | 36 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m3` | Continue / III. A rainy autumn, 1:30 | 8 + 25 | 33 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m3` | Continue / III. A rainy autumn, 10:00 | 8 + 26 | 34 |
| EN | `menu.continue`, `menu.continueSub`, `menu.m3` | Continue / III. A rainy autumn, 11:00 | 8 + 26 | 34 |
| EN | `menu.continue`, `menu.continueSub`, `menu.sandbox` | Continue / Free valley, 1:23:45 | 8 + 20 | 28 |

Żaden zwykły przycisk akcji z aktualnego UI nie ma ≥28 znaków widocznego napisu, również po tej łatce: dotyczy menu pauzy, listu wyniku, segmentów ustawień, narzędzi, kupna wozu z ceną oraz śledzenia. `menu.contract` jest obecnie nieużywany. Menu główne korzysta z `menu.m1/m2/m3` i podtytułów; `menu.contractItem` pozostał nagłówkiem menu pauzy.

### Przyciski łańcucha przyczyn ≥28 znaków

`chainHtml()` w `src/ui/panels.ts` tworzy prawdziwe elementy `button`, także dla bieżącego, wyłączonego elementu. Treść obejmuje nazwę budynku/wozu, opcjonalne „przyczyna” / „the cause” oraz opis statusu. Poniżej wszystkie rodziny, w których sprawdzone warianty osiągają próg przed lub po zmianie; zakres dotyczy **całego przycisku**, nie jednego wiersza.

Pomiary odtwarzają 208 zestawów fragmentów zgodnych z rendererem i aktualnymi recepturami. Warianty liczbowe używają ID wozu 12 i blokującego wozu 14; sprawdzono nazwy celów wszystkich ośmiu typów budynków. Nie jest to deklaracja uruchomienia wszystkich stanów ani górny limit dla dowolnie długiego identyfikatora. `MAX_WAGONS` nie ogranicza długości identyfikatora obiektu.

| Klucz statusu | PL obecnie | PL propozycja | EN obecnie | EN propozycja |
| --- | --- | --- | --- | --- |
| `status.NO_ROAD` | 33–40 | 33–40 | 34–44 | 34–44 |
| `status.NO_INPUT.NONE_AVAILABLE` | 40–54 | 34–48 | 28–40 | 24–36 |
| `status.NO_INPUT.UNREACHABLE` | 34–48 | 34–48 | 31–43 | 38–50 |
| `status.WAITING_DELIVERY` | 28–33 | 28–33 | 33–36 | 33–36 |
| `status.NO_WAGON.ALL_BUSY` | 49–54 | 49–54 | 38–41 | 38–41 |
| `status.NO_WAGON.NONE_CAN_REACH` | 45–50 | 51–56 | 41–44 | 48–51 |
| `status.OUTPUT_FULL.NO_WAGON` | 49–56 | 49–56 | 54–63 | 54–63 |
| `status.OUTPUT_FULL.NO_DESTINATION` | 38–54 | 38–54 | 44–62 | 44–62 |
| `status.WAITING_PICKUP` | 35–51 | 34–50 | 41–59 | 42–60 |
| `status.STORAGE_FULL` | 33 | 33 | 31 | 31 |
| `wagon.TO_PICKUP` | 23 | 23 | 33 | 33 |
| `wagon.RETURNING` | 21 | 21 | 31 | 31 |
| `wagon.BRIDGE_JAM` | 44–53 | 33–42 | 52–61 | 42–51 |
| `wagon.NO_ROUTE` | 31–47 | 31–47 | 26–45 | 26–45 |
| `wagon.NO_ROUTE.home` | 35 | 35 | 38 | 39 |

Na wszystkich trzech historycznych zrzutach piekarni PL występują przyciski (częściowo inne niż bieżące wartości słownika):

- „Piekarnia” + „Brak mąki — nikt jeszcze nie wyrobił”: **9 + 36 = 45** znaków. Opis jest w jednym fizycznym wierszu, nazwa nad nim.
- „Młyn wodny” + „przyczyna” + „Brak wolnego wozu do przewozu zboża”: **10 + 9 + 35 = 54** znaki.

Żaden z tych historycznych napisów nie jest ucięty. Nazwy „Chata drwala” / „Woodcutter's hut” są już w aktualnych źródłach; trzeba sprawdzić ich aktualne renderowanie wraz z całym łańcuchem. Nie usuwać ważnej przyczyny przestoju wyłącznie dla zmniejszenia liczby znaków.

### Etykiety dostępności i inne teksty — prawidłowa klasyfikacja

| Klucz / język | Obecnie | Znaki | Propozycja | Znaki | Rzeczywiste użycie |
| --- | --- | --- | --- | --- | --- |
| `hud.collapse` EN | Collapse waybill | 16 | Fold the waybill | 16 | `aria-label` przycisku pieczęci; tekst nie jest widoczny |
| `contract.wonText` EN | Planks and bread reached the castle before the first snow. | 58 | Planks and bread reached the castle before the first snow. | 58 | Akapit listu zwycięstwa; nie przycisk ani dymek |

W bieżącej migawce nie ma `aria-label` ani `title` osiągającego 28 znaków. Dawne wartości `hud.collapse` = 28 i `contract.wonText` = 60 dotyczyły wcześniejszego tekstu, nie stanu z tabeli powyżej.

`menu.leftHanded`, `menu.qualityHint` i `hud.clearHint` są etykietą/podpowiedziami ustawień, a `why.cycle` jest atrybutem `title` paska postępu. Nowe `wagon.slowMud`, `wagon.slowUphill` i `wagon.slowOther` to treść `dd/span` na karcie wozu, nie przyciski ani dymki. Żaden pojedynczy obecny ani proponowany `title` nie osiąga 60 znaków.

### Dymki ≥60 znaków po złożeniu

Mapowe znaczniki przestoju w `src/ui/markers.ts` pokazują **ikony**, nie teksty `status.*`. Długie opisy statusów trafiają do kart i przycisków opisanych wyżej. Żaden pojedynczy szablon komunikatu toast/notice ani pojedynczy wiersz w poniższych przykładach nie osiąga 60 znaków.

Dwuwierszowy dymek szkicowania drogi może przekroczyć próg **łącznie**. Poniżej warianty, które mają ≥60 znaków przed lub po zmianie. Użyte dane są jawne: nachylenie 15%, limit 14%, 3 pola mostu, koszt 22 dla drewna / 61 dla kamienia i saldo 0 w przykładzie braku srebra. Lista obejmuje obie nawierzchnie. Przekroczenie nie jest dowodem błędu układu.

| Język | Klucze | Obecne dwa wiersze | Znaki obecnie | Proponowane dwa wiersze | Znaki po zmianie | Dowód wizualny |
| --- | --- | --- | --- | --- | --- | --- |
| PL | `err.TOO_STEEP` + `road.bridge` | Za stromo: 15% (maks. 14%) / 22 srebra · most drewniany: 3 pola | 26 + 34 = 60 | Za stromo: 15% (maks. 14%) / 22 srebra · most drewniany: 3 pola | 26 + 34 = 60 | Przykład z kodu |
| PL | `err.NO_COINS` + `road.bridge` | Za mało srebra: potrzeba 22, masz 0 / 22 srebra · most drewniany: 3 pola | 35 + 34 = 69 | Potrzeba 22 srebra, masz 0 / 22 srebra · most drewniany: 3 pola | 26 + 34 = 60 | Przykład z kodu |
| PL | `err.NO_COINS` + `road.bridgeStone` | Za mało srebra: potrzeba 61, masz 0 / 61 srebra · most kamienny: 3 pola | 35 + 33 = 68 | Potrzeba 61 srebra, masz 0 / 61 srebra · most kamienny: 3 pola | 26 + 33 = 59 | Przykład z kodu |
| EN | `err.NOT_CONTIGUOUS` + `road.bridge` | The road must be continuous / 22 silver · wooden bridge: 3 cells | 27 + 34 = 61 | The road must be continuous / 22 silver · wooden bridge: 3 cells | 27 + 34 = 61 | Przykład z kodu |
| EN | `err.NO_COINS` + `road.bridge` | Not enough silver: need 22, have 0 / 22 silver · wooden bridge: 3 cells | 34 + 34 = 68 | Need 22 silver; have 0 / 22 silver · wooden bridge: 3 cells | 22 + 34 = 56 | Przykład z kodu |
| EN | `err.NOT_CONTIGUOUS` + `road.bridgeStone` | The road must be continuous / 61 silver · stone bridge: 3 cells | 27 + 33 = 60 | The road must be continuous / 61 silver · stone bridge: 3 cells | 27 + 33 = 60 | Przykład z kodu |
| EN | `err.NO_COINS` + `road.bridgeStone` | Not enough silver: need 61, have 0 / 61 silver · stone bridge: 3 cells | 34 + 33 = 67 | Need 61 silver; have 0 / 61 silver · stone bridge: 3 cells | 22 + 33 = 55 | Przykład z kodu |

Historyczny dymek PL błędu nachylenia na obrazach ma 29 + 34 = **63** znaki (64 z jednym LF); oba wiersze mieszczą się na jasnym tle z ramką. W bieżących źródłach pierwszy wiersz został już skrócony: PL 26 + 34 = **60**, EN 24 + 34 = **58**. Ta łatka nie ponawia skrócenia `err.TOO_STEEP`. Bieżącego dymka PL ani EN nie przedstawiono na nowych zrzutach. Wariant `NOT_CONTIGUOUS` jest ścieżką walidatora; zwykłe przeciąganie ciągłej drogi nie musi pozwalać go uzyskać.

Przy dłuższych kwotach, czasie lub ID trzeba ponownie mierzyć tekst po interpolacji. Te przykłady nie są górną granicą dla dowolnego stanu zapisu.

## Przegląd 27 zrzutów UI

Poniżej komplet istniejących obrazów. Pokazują **starszy UI**: nie przedstawiają już wszystkich obecnych tekstów ani nowego menu misji. Zachowano je jako materiał do analizy; nie stanowią dowodu wyglądu bieżącej ani proponowanej wersji. 21 obrazów jest po polsku, 6 po angielsku. Nie potwierdzono ucięcia napisów wskutek ich długości; zawijanie i celowe zasłanianie tła przez okno końcowe nie są same w sobie kolizją tekstów.

| Plik | Język obrazu | Faktycznie widoczna treść i ocena |
|---|---|---|
| [ui-end-412x915.png](../shots/ui-end-412x915.png) | PL | PL; list zwycięstwa, tytuł w dwóch wierszach, cały opis i oba przyciski widoczne. Widoczne „30/30 deski” oraz „20/20 chleb” wymagają przebudowy podpisu liczb/towarów w menu.ts, a nie zmiany globalnego good.*. |
| [ui-end-904x1000.png](../shots/ui-end-904x1000.png) | PL | PL; list zwycięstwa, pełny tytuł w jednym wierszu. Te same podpisy „30/30 deski”, „20/20 chleb”. Bez obcięcia. |
| [ui-end-915x412.png](../shots/ui-end-915x412.png) | PL | PL; list zwycięstwa w całości. Zakrywa fragment listu przewozowego w tle jako okno wyniku; jego własne napisy nie kolidują. Te same podpisy towarów do korekty. |
| [ui-end-lost-412x915.png](../shots/ui-end-lost-412x915.png) | EN | EN; rzeczywiście list porażki z „The snow came. The contract is lost”. Tytuł i akapit zawijają się do dwóch wierszy; tekst i przyciski nie są ucięte. |
| [ui-end-lost-904x1000.png](../shots/ui-end-lost-904x1000.png) | EN | EN; nie ma listu porażki. Widok gry i „0:00 left”, zaznaczone tempo ×1; nie można na tym obrazie ocenić układu porażki. |
| [ui-end-lost-915x412.png](../shots/ui-end-lost-915x412.png) | EN | EN; nie ma listu porażki. Widok gry i „0:00 left”, tempo ×1; nie można na tym obrazie ocenić układu porażki. |
| [ui-game-3min-412x915.png](../shots/ui-game-3min-412x915.png) | PL | PL; deszczowy komunikat „Deszcz — błoto spowalnia wozy na gruncie” zajmuje trzy wiersze; cały tekst widoczny. „Na gruncie” jest mało precyzyjnym określeniem rodzaju drogi. |
| [ui-game-3min-904x1000.png](../shots/ui-game-3min-904x1000.png) | PL | PL; ten sam komunikat deszczu w dwóch wierszach, bez ucięcia/kolizji. |
| [ui-game-3min-915x412.png](../shots/ui-game-3min-915x412.png) | PL | PL; ten sam komunikat deszczu w dwóch wierszach, bez ucięcia/kolizji z bocznym HUD. |
| [ui-hud-start-412x915.png](../shots/ui-hud-start-412x915.png) | PL | List przewozowy, HUD i dolne narzędzia PL. Bez widocznego ucięcia/kolizji. |
| [ui-hud-start-904x1000.png](../shots/ui-hud-start-904x1000.png) | PL | List przewozowy i dolny HUD PL. Bez widocznego ucięcia/kolizji. |
| [ui-hud-start-915x412.png](../shots/ui-hud-start-915x412.png) | PL | List przewozowy i boczny HUD PL. Narzędzia są ikonowe w tym układzie; brak podpisów nie jest obcięciem. |
| [ui-menu-412x915.png](../shots/ui-menu-412x915.png) | PL | Menu główne PL. Wszystkie napisy mieszczą się; opis kontraktu w jednym wierszu. Bez widocznego ucięcia i kolizji. |
| [ui-menu-904x1000.png](../shots/ui-menu-904x1000.png) | PL | Menu główne PL, pełny obraz odczytany. Ten sam poprawny układ napisów; wszystkie napisy widoczne. |
| [ui-menu-915x412.png](../shots/ui-menu-915x412.png) | PL | Menu główne PL. Cały panel i wszystkie napisy mieszczą się na wysokości 412 px. |
| [ui-road-steep-412x915.png](../shots/ui-road-steep-412x915.png) | PL | PL; „Za stromo: 15% (najwyżej 14%)” nad „22 srebra · most drewniany: 3 pola”. Oba wiersze mieszczą się na jasnym tle w ramce. |
| [ui-road-steep-904x1000.png](../shots/ui-road-steep-904x1000.png) | PL | PL; ten sam pełny dymek na wyraźnym jasnym tle, z ramką. Bez ucięcia tekstu. |
| [ui-road-steep-915x412.png](../shots/ui-road-steep-915x412.png) | PL | PL; ten sam pełny dymek i boczna etykieta „Droga”, bez widocznego ucięcia/kolizji. |
| [ui-settings-412x915.png](../shots/ui-settings-412x915.png) | EN | EN; widać wyłącznie menu główne (Contract / Free valley / Settings), bez otwartego panelu ustawień. Opis kontraktu zawija się na dwa wiersze i mieści się. |
| [ui-settings-904x1000.png](../shots/ui-settings-904x1000.png) | EN | EN; wyłącznie menu główne, bez otwartego panelu ustawień. Nie jest dowodem poprawnego renderowania ustawień przy tej szerokości. |
| [ui-settings-915x412.png](../shots/ui-settings-915x412.png) | EN | EN; faktycznie otwarty panel Settings po prawej i menu po lewej. Między nimi jest wolna przestrzeń, nie nakładają się. Widoczne m.in. „Tools under the left hand” i „Low saves battery on older phones” — uwagi stylistyczne EN można odnieść do tego obrazu. Cała treść i przyciski mieszczą się. |
| [ui-wagon-412x915.png](../shots/ui-wagon-412x915.png) | PL | PL; Wóz 9, Jedzie po ładunek, Ładunek/pusty, Cel/Młyn wodny, Dojazd/0:49, Dostawa/1:17, mąka → Piekarnia i Śledź wóz są czytelne. W dole półprzezroczystej karty lekko przebija HUD pod spodem; przyczyny (np. faza animacji) nie ustalono. Bez ucięcia tekstu karty. |
| [ui-wagon-904x1000.png](../shots/ui-wagon-904x1000.png) | PL | PL; pełna karta wozu po prawej, bez widocznego ucięcia/kolizji. Brak angielskich etykiet na obrazie. |
| [ui-wagon-915x412.png](../shots/ui-wagon-915x412.png) | PL | PL; pełna karta po lewej, bez widocznego ucięcia/kolizji. Brak angielskich etykiet na obrazie. |
| [ui-why-bakery-412x915.png](../shots/ui-why-bakery-412x915.png) | PL | PL; faktycznie „Brak mąki — nikt jeszcze nie wyrobił” i „stoi od 1:30”. Status ma jeden fizyczny wiersz, nazwa Piekarnia jest osobno nad nim. Żaden opis nie jest ucięty. |
| [ui-why-bakery-904x1000.png](../shots/ui-why-bakery-904x1000.png) | PL | PL; te same sformułowania w karcie po prawej. Cały łańcuch, oba opisy i zapasy widoczne; bez ucięcia. |
| [ui-why-bakery-915x412.png](../shots/ui-why-bakery-915x412.png) | PL | PL; karta po lewej. Status w jednym wierszu. Obie sekcje zapasów widoczne; dolna krawędź karty dochodzi do brzegu ekranu, tekst nie jest ucięty. |


**Ograniczenia pokrycia:** obrazy EN nie pokazują karty wozu, łańcucha piekarni ani dymka drogi. Dwa pliki `ui-settings-*` zawierają tylko menu, a dwa `ui-end-lost-*` tylko grę z zerowym czasem. Nie ustalano przyczyny brakującego panelu; nie jest to dowód błędu tłumaczenia. Na `ui-wagon-412x915.png` lekko przebija dolny HUD pod kartą; nie stwierdzono ucięcia tekstu ani trwałości tego zjawiska.

**Sprostowanie poprzedniej wersji raportu:** komplet obejmuje 27, nie 23 obrazy; wszystkie zostały otwarte. Zarzuty kolizji panelu ustawień przy 915×412, braku tła dymka przy 904×1000 i dwuwierszowego opisu braku mąki nie potwierdzają się. Liczby 28 dla `hud.collapse` EN i 60 dla `contract.wonText` EN były poprawne, lecz wymagały właściwej klasyfikacji: odpowiednio `aria-label` i akapit.

## Walidacja i późniejsze zastosowanie

Wykonano weryfikację techniczną bez edycji źródeł:

- `git apply --check docs/i18n/proposed.patch` dla migawki źródłowej — poprawna aplikowalność; sprawdzono też odwracalność na osobnej kopii z proponowanymi wartościami.
- `git diff --check` dla zmian w kopii — brak błędów białych znaków.
- Parsowanie i import obu proponowanych plików TypeScript w Node 24.22.1 — poprawne, w tym escapowanie apostrofu w `Woodcutter\'s hut`.
- Porównanie wszystkich 164 kluczy, kolejności, typów wartości i krotności placeholderów w każdym języku — bez utraty lub dodania kluczy/parametrów. Sprawdzono także interpolację wszystkich pięciu towarów, nazw ośmiu budynków i przykładowych liczników/ID/czasów/procentów.
- Zgodność wartości tabeli z obiektami słowników odczytanymi z kopii po zmianach; łatka obejmuje wyłącznie `src/i18n/pl.ts` i `src/i18n/en.ts`.
- Pliki źródłowe po weryfikacji mają te same identyfikatory blobów co na początku. PR zmienia wyłącznie `docs/i18n/REVIEW.md` i `docs/i18n/proposed.patch`.

Nie uruchamiano pełnego buildu gry ani nowych testów wizualnych zmienionych tekstów; samo ładowanie TS nie jest pełnym `tsc`. To raport i odłożona łatka, zgodnie z ograniczeniem tylko do odczytu.

### Po zakończeniu równoległych prac nad UI

1. Na aktualnej gałęzi sprawdzić kontekst łatki:

   ```bash
   git apply --check docs/i18n/proposed.patch
   ```

2. Gdy kontrola jest poprawna i prace nad UI zakończone, zastosować:

   ```bash
   git apply docs/i18n/proposed.patch
   npm run typecheck
   npm run build
   ```

3. Jeśli kontekst uległ zmianie, przenieść propozycje według kluczy z tabeli i ponownie sprawdzić parametry; nie nadpisywać całych słowników starszą kopią.
4. Wykonać nowe zrzuty **PL i EN** dla 412×915, 915×412 i 904×1000: menu z kontynuacją, otwarte ustawienia, karta wozu, łańcuch przyczyn, deszcz, dymek drogi, zwycięstwo i rzeczywista porażka. Sprawdzić także długie ID/kwoty oraz pięć zasobów.
5. Osobno wdrożyć poprawki formatterów wymienione wyżej; ta łatka nie zmienia logiki liczebników, ETA ani rozróżnienia przyczyn `NO_ROUTE`.

## Podstawa ustaleń

- Teksty: [`pl.ts`](../../src/i18n/pl.ts), [`en.ts`](../../src/i18n/en.ts), interpolacja [`src/i18n/index.ts`](../../src/i18n/index.ts).
- Użycie, odmiana i układ: [`format.ts`](../../src/ui/format.ts), [`menu.ts`](../../src/ui/menu.ts), [`panels.ts`](../../src/ui/panels.ts), [`hud.ts`](../../src/ui/hud.ts), [`roadTool.ts`](../../src/ui/roadTool.ts), [`markers.ts`](../../src/ui/markers.ts).
- Znaczenie komunikatów: [`logistics.ts`](../../src/sim/logistics.ts), [`commands.ts`](../../src/sim/commands.ts), [`wagons.ts`](../../src/sim/wagons.ts), [`diagnose.ts`](../../src/sim/diagnose.ts).
- Konwencja produktu: [`UI_STYLE.md`](../UI_STYLE.md) oraz zrzuty wskazane w pełnym manifeście.
