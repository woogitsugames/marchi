# Kronika doliny / Valley Chronicle

Wpisy dotyczą wyłącznie Wolnej doliny (`sandbox`). Każdy `id` odpowiada warunkowi danych w
`src/sim/proposals/chronicle.ts`. Tytuły mają najwyżej 32 znaki, zdania najwyżej 90 znaków
(wliczając spacje i interpunkcję). Nie ma nagród w srebrze ani terminów wykonania.

| ID | Tytuł PL | Zdanie PL | Title EN | Chronicle sentence EN |
| --- | --- | --- | --- | --- |
| `planks_at_market` | Deski u bram zamku | Zapisano, iż pierwsze deski dotarły na zamkowy targ. | Planks at the castle | The first planks reached the castle market, as the ledger records. |
| `two_forest_goods` | Dwa dary puszczy | Kronikarz spisał handel drewnem i deskami przy jednym targu. | Two gifts of the forest | The scribe recorded both timber and planks sold at the castle. |
| `third_wagon` | Trzeci wóz w drodze | Do taboru przybył trzeci wóz, gdy deski miały już zbyt. | The third wagon | A third wagon joined the train, and planks were known to the market. |
| `another_woodcutter` | Nowa drwalnia | Postawiono nową drwalnię, a deski nadal sprzedawano u zamku. | Another woodcutter | A new woodcutter's hut rose while planks found buyers at the keep. |
| `grain_at_market` | Pierwsze zboże | Nowe pole wydało ziarno, które kupcy nabyli pod zamkiem. | First grain | A new farm sent its grain to merchants beneath the castle walls. |
| `grain_wagonload` | Sześć miar zboża | Sześć miar zboża wpisano do rachunków zamkowego targu. | Six measures of grain | Six measures of grain were entered in the castle's market ledger. |
| `market_village` | Wieś targowa | Wieś targową wzniósł handel, któremu służą drogi i wozy. | Market village | The roads and wagons brought the valley to the rank of market village. |
| `mill_turns` | Koło młyńskie | Młyn stanął, a pierwszą mąkę wpisano do ksiąg doliny. | The mill wheel | A mill was raised and its first flour entered the valley records. |
| `flour_at_market` | Mąka u zamku | Mąka znalazła nabywcę pod zamkowymi murami. | Flour at the keep | Flour found a buyer beneath the walls of the keep. |
| `oven_fires` | Piec rozpalony | Nowa piekarnia wypiekła chleb, a piec już nie stał pusty. | The oven is lit | A new bakery fired its oven and made its first loaves of bread. |
| `bread_at_market` | Chleb na targu | Zamkowi kupcy nabyli pierwszy chleb z dolinnych pieców. | Bread at market | Castle merchants bought the first bread from the valley ovens. |
| `three_grain_stages` | Trzy postacie zboża | Ziarno, mąkę i chleb zapisano w księgach zamkowego handlu. | Grain in three forms | Grain, flour and bread all entered the castle's market ledgers. |
| `five_wagons` | Pięć zaprzęgów | Pięć wozów wozi towary, a kupcy znają już dwa ich rodzaje. | Five wagons on the road | Five wagons serve a market already trading in two kinds of goods. |
| `second_sawmill` | Drugi tartak | Drugi tartak stanął w dolinie, gdzie sprzedano już dwanaście desek. | Another sawmill | A further sawmill rose where twelve planks had found buyers. |
| `working_granary` | Nowy spichlerz | W nowym spichlerzu odłożono towar na dalszą drogę. | A working granary | Goods were laid in a new granary before their onward journey. |
| `diverse_flow` | Trzy dobra w obrocie | Trzy rodzaje dóbr i wartki obrót srebra zapełniły księgi. | Three goods in trade | Three kinds of goods and a steady silver flow filled the ledgers. |
| `small_town` | Miasteczko | Dolina doczekała rangi miasteczka dzięki targowi i szlakom. | The small town | Trade roads and markets raised the valley to the rank of small town. |
| `fish_at_market` | Połów dla zamku | Rybak osiadł przy wodzie, a jego połów sprzedano u zamku. | Fish for the keep | A fisher settled by the water and sold his catch at the keep. |
| `stone_at_market` | Kamień ze wzgórz | Otworzono kamieniołom, a kamień nabyli zamkowi kupcy. | Stone from the hills | A quarry was opened and castle merchants bought its stone. |
| `stone_paved_road` | Brukowany trakt | Kamień trafił na targ, a cztery odcinki drogi otrzymały bruk. | The cobbled road | Stone reached the market, and four stretches of road received cobbles. |
| `four_goods_flow` | Targ czterech dóbr | Cztery dobra i wartki obrót zapełniły księgi kupieckie. | The four-goods market | Four goods and a brisk trade filled the merchants' ledgers. |
| `winter_bread_record` | Zimowa karta kroniki | Gdy nadeszła zima, w księgach targu zapisany był już chleb. | A winter entry | When winter came, bread was already recorded in the market ledger. |
| `town_rank` | Miasto | Targowe szlaki wyniosły dolinę do rangi miasta. | The town | Trading roads raised the valley to the rank of a town. |
| `charcoal_at_market` | Węgiel z mielerza | Z nowej mielerni węgiel drzewny powędrował na targ. | Charcoal from the kiln | Charcoal from a new burner reached the merchants' stalls. |
| `malt_at_market` | Słód z doliny | W nowej słodowni powstał słód, który doszedł do kupców. | Malt of the valley | A new malthouse made malt, and the merchants bought it. |
| `wood_for_two_trades` | Drewno dla dwóch cechów | Deski i węgiel drzewny stanęły w kupieckich rachunkach obok siebie. | Wood for two trades | Planks and charcoal stood side by side in the merchants' accounts. |
| `stronghold_rank` | Gród | Handel i drogi niosły dolinę do rangi grodu. | The stronghold | Trade and well-kept roads raised the valley to a stronghold. |
| `brewery_brews` | Pierwsze warzenie | W nowym browarze uwarzono piwo ze słodu dowiezionego wozem. | The first brewing | A new brewery made beer from malt carried in by wagon. |
| `beer_at_market` | Piwo dla zamku | Pierwsze piwo znalazło nabywcę na zamkowym targu. | Beer for the castle | The first beer found a buyer at the castle market. |
| `seven_trade_goods` | Siedem towarów | Siedem rodzajów dóbr zasiliło targ, gdy obrót nabrał tempa. | Seven kinds of goods | Seven kinds of goods reached market as the trade grew swift. |

## Zakres danych / Data limits

- `sold` oznacza skumulowaną sprzedaż na zamkowym targu; `produced` obejmuje też zasób
  startowy, dlatego progi produkcji dotyczą wyłącznie mąki, chleba i piwa, których sandbox
  nie otrzymuje na starcie.
- `built` rozpoznaje budynki postawione przez gracza (`placedTick >= 0`), a `stocked` wymaga
  obecności towaru w nowym, nadal istniejącym magazynie. Rozebrana budowla nie jest dowodem.
- `road` rozpoznaje bruk (surface 2), **nie** dowodzi budowy kamiennego mostu. `season`
  rozpoznaje bieżącą porę roku, **nie** dowodzi zimy bez przestojów.
- Nie nazywamy żadnego wpisu „100 desek w jednym roku” ani „zima bez zamkniętego mostu”:
  takie zdarzenia wymagają historii okresowej, której obecny stan nie zawiera.
- Otrzymane identyfikatory powinny być przechowywane poza funkcją kontrolną, razem z
  zapisem gry lub w osobnym, wersjonowanym indeksie kroniki. Funkcja nie zmienia `SimState`.

## Propozycje późnej doliny / Proposed late-valley entries

Teksty do wdrożenia przez koordynatora, nie istniejące jeszcze warunki ani klucze.
Tytuł ≤32, zdanie ≤90 znaków. Warunki poniżej opisują wymagane fakty: przed
wdrożeniem trzeba dodać odpowiednie dane i trwałe oznaczenie już pokazanych wpisów.
`stronghold_rank` istnieje powyżej — proponowana alternatywa nie powinna go dublować.

| ID | Warunek proponowany | Tytuł PL | Zdanie PL | Title EN | Chronicle sentence EN |
| --- | --- | --- | --- | --- | --- |
| `post_first_sale` | pierwsza sprzedaż w posterunku | Pierwszy handel za rzeką | W księdze posterunku zapisano pierwszą sprzedaż. | First trade across the river | The post's ledger recorded its first sale. |
| `post_three_goods` | sprzedano trzy rodzaje towaru w posterunku | Trzy towary za wodą | Trzy rodzaje towaru znalazły nabywców przy posterunku. | Three goods across the water | Three kinds of goods found buyers at the trading post. |
| `frozen_bridge` | most rzeczywiście zamarzł | Lód na przeprawie | Mróz zamknął przeprawę, a wozy czekały na odwilż. | Ice on the crossing | Frost closed the crossing, and wagons waited for the thaw. |
| `bridge_thaw` | most po zamarznięciu znów przejezdny | Odwilż na trakcie | Po odwilży wozy znów ruszyły przez przeprawę. | Thaw on the road | After the thaw, wagons crossed the river again. |
| `stronghold_rank_alt` | alternatywa istniejącego `stronghold_rank`, ranga 4 | Gród nad szlakami | Drogi i handel wyniosły dolinę do rangi grodu. | Stronghold of the roads | Roads and trade raised the valley to the rank of stronghold. |
| `capital_rank` | osiągnięcie rangi 5 | Stolica doliny | Zapisano, że dolina dostąpiła rangi stolicy. | Capital of the valley | The ledger records the valley's rise to the rank of capital. |
| `flow_record` | nowy trwały rekord przepływu dla ustalonego okna | Rekord obrotu | Kupcy zapisali nowy rekord obrotu doliny. | A record of trade | Merchants recorded a new high for the valley's trade. |
| `post_connected` | posterunek ma przejezdne połączenie drogowe | Droga do posterunku | Trakt połączył posterunek z siecią dróg doliny. | Road to the post | A track joined the trading post to the valley road network. |

Nie wyzwalać wpisów o lodzie samą porą roku ani rekordu pojedynczym odczytem:
wymagają historii zdarzeń, definicji jednostki i okna pomiaru. Sprzedaż posterunku
musi być oddzielona od zamkowego `sold`. Stan drogi należy sprawdzać na żywym grafie.
