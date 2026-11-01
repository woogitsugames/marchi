# Integracja GPT-6 nr 1 — przegląd PR-ów (2026-11-01)

Gałąź: `claude/gpt-integration-1`, utworzona z `origin/claude/eager-cori-08wt8e` @ `7973e05`.
Każdy PR scalony `git merge --no-ff prN`; po każdym scaleniu `npm test` + `npm run typecheck`,
na końcu `npm run build`. Niczego nie pushowano na gałąź bazową; PR-y na GitHubie bez zmian (bez komentarzy).

Kryteria: CLAUDE.md (czysta, deterministyczna symulacja), lista „AI slop”, licencje (`docs/ASSETS.md`),
pliki zakazane w zleceniach (`src/sim/**` istniejące, `src/render/**`, `src/ui/**`, `src/main.ts`,
`src/i18n/pl|en|index.ts`, `android/**`), brak workflowów z zapisem/sekretami, brak telemetrii.

## Wyniki

| PR | Temat | Werdykt |
|---|---|---|
| #11 | Księga przyczyn (zlec. 16) | **przyjęto** |
| #13 | Projekt billingu (zlec. 25) | **przyjęto** |
| #14 | Tłumaczenia DE/FR (zlec. 23) | **scalono, potem wycofano** (`git revert -m 1`) — zastąpione przez #24/#26 |
| #15 | Protokół playtestu (zlec. 11) | **przyjęto** |
| #16 | Listy kasztelana (zlec. 17) | **przyjęto z poprawką** |
| #17 | Misja IV — kra (zlec. 12) | **przyjęto** |
| #18 | Misje jako JSON (zlec. 15) | **przyjęto z poprawką** |
| #19 | Nagrania CC0 Freesound (zlec. 18) | **przyjęto częściowo** (bez workflowu, bez binariów) |
| #20 | Ikona v3 (zlec. 19) | **przyjęto** |
| #21 | Audyt dostępności (zlec. 24) | **przyjęto z poprawką** |

### #11 — Księga przyczyn
- Przyjęto: `src/content/stallCodex.ts`, `docs/content/stall-codex.md`, `tests/stall-codex.test.ts`.
- Test parsuje `src/sim/types.ts` (TypeScript API) i wymusza wpis dla każdego `BuildingStatus`/`cause` i
  `WagonStatus` (w tym `WAITING_UPSTREAM`) oraz zgodność z plikiem Markdown. Same nowe pliki.
- Testy: 48/48.

### #13 — Billing
- Przyjęto: `docs/BILLING.md`, `src/platform/entitlements.ts` (interfejs + adapter wstrzykiwany, web zawsze
  „free”, zakup potwierdzany ponownym sprawdzeniem posiadania), `tests/entitlements.test.ts`.
- Brak instalacji wtyczek natywnych, brak zmian w `package.json`, brak zewnętrznych usług.
- Testy: 54/54.

### #14 — DE/FR — wycofane
- Najpierw scalono i dostosowano do D-18: brakujący klucz `status.WAITING_UPSTREAM`, bloki ICU-lite
  dla `road.cells`/`road.bridge*` (DE/FR) i `contract.stars` (FR), skrócone FR `tool.wagon`, test
  porównujący placeholdery z `en.ts`.
- Na polecenie koordynatora (nowsze PR-y #24 fr i #26 de w formacie D-18, integrowane osobno) cofnięto
  poprawkę i scalenie: `git revert ecab5b4`, `git revert -m 1 2914c64`. Na gałęzi nie ma `de.ts`/`fr.ts`.
- Uwagi dla #24/#26: sprawdzić `status.WAITING_UPSTREAM`, liczbę mnogą przy `{n}` + rzeczowniku
  (FR „1 sceaux”), długość FR „Acheter un chariot” (18 > 14 znaków).

### #15 — Protokół playtestu
- Przyjęto: `docs/playtest/PROTOCOL.md`, `results-template.csv`, wpisy w `docs/BACKLOG.md`
  (hipotezy H1–H5 wyraźnie oznaczone jako niezweryfikowane).
- Protokół uczciwie opisuje, że APK nie ma deep-linków do scenariuszy; zgoda uczestnika, bez danych osobowych.

### #16 — Listy kasztelana
- Przyjęto: `src/content/letters.ts`, `docs/content/letters.md`. Liczby zgodne z misjami (m1 30/20,
  m2 36/30, m3 24/16).
- **Poprawiono:** typ `Record<ContractMissionId, Record<Lang, …>>` nie kompilował się po rozszerzeniu
  `Lang` do 17 języków (D-18). Teraz wymagane są `pl` i `en`, pozostałe opcjonalne, z powrotem do
  angielskiego (`e7d5fc2`).
- Brak testu w PR; do rozważenia test długości tekstów.

### #17 — Misja IV (kra)
- Przyjęto: `src/sim/proposals/ice.ts`, `src/sim/proposals/m4.ts` (nowe pliki, deterministyczne,
  bez zabronionej matematyki, **niepodpięte** do `missions.ts`), `tests/m4-ice.test.ts`,
  `tools/bot-m4.ts`, `docs/missions/m4.md`.
- Workflow `.github/workflows/mission-m4-proposal.yml` pozostawiono: tylko `contents: read`, bez sekretów,
  bez pushowania (jak istniejący `mission-proposals.yml`).
- Bot: bazowo `won`, 6,12 min, 3 pieczęcie; wariant `--stone`: `won`, 5,61 min, 3 pieczęcie (bez kry).
- Testy: 58/58.

### #18 — Misje jako JSON
- Przyjęto: `missions/m1..m3.json`, `src/sim/missionData.ts` (walidator/parser), `tests/missionData.test.ts`.
- Testy dowodzą: JSON → `deepStrictEqual` z `MISSIONS[id]` i `ValleySpec`, identyczny teren, identyczny
  `stateHash` po 600 tickach względem `createWorld(id)` dla m1, m2, m3. Gra nadal **nie** ładuje JSON.
- **Poprawiono:** `Math.ceil` w `src/sim/` (spoza dozwolonej listy) → całkowity sufit przez `Math.floor`
  (`5384c5e`).
- Testy: 68/68.

### #19 — Nagrania CC0 Freesound
- **Odrzucono** `.github/workflows/cc0-audio-task18.yml`: `permissions: contents: write` i
  `git push` z CI (workflow sam commitował pliki do gałęzi).
- PR **nie zawiera plików audio** (miały powstać w tym workflowie). Przyjęto narzędzie
  (`tools/process_audio.py`, `tools/test_process_audio.py`, `tools/audio_sources.json`,
  `tools/audio-src/README.md`) i opis w `docs/ASSETS.md`.
- Licencje: wszystkie 11 stron Freesound (480020, 437092, 475483, 753925, 707527, 263583, 480042, 382642,
  537755, 681416, 263864) sprawdzono 2026-11-01. Każda pokazuje „Creative Commons 0”.
  Zwykły `curl` dostaje 403 (ochrona przed botami), więc sprawdzono przez narzędzie do pobierania stron.
- ID ścieżek zgodne z `src/audio/sounds.ts` (18 ID nagrań + 5 proceduralnych).
- Budżet: `process_audio.py --check` → 1 400 760 B / 4 MiB, 46 plików (obecne pliki).
- **Poprawiono:** w `docs/ASSETS.md` dodano status: źródła zatwierdzone, ale jeszcze niewyrenderowane.
  Obecnie dostarczane `sfx/*` to wciąż wersje z zadań 07/02. Do zrobienia: uruchomić
  `python3 tools/process_audio.py --only-freesound --fetch` lokalnie (poza tym kontenerem, Freesound blokuje
  automaty), odsłuchać i zacommitować z `docs/audio-provenance.json`.
- Testy Python: 9/9 OK.

### #20 — Ikona v3
- Przyjęto: nowe SVG (monogram „M” z konturów Grenze Gotisch, OFL, bez fontu w runtime), zasoby
  **wystawione w `art/out/`** (Android/iOS), `android/**` i `ios/**` nietknięte, arkusz v2/v3,
  wpis w `docs/ASSETS.md`.
- `npm run icons:check` → OK (art/out); `node tools/check-icons.mjs --native` → OK (zainstalowane ikony).
- Uwaga: `art/app-icon.svg` to już v3, więc `npm run icons` nadpisze natywne ikony v3. To decyzja właściciela.

### #21 — Audyt dostępności
- Przyjęto: `docs/a11y/AUDIT.md` (rzetelny: audyt kodu i zrzutów, nie certyfikat WCAG) i 5 podglądów CVD.
- **Poprawiono:** SVG zawierały zrzuty jako base64 (łącznie 2,7 MB). Zamieniono na odwołania
  względne `../shots/*.png` (ok. 2 KB każdy). Filtry `feColorMatrix` bez zmian.

## Testy końcowe
- `npm test`: `SUMMARY passed=68 failed=0 files=19`
- `npm run typecheck`: bez błędów
- `npm run build`: OK
- Sprawdzono pliki zmienione względem `7973e05`: brak zmian w `src/render`, `src/ui`, `src/main.ts`,
  `src/i18n`, `android/**`, istniejących plikach `src/sim/`. Brak telemetrii i analityki.

## Uwaga dla koordynatora
Gałąź bazowa przesunęła się w trakcie pracy (`5899910`). Próbne scalenie (`git merge-tree`) daje jeden
konflikt: `docs/BACKLOG.md` (tekstowy, prosty do rozwiązania).
