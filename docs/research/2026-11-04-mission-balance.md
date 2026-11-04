# Balans misji I–XII po zmianach z 2026-11-03 (badanie, noc 6)

> Badanie, nie zmiana gry: żaden plik `src/` nie jest zmieniony. Narzędzia: `tools/balance-night6.ts`
> (ankieta strategii), `tools/balance-night6-tune.ts` (kandydaci na retuning, łatki tylko w pamięci procesu),
> `tools/balance-night6-probe.ts` (przemiatanie liczby wozów, M1), `tools/mission-hashes.ts` (hasze strategii
> autorskich). Czasy w minutach symulacji; marginesy w sekundach jako „do 3★ / do 2★” (plus = zapas,
> minus = brakuje tylu sekund).

## TL;DR

1. **Misje są nietknięte przez wczorajsze zmiany.** Wszystkie 45 strategii autorskich (balance.ts M1–M6,
   bot-missions 7–9 i 10–12) dają **identyczny hasz stanu, czas i pieczęcie** na `5c31a4a` (przed 11-03) i na `HEAD`
   (`3fda18a`). Reguła „ładunek ≥ 4” (D-94) działa tylko w dolinie. `npm test -- missions`, `docs-numbers`, `m1-eye` — zielone.
2. **Zmieniły się natomiast wyniki „rozsądnego gracza”**, bo poprawki diagnozy zmieniły ranking i lekarstwa
   w karcie najgorszego przestoju: M4 (oko+ 30 s: 1★ → 2★, skan: 1★ → 3★), M8 (oko 30 s: 2★ → 3★), M12 (oko 60 s: 1★ → 3★),
   ale M12 (oko 30 s: 3★ → 2★) i M6 (skan: 2★ → 1★) w dół.
3. **M1 (samouczek): 3★ jest nieosiągalne.** Najlepszy znaleziony plan (most + 4 wozy, czyli całe srebro) kończy w 8,85 min przy progu 7:00.
4. **Odpowiedź na liczbę wozów jest niemonotoniczna i „na ostrzu noża”.** M4: 4 wozy → 10,78 (1★), 5 wozów → 6,52 (**3★ bez lekcji**), 6 wozów → 10,64 (1★).
   W M2, M8 i M9 jeden czy dwa dokupione wozy **pogarszają** wynik względem braku działania.
5. **Wyszukiwarka luk podsuwa w M5 i M6 drogę ukośną, która psuje lekcję:** w M6 sugerowane połączenie dużego spichlerza daje 9,10 min (1★, wolniej niż bezczynność: 8,92),
   prosta droga przez te same 2 pola daje 8,31 (3★).
6. **Lekcje, których karta najgorszego przestoju nie pokazuje:** M2 (zator na moście nie trafia na kartę: na 10-sekundowych spojrzeniach 52 z 63 kart to spokojny przestój farmy),
   M3 (błoto nie jest przestojem), M7 (gdzie postawić rybaka), M9/M10 (`CONTESTED` trwa za krótko, by wejść na kartę), M8 (lekcję zastępuje kupowanie wozów).
7. Żadna misja nie daje 3★ pasywnie. Najbliżej 2★ bez działania są M6 (−4 s), M8 (−12 s), M12 (−16 s) i M5 (−19 s).
   **Za łatwa jest M8**: 10 z 12 strategii ma 3★, w tym każdy gracz, który tylko klika „Kup wóz”.
   **Za trudne dla rozsądnego gracza są M1, M6, M9 i M10**: przy reakcji co 30 s z samą kartą wynik to 1★, 1★, porażka i porażka.

## 1. Weryfikacja: czy zmiany z 11-03 ruszyły misje

| Sprawdzenie | Wynik |
|---|---|
| `tools/mission-hashes.ts` na `git archive 5c31a4a` i na HEAD (45 strategii M1–M12) | `diff` pusty: hasze, czasy, pieczęcie identyczne |
| `npm test -- missions` / `docs-numbers` / `m1-eye` | 29/0, 3/0, 1/0 |
| `npm run bot` (M1) | wygrana 8,85 min, 2★, 26 srebra (jak w D-94) |

Zmiany z 11-03 w `src/sim` (D-94 `topUpHold` tylko dla `sandbox`, D-97 próg rangi, D-95 i poprawki audytu jako
odczyt diagnozy) nie zmieniają przebiegu żadnej misji. **Zmienia się jednak to, co gracz widzi i co UI mu podsuwa.**
Ten sam rozsądny gracz na starym UI (`stalls.ts` z `5c31a4a` i z wklejonym tam ówczesnym `gapTarget` z `panels.ts`)
wypada tak (pokazane są tylko różnice):

| Misja / gracz | UI 11-02 | UI dziś | Powód (prawdopodobny) |
|---|---|---|---|
| M4 oko+ 30 s / 60 s | 11,29 (1) / 11,63 (1) | 9,48 (2) / 7,97 (2) | poprawka 2: zatrzymane wozy widoczne jako przyczyna, a nie „brak wozu” |
| M4 skan+ 30 s | 11,29 (1) | 6,83 (3) | jw. |
| M8 oko 30 s | 10,01 (2) | 9,40 (3) | spokojny kamieniołom (D-95): wóz trafia do tartaku |
| M12 oko 60 s | 10,71 (1) | 8,80 (3) | poprawka 3: pełny spichlerz wskazuje niepodłączony; link już w 1:00, a nie w 3:00 |
| M12 oko 30 s | 8,73 (3) | 9,16 (2) | spokojne `STORAGE_FULL` ukrywa jedno „Kup wóz” (3 wozy → 2) |
| M6 skan+ 30 s | 8,71 (2) | 9,10 (1) | nowe lekarstwo „spichlerz” w 6:00 to niepotrzebny wydatek |
| M1 oko 10 / 30 s | 10,13 / 10,50 | 10,56 / 9,65 | inna kolejność kupowania wozów; za każdym razem 1★ |

Bilans: wczorajsze poprawki pomagają tam, gdzie były wymierzone (M4, M12, M8), a pogorszenia mieszczą się w szumie
(jeden wóz mniej, jeden zbędny spichlerz). Nie trzeba ich cofać.

## 2. Metoda

Każda misja przechodzi przez te same strategie (`tools/balance-night6.ts`; 12 misji, łącznie ok. 35 s):

- **pasywny**: brak jakiegokolwiek polecenia;
- **same wozy**: k = 1…8 wozów w 0:00, raportowane najlepsze k (to uogólnienie „złej naprawy”);
- **sama lekcja @0:00**: zamierzona naprawa z `docs/missions/mN.md`, ponawiana co sekundę, aż wejdzie
  (np. bruk w M8 wchodzi dopiero, gdy jest kamień: 3:00–3:01);
- **optimum siatki**: lekcja w T ∈ {0, 10, 20, 30, 45, 60} s plus k = 0…8 wozów w 0:00; najszybsza wygrana.
  To dolna granica możliwości, nie dowód optymalności (M8: gracz z listem kończy w 8,79, siatka w 9,14);
- **oko-N** („rozsądny gracz”): co N = 10/30/60 s otwiera kartę najgorszego przestoju (`rankStalls()[0]`) i naciska
  w arkuszu „Naprawa”. To dokładnie to, co pokazuje UI: droga z wyszukiwarki luk (`gapTarget` → `suggestLinkToStable`),
  „Kup wóz” (`cureFor = 'wagon'`) albo spichlerz (`'granary'`, tam gdzie wolno go budować; miejsce szukane spiralnie
  od bramy przyczyny i od razu dowiązywane drogą). Model jest ten sam co w `tests/m1-eye-fix.test.ts`;
- **oko+-N**: jak oko-N, ale gracz wykonuje też **tekstowe** podpowiedzi arkusza. Przy zatorze lub lodzie
  (`fix.jamStone`, `wagon.iceHint`) brukuje przęsło kamieniem. Przy wspólnym surowcu od jednego producenta
  (`why.shared` / `why.sharedOne`, `why.thin`) stawia drugiego takiego producenta, jeśli misja na to pozwala;
- **skan+ 30 s**: jak oko+, ale przechodzi pieczęcią alarmu po kolejnych pinezkach i bierze pierwszą, która coś proponuje;
- **list@1:00 + oko+ 30 s**: czyta list kontraktu (naprawa z dokumentu misji w 1:00), potem gra jak oko+ 30 s.

Ograniczenia: rozsądny gracz wykonuje jedno działanie na spojrzenie i nie planuje. Miejsce nowego budynku wybiera
heurystyka (`placeNear`), więc w M10 drwal stoi gorzej niż w miejscu autorskim. Jest jeden seed na misję
(misje mają stałe seedy).

## 3. Tabela misji (czas min (pieczęcie) i marginesy do 3★/2★ w sekundach)

P = porażka. Marginesy podane są dla strategii nieoczywistych; pełne liczby są w wyjściu narzędzia.

| Misja | 3★/2★/termin [min] | pasywny | same wozy (najlepsze k) | sama lekcja @0:00 | optimum siatki | oko 10/30/60 s | oko+ 10/30/60 s | skan+ 30 s | list@1:00 + oko+ 30 s |
|---|---|---|---|---|---|---|---|---|---|
| I | 7/9/12 | P | P (bez mostu) | P (bez wozów) | 8,85 (2) −111/+9 lekcja+4 w | 10,56 (1)/9,65 (1)/P | 10,56 (1)/9,65 (1)/P | 9,53 (1) | 11,22 (1) −254/−134 |
| II | 8,75/9,75/12 | 10,81 (1) −124/−64 | 8,79 (2) −2/+58 k=3 | 9,70 (2) −57/+3 | 8,24 (3) +30/+90 lekcja@20 s | 10,76 (1)/10,01 (1)/10,81 (1) | 8,88 (2)/10,01 (1)/10,81 (1) | 9,62 (2) | 9,60 (2) −51/+9 |
| III | 6,25/8/11 | 8,57 (1) −139/−34 | 6,74 (2) −29/+76 k=7 | 6,73 (2) −29/+76 | 5,34 (3) +54/+159 lekcja@10 s+1 w | 8,15 (1)/9,30 (1)/7,66 (2) | 8,15 (1)/9,30 (1)/7,66 (2) | 7,98 (2) | 5,49 (3) +46/+151 |
| IV | 7/9,5/12,5 | 11,65 (1) −279/−129 | **6,52 (3) +29/+179 k=5** | 7,01 (2) −0/+150 | 5,98 (3) +61/+211 lekcja@10 s+3 w | 10,56 (1)/11,81 (1)/11,43 (1) | 10,56 (1)/9,48 (2)/7,97 (2) | 6,83 (3) | 6,59 (3) +25/+175 |
| V | 8,5/9,3/11 | 9,61 (1) −67/−19 | **7,94 (3) +34/+82 k=6** | 9,41 (1) −55/−7, list spóźniony | 6,84 (3) +100/+148 lekcja+5 w | 7,48 (3)/8,72 (2)/9,24 (2) | 7,48 (3)/8,72 (2)/9,24 (2) | 8,72 (2) | 8,41 (2) +5/+53, list spóźniony |
| VI | 8,45/8,85/11 | 8,92 (1) **−28/−4** | 8,68 (2) −14/+10 k=4 | 8,31 (3) +8/+32 | 7,88 (3) +34/+58 lekcja+3 w | 9,10 (1)/9,10 (1)/9,10 (1) | 9,10 (1)/9,10 (1)/9,10 (1) | 9,10 (1) | 8,63 (2) −11/+13 |
| VII | 7,5/9,5/12 | 10,90 (1) −204/−84 | 10,90 (1) k=1 | 6,27 (3) +74/+194 | 5,91 (3) +96/+216 lekcja+2 w | 10,90 (1) ×3 | 10,90 (1) ×3 | 10,90 (1) | 6,91 (3) +35/+155 |
| VIII | 9,7/10,3/13 | 10,50 (1) −48/−12 | **9,42 (3) +17/+53 k=6** | 10,29 (2) −35/+1 | 9,14 (3) +34/+70 lekcja+5 w | 9,28 (3)/9,40 (3)/9,40 (3) | 9,07 (3)/9,40 (3)/9,40 (3) | 8,77 (3) | 8,79 (3) +54/+90 |
| IX | 9,2/10,8/13 | 11,22 (1) −121/−25 | 9,30 (2) −6/+90 k=5 | 9,96 (2) −46/+50 | 7,35 (3) +111/+207 lekcja@45 s+6 w | 12,12 (1)/**P**/12,21 (1) | 8,35 (3)/**P**/12,21 (1) | 12,95 (1) | 8,63 (3) +34/+130 |
| X | 9,3/10,3/12 | P | 10,44 (1) −68/−8 k=1 | 9,94 (2) −38/+22 | 6,23 (3) +184/+244 lekcja@20 s+6 w | 11,71 (1)/P/P | 10,41 (1)/P/P | P | 9,13 (3) +10/+70 |
| XI | 9,4/10,3/12 | 10,94 (1) −92/−38 | 8,88 (3) +31/+85 k=5 (= lekcja) | — | = same wozy | 9,87 (2)/10,12 (2)/10,94 (1) | jak oko | 10,12 (2) | — |
| XII | 9/10,1/12 | 10,36 (1) −82/−16 | 10,10 (2) −66/+0 k=6 | 8,52 (3) +29/+95 | 7,33 (3) +100/+166 lekcja+3 w | 7,67 (3)/9,16 (2)/8,80 (3) | jak oko | 8,81 (3) | 8,57 (3) +26/+92 |

### Ile strategii (z 12; w XI z 9) osiąga daną liczbę pieczęci

| Misja | ≥1★ | ≥2★ | 3★ | Kto ma 3★ |
|---|---|---|---|---|
| I | 7 | 1 | **0** | nikt |
| II | 12 | 6 | 1 | tylko optimum (kamienny most w 0:20) |
| III | 12 | 7 | 2 | optimum, gracz z listem |
| IV | 12 | 7 | 4 | **same 5 wozów**, optimum, skan+, list |
| V | 12 | 10 | 4 | **same 6 wozów**, optimum, oko 10 s (×2) |
| VI | 12 | 4 | 2 | sama lekcja, optimum (prosta droga, nie ta z wyszukiwarki luk) |
| VII | 12 | 3 | 3 | tylko z rybakiem nad wodą (lekcja, optimum, list) |
| VIII | 12 | 11 | **10** | **wszyscy poza pasywnym i „samą lekcją”** |
| IX | 10 | 5 | 3 | optimum, oko+ 10 s, list |
| X | 6 | 3 | 2 | optimum, list |
| XI | 9 | 6 | 1 | 5 wozów (to jest lekcja) |
| XII | 12 | 11 | 8 | prawie wszyscy, zawsze po podłączeniu spichlerza |

## 4. Krzywa trudności I → XII

Jako miarę biorę pieczęcie rozsądnego gracza (oko 30 s / gracz z listem) i zapas optimum do 3★:

| | I | II | III | IV | V | VI | VII | VIII | IX | X | XI | XII |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| oko 30 s | 1 | 1 | 1 | 1 | 2 | 1 | 1 | **3** | **0** | **0** | 2 | 2 |
| list + oko+ 30 s | 1 | 2 | 3 | 3 | 2 | 2 | 3 | 3 | 3 | 3 | (2) | 3 |
| zapas optimum do 3★ [s] | **−111** | +30 | +54 | +61 | +100 | +34 | +96 | +34 | +111 | +184 | +31 | +100 |

- Krzywa **nie rośnie**. Najtrudniejsza dla 3★ jest misja I (samouczek), a najłatwiejsza VIII. IX i X to urwisko dla gracza,
  który reaguje tylko na kartę: dopiero tam karta nie prowadzi do lekcji, a „Kup wóz” wręcz szkodzi.
- Zapas optimum do 3★ rośnie od V do X (+100 … +184 s). Eksperci będą mieli 3★ łatwo, a o trudności tych misji
  decyduje to, czy gracz **odkryje** naprawę, nie to, jak dobrze ją wykona. To zgodne z ideą gry („diagnoza, nie wykonanie”),
  ale tylko wtedy, gdy diagnoza w UI do naprawy prowadzi (patrz §5).
- Dla gracza z listem (oko+ 30 s) krzywa jest płaska: 2–3★ od II do XII. Kto czyta list, nie napotyka ściany.

## 5. Gdzie „najgorszy przestój” prowadzi źle

1. **M9: „Kup wóz” prowadzi do porażki.** Gracz oko 30 s kupuje wozy w 2:30, 3:30, 6:00 i 7:30 (karta: zamek `NO_WAGON.ALL_BUSY`) i przegrywa
   (13:00), choć bezczynny gracz wygrywa w 11,22. Przemiatanie: 0 wozów 11,22, 1 wóz **12,93**, 2 wozy 12,48. Więcej wozów to częstsze
   kursy po drewno do węglarza, który wygrywa rywalizację z tartakiem. `sawmill NO_INPUT.CONTESTED` prawie nigdy nie jest
   pierwszą kartą: przy spojrzeniu co 30 s gracz widzi go dopiero w 10:00.
2. **M10: lekcja (`CONTESTED`) trwa za krótko, by wejść na kartę.** Przy spojrzeniu co 30 s tartak z `CONTESTED` jest kartą
   tylko raz, w 8:00. Wcześniej karta pokazuje spokojny przestój węglarza „brak odbiorcy” albo nie ma jej wcale (50 z ok. 70 spojrzeń co 10 s).
   Sama zmiana kolejności (`CONTESTED` na górę) **nic nie daje**, bo w chwili spojrzenia tego stanu po prostu nie ma.
3. **M5 i M6: wyszukiwarka luk podsuwa połączenie ukośne** (nowe pola (38,38) i (39,39), węzeł na (40,40), bliżej stajni)
   zamiast prostego (37,38) i (37,39). Cena ta sama (2 srebra). Skutek:
   M6 9,10 min (1★, gorzej niż bezczynność 8,92) zamiast 8,31 (3★). M5 z jednym wozem: 9,13 (2★) zamiast 8,04 (3★). Działa to tak:
   `suggestConnection` liczy koszt od strony stajni (`EXISTING_ROAD = 0.01` za każde istniejące pole), więc wybiera
   węzeł bliżej stajni, a dalej od tartaku, który do spichlerza wozi.
4. **M2: zator na moście nie trafia na kartę.** Na kartę trafiają tylko budynki, a budynki za zatorem pokazują „czeka na dostawę”
   (to nie przestój) albo spokojne „brak odbiorcy” (farma; 52 z 63 kart przy spojrzeniu co 10 s). Oko 10/30/60 s → 1★.
5. **M8: karta uczy „kup wóz”, nie „bruk”.** Gracz kupujący wozy z karty ma 3★ przy każdym tempie, przy dowolnej ilości srebra od 120 do 410.
   Sama lekcja (bruk w 3:01) skraca misję tylko o 13 s (10,29 wobec 10,50).
6. **M1, oko 60 s: porażka.** Most powstaje w 1:00, a wozy dopiero między 4:00 a 12:00, bo karta przez kilka minut pokazuje spokojne
   `WAITING_PICKUP` farmy i drwala, a „Kup wóz” pojawia się rzadko. To skrajny przypadek, ale w samouczku.
7. **Ogólnie spokojne przestoje zajmują kartę.** Spokojne przestoje (`WAITING_PICKUP`, `OUTPUT_FULL.*` z adnotacją)
   to w większości misji ponad połowa spojrzeń. Karta jest wtedy prawdziwa, ale bez działania, a pieczęć alarmu
   (skan) poprawia wynik tylko w M2, M4 i M8.

## 6. Najważniejsze problemy (kolejność wg wagi)

1. **Chaotyczna odpowiedź na wozy i na moment działania.** M4: 0–4 wozy → 1★, 5 wozów → 3★, 6 wozów → 1★ (zapas drewna
   w spichlerzu przed lodem trafia się albo nie). M2: 1 wóz 11,18 wobec 0 wozów 10,81. M8: 4–5 wozów 11,13 wobec 10,50.
   M12: lekcja w 1:00 daje 8,22, w 1:30 już 9,57. M10: lekcja w 0:00 daje 9,94, w 0:20 8,34. Gracz nie nauczy się, że „więcej wozów = szybciej”,
   bo w połowie misji to nieprawda, a wynik zależy od zbiegów okoliczności w dyspozytorze.
2. **M1: 3★ nieosiągalne** (najlepsze 8,85 przy progu 7:00; 2★ z zapasem +9 s, tylko przy wydaniu całego srebra).
3. **Wyszukiwarka luk psuje lekcje M5 i M6** (§5.3).
4. **M8 i M4: lekcję omija samo kupowanie wozów** (M8 zawsze; M4 przy dokładnie 5 wozach). W M5 to samo: 6 wozów → 3★,
   a samo podłączenie spichlerza → 1★ ze spóźnionym listem.
5. **IX i X: rozsądny gracz przegrywa**, bo karta nie pokazuje wspólnej podaży (§5.1–2).
6. **Ciasne okna:** M6 ma 24 s między 3★ a 2★, a bezczynność jest 4 s od 2★. W M8 „sama lekcja” mieści się w 2★ z zapasem 1 s.

## 7. Propozycje retuningu

Każda propozycja jest zmierzona tymi samymi graczami (`npx tsx tools/balance-night6-tune.ts`; progi pieczęci nie zmieniają przebiegu,
więc ich skutek liczę z czasów). „Hasze” oznacza złote hasze, które zmiana by unieważniła:
`V4_GOLDEN` w `tests/chains.test.ts` (M1–M6) oraz hasze strategii autorskich z `tools/mission-hashes.ts`.
Progi i srebro są w stanie (`mission.contract.star*Tick`, `coins`), więc każda zmiana danych misji zmienia hasze **wszystkich** jej strategii.

### P1. M1: progi 3★ 7:00 → **9:15**, 2★ 9:00 → **10:45** (`src/sim/missions.ts`: `star3Min: 9.25, star2Min: 10.75`)

| gracz | dziś | po zmianie |
|---|---|---|
| optimum = `npm run bot` (most + 4 wozy) | 8,85 (2) | **3★** (+24 s) |
| oko 10 / 30 s, skan | 10,56 (1) / 9,65 (1) / 9,53 (1) | **2★** (+11 / +66 / +73 s) |
| list + oko 30 s | 11,22 (1) | 1★ |
| oko 60 s | P | P (gracz, który patrzy co minutę, i tak przegrywa samouczek; do rozważenia osobno) |

Sprawdziłem też więcej srebra (240) i 3 wozy na start: optimum 8,27–8,72 nadal nie mieści się w 7:00, a rozsądny gracz zostaje
przy 1★. Tańsze jest przesunięcie progów. **Hasze:** `V4_GOLDEN` m1 ×3 (`nothing`, `wooden bridge`, `bridge + 2 wagons`).
Do poprawy także `npm run bot` w CLAUDE.md/D-94 („2 seals”) i ewentualne liczby w `tests/docs-numbers.test.ts` i w liście M1.

### P2. Wyszukiwarka luk: węzeł po stronie towaru, nie stajni (`src/sim/repair.ts`, odczyt dla UI)

Zmiana: `EXISTING_ROAD = 0.01 → 0` oraz +0,02 za krok po przekątnej na nowe pole
(`const nd = dist[u]! + cellCost(v) + (d >= 4 && !st.roads[v] ? 0.02 : 0)`). Łatkę sprawdziłem lokalnie i cofnąłem.
Link do dużego spichlerza to wtedy (36,38) i (36,39), prosto w dół do traktu, po stronie tartaku.

| oko 10/30/60 s | dziś | z łatką |
|---|---|---|
| M5 | 7,48 (3) / 8,72 (2) / 9,24 (2) | 8,29 (3) / 8,04 (3) / 8,48 (3) |
| M6 | 9,10 (1) ×3 | 8,37 (3) / 8,37 (3) / 8,39 (3) |
| M12 | 7,67 (3) / 9,16 (2) / 8,80 (3) | 8,05 (3) / 8,56 (3) / 9,40 (2) |
| M1 | 10,56 (1) / 9,65 (1) / P | 10,06 (1) / 9,91 (1) / 11,38 (1) |

`tests/m1-eye-fix.test.ts` przechodzi. **Hasze: żadne.** `suggestConnection` to odczyt, a strategie autorskie
go nie wołają. Zastrzeżenie: o remisie decyduje kolejność w kopcu (zachód przed wschodem). Sama kara za przekątną
(bez `EXISTING_ROAD = 0`) dała tylko M6 2★ i gracza z listem 1★, a skan w M6 z pełną łatką spada do 1★ (9,29).
Pewniejsza wersja reguły: wybierać węzeł najbliższy **dostawcy** towaru, który ma trafić do celu (dla spichlerza: producent
z `OUTPUT_FULL`), a nie stajni. Wymaga to drugiego przebiegu Dijkstry.

### P3. M4: srebro 180 → **140**, 3★ 7:00 → **7:30**, 2★ 9:30 → **10:00** (`src/sim/missions-s2.ts`, `m4`)

| gracz | dziś | po zmianie |
|---|---|---|
| same wozy (najlepsze) | 6,52 (3), k=5 | 10,16 (1), k=2 (5 wozów niedostępne) |
| sama lekcja @0:00 | 7,01 (2) | **3★** (+29 s) |
| optimum | 5,98 (3), lekcja+3 w | 5,99 (3), lekcja@20 s+1 w |
| list + oko 30 s | 6,59 (3) | 7,15 → **3★** (+21 s) |
| oko+ 30 / 60 s | 9,48 (2) / 7,97 (2) | 2★ (+31 / +122 s) |
| skan+ 30 s | 6,83 (3) | 11,77 (1): brakuje srebra na most po trzech wozach; z kartą z P4 oko 30 s → 7,58 (2★) |
| pasywny | 11,65 (1) | 1★ |

Usuwa obejście lekcji przez 5 wozów i ostrze noża przy 4/5/6 wozach. Kamienny most (87 srebra) i 1–1 wóz nadal się mieszczą.
**Hasze:** `V4_GOLDEN` m4 ×4. Testy `s2-mechanics` i `balance.ts` (oczekiwane `expect`) do przeliczenia; „buy 3 wagons @1:00” pozostaje możliwe (90 ≤ 140).

### P4. Karta „zatrzymane przęsło” (UI, `src/ui/stalls.ts`) i M2 2★ 9:45 → **10:00**

Kandydat: przęsło, na którym wóz stoi ≥ 20 s (`BRIDGE_JAM` / `BRIDGE_CLOSED`), dostaje pinezkę na karcie najgorszego przestoju.
Jej „Naprawa” to wyłożenie przęsła kamieniem (tekst `fix.jamStone` jest już w grze, brakuje tylko przycisku i miejsca na karcie).

| gracz | dziś | z kartą | z kartą + M2 2★ 10:00 |
|---|---|---|---|
| M2 oko 10 / 30 / 60 s | 1 / 1 / 1 | 9,24 (2) / 9,82 (1, **4 s** za 2★) / 10,81 (1) | 2 / **2** / 1 |
| M2 skan+ | 9,62 (2) | 9,63 (2) | 2 |
| M4 oko 30 / 60 s | 11,81 (1) / 11,43 (1) | 7,58 (2) / 7,96 (2) | — |

M2 2★ 10:00 to wartość, którą proponował już raport siatkowy (`docs/balance/REPORT.md`). Pasywny (10,81) zostaje przy 1★,
3 wozy (8,79) przy 2★. **Hasze:** karta żadnych; próg M2: `V4_GOLDEN` m2 ×4.

### P5. Karta „wspólna podaż” (UI): jeden producent dla dwóch odbiorców → „Postaw drugiego <producenta>”

Kandydat: dowolny budynek, dla którego `sharedInput()` zwraca `producers === 1 && consumers >= 2`, dostaje pinezkę krytyczną.
Jej „Naprawa” to tryb budowy producenta tego typu (tylko gdy misja na niego pozwala: IX, X). Diagnoza już to liczy
(`why.sharedOne` pokazuje się w arkuszu), ale nie ma tego na karcie, a sam `CONTESTED` jest zbyt ulotny (§5.2).

| oko 10/30/60 s | dziś | z kartą |
|---|---|---|
| M9 | 12,12 (1) / P / 12,21 (1) | 8,35 (3) / 9,09 (3) / 10,12 (2) |
| M10 | 11,71 (1) / P / P | 10,41 (1) / 9,85 (2) / 10,34 (1, 2 s za 2★) |

**Hasze: żadne** (UI). W M10 zostaje problem miejsca: heurystyka stawia drwala gorzej niż w (12,34). UI powinno podświetlić miejsce
autorskie (jak duch drogi w wyszukiwarce luk). Wtedy będzie 9,94 → 2★ bez wozów.

### P6. M8: to nie problem parametrów, tylko projektu lekcji (zgłoszenie, bez gotowej liczby)

Przemiatałem srebro (120 / 150 / 180 / 230 / 410), zapas kamieniołomu (8 / 16 / 20 / 24) i długość bruku (x45–56 … x30–56).
**Żadna kombinacja nie oddziela lekcji od kupowania wozów.** Gracz klikający „Kup wóz” ma 3★ przy każdym srebrze ≥ 120,
a strategia autorska „wóz + bruk” (9,48) jest wolniejsza niż 6 wozów (9,42). Więcej kamienia w obiegu spowalnia misję,
bo dyspozytor wozi kamień zamiast desek. Samo zaostrzenie 3★ do 9:00 odebrałoby 3★ również strategii autorskiej (9,48), więc go nie proponuję.
Kierunek: błoto musi kosztować więcej niż wóz. Na przykład dłuższa gruntowa trasa, którą da się wybrukować tylko z kamienia z kamieniołomu,
albo kontrakt, w którym deski jadą przez odcinek x45–56 w deszczu przez większość misji. Do sprawdzenia
na `tools/balance-night6.ts m8` z kryterium: „same wozy” ≤ 2★, „lekcja + 1 wóz” 3★ z zapasem ≥ 20 s.

## 8. Co zostaje do decyzji właściciela

- P1 (samouczek z 3★ w zasięgu), P3 (M4) i P4 (próg M2) zmieniają złote hasze i liczby w dokumentach. To trzy osobne commity z aktualizacją `V4_GOLDEN`.
- P2, P4 (karta) i P5 to zmiany UI / odczytu bez zmian haszy. Największy zysk dla „rozsądnego gracza” (M5, M6, M9, M10).
- Chaos wozów (§6.1) nie ma tu gotowej poprawki. Proponuję dodać do `tools/balance.ts` test odporności: każda strategia ±10 s
  i ±1 wóz nie może zmieniać wyniku o więcej niż jedną pieczęć.

## Reprodukcja

```bash
npx tsx tools/balance-night6.ts [m1 … m12] [--json out.json] [--no-search]   # tabela §3, karty i działania gracza
npx tsx tools/balance-night6-probe.ts                                        # M1 3★, przemiatanie wozów, M5/M9/M10
npx tsx tools/balance-night6-tune.ts ["m4 coins 140" …]                      # §7, łatki tylko w pamięci
npx tsx tools/mission-hashes.ts > a.txt   # na dwóch checkoutach, potem diff  # §1
```

## Po decyzjach 11-04 (dzień 8, gałąź `claude/w-day8`)

Stan po D-108 (M1: 3★ 9:15, 2★ 10:45), D-109 (M4: 140 srebra, 3★ 7:30, 2★ 10:00) i D-110 (karta „jeden producent
dla dwóch warsztatów” dopiero po 30 s czekania), plus wszystko z nocy 6 i 6b (D-103 … D-107). Narzędzie
`npx tsx tools/balance-night6.ts` (I–XIII, ok. 45 s), które teraz co tick próbkuje czekanie (jak gra) i przy podpowiedzi
tekstowej stawia producenta tam, gdzie startuje duch (D-107). **M8 w tej gałęzi to stara wersja** — przeprojektowanie
robi osobna sesja, więc wiersz VIII trzeba będzie zmierzyć ponownie po scaleniu.

| Misja | 3★/2★/termin | pasywny | same wozy (najl. k) | sama lekcja @0:00 | optimum | oko 10/30/60 s | oko+ 10/30/60 s | skan+ 30 s | list + oko+ 30 s |
|---|---|---|---|---|---|---|---|---|---|
| I | **9,25/10,75**/12 | P | P | P | 8,85 (**3**) +24 | 10,06 (**2**) / 9,91 (**2**) / 11,38 (1) | jak oko | 11,01 (1) | 11,15 (1) |
| II | 8,75/9,75/12 | 10,81 (1) | 8,79 (2) k=3 | 9,70 (2) | 8,24 (3) +30 | 9,24 (2) / 9,82 (1) / 10,81 (1) | 8,88 (2) / 9,82 (1) / 10,81 (1) | 9,63 (2) | 9,60 (2) |
| III | 6,25/8/11 | 8,57 (1) | 6,74 (2) k=7 | 6,73 (2) | 5,34 (3) +54 | 8,15 (1) / 9,30 (1) / 7,66 (2) | jak oko | 7,98 (2) | 5,49 (3) |
| IV | **7,5/10**/12,5 | 11,65 (1) | **10,16 (1) k=2** | 7,01 (**3**) +30 | 5,99 (3) +91 | 10,56 (1) / 7,58 (2) / 7,96 (2) | jak oko | **11,77 (1)** | 7,15 (3) +21 |
| V | 8,5/9,3/11 | 9,61 (1) | 7,94 (3) k=6 | 9,41 (1), list spóźn. | 6,84 (3) +100 | 8,22 (3) / 8,59 (2) / 8,76 (2) | jak oko | 8,50 (3) +0 | 8,59 (2) |
| VI | 8,45/8,85/11 | 8,92 (1) | 8,68 (2) k=4 | 8,31 (3) +8 | 7,88 (3) +34 | 8,31 (3) ×3 | jak oko | 8,31 (3) | 8,31 (3) |
| VII | 7,5/9,5/12 | 10,90 (1) | 10,90 (1) | 6,27 (3) +74 | 5,91 (3) +96 | 10,90 (1) ×3 | jak oko | 10,90 (1) | 6,91 (3) |
| VIII* | 9,7/10,3/13 | 10,50 (1) | 9,42 (3) k=6 | 10,29 (2) | 9,14 (3) +34 | 9,28 (3) / 9,40 (3) / 9,40 (3) | 9,07 (3) / 9,40 (3) / 9,40 (3) | 8,77 (3) | 8,79 (3) |
| IX | 9,2/10,8/13 | 11,22 (1) | 9,30 (2) k=5 | 9,96 (2) | 7,35 (3) +111 | 8,50 (3) / 8,63 (3) / 9,24 (2) | 8,71 (3) / 8,63 (3) / 9,24 (2) | 8,63 (3) | 8,63 (3) |
| X | 9,3/10,3/12 | P | 10,44 (1) k=1 | 9,94 (2) | 6,23 (3) +184 | 9,05 (3) / 9,13 (3) / 9,11 (3) | 9,04 (3) / 9,13 (3) / 9,11 (3) | 9,13 (3) | 9,13 (3) |
| XI | 9,4/10,3/12 | 10,94 (1) | 8,88 (3) k=5 (= lekcja) | — | = same wozy | 9,87 (2) / 10,12 (2) / 10,94 (1) | jak oko | 10,12 (2) | — |
| XII | 9/10,1/12 | 10,36 (1) | 10,10 (2) k=6 | 8,52 (3) +29 | 7,33 (3) +100 | 8,80 (3) / 8,55 (3) / 8,52 (3) | jak oko | 8,55 (3) | 8,55 (3) |
| XIII | 5,5/8/10 | P | 4,29 (3) k=5 (= lekcja) | — | = same wozy | 4,38 (3) / 5,49 (3) +1 / 6,42 (2) | jak oko | 5,49 (3) | — |

\* VIII: stara wersja misji (przed przeprojektowaniem).

### Rozsądny gracz (oko 10/30/60 s): noc 6b → dzień 8

| | I | II | III | IV | V | VI | VII | VIII | IX | X | XI | XII | XIII |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| noc 6b | 1/1/1 | 2/1/1 | 1/1/2 | 1/2/2 | 3/2/2 | 3/3/3 | 1/1/1 | 3/3/3 | 3/3/2 | 3/3/3 | 2/2/1 | 3/3/3 | 3/3/2 |
| dzień 8 | **2/2/1** | 2/1/1 | 1/1/2 | 1/2/2 | 3/2/2 | 3/3/3 | 1/1/1 | 3/3/3 | 3/3/2 | 3/3/3 | 2/2/1 | 3/3/3 | 3/3/2 |

- **I:** 3★ w zasięgu planu z mostem i czterema wozami (`npm run bot`: 8,85 min, 3★), rozsądny gracz 1★ → 2★ przy 10 i 30 s.
  Gracz co 60 s zostaje przy 1★ (most w 1:00, wozy dopiero od 3:00).
- **IV:** same wozy nie dają już 3★ (najlepiej 2 wozy, 1★, 10 s do 2★), sama lekcja daje 3★ z zapasem 30 s, gracz z listem
  3★ z zapasem 21 s. Rozsądny gracz bez zmian (1/2/2★). **Strata: skan+ 30 s 3★ → 1★** — kupuje trzy wozy z kolejnych pinezek
  i nie ma już srebra na kamienny most (karta przęsła pokazuje „brak srebra”). Do rozważenia: przy 140 srebrze karta
  „Kup wóz” w IV mogłaby ustępować karcie przęsła, gdy wóz stoi przed krą.
- **IX/X:** karta po 30 s nie odbiera pieczęci. IX szybciej przy 10 i 30 s (8,71 → 8,50, 8,99 → 8,63: drwal staje w 0:40 / 1:00,
  a wozy z karty przychodzą później i jest ich mniej — chaos dyspozytora, nie zasługa opóźnienia). X przy 30 s wolniej o 32 s (8,59 → 9,13; zapas do 3★ +43 → +10 s),
  bo pierwsze spojrzenie w 0:30 przypada na 29,9 s czekania tartaku, więc drwal staje w 1:00.
- **Wciąż do zrobienia (bez zmian od nocy 6b):** VII (rozsądny gracz 1★ — karta nie prowadzi do rybaka nad wodą), III
  (1/1/2★ — błoto nie jest przestojem), II przy 30/60 s (1★; próg 2★ 10:00 czeka na playtest), XI przy 60 s (1★).
  XIII przy 30 s ma 3★ z zapasem 1 s.
