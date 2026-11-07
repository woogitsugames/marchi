# 101 — Listy misji XVI — gałąź `gpt/101-letters-16`

Misja XVI „Dwa zamki” (`docs/missions/m16.md`, decyzje D-288..D-293 w `docs/DECISIONS.md`): dwa zamki (Wschodni, Północny) chcą desek z jednego tartaku; gracz ma przełącznik „Ten zamek pierwszy” na karcie zamku. Listy kasztelana są w `src/content/letters.ts` (klucz `m16`) we wszystkich 17 językach — PL/EN napisał agent, 15 języków to tłumaczenia agenta.

1. **PL:** redakcja listu otwierającego, zwycięstwa i porażki — ton jak w listach I–XV, list otwierający ma od 0:00 sygnalizować, że Wschodni ma wcześniejszy termin (przełącznik działa tylko do ~1:30). Bez zdradzania „kup wóz”.
2. **15 języków:** przegląd i poprawki zgodnie z poprawionym PL/EN; nazwy zamków spójne z kluczami `castle.*` w `src/i18n/*.ts`; ru/uk/ar/ko — formy w `castle.rival` (liczba, przypadki, partykuły).
**Oddaj:** poprawione `letters.ts` (+ ewentualnie `castle.*` w i18n) i `docs/reviews/letters-16.md` (tabela: język, było → jest, powód).
