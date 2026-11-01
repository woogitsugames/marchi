Repozytorium: woogitsugames/marchi, gałąź bazowa: claude/eager-cori-08wt8e (zrób `git fetch`, baza poszła do przodu).
Komunikacja po polsku, kod po angielsku. Zasady: CLAUDE.md. NIE edytuj src/ui/**, src/main.ts, src/styles/**,
src/render/**, index.html, android/** (tam pracuje inny agent).

ZADANIE A — Jedna gałąź integracyjna z Twoimi PR-ami (#38 replay, #39 pakiet 4K, #40 zapisy, #41 misje IV–VI)
oraz PR-em GPT #37 (siatkowy balans).
- Utwórz `claude/s2-integration` od najnowszej `origin/claude/eager-cori-08wt8e`, scal po kolei #41, #40, #39, #38, #37,
  rozwiąż konflikty (uwaga: baza ma STATE_VERSION 2 z `ledger.stallSeconds`, status `WAITING_UPSTREAM`,
  `src/sim/repair.ts`, komendę `sellWagon`, trasy z karą kolejki przy moście D-13, przęsła 8-sąsiedzkie F-01 — zachowaj
  je wszystkie; migracje zapisów mają iść łańcuchem 1→2→3 z testami).
- Po każdym scaleniu: `npm ci` (jeśli zmienił się package.json), `npm test`, `npm run typecheck`, `npm run build`.
- Długi fuzz po scaleniu: `npm run fuzz -- --runs 150` także na m4–m6 (rozszerz fuzzer o te misje, jeśli trzeba).
- `npm run bot`, `tools/balance.ts` dla m1–m6 — wyniki wpisz do opisu PR.
- Otwórz PR `claude/s2-integration` → `claude/eager-cori-08wt8e` z listą rozwiązanych konfliktów. Nie zamykaj starych PR-ów.

ZADANIE B (mniejsze) — Wydajność dispatchu (src/sim/logistics.ts)
- Zmierz p99 ticku przy 200 wozach (`npm run perf:sim`) po scaleniu A. Jeśli p99 > 1,5 ms: rozłóż dispatch w czasie
  (np. źródła/żądania w kolejnych tickach, budżet Dijkstr na tick) BEZ utraty determinizmu i bez zmiany wyników bota
  powyżej ±3 %. Zaktualizuj tabelę w docs/PERF.md. Osobny commit z pomiarem przed/po.

Na końcu krótki raport po polsku: link do PR, wyniki testów/fuzz/bota/balansu, co zostało.
