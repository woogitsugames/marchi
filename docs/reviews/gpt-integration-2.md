# Integracja GPT-6 — runda 2 (PR #43–#47)

Gałąź `claude/gpt-integration-2` (baza `claude/eager-cori-08wt8e` @ 25ca514). Każdy PR scalony `--no-ff`;
po każdym scaleniu `npm test` i `npm run typecheck`, na końcu `npm run build`.
Na GitHubie nic nie scalano ani nie zamykano.

## #47 — tłumaczenia, paczka 05 (15 języków)

- **Przyjęto:** `src/i18n/{de,fr,es,it,pt_BR,nl,sv,tr,ru,uk,ja,ko,zh_Hans,ar,hi}.ts` (143 klucze w kolejności z `pl.ts`),
  słowniczki `docs/i18n/glossary-*.md`, zaostrzone testy `tests/i18n-<lang>.test.ts` (kolejność kluczy jak w `pl.ts`,
  brak pustych tłumaczeń). `pl.ts`, `en.ts`, `index.ts` nietknięte.
- **Sprawdzono:** wszystkie 143 klucze są we wszystkich 15 słownikach; placeholdery zgodne z angielskim, bloki
  `{n, plural, …}` mają gałąź `other` i domknięte nawiasy.
- **Poprawiono:** `PENDING_KEYS` w `src/i18n/pl.ts` wyczyszczone (143 → 0; mechanizm zostaje na kolejną rundę).
  **Odrzucono** zmianę `tests/i18n-keys.ts` (PR zastąpił widok „bez PENDING_KEYS” pełnymi słownikami — następna runda
  nowych kluczy wysypałaby wszystkie testy językowe); przywrócono wersję z filtrem.

## #46 — misje VII–IX (propozycja)

- **Przyjęto:** `src/sim/proposals/missions-7-9.ts`, `tools/bot-m7.ts…bot-m9.ts`, `tools/bot-missions-7-9.ts`,
  `docs/missions/m7.md…m9.md`, `docs/content/letters-7-9.md`, `tests/missions-7-9.test.ts`. Misje **niezarejestrowane**.
  Brak `Math.random`/`Date`/trygonometrii.
- **Odrzucono:** zmiany istniejących plików sim — `src/sim/commands.ts` (`roadStoneCost` dla `mission.id === 'm8'`)
  i `src/sim/logistics.ts` (rezerwa kamienia w spichlerzach dla `m8`). Zakaz z zlecenia; poza tym id misji wpisane
  w kod sim zamiast danych. Właściwy hak: pole `MissionDef` (np. `roadStone?: boolean`) dodane razem z rejestracją.
  Odrzucono też workflow `.github/workflows/mission-7-9-proposal.yml` (nieszkodliwy, `contents: read`, ale zbędny —
  `ci.yml` uruchamia `npm test`, który zawiera test akceptacyjny).
- **Poprawiono:** test akceptacyjny wykrywa hak (`roadStoneCost(m8) > 0`); bez niego pomija tylko sprawdzenia
  kamienia w VIII (sprawdzone: z łatką z PR wszystkie 9 testów przechodzi, bez łatki — też, z pominięciem).
  Usunięto wartościowy import `valleySpec` z `missions.ts` (przy rejestracji powstałby cykl importów i błąd TDZ
  `VALLEY_W`); teraz `M8_SEED = 1301`, import tylko typu. Notatka o haku w `docs/missions/m8.md`.
- **Rejestracja (sprawdzona na próbę: typecheck + pełne `npm test` zielone), w `src/sim/missions.ts`:**

  ```ts
  import { PROPOSED_MISSIONS_7_9 } from './proposals/missions-7-9';
  MISSIONS.m7 = PROPOSED_MISSIONS_7_9.m7;
  MISSIONS.m8 = PROPOSED_MISSIONS_7_9.m8;
  MISSIONS.m9 = PROPOSED_MISSIONS_7_9.m9;
  ```

  Do pełnego wejścia potrzebne też: hak kamienia dla VIII, `MENU_MISSIONS` w `src/ui/menu.ts`,
  `ContractMissionId` + listy w `src/content/letters.ts` (teksty w `docs/content/letters-7-9.md`), klucze i18n.
  Propozycja używa istniejących `mapId` (`valley-m2`, `valley1`, `valley-m3`); do rozważenia własne aliasy
  `valley-m7…m9` w `MAP_SPECS`, jak przy IV–VI.

## #45 — opisy sklepu

- **Przyjęto w całości.** Wszystkie `play-*.md`, `appstore-*.md`, `privacy-*.md`, `data-safety.md`,
  `screenshots-plan.md`: gra darmowa, bez reklam i bez zakupów; brak „pełnej wersji / jednorazowego zakupu”
  (grep pusty); Wolna dolina, 3 sloty, rangi do Stolicy, nowe łańcuchy. Limity znaków zachowane
  (Play: krótki opis ≤ 74, pełny ≤ 2255 z 4000; App Store: tytuł/podtytuł ≤ 29, tekst promocyjny ≤ 145).

## #44 — pory roku (propozycja)

- **Przyjęto w całości:** `src/sim/proposals/seasons.ts` (czyste funkcje `seasonAt`, `effectsAt`, `nextChange`;
  tylko `Math.floor` i arytmetyka, bez RNG/zegara), `tests/seasons.test.ts`, `docs/design/seasons.md`.
- **Do podpięcia (wg `docs/design/seasons.md` §2, tylko `mission.id === 'sandbox'`):** `sim.ts step()` (jedno
  `effectsAt(st.tick)` na tick), `sim.ts produce()` (próg cyklu farmy/rybaka z procentów), `contract.ts iceUntil()`
  (złożenie `state.ice` z `closedBridgeUntilTick`, bez zapisu do stanu), `wagons.ts iceBlocks()` (bez zmian — używa
  `iceUntil`), `network.ts cellSpeed()/edgeCosts()/dijkstra()` (osobna flaga roztopów, tylko grunt), `town.ts
  unitCents()/quoteCents()` (jarmark +25 % na piwo), `diagnose.ts` (wyjaśnienia), i18n PL/EN.

## #43 — dźwięki nowych łańcuchów („binaries pending”)

- **Przyjęto:** `tools/process_audio.py` (kontrola katalogu z manifestu, walidacja ID/ścieżek), testy
  `tools/test_process_audio.py`, wpisy źródeł CC0 w `tools/audio_sources.json`, `tools/audio-src/README.md`,
  sekcja w `docs/ASSETS.md`. Brak workflowów CI, sekretów i pushy.
- **Poprawiono:** 13 niewyrenderowanych ścieżek przeniesiono do `pending_tracks` (walidowane, nie renderowane
  ani nie sprawdzane), więc `python3 tools/process_audio.py --check` przechodzi na 46 dostarczonych plikach
  (z PR w obecnej postaci padało). Tekst `docs/ASSETS.md` dopasowany (bez „do not merge / must fail”).
- **Odrzucono:** 13 nowych wpisów w `src/audio/sounds.ts` — pliki nie istnieją. Dodać razem z binariami.

## Wyniki

| Krok | Wynik |
|---|---|
| po #47 + czyszczenie PENDING_KEYS | `SUMMARY passed=206 failed=0 files=43`, typecheck OK |
| po #46 (+ poprawki) | `SUMMARY passed=215 failed=0 files=44`, typecheck OK |
| po #45, #44 | `SUMMARY passed=224 failed=0 files=45`, typecheck OK |
| po #43 | `SUMMARY passed=224 failed=0 files=45`, typecheck OK; `process_audio.py --check` PASS (46 plików, 1 400 760 B); `unittest` 12/12 OK |
| `npm run build` | OK |
