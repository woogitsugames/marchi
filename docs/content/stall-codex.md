# Księga przyczyn / Stall Codex

Teksty do poradnika w grze. Każde pole ma maksymalnie 220 znaków.
Klucze odpowiadają `BuildingStatus` / `WagonStatus` w `src/sim/types.ts`.
Stan `wagon.NO_ROUTE` obejmuje również powrót do stajni (`target = -1`).
Dla prawidłowych stanów „Naprawy / działania” to działania zapobiegawcze, nie awarie.

## `status.WORKING`

### PL — Produkuje

- **Co to znaczy:** Budynek właśnie wytwarza towar; trwa cykl produkcji.
- **Jak sprawdzić:** Dotknij budynku i sprawdź pasek postępu oraz zapasy.
- **Naprawy / działania:**
  1. Pozwól dokończyć bieżący cykl.
  2. Zapewnij odbiór wyrobów, zanim zapełnią magazyn.
- **Łańcuch:** Gospodarstwo produkuje zboże → młyn robi mąkę → piekarnia piecze chleb.

### EN — Producing

- **Meaning:** The building is making goods; its production cycle is underway.
- **How to check:** Tap the building and check its progress bar and stock.
- **Fixes / next steps:**
  1. Let the current cycle finish.
  2. Arrange collection before the output store fills up.
- **Chain:** Farm makes grain → mill makes flour → bakery bakes bread.

## `status.IDLE`

### PL — Bezczynność

- **Co to znaczy:** Budynek nie pracuje w tej chwili; sam ten stan nie oznacza awarii.
- **Jak sprawdzić:** Dotknij budynku i sprawdź jego typ, zapasy oraz status.
- **Naprawy / działania:**
  1. Sprawdź, czy stajnia lub spichlerz ma zadanie do wykonania.
  2. Jeśli brakuje popytu, podłącz odbiorcę lub zamek.
- **Łańcuch:** Brak zamówień → stajnia bez kursów → wozy czekają.

### EN — Idle

- **Meaning:** The building is not active right now; this status alone is not a fault.
- **How to check:** Tap the building and check its type, stock and status.
- **Fixes / next steps:**
  1. Check whether the stable or granary has any work to do.
  2. If there is no demand, connect a buyer or the castle.
- **Chain:** No orders → stable has no trips → wagons wait.

## `status.NO_ROAD`

### PL — Brak drogi do bramy

- **Co to znaczy:** Brama budynku nie ma przejezdnego połączenia z sąsiednią drogą.
- **Jak sprawdzić:** Dotknij budynku i obejrzyj drogę przy jego bramie.
- **Naprawy / działania:**
  1. Dorysuj drogę od bramy do traktu.
  2. Usuń przerwę lub wytycz obejście stromego terenu.
  3. Połącz trasę ze stajnią i odbiorcą.
- **Łańcuch:** Piekarnia bez drogi → brak dostaw mąki → brak chleba dla zamku.

### EN — No road to gate

- **Meaning:** The building gate has no drivable connection to an adjacent road.
- **How to check:** Tap the building and inspect the road beside its gate.
- **Fixes / next steps:**
  1. Draw a road from the gate to the network.
  2. Close any gap or route around steep ground.
  3. Connect the route to a stable and a customer.
- **Chain:** Bakery has no road → flour cannot arrive → castle gets no bread.

## `status.NO_INPUT.NONE_AVAILABLE`

### PL — Brak dostępnego surowca

- **Co to znaczy:** Nie ma surowca gotowego do przydzielenia dostawy do tego budynku.
- **Jak sprawdzić:** Dotknij budynku, potem producenta w łańcuchu; sprawdź zapasy i rezerwacje.
- **Naprawy / działania:**
  1. Uruchom lub zbuduj producenta surowca.
  2. Usuń przestój wyżej w łańcuchu dostaw.
  3. Poczekaj na nową partię, jeśli produkcja trwa.
- **Łańcuch:** Piekarnia bez mąki → młyn bez zboża → gospodarstwo bez drogi.

### EN — No input available

- **Meaning:** No input goods are ready to be assigned for delivery to this building.
- **How to check:** Tap the building, then its upstream producer; check stock and reserved goods.
- **Fixes / next steps:**
  1. Start or build a producer of the missing input.
  2. Fix the stall further upstream.
  3. Wait for a fresh batch if production is underway.
- **Chain:** Bakery lacks flour → mill lacks grain → farm has no road.

## `status.NO_INPUT.UNREACHABLE`

### PL — Brak dojazdu do surowca

- **Co to znaczy:** Surowiec jest u dostawcy, ale nie ma przejezdnej trasy do odbiorcy.
- **Jak sprawdzić:** Dotknij odbiorcy, przejdź do dostawcy w łańcuchu i obejrzyj drogi między bramami.
- **Naprawy / działania:**
  1. Połącz drogi dostawcy i odbiorcy.
  2. Odbuduj brakujący odcinek lub most.
  3. Wyznacz objazd wokół przeszkody.
- **Łańcuch:** Młyn ma mąkę → most do piekarni jest przerwany → piekarnia stoi.

### EN — Input unreachable

- **Meaning:** The supplier has the goods, but there is no drivable route to the customer.
- **How to check:** Tap the customer, follow the chain to the supplier and inspect the roads between their gates.
- **Fixes / next steps:**
  1. Connect the supplier and customer roads.
  2. Restore the missing road or bridge.
  3. Build a detour around the obstacle.
- **Chain:** Mill holds flour → bridge to bakery is broken → bakery stalls.

## `status.NO_INPUT.CONTESTED`

### PL — Surowiec jedzie do innego odbiorcy

- **Co to znaczy:** Towar jest u dostawcy, ale wozy wiozą go do budynku innego rodzaju, który też go zużywa.
- **Jak sprawdzić:** Dotknij budynku; w łańcuchu przyczyn widać rywala (np. tartak), do którego jedzie drewno.
- **Naprawy / działania:**
  1. Postaw drugiego dostawcę tego surowca.
  2. Kup wóz, żeby oba budynki dostawały ładunki na zmianę.
  3. Rozbierz lub przenieś mniej ważnego odbiorcę.
- **Łańcuch:** Drwal ma drewno → wóz wiezie je do tartaku → węglarnia czeka.

### EN — Input goes to another customer

- **Meaning:** The supplier has the goods, but wagons take them to a different kind of building that also uses them.
- **How to check:** Tap the building; the cause chain shows the rival (e.g. the sawmill) the wood goes to.
- **Fixes / next steps:**
  1. Build a second producer of this input.
  2. Buy a wagon so both buildings get loads in turn.
  3. Demolish or move the less important customer.
- **Chain:** Woodcutter has wood → wagon takes it to the sawmill → charcoal burner waits.

## `status.NO_INPUT.CHAIN_FIRST`

### PL — Surowiec idzie najpierw na łańcuch drugiego zamku

- **Co to znaczy:** Jeden zamek jest pierwszy z całym łańcuchem, więc wspólny surowiec jedzie najpierw do jego warsztatu, a ten budynek czeka na swoją kolej.
- **Jak sprawdzić:** Dotknij budynku: łańcuch przyczyn pokazuje warsztat, który bierze surowiec, a karta zamku mówi, dla którego zamku pracuje.
- **Naprawy / działania:**
  1. Zostaw tak, jeśli tamten zamek ma wcześniejszy termin; surowiec wróci, gdy jego zamówienie będzie miało swoje.
  2. Na karcie zamku wybierz „Dziel po równo” albo daj pierwszeństwo temu łańcuchowi.
- **Łańcuch:** Drwal ma drewno → wóz wiezie je do tartaku (deski dla Zamku Wschodniego) → węglarnia czeka.

### EN — Input goes to the other castle's chain first

- **Meaning:** One castle goes first with its whole chain, so the shared input goes to its workshop first and this building waits its turn.
- **How to check:** Tap the building: the cause chain shows the workshop taking the input, and the castle card says which castle it works for.
- **Fixes / next steps:**
  1. Leave it if that castle's deadline comes first; the input returns once its order is covered.
  2. On the castle card choose "Share evenly" or put this chain first instead.
- **Chain:** Woodcutter has logs → wagon takes them to the sawmill (planks for the East Castle) → charcoal burner waits.

## `status.WAITING_UPSTREAM`

### PL — Czeka na dostawcę

- **Co to znaczy:** Dostawca jest osiągalny i wytwarza towar lub czeka na własną dostawę; ładunek nie jest jeszcze gotowy.
- **Jak sprawdzić:** Dotknij odbiorcy, potem dostawcy w Łańcuchu przyczyn; sprawdź postęp i zapasy.
- **Naprawy / działania:**
  1. Poczekaj, aż dostawca przygotuje towar.
  2. Jeśli sam czeka na dostawę, przejdź wyżej w łańcuchu przyczyn.
  3. Sprawdź, czy wozy mają dojazd do gotowego towaru.
- **Łańcuch:** Piekarnia czeka na mąkę → młyn właśnie ją produkuje → wóz odbierze mąkę.

### EN — Waiting for upstream supply

- **Meaning:** A reachable supplier is producing the goods or awaiting its own delivery; the cargo is not ready yet.
- **How to check:** Tap the customer, then the supplier in the Cause chain; check progress and stock.
- **Fixes / next steps:**
  1. Wait until the supplier has goods ready.
  2. If it is awaiting input too, follow the chain further upstream.
  3. Check that wagons can reach the goods once ready.
- **Chain:** Bakery awaits flour → mill is producing it → a wagon will collect the flour.

## `status.WAITING_DELIVERY`

### PL — Dostawa w drodze

- **Co to znaczy:** Wóz ma przydzieloną dostawę surowca, która jeszcze nie dotarła.
- **Jak sprawdzić:** Dotknij odbiorcy, potem wozu w łańcuchu; sprawdź cel i dojazd.
- **Naprawy / działania:**
  1. Poczekaj na dostawę.
  2. Jeśli wóz stracił trasę, napraw drogę.
  3. Jeśli stoi przy moście, zbuduj objazd.
- **Łańcuch:** Piekarnia czeka na mąkę → wóz jedzie z młyna → piec ruszy po dostawie.

### EN — Delivery on the way

- **Meaning:** A wagon has been assigned the incoming input, but it has not arrived yet.
- **How to check:** Tap the customer, then its wagon in the chain; check destination and ETA.
- **Fixes / next steps:**
  1. Wait for the delivery.
  2. If the wagon has no route, repair the road.
  3. If it is stuck at a bridge, build a detour.
- **Chain:** Bakery waits for flour → wagon drives from mill → baking resumes on delivery.

## `status.NO_WAGON.ALL_BUSY`

### PL — Wszystkie wozy zajęte

- **Co to znaczy:** Towar może zostać przewieziony, ale żaden wóz nie jest wolny.
- **Jak sprawdzić:** Dotknij odbiorcy, potem stajni i wozów; sprawdź ich aktualne kursy.
- **Naprawy / działania:**
  1. Kup dodatkowy wóz w stajni.
  2. Poczekaj na zakończenie któregoś kursu.
  3. Skróć przewozy nową drogą lub brukiem.
- **Łańcuch:** Piekarnia potrzebuje mąki → wszystkie wozy wiozą deski → dostawa czeka.

### EN — All wagons busy

- **Meaning:** The goods can be transported, but no wagon is free to take the job.
- **How to check:** Tap the customer, then the stable and wagons; inspect their current trips.
- **Fixes / next steps:**
  1. Buy another wagon at a stable.
  2. Wait until one of the current trips ends.
  3. Shorten routes with a new road or cobbles.
- **Chain:** Bakery needs flour → all wagons haul planks → flour delivery must wait.

## `status.NO_WAGON.NONE_CAN_REACH`

### PL — Żaden wóz nie dojedzie

- **Co to znaczy:** Wolne wozy istnieją, ale żaden nie dotrze do miejsca odbioru towaru.
- **Jak sprawdzić:** Dotknij odbiorcy, stajni i dostawcy; sprawdź połączenie dróg do źródła.
- **Naprawy / działania:**
  1. Połącz stajnię drogą z dostawcą.
  2. Napraw odcięty most lub odcinek drogi.
  3. Postaw stajnię połączoną z dostawcą i kup wóz.
- **Łańcuch:** Młyn ma mąkę → stajnia odcięta od młyna → piekarnia nie dostaje dostawy.

### EN — No wagon can reach pickup

- **Meaning:** Free wagons exist, but none can reach the goods at their source.
- **How to check:** Tap the customer, stable and supplier; inspect the road link to the pickup point.
- **Fixes / next steps:**
  1. Connect the stable to the supplier by road.
  2. Repair the cut-off bridge or road section.
  3. Build a connected stable and buy a wagon there.
- **Chain:** Mill has flour → stable is cut off from mill → bakery gets no delivery.

## `status.OUTPUT_FULL.NO_WAGON`

### PL — Pełno — brak wozu

- **Co to znaczy:** Budynek nie może produkować dalej, bo jego wyroby czekają na odbiór, a brak wozu.
- **Jak sprawdzić:** Dotknij producenta i sprawdź zapas wyrobów; następnie otwórz stajnię.
- **Naprawy / działania:**
  1. Kup wóz w połączonej stajni.
  2. Poczekaj, aż wóz skończy obecny kurs.
  3. Napraw dojazd wozów do producenta.
- **Łańcuch:** Tartak pełen desek → brak wozu do odbioru → produkcja desek staje.

### EN — Output full — no wagon

- **Meaning:** Production cannot continue because finished goods await pickup and no wagon can collect them.
- **How to check:** Tap the producer and inspect output stock; then open the stable.
- **Fixes / next steps:**
  1. Buy a wagon at a connected stable.
  2. Wait for a wagon to finish its current trip.
  3. Repair wagon access to the producer.
- **Chain:** Sawmill full of planks → no wagon collects them → plank production stops.

## `status.OUTPUT_FULL.NO_DESTINATION`

### PL — Pełno — nie ma dokąd wieźć

- **Co to znaczy:** Wyroby blokują produkcję, bo brak odbiorcy lub osiągalnego spichlerza z wolnym miejscem.
- **Jak sprawdzić:** Dotknij producenta, potem spichlerzy; sprawdź ich zapełnienie i drogi.
- **Naprawy / działania:**
  1. Zbuduj i podłącz kolejny spichlerz.
  2. Zapewnij odbiorcę potrzebującego tego towaru.
  3. Połącz producenta drogą z wolnym spichlerzem.
- **Łańcuch:** Drwal ma pełno drewna → spichlerz pełny → drwal przestaje pracować.

### EN — Output full — no destination

- **Meaning:** Finished goods block production because no customer or reachable granary has room.
- **How to check:** Tap the producer, then granaries; check their space and road access.
- **Fixes / next steps:**
  1. Build and connect another granary.
  2. Provide a customer that needs these goods.
  3. Connect the producer to a granary with space.
- **Chain:** Woodcutter holds too many logs → granary is full → woodcutting stops.

## `status.WAITING_PICKUP`

### PL — Czeka na odbiór

- **Co to znaczy:** Zapas wyrobów jest pełny, ale wóz już dostał zlecenie odbioru.
- **Jak sprawdzić:** Dotknij producenta, potem wozu w łańcuchu; sprawdź, gdzie utknął.
- **Naprawy / działania:**
  1. Poczekaj na przyjazd wozu.
  2. Przy korku na moście zapewnij objazd.
  3. Przy braku trasy napraw przerwę w drodze.
- **Łańcuch:** Tartak pełen desek → wóz jedzie po deski → tartak wznowi produkcję.

### EN — Waiting for pickup

- **Meaning:** The output store is full, but a wagon has already been assigned to collect it.
- **How to check:** Tap the producer, then its wagon in the chain; check where it is.
- **Fixes / next steps:**
  1. Wait for the wagon to arrive.
  2. If the bridge is jammed, provide a detour.
  3. If the route is broken, repair the road gap.
- **Chain:** Sawmill full of planks → wagon drives to collect them → production resumes.

## `status.WAGON_DUE`

### PL — Wóz zaraz przyjedzie

- **Co to znaczy:** Towar czeka, bo zajęty wóz kończy kurs obok i dojedzie po niego szybciej niż wolny wóz z daleka.
- **Jak sprawdzić:** Dotknij budynku: linia mówi, który wóz i za ile przyjedzie. Dotknij tego wozu i sprawdź, czy nie stoi przy moście.
- **Naprawy / działania:**
  1. Poczekaj — dalszy wóz celowo nie rusza.
  2. Nie kupuj wozu z tego powodu: nowy wóz nie dojechałby tu szybciej.
- **Łańcuch:** Tartak pełen desek → wóz 2 rozładowuje obok → za kilka sekund weźmie deski.

### EN — Wagon due shortly

- **Meaning:** The goods wait because a busy wagon finishing a run nearby will get there sooner than a free wagon from far away.
- **How to check:** Tap the building: the line says which wagon comes and when. Tap that wagon and check it is not held at a bridge.
- **Fixes / next steps:**
  1. Wait — the far wagon is held back on purpose.
  2. Do not buy a wagon for this: a new one would not get there sooner.
- **Chain:** Sawmill full of planks → wagon 2 unloads next door → takes the planks in a few seconds.

## `status.STORAGE_FULL`

### PL — Spichlerz pełny

- **Co to znaczy:** Spichlerz osiągnął limit łącznych zapasów i nie przyjmie kolejnych dostaw.
- **Jak sprawdzić:** Dotknij spichlerza i sprawdź licznik zajętości oraz rodzaje towarów.
- **Naprawy / działania:**
  1. Zbuduj kolejny spichlerz przy drodze.
  2. Połącz spichlerz z budynkami zużywającymi zapasy.
  3. Zwiększ zapotrzebowanie, uruchamiając produkcję dalej w łańcuchu.
- **Łańcuch:** Spichlerz pełen zboża → gospodarstwo nie ma gdzie oddać plonu.

### EN — Granary full

- **Meaning:** The granary has reached its total storage limit and cannot accept more deliveries.
- **How to check:** Tap the granary and check its capacity counter and stored goods.
- **Fixes / next steps:**
  1. Build another granary beside a road.
  2. Connect the granary to buildings that use its stock.
  3. Create demand by starting production further down the chain.
- **Chain:** Granary is full of grain → farm has nowhere to send its harvest.

## `status.CONTRACT_DONE`

### PL — Kontrakt wykonany

- **Co to znaczy:** Zamek otrzymał zamówione towary i kontrakt został ukończony.
- **Jak sprawdzić:** Dotknij zamku i otwórz list przewozowy z wynikiem.
- **Naprawy / działania:**
  1. Nic nie naprawiaj — cel został osiągnięty.
  2. Sprawdź liczbę zdobytych pieczęci.
  3. Przejdź do kolejnej misji lub Wolnej doliny.
- **Łańcuch:** Gospodarstwo → młyn → piekarnia → chleb w zamku → kontrakt wykonany.

### EN — Contract fulfilled

- **Meaning:** The castle has received the requested goods and the contract is complete.
- **How to check:** Tap the castle and open the waybill to see the result.
- **Fixes / next steps:**
  1. No repair is needed — the goal is complete.
  2. Check how many seals you earned.
  3. Try the next mission or Free valley.
- **Chain:** Farm → mill → bakery → bread reaches castle → contract fulfilled.

## `wagon.IDLE`

### PL — Stoi w stajni

- **Co to znaczy:** Wóz nie ma teraz zlecenia i zwykle czeka przy swojej stajni.
- **Jak sprawdzić:** Dotknij wozu i sprawdź ładunek, cel oraz aktualny status.
- **Naprawy / działania:**
  1. Poczekaj, aż odbiorca zgłosi potrzebę towaru.
  2. Podłącz stajnię do sieci dostaw.
  3. Sprawdź, czy u producenta są towary do odbioru.
- **Łańcuch:** Piekarnia nie zamawia mąki → wóz bez zlecenia → stoi w stajni.

### EN — At the stable

- **Meaning:** The wagon has no job right now and usually waits at its home stable.
- **How to check:** Tap the wagon and check cargo, destination and status.
- **Fixes / next steps:**
  1. Wait until a customer needs goods.
  2. Connect the stable to the supply network.
  3. Check whether a supplier has goods ready for pickup.
- **Chain:** Bakery has no flour order → wagon has no job → waits at stable.

## `wagon.TO_PICKUP`

### PL — Jedzie po ładunek

- **Co to znaczy:** Wóz jest w drodze do dostawcy, aby odebrać przydzielony towar.
- **Jak sprawdzić:** Dotknij wozu, wybierz Śledź wóz i sprawdź jego cel oraz dojazd.
- **Naprawy / działania:**
  1. Poczekaj, jeśli wóz jedzie prawidłowo.
  2. Wybrukuj długi lub błotnisty odcinek.
  3. Gdy pojawi się brak trasy, odbuduj drogę.
- **Łańcuch:** Wóz jedzie do młyna → ładuje mąkę → dostarcza ją do piekarni.

### EN — Going to pickup

- **Meaning:** The wagon is travelling to the supplier to collect assigned goods.
- **How to check:** Tap the wagon, choose Follow wagon and check destination and ETA.
- **Fixes / next steps:**
  1. Wait if the wagon is moving normally.
  2. Pave long or muddy sections with cobbles.
  3. If the route fails, repair the broken road.
- **Chain:** Wagon goes to mill → loads flour → delivers it to bakery.

## `wagon.LOADING`

### PL — Załadunek

- **Co to znaczy:** Wóz stoi u dostawcy i ładuje towar przed dalszą drogą.
- **Jak sprawdzić:** Dotknij wozu i sprawdź status Załadunek oraz budynek źródłowy.
- **Naprawy / działania:**
  1. Poczekaj na zakończenie załadunku.
  2. Sprawdź, czy dostawca ma zapas towaru.
  3. Nie rozbieraj źródła lub bramy podczas kursu.
- **Łańcuch:** Młyn ma mąkę → wóz ładuje mąkę → rusza do piekarni.

### EN — Loading

- **Meaning:** The wagon is at the supplier, loading goods before the delivery leg.
- **How to check:** Tap the wagon and check Loading status and the source building.
- **Fixes / next steps:**
  1. Wait for loading to finish.
  2. Check that the supplier has stock available.
  3. Do not demolish the source or gate during the trip.
- **Chain:** Mill has flour → wagon loads flour → heads to bakery.

## `wagon.TO_DROPOFF`

### PL — Wiezie ładunek

- **Co to znaczy:** Wóz przewozi odebrany towar do wskazanego odbiorcy.
- **Jak sprawdzić:** Dotknij wozu; sprawdź Ładunek, Cel i czas dostawy.
- **Naprawy / działania:**
  1. Poczekaj, aż dojedzie do odbiorcy.
  2. Wybrukuj trasę, jeśli często się opóźnia.
  3. Napraw przerwaną drogę, jeśli zgłosi brak trasy.
- **Łańcuch:** Wóz z mąką → piekarnia dostaje mąkę → produkcja chleba rusza.

### EN — Delivering cargo

- **Meaning:** The wagon is carrying collected goods to the assigned customer.
- **How to check:** Tap the wagon; check Cargo, Destination and delivery ETA.
- **Fixes / next steps:**
  1. Wait for it to reach the customer.
  2. Pave the route if deliveries are often slow.
  3. Repair any broken road if No route appears.
- **Chain:** Wagon carries flour → bakery receives it → bread production starts.

## `wagon.UNLOADING`

### PL — Rozładunek

- **Co to znaczy:** Wóz dotarł do odbiorcy i przekazuje mu przewożony towar.
- **Jak sprawdzić:** Dotknij wozu, potem docelowego budynku; obserwuj zmianę zapasów.
- **Naprawy / działania:**
  1. Poczekaj na koniec rozładunku.
  2. Sprawdź, czy towar trafił do odbiorcy.
  3. Jeśli łańcuch nadal stoi, otwórz status odbiorcy.
- **Łańcuch:** Wóz rozładowuje zboże → młyn dostaje surowiec → rusza produkcja mąki.

### EN — Unloading

- **Meaning:** The wagon has reached its customer and is transferring its cargo.
- **How to check:** Tap the wagon, then its destination building; watch the stock change.
- **Fixes / next steps:**
  1. Wait for unloading to finish.
  2. Check that the customer received the goods.
  3. If the chain still stalls, inspect the customer's status.
- **Chain:** Wagon unloads grain → mill receives input → flour production starts.

## `wagon.RETURNING`

### PL — Wraca do stajni

- **Co to znaczy:** Wóz zakończył dostawę i jedzie z powrotem do swojej stajni.
- **Jak sprawdzić:** Dotknij wozu i sprawdź trasę powrotną oraz stan ładunku.
- **Naprawy / działania:**
  1. Poczekaj na powrót, jeśli droga jest drożna.
  2. Połącz stajnię krótszą drogą z resztą sieci.
  3. Napraw trasę, jeśli wóz zgłosi brak dojazdu.
- **Łańcuch:** Wóz oddaje chleb w zamku → wraca do stajni → czeka na następny kurs.

### EN — Returning to stable

- **Meaning:** The wagon has finished its delivery and is travelling back to its home stable.
- **How to check:** Tap the wagon and check its return route and cargo.
- **Fixes / next steps:**
  1. Wait if its route is clear.
  2. Give the stable a shorter connection to the network.
  3. Repair the road if the wagon reports No route.
- **Chain:** Wagon drops bread at castle → returns to stable → waits for next job.

## `wagon.BRIDGE_JAM`

### PL — Korek na moście

- **Co to znaczy:** Wóz czeka przed drewnianym mostem na przejazd innych wozów.
- **Jak sprawdzić:** Dotknij wozu, przejdź do blokującego wozu w łańcuchu i obejrzyj most.
- **Naprawy / działania:**
  1. Poczekaj, aż zwolni się przejazd.
  2. Zbuduj drugi most lub trasę objazdową.
  3. Rozważ kamienny most, by usunąć ograniczenie ruchu.
- **Łańcuch:** Dwa wozy jadą z przeciwnych stron → jeden czeka przy moście → dostawa się opóźnia.

### EN — Bridge traffic jam

- **Meaning:** The wagon is waiting at a wooden bridge for other traffic to clear.
- **How to check:** Tap the wagon, follow the blocking wagon in its chain and inspect the bridge.
- **Fixes / next steps:**
  1. Wait until the crossing clears.
  2. Build a second bridge or a detour.
  3. Consider a stone bridge to remove the traffic restriction.
- **Chain:** Two wagons approach from opposite sides → one waits at bridge → delivery is delayed.

## `wagon.BRIDGE_CLOSED`

### PL — Most skuty lodem

- **Co to znaczy:** Kra zamknęła drewniany most; wóz czeka przy przyczółku do odwilży, ładunek i zlecenie zostają.
- **Jak sprawdzić:** Dotknij wozu: zobaczysz, do której godziny most jest zamknięty. Kamienny most lód omija.
- **Naprawy / działania:**
  1. Przed zamknięciem zgromadź zapas w spichlerzu po drugiej stronie rzeki.
  2. Zamień przęsło na kamienne — lód zamyka tylko drewniane mosty.
  3. Poczekaj do odwilży; potem wozy ruszą same.
- **Łańcuch:** Wóz z drewnem → most skuty lodem do 08:00 → tartak bez drewna → zamek bez desek.

### EN — Bridge closed by ice

- **Meaning:** Ice has closed the wooden bridge; the wagon waits at the bridgehead until the thaw and keeps its cargo and job.
- **How to check:** Tap the wagon to see until when the bridge is closed. Stone bridges are not affected.
- **Fixes / next steps:**
  1. Before the closure, stock a granary on the far bank of the river.
  2. Rebuild the span in stone — ice only closes wooden bridges.
  3. Wait for the thaw; wagons then continue on their own.
- **Chain:** Wagon with wood → bridge iced until 08:00 → sawmill without wood → castle without planks.

## `wagon.NO_ROUTE`

### PL — Brak drogi do celu

- **Co to znaczy:** Wóz nie ma przejezdnej trasy do dostawcy, odbiorcy lub swojej stajni.
- **Jak sprawdzić:** Dotknij wozu; sprawdź Cel, łańcuch przyczyn i drogę między punktami.
- **Naprawy / działania:**
  1. Odbuduj brakujący odcinek lub most.
  2. Połącz siecią dróg bramy źródła, celu i stajni.
  3. Gdy zniknął odbiorca, zapewnij inny osiągalny punkt dostawy.
- **Łańcuch:** Wóz z mąką → most rozebrany → piekarnia bez dostawy → brak chleba w zamku.

### EN — No route

- **Meaning:** The wagon has no drivable route to its supplier, customer or home stable.
- **How to check:** Tap the wagon; check Destination, its cause chain and roads between endpoints.
- **Fixes / next steps:**
  1. Restore the missing road or bridge.
  2. Connect the source, customer and stable gates.
  3. If the customer is gone, provide another reachable destination.
- **Chain:** Wagon carries flour → bridge removed → bakery lacks input → castle gets no bread.

# Wersje spokojne / Calm variants

Gdy postój jest spokojny (nadwyżka, której nikt teraz nie potrzebuje, wypełnione zamówienie, kamień już w spichlerzu),
fałda „Co to znaczy?” pokazuje ten wariant zamiast zwykłego wpisu (D-98).

## `status.OUTPUT_FULL.NO_WAGON` — spokojny / calm

### PL — Pełno — nic pilnego

- **Co to znaczy:** Wyroby czekają na miejscu, bo teraz nikt ich nie potrzebuje albo zapas już leży w spichlerzu; to nie awaria.
- **Jak sprawdzić:** Przeczytaj spokojną linię wyżej w karcie: mówi, czego jest już dość.
- **Naprawy / działania:**
  1. Nie kupuj wozu z tego powodu — ten postój niczego nie blokuje.
  2. Zajmij się postojem z czerwoną pieczęcią, jeśli jest.
  3. Gdy towar znów będzie potrzebny, wóz przyjedzie sam.
- **Łańcuch:** Tartak pełen desek → zamówienie desek wypełnione → tartak spokojnie czeka.

### EN — Full — nothing urgent

- **Meaning:** The goods wait on site because nobody needs them now or the stock is already in a granary; nothing is broken.
- **How to check:** Read the calm line higher up on the card: it says what there is already enough of.
- **Fixes / next steps:**
  1. Do not buy a wagon for this — this stall blocks nothing.
  2. Turn to a stall with a red seal, if there is one.
  3. When the goods are needed again, a wagon comes on its own.
- **Chain:** Sawmill full of planks → plank order filled → the sawmill waits calmly.

# Wpisy sytuacyjne / Situational entries

Stany, które karta czyta po swojemu (spokojna linia, linia zamku, samouczek), mają własny wpis fałdy
„Co to znaczy?” zamiast wpisu statusu (D-339, `src/ui/codexSituations.ts`). Teksty są kluczami i18n
`codex.s.<wpis>.<pole>` we wszystkich 17 językach; tu PL i EN.

## `wagonDue` — `status.WAGON_DUE` (D-156)

### PL — Wóz zaraz przyjedzie

- **Co to znaczy:** Towar czeka, bo zajęty wóz kończy kurs obok i dojedzie po niego szybciej niż wolny wóz z daleka.
- **Jak sprawdzić:** Dotknij budynku: linia mówi, który wóz i za ile przyjedzie. Dotknij tego wozu i sprawdź, czy nie stoi przy moście.
- **Naprawy / działania:**
  1. Poczekaj — dalszy wóz celowo nie rusza.
  2. Nie kupuj wozu z tego powodu: nowy wóz nie dojechałby tu szybciej.
- **Łańcuch:** Tartak pełen desek → wóz 2 rozładowuje obok → za kilka sekund weźmie deski.

### EN — Wagon due shortly

- **Meaning:** The goods wait because a busy wagon finishing a run nearby will get there sooner than a free wagon from far away.
- **How to check:** Tap the building: the line says which wagon comes and when. Tap that wagon and check it is not held at a bridge.
- **Fixes / next steps:**
  1. Wait — the far wagon is held back on purpose.
  2. Do not buy a wagon for this: a new one would not get there sooner.
- **Chain:** Sawmill full of planks → wagon 2 unloads next door → takes the planks in a few seconds.

## `marketFull` — spichlerz pełny, rynek nasycony / granary full, market saturated (D-174, D-180)

### PL — Spichlerz pełny — rynek nasycony

- **Co to znaczy:** Spichlerz jest pełen towaru, którego rynki teraz więcej nie wezmą — cena spadła do dna albo wozy już wiozą tyle, ile rynek przyjmie.
- **Jak sprawdzić:** Przeczytaj spokojną linię wyżej w karcie: rynek bierze tyle, ile zje. Sprawdź, jakie towary leżą w spichlerzu pełnymi ładunkami.
- **Naprawy / działania:**
  1. Nie kupuj wozu z tego powodu — nowy wóz tylko by czekał.
  2. Sprzedaj inny towar albo przyjmij zamówienie; posterunek handlowy za rzeką, gdy jest otwarty i ma drogę, kupi więcej.
- **Łańcuch:** Spichlerz pełen drewna → cena drewna w zamku na dnie → wozy nie mają dokąd go wieźć.

### EN — Granary full — the market is saturated

- **Meaning:** The granary is full of goods the markets will not take more of now — the price is at its floor or wagons already carry all the market accepts.
- **How to check:** Read the calm line higher up on the card: the market only takes what it can use. Check which goods lie in the granary in full loads.
- **Fixes / next steps:**
  1. Do not buy a wagon for this — a new wagon would just wait.
  2. Sell another good or accept an order; the trading post across the river, once open and reached by a road, buys more.
- **Chain:** Granary full of logs → log price at the castle on the floor → wagons have nowhere to take them.

## `surplus` — nadwyżka / surplus (D-160)

### PL — Nadwyżka — nikt jej teraz nie potrzebuje

- **Co to znaczy:** Plac budynku jest pełny, ale żaden odbiorca nie czeka teraz na ten towar, więc wozy zabiorą go na końcu.
- **Jak sprawdzić:** Przeczytaj linię wyżej w karcie: nadwyżka poczeka na placu. Dotknij odbiorców tego towaru — żaden nie stoi z jego braku.
- **Naprawy / działania:**
  1. Nie kupuj wozu z tego powodu — nowy wóz tego nie przyspieszy.
  2. Zajmij się postojem, który naprawdę coś blokuje; gdy towar znów będzie potrzebny, wóz przyjedzie sam.
- **Łańcuch:** Gospodarstwo pełne zboża → młyn ma zapas → zboże spokojnie czeka na placu.

### EN — Surplus — nobody needs it now

- **Meaning:** The building's yard is full, but no customer is waiting for this good now, so wagons collect it last.
- **How to check:** Read the line higher up on the card: the surplus waits in the yard. Tap the customers of this good — none of them stands for lack of it.
- **Fixes / next steps:**
  1. Do not buy a wagon for this — a new wagon would not move it sooner.
  2. Turn to a stall that really blocks something; when the good is needed again, a wagon comes on its own.
- **Chain:** Farmstead full of grain → the watermill has stock → the grain waits calmly in the yard.

## `postNoRoad` — posterunek bez drogi / trading post without a road (D-170)

### PL — Posterunek bez drogi

- **Co to znaczy:** Posterunek handlowy za rzeką płaci więcej niż zamek, ale żadna droga ze stajni nie dochodzi do jego bramy.
- **Jak sprawdzić:** Dotknij posterunku: karta pokazuje drogę z mostem i jej cenę. Sprawdź też, czy posterunek już kupuje, czy otworzy się dopiero w podanej randze.
- **Naprawy / działania:**
  1. Gdy masz srebro na most, zbuduj drogę z karty — to Twój wybór, nie awaria.
  2. Dopóki drogi nie ma, sprzedawaj w zamku; posterunek poczeka.
- **Łańcuch:** Posterunek za rzeką → brak mostu → wozy jeżdżą tylko do zamku.

### EN — Trading post without a road

- **Meaning:** The trading post across the river pays more than the castle, but no road from a stable reaches its gate.
- **How to check:** Tap the trading post: the card shows the road with its bridge and its price. Check too whether the post is buying yet or opens only at the rank it names.
- **Fixes / next steps:**
  1. When you have the silver for the bridge, build the road from the card — your choice, not a fault.
  2. Until the road is there, sell at the castle; the post will wait.
- **Chain:** Trading post across the river → no bridge → wagons drive only to the castle.

## `castleRival` — XVI: drugi zamek zabiera towar / the other castle takes the goods (D-291)

### PL — Drugi zamek zabiera towar

- **Co to znaczy:** Oba zamki czekają na ten sam towar, a wozy wiozą go teraz do drugiego zamku, więc tu zapas nie rośnie.
- **Jak sprawdzić:** Dotknij zamku: linia w karcie mówi, który zamek dostaje towar, ile wozów jedzie i ile tu brakuje do terminu. Porównaj terminy obu zamków w liście przewozowym.
- **Naprawy / działania:**
  1. Jeśli ten zamek ma wcześniejszy termin, dotknij „Ten zamek pierwszy” — zdecyduj wcześnie.
  2. Jeśli pilniejszy jest drugi zamek, zostaw podział albo daj pierwszeństwo jemu.
- **Łańcuch:** Tartak robi deski → 2 wozy wiozą je do Zamku Północnego → Zamkowi Wschodniemu brakuje 18 do 5:00.

### EN — The other castle takes the goods

- **Meaning:** Both castles wait for the same good, and wagons now carry it to the other castle, so the stock here does not grow.
- **How to check:** Tap the castle: a line on its card names the castle getting the goods, the wagons on the way and what is still missing here by the deadline. Compare both deadlines on the waybill.
- **Fixes / next steps:**
  1. If this castle's deadline comes first, tap “This castle first” — decide early.
  2. If the other castle is more urgent, keep the split or put that one first.
- **Chain:** Sawmill makes planks → 2 wagons take them to the North Castle → the East Castle lacks 18 by 5:00.

## `castleEven` — XVI: towar dzielony po równo / goods shared evenly (D-290)

### PL — Towar dzielony po równo

- **Co to znaczy:** Żaden zamek nie jest pierwszy, więc wozy dzielą gotowy towar między oba zamki — każdy ładunek jedzie tam, gdzie zamówienie jest mniej wypełnione.
- **Jak sprawdzić:** Dotknij zamku: prognoza mówi, czy przy tym podziale zdąży na swój termin. Pod przyciskiem „Ten zamek pierwszy” widać, kiedy byłby gotowy jako pierwszy.
- **Naprawy / działania:**
  1. Gdy zamek spóźni się przy podziale, a jako pierwszy by zdążył, dotknij u niego „Ten zamek pierwszy”.
  2. Decyduj wcześnie: im później przełączysz, tym mniej to da.
- **Łańcuch:** Tartak robi deski → wozy wiozą je na zmianę do obu zamków → Zamek Wschodni spóźni się o 0:50.

### EN — Goods shared evenly

- **Meaning:** No castle goes first, so wagons share the finished goods between both castles — each load goes where the order is less filled.
- **How to check:** Tap the castle: the forecast says whether it makes its deadline at this split. Under “This castle first” you can see when it would be done going first.
- **Fixes / next steps:**
  1. If a castle will be late at the split but would make it going first, tap “This castle first” on its card.
  2. Decide early: the later you switch, the less it gains.
- **Chain:** Sawmill makes planks → wagons take them to both castles in turn → the East Castle will be 0:50 late.

## `castleFirst` — XVI: przełącznik pierwszeństwa włączony / castle-first switch on (D-289)

### PL — Zamek ma pierwszeństwo

- **Co to znaczy:** Jeden zamek jest pierwszy: wozy z gotowym towarem jadą najpierw do niego, a drugi zamek dostaje towar dopiero po nim.
- **Jak sprawdzić:** Dotknij zamku: linia w karcie mówi, który zamek jest pierwszy. Prognoza każdego zamku pokazuje, czy zdąży na swój termin.
- **Naprawy / działania:**
  1. Zostaw tak — gdy pierwszy zamek dostanie całe zamówienie, wozy same pojadą do drugiego.
  2. Żeby wrócić do podziału, dotknij „Dziel po równo” na karcie pierwszego zamku.
- **Łańcuch:** Zamek Wschodni pierwszy → wozy wiozą deski najpierw tam → Zamek Północny dostaje je po nim.

### EN — A castle goes first

- **Meaning:** One castle goes first: wagons with finished goods drive to it first, and the other castle gets goods only after it.
- **How to check:** Tap the castle: a line on its card says which castle goes first. Each castle's forecast shows whether it makes its deadline.
- **Fixes / next steps:**
  1. Leave it — once the first castle has its whole order, wagons drive to the other one on their own.
  2. To go back to the split, tap “Share evenly” on the first castle's card.
- **Chain:** East Castle first → wagons take the planks there first → the North Castle gets them after it.

## `tutorialNoRoad` — samouczek budowania: chata bez drogi / build tutorial: hut without a road (D-259)

### PL — Chata bez drogi

- **Co to znaczy:** Chata drwala ścina drewno na swoje podwórze, ale bez drogi do bramy żaden wóz go nie odbierze — gdy podwórze się zapełni, chata staje.
- **Jak sprawdzić:** Dotknij chaty: status mówi „Brak drogi do bramy”, a na mapie widać proponowaną drogę od bramy. Sprawdź, czy podwórze jest pełne.
- **Naprawy / działania:**
  1. Zbuduj drogę zaproponowaną na karcie albo narysuj ją narzędziem Droga od bramy do drogi prowadzącej do stajni.
  2. Gdy droga połączy chatę ze stajnią, wóz zabierze drewno i chata znów ruszy.
- **Łańcuch:** Chata drwala bez drogi → podwórze pełne drewna → chata stoi.

### EN — Hut without a road

- **Meaning:** The woodcutter's hut cuts logs into its yard, but with no road to its gate no wagon can collect them — once the yard is full, the hut stops.
- **How to check:** Tap the hut: its status reads “No road to the gate” and the map shows the suggested road from the gate. Check whether the yard is full.
- **Fixes / next steps:**
  1. Build the road the card offers, or draw one with the Road tool from the gate to a road that leads to the stable.
  2. Once the road joins the hut to the stable, a wagon takes the logs and the hut starts again.
- **Chain:** Woodcutter's hut without a road → yard full of logs → the hut stands.

## `castleChain` — XVII: wspólny surowiec idzie na łańcuch drugiego zamku / the shared input goes to the other castle's chain (D-358)

### PL — Wspólny surowiec idzie na drugi łańcuch

- **Co to znaczy:** Warsztaty obu zamków żyją z tego samego surowca; teraz bierze go warsztat drugiego zamku, więc producent tego zamku stoi.
- **Jak sprawdzić:** Dotknij zamku: linia w karcie mówi, który warsztat stoi i dla którego zamku idzie surowiec. Porównaj terminy w liście przewozowym.
- **Naprawy / działania:**
  1. Jeśli ten zamek ma wcześniejszy termin, dotknij „Cały łańcuch dla tego zamku” — samo „Ten zamek pierwszy” nie doda surowca.
  2. Decyduj wcześnie: surowiec zużyty w pierwszych minutach już nie wróci.
- **Łańcuch:** Drwal ma drewno → wozy wiozą je do tartaku (deski dla Zamku Wschodniego) → węglarnia stoi.

### EN — Shared input goes to the other chain

- **Meaning:** Both castles' workshops live on the same input; the other castle's workshop is taking it now, so this castle's producer stands idle.
- **How to check:** Tap the castle: the card line says which workshop stands idle and which castle the input goes to. Compare the deadlines on the waybill.
- **Fixes / next steps:**
  1. If this castle's deadline comes first, tap “Whole chain for this castle” — “This castle first” alone adds no input.
  2. Decide early: input used up in the first minutes does not come back.
- **Chain:** Woodcutter has logs → wagons take them to the sawmill (planks for the East Castle) → charcoal burner stands idle.

