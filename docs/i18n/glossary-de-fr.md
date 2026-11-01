# Marchia — słowniczek lokalizacji niemieckiej i francuskiej

Źródło kluczy: `src/i18n/pl.ts` (`Dict`), referencja znaczeniowa: `src/i18n/en.ts`.
Pliki robocze: `src/i18n/de.ts` i `src/i18n/fr.ts`.
Zachowujemy nazwy kluczy, rzeczowy ton gry strategicznej i lekko średniowieczne słownictwo bez archaizmów.

## Zasoby

| Polski | Niemiecki (DE) | Francuski (FR) | Uwaga |
| --- | --- | --- | --- |
| drewno / kłody | **Baumstämme** | **troncs** | Surowiec z chaty drwala, trafia do tartaku; nie opał |
| deski | **Bretter** | **planches** | Produkt tartaku, używany w kontrakcie |
| zboże | **Getreide** | **grain** | Surowiec gospodarstwa, przetwarzany w młynie |
| mąka | **Mehl** | **farine** | Produkt młyna |
| chleb | **Brot** | **pain** | Produkt piekarni |
| zapasy / stan magazynu | **Vorrat / Lagerbestand** | **stock** | Towar dostępny; może być oddzielnie zarezerwowany |
| ładunek | **Ladung** | **cargaison** | Zawartość przewożona przez wóz |

Dla każdego dobra istnieją trzy klucze: `good.*`, `goodGen.*` i `goodAcc.*`.
W DE i FR mają tę samą postać leksykalną. **Nie usuwać kluczy odmiany**: `src/ui/format.ts` przekazuje równolegle `{good}`, `{goodGen}` i `{goodAcc}`. Szablony statusów zbudowano tak, żeby działały bez polskiej odmiany przez przypadki, również dla mnogich *Bretter / planches* oraz niepoliczalnych *Mehl / farine*.

## Budynki

| Polski | DE | FR |
| --- | --- | --- |
| chata drwala | Holzfällerhütte | Cabane du bûcheron |
| tartak | Sägewerk | Scierie |
| gospodarstwo | Bauernhof | Ferme |
| młyn wodny | Wassermühle | Moulin à eau |
| piekarnia | Bäckerei | Boulangerie |
| spichlerz | Kornspeicher | Grenier |
| stajnia | Stall | Écurie |
| zamek | Burg | Château |
| brama budynku | Gebäudetor | porte du bâtiment |

*Spichlerz* pozostaje tak nazwany, mimo że symulacja pozwala składować w nim także inne towary. Nie zmieniać identyfikatora technicznego `warehouse`.

## Drogi, logistyka i interfejs

| Polski | DE | FR | Użycie |
| --- | --- | --- | --- |
| Marchia — Szlaki Królestwa | Marchia — Wege des Königreichs | Marchia — Les routes du royaume | Tytuł i podtytuł |
| droga | Straße | route | Narzędzie budowy |
| bruk | Pflaster | pavés | Nawierzchnia odporna na błoto |
| most drewniany | Holzbrücke | pont en bois | Podgląd budowy |
| most kamienny | Steinbrücke | pont en pierre | Podgląd budowy |
| pole mapy | Feld / Felder | case / cases | Jednostka długości drogi |
| wóz | Wagen | chariot | Pojazd przewożący towary |
| odbiór | Abholung | collecte | Pobranie od producenta |
| dostawa | Lieferung | livraison | Dostarczenie do odbiorcy |
| załadunek | Beladung | chargement | Stan wozu |
| rozładunek | Entladung | déchargement | Stan wozu |
| prędkość wozu | Geschwindigkeit | vitesse | Rzeczywista prędkość względna |
| tempo gry | Tempo | vitesse du jeu | Przyspieszanie symulacji ×1/×2/×4 |
| bezczynność | Inaktiv | inactivité | Brak aktywnej pracy, niekoniecznie awaria |
| przestój | Stillstand | blocage / arrêt | Praca zatrzymana z konkretną przyczyną |
| łańcuch przyczyn | Ursachenkette | chaîne des causes | Diagnostyka budynków i wozów |
| ruch / natężenie | Verkehr | circulation | Nakładka drogowa |
| srebro | Silber | argent | Waluta; nie zastępować złotem |
| kontrakt / zlecenie | Auftrag | contrat | Cel rozgrywki |
| list przewozowy | Frachtbrief | lettre de voiture | Rozwijany dokument w HUD |
| pieczęć | Siegel | sceau | Wynik zadania |
| wolna dolina | Freies Tal | Vallée libre | Swobodny tryb bez terminu |

## Ustalony sens najważniejszych statusów

- **Brak dostępnych zapasów**: nie wynika z niego, że surowca nigdy nie wyprodukowano. DE: *Kein verfügbarer Vorrat*; FR: *Aucun stock disponible*.
- **Towar jest, ale nie ma dojazdu**: trzeba odróżnić niedostępność drogową od wyczerpania zapasów. DE: *Vorrat ohne Straßenzugang*; FR: *Stock sans accès routier*.
- **Nie ma wolnego wozu** i **żaden wolny wóz nie dociera do miejsca odbioru** to dwa różne stany (`ALL_BUSY` / `NONE_CAN_REACH`).
- **Oczekiwanie na odbiór** oznacza przypisanie wozu, nie gwarantuje, że już jedzie. DE: *Abholung: Wagen …*; FR: *collecte : chariot …*.
- **Zator na moście**: blokujący wóz może jechać lub czekać. Nie pisać, że na pewno przejeżdża.
- **Limit wozów** jest globalny, a nie limitem miejsca w pojedynczej stajni.
- **{pct}% prędkości** to pozostała prędkość względem warunków normalnych. „55%” oznacza 55% prędkości, a nie spadek o 55%. Błoto występuje podczas deszczu na drogach gruntowych; bruk pomaga.
- **ETA** (`wagon.eta` / `wagon.etaFinish`) to czas pozostały, nie godzina przyjazdu.

## Placeholdery i długość na telefonie

1. Zachować nazwy parametrów dokładnie: `{good}`, `{goodGen}`, `{goodAcc}`, `{wagon}`, `{blocker}`, `{target}`, `{id}`, `{pct}`, `{time}`, `{grade}`, `{max}`, `{need}`, `{have}`, `{n}`, `{what}`, `{q}`, `{cells}`.
2. Główne etykiety przycisków powinny mieć maksymalnie **28 znaków**; osobne opisy wielowierszowych kafli misji, komunikaty diagnostyczne i etykiety dostępności nie mają takiego limitu.
3. `unit.cell.one/few/many` pozostają trzema kluczami, mimo że DE i FR mają tylko dwie formy (liczba pojedyncza/mnoga). Zapewnia to zgodność z istniejącym `cellsWord()`.
4. Automatyczna kontrola: `npm test -- i18n-de-fr` uruchamia test kluczy, placeholderów i długości przycisków. Po rejestracji języków zalecany jest również test renderowania na ekranach 412×915 i 915×412.

## Rejestracja — poza zakresem tego zlecenia

Zgodnie ze zleceniem **nie modyfikowano** `src/i18n/index.ts`.
Po scaleniu trzeba w nim dodać importy `de` i `fr`, rozszerzyć typ `Lang` i mapę `dicts`. Dodatkowo logika `detectLang()` sprawdza obecnie tylko `pl/en`, a menu języków w `src/ui/menu.ts` wymienia wyłącznie te dwie opcje. **Bez rozszerzenia tych miejsc DE i FR nie będą dostępne z interfejsu ani odtwarzane z zapisanego wyboru.**

Ponieważ `pl.ts` nie zawiera kluczy `lang.de` ani `lang.fr`, nowym słownikom nie dodawano pozasystemowych kluczy. Przy rozszerzaniu menu można użyć etykiet własnych języków „Deutsch” i „Français” albo osobno dodać oba klucze do wszystkich słowników.
