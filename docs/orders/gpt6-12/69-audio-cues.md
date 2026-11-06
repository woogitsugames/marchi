# 69 — Sygnały dźwiękowe — gałąź `gpt/69-audio`

5 krótkich plików (OGG Vorbis 48 kHz mono, ≤ 1,2 s, −16 LUFS ±1, bez trzasków na początku/końcu, energia 600–2500 Hz —
słyszalne na głośniku telefonu, zob. D-59 / zadanie 59 w `docs/ASSETS.md`): `ui.rankUp` (awans rangi — dzwon/róg,
uroczyste, nie fanfara), `ui.rankCard` (cicha wskazówka — drewniany stuk), `ui.grow` (kilka uderzeń ciesielskich),
`event.postOpen` (otwarcie posterunku — skrzypnięcie okiennicy + dzwonek), `world.iceCrack` (kra na moście).
Źródła: tylko CC0 (Freesound/OpenGameArt z weryfikacją licencji) albo własna synteza — każdy plik z wpisem w
`docs/ASSETS.md` (źródło, licencja, obróbka). Pliki do `public/assets/audio/sfx/`. **Nie edytuj `src/audio/sounds.ts`**
(podpięcie zrobi koordynator). Narzędzia kontroli: `tools/audio-mix-audit.py`. **Zlecenie bez plików jest nieoddane.**
