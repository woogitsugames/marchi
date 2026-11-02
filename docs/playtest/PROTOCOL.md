# Playtest MARCHIA v2 — diagnoza w < 30 s, onboarding i nowe tryby

**Status:** protokół v2 do przeprowadzenia przez właściciela; **nie jest raportem z badań**. Nowe sceny są propozycjami badań, nie wynikami pomiarów.  
**Badani:** 5–8 osób na kohortę, Android, **APK debug**. **Czas:** 25 min na dotychczasowy blok diagnostyczny A; moduły v2 realizuj w osobnym bloku B (ok. 25–35 min) i opcjonalnym teście urządzeń składanych (10–15 min). Nie przedstawiaj sumy modułów jako 25-minutowej sesji.  
**Cel główny:** czy osoba bez pomocy prowadzącego poprawnie nazywa **rzeczywistą przyczynę** zastoju w mniej niż 30 sekund od pytania? Sprawdzamy osobno, czy potrafi otworzyć „Dlaczego stoi?”, przejść łańcuch przyczyn i zaproponować adekwatne działanie.

Podstawa implementacji (gałąź `claude/eager-cori-08wt8e`): `src/sim/missions.ts`, `src/sim/missions-proposed.ts`, `src/sim/missions-s2.ts`, `src/sim/types.ts`, `src/sim/town.ts`, `src/ui/tutorial.ts`, `src/ui/panels.ts`, `src/ui/menu.ts`, `src/ui/buildTool.ts`, `src/ui/marketSheet.ts`, `src/ui/layout.ts`, `src/platform/save.ts`, `src/ui/app.ts` i narzędzia botów. **Źródłem prawdy jest kod oraz zweryfikowany stan w APK, nie starszy opis projektu; nie zakładaj, że hipotetyczne parametry/fixtury zostały wdrożone.**

## 1. Rekrutacja, zgoda i organizacja

| Segment | Minimum | Kryterium |
| --- | ---: | --- |
| Strategie/logistyka | 2 | Grają co najmniej raz w miesiącu w strategie lub gry ekonomiczne |
| Casual mobile | 2 | Grają na telefonie, lecz rzadko w strategie |
| Niegrający | 1–2 | Nie grają regularnie lub wcale |
| Dodatkowe osoby | Do łącznego limitu 8 | W pierwszej kolejności uzupełnij mniej reprezentowany segment |

Nie zapraszaj osób, które widziały wcześniej te misje, projektowały interfejs lub czytały scenariusze. Nadaj losowy kod `P01`–`P08`; w wynikach nie zapisuj imion, kont, telefonów ani innych danych identyfikujących. Używaj tego samego APK/commita, ustawienia języka PL i podobnej jasności ekranu. Odnotuj model telefonu i wersję Androida; jeśli korzystasz z różnych urządzeń, **nie mieszaj wyników urządzeń bez adnotacji**.

**Tekst zgody, przeczytany przed sesją:**

> „Badamy grę, nie Ciebie. Sesja trwa około 25 minut. Możesz odmówić odpowiedzi lub przerwać ją w dowolnej chwili. Zapiszę anonimowy kod, czasy, liczbę dotknięć i krótkie uwagi; nie zapisuję Twoich danych osobowych. Nagranie ekranu/dźwięku wykonam tylko za Twoją osobną zgodą. Czy zgadzasz się na taki test?”

Zanotuj `consent=yes`; gdy brak zgody, nie rozpoczynaj sesji i nie twórz wierszy z wynikami. Nagranie jest **opcjonalne**, osobna zgoda wymagana także na dźwięk/wypowiedzi. Przed sesją ustal termin usunięcia surowych notatek/nagrań (proponowane 30 dni po analizie); opublikuj tylko agregaty bez cytatów identyfikujących osobę.

**Rozkład bloku A (25 minut, scenariusze S1–S6):**
- **0:00–2:30:** zgoda, jedno neutralne objaśnienie sterowania mapą (przesuwanie/powiększanie), bez nauki diagnozy;
- **2:30–20:30:** 6 scenariuszy × maks. 3 min (reset ~45 s, diagnoza do 60 s, omówienie i ewentualna akcja ~75 s);
- **20:30–23:30:** 6 ocen w skali + 3 pytania otwarte;
- **23:30–25:00:** uwagi i zakończenie.

Ustal kolejność przed testem, żeby ograniczyć efekt nauki: dla osób nieparzystych `S1,S3,S4,S2,S5,S6`, dla parzystych `S3,S1,S2,S4,S6,S5`. Scenariusze i nazwy stanów **są wyłącznie dla prowadzącego** — nie pokazuj tabeli uczestnikowi.

**Bloki v2:** B1 (T1/T2 i S7–S9, do 25 min) oraz B2 (V1–V4, do 10 min); F1–F3 tylko na odpowiednim sprzęcie, osobno 10–15 min. Zrób przerwę po bloku A. Aby ocenić **pierwsze spotkanie** z samouczkiem, T1 wykonują osoby, które nie widziały jeszcze gry; po wykonaniu S1–S6 ten warunek nie jest spełniony. W praktyce przygotuj odrębną kohortę `onboarding` albo oznacz `prior_training=1` i raportuj takie próby oddzielnie. W B1 naprzemiennie stosuj kolejność `S7,S8,S9` i `S9,S7,S8`, nie zmieniając preflightów. Warianty sprzętowe zbieraj tylko u uczestników z dostępem do danego Fold/Flip; nie imputuj brakujących prób.


## 2. Przygotowanie APK i uruchamianie stanu

1. Na stanowisku prowadzącego: `npm ci`, następnie `npm run apk` (wymaga JDK 21 i Android SDK; zob. `tools/build-apk.sh`); APK debug również powstaje w `android/app/build/outputs/apk/debug/app-debug.apk`.
2. Zainstaluj na urządzeniu: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. Wyłącz powiadomienia/rozmowy, zapewnij stabilną orientację i naładowaną baterię.
3. **Parametry URL są obsługiwane w `src/ui/app.ts`, ale APK nie udostępnia pola adresu ani udokumentowanego deep linku.** Przy debugowym WebView spróbuj `chrome://inspect/#devices` (telefon z włączonym debugowaniem USB i zezwoleniem na inspekcję WebView). W konsoli właściwej karty aplikacji:
   ```js
   location.replace(location.pathname + '?play=m1&ff=90&speed=0');
   ```
   Użyj odpowiedniego URL z tabeli poniżej. **Nie zakładaj**, że `adb shell am start ... ?play=` działa: brak takiej ścieżki w kodzie. Jeżeli WebView nie daje się zdalnie inspekcjonować, przygotuj debugowy ekran wyboru fixtur albo wariant APK z ustalonym adresem startowym **przed rekrutacją**. Scenariusze bez możliwości przygotowania nie są „zaliczone”.
4. Po wczytaniu upewnij się w konsoli, że `window.__marchia?.ready === true` oraz `__marchia.app.world.state.mission.id` odpowiada misji. Przed oddaniem telefonu zamknij panel diagnostyczny na komputerze i nie zostawiaj otwartego arkusza „Dlaczego stoi?”.
5. Każdy przypadek przeładuj **od zera**; nie kontynuuj zapisu z poprzedniego scenariusza. Po przygotowaniu wykonaj kontrolę stanu (`preflight` poniżej), a czas zacznij mierzyć dopiero po przekazaniu telefonu.

**Faktyczne parametry z `src/ui/app.ts` (nie zamieniać ich znaczeń):**

| Parametr | Stan faktyczny / ograniczenie |
| --- | --- |
| `play=m1|m2|m3|m4|m5|m6|sandbox` | Obsługiwane klucze w `isMissionKey` z `src/ui/menu.ts`; start nowej gry w danym trybie, **nie** wczytanie zapisu |
| `tut=1` | Wymusza samouczek **tylko w m1** także przy starcie debugowym; `?play=m1` bez `tut=1` wyłącza samouczek w tym trybie. W normalnym menu samouczek zależy od zapisanej preferencji gracza |
| `ff=<s>` | Fast-forward w **sekundach symulacji**, limit 3600; tylko do momentu wyniku misji, nie gwarantuje określonego statusu. Przetestuj stan po odczycie, bez podawania ujemnych/nieprawidłowych wartości |
| `speed=0|1|2|4` | Prędkość (0 = pauza); kod nie waliduje innych liczb, więc ich nie podawaj |
| `bot=1` | Uruchamia **plan z m1** (most `bridgeA`, `x=41`, i zakup 4 wozów), nawet gdy wybrano inną misję; **stosować tylko w m1**, nigdy w m2/m3 ani w przypadku braku mostu |
| `open=<buildingType>` | Otwiera **pierwszy budynek danego typu**, np. `castle`, `bakery`, `warehouse`; **nie przyjmuje ID** |
| `wagon=jam|closed` | Preferuje odpowiednio pierwszy `BRIDGE_JAM` albo `BRIDGE_CLOSED`, a jeśli brak — **pierwszy wóz nie-IDLE**; to nie jest asercja statusu ani wybór po ID |
| `wagon=<inna_wartość>` | Otwiera pierwszy wóz nie-IDLE; **nie przyjmuje ID** |
| `tool=road|cobble|demolish|build` | Wybiera narzędzie; przy `tool=build` parametr `pick=<buildingType>` wstępnie wybiera typ (wyłącznie dla prowadzącego) |
| `slot=valley1|valley2|valley3` | W połączeniu z `play=sandbox` wybiera docelowy zapis nowej doliny; **może nadpisać testowy slot** przy automatycznym zapisie |
| `market=1` | W debugowym starcie otwiera panel targu, jeżeli dany świat ma targ; tylko do kontroli przed testem, nie do właściwego zadania |

`open` i `wagon` używaj **wyłącznie do wstępnej kontroli wizualnej**: otwarty panel zdradza ścieżkę rozwiązania i unieważnia pomiar samodzielnego znalezienia „Dlaczego stoi?”. Aby wykonać próbę z panelem, przeładuj przypadek bez tych parametrów. `ff` nie gwarantuje żądanego **stanu semantycznego** — zawsze weryfikuj status, nie samą liczbę sekund.

**Szybki odczyt stanu w konsoli (bez zmian gry):**
```js
const s = window.__marchia.app.world.state;
console.table(s.buildings.map(b => ({ id:b.id, type:b.type, status:b.status.k, cause:b.status.cause ?? '', stalled:b.stalledTicks })));
console.table(s.wagons.map(w => ({ id:w.id, status:w.status.k, job:w.job?.phase ?? '', from:w.job?.from ?? '', to:w.job?.to ?? '' })));
```
**Brak spełnionego `preflight` = nie pokazuj scenariusza.** Zmień `ff`/powtórz przygotowanie lub oznacz `invalid_setup=1`; nie licz takiej próby do wyników poznawczych.

## 3. Sześć scenariuszy (misje I–III)

Każde zadanie zaczyna się **jednakowym, niepodpowiadającym pytaniem**: „Co tutaj nie działa tak, jak oczekujesz? Jaka jest przyczyna i skąd to wiesz? Co zrobił(a)byś dalej?”. Uczestnik **nie słyszy** tytułu sytuacji ani jej poprawnej diagnozy. Najpierw testujesz **rozpoznanie przyczyny**, a nie zdolność do ukończenia misji.

### S1 — Nie ma przeprawy przez rzekę (misja I; obecne URL)

- **Start:** `?play=m1&ff=90&speed=0`. W m1 nie ma mostu na starcie; sieć północna i południowa są rozdzielone. Nie używaj `bot=1`.
- **Preflight:** na zamku wciąż brakuje desek; produkcja na północy ma już deski albo surowiec, a przez wodę nie ma odcinka drogi. Jeżeli przy `90 s` obserwujesz wyłącznie rozruch produkcji (`NO_INPUT`/`NONE_AVAILABLE`), przygotuj od nowa np. `ff=120` — nie testuj innego zjawiska jako braku mostu.
- **Poprawna przyczyna:** brak przejezdnego połączenia przez rzekę uniemożliwia dowóz desek, choć łańcuch po północnej stronie może pracować; nie wystarczy samo „brakuje desek”.
- **Co mierzyć:** czas do tej przyczyny, dotknięcia, otwarcie „Dlaczego stoi?”, przejście od zamku do dostawcy (jeśli łańcuch istnieje), wskazanie brakującej przeprawy.
- **Sukces:** trafna diagnoza **<30 s**, bez podpowiedzi; działanie wtórne: proponuje budowę mostu/spięcie sieci.

### S2 — Jedyny most usunięty **w trakcie dostawy** (misja II; przygotowanie ręczne)

- **Start:** `?play=m2&ff=70&speed=0`. Misja II ma **jedną** przeprawę po kolumnie `x=51`, od `y=30` do `42`, oraz aktywne przewozy w obie strony.
- **Preflight przed cięciem:** co najmniej jeden wóz ma pracę (`job !== null`), która wymaga tej przeprawy; nie wystarczy przerwać pustą drogę przed uruchomieniem logistyki.
- **Przygotowanie:** włącz „Rozbiórka” i usuń **jeden nieobsadzony przez wóz fragment mostu** (nie bramę budynku). Odczekaj 1–2 sekundy symulacji, zatrzymaj grę i sprawdź, czy to rzeczywiście blokuje trasę. Jeśli ręczne wskazanie fragmentu na telefonie jest za mało precyzyjne, dozwolony jest tylko następujący **moderatorski** wariant przez istniejącą kolejkę komend (to nie jest nowy parametr URL):
  ```js
  const a = window.__marchia.app, w = a.world, W = w.terrain.w;
  const cells = Array.from({length:13}, (_,i) => (30+i)*W+51);
  const emptyBridge = cells.find(c => w.terrain.water[c] === 1 &&
    w.state.roads[c] === 1 && w.state.wagons.every(v => v.at !== c && v.next !== c));
  if (emptyBridge === undefined) throw Error('Brak pustej komórki mostu; ustaw inny ff');
  a.loop.enqueue({t:'demolish',cell:emptyBridge});
  a.loop.flushCommands();
  if (w.state.roads[emptyBridge] !== 0) throw Error('Rozbiórka nie powiodła się');
  for (let i = 0; i < 20; i++) a.loop.tickOnce(); // 2 s symulacji
  ```
  `loop` to obecnie pole TypeScript `private`, lecz dostępne w debugowym JS; nie jest to stabilne publiczne API. Przed badaniem sprawdź to na docelowym APK.
- **Preflight po cięciu:** potwierdź brak przeprawy i **co najmniej jeden** `NO_ROUTE` wozu albo `NO_INPUT` z `cause=UNREACHABLE`; jeśli nie, powtórz przy innym `ff`. `speed=0` ma pozostać ustawione przed oddaniem urządzenia.
- **Poprawna przyczyna:** trasa przewożącego wozu/dostawy została przecięta przez rozebrany most; nie „wóz się zepsuł” i nie „za mało wozów”.
- **Co mierzyć:** czas, dotknięcia, karta wozu, `NO_ROUTE`, przejście łańcucha do odbiorcy, znalezienie przerwy na mapie.
- **Sukces:** poprawna diagnoza **<30 s**; wtórnie wskazuje odbudowę mostu. **Nie** wymagaj od gracza wykonania kosztownej naprawy.

### S3 — Wszystkie wozy zajęte (misja II; zależne od statusu)

- **Start kandydujący:** `?play=m2&ff=90&speed=0` (ew. 60/120/150 s); bez `bot=1`.
- **Preflight:** przynajmniej jeden potrzebujący surowca budynek ma dokładnie `status.k=NO_WAGON` i `status.cause=ALL_BUSY`, a przewozy faktycznie są aktywne. Sam fakt, że na ekranie jadą wozy, **nie wystarcza**. Gdy warunek się nie pojawia, przypadek nie jest przygotowany — patrz propozycja `fixture=all-busy`.
- **Poprawna przyczyna:** produkt/dostawca jest osiągalny, ale nie ma wolnego wozu do podjęcia kolejnego zadania; to **nie** brak surowca.
- **Co mierzyć:** czas, otwarcie „Dlaczego stoi?”, odnalezienie `NO_WAGON` i `ALL_BUSY`, przejście łańcucha, dotknięcia, wybór działania.
- **Sukces:** diagnoza **<30 s**; wtórnie rozważa dokupienie wozu lub odciążenie floty (zakup możliwy przy odpowiedniej liczbie monet).

### S4 — Korek na drewnianym moście (misja II; obecne URL)

- **Start kandydujący:** `?play=m2&ff=60&speed=0` (sprawdź też 45/90 s). Zaczyna się z 7 wozami i jednym drewnianym mostem przy `x=51`. Bot m2 obserwuje `BRIDGE_JAM` w toku symulacji, ale konkretny stan przy danym `ff` zawsze sprawdzaj.
- **Preflight:** przynajmniej jeden wóz ma **rzeczywisty** `status.k=BRIDGE_JAM`; `?wagon=jam` bez tego testu może otworzyć zwykły wóz (fallback). Warto także sprawdzić, czy w panelu widać łańcuch do blokującego wozu.
- **Poprawna przyczyna:** jednopasmowy drewniany most ogranicza przepustowość / wóz czeka na przejazd z drugiej strony; nie brak połączenia.
- **Co mierzyć:** czas, dotknięcia, karta wozu, otwarcie przyczyny, kliknięcie blokującego wozu, wskazanie wąskiego gardła.
- **Sukces:** diagnoza **<30 s**; wtórnie propozycja przeprawy alternatywnej albo modernizacji mostu do kamiennego.

### S5 — Deszcz i błoto spowalniają przewóz (misja III; **osobna metryka**)

- **Start:** `?play=m3&ff=35&speed=1`. W m3 deszcz jest zaplanowany od **20 s do 700 s** symulacji; długa droga gruntowa biegnie wzdłuż `y=40`. Tu gracz powinien widzieć **ruch**, zatem celowo nie stosuj pauzy; start zegara przy przekazaniu telefonu.
- **Preflight:** trwa opad (`state.rain` obejmuje bieżący tick) i przynajmniej jeden wóz porusza się po gruncie. Karta takiego wozu może pokazywać spowolnienie przez błoto (`wagonSlowdown` w `src/sim/diagnose.ts`).
- **Poprawna przyczyna:** deszcz zamienia drogę gruntową w błoto i **zmniejsza prędkość** przewozu; bruk ogranicza stratę.
- **Co mierzyć:** czas do poprawnego rozpoznania spowolnienia, dotknięcia, otwarcie wozu, przeczytanie pozycji „tempo”, proponowana zmiana nawierzchni.
- **Sukces:** diagnoza **<30 s**. **Uwaga:** w sim nie istnieje `MUD_SLOW` jako `WagonStatus`; to spowolnienie, **nie przestój**. Raportuj S5 osobno, nie wliczaj do głównego wskaźnika „co stoi”.

### S6 — Pełny spichlerz (misja I; debug-fixtura operatora)

- **Start:** `?play=m1&speed=0`. W m1 istnieje `warehouse`, pojemność **60** (`BUILDINGS.warehouse.storeCap`); w m2/m3 nie ma magazynu startowego. Obecne URL **nie mają** przełącznika „pełny magazyn”.
- **Przygotowanie przez prowadzącego** w konsoli debugowego WebView, na świeżej m1 (bez `ff`), zanim tester zobaczy telefon:
  ```js
  const a = window.__marchia.app, s = a.world.state;
  const wh = s.buildings.find(b => b.type === 'warehouse');
  if (!wh || wh.stock.grain !== 0 || wh.incoming.grain !== 0) throw Error('Nieświeży stan');
  wh.stock.grain = 60;
  s.ledger.produced.grain += 60; // wyrównanie księgi dla ręcznie dodanego towaru
  a.loop.tickOnce(); // przeliczenie statusów (speed nadal 0)
  if (wh.status.k !== 'STORAGE_FULL') throw Error('Magazyn nie jest pełny; przerwij próbę');
  ```
  To **sztuczna fixtura poznawcza**, nie dowód, że normalna rozgrywka naturalnie zapełnia magazyn. Nie modyfikuj poziomu przez `save` i nie przenoś takiego stanu do innych zadań.
- **Preflight:** karta magazynu pokazuje `60/60`, `STORAGE_FULL`; budynek można znaleźć na mapie. Jeżeli przestanie być pełny po wznowieniu czasu, przygotuj od nowa i pozostań na pauzie.
- **Poprawna przyczyna:** brak miejsca w magazynie na dalszy odbiór towarów; nie brak woźnicy ani brak towaru.
- **Co mierzyć:** czas, dotknięcia, odnalezienie magazynu/karty „Dlaczego stoi?”, odczyt `60/60`, poprawna sugestia zwolnienia miejsca.
- **Sukces:** diagnoza **<30 s**; wtórnie wskazuje konieczność opróżnienia/zwiększenia miejsca. **Nie wymagaj postawienia nowego magazynu w m1**: narzędzie budowy nie jest tam udostępnione. Wyjątkiem w misjach jest m6, gdzie `buildable: ['warehouse']` pozwala postawić spichlerz.

### Propozycja brakujących, deterministycznych narzędzi debugowych — **NIEZAIMPLEMENTOWANE**

W osobnym zadaniu (nie w tym PR z dokumentacją) dodać wyłącznie w buildach debugowych, bez przechodzenia do zapisu produkcyjnego, z walidacją statusów po utworzeniu świata:
- `?fixture=bridge-cut-in-transit`: m2 z aktywnym zadaniem przewozu po przecięciu mostu; wymuszone `NO_ROUTE`;
- `?fixture=all-busy`: m2 z osiągalnym towarem i `NO_WAGON/ALL_BUSY`;
- `?fixture=bridge-jam`: m2 z rzeczywistym `BRIDGE_JAM` (nie przypadkowym aktywnym wozem);
- `?fixture=warehouse-full`: m1, `STORAGE_FULL`, rzeczywisty stan pojemności i poprawne wartości księgi.

Rozważyć osobne `openId=<buildingId>`, `wagonId=<id>` zamiast zmieniać działanie istniejących `open`/`wagon`; nie używać ich w głównym pomiarze. Każda fixtura powinna mieć test inwariantów, seeda i wersję. **Bez fixtury lub pomyślnego przygotowania ręcznego S2/S3/S4/S6 nie mogą być ocenione na siłę**; zapisz nieudaną próbę przygotowania w notatkach, a nie jako błąd gracza.

## 3A. Rozszerzenie diagnostyczne: misje IV–VI (S7–S9)

**Cel:** sprawdzić, czy gracz rozpoznaje **nową przyczynę**, a nie tylko objaw; dla S7/S9 mierz `correct=1 AND time_s<30` według reguł S1–S6. Dla S8 osobno mierz poprawne odczytanie transzy i przyczynę zapełnienia bufora, **tylko gdy zweryfikowana fixtura rzeczywiście ją pokazuje**. W nowych misjach nie stosuj `bot=1` ani `tut=1`; `ff` jest kandydatem, a nie obietnicą określonego statusu. Jeśli zależność nie wystąpi, zmień `ff`/przygotuj nową próbę albo wpisz `invalid_setup=1`.

### S7 — Kra zamyka drewnianą przeprawę (misja IV)

- **URL kandydacki:** `?play=m4&ff=200&speed=0` (sprawdź również 185/240 s). Dla prowadzącego wolno dodać `wagon=closed` i przeładować na właściwe URL bez tej podpowiedzi.
- **Preflight:** `mission.id === 'm4'`; `state.ice[0]` obejmuje `state.tick` — zamknięcie trwa w przedziale **[03:00, 08:00)** symulacji (180–480 s); przynajmniej jeden wóz ma `status.k === 'BRIDGE_CLOSED'` i wskazany odcinek drewnianej przeprawy rzeczywiście istnieje. Jeśli nie wystąpił taki status, nie zamieniaj go na `BRIDGE_JAM` lub `NO_ROUTE`.
- **Pytanie:** wspólne z sekcji 3; nie używaj w nim słowa „kra”.
- **Poprawna przyczyna:** lód blokuje **wjazd** na drewniany most do odwilży, a droga nie jest rozebrana. **Działanie wtórne:** poczekać na odwilż, wcześniej zgromadzić zapas lub zapewnić kamienną przeprawę/objazd.
- **Wynik:** `time_s` (do 60), `correct`, `opened_wagon`, `followed_chain`, `action_correct`; opcjonalnie liczba osób, które odróżniły `BRIDGE_CLOSED` od korka. Nie wymagaj wygranej misji.

### S8 — Kolejne listy kontraktu i pełny bufor (misja V)

- **URL kandydacki:** `?play=m5&ff=120&speed=0`; dla innego etapu sprawdź osobno `ff=180`, `240` lub `360`, nie przekraczając terminów w ciemno.
- **Fakty z konfiguracji:** trzy transze: **6 desek + 6 chlebów do 03:00**, **18 chlebów do 05:30**, **36 desek do 11:00**. To zamówienia **dla kolejnej transzy**, a nie trzy niezależne sumy całego kontraktu. Spóźnienie na wcześniejszy list kosztuje pieczęć, lecz nie kończy od razu misji.
- **Preflight A (czytanie listu):** `mission.contract.tranches.length === 3`, karta/list przewozowy wyświetla aktualną transzę i właściwy termin. Wpisz w notatkach numer bieżącej transzy oraz `doneTick`/`missed` każdego listu.
- **Preflight B (diagnoza):** tartak ma faktyczne `OUTPUT_FULL`, a w łańcuchu może pojawić się odcięty od sieci spichlerz obok tartaku (`NO_ROAD`). Nie wpisuj `correct=0` za brak takiego stanu — zapisz `invalid_setup=1` i ponów ustawienie.
- **Zadanie:** „Powiedz, co trzeba dostarczyć teraz, do kiedy i co blokuje dalszą pracę zakładu”. Nie czytaj tytułu sceny.
- **Sukces:** `tranche_read_correct=1`, gdy gracz podaje produkt, ilość i termin **bieżącej** transzy oraz rozumie, że kolejny list zmienia popyt; `correct=1` dla przyczyny `OUTPUT_FULL`, jeżeli preflight B jest spełniony. **Działanie wtórne:** połączenie niepodłączonego spichlerza drogą i/lub zwiększenie dostępnej floty. Nie utożsamiaj rozumienia kolejnych listów z rozwiązaniem wszystkich dostaw.
- **Pomiar:** osobny `task_time_s` do odczytania transzy (maks. 120 s) i `time_s` do zdiagnozowania rzeczywistego `OUTPUT_FULL` (maks. 60 s); licz oba czasy od osobnych, neutralnych pytań.

### S9 — Mały spichlerz blokuje odpływ towaru (misja VI)

- **URL kandydacki:** `?play=m6&ff=180&speed=0` (ewentualnie 120/240/300 s; wybierz tylko stan pozytywnie zweryfikowany).
- **Fakty z kodu:** mały spichlerz koło pól ma `capOverride=12` (nie 20 ani 60). Duży magazyn przy tartaku ma standardowe **60** miejsc, lecz początkowo jest oddzielony od drogi. Misja VI **pozwala budować warehouse**; nie przenoś na nią zakazu budowania z S6/m1. Kontrakt: 24 chleby do 06:00, następnie 60 desek do 11:00.
- **Preflight:** `mission.id === 'm6'`; zlokalizuj magazyn o `capOverride === 12`; sprawdź jego zajętość łącznie z przychodzącymi rezerwacjami i faktyczny `STORAGE_FULL`. Do diagnozy łańcucha tartak → spichlerz wymagaj dodatkowo `OUTPUT_FULL` u tartaku oraz odpowiedniego `blockedBy`, jeżeli ten wątek jest przedmiotem pomiaru.
- **Poprawna przyczyna:** mały spichlerz nie ma wolnego miejsca; nadwyżki zboża konkurują o pojemność, co może zablokować odbiór kolejnych towarów. Samo „za mało wozów” jest błędne.
- **Działanie wtórne:** połączyć większy spichlerz z siecią lub postawić nowy magazyn (`buildable`); odnotuj, czy osoba **wie, dlaczego** to pomoże, bez wymogu ukończenia kontraktu.
- **Wynik:** `time_s`, `correct`, `opened_why`, `followed_chain`, `action_correct`; osobna adnotacja, czy gracz porównał pojemności **12 vs 60**. Nie wymuszaj `STORAGE_FULL` ręcznym nadpisaniem zapisu.

**Konsolowy preflight S7–S9** (wyłącznie prowadzący, aktualny stan odczytywany bez modyfikacji):

```js
const s = window.__marchia.app.world.state;
console.log({ mission: s.mission.id, seconds: s.tick / 10, ice: s.ice, tranches: s.mission.contract?.tranches });
console.table(s.buildings.map(b => ({
  id: b.id, type: b.type, status: b.status.k, cause: b.status.cause ?? '',
  blockedBy: b.status.blockedBy ?? -1, cap: b.capOverride,
  stock: Object.values(b.stock).reduce((a, x) => a + x, 0),
  incoming: Object.values(b.incoming).reduce((a, x) => a + x, 0),
})));
console.table(s.wagons.map(w => ({ id: w.id, status: w.status.k, until: w.status.until ?? -1 })));
```

## 3B. Pierwsze uruchomienie misji I — list kasztelana i automatyczna naprawa

Te zadania są **inne niż S1**: tutorial celowo prowadzi gracza, dlatego wyniku osoby szkolonej nie wolno łączyć z niezależnym benchmarkiem diagnozy. Samouczek w `src/ui/tutorial.ts` ma maksymalnie **6 notatek**, przycisk `Pomiń`, limit **110 s aktywnego czasu**; przejścia mogą pomijać kroki, gdy stan łańcucha się zmieni. Automatyczne zakończenie po limicie nie świadczy o zrozumieniu instrukcji. Przycisk proponowanej naprawy jest renderowany **warunkowo** w `src/ui/panels.ts` (`data-act="fix:<id>"`), o ile wykryto brakujące połączenie i istnieje propozycja drogi; przy braku monet może być nieaktywny. Samouczek **nie jest** sześciokrokową demonstracją tego przycisku — dlatego testujemy go osobno.

### T1 — Czy nowy gracz rozumie list i wskazówki?

- **Start:** świeży uczestnik, świeża m1: `?play=m1&tut=1&speed=1`; **bez** `ff`, `bot`, `open`, `tool`. Jeśli nie da się ustawić URL w APK, rozpocznij nową m1 z menu na świeżym profilu/testowym urządzeniu i sprawdź wyświetlenie notatki; zapisane preferencje mogą ukryć samouczek.
- **Preflight:** widoczny nagłówek „Pismo od kasztelana”, pierwsza notatka, aktywna misja `m1` i brak przeprawy. Nie pokazuj graczowi konsoli ani listy kroków.
- **Polecenie:** „Graj tak, jak zrobił(a)byś to po pierwszym uruchomieniu. Mów, co oznacza list i co zamierzasz zrobić”. Nie instruuj, gdzie jest lista przewozowa ani jak budować most.
- **Obserwuj:** (1) rozpoznanie zamówienia na **30 desek i 20 chlebów**; (2) samodzielne otwarcie zamku z listu; (3) przejście przynajmniej jednego ogniwa przyczyny; (4) znalezienie narzędzia traktu; (5) utworzenie przeprawy; (6) ponowne otwarcie zamku po połączeniu. Zapisz ostatni zaobserwowany krok 1–6 i powód pominięcia.
- **Sukces:** `letter_understood=1`, gdy bez podpowiedzi poprawnie objaśnia rolę listu oraz bieżący brak dostawy; `task_success=1`, gdy wykona niezbędną sekwencję i ponownie sprawdzi zamek (nie wymagaj zwycięstwa). Zapisz `task_time_s` do 110 s aktywnego tutoriala, `tutorial_result` i `taps`. **Nie stosuj progu <30 s do całego tutoriala.**

### T2 — Czy gracz dostrzega i rozumie przycisk naprawy?

- **Start:** nowa, osobna m1: `?play=m1&ff=90&speed=0`; samouczek wyłączony. Moderator może na chwilę użyć `open=castle` w osobnym załadowaniu kontrolnym, **następnie przeładowuje bez `open`**.
- **Preflight:** moderator przez kartę i łańcuch potwierdza, że problem ma korzeń `NO_ROAD` lub `NO_WAGON/NONE_CAN_REACH` (ew. `NO_ROUTE` z celem), istnieje `gapSuggestion` i **faktycznie** widać przycisk naprawy na stosownej karcie. Zanotuj `repair_offered=1`; jeżeli przycisk nie występuje, scenariusz T2 jest nieważny dla miary odkrywalności. Przy niedoborze monet osobno zanotuj ograniczenie, nie oceniaj niemożliwego kliknięcia jako porażki.
- **Pytanie:** „Co powoduje ten brak dostawy i którą czynność wybrał(a)byś, by to naprawić?” Po odpowiedzi obserwuj wybór UI, nie podpowiadaj przycisku.
- **Sukces diagnozy:** `correct=1` tylko przy nazwaniu niepołączonej sieci; `time_s<30` to próg diagnozy, nie czasu budowy. **Sukces przycisku:** `repair_seen=1`, gdy uczestnik sam wskazuje propozycję naprawy; `repair_used=1` wyłącznie po skutecznym świadomym naciśnięciu, gdy jest dostępna i opłacalna; brak naprawy można zaliczyć jako trafną diagnozę.
- **Efekt nauki:** `prior_training=1`, gdy osoba wcześniej miała T1 albo S1; raportuj osobno `prior_training=0` i `1`. Nie ogłaszaj na tej podstawie „pierwszego intuicyjnego kontaktu” po wcześniejszym tutorialu.

## 3C. Wolna dolina: budowa, ranga, targ, zapisy (V1–V4)

Wolna dolina ma `mission.id='sandbox'`, `contract=null`, bez zegara przegranej; przy zamku działa targ. Budowanie jest dostępne w HUD, ale odblokowanie budynków i nawierzchni zależy od `state.town.rank`. **Startowa ranga 0** dopuszcza m.in. drwala, tartak, farmę, stajnię i spichlerz; ranga 1 wymaga **200 renomy, 2 rodzajów sprzedanych towarów i najlepszego przepływu 8**. To trzy **łączne** warunki; kolejnych rang nie przyznaje samo czekanie. Targ pokazuje cenę bazową, bieżącą, procent i nasycenie dla towarów. Istnieją **3 niezależne** księgi `valley1`–`valley3`, przechowywane w IndexedDB; kontrakty mają osobny wspólny slot `auto`.

Przed sesją **użyj pustego testowego profilu WebView/urządzenia**, nigdy prywatnych zapisów gracza. W `?play=sandbox&slot=valley1` debug uruchamiasz **nowy świat**, nie „kontynuuj”: może to później nadpisać testowy slot. Do zadań V4 preferuj menu ksiąg, nie sam URL.

| ID | Start i polecenie dla gracza | Preflight i zaobserwowane kryterium |
| --- | --- | --- |
| **V1 — budowa** | `?play=sandbox&speed=0`; „Postaw budynek, który jest już dostępny, i sprawdź, czy wozy będą mogły do niego dojechać”. | `buildTypes(world)` niepuste, dostatecznie dużo srebra i wolne pole. Zaliczenie po samodzielnym wyborze karty budynku, prawidłowym ustawieniu bramy, zatwierdzeniu „Postaw” oraz rozpoznaniu znaczenia połączenia z drogą. Błąd kolizji/pochylenia dokumentuj jako `issue_codes=BUILD`, nie awarię fixtury. |
| **V2 — ranga** | `?play=sandbox&speed=0`; „Pokaż, czego brakuje do następnej rangi i co zostanie odblokowane”. | `state.town.rank=0`, panel rangi dostępny. Zaliczenie po wskazaniu trzech warunków (renoma, różnorodność sprzedanych towarów, przepływ) i co najmniej jednego zamkniętego budynku. **Nie wymagaj zdobycia 200 renomy w 2 minuty**. |
| **V3 — targ** | `?play=sandbox&ff=120&speed=0` (lub nowa dolina); „Wyjaśnij cenę wybranego towaru i co może ją obniżyć”. | `state.market.open===true` i wyświetlony panel po samodzielnym wyborze „Targ i ranga”. Zaliczenie: rozpoznaje cenę **bieżącą vs bazową**, % oraz nasycenie; nie myli wpływu nasycenia z terminem kontraktu. |
| **V4 — sloty zapisu** | Uruchom menu bez `play`. „Utwórz księgę, zapisz postęp, wróć i wczytaj ten sam stan; pokaż, jak rozpocząć od nowa bez skasowania innej księgi”. | Dostępne `valley1`–`valley3`, testowe wpisy jednoznacznie oznaczone. Sprawdź niezależność slotów, potwierdzenie „od nowa”/„usuń”, poprawność rangi/monet w podglądzie i wznowienie tego samego świata. Zapis wykonuje się m.in. przy „Do menu” (await `autosave()`) lub co **30 s symulacji**; nie uznawaj za błąd braku zapisu po samym otwarciu nowej gry na pauzie. |

W V1–V4 wpisuj `task_time_s` i `task_success`; w V4 również `save_ok`. `time_s`/`correct` zostaw puste — nie są to scenariusze diagnozy przestoju. Nie usuwaj zapisów spoza wydzielonego środowiska. Nie zmieniaj samodzielnie stanu rangi w konsoli, jeśli celem jest ocena intuicyjności interfejsu.

## 3D. Fold/Flip i tryb Flex (F1–F3)

**Sprzęt:** prawdziwy Fold/Flip z APK debug; zanotuj model, Android, rozdzielczość, skalę ekranu, zewnętrzny/wewnętrzny ekran, orientację i aktualną postawę. Emulacja viewportu jest dopuszczalna **tylko jako próba techniczna**, nie jako wynik ergonomii fizycznego zawiasu. `src/ui/layout.ts` wykrywa segmenty viewportu/CSS lub natywny `__marchiaFold`; poziomy zawias z dwiema częściami o wysokości co najmniej 200 CSS px uruchamia `is-flex` (scena u góry, HUD na dole). Pionowy zawias daje `is-book` (panele w prawym segmencie). Bardzo mały ekran zewnętrzny Flip może przejść do `is-mini`, gdzie narzędzia budowania są niedostępne **celowo**.

| ID | Procedura bez podpowiedzi | Oczekiwane zachowanie / odnotowanie |
| --- | --- | --- |
| **F1 — Fold złożony → rozłożony** | Uruchom sandbox na ekranie okładki, otwórz kartę, rozłóż urządzenie i wróć do tej samej czynności; powtórz po obrocie. | Brak utraty stanu, podwójnej karty czy niezamierzonego gestu; działają gesty kamery i duże cele dotykowe. W pionowym zawiasie karta mieści się w prawym segmencie. |
| **F2 — Flex/tabletop** | Złóż ekran do poziomego półotwarcia, podczas widocznej karty wybierz narzędzie, czytaj status i spróbuj wykonać gest w scenie. Rozłóż urządzenie w trakcie anulowanej czynności. | `is-flex` tylko przy **wykrytym** poziomym podziale i odpowiednich rozmiarach. Scena u góry, HUD/karty poniżej, nie ma klikalnych elementów pod zawiasem ani przypadkowego dokończenia gestu po zmianie układu. |
| **F3 — Flip główny → okładka** | Sprawdź mapę i menu na ekranie głównym, następnie zamknij Flip na ekran okładki i wróć. | `is-mini` może świadomie wyłączyć budowę; menu/karty nie ucinają tekstu, nie prowadzą do martwych dotknięć, powrót do głównego ekranu przywraca elementy sterowania. Jeśli WebView nie działa na okładce, zapisz `unsupported`, nie błąd UX gry. |

**Preflight F2:** rzeczywisty `document.body.classList.contains('is-flex') === true`; przy fałszu nie udawaj Flex i wpisz `invalid_setup=1` lub `device_unsupported` w `notes_no_pii`. Zapisuj `fold_state` (`cover|inner|book|flex|flip_cover`), `layout_ok`, `task_success`, liczbę błędnych dotknięć, niezamierzone komendy, ucięcia UI i konkretną sekwencję reprodukcji. **Nie** porównuj czasów z Fold/Flip do płaskich telefonów bez rozdzielenia typu ekranu.

## 4. Prowadzenie: think-aloud i pomiar

Przed pierwszym zadaniem: „Mów na głos, co widzisz, co Cię dziwi i co chcesz zrobić. Nie musisz tłumaczyć mi zasad ani zgadywać moich oczekiwań”. Przy każdej scenie przeczytaj tylko **wspólne pytanie** z sekcji 3.

- **T0:** pierwsze słowo wspólnego pytania wypowiedziane po pokazaniu przygotowanego stanu. Start stopera. **T1:** pierwsza odpowiedź jednoznacznie i poprawnie nazywająca przyczynę z „Klucza odpowiedzi”; `time_s = T1 - T0`. Gdy poprawnej odpowiedzi nie ma do 60 s, `time_s=60`, `correct=0`, `timeout=1`. Jeśli odpowiedź padła po 30 s, ale przed 60 s: `correct=1`, **nie zalicza się** do `<30 s`.
- **Dotknięcia:** policz dotknięcia od T0 do T1 lub limitu 60 s, wliczając niecelne; gesty pinch/drag zapisuj jako **jeden gest**, nie jako każde zdarzenie dotykowe. Nie licz działań prowadzącego.
- **„Dlaczego stoi?”:** `opened_why=1`, gdy badany **sam** otworzył kartę budynku z przyczyną; kartę wozu koduj w `opened_wagon=1`. `followed_chain=1`, jeśli nacisnął przynajmniej jedno ogniwo przejścia do innego obiektu; `chain_steps` to liczba takich przejść. W m3 spowolnienie pojawia się w karcie wozu, nie jako osobny łańcuch.
- **Prawidłowe działanie:** `action_correct=1`, gdy bez podpowiedzi wskazał sensowną naprawę; to **wynik pomocniczy**. Sukces diagnozy nie wymaga kliknięcia panelu — jeśli uczestnik rozpozna przyczynę z mapy, to także sukces.
- **Brak podpowiedzi przez 60 s.** Nie mów: „spójrz na most”, „kliknij wóz”, „użyj przycisku Dlaczego stoi?”, „zobacz łańcuch”, „to błoto”. Nie wskazuj palcem, nie naprowadzaj wzrokiem, nie potwierdzaj zgadywanek słowami „tak, właśnie”. Na „co mam zrobić?” odpowiadaj neutralnie: „Zrób to, co wydaje Ci się naturalne”. Pomoc wyłącznie po limicie, oznacz `assistance=1`; nie licz późniejszej odpowiedzi jako samodzielnego sukcesu.
- **Zapisuj fakty, nie interpretacje:** dosłowny krótki cytat bez danych osobowych, przebieg kliknięć, błędną hipotezę, lokalizację/powód pomyłki. Nie zgaduj kodów błędów z samej animacji.

**Klucz odpowiedzi (dla prowadzącego):** `S1=NO_BRIDGE`, `S2=BRIDGE_CUT/NO_ROUTE`, `S3=NO_WAGON/ALL_BUSY`, `S4=BRIDGE_JAM`, `S5=RAIN_MUD_SLOW`, `S6=STORAGE_FULL`. Odpowiedź o samym **objawie** („nie ma desek”, „stoi”, „wolno jedzie”) jest błędna. Odpowiedź wskazująca przyczynę własnymi słowami jest prawidłowa nawet bez technicznej nazwy.

## 4A. Zakresy pomiaru i rozdzielenie efektów nauki (v2)

- Dla **S1–S4, S6–S9 oraz T2**: `time_s` = czas od pierwszego słowa neutralnego pytania do pierwszej **prawidłowej diagnozy przyczyny** (0–60 s); `correct=1` tylko przy trafnym wyjaśnieniu. Odpowiedź poprawna po 30 s to `correct=1`, ale **nie** sukces `<30`. W S8 pomiar diagnozy jest ważny tylko, gdy aktywny preflight B pokazuje `OUTPUT_FULL`. `S5` nadal liczy się osobno jako spowolnienie, nie przestój.
- Dla **T1, czytania transzy w S8, V1–V4 i F1–F3**: `task_time_s` oznacza czas wykonania danego zadania (limit w protokole prowadzącego: T1 110 s aktywnego czasu; S8 transza 120 s; V/F maksymalnie 180 s). `task_success` nie zastępuje `correct`. Puste pole oznacza „nie mierzono”, a nie zero.
- Nieważna próba: `preflight_ok=0` lub `invalid_setup=1`; zostaw `time_s`, `correct`, `task_time_s` i `task_success` **puste**, zapisz przyczynę w `notes_no_pii`. Brak sprzętu Fold/Flip to `not_run` w dzienniku rekrutacji, **nie** porażka użytkownika i nie wiersz udający wynik.
- Przed każdą próbą odnotuj `cohort`, `prior_training`, APK commit i ekran. Diagnostyka bez samouczka oraz diagnoza po T1 **nie są równoważnymi próbami**. Dla tego samego uczestnika nie licz dwóch załadowań tej samej sytuacji jako dwóch niezależnych obserwacji.
- Zadania konstrukcyjne/sprzętowe oceniaj z logiem błędnych dotknięć i zachowania UI; żadne przyspieszenie `ff` ani syntetyczna modyfikacja konsolą nie może być przedstawiane jako spontaniczny wybór testera.

## 5. Arkusz danych i ankieta po sesji

Wpisuj **jeden wiersz na uczestnika × scenariusz** do kopii `docs/playtest/results-template.csv` (30–48 wierszy **tylko dla S1–S6** przy pełnych próbach, a dla B1/B2 dodatkowe wiersze według faktycznie wykonanych zadań). Zapisz także nieudane technicznie przygotowania w osobnym dzienniku moderacji; w CSV mają `invalid_setup=1` i puste wyniki poznawcze. Nie umieszczaj w repo prawdziwych danych osobowych ani surowych nagrań.

**Znaczenie pól CSV:**
- `participant_id`, `segment` (`strategy|casual|non_gamer`), `device`, `apk_commit`, `scenario_id`, `order_index`, `setup_url`, `setup_method` (`url|manual|devtools`);
- `preflight_ok` (`1|0`), `invalid_setup` (`1|0`), `time_s` (0–60, liczba), `correct` (`1|0`), `timeout` (`1|0`), `taps`, `opened_why`, `opened_wagon`, `followed_chain`, `chain_steps`, `action_correct`, `assistance` (`1|0`);
- `issue_codes` (wiele kodów rozdzielonych `|`), `quote_anonymized`, `notes_no_pii` (bez przecinków nieucieczonych lub poprawnie w cudzysłowie CSV).

**Ankieta — 6 pytań w skali 1–5** (`1=zupełnie nie`, `5=zdecydowanie tak`; brak odpowiedzi pozostaw pusty):
1. Szybko zauważyłem(-am), że gdzieś występuje problem.
2. Łatwo znalazłem(-am) budynek lub wóz, którego dotyczy problem.
3. Komunikaty o stanie budynków i wozów były zrozumiałe.
4. Potrafiłem(-am) prześledzić, skąd bierze się problem.
5. Po znalezieniu przyczyny wiedziałem(-am), co zrobić dalej.
6. Tekst, ikony i przyciski były czytelne na tym telefonie.

**3 pytania otwarte:**
1. „W którym momencie najbardziej się zgubiłeś(-aś) i dlaczego?”
2. „Który element ekranu najbardziej pomógł Ci ustalić przyczynę?”
3. „Jaką **jedną rzecz** zmienił(a)byś, żeby szybciej wyjaśniać takie sytuacje?”

Odpowiedzi ankietowe zbierz osobno pod `participant_id`, np. w prywatnym arkuszu — **nie dopisuj 9 pól do każdego z 6 wierszy**, bo policzyłoby to tę samą odpowiedź sześciokrotnie. Nie publikuj dosłownych wypowiedzi umożliwiających rozpoznanie osoby.

## 5A. Rozszerzone CSV i ankieta v2

W `docs/playtest/results-template.csv` zachowano oryginalne kolumny S1–S6 i dodano pola modułów v2: `cohort` (`baseline|onboarding|extended|fold`), `prior_training` (`0|1`), `task_time_s`, `task_success` (`0|1`), `letter_understood`, `tutorial_step` (1–6), `tutorial_result` (`completed|skipped|time_limit|not_shown` — **kod obserwatora**, nie wynik zwracany przez klasę `Tutorial`), `repair_offered`, `repair_seen`, `repair_used`, `tranche_read_correct`, `save_ok`, `fold_state`, `layout_ok`. Puste pole = nie dotyczy albo nie mierzono (wyjaśnij w `notes_no_pii`). Zmienna `repair_used=0` przy niedostępnych środkach nie oznacza porażki: porównuj ją tylko przy rzeczywiście aktywnej propozycji naprawy. W `setup_url` wpisuj rzeczywisty ciąg zapytania, w tym `slot`, nigdy nie używaj sztucznego `fixture=...` jako istniejącej funkcji.

Kwestionariusz sesji **raz na osobę** zapisuj w osobnym `docs/playtest/survey-template.csv` (`participant_id` jako klucz; bez danych osobowych). Pierwsze sześć pytań w skali 1–5 jest niezmienione z sekcji 5. Dla osoby, która wykonała odpowiednie moduły, dodaj:
7. „Rozumiałem(-am), do czego służy list kasztelana i jaki jest następny krok”.
8. „Proponowana automatyczna naprawa była łatwa do zauważenia i zrozumienia”.
9. „Zrozumiałem(-am), co ogranicza rozwój Wolnej doliny i jak działa targ”.
10. „Na składanym ekranie bez problemu znajdowałem(-am) karty, tekst i sterowanie”.

Skala `1=zupełnie nie`, `5=zdecydowanie tak`, brak testu danej funkcji lub brak odpowiedzi → puste pole, **nie zero**. Trzy oryginalne pytania otwarte zachowaj bez zmian; krótkie wypowiedzi zapisuj w `open_1`–`open_3` po anonimizacji. Dla prób technicznych Flex dopisz faktyczne urządzenie do wyniku scenariusza, nie próbuj dopowiadać go z subiektywnej ankiety.

## 6. Analiza i decyzje UI

Po zebraniu wszystkich sesji przedstaw dla **każdego S1–S6**: `n` ważnych prób, `n` nieudanych przygotowań, medianę `time_s`, liczbę i odsetek **`correct=1 AND time_s<30`**, odsetek `opened_why`, `followed_chain`, `action_correct`, medianę dotknięć, 1–2 anonimowe cytaty.

**Zasady liczenia:**
- Mianownik odsetka `<30 s` = **wszystkie ważne próby** danej sceny, w tym odpowiedzi błędne i timeouty. Próby z `preflight_ok=0`/`invalid_setup=1` nie należą do mianownika, ale **jawnie** raportuj ich liczbę.
- `median(time_s)` licz ze wszystkich ważnych prób, **timeout=60**. Nazwij to „mediana z ucięciem do 60 s”, nie medianą rzeczywistego czasu nieskończonego czekania. Dodatkowo pokaż medianę tylko poprawnych odpowiedzi (`correct=1`), jeśli takie są.
- Warunek `<30` jest **ściśle mniejszy**: dokładnie `30.0` = poza sukcesem. `correct=0` nie jest sukcesem nawet przy `time_s=5`.
- **Wynik główny:** agregat **S1,S2,S3,S4,S6**, wyłącznie zweryfikowane bloki; **S5 pokazuj osobno** jako rozpoznanie spowolnienia. Dla każdego segmentu pokaż liczniki, nie tylko procenty.
- **Próg decyzyjny (cel projektu, nie obserwacja):** co najmniej **80% trafnych diagnoz <30 s** w każdej scenie. Przy `n=5–8` wnioski są kierunkowe; nie przedstawiaj ich jako dowodu statystycznego.

**Kody problemów (`issue_codes`; koduj tylko zaobserwowane zachowanie):**

| Kod | Obserwacja | Kandydat na zmianę UI |
| --- | --- | --- |
| `DISCOVERY` | Nie znajduje obiektu, który stoi | „Co teraz stoi?” w HUD, przejście do najdłuższego przestoju |
| `NETWORK` | Nie dostrzega brakującej/przerwanej przeprawy | Zaznaczenie przerwy i wskazanie obu stron rozłączonej sieci |
| `BUSY` | Myli `ALL_BUSY` z brakiem towaru | W łańcuchu przyczyny bezpośredni opis „wszystkie wozy zajęte” i przycisk zakupu |
| `JAM` | Nie rozróżnia korka od nieistniejącej drogi | W karcie wozu przyczyna jednopasmowego mostu i dwie opcje udrożnienia |
| `MUD` | Nie potrafi wyjaśnić spadku tempa podczas deszczu | Etykieta „zwalnia przez błoto” wraz z nawierzchnią/porównaniem tempa |
| `STORAGE` | Nie rozpoznaje `60/60` lub wpływu pełnego magazynu | Pasek pojemności i wyraźny komunikat „brak miejsca na odbiór” |
| `CHAIN` | Otwiera kartę, ale nie umie przejść do korzenia | Mocniejsza hierarchia i klikalność ogniw „ponieważ” |
| `TOUCH` | Niecelne kliknięcia, zasłonięty obiekt/karta | Większe cele dotykowe, korekta położenia kamery/arkusza |

Dla **TOP 5** grupuj problemy po kodzie, zliczaj **unikalne osoby** (współwystąpienia w kilku scenach tej samej osoby liczą się raz), podaj `liczba/n`, medianę czasu dla dotkniętych prób, stopień utrudnienia `1=kosmetyczny,2=opóźnia,3=uniemożliwia diagnozę`. Ranking: malejąco `liczba_osób × stopień`, potem dłuższa mediana; opisz konkurencyjne wyjaśnienia. Wpisz do `docs/BACKLOG.md` **rzeczywiście zaobserwowane TOP 5** po testach, z licznikami, linkiem do podsumowania i warunkiem akceptacji. W tej wersji backlog zawiera **tylko 5 hipotez do zweryfikowania**, a nie wymyślone wyniki.

## 6A. Raport v2 i decyzje

W raporcie zrealizowanych sesji pokaż **oddzielnie**: (a) niepodpowiadany benchmark S1–S4/S6, S5 jako spowolnienie, (b) **S7–S9** z liczbą ważnych i nieważnych przygotowań oraz `n` i odsetkiem trafnych diagnoz **<30 s**, (c) T1: odsetek `letter_understood=1`, przejścia przez kroki 1–6, pominięcia i odsetek ukończeń; T2: widoczność/odnalezienie/naciśnięcie proponowanej naprawy, (d) V1–V4: `task_success`/`task_time_s` oraz utrata danych w V4, (e) F1–F3: wskaźniki układu i problemy w rozbiciu na urządzenie, ekran i tryb. Nie scalaj `correct` z `task_success` ani osób poinstruowanych z niewprowadzonymi w mechanikę. Próg **80% poprawnej diagnozy <30 s** jest hipotezą dla ważnych zadań diagnostycznych, nie celem dla budowania, rankingów, zapisów lub zawiasu.

Dodatkowe kody `issue_codes` do TOP 5 (wpisuj **tylko po rzeczywistej obserwacji**): `LETTER` (niezrozumiały list), `REPAIR` (niewidoczna/myląca naprawa), `ICE` (kra mylona z uszkodzeniem), `TRANCHE` (kolejny list mylony z sumą zamówień), `CAP12` (niezauważona mała pojemność), `BUILD` (brama/walidacja/umiejscowienie), `RANK` (niezrozumiałe trzy warunki), `MARKET` (cena/nasycenie), `SAVES` (mylenie/usunięcie ksiąg), `HINGE` (zawias/pozycja paneli), `FLEX` (gest/układ tabletop). Zachowaj zasadę TOP 5: **unikalni uczestnicy**, stopień utrudnienia i kontrola alternatywnych wyjaśnień; nie generuj z góry wyników.

**Definicja ukończenia v2:** przeprowadzono prawidłowo uzgodnione bloki i uzyskano osobną zgodę na nagrania (jeśli były); wszystkie ważne próby mają preflight, commit i kod osoby; pliki CSV są poprawnie cytowane/anonimowe; czasy i odsetki podano z mianownikami, timeouty i nieudane ustawienia są widoczne; osobno zraportowano m4–m6, list, naprawę, Wolną dolinę i dostępne tryby Fold/Flip, a do `docs/BACKLOG.md` dopisano wyłącznie **zaobserwowane** problemy z warunkami akceptacji. Jeżeli brak urządzenia Flex, zapisz „nieprzetestowano na sprzęcie”, a nie „zaliczone”.
