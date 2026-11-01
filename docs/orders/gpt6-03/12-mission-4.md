# 12 — Misja IV „Zima na przeprawie” (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Wzoruj się na misjach II/III: `src/sim/missions-proposed.ts`, `docs/missions/m2.md`, `tools/bot-m2.ts`, `tools/balance.ts`,
`tests/missions.test.ts`. Lekcja (JEDNA nowa przyczyna): **most drewniany zamknięty przez kry/lód w określonym oknie czasu** —
gracz musi zawczasu zrobić zapas po drugiej stronie (spichlerz) albo zbudować kamienny most.
- Mechanika wymaga zmiany w sim (zamknięcie przeprawy w czasie): **nie edytuj istniejących plików sim**. Zaprojektuj ją jako
  propozycję: nowy plik `src/sim/proposals/ice.ts` z czystą funkcją (np. `closedSpans(state, terrain): Set<number>`) + test
  jednostkowy + opis dokładnie, gdzie podpiąć (network.ts edgeCosts / wagons bridgeBlocker) i jaki nowy powód przestoju dodać
  (`BRIDGE_CLOSED{span, until}`), z tekstami PL/EN.
- Dane misji w `src/sim/proposals/m4.ts` (ValleySpec + MissionDef jak w missions-proposed.ts) i bot `tools/bot-m4.ts`
  działający BEZ lodu (jako dowód przechodności mapy) + opis oczekiwanych wyników z lodem.
- `docs/missions/m4.md`: cel, mapa (ASCII 96×72), kontrakt, progi pieczęci, oczekiwane łańcuchy „Dlaczego stoi?”, ryzyka.
