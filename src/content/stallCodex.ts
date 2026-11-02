// Short PL/EN explanations for every building and wagon status in the in-game codex.
// Keep docs/content/stall-codex.md in sync; tests/stall-codex.test.ts verifies both files.
import type { BuildingStatus, WagonStatus } from '../sim/types';

export interface StallCodexLocale {
  name: string;
  meaning: string;
  check: string;
  fixes: readonly [string, string, string?];
  chain: string;
}

export interface StallCodexEntry {
  pl: StallCodexLocale;
  en: StallCodexLocale;
}

/** Expands each BuildingStatus.cause union into its own translation key. */
type BuildingCodexKey<S extends BuildingStatus = BuildingStatus> =
  S extends { cause: infer C extends string }
    ? `status.${S['k']}.${C}`
    : `status.${S['k']}`;

export type StallCodexKey = BuildingCodexKey | `wagon.${WagonStatus['k']}`;

// 'satisfies' enforces exhaustive, correctly spelled keys when types.ts changes.
const CONTENT = {
  "status.WORKING": {
    "pl": {
      "name": "Produkuje",
      "meaning": "Budynek właśnie wytwarza towar; trwa cykl produkcji.",
      "check": "Dotknij budynku i sprawdź pasek postępu oraz zapasy.",
      "fixes": [
        "Pozwól dokończyć bieżący cykl.",
        "Zapewnij odbiór wyrobów, zanim zapełnią magazyn."
      ],
      "chain": "Gospodarstwo produkuje zboże → młyn robi mąkę → piekarnia piecze chleb."
    },
    "en": {
      "name": "Producing",
      "meaning": "The building is making goods; its production cycle is underway.",
      "check": "Tap the building and check its progress bar and stock.",
      "fixes": [
        "Let the current cycle finish.",
        "Arrange collection before the output store fills up."
      ],
      "chain": "Farm makes grain → mill makes flour → bakery bakes bread."
    }
  },
  "status.IDLE": {
    "pl": {
      "name": "Bezczynność",
      "meaning": "Budynek nie pracuje w tej chwili; sam ten stan nie oznacza awarii.",
      "check": "Dotknij budynku i sprawdź jego typ, zapasy oraz status.",
      "fixes": [
        "Sprawdź, czy stajnia lub spichlerz ma zadanie do wykonania.",
        "Jeśli brakuje popytu, podłącz odbiorcę lub zamek."
      ],
      "chain": "Brak zamówień → stajnia bez kursów → wozy czekają."
    },
    "en": {
      "name": "Idle",
      "meaning": "The building is not active right now; this status alone is not a fault.",
      "check": "Tap the building and check its type, stock and status.",
      "fixes": [
        "Check whether the stable or granary has any work to do.",
        "If there is no demand, connect a buyer or the castle."
      ],
      "chain": "No orders → stable has no trips → wagons wait."
    }
  },
  "status.NO_ROAD": {
    "pl": {
      "name": "Brak drogi do bramy",
      "meaning": "Brama budynku nie ma przejezdnego połączenia z sąsiednią drogą.",
      "check": "Dotknij budynku i obejrzyj drogę przy jego bramie.",
      "fixes": [
        "Dorysuj drogę od bramy do traktu.",
        "Usuń przerwę lub wytycz obejście stromego terenu.",
        "Połącz trasę ze stajnią i odbiorcą."
      ],
      "chain": "Piekarnia bez drogi → brak dostaw mąki → brak chleba dla zamku."
    },
    "en": {
      "name": "No road to gate",
      "meaning": "The building gate has no drivable connection to an adjacent road.",
      "check": "Tap the building and inspect the road beside its gate.",
      "fixes": [
        "Draw a road from the gate to the network.",
        "Close any gap or route around steep ground.",
        "Connect the route to a stable and a customer."
      ],
      "chain": "Bakery has no road → flour cannot arrive → castle gets no bread."
    }
  },
  "status.NO_INPUT.NONE_AVAILABLE": {
    "pl": {
      "name": "Brak dostępnego surowca",
      "meaning": "Nie ma surowca gotowego do przydzielenia dostawy do tego budynku.",
      "check": "Dotknij budynku, potem producenta w łańcuchu; sprawdź zapasy i rezerwacje.",
      "fixes": [
        "Uruchom lub zbuduj producenta surowca.",
        "Usuń przestój wyżej w łańcuchu dostaw.",
        "Poczekaj na nową partię, jeśli produkcja trwa."
      ],
      "chain": "Piekarnia bez mąki → młyn bez zboża → gospodarstwo bez drogi."
    },
    "en": {
      "name": "No input available",
      "meaning": "No input goods are ready to be assigned for delivery to this building.",
      "check": "Tap the building, then its upstream producer; check stock and reserved goods.",
      "fixes": [
        "Start or build a producer of the missing input.",
        "Fix the stall further upstream.",
        "Wait for a fresh batch if production is underway."
      ],
      "chain": "Bakery lacks flour → mill lacks grain → farm has no road."
    }
  },
  "status.NO_INPUT.UNREACHABLE": {
    "pl": {
      "name": "Brak dojazdu do surowca",
      "meaning": "Surowiec jest u dostawcy, ale nie ma przejezdnej trasy do odbiorcy.",
      "check": "Dotknij odbiorcy, przejdź do dostawcy w łańcuchu i obejrzyj drogi między bramami.",
      "fixes": [
        "Połącz drogi dostawcy i odbiorcy.",
        "Odbuduj brakujący odcinek lub most.",
        "Wyznacz objazd wokół przeszkody."
      ],
      "chain": "Młyn ma mąkę → most do piekarni jest przerwany → piekarnia stoi."
    },
    "en": {
      "name": "Input unreachable",
      "meaning": "The supplier has the goods, but there is no drivable route to the customer.",
      "check": "Tap the customer, follow the chain to the supplier and inspect the roads between their gates.",
      "fixes": [
        "Connect the supplier and customer roads.",
        "Restore the missing road or bridge.",
        "Build a detour around the obstacle."
      ],
      "chain": "Mill holds flour → bridge to bakery is broken → bakery stalls."
    }
  },
  "status.NO_INPUT.CONTESTED": {
    "pl": {
      "name": "Surowiec jedzie do innego odbiorcy",
      "meaning": "Towar jest u dostawcy, ale wozy wiozą go do budynku innego rodzaju, który też go zużywa.",
      "check": "Dotknij budynku; w łańcuchu przyczyn widać rywala (np. tartak), do którego jedzie drewno.",
      "fixes": [
        "Postaw drugiego dostawcę tego surowca.",
        "Kup wóz, żeby oba budynki dostawały ładunki na zmianę.",
        "Rozbierz lub przenieś mniej ważnego odbiorcę."
      ],
      "chain": "Drwal ma drewno → wóz wiezie je do tartaku → węglarnia czeka."
    },
    "en": {
      "name": "Input goes to another customer",
      "meaning": "The supplier has the goods, but wagons take them to a different kind of building that also uses them.",
      "check": "Tap the building; the cause chain shows the rival (e.g. the sawmill) the wood goes to.",
      "fixes": [
        "Build a second producer of this input.",
        "Buy a wagon so both buildings get loads in turn.",
        "Demolish or move the less important customer."
      ],
      "chain": "Woodcutter has wood → wagon takes it to the sawmill → charcoal burner waits."
    }
  },
  "status.WAITING_UPSTREAM": {
    "pl": {
      "name": "Czeka na dostawcę",
      "meaning": "Dostawca jest osiągalny i wytwarza towar lub czeka na własną dostawę; ładunek nie jest jeszcze gotowy.",
      "check": "Dotknij odbiorcy, potem dostawcy w Łańcuchu przyczyn; sprawdź postęp i zapasy.",
      "fixes": [
        "Poczekaj, aż dostawca przygotuje towar.",
        "Jeśli sam czeka na dostawę, przejdź wyżej w łańcuchu przyczyn.",
        "Sprawdź, czy wozy mają dojazd do gotowego towaru."
      ],
      "chain": "Piekarnia czeka na mąkę → młyn właśnie ją produkuje → wóz odbierze mąkę."
    },
    "en": {
      "name": "Waiting for upstream supply",
      "meaning": "A reachable supplier is producing the goods or awaiting its own delivery; the cargo is not ready yet.",
      "check": "Tap the customer, then the supplier in the Cause chain; check progress and stock.",
      "fixes": [
        "Wait until the supplier has goods ready.",
        "If it is awaiting input too, follow the chain further upstream.",
        "Check that wagons can reach the goods once ready."
      ],
      "chain": "Bakery awaits flour → mill is producing it → a wagon will collect the flour."
    }
  },
  "status.WAITING_DELIVERY": {
    "pl": {
      "name": "Dostawa w drodze",
      "meaning": "Wóz ma przydzieloną dostawę surowca, która jeszcze nie dotarła.",
      "check": "Dotknij odbiorcy, potem wozu w łańcuchu; sprawdź cel i dojazd.",
      "fixes": [
        "Poczekaj na dostawę.",
        "Jeśli wóz stracił trasę, napraw drogę.",
        "Jeśli stoi przy moście, zbuduj objazd."
      ],
      "chain": "Piekarnia czeka na mąkę → wóz jedzie z młyna → piec ruszy po dostawie."
    },
    "en": {
      "name": "Delivery on the way",
      "meaning": "A wagon has been assigned the incoming input, but it has not arrived yet.",
      "check": "Tap the customer, then its wagon in the chain; check destination and ETA.",
      "fixes": [
        "Wait for the delivery.",
        "If the wagon has no route, repair the road.",
        "If it is stuck at a bridge, build a detour."
      ],
      "chain": "Bakery waits for flour → wagon drives from mill → baking resumes on delivery."
    }
  },
  "status.NO_WAGON.ALL_BUSY": {
    "pl": {
      "name": "Wszystkie wozy zajęte",
      "meaning": "Towar może zostać przewieziony, ale żaden wóz nie jest wolny.",
      "check": "Dotknij odbiorcy, potem stajni i wozów; sprawdź ich aktualne kursy.",
      "fixes": [
        "Kup dodatkowy wóz w stajni.",
        "Poczekaj na zakończenie któregoś kursu.",
        "Skróć przewozy nową drogą lub brukiem."
      ],
      "chain": "Piekarnia potrzebuje mąki → wszystkie wozy wiozą deski → dostawa czeka."
    },
    "en": {
      "name": "All wagons busy",
      "meaning": "The goods can be transported, but no wagon is free to take the job.",
      "check": "Tap the customer, then the stable and wagons; inspect their current trips.",
      "fixes": [
        "Buy another wagon at a stable.",
        "Wait until one of the current trips ends.",
        "Shorten routes with a new road or cobbles."
      ],
      "chain": "Bakery needs flour → all wagons haul planks → flour delivery must wait."
    }
  },
  "status.NO_WAGON.NONE_CAN_REACH": {
    "pl": {
      "name": "Żaden wóz nie dojedzie",
      "meaning": "Wolne wozy istnieją, ale żaden nie dotrze do miejsca odbioru towaru.",
      "check": "Dotknij odbiorcy, stajni i dostawcy; sprawdź połączenie dróg do źródła.",
      "fixes": [
        "Połącz stajnię drogą z dostawcą.",
        "Napraw odcięty most lub odcinek drogi.",
        "Postaw stajnię połączoną z dostawcą i kup wóz."
      ],
      "chain": "Młyn ma mąkę → stajnia odcięta od młyna → piekarnia nie dostaje dostawy."
    },
    "en": {
      "name": "No wagon can reach pickup",
      "meaning": "Free wagons exist, but none can reach the goods at their source.",
      "check": "Tap the customer, stable and supplier; inspect the road link to the pickup point.",
      "fixes": [
        "Connect the stable to the supplier by road.",
        "Repair the cut-off bridge or road section.",
        "Build a connected stable and buy a wagon there."
      ],
      "chain": "Mill has flour → stable is cut off from mill → bakery gets no delivery."
    }
  },
  "status.OUTPUT_FULL.NO_WAGON": {
    "pl": {
      "name": "Pełno — brak wozu",
      "meaning": "Budynek nie może produkować dalej, bo jego wyroby czekają na odbiór, a brak wozu.",
      "check": "Dotknij producenta i sprawdź zapas wyrobów; następnie otwórz stajnię.",
      "fixes": [
        "Kup wóz w połączonej stajni.",
        "Poczekaj, aż wóz skończy obecny kurs.",
        "Napraw dojazd wozów do producenta."
      ],
      "chain": "Tartak pełen desek → brak wozu do odbioru → produkcja desek staje."
    },
    "en": {
      "name": "Output full — no wagon",
      "meaning": "Production cannot continue because finished goods await pickup and no wagon can collect them.",
      "check": "Tap the producer and inspect output stock; then open the stable.",
      "fixes": [
        "Buy a wagon at a connected stable.",
        "Wait for a wagon to finish its current trip.",
        "Repair wagon access to the producer."
      ],
      "chain": "Sawmill full of planks → no wagon collects them → plank production stops."
    }
  },
  "status.OUTPUT_FULL.NO_DESTINATION": {
    "pl": {
      "name": "Pełno — nie ma dokąd wieźć",
      "meaning": "Wyroby blokują produkcję, bo brak odbiorcy lub osiągalnego spichlerza z wolnym miejscem.",
      "check": "Dotknij producenta, potem spichlerzy; sprawdź ich zapełnienie i drogi.",
      "fixes": [
        "Zbuduj i podłącz kolejny spichlerz.",
        "Zapewnij odbiorcę potrzebującego tego towaru.",
        "Połącz producenta drogą z wolnym spichlerzem."
      ],
      "chain": "Drwal ma pełno drewna → spichlerz pełny → drwal przestaje pracować."
    },
    "en": {
      "name": "Output full — no destination",
      "meaning": "Finished goods block production because no customer or reachable granary has room.",
      "check": "Tap the producer, then granaries; check their space and road access.",
      "fixes": [
        "Build and connect another granary.",
        "Provide a customer that needs these goods.",
        "Connect the producer to a granary with space."
      ],
      "chain": "Woodcutter holds too many logs → granary is full → woodcutting stops."
    }
  },
  "status.WAITING_PICKUP": {
    "pl": {
      "name": "Czeka na odbiór",
      "meaning": "Zapas wyrobów jest pełny, ale wóz już dostał zlecenie odbioru.",
      "check": "Dotknij producenta, potem wozu w łańcuchu; sprawdź, gdzie utknął.",
      "fixes": [
        "Poczekaj na przyjazd wozu.",
        "Przy korku na moście zapewnij objazd.",
        "Przy braku trasy napraw przerwę w drodze."
      ],
      "chain": "Tartak pełen desek → wóz jedzie po deski → tartak wznowi produkcję."
    },
    "en": {
      "name": "Waiting for pickup",
      "meaning": "The output store is full, but a wagon has already been assigned to collect it.",
      "check": "Tap the producer, then its wagon in the chain; check where it is.",
      "fixes": [
        "Wait for the wagon to arrive.",
        "If the bridge is jammed, provide a detour.",
        "If the route is broken, repair the road gap."
      ],
      "chain": "Sawmill full of planks → wagon drives to collect them → production resumes."
    }
  },
  "status.STORAGE_FULL": {
    "pl": {
      "name": "Spichlerz pełny",
      "meaning": "Spichlerz osiągnął limit łącznych zapasów i nie przyjmie kolejnych dostaw.",
      "check": "Dotknij spichlerza i sprawdź licznik zajętości oraz rodzaje towarów.",
      "fixes": [
        "Zbuduj kolejny spichlerz przy drodze.",
        "Połącz spichlerz z budynkami zużywającymi zapasy.",
        "Zwiększ zapotrzebowanie, uruchamiając produkcję dalej w łańcuchu."
      ],
      "chain": "Spichlerz pełen zboża → gospodarstwo nie ma gdzie oddać plonu."
    },
    "en": {
      "name": "Granary full",
      "meaning": "The granary has reached its total storage limit and cannot accept more deliveries.",
      "check": "Tap the granary and check its capacity counter and stored goods.",
      "fixes": [
        "Build another granary beside a road.",
        "Connect the granary to buildings that use its stock.",
        "Create demand by starting production further down the chain."
      ],
      "chain": "Granary is full of grain → farm has nowhere to send its harvest."
    }
  },
  "status.CONTRACT_DONE": {
    "pl": {
      "name": "Kontrakt wykonany",
      "meaning": "Zamek otrzymał zamówione towary i kontrakt został ukończony.",
      "check": "Dotknij zamku i otwórz list przewozowy z wynikiem.",
      "fixes": [
        "Nic nie naprawiaj — cel został osiągnięty.",
        "Sprawdź liczbę zdobytych pieczęci.",
        "Przejdź do kolejnej misji lub Wolnej doliny."
      ],
      "chain": "Gospodarstwo → młyn → piekarnia → chleb w zamku → kontrakt wykonany."
    },
    "en": {
      "name": "Contract fulfilled",
      "meaning": "The castle has received the requested goods and the contract is complete.",
      "check": "Tap the castle and open the waybill to see the result.",
      "fixes": [
        "No repair is needed — the goal is complete.",
        "Check how many seals you earned.",
        "Try the next mission or Free valley."
      ],
      "chain": "Farm → mill → bakery → bread reaches castle → contract fulfilled."
    }
  },
  "wagon.IDLE": {
    "pl": {
      "name": "Stoi w stajni",
      "meaning": "Wóz nie ma teraz zlecenia i zwykle czeka przy swojej stajni.",
      "check": "Dotknij wozu i sprawdź ładunek, cel oraz aktualny status.",
      "fixes": [
        "Poczekaj, aż odbiorca zgłosi potrzebę towaru.",
        "Podłącz stajnię do sieci dostaw.",
        "Sprawdź, czy u producenta są towary do odbioru."
      ],
      "chain": "Piekarnia nie zamawia mąki → wóz bez zlecenia → stoi w stajni."
    },
    "en": {
      "name": "At the stable",
      "meaning": "The wagon has no job right now and usually waits at its home stable.",
      "check": "Tap the wagon and check cargo, destination and status.",
      "fixes": [
        "Wait until a customer needs goods.",
        "Connect the stable to the supply network.",
        "Check whether a supplier has goods ready for pickup."
      ],
      "chain": "Bakery has no flour order → wagon has no job → waits at stable."
    }
  },
  "wagon.TO_PICKUP": {
    "pl": {
      "name": "Jedzie po ładunek",
      "meaning": "Wóz jest w drodze do dostawcy, aby odebrać przydzielony towar.",
      "check": "Dotknij wozu, wybierz Śledź wóz i sprawdź jego cel oraz dojazd.",
      "fixes": [
        "Poczekaj, jeśli wóz jedzie prawidłowo.",
        "Wybrukuj długi lub błotnisty odcinek.",
        "Gdy pojawi się brak trasy, odbuduj drogę."
      ],
      "chain": "Wóz jedzie do młyna → ładuje mąkę → dostarcza ją do piekarni."
    },
    "en": {
      "name": "Going to pickup",
      "meaning": "The wagon is travelling to the supplier to collect assigned goods.",
      "check": "Tap the wagon, choose Follow wagon and check destination and ETA.",
      "fixes": [
        "Wait if the wagon is moving normally.",
        "Pave long or muddy sections with cobbles.",
        "If the route fails, repair the broken road."
      ],
      "chain": "Wagon goes to mill → loads flour → delivers it to bakery."
    }
  },
  "wagon.LOADING": {
    "pl": {
      "name": "Załadunek",
      "meaning": "Wóz stoi u dostawcy i ładuje towar przed dalszą drogą.",
      "check": "Dotknij wozu i sprawdź status Załadunek oraz budynek źródłowy.",
      "fixes": [
        "Poczekaj na zakończenie załadunku.",
        "Sprawdź, czy dostawca ma zapas towaru.",
        "Nie rozbieraj źródła lub bramy podczas kursu."
      ],
      "chain": "Młyn ma mąkę → wóz ładuje mąkę → rusza do piekarni."
    },
    "en": {
      "name": "Loading",
      "meaning": "The wagon is at the supplier, loading goods before the delivery leg.",
      "check": "Tap the wagon and check Loading status and the source building.",
      "fixes": [
        "Wait for loading to finish.",
        "Check that the supplier has stock available.",
        "Do not demolish the source or gate during the trip."
      ],
      "chain": "Mill has flour → wagon loads flour → heads to bakery."
    }
  },
  "wagon.TO_DROPOFF": {
    "pl": {
      "name": "Wiezie ładunek",
      "meaning": "Wóz przewozi odebrany towar do wskazanego odbiorcy.",
      "check": "Dotknij wozu; sprawdź Ładunek, Cel i czas dostawy.",
      "fixes": [
        "Poczekaj, aż dojedzie do odbiorcy.",
        "Wybrukuj trasę, jeśli często się opóźnia.",
        "Napraw przerwaną drogę, jeśli zgłosi brak trasy."
      ],
      "chain": "Wóz z mąką → piekarnia dostaje mąkę → produkcja chleba rusza."
    },
    "en": {
      "name": "Delivering cargo",
      "meaning": "The wagon is carrying collected goods to the assigned customer.",
      "check": "Tap the wagon; check Cargo, Destination and delivery ETA.",
      "fixes": [
        "Wait for it to reach the customer.",
        "Pave the route if deliveries are often slow.",
        "Repair any broken road if No route appears."
      ],
      "chain": "Wagon carries flour → bakery receives it → bread production starts."
    }
  },
  "wagon.UNLOADING": {
    "pl": {
      "name": "Rozładunek",
      "meaning": "Wóz dotarł do odbiorcy i przekazuje mu przewożony towar.",
      "check": "Dotknij wozu, potem docelowego budynku; obserwuj zmianę zapasów.",
      "fixes": [
        "Poczekaj na koniec rozładunku.",
        "Sprawdź, czy towar trafił do odbiorcy.",
        "Jeśli łańcuch nadal stoi, otwórz status odbiorcy."
      ],
      "chain": "Wóz rozładowuje zboże → młyn dostaje surowiec → rusza produkcja mąki."
    },
    "en": {
      "name": "Unloading",
      "meaning": "The wagon has reached its customer and is transferring its cargo.",
      "check": "Tap the wagon, then its destination building; watch the stock change.",
      "fixes": [
        "Wait for unloading to finish.",
        "Check that the customer received the goods.",
        "If the chain still stalls, inspect the customer's status."
      ],
      "chain": "Wagon unloads grain → mill receives input → flour production starts."
    }
  },
  "wagon.RETURNING": {
    "pl": {
      "name": "Wraca do stajni",
      "meaning": "Wóz zakończył dostawę i jedzie z powrotem do swojej stajni.",
      "check": "Dotknij wozu i sprawdź trasę powrotną oraz stan ładunku.",
      "fixes": [
        "Poczekaj na powrót, jeśli droga jest drożna.",
        "Połącz stajnię krótszą drogą z resztą sieci.",
        "Napraw trasę, jeśli wóz zgłosi brak dojazdu."
      ],
      "chain": "Wóz oddaje chleb w zamku → wraca do stajni → czeka na następny kurs."
    },
    "en": {
      "name": "Returning to stable",
      "meaning": "The wagon has finished its delivery and is travelling back to its home stable.",
      "check": "Tap the wagon and check its return route and cargo.",
      "fixes": [
        "Wait if its route is clear.",
        "Give the stable a shorter connection to the network.",
        "Repair the road if the wagon reports No route."
      ],
      "chain": "Wagon drops bread at castle → returns to stable → waits for next job."
    }
  },
  "wagon.BRIDGE_JAM": {
    "pl": {
      "name": "Korek na moście",
      "meaning": "Wóz czeka przed drewnianym mostem na przejazd innych wozów.",
      "check": "Dotknij wozu, przejdź do blokującego wozu w łańcuchu i obejrzyj most.",
      "fixes": [
        "Poczekaj, aż zwolni się przejazd.",
        "Zbuduj drugi most lub trasę objazdową.",
        "Rozważ kamienny most, by usunąć ograniczenie ruchu."
      ],
      "chain": "Dwa wozy jadą z przeciwnych stron → jeden czeka przy moście → dostawa się opóźnia."
    },
    "en": {
      "name": "Bridge traffic jam",
      "meaning": "The wagon is waiting at a wooden bridge for other traffic to clear.",
      "check": "Tap the wagon, follow the blocking wagon in its chain and inspect the bridge.",
      "fixes": [
        "Wait until the crossing clears.",
        "Build a second bridge or a detour.",
        "Consider a stone bridge to remove the traffic restriction."
      ],
      "chain": "Two wagons approach from opposite sides → one waits at bridge → delivery is delayed."
    }
  },
  "wagon.BRIDGE_CLOSED": {
    "pl": {
      "name": "Most skuty lodem",
      "meaning": "Kra zamknęła drewniany most; wóz czeka przy przyczółku do odwilży, ładunek i zlecenie zostają.",
      "check": "Dotknij wozu: zobaczysz, do której godziny most jest zamknięty. Kamienny most lód omija.",
      "fixes": [
        "Przed zamknięciem zgromadź zapas w spichlerzu po drugiej stronie rzeki.",
        "Zamień przęsło na kamienne — lód zamyka tylko drewniane mosty.",
        "Poczekaj do odwilży; potem wozy ruszą same."
      ],
      "chain": "Wóz z drewnem → most skuty lodem do 08:00 → tartak bez drewna → zamek bez desek."
    },
    "en": {
      "name": "Bridge closed by ice",
      "meaning": "Ice has closed the wooden bridge; the wagon waits at the bridgehead until the thaw and keeps its cargo and job.",
      "check": "Tap the wagon to see until when the bridge is closed. Stone bridges are not affected.",
      "fixes": [
        "Before the closure, stock a granary on the far bank of the river.",
        "Rebuild the span in stone — ice only closes wooden bridges.",
        "Wait for the thaw; wagons then continue on their own."
      ],
      "chain": "Wagon with wood → bridge iced until 08:00 → sawmill without wood → castle without planks."
    }
  },
  "wagon.NO_ROUTE": {
    "pl": {
      "name": "Brak drogi do celu",
      "meaning": "Wóz nie ma przejezdnej trasy do dostawcy, odbiorcy lub swojej stajni.",
      "check": "Dotknij wozu; sprawdź Cel, łańcuch przyczyn i drogę między punktami.",
      "fixes": [
        "Odbuduj brakujący odcinek lub most.",
        "Połącz siecią dróg bramy źródła, celu i stajni.",
        "Gdy zniknął odbiorca, zapewnij inny osiągalny punkt dostawy."
      ],
      "chain": "Wóz z mąką → most rozebrany → piekarnia bez dostawy → brak chleba w zamku."
    },
    "en": {
      "name": "No route",
      "meaning": "The wagon has no drivable route to its supplier, customer or home stable.",
      "check": "Tap the wagon; check Destination, its cause chain and roads between endpoints.",
      "fixes": [
        "Restore the missing road or bridge.",
        "Connect the source, customer and stable gates.",
        "If the customer is gone, provide another reachable destination."
      ],
      "chain": "Wagon carries flour → bridge removed → bakery lacks input → castle gets no bread."
    }
  }
} as const satisfies Record<StallCodexKey, StallCodexEntry>;

// The string index signature supports looking up a status key built at runtime.
export const STALL_CODEX: Record<string, StallCodexEntry> = CONTENT;
