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
Zrzuty `docs/shots/night3-*.jpg` (4). Następne decyzje od **D-63**.
