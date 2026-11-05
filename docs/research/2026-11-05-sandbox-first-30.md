# Wolna dolina: pierwsze 30 minut po misji I (2026-11-05)

**Status: pomiar pełny.**
- Część A, bez przeglądarki: gracz „oko” w dolinie, 18 wariantów × 3 ziarna (1301–1303; domyślne ziarno to 1301), po 30 min gry.
- Część B, przeglądarka: zimny start → menu → „Wolna dolina” → nowa księga → 30 min gry. Portret 412×915 i krajobraz 915×412.

**Wniosek w jednym zdaniu.** W dolinie karta „Najgorszy zastój” przez ponad 99 % czasu jest pusta albo spokojna i bez lekarstwa, a gracz kończy 30 minut z 600–1000 srebra, którego nic nie każe wydać.

Szczegóły:
- **Tempo rang.** Gracz, który robi tylko to, co mówi karta (plus minimalny porządek budowy), osiąga rangę 1 w 14–17 min (projekt: 7–10). Rangi 2 w 30 min prawie nigdy nie osiąga (projekt: 18–22).
- **Reguły D-110..D-132.** Żadna nie odpala w dolinie błędnie: karta tempa, flota (D-127/D-128) i błoto (D-116/D-132) wymagają kontraktu. Z tego samego powodu dolina nie ma żadnego sygnału „kup wóz” przy najczęstszym stanie, czyli „czekanie na odbiór”.
- **Jedyny komunikat, który radzi coś niewykonalnego,** to zapowiedź deszczu: „bruk utrzyma tempo”, podczas gdy bruk do rangi 2 jest zablokowany.

Narzędzia (oba nowe, bez zmian w `src/`):
- `tools/sandbox-first30.ts`, bez przeglądarki. Dane: `docs/research/sandbox30-data/seeds.{json,txt}`.
- `tools/sandbox-first30.mjs`, Playwright + SwiftShader, `?debug=1&lang=pl&quality=low`, `vite preview --port 5195`. Czas gry pędzi własna pętla aplikacji (`app.loop.tickOnce`, porcje po 10–20 s gry), więc toasty, powiadomienia, kronika i zdarzenia odpalają tak jak w grze. Gracz co 30 s gry dotyka oka karty, czyta arkusz, naciska „Naprawa”, jeśli jest, i zamyka arkusz krzyżykiem. Porządek budowy dochodzi jako komendy.
- JSON-y przebiegów i zrzuty (JPEG, 39–54 KB): `docs/research/shots-sandbox30/`.

## Gracz „oko” i minimalny porządek budowy

**Oko** co N s (10/30/60) patrzy na slot karty. Jeśli karta tempa zajęłaby slot, liczy ją (w dolinie ani razu). W przeciwnym razie bierze `rankStalls()[0]` i naciska to, co oferuje arkusz:
- drogę z wyszukiwarki luk;
- „Kup wóz”;
- ducha spichlerza.

To ta sama logika co w `tools/balance-night6.ts`. Dodatkowo oko liczy czas slotu (co sekundę: pusty / spokojny / z lekarstwem / bez lekarstwa) i każdą nieudaną naprawę razem z błędem.

**Minimalny porządek budowy („build”)** to jedna nowa linia na każde odblokowanie i nic poza tym. Wozy kupuje wyłącznie z karty.

| krok | kiedy | uzasadnienie |
|---|---|---|
| Gospodarstwo (55,25) przy drodze zamkowej | 0:30 | Misja I nie uczyła budowania, ale narzędzie „Buduj” stoi pierwsze w szynie. Tablica rangi mówi „Różne towary 0/2”: dolina startowa sprzedaje tylko deski, bo drewno w całości zjada tartak, więc bez nowego towaru ranga 1 jest nieosiągalna. Gospodarstwo to najtańszy nowy towar dostępny od rangi 0. |
| Młyn + piekarnia | ranga 1 | List rangi mówi wprost: „Odblokowano: Młyn wodny i Piekarnia”. |
| Droga do rzeki + rybak | ranga 2 | Analogicznie; w 30 min prawie nigdy nie dochodzi do tego kroku. |

Miejsca budowy biorę z planu DECENT (przy drodze, bez drogi łączącej), czyli z korzyścią dla gracza.

## Część A: wyniki bez przeglądarki (3 ziarna, 30 min)

Kolumna „spojrzenia” to: pusta karta / spokojna bez lekarstwa / lekarstwo zadziałało / inne, z liczby wszystkich spojrzeń (3 ziarna razem).

| gracz | ranga 1 (min) | ranga 2 (min) | zarobione | srebro na koniec | wozy | spojrzenia |
|---|---|---|---|---|---|---|
| nic | – | – | 210 | 470 | 2 | — |
| tylko budowa | – | – | 205 | 435 | 2 | — |
| oko 10 s | 15,2 / 15,3 / 15,8 | – | 415 | 615 | 4,0 | 246 / 285 / 6 / 0 z 537 |
| oko 30 s | 15,7 / 16,2 / 16,3 | – | 434 | 624 | 4,3 | 75 / 95 / 7 / 0 z 177 |
| oko 60 s | 17,1 / 16,8 / 16,9 | – | 419 | 619 | 4,0 | 34 / 47 / 6 / 0 z 87 |
| budowa + oko 10 s | 12,2 / 13,1 / 13,4 | 29,8 / – / – | 978 | 986 | 6,3 | 215 / 309 / 13 / 0 z 537 |
| **budowa + oko 30 s** | **14,1 / 14,9 / 16,0** | **–** | 795 | **835** | 5,7 | 46 / 120 / 11 / 0 z 177 |
| budowa + oko 60 s | 14,1 / 16,0 / 17,6 | – | 746 | 806 | 5,0 | 20 / 58 / 9 / 0 z 87 |
| budowa + oko 30 s + zdarzenia (każde zamówienie przyjęte, kupiec obsłużony) | 13,8 / 16,1 / 15,5 | – | 903 | 933 | 6,0 | 48 / 117 / 12 / 0 z 177 |
| DECENT (bot wzorcowy, 18 wozów) | 10,4 / 10,5 / 10,6 | 22,3 / 22,5 / 22,7 | 1698 | 1040 | 16,7 | — |

Co pokazuje karta, w procentach czasu slotu:

| gracz | pusta | spokojna | z lekarstwem |
|---|---|---|---|
| budowa + oko 30 s | 25 % | 74 % | 0,9 % |
| oko 30 s | 43 % | 57 % | 0 % |

Tematy slotu przy „budowa + oko 30 s” (suma sekund z 3 ziaren):
- `WAITING_PICKUP` (spokojny) 3730 s;
- `OUTPUT_FULL.NO_WAGON` (spokojny, nadwyżka na targ, D-85 MARKET) 270 s;
- `NO_WAGON.ALL_BUSY` 46 s.

**Krytycznej (czerwonej) karty nie było ani razu,** w żadnym wariancie.

**Naprawy, które zawiodły: 0.** Ani jednego `NO_COINS`, bo srebra jest za dużo, nie za mało. Wszystkie zakupy wozów przyszły z jednego źródła: spokojnej nadwyżki na targ (D-85 MARKET zostawia „Kup wóz”). Takie zakupy zdarzają się 2–4 razy w 30 min, zwykle w 3.–7. minucie, potem rzadko.

### Czy któraś reguła odpala w dolinie błędnie?

| reguła | wynik w dolinie | ocena |
|---|---|---|
| karta tempa D-115 (`producer`) | 0 razy (`forecastFor` → null bez kontraktu) | poprawnie |
| błoto D-116 / duch bruku D-132 | 0 razy (`mudCard` wymaga kontraktu) | poprawnie. W pierwszych 30 min jest 6 deszczów, ale bruk i tak jest zablokowany do rangi 2. |
| flota D-127 / „Kup wóz” na arkuszu odbioru D-128 | 0 razy: `sampleFleet` nie próbkuje bez kontraktu, `fleetGate` wymaga prognozy | nie „błędnie”, tylko **brakuje jej**. Najczęstszy stan doliny (`WAITING_PICKUP`, 74 % slotu) nie ma lekarstwa, choć wóz jest właściwym lekiem (prototyp niżej). |
| karta wspólnego producenta D-110 | 0: `sampleInputWaits` i `sharedOneProducer` pomijają misję „ranked” | poprawnie przed rangą 3; w późnej dolinie do sprawdzenia osobno |
| zapowiedź deszczu `hud.rainSoon` | 6 razy w 30 min, „Za pół minuty deszcz — grunt rozmięknie, **bruk utrzyma tempo**”, przy szarym „Bruk” | **błędna rada.** `src/ui/hud.ts` `update()` nie sprawdza `canSurface(world, 2)`. |

### Dwa prototypy reguł (tylko w narzędziu, nie w grze)

- **sbF, flota w dolinie.** Bramka D-127 bez części kontraktowych (prognoza, cel, 3:30 zapasu):
  - slot jest pusty albo spokojny;
  - jakieś podwórze czeka na odbiór ≥ 20 s, a jego wóz nie stoi przy moście;
  - żaden wóz nie stoi bezczynnie;
  - flota była w trasie ≥ 90 % ostatniej minuty;
  - srebro ≥ 30 + 40 zapasu na następny budynek.
- **sbR, karta rangi.** Gdy slot jest pusty albo spokojny, a następnej randze brakuje różnych towarów: karta nazywa najbliższego niepostawionego producenta niesprzedanego towaru (gospodarstwo; młyn, gdy jest gospodarstwo; piekarnia, gdy jest młyn; rybak). Przycisk otwiera narzędzie budowy z duchem przy zamku (`buildSite`), jak „Postaw jeszcze” z karty tempa.

| gracz | ranga 1 (min) | ranga 2 (min) | zarobione | srebro na koniec | wozy |
|---|---|---|---|---|---|
| budowa + oko 30 s (dziś) | 14,1 / 14,9 / 16,0 | – | 795 | 835 | 5,7 |
| budowa + oko 30 s + sbF | **11,3 / 11,5 / 11,4** | – / 29,9 / 29,5 | 1012 (+27 %) | 958 | 8,0 |
| budowa + oko 10 s + sbF | 11,7 / 11,4 / 12,1 | – / 29,4 / 29,5 | 999 | 935 | 8,3 |
| budowa + oko 60 s + sbF | 12,5 / 11,8 / 12,4 | – / 29,1 / – | 990 | 958 | 7,7 |
| oko 30 s (bez budowy) | 15,7 / 16,2 / 16,3 | – | 434 | 624 | 4,3 |
| oko 30 s + sbR (bez porządku budowy) | 15,1 / 15,8 / 15,6 | – | 675 | 666 | 6,7 |
| **oko 30 s + sbF + sbR (sama karta)** | **12,3 / 12,0 / 12,4** | – | 882 | 803 | 9,0 |
| oko 60 s + sbF + sbR | 13,5 / 12,3 / 12,4 | – | 859 | 790 | 8,7 |

Wnioski z prototypów:
- **sbF** przyspiesza rangę 1 o 3–4 min, daje +27 % srebra i nie zawiodła ani razu. Wozy kupuje w 2.–7. minucie, gdy flota naprawdę jest wąskim gardłem; później sama milknie, bo zaczynają stać bezczynne wozy.
- **sbR** sprawia, że gracz bez żadnej wiedzy spoza karty w ogóle buduje. Bez niej „oko” zostaje na zawsze przy 2 towarach i nigdy nie dojdzie do rangi 2, bo ta wymaga 4 towarów.
- **Ściana rangi 2 to renoma 1000.** Towary (5/4) i przepływ (55–68/20) są spełnione z zapasem. W 30 min gracz z kartą ma 800–1000 renomy. Nawet z oboma prototypami ranga 2 przychodzi w ~29,5 min albo wcale. Projekt (D-27, `docs/design/sandbox.md`: 18–22 min) zakłada drugi łańcuch: drugie gospodarstwo, drugi tartak i ~16 wozów, czyli to, co robi DECENT. Tego karta dziś nie podsuwa, a sbR też nie, bo patrzy tylko na liczbę towarów.

## Część B: przeglądarka (portret 412×915, krajobraz 915×412)

Ten sam gracz (budowa + oko 30 s przez UI). Wynik po 30 min gry:

| | portret | krajobraz |
|---|---|---|
| ranga | 1 (15,8 min) | 1 (15,8 min) |
| srebro | 842 | 794 |
| wozy | 5 | 6 |
| dotknięcia | 91 | 92 |
| spojrzenia | 59 | 59 |
| błędy konsoli | **0** | **0** |
| cele < 48 px w grze | **0** | 0 (jeden przypadek przy otwartej karcie zdarzeń, ustalenie B5) |

Ze 59 spojrzeń w portrecie: 17 razy karta pusta, 39 razy „czekanie na odbiór” bez naprawy, 3 razy „pełny magazyn, brak wozu” → „Kup wóz −30” (zadziałało). Krajobraz wygląda tak samo: 17 / 39 / 3. Naprawę („Kup wóz” podświetlony w szynie) widać w 7 ze 105 próbek co 10–20 s.

**B1. Wejście do doliny: brak listu, kierunku i widoku osady.**
- W menu „Wolna dolina” leży pod fałdą w obu orientacjach: portret y 946–1004 przy wysokości 915, krajobraz y 411–463 przy 412 (`port-01-menu.jpg`, `land-01-menu.jpg`). Potrzebny przewijany gest. „Zacznij tutaj” wciąż wskazuje misję I (świeży kontekst przeglądarki).
- Wybór księgi jest czytelny: 3 × „Nowa osada”, 128–136 słów, 0 celów < 48 px (`port-02-ledger.jpg`).
- Dolina **nie ma listu otwarcia** („no letters exist for sandbox”, `src/content/letters.ts`). Gracz trafia od razu do gry na ×1.
- Pierwszy ekran ma 24 słowa: tablica „Osada · Do rangi »Wieś targowa«: Renoma 0/200, Różne towary 0/2, Przepływ 0/8” i nagłówek „Wieści z doliny 1”.
- Karty przestoju nie ma (nic jeszcze nie stoi), szyna nie podświetla żadnej naprawy.
- W portrecie kamera pokazuje rzekę i pustą łąkę na południowym brzegu. Zamek i tartak leżą na górnej krawędzi pod tablicą rangi, która zajmuje 222 px, czyli 24 % ekranu (`port-03-start.jpg`). W krajobrazie osada jest widoczna u góry po lewej (`land-03-start.jpg`).
- **Nic nie mówi „postaw coś”.** „Różne towary 0/2” jest prawdziwe, ale nie wskazuje czynności. Gracz po misji I zna drogę i wóz, a budowania nie zna. Jedynym tropem, że trzeba budować, jest list rangi, który przychodzi dopiero po randze 1.

**B2. Karta przestoju mówi „czekaj” przez 30 minut.**
- Pierwsza karta (0:36) to „Tartak: czekanie na odbiór”. Arkusz pokazuje łańcuch „Pełno desek — odbiór: wóz 1 → Wóz 1 jedzie po ładunek”, „Co to znaczy?” i linijkę D-94 („Ma drewna na pracę; dowóz zamówi, gdy zmieści się 4 — pełniejszy wóz, mniej kursów”). Naprawy nie ma (`port-04-look1.jpg`).
- Tak wygląda 66 % spojrzeń. Pozostałe 29 % to pusta karta.
- Jedyna naprawa w 30 min: „Gospodarstwo: pełny magazyn, brak wozu” → „Kup wóz −30” z dobrym tekstem „Wszystkie wozy są zajęte…” (`port-09-look-fix.jpg`). Trzy zakupy weszły w 7:30–9:00.
- Od 10. minuty do końca karta nie dała żadnej czynności. Srebro rośnie z 208 do 842 (`port-10-min10.jpg`, `port-14-min30.jpg`).

**B3. Co konkuruje z kartą przestoju.** W 30 min gry:

| źródło | ile razy |
|---|---|
| kronika (toasty) | 14 |
| toasty zdarzeń: zamówienie królewskie, kupiec, jarmark | 3 |
| list rangi | 1 |
| powiadomienia o deszczu / porze roku | do 12 + 2 (deszcz co ~4–5 min, z zapowiedzią i początkiem) |
| „Postawiono…” | 3 |

- Kronika przychodzi seriami. W 9:45 trzy toasty naraz („Trzy dobra w obrocie”, „Sześć miar zboża”, „Pierwsze zboże”), w 18:45 dwa plus powiadomienie o deszczu (`port-12-rain.jpg`). Stos toastów stoi nad kartą przestoju; w portrecie nie zasłania jej, w krajobrazie leży nad szyną. Nakładania tekstu audyt nie zgłosił.
- Kronika i zdarzenia nie przykrywają karty, ale **są jedynym ruchem na ekranie**. Karta przez 99 % czasu mówi „czekaj”, więc oko gracza naturalnie idzie do toastów, które nie wymagają czynności. Zamówienie królewskie wymaga przyjęcia, ale w zwiniętej karcie widać tylko licznik.
- Pierwsze zamówienie królewskie („Dom poborcy myta”, drewno 9 + deski 8) czeka od 0:00. Kupiec przychodzi w 1:30 („kupi deski”, `port-07-merchant.jpg`). W pierwszych 2 minutach dolina daje więc dwie oferty, zanim karta przestoju powie cokolwiek. Licznik „Wieści z doliny” rośnie 1 → 4 i nikt go nie otwiera (gracz-oko nie otwiera).
- „Dom poborcy myta” chce **drewna**, którego dolina startowa w ogóle nie sprzedaje, bo całe drewno zjada tartak. Bez drugiego drwala zamówienie jest niewykonalne, a karta o tym nie mówi.
- Pinezki nadwyżki: przy tej skali najwyżej 1 widoczna pinezka. Mosiężna, spokojna, nie konkuruje.

**B4. List rangi** (15:46): „Nowa ranga: Wieś targowa… Odblokowano: Młyn wodny i Piekarnia” (`port-11-rank.jpg`). To jedyna wskazówka budowy w całej sesji i działa. Przy randze 1 gracz od razu wie, co postawić. W portrecie list przykrywa tablicę rangi; zamyka się jednym dotknięciem.

**B5. Otwarta karta zdarzeń w krajobrazie** (`land-15-ev-open.jpg`): 300×254 px po prawej. Przycisk „Odłóż” wchodzi pod pieczęć alarmu („Odłóż” × `al-badge`, „Przyjmij” × kicker „Najgorszy zastój”). Jej dół (y 322) styka się z kartą przestoju (y 332). Audyt zgłosił „Odłóż” jako zasłonięty. Portret: 330×364 px, nic nie zasłania (`port-15-ev-open.jpg`).

**B6. Noc** (19:00–6:00 zegara gry) przyciemnia scenę mocno (`port-12-rain.jpg`). Nie jest to ustalenie z tego briefu, tylko zauważone przy okazji. HUD pozostaje czytelny.

## Poprawki (priorytet; wszystkie poza P5 to UI)

1. **P1. Flota w dolinie: „Kup wóz” przy długim czekaniu na odbiór.**
   - Gdzie: `src/ui/paceCard.ts`. `sampleFleet` ma próbkować także bez kontraktu, gdy `marketOpen(world)`. Nowa gałąź `fleetGate` dla doliny: bez prognozy, celu i `FLEET_ROOM_TICKS`, ale z resztą bramki D-127 (≥ 20 s odbioru, wóz nietrzymany, brak bezczynnego wozu, flota ≥ 90 % w trasie, `WAGON_PRICE` + ~40 srebra zapasu, `iceBeforeWagon`). Karta potrzebuje nagłówka innego niż „Tempo zamówienia” (np. „Wozy”); tekst `cause.paceFleet` pasuje bez zmian. `fleetCueFor` (D-128) daje wtedy „Kup wóz” na arkuszu każdego takiego podwórza.
   - Efekt (prototyp sbF): ranga 1 14,1–16,0 → 11,3–11,5 min, +27 % srebra, 0 nieudanych zakupów, ranga 2 w 2 z 3 ziaren tuż przed 30. minutą. Misje bez zmian: tam nadal działa gałąź kontraktowa.
2. **P1. Zapowiedź deszczu bez rady o bruku, gdy bruk jest zablokowany.**
   - Gdzie: `src/ui/hud.ts`, `update()`. `hud.rainSoon` tylko przy `canSurface(world, 2).ok`; w przeciwnym razie nowy klucz bez bruku („Za pół minuty deszcz — wozy zwolnią na gruntowych drogach”) albo brak zapowiedzi (sam `hud.rain` przy starcie deszczu wystarczy).
   - Efekt: 6 błędnych rad mniej w pierwszych 30 min; dotyczy też misji z zablokowanym brukiem.
3. **P2. Karta rangi w dolinie, gdy slot jest pusty albo spokojny.**
   - Gdzie: nowy rodzaj karty (np. `rank` w `src/ui/paceCard.ts` albo osobny `src/ui/rankCard.ts`) czyta `sandboxStatus`. Gdy brakuje różnych towarów: „Do rangi Wieś targowa brakuje 1 towaru — postaw Gospodarstwo”, przycisk `nav.pickBuild(type, castleId)`. Gdy brakuje tylko renomy (dzisiejsza ściana rangi 2): spokojna linia z tempem, np. „renoma 782/1000, +42/min — drugi łańcuch przyspieszy” (wymaga decyzji właściciela, pytanie 2). Ten sam kalm-slot co karta tempa, nigdy czerwony.
   - Efekt (prototyp sbF+sbR, sama karta bez wiedzy spoza gry): ranga 1 w 12,0–12,4 min zamiast nigdy nie budować; 0 z 177 spojrzeń z nieudaną akcją.
4. **P2. Pierwszy ekran doliny: jedna linijka kierunku.**
   - Gdzie: krótki list otwarcia doliny w `src/content/letters.ts`, rodzaj `opening` dla `sandbox` (3 zdania: targ kupuje wszystko, rangi odblokowują budynki, „Postaw gospodarstwo — zboże to drugi towar”). Albo jednorazowa notatka nad „Buduj”.
   - Kamera startowa w portrecie: `src/ui/app.ts` `enterGame`, kadr na zamek i tartak (`frameCells` budynków startowych) zamiast łąki. Opcjonalnie tablica rangi złożona do pieczęci na starcie w portrecie (`prefs`).
   - Efekt: gracz wie w < 30 s, co zrobić w dolinie. Dziś odpowiedź przychodzi dopiero w liście rangi w 15. minucie.
5. **P2. Zamówienie królewskie, którego dolina nie może spełnić.**
   - Gdzie: `src/sim/events.ts` (szablony zamówień już filtrują po „complete existing chain”). Drewno nie ma klienta targowego, bo tartak zjada wszystko, więc „Dom poborcy myta” (drewno 9) na starcie jest praktycznie niewykonalny.
   - Albo wykluczyć drewno z zamówień, dopóki sprzedano 0 drewna, albo w karcie zdarzeń (`src/ui/eventCard.ts`) dopisać „brak drewna na wolnym rynku — postaw drugiego drwala”.
   - Uwaga: zmiana w `events.ts` zmienia hasze doliny (RNG), a misje zostają bez zmian. Do decyzji właściciela.
6. **P3. Kronika bez serii.**
   - Gdzie: `src/ui/app.ts` `onTick`: przy kilku nowych wpisach w tej samej sekundzie jeden toast „Kronika: 3 nowe wpisy” zamiast trzech.
   - Efekt: mniej szumu obok karty (dziś 14 toastów w 30 min, w tym dwie serie po 2–3).
7. **P3. Krajobraz: otwarta karta zdarzeń nachodzi na pieczęć alarmu.**
   - Gdzie: `src/styles` (karta `.ev-card` w krajobrazie): `max-height` do `--rail-h` + odstęp albo przewijana lista.
   - Efekt: „Odłóż” nie leży pod pieczęcią (B5).
8. **P3. Menu: „Wolna dolina” nad fałdą** (A5 z poprzednich raportów). Po ukończeniu misji I wiersz doliny mógłby stać zaraz pod „Zacznij tutaj”, albo „Zacznij tutaj” przechodzi na następny krok.

## Pytania do właściciela

1. Czy w dolinie wóz ma być podpowiadany przy „czekaniu na odbiór” (P1)? W misjach D-128 trzyma to w bramce kontraktowej, bo spóźniony wóz kosztował pieczęcie. W dolinie nie ma pieczęci, a pomiar daje +27 % srebra i 3–4 min szybszą rangę 1.
2. Ranga 2, renoma 1000: gracz prowadzony kartą ma w 30 min 800–1000 renomy, a projekt mówi 18–22 min. Co wolisz: obniżyć próg (np. 800), czy dodać do karty rangi podpowiedź „drugi łańcuch”?
3. Czy dolina ma dostać krótki list otwarcia (P4)? Dziś gracz po misji I wchodzi bez słowa instrukcji.
