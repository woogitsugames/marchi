# Tryb swobodny jako spokojny city builder — propozycja projektu

Status: **propozycja** (Sonnet, 2026-11-01), do akceptacji właściciela. Wynika z D-21: gra jest darmowa (być może z reklamami), bez energii/timerów/pay-to-win; „Wolna dolina" ma być relaksującym budowaniem miasteczka, nadal opartym na logistyce, **bez life-simu osadników**.
Zasada przewodnia (CLAUDE.md): *gra o diagnozowaniu przestojów, nie o ładnej osadzie*. Miasto rośnie tylko tyle, ile przewiozą wozy; wszystko, co nowe, ma uczyć **nowej przyczyny przestoju**.

Stan wyjściowy (kod): `MISSIONS.sandbox` = mapa `valley1`, 600 srebra, 4 wozy, układ m1, `contract: null`. Zamek w sandboxie nic nie przyjmuje (`remainingContract` zwraca 0 bez kontraktu), więc **dziś nie ma żadnego dochodu**; `place` istnieje w sim, brak UI (BACKLOG P4). Sim: 5 towarów w sztywnym `GoodMap`, `STATE_VERSION = 2`, wóz = 6 jednostek, cena wozu 30, ceny budynków 20–40, rozbiórka zwraca 50%.

---

## 1. Pętla rozgrywki (sesje 10–30 min)

### 1.1 Skąd srebro
Jedno źródło prawdy: **sprzedaż towarów na rynku**. Zamek (i później Targ) w sandboxie dostaje „popyt rynkowy": przyjmuje każdy towar, który ma cenę, a rozładowany towar jest **od razu sprzedawany** (stock → srebro, `ledger.consumed += n`, więc test zachowania towarów nadal działa).

- **Cena bazowa** stała na towar (tabela w `defs.ts`, §4). Bez losowości w cenach — gracz ma planować, nie hazardować.
- **Nasycenie rynku** (wolny dryf, nie timer): licznik `market.sold[g]` rośnie przy sprzedaży i maleje o 1 co `MARKET_RECOVER_TICKS` (np. 20 s). Cena = `max(50%, 100% − sold·100/(2·cap))` bazowej, całkowitoliczbowo (`floor(base*pct/100)`, min 1). Skutek: jeden towar sprzedawany bez końca traci do −50%; **dywersyfikacja** (chleb + deski + ryby) jest opłacalna. To jest naturalny, czytelny „powód" (nowy status zamiast przestoju — §3).
- **Dostawy jako dochód**: nie ma pensji ani podatku od „mieszkańców". Dochód = (towary na wóz) × (cena). Brak wozu/drogi = brak srebra, i to widać w „Dlaczego stoi?".
- **Rekompensata za błędy**: sprzedaż wozu (50%) i rozbiórka (50%) zostają; patrz też cofnięcie w §2.5. Nie ma stanu „game over": jeśli srebro = 0 i nic nie jedzie, gracz sprzedaje wóz/rozbiera — istniejący backlog „wczesne wykrycie braku drogi" dostaje w sandboxie łagodny komunikat zamiast listu.

### 1.2 Co rośnie: renoma (tiery) mierzona przepływem
Gracz hoduje **Renomę miasteczka** (cztery rangi). Renoma **nie** zależy od liczby mieszkańców, tylko od przepływu:

- `renown` = skumulowana wartość sprzedanych towarów (srebro ze sprzedaży) + nagrody z zamówień ×2. Rośnie monotonicznie (nic nie można stracić).
- Ranga wymaga **progu renomy ORAZ spełnienia dwóch warunków „logistycznych"** (zatrzaskowych, raz osiągniętych nie cofają się):
  1. *różnorodność*: sprzedano co najmniej K różnych towarów,
  2. *przepływ*: kiedykolwiek osiągnięto średnio ≥ X srebra/min w oknie 3 minut (pierścień 18 kubełków po 10 s w stanie).
  Dzięki temu rangi premiują sprawną sieć, a nie samo „klikanie budowy".
- Ranga **odblokowuje budynki i przeprawy** (nie liczbę ludzi). Wszystko dostępne w misjach m1–m3 bez zmian (blokady dotyczą tylko `mission.id === 'sandbox'`).

| Ranga | Nazwa | Próg renomy | Różnorodność | Przepływ | Odblokowuje |
|---|---|---|---|---|---|
| 0 | Osada | 0 | — | — | drwal, tartak, farma, stajnia, magazyn |
| 1 | Wieś targowa | 400 | ≥ 2 towary | ≥ 8 sr/min | młyn, piekarnia, rybak, węglarnia |
| 2 | Miasteczko | 1 500 | ≥ 4 | ≥ 20 sr/min | kamieniołom, Targ, słodownia + browar, brukowanie wymagające kamienia, most kamienny |
| 3 | Miasto | 4 000 | ≥ 6 | ≥ 40 sr/min | druga i kolejne stajnie w rabacie wozów, jarmark sezonowy (bonus), „Księga cechów" (statystyki przepływu) |

Wartości to pierwsze przybliżenie (§4). Pasek renomy w HUD: cienki pasek przy zegarze + nazwa rangi; po awansie jednorazowy, spokojny list (pergamin, bez konfetti, bez ✨).

### 1.3 Miękkie cele (bez terminów i porażek)
- **Zamówienia królewskie** (`orders`, maks. 2 aktywne): „Zamek prosi o 18 desek i 12 chlebów — nagroda 120 srebra i podwójna renoma". Brak terminu, brak kary; można odrzucić („Odłóż") i dostać inne po następnej dostawie. Dostarczane towary leżą w magazynie zamku (jak dziś kontrakt: `incoming`/`stock`) i są konsumowane przy realizacji (`ledger.consumed`). Technicznie: uogólnić `remainingContract` z jednego kontraktu na listę zamówień.
- **Jarmarki sezonowe**: sezon = 6 min czasu symulacji (`SEASON_TICKS`), co 3 sezony jarmark: jeden towar (z RNG w stanie, deterministycznie) ma +25% ceny przez cały następny sezon. Zapowiedź na liście z wyprzedzeniem („W następnym sezonie jarmark na piwo"). To zachęta, nie przymus: brak jarmarku nic nie odbiera. Nie jest to timer blokujący grę — pauza i prędkość działają normalnie, a opuszczenie sezonu nic nie kosztuje.
- **Księga** (opcjonalna lista osiągnięć „pierwszy wóz na kamiennym moście", „5 towarów w jednym sezonie") — tylko prezentacja, bez nagród srebrnych.
- Brak: kar, wygasania, licznika dni, powiadomień push, „wróć za 4 h". Zapis ciągły (IndexedDB, już jest), wznowienie bez zmian stanu.

### 1.4 Typowa sesja (cel projektowy)
0–2 min: wozy wiozą deski do zamku (preset startowy, §4), pierwszy dochód. 2–6 min: gracz dobudowuje farmę i drugą drogę, kupuje wóz. 6–12 min: ranga 1, młyn+piekarnia, pierwsze zamówienie. 12–25 min: ranga 2, kamieniołom, Targ, wyraźne „wąskie gardło" (wozy/most) do zdiagnozowania. Po 30 min ranga 3 jest osiągalna, ale nie wymagana.

---

## 2. Stawianie budynków na telefonie

Sim `place(type,x,y,facing)` waliduje już: granice, woda, droga, zajęcie, brama, płaskość (`NOT_FLAT`, różnica ≤ 2,5 m), srebro (`NO_COINS`). Brakuje **czystej walidacji bez mutacji** (analogia do `validateRoad`) — pierwszy krok implementacji (task S3).

### 2.1 Szyna narzędzi
Dziś: droga, bruk, rozbiórka (`Tool = 'none'|'road'|'cobble'|'demolish'`, `hud.setTool`). Dodajemy czwarte narzędzie **`build`** (ikona: ciosany szkic dachu/belki, drzeworyt — w stylu `icons.ts`, nie emoji, cel ≥ 48 dp). Dotknięcie otwiera **półkę budynków** (arkusz dolny, przewijana poziomo): karta = ikona kształtowa, nazwa, cena, wymiar `3×2`, plakietka „Ranga 2" na zablokowanych (szare, dotknięcie pokazuje wymagania: „Potrzeba: 1 500 renomy, 4 towary"). Skrót klawiszowy `b` dla desktopu/dev.

### 2.2 Duch z obrysem (ghost)
1. Wybór karty → duch (półprzezroczysty model + obrys cegiełek 4 m) pojawia się **na środku widoku**, przyciągnięty do siatki.
2. **Przeciągnięcie jednym palcem po duchu** przesuwa go; duch jest **przesunięty ~72 dp nad palec** (palec nie zasłania stawianego miejsca). Dwa palce / szczypanie / obrót nadal sterują kamerą (to samo rozdzielenie co w `RoadDraft`: `draftMode`/`input.ts`).
3. Obrys komórek koloru: *akceptacja* (ciemna zieleń „ołowiowa" z palety UI_STYLE, nie pastel) / *odrzucenie* (krapp/umbra). Komórka winowajcy (`BLOCKED.cell`, `NOT_FLAT.cell`) jest podświetlona mocniej, a pod duchem pasek jednolinijkowy z powodem (i18n z `CommandError.k`: „Za stromo", „Woda", „Droga/budynek w drodze", „Brak srebra: brakuje 12").
4. Opcjonalnie podgląd poziomicy: przy `NOT_FLAT` pokazać kolor wysokości komórek (istnieje overlay).

### 2.3 Strona bramy i obrót
Przycisk **obrotu** (strzałka kołowa, rysowana, nie emoji) obok ducha cykluje `facing` 0→1→2→3 (S, E, N, W — `gateCell`). Brama to wyraźny **znacznik na krawędzi obrysu** (kawałek ścieżki + chorągiewka); komórka bramy jest walidowana (`BLOCKED`), a `place` sam kładzie 1 komórkę drogi pod bramą. Domyślny `facing`: strona zwrócona do **najbliższej istniejącej drogi/bramy** (pierwsza sugestia, jak `suggestLinkToStable`), z możliwością ręcznej zmiany. Podgląd „bramka połączona/niepołączona": gdy brama nie dotyka sieci, duch pokazuje krótką **przerywaną sugestię drogi** (`setRoadPreview`) i cenę „+N srebra" — ten sam przycisk zbuduje budynek i dojazd jedną komendą (dwie komendy w jednym ticku: `place` + `road`).

### 2.4 Podgląd kosztu i potwierdzenie
Na panelu ducha: `Cena 40 + droga 6 = 46 · Masz 213 → 167`. Przyciski **Postaw** (✓ rysowany) i **Anuluj**; po postawieniu narzędzie zostaje aktywne (seria stawiania, np. 3 farmy), wyjście przez Anuluj/Back (system `sheets.ts` ma już pushState). Dotknięcie obok = przesunięcie ducha, **nie** postawienie (bez przypadkowych budów). Postawienie dźwiękiem młotka z istniejącego zestawu, bez nowych efektów.

### 2.5 Cofnięcie
- Komenda `undo` nie jest potrzebna jako stos: **„Cofnij" ostatniej budowy** = komenda `demolish` z **pełnym zwrotem 100%**, gdy budynek jest „świeży": postawiony ≤ 30 s czasu symulacji temu (nowe pole `placedTick`), bez zapasu i bez rezerwacji. Poza tym oknem zwrot jak dziś 50%. To nie jest licznik z karą — to tylko łagodniejszy zwrot.
- Pływający przycisk „Cofnij: farma (−40)" widoczny kilka sekund po postawieniu; zniknięcie bez konsekwencji.
- Rozbiórka produkcyjnego budynku wymaga potwierdzenia (otwarty P1 w backlogu — tu staje się wymogiem).

### 2.6 Integracja
`App.tool` rozszerzyć o `'build'`; nowy moduł `src/ui/buildTool.ts` obok `roadTool.ts` (ta sama sygnatura: callbacki do `enqueue`, brak mutacji sim); `view.setPlacementGhost({type,x,y,facing,valid,badCell})` w `src/render` analogicznie do `setRoadPreview`. Nic w UI nie dotyka stanu — wszystko przez `Command`.

---

## 3. Nowa treść (mały zakres: 5 budynków, 5 towarów)

Epoka: Europa Środkowa ok. 1300–1400 (ART_DIRECTION): drewno, kamień, węgiel drzewny, ryby, piwo — bez prochu, bez „fantasy". Wszystko przez istniejące mechaniki (receptury `inputs/outputs/ticks`, `inCap/outCap`, brama). Towary: `stone` (kamień), `charcoal` (węgiel drzewny), `fish` (ryby), `malt` (słód), `beer` (piwo) — ikony **rozróżnialne kształtem** (CLAUDE.md).

| # | Budynek / łańcuch | Receptura (propozycja) | Co to uczy — NOWA przyczyna przestoju |
|---|---|---|---|
| 1 | **Rybak** (`fisher`, 2×2, **musi sąsiadować z wodą**) → ryby | brak wejść → 1 ryba / 9 s | *Miejsce, nie rozkaz*: nowy błąd `NOT_NEAR_WATER` przy stawianiu oraz klasyczny `NO_ROAD` po drugiej stronie rzeki — wymusza most i pokazuje, że budynek bez przeprawy nie ma ruchu (łączy się z lekcją mostów z m2). |
| 2 | **Węglarnia** (`charcoal`, 2×2) | 2 drewna → 1 węgla / 20 s | *Rywalizacja o wejście*: drwal zasila tartak **i** węglarnię. Nowy status `NO_INPUT` z `cause: 'CONTESTED'` („drewno jedzie do tartaku; ten drwal ma jeden wóz") — uczy, że dwa odbiorcy dzielą jedno źródło i potrzeba drugiego drwala lub wozu. |
| 3 | **Kamieniołom** (`quarry`, 3×2, tylko na stoku ≥ 6% lub przy skarpie) → kamień; towar „ciężki": ładunek wozu **4**, nie 6 | 1 kamień / 12 s | *Ciężki ładunek na stromym*: istniejące `SLOPE_K_LOADED` + mniejszy ładunek ⇒ wóz „zwalnia pod górę" (nie przestój — jak H4/błoto, osobne rozróżnienie). Kamień **zużywa** się przy budowie: bruk (`COST_COBBLE`) i most kamienny wymagają od teraz **srebra + kamienia z dowolnego magazynu** (odliczane w komendzie, `ledger.consumed`). Nowy błąd komendy `NO_STONE{need,have}` („Brak kamienia w magazynie — kamień jest w kamieniołomie / na wozie") uczy, że materiał budowlany też musi dojechać do magazynu. |
| 4 | **Targ** (`market`, 3×3, drugi punkt sprzedaży, bez receptury, `storeCap` 0) | przyjmuje towary jak zamek, własne nasycenie rynku | *Dystans i cel*: dostawa do bliższego Targu skraca trasę; gdy Targ nasycony, a zamek daleko, powstaje nowy status wyjścia `OUTPUT_FULL` z `cause: 'MARKET_SATURATED'` („Ceny spadły: sprzedaj gdzie indziej albo zmień towar"). Pokazuje, że przepływ ≠ produkcja. |
| 5 | **Słodownia + Browar** (łańcuch 3-etapowy) → słód → piwo | słodownia: 2 ziarna → 1 słód / 12 s; browar: 1 słód → 2 piwa / 16 s | *Dzielenie ziarna z młynem*: farma zasila młyn i słodownię (rozszerzenie lekcji 2, ale o **długi łańcuch** i `WAITING_UPSTREAM` w kolejnym ogniwie: stoi browar, bo stoi słodownia, bo farma nie wyrabia). Piwo jest najdroższe, więc nagradza opanowanie całego łańcucha i obsługę jarmarku. |

Uwagi:
- Zakres celowo mały: **bez** kowala, tkacza, kościoła, studni, ludzi. Kolejne łańcuchy dopiero po playteście.
- Refaktor wymagany: `GoodMap` jest dziś rekordem z 5 kluczami (`emptyGoods`, `sumGoods` wypisują pola ręcznie) → przejść na `Record<Good, number>` zbudowany z `GOODS`, `STATE_VERSION = 3` z migracją (nowe klucze = 0) i test zapisu v2→v3. To **krok 0** (task S1), bez zmiany zachowania.
- Ładunek 4 dla kamienia: `capacityOf(good)` w `defs.ts` zamiast stałej `WAGON_CAPACITY` (użycia w `logistics.ts`, `wagons.ts`).
- Każdy nowy status/komenda wymaga wpisu w `src/content/stallCodex.ts`, i18n (pl/en minimum, reszta przez paczkę GPT) i testu `stall-codex`.

---

## 4. Tempo i liczby (pierwsze przybliżenie)

### 4.1 Start
Zamiast dzisiejszego układu m1 + 600 srebra: **start „Osada"**: zamek (rynek) + stajnia + magazyn + **drwal i tartak już połączone** drogą z zamkiem (dochód od pierwszej minuty), **260 srebra**, **2 wozy** (dziś 4).
Uzasadnienie: dziś 600 srebra i 4 wozy przeskakują pierwszą fazę. 260 = ok. 6 budynków podstawowych albo 3 budynki + 3 wozy: gracz musi wybrać, ale nigdy nie jest zablokowany (tartak/drwal już zarabiają, sprzedaż wozu zawsze możliwa).

### 4.2 Ceny sprzedaży (srebro/jednostka) i wartość dodana
| Towar | Cena | Uwaga |
|---|---|---|
| drewno | 1 | sprzedaż surowca opłaca się mało — zachęta do tartaku |
| deski | 3 | 1 drewno → 2 deski = 6 (×6 wartości) |
| ziarno | 1 | |
| mąka | 3 | |
| chleb | 4 | 1 ziarno → 1 mąka → 2 chleby = 8 |
| ryby | 4 | surowiec bez wejść, ale wymaga mostu/dojazdu |
| kamień | 3 | niska cena: służy budowie, nie handlowi |
| węgiel | 6 | 2 drewna → 1 węgla = 6 (równo z deskami, ale z innym łańcuchem) |
| słód | 4 | półprodukt (sprzedawalny, ale nieopłacalny) |
| piwo | 9 | 2 ziarna → 1 słód → 2 piwa = 18 (≈ 9/ziarno vs 8 u chleba) |

Cap nasycenia (`cap`) = 24 jednostki na towar, odnowa 1 jedn./20 s ⇒ stałe tempo „bez spadku ceny" 3 jedn./min na towar — wystarczy na 1–2 wozy, więc **drugi towar jest lepszy niż dziesiąty wóz tego samego**.

### 4.3 Dochód (sanity check na liczbach z `defs.ts`)
Trasa ok. 250 m dla wozu na gruncie (3,6 m/s): ok. 70 s w jedną stronę, obieg ok. 2,5–3 min, ładunek 6 szt. Przy deskach po 3 sr: ok. 18 sr/obieg ≈ **6–7 sr/min na wóz**. Dwa wozy ⇒ ok. 13 sr/min: pierwsza budowa (30–40 sr) po ok. 3 min. Wóz (30 sr) zwraca się w ok. 5 min — dobre dla sesji 10–30 min. Produkcja nie jest wąskim gardłem (drwal 6 drewna/min ⇒ 12 desek/min), wąskie gardło to **wozy i drogi** — to dokładnie to, co gra ma uczyć. Cena wozu rośnie łagodnie: `30 + 2·(wozy − 4)` (ponad 4 wozy), żeby uniknąć bezmyślnego mnożenia floty; do kalibracji.

### 4.4 Progi rang
Renoma 400 / 1 500 / 4 000 i przepływ 8 / 20 / 40 sr/min dobrane tak, by: ranga 1 ≈ minuta 7–10 (jedna sprawna linia + sprzedaż 2 towarów), ranga 2 ≈ minuta 18–22, ranga 3 ≈ po 30–35 min (opcjonalna). Uwaga: przepływ 40 sr/min wymaga ok. 6 wozy na dobrych drogach — to wymusza bruk i drugi most.

### 4.5 Strojenie `tools/balance.ts`
Dziś `balance.ts` porównuje strategie na misjach (`plans`, `createWorld(id)`, pętla do `result !== 'running'`). Rozszerzenie:
- plan `sandbox`: stały horyzont (np. 1800 s symulacji) zamiast `result`; strategie: *„nic"*, *„tylko wozy"*, *„farma+młyn+piekarnia @60 s"*, *„rybak za rzeką bez mostu"*, *„3 wozy + bruk @120 s"*;
- wypis: srebro, renoma, ranga, minuta awansu rangi (rejestruj `rankUpTick`), srebro/min w oknie, suma `stallSeconds` wg przyczyny, `jam wagon-s`;
- cel strojenia: ranga 1 w 7–10 min dla „rozsądnej" strategii, **a nie** dla „nic"; strategia „nic" ma zostać na rangie 0 i na dodatnim saldzie (tartak zarabia); żadna strategia nie może zbankrutować bez wyjścia (test: zawsze `coins + sellable ≥ 0` i istnieje ruch);
- bot `tools/bot-sandbox.ts` (wzór: `bot-m2.ts`) jako test regresji: po 20 min ranga ≥ 1, brak deadlocku, zachowanie towarów.
Dane wejściowe do strojenia trzymać w jednej tabeli w `defs.ts` (`MARKET`, `RANKS`), nie rozsiane po kodzie.

---

## 5. Polityka reklam zgodna z D-21 i regułą „no dark patterns"

**Rekomendacja: wersja 1.0 bez reklam**; decyzja o dostawcy po playteście (BACKLOG już mówi „reklamy dopiero po decyzji o dostawcy"). Jeśli reklamy — **wyłącznie** poniższy model.

### 5.1 Dozwolone
- **Opcjonalna reklama nagradzana** w sandboxie: przycisk „Karawana kupca: obejrzyj reklamę, dostaniesz 40 srebra" (≈ 1 wóz). Gracz **zawsze wybiera**, nigdy nie jest pytany w trakcie akcji.
- Dostępna tylko gdy: tryb sandbox, gra spauzowana lub menu/półka budowy, jest sieć i wczytana reklama. W przeciwnym razie przycisk **niewidoczny** (nie szary z napisem „spróbuj później").
- Limit **liczbowy**, nie czasowy: np. do 3 nagród na sesję sandboxa (licznik w pamięci, zerowany przy nowej sesji). Brak odliczania „następna za 0:59".
- Nagroda mała i nieistotna dla ukończenia czegokolwiek: srebro w sandboxie można zarobić bez reklam; **nic nie jest zablokowane za reklamę** (nie odblokowuje rang, budynków, zapisów).

### 5.2 Zakazane (dark patterns)
Reklamy w misjach (m1–m3) i w trakcie kontraktu; interstitiale i banery nad mapą; reklamy przy starcie/wyjściu; „podwój nagrodę" po przegranej; fałszywe zegary i licznik „oferta znika"; przyciski zamknięcia w rogu 8 dp; reklamy dla dzieci / kierowane do dzieci; kontynuacja po niepowodzeniu za reklamę (bo nie ma niepowodzeń); powiadomienia push o nagrodach; udawanie elementów gry (wóz „premium").

### 5.3 Zalety / wady
| | Zalety | Wady |
|---|---|---|
| Rewarded ad (opt-in, sandbox) | zgodne z „free, no pay-to-win"; przychód bez przerywania; gracz kontroluje | dodaje SDK i sieć do gry dotychczas offline; deklaracje danych; ryzyko postrzeganej „kupowanej wygody" (mała nagroda to ogranicza); treść cudzych reklam poza kontrolą (kategorie, blokada treści 18+) |
| Brak reklam | zero SDK, „Data not collected" zostaje, czysty brand | brak przychodu; koszty utrzymania/GPT-paczek spadają na właściciela |
| Banner/interstitial | największy przychód | **łamie pillar i dark-patterns; odrzucone** |
| Dobrowolny napiwek / kosmetyka | bez trackerów | wymaga płatności (D-21 odrzuca zakup pełnej wersji; napiwek to osobna decyzja) |

### 5.4 Prywatność i dokumenty (zmiany obowiązkowe przed pierwszą wersją z reklamami)
- `docs/store/data-safety.md` dziś deklaruje „Data not collected / None" — **przestanie być prawdą**. Play Data safety: *zbierane i udostępniane*: Device or other IDs (Advertising ID), App activity/Diagnostics (zależnie od SDK), przybliżona lokalizacja z IP; cel: Advertising; Apple: **Data Used to Track You** + dialog **ATT** (iOS) lub tryb nie-śledzący (SKAdNetwork, bez IDFA); „Contains ads" w Play Console.
- **EEA/UK**: zgoda zgodna z IAB TCF (Google UMP) przed pierwszym żądaniem reklamy; domyślnie **non-personalized**; opcja wycofania zgody w Ustawieniach. Jeśli odmowa ⇒ brak reklam, gra bez zmian.
- Klasyfikacja wiekowa: **nie** „dla dzieci" (Families Policy ograniczyłaby SDK); ustawić `tagForChildDirectedTreatment=false`, `maxAdContentRating` = G/PG.
- Zaktualizować `privacy-*.md` (17 języków, pliki w docs/store) — sekcja „Reklamy i dostawcy", lista odbiorców; usunąć „jednorazowy zakup / pełna wersja" (BACKLOG już to ma); `appstore-*.md`/`play-*.md` — „zawiera reklamy".
- Technicznie: SDK ładowany **leniwie**, dopiero po zgodzie i tylko w sandboxie; w `src/platform/` interfejs `AdsPort` (domyślnie `NullAds`), żeby sim/UI nie znały SDK, a tryb offline i testy działały bez niego. Reklama nie dotyka stanu sim poza komendą `grantBonus{silver}` (zapis w dzienniku komend, deterministyczne odtworzenie, limit w sim).
- Test CI „brak SDK reklamowego w bundlu bez flagi" i skan uprawnień APK (`AD_ID` tylko jeśli reklamy).

---

## 6. Plan wdrożenia (8 zadań, małe kroki)

Własność plików: **sim** = `src/sim/*`, `tests/*`, `tools/balance.ts|bot-*.ts`; **ui** = `src/ui/*`, `src/i18n/*`, `src/content/*`; **render** = `src/render/*`; **docs/store** = `docs/store/*`. Każde zadanie kończy się `npm run typecheck && npm test`; zadania S1–S5 to sim bez UI i da się je scalać pojedynczo.

| # | Zadanie | Właściciel | Pliki | Testy akceptacyjne |
|---|---|---|---|---|
| S1 | **Generyczne towary**: `GoodMap = Record<Good,number>`, `GOODS` jako źródło, `STATE_VERSION = 3`, migracja v2→v3; 5 nowych towarów zdefiniowanych, bez budynków | sim | `types.ts`, `defs.ts`, `sim.ts`, `platform/save.ts` (tylko migracja) | `saveload` wczytuje zapis v2; hash determinizmu misji m1–m3 **bez zmian** (te same wyniki); `conservation` zielony; `purity` zielony |
| S2 | **Rynek**: `state.market {sold, ...}`, sprzedaż przy rozładunku w zamku (sandbox), ceny z nasyceniem, dochód, `ledger.consumed`; start „Osada" (260 sr, 2 wozy, drwal+tartak połączone) | sim | `defs.ts` (`MARKET`), `logistics.ts` (popyt zamku w sandboxie), `sim.ts`, `missions.ts` | nowy `tests/market.test.ts`: cena monotonicznie spada przy sprzedaży i odnawia się; sprzedaż 12 desek = oczekiwane srebro; konserwacja po 20 min; determinizm (ten sam hash); m1–m3 bez zmian |
| S3 | **Walidacja i cofanie**: czyste `validatePlace`, `placedTick`, zwrot 100% świeżego budynku, błędy `LOCKED`/`NOT_NEAR_WATER` jako typy | sim | `commands.ts`, `types.ts` | `validatePlace` nie mutuje (hash przed = po); wszystkie istniejące `place` zgodne z walidatorem na fuzz (`fuzz.test`); undo ≤ 30 s zwraca 100%, później 50% |
| S4 | **Renoma i rangi**: `state.renown`, pierścień przepływu, zatrzaski różnorodności/przepływu, blokady budynków w sandboxie (`LOCKED`), komenda `ackRank` (lub zdarzenie w `state.events`) | sim | `types.ts`, `defs.ts` (`RANKS`), `commands.ts`, nowy `src/sim/town.ts` | `tests/town.test.ts`: ranga nie maleje; budynek rangi 2 → `LOCKED` przy randze 1; misje m1–m3 bez blokad; bot sandbox osiąga rangę 1 w ≤ 12 min |
| S5 | **Treść**: fisher, charcoal, quarry, market, malthouse, brewery; `NOT_NEAR_WATER`, `NO_STONE`, `CONTESTED`, `MARKET_SATURATED`; ładunek 4 dla kamienia; kamień w koszcie bruku/mostu kamiennego | sim | `defs.ts`, `logistics.ts`, `diagnose.ts`, `commands.ts` | `tests/stall-codex` rozszerzony o nowe powody; `tests/content.test.ts`: każdy budynek ma recepturę zgodną z tabelą; łańcuch słód→piwo działa headless; kamień znika z magazynu przy brukowaniu (konserwacja) |
| S6 | **Zamówienia i jarmarki**: lista `orders` (maks. 2), odrzucanie, nagrody w srebrze/renomie, `season`, jarmark ±25% z RNG w stanie | sim | `types.ts`, `defs.ts`, nowy `src/sim/orders.ts`, `logistics.ts` | `tests/orders.test.ts`: zamówienie realizuje się i konsumuje towary; odrzucone wraca inne; deterministyczność jarmarku; brak wygaśnięcia po 60 min |
| S7 | **UI budowania**: narzędzie `build`, półka kart, duch (przeciąganie z offsetem 72 dp, obrót, powód błędu, cena, „Cofnij"), HUD renomy, panel zamówień; i18n pl/en | ui (+ render) | `ui/buildTool.ts` (nowy), `app.ts`, `hud.ts`, `icons.ts`, `panels.ts`, `i18n/pl.ts`, `i18n/en.ts`; `render/api.ts`, `render/view.ts`, `render/buildingsView.ts` (duch) | Playwright `npm run shots` 412×915 / 915×412 / 904×1000: duch zielony/czerwony, brama widoczna, półka z zablokowanymi kartami; test e2e: drag→Postaw→`buildings.length+1`; cele dotyku ≥ 48 dp (`layout.ts`); ręczny przegląd względem listy zakazów CLAUDE.md |
| S8 | **Reklamy (po decyzji właściciela)**: `AdsPort`, nagroda, zgoda UMP/ATT, zmiana deklaracji danych i polityk prywatności | ui + docs/store | `platform/ads.ts` (nowy), `ui/panels.ts`, `docs/store/*`, `docs/store/privacy-*.md` | test: bez flagi brak SDK w bundlu; nagroda działa tylko w sandboxie i poza misją; limit 3/sesję; dziennik komend odtwarza `grantBonus`; przegląd deklaracji w obu sklepach |

Kolejność: S1 → S2 → S3 → (S4, S5 równolegle) → S6 → S7 (może zacząć po S3, z atrapami) → S8 na końcu. Pierwszy grywalny kawałek: **S1+S2+S3+S7 (bez rang)** = sprzedajemy towary i stawiamy budynki; reszta to głębia.

## 7. Ryzyka i pytania do właściciela
1. Czy sandbox ma **jedno** stałe miasteczko z zapisem (rekomendowane), czy wiele zapisów/map? Rekomendacja: jeden zapis, nowa gra = reset.
2. Czy Targ i zamek mają sprzedawać po tych samych cenach? (zalecane: tak, różnią się tylko nasyceniem i odległością).
3. Ranga 3 „Miasto" to cel końcowy — czy dopuszczamy dalsze rangi i nowe łańcuchy po playteście?
4. Reklamy w ogóle? Rekomendacja: nie w 1.0; wrócić po danych z playtestu.
5. Ryzyko pomijania pillaru: łatwo o „ładne miasto bez przestojów"; dlatego każda ranga ma przepływ jako warunek i każda nowość uczy nowej przyczyny (§3).
