# Przegląd nazw dostępnych dla czytnika — częściowy

Baza `b020c577`. Przegląd statyczny tekstów PL/EN i miejsc ich użycia;
nie wykonano ręcznego odsłuchu VoiceOver/TalkBack ani testu wszystkich ekranów.
Nie oznaczać zadania jako zakończonego do czasu tych prób i pełnego przeglądu
etykiet przycisków.

| Miejsce | Wynik / działanie |
| --- | --- |
| `pin.worst`, `pin.critical`, `pin.stood` | `markers.ts` wstawia nazwę obiektu z przyczyną, stopień i czas. Doprecyzowano w PL, że czas dotyczy przestoju, a w EN poprawiono „stalled for”. |
| `hud.stallsNext` | W PL doprecyzowano, że `{n}` oznacza liczbę przestojów, a przycisk pokazuje kolejny. EN już wyjaśnia liczbę i działanie. |
| `hud.worstShow`, `neck.show` | Przekazują nazwę lub funkcję wskazania; przedmiot trafia do `hud.worstShow` jako `{name}`. Potwierdzić w czytniku, czy po nawigacji rzeczywiście jest jasne, gdzie się znaleźć. |
| `menu.bestAria` | Liczba pieczęci i czas są podawane jako część nazwy pozycji misji. Zweryfikować na urządzeniu sposób odczytu czasu `mm:ss`. |
| Pasek pojemności w `panels.ts` | Etykieta to samo `held/cap`, bez nazwy i jednostki. Samą zmianą tekstu i18n nie można jej naprawić: wymaga zmiany UI, poza zakresem zlecenia. |
| Przyciski ikoniczne HUD | Część korzysta z etykiet narzędzi, wybrany jest stan `aria-pressed`; wymagany rzeczywisty przegląd wszystkich kontekstów, kolejności i powtarzanych komunikatów. |

Na tej bazie w słownikach brak kluczy `aria.*` i `hud.*Aria`; istnieje
`menu.bestAria`. Raport `tools/i18n-coverage.ts`: 683 klucze, 0 brakujących
w 15 pozostałych językach, 0 rozbieżnych placeholderów. To kontrola obecności,
nie dowód jakości przekładu. Nie dodawano kluczy ani fikcyjnych tłumaczeń.

**Do ukończenia:** odsłuch PL/EN z TalkBack i VoiceOver, sprawdzenie pozostałych
przycisków oraz wymowy wartości zegara; przekazać poprawki wymagające kodu UI
koordynatorowi, a następnie sprawdzić zmieniony widok. Nie gwarantować zgodności
z normą dostępności na podstawie tego przeglądu.
