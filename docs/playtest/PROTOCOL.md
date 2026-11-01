# Playtest MARCHIA: „przyczyna blokady w < 30 s”

**Status:** protokół do przeprowadzenia przez właściciela; **nie jest raportem z badań**.  
**Badani:** 5–8 osób, Android, **APK debug**. **Czas:** 25 min/os.  
**Cel główny:** czy osoba bez pomocy prowadzącego poprawnie nazywa **rzeczywistą przyczynę** zastoju w mniej niż 30 sekund od pytania? Sprawdzamy osobno, czy potrafi otworzyć „Dlaczego stoi?”, przejść łańcuch przyczyn i zaproponować adekwatne działanie.

Podstawa implementacji (na gałęzi `claude/eager-cori-08wt8e`): `src/sim/missions.ts`, `src/sim/missions-proposed.ts`, `tools/bot.ts`, `tools/bot-m2.ts`, `tools/bot-m3.ts`, `src/sim/diagnose.ts`, `src/ui/panels.ts`, `src/ui/app.ts`. **Nie zakładaj, że hipotetyczne parametry/fixtury zostały wdrożone.**

## 1. Rekrutacja, zgoda i organizacja

| Segment | Minimum | Kryterium |
| --- | ---: | --- |
| Strategie/logistyka | 2 | Grają co najmniej raz w miesiącu w strategie lub gry ekonomiczne |
| Casual mobile | 2 | Grają na telefonie, lecz rzadko w strategie |
| Niegrający | 1–2 | Nie grają regularnie lub wcale |
| Dodatkowe osoby (do 8) | 0–3 | W pierwszej kolejności uzupełnij mniej reprezentowany segment |

Nie zapraszaj osób, które widziały wcześniej te misje, projektowały interfejs lub czytały scenariusze. Nadaj losowy kod `P01`–`P08`; w wynikach nie zapisuj imion, kont, telefonów ani innych danych identyfikujących. Używaj tego samego APK/commita, ustawienia języka PL i podobnej jasności ekranu. Odnotuj model telefonu i wersję Androida; jeśli korzystasz z różnych urządzeń, **nie mieszaj wyników urządzeń bez adnotacji**.

**Tekst zgody, przeczytany przed sesją:**

> „Badamy grę, nie Ciebie. Sesja trwa około 25 minut. Możesz odmówić odpowiedzi lub przerwać ją w dowolnej chwili. Zapiszę anonimowy kod, czasy, liczbę dotknięć i krótkie uwagi; nie zapisuję Twoich danych osobowych. Nagranie ekranu/dźwięku wykonam tylko za Twoją osobną zgodą. Czy zgadzasz się na taki test?”

Zanotuj `consent=yes`; gdy brak zgody, nie rozpoczynaj sesji i nie twórz wierszy z wynikami. Nagranie jest **opcjonalne**, osobna zgoda wymagana także na dźwięk/wypowiedzi. Przed sesją ustal termin usunięcia surowych notatek/nagrań (proponowane 30 dni po analizie); opublikuj tylko agregaty bez cytatów identyfikujących osobę.

**Rozkład 25 minut:**
- **0:00–2:30:** zgoda, jedno neutralne objaśnienie sterowania mapą (przesuwanie/powiększanie), bez nauki diagnozy;
- **2:30–20:30:** 6 scenariuszy × maks. 3 min (reset ~45 s, diagnoza do 60 s, omówienie i ewentualna akcja ~75 s);
- **20:30–23:30:** 6 ocen w skali + 3 pytania otwarte;
- **23:30–25:00:** uwagi i zakończenie.

Ustal kolejność przed testem, żeby ograniczyć efekt nauki: dla osób nieparzystych `S1,S3,S4,S2,S5,S6`, dla parzystych `S3,S1,S2,S4,S6,S5`. Scenariusze i nazwy stanów **są wyłącznie dla prowadzącego** — nie pokazuj tabeli uczestnikowi.

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
| `play=m1|m2|m3` | Start wskazanej misji (jest też `sandbox`) |
| `ff=<s>` | Deterministyczny fast-forward w **sekundach symulacji**, maks. 3600; zatrzymuje się po wygranej/przegranej |
| `speed=0|1|2|4` | Prędkość (0 = pauza); kod nie waliduje innych liczb, więc ich nie podawaj |
| `bot=1` | **Tylko dla m1:** stawia most `bridgeA` (`x=41`) i kupuje 4 wozy; nie używać w m2/m3 i w scenariuszu bez mostu |
| `open=<buildingType>` | Otwiera **pierwszy budynek danego typu**, np. `castle`, `bakery`, `warehouse`; **nie przyjmuje ID** |
| `wagon=jam` | Otwiera pierwszy `BRIDGE_JAM`, **a jeśli go brak — pierwszy wóz nie-IDLE** |
| `wagon=<inna_wartość>` | Otwiera pierwszy wóz nie-IDLE; **nie przyjmuje ID** |
| `tool=road|cobble|demolish` | Uruchamia wskazane narzędzie (do przygotowania, nigdy jako podpowiedź) |

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
- **Sukces:** diagnoza **<30 s**; wtórnie wskazuje konieczność opróżnienia/zwiększenia miejsca. **Nie wymagaj postawienia nowego magazynu**: UI obecnie nie umożliwia stawiania budynków w misjach.

### Propozycja brakujących, deterministycznych narzędzi debugowych — **NIEZAIMPLEMENTOWANE**

W osobnym zadaniu (nie w tym PR z dokumentacją) dodać wyłącznie w buildach debugowych, bez przechodzenia do zapisu produkcyjnego, z walidacją statusów po utworzeniu świata:
- `?fixture=bridge-cut-in-transit`: m2 z aktywnym zadaniem przewozu po przecięciu mostu; wymuszone `NO_ROUTE`;
- `?fixture=all-busy`: m2 z osiągalnym towarem i `NO_WAGON/ALL_BUSY`;
- `?fixture=bridge-jam`: m2 z rzeczywistym `BRIDGE_JAM` (nie przypadkowym aktywnym wozem);
- `?fixture=warehouse-full`: m1, `STORAGE_FULL`, rzeczywisty stan pojemności i poprawne wartości księgi.

Rozważyć osobne `openId=<buildingId>`, `wagonId=<id>` zamiast zmieniać działanie istniejących `open`/`wagon`; nie używać ich w głównym pomiarze. Każda fixtura powinna mieć test inwariantów, seeda i wersję. **Bez fixtury lub pomyślnego przygotowania ręcznego S2/S3/S4/S6 nie mogą być ocenione na siłę**; zapisz nieudaną próbę przygotowania w notatkach, a nie jako błąd gracza.

## 4. Prowadzenie: think-aloud i pomiar

Przed pierwszym zadaniem: „Mów na głos, co widzisz, co Cię dziwi i co chcesz zrobić. Nie musisz tłumaczyć mi zasad ani zgadywać moich oczekiwań”. Przy każdej scenie przeczytaj tylko **wspólne pytanie** z sekcji 3.

- **T0:** pierwsze słowo wspólnego pytania wypowiedziane po pokazaniu przygotowanego stanu. Start stopera. **T1:** pierwsza odpowiedź jednoznacznie i poprawnie nazywająca przyczynę z „Klucza odpowiedzi”; `time_s = T1 - T0`. Gdy poprawnej odpowiedzi nie ma do 60 s, `time_s=60`, `correct=0`, `timeout=1`. Jeśli odpowiedź padła po 30 s, ale przed 60 s: `correct=1`, **nie zalicza się** do `<30 s`.
- **Dotknięcia:** policz dotknięcia od T0 do T1 lub limitu 60 s, wliczając niecelne; gesty pinch/drag zapisuj jako **jeden gest**, nie jako każde zdarzenie dotykowe. Nie licz działań prowadzącego.
- **„Dlaczego stoi?”:** `opened_why=1`, gdy badany **sam** otworzył kartę budynku z przyczyną; kartę wozu koduj w `opened_wagon=1`. `followed_chain=1`, jeśli nacisnął przynajmniej jedno ogniwo przejścia do innego obiektu; `chain_steps` to liczba takich przejść. W m3 spowolnienie pojawia się w karcie wozu, nie jako osobny łańcuch.
- **Prawidłowe działanie:** `action_correct=1`, gdy bez podpowiedzi wskazał sensowną naprawę; to **wynik pomocniczy**. Sukces diagnozy nie wymaga kliknięcia panelu — jeśli uczestnik rozpozna przyczynę z mapy, to także sukces.
- **Brak podpowiedzi przez 60 s.** Nie mów: „spójrz na most”, „kliknij wóz”, „użyj przycisku Dlaczego stoi?”, „zobacz łańcuch”, „to błoto”. Nie wskazuj palcem, nie naprowadzaj wzrokiem, nie potwierdzaj zgadywanek słowami „tak, właśnie”. Na „co mam zrobić?” odpowiadaj neutralnie: „Zrób to, co wydaje Ci się naturalne”. Pomoc wyłącznie po limicie, oznacz `assistance=1`; nie licz późniejszej odpowiedzi jako samodzielnego sukcesu.
- **Zapisuj fakty, nie interpretacje:** dosłowny krótki cytat bez danych osobowych, przebieg kliknięć, błędną hipotezę, lokalizację/powód pomyłki. Nie zgaduj kodów błędów z samej animacji.

**Klucz odpowiedzi (dla prowadzącego):** `S1=NO_BRIDGE`, `S2=BRIDGE_CUT/NO_ROUTE`, `S3=NO_WAGON/ALL_BUSY`, `S4=BRIDGE_JAM`, `S5=RAIN_MUD_SLOW`, `S6=STORAGE_FULL`. Odpowiedź o samym **objawie** („nie ma desek”, „stoi”, „wolno jedzie”) jest błędna. Odpowiedź wskazująca przyczynę własnymi słowami jest prawidłowa nawet bez technicznej nazwy.

## 5. Arkusz danych i ankieta po sesji

Wpisuj **jeden wiersz na uczestnika × scenariusz** do kopii `docs/playtest/results-template.csv` (30–48 wierszy przy pełnych próbach). Zapisz także nieudane technicznie przygotowania w osobnym dzienniku moderacji; w CSV mają `invalid_setup=1` i puste wyniki poznawcze. Nie umieszczaj w repo prawdziwych danych osobowych ani surowych nagrań.

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

**Definicja ukończenia playtestu:** 5–8 podpisanych zgodą sesji, plik wyników bez danych osobowych, osobny wynik S5, pięć rzeczywistych problemów z licznikami, propozycje UI w backlogu, brak udawanych fixtur i brak interpretacji błędów przygotowania jako błędów użytkownika.
