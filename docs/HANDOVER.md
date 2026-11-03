# Handover — MARCHIA (stan 2026-11-02, ~15:20 Europe/Brussels)

Nowa sesja przejmuje autonomiczny rozwój gry od poprzedniej (kończy się jej limit). Rozmawiaj z właścicielem
**po polsku**; kod/komentarze/commity po angielsku. Zasady: `CLAUDE.md` (najpierw!). Decyzje: `docs/DECISIONS.md` (D-01…D-35).

## Repo i gałęzie
- Repo `woogitsugames/marchi`, gałąź robocza i bazowa: **`claude/eager-cori-08wt8e`** (nigdy `main`; PR tylko na prośbę).
- Ostatni commit: `214966d` (wszystko wypchnięte, drzewo czyste). Stan symulacji **v6**, 10 towarów, rangi 0–5,
  misje I–IX w menu, Wolna dolina (sandbox, 3 sloty „Księgi osad”) z porami roku.
- Commity kończ: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + `Claude-Session: <link Twojej sesji>`.
  Bez identyfikatorów modelu w commitach/PR. Komentarze GitHub tylko na prośbę, ze stopką atrybucji.
- **Nie zamykaj PR-ów na GitHubie bez prośby właściciela.** Integracja = scalenie lokalne do bazy + push.

## Rytm pracy (ustalony przez właściciela)
- Praca autonomiczna, ciągła. Poprzedni godzinny cykl (stare konto) jest **wyłączony**, przypomnienie o APK usunięte.
  Utwórz własny godzinny trigger dla swojej sesji (create_trigger) — prompt cyklu: sekcja „Prompt cyklu” na końcu pliku.
- Maks. **3 agentów Opus** naraz + osobno researcher Sonnet (wąskie tematy, raport do `docs/research/`).
  Agentów uruchamiaj w ręcznych worktree: `git worktree add -B <gałąź> /workspace/marchi-<x> HEAD` +
  `ln -s /workspace/marchi/node_modules …` (izolacja `worktree` w Agent nie działa — /workspace nie jest repo).
  Agenci pushują swoje gałęzie, Ty scalasz do bazy (konflikty zwykle w `src/i18n/pl.ts`/`en.ts` PENDING_KEYS — zachowaj obie strony).
- Decyzje właściciela — **klikalnie** (AskUserQuestion) z rekomendacją; nie blokuj się.
- **APK**: w dzień (7–23 Brussels) gdy wersja istotnie lepsza, nie częściej niż co ~3 h; w nocy nic, jedno rano.
  Przed wysłaniem: `npm run typecheck`, `npm test` (SUMMARY failed=0), `npm run build`, smoke test w przeglądarce
  (skrypt `/tmp/claude-0/smoke2.cjs` jeśli przetrwał; inaczej: vite preview na porcie 5193, `?play=mN&quality=low&dynres=0&speed=4`
  dla m1–m9 + sandbox, 0 błędów konsoli). Budowa: `npm run setup:android` (raz w nowym kontenerze), `npm run apk -- --skip-web`
  → `dist-apk/marchia-debug-<sha>.apk` (~48 MB), wyślij SendUserFile. Ostatnie APK: **d58ef72** (11:28 Brussels).
  **Następne APK do wysłania ~14:30 Brussels** — zmiany od d58ef72: rozbiórka z potwierdzeniem w misjach, narzędzie
  budowy zostaje otwarte, skrócone podtytuły VII/VIII, czytelność pór roku (D-34), odstęp wozów w obrazie (D-35),
  UI/render nowych łańcuchów (PR #49: CONTESTED „idzie do”, koszt kamienia, nakładki skał/wody, dym, wariant zamku).
  Poproś właściciela o ocenę kreskowania terenu na telefonie.
- Uwaga: `pkill -f` z wzorcem pasującym do własnej komendy zabija powłokę — zabijaj po PID.

## Współpracownicy
- **GPT-6** (właściciel przekazuje zip-y, GPT pushuje gałęzie `gpt/*` i PR-y). Paczka **07** zlecona (zlecenia 48–54:
  i18n 06, misje X–XII, pliki 13 dźwięków CC0, Kronika doliny, balans sandboxa z porami roku, testy odporności,
  Księga towarów) — `docs/orders/gpt6-07/`. Z paczki 06 nieoddane: 44 (zdarzenia w dolinie), 47 (playtest v2).
  Przegląd: tylko dozwolone ścieżki, bez workflowów pushujących, bez `mission.id === …` w sim, bez wpisów w sounds.ts
  bez plików; wzór raportu: `docs/reviews/gpt-integration-2.md`. Po scaleniu tłumaczeń usuń przetłumaczone klucze z `PENDING_KEYS`.
- **Druga sesja Claude Code** (właściciel przekazuje prompty z `docs/orders/claude-session-NN.md`). Zlecenie **05**
  (układ RTL dla arabskiego, gałąź `claude/s5-rtl`) — przekazane przez właściciela teraz. PR-y #48/#49 tej sesji już scalone.

## Otwarte (kolejność wg backlogu: błędy > Fold/wydajność > czytelność < 30 s > grafika > treść)
- `docs/BACKLOG.md` — po audycie 53 pozycji przeniesiono do „Zrobione”. Otwarte m.in.: P0 do weryfikacji — błąd
  shadera wody (sprawdzić przy quality=high/ultra); restart/nadpisanie kontraktu bez potwierdzenia;  budżet przeplanowań; `{n, plural}` w pl/en; koszt drogi dojazdowej w etykiecie budowy.
- `docs/research/2026-11-02-seasons-m7-9.md`: F3 (m9 — CONTESTED widoczny tylko 34 s) i F10 (m7 — brak sygnału
  niedoboru przepustowości; propozycja: tempo dostaw + prognoza „przy tym tempie spóźnisz się” na liście przewozowym
  i karcie zamku, bez nowego StallReason) — do zrobienia; druga połowa F5 (piekarnia „dostawca produkuje”, gdy młyn
  czeka) wymaga zmiany statusów w sim → zmienia hashe misji, decyzja.
- D-34: podwójne liczenie zamkniętego mostu w liście końcowym misji kontraktowych — poprawka zmieni złote hashe
  (m2, m4, m8); ewentualnie zapytać właściciela.
- 24+ nowych kluczy i18n w `PENDING_KEYS` (czekają na GPT 48).
- Hosting pakietu 4K odłożony (D-21: „na razie nigdzie”). Gra darmowa, bez reklam (D-29).

## Decyzje właściciela z dziś
3 sloty doliny; bez reklam na razie; rangi Gród/Stolica; pory roku łagodnie (tylko dolina); nazwa „Marchia” wszędzie;
odstęp wozów zostaje tylko w obrazie (D-35); druga sesja → RTL arabski.

## Prompt cyklu (do create_trigger, co godzinę)
Godzinny cykl autonomicznego rozwoju MARCHIA (właściciel zlecił ciągłą pracę; ten cykl wznawia sesję także po limicie/restarcie). Limit: najwyżej 3 agentów Opus naraz (researcher Sonnet osobno). Kontynuuj:
1. Zbierz wyniki agentów (przerwanych — wznów; zakończonych: przejrzyj zrzuty, zintegruj, `npm test`, `npm run typecheck`, `npm run build`, commit + push na claude/eager-cori-08wt8e).
2. PR-y GPT i drugiej sesji Claude (claude/s*-*, gpt/*): przejrzyj, scal lokalnie, testy, popraw drobiazgi, odrzuć szkodliwe elementy, wypchnij; raport: przyjęto / poprawiono / odrzucono. Nie zamykaj PR-ów bez prośby właściciela.
3. docs/BACKLOG.md: 1–3 najważniejsze pozycje (błędy > wydajność/Fold > czytelność przyczyn < 30 s > grafika > treść); kolejność wg D-17, D-21, D-29. Realizuj sam albo przez agentów, aktualizuj backlog.
4. Jeśli researcher Sonnet nie pracuje, uruchom go z nowym, wąskim tematem.
5. APK: w dzień (7:00–23:00 Europe/Brussels) gdy jest istotnie lepsza wersja, nie częściej niż co ~3 h (typecheck, testy, smoke test bez błędów konsoli). W nocy nie — jedno APK rano.
6. Krótki raport po polsku. Decyzje właściciela — klikalnie (AskUserQuestion) z rekomendacją. Zasady z CLAUDE.md.

## Stan 2026-11-02 ~15:20 (sesja session_01QWRid6hScCk3PSEu7RfFHs)
- Godzinny cykl: trigger `trig_01SUuiU1pXy1yo2Wj2sfPrJx` (:42 UTC) przypięty do tej sesji.
- Scalone dziś: paczka GPT 07 (48–54, raport `docs/reviews/gpt-integration-3.md`) i 57 (tłumaczenia); sloty zapisu
  na misję (D-36); RTL arabski (D-37, szyna zależy tylko od ręki); prognoza tempa i „drewno bierze też” (D-38);
  misje X–XII w menu (D-39); poprawka dyspozytora (hasze bez zmian); łąka bez powtórzeń kafla.
- Ostatnie APK: **9618287** (14:05 Brussels). Następne najwcześniej ~17:00.
- W toku (agenci w worktree): `claude/w-models` (koń/wóz/ludzie + krok konia od dystansu — właściciel: „koń biegnie
  szybciej niż nogi”), `claude/w-trees` (drzewa wg `docs/research/2026-11-02-trees.md`).
- HUD: właściciel odrzucił CSS-owe wersje jako „AI slop”; układ **D** (góra z A, dół z B, klasycznie —
  `claude/hud-mockups`, `docs/mockups/hud/v2/D-*.jpg`) akceptowany co do układu. Grafiki: zlecenie GPT **55**
  (paczka 08, `docs/orders/gpt6-08/`) — ręcznie malowany kit UI; wdrożenie dopiero po akceptacji właściciela.
- GPT paczka 08 wysłana: 55 kit UI, 56 dźwięki (powtórka 50), 57 tłumaczenia (oddane, scalone).

## Stan 2026-11-02 ~19:00
- Baza `d1c1d84`: + nowy HUD v3 (D-43, kit GPT 55/55b), kamera nad arkuszem i wozy przy stajni (D-45), sim D-44
  (most raz, F5, numery floty — STATE_VERSION 7), dźwięki 56 + miks, drzewa (D-41), koń (D-40), sesja 06 (D-46…D-52).
- Ostatnie APK: **2bae80f** (17:2x Brussels) — jeszcze bez nowego HUD. Następne: po szlifie HUD (`claude/hud-polish`)
  i akceptacji właściciela; w nocy nic, rano jedno.
- Właściciel: HUD — „najpierw poprawki” (szczegółów nie podał; robimy: mniejszy panel w poziomie, jaśniejsze paski,
  ikona oka, styl przycisków w arkuszach/listach). Kolejne decyzje numeruj od **D-53**.
- Do tłumaczenia (PENDING_KEYS): menu X–XII, tempo D-38, HUD v3, F5, listy/dead-end sesji 06 → paczka GPT 09.

## Stan 2026-11-02 ~21:00 (limit użycia prawie wyczerpany)
- Baza `0007f5a`. Ostatnie APK: **8b59953** (20:30) — nowy HUD po szlifie, shadery pre-warm. W nocy bez APK, rano jedno.
- W toku (WIP pushowany na bieżąco): `claude/w-events` — integracja zdarzeń doliny (zgoda właściciela, D-54,
  STATE_VERSION 8, karta w HUD); `claude/w-hudp3` — cache rankStalls + boczny arkusz w poziomie (D-55 jeśli reguła).
  Po wznowieniu: sprawdź obie gałęzie, scal (konflikty zwykle BACKLOG/DECISIONS/i18n PENDING_KEYS), testy, smoke I–XII.
- GPT: oddane 44/47/57/58/59/55/56; czeka 60 (korekta PL, paczka 09R) i paczka 10 (61 grafiki sklepu, 62 opisy).
- Następne decyzje od **D-56**.

## Stan 2026-11-02 ~22:50
- Baza po scaleniu zdarzeń doliny (D-54, STATE_VERSION 8) i HUD P3 (D-55). Testy 374/374, smoke I–XII OK.
- GPT: 62 przyjęte; 61 bez grafik (przyjęty tylko skrypt `tools/store-shots-v2.mjs`, workflow z pushem odrzucony) —
  rano wygenerować zrzuty sklepu tym skryptem; 60 (korekta PL) nadal czeka.
- Rano: jedno APK (od 8b59953: zdarzenia doliny, HUD P3, opisy sklepu), zrzuty sklepu, P2 karta wieści zwinięta.
- Następne decyzje od **D-56**.

## Plan nocy 2026-11-02/03 (właściciel śpi; jeden agent Opus naraz, ciągle)
Decyzje właściciela 23:55: benchmark na telefon — TAK jako ukryta strona `?debug=1`; zrzuty do sklepu — NIE (zrobi kto inny,
zapomnieć); `task/20-store-graphics` i `claude/hud-mockups` do usunięcia (polecenie w docs/branches-audit-2026-11-02.md);
praca nocna: „wszystko po kolei, w sposób ciągły: poprawki, błędy, ulepszanie modeli, treści”.
Kolejka (agent bierze po kolei, każda pozycja osobnym commitem; koordynator scala po każdym agencie):
1. Integracja `gpt/device-bench-22` jako ukryta strona benchmarku (`?debug=1`), bez wpływu na build gracza.
2. Błędy P0/P2 z docs/BACKLOG.md (otwarte pozycje), m.in. zgłoszenia z audytów (fold, save, audio).
3. Wydajność P1: audyt alokacji pod GC (frame-cost research pkt 5), dispatcher/DistMap.
4. Czytelność < 30 s: pozostałe P2 z backlogu (np. bąbelki klas przestojów, toasty „brak N srebra”).
5. Modele/animacje: budynki (detal, ludzie przy pracy: drwal, młynarz, piekarz — pętle animacji), drzewa impostor
   wielowidokowy (P3 z D-41), woda/most detale.
6. Treść: zdarzenia doliny — dodatkowe warianty, kronika doliny (gpt/51 proposal) podpięta do UI.
## Decyzje na rano
(dopisuj tu w nocy)
1. **Kronika doliny — gdzie trzymać zapisane wpisy (D-57).** Teraz: localStorage per księga (bez zmiany sim i zapisu).
   Opcje: (a) zostawić; (b) pole w kopercie zapisu (`chronicle: string[]`, bramka zapisu + test, bez zmiany hasza stanu);
   (c) `SimState.chronicle` z migracją v8→v9 (zmienia hasze doliny, nie kontraktów). **Rekomendacja: (b)** — wpisy
   podróżują z kopią zapasową Androida i nie dotykają symulacji.
2. **Karta przestoju „Naprawa” dla OUTPUT_FULL / NO_DESTINATION** — dodać przycisk otwierający narzędzie Buduj z
   podświetlonym spichlerzem? (teraz brak przycisku; „Kup wóz” i wskazówka korka mostowego są). **Rekomendacja: tak**,
   po playteście H5.
3. **Benchmark na Foldzie (D-56)** — strona gotowa: w APK otworzyć z `?debug=1&bench=device` (np. `chrome://inspect`
   → konsola WebView: `location.search='?debug=1&bench=device'`); wyniki JSON wkleić do tabeli w docs/PERF.md.
4. **Postacie przy pracy** — drwal/młynarz/piekarz są; czy dodać tartak (dwóch przy pile), rolnika, rybaka? Koszt:
   +3 wywołania rysowania na rodzaj (+cienie). **Rekomendacja: tak, ale po ocenie obecnych na telefonie.**
5. **Pamięć atlasu drzew (D-58)** — impostor 8-widokowy: low 2×7 MB, high 2×21 MB, ultra 2×28 MB (wcześniej ~2×7 MB
   razem z buforami MSAA). Na Foldzie sprawdzić w benchmarku/`chrome://inspect` → Memory. **Rekomendacja: zostawić
   224 px na high**; jeśli WebView zacznie gubić kontekst — 192 px (2×16 MB). Drugi wariant drzew bez własnych widoków
   (karta zawsze wariant 0) — **rekomendacja: nie** (2× pamięci za drobną różnicę w paśmie przejścia).
6. **Kontrakt „odliczanie z nadzieją” (D-60), reszta wpisu P2** — animacja odciśnięcia pieczęci (1,2 s) przed listem
   końcowym, nastrój muzyki „hurry” przy < 2 min, dźwięk dostawy do zamku. To zmiany smaku i przepływu (app.ts
   showEnd, music.ts). **Rekomendacja: pieczęć tak (200 ms + 1 s trzymania, bez sprężyny); muzyka dopiero po
   playteście; dźwięk dostawy cichy, ten sam co przyjęcie ładunku.**
7. **Podpowiedź tempa / auto-powrót do ×1 (BACKLOG P3 „prędkość jako narzędzie”)** — zmienia to, co robi gra bez
   pytania gracza. **Rekomendacja: tylko podpowiedź raz na misję; auto-×1 nie** (ukryta zmiana prędkości myli).
8. **Wygląd kalenicy strzechy (D-61)** — lasce na krzyż czytają się z bliska jako wyraźna kratka. Ocenić na telefonie;
   jeśli zbyt „graficzne”: kolor bliżej strzechy (`#655640`) albo tylko dwa pręty bez krzyży. **Rekomendacja: zostawić.**
9. **Arkusz od dołu zwija list przewozowy (D-62, noc 3 — zrobione, do oceny).** W pionie, gdy otwarta jest karta
   (Dlaczego stoi? / wóz / zamek), list zwija się do pieczęci, a po zamknięciu karty wraca; własne ustawienie
   gracza (zwinięty/rozwinięty) bez zmian; pieczęć zwiniętego listu otwiera wtedy kartę zamku (jak na Flipie). Powód: na 412×915 rozwinięty list i karta zabierały całą mapę, a
   piekarnia z czerwoną pinezką siedziała pod listem. **Rekomendacja: zostawić**; jeśli przeszkadza na telefonie —
   cofnięcie to jedna linia (`syncSheetFold()` w app.ts).
10. **Pinezki pod panelami HUD znikają (D-62)** zamiast wystawać zza listu/paska tempa (i łapać ich dotyk).
   Najgorszy przestój nadal widać w karcie „najgorszy” na dole. **Rekomendacja: zostawić**; alternatywa (droższa) —
   pinezka „przyklejona” do krawędzi panelu ze strzałką.
11. **Listy kasztelana po niemiecku (i w 14 innych językach) są po angielsku** (`src/content/letters.ts`, widać na
   `docs/shots/night3-de-end-360x740.jpg`). To treść do paczki tłumaczeń, nie układ. **Rekomendacja: dołożyć do
   najbliższej paczki GPT razem z kluczami PENDING_KEYS.**
12. **`npm run layout` w CI?** Pełny przebieg ~14 min (350 zadań), `--quick` ~3,5 min (412×915 + Flip × pl/de/pseudo, 84 zadania).
   Wymaga Playwright + Chromium w CI (dziś nie ma ich w `package.json`, są globalnie w kontenerze). **Rekomendacja:
   `--quick` w `ci.yml` na każdy push (z `npx playwright install chromium`), pełny przed wydaniem/APK.**
13. **Pieczęcie nigdzie nie zostają (BACKLOG P3 „Opisy”).** Opis sklepu mówi „zdobywaj pieczęcie” i „postępy
   zapisują się”, a po liście końcowym zapis `auto`/slot kontraktu jest kasowany i nie ma rekordu pieczęci.
   Opcje: (a) najlepsze pieczęcie per misja w `localStorage` (jak kronika) i trzy małe pieczęcie w wierszu misji w
   menu — bez zmiany sim i koperty zapisu; (b) to samo w IDB obok zapisów (kopia zapasowa Androida); (c) zmienić opis
   sklepu. **Rekomendacja: (a) teraz, (b) razem z decyzją 1 (kronika do koperty)** — jedna zmiana formatu zamiast dwóch.
14. **Misja X: „drewno w drodze — wóz N” maskuje niedobór drewna (BACKLOG P2).** Łańcuch kończy się na wozie, który
   czeka u drwala. Propozycja: gdy wóz z tym zleceniem jest w odbiorze (`LOADING`/w drodze po towar), dodać ogniwo
   „producent” (drwal pracuje / stoi) w `explainBuilding` — funkcja tylko czyta stan, hasze bez zmian, ale to
   `src/sim/diagnose.ts` i zmienia to, co gracz czyta w misjach I–XII (testy czytelności do przejrzenia).
   **Rekomendacja: tak, po playteście H2** (ta sama pomyłka „brak wozu” vs „brak surowca”), nie przed nim.
15. **Zapasy na podwórzach według stanu magazynu (propozycja, noc 5 — nie zrobione).** Dziś stosy kłód, desek,
   worków i beczek przy budynkach są stałą dekoracją modelu, niezależną od `stock`. Propozycja: każdy model dostaje
   miejsca na 6 jednostek wyrobu (`stockSlots`), rysowane tymi samymi instancjami co ładunek wozów (`cargo-*`, bez
   nowych wywołań rysowania), więc pełne podwórze = `OUTPUT_FULL` widać bez dotykania. Koszt: przejrzenie 12 modeli
   (stałe stosy wyrobu zamienić na dynamiczne), zrzuty z bliska. **Rekomendacja: tak, po ocenie postaci przy pracy
   (decyzja 4)** — ten sam przegląd modeli na telefonie.

## Stan nocy 2026-11-02/03 (gałąź `claude/w-night`, agent nocny)
Zrobione z kolejki „Plan nocy” (każde: typecheck, testy 376/376, build, push; hasze kontraktów bez zmian):
1. `5731c9d` benchmark telefonu — ukryta strona `tools/device-bench.html`, wejście `?debug=1&bench=device` (D-56).
2. `3a41b86` błędy: przyczyna korka na moście w karcie wozu (z naprzeciwka / pełne przęsło / przepuszcza), baza IDB
   nowsza niż aplikacja (B6); restart z potwierdzeniem i B1–B5 były już zrobione.
3. `7bcd420` GC: −41 % alokacji (sandbox 50 wozów ×4), `tools/alloc-probe.mjs`; `frame-cost.mjs` rank 5.
4. `3ab1054` czytelność: „Naprawa → Kup wóz −30” w karcie przestoju, wskazówka korka, licznik czasu pod pinezką od 20 s.
5. `a8f235a` ludzie przy pracy: drwal, młynarz, piekarz (pętle animacji, tylko przy `WORKING`). Nie zrobione: impostor
   drzew wielowidokowy, detale wody/mostu.
6. `52c09ec` kronika doliny w UI (D-57), `5c31a4a` +6 wariantów zamówień (rangi 3–5).
Nowe klucze i18n (PENDING_KEYS): `wagon.BRIDGE_JAM.*`, `fix.wagon*`, `fix.jam*`, `chron.*` (66), `events.order.t.*` (6).

## Stan nocy 2 — 2026-11-03 (gałąź `claude/w-night2`, agent nocny 2)
Kolejka nocy 2 (każde: typecheck, testy 376/376, build, push; hasze kontraktów bez zmian, sim nietknięta):
1. `004e1c2` **D-58** impostor drzew 8 widoków (azymut w układzie drzewa, high miesza, low dithering bez dodatkowych
   próbek), atlas per jakość (128/224/256 px), wypiekany po wierszu przez mały cel MSAA. Wywołania/trójkąty bez zmian.
2. `516ced9` **D-59** woda: falujący brzeg i piana (high), mokry pas brzegu (wszystkie); mosty: przyczółki (rampa,
   kłody / skrzydła murowane), odbojnice, gzyms i ciosy, piana i ślad za palami/filarami (+1 wywołanie rysowania).
3. `8a3b68b` **D-60** dostawa do zamku „+6” przy bramie, błysk wiersza listu, powiadomienia: połowa / 2 min / ostatnia
   minuta; `63161ae` Buduj — koszt drogi dojazdowej w etykiecie, etykieta nigdy na duchu; backlog: stare
   pozycje oznaczone jako zrobione (`702f131`: listy kasztelana, pierścień na moście, kadr po arkuszu, cena wozu).
4. `eddd186` **D-61** detal budynków: lasce na kalenicy, łaty świeżej słomy, porost na gontach, zacieki/zachlapanie
   gliny, drabiny, ława (bez nowych wywołań; +0,5–1,3 tys. trójkątów na budynek ze strzechą).
5. `885cd09` narracja zamówień (36 × PL/EN) w rozwiniętej ofercie; 4 brzmienia przyjazdu kupca.
Nowe klucze (PENDING_KEYS): `contract.half|twoMin|lastMin`, `build.costRoad`, `events.order.d.*` (36),
`events.merchant.new.1–3`. Zrzuty `docs/shots/night2-*`. Uwaga do skryptów zrzutów: tekstury high dochodzą pod
SwiftShaderem po 10–20 s — wcześniejsze zrzuty „bez tekstur” to za krótki czas oczekiwania, nie błąd gry.
Następne decyzje od **D-62**.

## Stan nocy 3 — 2026-11-03 (gałąź `claude/w-night3`, agent nocny 3)
Kolejka nocy 3 (każde: typecheck, testy, build, push; sim nietknięta, hasze kontraktów bez zmian):
1. **`npm run layout`** (`tools/layout-check.mjs`, D-62) — pomiar zamiast oceny: 14 ekranów (menu, ustawienia, HUD,
   Dlaczego stoi?, wóz, Buduj, list M7, list końcowy, zamek M5, Wolna dolina, targ, list otwierający, samouczek,
   awans) × 412×915, 915×412, 904×1000, 360×740, Flip 360×380 × pl/de/ru/ar/pseudo = 350 zadań, ~14 min (mapa Canvas2D; `--three` na mapie 3D, ~40 s/zadanie). Sprawdza: akcje w
   widoku, przecięcia HUD × arkusz × pinezki, cele ≥ 48 px, tekst poza ramką/ucięty, tekst/przycisk przykryty innym
   elementem, przewijanie w bok, błędy konsoli. Kontrola pozytywna 5/5 (wstrzyknięty zły CSS musi czerwienić).
   Raport `docs/layout/layout-report.json` (tylko pełny przebieg domyślny; `--three` na mapie 3D: hud, Dlaczego stoi?,
   wóz, dolina, zamek, list końcowy, samouczek × 3 widoki × pl/de/ar — też czysto). Naprawione dzięki niemu: pinezki pod HUD-em gasną, list zwija się przy
   arkuszu od dołu, kadr kamery liczy menu/żetony/tempo jako przeszkody, pasek Flip ukryty pod arkuszem, przyciski-
   linki ar ≥ 48 px, **wstęga listu przewozowego malowała się nad nagłówkiem listu końcowego** (warstwy UI izolowane),
   w poziomie komunikat pory roku zakrywał zwiniętą kartę „Wieści z doliny” (teraz pod nią), na Flipie komunikat na
   dymku (teraz na dole), na 904×1000 arkusz boczny zaczynał się na żetonach i tempie (teraz pod nimi).
   Na Flipie strzałka samouczka szła przez podpowiedź „Otwórz telefon…” (podpowiedź chowa się, notatka ją omija);
   notatka samouczka ma ≤ 3 wiersze od 360 px (sprawdzane), klucze ≤ 140 znaków we wszystkich językach.
   Dodatkowo: `tests/i18n-plural` (każdy blok plural w 17 słownikach), `{n} {cells}` → bloki plural, `tests/repo-size`.
2. **i18n**: `?lang=pseudo` (angielski z akcentami, +40 %, ⟦ ⟧; test), `hyphens:auto` + `overflow-wrap` na
   nagłówkach arkusza/listu/menu/wstęgi i wierszu stanu. Łączenia list (`Intl.ListFormat`) i liczby (fmt.ts) były już
   zrobione; zostaje `{n} {cells}` → blok plural (BACKLOG).
3. **Czcionki**: `tests/font-coverage` czyta cmap WOFF — Grenze Gotisch ma wszystkie litery 10 języków łacińskich,
   Ruslan + Alegreya całą cyrylicę; stosy ar/hi/ja/ko/zh dostały nazwy iOS (Geeza Pro, Kohinoor Devanagari, Hiragino,
   Apple SD Gothic Neo, PingFang SC).
4. **Bramki dokumentów**: `tests/docs-numbers` dla misji II–XII (start, termin, progi pieczęci, ilości) — złapał
   `docs/missions/m3.md` (12:00/08:00/10:00 zamiast 11:00/06:15/08:00, poprawione); `tests/i18n-hygiene` — 19
   martwych kluczy usuniętych ze wszystkich słowników, brak literałów w index.html i budowniczych UI.
Zrzuty `docs/shots/night3-*.jpg` (4); `npm run shots` (27 zrzutów) bez błędów konsoli. Następne decyzje od **D-63**.

## Stan nocy 4 — 2026-11-03 (gałąź `claude/w-night4`, agent nocny 4)
Kolejka nocy 4 (każde: typecheck, testy, build, `npm run layout -- --quick`, push; sim nietknięta, hasze bez zmian):
1. **Audio (D-63)**: szew pętli `ambient.evening` — przyczyna nie w przenikaniu, tylko w `loudnorm`, który przy
   przekroczeniu -6 dBTP po cichu przechodził w tryb dynamiczny (wzmocnienie dryfowało 26,6 → 23,9 dB w 30 s, więc
   koniec i początek pętli miały inne wzmocnienie). `tools/process_audio.py` daje wtedy stałe wzmocnienie + limiter;
   fragment nagrania przesunięty z 0 s na 198,5 s (ten sam wiatr CC0, równiejsza obwiednia). Szew 200 ms: 5,8 → 0,56 dB
   (mediana sąsiednich okien w pliku 0,76 dB). Przerenderowany tylko ten plik, `--check` zielony, provenance
   zaktualizowane. **Do odsłuchu na słuchawkach**: nowy fragment ma mniej dudnienia < 60 Hz (31 % zamiast 90 % energii).
   `AudioEngine`: po pierwszym geście ładuje wszystkie jednorazowe dźwięki (sfx + ui, ~300 kB; pętle dalej na
   żądanie), a `play()` w trakcie ładowania czeka w kolejce (jedno na id) zamiast przepadać po 850 ms; odrzuca dopiero
   po 4 s. Test `tests/audio-preload.test.ts`.
2. **Render P3 (D-64)**: dalekie wozy (LOD1) bez cienia na każdej jakości — `setShadows` było wołane, ale z
   `far = high`. Pomiar `tools/wagon-shadow-calls.mjs` (100 wozów, 72 daleko): 90 → 87 wywołań GL na klatkę,
   −14,9 tys. trójkątów w passie cienia; różnicy w obrazie nie widać (`docs/shots/night4-wagon-far-shadow-on-off.jpg`).
   Uwaga: licznik `drawCalls` w `?perf=1` nie liczy passu cienia (three r181 zeruje `info` po nim). Pierścień
   zaznaczenia na moście — już naprawiony w nocy 2 (`deckRing`), sprawdzone w kodzie.
3. **Drobne P3**: `load.stone` zaczynał się od 55 ms ciszy (uderzenie spóźnione względem animacji) — fragment
   przesunięty o 40 ms, przerenderowany tylko ten plik; pipeline przy ponownym renderze źródła Freesound nie kasuje
   już jego wpisu w provenance (URL, licencja, data). Usunięty zdublowany wpis BACKLOG o numeracji wozów (zrobiony, D-44).
4. **Zmiana jakości bez kompilacji w klatce (D-65)**: przełączenie wysoka ↔ niska linkowało 2–4 shadery w klatce
   (przycięcie). Teraz warianty (A2C liści, mieszanie kart drzew, teren low) kompilują się na klonach przed
   przełączeniem, a materiały wypiekania atlasu drzew zostają w pamięci: 0 linków w klatce w 4 przełączeniach.
   Jakość wchodzi ~kilkaset ms później (niewidoczne). Obraz po przełączeniu = obraz po świeżym starcie na tej jakości.
5. **BACKLOG porządki**: `stall.alert`/`ui.error` na głośniku telefonu — już zrobione wcześniej (pliki mają 99 % energii
   w 600–2500 Hz), `screenshots-plan.md` — już przepisany; wpisy zamknięte. Nowy wpis P3: pętla młyna gubi rytm na szwie
   (9,56 okresu na 5,5 s) — źródło Freesound niedostępne z kontenera (403), opis naprawy w BACKLOG. Następne decyzje od **D-66**.

## Decyzje właściciela 2026-11-03 rano (odpowiedzi na „Decyzje na rano” 1–12)
- 1 Kronika doliny → **w pliku zapisu gry** (envelope, bez zmiany sim; migracja z localStorage).
- 2 „Naprawa” dla OUTPUT_FULL / NO_DESTINATION → **tak** (Buduj → spichlerz; w misjach bez budowy tylko wskazówka).
- 3 Benchmark na Foldzie → właściciel uruchomi `?debug=1&bench=device` w APK i wklei JSON do docs/PERF.md.
- 4 Kolejni ludzie przy pracy → **po ocenie obecnych** przez właściciela (czekać na jego opinię o drwalu/młynarzu/piekarzu).
- 5 Atlas drzew → **mniejszy na high** (jak low ≈14 MB), pełny tylko na ultra.
- 6 Koniec kontraktu → **animacja odciśnięcia pieczęci + dźwięk dostawy** (motyw muzyczny Suno — właściciel).
- 7 Prędkość → **tylko podpowiedź** (toast przy rosnącym przestoju na ×4), bez auto-powrotu.
- 8 Strzecha → **złagodzić** witki na kalenicy (rzadsze, ciemniejsze, bez kratki).
- 9 Zwijanie listu przy arkuszu od dołu → **zostaje**. 10 Znikanie pinezek pod HUD → **zostaje**.
- 11 Listy kasztelana → **tłumaczenie w paczce GPT 11** (listy I–XII + nowe klucze z nocy, 15 języków).
- 12 CI → **`npm run layout -- --quick` przy każdym pushu**, pełny ręcznie przed APK.

## Plan dnia 2026-11-03 (jeden agent Opus ciągle + koordynator)
Kolejka: dokończ agenta 5 (`claude/w-night5`) → decyzje 5, 8, 2, 7, 1, 6, 12 (w tej kolejności) → paczka GPT 11 (decyzja 11)
→ dalej backlog jak w nocy. APK w dzień co ~3 h.
## Stan nocy 5 — 2026-11-03 (gałąź `claude/w-night5`, agent nocny 5)
Kolejka wg BACKLOG (każde: typecheck, testy, build, `npm run layout -- --quick`, push; sim nietknięta, hasze bez zmian):
1. `23b7ce1` **P1 provenance muzyki**: `tests/music-provenance.test.ts` — plik bez wpisu w
   `docs/legal/music_provenance.json` = czerwony test (SHA-256, id Suno w tagu COMMENT WebM, każdy utwór z `music.ts`
   istnieje, tabela w ASSETS.md); skaner `tools/music-provenance.mjs` (`--write` po przekodowaniu). ASSETS.md: Suno AI,
   plan płatny. Deklaracja treści AI w sklepach zostaje krokiem wydania.
2. `9d81f3f` **P2 `?diag=1`**: percentyle czasu klatki p50/p95/p99, klatki > 33 ms, p95 CPU sim/widoku w kubełkach
   tempa (pauza = odniesienie), „Kopiuj JSON” (`marchia.frame-diag.v1`); protokół na składaku i tabela w docs/PERF.md.
3. `2f4dd6a` **P2 test optymalności `findPath`** względem niezależnej Dijkstry O(V²) (deszcz, kolejki na mostach,
   żywy świat 50 wozów).
4. `5c6f5a7` **P2 raport pokrycia tłumaczeń**: `npm run i18n:coverage` (+ `--pack`), paczka
   `docs/i18n/pending-pack/` (177 kluczy) gotowa dla GPT.
5. `83e983c` **P3 „migawka diagnozy”**: pierwszy krytyczny przestój misji — pinezka trzy razy wypuszcza pierścień,
   karta „Najgorszy zastój” na 2 s mosiężna poświata, czytnik ekranu słyszy przyczynę; kamera stoi, bez nowych kluczy.
6. `f0f5c5e` + `0aaf913` **P4 zapowiedź deszczu** 30 s przed ulewą (`hud.rainSoon`); przy okazji na Flipie
   komunikat chowa się pod otwartym arkuszem (stara kolizja wyszła w `layout`); pełny `npm run layout` (350) złapał to
   samo na 915×412 / 904×1000 / 360×740 w karcie wozu → reguła rozszerzona na każdy układ (`body.has-sheet .notice-wrap`),
   scena `wagon` 25/25 i `--quick` 84/84 zielone (pełnego przebiegu nie powtórzono — ~25 min).
7. `326bacd` **P3 `npm run a11y`** (CDP, drzewo dostępności): złapał błąd — po zamknięciu arkusza w pionie fokus nie
   wracał do oka „Najgorszy zastój” (naprawione w `sheets.ts`).
BACKLOG: zamknięte jako już zrobione wcześniej (sprawdzone w kodzie): kod deweloperski w buildzie, klon w `saveGame`,
Intl w liczbach, właściwości logiczne RTL, klucze HUD w 17 językach, samouczek ≤ 140 znaków, ikona v3.
Nowe klucze (PENDING_KEYS): `diag.copy|copied|reset`, `hud.rainSoon`. Zrzuty `docs/shots/night5-*.jpg` (5).
Decyzje 13–15 dopisane wyżej. Następne decyzje od **D-66** (ta noc nie dodała wpisów D-NN).
- 13 Pieczęcie misji → **tak, najlepszy wynik i czas na misję w zapisie gry** (razem z kroniką, decyzja 1), widoczne w menu misji.
- 14 Łańcuch misji X do producenta → **po playteście**.
- 15 Stosy towaru na placach wg zapasu → **tak** (instancje ładunku, bez nowych wywołań rysowania).
- **CI (właściciel 2026-11-03): limit minut GitHub Actions — CI do minimum.** `ci.yml` tylko ręcznie i przy otwarciu PR
  (bez push, bez synchronize), workflowy propozycji misji tylko ręcznie. Nie dodawać kroków do CI; wszystkie
  sprawdzenia lokalnie przed pushem. Decyzja 12 (layout w CI) **anulowana**.

## Stan dnia 1 — 2026-11-03 (gałąź `claude/w-day1`, agent dzienny)
Każdy punkt: typecheck, `npm test` (408/0), build, `npm run layout -- --quick` (84/84) zielone; hasze złote bez zmian (sim nietknięta).
1. **Decyzja 5** — atlas drzew: high = 128 px (2 × 7 MB = 14,0 MB, było 42,8 MB), ultra 256 px (55,9 MB); `view.stats().treeAtlasMB`. D-58 poprawka.
2. **Decyzja 8** — kalenica strzechy: jeden pręt na ~0,9 m naprzemiennie (zygzak), cieńsze i ciemniejsze (`#4a3f2c`), bez kratki. D-61 poprawka; przed/po `day1-ridge-before-after.jpg` (widok `ridge` w model-preview).
3. **Decyzja 2** — „Naprawa” dla OUTPUT_FULL/NO_DESTINATION (korzeń łańcucha): „Postaw spichlerz −30” zamyka kartę, otwiera Buduj ze spichlerzem na najbliższym wolnym miejscu obok budynku; w misjach bez spichlerza na liście — sama wskazówka. Przycisk Buduj w szynie dostaje znacznik lekarstwa. D-66.
4. **Decyzja 7** — toast „Na ×4 przestój rośnie szybko: {budynek}. Zwolnij…” raz na przestój (krytyczny, ≥ 60 s gry), bez zmiany tempa. D-67.
5. **Decyzje 1 + 13** — kronika w kopercie zapisu księgi (`chronicle`, opcjonalne, czytane łagodnie; localStorage scalany raz i kasowany po zapisie; nowy wpis = autozapis); najlepsze pieczęcie + czas per kontrakt w nowym magazynie IDB `profile` (DB v3), zapis przy liście końcowym, w menu trzy małe pieczęcie i czas pod podtytułem. Testy: stara baza v2, stara koperta, uszkodzony profil, migracja localStorage. D-68.
6. **Decyzja 6** — pieczęć zamku odciskana 200 ms (bez sprężyny), trzymana do 1,2 s, tap/klawisz pomija, potem list; dźwięk dostawy przy każdym towarze kontraktu w zamku (`contract.delivery` = istniejący CC0 `unload-sack`, cicho, bez pozycji); `process_audio --check` PASS. D-69. Muzyka „hurry” — po playteście.
7. **Decyzja 12 (CI) — pominięta** na polecenie właściciela (limit minut CI; workflowy nietknięte, baza `cd5b8a3` wyłączyła CI na push).
8. **Priorytet właściciela (zrzut z telefonu)** — menu główne na zestawie UI: rama z liliami (`frame-sheet-dim`), tytuł na wstędze, mosiężne medaliony z numerem misji (wygrana = woskowa pieczęć), Kontynuuj = wiśniowy przycisk, Ustawienia = karta; przewijanie z wygaszeniem, 2 kolumny w krótkim poziomie/Flex, RTL. Layout 75 zadań menu/ustawienia/zapis/dolina we wszystkich widokach zielone. D-70; przed/po `day1-menu-*.jpg`.
9. **Decyzja 15** — stosy towaru przy podwórzach wg zapasu: do jednego ładunku (6, kamień 4) instancjami `cargo-*` wozów; stałe stosy wyrobu usunięte z 7 modeli. Wywołania: +1–4 tylko gdy żaden widoczny wóz nie wiezie tego towaru. D-71; `day1-yard-sawmill-off-on.jpg`.
Nowe klucze (PENDING_KEYS, PL+EN): `fix.granary`, `fix.granaryWhy`, `fix.granaryHint`, `hud.speedHint`, `menu.bestAria`. Następna decyzja: **D-72**.
Do oceny na telefonie: rozmiar pieczęci przy liście (sprite 84 px — większa byłaby miękka), numery rzymskie w medalionach przy arabskim, stosy na podwórzach (miejsca na 10 modelach).


## Stan dnia 2 — 2026-11-03 (gałąź `claude/w-day2`, agent dzienny 2)
Każdy punkt: typecheck, `npm test` (409→412/0), build, `npm run layout -- --quick` (84/84) zielone; złote hasze bez zmian (sim nietknięta; `forecast.ts` tylko czyta stan).
1. **Pieczęć przy liście (pytanie dnia 1)** — rysowana wektorowo (`public/assets/ui/kit/seal-press.svg`, ten sam wzór i kolory co `seal-full`), ostra przy 96 px na każdym dpr; małe pieczęcie zostają bitmapami w natywnych rozmiarach. D-72, `day2-seal-press.jpg` (lewa: nowa, prawa: stary sprite).
2. **Rzymskie numery w medalionach przy arabskim** — zostają celowo: wszystkie 17 tłumaczeń ma tytuły „I. …”, medalion powtarza numer z tytułu (dwa systemy liczb obok siebie byłyby gorsze). Komentarz przy `ROMAN_MISSION`. D-73.
3. **Stosy na podwórzach (10 modeli)** — geometryczny test (każdy trójkąt modelu co ~5 cm, pas drogi przy bramie 2,2 m, krawędź działki) znalazł 8 kolizji: worki młyna w drzwiach i na krawędzi, kosze piekarni w wylocie drogi, worki zboża przy progu, kosze rybaka na krawędzi, worki węgla w podstawie szałasu (szałas 0,4 m w tył), worki słodu przed drzwiami i w drewnie, beczki browaru w pasie drogi, lina żurawia „przez” bloki kamieniołomu. Wszystko przesunięte, test w `yard-piles.test.ts`; podglądy `yard-<rodzaj>` / `yardtop-<rodzaj>` w model-preview. D-74, `day2-yard-piles-before-after.jpg`.
4. **Ostatnie fazowane powierzchnie → zestaw UI**: ogniwa „Łańcucha przyczyn”, żetony Potrzebuje/Produkuje/Zamówienie, wiersze tempa, karty budowy, metki ducha i szkicu na mapie — karta `card-normal` (wciśnięta, aktywna dla samego budynku); przyczyna / pusty żeton / wąskie gardło / zła lokalizacja — `panel-alert` z winną krawędzią (lustro w RTL); zablokowane karty budowy — ta sama karta pod jasnym kreskowaniem (ciemny `card-disabled` zjadał nazwę i cenę). D-75, `day2-kit-cards.jpg`.
5. **Arkusz targu i rang** — pieczęci przy wymaganiach rangi (wciśnięta = spełnione), mosiężny rowek postępu i nasycenia, budynki na kartach zestawu. D-76, `day2-market-kit.jpg`.
6. **Pętla młyna (BACKLOG P3)** — 9 okresów łopat (5,22 s), szew między uderzeniami (0,58 s zamiast 0,28 s); przycięte z pliku w grze (Freesound niedostępny), przenikanie 0,25 s w tej samej fazie, `process_audio --check` PASS, hasze proweniencji zaktualizowane. D-77.
7. **Prognoza tempa dla listów z transzami (m5, m6; BACKLOG P3)** — bieżąca transza na liście przewozowym („Przy tym tempie: gotowe za M:SS / spóźnienie M:SS” + dostawca) i w karcie zamku (wiersze tempa, bez pieczęci i bez „na N pieczęci trzeba”), wobec terminu tej transzy; pokazywana, gdy okno 2 min leży w transzy — 0 fałszywych „spóźnień” na przebiegach bez akcji (było 18 / 14 próbek). Nowy klucz `why.pace.waitTranche` (PENDING_KEYS). D-78, `day2-tranche-pace.jpg`.
8. **Stosy przy spichlerzu i zamku (ciąg dalszy decyzji 15)** — spichlerz: dwa największe zapasy po bokach rampy (stałe beczki/skrzynie/worek usunięte); zamek z kontraktem: po stosie na każdy zamówiony towar w ogrodzonym placu, rośnie z dostarczonym udziałem (pełny stos = towar skompletowany). Stosy centrowane na rzeczywistym obrysie ładunku (beczki stały 0,5 m obok miejsca). D-79, `day2-castle-store-piles.jpg`.
BACKLOG: zamknięte P3 pętla młyna, P3 prognoza transz (zostaje strojenie okna po playteście), P1 „odmiana nazw towarów” (zrobione wcześniej: przypadek = nazwa klucza, testy `{param}` per język). Nowe klucze: `why.pace.waitTranche`. Następna decyzja: **D-80**.

## Decyzje dnia 2 (do właściciela)
1. **Księga przyczyn w grze?** `src/content/stallCodex.ts` ma gotowe PL/EN dla każdego statusu budynku i wozu (co znaczy, jak sprawdzić, 2–3 naprawy, przykład łańcucha), ale żaden ekran jej nie pokazuje. Propozycja: w arkuszu „Dlaczego stoi?” pod przyczyną zwinięte „Co to znaczy?” (jedno dotknięcie, treść dla statusu przyczyny); inne języki — EN do czasu paczki GPT. **Rekomendacja: tak, zwinięte domyślnie** (nie wydłuża arkusza; pomaga w diagnozie < 30 s przy pierwszym spotkaniu przyczyny).
2. **Rzymskie numery kontraktów także po arabsku/hindi/japońsku (D-73)** — zostawione celowo. **Rekomendacja: zostawić**; zmiana = tytuły i medalion razem w paczce tłumaczeń.
3. **Spichlerz bez stałych beczek i skrzyń (D-79)** — pusty spichlerz ma teraz pusty plac przed rampą (pełny pokazuje swoje dwa największe zapasy). Ocenić na telefonie. **Rekomendacja: zostawić** (stałe rekwizyty udawały zapas, którego nie było).
- **Decyzje dnia 2 (właściciel, 13:50):** Księga przestojów w „Dlaczego stoi?” — **tak, zwinięte „Co to znaczy?”**;
  cyfry rzymskie wszędzie — **zostają**; magazyn bez stałych rekwizytów — **zostaje**.

## Stan dnia 3 — 2026-11-03 (gałąź `claude/w-day3`, agent dzienny 3)
Każdy punkt: typecheck, `npm test` (412/0), build, `npm run layout -- --quick` (84/84) zielone; złote hasze bez zmian (sim nietknięta).
1. **Pętla `cart.cobble`** (resztka D-77) — przycięta z plików w grze do 3,514 s (11 uderzeń kół), przenikanie 0,1 s w sygnał sprzed cięcia; szew 0,32 s (OGG) / 0,35 s (M4A) zamiast 0,61 s przy uderzeniach co 0,23–0,38 s. Hasze proweniencji, `audio_sources.json`, ASSETS.md; `process_audio --check` PASS. D-80.
2. **Pauza w kontrakcie** pokazuje tytuł misji („I. Chleb i deski”) zamiast samego „Kontrakt”.
3. **Flex (Fold na pół otwarty, szeroki)** — otwarta karta zaczyna się pod żetonami czasu/srebra i tempem (wcześniej je przykrywała); strzałka samouczka nie idzie już przez wstęgę listu przewozowego (w Flex wybierała kierunek „w dół” przez tytuł; wstęga i rząd pieczęci są teraz przeszkodami — strzałka staje z boku). `day3-flex-arrow-sheet.jpg`.
4. **Pierścień samouczka** o 3 px szerszy — wewnętrzna linia z obwódką zasłaniała ostatnią cyfrę „0/20” przy krawędzi listu w poziomie.
5. **Wiersze „etykieta — wartość”** (karta wozu, list końcowy, karta zamku): etykiety wyrównane do środka wiersza, nie do linii bazowej — przy wartości z ikoną (ładunek, prędkość) albo 48-px linku (cel) etykieta spadała o pół wiersza. `day3-kv-align.jpg`.
6. **Błąd: listy z transzami (V, VI)** — pigułka mówiła „2:00 do śniegu”, licząc do terminu bieżącej dostawy (śnieg dopiero 11:00). Teraz „2:00 do dostawy 1” z klepsydrą; ostatnia transza (termin = śnieg) zostaje „do śniegu”. Nowy klucz `contract.toTranche` (PENDING_KEYS).
7. **Ostrzeżenia przed terminem transzy** — „Zostały 2 minuty — brakuje jeszcze N” liczyło cały kontrakt (48), nie bieżącą dostawę (12 z 18 chleba); teraz brak tej transzy, z klepsydrą, i cisza, gdy transza już skompletowana.
8. **Beczki piwa (błąd grafiki)** — losowy „obrót klepek” był odchyleniem całej beczki: na wozie wystawały do 1,11 m w bok (burty ±0,64), na placu browaru / spichlerza / zamku leżały krzywo. Teraz obrót wokół własnej osi; plac browaru 0,1 m w bok (test kolizji). D-81, `day3-beer-barrels.jpg`, widok `beercargo` w model-preview.
9. **Fold w pozycji książki (pionowy zawias)** — nic już nie leży na zgięciu: żetony i tempo ułożone w dwóch rzędach w prawym segmencie (w jednym rzędzie ≈ 460 px wchodziły w zawias), narzędzia szyny zwężają się w swoim segmencie tylko gdy trzeba (5 w kontrakcie: 76 px jak dotąd, 6 w dolinie: 64 px), karta „Najgorszy zastój” w drugim; komunikaty (toasty) w segmencie początkowym; notatka i strzałka samouczka omijają zgięcie (nowe zmienne `--book-start/--book-end`). RTL sprawdzony. `day3-book-crease.jpg` (czerwony pas = zawias).
BACKLOG: P3 `{n, plural}` zamknięte (sprawdzone — wszystkie liczniki z rzeczownikiem policzalnym już są blokami; „srebra” niepoliczalne); P2 misja X — po D-47 zostaje tylko pytanie po playteście (sonda: brak wozów czekających u drwala); Flex — częściowo (zostaje sprawdzenie na urządzeniu).
Nowe klucze: `contract.toTranche`. Następna decyzja: **D-82**.
