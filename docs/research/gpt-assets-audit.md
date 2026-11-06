# Audyt zasobów — 6 listopada 2026

Inwentarz obejmuje 202 pliki w `public/assets/`. Przed dodaniem tabeli 201 nie miało w `docs/ASSETS.md` dokładnej ścieżki w osobnym wpisie. Brak ścieżki nie oznacza braku praw: źródła grupowano wcześniej według zestawów. Dodano tabelę wszystkich plików, wskazując istniejące opisy i rejestry pochodzenia; `tools/assets-audit.ts` wykrywa brak dosłownej ścieżki.

## Otwarte kwestie

- W 61 plikach `ui/kit` istniejący opis wskazuje jedynie „licencję jak gra” oraz wygenerowanie dla Marchii. Konieczne jest potwierdzenie konkretnych warunków prawnych i pochodzenia przez wydawcę. Ten wpis nie oznacza CC0.
- Wpisy audio odsyłają do tabel istniejącego dokumentu i `docs/audio-provenance.json`; każdy materiał przed publikacją należy porównać ze źródłem i licencją. Ten audyt nie obejmuje ponownego sprawdzenia stron źródłowych.
- Ścieżka w tabeli jest wyłącznie kontrolą kompletności inwentarza, a nie dowodem licencji ani poprawności przypisania źródła.

Uruchomienie: `npx tsx tools/assets-audit.ts`; kod 1 oznacza brakujące dokładne wpisy.
