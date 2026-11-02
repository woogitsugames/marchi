# 59 — Dźwięki alarmu przestoju i błędu słyszalne na telefonie — gałąź `gpt/59-alert-sounds`

Audyt `docs/research/2026-11-02-audio-mix.md`: `ui/stall` ma 99,5 % energii < 200 Hz, a `ui/error` podobnie —
na głośniku telefonu (który prawie nie gra poniżej ~300 Hz) są 10–15 dB ciszej od otoczenia i giną.
Zrób nowe wersje w `tools/generate_audio.py` (te dwa są generowane, nie z nagrań): charakter jak dziś (drewniany,
średniowieczny, krótki, bez „cyfrowego” bipu, bez głosu), ale z główną treścią w paśmie **0,7–1,4 kHz** (np. stuk
w deskę / drewniany klekot z rezonansem), długość ≤ 0,6 s, głośność wg pipeline (LUFS jak grupa `ui`).
Wyrenderuj OGG + M4A, `python3 tools/process_audio.py --check` zielone, zaktualizuj `docs/audio-provenance.json`
i `docs/ASSETS.md`. W PR: pomiar energii w pasmach przed/po (< 200 Hz, 0,3–1 kHz, 1–4 kHz) i LUFS.
