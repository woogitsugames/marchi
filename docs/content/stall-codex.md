# Księga przyczyn / Stall codex

Treść poradnika dostępna w PL i EN. Każdy wpis wyjaśnia znaczenie, sposób sprawdzenia, dwie naprawy i przykład łańcucha. Teksty mają co najwyżej 220 znaków na pole; nazwy statusów odpowiadają `src/sim/types.ts`. Stany informacyjne (WORKING, IDLE, …) również mają wpisy.

## `status.WORKING`

**PL — Praca trwa.** Budynek wytwarza towar. **Sprawdź:** Otwórz budynek; sprawdź postęp i zapas. **Naprawy:** Sprawdź kolejny odbiór.; Zapewnij drogę do odbiorcy. **Łańcuch:** Tartak → praca → deski czekają na wóz.

**EN — Producing.** The building is making goods. **Check:** Open the building; check progress and stock. **Fixes:** Check the next collection.; Keep the delivery road clear. **Chain:** Sawmill → working → planks await a wagon.

## `status.IDLE`

**PL — Bezczynność.** Budynek nie ma w tej chwili zadania. **Sprawdź:** Otwórz budynek i sprawdź odbiorców. **Naprawy:** Sprawdź, czy kontrakt trwa.; Zobacz zapasy i drogi. **Łańcuch:** Stajnia → brak zlecenia → wozy czekają.

**EN — Idle.** No current task requires this building. **Check:** Open it and inspect nearby demand. **Fixes:** Check if the contract is active.; Inspect stock and roads. **Chain:** Stable → no jobs → wagons waiting.

## `status.NO_ROAD`

**PL — Brak drogi.** Brama budynku nie jest połączona z traktem. **Sprawdź:** Dotknij budynku, potem zaznacz drogę. **Naprawy:** Połącz bramę z siecią.; Odbuduj przerwany odcinek. **Łańcuch:** Młyn → brak drogi → zboże nie dojeżdża.

**EN — No road.** The gate is cut off from the road network. **Check:** Tap the building, then inspect its gate. **Fixes:** Connect the gate to the road.; Repair a missing road cell. **Chain:** Mill → no road → grain cannot arrive.

## `status.NO_INPUT.NONE_AVAILABLE`

**PL — Brak surowca.** Nigdzie nie ma wolnego zapasu potrzebnego towaru. **Sprawdź:** Otwórz „Dlaczego stoi?” i przejdź do dostawcy. **Naprawy:** Uruchom producenta surowca.; Sprawdź zapas i rezerwacje. **Łańcuch:** Piekarnia → brak mąki → młyn bez zboża.

**EN — No supplies.** No unreserved input goods are available. **Check:** Open Why stalled? and follow the supplier. **Fixes:** Restore upstream production.; Inspect stock and reservations. **Chain:** Bakery → no flour → mill lacks grain.

## `status.NO_INPUT.UNREACHABLE`

**PL — Surowiec odcięty.** Towar istnieje, lecz nie ma przejezdnej trasy. **Sprawdź:** Otwórz łańcuch przyczyn i wskaż dostawcę. **Naprawy:** Połącz drogi lub most.; Usuń przerwę albo niedostępny odcinek. **Łańcuch:** Piekarnia → młyn ma mąkę → brak drogi.

**EN — Supply cut off.** Goods exist, but no usable route reaches them. **Check:** Follow the cause chain to the supplier. **Fixes:** Connect roads or bridges.; Repair the broken route. **Chain:** Bakery → mill has flour → route missing.

## `status.WAITING_DELIVERY`

**PL — Dostawa w drodze.** Wóz wiezie brakujący surowiec do budynku. **Sprawdź:** Dotknij wskazanego wozu; odczytaj trasę i ETA. **Naprawy:** Poczekaj na rozładunek.; Sprawdź korek lub opóźnienie na trasie. **Łańcuch:** Piekarnia → czeka na mąkę → wóz dojeżdża.

**EN — Delivery on the way.** A wagon is bringing the missing input. **Check:** Tap the named wagon; inspect route and ETA. **Fixes:** Wait for unloading.; Inspect jams or route delays. **Chain:** Bakery → waiting for flour → wagon en route.

## `status.NO_WAGON.ALL_BUSY`

**PL — Wszystkie wozy zajęte.** Towar jest dostępny, lecz wolnego wozu brak. **Sprawdź:** Otwórz kartę budynku, potem listę wozów. **Naprawy:** Dokup wóz w stajni.; Dokończ lub skróć inne przewozy. **Łańcuch:** Tartak → deski gotowe → wszystkie wozy w kursie.

**EN — All wagons busy.** Goods are ready, but no wagon is free. **Check:** Open the building and inspect wagons. **Fixes:** Buy another wagon at the stable.; Let other journeys finish. **Chain:** Sawmill → planks ready → all wagons busy.

## `status.NO_WAGON.NONE_CAN_REACH`

**PL — Wóz nie dojedzie.** Wolne wozy istnieją, ale nie dotrą do źródła. **Sprawdź:** Sprawdź drogę od stajni do producenta. **Naprawy:** Połącz rozdzielone odcinki.; Zbuduj most lub objazd. **Łańcuch:** Drwal → drewno czeka → odcięta stajnia.

**EN — No wagon can reach.** There are free wagons, but none can reach the pickup. **Check:** Trace the road from stable to supplier. **Fixes:** Connect separated road sections.; Build a bridge or detour. **Chain:** Woodcutter → logs wait → stable isolated.

## `status.OUTPUT_FULL.NO_WAGON`

**PL — Pełny bufor — brak wozu.** Producent nie ma miejsca na kolejny towar; odbiór czeka na wóz. **Sprawdź:** Dotknij producenta; sprawdź wozy i zapas. **Naprawy:** Dokup wóz.; Poczekaj, aż wóz skończy kurs. **Łańcuch:** Tartak → pełno desek → wszystkie wozy zajęte.

**EN — Full output — no wagon.** Production is blocked; no wagon can collect output. **Check:** Tap the producer; inspect wagons and stock. **Fixes:** Buy a wagon.; Wait for a current trip to end. **Chain:** Sawmill → planks full → wagons busy.

## `status.OUTPUT_FULL.NO_DESTINATION`

**PL — Pełny bufor — brak odbiorcy.** Towar blokuje produkcję, bo nikt nie ma miejsca na dostawę. **Sprawdź:** Sprawdź spichlerze i zamówienie zamku. **Naprawy:** Postaw kolejny spichlerz.; Opróżnij odbiorcę lub otwórz drogę. **Łańcuch:** Farma → zboże zalega → spichlerz pełny.

**EN — Full output — no destination.** Production stops because no receiver has space. **Check:** Inspect granaries and the castle order. **Fixes:** Build another granary.; Free destination space or repair its road. **Chain:** Farm → grain piled up → granary full.

## `status.WAITING_PICKUP`

**PL — Odbiór zamówiony.** Bufor jest pełny, ale wóz jedzie po towar. **Sprawdź:** Dotknij przypisanego wozu; sprawdź ETA. **Naprawy:** Zaczekaj na załadunek.; Skróć trasę lub usuń zator. **Łańcuch:** Tartak → pełne deski → wóz po odbiór.

**EN — Pickup scheduled.** The buffer is full, but a wagon is on its way. **Check:** Tap the assigned wagon and check ETA. **Fixes:** Wait for collection.; Shorten its route or clear a jam. **Chain:** Sawmill → planks full → wagon inbound.

## `status.STORAGE_FULL`

**PL — Pełny spichlerz.** Nie ma miejsca na następne jednostki towaru. **Sprawdź:** Otwórz spichlerz i odczytaj stany. **Naprawy:** Postaw drugi spichlerz.; Zapewnij odbiór zalegających towarów. **Łańcuch:** Spichlerz → pełny → farma nie może oddać zboża.

**EN — Granary full.** There is no room for more goods. **Check:** Open the granary and inspect all stock. **Fixes:** Build another granary.; Deliver stored goods onward. **Chain:** Granary → full → farm cannot unload grain.

## `status.CONTRACT_DONE`

**PL — Kontrakt zamknięty.** Zamek przyjął wszystkie zamówione towary. **Sprawdź:** Otwórz list przewozowy i wynik kontraktu. **Naprawy:** Zobacz zdobyte pieczęcie.; Rozpocznij następny kontrakt. **Łańcuch:** Zamek → dostawy pełne → koniec zadania.

**EN — Contract complete.** The castle received every required good. **Check:** Open the waybill and mission result. **Fixes:** Check the seals earned.; Start another contract. **Chain:** Castle → all goods delivered → task complete.

## `wagon.IDLE`

**PL — Wóz wolny.** Wóz stoi bez przydzielonego zlecenia. **Sprawdź:** Dotknij wozu; sprawdź stan i stajnię. **Naprawy:** Sprawdź popyt na towary.; Upewnij się, że drogi są połączone. **Łańcuch:** Wóz → bez kursu → brak dostępnego zlecenia.

**EN — Wagon idle.** No delivery job is assigned to this wagon. **Check:** Tap it; inspect status and stable. **Fixes:** Check current goods demand.; Check the road connections. **Chain:** Wagon → no job → nothing to haul.

## `wagon.TO_PICKUP`

**PL — Po odbiór.** Wóz jedzie do producenta po zamówiony towar. **Sprawdź:** Dotknij wozu, sprawdź cel i ETA. **Naprawy:** Pozwól mu dojechać.; Usuń zator na drodze. **Łańcuch:** Wóz → tartak → odbiór desek.

**EN — To pickup.** The wagon is travelling to collect cargo. **Check:** Tap it and inspect destination and ETA. **Fixes:** Let it arrive.; Clear any road bottleneck. **Chain:** Wagon → sawmill → collect planks.

## `wagon.LOADING`

**PL — Załadunek.** Towar jest przenoszony na wóz. **Sprawdź:** Otwórz kartę wozu i sprawdź ładunek. **Naprawy:** Poczekaj na załadunek.; Sprawdź, czy dalsza trasa istnieje. **Łańcuch:** Wóz → tartak → ładuje deski.

**EN — Loading.** Goods are being loaded onto the wagon. **Check:** Open the wagon card and inspect cargo. **Fixes:** Wait for loading.; Check that the outgoing route exists. **Chain:** Wagon → sawmill → loading planks.

## `wagon.TO_DROPOFF`

**PL — W drodze do celu.** Wóz wiezie towar do odbiorcy. **Sprawdź:** Otwórz kartę wozu; sprawdź cargo i ETA. **Naprawy:** Pozwól mu dojechać.; Ulepsz zatłoczony trakt. **Łańcuch:** Wóz → mąka → piekarnia.

**EN — Delivering.** The wagon is carrying goods to a receiver. **Check:** Open its card; inspect cargo and ETA. **Fixes:** Let it deliver.; Improve a congested road. **Chain:** Wagon → flour → bakery.

## `wagon.UNLOADING`

**PL — Rozładunek.** Wóz przekazuje przewożony towar odbiorcy. **Sprawdź:** Otwórz kartę wozu i miejsce dostawy. **Naprawy:** Poczekaj na rozładunek.; Sprawdź wolne miejsce w magazynie. **Łańcuch:** Wóz → zamek → rozładowuje chleb.

**EN — Unloading.** The wagon is transferring cargo to a receiver. **Check:** Open the wagon and destination panels. **Fixes:** Wait for unloading.; Check receiver storage space. **Chain:** Wagon → castle → unloading bread.

## `wagon.RETURNING`

**PL — Powrót.** Wóz wraca do swojej stajni po zakończonym kursie. **Sprawdź:** Dotknij wozu i sprawdź cel. **Naprawy:** Poczekaj na powrót.; Zapewnij przejezdność do stajni. **Łańcuch:** Wóz → dostarczył deski → wraca.

**EN — Returning.** The wagon is returning to its home stable. **Check:** Tap it and inspect destination. **Fixes:** Wait for its return.; Keep the stable route connected. **Chain:** Wagon → planks delivered → heading home.

## `wagon.BRIDGE_JAM`

**PL — Zator na moście.** Ruch z przeciwka blokuje jednopasmowy most. **Sprawdź:** Dotknij wozu; odczytaj blokujący wóz. **Naprawy:** Ulepsz most do kamiennego.; Zbuduj drugi most lub objazd. **Łańcuch:** Wóz → korek → przeprawa zajęta przez przeciwny ruch.

**EN — Bridge jam.** Opposing traffic blocks the one-lane bridge. **Check:** Tap the wagon and inspect its blocker. **Fixes:** Upgrade the bridge to stone.; Build a second crossing or detour. **Chain:** Wagon → waiting → opposing traffic on bridge.

## `wagon.NO_ROUTE`

**PL — Brak trasy.** Wóz nie ma przejezdnej drogi do celu. **Sprawdź:** Dotknij wozu i sprawdź wskazany cel. **Naprawy:** Odbuduj brakujący odcinek.; Połącz drogi lub postaw most. **Łańcuch:** Wóz z mąką → brak mostu → piekarnia odcięta.

**EN — No route.** No traversable road leads to the wagon's target. **Check:** Tap the wagon and inspect its target. **Fixes:** Repair the broken road segment.; Join roads or build a bridge. **Chain:** Flour wagon → bridge missing → bakery cut off.

