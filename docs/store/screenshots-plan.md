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
| 1 | **Wolna dolina**, rzeczywisty widok rozwijanej osady: rzeka, szlaki, zamek, załadowane wozy i widoczna w HUD ranga miasta. Pokaż swobodną rozbudowę bez licznika kontraktu; trzy sloty zapisu pokaż osobno na prawdziwym ekranie wyboru, nie w fotomontażu. | Twoja dolina, Twoje miasto | Your valley, your town | textures.png; models-overview.png |
| 2 | Wybrana piekarnia i otwarty panel „Dlaczego stoi?”: konkretny brak mąki oraz łańcuch przyczyn prowadzący do młyna i przerwanej dostawy. Pokaż przyczynę, nie ogólny błąd. | Jedno dotknięcie. Znasz przyczynę | One tap reveals the cause | icons.png; icons.html |
| 3 | Zbliżenie dwóch wozów z **różnymi widocznymi ładunkami** (np. deski i zboże). Jeden wybrany: karta z towarem, celem i ETA; ładunki nie mogą zostać zasłonięte przez UI. | Wiesz, co wiezie każdy wóz | See what every wagon carries | models-overview.png; icons.png |
| 4 | **Nowe łańcuchy w Wolnej dolinie:** z rzeczywistej rozgrywki pokaż rybaka przy wodzie i/lub kamieniołom; na mapie prawdziwe dostawy kamienia do bruku lub kamiennego mostu. W ujęciach alternatywnych pokaż wypalarnię węgla drzewnego, słodownię i browar; nie dokładaj fikcyjnych elementów UI. | Nowe łańcuchy, nowe dostawy | New chains, new deliveries | textures.png; icons.png |
| 5 | Prawdziwy przestój przy jednopasmowym drewnianym moście; wybrany wóz ma status oczekiwania na przejazd. Jeśli docelowa misja 2 nie jest gotowa, ustaw odtwarzalną scenę z istniejących mechanik; nie fałszuj panelu. | Znajdź wąskie gardło | Find the bottleneck | models-overview.png; icons.png |
| 6 | List przewozowy do zamku: „30 desek, 20 chlebów”, postęp realizacji, pieczęcie i czas misji; w tle autentyczny transport. Kontrast dla czytelności tekstu na telefonie. | Kontrakty na 5–12 minut | Castle contracts in 5–12 minutes | icons.png; textures.png |

## Nowe mechaniki do udokumentowania po D-21/D-29

- **Pełna darmowa zawartość:** sześć misji (I–VI) oraz Wolna dolina, bez reklam i zakupów w aplikacji; nie stosuj nakładek sugerujących odblokowanie pełnej wersji.
- **Budowa miasta:** wolna rozgrywka z trzema lokalnymi slotami zapisu i rangami od Osady przez Wieś targową, Miasteczko, Miasto i Gród do Stolicy. Jeżeli wybór slotu nie mieści się w sześciu kadrach, przygotuj osobny autentyczny kadr rezerwowy.
- **Pięć nowych dóbr:** ryby, kamień, węgiel drzewny, słód i piwo; łańcuchy rybak → ryby, kamieniołom → kamień (bruk, kamienny most), wypalarnia → węgiel drzewny, słodownia → słód, browar → piwo. Pokazuj tylko funkcje działające w nagrywanym buildzie.
- **Weryfikacja:** sprawdź, czy dany build rzeczywiście udostępnia trzy sloty i właściwe rangi. Nie twórz inscenizowanych zrzutów przedstawiających przyszłe funkcje jako obecne.

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
- [ ] Kadry Wolnej doliny pokazują prawdziwe rangi, działające sloty zapisu i wdrożone łańcuchy produkcji.
- [ ] Materiały sklepowe nie zawierają obietnic zakupów, reklam ani odblokowania pełnej wersji.
- [ ] Po zaktualizowaniu scen sprawdzono układ na małym ekranie telefonu.
