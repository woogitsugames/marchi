# Handover — MARCHIA (stan 2026-11-03, ~15:00 Europe/Brussels) — PRZEJĘCIE PRZEZ NOWĄ SESJĘ

> Sesja `session_01QWRid6hScCk3PSEu7RfFHs` kończy pracę (limit tygodniowy). Poniżej: stan, zasady, otwarte sprawy.
> Starsze sekcje niżej to historia dnia 2–3 XI (decyzje i stany nocy/dnia) — czytaj je jako kontekst.

## Stan teraz
- Repo `woogitsugames/marchi`, baza **`claude/eager-cori-08wt8e`** (nigdy `main`). Wszystko wypchnięte; drzewo czyste.
  Testy **412/412**, typecheck i build zielone, smoke I–XII + dolina bez błędów konsoli. Stan symulacji **v8**.
- Ostatnie APK: **e29f7f0** (~21:30, diagnoza day5 + samouczek/dolina day6). Kolejne: jedno rano.
  strzałka samouczka, Flex/Book posture, ostrzeżenia transz, beczki na wozie).
- **Zrobione (sesja `session_01Hk8EbiYMw1x9CXhyu3HM9n`):** WIP `1630083` z `claude/w-day3` dokończony i scalony —
  zwinięte „Co to znaczy?” (Księga przestojów, `src/ui/codex.ts`) w karcie budynku i wozu, dla przyczyny u korzenia
  łańcucha; inne języki czytają wpis EN (lang/dir=ltr, szewron fizyczny, `dir=auto` w RTL). Plus tempo dostawcy
  „4,9/min” obok towaru w poziomym liście. Nowy cykl: `trig_01TCkYqpaE2pikhXkeMNAEq9`. Właściciel: do **2 agentów Opus**
  naraz, jeden stale od researchu.
- Decyzje: ostatnia **D-79** w docs/DECISIONS.md (sprawdź, czy day3 dodał nowsze); następna wolna — sprawdź plik.
- GPT: oddane i scalone do 64; **czeka 65** (hindi, `docs/orders/gpt6-11b/`). 61 (grafiki sklepu) — właściciel: „zrobi kto
  inny, zapomnij”.
- Gałęzie do usunięcia: lista i polecenie w `docs/branches-audit-2026-11-02.md` — **z sesji Claude usuwanie jest
  zablokowane (proxy 403)**, robi właściciel.

## Zasady pracy (właściciel)
- Rozmowa po polsku; kod/komentarze/commity po angielsku; zasady `CLAUDE.md`.
- **Praca ciągła i autonomiczna z JEDNYM agentem Opus naraz** (koordynator też może kodować). Agent w worktree
  `/workspace/marchi-saves` (ręczny worktree + symlink `node_modules`), gałąź `claude/w-*`; koordynator scala do bazy,
  `npm run typecheck`, `npm test`, `npm run build`, smoke (skrypt Playwright: menu + `?play=m1…m12|sandbox&quality=low&dynres=0&speed=4`,
  0 błędów konsoli), `npm run layout -- --quick` (84 zadania, ~3,5 min), push.
- **CI ma limit minut**: `ci.yml` tylko ręcznie i przy otwarciu PR — nie dodawać kroków, nie zmieniać workflowów,
  sprawdzać lokalnie; agenci pushują rzadko (paczkami) i scalają bazę przed pushem.
- APK: w dzień (7–23) nie częściej niż co ~3 h, gdy istotnie lepsze; w nocy nic, jedno rano. `npm run setup:android`
  raz w kontenerze, `npm run apk -- --skip-web` (Maven 429 → ponawiać), SendUserFile.
- Decyzje właściciela: klikalnie (AskUserQuestion) z rekomendacją; w nocy zapisywać do „Decyzje na rano”.
- Nie zamykać PR-ów bez prośby. Commity kończyć `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` +
  `Claude-Session: <link nowej sesji>`.
- Limit 5-godzinny: przy ostrzeżeniu zatrzymaj agenta, zapisz WIP, wznów po resecie.
- Triggery: utwórz w nowej sesji godzinny cykl (min. odstęp 1 h) z promptem z sekcji „Prompt cyklu” niżej; stary cykl
  `trig_01SUuiU1pXy1yo2Wj2sfPrJx` jest **wyłączony**.

## Prompt cyklu (do create_trigger, „42 * * * *”)
Godzinny cykl MARCHIA (praca ciągła, jeden agent Opus naraz; koordynator też rozwija). Repo /workspace/marchi, baza
claude/eager-cori-08wt8e (nigdy main). 1) Agent w /workspace/marchi-saves: jeśli skończył/przerwany — scal (konflikty
BACKLOG/DECISIONS/i18n PENDING_KEYS: obie strony), typecheck, test, build, smoke, layout --quick, push; uruchom
następnego z kolejnymi pozycjami (HANDOVER „Plan”, potem backlog: błędy > wydajność > czytelność > modele/animacje >
treść). Jeśli pracuje — tylko sprawdzenie. 2) Nowe gpt/* — przejrzyj, scal, raport przyjęto/poprawiono/odrzucono.
3) APK w dzień co ~3 h, w nocy nic. 4) Decyzje: w dzień klikalnie, w nocy do HANDOVER. Raport krótki po polsku.

## Kolejka na start
00. **Z researchu „pierwsze 10 minut” (częściowy, `docs/research/2026-11-03-first-10-minutes.md`)** — po paczce day5:
   (1) sprawdzić, czy samouczek m1 krok 5 (most) się nie zacina — notatka zostaje z tekstem kroku 4, przeciągnięcia
   po duchu nie budują mostu (może artefakt skryptu/SwiftShader; jeśli prawdziwe — P0); (2) notatka samouczka zasłania
   list przewozowy (`placeNote`); (3) karta „Najgorszy zastój” z alarmem w trakcie samouczka (kroki 4–5); (4) brak
   „Następna misja” w liście końcowym (`buildEndLetter`); (5) menu na zimno: nic nie wskazuje misji I, „Ustawienia”
   pod ekranem 412×915; (6) karta zamku gęsta w kroku 2. Poziom i reszta ścieżki — nie zmierzone, ponowić.
0. **Decyzja właściciela 2026-11-03 ~18:00 (research partial-loads): A — reguła „dowóz dopiero, gdy zmieści się ≥4”
   tylko w wolnej dolinie**; misje i ich hasze bez zmian; przestroić progi rang 3–4 (~+10 %) i test F1, jedno zdanie
   na karcie warsztatu („czeka na pełniejszy wóz”). Spec: `docs/research/2026-11-03-partial-loads.md`. Następna paczka
   dewelopera po poprawkach audytu diagnozy (`claude/w-day5`).
1. Dokończ WIP `claude/w-day3` (Księga przestojów „Co to znaczy?”), scal, APK.
2. Scal GPT 65 (hindi) gdy przyjdzie; zdejmij przetłumaczone klucze z PENDING_KEYS (`npx tsx tools/i18n-reorder.ts`).
3. Czekają na właściciela: ocena postaci przy pracy (decyzja: dodać kolejnych po jego ocenie), benchmark Fold
   (`?debug=1&bench=device`, `?diag=1` → JSON do docs/PERF.md), motyw muzyczny końca kontraktu (Suno — właściciel).
4. Po playteście: łańcuch misji X do producenta, strojenie nagród zdarzeń doliny, okno prognozy tempa.
5. Dalej backlog (docs/BACKLOG.md).

---

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

## Stan dnia 4 — 2026-11-03 (gałąź `claude/w-day4`, agent dzienny 4)
Każdy punkt: typecheck, `npm test` (413/0, nowy `mud-pace`), build, zrzuty 412×915 / 915×412 / `?lang=ar`; złote hasze bez zmian (stan sim nietknięty; jedyna zmiana w `src/sim` to czysty odczyt `Slowdown.paved`).
1. **Pieczęć przy wygranym kontrakcie (D-82)** — pieczęć zamku wciskana teraz w **list przewozowy**, nie na środek ekranu: list podświetlony, mapa i reszta HUD przygasają, pieczęć schodzi 260 ms (skala 1,5 → 1 → 0,96, bez sprężynowania, cień z „uniesionego” na „przyciśnięty”), wosk rozlewa się raz, odcisk leży na towarach do listu (1,2 s). Złożony list → pieczęć na medalionie. Pieczęcie listu pokazują zdobyte (wcześniej trzy puste). `prefers-reduced-motion` → od razu list. Dźwięk: istniejący `contract.won` (`sfx/wax-seal`) gra w ticku wygranej z `bindings.ts` (zostawiony tam — test audio). Przegrana bez zmian. `day4-seal-*.jpg`.
2. **Błoto w karcie wozu (H4, D-83)** — „Błoto: 52% prędkości — na bruku 114%” / EN „Mud: 52% speed — on cobbles 114%” (roztopy: „Roztopy: …”); obie liczby wobec suchego tempa na tym odcinku (bruk szybszy także na sucho, więc >100%). Jedna linia, ikona obok, kolor atramentu, status zostaje „jedzie…”. Klucze `wagon.mudVsCobble`, `wagon.thawVsCobble`; `wagon.slowMud`/`slowThaw` martwe (do porządków słowników). `day4-mud-*.jpg`.
3. **Pełny magazyn (H5, D-84)** — w „Dlaczego stoi?” pod przyczyną ramka panel-alert: „8/8 drewna — brak miejsca na nowy towar” (albo „następna partia (2) się nie zmieści”), spichlerz „12/12 — brak miejsca na odbiór”; pod tym skutek i kto czeka („Na drewno czeka: Tartak”, linki 48 px). Budynek z pełnym magazynem u korzenia łańcucha — ten sam licznik z linkiem do niego. Żadnej nowej akcji: „Naprawa” jak dotąd (wóz / spichlerz tylko tam, gdzie misja pozwala budować). Klucze `why.full.*`; nowa funkcja `translated()` w i18n (fallback EN jako `lang=en dir=ltr`). `day4-full-*.jpg`.
Nowe klucze (PENDING_KEYS, paczka GPT): `wagon.mudVsCobble`, `wagon.thawVsCobble`, `why.full.out`, `why.full.outBatch`, `why.full.store`, `why.full.halted`, `why.full.refuses`, `why.full.waiting`, `why.full.blocked`. H4 i H5 w BACKLOG oznaczone `[~]` — zostają do potwierdzenia w playteście. Następna decyzja: **D-85**.
Do sprawdzenia przez koordynatora: pieczęć zasłania środek pasków towarów (w poziomie także ikonę drugiego towaru) — celowo „stempel na dokumencie”, ocenić na telefonie; zrzuty z SwiftShader (mało klatek), więc płynność 260 ms też do obejrzenia na urządzeniu.

## Stan dnia 5 — 2026-11-03 (gałąź `claude/w-day5`, agent dzienny 5)
Zadanie: naprawy z audytu diagnozy postojów (`docs/research/2026-11-03-diagnosis-audit.md`, rozdz. 5) w kolejności 1+2, 4, 3, 5, 6.
Każdy krok: typecheck, `npm test` (koniec: 423/0, nowy plik `diagnosis-audit-fixes`), osobny commit. **Złote hasze i `step()` bez zmian** —
wszystko w UI i w czytających funkcjach `src/sim/diagnose.ts` (`outputSurplus`, `heldWagon`, `isHeld`, `granaryRelief`, `busyOutOfReach`,
`contractFilled`); `tests/determinism-reads.test.ts` sprawdza, że odczyty między tickami nie zmieniają hasza (m1, m4, m6, m10, m12).
1. **Nadwyżka zamiast „brak wozu” + flota przy moście (D-85).** Pełny plac, na który nikt nie czeka (odbiorcy nie czekają na towar, zamek ma całe zamówienie, spichlerz nie prosi o kamień wg reguły dyspozytora) — postój spokojny: pinezka drugorzędna, bez wosku, karta „nadwyżka, nikt jej teraz nie potrzebuje”, w arkuszu zamiast „Kup wóz” linia „Nadwyżka: nikt teraz nie potrzebuje zboża, poczeka na placu. Nowy wóz tego nie przyspieszy.”. Dolina (rynek): wóz zostaje, ale bez wosku. Gdy ≥ 1/3 floty stoi przy moście / bez drogi, łańcuch „brak wozu” idzie do najbliższego takiego wozu → wskazówka lodu / zatoru, bez „Kup wóz”. Wskazówka zatoru także gdy zator jest w środku łańcucha.
2. **Kodeks (D-86).** „Co to znaczy?” objaśnia ostatnie ogniwo, które jest postojem (nie „Produkuje” ani „Jedzie po ładunek”); 67 % → 100 % trafnych.
3. **Pełny spichlerz (D-87).** Inny spichlerz bez drogi → łańcuch do niego i przycisk „Zbuduj drogę: 2 srebra” (m6/m12 przed lekcją: 76/85 % → 100 % próbek z przyciskiem); inny ma miejsce → spokojny, „Inny spichlerz ma jeszcze miejsce — nowy towar pojedzie tam:” z linkiem; żaden → „Postaw spichlerz” / wskazówka.
4. **`ALL_BUSY` bez dojazdu ze stajni (D-88).** Misja I przed mostem: zamiast „Kup wóz” przycisk mostu do gospodarstwa. `gapTarget` przeniesiony do `stalls.ts` (testowalny), re-eksport z `panels.ts`.
5. **Zamówienie wypełnione (D-89).** Węglarnia po dostarczeniu całego węgla: spokojna, „zamówienie wypełnione, reszta czeka”, bez wskazówki spichlerza (m10/nic: 86 % → 0 % wosku).
6. **Układ (D-90).** Linie spokojne stoją pod licznikiem pełnego magazynu, nad fałdą kodeksu (`.calm-hint`, atrament, link 48 px). Zrzuty `docs/shots/day5-*.jpg` (412×915, 915×412, `?lang=ar` — nowe klucze po arabsku z fallbackiem EN `dir=ltr`).
Wynik audytu po naprawach (tabela „Po naprawach” w raporcie): krytyczny najgorszy postój 282 → **189** z 635 próbek; m4 91 → 17 %, m6/lekcja 100 → 38 %, m10/nic 86 → 0 %, misje drogowe „nic” dalej 100 % (słusznie).
Nowe klucze (PENDING_KEYS): `fix.surplus`, `cause.surplus`, `fix.storeRoom`, `cause.storeRoom`, `fix.orderFilled`, `cause.orderFilled`. Następna decyzja: **D-91**.
**Do decyzji właściciela:**
- **m8** — kamieniołom dalej „pełno — brak wozu” z woskiem (70 %) i „Kup wóz” nie działa (0/14): spichlerz naprawdę prosi o kamień, ale wóz idzie najpierw do piekarni/tartaku. Rekomendacja: odczyt „W spichlerzu jest 12 kamienia — wystarczy na bruk” (UI, bez hasha), zmiana dyspozytora dopiero po playteście.
- **Dolina** — nadwyżka na rynek bez wosku (spadek 33 → 0 %). Rekomendacja: zostawić do playtestu.
- **Kodeks** przy nadwyżce dalej radzi „Kup wóz” (zwinięty, linia spokojna wyżej). Rekomendacja: osobne zdanie w kodeksie przy następnej redakcji treści.

## Stan dnia 6 — 2026-11-03 (gałąź `claude/w-day6`, agent dzienny 6)
Zadania: A — poprawki z badania „pierwsze 10 minut” (`docs/research/2026-11-03-first-10-minutes.md`), B — decyzja właściciela A
(niepełne ładunki tylko w dolinie), C — decyzja właściciela dla m8. Każdy krok: typecheck, `npm test` (koniec: **429/0**, nowe pliki
`tutorial-crossing`, `valley-top-up`, `m8-stone-stored`), zrzuty 412×915 / 915×412 / `?lang=ar`, osobny commit. **Złote hasze misji bez
zmian**; `npm run bot` (m1) identyczny przed i po (wygrana 8,85 min, 2 pieczęcie, 26 srebra).
1. **Krok 5 samouczka (most) — D-91, 58dc9b7.** Odtworzone prawdziwym dotykiem i myszą w Playwright (`tools/repro-step5.mjs`, zimny
   start). Werdykt: **stary tekst przy `current = 5` to artefakt skryptu** (krok zmienia się w obsłudze dotknięcia, notatka w następnej
   klatce; pod SwiftShader klatka trwa ~1 s, skrypt dotknął „Droga” drugi raz i wyłączył narzędzie → samouczek słusznie wrócił do
   kroku 4). **Nieudane przeciąganie to prawdziwy błąd:** duch był całą trasą tartak–zamek (62 pola, oba końce poza ekranem 412 px,
   początek pod notatką), a po karcie wozu kamera bywała daleko od rzeki. Teraz duch = tylko brakujące pola + po jednym polu drogi na
   końcach (17 pól), kamera raz pokazuje całą przeprawę, notatka jej nie zasłania; to samo przeciągnięcie buduje most i przechodzi do
   kroku 6 (pion: 3 przebiegi; poziom: sonda `?play=m1&tut=1` — most i krok 6). Przy okazji: notatka nie „jedzie” już przez listę
   przewozowy (bez przejścia `transform`), awaryjne miejsce notatki zasłania najmniej; w kroku 2–3 ogniwo łańcucha pod fałdą krótkiej
   karty jest przewijane do widoku.
2. **Karta „Najgorszy zastój” w notatkach 1–5 ukryta (D-92, 2692e51)** — pojawia się od notatki 6 albo po końcu/pominięciu samouczka,
   z jednorazowym błyskiem pierwszego postoju.
3. **„Następna misja” + menu (D-93, fab20b4)** — na liście wygranej (misje I–XI) główny przycisk z tytułem następnej misji; przy
   niedokończonym zapisie tej misji — przez arkusz pytania z menu. „Jeszcze raz” / „Do menu” zostają. Menu: „zacznij tutaj” przy misji I
   do pierwszej wygranej, „Ustawienia” w stopce ramki (412×915: y 839–887, bez przewijania), podtytuł misji I już nie powtarza tytułu.
4. **Dolina: dowóz od 4 sztuk (D-94, 753d21b)** — `topUpHold()` tylko w `sandbox`; brak nowego pola stanu → **bez podbicia wersji
   stanu (zostaje 8)**. Progi rang 3–4: 2500/6000 → **3000/7200** (+10 % lądowało na krawędzi okien: 40,5 / 71,4 min). Bot doliny
   (decent, 150 min): srebro 17 188 → **19 706**, rangi 10,1/26,6/45,9/77,9/122,8 → **10,4/22,3/42,8/76,3/108,7** min, przepływ 208 → 225;
   małe floty w 30 min ~8 % mniej (485 → 446, 474 → 438). Testy F1 i „audit fix 1” przestawione na scenariusz, w którym ich sytuacja
   nadal zachodzi (słodownia bez własnych pól; 7 wozów zamiast 30). Karta warsztatu: „Ma drewna na pracę; dowóz zamówi, gdy zmieści się
   4 — pełniejszy wóz, mniej kursów.” — status „Produkuje”, bez postoju.
5. **m8 (D-95, 8093591)** — kamieniołom czekający tylko na rezerwę kamienia spichlerza, gdy spichlerz ma już kamień: postój spokojny,
   „W spichlerzu jest 12 kamieni — wystarczy na bruk (12 pól). …”, bez „Kup wóz” (188/188 próbek w przebiegu bazowym). Dyspozytor bez zmian.
   Nadwyżka w dolinie zostaje jak jest (decyzja właściciela).
Zrzuty: `docs/shots/day6-*.jpg`. Narzędzia: `tools/repro-step5.mjs`, `tools/day6-shots.mjs`. Nowe klucze (PENDING_KEYS): `contract.next`,
`menu.startHere`, `menu.m1Sub`, `why.topUp`, `cause.stoneStored`, `fix.stoneStored`. Następna decyzja: **D-96**.
**Do decyzji właściciela:**
- **Progi rang doliny +20 % zamiast ~+10 %** (powód wyżej). Jeśli ma być bliżej +10 %, 2750/6600 przechodzi testy, ale z zapasem 0,5 / 1,4 min.
- **Samouczek ruszy kamerą raz** (krok 5), wbrew zasadzie m1.md „nie rusza kamery” — bez tego przeprawa bywała poza ekranem. Zaakceptować albo wskazać inną drogę (strzałka do krawędzi ekranu).
- **m8: kamieniołom spokojny** (bez wosku), nie tylko bez „Kup wóz” — spójne z D-85; jeśli ma zostać alarmem, to jedna linia w `calmStall`.
Do sprawdzenia na telefonie: notatka samouczka w poziomie w kroku 5 leży na pasku narzędzi (BACKLOG); pozostała część pomiaru pierwszych
10 minut (BACKLOG P2).

## Decyzje właściciela 2026-11-03 ~21:30
- Progi rang doliny 3/4 = **3000/7200** (+20 %, D-94) — zostają.
- Samouczek m1 krok 5: **jedno przesunięcie kamery nad przeprawę — akceptowane** (wyjątek od „nigdy nie rusza kamery”, D-91).
- m8: kamieniołom czekający na rezerwę kamienia — **spokojna pinezka** z linią „W spichlerzu jest N kamieni” (D-95) — zostaje.
- Od ~21:00 znów do 2 agentów Opus (deweloper + researcher).

## Stan dnia 7 — 2026-11-03 (gałąź `claude/w-day7`, agent dzienny 7; przerwane z powodu limitu użycia)
**Zrobione i zatwierdzone:** zadanie 1 — notatka samouczka w kroku 5 w poziomie nie leży już na „Droga” ani na
przycisku zamknięcia karty (D-96, 4ce0565). Sprawdzone przez `tools/repro-step5.mjs` (prawdziwe dotknięcia, zbudowana gra):
915×412 pl z kartą i bez, `?lang=ar`, 412×915; most nadal się buduje. Zrzuty `docs/shots/day7-tut-step5-*.jpg`.
Fold book/flex nie sprawdzone (narzędzie nie emuluje zawiasu, maszyna przeciążona). Typecheck OK, `npm test` **431/0**,
złote hasze bez zmian.
**Gotowe w drzewie roboczym, NIEZATWIERDZONE** (typecheck i 431/0 przeszły na tym drzewie; przed commitem dopisać
D-97…D-99 i zrobić zrzuty):
- Zadanie 2 — ranga 5 doliny 13 000 → **14 500** (`src/sim/defs.ts`; tabela rang w `docs/playtest/PROTOCOL.md` też
  poprawiona na 3000/7200/14 500). Bot DECENT: R5 108,7 → **119,7 min** (środek okna 105–135); próg 14 000 → 116,0,
  15 000 → 123,1. Ławka 180 min: „mixed” 106,5–108,7 → 117,7–119,7; z `--events` 87,5–90,0 → 95,3–96,9 (nadal poniżej okna,
  jak dotąd). Srebro, rangi 1–4 i pozostałe plany bez zmian. Rangi 3/4 zostają 3000/7200.
- Zadanie 3 — spokojny wariant kodeksu `OUTPUT_FULL.NO_WAGON` („Pełno — nic pilnego”, bez „Kup wóz”):
  `STALL_CODEX_CALM` w `src/content/stallCodex.ts`, sekcja „Wersje spokojne” w `docs/content/stall-codex.md`,
  `codexCalm()` w `src/ui/stalls.ts`, `codexHtml(…, calm)` w `codex.ts`/`panels.ts`, 2 nowe testy w `tests/stall-codex.test.ts`.
  m4: 898 spokojnych / 15 zwykłych próbek, m8: 340 / 139. Zrzut 412×915 obejrzany (`tools/day7-shots.mjs WHAT=codex`).
- Zadanie 4 — dwa podglądy prognozy na pieczęci w trybie zegarka, tylko z flagą `?sealpace=a|b` (`sealPaceHtml` w
  `src/ui/pace.ts`, `hud.ts`, CSS `.seal-pace*`, klucze `contract.sealPace.eta/.late` w PENDING_KEYS). A: „gotowe za 3:05”
  pod zegarem; B: trzy małe pieczęcie bez słów. Zrzuty 360×380 zrobione (`tools/day7-shots.mjs WHAT=flip`), jeszcze nie w
  `docs/shots/`. **Do decyzji właściciela: A czy B** (rekomendacja: A).
**Zostało:** zatwierdzić zadania 2–4 (każde osobno, z D-97/D-98/D-99), zrzuty `day7-codex-*`/`day7-flip-*` do
`docs/shots/`, BACKLOG (zamknąć P2 „notatka w poziomie” i P3 „kodeks Kup wóz”, przy P3 Flip dopisać warianty).

## Plan nocy 2026-11-03/04 (właściciel ~22:15)
- Przerwa do resetu limitu **01:50 Brussels**; budzik `send_later` 01:51 (`trig_01XbYzYTQ84hRVHD1m32jheV`); godzinny cykl
  `trig_01TCkYqpaE2pikhXkeMNAEq9` **wyłączony do resetu** — włączyć po wznowieniu, prompt: do 2 agentów Opus bez limitu godzin.
- Deweloper w nocy: **„wszystko po kolei”** — najpierw poprawki z `docs/research/2026-11-03-first-10-minutes-b.md`
  („Naprawa” zawsze widoczna w arkuszu, zwłaszcza w poziomie; krok 5 w poziomie — zamknąć kartę wozu, notatka omija
  `.rail-tools`; koniec samouczka wyłącza „Drogę”; przycisk naprawy nie znika przy odświeżaniu arkusza; sprawdzić,
  czy „oko → Naprawa” kończy misję I), potem reszta day7 (ranga 5 w dolinie, kodeks dla spokojnych przypadków, warianty
  Flip), potem backlog po kolei: czytelność → grafika/animacje (tartak, rolnik, rybak) → misja-lekcja kupna wozu → wydajność.
- Researcher w nocy: **balans misji I–XII** (boty na różnych strategiach, osiągalność 1/2/3 pieczęci po dzisiejszych zmianach),
  potem dokończyć pomiar „pierwszych 10 minut” (`node tools/first10-minutes.mjs 915x412`, potem `412x915`, osobno).
- W nocy bez APK (jedno rano), decyzje do „Decyzje na rano”.
- **Decyzje właściciela ~22:30:** Flip — **wariant A** (linia pod zegarem pieczęci, „gotowe za 3:05”) jako domyślny
  w trybie zegarka, wariant B usunąć; ranga 5 doliny **14 500** — zostaje.
- **Do zrobienia po wznowieniu (01:51):** `claude/w-day7` ma commit `87fdf14 WIP` (zadania 2–4 gotowe, testy 431/0) —
  rozdzielić na commity, dopisać D-97..D-99 w DECISIONS, zrzuty `day7-codex-*`/`day7-flip-*` do docs/shots,
  BACKLOG; włączyć wariant A domyślnie; scalić do bazy.
- **~22:40: dokończenie day7 + poprawki z first-10-b oddane innej sesji Claude Code** (prompt od właściciela; gałąź
  `claude/x-day7-finish` z `claude/w-day7`, PR do bazy). Po wznowieniu NIE robić tego samego: deweloper nocny bierze
  grafikę/animacje (tartak, rolnik, rybak) i misję-lekcję kupna wozu; scalić PR tej sesji, gdy przyjdzie.
- **~22:50 właściciel: także `main`.** Na zdalnym nie było `main` — utworzona z bazy. Po każdym zielonym scaleniu do bazy:
  `git push origin claude/eager-cori-08wt8e:main` (fast-forward). PR innych sesji kierować do bazy, scalać lokalnie lub przez
  GitHub, potem przesunąć `main`. Praca autonomiczna, ciągła, PR-y wolno otwierać.

## Stan day7-finish (inna sesja) — 2026-11-03 (gałąź `claude/x-day7-finish` z `claude/w-day7`, PR do bazy)
Sesja `session_01SPCeEK6Xe5W8fsR6UsUZeP`. Baza `claude/eager-cori-08wt8e` scalona do gałęzi (notatki właściciela ~22:30,
`docs/research/2026-11-03-first-10-minutes-b.md`; konflikt w HANDOVER — obie strony zachowane). `src/sim` zmienia tylko
próg rangi 5 doliny. Testy **432/0** (nowy `tests/m1-eye-fix.test.ts`), typecheck i build zielone, złote hasze bez zmian,
`npm run bot` (m1) identyczny: wygrana 8,85 min, 2 pieczęcie, 26 srebra. Smoke m1–m12 + dolina (`quality=low&dynres=0&speed=4`)
bez błędów konsoli; `npm run layout -- --quick` **84/84**.
**Zadanie A (day7, WIP 87fdf14 rozbity):**
- 8d22927 — ranga 5 doliny **14 500** (D-97): bot DECENT 108,7 → 119,7 min; przegląd 14 000 / 15 000 / 16 000 = 116,0 / 123,1 /
  129,1 min (rangi 1–4 i srebro bez zmian). Tabela w `docs/playtest/PROTOCOL.md`.
- 6bc9d09 — spokojny wpis kodeksu `OUTPUT_FULL.NO_WAGON` „Pełno — nic pilnego”, bez „Kup wóz” (D-98). Zrzuty `day7-codex-*`.
- b912dbe — tryb zegarka (Flip): „gotowe za 3:05” / „spóźni się 1:20” pod zegarem pieczęci **domyślnie**, bez flagi; wariant B
  i `?sealpace` usunięte (D-99). Zrzut `day7-flip-a-m3-360x380.jpg`. Linia tylko w trybie zegarka (`Hud.compact`), nie przy
  ręcznym zwinięciu listu na dużym ekranie.
- d65e529 — BACKLOG (zamknięte: notatka kroku 5 w poziomie, ranga 5, kodeks „Kup wóz”, Flip).
**Zadanie B (first-10-minutes-b; bez zmian w sim):**
1. **„Naprawa” przyklejona do dołu arkusza** (D-100, 66a2077) — wybrane zamiast przeniesienia nad łańcuch: przy ~136 px treści
   w 915×412 przeniesienie zasłoniłoby przyczynę; teraz nagłówek łańcucha i pierwsze ogniwo na górze, przycisk zawsze w widoku,
   reszta przewija się pod nim (miękkie wygaszenie, bez linii). Zmierzone `tools/fix-shots.mjs`: przycisk w widoku 915×412 pl/ar
   i 412×915. Zrzuty `day7-fix-before-915x412.jpg` i `day7-fix-dock-*.jpg`.
2. **Przycisk nie znika pod palcem** (05cbd71) — arkusz budynku i wozu w trzech częściach (`display: contents`), każda
   przerysowywana tylko przy zmianie własnego HTML; przy wciśniętym palcu odświeżenie czeka. `tools/fix-tap.mjs`: węzeł
   przycisku przeżywa odświeżanie przy ×1; dotknięcie buduje most (180 → 150), w m3 kupuje wóz (270 → 240, 4 → 5 wozów).
3. **Koniec samouczka i „Pomiń” wyłączają „Drogę”** (e6a93fd; `host.finish` w `src/ui/app.ts`). `repro-step5.mjs END=1/SKIP=1`:
   `tool: none` w 915×412 i 412×915.
4. **Krok 5: karta z kroku 3 zamyka się** (6522fd0; `tutorial.ts`). W poziomie notatka pod listem, pasek narzędzi wolny,
   most się buduje (pl i ar). Zrzuty `day7-tut-step5-915x412-nocard.jpg`, `…-ar-nocard.jpg`.
5. **„Oko → Naprawa” kończy misję I** — tak: `tests/m1-eye-fix.test.ts` (dotyk karty najgorszego zastoju + przycisk z arkusza)
   wygrywa przy reakcji co 10 s (10,6 min) i 30 s (9,7 min); co 60 s przegrywa (12:00). Przyczyna porażki w badaniu: przycisk
   pod fałdą i przerysowanie (dotknięcie nie trafiło, srebro zostało 150) — naprawione w 1–2. Pełnego pomiaru 10 minut w
   przeglądarce nie powtarzałem (SwiftShader, ~1 min na krok) — BACKLOG P2.
Nowe narzędzia: `tools/fix-shots.mjs`, `tools/fix-tap.mjs`, `tools/day7-shots.mjs`; `repro-step5.mjs` + `SKIP`/`END`.
Następna decyzja: **D-101**. Nowe klucze PENDING_KEYS: `contract.sealPace.eta`, `contract.sealPace.late`.
**Do decyzji właściciela:** w poziomie przyklejona „Naprawa” zasłania korzeń łańcucha (widać nagłówek i pierwsze ogniwo;
przyczynę podaje też karta „Najgorszy zastój”) — zostawić, czy w poziomie dodatkowo skracać łańcuch do korzenia?
Do sprawdzenia na telefonie: dok „Naprawy” przy prawdziwym przewijaniu palcem (Android WebView, `:has`), linia „gotowe za”
na okładce Flip.

## Decyzje na rano (noc 6, 2026-11-04) — z `docs/research/2026-11-04-mission-balance.md`
Misje I–XII nietknięte przez zmiany z 11-03 (45 strategii, te same hasze). Zmiany balansu do decyzji (zmieniają złote hasze):
1. **M1: 3★ nieosiągalne** (najlepszy plan 8,85 min przy progu 7:00). Propozycja P1: progi 3★/2★ → **9:15 / 10:45**. Rekomendacja: tak.
2. **M4: same wozy dają 3★** (5 wozów, 6,52 min). P3: srebro 180 → **140**, progi 7:30 / 10:00 → lekcja (lód/most) konieczna. Rekomendacja: tak.
3. **M2: lekcja zatoru na moście niewidoczna** — P4: karta „zatrzymane przęsło” z przyciskiem bruku (bez zmian haszy, robi deweloper) + próg 2★ → 10:00 (zmienia hasze). Rekomendacja: karta tak, próg po playteście.
4. **M8 za łatwa** (same wozy 3★ przy każdym srebrze ≥120, bruk skraca o 13 s) — P6: przeprojektować (kryterium: same wozy ≤2★, lekcja + 1 wóz 3★ z zapasem ≥20 s). Rekomendacja: tak, osobna paczka.
5. Liczba wozów działa chaotycznie (M4: 4 wozy 1★, 5 → 3★, 6 → 1★; M9: wozy z karty → porażka) — do zbadania przy P6.
Bez decyzji (robi deweloper, bez zmian haszy): P2 wyszukiwarka luk (węzeł po stronie dostawcy, bez ukośnych skrótów; M5/M6 rozsądny gracz → 3★), P5 karta „jeden producent dla dwóch odbiorców” (M9/M10), karta z P4.
