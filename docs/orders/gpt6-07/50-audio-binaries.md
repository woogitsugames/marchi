# 50 — Dźwięki nowych budynków: pliki (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)
Gałąź `gpt/50-audio-binaries`. W `tools/audio_sources.json` jest klucz `pending_tracks` (13 pozycji: rybak, kamieniołom,
węglarz, słodownia, browar…) — źródła CC0 opisane, ale plików brak.
1. Pobierz źródła CC0 (Freesound z licencją CC0, OpenGameArt CC0 itp.; jeśli źródło niedostępne — znajdź inne CC0
   i zaktualizuj wpis). Zapisz w PR link, autora, licencję i datę pobrania dla każdego.
2. Przetwórz `python3 tools/process_audio.py` zgodnie z pipeline (format/bitrate/głośność jak dla istniejących 46 plików).
3. Przenieś gotowe pozycje z `pending_tracks` do `tracks`; `python3 tools/process_audio.py --check` zielone.
4. Wpisy w `docs/ASSETS.md`. **NIE edytuj `src/audio/sounds.ts`** — w PR podaj gotowe linie do dodania (id → plik).
Budżet: łącznie ≤ 400 KB dla 13 plików; pętle bezszwowe (crossfade na końcach); bez muzyki i bez głosu.
