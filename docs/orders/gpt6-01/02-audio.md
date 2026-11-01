# Zlecenie 02 — Dźwięk (ambient, SFX, moduł audio)

Kierunek (z `docs/ART_DIRECTION.md`): wilgotny poranek późnej jesieni, wieś środkowoeuropejska ok. 1300–1400.
Realistycznie, cicho, bez muzyki „epickiej”. Dźwięk ma też **informować**: przestój słychać zanim go widać.

Zasoby (tylko CC0: np. freesound.org z filtrem CC0, opengameart CC0, Sonniss GDC bundle — sprawdź licencję każdego pliku):
- Ambient pętle (30–90 s, bezszwowe): dolina rano (ptaki, daleki pies, wiatr w trawie), rzeka (szum przy moście), deszcz na łące, wieczór (świerszcze? — listopad: raczej wiatr i kawki).
- SFX: turkot wozu po gruncie i po bruku (pętla, tempo zależne od prędkości), koń parsknięcie (rzadko), most drewniany (dudnienie desek), załadunek/rozładunek (worki, deski, kłody — osobno), siekiera drwala, piła tartaku, koło młyńskie (pętla), piec/chleb, pieczęć woskowa (kontrakt wypełniony), UI: dotyk drewna, papier (otwarcie panelu), błąd (tępe stuknięcie, nie „buzzer”).
- Format: `.ogg` (Opus/Vorbis) + `.m4a` dla iOS Safari jeśli potrzebne; mono dla SFX, stereo ambient; łącznie < 4 MB.
- Normalizacja: ambient −24 LUFS, SFX szczyty −6 dBFS. Wpisy w `docs/ASSETS.md`.

Kod — nowy katalog `src/audio/` (tylko Web Audio API, bez bibliotek):
- `audio.ts`: `AudioEngine` z `init()` po pierwszym geście użytkownika (wymóg mobilny), kanały master/ambient/sfx/ui z głośnością, `play(id, {x, z})` z prostą panoramą/tłumieniem względem kamery, pętle z crossfade, limit jednoczesnych głosów (np. 16), wyciszenie przy `visibilitychange`.
- `sounds.ts`: manifest id → pliki.
- `bindings.ts`: funkcja `observeSim(prevState, state, camera)` wywoływana po ticku, która **czyta** stan symulacji (nie modyfikuje!) i wyzwala dźwięki: start pracy budynku, załadunek, wjazd na most, nowy przestój (krótki sygnał tylko przy przejściu w stan przestoju, nie co tick), wygrana kontraktu. Nie podpinaj tego w `src/main.ts` — opisz w PR 3 linijki integracji, zrobimy to sami.
- Ustawienia: klucze i18n `settings.volume.*` w `pl.ts` i `en.ts`.

Kryteria: brak trzasków na pętlach, brak dźwięku przed gestem, CPU < 1 ms/klatkę przy 200 wozach (agregacja turkotu: nie 200 źródeł, tylko 1–3 pętle z głośnością zależną od liczby wozów w kadrze).
