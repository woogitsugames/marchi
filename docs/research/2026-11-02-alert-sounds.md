# Task 59 — alarmy przestoju i błędu: przed / po

Pomiar ze zdekodowanych, dostarczanych OGG Vorbis i AAC/M4A (24 kHz mono).
Udział pasma w całkowitej energii: FFT + wzór Parsevala, łącznie z ogonem kodeka.
LUFS-I: FFmpeg ebur128=peak=true. Dla krótkich one-shotów pomiar LUFS jest przybliżony.

| Dźwięk | Format | <200 Hz przed → po | 0,3–1 kHz przed → po | 1–4 kHz przed → po | 0,7–1,4 kHz po | LUFS-I przed → po | Czas po |
|---|---|---:|---:|---:|---:|---:|---:|
| ui/stall | OGG | 99.5% → 0.4% | 0.2% → 40.9% | 0.2% → 58.6% | 78.0% | -24.8 → -23.2 | 0.540 s |
| ui/stall | M4A | 99.5% → 0.5% | 0.2% → 42.9% | 0.1% → 56.6% | 78.6% | -24.7 → -23.0 | 0.540 s |
| ui/error | OGG | 99.5% → 0.4% | 0.2% → 30.9% | 0.2% → 68.8% | 77.3% | -24.6 → -22.2 | 0.480 s |
| ui/error | M4A | 99.5% → 0.5% | 0.2% → 30.2% | 0.2% → 69.4% | 77.4% | -27.0 → -23.3 | 0.480 s |

### Model głośnika telefonu: filtr górnoprzepustowy Butterwortha 4. rzędu, 300 Hz

| Dźwięk | Format | RMS przed (dBFS) | RMS po (dBFS) | Różnica |
|---|---|---:|---:|---:|
| ui/stall | OGG | -46.4 | -23.8 | +22.6 dB |
| ui/stall | M4A | -46.8 | -23.5 | +23.3 dB |
| ui/error | OGG | -47.0 | -23.6 | +23.4 dB |
| ui/error | M4A | -47.3 | -23.8 | +23.5 dB |

### Sposób wykonania

- Dwa nieregularnie brzmiące drewniane stuknięcia; bez głosu, nagrań i cyfrowego bipu.
- Silna energia 700–1400 Hz, ziarnisty rezonans i delikatny niskotonowy komponent drewna.
- Osobne deterministyczne ziarna RNG dla każdego uderzenia; pipeline mono 24 kHz i normalizacja szczytu UI -6 dBFS bez zmian.
- Bezpieczna komenda: python3 tools/generate_audio.py --only-ui-alerts (nie uruchamiać pełnego generatora po podmianie nagrań CC0).
- Tymczasowy gain stall 0,55 cofnięty do 0,38; ui.error pozostał 0,36.
- Kontrola końcowa: python3 tools/process_audio.py --check.
- Zestaw: 72 plików OGG/M4A, 1626344 B < 4194304 B.
