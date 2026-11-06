# Kronika doliny — propozycje późnej doliny (rangi 4–5, posterunek)

Wydzielone z `docs/content/chronicle.md`: testy treści czytają tam każdy wiersz tabeli jako wdrożony
szablon/wpis. Tutaj tylko propozycje do wdrożenia przez koordynatora.


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
