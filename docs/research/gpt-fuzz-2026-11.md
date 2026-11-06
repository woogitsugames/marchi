# Długi fuzz — 6 listopada 2026

Stan `b020c577debddb24cdacba06b11dbbf005f7c0d1`. Uruchomiono `node --import tsx tools/fuzz.ts --runs 500`. CLI `npx tsx` nie może utworzyć gniazda IPC w tym środowisku; inny sposób ładowania TypeScript wykonuje ten sam program.

- 500 scenariuszy, seedy 1–500, do 6000 ticków każdy; 7 550 633 symulowanych ticków łącznie z replikami.
- 7275 zaakceptowanych i 4885 odrzuconych poleceń; maksymalnie 23 wozy.
- Jeden przypadek rodzaju `stuck`; proces kończy się kodem 1. Pozostałe 499 scenariuszy bez zgłoszonego błędu. To nie dowód braku innych błędów.
- Misje: m1:30, m2:40, m3:38, m4:35, m5:29, m6:34, m7:36, m8:34, m9:27, m10:32, m11:43, m12:42, m13:36, sandbox:44.

## Seed 255: zakleszczenie na moście

W misji m2, przy 4000 monet, po zburzeniu komórki drogi 2937 w ticku 2065 wóz pozostaje w stanie `BRIDGE_JAM` ponad 3000 ticków. Minimalny scenariusz ma jedną komendę i jest zapisany w `tests/known-failing/fuzz-stuck-255.test.ts`. Runner `node --import tsx tests/known-failing/run.ts fuzz-stuck-255` potwierdził `FAIL (open bug)` w ticku 5101. Oczekiwane zachowanie: brak nieskończonego zakleszczenia. Konieczne jest zbadanie, czy próg fuzzera oznacza rzeczywistą blokadę dla gracza, i poprawienie mechanizmu, jeśli się potwierdzi.

## Późna gra

Dodatkowe `node --import tsx tools/fuzz-late.ts --runs 100` zostało uruchomione i nadal trwało w chwili przygotowania raportu; wynik nie jest jeszcze znany. Ten fragment zlecenia pozostaje nieukończony.

## Walidacja

Testy bazowe: 544 passed, 0 failed. `npm run typecheck` zakończył się powodzeniem także po dodaniu testu. Test znanego błędu jest celowo poza zestawem podstawowym.
