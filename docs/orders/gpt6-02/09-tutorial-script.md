# Zlecenie 09 — Scenariusz samouczka misji 1 (dokument)

Bez kodu. Zaprojektuj krótki samouczek wpleciony w misję 1 (zobacz `docs/DESIGN.md`, `src/sim/missions.ts`,
`tools/bot.ts`, zrzuty `docs/shots/ui-*.png`). Zasady: diegetycznie (list od kasztelana / notatki na liście
przewozowym), maks. 6 kroków, każdy kończy się działaniem gracza, nie „Dalej”; da się pominąć; nie blokuje gry;
całość < 2 min; uczy przede wszystkim **czytania przyczyny przestoju**.

Dostarcz `docs/tutorial/m1.md`: kroki (warunek startu w stanie gry — np. `castle.status.k === 'NO_WAGON'`,
tekst PL i EN ≤ 140 znaków, wskazany element UI/świata, warunek zakończenia), co pokazać na ekranie
(podświetlenie, strzałka-rycina), zachowanie przy obróceniu ekranu i pauzie, listę kluczy i18n
(`tutorial.m1.*`) z tekstami PL i EN. Ton: rzeczowy, z lekkim posmakiem epoki, bez archaizmów na siłę.
