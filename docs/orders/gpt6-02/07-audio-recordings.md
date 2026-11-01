# Zlecenie 07 — Realistyczne nagrania CC0

Obecny dźwięk (`public/assets/audio`, `tools/generate_audio.py`) jest syntetyczny. Kierunek gry to stonowany
realizm — ambient i najważniejsze SFX mają być **prawdziwymi nagraniami terenowymi CC0**.

Źródła: freesound.org (filtr licencji **Creative Commons 0** — sprawdź każdy plik osobno), opengameart.org (CC0),
Sonniss GDC Game Audio Bundle (licencja royalty-free — zaznacz w ASSETS, że to nie CC0 i podaj warunki).
Unikaj nagrań z dźwiękami współczesnymi (samochody, samoloty, silniki, mowa w obcych językach).

Podmień (te same nazwy plików i ID w `src/audio/sounds.ts`, żeby integracja się nie zmieniła):
- ambient: `morning` (ptaki jesienne, kawki, daleki pies, wiatr), `river` (szum niewielkiej rzeki), `rain` (deszcz na trawie/strzesze), `evening` (wiatr, sowa rzadko);
- SFX: `cart-dirt`, `cart-cobble` (turkot drewnianych kół, pętle), `bridge-wood`, `horse-snort`, `axe`, `saw` (ręczna piła ramowa, nie mechaniczna), `mill-wheel`.
Zostaw syntetyczne te, dla których nie znajdziesz dobrego CC0 (zaznacz w raporcie).

Obróbka: przycięcie, bezszwowa pętla (crossfade), ambient −24 LUFS, SFX szczyt −6 dBFS, OGG + M4A,
mono SFX / stereo ambient, łącznie < 4 MB. Zaktualizuj `docs/ASSETS.md` (link do konkretnego pliku, autor,
licencja, zmiany) i dodaj skrypt obróbki `tools/process_audio.py` (ffmpeg), żeby dało się odtworzyć.
`npm test` musi przechodzić (jest `tests/audio.test.ts`).
