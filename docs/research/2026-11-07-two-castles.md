# Badanie: lekcja „dwa zamki” (2026-11-07)

> Gałąź `claude/research-castles`. Kontekst: `docs/research/2026-11-06-missions-14-15.md` §6.3 („dwa zamki wymagają
> rozszerzenia sim: kontrakt na zamek”). Prototyp: `tools/two-castles-proto.ts` (eksperymentalny, nie do scalenia
> z rozgrywką). Wszystkie liczby poniżej pochodzą z tego narzędzia: `npx tsx tools/two-castles-proto.ts`
> (`--sweep`, `--chain`, `--map`).

## 0. W skrócie

- **Da się, i tanio, bez ruszania istniejących misji.** Opcjonalne pole `mission.extraContracts` (kolejne zamki,
  każdy z jedną transzą z własnym terminem) i opcjonalne `mission.firstCastle` (zamek obsługiwany najpierw).
  Obu nie ma w żadnej autorskiej misji, więc stan serializuje się bajt w bajt jak dziś: `tools/mission-hashes.ts`
  daje **identyczny** wynik przed i po (45 wierszy), `npm test` 579/0, golden kontraktów I–XV (`CONTRACT_GOLDEN`)
  bez zmian.
- **Dyspozytor obsługuje dwa zamki deterministycznie**: każdy wiersz prototypu grany 2× daje ten sam hash, a zapis
  i odczyt w 3:00 nic nie zmienia (27/27 wierszy dla trzech map, z priorytetem łańcuchowym i bez).
- **Lekcja działa tylko w jednym kształcie**: oba zamki chcą **tego samego towaru od wspólnego producenta**, mają
  **różne terminy**, a gracz ma **dźwignię „Najpierw ten zamek”**. Wtedy drabina jest czysta: nic = 1★, sama dźwignia
  = 2★, sam wóz (zła poprawka) = 1★, dźwignia + wóz = 3★ (projekt A).
- **Priorytet tylko na ostatnim odcinku** (wozy z gotowym towarem jadą najpierw do wybranego zamku). Priorytet
  „łańcuchowy” (podnosi też warsztaty pod spodem) w prototypie częściej szkodzi niż pomaga i głodzi drugi zamek —
  nie polecam go na pierwszą wersję.
- **Rekomendacja: opcja 2** (dwa zamki + przełącznik na karcie zamku, priorytet ostatniego odcinka, pieczęcie za
  całość minus spóźniony list), misja XVI „Dwa zamki” wg projektu A. Szacunek: 2–3 sesje agenta.

## 1. Co sim robi dziś i co trzeba zmienić

### 1.1 Dziś

- `MissionState.contract: Contract | null` — **jeden** kontrakt, jeden zamek (`contract.castle`). `buildMission`
  bierze **pierwszy** zamek z listy budynków.
- Kontrakt ma `need`, `deadlineTick`, `star3Tick`, `star2Tick` i opcjonalne `tranches` (V, XV): transze kończą się
  **po kolei**, spóźniona kosztuje pieczęć (min. 1 za wygraną), przegrana tylko po ostatnim terminie.
- Pytanie „czy ten zamek chce towaru g?” jest rozsiane po kodzie jako `m.contract.castle === b.id`:
  `logistics.ts` (`remainingContract`, popyt zamku, `statusFor` zamku), `wagons.ts` (`accepts`, `acceptsUpTo`,
  przekierowanie ładunku), `sim.ts` (`checkMission`, `stars`), `diagnose.ts` (`outputCustomer`, `outputSurplus`,
  `stoneInStore`, `contractFilled`), `forecast.ts` (`contractForecast`), `repair.ts`, a w UI ~27 miejsc
  (`hud.ts` list przewozowy, `pace.ts`, `paceCard.ts`, `markers.ts`, `stalls.ts`, `menu.ts`, `wagonsView.ts` sterty
  pod zamkiem).
- Dyspozytor (`dispatch`): popyty sortowane po `prio` (zamek 0, wejścia warsztatów 1, kamień w spichlerzu 2), potem
  po `fill` (zapełnienie), potem po id. Reguła A (D-156) działa dopiero przy flocie ≥ autorska + 2.
- Dwa zamki tego samego typu **nie są dla siebie rywalami** w diagnozie: `contestedBy` pomija konsumentów tego
  samego typu (`to.type === b.type`), więc zamek, któremu deski zabrał drugi zamek, czyta dziś `WAITING_UPSTREAM`
  („tartak robi”), a nie „deski pojechały do Zamku Północnego”.

### 1.2 Kształt stanu (zrobione w prototypie)

```ts
interface MissionState {
  contract: Contract | null;        // bez zmian: główny zamek; jego deadlineTick = koniec misji
  ...
  extraContracts?: Contract[];      // NOWE, opcjonalne: kolejne zamki, każdy z tranches = [jedna transza z terminem]
  firstCastle?: number;             // NOWE, opcjonalne: id zamku obsługiwanego najpierw
}
```

Dlaczego tak, a nie `contracts: Contract[]`:
- **Klucz nieobecny = JSON identyczny.** Ten sam wzorzec co `valleyEvents` i `tradePost` (obecne tylko w dolinie).
  Zamiana `contract` na tablicę zmieniłaby JSON każdej misji, więc każdy hash i każdy zapis (migracja + nowe golden).
- **Termin zamku = jedna transza.** Istniejąca maszyneria transz (`doneTick`, `missed`, „spóźniony list = −1
  pieczęć”) robi dokładnie to, czego potrzeba dla zamku z własnym terminem. Gracz zna tę regułę z V i XV.
- Dwa pomocniki w `contract.ts` zastępują rozsiane porównania: `contractsOf(m)` (wszystkie zamówienia) i
  `runningContractOf(m, castleId)` (zamówienie tego zamku, gdy misja trwa). Dla jednego zamku zwracają to samo co
  dziś, więc ścieżki są bit-identyczne.

### 1.3 Zapisy i wersja stanu

- **Migracja danych nie jest potrzebna**: stare zapisy nie mają nowych kluczy, a brak klucza znaczy „jeden zamek”.
- `saveGate.ts` toleruje dziś nieznane pola, ale **ich nie sprawdza**. Przed wydaniem trzeba dopisać walidację
  `extraContracts` (jak `contract`: `need`, `castle` musi być zamkiem, transze) i `firstCastle` (id zamku z
  kontraktem), oraz test w `save-hostile`.
- Podbicie `STATE_VERSION` 9 → 10 z migracją-tożsamością (jak v8 → v9 dla misji poza doliną) jest **zalecane**
  (stara wersja gry nie wczyta zapisu XVI), ale ma koszt: `tools/mission-hashes.ts` haszuje stan z polem
  `version`, więc wszystkie 45 wierszy zmieni się formalnie. Rozwiązanie: w tym narzędziu haszować z
  `version: 0`, tak jak robi to już `CONTRACT_GOLDEN` w `tests/valley-events-live.test.ts`. `V4_GOLDEN`
  (`tests/chains.test.ts`) zdejmuje nowe pola sam. Wtedy dowód „nic się nie zmieniło” zostaje dosłowny.

### 1.4 Priorytet dyspozytora między dwoma zamkami

Prototyp ma trzy tryby (czytaj tabele w §3):

| Tryb | Co robi | Wynik w prototypie |
|---|---|---|
| **Domyślny: podział po zapełnieniu** | Oba zamki `prio 0`; idzie ten, który ma mniejszy ułamek zamówienia (`fill`), remis → niższe id | Zamki rosną **równo**, więc zamek z wcześniejszym terminem się spóźnia. To jest pożądana porażka „nic nie robię”. |
| **„Najpierw ten zamek” (ostatni odcinek)** | Popyt wybranego zamku dostaje `prio −1` (przed wszystkim) | Działa, gdy oba zamki chcą tego samego towaru (A). Gdy wąskie gardło jest wyżej w łańcuchu (B, C), nie zmienia nic albo lekko szkodzi. |
| Priorytet łańcuchowy (`--chain`, flaga tylko w narzędziu) | Dodatkowo warsztaty robiące brakujące towary wybranego zamku (i ich wejścia) dostają `prio 0.5` | W B i C ścisły priorytet **głodzi drugi zamek**: B 7:42 → 9:22 (oba listy spóźnione), C 6:45 → 8:42. |

Wniosek: na pierwszą wersję **priorytet tylko na ostatnim odcinku**. Jest prosty do wyjaśnienia jednym zdaniem
(„Wozy z deskami jadą najpierw pod Zamek Wschodni”) i karta go pokaże. Łańcuchowy jest nieprzejrzysty (gracz nie
widzi, czemu młyn stoi) i zamienia lekcję w loterię.

Dyspozytor nie powinien sam wybierać zamku z wcześniejszym terminem (EDF). Wtedy „nic nie robię” dawałoby od
razu dobry wynik i lekcja by znikła. Podział po zapełnieniu jest „głupi, ale czytelny”: karta może uczciwie
powiedzieć „deski dzielone po równo”.

Dźwignia w stanie to nowa komenda (np. `{ t: 'castleFirst'; castle: number }`, `castle: -1` zdejmuje). Komendy
idą przez `commands.ts` i powtórki (`replay.ts`), więc są deterministyczne z definicji. W prototypie narzędzie
ustawia `firstCastle` bezpośrednio, bez komendy.

Ważna obserwacja z przeglądu (§3, A): przełączenie priorytetu **po ~1:50** już nie ratuje wczesnego listu (5:16
przy terminie 5:00), a w jednym wariancie kończy misję **później** niż brak działania (7:56 vs 7:40). Powód: połowa
desek jest już w drodze do drugiego zamku. To zgodne z lekcją („zdecyduj wcześnie”), ale wymaga sygnału od 0:00
(list otwierający + karta tempa).

### 1.5 Pieczęcie: za zamek czy za całość?

W prototypie: **za całość**. Misja jest wygrana, gdy oba zamki mają swoje. Pieczęcie liczą się z czasu ostatniej
dostawy (`star3Tick`/`star2Tick` głównego kontraktu) minus 1 za każdy zamek, który przekroczył **swój** termin
(min. 1 za wygraną). Przegrana przychodzi dopiero o końcu misji (`contract.deadlineTick`). To dokładnie reguła
transz z V/XV, więc gracz nie musi uczyć się nowej. Alternatywa „pieczęcie osobno dla każdego zamku” daje sześć
pieczęci na ekranie, nie pasuje do menu (jedna pieczęć na misję) ani do listu końcowego — patrz pytanie P3.

### 1.6 Determinizm i golden — jak to pokazano

1. `tools/mission-hashes.ts` przed zmianą i po niej: `diff` pusty (45 strategii I–XII, wynik, czas, pieczęcie,
   hash).
2. `npm test`: 579 passed, 0 failed. W tym `CONTRACT_GOLDEN` (wszystkie misje I–XV, z 2 wozami i bez, hash co
   4 min), `V4_GOLDEN`, testy drabin lekcji.
3. Prototyp: każdy wiersz grany dwa razy (ten sam hash) i trzeci raz z `serialize → deserialize` w 3:00 (ten sam
   hash). 27/27 wierszy „same | same” (i drugie 27 z `--chain`).
4. Nowy kod jest wyłącznie za warunkami „klucz istnieje” (`m.extraContracts`, `m.firstCastle === b.id`,
   `TWO_CASTLES.chainPriority`), żadna nowa iteracja nie dotyka RNG, żadnych Map w stanie.

Nowa misja XVI dostanie po prostu własne wpisy w `CONTRACT_GOLDEN` (test sam tego wymaga: liczy misje z `MISSIONS`)
— „starsze wpisy się nie zmieniły”, jak przy XIII–XV.

## 2. UI i diagnoza

### 2.1 „Który zamek ten przestój boli?”

To jest serce lekcji i dziś go brak. Proponuję:

- **Nowa odczytowa diagnoza (bez zmiany sim)**: `castleRival(world, castleId)`. Zamek czeka na towar g, a wozy
  wiozą g (albo producent zarezerwował g) **do drugiego zamku**. Karta zamku nad łańcuchem: „Deski jadą teraz pod
  Zamek Północny (2 wozy) — tu brakuje 9 do 5:00” + przycisk „Najpierw ten zamek”. To odpowiednik `sharedInput`
  (F3, D-38) dla zamków. `contestedBy` w sim zostaje wąskie, bez zmian hashy (jak przy F3).
- **Karta producenta** (tartak): „Deski dla: Zamek Wschodni 14/24 (do 5:00) · Zamek Północny 11/30 (do 9:00)”.
  Jedno spojrzenie mówi, kto bierze towar. Kolor/pinezka przy zamku zagrożonym spóźnieniem.
- **Wóz**: etykieta ładunku już pokazuje cel; wystarczy nazwa zamku zamiast „Zamek” (`Zamek Wschodni`,
  `Zamek Północny` — nazwy w i18n).
- **Pinezka przestoju** nad zamkiem, który przekroczy termin przy obecnym tempie (z prognozy), nie nad oboma.

Test < 30 s: gracz widzi czerwony wczesny zamek → tap → „deski jadą pod drugi zamek” → przycisk. Dwa tapy.

### 2.2 Karta tempa i list przewozowy

- `contractForecast(world, log, needOf)` ma już parametr zawężający zamówienie (używany dla transz). Wystarczy
  liczyć go **per zamek** (`need` danego zamku, magazyn danego zamku). Pula „dwa towary z jednego wejścia” z m9
  przenosi się na „ten sam towar dla dwóch zamków”: tempo tartaku dzielone między zamki wg bieżącego trybu (po
  równo / najpierw wybrany). Bez tego prognoza wczesnego zamku będzie optymistyczna.
- **List przewozowy (HUD)**: dwa wiersze zamiast jednego, każdy z ikoną zamku, paskiem, terminem i stanem („na
  czas” / „spóźni się o 0:40”). Pieczęcie wspólne nad oboma. W wersji złożonej (pieczęć) — wypełnienie liczone z
  obu. Wymaga zrzutów 412×915, 915×412, 904×1000; złożony list nie może urosnąć o więcej niż jeden wiersz (~28 px).
- **Przełącznik priorytetu**: na karcie zamku, nie w HUD. Mosiężna pieczęć „Najpierw” (ikona drzeworytnicza
  z chorągwią), stan widoczny też na liście przewozowym (mała chorągiew przy wierszu). Cel dotyku ≥ 48 dp.
  Jedno kliknięcie przełącza; drugi zamek traci znacznik.

### 2.3 Listy (otwarcie / koniec)

- Otwarcie: dwóch nadawców albo jeden posłaniec z dwiema pieczęciami. Treść niesie termin każdego zamku i pokusę
  („obaj panowie chcą desek z jednego tartaku”).
- Koniec: zdanie mówi, **który** zamek czekał („Wschodni dostał deski po terminie — Północny miał czas do 9:00”).
  Potrzebny nowy kształt listu (`won[1..3]` + wariant „spóźniony zamek”); ~20 języków w `letters.ts`.
- Kronika końcowa (`topStallCauses`): klucze przestojów już są per budynek, więc zamek zagrożony pojawi się sam.

## 3. Projekty misji

Wszystkie trzy na suchej dolinie `valley-m3` (jak III, X–XV): bez nowego terenu i bez nowego golden terenu. Wspólne:
długa droga w osi y=40, stajnia (46,35), Zamek Wschodni (84,42) = główny kontrakt, Zamek Północny (62,27) na
odnodze (64,31)–(64,40).

### A. „Jeden tartak, dwa listy” — **polecany** (zmierzony)

```text
 27 ....................................................CCCC..........................   C = Zamek Północny
 31 ......................................................@...........................
 35 ....................................HHH...............#...........................   H = stajnia
 37 .......WW...WW......T................@................#...........................   W = drwale
 40 .....##########################################################################...
 41 .............................@..............................................@.....
 42 ............................SSS...........................................CCCC....   S = tartak, C = Zamek Wschodni
```

- **Start**: 2 drwali (po 4 drewna), 1 tartak (4 drewna), 4 wozy, 60 srebra. Bez budowy (albo tylko wóz).
- **Zamówienia**: Wschodni 24 deski **do 5:00**, Północny 30 desek **do 9:00**; koniec 12:00.
- **Lekcja**: wspólny producent, różne terminy → **zdecyduj, kto pierwszy, i zdecyduj wcześnie**.
- **Porażka „nic nie robię”**: podział po równo, Wschodni dostaje 24 deski o 6:58 (spóźniony list), 1★.
- **Zła poprawka**: kupić wóz bez priorytetu. Szybciej, ale nadal równo, Wschodni o 6:42 → 1★. To jest pokusa
  „Kup wóz” z D-127, tu uczciwie zła.
- **Pomiary** (`two-castles-proto.ts`, progi robocze 3★ 7:00 / 2★ 9:00, −1 za spóźniony list):

| Strategia | Koniec | Wschodni gotowy | Spóźniony | Pieczęcie |
|---|---:|---:|---|---:|
| nic | 7:40 | 6:58 | Wschodni | 1 |
| najpierw Wschodni @0:00 / @1:00 / @1:30 | 7:15 | 4:47 | — | 2 |
| najpierw Wschodni @2:00 | 7:56 | 5:16 | Wschodni | 1 |
| najpierw Północny @0:00 (zły wybór) | 7:30 | 7:30 | Wschodni | 1 |
| +1 wóz @0:30, bez priorytetu | 7:08 | 6:42 | Wschodni | 1 |
| **+1 wóz @0:30 i najpierw Wschodni** | **6:43** | **3:44** | — | **3** |

- **Proponowane progi**: 3★ do **7:05**, 2★ do 9:00, koniec 12:00. Margines 3★: +22 s dla dobrej strategii,
  sam priorytet −10 s. Jest wąsko, do strojenia drabiną (jak `m14-ladder.ts`) przed wydaniem; przegląd
  `--sweep`: przy Północnym 24 deski sam priorytet daje już 3★ (za łatwo), przy 36 nawet dźwignia + wóz to 2★
  (za trudno). Zostaje **30**.
- Okno decyzji: priorytet ustawiony do ~1:50 działa tak samo jak o 0:00; później nie ratuje wczesnego listu.
  Termin Wschodniego 5:30 poszerza okno do ~2:00, ale wtedy sam priorytet w 2:00 też ratuje list (łatwiej).

### B. „Jedna stajnia, dwa łańcuchy” — zmierzony, **nie polecam w tej postaci**

- **Mapa**: drwale + tartak na zachodzie (dla Północnego), pole (56,48) → młyn (66,42) → piekarnia (72,42) na
  wschodzie (dla Wschodniego). Wspólne są tylko 3 wozy.
- **Zamówienia**: Wschodni 20 chleba do 6:00, Północny 30 desek do 8:00.
- **Wynik**: priorytet ostatniego odcinka **nic nie zmienia** (7:42 w każdym wariancie, Wschodni zawsze spóźniony),
  bo wąskim gardłem jest dowóz zboża i mąki (`prio 1`), a nie ostatni odcinek. Jeden kupiony wóz rozwiązuje
  wszystko (5:15, 3★). To jest lekcja „kup wóz”, którą gra już ma. Z priorytetem łańcuchowym jest gorzej: 9:22,
  oba listy spóźnione.
- **Co by ją uratowało**: zakaz kupna wozów (brak srebra) i ręczne przypisanie wozów do zamku. To nowa mechanika
  („wozy tego zamku”), której nie polecam teraz.

### C. „Drewno na dwa listy” — zmierzony, **na później**

- **Mapa**: 2 drwali na zachodzie, tartak (38,42) i smolarnia (52,42) — obie żyją z tego samego drewna (znany z
  doliny `CONTESTED`). Wschodni chce 30 desek do 5:00, Północny 10 węgla do 8:00.
- **Wynik**: bez działania 6:45, 2★ (Wschodni spóźniony). Priorytet ostatniego odcinka **szkodzi** (7:05, 1★),
  priorytet łańcuchowy lepiej trzyma Wschodni (5:49 przy ustawieniu w 1:00), ale głodzi Północny, więc nadal 1★.
  Wóz: 2★.
- **Wniosek**: ciekawa lekcja („drewno jest wspólne dla dwóch zamków”), ale wymaga priorytetu łańcuchowego i jego
  czytelnej diagnozy („młyn stoi, bo drewno idzie na deski dla Zamku Wschodniego”). Kandydat na XVII, po
  playteście A.

## 4. Szacunek prototypu i rekomendacja

| Opcja | Zakres | Pliki | Ryzyko | Nakład |
|---|---|---|---|---|
| 1. Dwa zamki bez dźwigni | `extraContracts`, podział po zapełnieniu, lekcja tylko przez budowę (np. drugi tartak przy zamku) | sim: types, contract, logistics, wagons, sim, missions (`MissionDef.castles`), saveGate; UI: hud (2 wiersze), pace/paceCard per zamek, letters, menu, i18n | niskie dla sim; lekcja „postaw drugi tartak” powtarza X i XIV | 1,5–2 sesje |
| **2. + „Najpierw ten zamek”** (polecana) | jak 1 + `firstCastle`, komenda `castleFirst`, `castleRival` w diagnozie, przełącznik na karcie zamku, ikona | jak 1 + commands.ts, replay (komenda), diagnose.ts, stallKinds/stalls, panels/app (karta zamku), ikona drzeworytnicza, `tests/two-castles.test.ts`, `tools/bot-m16.ts` + drabina | średnie: wąskie progi (§3 A), okno decyzji ~1:50 wymaga wyraźnego sygnału od 0:00; zrzuty HUD z dwoma wierszami | 2–3 sesje |
| 3. + priorytet łańcuchowy | jak 2 + `prio 0.5` dla warsztatów pod wybranym zamkiem, diagnoza „warsztat stoi, bo łańcuch obsługuje drugi zamek” | jak 2 + forecast (pula łańcucha), nowa przyczyna w diagnozie | wysokie: w prototypie głodzi drugi zamek (B, C), nieprzejrzyste dla gracza | +2 sesje |

Kod sim z prototypu (commit `EXPERIMENTAL: two-castle orders…`) to ~100 linii (z flagą łańcuchową) i jest dobrym punktem startu dla opcji
2. Przed scaleniem trzeba: przenieść ustawienie zamówień z narzędzia do `MissionDef` (np. `castles?: { need,
dueMin }[]`, gdzie pierwszy zamek = główny), dodać komendę zamiast bezpośredniego zapisu pola, walidację w
`saveGate`, oraz poprawić `diagnose.ts` (`outputCustomer`, `outputSurplus`, `contractFilled`, `stoneInStore` mają
jeszcze `st.mission.contract` na sztywno — dla jednego zamku wynik ten sam, dla dwóch błędny). Flaga
`TWO_CASTLES.chainPriority` do usunięcia, jeśli opcja 3 odpadnie.

Kolejność pracy dla opcji 2: (1) sim + komenda + test determinizmu + golden XVI, (2) bot i drabina A, strojenie
progów, (3) `castleRival` + karta zamku + przełącznik, (4) list przewozowy z dwoma wierszami + zrzuty, (5) listy
i i18n.

## 5. Pytania do właściciela (z rekomendacją)

1. **Czy robimy „dwa zamki” jako XVI?** Tak — opcja 2, projekt A. *Rekomendacja: tak.*
2. **Dźwignia gracza.** (a) przełącznik „Najpierw ten zamek” na karcie zamku, (b) brak dźwigni — tylko budowa i
   drogi, (c) ręczne przypisanie wozów do zamków. *Rekomendacja: (a).* (b) powtarza lekcję X/XIV, a (c) to nowa
   mechanika floty z dużym UI.
3. **Pieczęcie.** (a) wspólne za misję: czas ostatniej dostawy, −1 za każdy zamek po swoim terminie (reguła listów
   z V/XV), (b) osobne pieczęcie dla każdego zamku. *Rekomendacja: (a).*
4. **Priorytet dyspozytora bez decyzji gracza.** (a) podział po zapełnieniu (oba rosną równo — wczesny zamek się
   spóźnia), (b) sam wybiera wcześniejszy termin. *Rekomendacja: (a)* — przy (b) „nic nie robię” wygrywa i lekcja
   znika.
5. **Zasięg priorytetu.** (a) tylko ostatni odcinek (wozy z gotowym towarem), (b) cały łańcuch. *Rekomendacja:
   (a)* teraz; (b) dopiero z misją C po playteście.
6. **Wersja zapisu.** (a) podbić `STATE_VERSION` do 10 (migracja-tożsamość, `mission-hashes` haszuje z
   `version: 0`), (b) bez podbicia, same opcjonalne pola. *Rekomendacja: (a)* — stara gra nie wczyta zapisu XVI,
   a dowód niezmienności zostaje dosłowny.
7. **Nazwy i miejsce w menu.** „Dwa zamki” (podtytuł „Kto pierwszy, ten na czas”), zamki „Wschodni” i „Północny”,
   na końcu listy jako XVI. *Rekomendacja: tak, na końcu* (bez zmiany numeracji i kluczy zapisów).
8. **Progi A.** 3★ do 7:05, 2★ do 9:00, koniec 12:00, Północny 30 desek. Zaostrzyć/poluzować teraz czy po drabinie?
   *Rekomendacja: przyjąć roboczo, ostatecznie po drabinie i playteście* (margines 3★ to dziś +22 s).
