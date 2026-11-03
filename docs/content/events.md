# Wolna dolina — teksty zdarzeń (PL / EN)

**Status: wdrożone (D-54).** Tytuły zamówień i teksty karty są w i18n jako `events.*` (PL, EN, AR; PENDING_KEYS); pełne opisy zamówień zostają tutaj jako materiał na przyszłe szczegóły karty. Europa Środkowa, ok. 1300–1400. Każde ID poniżej jest stabilnym kluczem ORDER_TEMPLATES z src/sim/events.ts. Liczby, ilości i nagrody pochodzą wyłącznie z wylosowanego zdarzenia, **nie** z narracji. Każda pozycja jest prośbą docierającą do zamku, a nie zadaniem z terminem. Bez elementów fantasy, prochu, nowożytnej techniki ani życia wewnętrznego mieszkańców.

## Zamówienia królewskie — 36 wariantów

| ID | Ranga min. | Towary | PL — tytuł i treść | EN — title and copy |
| --- | ---: | --- | --- | --- |
| `palisade_repair` | 0 | wood | Naprawa palisady — Kasztelan prosi o drewno do wzmocnienia palisady przy grodowej bramie. | Palisade repairs — The castellan requests timber to strengthen the palisade beside the castle gate. |
| `bridge_planking` | 0 | planks | Deski na przeprawę — Po wiosennych wodach most wymaga nowych desek, zanim przejadą nim królewskie wozy. | Planks for the crossing — After the spring flood, the bridge needs new boards before the royal wagons can pass. |
| `winter_granary` | 0 | grain | Zapasy na zimę — Zarządca spichlerza zamkowego zbiera ziarno na czas zimowych gości i straży. | Winter granary — The castle steward is gathering grain for winter visitors and the garrison. |
| `toll_house` | 0 | wood, planks | Dom poborcy myta — Przy trakcie trzeba postawić nowy dach i przegrodę dla poborcy myta. | Tollkeeper's house — The road needs timber and boards for a new roof and partition at the toll house. |
| `castle_stores` | 0 | grain, wood | Zapas grodu — Na rozkaz kasztelana spichlerz przy bramie gromadzi opał i ziarno. | Castle stores — By the castellan's order, the granary by the gate gathers firewood and grain. |
| `border_watch` | 0 | planks, grain | Straż przy granicy — Niewielka strażnica potrzebuje desek na naprawę pomostu i ziarna dla wartowników. | Border watch — A small watchpost needs planks to repair its platform and grain for the guards. |
| `pilgrim_shelter` | 0 | wood, planks | Schronienie dla pielgrzymów — Przy trakcie do opactwa mają powstać ławy i zadaszenie dla podróżnych. | Pilgrims' shelter — Benches and a roof are to be built beside the road leading to the abbey. |
| `neighbor_siege` | 0 | planks, grain | Oblężenie sąsiedniego grodu — Posłaniec prosi o deski do bramy i ziarno dla załogi przygotowującej się do obrony. | Siege of the neighbouring stronghold — A messenger seeks gate planks and grain for defenders preparing for a siege. |
| `wedding_bread` | 1 | bread | Dworskie wesele — Na wesele w zamkowej kaplicy kuchmistrz zamawia świeże bochny chleba. | A court wedding — The kitchen master orders fresh loaves for a wedding by the castle chapel. |
| `abbey_flour` | 1 | flour | Mąka do opactwa — Klasztorna piekarnia prosi zamek o mąkę przed świętem patrona. | Flour for the abbey — The monastery bakery asks the castle for flour ahead of its patron's feast. |
| `knights_assembly` | 1 | bread, planks | Zjazd rycerstwa — Na zamku zbierają się rycerze; potrzebne są bochny oraz deski na stoły w wielkiej sieni. | Gathering of knights — Knights assemble at the castle; loaves and planks for tables in the great hall are needed. |
| `harvest_almshouse` | 1 | bread, grain | Jałmużna po żniwach — Dwór wydziela chleb i ziarno na pomoc podróżnym przy szpitalu klasztornym. | Alms after harvest — The court sets aside bread and grain for travellers sheltered by the monastic infirmary. |
| `pilgrimage_rations` | 1 | bread, flour | Droga pielgrzymów — Kasztelan poleca przygotować chleb i mąkę na postoje orszaku pielgrzymiego. | Pilgrims' provisions — The castellan orders bread and flour for the stops along a pilgrims' route. |
| `court_bakers` | 1 | flour, grain | Piece zamkowe — Piekarze dworu uzupełniają zapas mąki i ziarna przed przyjazdem gości. | Castle ovens — Court bakers replenish flour and grain before visitors arrive. |
| `lenten_fish` | 2 | fish | Ryby na post — Podczas postu na zamkowe stoły potrzeba ryb zamiast mięsa. | Fish for Lent — During the fast, the castle kitchens require fish in place of meat. |
| `church_masonry` | 2 | stone, planks | Budowa kościoła — Mistrz murarski prosi o kamień na ściany i deski na rusztowania świątyni. | Church masonry — The master mason seeks stone for the walls and planks for church scaffolding. |
| `river_garrison` | 2 | fish, bread | Załoga nad rzeką — Strażnicy przy rzecznym brodzie czekają na dostawę ryb i chleba. | River garrison — Guards at the river ford await a delivery of fish and bread. |
| `stone_gate` | 2 | stone | Kamienna brama — Warsztat budujący nowy portal bramny potrzebuje ciosanego kamienia. | Stone gate — The workshop raising a new gatehouse arch needs cut stone. |
| `bridge_footings` | 2 | stone, wood | Fundamenty mostu — Cieśle i murarze proszą o drewno i kamień pod nową przeprawę. | Bridge footings — Carpenters and masons ask for timber and stone for a new crossing. |
| `court_banquet` | 2 | bread, fish | Uczta u kasztelana — Do postnej uczty z udziałem gości z opactwa potrzeba chleba i ryb. | The castellan's banquet — A meatless feast for abbey guests calls for bread and fish. |
| `forge_charcoal` | 3 | charcoal | Węgiel do kuźni — Kowal naprawiający okucia bramy prosi o węgiel drzewny do paleniska. | Charcoal for the forge — The smith repairing gate fittings requests charcoal for the hearth. |
| `abbey_malt` | 3 | malt, grain | Zapas klasztornej słodowni — Opactwo gromadzi słód i ziarno przed warzeniem piwa dla gości. | Abbey malt stores — The abbey gathers malt and grain ahead of brewing ale for its visitors. |
| `smithy_repair` | 3 | charcoal, planks | Naprawa przy kuźni — Przy zamkowej kuźni trzeba uzupełnić węgiel drzewny i deski na naprawę zadaszenia. | Repairs at the smithy — The castle smithy needs charcoal and planks to repair its shelter. |
| `brewers_supplies` | 3 | malt, wood | Dostawa do warzelni — Dworski piwowar zamawia słód i drewno do ogrzewania kotłów. | Supplies for the brewhouse — The court brewer orders malt and firewood to heat the kettles. |
| `guardhouse_ale` | 4 | beer, bread | Straż po nocnej warcie — Zarządca zamawia piwo i chleb dla załogi po długiej służbie. | Ale for the watch — The steward orders ale and bread for the guards after a long watch. |
| `guild_meeting` | 4 | beer, planks | Zebranie cechu — Mistrzowie rzemieślniczy proszą o piwo i deski na stoły zgromadzenia. | Guild gathering — Craft masters request ale and planks for the tables at their meeting. |
| `abbey_hospitality` | 4 | beer, fish | Gościna w opactwie — Przybywających gości klasztor przyjmie rybami i piwem. | Abbey hospitality — The monastery will welcome its visitors with fish and ale. |
| `fair_brewers` | 4 | beer, malt | Przygotowania do jarmarku — Piwniczny zamku zamawia piwo i słód przed przyjazdem kupców. | Preparing for the fair — The castle cellarer requests ale and malt before traders arrive. |
| `royal_progress` | 5 | beer, bread, planks | Przejazd królewskiego dworu — Na postój władcy potrzebne są piwo, chleb oraz deski do ustawienia stołów. | The royal progress — A stop by the ruler's travelling court requires ale, bread and planks for tables. |
| `capital_embassy` | 5 | beer, stone, charcoal | Poselstwo w stołecznym grodzie — Dwór przygotowuje piwo dla gości, kamień dla murarzy i węgiel do prac przy bramie. | Embassy at the capital stronghold — The court prepares ale for guests, stone for masons and charcoal for gate repairs. |
| `bell_casting` | 3 | charcoal, stone | Odlew dzwonu — Ludwisarz przy kościele prosi o węgiel drzewny do pieca i kamień na obmurowanie formy. | Casting the bell — The bell-founder by the church asks for charcoal for his furnace and stone to wall the mould. |
| `harvest_home` | 3 | malt, bread | Dożynki na dziedzińcu — Na dożynki kasztelan zamawia chleb dla żniwiarzy i słód dla piwowara. | Harvest home in the bailey — For the harvest feast the castellan orders bread for the reapers and malt for the brewer. |
| `mill_weir` | 4 | stone, planks | Jaz przy młynie — Wiosenna woda podmyła jaz; młynarz prosi o kamień na narzut i deski na zastawki. | The mill weir — Spring water has undercut the weir; the miller asks for stone for the bank and planks for the sluices. |
| `christmas_court` | 4 | beer, flour | Boże Narodzenie na dworze — Na święta dwór gromadzi piwo dla gości i mąkę na świąteczne kołacze. | Christmas at court — For the feast days the court gathers ale for its guests and flour for the festive loaves. |
| `cathedral_works` | 5 | stone, planks, charcoal | Budowa katedry — Kapituła prosi o kamień na filary, deski na rusztowania i węgiel dla kowali przy hucie. | Cathedral works — The chapter asks for stone for the piers, planks for scaffolding and charcoal for the smiths. |
| `royal_hunt` | 5 | beer, bread, fish | Królewskie łowy — Na postój królewskiego polowania w dolinie potrzeba piwa, chleba i ryb. | The royal hunt — The king's hunting party will rest in the valley; ale, bread and fish are needed. |

Wymagania towarowe HUD wyświetla osobno, np. „Deski 8/12 · Ziarno 5/9”. Generator wymaga rangi **i kompletnego istniejącego łańcucha** dla każdego towaru. Dla każdej pozycji dostępne są polska i angielska narracja; to jedynie teksty, bez kodu wykonawczego.

## Jarmarki — teksty sezonowe

| Klucz | PL | EN |
| --- | --- | --- |
| events.fair.upcoming | Zapowiedziano jarmark na {good}. W następnym sezonie kupcy zapłacą o 25% więcej. | A fair for {good} has been announced. Next season, traders will pay 25% more. |
| events.fair.active | Jarmark trwa: {good} sprzedaje się o 25% drożej. | The fair is open: {good} sells for 25% more. |
| events.fair.spring | Wiosenny jarmark przy trakcie — kupcy wracają na szlaki po roztopach. | Spring roadside fair — Traders return to the roads after the thaw. |
| events.fair.summer | Letni jarmark — stragany zapełniają się w porze zbiorów i podróży. | Summer fair — Stalls fill during the season of harvests and travel. |
| events.fair.autumn | Jesienny jarmark — po żniwach kupcy szukają zapasów na zimę. | Autumn fair — After harvest, traders seek stores for winter. |
| events.fair.winter | Zimowy targ — kupcy wypatrują opału i żywności w pobliżu grodu. | Winter market — Traders seek fuel and provisions near the stronghold. |
| events.fair.price | Cena {good}: +25% w tym jarmarku. | {good} price: +25% at this fair. |

Jarmark wypada co trzeci 15-minutowy sezon symulacji; pierwsza zapowiedź jesienią pierwszego roku. Towar pochodzi z puli sezonowej dostępnej do wytworzenia, a nie zawsze z piwa. Zapowiedź pojawia się dwie minuty symulacji przed początkiem sezonu. Nie jest odliczaniem do wykonania zadania; brak sprzedaży nie powoduje straty.

## Wędrowny kupiec — teksty

| Klucz | PL | EN |
| --- | --- | --- |
| events.merchant.title | Wędrowny kupiec | Travelling merchant |
| events.merchant.offer | Kupiec przybył traktem. Kupi nadwyżkę towaru {good} po {price} srebra za sztukę. | A merchant has arrived by road. He will buy surplus {good} for {price} silver per unit. |
| events.merchant.quantity | Może kupić do {qty} sztuk. | Will buy up to {qty} units. |
| events.merchant.bonus | Cena kupca jest wyższa niż zwykła cena na rynku. | The merchant's price is higher than the ordinary market price. |
| events.merchant.accept | Sprzedaj nadwyżkę | Sell surplus |
| events.merchant.dismiss | Odłóż ofertę | Put offer aside |
| events.merchant.noStock | Nadwyżka została już przewieziona. Nie musisz sprzedawać. | The surplus has already been hauled away. You do not need to sell. |

## Wspólne elementy karty HUD

| Klucz | PL | EN |
| --- | --- | --- |
| events.card.title | Wieści z doliny | News from the valley |
| events.orders.title | Zamówienia królewskie | Royal orders |
| events.orders.progress | Dostarczono: {delivered}/{required} {good} | Delivered: {delivered}/{required} {good} |
| events.orders.reward | Nagroda: {silver} srebra · {renown} renomy | Reward: {silver} silver · {renown} renown |
| events.orders.dismiss | Odłóż | Set aside |
| events.orders.complete | Zamówienie wykonane | Order fulfilled |
| events.orders.none | Na razie nie ma nowych zamówień. | No new orders for now. |
| events.empty | Brak nowych wieści. Wozy mogą jechać dalej. | No new messages. The wagons can keep moving. |

Wartości {good}, {qty}, {price}, {delivered}, {required}, {silver}, {renown} podstawia HUD z danych zdarzeń i lokalizuje nazwy towarów. Bez tekstów typu „ostatnia szansa”, „zostało X sekund”, „porażka” i bez powiadomień push. Karta używa krótszych kluczy (`events.order.*`, `events.fair.*`, `events.merchant.*`); narracja tytułów 1:1 z tabeli.
