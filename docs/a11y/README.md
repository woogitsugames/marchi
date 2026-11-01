# Symulacje dostępności — Marchia (2026-11-01)

- [AUDIT.md](AUDIT.md): wyniki, kontrast i priorytety.
- [VIEWER.html](VIEWER.html): porównanie oryginału z symulacjami wszystkich 61 zrzutów (wybór z listy).
- [simulations/](simulations/): dokładnie 183 pliki SVG (61 × 3), z nazwami odpowiadającymi PNG i typowi symulacji.
- [standalone/](standalone/): 9 kompletnych SVG z osadzonym base64 źródłowym PNG (3 tryby × 3 reprezentatywne zrzuty: HUD, błędna droga i Flip cover). Niezależne od docs/shots.

**Jak oglądać:** pobierz repozytorium razem z folderem docs/shots, otwórz VIEWER.html w Chrome/Firefox. Poszczególne SVG ładują źródłowy PNG z ścieżki ../../shots/ i nakładają feColorMatrix. Są to *renderowane zrzuty-symulacje*, nie rasteryzowane, autonomiczne PNG. Na GitHubie przeglądarka obrazów SVG może blokować odwołania do plików względnych (CSP); w razie pustego obrazu użyj lokalnego VIEWER.html.

**Algorytm:** macierze Machado (100% protanopia/deuteranopia/tritanopia) z color-interpolation-filters="linearRGB". Filtr wpływa na cały zrzut, włącznie z tekstem i tłem; nie jest to emulacja funkcji korekcji kolorów systemu Android/iOS ani diagnoza medyczna.

**Ograniczenie audytu:** bez uruchomienia gry i pomiarów pikselowych wyniki statycznego testu kontrastu odnoszą się do CSS, nie do każdej tekstury i przezroczystości w obrazie. Sam viewer nie weryfikuje automatycznie, czy użytkownik rozpozna każdą ikonę; do tego konieczne są testy z ludźmi i scenariusze funkcjonalne.
