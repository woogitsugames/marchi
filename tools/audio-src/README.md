# Freesound CC0 source previews

These are the **official Freesound high-quality OGG previews**, not the lossless original WAVs.
Freesound original downloads require a login/OAuth token; HQ preview downloads do not.

For each sound, `tools/audio_sources.json` records the individual Freesound page URL,
uploader, sound ID, license (`CC0-1.0`), and the on-disc filename:
`<sound_id>-hq.ogg`. Every file must be a recording of the actual physical event,
never an imitation; reject motor sounds, speech, modern traffic and bitcrushing.

The build tool reads the individual Freesound page, checks the CC0 link and label,
finds the official preview URL, then downloads into this directory with `--fetch`.
It never downloads a sound with a different license. This folder is used to
rebuild OGG/M4A pairs; it is **not** served at runtime.

Regenerate:

```sh
python3 tools/process_audio.py --only-freesound --fetch
python3 tools/process_audio.py --check
python3 -m unittest tools/test_process_audio.py
npm test
```

SHA-256 checksums for source previews and rendered assets are recorded in
`docs/audio-provenance.json`. Recordings may not be committed without these
fingerprints and a complete pass of the manifest-driven file-count (<4 MiB)
budget check (72 files once task 46 is rendered).

Attribution is included for provenance even though CC0 does not require it.
Copyrighted or CC-BY/CC-BY-NC Freesound samples must not be added.
