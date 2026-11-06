# Playtest MARCHIA v2 — misje I–XII, Wolna dolina i HUD v3

**Status:** protokół badań, **nie wynik sesji**. Źródła prawdy (2026-11-02): `src/ui/app.ts`, `src/ui/menu.ts`, `src/ui/hud.ts`, `src/ui/layout.ts`, `src/sim/missions*.ts`, `src/sim/proposals/missions-*.ts`, `src/sim/defs.ts` i `src/sim/seasons.ts` na gałęzi `claude/eager-cori-08wt8e`; zweryfikuj w docelowym APK. URL `ff` to przyspieszenie symulacji, a **nie** gwarancja określonego zastoju; dla S2/S3/S4/S6 są zwalidowane fixtury `?fixture=` (D-185, §3).

**5–8 uczestników, 30–40 minut na osobę**. Scenariusze rotują pomiędzy sesjami — nie da się rzetelnie sprawdzić wszystkich misji I–XII, Wolnej doliny, HUD, Fold/Flip i wydajności podczas jednej sesji. Pierwszy kontakt z samouczkiem i test diagnozy **bez** samouczka należą do odrębnych prób.

**Główny cel diagnostyczny:** poprawna przyczyna zastoju bez pomocy w **ściśle mniej niż 30 s** od neutralnego pytania, z osobnym czasem na znalezienie karty „Najgorszy zastój” i użycie „Pokaż”. Rozumienie listu, transz, prognozy „Przy tym tempie”, planowania infrastruktury, ergonomii i wydajności ma oddzielne wskaźniki. Brak poprawnego preflightu = `invalid_setup=1`, a nie błąd gracza.

## 1. Rekrutacja, zgoda i organizacja

| Segment | Minimum | Kryterium |
| --- | ---: | --- |
| Strategie/logistyka | 2 | Grają co najmniej raz w miesiącu w strategie lub gry ekonomiczne |
| Casual mobile | 2 | Grają na telefonie, lecz rzadko w strategie |
| Niegrający | 1–2 | Nie grają regularnie lub wcale |
| Dodatkowe osoby | Do łącznego limitu 8 | W pierwszej kolejności uzupełnij mniej reprezentowany segment |

Nie zapraszaj osób, które widziały wcześniej te misje, projektowały interfejs lub czytały scenariusze. Nadaj losowy kod `P01`–`P08`; w wynikach nie zapisuj imion, kont, telefonów ani innych danych identyfikujących. Używaj tego samego APK/commita, ustawienia języka PL i podobnej jasności ekranu. Odnotuj model telefonu i wersję Androida; jeśli korzystasz z różnych urządzeń, **nie mieszaj wyników urządzeń bez adnotacji**.

**Tekst zgody, przeczytany przed sesją:**

> „Badamy grę, nie Ciebie. Sesja trwa około 30–40 minut. Możesz odmówić odpowiedzi lub przerwać ją w dowolnej chwili. Zapiszę anonimowy kod, czasy, liczbę dotknięć i krótkie uwagi; nie zapisuję Twoich danych osobowych. Nagranie ekranu/dźwięku wykonam tylko za Twoją osobną zgodą. Czy zgadzasz się na taki test?”

Zanotuj `consent=yes`; gdy brak zgody, nie rozpoczynaj sesji i nie twórz wierszy z wynikami. Nagranie jest **opcjonalne**, osobna zgoda wymagana także na dźwięk/wypowiedzi. Przed sesją ustal termin usunięcia surowych notatek/nagrań (proponowane 30 dni po analizie); opublikuj tylko agregaty bez cytatów identyfikujących osobę.

**Przebieg 30–40 minut na osobę (stany przygotowane przed wejściem uczestnika):**

| Minuty | Czynność |
| --- | --- |
| 0–3 | Zgoda, kod P01–P08, urządzenie/Android, doświadczenie i neutralne pokazanie przesuwania/powiększania |
| 3–9 | A: pierwszy S1/S3 bez tutoriala; B: list i T1 (musi być **pierwsze**); C: pierwszy niepodpowiadany przypadek m9–m12 |
| 9–21 | 3–4 scenariusze z przydzielonej ścieżki: 60 s bez podpowiedzi + kontrolowany reset + ewentualna akcja |
| 21–29 | H1–H4 + 1–2 wybrane zadania Wolnej doliny / dalszych misji, lub jeden test Fold/Flip |
| 29–33 | P1: ×1/×4, odczuwalna płynność, krok konia, nagrzewanie |
| 33–38 | Ankieta i 3 pytania otwarte; 38–40 min to bufor techniczny |

**Rotacja ścieżek w grupie 5–8 osób:**
- **A — `cohort=baseline`:** S1–S6, maks. 4 z nich w jednej sesji, naprzemiennie porządek `S1,S3,S4,S2,S5,S6` / `S3,S1,S2,S4,S6,S5`. H1/H2 i P1. `prior_training=0` przed pierwszym przypadkiem.
- **B — `cohort=onboarding`:** T1 jako pierwsze, T2, S7–S11 (m4–m8), H1–H4 i wybrane V; po T1 `prior_training=1`. Nie scalaj wyników osoby już uczonej z baseline.
- **C — `cohort=extended`:** S12–S15 (m9–m12), V1–V6 rotacyjnie i P1. Parę IX/X zrób w **przeciwnej kolejności** u następnej osoby, bez naprowadzania na podobieństwo.
- **Sprzęt:** F0 na zwykłym telefonie, F1–F3 tylko na rzeczywistych Fold/Flip; wiersz z `not_run` w dzienniku nie jest niepowodzeniem gracza.

Prowadzący tworzy przed sesjami tabelkę `P01–P08 → ścieżka + planowane sceny`, by każdą misję I–XII obejrzeć co najmniej raz. Przy `n=1–2` wyniki scen są jakościowe, nie dowodem skuteczności; dla każdej sceny raportuj rzeczywisty mianownik i liczbę nieudanych preflightów. Jeśli stan nie wystąpi, zastąp go innym przygotowanym, nie wytwarzaj „błędu” uczestnika.

## 2. Przygotowanie APK i uruchamianie stanu

1. Na stanowisku prowadzącego: `npm ci`, następnie `npm run apk` (wymaga JDK 21 i Android SDK; zob. `tools/build-apk.sh`); APK debug również powstaje w `android/app/build/outputs/apk/debug/app-debug.apk`.
2. Zainstaluj na urządzeniu: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. Wyłącz powiadomienia/rozmowy, zapewnij stabilną orientację i naładowaną baterię.
3. **Parametry URL są obsługiwane w `src/ui/app.ts`, ale APK nie udostępnia pola adresu ani udokumentowanego deep linku.** Przy debugowym WebView spróbuj `chrome://inspect/#devices` (telefon z włączonym debugowaniem USB i zezwoleniem na inspekcję WebView). W konsoli właściwej karty aplikacji:
   ```js
   location.replace(location.pathname + '?play=m1&ff=90&speed=0&lang=pl&debug=1');
   ```
   Użyj odpowiedniego URL z tabeli poniżej. **Nie zakładaj**, że `adb shell am start ... ?play=` działa: brak takiej ścieżki w kodzie. Jeżeli WebView nie daje się zdalnie inspekcjonować, przygotuj debugowy ekran wyboru fixtur albo wariant APK z ustalonym adresem startowym **przed rekrutacją**. Scenariusze bez możliwości przygotowania nie są „zaliczone”.
4. Sprawdź `window.__marchia?.ready === true` oraz (w debug) `window.__marchia.app.world.state.mission.id`. **D-51:** pełny uchwyt `app` jest dostępny w release tylko przy `?debug=1`; w Vite dev również bez flagi (`import.meta.env.DEV`). Bez niej w release zostaje wyłącznie `ready`. Do konsolowych preflightów dodaj `debug=1` na stanowisku prowadzącego, nie pokazując konsoli uczestnikowi. Przed oddaniem telefonu zamknij panel diagnostyczny na komputerze i nie zostawiaj otwartego arkusza „Dlaczego stoi?”.
5. Każdy przypadek przeładuj **od zera**; nie kontynuuj zapisu z poprzedniego scenariusza. Po przygotowaniu wykonaj kontrolę stanu (`preflight` poniżej), a czas zacznij mierzyć dopiero po przekazaniu telefonu.

**Zweryfikowane parametry URL** (`src/ui/app.ts`, `src/ui/menu.ts`, `src/main.ts`):

| Parametr | Działanie i ograniczenia |
| --- | --- |
| `play=m1…m12|sandbox` | Dwanaście misji i Wolna dolina z `isMissionKey`, zawsze **nowy** świat, nie wznowienie zapisu. Bez `play` — menu |
| `tut=1` | Wymusza samouczek tylko w m1. Dla `play=m1&tut=1` **najpierw list otwierający**, potem (po jego zamknięciu) notatki tutoriala; samo `play=m1` nie pokazuje żadnego z nich |
| `ff=N` | Fast-forward o N **sekund symulacji**, do 3600 s i nie dalej niż wynik misji; **nie gwarantuje statusu** |
| `speed=0|1|2|4` | 0 = pauza. Inne wartości nie są wspieranymi trybami HUD, nie podawaj ich |
| `bot=1` | Uruchamia `botPlan(world)`, plan m1 (most i cztery wozy). Nie stosuj do m2–m12 ani badania samodzielnego wykrycia problemu |
| `lang=pl|en|…` | Parsowane w `src/main.ts` przez `parseLang`; dla badania ustal jeden język, odnotuj zmianę; lista języków wg `src/i18n/index.ts` |
| `debug=1` | Pełne `window.__marchia.app` i helpery w buildzie release (D-51), w dev również bez parametru. `ready` zawsze |
| `perf=1` | Licznik wydajności; pomocniczy odczyt techniczny, **nie** temperatura ani odczucie użytkownika |
| `open=typ`, `wagon=jam|closed|dowolne` | Otwierają pierwszy budynek typu lub wskazany status wozu, z fallbackiem do pierwszego aktywnego; **nie** wybierają ID i **nie** zapewniają żądanego statusu |
| `tool=road|cobble|demolish|build`, `pick=typ` | Wybór narzędzia i opcjonalnego typu budynku (`pick` przy `tool=build`); nie zostawiaj podczas testu odkrywalności |
| `slot=valley1|valley2|valley3` | Nowy sandbox zapisuje do wskazanej księgi; może ją nadpisać przez autosave |
| `market=1`, `collapsed=1` | Kontrolne otwarcie targu / złożenie listu przewozowego, nie używaj w teście znalezienia elementu |
| `quality=…`, `dynres=0` | Preferencja jakości i wyłączenie dynamicznej rozdzielczości — zanotuj przy P1 |
| `fixture=bridge-cut-in-transit|all-busy|bridge-jam|warehouse-full` | **D-185, tylko z `debug=1`** (lub serwer Vite dev). Nowy świat misji, rozgrywany prawdziwą symulacją od ticku 0 skryptem komend, zatrzymany (pauza) w chwili potwierdzonego zastoju i **zwalidowany**. Ignoruje `play`, `ff` i `bot`. Cała strona **nie zapisuje niczego** do slotów zapisu ani profilu (autozapis, kasowanie, najlepszy wynik). Szczegóły i preflight: „Fixtury debugowe” w §3 |
| `openId=<id budynku>`, `wagonId=<id wozu>` | D-187: otwierają kartę **dokładnie** tego budynku / wozu (bez fallbacku; nieistniejące ID = nic). Wyłącznie do kontroli prowadzącego, nigdy w mierzonej próbie |

**Przykładowe URL dla prowadzącego:** `?play=m1&tut=1&speed=1&lang=pl&debug=1`, `?play=m7&ff=120&speed=0&lang=pl&debug=1`, `?play=m12&ff=180&speed=0&lang=pl&debug=1`, `?play=sandbox&slot=valley2&speed=0&lang=pl&debug=1`, `?fixture=bridge-jam&lang=pl&debug=1` (S4).

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

- **Start (preferowany, D-185):** `?fixture=bridge-cut-in-transit&lang=pl&debug=1` — gotowy, zwalidowany stan (zob. „Fixtury debugowe” niżej); wtedy pomiń „Przygotowanie” poniżej. **Wznowienie czasu** po ok. 20 s anuluje zadanie odciętego wozu (`NO_ROUTE_CANCEL_TICKS`), więc stan zostaw na pauzie.
- **Start ręczny (zapasowy):** `?play=m2&ff=70&speed=0`. Misja II ma **jedną** przeprawę po kolumnie `x=51`, od `y=30` do `42`, oraz aktywne przewozy w obie strony.
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

- **Start (preferowany, D-185):** `?fixture=all-busy&lang=pl&debug=1` — Piekarnia (id 9) ma `NO_WAGON/ALL_BUSY` przy osiągalnej mące, wszystkie 7 wozów ma pracę.
- **Start kandydujący (zapasowy):** `?play=m2&ff=90&speed=0` (ew. 60/120/150 s); bez `bot=1`. Uwaga: przy 90 s ten stan **nie** występuje; pierwszy raz pojawia się ok. 158,6 s.
- **Preflight:** przynajmniej jeden potrzebujący surowca budynek ma dokładnie `status.k=NO_WAGON` i `status.cause=ALL_BUSY`, a przewozy faktycznie są aktywne. Sam fakt, że na ekranie jadą wozy, **nie wystarcza**. Gdy warunek się nie pojawia, przypadek nie jest przygotowany — użyj `fixture=all-busy`.
- **Poprawna przyczyna:** produkt/dostawca jest osiągalny, ale nie ma wolnego wozu do podjęcia kolejnego zadania; to **nie** brak surowca.
- **Co mierzyć:** czas, otwarcie „Dlaczego stoi?”, odnalezienie `NO_WAGON` i `ALL_BUSY`, przejście łańcucha, dotknięcia, wybór działania.
- **Sukces:** diagnoza **<30 s**; wtórnie rozważa dokupienie wozu lub odciążenie floty (zakup możliwy przy odpowiedniej liczbie monet).

### S4 — Korek na drewnianym moście (misja II; obecne URL)

- **Start (preferowany, D-185):** `?fixture=bridge-jam&lang=pl&debug=1` — Wóz 1 (id 11) czeka przy moście na Wóz 4 jadący z naprzeciwka, od co najmniej 2 s.
- **Start kandydujący (zapasowy):** `?play=m2&ff=60&speed=0` (sprawdź też 45/90 s; w obecnym buildzie pierwszy korek ok. 96 s). Zaczyna się z 7 wozami i jednym drewnianym mostem przy `x=51`. Bot m2 obserwuje `BRIDGE_JAM` w toku symulacji, ale konkretny stan przy danym `ff` zawsze sprawdzaj.
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

- **Start (preferowany, D-185):** `?fixture=warehouse-full&lang=pl&debug=1` — prawdziwie zapełniony spichlerz z poprawną księgą; **przeczytaj ograniczenia** w „Fixtury debugowe” (odcięty zamek jest częścią tego stanu). Wtedy pomiń ręczne przygotowanie poniżej.
- **Start ręczny (zapasowy, sztuczny):** `?play=m1&speed=0`. W m1 istnieje `warehouse`, pojemność **60** (`BUILDINGS.warehouse.storeCap`); w m2/m3 nie ma magazynu startowego. Obecne URL **nie mają** przełącznika „pełny magazyn”.
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

### Fixtury debugowe — **ZAIMPLEMENTOWANE** (D-185…D-187, `FIXTURE_VERSION=1`)

`?fixture=<id>&lang=pl&debug=1` startuje misję od ticku 0 z jej własnym seedem i rozgrywa **prawdziwą symulację** (`step()` + zwykłe komendy gracza, `src/game/fixtures.ts`) do chwili, gdy oczekiwany zastój trwa nieprzerwanie 1 s; potem gra stoi na **pauzie** (`speed` z URL może to zmienić — nie zmieniaj). Nic nie jest dopisywane ręcznie do stanu: towary, rezerwacje i statusy pochodzą z symulacji, więc księga i inwarianty są prawdziwe. Przebieg jest deterministyczny — ten sam tick, te same ID i ten sam hash stanu na każdym urządzeniu (sprawdzone headless i w Chromium). Po zbudowaniu stan jest **walidowany** (`checkFixture`: status, inwarianty, brak niewyjaśnionego zastoju, misja trwa).

- **Brak `debug=1`**, nieznane ID albo nieudana walidacja → **widoczny czerwony komunikat** „Nieprawidłowe przygotowanie … Nie oceniaj tej próby (invalid_setup=1)” u góry ekranu (znika po dotknięciu) oraz `console.error('[fixture] invalid setup', …)`. Taka próba: `invalid_setup=1`, **bez oceny**.
- **Zapisy:** strona z parametrem `fixture` nie zapisuje, nie kasuje i nie nadpisuje **żadnego** slotu ani profilu — także po przejściu do menu, „Jeszcze raz” lub zamknięciu aplikacji. Zapisy uczestnika z innych prób pozostają nietknięte.
- `ff`, `bot` i `play` są przy fixturze ignorowane. `openId`/`wagonId` (D-187) służą wyłącznie do kontroli prowadzącego; mierzoną próbę zawsze ładuj **bez** nich.

| Scenariusz | URL (dla uczestnika) | Misja, stop | Podmiot (dla `openId`/`wagonId`) | Co zawiera stan |
| --- | --- | --- | --- | --- |
| S2 | `?fixture=bridge-cut-in-transit&lang=pl&debug=1` | m2, 39,4 s | wóz id **12** („Wóz 2”, 6 drewna do Tartaku) | Gdy załadowany wóz zmierza do mostu `x=51`, skrypt rozbiera **jedną** wolną komórkę przęsła na jego trasie (komenda `demolish`); 2 s później wóz ma `NO_ROUTE` (drugi wóz, id 13, również). Karta „Najgorszy zastój” w tej chwili wskazuje **zamek** (czeka na deski od początku gry) — to prawdziwy, starszy zastój, nie błąd fixtury |
| S3 | `?fixture=all-busy&lang=pl&debug=1` | m2, 159,5 s | budynek id **9** (Piekarnia) | Bez komend. 7 wozów, każdy z pracą; piekarnia `NO_WAGON/ALL_BUSY` (mąka), źródło osiągalne, flota nie stoi przy moście (`heldWagon=-1`, `busyOutOfReach=-1`). Druga piekarnia (id 10) ma ten sam status |
| S4 | `?fixture=bridge-jam&lang=pl&debug=1` | m2, 98,2 s | wóz id **11** („Wóz 1”) | Bez komend. Wóz 1 z 4 zbożem czeka przy drewnianym moście na Wóz 4 jadący z naprzeciwka (jeden pas), od ≥2 s |
| S6 | `?fixture=warehouse-full&lang=pl&debug=1` | m1, 612,5 s | budynek id **7** (Spichlerz) | Komendy na starcie: most z lekcji (`x=41`), 4 wozy, **rozbiórka 1 komórki drogi do zamku** `(72,50)`. Deski, chleb i nadmiar mąki trafiają do spichlerza, aż `STORAGE_FULL`. Patrz ograniczenia |

**Ograniczenia, które prowadzący musi znać:**
- **S6 nie jest „czystym” pełnym spichlerzem.** W misji I bez przecięcia czegoś za spichlerzem prawdziwa symulacja nie zapełnia go przed terminem (zamek bierze deski i chleb, młyn i piekarnia nadążają za polem). Fixtura odcina więc zamek. Skutek: karta „Najgorszy zastój” pokazuje **„Zamek: brak dojazdu do zapasów”**, kontrakt ma 0/30 i 0/20, a do śniegu zostaje **1:48** (z komunikatem „Zostały 2 minuty”). Karta spichlerza: wiersz przyczyny **„60/60 — brak miejsca na odbiór”** (zapas + ładunki w drodze, tak liczy symulacja), pasek „W spichlerzu: 35/60” z kreskowanym przychodem. Na neutralne pytanie uczestnik najpewniej wskaże odcięty zamek — **to poprawna przyczyna korzenia**. Dla S6 zapisuj osobno: `correct` = rozpoznaje brak miejsca w spichlerzu (z kartą lub mapą), `notes_no_pii` = czy wskazał także odcięty zamek. Decyzja, czy S6 w tej postaci liczyć do głównego wskaźnika, należy do właściciela (BACKLOG).
- **S2:** wznowienie czasu na ponad ~20 s anuluje zadanie odciętego wozu; nie zostawiaj gry na ×1 przed oddaniem telefonu.
- Wartości z tabeli (czas stopu, ID) są przypięte w `tests/playtest-fixtures.test.ts`. Zmiana symulacji, która je przesuwa, musi zaktualizować tę tabelę i podbić `FIXTURE_VERSION`; wyników z różnych wersji fixtur nie mieszaj.

**Preflight fixtury** (konsola debugowego WebView, przed oddaniem telefonu; nic nie zmienia):
```js
const f = window.__marchia.fixture, s = window.__marchia.app.world.state;
console.log(f.ok, f.problem, f.id, 'v' + f.version, f.tick, f.hash, f.focus, 'speed', window.__marchia.app.loop.speed);
// oczekiwane: ok=true, problem=null, speed=0, tick i focus jak w tabeli; hash zapisz w fixture_hash
console.log(s.mission.id, s.tick, f.focus.kind === 'wagon'
  ? s.wagons.find(w => w.id === f.focus.id).status
  : s.buildings.find(b => b.id === f.focus.id).status);
```
`window.__marchia.fixture` istnieje także bez pełnego uchwytu `app`. Jeżeli `ok !== true` albo widać czerwony komunikat: `invalid_setup=1`, przeładuj od zera; nie oceniaj próby. Kontrola wizualna: ten sam URL z `&wagonId=12` / `&openId=9` / `&wagonId=11` / `&openId=7` (zrzuty `docs/shots/playtest-*-card.jpg`), potem **przeładuj bez tych parametrów**. Automatyczna kontrola wszystkich fixtur na buildzie: `node tools/playtest-shots.mjs http://127.0.0.1:5194/` (ok, pauza, brak zapisów, komunikat dla błędnego ID).

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
- **Preflight:** widoczny list otwierający, aktywna `m1` i brak przeprawy. **Pierwsza notatka samouczka nie jest równocześnie widoczna z listem** — pojawia się dopiero po jego zamknięciu. Zapisz, czy gracz przeczytał list, zamknął go przyciskiem lub dotknięciem i dostrzegł pierwszą notatkę. Nie pokazuj graczowi konsoli ani listy kroków.
- **Polecenie:** „Graj tak, jak zrobił(a)byś to po pierwszym uruchomieniu. Mów, co oznacza list i co zamierzasz zrobić”. Nie instruuj, gdzie jest lista przewozowa ani jak budować most.
- **Obserwuj:** (1) rozpoznanie zamówienia na **30 desek i 20 chlebów**; (2) samodzielne otwarcie zamku z listu; (3) przejście przynajmniej jednego ogniwa przyczyny; (4) znalezienie narzędzia traktu; (5) utworzenie przeprawy; (6) ponowne otwarcie zamku po połączeniu. Zapisz ostatni zaobserwowany krok 1–6 i powód pominięcia.
- **Sukces:** `letter_understood=1`, gdy bez podpowiedzi objaśnia rolę listu, zamówienie i brak dostawy; `task_success=1`, gdy wykona sekwencję i ponownie sprawdzi zamek (bez wymagania zwycięstwa). Zapisz `task_time_s` do 110 s **aktywnego** tutoriala, `tutorial_result` i `taps`. **Osobno**, po zamknięciu listu, spytaj: „Co wstrzymuje dostawę do zamku?” i mierz `first_diagnosis_s` od tego pytania do pierwszej trafnej przyczyny (maks. 60 s; timeout=60), `first_diagnosis_correct` (1/0). `first_diagnosis_s<30` jest osobną miarą pierwszej diagnozy — **nie** czasem ukończenia tutoriala ani niepodpowiadanym S1.

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


### V5 — Pory roku i jesienny jarmark

- **Start:** `?play=sandbox&ff=780&speed=4` (zapowiedź lata w 13:00), `?play=sandbox&ff=1780&speed=4` (jesień za 20 sekund symulacji), `?play=sandbox&ff=2700&speed=0` (zima do oglądania). Jeżeli chcesz zmierzyć odbiór zapowiedzi, zacznij **przed** granicą, nie dopiero na niej; `ff` wykonuje skok, nie obserwację gracza.
- **Fakty do klucza:** sezon trwa **15 min symulacji**: wiosna [00:00,15:00), roztopy [04:00,08:00) ×0,55 na drodze gruntowej; lato [15:00,30:00), gospodarstwa +20% tempa; jesień [30:00,45:00), **piwo +25% względem bieżącej ceny po nasyceniu**; zima [45:00,60:00), farma −40%, ryby −50%, drewniane mosty zamknięte w [48:00,50:00) i [54:00,56:00), kamienne pozostają czynne. Zapowiedź nadchodzi **2 min gry wcześniej**; pauza zatrzymuje kalendarz.
- **Polecenie:** „Wyjaśnij, co się niedługo zmieni i jak wpłynie na produkcję, drogę albo targ”. `season_understood=1`, gdy wskazuje poprawny konkretny efekt; nie wymagaj czekania pełnej pory roku. Wpisz `task_time_s` i `issue_codes=SEASON` tylko przy obserwowanej pomyłce. Płatność +25% w praktyce wymaga faktycznej sprzedaży piwa; początkujący gracz może tylko odczytać ofertę jarmarku — rozdziel te wyniki.

### V6 — Dziesięć towarów, rangi 0–5 i odblokowania

**Towary** (stała `GOODS`): `wood` drewno, `planks` deski, `grain` zboże, `flour` mąka, `bread` chleb, `fish` ryby, `stone` kamień, `charcoal` węgiel drzewny, `malt` słód, `beer` piwo. Pytanie: „Które z nich trzeba wyprodukować lub kupić jako półprodukt; czym różni się sprzedaż od przetworzenia?”.

**Rangi i wszystkie trzy łączne warunki (renoma, różne sprzedane towary, najlepszy przepływ srebra/min):**

| Ranga | Renoma | Rodzaje | Najlepszy przepływ | Odblokowanie |
| --- | ---: | ---: | ---: | --- |
| 0 (start) | 0 | 0 | 0 | drwal, tartak, farma, stajnia, spichlerz, droga gruntowa |
| 1 | 200 | 2 | 8 | młyn i piekarnia |
| 2 | 1000 | 4 | 20 | rybak, kamieniołom, bruk i kamienny most |
| 3 | 3000 | 6 | 60 | węglarz i słodownia |
| 4 | 7200 | 7 | 120 | browar; punkt handlowy za rzeką (125 % ceny, D-170) |
| 5 | 17000 | 9 | 160 | ulepszenie wyglądu zamku, bez nowego budynku |

- **Start:** `?play=sandbox&speed=0` oraz opcjonalnie **realny** zaawansowany zapis testowej księgi. Nie ustawiaj rangi sztucznie i nie żądaj osiągnięcia rangi 5 w krótkiej sesji.
- **Zaliczenie:** uczestnik sam odnajduje wymagania następnej rangi i wymienia, co się odblokuje (`rank_understood`); `goods_identified` to liczba prawidłowo wskazanych towarów 0–10. Zapisz `task_time_s` i odróżnij **rozumienie progów** od faktycznego awansu.

## 3D. Fold/Flip i tryb Flex (F0–F3)

**F0 — zwykły telefon (punkt odniesienia):** wykonaj H1 i P1 na typowym nieskładanym Androidzie w pionie, następnie obróć ekran. Zanotuj dostęp do szyny narzędzi jedną ręką, czytelność karty, brak ucięć, przypadkowe kliknięcia i położenie „Pokaż”. Zapisz `device_class=phone`, `screen_mode=normal`, `layout_ok`, `misclicks`.

**Sprzęt:** prawdziwy Fold/Flip z APK debug; zanotuj model, Android, rozdzielczość, skalę ekranu, zewnętrzny/wewnętrzny ekran, orientację i aktualną postawę. Emulacja viewportu jest dopuszczalna **tylko jako próba techniczna**, nie jako wynik ergonomii fizycznego zawiasu. `src/ui/layout.ts` wykrywa segmenty viewportu/CSS lub natywny `__marchiaFold`; poziomy zawias z dwiema częściami o wysokości co najmniej 200 CSS px uruchamia `is-flex` (scena u góry, HUD na dole). Pionowy zawias daje `is-book` (panele w prawym segmencie). Bardzo mały ekran zewnętrzny Flip może przejść do `is-mini`, gdzie narzędzia budowania są niedostępne **celowo**.

| ID | Procedura bez podpowiedzi | Oczekiwane zachowanie / odnotowanie |
| --- | --- | --- |
| **F1 — Fold złożony → rozłożony (`is-split`)** | Uruchom sandbox na ekranie okładki, otwórz kartę, rozłóż urządzenie i wróć do tej samej czynności; powtórz po obrocie. | Brak utraty stanu, podwójnej karty czy niezamierzonego gestu; działają gesty kamery i duże cele dotykowe. Na szerokim ekranie (`w>=720 CSS px` i bez trybu poziomego/mini) sprawdź `is-split`; pionowy zawias rozpoznany przez API może dodatkowo włączyć `is-book`, wtedy karta powinna zmieścić się w prawym segmencie. Nie zakładaj `is-book` tylko na podstawie fizycznego modelu. |
| **F2 — Flex/tabletop** | Złóż ekran do poziomego półotwarcia, podczas widocznej karty wybierz narzędzie, czytaj status i spróbuj wykonać gest w scenie. Rozłóż urządzenie w trakcie anulowanej czynności. | `is-flex` tylko przy **wykrytym** poziomym podziale i odpowiednich rozmiarach. Scena u góry, HUD/karty poniżej, nie ma klikalnych elementów pod zawiasem ani przypadkowego dokończenia gestu po zmianie układu. |
| **F3 — Flip główny → okładka** | Sprawdź mapę i menu na ekranie głównym, następnie zamknij Flip na ekran okładki i wróć. | `is-mini` może świadomie wyłączyć budowę; menu/karty nie ucinają tekstu, nie prowadzą do martwych dotknięć, powrót do głównego ekranu przywraca elementy sterowania. Jeśli WebView nie działa na okładce, zapisz `unsupported`, nie błąd UX gry. |

**Preflight urządzeń:** `is-split` oznacza szeroki layout, **nie** dowód fizycznego zawiasu; `is-book` wymaga wykrycia pionowego segmentu, `is-flex` poziomego z dwiema częściami o wysokości >=200 CSS px, `is-mini` małego viewportu. Zapisz rzeczywiste klasy, orientację i źródło informacji o zawiasie (segments/CSS/natywne) lub `unsupported`. **Preflight F2:** rzeczywisty `document.body.classList.contains('is-flex') === true`; przy fałszu nie udawaj Flex i wpisz `invalid_setup=1` lub `device_unsupported` w `notes_no_pii`. Zapisuj `fold_state` (`cover|inner|book|flex|flip_cover`), `layout_ok`, `task_success`, liczbę błędnych dotknięć, niezamierzone komendy, ucięcia UI i konkretną sekwencję reprodukcji. **Nie** porównuj czasów z Fold/Flip do płaskich telefonów bez rozdzielenia typu ekranu.


## 3E. Misje VII–XII (S10–S15): sprawdź, czy scenariusze uczą czegoś nowego

**Ogólne przygotowanie:** `?play=m7` do `?play=m12` są obsługiwane w `src/ui/menu.ts` oraz `src/ui/app.ts`. `ff` poniżej to **kandydaci**, nie fixtury gwarantujące blokadę. Przed każdą diagnozą sprawdź `mission.result='running'`, status wozów i budynków, dostępność zasobów oraz kartę HUD. **Sceny planowania (S10, S11) nie muszą zawierać zastoju**, dlatego używaj w nich `task_success`, `task_time_s` i pól zrozumienia, nie wymyślonego `correct`.

### S10 — VII: ryby, most i „Przy tym tempie”

**Start:** `?play=m7&ff=120&speed=0&lang=pl&debug=1`, ewentualnie inny `ff` po kontroli. Misja zamawia **54 ryby** (termin 12:00), ma **jednego istniejącego rybaka**, **4 wozy**, jedną drewnianą przeprawę `x=51` i pozwala zbudować **rybaka**. `forecastFor(world,pace)` działa dla pojedynczego kontraktu (nie transzy), ale prognoza może nie być gotowa bez dostatecznych próbek tempa.

**Preflight:** rybak i most istnieją, karta listu przewozowego lub zamku faktycznie pokazuje `Przy tym tempie: gotowe za …` albo spóźnienie (a nie pusty placeholder); jeżeli prognoza niegotowa, zmień `ff`/przygotowanie, odnotuj to jako `invalid_setup=1` dla testu prognozy.

**Polecenie:** „Co będzie dostarczone, kiedy i co najbardziej ogranicza postęp?”. Zaliczenie `pace_seen=1` za samodzielne odnalezienie komunikatu, `pace_understood=1` za poprawne wyjaśnienie, że to **przewidywanie na podstawie dotychczasowego tempa**, a nie gwarantowany termin. Osobno oceń, czy gracz łączy liczbę rybaków, podaż i przeprawę oraz proponuje sensowną zmianę. Mierz `task_time_s` (maks. 120 s); `correct/time_s` tylko przy osobnym, zweryfikowanym zastoju.

### S11 — VIII: bruk z kamienia **przed** burzą

**Start:** `?play=m8&ff=60&speed=0&lang=pl&debug=1`. Deszcz zaczyna się przy **ticku 1000** (01:40 sim), `roadStone=true`, w mapie stoją kamieniołom `(57,7)` i spichlerz; 6 wozów, gracz może budować kamieniołom. Południowy gruntowy trakt będzie wolniejszy podczas deszczu.

**Preflight:** jesteśmy przed opadem, sprawdź w magazynie `stock.stone` i w kartach faktyczną możliwość układania bruku. Kamień musi zostać **dostarczony do spichlerza**, nie wystarczy, że leży w kamieniołomie. Nie podpowiadaj narzędzia kamiennej nawierzchni.

**Pytanie:** „Co przygotujesz przed zmianą pogody, żeby dostawy nie zwolniły?”. `road_stone_understood=1` za zrozumienie kosztu w kamieniu z magazynu; `task_success=1` za samodzielny poprawny plan bruku na ważnym odcinku. `task_time_s` i `issue_codes=STONE` przy rzeczywistym błędzie, bez wymogu rozgrywania całej burzy.

### S12 — IX: wspólne drewno dla tartaku i węglarza

**Start:** `?play=m9&ff=120&speed=0&lang=pl&debug=1`. Jeden drwal, tartak oraz węglarz konkurują o drewno; równolegle istnieje łańcuch piwa (słodownia, browar). Można postawić drugiego drwala. Kontrakt to 36 desek, 8 węgla i 26 piwa.

**Preflight:** sprawdź `sharedInput(world, id)` albo potwierdzone `NO_INPUT/WAITING_UPSTREAM` z korzeniem niedostatecznej podaży; jeśli brak niedoboru, nie wymuszaj diagnozy. **Pytanie:** „Skąd bierze się opóźnienie w dostawie drewna do różnych zakładów?”. Poprawne: **jedno źródło i dwóch odbiorców**, a nie z definicji za mało wozów. Wpisz `correct/time_s` dla ważnej próby diagnozy, `action_correct`, czy proponuje dodatkowego drwala lub sensowne zwiększenie podaży.

### S13 — X: czy gracz odczuwa powtórkę z IX?

**Start:** `?play=m10&ff=120&speed=0&lang=pl&debug=1`. Tutaj **jeden drwal** ponownie obsługuje tartak i węglarza, ale **stajnia jest przy drwalu**, a 4 wozy w założeniu usuwają flotę jako główne ograniczenie; nie ma pobocznego łańcucha piwa. Kontrakt: 48 desek i 8 węgla. Istnieje podpowiedź **cienkich dostaw drewna** (`thinDelivery`).

**Preflight:** problem leży w podaży drewna, nie w `NO_WAGON/ALL_BUSY`; sprawdź status i liczbę/ładunek wozów. **Polecenie:** „Co jest przyczyną, a co naprawisz w pierwszej kolejności?”. Rozpoznanie braku surowca i propozycja kolejnego drwala jest trafna; samo „kup więcej wozów” nie.

**Pomiary porównawcze IX/X:** po **obu** próbach zapytaj neutralnie: „Czy druga sytuacja nauczyła Cię czegoś nowego? Czego konkretnie?”. `ix_x_new_lesson=1` tylko przy **konkretnym** nowym rozróżnieniu (np. wolna flota vs cienka dostawa / krótszy łańcuch), `0` gdy uczestnik uważa sytuację za powtórzenie. Zmień kolejność IX→X i X→IX u kolejnej osoby; nie uznawaj dwóch prób jednej osoby za niezależne wyniki. Raportuj cytaty, a nie ocenę projektanta.

### S14 — XI: odległa słodownia (62 pola zboża)

**Start:** `?play=m11&ff=120&speed=0&lang=pl&debug=1`. Farma `x=18`, słodownia `x=80`, browar `x=56`, tylko **3 wozy**. Długi odcinek przewozu zboża (~62 pól) jest zamierzonym ograniczeniem przepustowości. Nie można stawiać budynków (`buildable=[]`), kontrakt to 22 piwa.

**Preflight:** droga jest ciągła, zboże istnieje, są trwające dalekie przewozy/oczekiwania; nie koduj wymyślonego `NO_ROAD`. **Pytanie:** „Czemu browar nie może szybko zakończyć produkcji, choć mamy zboże?”. Poprawne: daleki transport do słodowni i mała flota, a nie brak surowca lub konieczność budowy nowego browaru. Jeśli stan zawiera naprawdę `NO_WAGON/ALL_BUSY`, mierz `time_s/correct`; w przeciwnym razie `task_time_s/task_success` za wyjaśnienie pojemności przewozowej.

### S15 — XII: magazyn jako bufor, nie brak kolejnego wozu

**Start:** `?play=m12&ff=180&speed=0&lang=pl&debug=1` (dla obserwacji magazynu sprawdź również `ff=0/120/240`). Na starcie **12 wozów**; mały magazyn `capOverride=12` pełen zboża, większy pusty spichlerz przy `(36,35)` **dwie komórki** od połączenia z drogą (kandydat `x=37,y=38–39`); można budować magazyny. Trzy transze: 32 chleby do 06:00, 8 chlebów i 12 piwa do 09:00, 36 piwa do 12:00.

**Preflight:** sprawdź `STORAGE_FULL`/`OUTPUT_FULL` oraz trasę do dużego spichlerza. Sam pełny magazyn **nie gwarantuje**, że w bieżącej chwili blokuje konkretny zakład. **Pytanie:** „Co ogranicza produkcję mimo tylu wozów i co zmieni połączenie magazynu?”. Trafna przyczyna: niedostępny **bufor połączony z drogą**, a nie brak wozu. `buffer_understood=1` przy wyjaśnieniu roli zapasowej pojemności; `correct/time_s` tylko z faktyczną blokadą, inaczej `task_success` za sensowny plan dwóch pól drogi / nowego spichlerza.

**Konsolowy preflight S10–S15 (prowadzący; po dodaniu `?debug=1`):**

```js
const a = window.__marchia?.app;
if (!a) throw Error('Brak uchwytu debug (D-51)');
const s = a.world.state;
console.log({ mission: s.mission.id, tick: s.tick, result: s.mission.result,
  need: s.mission.contract?.need, tranches: s.mission.contract?.tranches,
  roadStone: s.mission.roadStone });
console.table(s.buildings.map(b => ({
  id: b.id, type: b.type, status: b.status.k, cause: b.status.cause ?? '',
  cap: b.capOverride, wood: b.stock.wood, grain: b.stock.grain,
  stone: b.stock.stone, inStone: b.incoming.stone
})));
console.table(s.wagons.map(w => ({ id: w.id, status: w.status.k })));
```


## 3F. HUD v3: „Najgorszy zastój”, pieczęć, karty narzędzi (H1–H4)

**Preflight wspólny:** oblicz `rankStalls(world)`, z którego `src/ui/hud.ts` otrzymuje stany. Minimum to **20 ticków = 2 s**, więc dla krótkiego zacięcia karta i alarm są celowo ukryte. „Najgorszy” oznacza najwyższe `score = stalledTicks × waga` (krytyczny > zwykły > samoczynnie ustępujący), **nie po prostu najstarszy**. Wpisz `stalls_count` i `worst_stall_id` na podstawie kodu; resetuj ekran bez otwartej karty. Testuj wybrane sceny S1–S15 po ich potwierdzonym preflighcie.

| ID i polecenie bez podpowiedzi | Sukces / miary |
| --- | --- |
| **H1 — odnajdź najgorszy zastój.** „Gdzie widzisz najważniejszy problem? Pokaż go i powiedz, dlaczego powstał”. | `hud_find_s` mierzone od pierwszego słowa pytania do samodzielnego wskazania właściwej karty/obiektu; cel **<30 s**. `hud_show_used=1` gdy użyto przycisku z ikoną oka (dostępna etykieta „Pokaż: [nazwa]”). `hud_cause_s` do pierwszej trafnej przyczyny — **osobny zegar** i `correct` zależny od faktycznego statusu. Samo kliknięcie „Pokaż” nie jest poprawną diagnozą. |
| **H2 — pieczęć alarmu.** „Co oznacza liczba na pieczęci? Co nastąpi po naciśnięciu?”. | `alarm_count_understood=1` gdy uczestnik rozpoznaje **liczbę aktualnych zastojów**, a nie srebro, terminy lub rangę. `alarm_cycle_used=1` przy świadomym przejściu do następnego problemu. Do testu cyklu potrzebne co najmniej 2 zastoje; przy jednym pole zostaw puste, nie 0. Pieczęć cyklicznie przechodzi po rankingu. |
| **H3 — karty narzędzi i podświetlenie lekarstwa.** „Co możesz zrobić, żeby usunąć przyczynę, i gdzie znajdziesz tę czynność?”. | `tool_cards_understood=1` jeśli rozróżnia budowę, trakt, bruk, rozbiórkę, kupno wozu oraz podgląd ruchu. `cure_highlight_seen=1`, gdy spontanicznie zauważa podświetlenie `is-cure` narzędzia `road` albo `wagon` **tylko przy rzeczywistej propozycji `cureFor`**. Nie wyciągaj wniosków z braku podświetlenia, jeśli nie ma lekarstwa. |
| **H4 — „brak N srebra”.** „Dlaczego ten przycisk nie pozwala kupić wozu i ile brakuje?”. | **Preflight:** srebro `coins < 30`, bo `WAGON_PRICE=30`. Karta „Kup wóz” zmienia widoczny opis na `brak {n}`, a `aria-label` wyjaśnia „Brakuje {n} srebra”; `wagon_shortfall_understood=1` przy poprawnym obliczeniu `30 - coins` i zrozumieniu blokady. Jeśli srebra jest >=30, nie raportuj błędnego wyniku — przygotuj inny stan lub `invalid_setup=1`. Przy zbyt małym saldzie karta wozu **nie jest aktywnie wyróżniana** jako lekarstwo. |

**Kontrola czystości próby:** `?open` / `?wagon` są wyłącznie do przygotowania; po ich użyciu przeładuj bez nich. Gdy brak zastoju, `stallRow` jest ukryty, a H1/H2 nie mają ważnego ustawienia. Dla H3, jeżeli budowa jest w danej misji niedostępna, nie karz za niewidoczną kartę. H1/H2/H3/H4 nie są automatycznie czterema osobnymi diagnozami: dla jednej osoby i tego samego stanu raportuj jeden poznawczy wynik, a resztę jako interakcje z HUD.

## 3G. Wydajność odczuwalna: ×1/×4, ciepło i krok konia (P1)

**P1 — ten sam sprzęt i zbliżona liczba obiektów.** Przygotuj `?play=m2&ff=45&speed=1&lang=pl` (lub sandbox z podobnym ruchem), bez otwartych paneli, a następnie poproś o obserwowanie **20–30 s przy ×1**, **20–30 s przy ×4** i powrót do ×1. Nie mierz FPS jako proporcji tempa symulacji. W razie potrzeby uruchom osobną próbę techniczną z `?perf=1` (licznik nie zastępuje oceny uczestnika). Zanotuj jakość/`dynres`, orientację, stan baterii i to, czy aparat był już ciepły przed startem.

- **Płynność:** `perceived_smoothness_x1` i `perceived_smoothness_x4` od 1 (wyraźne cięcia) do 5 (bez zakłóceń). Obserwator notuje widoczne skoki animacji, opóźnienie gestów i stop-klatki.
- **Krok konia:** `horse_step_x1_ok` i `horse_step_x4_ok` to `1`, gdy animacja kroku naturalnie współgra z przesuwaniem wozu; `0`, gdy koń ślizga się, przebiera nogami z niewłaściwym rytmem albo przeskakuje. Osobno zapisz przy jakiej prędkości.
- **Ciepło:** `heat_before` i `heat_after` — subiektywna skala dotyku 1 (chłodny) do 5 (nieprzyjemnie gorący). **To nie pomiar temperatury procesora.** Po 30 s nie wolno twierdzić, że urządzenie nigdy się nie nagrzeje podczas długiej gry.
- **Różne ekrany:** powtarzaj na Fold wewnętrzny / `is-flex` oraz Flip okładka tylko gdy jest obsługiwana. Bez wyświetlenia sceny wpisz `device_unsupported=1`, nie `smoothness=0`. Porównuj ten sam model i stan ekranu, a nie wyniki zbiorcze z Fold, Flip i zwykłego telefonu.

## 4. Prowadzenie: think-aloud i pomiar

Przed pierwszym zadaniem: „Mów na głos, co widzisz, co Cię dziwi i co chcesz zrobić. Nie musisz tłumaczyć mi zasad ani zgadywać moich oczekiwań”. Przy każdej scenie przeczytaj tylko **wspólne pytanie** z sekcji 3.

- **T0:** pierwsze słowo wspólnego pytania wypowiedziane po pokazaniu przygotowanego stanu. Start stopera. **T1:** pierwsza odpowiedź jednoznacznie i poprawnie nazywająca przyczynę z „Klucza odpowiedzi”; `time_s = T1 - T0`. Gdy poprawnej odpowiedzi nie ma do 60 s, `time_s=60`, `correct=0`, `timeout=1`. Jeśli odpowiedź padła po 30 s, ale przed 60 s: `correct=1`, **nie zalicza się** do `<30 s`.
- **Dotknięcia:** policz dotknięcia od T0 do T1 lub limitu 60 s, wliczając niecelne; gesty pinch/drag zapisuj jako **jeden gest**, nie jako każde zdarzenie dotykowe. Nie licz działań prowadzącego.
- **„Dlaczego stoi?”:** `opened_why=1`, gdy badany **sam** otworzył kartę budynku z przyczyną; kartę wozu koduj w `opened_wagon=1`. `followed_chain=1`, jeśli nacisnął przynajmniej jedno ogniwo przejścia do innego obiektu; `chain_steps` to liczba takich przejść. W m3 spowolnienie pojawia się w karcie wozu, nie jako osobny łańcuch.
- **Prawidłowe działanie:** `action_correct=1`, gdy bez podpowiedzi wskazał sensowną naprawę; to **wynik pomocniczy**. Sukces diagnozy nie wymaga kliknięcia panelu — jeśli uczestnik rozpozna przyczynę z mapy, to także sukces.
- **Brak podpowiedzi przez 60 s.** Nie mów: „spójrz na most”, „kliknij wóz”, „użyj przycisku Dlaczego stoi?”, „zobacz łańcuch”, „to błoto”. Nie wskazuj palcem, nie naprowadzaj wzrokiem, nie potwierdzaj zgadywanek słowami „tak, właśnie”. Na „co mam zrobić?” odpowiadaj neutralnie: „Zrób to, co wydaje Ci się naturalne”. Pomoc wyłącznie po limicie, oznacz `assistance=1`; nie licz późniejszej odpowiedzi jako samodzielnego sukcesu.
- **Zapisuj fakty, nie interpretacje:** dosłowny krótki cytat bez danych osobowych, przebieg kliknięć, błędną hipotezę, lokalizację/powód pomyłki. Nie zgaduj kodów błędów z samej animacji.

**Klucz odpowiedzi (dla prowadzącego):** `S1=NO_BRIDGE`; `S2=BRIDGE_CUT/NO_ROUTE`; `S3=NO_WAGON/ALL_BUSY`; `S4=BRIDGE_JAM`; `S5=RAIN_MUD_SLOW`; `S6=STORAGE_FULL`; `S7=BRIDGE_CLOSED`; `S8=TRANCHE/OUTPUT_FULL`; `S9=CAP12/STORAGE_FULL`; `S10=FISH/FORECAST`; `S11=STONE_BEFORE_RAIN`; `S12=SHARED_WOOD`; `S13=WOOD_SOURCE_NOT_WAGONS`; `S14=LONG_GRAIN_ROUTE`; `S15=WAREHOUSE_BUFFER`. **Nie wszystkie to statusy `SimState`:** część nazw to etykiety dla prowadzącego służące ocenie zadania planowania. Odpowiedź o samym objawie („nie ma desek”, „stoi”, „wolno jedzie”) jest błędna w diagnozie; trafna przyczyna może być sformułowana własnymi słowami bez technicznej nazwy.

## 4A. Miary, timeouty, czystość preflightu i efekt nauki

**Zasady dla diagnozy (S1–S4, S6–S9, T2 oraz S12/S13/S15 wyłącznie w potwierdzonym stanie; S5 jako osobne spowolnienie):**

1. `T0` = początek pierwszego słowa neutralnego pytania *po* przekazaniu przygotowanego stanu; `T1` = pierwsze samodzielne **poprawne wyjaśnienie przyczyny**. `time_s = T1−T0`, maks. 60 s. Przy braku trafnej odpowiedzi w 60 s: `time_s=60`, `correct=0`, `timeout=1`. Przy poprawnej odpowiedzi po 30 s i przed 60 s: `correct=1`, ale próg **`time_s < 30` niezaliczony**; dokładnie `30.0` także niezaliczone.
2. `taps` to dotknięcia (pinch/drag liczone jako jeden gest), `opened_why` / `opened_wagon` / `followed_chain` / `chain_steps` / `action_correct` to odrębne obserwacje. Świadome użycie panelu nie jest konieczne do trafnej diagnozy, jeśli badany wyjaśni przyczynę na podstawie mapy.
3. `preflight_ok=0` lub `invalid_setup=1`: **nie wpisuj** `correct`, `time_s`, `task_success`, `task_time_s` ani zer rzekomych umiejętności. Powód w `notes_no_pii`. Nie licz tej próby w mianowniku; ujmij ją w liczbie technicznych niepowodzeń.
4. **S8 podziel na dwa niezależne zadania i wiersze**: `scenario_id=S8_TRANCHE` (prawidłowy odczyt bieżącego listu, `task_time_s` do 120 s + `tranche_read_correct`), `scenario_id=S8_BUFFER` (rzeczywiste `OUTPUT_FULL`/odcięty spichlerz, `time_s` do 60 s + `correct`). Każdy ma własny preflight i `setup_url`, więc niezdatny bufor nie unieważnia prawidłowego odczytu transzy.
5. **T1:** aktywny tutorial ma limit **110 s** (`task_time_s`) i może przeskakiwać kroki; `tutorial_result=completed|skipped|time_limit|not_shown` jest kodem obserwatora, a nie dosłownym `TutorialResult` (`done|skipped`). Od pierwszego neutralnego pytania **po liście** mierz niezależnie `first_diagnosis_s` i `first_diagnosis_correct` (60 s limit). Nie wliczaj tego wyniku do baseline S1.
6. **Zadania zamiast diagnoz**: S10 (prognoza), S11 (bruk), S14 (odległość), V1–V6, F0–F3, P1 oraz części T2/H1–H4 używają `task_time_s` / `task_success`, dedykowanych pól i maks. 180 s na V/F, jeśli nie wskazano innego limitu. Nie wymuszaj `correct=0`, jeżeli w świecie **nie ma** przestoju.
7. **H1:** od pierwszego pytania mierz `hud_find_s` do wskazania właściwej karty/obiektu i `hud_cause_s` do trafnej przyczyny, maks. 60 s; `hud_found=1|0` mówi, czy cel rzeczywiście znaleziono, nawet przy timeout. Cel `hud_found=1 && hud_find_s < 30` jest **inny** niż trafna diagnoza. Przy `stalls_count=0` nie oceniaj H1/H2. Przejście pieczęcią wymaga `stalls_count>=2`.
8. **P1:** skale 1–5 dla odczucia płynności i ciepła, `0|1` dla kroku konia; rozdziel ×1 i ×4. Nie mieszaj FPS z szybkością symulacji; nie wyciągaj wniosków o długim nagrzewaniu z krótkiego testu.

Przy każdej próbie zapisz `cohort`, `prior_training` (`0|1`), `apk_commit`, `device_class`, `screen_mode`, `orientation` i `setup_method`. Pierwszy kontakt, powtórne przeładowanie, wcześniejszy tutorial i zmiana rozmiaru ekranu są **konfunderami**: raportuj je osobno. Dla pojedynczej osoby i jednego stanu H1 oraz S1 nie są dwiema niezależnymi diagnozami, nawet jeśli wpisano dwa wiersze techniczne. Brak fizycznego Fold/Flex/Flip wpisz jako `not_run` w dzienniku rekrutacji, **nie** jako zerową ocenę użytkownika.

## 5. Dane wyników i ankieta po sesji

Dla **każdej wykonanej próby** (`S1–S15`, warianty `S8_TRANCHE` / `S8_BUFFER`, `T1–T2`, `V1–V6`, `H1–H4`, `F0–F3`, `P1`) dodaj **jeden wiersz uczestnika × zadanie** do prywatnej kopii `docs/playtest/results-template.csv`. Nie twórz pustych wierszy dla zadań, których nie wykonano. Jeśli przygotowanie technicznie się nie powiodło, zachowaj wiersz z `invalid_setup=1` i **pustymi wynikami poznawczymi**, zamiast fałszować `correct=0`. Gdy tego samego uczestnika dotyczy kilka prób przygotowania, odnotuj to w `notes_no_pii` i nie licz tych prób jako niezależnych.

**Kolumny bazowe (zachowane w tej samej kolejności co v1):** `participant_id` (anonimowy P01–P08), `segment` (`strategy|casual|non_gamer`), `device`, `android_version`, `apk_commit` (rzeczywisty SHA buildu), `scenario_id`, `order_index` (kolejność podjętych prób), `setup_url` (cały **faktyczny** query string), `setup_method` (`url|manual|devtools|fixture`), `preflight_ok`, `invalid_setup`, `time_s`, `correct`, `timeout`, `taps`, `opened_why`, `opened_wagon`, `followed_chain`, `chain_steps`, `action_correct`, `assistance`, `issue_codes`, `quote_anonymized` i `notes_no_pii`.

**Format:** liczniki i wskaźniki `0|1` **tylko przy rzeczywiście wykonanemu pomiarze**; pusty = nie dotyczy / brak pomiaru, nie zero. Czas w sekundach, 0–60 dla diagnozy; dotknięcia i błędne gesty jako liczby całkowite >=0. `issue_codes` łącz pionową kreską `|`. Pola tekstowe z przecinkami, cudzysłowami lub końcami linii zapisuj prawidłowo w CSV (cudzysłowy podwajaj). W repozytorium jest **wyłącznie szablon**, nie rzeczywiste dane, nagrania, numery telefonów ani cytaty umożliwiające rozpoznanie osoby.

**Ankieta raz na uczestnika**, w osobnym `docs/playtest/survey-template.csv`. Pytania 1–12 w skali `1=zupełnie nie` do `5=zdecydowanie tak` (nie wykonano modułu = komórka pusta):

| Nr | Stwierdzenie po sesji |
| --- | --- |
| 1 | Szybko zauważyłem(-am), że gdzieś występuje problem. |
| 2 | Łatwo znalazłem(-am) budynek lub wóz, którego dotyczy problem. |
| 3 | Komunikaty o stanie budynków i wozów były zrozumiałe. |
| 4 | Potrafiłem(-am) prześledzić, skąd bierze się problem. |
| 5 | Po znalezieniu przyczyny wiedziałem(-am), co zrobić dalej. |
| 6 | Tekst, ikony i przyciski były czytelne na tym telefonie. |
| 7 | Rozumiałem(-am), do czego służy list kasztelana i jaki jest następny krok. |
| 8 | Proponowana automatyczna naprawa była łatwa do zauważenia i zrozumienia. |
| 9 | Zrozumiałem(-am), co ogranicza rozwój Wolnej doliny i jak działa targ. |
| 10 | Na składanym ekranie bez problemu znajdowałem(-am) karty, tekst i sterowanie. |
| 11 | Karta najgorszego zastoju, pieczęć alarmu i podświetlenie działania pomagały mi znaleźć problem. |
| 12 | Przy ×4 gra działała płynnie, a ruch koni wyglądał naturalnie. |

**Pytania otwarte:** (1) „W którym momencie najbardziej się zgubiłeś(-aś) i dlaczego?”, (2) „Który element ekranu najbardziej pomógł Ci ustalić przyczynę?”, (3) „Jaką jedną rzecz zmienił(a)byś, żeby szybciej wyjaśniać takie sytuacje?”. Krótkie, pozbawione danych osobowych odpowiedzi wpisz **raz** w `open_1`–`open_3`. Nigdy nie powielaj ankiety na każdy wiersz scenariusza — zawyżyłoby to średnie.

## 5A. Słownik dodatkowych kolumn CSV v2

Starsze pola `cohort` (`baseline|onboarding|extended|fold`), `prior_training` (`0|1`), `task_time_s`, `task_success`, `letter_understood`, `tutorial_step` (ostatni faktycznie zaobserwowany 1–6), `tutorial_result` (`completed|skipped|time_limit|not_shown`), `repair_offered`, `repair_seen`, `repair_used`, `tranche_read_correct`, `save_ok`, `fold_state` i `layout_ok` zachowano dla porównywalności. `repair_used=0` ma sens tylko przy **aktywnym i opłacalnym** przycisku; przy braku środków pozostaw puste.

| Dodane kolumny | Jednostka / zasady kodowania |
| --- | --- |
| `session_id`, `device_class`, `screen_mode`, `orientation`, `layout_classes`, `device_unsupported` | ID bez danych osobowych; `phone|fold|flip`; `normal|cover|inner|book|flex|flip_cover`; `portrait|landscape`; **zaobserwowane** klasy `is-split|is-flex|is-book|is-mini` (rozdziel `|`); brak obsługi ekranu `0|1` |
| `ff_seconds`, `speed_mode`, `stalls_count`, `worst_stall_id`, `observed_status` | Wartości z moderatorskiego preflightu: sekundy przewinięcia, `0|1|2|4`, liczba aktualnych zastojów, ID najgorszego budynku (nigdy zgadywane), rzeczywiście zaobserwowany status/kod przyczyny |
| `first_diagnosis_s`, `first_diagnosis_correct` | **T1**, 0–60 sekund od neutralnego pytania po zamknięciu listu, `1|0`; timeout: 60 s i 0 |
| `pace_seen`, `pace_understood`, `road_stone_understood`, `ix_x_new_lesson`, `buffer_understood` | `1|0`, tylko jeśli temat rzeczywiście pokazano/badano; `ix_x_new_lesson` dopiero po **obu** IX/X |
| `hud_find_s`, `hud_found`, `hud_cause_s`, `hud_show_used`, `alarm_count_understood`, `alarm_cycle_used`, `tool_cards_understood`, `cure_highlight_seen`, `wagon_shortfall_understood` | Czas znalezienia/korygowania przyczyny 0–60 s, flagi `1|0` przy ważnej próbie; znalezienie = `hud_found=1 && hud_find_s <30`, przy 1 zastoju `alarm_cycle_used` puste |
| `rank_understood`, `season_understood`, `goods_identified` | `1|0` przy badanym pytaniu; liczba poprawnie rozpoznanych **spośród 10** towarów (`0..10`) |
| `fixture_id`, `fixture_version`, `fixture_hash` | Tylko przy `setup_method=fixture`: ID z URL, `window.__marchia.fixture.version` i `.hash` z preflightu (D-185); przy innym przygotowaniu puste |
| `misclicks`, `unintended_commands`, `clipped_ui` | Zliczone błędne dotknięcia, niezamierzone akcje i widoczne ucięcia tekstu/karty; 0, gdy obserwator **sprawdził** i nie było problemu |
| `perceived_smoothness_x1`, `perceived_smoothness_x4`, `horse_step_x1_ok`, `horse_step_x4_ok`, `heat_before`, `heat_after`, `perf_fps_note` | Subiektywna płynność i temperatura **1–5**, krok konia `1|0`, ewentualnie zaobserwowany FPS/warunki renderowania jako tekst; niczego nie wpisuj bez obserwacji |

**Ważne rozróżnienie:** `fold_state` to starszy skrót stanu, natomiast `screen_mode`/`layout_classes` podają konkretne warunki; `is-split` nie oznacza automatycznie wykrytego zawiasu. Przy S8 używaj `S8_TRANCHE` i `S8_BUFFER`, a w obu wpisz niezależny `preflight_ok`. W `setup_url` wpisuj `fixture=…` tylko wtedy, gdy faktycznie go użyto (`setup_method=fixture`). Ankieta pozostaje oddzielna od danych prób, połączona tylko anonimowym `participant_id`.

## 6. Analiza, mediany i decyzje o UI

**Raportuj osobno każdą scenę i kohortę, bez pozornej precyzji przy n=1–2.** Na początek tabela `scenario_id / cohort / n_valid / n_invalid_preflight / n_correct / n_correct_under_30 / median_time_s / median_correct_time_s / median_taps`, a poza diagnozą odrębne tabele dla `task_success` i właściwych wskaźników.

**Reguły wyliczeń:**

- `valid = preflight_ok=1 && invalid_setup=0`; `n_valid` to liczba **unikalnych, ważnych prób uczestnik × scena**, a `n_invalid_preflight` — nieudane techniczne przygotowania, bez wpisywania ich do mianownika. Gdy ta sama osoba widziała scenę kilka razy, do benchmarku pierwszego kontaktu licz **wyłącznie pierwszą** poprawnie przygotowaną próbę, bez wcześniejszej podpowiedzi.
- **Odsetek poprawnych diagnoz:** `n(correct=1)/n_valid`. **Główny odsetek <30 s:** `n(correct=1 AND time_s<30)/n_valid`, **nie** tylko z poprawnych. Odpowiedź dokładnie w `30.0` s nie przechodzi; `correct=0` nigdy nie przechodzi, choćby `time_s=5`. Wartość docelowa **>=80% na scenę** jest **hipotezą projektową**, nie wynikiem eksperymentu przy 5–8 osobach.
- **Mediana czasu:** z `time_s` dla **wszystkich ważnych prób** w danej scenie, **timeout=60 s**. Zawsze nazywaj „mediana z ucięciem do 60 s”; dodatkowo pokaż medianę czasu wśród `correct=1`. Dla zadań planistycznych używaj osobnej mediany `task_time_s` tylko dla rzeczywiście wykonanych ważnych prób; nie podmieniaj pustego pola zerem.
- **HUD H1:** odsetek `hud_found=1 && hud_find_s<30` oraz mediana `hud_find_s` (timeout 60), osobno odsetek trafnej diagnozy `correct=1 && hud_cause_s<30`. Dla H2 mierzalność cyklu tylko przy `stalls_count>=2`; dla H3 podświetlenie tylko przy aktywnym `cureFor`; dla H4 interpretacja ceny tylko przy `coins<30`.
- **Ankieta:** każdy `participant_id` raz; dla 12 pytań pokaż `n` odpowiedzi, medianę i zakres (1–5), bez zer za niewykonany moduł. Nie traktuj subiektywnej oceny jako faktu o silniku.

**Oddzielne sekcje raportu po sesjach:**

| Blok | Podsumowanie |
| --- | --- |
| **Baseline S1–S6** | Główne niepodpowiadane diagnozy: agregat **S1,S2,S3,S4,S6** oraz **S5 osobno** jako rozpoznanie błota; `opened_why`, `opened_wagon`, `followed_chain`, `action_correct`, mediana dotknięć i 1–2 krótkie anonimowe cytaty na scenę |
| **Misje IV–VI S7–S9** | Kra `BRIDGE_CLOSED`, transza `S8_TRANCHE` **osobno** od pełnego bufora `S8_BUFFER`, mały spichlerz `cap=12`; n ważnych/nieważnych oraz czas diagnozy tylko, gdy spełniono preflight |
| **Misje VII–XII S10–S15** | VII: odczyt `Przy tym tempie` i przeprawa; VIII: kamień/bruk przed deszczem; IX/X: liczba par z obu misji, odsetek `ix_x_new_lesson=1` i cytaty wraz z kolejnością; XI: długa trasa zboża; XII: bufor mimo 12 wozów; diagnoza <30 wyłącznie gdy był sprawdzony przestój |
| **T1–T2** | List kasztelana `letter_understood`, czas pierwszej diagnozy `first_diagnosis_s` z progiem <30 i `first_diagnosis_correct`; rzeczywiście przebyte kroki 1–6 i pominięcia, rodzaj `tutorial_result`; dla naprawy `repair_offered`/`repair_seen`/`repair_used` z mianownikiem faktycznej dostępności |
| **V1–V6** | Budowanie, trzy warunki rang i tabela 0–5, targ i nasycenie, niezależność `valley1–3` oraz błędy zapisu, zapowiedzi i efekty czterech pór, rozpoznanie 10 towarów; `task_success`, `task_time_s`, `rank_understood`, `season_understood` |
| **H1–H4** | Odkrycie karty „Najgorszy zastój” **<30 s**, „Pokaż”, licznik pieczęci i przełączanie, karty narzędzi, podświetlenie `Kup wóz` / `Trakt` oraz wyjaśnienie „brak N srebra”; n możliwości interakcji i n samodzielnych sukcesów |
| **F0–F3 i P1** | Zwykły telefon, Fold złożony/`is-split`, prawdziwy `is-flex` i Flip cover (ew. `is-mini`), ucięcia i błędne gesty, obciążenie ×1/×4, `horse_step_*`, płynność i nagrzewanie; w każdym trybie raportuj **model, ekran i rzeczywistą klasę layoutu**. Brak sprzętu = nieprzetestowano, nie zaliczone |

**Kody problemów (`issue_codes`; nadaj dopiero po zaobserwowanym zachowaniu, nie z samego projektu):**

| Kod | Weryfikowalna pomyłka lub problem | Kandydat na poprawkę / pytanie do audytu |
| --- | --- | --- |
| `DISCOVERY` | Nie odnajduje zastoju | Czy istniejąca karta HUD „Najgorszy zastój” i „Pokaż” są dostrzegalne |
| `NETWORK` | Nie widzi przerwy w przeprawie | Mocniejsze pokazanie rozłączonej sieci |
| `BUSY` | Myli zajęte wozy z brakiem towaru | Wyraźniejsze `NO_WAGON/ALL_BUSY` i zakup wozu |
| `JAM` | Nie odróżnia korka od braku drogi | Opis jednopasmowego mostu i możliwego objazdu |
| `MUD` | Nie rozpoznaje spadku tempa w błocie | Porównanie przejazdu po gruncie i bruku |
| `STORAGE` | Nie rozumie pełnej pojemności | Lepszy pasek `zajęte/pojemność` |
| `CHAIN` | Nie przechodzi do przyczyny źródłowej | Wyraźniejsze klikalne ogniwa „ponieważ” |
| `TOUCH` | Niecelne dotknięcia/zasłonięta karta | Układ, większe przyciski |
| `LETTER` | Myli cel listu lub nie wie, jak zacząć | Czytelniejsza treść lub wskazanie celu |
| `REPAIR` | Nie zauważa dostępnej naprawy w karcie | Widoczność propozycji oraz kosztu |
| `ICE` | Kra pomylona ze zniszczonym mostem | Doprecyzowanie czasu otwarcia |
| `TRANCHE` | Suma listów pomylona z transzą | Bieżący list i kolejny termin |
| `CAP12` | Mały spichlerz mylony z pojemnością 60 | Pokazanie porównania magazynów |
| `BUILD` | Błąd bramy/pozycji/kolizji podczas budowania | Lepszy ghost i wyjaśnienie walidacji |
| `RANK` | Nie rozumie łącznych warunków | Trzy wymogi i odblokowania na karcie rangi |
| `MARKET` | Cena i nasycenie pomylone | Jawne rozdzielenie ceny bazowej/bieżącej |
| `SAVES` | Myli lub nieumyślnie kasuje księgę | Potwierdzenie operacji i nazwa księgi |
| `HINGE` | UI nachodzi na fizyczny zawias | Weryfikacja `is-book`/segmentu |
| `FLEX` | Nieprawidłowy gest w układzie tabletop | Rozdzielenie sceny i HUD |
| `HUD` | Nie widzi pieczęci albo „Pokaż” | Kontrast i hierarchia w HUD |
| `CURE` | Nie rozpoznaje podświetlonego lekarstwa | Powiązanie przyczyny z aktywnym narzędziem |
| `SILVER` | Nie rozumie „brak N srebra” | Nazwanie ceny i brakującej kwoty |
| `PACE` | Prognoza traktowana jako obietnica | Zastrzeżenie „przy tym tempie” |
| `STONE` | Nie łączy kamienia w spichlerzu z brukiem | Widoczność warunku budowy |
| `WOODIX_X` | IX i X odbierane jako ta sama lekcja | Ocena, czy X daje nowe rozróżnienie |
| `DISTANCE` | Nie dostrzega kosztu dalekiej trasy do słodowni | Wskazanie przebiegu przewozu |
| `BUFFER` | W XII kupuje wozy zamiast otworzyć spichlerz | Powiązanie produkcji z buforem |
| `SEASON` | Myli efekty/zapowiedzi sezonu | Jasne zdarzenie i efekt w kalendarzu |
| `PERF` | Szarpanie, ślizgający koń lub nieprzyjemne ciepło | Rozdzielenie tempa symulacji i animacji |

**TOP 5 wniosków:** pogrupuj kody i licz **unikalne osoby**, nie liczbę kliknięć/wystąpień; dla każdego `liczba osób / n osób, które mogły zobaczyć funkcję`, dotkliwość `1` kosmetyczny / `2` opóźnia / `3` uniemożliwia, medianę czasu z dotkniętych prób, krótkie cytaty i alternatywne wyjaśnienia. Sortuj malejąco `liczba_osób × dotkliwość`, następnie malejąco mediana. **Dopiero po rzeczywistych sesjach** wpisz TOP 5 do `docs/BACKLOG.md` z mianownikami, linkiem do raportu i **warunkiem akceptacji**. Nie wymyślaj obserwacji, brakujących prób, temperatur ani „zielonego” wyniku UX.

**Warunek domknięcia protokołu v2:** sesje wykonane w uzgodnionych ścieżkach z 5–8 osobami i osobnymi zgodami na ewentualne nagrania; każda próba ma anonimowy kod, commit, realny URL/preflight, ekran i wynik albo jawny powód nieważności; oba szablony CSV są wypełniane zgodnie ze słownikiem; mediana z timeoutami, odsetki z mianownikami i puste przypadki zostały pokazane osobno; opisano IX/X, m12, HUD v3, rangi, sezony, Fold/Flex/Flip i ×4 tam, gdzie naprawdę testowano. **Brak fizycznego urządzenia lub niemożliwy stan = „nieprzetestowano”, nie „zaliczono”.**
