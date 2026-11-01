# 18 — Nagrania CC0, część 2 (repo `woogitsugames/marchi`, baza `claude/eager-cori-08wt8e`)

Wciąż syntetyczne: `cart-dirt`, `cart-cobble`, `axe`, `saw`, `horse-snort`, `mill-wheel`, `oven`, `load-*`/`unload-*` (zob. `docs/ASSETS.md`,
`tools/audio_sources.json`, `tools/process_audio.py` — pipeline z zlecenia 07, tylko OpenGameArt). Rozszerz pipeline o freesound.org
**tylko dla plików z licencją CC0** (sprawdź każdy na stronie pliku; zapisz URL strony, autora, ID) — pobieranie przez API wymaga klucza:
jeśli go nie masz, dołącz pliki źródłowe do PR (CC0 pozwala) w `tools/audio-src/` i ich SHA-256. Turkot: drewniane koła na żwirze/ziemi
(pętla bez szwu), osobno na kamieniu; piła ręczna (nie mechaniczna); siekiera w kłodę; koń parsknięcie; koło wodne. Żadnych silników,
asfaltu, mowy. Te same nazwy plików i ID. Budżet całego audio < 4 MB (bez `public/assets/music`). `npm test` zielony.
