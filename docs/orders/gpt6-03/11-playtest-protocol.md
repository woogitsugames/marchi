# 11 — Protokół playtestu „przyczyna blokady w < 30 s” (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Ponowienie zlecenia 08 (nie dotarło). Przygotuj protokół testu z 5–8 osobami na Androidzie (APK debug), który
właściciel przeprowadzi sam. Dostarcz `docs/playtest/PROTOCOL.md` (PL):
- rekrutacja (2 grający w strategie, 2 casual mobile, 1–2 nie-gracze), zgoda, 25 min/os.;
- 6 scenariuszy na misjach I–III (zobacz `src/sim/missions.ts`, `src/sim/missions-proposed.ts`, `tools/bot.ts`):
  np. brak mostu, rozebrany jedyny most w trakcie dostawy, brak wolnych wozów, korek na moście (misja II), deszcz
  i błoto (misja III), pełny spichlerz. Dla każdego: jak przygotować stan (parametry URL, które już są: `?play=m1|m2|m3`,
  `ff=<s>`, `bot=1`, `speed`, `open=<buildingId>`, `wagon=<id>` — sprawdź w `src/ui/app.ts`; brakujące opisz jako propozycję),
  pytanie do gracza, co mierzyć (czas do poprawnej odpowiedzi, dotknięcia, czy otworzył „Dlaczego stoi?”, czy przeszedł łańcuch),
  kryterium sukcesu;
- think-aloud, czego nie podpowiadać; `docs/playtest/results-template.csv`; ankieta (6 pytań skali + 3 otwarte);
- analiza: mediana czasu, % < 30 s, top 5 problemów → propozycje zmian w UI (jako lista do `docs/BACKLOG.md`, w PR).
