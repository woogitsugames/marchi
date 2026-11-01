# Listy od kasztelana — misje I–VI / Contract letters — missions I–VI

Teksty dla gracza w języku polskim i angielskim, przygotowane dla **MARCHIA — Szlaki Królestwa**. Każda misja ma pięć wariantów: list otwierający, zwycięstwo z 1/2/3 pieczęciami oraz porażkę. Podane długości obejmują podpis i znak nowego wiersza (`\n`); wszystkie mieszczą się w limitach 400/200 znaków.

## Postacie i nazewnictwo

- **Wszebor** — kasztelan fikcyjnego grodu **Łozinny Bród**; podpisuje listy. W języku angielskim: *Wszebor, Castellan of Łozinny Bród*.
- **Mirogniew** — pisarz grodzki, prowadzi księgę terminów i dostaw.
- **Borzym** — młynarz, którego praca zależy od przewozów ziarna.

Nazwy postaci i grodu nie zostały zaczerpnięte z innych gier. Sprawdzono wyszukiwania publiczne obejmujące każdą nazwę i określenia „gra”, „game”, „postać” oraz pełną nazwę grodu (2026-11-01). Nie znaleziono jednoznacznego dopasowania do rozpoznawalnej postaci lub lokacji z gry; wyszukiwanie nie stanowi prawnej weryfikacji znaków towarowych. Imiona mają słowiańskie brzmienie, a miejsce jest fikcyjne.

## Podstawa fabularna i techniczna

- **I–III:** `src/sim/missions.ts` oraz `src/sim/missions-proposed.ts` w gałęzi `claude/eager-cori-08wt8e`. Kontrakty według aktualnego kodu: I — 30 desek i 20 bochenków; II — 36 desek i 30 bochenków; III — 24 deski i 16 bochenków. Uwaga: starszy tekst `docs/missions/m2.md` ma inne wartości niż kod; tutaj przyjęto **kod** jako źródło prawdy.
- **IV–VI:** `docs/orders/gpt6-03/12-mission-4.md` do `14-mission-6.md` — propozycje fabularne (kra/lód, dostawy w trzech transzach, zatkany spichlerz). Bez niezatwierdzonych liczb ani godzin, żeby listy nie rozminęły się z przyszłym balansem.
- **Ocena:** 1, 2 lub 3 pieczęcie oznaczają odpowiednio ukończenie w późniejszym, średnim lub najlepszym progu czasowym. Teksty nie przypisują graczowi konkretnej strategii, której symulacja nie potwierdza.
- **Styl:** rzeczowy język listu urzędowego z odrobiną słownictwa epoki; bez fantastyki, wojen ani nazw z innych tytułów.

## Integracja

Moduł `src/content/letters.ts` zawiera typowany komplet 6 × 2 × 5 tekstów. `getContractLetter(missionId, phase, seals?, lang?)` wybiera język gry przez `getLang()`; można podać `lang` jawnie. Dla `phase='won'` wymagane jest `seals` równe 1, 2 albo 3. Dla `sandbox`, nieznanych misji i nieprawidłowej liczby pieczęci funkcja zwraca `null`. Moduł nie modyfikuje symulacji ani UI; wyświetlenie listów to oddzielna integracja.

```ts
getContractLetter('m1', 'opening');             // current game language
getContractLetter('m2', 'won', 3, 'en');         // English, three seals
getContractLetter('m5', 'lost', 0, 'pl');        // Polish, failure
getContractLetter('sandbox', 'opening');        // null
```

---

## I. Chleb i deski przed zimą / Bread and planks before winter

### PL

**List otwierający** (244/400 znaków / characters)

> Do zarządcy traktów: przed pierwszym śniegiem dostarcz do grodu 30 desek i 20 bochenków. Drwal i tartak pracują za rzeką, lecz brzegi nie są połączone. Wytycz przeprawę, a potem dopilnuj drogi mąki i chleba.
>
> — Wszebor, kasztelan Łozinnego Brodu

**Wygrana — 1 pieczęć** (120/200 znaków / characters)

> Dostawy dotarły przed śniegiem. Cieśle mają deski, kuchnia chleb. Następnym razem puść wozy w drogę wcześniej.
>
> — Wszebor

**Wygrana — 2 pieczęcie** (114/200 znaków / characters)

> Dobrze wytyczony trakt przyniósł dostawy ze sporym zapasem czasu. Dwie pieczęcie za sprawną pracę wozów.
>
> — Wszebor

**Wygrana — 3 pieczęcie** (113/200 znaków / characters)

> Bramę otwarto, nim zziębły konie. Deski i chleb złożono bez zwłoki; tak prowadzi się gród przez jesień.
>
> — Wszebor

**Przegrana** (132/200 znaków / characters)

> Przyszedł pierwszy śnieg, a część dostaw została na szlaku. Sprawdź, czy oba brzegi mają drogę i czy wozy odbierają towar.
>
> — Wszebor

### EN

**Opening letter** (268/400 znaków / characters)

> To the road steward: deliver 30 planks and 20 loaves to the castle before the first snow. The woodcutter and sawmill stand across the river, but the banks are not joined. Build a crossing, then see that flour and bread keep moving.
>
> — Wszebor, Castellan of Łozinny Bród

**Victory — 1 seal** (137/200 znaków / characters)

> The goods arrived before the snow. The carpenters have planks and the kitchen has bread. Next time, send the wagons out sooner.
>
> — Wszebor

**Victory — 2 seals** (96/200 znaków / characters)

> A well-laid road brought the goods with time to spare. Two seals for sound wagon work.
>
> — Wszebor

**Victory — 3 seals** (135/200 znaków / characters)

> The gate opened before the horses grew cold. Bread and planks were stored without delay. This is how a march survives autumn.
>
> — Wszebor

**Defeat** (146/200 znaków / characters)

> The first snow has come, and part of the order remains on the road. Check the crossing and make sure the wagons can collect their loads.
>
> — Wszebor

## II. Korek na moście / Bridge bottleneck

### PL

**List otwierający** (228/400 znaków / characters)

> Pisarz grodzki Mirogniew liczy 36 desek i 30 bochenków potrzebnych w grodzie. Wozy z obu brzegów tłoczą się na jedynym drewnianym moście. Nim termin minie, odciąż przeprawę: drugi most albo kamień mogą skrócić kolejkę.
>
> — Wszebor

**Wygrana — 1 pieczęć** (101/200 znaków / characters)

> Kontrakt wykonano, choć wóz za wozem czekał przy przyczółku. Pieczęć za dochowanie terminu.
>
> — Wszebor

**Wygrana — 2 pieczęcie** (113/200 znaków / characters)

> Przeprawa szła sprawniej, niż zapowiadali woźnice. Zapisuję dwie pieczęcie za dobrą organizację kursów.
>
> — Wszebor

**Wygrana — 3 pieczęcie** (113/200 znaków / characters)

> Po obu brzegach ruch trwał bez zbędnej zwłoki. Trzy pieczęcie; tak należy gospodarować wąską przeprawą.
>
> — Wszebor

**Przegrana** (124/200 znaków / characters)

> W księdze brakuje towarów dostarczonych w terminie. Obejrzyj kolejkę przy przyczółku i zapewnij wozom drugą drogę.
>
> — Wszebor

### EN

**Opening letter** (242/400 znaków / characters)

> Castle scribe Mirogniew has counted 36 planks and 30 loaves needed at the keep. Wagons from both banks crowd onto the only wooden bridge. Before the deadline, ease the crossing: a second bridge or a stone span may shorten the queue.
>
> — Wszebor

**Victory — 1 seal** (105/200 znaków / characters)

> The order is filled, though wagons queued at the bridgehead. One seal for keeping the deadline.
>
> — Wszebor

**Victory — 2 seals** (107/200 znaków / characters)

> The crossing worked better than the carters foretold. I mark two seals for well-managed journeys.
>
> — Wszebor

**Victory — 3 seals** (119/200 znaków / characters)

> Goods moved across both banks without needless delay. Three seals; that is how one manages a narrow crossing.
>
> — Wszebor

**Defeat** (129/200 znaków / characters)

> The ledger lacks some goods due by the deadline. Inspect the queue at the bridgehead and give the wagons another route.
>
> — Wszebor

## III. Deszczowa jesień / Rainy autumn

### PL

**List otwierający** (204/400 znaków / characters)

> Deszcz rozmył gruntowy trakt. Do zamku potrzeba 24 desek i 16 bochenków, ale koła grzęzną w koleinach. Młynarz Borzym czeka na przewóz ziarna. Wybrukuj odcinki, po których idzie najwięcej wozów.
>
> — Wszebor

**Wygrana — 1 pieczęć** (96/200 znaków / characters)

> Gród otrzymał zapasy mimo ulewy. Termin ocalony, ale błoto kosztowało nas wiele czasu.
>
> — Wszebor

**Wygrana — 2 pieczęcie** (77/200 znaków / characters)

> Droga wytrzymała jesienną słotę. Dwie pieczęcie za sprawny przewóz.
>
> — Wszebor

**Wygrana — 3 pieczęcie** (111/200 znaków / characters)

> Nie zatrzymała was nawet ulewa. Trzy pieczęcie, bo dobry trakt jest wart więcej niż pośpiech woźnicy.
>
> — Wszebor

**Przegrana** (113/200 znaków / characters)

> Ulewa nie ustała, a dostaw zabrakło. Przed kolejną próbą zobacz, gdzie wozy zwalniają, i tam ułóż bruk.
>
> — Wszebor

### EN

**Opening letter** (207/400 znaków / characters)

> Rain has washed out the dirt road. The castle needs 24 planks and 16 loaves, but wheels sink into the ruts. Borzym the miller waits for grain to be hauled. Lay cobbles where the wagons travel most.
>
> — Wszebor

**Victory — 1 seal** (121/200 znaków / characters)

> The castle received its supplies despite the downpour. The deadline was kept, though mud cost us precious time.
>
> — Wszebor

**Victory — 2 seals** (81/200 znaków / characters)

> The road held against the autumn rain. Two seals for a steady delivery.
>
> — Wszebor

**Victory — 3 seals** (107/200 znaków / characters)

> Even the downpour did not stop you. Three seals: a good road is worth more than a hurried carter.
>
> — Wszebor

**Defeat** (129/200 znaków / characters)

> The rain did not let up, and the supplies fell short. Next time, find where the wagons slow down and lay cobbles there.
>
> — Wszebor

## IV. Zima na przeprawie / Winter at the crossing

### PL

**List otwierający** (235/400 znaków / characters)

> Na rzece ruszyła kra. O wyznaczonej porze zamknie drewnianą przeprawę. Nim nadejdzie przerwa, przewieź potrzebne zapasy do spichlerza po stronie grodu albo zbuduj kamienny most. Towar pozostawiony za rzeką nie nakarmi nikogo.
>
> — Wszebor

**Wygrana — 1 pieczęć** (93/200 znaków / characters)

> Kra utrudniła przewóz, lecz gród dostał swoje. Jedna pieczęć za dochowanie terminu.
>
> — Wszebor

**Wygrana — 2 pieczęcie** (102/200 znaków / characters)

> Kiedy lód odciął drewniany most, dostawy nie ustały na długo. Dwie pieczęcie za przezorność.
>
> — Wszebor

**Wygrana — 3 pieczęcie** (122/200 znaków / characters)

> Most bywa zamknięty, lecz dobrze obmyślony przewóz trwa dalej. Trzy pieczęcie za planowanie zapasów i przeprawy.
>
> — Wszebor

**Przegrana** (130/200 znaków / characters)

> Termin minął, choć pora zamknięcia mostu była znana. Przygotuj wcześniej zapas po stronie grodu albo kamienną przeprawę.
>
> — Wszebor

### EN

**Opening letter** (243/400 znaków / characters)

> River ice is on the move. At the appointed hour it will close the wooden crossing. Before that happens, bring the needed supplies to a granary on the castle bank, or build a stone bridge. Goods left across the river will feed no one.
>
> — Wszebor

**Victory — 1 seal** (107/200 znaków / characters)

> The ice hindered the carts, but the castle received its goods. One seal for meeting the deadline.
>
> — Wszebor

**Victory — 2 seals** (103/200 znaków / characters)

> When ice shut the wooden bridge, deliveries did not stop for long. Two seals for forethought.
>
> — Wszebor

**Victory — 3 seals** (119/200 znaków / characters)

> A bridge may close, yet a well-planned supply line endures. Three seals for planning the stores and crossing.
>
> — Wszebor

**Defeat** (129/200 znaków / characters)

> The deadline passed, though the bridge closure was foretold. Stock the castle bank sooner, or prepare a stone crossing.
>
> — Wszebor

## V. Jarmark / The fair

### PL

**List otwierający** (233/400 znaków / characters)

> Na jarmark grodzki wyznaczono trzy dostawy w różnych porach. Pisarz Mirogniew wpisze każdą osobno: chleb i deski mają przybywać wedle kolejnych terminów, nie jednym wozem na koniec. Przygotuj zapas i pilnuj porządku kursów.
>
> — Wszebor

**Wygrana — 1 pieczęć** (97/200 znaków / characters)

> Trzy wpisy zamknięto przed terminami, choć nie bez zamieszania na placu. Jedna pieczęć.
>
> — Wszebor

**Wygrana — 2 pieczęcie** (105/200 znaków / characters)

> Jarmark miał to, czego potrzebował, we właściwej porze. Dwie pieczęcie za porządek w dostawach.
>
> — Wszebor

**Wygrana — 3 pieczęcie** (128/200 znaków / characters)

> Nie trzeba było wołać woźniców po raz drugi. Wszystkie transze dotarły bez pośpiechu ostatniej chwili. Trzy pieczęcie.
>
> — Wszebor

**Przegrana** (134/200 znaków / characters)

> Co najmniej jedna transza nie dotarła na czas. Następnym razem rozdziel zapas na kolejne terminy, zamiast liczyć tylko sumę.
>
> — Wszebor

### EN

**Opening letter** (255/400 znaków / characters)

> The castle fair requires three deliveries at separate times. Scribe Mirogniew will enter each one in the ledger: bread and planks must arrive by their appointed deadlines, not in one last wagonload. Prepare a reserve and order the journeys well.
>
> — Wszebor

**Victory — 1 seal** (96/200 znaków / characters)

> All three entries were closed on time, though the yard was in some disorder. One seal.
>
> — Wszebor

**Victory — 2 seals** (110/200 znaków / characters)

> The fair received what it needed at the proper hours. Two seals for keeping the deliveries in order.
>
> — Wszebor

**Victory — 3 seals** (112/200 znaków / characters)

> No carter needed to be called twice. Every instalment arrived without a last-minute rush. Three seals.
>
> — Wszebor

**Defeat** (138/200 znaków / characters)

> At least one instalment missed its appointed time. Next time, divide the stores by deadline rather than counting only the total.
>
> — Wszebor

## VI. Ciasny spichlerz / The crowded granary

### PL

**List otwierający** (221/400 znaków / characters)

> Spichlerz jest ciasny, a ziarno przybywa szybciej, niż młynarz Borzym może je odebrać. Gdy magazyn się zapełni, stanie praca i ucierpi kontrakt grodu. Znajdź miejsce dla zapasów albo skieruj wozy innym szlakiem.
>
> — Wszebor

**Wygrana — 1 pieczęć** (116/200 znaków / characters)

> Kontrakt dowieziony, choć spichlerz pękał w szwach. Jedna pieczęć; trzeba pilniej patrzeć na stan zapasów.
>
> — Wszebor

**Wygrana — 2 pieczęcie** (104/200 znaków / characters)

> Wozy rozniosły nadmiar towarów, zanim zatkał warsztaty. Dwie pieczęcie za rozsądną gospodarkę.
>
> — Wszebor

**Wygrana — 3 pieczęcie** (116/200 znaków / characters)

> Dobrze rozłożony zapas nie zatrzymał młyna ani piekarni na długo. Trzy pieczęcie za sprawny obieg towarów.
>
> — Wszebor

**Przegrana** (115/200 znaków / characters)

> Zapas utknął i zabrakło przewozu przed terminem. Sprawdź pełny spichlerz oraz drogę od młyna do piekarni.
>
> — Wszebor

### EN

**Opening letter** (228/400 znaków / characters)

> The granary is cramped, and grain arrives faster than Borzym the miller can collect it. Once the stores fill, work will halt and the castle order will suffer. Make room for supplies or send the wagons by another route.
>
> — Wszebor

**Victory — 1 seal** (124/200 znaków / characters)

> The order arrived, though the granary was bursting at the seams. One seal; mind the stores more closely next time.
>
> — Wszebor

**Victory — 2 seals** (116/200 znaków / characters)

> The wagons moved surplus goods before they clogged the workshops. Two seals for prudent keeping of stores.
>
> — Wszebor

**Victory — 3 seals** (107/200 znaków / characters)

> Well-placed stocks kept the mill and bakery from waiting long. Three seals for goods kept moving.
>
> — Wszebor

**Defeat** (130/200 znaków / characters)

> Goods piled up, and the deliveries fell short of the deadline. Check the full granary and the route from mill to bakery.
>
> — Wszebor
