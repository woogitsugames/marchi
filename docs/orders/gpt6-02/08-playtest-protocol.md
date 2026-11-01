# Zlecenie 08 — Protokół playtestu „przyczyna blokady w < 30 s”

Kluczowe kryterium gry: gracz rozumie przyczynę przestoju w mniej niż 30 sekund. Przygotuj protokół testu
z 5–8 osobami (telefon z Androidem, APK debug), do przeprowadzenia przez właściciela bez pomocy dewelopera.

Dostarcz `docs/playtest/PROTOCOL.md` (PL) zawierający:
- rekrutację (kto: 2 osoby grające w strategie, 2 casual mobile, 1–2 nie-gracze), zgodę, czas (25 min/os.);
- scenariusze z gotowym stanem gry (opisz, jak je przygotować w misji 1, np. „nie budować mostu 2 min”,
  „rozebrać jedyny most w trakcie dostawy”, „kupić 0 wozów”, „deszcz” — zaproponuj też parametry URL/debug,
  które warto dodać do gry, by ładować te stany jednym linkiem; nie implementuj ich);
- dla każdego scenariusza: pytanie do gracza („Dlaczego piekarnia nie piecze?”), co mierzyć (czas do poprawnej
  odpowiedzi, liczba dotknięć, czy otworzył „Dlaczego stoi?”, czy poszedł po łańcuchu przyczyn), kryterium sukcesu;
- metodę think-aloud, co notować, czego nie podpowiadać;
- arkusz wyników `docs/playtest/results-template.csv` i ankietę końcową (SUS-lite, 6 pytań + 3 otwarte);
- sposób analizy: mediana czasu, % < 30 s, top 5 problemów, mapowanie na zmiany w UI.
