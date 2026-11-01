# 14 — Misja VI „Ciasny spichlerz” (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Lekcja: **pełny magazyn blokuje produkcję** (`OUTPUT_FULL` / `STORAGE_FULL` już istnieją w sim). Mały spichlerz (np. 20 jednostek),
nadprodukcja zboża, gracz musi dobudować spichlerz lub skierować przepływ. Bez zmian w silniku — da się zrobić samymi danymi.
- `src/sim/proposals/m6.ts` (ValleySpec + MissionDef; spichlerz o mniejszej pojemności zaproponuj jako parametr — opisz potrzebną
  zmianę `BUILDINGS.warehouse.storeCap` per budynek, jeśli konieczna), bot `tools/bot-m6.ts`, `docs/missions/m6.md`
  z pomiarami 3 strategii (nic / dobudowa spichlerza / przekierowanie) — użyj podejścia z `tools/balance.ts`.
