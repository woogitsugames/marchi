# Wolna dolina, środek gry (rangi 2–3): gracz, który słucha tylko kart — 2026-11-05

Stan: baza `a419f71` (D-140 karta floty, D-152/D-163 karta rangi, D-168 ranga 1 przy renomie 120).
Narzędzia: `tools/sandbox-first30.ts` (gracze `card-10/30/60`, nowe: ślad co minutę, prototyp karty
„rozbuduj” `+grow`, `--safe-sites`, `--ranks` do prób balansu), `tools/valley-ranks23.ts` (który warunek rangi
spełnił się ostatni). Seedy: default (= 1301, identyczne wyniki), 1302, 1303, 1304. Surowe logi:
`docs/research/valley-ranks-2-3/`.

Cele (`tests/chains.test.ts`, okna DECENT): ranga 2 w 20–30 min, ranga 3 w 40–50 min.

## 1. Wynik w skrócie

- Gracz „tylko karty” ma rangę 1 w 8–10 min (dobrze), **rangę 2 w 30,3–32,4 min** (tuż za oknem) i **rangę 3
  w 64,7–71,9 min** (20+ min za oknem). Bot DECENT: 6,8–7 / 20,3–20,7 / 39,5–40,4.
- **Hamulcem obu rang jest wyłącznie renoma.** Różnorodność (4 towary) jest spełniona w 12–15 min, (6 towarów)
  w 33–35 min; przepływ 20 sr/min w 5–10 min, 60 sr/min w 17–40 min. Renoma rośnie ~40/min (ranga 1→2)
  i ~57/min (2→3), bo gracz ma przez 50 minut **jeden** łańcuch każdego rodzaju.
- **Srebro leży.** W chwili rangi 2 gracz ma 850–950 sr, przy randze 3 — 2 670–2 820 sr (budynek kosztuje
  20–45 sr). Po zbudowaniu młyna i piekarni karta nie proponuje żadnej inwestycji poza wozem.
- **Karta przez >90 % czasu milczy.** Faza 1→2: 21–24 z 22–24 minut to „pusto” albo spokojne „czeka na odbiór”;
  faza 2→3: 31–36 z 35–40 minut. Karta floty strzela 1–3 razy na fazę, karta rangi 1–2 razy.
- Karta rangi nazywa właściwe budynki: przy 0→1 farmę, przy 1→2 młyn i piekarnię (rangowe odblokowania 1),
  przy 2→3 rybaka (odblokowany na 2) i — jeśli ryba jeszcze się nie sprzedała — od razu kamieniołom. Węglarza
  i słodowni (ranga 3) karta nigdy nie nazywa (`RANK_ORDER` ich nie ma; dla rangi 4 wystarczy 7 towarów
  z kamieniem, więc to sprawa późnej doliny — drugi agent).
- **Niewykonalne lekarstwo:** seed 1304 — wokół zamku (10 pól) nie ma wysokiego gruntu, „Postaw: kamieniołom”
  otwiera czerwonego ducha na środku ekranu; karta wraca co minutę do końca gry (w fazie 3→4 ~18 min z rzędu).
- **Dwa błędy kart wyszły przy rozbudowie** (prototyp `+grow`, ale tak samo zrobi to każdy gracz, który postawi
  drugą farmę ręcznie) — patrz §4.

## 2. Tabela: gracz × seed (60–90 min, gra bez zmian)

Minuty awansu; „sr@R2/R3” = srebro w chwili awansu; wozy/budynki przy randze 3.

| gracz | seed | R1 | R2 | R3 | sr@R2 | sr@R3 | wozy | bud. | renoma/min 1→2 / 2→3 |
|---|---|---|---|---|---|---|---|---|---|
| card-10 | 1301 | 9,5 | 31,5 | 66,5 | 906 | 2 731 | 12 | 10 | 40 / 57 |
| card-10 | 1302 | 8,4 | 30,4 | 64,7 | 897 | 2 672 | 13 | 10 | 40 / 58 |
| card-10 | 1303 | 8,9 | 30,3 | 66,1 | 870 | 2 740 | 12 | 10 | 41 / 57 |
| card-10 | 1304 | 8,2 | 31,8 | 71,9 | 850 | 2 714 | 12 | 9 | 36 / 49 |
| card-30 | 1301 | 8,9 | 31,4 | 66,5 | 906 | 2 741 | 12 | 10 | 39 / 57 |
| card-30 | 1302 | 8,9 | 30,5 | 67,3 | 936 | 2 734 | 12 | 10 | 41 / 55 |
| card-30 | 1303 | 9,3 | 31,4 | 66,1 | 892 | 2 717 | 13 | 10 | 39 / 58 |
| card-30 | 1304 | 8,5 | 31,1 | 71,1 | 948 | 2 821 | 11 | 9 | 39 / 50 |
| card-60 | 1301 | 10,4 | 32,4 | 67,4 | 893 | 2 788 | 10 | 10 | 40 / 57 |
| card-60 | 1302 | 9,4 | 31,4 | 71,7 | 949 | 2 820 | 10 | 9 | 42 / 50 |
| card-60 | 1303 | 9,5 | 32,2 | 65,9 | 939 | 2 701 | 12 | 10 | 39 / 59 |
| card-60 | 1304 | 9,3 | 31,3 | 71,5 | 914 | 2 808 | 11 | 9 | 41 / 50 |
| DECENT | 1301–1304 | 6,8–7,0 | 20,3–20,7 | 39,5–40,4 | — | — | 25 | 21 | — |

Seed 1304 jest wolniejszy w 2→3, bo kamieniołom nie staje (brak 7. towaru nie hamuje rangi 3, ale gracz ma
o jedno źródło srebra mniej). Gracz przyjmujący każde zamówienie i kupca (`card-30+ev`): R2 29,8–30,0,
R3 62,1–66,8 — wydarzenia dają 3–5 min, nie zmieniają obrazu.

### Co mówi karta (minuty fazy, card-30)

| seed | faza 1→2: pusto / spokój / flota / ranga | faza 2→3: pusto / spokój / flota / ranga |
|---|---|---|
| 1301 | 15 / 6 / 1 / 1 (młyn) | 17 / 16 / 1 / 1 (kamieniołom) |
| 1302 | 10 / 11 / 0 / 1 | 13 / 21 / 2 / 1 (rybak) |
| 1303 | 12 / 8 / 1 / 1 | 10 / 22 / 2 / 1 |
| 1304 | 8 / 13 / 1 / 1 | 19 / 16 / 3 / 2 (kamieniołom — niewykonalny) |

## 3. Wiążące ograniczenie per ranga

- **Ranga 1→2:** renoma 1 000 (towary 4 w ~13 min, przepływ 20 w ~5–10 min). Brakuje ~10 min przy
  ~40 renomy/min; jeden łańcuch chleba + deski + zboże daje ~40 sr/min i więcej nie da.
- **Ranga 2→3:** renoma 3 000 (towary 6 w ~34 min, przepływ 60 w 17–40 min). Przy ~57/min potrzeba ~35 min.
- Przyczyna wspólna: **żadna karta nie każe rozbudować działającego łańcucha**, gdy brak już tylko renomy.
  Gracz z kartami nie ma powodu wydać 900–2 800 sr, które leżą. DECENT dochodzi do celu dokładnie tym:
  druga farma/młyn/piekarnia, drugi tartak, drugi rybak, bruk.

## 4. Błędy i złe lekarstwa znalezione po drodze

1. **Duch obok zamku przecina ukośną drogę** (bez komunikatu). `buildSite` ma prawo postawić budynek tak, że
   zajmuje narożnik ukośnego kroku drogi; `network.ts` (krawędź ukośna wymaga wolnych obu narożników) od tej
   chwili tej krawędzi nie widzi. Przykład (seed 1301): druga farma przy zamku (65,23) odcina pierwszą farmę,
   której łącze `suggestLinkToStable` biegło (64,23)→(65,22). Odcięta farma dostaje
   `OUTPUT_FULL.NO_DESTINATION` z `blockedBy` = pusty spichlerz (`cutOffWh`), łańcuch kończy się na spichlerzu
   IDLE → **karta krytyczna bez lekarstwa** zajmuje slot na stałe (w próbie 60+ min, karta rangi już nigdy
   nie wraca — gracz utknął na randze 1–2). Dotyczy też ducha z karty rangi (rybak, kamieniołom).
2. **Pętla „Kup wóz” przy pełnym spichlerzu w nasyconym rynku.** Gdy gracz ma ≥ 2–3 łańcuchy, rynek jest
   nasycony (wszystkie towary 18–23/24), spichlerz się zapełnia, `cureFor` → `STORAGE_FULL` +
   `clogNeedsWagon` → „wóz”. Gracz co 10 s kupił 115–233 wozy (do 250), stall nie zniknął (rynek ma limit
   `inflightPerGood` 12 na towar, nowe wozy nie wiozą więcej). `card-30`: 77–109 wozów. To złe lekarstwo
   w czystej postaci.
3. **Kamieniołom bez miejsca** (seed 1304): karta rangi nazywa budynek, dla którego `buildSite` nie zwraca
   żadnego miejsca (10 pól wokół zamku), więc przycisk daje czerwonego ducha w środku ekranu.

## 5. Poprawki (karta lub balans) i oczekiwany efekt

Prototypy w `tools/sandbox-first30.ts` (nie w grze). Pomiar: 4 seedy × 3 gracze, 60 min, `--safe-sites`.

### F1 — karta „rozbuduj” (karta rangi, gdy brakuje już tylko renomy) — **główna poprawka**
Reguła (`sbGrow`): od rangi 1, gdy slot jest pusty/spokojny, następnej randze brakuje tylko renomy
(towary ≥, renoma <) i srebro ≥ cena + 40: karta nazywa jeszcze jeden producent istniejącego łańcucha —
najmniej postawiony, z zachowaniem proporcji (farma ≤ młyn, młyn < farma, piekarnia < młyn; drwal ≤ tartak,
tartak < drwal; rybak), **tylko jeśli towar końcowy łańcucha nie jest nasycony** (saturacja < połowy `cap`).
Przycisk: duch obok zamku jak dziś. Kolejność w `paceCard`: jak dzisiejsza karta rangi (po flocie, gdy flota
wystarcza).

| gracz | R2 (min) | R3 (min) | sr@R3 | wozy@R3 |
|---|---|---|---|---|
| card-10+grow | 22,9–24,5 | 39,5–41,5 | 57–542 | 65–86 (pętla F3!) |
| card-30+grow | 24,2–25,2 | 41,0–44,6 | 1 600–2 070 | 24–34 |
| card-60+grow | 26,6–28,5 | 47,2–50,9 | 2 210–2 410 | 17–22 |
| dziś (card-*) | 30,3–32,4 | 64,7–71,9 | 2 670–2 820 | 10–13 |

Efekt: wszystkie trzy tempa w oknach 20–30 / 40–50 (card-10 na dolnej krawędzi R3), DECENT bez zmian
(testy okien nietknięte), srebro wreszcie pracuje. Bez bramki nasycenia (`grow-safe-nosat-75min.txt`) rangi
są podobne, ale gracz buduje bez końca w nasycony rynek i wpada w pętlę F3 (98–250 wozów).

### F2 — duch nie może przeciąć drogi (sim `validatePlace` albo UI `buildSite`)
Odrzucić miejsce, którego obrys zajmuje narożnik ukośnego kroku istniejącej drogi (prototyp `cutsDiagonal`
w narzędziu) — najprościej w `buildSite` (dotyczy tylko „Postaw” z kart), pewniej w `validatePlace`
(nowy `BLOCKED` z komórką narożnika; zmienia też ręczne stawianie). Do tego diagnoza: producent, którego
brama nie łączy się z żadnym spichlerzem ani stajnią, powinien dostać lekarstwo „droga” (`suggestLinkToStable`
już zwraca właściwe łącze), a nie wskazywać na pusty spichlerz. Efekt: bez F2 karta F1 w 11 z 12 przebiegów
kończy się wieczną kartą krytyczną bez lekarstwa (`grow-unsafe-75min.txt`, 3 600–3 700 s „no-cure”).

### F3 — „Kup wóz” tylko, gdy rynek przyjmie kolejny ładunek
`clogNeedsWagon`: liczyć tylko towary, dla których `MARKET.inflightPerGood - castle.incoming[g] >= capacityOf(g)`
i których cena nie leży na podłodze. Gdy żaden — spichlerz pełny to stan „rynek nasycony” (spokojna karta:
„Rynek bierze tyle, ile zje — sprzedaj inny towar albo przyjmij zamówienie”), bez lekarstwa „wóz”.
Oczekiwany efekt: zero zakupów w pętli (dziś 77–233 na przebieg z rozbudową), srebro zostaje na budynki.

### F4 — karta rangi pomija budynek bez miejsca
`rankCard`: pominąć typ, dla którego `buildSite(world, type, castle)` = null (albo szukać miejsca
w promieniu > 10 od zamku / od najbliższej drogi). Efekt: seed 1304 nie dostaje niewykonalnego
„Postaw: kamieniołom” (dziś co minutę przez ~18 min fazy 3→4).

### Alternatywa balansowa (gorsza) — progi renomy 2: 1 000 → 750, 3: 3 000 → 2 000
`--ranks 2:renown=750,3:renown=2000`: card-* R2 24,1–26,5, R3 43,2–48,9 (w oknach), ale DECENT spada do
17,1–17,6 / 29,8–30,0 — wypada z obu okien testu, a gracz dalej ma 3 100–3 550 sr nieruszone. Leczy objaw,
nie przyczynę (karta nie uczy rozbudowy).

## 6. Pytania do właściciela

1. Czy karta „rozbuduj” (F1) ma wejść jako trzecia odmiana karty tempa w wolnej dolinie (tekst np.
   „Ranga 2 potrzebuje renomy: postaw drugą piekarnię”)? To zmiana UI, nie balansu.
2. Jeśli wolisz balans zamiast F1: czy przesuwamy okna testu DECENT (ranga 2: 15–25, ranga 3: 28–40),
   bo przy progach 750/2 000 bot wypada z dzisiejszych?
3. F2 w `validatePlace` (ręczne stawianie też odrzuca przecięcie drogi) czy tylko w duchu z kart?

## 7. Jak powtórzyć

```bash
npx tsx tools/sandbox-first30.ts --minutes 90 --only card-10,card-30,card-60 --seeds default,1302,1303,1304 --json base.json
npx tsx tools/valley-ranks23.ts base.json
npx tsx tools/sandbox-first30.ts --minutes 60 --safe-sites --only card-10+grow,card-30+grow,card-60+grow --seeds default,1302,1303,1304
npx tsx tools/sandbox-first30.ts --minutes 75 --only card-10,card-30,card-60,decent --ranks 2:renown=750,3:renown=2000 --seeds default,1302,1303,1304
```
