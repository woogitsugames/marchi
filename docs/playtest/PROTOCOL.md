# Protokół playtestu: „Dlaczego stoi?” w mniej niż 30 sekund

**Wersja:** 1.0 · **Gra:** Marchia · **Urządzenie:** Android, APK debug · **Misje:** I–III

## Hipoteza i warunki zaliczenia

Gracz bez podpowiedzi prowadzącego potrafi **prawidłowo wskazać źródłową przyczynę przestoju** w czasie **< 30 s** liczonym od pytania. Sukces nie oznacza samego otwarcia karty ani domyślenia się „brak drogi”: odpowiedź musi dotyczyć konkretnego obiektu i zależności. Osobno mierzymy skuteczność diagnozy i skuteczność naprawy.

**Plan:** 5–8 osób (minimum: 2 grające w strategie, 2 casual mobile, 1–2 osoby niegrające; dodatkowe osoby według dostępności). Nie instruować o mechanice przed próbą. Telefon pionowo, opcjonalnie drugi przebieg na składanym ekranie. Przy każdym uczestniku zapisać rozmiar, ustawienie systemowego tekstu i wersję APK. **25 min/os.**: 2 min zgoda, 3 min orientacja, 15 min sześć scenariuszy, 3 min ankieta, 2 min podsumowanie.

## Zgoda i ochrona danych

Przed testem: „Sprawdzamy czytelność gry, nie Twoje umiejętności. Możesz przerwać bez konsekwencji. Zapisujemy czasy, dotknięcia i anonimowe komentarze. Nagrywanie ekranu/głosu tylko za Twoją osobną zgodą. Wyniki publikujemy zbiorczo.” Zgoda ustna na udział, osobna **dobrowolna** zgoda na nagranie. Nie nagrywać powiadomień, kontaktów ani twarzy; użyć trybu Nie przeszkadzać. Nadawać identyfikator P01–P08 zamiast imion; surowe nagrania usunąć do 30 dni, tabelę anonimową zachować do analizy. Uczestnik może zażądać usunięcia swojego pomiaru.

## Obsługa APK / precyzja debugowania

W `src/ui/app.ts → applyDebug()` istnieją parametry: `?play=m1|m2|m3`, `bot=1` (**tylko skrypt mostu i czterech wozów dla m1, nie bot dla m2/m3**), `ff=<sekundy>` (maks. 3600 s, zatrzymuje się po końcu misji), `speed=0|1|2|4`, `open=<typ budynku>` (nie ID; wybiera pierwszy obiekt danego typu), `wagon=jam` lub inna wartość (wybiera wóz w ruchu), `tool=road|cobble|demolish`, `collapsed=1`. Parametry `open` i `wagon` otwierają panel od razu — **nie stosować w pomiarze czasu do odnalezienia panelu**.

**Nie ma obecnie debugowego edytora stanu.** Scenariusze B/C/F wymagają ręcznego odtworzenia przez prowadzącego z zapisanego stanu APK, a dla badań powtarzalnych rekomendujemy osobny, niewysyłany do produkcji `?fixture=bridge-removed|all-busy|warehouse-full`. Fixture powinien ładować zapis o znanym hashu i nie ingerować w symulację. Nie używać `bot=1` w m2/m3 jako dowodu przebiegu tych misji.

## Scenariusze (kolejność rotowana między osobami)

Dla każdego scenariusza: prowadzący przygotowuje ekran, pokazuje uczestnikowi mapę bez otwartej karty i pyta: **„Co dokładnie zatrzymało dostawę i co trzeba zmienić?”** Start stopera na końcu pytania, stop na poprawnej diagnozie, limit 90 s. Po odpowiedzi opcjonalnie 30 s na wypróbowanie naprawy. Nie wymagać rzeczywistego ukończenia kontraktu.

| ID | Stan początkowy / sposób przygotowania | Poprawna diagnoza (kryterium) | Pytanie uzupełniające |
|---|---|---|---|
| A | M1, `?play=m1&speed=0`; bez budowy mostu (początek misji). | Brak przejezdnego połączenia między brzegami blokuje dostawy do zamku; trzeba poprowadzić drogę przez rzekę. | „Pokaż, które ogniwo ma problem.” |
| B | M1: zbudować jedyny most po x=41, uruchomić dostawę, usunąć **tylko pustą** komórkę przeprawy (silnik zabrania rozbiórki pod kołem); zapisać/załadować stan. **Fixture do zaprojektowania** — brak URL realizującego tę sekwencję. | Wóz ma `NO_ROUTE` po przerwaniu przeprawy; odbudowa brakującego odcinka lub objazd. | „Czy problem leży w produkcji czy w trasie?” |
| C | M1 po `?play=m1&bot=1&ff=100&speed=0`: sprawdzić, że wozy są zajęte; jeżeli nie, przygotować fixture `all-busy` (potrzebne rozdzielenie od `NONE_CAN_REACH`). | `NO_WAGON.ALL_BUSY` — wszystkie wozy pracują; nowy wóz albo odczekanie; nie mylić z brakiem drogi. | „Który zasób jest wolny?” |
| D | M2 `?play=m2&ff=45&speed=0&wagon=jam` **tylko do przygotowania**; przed pomiarem zamknąć panel, sprawdzić, że istnieje rzeczywisty `BRIDGE_JAM`. Jeśli nie, dobrać chwilę `ff`, zanotować. | Drewniany most ma jeden pas, przeciwne wozy czekają; kamienny most lub druga przeprawa. | „Czy zakup wozów pomoże?” |
| E | M3 `?play=m3&ff=60&speed=0`; potwierdzić deszcz i gruntową drogę, wybrać jadący wóz z obniżoną prędkością. | Deszcz spowalnia ruch po ziemi (`RAIN_DIRT=0.55`); bruk skraca dostawy. **To nie jest** osobny stan `MUD_SLOW` w `WagonStatus`. | „Skąd wiesz, że wóz jedzie wolniej?” |
| F | M3 lub M1: przez zapis/fixture `warehouse-full` zapełnić spichlerz do `storeCap=60`, a producenta pozostawić z nadwyżką; potwierdzić `STORAGE_FULL` lub `OUTPUT_FULL.NO_DESTINATION` w zależności od obiektu. | Brak miejsca docelowego blokuje odbiór; inny spichlerz / zmiana dostaw / opróżnienie. | „Gdzie kończy się łańcuch blokady?” |

**Weryfikacja prowadzącego:** zanim zaprosisz uczestnika, potwierdź przez panel lub log debug, że stan rzeczywiście odpowiada oczekiwanemu kodowi. Nie używaj niepowtarzalnych chwil `ff` bez potwierdzenia. W razie nieudanego przygotowania wpisz `invalid_setup` zamiast oceny uczestnika.

## Instrukcja think-aloud

Powiedz: „Mów na głos, czego szukasz i co rozumiesz, nawet jeśli nie masz pewności.” Jeżeli uczestnik milczy dłużej niż 8 s: „Co teraz próbujesz znaleźć?” — bez podawania nazwy przyczyny. **Nie mówić** „otwórz Dlaczego stoi?”, „sprawdź most”, „kup wóz”, „spójrz na status”. Nie wskazywać palcem ani wzrokiem elementu UI. Notować dokładne spontaniczne wypowiedzi i momenty zawahania. Po pomiarze można dopytać o znaczenie przycisków.

## Zbieranie danych

Każdy wiersz CSV to jeden scenariusz jednej osoby. `time_s` to czas od pytania do pierwszej poprawnej odpowiedzi; jeśli nie ma jej w 90 s — `90` oraz `correct=0`, `timeout=1`. `touches` = liczba celowych dotknięć/gestów do diagnozy; `opened_why` = 1 po otwarciu „Dlaczego stoi?”; `followed_chain` = 1 po dotknięciu kolejnego ogniwa w panelu; `repair_attempt` i `repair_ok` mierzyć osobno. Pomyłki notować w `wrong_hypothesis`; w `setup_verified` 1 oznacza sprawdzony stan. Nie wliczać czasu ładowania APK.

## Ankieta po sześciu scenariuszach

Skala **1–5** (1 zdecydowanie nie, 5 zdecydowanie tak):
1. Potrafiłem znaleźć potrzebną informację bez zgadywania.
2. Zrozumiałem, **dlaczego** wóz lub budynek stoi.
3. Rozumiałem, dokąd prowadzi następny element łańcucha przyczyn.
4. Ikony stanu można rozróżnić bez czytania tekstu.
5. Napisy i cele dotyku były czytelne i wygodne.
6. Wiedziałem, jak usunąć przyczynę po jej znalezieniu.

Trzy otwarte:
1. W którym miejscu najbardziej się zgubiłeś i dlaczego?
2. Który komunikat lub symbol był niezrozumiały?
3. Co jedna zmiana w interfejsie powinna wyjaśniać lepiej?

## Analiza i decyzja

Wyklucz `invalid_setup` z miernika, ale raportuj liczbę wykluczeń. Dla wszystkich poprawnych prób oblicz **medianę `time_s`** (parzysta liczba: średnia środkowych); główny KPI: **% prób z `correct=1` oraz `time_s<30`** liczony po wszystkich ważnych próbach, nie tylko poprawnych. Osobno: mediana per scenariusz, % poprawnych, mediana dotknięć, % użyć „Dlaczego stoi?”, % przejść łańcucha, % udanych napraw, różnice między trzema grupami. Raportuj **n** i nie wyciągaj wniosków statystycznych z n=5–8. Przyjmij próg akceptacji orientacyjny **≥80% ważnych prób <30 s** i **żaden scenariusz poniżej 60%**; w przeciwnym razie powtórzyć po poprawkach. To kryterium produktu, nie dowód naukowy.

Wypisz **pięć najczęstszych problemów** uporządkowanych po liczbie uczestników (nie liczbą wszystkich dotknięć). Do `docs/BACKLOG.md` w odrębnym PR zaproponuj dla każdego: `[playtest] tytuł`, odsyłacz do scenariusza, dowód (n/N + cytat), proponowaną zmianę w `src/ui/`, poziom P0/P1/P2, sposób powtórnej weryfikacji. **Nie wpisywać zmyślonych wyników** przed testem.
