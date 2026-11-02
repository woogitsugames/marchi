# Odporność zapisów po zmianach z 2026-11-02 (D-36, D-44, D-50)

Zakres: `src/platform/save.ts`, `saveGate.ts`, `slots.ts`; IDB v2 + store `meta`, STATE_VERSION 7.
Metoda: `fake-indexeddb`, nowy plik testowy `tests/save-robustness.test.ts` (21 testów, wszystkie zielone na obecnym kodzie;
`npx tsx tests/run.ts save-robust`). Kod w `src/` bez zmian. Przypadki, które ujawniły błędy, są niżej jako fragmenty
(nie zacommitowane jako testy, bo by padały).
Uwaga: w `tests/fixtures` jest tylko jeden fixture (v6, `save-v6-m2-sold-wagon.json`); v4/v5 powstają przez `downgrade()` stanu
bieżącego (jak w `save-chain.test.ts`), v6 dodatkowo przez usunięcie `Wagon.n` i `nextWagonN`.

## Wyniki

| # | Przypadek | Wynik | Dowód |
|---|-----------|-------|-------|
| 1a | v4/v5/v6 × m2/m5/sandbox w starym slocie `auto` -> `adoptLegacySaves` -> `loadGame` -> 400 ticków | OK, hash = bieg bez przerwy, invarianty OK, po zapisie wersja 7 | testy `robust: vN <id> in the legacy 'auto' slot...` (9 sztuk) |
| 1b | Prawdziwy fixture v6 w `auto` (kontrakt m2) | OK -> `auto-m2`, migracja do v7 | test `the real v6 fixture...` |
| 1c | `auto` z grą doliny: pierwszy wolny ledger; wszystkie 3 zajęte -> `auto` zostaje | OK | ten sam test |
| 2a | DB v1 z 2 zapisami -> v2: meta uzupełnione = envelope bez `state`, sort od najnowszego | OK | `v1 -> v2 upgrade backfills meta...` |
| 2b | Nowa baza (v0->v2) | OK, pusta lista, `loadGame` = null | `a fresh database...` |
| 2c | v1 z rekordem bez `savedAt` | BŁĄD B4 (sort NaN psuje kolejność poprawnych zapisów) | snippet B4 |
| 3a | Rzut wyjątku z `put(state)` po `put(meta)` (DataCloneError) | BŁĄD B3: osierocone / niespójne meta | snippet B3 |
| 3b | Abort transakcji po `put` (symulacja quota) | OK: oba store wycofane, stary zapis i meta zgodne; odrzucenie ma wartość `null` (B5, drobne) | probe |
| 3c | `make()` rzuca przed `put` | OK, nic nie zapisane | z kodu (`make()` przed pierwszym put) |
| 4a | 3 `saveGame` bez await (pierwszy przy otwieraniu bazy) + równoległe `listSaves` | OK: wygrywa ostatnie wywołanie, meta.tick = state.tick | `autosave and manual save in flight` |
| 4b | Cache'owane połączenie zamknięte `db.close()` | OK: retry, zapis przechodzi | `a connection closed behind our back` |
| 4c | `versionchange` (inna karta otwiera v3) | OK: nasze połączenie się zamyka, brak `blocked` | `a versionchange from another tab` |
| 4d | Po 4c baza jest v3, a ta wersja aplikacji prosi o v2 | `VersionError`, `listSaves` rzuca, menu bez "Kontynuuj", zapis nie działa; dane nie tracone. Uwaga B6 (niski priorytet, scenariusz downgrade aplikacji) | probe |
| 5a | v8 / v99 / stateVersion 0 / format 3 / brak `state` / ujemne coins / zły terrainHash / `state.version` != stateVersion / `state:'garbage'` / rekordy-śmieci | OK: kody `NEWER_VERSION`, `BAD_VERSION`, `UNSUPPORTED_FORMAT`, `BAD_ENVELOPE`, `TERRAIN_CHANGED`, `INCONSISTENT`; brak wyjątku innego niż `SaveError`; `readSlots` wypisuje każdy; oryginał w IDB bajt w bajt nietknięty | `damaged, wrong-version and v8 envelopes...` |
| 5b | Uszkodzony / v8 zapis w `auto` z `missionId` kontraktu, a w `auto-<m>` jest dobry zapis | BŁĄD B1: dobry zapis nadpisany | snippet B1 |
| 6 | m1, m5, m9, m12, sandbox: scenariusz fuzz (15-40 komend, 2400 ticków), 3 zapisy do IDB w losowych (seedowanych) tickach z przeładowaniem | OK: hash końcowy = bieg bez przerwy, invarianty OK | 5 testów `robust: <id>: save to IDB at seeded random ticks` |

## Błędy

### B1 (wysoki) — migracja `auto` przenosi uszkodzony/nowszy zapis na dobry
`src/platform/slots.ts:57-60` (`planLegacy`) decyduje wyłącznie po `missionId` i `savedAt`; `src/platform/save.ts:329-331`
nigdy nie sprawdza, czy zapis przechodzi bramkę. Dokumentacja D-36 mówi "an unreadable one stays in `auto`", ale zapis z
poprawnym `missionId`, a zepsutym stanem (albo z `stateVersion` 8 po zejściu na starszą wersję aplikacji) ma nowszy `savedAt`,
więc plan = `move`, i `putEnvelope` nadpisuje dobry `auto-m3`, po czym `auto` jest kasowane. Gracz traci grywalny zapis na rzecz
nieczytelnego (oryginał też znika).
```ts
// good auto-m3 (tick 100), auto = same mission, savedAt newer, coins=-5 (or stateVersion=8)
await saveGame(contractSlot('m3'), w3.state);
await rawPut({ ...makeEnvelope('auto', w.state, Date.now() + 9999), stateVersion: 8 }); // v8 variant
await adoptLegacySaves();
await loadGame(contractSlot('m3'));   // throws NEWER_VERSION / OUT_OF_RANGE; the good save is gone
```
Poprawka: w `adoptLegacySaves` przed `planLegacy` wywołać `prepareLoad(raw)`; gdy `!ok` -> `return` (zostaw w `auto`).
Dodatkowo w gałęzi `drop` nie kasować, jeśli kopia docelowa sama jest nieczytelna (opcjonalnie).

### B2 — (powiązane z B1) `Kontynuuj` dla `auto`
Po poprawce B1 zapis nieczytelny zostaje w `auto`; `app.ts:446-470` już to obsługuje (broken sheet), więc bez zmian.

### B3 (średni) — wyjątek w trakcie `putEnvelope` zostawia commit samego `meta`
`src/platform/save.ts:233-239` + `run()` `:204-215`. `put(meta)` jest zakolejkowany przed `put(state)`; gdy `put(state)`
rzuci synchronicznie (DataCloneError dla stanu z niesklonowalną wartością, DataError), `run` łapie wyjątek i robi `reject(e)`,
ale NIE woła `t.abort()`, więc transakcja się commituje z samym `meta`. Skutki: nowy slot -> meta bez stanu (menu pokazuje
"Kontynuuj", `loadGame` zwraca null -> "save slot is empty" -> ekran uszkodzonego zapisu); istniejący slot -> meta z nowym
`tick`/`savedAt` przy starym stanie.
```ts
const origPut = IDBObjectStore.prototype.put;
IDBObjectStore.prototype.put = function (v, k) { if (this.name === 'saves') throw new DOMException('boom', 'DataCloneError'); return origPut.call(this, v, k); };
await saveGame(contractSlot('m5'), w.state).catch(() => {});
(await listSaves()).map((x) => x.slot);        // ['auto-m5']  <- orphan meta
await loadGame(contractSlot('m5'));            // null
```
Poprawka (minimalna): w `run()` w `catch` przed `reject(e)`/retry dodać `try { t?.abort(); } catch { /* already finished */ }`
(zadeklarować `t` poza `try`, jest już). Alternatywa: w `putEnvelope` najpierw `put(state)`, potem `put(meta)`.
Quota (asynchroniczny błąd requestu) działa poprawnie — transakcja się wycofuje (3b).

### B4 (niski) — `listSaves` z rekordem bez `savedAt`
`src/platform/save.ts:276` — `b.savedAt - a.savedAt` daje NaN; komparator niespójny, kolejność poprawnych zapisów jest
nieokreślona (zaobserwowane: starszy `auto-m1` przed nowszym `valley2` -> złe "Kontynuuj"). Źródło: backfill meta w upgrade
(`save.ts:158-170`) kopiuje dowolny obiekt. Poprawka: `(Number(b.savedAt) || 0) - (Number(a.savedAt) || 0)`; opcjonalnie
w backfillu pomijać rekordy bez `typeof savedAt === 'number'`.

### B5 (niski) — odrzucenie `null` po aborcie
`save.ts:218`: `t.onerror = () => reject(t.error)` odpala się na bąbelkującym błędzie requestu (AbortError) gdy `t.error` jest
`null`, więc `saveGame` odrzuca wartością `null` (log `autosave failed null`). Poprawka: `reject(t.error ?? new Error('IndexedDB transaction failed'))`.

### B6 (niski) — baza nowsza niż aplikacja
`DB_VERSION = 2` stałe; po otwarciu bazy v3 (np. wcześniejsza kompilacja z dalszą wersją, drugie okno innej wersji)
każdy `open` -> `VersionError`, `listSaves` rzuca, `refreshSaves` (`app.ts:~292`) połyka błąd (`save = null`): brak
"Kontynuuj", autosave cicho nie działa (tylko `console.warn`). Dane bezpieczne. Poprawka: przy `VersionError` otworzyć bez
numeru wersji (`indexedDB.open(DB_NAME)`) — obecna wersja zawiera stores v2 — albo pokazać komunikat `menu.saveNewer`.

## Notatki bez błędu
- `loadGame` czyta store `saves`, a menu (`listSaves`) store `meta`; rozjazd był możliwy tylko przez B3. Po poprawce B3 oba
  zawsze są zapisywane/kasowane w jednej transakcji.
- `adoptLegacySaves` (kopia, potem kasowanie `auto`) nie jest atomowe, ale zgodnie z D-36 skutkiem przerwania są dwie kopie, nie zero (sprawdzone w kodzie).
- Spójność wersji: envelope `stateVersion` 7 + `state.version` 4 jest odrzucany (`INCONSISTENT`).
