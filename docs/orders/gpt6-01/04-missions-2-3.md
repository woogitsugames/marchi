# Zlecenie 04 — Projekt misji 2 i 3 (dokument + propozycja danych)

Przeczytaj dokładnie `docs/DESIGN.md` i kod `src/sim/missions.ts`, `src/sim/defs.ts` (tylko do czytania).
Uruchom `npx tsx tools/ascii-map.ts` i `npm run bot`, żeby zobaczyć misję 1.

Filar gry: **diagnozowanie przestojów**. Każda misja uczy JEDNEJ nowej przyczyny przestoju i jej naprawy.
Misje 5–12 minut, kontrakt („X i Y do zamku przed …”), 3 pieczęcie za czas.

- Misja 2 — „Korek na moście”: jedyny drewniany most jednopasmowy jest wąskim gardłem; rozwiązanie:
  drugi most albo bruk + most kamienny (droższy, dwupasmowy). Zaprojektuj mapę tak, by gracz to zobaczył w < 30 s.
- Misja 3 — „Deszczowa jesień”: długie opady, błoto spowalnia wozy na gruncie ×0.55; rozwiązanie: bruk na
  kluczowych odcinkach + magazyn pośredni. Pokaż, że deszcz jest w danych (`state.rain`).

Dostarcz:
1. `docs/missions/m2.md`, `docs/missions/m3.md`: cel, nowa mechanika/przyczyna, układ mapy (szkic ASCII 96×72),
   start (srebro, wozy), kontrakt, progi pieczęci, oczekiwane przestoje i ich odczyt w panelu „Dlaczego stoi?”,
   ryzyka balansu.
2. Propozycję danych w **nowym pliku** `src/sim/missions-proposed.ts` (nie edytuj `missions.ts`!) w formacie
   `MissionDef` + `ValleySpec` (rzeka, wzgórza, pola) i bota w `tools/bot-m2.ts` / `tools/bot-m3.ts`, które
   pokazują, że misje da się przejść (kod wyjścia 0). Jeśli potrzebujesz małej zmiany w sim (np. rejestracja
   nowej mapy), opisz ją w PR zamiast robić.
3. Teksty kontraktów PL+EN jako lista kluczy do i18n w opisie PR.
