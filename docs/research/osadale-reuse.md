# Osadale -> MARCHIA: co przenieść, czego się nauczyć

Data przeglądu: 2026-11-01. Źródło: `/workspace/osadale` (tylko odczyt). Właściciel zezwolił na reuse kodu, rozwiązań i assetów.

## Najważniejsze ustalenie (zmienia oczekiwania)

**Osadale to gra przeglądarkowa/PWA (WebGL1, czysty JS, backend PHP/MySQL, hosting + Cloudflare), a nie aplikacja mobilna.**
W repo nie ma `android/`, `ios/`, Capacitora, bramki płatności (Play Billing/StoreKit), keystore, AAB, ProGuard, splash ani
obsługi składaków. Grep po `OPS_PRODUKCJA.md`, `PLAN_*`, `DECYZJE_DO_PODJECIA.md`, `manifest.json`, `build.js`, `prepare_release.py`
nie znajduje ani jednego trafienia na capacitor/gradle/aab/billing. Polityka prywatności osadale mówi wprost „gra nie obsługuje
zakupu Premium przez bramkę płatniczą” (PROJEKT_POLITYKI_PRYWATNOSCI.md §3.6); „Premium” to konto na własnym backendzie
(`backend/promo.php`, `premium_until`), nie zakup w sklepie. **Obszary 1 i 2 z zadania (Android/iOS, billing, Play Console) nie mają
w osadale nic do przeniesienia; MARCHIA jest tu już dalej** (Capacitor 8.6, APK, docs/store/*). Wartość osadale leży w
inżynierii jakości, testach, prawie/provenance, diagnostyce i lekcjach UX.

Kontekst, który trzeba mieć na uwadze: osadale używa emoji jako ikon (np. `src/ui/settlementMatters.js`: 🪵 💧 🎉 🛒), ma
12 języków w JSON ładowanych w runtime i czerpie z KaM Remake. **Nie kopiować UI, ikon ani modeli 3D** (reguły MARCHIA:
własny system wizualny, ikony drzeworytnicze, zakaz emoji; modele osadale to 248 MB `3d/`, inny silnik, własny pipeline Blender).

## Top 10 do przeniesienia (ranking)

| # | Co | Ścieżka w osadale | Wartość dla MARCHIA | Nakład | Priorytet |
|---|----|-------------------|---------------------|--------|-----------|
| 1 | Audyt pochodzenia muzyki/SFX + reguła „brak wpisu = brak w paczce” | `tools/audio_provenance_scan.js`, `docs/legal/audio_provenance.json`, `THIRD_PARTY_NOTICES.md`, `tests/test_third_party_notices_audio.js` | MARCHIA już używa 14 utworów z osadale; wszystkie to **Suno AI** (ID3 „made with suno”). Zanim wyjdzie wydanie sklepowe, potrzebny jest dowód praw (plan płatny, konto właściciela) i test CI | S | P1 |
| 2 | Bramka budżetu importu zapisu przed migracją + test wrogich zapisów | `src/save/budget.js`, `tests/test_save_hostile.js`, `src/save/CLAUDE.md` | `save.ts` migruje bez limitów rozmiaru/głębokości; zapis z IndexedDB/kopii zapasowej Androida może być uszkodzony. Osadale zmierzyło 1458 ms CPU na zapisie z 2 mln budynków przed odrzuceniem | S-M | P1 |
| 3 | Testy pomiaru układu z kontrolą pozytywną (przycisk pod zgięciem, kolizje prostokątów HUD, cele dotyku) | `tests/test_ux_firstscreen.js`, `tests/test_ux_touch_targets.js`, `tests/test_ux_hud_contrast.js`, `HISTORIA_WYDAN.md` v168 | MARCHIA ma zrzuty Playwright, ale ocena jest wzrokowa. Osadale: bateria 4400 testów nie wykryła, że „Zaczynajmy!” było poza ekranem; wykrył to dopiero pomiar prostokątów na 390x844. Wymóg MARCHIA: cele >= 48 dp, safe-area, 3 rozmiary | M | P1 |
| 4 | Dziennik komend + odcisk stanu jako pakiet zgłoszenia błędu (bez wysyłki) | `src/sim/replayJournal.js`, `src/sim/stateDigest.js`, `src/sim/rng.js`, `tools/replay_runner.js` | MARCHIA ma już komendy na granicy ticków i deterministyczny hash. Wystarczy „Skopiuj raport”: ziarno + lista komend + hash + wersja, odtwarzalna headless. Zero sieci, zgodne z obietnicą „bez śledzenia” | M | P2 |
| 5 | Scrubber adresów/tokenów w raporcie + allowlista pól przez deklarację | `tests/test_ux_bug_report_redaction.js` (blok `#417 LEG-06`), `replayJournal.js` (`REPLAY_STR_FIELDS` jako strażnik dwustronny) | Gdy raport dojdzie do pkt 4, nic poza deklarowanymi polami nie może wejść. Wzorzec „allowlista = deklaracja komendy, nie druga lista” | S | P2 |
| 6 | Tryb diagnostyczny `?diag=1`: histogram czasu klatki, percentyle, JSON do wklejenia | `src/runtime/diagStall.js` (czysta agregacja: `diagStallPercentile`, kubełki 8,4/16,7/33,4/50/100 ms) | Rozszerza istniejące `?perf=1` o protokół pomiaru na urządzeniu (składak 904x1000, DPR 2, jak backlog P1 „Składaki”). Zero kosztu bez flagi | S-M | P2 |
| 7 | Wizualizacja przepływów i telemetria sesyjna transportu (ograniczona) | `src/ui/logisticsLens.js` (max 48 węzłów / 32 krawędzie), `src/sim/logisticsTelemetry.js` (agregat po kluczu towar-źródło-cel, okno 1800 ticków, nie w save) | Bezpośrednio wspiera filar „diagnozuj przestoje”: backlog ma „Co teraz stoi?” i „Szukacz przerwy”. Pomysł agregatu zamiast surowej listy zdarzeń i twardych limitów pasuje do deterministycznego sim | M | P2 |
| 8 | Test A* względem niezależnej Dijkstry + stempel generacji + etykiety składowych jako early-out | `tests/test_pathfinding_stamp.js`, `HISTORIA_WYDAN.md` v107 (`computePfRegions`: 35% CPU -> 3%) | `findPath` MARCHIA już jest bez alokacji, ale nie ma testu optymalności z oracle ani brudnych buforów. Etykiety składowych dają darmowe `UNREACHABLE` i są bazą „Szukacza przerwy” | S-M | P2 |
| 9 | Testy dostępności: aria-live w drzewie a11y, rozmiar celu WCAG 2.5.8, reduced-motion | `tests/test_a11y_status_messages.js`, `tests/test_a11y_names.js`, `src/styles/99-a11y-last.css` | MARCHIA nie ma żadnego testu a11y. Z osadale: tylko 1 z 9 regionów `aria-live` było w drzewie dostępności; komunikaty tylko wizualne | M | P3 |
| 10 | Bramki dokumentacji: liczby w docs = kod; martwe klucze i18n; rozmiar plików | `tests/test_docs_claims.js`, `tests/test_i18n_reverse.js`, `tests/test_repo_size.js` | Backlog P4 zgłasza przestarzałe liczby w DESIGN.md/m2.md. Typowane słowniki PL/EN łapią brak klucza, ale nie klucz martwy ani literał w HTML. Bezpiecznik rozmiaru chroni przed wrzuceniem zrzutu 4K | S | P3 |

Pozycje poza top 10 (drobne): debounce zapisów ustawień z `flush` przy pauzie (`src/platform/storage.js`, w Capacitorze flush na
`App` `pause`), widoczny komunikat o nieudanej kompilacji shadera z logiem sterownika w `<details>` (`HISTORIA_WYDAN.md` v159 #80;
istotne dla czarnego ekranu w WebView Androida), archiwizacja wydania z manifestem SHA i odmową plików konfiguracji
(`tools/create_release_rollback.py`, `verify_release_package.py`, `release_provenance.py`; do adaptacji pod AAB + mapping R8).

## Szczegóły

### 1. Provenance audio (P1, prawo)
- Co: skaner czyta ramki ID3v2 każdego pliku, liczy sha256, zapisuje JSON; `--check` w CI czerwieni nowy plik bez wpisu. Reguła z `THIRD_PARTY_NOTICES.md`: „brak wpisu = zasób NIE MOŻE wejść do paczki”.
- Fakty z osadale: 68 utworów muzyki i 11 SFX to Suno AI; właściciel potwierdził 2026-09-14 (w `THIRD_PARTY_NOTICES.md`), że `wutkabxl` to jego konto i że pliki powstały na planie płatnym (Pro/Premier) 2026-07-08/09. Osadale **samo wycofało muzykę z paczki** (decyzja #148, odtwarzacz zewnętrzny) i nie ma jej w wydaniu.
- Adaptacja: napisać `tools/audio_provenance.ts` dla `public/assets/music/*` (14 plików, wcześniej transkodowane — **ID3 mogło zniknąć przy transkodowaniu**, więc zapisać sha256 źródłowych mp3 z osadale i mapowanie na pliki wyjściowe), wpis w `docs/ASSETS.md`.
- Ryzyko: status praw do dźwięku generowanego AI (autorstwo, regulamin Suno przy zmianie planu) nie jest rozstrzygnięty prawnie; to decyzja właściciela, nie kwalifikacja prawna. Google Play wymaga deklaracji treści AI w niektórych kategoriach; sprawdzić przed publikacją.

### 2. Budżet importu zapisu (P1)
- Co: `validateSaveBudget` jest czysty, nie mutuje wejścia, O(1) względem pól sterujących kosztem (długości list), głębokość bramkowana na wejściu; stoi PRZED migracją. Testy generują wektory w pamięci (nie jako pliki), wymuszają odrzucenie zapisu z przyszłej wersji bez zmiany obiektu.
- Adaptacja: `src/platform/save.ts` + nowy `tests/save-hostile.test.ts`: limity liczby budynków/wozów/długości łańcuchów, głębokość JSON, `__proto__`/`constructor` w kluczach, NaN/Infinity w liczbach (sim używa tylko `+ - * /`, więc NaN w stanie to niezmiennik do sprawdzenia), odrzucenie bez śladu w IndexedDB. Dołożyć sprawdzenie sumy kontrolnej stanu przy wczytaniu (hash z `determinism.test` już istnieje).
- Ryzyko: brak; kod osadale jest zależny od jego schematu (kafle, RLE), więc przenosimy zasady i testy, nie funkcje.

### 3. Pomiar układu (P1, UX)
- Co: trzy rozmiary, pomiar `getBoundingClientRect`, przecięcia prostokątów w px², kontrola pozytywna (wstrzyknięcie starego CSS musi czerwienić asercje; bez niej „0 kolizji” może znaczyć „nie mierzę”). Toast wstrzykiwany przez DOM, bo pusty kontener ma zerowy prostokąt. Bez porównania pikseli (kruche między wersjami SwiftShader).
- Adaptacja: `tools/layout-check.mjs` obok `tools/screenshots.mjs`, na rozmiarach 412x915, 915x412, 904x1000; sprawdzać: przyciski akcji w widocznym obszarze, brak przecięć HUD x arkusz x bąbelek, cele >= 48 dp (próg MARCHIA, wyższy niż 24 px WCAG), `env(safe-area-inset-*)`.
- Ryzyko: Playwright w kontenerze bez GPU renderuje WebGL wolno (osadale: ~770 ms/klatkę SwiftShader) — mierzyć DOM, nie renderować sceny; osadale odpala ciężką suitę wizualną tylko nocą i na PR (lekcja CI poniżej).

### 4-5. Raport błędu bez wysyłki (P2)
- Co: dziennik komend ze stałym formatem wersjonowanym; `parseReplayJournal` jest czystą funkcją tekstu, więc nie dotyka zapisu. Allowlista pól wynika ze struktury (iteracja po deklaracji pól komendy), a lista pól typu `str` jest dwustronnym strażnikiem (nowe pole `str` czerwieni test i wymusza decyzję).
- Adaptacja: `src/sim/commands.ts` ma już komendy; dodać `serializeJournal(seed, commands, hash, version)` i przycisk w Ustawieniach „Kopiuj raport” (schowek/udostępnij, bez sieci). Nie przenosić telemetrii `src/runtime/telemetry.js` ani GA4: osadale ładuje Google Analytics za zgodą (`osada_cookie_ok`) — **MARCHIA obiecuje brak śledzenia, więc nie wolno**. Z tego pliku brać tylko wzorzec „zgoda jest czynna; wyjątek storage = brak zgody”, gdyby kiedyś powstał opt-in.
- Ryzyko: odtworzenie między silnikami wymaga braku `Math.sin/cos/exp/pow` w sim — MARCHIA to już egzekwuje. Osadale zmierzyło, że `bob` jednostek (pole prezentacyjne) psuł odcisk; w MARCHIA stan nie powinien zawierać pól renderu.

### 6. Tryb diagnostyczny (P2, wydajność)
- Co: `?diag=1` (ściśle), własna pętla rAF tylko na czas pomiaru, protokół: ta sama scena, ×8, 90 s aktywnie + 30 s referencji na pauzie, wynik JSON (percentyle p50/p95/p99, histogram, najdłuższe LoAF). Brak localStorage dla flagi (żeby nie zostać w trybie pomiaru).
- Adaptacja: wyciągnąć `percentile`/histogram do `src/platform/frameStats.ts`; w kroku „Składaki” z backlogu użyć jako protokołu pomiaru na realnym Fold.
- Ryzyko: LoAF API nie istnieje w starszych WebView Androida; zostawić `PerformanceObserver` jako opcjonalny.

### 7. Wizualizacja przepływów (P2, diagnoza przestojów)
- Co z osadale: snapshot z twardymi limitami (48 węzłów, 32 krawędzie), producenci/odbiorcy/aktywne kursy, telemetria zbierana od nowa po wczytaniu (nie w stanie gry, więc nie zmienia sim ani budżetu zapisu).
- Adaptacja: u MARCHIA `StallReason` jest już daną; dołożyć agregat „towar-źródło-cel” w oknie czasu jako czyste dane z sim (nie z renderu), żeby lista „Co teraz stoi?” i „Szukacz przerwy” miały skąd brać liczby.
- Uwaga UI: kod osadale generuje HTML z emoji i `esc()`; **nie kopiować warstwy UI**, tylko moduł danych.

### 8. Pathfinding (P2)
- Co: test porównuje koszt trasy z niezależną Dijkstrą (optymalność, `null` = realna nieosiągalność), dowodzi że brudne bufory dają wynik bit w bit identyczny, a stempel generacji jest sprawdzany właściwie. Osobno: etykiety składowych spójności (`computePfRegions`) jako early-out, przeliczane z backstopem co 10 ticków i od razu po wycince/moście — dały -32 pp CPU przy ~350 jednostkach.
- Adaptacja: MARCHIA ma `netVersion`; etykiety składowych sieci dróg mogą rosnąć przy `road`/`bridge`, i wtedy `UNREACHABLE` jest O(1) bez przeszukiwania; łączy się z backlogiem „Replan wszystkich wozów w jednej klatce”.
- Ryzyko: osadale ma siatkę 14 400 kafli i kroki inne niż MARCHIA; przenosić zasadę i test, nie kod.

### 9. Dostępność (P3)
- Co: pomiar przez CDP `Accessibility.getFullAXTree`, czy regiony `aria-live` są w drzewie (kontener z `opacity:0` bywa pomijany); WCAG 2.5.8 (24 px minimum) mierzone po kliknięciu w panele (pomiar „na ekranie startowym” widział 16 z 410 kontrolek); `prefers-reduced-motion`.
- Adaptacja: MARCHIA wymaga 48 dp, więc próg wyższy; toasty i karty przyczyn przestoju muszą trafiać do czytnika (diagnoza = główna treść gry).

### 10. Bramki dokumentacji (P3)
- `test_docs_claims.js` weryfikuje twierdzenia w docs przeciw kodowi (np. zamrożone liczby przeżyły audyt, dopóki nie objęto nimi OPS_PRODUKCJA). Dla MARCHIA: test, że liczby w `DESIGN.md`/`missions/*.md` (start srebra, prędkości, czasy cykli) zgadzają się z `defs.ts`/`missions.ts`. `test_repo_size.js`: limit rozmiaru nowego pliku z opisaną listą wyjątków.

## Audio: muzyka i SFX (obszar 4)
- **Odtwarzacz muzyki w osadale nie istnieje jako system w grze.** Od decyzji #148 muzyka (68 mp3, 238 MB) nie wchodzi do wydania; gra otwiera panel z osadzonym odtwarzaczem Spotify/Deezer/YouTube Music po osobnej zgodzie (`osada_media_ok`). Brak playlist, crossfade ani formatów do przejęcia. Własny system muzyki MARCHIA (`src/audio/music.ts`, nastroje menu/gra/deszcz/wygrana/przegrana, 14 utworów) jest już lepszy.
- `assets/sfx/*.mp3` (11 plików, 40-108 KB, polskie nazwy: kupno, sprzedaz, awans, cel, budynek_gotowy...) to krótkie, melodyjne jingle Suno AI w stylu cozy. **Nie pasują** do realistycznej, „drzeworytniczej” palety MARCHIA (docs/AUDIO_INTEGRATION.md: CC0 foley, drewno/papier). Nie przenosić. Do rozważenia tylko `cel`/`awans` jako motyw wygranej misji, o ile właściciel zechce ton bardziej fanfarowy; wymaga wpisu provenance (#1).
- Pomysł do wzięcia: budżet kanałów `ui`/`ambient` z rezerwacją (`createAudioBudget`, `src/render/ambientAudio.js`: pula 4, rezerwa 2 dla UI, ambient nie może jej zająć) oraz tabela `SFX_FILES` jako jedno źródło nazw + test, że każdy plik istnieje (`tests/test_render_sfx_assets.js`; ścieżka sklejana w runtime była niewidoczna dla bramek, brakujący plik = cisza bez błędu). MARCHIA ma 4 pętle ambient i miksery wozów, więc budżet jest opcjonalny; test spójności nazw `sounds.ts` <-> pliki — tani i wart dodania.

## CI/CD i proces wydań (obszar 5)
- Osadale: pięć workflowów (`ci.yml` + sprzątanie runów/gałęzi + `prod-smoke.yml`), 435 testów w `tests/`, własny runner self-hosted. **Specyficzne dla PHP/hostingu; nie przenosić.**
- Lekcje do wzięcia: (a) dwa tiery CI: szybka bateria na każdy push, ciężka suita wizualna tylko nocą/PR/ręcznie (zmierzone: 13,5 min pracy niegraficznej vs ~70 min wizualnej; push dostaje werdykt w ~14 min zamiast ~2 h) — MARCHIA ma `ci.yml` + `apk.yml`, analogicznie trzymać `npm run shots` poza pushem; (b) test, który sprawdza, że każdy job CI ma jawną kategorię (`test_ci_coverage.js`); (c) archiwum wydania z manifestem SHA256, `RELEASE_PROVENANCE.json` i odmową plików z sekretami/konfiguracją — dla AAB: zapisywać `mapping.txt` R8, SHA AAB, `versionCode` i commit, żeby odtworzyć wydanie.
- Pipeline tekstur/modeli: osadale ma Blender (`tools/building_assets/*.py`, `generate_all.py`, `validate_all.py`) i GLB. Brak kompresji tekstur (KTX2/ASTC) do przejęcia — **żaden pipeline tekstur mobilnych tam nie istnieje**; MARCHIA ma własne `tools/textures`.
- Walidator modeli (`validate_building.py`) mógłby inspirować kontrolę budżetu trójkątów, ale to osobne zadanie i inny silnik (WebGL1 bez three.js).

## Zapis, chmura, błędy, analityka, i18n (obszar 3)
- Zapis: osadale = JSON w `localStorage` + serwerowy `save_shadow` w MariaDB, `src/save/migrate.js` z self-init pól. Zasada do wzięcia: przy każdym nowym polu rozstrzygnąć „persistent / runtime-only / pochodne” i mieć fixture legacy (nie usuwać starych fixture'ów; dodać do `tests/saveload.test.ts`). Chmura zapisu: serwer osadale — **nie dotyczy** (MARCHIA offline; Android Auto Backup i tak kopiuje IndexedDB, zob. backlog `allowBackup`).
- Analityka: osadale używa GA4 za zgodą (pseudonimowa, polityka sama ostrzega, by nie nazywać jej „anonimową”). MARCHIA: **nie przenosić**. Wartościowy jest tylko ten zapis w polityce: nie obiecywać „anonimowości”.
- Raporty błędów: patrz #4-5 (osadale wysyła je na własny backend `bug_reports` i miało wyciek tokenów resetu w URL; lekcja: trzy kanały wycieku — `location.href`, `ErrorEvent.filename`, ramki `stack`; w MARCHIA bez sieci ryzyko mniejsze, ale schowek też jest kanałem).
- i18n: osadale = 12 JSON w runtime + 3 testy (kompletność, martwe klucze, wyciek polskiego tekstu). MARCHIA (typowane słowniki, D-11) jest silniejsze dla braków; brakuje tylko wykrywania martwych kluczy i literałów (#10).

## Monetyzacja i sklep (obszar 2)
- Nic do przeniesienia kodowo. Z dokumentów osadale warto wziąć tylko: (1) politykę „plan płatności ujawniony w polityce **przed** uruchomieniem”; (2) szkielet polityki prywatności z załącznikiem „bramy: nie publikować, dopóki…” (`PROJEKT_POLITYKI_PRYWATNOSCI.md`, sekcje A-B) jako wzorzec checklisty przed publikacją — treść RODO osadale (konta, ranking, czat, Turnstile) nie dotyczy MARCHIA; (3) decyzja „próg wieku jedną liczbą w trzech plikach” (v169) — dla MARCHIA sprawdzić deklarację grupy wiekowej w Play Console.
- D-10 (darmowe + jednorazowy zakup, bez reklam/energii/timerów): do implementacji potrzebne Play Billing Library (nie ma w osadale), przywracanie zakupów i test na koncie testowym; zalecenie spoza osadale: wtyczka Capacitor z natywnym `BillingClient`, jednorazowy produkt `inapp`, weryfikacja lokalna (bez serwera, jeśli „bez śledzenia”).

## Lekcje projektowe/UX (obszar 6; tylko mechanika)
- **Test „oczy nowego gracza” > bateria testów**: przycisk startu był poza ekranem przez cały czas życia gry mimo tysięcy testów (v168); dla MARCHIA: playtest pierwszych 3 minut na telefonie z kimś, kto gry nie zna, przed każdym wydaniem; kolizje HUD z samouczkiem (`#msgs` x `#tutBox`: 8096 px²) usuwa się rozdzieleniem elementów, nie z-indexem.
- **Samouczek zakotwiczony jednym kierunkiem** (dołem nad dokiem), toasty u góry; dwa elementy liczone od dołu dają kruchy stos.
- **Skrót klawiszy ukryty na telefonie** (8 wierszy skrótów myszy robiło z karty startowej 1367 px treści): w MARCHIA nie pokazywać pomocy dla niedostępnych urządzeń.
- **Wynik negatywny zapisany wprost** (v165-v167: hipoteza obalona pomiarem, „czujnik zamiast nieudowodnionej naprawy”): wzorzec dla backlogu wydajności MARCHIA (pomiar -> poprawka, nie odwrotnie).
- **Oś postępu jako dane deklaratywne** (`PLAN_GRA_NA_LATA.md` §1: nowy kamień milowy = jeden wiersz danych): pasuje do backlogu „misje do JSON walidowanego testem”.
- **Czego NIE brać (dark patterns / poza zasadami MARCHIA)**: seria dzienna w niebezpieczeństwie, push „wróć jutro”, nagrody dzienne, Premium na 90 dni dla rejestrujących się, ranking i czat graczy (`PLAN_GRA_NA_LATA.md` §3; `DECYZJE_DO_PODJECIA.md` A4). Retencja w MARCHIA ma wynikać z diagnozy i misji, nie z przymusu powrotu.
- **Dokumenty-„żywe listy” szybko tracą prawdę**: sam osadale opisał pozycje „otwarte”, które były zrobione, i dopisał ramki ostrzegawcze „stan pliku — przeczytaj, zanim uznasz za aktualny”. Dla MARCHIA: BACKLOG.md porządkować przy każdej fali, daty przy pozycjach, test docs-claims (#10).

## Ryzyka zbiorcze
- Różne silniki: osadale = własny WebGL1 i czysty JS; kod renderu, pętli i modeli **nie nadaje się** do przeniesienia (three.js, TS strict).
- Licencje: kod osadale „wszelkie prawa zastrzeżone” (właściciel pozwolił); fonty OFL-1.1 (Manrope, Marcellus, JetBrains Mono — wolno, z zachowaniem licencji, ale MARCHIA ma własny system typografii, więc raczej nie); ikony Lucide (ISC) — **MARCHIA zabrania niezmodyfikowanych ikon z popularnych paczek**; muzyka i SFX Suno AI (patrz #1); portrety doradcy (`assets/advisor/*.webp`) mają status „DO UZUPEŁNIENIA” w notices — **nie używać**.
- Wielkość: nie kopiować katalogów `3d/` (248 MB), `music/` (238 MB), `work/`, `archiwum/`, `audyt/`.
