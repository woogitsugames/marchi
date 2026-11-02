# 56 — 13 plików dźwięków CC0 (powtórka zlecenia 50) — gałąź `gpt/56-audio-files`

W paczce 07 gałąź `gpt/50-audio-binaries` dostarczyła tylko narzędzia (`tools/finalize_audio_50.py`, kroki CI),
**bez żadnego pliku dźwięku**. Narzędzia przyjęto (`docs/reviews/gpt-integration-3.md`), zlecenie jest otwarte.
Teraz: **same pliki** dla 13 pozycji `pending_tracks` w `tools/audio_sources.json` (kamieniołom, węglarz,
słodownia, browar, rybak…), wg pierwotnego zlecenia `docs/orders/gpt6-07/50-audio-binaries.md`:
OGG + M4A, budżet ≤ 400 KB łącznie, pętle bezszwowe, bez muzyki i głosu; przeniesienie z `pending_tracks` do
`tracks`, `python3 tools/process_audio.py --check` zielone, wpisy w `docs/ASSETS.md` (link, autor, licencja CC0,
data pobrania). `src/audio/sounds.ts` NIE edytuj — podaj w PR gotowe linie `id → plik`.
Jeśli nie możesz pobrać plików z sieci: napisz to w PR wprost i podaj dokładne linki do ręcznego pobrania —
nie oddawaj ponownie samych narzędzi.
