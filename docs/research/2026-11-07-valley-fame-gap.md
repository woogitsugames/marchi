# Wolna dolina: luka sławy graczy card-30 / card-60 (2026-11-07)

Źródło: BACKLOG P2 (D-251) — gracze „tylko karta” card-30/card-60 nie dochodzą do rangi 5 (Stolica) w 120 min, choć
mają 9/9 towarów; slot karty miał trzymać spokojny stan „czeka na odbiór”, a ~15 tys. srebra leżało.
Narzędzia: `tools/sandbox-first30.ts --minutes 120 --seeds 1301,1302,1303,1304 --only card-10,card-30,card-60,decent`,
nowa sonda `tools/valley-fame-gap.ts` (co pokazuje slot w każdej sekundzie od minuty N i dlaczego nie ma karty tempa).
Decyzje: D-264..D-267.

## 1. Gdzie idzie czas (ustalenia)

**F1 — slot trzyma karta „Wąskie gardło”, nie „czeka na odbiór”.** Licznik `topSubjects` w narzędziu liczył tylko
`rankStalls()`, a karta wąskiego gardła (D-171) zajmuje slot *po* nich, w spokojnym stanie. Sonda (stary gracz, gra
przed zmianą), udział sekund od 40. minuty:

| gracz, ziarno | wąskie gardło (drewno / zboże / flota) | spokojny pin | karta tempa (flota / rozbuduj / ranga) | prawdziwy przestój |
|---|---|---|---|---|
| card-30, 1304 | **82 %** (57 / 25 / –) | 6 % | 8 % | 4 % |
| card-60, 1304 | **77 %** (47 / 30 / –) | 6 % | 9 % | 5 % |

Gracze card-N w narzędziu **nigdy nie naciskali leku tej karty** (arkusz czekającego warsztatu: „Postaw: Chata drwala /
Farma” albo „Kup wóz”). Prawdziwy gracz widzi ją 3/4 czasu. Po dodaniu tego do narzędzia (D-264 część narzędziowa)
card-30 dochodzi do rangi 5 na 4/4 ziarnach już *bez* zmiany gry (100,8–109,9 min). Luka card-30 z D-251 była w dużej
mierze ślepą plamką pomiaru.

**F2 — ranga trzymana samym przepływem nie ma żadnej karty.** card-60 seed 1303 stoi na randze 3 przez 66 min: sława
8 419/7 200, towary 7/7, przepływ 107/120. Karta „rozbuduj” (D-192) wymagała osiągniętego przepływu („brakuje tylko
sławy”), więc slot był pusty (38 %) albo spokojny (60 %). Ten sam stan „flow-short” zajmował 27 % czasu card-60 1302.

**F3 — przy nasyceniu wszystkich łańcuchów „rozbuduj” milknie, choć jest świeży towar.** Gdy chleb, ryby i deski są
nasycone (≥ ½ limitu), każdy stojący łańcuch odpada (D-174), a węglarz/słodownia — towary, których dolina nigdy nie
sprzedała i które płacą pełną cenę — nie są nazywane, bo karta rangi znika po spełnieniu liczby towarów.

**F4 — słodownia nie rośnie przed browarem, nawet gdy browaru jeszcze nie wolno.** Reguła proporcji (słodownia ≤
browar) blokuje drugą słodownię na randze 3, choć słód jest wtedy towarem końcowym.

**F5 — duch przy zamku bywa nieosiągalny drogą.** W zabudowanej dolinie (card-10, 90+ budynków) `buildSite` zwracał
miejsce, do którego bramy żadna droga nie dojdzie: karta rangi nazywała browar, a postawiony budynek rodził się odcięty
(card-10 1304: 257 nieudanych prób, ranga 4 z towarami 8/9). Ten sam mechanizm w narzędziu: drwal z bramą zamkniętą
przez sąsiadów trzymał krytyczną kartę „brak drogi” bez leku przez 75 min (card-30 1301). Uwaga: `demolish` w narzędziu
podawał komórkę bramy, którą sim odrzuca (`IS_GATE`) — cofnięcie nigdy nie działało.

**F6 — srebro leży, bo karta nie ma czego zaproponować, a nie dlatego, że jest za ostrożna.** Rezerwa `FLEET_FREE_KEEP`
(40) nie gra roli przy 10 000+ srebra; ograniczeniem były warunki pokazania kart (F2–F4) i wybór miejsca (F5).

Uwaga pomiarowa: `bottleneckCard` ma histerezę liczoną przy każdym odczycie, więc sonda wołająca karty co sekundę
przesuwa wynik pojedynczego biegu o ~1 min (np. card-60 1304: 117,3 → 118,4). Tabele niżej są bez sondy.

## 2. Zmiana (UI, tylko odczyt; misje bez zmian)

- **D-264** — karta „rozbuduj” także przy brakującym przepływie (towary spełnione, brakuje sławy *lub* przepływu); karta
  mówi, czego brakuje: „Do rangi 4 (Gród) brakuje przepływu srebra — postaw jeszcze: …”, arkusz „Przepływ 100 z 120
  srebra na minutę…” (`cause.paceGrowFlow`, `fix.growWhyFlow`, 17 języków). Narzędzie: gracze card-N naciskają lek
  karty wąskiego gardła; odcięty producent bez leku jest cofany (`--no-neck` = stary gracz).
- **D-265** — gdy każdy stojący łańcuch jest nasycony, „rozbuduj” nazywa następnego producenta z kolejności rangi,
  którego towaru dolina nigdy nie sprzedała (węglarz, słodownia, browar).
- **D-266** — w dolinie duch woli miejsce osiągalne drogą (`siteLinked`: droga obok bramy albo link wyszukiwarki luk);
  karty rangi/rozbuduj liczą tylko takie miejsca: przy zamku, a gdy tam brak — przy budynku tego samego rodzaju, jego
  dostawcy albo stajni (ten budynek jest podmiotem karty).
- **D-267** — słodownia rośnie na własnym słodzie, dopóki ranga nie pozwala na browar.

Jedna karta w slocie jak dotąd; spokojne stany zostają spokojne (karta „rozbuduj” nadal ostatnia, za flotą i wąskim
gardłem). Hasze misji (`tools/mission-hashes.ts`, 45 strategii) identyczne przed i po.

## 3. Wyniki (minuta rangi 5; – = nie osiągnięto, w nawiasie sława po 120 min)

Ziarna 1301 / 1302 / 1303 / 1304.

| gracz | D-251 (stare narzędzie) | gra przed, nowe narzędzie | **gra po** |
|---|---|---|---|
| card-10 | 108,7 / 103,8 / 109,3 / 107,4 | 102,2 / 100,0 / 104,9 / – (R4, towary 8/9) | **92,9 / 87,8 / 108,8 / 93,9** |
| card-30 | – (16 919) / 117,5 / – (16 660) / – (16 467) | 106,2 / 104,4 / 109,9 / 100,8 | **97,0 / 102,5 / 104,6 / 100,0** |
| card-60 | – (11 486) / – (12 160) / – (R3, 8 349) / – (12 428) | – (15 820) / – (13 195) / – (R3, 8 419) / 117,3 | **– (16 387) / – (16 789) / – (14 281) / 116,6** |
| decent | 117,6 / 116,7 / 117,0 / 115,6 | identycznie | identycznie |

Gracz ślepy na wąskie gardło (`--no-neck`, gra po): card-10 108,1 / 106,4 / 110,2 / 106,5; card-30 116,3 / 112,6 /
111,4 / – (16 612) (D-251: 1/4); card-60 – (12 251) / – (12 655) / – (R3, 8 622) / – (12 598).

card-10 1303 jest o 3,9 min wolniejszy niż „gra przed, nowe narzędzie” (więcej budowania, gęstszy węzeł przy zamku),
ale szybszy niż w D-251; 1304 dochodzi (wcześniej nigdy). card-60 brakuje 211–2 719 sławy (wcześniej 1 180–8 581 i
ranga 3 na 1303).

## 4. Co zostaje

- card-60 dalej nie dochodzi na 3/4 ziaren: gracz z jedną akcją na minutę po 90. minucie ma już niewiele tanich
  ruchów; dalej pomogłaby raczej karta, która łączy kilka kroków (np. łańcuch „słodownia + browar” jednym
  przyciskiem) — do decyzji właściciela, nie robione.
- Karta wąskiego gardła nie patrzy na nasycenie towarów swoich odbiorców: w bardzo zabudowanej dolinie card-10
  stawia drwali, choć węgiel i deski są nasycone (card-10 1303: 116 budynków). Kandydat na osobny P2.
- Ogólny `buildSite` w misjach nadal bierze pierwsze ważne miejsce (bez sprawdzenia drogi) — celowo, misje bez zmian.
- Playtest: czy gracz czyta „brakuje przepływu srebra” obok tabliczki „Przepływ na minutę 100/120”.
