# MARCHIA — plan 6 zrzutów do Google Play i App Store

## Stan materiałów źródłowych

W katalogu docs/shots/ znajdują się **materiały referencyjne**, a nie sześć gotowych ekranów rozgrywki:

- **models-overview.png** — odniesienie dla modeli budynków i wozów; kontrola czytelności ładunku i skali.
- **textures.png** — odniesienie dla błota, bruku, kamienia, strzechy i jesiennej palety.
- **icons.png** i **icons.html** — odniesienie dla autorskich ikon towarów, statusów i narzędzi (styl drzeworytu).

Zrzuty poniżej należy wykonać **z prawdziwej wersji gry** po doprowadzeniu wskazanych scen do czytelnego stanu. Nie należy przedstawiać arkusza ikon, tekstur ani makiety jako screenshotu rozgrywki.

## Kolejność, ujęcia i podpisy

| Nr | Co pokazać na zrzucie | Podpis PL | Caption EN | Odniesienie w docs/shots/ |
| --- | --- | --- | --- | --- |
| 1 | Szeroki kadr doliny w późnojesiennym świetle: rzeka, dwa brzegi, szlaki, tartak i zamek, na drodze załadowany wóz. Minimalny HUD, ale widoczny cel dostawy. | Dolina żyje dzięki szlakom | Roads keep the valley moving | textures.png; models-overview.png |
| 2 | Wybrana piekarnia i otwarty panel „Dlaczego stoi?”: konkretny brak mąki oraz łańcuch przyczyn prowadzący do młyna i przerwanej dostawy. Pokaż przyczynę, nie ogólny błąd. | Jedno dotknięcie. Znasz przyczynę | One tap reveals the cause | icons.png; icons.html |
| 3 | Zbliżenie dwóch wozów z **różnymi widocznymi ładunkami** (np. deski i zboże). Jeden wybrany: karta z towarem, celem i ETA; ładunki nie mogą zostać zasłonięte przez UI. | Wiesz, co wiezie każdy wóz | See what every wagon carries | models-overview.png; icons.png |
| 4 | Gracz wytycza trasę i przeprawę przez rzekę: różnica między gruntowym traktem a brukiem, widoczny most i koszt budowy w UI. Kadruj tak, aby droga była główną linią obrazu. | Buduj drogi i mosty | Build roads and bridges | textures.png; icons.png |
| 5 | Prawdziwy przestój przy jednopasmowym drewnianym moście; wybrany wóz ma status oczekiwania na przejazd. Jeśli docelowa misja 2 nie jest gotowa, ustaw odtwarzalną scenę z istniejących mechanik; nie fałszuj panelu. | Znajdź wąskie gardło | Find the bottleneck | models-overview.png; icons.png |
| 6 | List przewozowy do zamku: „30 desek, 20 chlebów”, postęp realizacji, pieczęcie i czas misji; w tle autentyczny transport. Kontrast dla czytelności tekstu na telefonie. | Kontrakty na 5–12 minut | Castle contracts in 5–12 minutes | icons.png; textures.png |

## Wskazówki do przygotowania

1. **Hierarchia:** 1 — rozpoznawalny świat; 2 — główny wyróżnik (diagnoza); 3 — widoczny ładunek; 4 — budowa; 5 — problem do rozwiązania; 6 — cel i krótkie sesje.
2. **Jeden komunikat na obraz:** na każdym zrzucie pokaż realne UI lub obiekt potwierdzający podpis. Żadnych nieistniejących funkcji ani obietnic rozgrywki w statycznym montażu.
3. **Kadry:** zacznij od portretu telefonu; sprawdź też landscape i foldable. Projektowe punkty odniesienia to 412×915, 915×412 i 904×1000 CSS px (docs/UI_STYLE.md i CLAUDE.md). Finalny eksport powinien spełniać wymagania rozdzielczości i proporcji konkretnego sklepu.
4. **Napisy:** podpisy PL i EN traktuj jako krótkie nakładki oddzielone od HUD, bez zasłaniania przyczyny przestoju, ładunku, trasy ani pieczęci. Utrzymaj zapas przy krawędziach i czytelność przy pomniejszeniu.
5. **Spójność:** zachowaj paletę późnej jesieni, mokre drogi, mgłę, drewno i pergamin, bez pastelowego efektu dioramy. Ikony towarów odróżniaj kształtem, nie samym kolorem.
6. **Lokalizacja i stan gry:** przygotuj osobne zrzuty z interfejsem PL i EN. Przed wykonaniem #5 upewnij się, że korek na moście i panel statusu działają w tej kompilacji. #6 sfotografuj w misji z rzeczywistym kontraktem, nie w wolnej dolinie.

## Lista kontrolna publikacji

- [ ] Sześć oryginalnych kadrów rozgrywki w obu językach, w wymaganych przez sklepy rozmiarach.
- [ ] Nie ma elementów z debugowania, placeholderów, testowych ikon ani tekstów niespójnych z aktualnym buildem.
- [ ] Podpisy mieszczą się w limicie **40 znaków na język**.
- [ ] UI, widoczne ładunki i powody przestojów odpowiadają aktualnym mechanikom.
- [ ] Po zaktualizowaniu scen sprawdzono układ na małym ekranie telefonu.
