# Backlog — MARCHIA

Priorytety: **P0** błędy/crash/utrata danych · **P1** wydajność i składaki (Fold/Flip) · **P2** czytelność
przyczyn przestoju (< 30 s) · **P3** jakość grafiki/dźwięku · **P4** treść i nowe funkcje.
Format: `- [ ] P? — tytuł — opis (źródło: research/owner/claude, plik:linia jeśli dotyczy)`.
Zrobione przenoś do sekcji „Zrobione” z datą i commitem.

## W toku
- [ ] P1 — Tekstury 4K + poziom jakości ultra (agent) — wymóg właściciela.
- [ ] P1 — Fold 8 Ultra / Foldy / Flipy: tryb Flex, rozkładanie w trakcie, dynamiczna rozdzielczość (agent) — wymóg właściciela.
- [ ] P3 — Poprawki grafiki: brzeg rzeki, drogi z daleka, łąka, drzewa, las (agent).

## Do zrobienia
- [ ] P0 — Błąd kompilacji shadera wody raz zgłoszony (`'z' : vector field selection out of range`), rzeka różowa na jednym zrzucie (src/render/water.ts) — zweryfikować po poprawkach grafiki.
- [ ] P1 — Pomiar FPS i pamięci przy 50/100/200 wozach w buildzie (docs/PERF.md, sekcja render) — na prawdziwym urządzeniu przez właściciela + headless.
- [ ] P2 — Kamera po otwarciu panelu chowa obiekt pod arkuszem: `camera.focusCell(cell, screenOffset)`.
- [ ] P2 — Samouczek misji 1 wg docs/tutorial/m1.md (GPT, PR #4).
- [ ] P2 — Protokół playtestu (zlecenie GPT 08 — jeszcze nie dostarczony).
- [ ] P3 — Ikona: „M” na pieczęci w Grenze Gotisch, kreskowanie koła.
- [ ] P3 — Turkot wozu, siekiera, piła, koń: wciąż syntetyczne — szukać nagrań CC0.
- [ ] P3 — Wozy na zakrętach odstają od wygładzonej drogi (~0,6 m); kolejki przy moście mogą wychodzić poza drogę.
- [ ] P4 — Budowanie budynków w trybie swobodnym (sim ma `place`, brak UI).
- [ ] P4 — Monetyzacja: pełna wersja jednorazowo (D-10) — sklep na późniejszym etapie.

## Zrobione
- 2026-11-01 — Rdzeń symulacji + testy, render, UI, misje I–III, trasy omijające kolejkę przy moście (D-13), audio, ikona v2, CI, pierwsze APK.
