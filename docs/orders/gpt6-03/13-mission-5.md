# 13 — Misja V „Jarmark” — fale popytu (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Lekcja: **popyt zmienia się w czasie** — kontrakt w 3 transzach z osobnymi terminami (np. 10 chlebów do 3:00, 15 desek do 6:00,
20 chlebów do 10:00). Gracz uczy się przestawiać logistykę (spichlerz jako bufor, priorytety).
- Mechanika transz to zmiana w sim → projekt jako propozycja w `src/sim/proposals/tranches.ts` (czyste funkcje + test), opis podpięcia
  (Contract z listą transz, checkMission, demand w logistics.ts) i nowych stanów UI (list przewozowy z transzami).
- Dane `src/sim/proposals/m5.ts`, bot `tools/bot-m5.ts` (na obecnym silniku: suma kontraktu jako jeden kontrakt), `docs/missions/m5.md`.
