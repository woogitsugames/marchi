# Późna wolna dolina: co diagnozować po ~76 minutach

Badanie (dzień 8b, 4 listopada 2026). Baza: `claude/research-day8b` (= `claude/eager-cori-08wt8e` + raport `2026-11-04-valley-3h.md`).
Bez zmian w `src/`. Prototypy były łatkami lokalnymi, cofniętymi przed commitem i zapisanymi obok jako `.patch`.
Boty: `tools/valley-3h.ts` (rozszerzony) + nowy `tools/valley-late.ts`. Seedy 1301–1303, 180 min, średnie z 3 seedów.

## TL;DR

1. **Żaden z 5 prototypów nie daje graczowi „porządnemu” trwałego, prawdziwego wąskiego gardła na karcie.** Rozbudowa targu,
   duże zamówienia, popyt pór roku i rosnący popyt z rangą dają tylko więcej srebra (+3…+16 %), a karta najgorszego postoju
   w pasmach 90–180 min pokazuje **0 %** prawdziwych (niespokojnych) kart, tak jak dziś. Trakt kupiecki za rzeką
   to jedyny pomysł z prawdziwą kartą: „most skuty lodem → wybrukuj przęsło” w **13–15 %** próbek zimowych pasm. Jeden
   ruch gracza ją leczy, a strata bez leczenia to −0,5 % dochodu.
2. **Przyczyna jest strukturalna, nie treściowa.** Karta widzi tylko budynek *zablokowany*. Dojrzała dolina ma inne
   ograniczenie, **przepustowość łańcucha**. Średnio **1,4 z 4 odbiorców zboża** (2 młyny + 2 słodownie) czeka na dostawę
   (`WAITING_DELIVERY`), a to nie jest postój, więc karta milczy. Lek istnieje i działa: +2 farmy → 1,38 → 0,85
   czekających, +5 % srebra, R5 118,6 → 115,4. Gracz po prostu go nie widzi.
3. Brak wozów też jest niewidoczny: w dolinie `OUTPUT_FULL.NO_WAGON` przy otwartym targu to spokojna pinezka
   (poprawka audytu nr 1). Przy trakcie kupieckim jałowe wozy spadają z 30–36 % do 1–4 %, a karta dalej pokazuje
   spokojne „czeka na odbiór”. Dokupienie +10 wozów daje jednak tylko +2 % (wozy nie są tu wąskim gardłem).
4. **Tempo rang:** projekty od R4 zostawiają R1–R4 bez zmian. Za to R5 przychodzi wcześniej: rozbudowa targu 113,6,
   rosnący popyt 112,7, trakt 150 % **103,0 ✗**, trakt 125 % 106,5 (krawędź okna). Korekta progu R5 (zmierzona) wraca
   do środka okna: trakt 125 % + R5 17 000 → **119,3**, rozbudowa + R5 15 500 → **119,4**. Popyt pór roku działa od
   startu i łamie okna: R3 37,1, R4 67,3, R5 102,3 ✗.
5. **Lek na zatkany spichlerz („Kup wóz” zamiast „Spichlerz”) potwierdzony jako zmiana tylko w UI:**
   `cureFor` + `clogNeedsWagon` (`2026-11-04-valley-late-cure-proto.patch`). Testy 448/448 przechodzą, a DECENT jest
   identyczny co do monety. Gracz, który słucha karty, ma teraz +31 % srebra (bierny, 3 wozy), a mała flota +64 %
   (6 → 14 wozów) i R4 w 97,8 min zamiast nigdy. Bez łatki ten sam gracz nie robi nic, bo karta mówi „Spichlerz”.
6. **Rekomendacja:** (a) od razu lek na spichlerz (UI) i **karta „wąskie gardło”** (UI: nazywa towar, na który
   najwięcej odbiorców czeka ≥ 3 min, a lek to „postaw producenta”). To pierwsza karta, która w dojrzałej dolinie
   ma co pokazać (zboże przez całe 3 h). (b) Jako treść późnej doliny **Trakt kupiecki za rzeką od R4** (125 %, własne
   nasycenie, R5 → 17 000). Daje ujście dla nadwyżki towarów, decyzję o moście i nową odległość, która przesuwa wąskie
   gardło. Rozbudowa targu nadaje się na późniejsze ujście srebra, ale sama nie tworzy niczego do diagnozy.

## Odtworzenie

```bash
git apply docs/research/2026-11-04-valley-late-proto.patch      # przełączniki LATE w src/sim (wszystkie domyślnie wyłączone)
npx tsx tools/valley-late.ts --seeds 1301,1302,1303             # wszystkie projekty (~6 min)
npx tsx tools/valley-late.ts decent decent+2farms trade trade125-r5x17k upgrade-r5x15.5k
git checkout src/
# lek na spichlerz (UI): ten sam gracz z łatką i bez niej
git apply docs/research/2026-11-04-valley-late-proto.patch docs/research/2026-11-04-valley-late-cure-proto.patch
npx tsx tools/valley-late.ts passive passive+eye small small+eye decent+eye; git checkout src/
```

Łatka prototypowa z wyłączonymi przełącznikami przechodzi cały `npm test` (448/448, złote hasze bez zmian). Z łatką
leku też 448/448. Bez łatki `valley-late.ts` kończy się komunikatem.

**Metryki (nowe w `valley-3h.ts`):** co 10 s karta najgorszego postoju (`rankStalls()[0]`):
- **kryt.**: karta krytyczna (wosk);
- **prawdziwa**: karta nie jest spokojna (`!minor`, czyli krytyczna albo zwykła);
- **+lek**: prawdziwa karta z przyciskiem leku;
- **czekający odbiorcy**: średnia liczba warsztatów czekających na towar wejściowy
  (`WAITING_DELIVERY` / `_UPSTREAM` / `NO_INPUT` / `NO_WAGON`), według towaru.

Gracze:
- **DECENT**: 54 kroki, koniec planu w ~76 min.
- **„+eye”**: od 1. minuty, co 30 s; krytyczna karta z lekiem „wóz” → kupuje wóz, z lekiem „bruk” → brukuje przęsło.
- **„+fleet”**: po planie co minutę wóz, gdy żaden nie stoi.
- **„+2farms”**: po planie droga na wschód i 2 farmy.
- **Kontrfakty progu R5**: wartości w pamięci.

## Prototypy

| | projekt | co zmienia w prototypie | gracz |
|---|---|---|---|
| A | **Rozbudowa targu** (R4) | 2 500 srebra, potem 48 kamienia do zamku jako „zamówienie robót” (stary mechanizm zamówień, dowóz kamienia z pierwszeństwem); po dowozie odnowa nasycenia 10 s → 7 s (`upgrade5`: 5 s) | DECENT, kupuje zaraz po planie |
| B | **Duże zamówienia od R4** | od R4 ilość × 3; renoma każdego zamówienia = srebro / 2 (propozycja 1 z raportu 3 h) | DECENT + przyjmuje każde zamówienie |
| C | **Popyt pór roku** | 2 towary na porę za 150 % (wiosna deski+kamień, lato piwo+ryby, jesień chleb+słód, zima węgiel+drewno), bez pola w stanie | DECENT |
| D | **Trakt kupiecki za rzeką** (R4) | druga „faktoria” typu zamek przy (37,58) za rzeką; kupuje od R4 za 150 % (`trade125`: 125 %), własne nasycenie; dyspozytor wybiera parę (targ, towar) po cenie | DECENT + droga (x≈39, 33 pola, drewniany most 3 pola) zaraz po planie; `trade-stone`: kamienny most |
| E | **Rosnący popyt z rangą** | odnowa nasycenia R4 8 s, R5 6 s, bez pola w stanie | DECENT |

## 1. Rangi i srebro (średnia 3 seedów; min)

| gracz | R1 (8–12) | R2 (20–30) | R3 (40–50) | R4 (70–90) | R5 (105–135) | srebro 180 min | Δ | monety 180 | wozy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| decent (dziś) | 10,5 | 22,5 | 42,0 | 75,6 | 118,6 | 24 578 | — | 23 175 | 30 |
| decent + 2 farmy (lek na zboże) | 10,5 | 22,5 | 42,0 | 75,6 | 115,4 | 25 833 | +5 % | 24 360 | 30 |
| A upgrade (7 s) | 10,5 | 22,5 | 42,0 | 75,6 | 113,6 | 27 335 | +11 % | 23 432 | 30 |
| A upgrade5 (5 s) | 10,5 | 22,5 | 42,0 | 75,6 | 112,3 | 28 034 | +14 % | 24 131 | 30 |
| A upgrade, R5 = 15 500 | 10,5 | 22,5 | 42,0 | 75,6 | **119,4** | 27 335 | +11 % | 23 432 | 30 |
| orders (gra: renoma 2×) | 9,2 | 19,7 | 35,3 ✗ | 62,9 ✗ | 96,0 ✗ | 28 392 | +16 % | 26 989 | 30 |
| orders-half (renoma 0,5×) | 11,1 | 23,2 | 42,7 | 75,8 | 118,2 | 27 136 | +10 % | 25 733 | 30 |
| B bigorders (×3 od R4, 0,5×) | 11,1 | 23,2 | 42,7 | 75,8 | 117,7 | 27 902 | +14 % (+3 % wobec orders-half) | 26 499 | 30 |
| C seasonal | **8,0** | 19,9 ✗ | **37,1 ✗** | **67,3 ✗** | **102,3 ✗** | 28 465 | +16 % | 27 062 | 30 |
| D trade (150 %) | 10,5 | 22,5 | 42,0 | 75,6 | **103,0 ✗** | 33 486 | +36 % | 32 036 | 30 |
| D trade-stone (kamienny most) | 10,5 | 22,5 | 42,0 | 75,6 | 103,0 ✗ | 33 318 | +36 % | 31 841 | 30 |
| D trade + fleet | 10,5 | 22,5 | 42,0 | 75,6 | 102,6 ✗ | 34 090 | +39 % | 32 340 | 40 |
| D trade125 (125 %) | 10,5 | 22,5 | 42,0 | 75,6 | 106,5 | 30 673 | +25 % | 29 223 | 30 |
| D trade125, R5 = 17 000 | 10,5 | 22,5 | 42,0 | 75,6 | **119,3** | 30 673 | +25 % | 29 223 | 30 |
| E rankdemand (8 s / 6 s) | 10,5 | 22,5 | 42,0 | 75,6 | 112,7 | 27 651 | +13 % | 26 248 | 30 |

Dodatkowe fakty:
- **A:** rozbudowę kupiono w 76–77 min, kamień dowieziono w 85–86 min, czyli **9 min** dowozu, a w tym czasie
  ani jednej prawdziwej karty: kamieniołom nadąża.
- **D:** drogę zbudowano w 76–77 min, pierwszą sprzedaż w faktorii w 77–78 min. Gracz „+eye” brukuje przęsło
  w 109 min, przy pierwszym lodzie po R4.

**Monety dalej rosną bez ujścia:**
- A zabiera 2 500 z ~23 000 (11 %) i dochód szybko to odrabia;
- D i E zwiększają stos monet.

Żaden z projektów nie jest stałym ujściem srebra. Ujściem są dopiero nowe budowy, gdy gracz wie, co budować (patrz §3).

## 2. Karta najgorszego postoju w późnych pasmach

sr/min oraz prawdziwa karta (niespokojna) jako % próbek. Pasma 0–60 są identyczne z `decent` (poza B i C).

| gracz | 60–90 | 90–120 | 120–150 | 150–180 | jałowe wozy 90–180 | co pokazuje karta po 90 min |
|---|---|---|---|---|---:|---|
| decent | 162,7 / 0 % | 156,8 / 0 % | 171,9 / 1 % | 157,5 / 0 % | 30–36 % | tartak/drwal „czeka na odbiór” ~ (spokojna) |
| A upgrade | 161,5 / 0 % | 187,4 / 0 % | 203,0 / 0 % | 188,8 / 0 % | 30–36 % | jak decent |
| B bigorders | 176,0 / 0 % | 199,0 / 0 % | 205,4 / 0 % | 172,6 / 0 % | 30–36 % | jak decent |
| C seasonal | 196,7 / 1 % | 174,3 / 0 % | 196,7 / 1 % | 176,3 / 0 % | 30–36 % | jak decent |
| E rankdemand | 167,9 / 0 % | 186,3 / 0 % | 205,9 / 1 % | 191,1 / 0 % | 30–36 % | jak decent |
| **D trade** | 196,2 / 0 % | 245,9 / **14 %** | 257,4 / 1 % | 246,3 / **15 %** | **1–4 %** | zima: faktoria `castle:IDLE!` z lekiem **„bruk”** (wozy przed skutym drewnianym mostem); poza zimą spokojna |
| D trade + eye | 196,2 / 0 % | 243,7 / 1 % | 254,2 / 0 % | 242,9 / 0 % | 2–8 % | po jednym brukowaniu (109 min) już nic |
| D trade125 | 182,7 / 0 % | 219,3 / 13 % | 233,8 / 0 % | 216,2 / 15 % | 1–4 % | jak trade |

**Czekający odbiorcy (średnio, pasma 90–180)**, czyli wąskie gardło przepustowości, którego karta nie pokazuje:

| gracz | zboże (4 odbiorców: 2 młyny + 2 słodownie) | drewno (2 tartaki + węglarz) |
|---|---:|---:|
| decent | 1,38 | 0,18 |
| decent + 1 farma | 1,10–1,15 | 0,17 |
| decent + 2 farmy | 0,83–0,88 | 0,17 |
| A upgrade (+ 2 farmy) | 0,89–1,38 (0,83–0,89) | 0,17–0,20 |
| D trade | 1,47–1,51 | 0,27–0,32 |
| D trade + 2 farmy | 1,21–1,27 | 0,31–0,37 |

Dojrzała dolina ma więc zawsze to samo wąskie gardło: **zboże**. Odbiorców jest 4, a 4 farmy przy zimie 60 %
nie nadążają. Lek (farma) działa, ale wartość jest niska:
- decent +5 %,
- przy trakcie tylko +1 %, bo wtedy brakuje też drewna, a za nim wozów i miejsc na targu.

Gdy karta zacznie pokazywać ten rodzaj braku, gracz dostanie pętlę „przeczytaj → zbuduj → gardło się przesuwa”.
Ruchome gardło (zboże → drewno → wozy) widać w danych traktu.

## 3. Ocena projektów

| | prawdziwa karta po 76 min | lek działa? | srebro 3 h | tempo rang | nowe pola stanu | klucze i18n (×2 języki) | grafika |
|---|---|---|---:|---|---|---:|---|
| A Rozbudowa targu | 0 % (także w 9 min dowozu kamienia) | — | +11 % | R5 113,6 → z R5 15 500: 119,4 | `market.level`, szablon „zamówienie robót”, komenda `upgradeMarket`; STATE_VERSION 9 + migracja (domyślnie 0) | ~7 (przycisk, opis, koszt, karta robót, postęp „Kamień 12/48”, komunikat, kodeks) | wariant zamku/targu (kramy): 1 model |
| B Duże zamówienia | 0 % | — | +3 % wobec samej renomy 0,5× | bez zmian (z 0,5×) | 0 (formuła) | 1–2 („Wielkie zamówienie”) | 0 |
| C Popyt pór roku | 0 % | — | +16 % | **łamie R2–R5** (od startu); trzeba by bramki od R4 | 0 (z ticku) | ~5 (4 pory + „Zamek potrzebuje”) | 0–1 (znacznik na ikonie towaru) |
| D Trakt kupiecki | **13–15 % w pasmach zimowych** (lód na drewnianym moście, lek „bruk”) | tak, 1 ruch; strata bez leku −0,5 % | +25 % (125 %) / +36 % (150 %) | 150 %: R5 103 ✗; 125 % + R5 17 000: 119,3 | `market.post` (10 liczb) + typ/flaga budynku faktorii na mapie; STATE_VERSION 9 + migracja; dyspozytor „para targ–towar” (hasze piaskownicy się zmienią, misji nie) | ~10–12 (nazwa, opis, „zamknięta do Grodu”, brak drogi, ceny w panelu targu, karta „most skuty — faktoria czeka”, kodeks) | 1 nowy model (komora celna / faktoria) + ikona drzeworytowa |
| E Rosnący popyt | 0 % | — | +13 % | R5 112,7 | 0 | 1–2 (komunikat awansu „targ chłonie więcej”) | 0 |
| G Karta „wąskie gardło” (tylko UI, z §2) | zboże ~1,4 z 4 odbiorców czeka przez całe 3 h, więc karta miałaby co pokazać prawie zawsze | tak: +2 farmy → 0,85, +5 % | — | R5 −3 min | 0 | ~4 (tytuł „Wąskie gardło: zboże”, linia „N z M odbiorców czeka”, lek „Postaw farmę”, kodeks) | 0 (ikony towarów i lek `producer` już są) |

Uwagi:
- **A** to dobre ujście srebra z dowozem kamienia jako „projektem”, ale kamieniołom DECENT dowozi 48 kamienia w 9 min
  bez zatoru. Żeby dowóz był wąskim gardłem, trzeba by np. 120 kamienia i dowozu do placu budowy, a to więcej pracy.
  Po ukończeniu targ tylko lepiej płaci.
- **B** po R4 ×3 nie zmienia nic logistycznego: dyspozytor i tak wiezie zamówiony towar pierwszy, a browar pracuje cały czas.
- **C** to sygnał cenowy, nie logistyczny: dyspozytor sam przestawia kolejność towarów na targ, a gracz nic nie musi.
- **D** jest jedynym projektem, który wprowadza nową *geografię*: odległość ×2–5 dla producentów ze wschodu, most
  z limitem 3 wozów i zimowym lodem, wybór drewniany/kamienny. Jałowe wozy spadają z 30–36 % do 1–4 %. Słabość:
  bez karty przepustowości (G) gracz widzi tylko zimowy lód. Faktoria jako „zamek” ma też złą etykietę karty
  (`castle:IDLE!`); w prawdziwej wersji potrzebny jest własny tekst.
- **Wspólny wniosek:** każdy projekt „więcej popytu” (A, B, C, E) tylko podnosi dochód, bo dojrzała dolina nie ma
  zablokowanego budynku. Bez G żadna treść nie spełni kryterium „karta pokazuje prawdziwe, uleczalne gardło przez
  większość czasu”.

## 4. Lek na zatkany spichlerz (propozycja 2 raportu 3 h): zmierzone, tylko UI

Zmiana w `src/ui/stalls.ts` (`2026-11-04-valley-late-cure-proto.patch`, +20 linii): `clogNeedsWagon(world, granary)`
zwraca prawdę, gdy targ jest otwarty, a spichlerz trzyma ≥ 1 ładunek towaru kupowanego przez targ (bez kamienia,
który jest materiałem budowlanym). Wtedy `cureFor` dla `STORAGE_FULL` (korzeń) i `OUTPUT_FULL.NO_DESTINATION`
(blokujący spichlerz) zwraca `'wagon'` zamiast `'granary'`. Stan sim pozostaje nietknięty.

| gracz (3 seedy, 180 min) | bez łatki: srebro / wozy / prawdziwa karta 90–180 | z łatką: srebro / wozy / prawdziwa karta 90–180 | rangi z łatką |
|---|---|---|---|
| passive + eye | 1 850 / 2 / 100 % (karta „Spichlerz”, gracz nic nie robi) | **2 419 (+31 %)** / 5 / **0 %** | R1 41,5 |
| small (6 wozów) + eye | 10 913 / 6 / 100 % | **17 934 (+64 %)** / 14 / **0–2 %** | R3 57,2, **R4 97,8** (wcześniej nigdy), R5 151,9 (2/3 seedów) |
| decent + eye | 24 578 | 24 578 (identycznie) | bez zmian |

`npm test` z łatką: 448/448. Karta z lekiem „wóz” w bierności: 30–60 min 79 %, od 60 min 100 % próbek, a pierwszy
zakup wozu ją czyści. Opcjonalnie dochodzi jedna linia w karcie (1 klucz × 2 języki): „Targ zabiera najpierw droższy
towar; drewno czeka w spichlerzu — więcej wozów, a ruszy.”

Nowa obserwacja przy okazji: po wyleczeniu mała flota ma 0 % jałowych wozów, ale karta pokazuje wtedy tylko spokojne
`OUTPUT_FULL.NO_WAGON~` (towar dla targu = spokojna pinezka). To ten sam ślepy punkt co w §2. Karta G mogłaby
obejmować także „wszystkie wozy zajęte ≥ 3 min → Kup wóz”.

## 5. Rekomendacja

1. **Teraz (UI, bez zmian stanu):** lek „Kup wóz” na zatkany spichlerz (§4, zmierzony, testy zielone).
2. **Teraz (UI): karta „Wąskie gardło”** w wolnej dolinie, gdy żadna prawdziwa karta nie wisi:
   - pokazuje towar, na który najdłużej czeka najwięcej odbiorców (okno 3 min, próg np. ≥ 1 odbiorca przez ≥ 50 % okna);
   - lek: `producer` (podświetla kartę narzędzia tego producenta);
   - druga reguła: „0 jałowych wozów przez 3 min” → lek `wagon`.

   Mechanizm już istnieje dla misji (`sharedOneProducer`, `sampleInputWaits`, D-110); dziś wyłącza go `'ranked'`.
   Zmierzony sygnał: zboże ~1,4 z 4 odbiorców przez całe 3 h, lek +2 farmy działa (+5 %). Wymaga prototypu UI i zrzutów.
3. **Treść późnej doliny: Trakt kupiecki za rzeką od R4:**
   - 125 %, własne nasycenie, faktoria przy południowym brzegu, drewniany most z lodem albo kamienny;
   - R5 14 500 → **17 000** (zmierzone 119,3 min).

   Daje nowy cel w pustym paśmie 76–120 min (droga, most), prawdziwą zimową kartę z lekiem i +25 % dochodu. Razem z G
   pokazuje ruchome gardło: zboże → drewno → wozy. Koszt: STATE_VERSION 9, 1 model, ~12 kluczy.
4. **Rozbudowa targu (A)** dopiero jako drugie ujście srebra (z R5 15 500), np. po playteście, jeśli monety dalej będą
   przeszkadzać. **B, C, E odradzam** jako „późną grę”, bo nie tworzą nic do diagnozy. C dodatkowo łamie tempo.
   B (renoma 0,5×) zostaje jako osobna poprawka tempa z raportu 3 h.

## 6. Pytanie do właściciela

**Co ma być pierwszą „późną grą” wolnej doliny (po ~76 min)?**

- **(a) Karta „wąskie gardło” (UI) + Trakt kupiecki za rzeką od Grodu (R4)**: faktoria 125 %, most z lodem,
  R5 → 17 000. Koszt: STATE_VERSION 9, 1 model, ~12 + 4 klucze. **← rekomendowane**
- (b) Karta „wąskie gardło” (UI) + Rozbudowa targu od R4 (2 500 srebra + 48 kamienia, odnowa 7 s, R5 → 15 500).
  Taniej (bez nowej mapy i modelu faktorii), ale po ukończeniu nie ma nic nowego do diagnozy.
- (c) Na razie tylko UI (lek „Kup wóz” + karta „wąskie gardło”), a treść późnej doliny dopiero po playteście logistyki.

Lek „Kup wóz” na zatkany spichlerz rekomenduję niezależnie od wyboru: to zmiana tylko w UI, zmierzona.

## Pliki

- `tools/valley-late.ts`: gracze A–E, sondy (+eye / +fleet / +farms), kontrfakty progu R5, tabele (nowy).
- `tools/valley-3h.ts`: hak `setup` (przełączniki i mapa na czas przebiegu), `eyeAlways` (oko od 1. minuty i brukowanie
  przęsła), `watch` (pierwsza minuta zdarzeń), metryki `real` / `realCure` / `inputWaits`. Wyniki dawnych graczy
  są bez zmian.
- `docs/research/2026-11-04-valley-late-proto.patch`: prototyp A–E w `src/sim` (przełączniki `LATE`, domyślnie wyłączone;
  NIE do scalenia).
- `docs/research/2026-11-04-valley-late-cure-proto.patch`: lek „Kup wóz” w `src/ui/stalls.ts` (kandydat do wdrożenia).
