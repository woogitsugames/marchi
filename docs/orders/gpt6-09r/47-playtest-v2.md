# 47 — Protokół playtestu v2 — gałąź `gpt/47-playtest-v2` (ponownie)

Zaktualizuj `docs/playtest/PROTOCOL.md` do dzisiejszej gry:
- **samouczek i list otwierający misji I** (czy gracz rozumie list kasztelana i kartę „Najgorszy zastój” z przyciskiem
  „pokaż”), czas do pierwszej poprawnej diagnozy;
- **misje IV–XII**: kra, transze, mały spichlerz, ryby/most, bruk przed burzą, spór o drewno (IX/X — czy X nie
  powtarza IX), słodownia daleko (XI), magazyn jako bufor (XII); prognoza tempa „przy tym tempie” (VII);
- **Wolna dolina**: stawianie budynków, rangi, targ, pory roku, 3 Księgi osad;
- **nowy HUD v3**: czy gracz znajduje najgorszy przestój < 30 s, czy rozumie pieczęć alarmu z licznikiem, karty narzędzi,
  podświetlenie lekarstwa („Kup wóz”), „brak N srebra”;
- **urządzenia**: zwykły telefon, Fold rozłożony (is-split), tryb Flex (zawias), Flip — ekran zewnętrzny;
- **wydajność odczuwalna**: płynność przy ×4, nagrzewanie, krok konia przy ×1/×4.
Scenariusze z parametrami URL (`?play=m1…m12|sandbox`, `?tut=1`, `ff`, `bot`, `lang` — sprawdź w `src/ui/app.ts`;
pełny uchwyt debug tylko z `?debug=1`, D-51), metryki (czas do zrozumienia przyczyny < 30 s, odsetek poprawnych
diagnoz, mediany), ankieta po sesji, arkusz wyników `docs/playtest/results-template.csv` (kolumny opisane),
instrukcja dla prowadzącego (5–8 osób, 30–40 min). Testy/typecheck zielone (to głównie dokumentacja).
