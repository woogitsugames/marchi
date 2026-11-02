# Księga towarów i budynków / Goods and Buildings Codex

Teksty i wartości do przyszłego ekranu „Księga”. Dane do importu: `docs/content/codex.json`.
Źródło liczb: `src/sim/defs.ts`. W JSON każda liczba ma pole `source`; dla cykli `conversion: ticksToSeconds` oznacza dzielenie przez `defs.TICK_HZ`.
Sprawdzenie: `npx tsx tools/codex-check.ts`. Nazwy odpowiadają kluczom `good.*` i `building.*` w `src/i18n/pl.ts` oraz `src/i18n/en.ts`.

**PL:** Podane ceny zamkowe są cenami bazowymi za 1 sztukę; nasycenie rynku i wydarzenia sezonowe zmieniają zapłatę.
**EN:** Castle prices are base prices for one unit; market saturation and seasonal events change the payout.

**PL:** Przestoje używają kluczy status.* z Księgi przyczyn. IDLE, WAITING_DELIVERY, WAITING_PICKUP i WAITING_UPSTREAM nie są samodzielnie awariami.
**EN:** Stalls use status.* keys from the Stall Codex. IDLE, WAITING_DELIVERY, WAITING_PICKUP and WAITING_UPSTREAM are not faults by themselves.

## Towary / Goods

### `wood` — drewno / logs

**PL:** Drwale ścinają pnie, od których zaczyna się praca tartaków i węglarek.
**EN:** Woodcutters fell the logs that feed sawmills and charcoal burners.

- **Producent / Producer:** `woodcutter` (Chata drwala / Woodcutter's hut).
- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 drewno / logs.
- **Cykl / Cycle:** 10 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 1 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.wood`, `defs.MARKET.base.wood`, `defs.BUILDINGS.woodcutter.recipe.outputs.wood`, `defs.BUILDINGS.woodcutter.recipe.ticks`.

### `planks` — deski / planks

**PL:** Tartak tnie pnie na deski, które ruszają traktem ku zamkowi.
**EN:** The sawmill cuts logs into planks, which travel by road to the castle.

- **Producent / Producer:** `sawmill` (Tartak / Sawmill).
- **Wejście / Input:** 1 drewno / logs.
- **Wyjście / Output:** 2 deski / planks.
- **Cykl / Cycle:** 10 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 3 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.planks`, `defs.MARKET.base.planks`, `defs.BUILDINGS.sawmill.recipe.inputs.wood`, `defs.BUILDINGS.sawmill.recipe.outputs.planks`, `defs.BUILDINGS.sawmill.recipe.ticks`.

### `grain` — zboże / grain

**PL:** Na polach dojrzewa zboże przeznaczone do młynów i słodowni.
**EN:** Grain ripens in the fields, bound for mills and malthouses.

- **Producent / Producer:** `farm` (Gospodarstwo / Farmstead).
- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 zboże / grain.
- **Cykl / Cycle:** 8 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 1 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.grain`, `defs.MARKET.base.grain`, `defs.BUILDINGS.farm.recipe.outputs.grain`, `defs.BUILDINGS.farm.recipe.ticks`.

### `flour` — mąka / flour

**PL:** Młyn miele zboże na mąkę, bez której piekarnia nie rozpocznie wypieku.
**EN:** The mill grinds grain into flour; a bakery cannot bake without it.

- **Producent / Producer:** `mill` (Młyn wodny / Watermill).
- **Wejście / Input:** 1 zboże / grain.
- **Wyjście / Output:** 1 mąka / flour.
- **Cykl / Cycle:** 7 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 3 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.flour`, `defs.MARKET.base.flour`, `defs.BUILDINGS.mill.recipe.inputs.grain`, `defs.BUILDINGS.mill.recipe.outputs.flour`, `defs.BUILDINGS.mill.recipe.ticks`.

### `bread` — chleb / bread

**PL:** Piekarze wyrabiają chleb z mąki, a wozy dowożą bochny do zamku.
**EN:** Bakers make bread from flour, and wagons carry loaves to the castle.

- **Producent / Producer:** `bakery` (Piekarnia / Bakery).
- **Wejście / Input:** 1 mąka / flour.
- **Wyjście / Output:** 2 chleb / bread.
- **Cykl / Cycle:** 12 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 4 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.bread`, `defs.MARKET.base.bread`, `defs.BUILDINGS.bakery.recipe.inputs.flour`, `defs.BUILDINGS.bakery.recipe.outputs.bread`, `defs.BUILDINGS.bakery.recipe.ticks`.

### `fish` — ryby / fish

**PL:** Rybacy wyciągają ryby z wód doliny i oddają je kupcom.
**EN:** Fishers draw their catch from the valley waters and bring it to traders.

- **Producent / Producer:** `fisher` (Chata rybaka / Fisher's hut).
- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 ryby / fish.
- **Cykl / Cycle:** 9 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 3 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.fish`, `defs.MARKET.base.fish`, `defs.BUILDINGS.fisher.recipe.outputs.fish`, `defs.BUILDINGS.fisher.recipe.ticks`.

### `stone` — kamień / stone

**PL:** Kamieniołom daje kamień na bruk i mosty; ciężar ogranicza ładunek wozu.
**EN:** The quarry yields stone for cobbles and bridges; its weight limits wagon loads.

- **Producent / Producer:** `quarry` (Kamieniołom / Quarry).
- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 kamień / stone.
- **Cykl / Cycle:** 12 s.
- **Ładunek wozu / Wagon load:** 4 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 2 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.stone`, `defs.MARKET.base.stone`, `defs.BUILDINGS.quarry.recipe.outputs.stone`, `defs.BUILDINGS.quarry.recipe.ticks`.

### `charcoal` — węgiel drzewny / charcoal

**PL:** Węglarnia wypala drewno na węgiel drzewny, który trafia do kupców.
**EN:** The charcoal burner turns logs into charcoal for the castle traders.

- **Producent / Producer:** `charcoalBurner` (Węglarnia / Charcoal burner).
- **Wejście / Input:** 2 drewno / logs.
- **Wyjście / Output:** 1 węgiel drzewny / charcoal.
- **Cykl / Cycle:** 20 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 4 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.charcoal`, `defs.MARKET.base.charcoal`, `defs.BUILDINGS.charcoalBurner.recipe.inputs.wood`, `defs.BUILDINGS.charcoalBurner.recipe.outputs.charcoal`, `defs.BUILDINGS.charcoalBurner.recipe.ticks`.

### `malt` — słód / malt

**PL:** Słodownia przerabia zboże na słód, a browar czeka na dostawę.
**EN:** The malthouse turns grain into malt, which the brewery awaits.

- **Producent / Producer:** `malthouse` (Słodownia / Malthouse).
- **Wejście / Input:** 2 zboże / grain.
- **Wyjście / Output:** 1 słód / malt.
- **Cykl / Cycle:** 12 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 4 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.malt`, `defs.MARKET.base.malt`, `defs.BUILDINGS.malthouse.recipe.inputs.grain`, `defs.BUILDINGS.malthouse.recipe.outputs.malt`, `defs.BUILDINGS.malthouse.recipe.ticks`.

### `beer` — piwo / beer

**PL:** Browar warzy piwo ze słodu, a wozy zawożą beczki do zamku.
**EN:** The brewery brews beer from malt, and wagons haul its barrels to the castle.

- **Producent / Producer:** `brewery` (Browar / Brewery).
- **Wejście / Input:** 1 słód / malt.
- **Wyjście / Output:** 2 piwo / beer.
- **Cykl / Cycle:** 16 s.
- **Ładunek wozu / Wagon load:** 6 szt. / units.
- **Cena bazowa w zamku / Castle base price:** 9 srebra / silver per unit.
- **Źródła / Sources:** `defs.WAGON_CAPACITY_BY_GOOD.beer`, `defs.MARKET.base.beer`, `defs.BUILDINGS.brewery.recipe.inputs.malt`, `defs.BUILDINGS.brewery.recipe.outputs.beer`, `defs.BUILDINGS.brewery.recipe.ticks`.

## Budynki / Buildings

### `woodcutter` — Chata drwala / Woodcutter's hut

**PL:** Z chaty drwala wychodzą bale potrzebne tartakom i węglarkom. Bez odbioru skład zapełni się.
**EN:** The woodcutter sends logs to sawmills and charcoal burners. Without pickup, the yard fills.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 drewno / logs.
- **Cykl / Cycle:** 10 s.
- **Wymiary / Footprint:** 2 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 20 srebra / silver.
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 0 — Osada / Settlement.
- **Źródła / Sources:** `defs.BUILDINGS.woodcutter.price`, `defs.BUILDINGS.woodcutter.recipe.ticks`, `defs.SITE_RULE.woodcutter`, `defs.RANKS.0.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.OUTPUT_FULL.NO_WAGON` — PL: Zapewnij wolny wóz z dojazdem do producenta. EN: Provide a free wagon that can reach the producer.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `sawmill` — Tartak / Sawmill

**PL:** W tartaku drewno obraca się w deski. Praca ustaje bez bali lub miejsca na wyroby.
**EN:** At the sawmill, logs become planks. Work stops without logs or room for finished goods.

- **Wejście / Input:** 1 drewno / logs.
- **Wyjście / Output:** 2 deski / planks.
- **Cykl / Cycle:** 10 s.
- **Wymiary / Footprint:** 3 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 40 srebra / silver.
- **Bufory / Stock limits:** wejście / input 8 na towar, wyjście / output 12 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 0 — Osada / Settlement.
- **Źródła / Sources:** `defs.BUILDINGS.sawmill.price`, `defs.BUILDINGS.sawmill.recipe.ticks`, `defs.SITE_RULE.sawmill`, `defs.RANKS.0.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.
- `status.NO_INPUT.UNREACHABLE` — PL: Napraw połączenie dróg między dostawcą a odbiorcą. EN: Repair the road link between supplier and customer.
- `status.NO_WAGON.ALL_BUSY` — PL: Kup wóz w połączonej stajni albo poczekaj na wolny kurs. EN: Buy a wagon at a connected stable or wait for one to finish a trip.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `farm` — Gospodarstwo / Farmstead

**PL:** Gospodarstwo zbiera zboże dla młynów i słodowni. Plon musi znaleźć drogę do odbiorcy.
**EN:** The farmstead harvests grain for mills and malthouses. Its crop needs a road to a buyer.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 zboże / grain.
- **Cykl / Cycle:** 8 s.
- **Wymiary / Footprint:** 3 × 3 pól / cells.
- **Koszt w definicji / Defined construction cost:** 30 srebra / silver.
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 0 — Osada / Settlement.
- **Źródła / Sources:** `defs.BUILDINGS.farm.price`, `defs.BUILDINGS.farm.recipe.ticks`, `defs.SITE_RULE.farm`, `defs.RANKS.0.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.OUTPUT_FULL.NO_WAGON` — PL: Zapewnij wolny wóz z dojazdem do producenta. EN: Provide a free wagon that can reach the producer.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `mill` — Młyn wodny / Watermill

**PL:** Młyn miele dostarczone zboże na mąkę dla piekarzy. Bez surowca koło stoi.
**EN:** The watermill grinds delivered grain into flour for bakers. Without grain, its wheel stands idle.

- **Wejście / Input:** 1 zboże / grain.
- **Wyjście / Output:** 1 mąka / flour.
- **Cykl / Cycle:** 7 s.
- **Wymiary / Footprint:** 2 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 40 srebra / silver.
- **Bufory / Stock limits:** wejście / input 8 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 1 — Wieś targowa / Market village.
- **Źródła / Sources:** `defs.BUILDINGS.mill.price`, `defs.BUILDINGS.mill.recipe.ticks`, `defs.SITE_RULE.mill`, `defs.RANKS.1.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.
- `status.NO_INPUT.UNREACHABLE` — PL: Napraw połączenie dróg między dostawcą a odbiorcą. EN: Repair the road link between supplier and customer.
- `status.NO_WAGON.NONE_CAN_REACH` — PL: Połącz stajnię drogą z miejscem odbioru towaru. EN: Connect the stable by road to the goods pickup point.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `bakery` — Piekarnia / Bakery

**PL:** Piekarze przemieniają mąkę w chleb dla zamku. Brak dostawy wstrzymuje piece.
**EN:** Bakers turn flour into bread for the castle. A missing delivery leaves the ovens cold.

- **Wejście / Input:** 1 mąka / flour.
- **Wyjście / Output:** 2 chleb / bread.
- **Cykl / Cycle:** 12 s.
- **Wymiary / Footprint:** 2 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 40 srebra / silver.
- **Bufory / Stock limits:** wejście / input 8 na towar, wyjście / output 12 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 1 — Wieś targowa / Market village.
- **Źródła / Sources:** `defs.BUILDINGS.bakery.price`, `defs.BUILDINGS.bakery.recipe.ticks`, `defs.SITE_RULE.bakery`, `defs.RANKS.1.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.
- `status.NO_INPUT.CONTESTED` — PL: Zwiększ produkcję surowca lub zapewnij osobną dostawę dla tego odbiorcy. EN: Increase input production or arrange a separate delivery to this customer.
- `status.NO_WAGON.ALL_BUSY` — PL: Kup wóz w połączonej stajni albo poczekaj na wolny kurs. EN: Buy a wagon at a connected stable or wait for one to finish a trip.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `fisher` — Chata rybaka / Fisher's hut

**PL:** Rybak rozkłada sieci przy brzegu i oddaje połów woźnicom.
**EN:** The fisher sets nets by the shore and hands the catch to wagon drivers.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 ryby / fish.
- **Cykl / Cycle:** 9 s.
- **Wymiary / Footprint:** 2 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 30 srebra / silver.
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren przy wodzie. / Flat, dry ground beside water.
- **Ranga / Rank:** 2 — Miasteczko / Small town.
- **Źródła / Sources:** `defs.BUILDINGS.fisher.price`, `defs.BUILDINGS.fisher.recipe.ticks`, `defs.SITE_RULE.fisher`, `defs.RANKS.2.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.OUTPUT_FULL.NO_WAGON` — PL: Zapewnij wolny wóz z dojazdem do producenta. EN: Provide a free wagon that can reach the producer.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `quarry` — Kamieniołom / Quarry

**PL:** Kamieniarze wydobywają surowiec przy skalnej grani. Wozy zabierają mniej kamienia niż innych towarów.
**EN:** Stonecutters work beside the rocky ridge. Wagons carry less stone than other goods.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** 1 kamień / stone.
- **Cykl / Cycle:** 12 s.
- **Wymiary / Footprint:** 3 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 40 srebra / silver.
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren na skale lub przy niej. / Flat, dry ground on or next to rock. Skała co najmniej / Rock at least 5 m ponad wodą / above water.
- **Ranga / Rank:** 2 — Miasteczko / Small town.
- **Źródła / Sources:** `defs.BUILDINGS.quarry.price`, `defs.BUILDINGS.quarry.recipe.ticks`, `defs.SITE_RULE.quarry`, `defs.RANKS.2.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.OUTPUT_FULL.NO_WAGON` — PL: Zapewnij wolny wóz z dojazdem do producenta. EN: Provide a free wagon that can reach the producer.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `charcoalBurner` — Węglarnia / Charcoal burner

**PL:** Węglarnia wypala przywiezione drewno na węgiel drzewny. Bez bali wygasa praca.
**EN:** The charcoal burner chars delivered logs. Without timber, work dies down.

- **Wejście / Input:** 2 drewno / logs.
- **Wyjście / Output:** 1 węgiel drzewny / charcoal.
- **Cykl / Cycle:** 20 s.
- **Wymiary / Footprint:** 2 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 35 srebra / silver.
- **Bufory / Stock limits:** wejście / input 8 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 3 — Miasto / Town.
- **Źródła / Sources:** `defs.BUILDINGS.charcoalBurner.price`, `defs.BUILDINGS.charcoalBurner.recipe.ticks`, `defs.SITE_RULE.charcoalBurner`, `defs.RANKS.3.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.
- `status.NO_INPUT.CONTESTED` — PL: Zwiększ produkcję surowca lub zapewnij osobną dostawę dla tego odbiorcy. EN: Increase input production or arrange a separate delivery to this customer.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `malthouse` — Słodownia / Malthouse

**PL:** Słodownia przerabia zboże na słód, zanim trafi on do browaru.
**EN:** The malthouse prepares grain as malt before it travels to the brewery.

- **Wejście / Input:** 2 zboże / grain.
- **Wyjście / Output:** 1 słód / malt.
- **Cykl / Cycle:** 12 s.
- **Wymiary / Footprint:** 2 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 45 srebra / silver.
- **Bufory / Stock limits:** wejście / input 8 na towar, wyjście / output 8 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 3 — Miasto / Town.
- **Źródła / Sources:** `defs.BUILDINGS.malthouse.price`, `defs.BUILDINGS.malthouse.recipe.ticks`, `defs.SITE_RULE.malthouse`, `defs.RANKS.3.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.
- `status.NO_INPUT.CONTESTED` — PL: Zwiększ produkcję surowca lub zapewnij osobną dostawę dla tego odbiorcy. EN: Increase input production or arrange a separate delivery to this customer.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `brewery` — Browar / Brewery

**PL:** W browarze słód przemienia się w piwo. Beczki czekają na wozy do zamku.
**EN:** The brewery turns malt into beer. Barrels await wagons bound for the castle.

- **Wejście / Input:** 1 słód / malt.
- **Wyjście / Output:** 2 piwo / beer.
- **Cykl / Cycle:** 16 s.
- **Wymiary / Footprint:** 3 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 60 srebra / silver.
- **Bufory / Stock limits:** wejście / input 8 na towar, wyjście / output 12 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 4 — Gród / Stronghold.
- **Źródła / Sources:** `defs.BUILDINGS.brewery.price`, `defs.BUILDINGS.brewery.recipe.ticks`, `defs.SITE_RULE.brewery`, `defs.RANKS.4.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.
- `status.NO_WAGON.ALL_BUSY` — PL: Kup wóz w połączonej stajni albo poczekaj na wolny kurs. EN: Buy a wagon at a connected stable or wait for one to finish a trip.
- `status.OUTPUT_FULL.NO_DESTINATION` — PL: Podłącz odbiorcę albo spichlerz z wolnym miejscem. EN: Connect a customer or a granary with free space.

### `warehouse` — Spichlerz / Granary

**PL:** Spichlerz przechowuje towary wielu gospodarstw. Gdy się zapełni, dalsze dostawy nie wejdą.
**EN:** The granary stores goods from many producers. Once full, it cannot accept new deliveries.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** brak / none.
- **Cykl / Cycle:** brak / none.
- **Wymiary / Footprint:** 3 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 30 srebra / silver.
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 0 na towar, łączny skład / total store 60.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 0 — Osada / Settlement.
- **Źródła / Sources:** `defs.BUILDINGS.warehouse.price`, `defs.BUILDINGS.warehouse.recipe`, `defs.SITE_RULE.warehouse`, `defs.RANKS.0.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.STORAGE_FULL` — PL: Zbuduj połączony spichlerz lub uruchom odbiór nagromadzonych zapasów. EN: Build a connected granary or arrange collection of stored goods.

### `stable` — Stajnia / Stable

**PL:** W stajni czekają wozy, które łączą warsztaty i zamek. Bez drogi nie ruszą po ładunek.
**EN:** The stable houses wagons serving workshops and the castle. Without a road, they cannot collect cargo.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** brak / none.
- **Cykl / Cycle:** brak / none.
- **Wymiary / Footprint:** 3 × 2 pól / cells.
- **Koszt w definicji / Defined construction cost:** 40 srebra / silver.
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 0 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** 0 — Osada / Settlement.
- **Źródła / Sources:** `defs.BUILDINGS.stable.price`, `defs.BUILDINGS.stable.recipe`, `defs.SITE_RULE.stable`, `defs.RANKS.0.unlocks`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.

### `castle` — Zamek / Castle

**PL:** Zamek przyjmuje towary i w Wolnej dolinie wypłaca za nie srebro. W kontraktach wymaga wskazanych dostaw.
**EN:** The castle buys goods for silver in Free valley. During contracts, it awaits named deliveries.

- **Wejście / Input:** brak / none.
- **Wyjście / Output:** brak / none.
- **Cykl / Cycle:** brak / none.
- **Wymiary / Footprint:** 4 × 4 pól / cells.
- **Koszt w definicji / Defined construction cost:** 0 srebra / silver (nie można budować / not placeable).
- **Bufory / Stock limits:** wejście / input 0 na towar, wyjście / output 0 na towar, łączny skład / total store 0.
- **Miejsce / Site:** Równy, suchy teren. / Flat, dry ground.
- **Ranga / Rank:** zamek od początku, bez możliwości stawiania / preplaced, not buildable.
- **Źródła / Sources:** `defs.BUILDINGS.castle.price`, `defs.BUILDINGS.castle.recipe`, `defs.SITE_RULE.castle`, `defs.RANKS`.

**Typowe przyczyny przestoju / Typical stall reasons:**

- `status.NO_ROAD` — PL: Połącz bramę z przejezdną siecią dróg. EN: Connect the gate to a passable road network.
- `status.NO_INPUT.NONE_AVAILABLE` — PL: Uruchom dostawcę brakującego surowca i sprawdź jego zapasy. EN: Start a supplier of the missing input and check its stock.

**Uwaga / Note:** W Wolnej dolinie zamek jest rynkiem i przyjmuje każdy towar; w misjach kontraktowych obowiązują zamówienia. / In Free valley the castle is a market for all goods; contract missions require specified deliveries.

W Wolnej dolinie zamek zmienia wygląd na randze 5 (Stolica / Capital); nie jest to odblokowanie nowego budynku. / In Free valley the castle changes appearance at rank 5 (Capital); this does not unlock a new building.

