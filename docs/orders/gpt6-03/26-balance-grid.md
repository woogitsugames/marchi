# 26 — Siatkowy balans misji (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Rozszerz podejście z `tools/balance.ts` w NOWYM pliku `tools/balance-grid.ts`: dla misji m1–m3 (i propozycji m4–m6, jeśli są w repo)
przeszukaj siatkę parametrów kontraktu (ilości, termin, progi pieczęci, srebro startowe, liczba wozów) × zestaw strategii bota
(nic / więcej wozów / właściwa naprawa / naprawa + wozy) i znajdź ustawienia, przy których: „nic” = 0–1 pieczęć, właściwa naprawa = 3,
częściowa = 2, czas przejścia 5–12 min. Determinizm: stały seed + dodatkowo 5 innych seedów (stabilność). Wynik: `docs/balance/REPORT.md`
(tabele, rekomendowane wartości z uzasadnieniem). Nie zmieniaj danych misji w `src/sim` — tylko rekomendacje.
