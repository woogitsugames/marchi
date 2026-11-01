Repozytorium: woogitsugames/marchi. Gałąź bazowa: claude/eager-cori-08wt8e (zrób `git pull`, dużo się zmieniło).
Pracuj na własnych gałęziach (jedna na zadanie): claude/s2-missions, claude/s2-asset-pack, claude/s2-save-hardening,
claude/s2-replay — i na końcu każdej otwórz PR do claude/eager-cori-08wt8e. Możesz robić zadania równolegle
przez własnych subagentów (osobne worktree). Komunikuj się po polsku, kod i komentarze po angielsku.
Przeczytaj CLAUDE.md, docs/DESIGN.md, docs/DECISIONS.md (zwł. D-13…D-18), docs/BACKLOG.md, docs/reviews/*.md.

NIE edytuj (inne sesje/agenci pracują tam teraz): src/ui/**, src/main.ts, src/styles/**, src/render/**, index.html,
android/**, public/assets/textures/**, src/i18n/index.ts. Teksty dla gracza: dodawaj klucze do src/i18n/pl.ts i en.ts
(i wpisz listę nowych kluczy w opisie PR — pozostałe 15 języków uzupełnimy osobno). `npm test` i `npm run typecheck`
muszą przechodzić; symulacja zostaje deterministyczna (zasady z CLAUDE.md, testy determinizmu i fuzz z tests/).

ZADANIE 1 — Misje IV–VI w silniku (gałąź claude/s2-missions)
- Propozycje GPT są w repo: src/sim/proposals/ (lód — M4), docs/missions/m4.md, oraz zlecenia 13/14 (jarmark z transzami,
  ciasny spichlerz) w docs/orders/gpt6-03/ — jeśli PR-y GPT dla m5/m6 jeszcze nie weszły, zaprojektuj sam wg tych zleceń.
- Wdróż mechaniki w src/sim: (a) zamknięcie przeprawy w oknie czasu (lód) z nowym powodem przestoju wozu
  `BRIDGE_CLOSED{span, until}` widocznym w explainWagon/explainBuilding i uwzględnionym w routingu (koszt = czekanie
  do otwarcia lub objazd); (b) kontrakt w transzach (lista {need, deadlineTick}), list przewozowy w stanie, checkMission;
  (c) pojemność spichlerza per budynek (np. pole `capOverride` lub wariant), z zachowaniem kompatybilności zapisów:
  podbij STATE_VERSION i dodaj migrację w src/platform/save.ts (MIGRATIONS) + test migracji.
- Zarejestruj m4, m5, m6 w src/sim/missions.ts; balans narzędziem tools/balance.ts (dopisz strategie): „nic” = 1 pieczęć,
  właściwa naprawa = 3, częściowa = 2, czas 5–12 min; testy w tests/missions.test.ts zabezpieczające lekcje.
- Klucze i18n (pl/en) dla nowych statusów i nazw misji (menu.m4…m6, menu.m4Sub…). UI menu dopniemy sami.

ZADANIE 2 — Pakiet tekstur 4K do pobrania (gałąź claude/s2-asset-pack), decyzja D-17
- W APK tylko 2K; 4K leży poza buildem w `assets-ultra/` (inny agent właśnie to przenosi i tworzy
  `assets-ultra/manifest.json` z path/bytes/SHA-256 i wersją pakietu; `src/render/textures.ts` dostanie `setUltraBase(url)`).
- Napisz NOWY moduł src/platform/assetPack.ts: pobieranie pakietu (URL bazowy w configu — na razie placeholder
  + tryb dev z lokalnego serwera), zapis do pamięci aplikacji przez @capacitor/filesystem (dodaj zależność; na web —
  Cache Storage), weryfikacja SHA-256 (SubtleCrypto), wznawianie, postęp (callback), usuwanie, wersjonowanie pakietu,
  zwrot bazowego URL-a (Capacitor.convertFileSrc) do przekazania do setUltraBase. Testy jednostkowe logiki (mock fetch/fs).
- Opisz w docs/ASSET_PACK.md hosting (np. GitHub Releases / CDN), Play Asset Delivery jako alternatywę (porównanie),
  i dokładnie 10–15 linii integracji z UI (zrobimy sami).

ZADANIE 3 — Utwardzenie zapisów (gałąź claude/s2-save-hardening)
- Wzorem osadale (docs/research/osadale-reuse.md, pozycja „budżet importu zapisu”): bramka przed migracją
  w src/platform/save.ts — limity rozmiaru JSON, liczby budynków/wozów/komórek, typów pól, zakresów (np. cellIndex < W*H),
  bez mutowania wejścia, czytelny błąd; „wrogie” zapisy w tests/save-hostile.test.ts (ogromne tablice, NaN, ujemne stany,
  brakujące pola, stary format). Plus złoty hash terenu: zapis przechowuje hash wygenerowanego terenu, a wczytanie
  sprawdza, że generator daje to samo (ochrona przed zmianą generatora) — z migracją.
- save.ts używa IndexedDB (DOM) — logikę walidacji wydziel do czystego pliku testowalnego w Node.

ZADANIE 4 — „Skopiuj raport” i odtwarzanie (gałąź claude/s2-replay)
- Wzorem osadale (replayJournal/stateDigest/replay_runner): moduł src/sim/replay.ts — format raportu
  {version, missionId, seed, journal: GameLoop.journal (tick+cmd), checkpoints: [{tick, hash}], finalHash}, kompresja
  (np. deflate przez CompressionStream w UI; w sim tylko czysty JSON), allowlista pól (zero danych osobowych).
- tools/replay.ts: odtworzenie raportu w Node, porównanie hashy na checkpointach, wskazanie pierwszej rozbieżności.
- Testy: nagraj sesję bota z kilkoma komendami → raport → odtworzenie daje identyczne hashe; zmodyfikowany raport
  wykrywa rozbieżność. Opisz 5 linii integracji z UI (przycisk w menu pauzy, zrobimy sami).

Na końcu: raport po polsku dla właściciela (co zrobione, wyniki testów, linki do PR-ów, ryzyka).
