# 43 — Pory roku w Wolnej dolinie (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
D-31: łagodnie, zapowiadane z wyprzedzeniem, nigdy nie niszczą osady. Zaprojektuj i zaimplementuj jako CZYSTE funkcje
w NOWYM pliku `src/sim/proposals/seasons.ts` (deterministyczne, bez Math.random/Date/trygonometrii — zasady sim z
CLAUDE.md): kalendarz (np. pora roku co N minut gry), efekty jako dane: zima — kra zamyka drewniane mosty w oknach
(mechanika `ice` z misji IV już istnieje: zobacz `MissionDef.ice` / `BRIDGE_CLOSED`), plony gospodarstwa −40 %,
rybak −50 %; wiosna — roztopy: drogi gruntowe jak w deszczu (×0.55) przez okno czasu; lato — +20 % plonów; jesień —
jarmark (cena jednego towaru +25 %). Funkcja `seasonAt(tick)` i `effectsAt(tick)`; zapowiedź `nextChange(tick)`.
Testy jednostkowe + `docs/design/seasons.md` (wpływ na przyczyny przestojów, teksty zapowiedzi PL/EN, propozycja
ikon pór roku w stylu drzeworytu — tylko opis). W PR opisz dokładnie, gdzie to podpiąć w `sim.ts`/`logistics.ts`.
