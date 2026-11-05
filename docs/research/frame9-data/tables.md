
### Kamera 60 m — ms CPU na sekundę gry (×4, 60 kl.), mediana przebiegu 1 / 2

| scena | jakość | razem | rozrzut razem (min–max) | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne | ms/kl. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 129 / 169 | 122–186 | 11.8 / 6.60 | 2.00 / 2.10 | 0.30 / 0.40 | 9.70 / 12.7 | 78.4 / 93.8 | 27.0 / 32.0 | 5.80 / 11.4 | 6.50 / 8.20 | 1.80 / 4.50 | 2.70 / 2.50 | 13.8 / 14.9 | 2.14 / 2.81 |
| sandbox50 | high | 561 / 169 | 153–755 | 9.50 / 6.80 | 5.20 / 2.80 | 0.90 / 0.50 | 20.5 / 13.2 | 428 / 111 | 149 / 47.2 | 11.4 / 7.70 | 24.2 / 7.00 | 2.50 / 2.70 | 3.70 / 2.50 | 18.1 / 15.3 | 9.35 / 2.81 |
| sandbox100 | low | 137 / 116 | 108–258 | 7.10 / 9.20 | 4.70 / 4.00 | 0.60 / 0.30 | 23.5 / 15.7 | 70.6 / 62.9 | 26.7 / 15.6 | 9.60 / 5.70 | 7.00 / 7.00 | 1.30 / 2.00 | 2.20 / 2.80 | 15.4 / 9.50 | 2.28 / 1.93 |
| sandbox100 | high | 245 / 170 | 162–397 | 16.5 / 9.30 | 5.50 / 5.20 | 0.60 / 0.50 | 28.9 / 19.6 | 140 / 101 | 68.7 / 37.2 | 16.1 / 8.40 | 8.20 / 10.2 | 3.30 / 2.90 | 4.00 / 3.20 | 17.5 / 12.5 | 4.08 / 2.84 |
| sandbox200 | low | 462 / 216 | 205–651 | 12.2 / 15.9 | 60.6 / 7.90 | 1.00 / 0.90 | 90.9 / 56.0 | 148 / 123 | 29.5 / 30.2 | 8.20 / 13.2 | 24.6 / 7.70 | 6.90 / 4.10 | 29.2 / 4.80 | 18.6 / 16.5 | 7.71 / 3.60 |
| sandbox200 | high | 307 / 257 | 150–313 | 8.80 / 11.9 | 8.80 / 8.60 | 0.50 / 0.70 | 33.6 / 38.5 | 110 / 123 | 45.5 / 49.3 | 8.30 / 12.0 | 9.40 / 7.40 | 3.50 / 3.10 | 4.40 / 4.50 | 14.1 / 14.3 | 5.11 / 4.28 |
| m13 | high | 104 / 104 | 70.7–113 | 0.50 / 1.00 | 0.80 / 0.50 | 0.50 / 5.10 | 4.10 / 4.50 | 62.9 / 72.4 | 24.7 / 23.4 | 6.10 / 3.80 | 14.3 / 7.20 | 0.70 / 0.90 | 0.50 / 0.40 | 5.80 / 4.20 | 1.73 / 1.74 |
| m12 | low | 118 / 80.5 | 74.2–178 | 2.40 / 2.60 | 1.00 / 1.10 | 2.80 / 0.50 | 14.5 / 4.00 | 71.1 / 51.9 | 18.9 / 14.3 | 7.80 / 5.30 | 8.60 / 10.3 | 4.40 / 1.60 | 1.00 / 0.60 | 8.40 / 6.40 | 1.97 / 1.34 |
| m12 | high | 178 / 94.8 | 91.6–181 | 2.50 / 2.10 | 3.60 / 1.10 | 0.50 / 0.20 | 12.1 / 4.70 | 117 / 59.0 | 32.0 / 21.2 | 11.6 / 6.00 | 18.4 / 10.5 | 3.60 / 1.60 | 0.70 / 0.90 | 5.30 / 7.80 | 2.97 / 1.58 |

### Kamera 60 m — liczniki (przebieg 1)

| scena | jakość | wozy (jedzie) | rys. mid/far | piny | przestoje | draw main/cień | tris main/cień | przebudowy progr./render | upload KB/kl. | alloc MB/s gry | KB/kl. | GC ms/s | style+layout ms/kl. (realne) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 52 (19) | 5/7 | 2 | 27 | 79/37 | 438k/223k | 4 | 13.5 | 7.78 / 7.73 | 132.8 | 0.00 / 0.00 | 1.08 |
| sandbox50 | high | 52 (19) | 12/0 | 2 | 27 | 83/64 | 558k/373k | 6 | 16.5 | 8.82 / 8.80 | 150.5 | 2.31 / 0.00 | 0.02 |
| sandbox100 | low | 102 (29) | 9/0 | 1 | 27 | 63/34 | 458k/237k | 4 | 22.6 | 8.03 / 8.07 | 137.1 | 0.00 / 0.00 | 0.70 |
| sandbox100 | high | 102 (29) | 9/0 | 1 | 27 | 79/61 | 586k/397k | 6 | 22.6 | 9.14 / 9.09 | 156.1 | 2.34 / 0.00 | 0.17 |
| sandbox200 | low | 202 (51) | 14/4 | 1 | 27 | 67/34 | 522k/256k | 4 | 37.0 | 10.9 / 10.9 | 185.5 | 0.00 / 2.32 | 0.72 |
| sandbox200 | high | 202 (51) | 18/0 | 1 | 27 | 80/61 | 628k/396k | 6 | 37.3 | 12.0 / 12.0 | 204.8 | 0.00 / 7.68 | 0.03 |
| m13 | high | 4 (4) | 1/0 | 0 | 2 | 62/46 | 349k/184k | 4 | 1.9 | 4.21 / 4.26 | 71.8 | 0.90 / 0.49 | 0.53 |
| m12 | low | 12 (12) | 2/0 | 0 | 6 | 59/19 | 310k/87k | 2 | 4.2 | 4.13 / 4.35 | 70.5 | 16.8 / 0.00 | 2.32 |
| m12 | high | 12 (12) | 2/0 | 0 | 6 | 62/42 | 401k/224k | 4 | 4.4 | 5.05 / 5.11 | 86.1 | 19.3 / 1.28 | 0.73 |

### Kamera 160 m — ms CPU na sekundę gry (×4, 60 kl.), mediana przebiegu 1 / 2

| scena | jakość | razem | rozrzut razem (min–max) | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne | ms/kl. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 116 / 89.9 | 76.4–116 | 12.3 / 5.00 | 2.50 / 2.10 | 0.50 / 0.40 | 9.80 / 6.70 | 53.7 / 52.6 | 17.5 / 20.2 | 5.20 / 4.90 | 7.10 / 6.10 | 2.90 / 2.30 | 3.40 / 2.60 | 13.0 / 9.10 | 1.93 / 1.50 |
| sandbox50 | high | 203 / 98.3 | 72.8–215 | 5.70 / 5.90 | 2.30 / 2.20 | 0.30 / 0.20 | 13.0 / 6.30 | 113 / 51.1 | 40.8 / 17.5 | 4.90 / 6.60 | 5.20 / 11.7 | 2.10 / 1.50 | 3.00 / 2.40 | 11.7 / 12.2 | 3.38 / 1.64 |
| sandbox100 | low | 151 / 74.4 | 68.2–229 | 10.3 / 5.00 | 4.00 / 2.80 | 0.60 / 0.30 | 14.8 / 10.3 | 66.6 / 35.4 | 19.2 / 14.0 | 6.80 / 3.20 | 20.8 / 5.20 | 2.60 / 2.10 | 2.40 / 2.10 | 11.5 / 7.90 | 2.52 / 1.24 |
| sandbox100 | high | 102 / 116 | 76.4–172 | 5.50 / 7.40 | 3.30 / 3.50 | 0.20 / 0.40 | 13.4 / 14.0 | 41.3 / 57.5 | 16.5 / 25.2 | 4.70 / 4.30 | 6.10 / 11.9 | 2.60 / 2.50 | 2.10 / 2.10 | 18.0 / 11.7 | 1.69 / 1.93 |
| sandbox200 | low | 117 / 98.0 | 80.8–127 | 6.60 / 5.70 | 5.70 / 5.10 | 0.20 / 0.40 | 17.6 / 20.3 | 53.9 / 36.7 | 11.4 / 14.4 | 4.50 / 4.00 | 5.00 / 5.20 | 6.90 / 11.6 | 2.60 / 2.50 | 8.00 / 9.30 | 1.94 / 1.63 |
| sandbox200 | high | 117 / 152 | 94.7–190 | 6.70 / 9.80 | 4.80 / 7.90 | 0.60 / 0.30 | 21.8 / 27.3 | 44.8 / 57.7 | 17.9 / 21.0 | 4.80 / 4.50 | 7.00 / 7.20 | 9.60 / 13.0 | 2.80 / 4.50 | 11.8 / 15.0 | 1.94 / 2.54 |
| m13 | high | 73.5 / 65.0 | 55.3–75.0 | 1.10 / 1.00 | 0.60 / 0.40 | 0.30 / 0.30 | 3.80 / 6.90 | 48.5 / 37.3 | 19.9 / 17.2 | 3.70 / 2.40 | 8.30 / 6.40 | 0.90 / 1.10 | 0.40 / 0.60 | 5.60 / 4.30 | 1.23 / 1.08 |
| m12 | low | 115 / 60.9 | 53.0–128 | 2.20 / 1.60 | 1.20 / 1.20 | 0.60 / 0.30 | 3.90 / 3.20 | 48.4 / 35.1 | 10.8 / 12.7 | 4.10 / 3.20 | 7.20 / 6.20 | 1.60 / 2.00 | 1.40 / 0.70 | 5.40 / 3.90 | 1.92 / 1.01 |
| m12 | high | 63.5 / 65.6 | 41.4–70.5 | 2.10 / 1.20 | 0.80 / 0.80 | 0.20 / 0.60 | 2.00 / 2.30 | 37.6 / 38.4 | 15.0 / 13.9 | 3.90 / 3.60 | 6.90 / 8.00 | 1.30 / 1.80 | 0.60 / 1.00 | 5.80 / 3.00 | 1.06 / 1.09 |

### Kamera 160 m — liczniki (przebieg 1)

| scena | jakość | wozy (jedzie) | rys. mid/far | piny | przestoje | draw main/cień | tris main/cień | przebudowy progr./render | upload KB/kl. | alloc MB/s gry | KB/kl. | GC ms/s | style+layout ms/kl. (realne) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| sandbox50 | low | 52 (18) | 0/19 | 5 | 27 | 61/33 | 427k/219k | 2 | 14.4 | 5.79 / 5.79 | 98.8 | 1.63 / 5.26 | 0.92 |
| sandbox50 | high | 52 (20) | 0/17 | 2 | 25 | 62/41 | 465k/269k | 4 | 13.8 | 6.43 / 6.45 | 109.7 | 3.72 / 1.30 | 5.87 |
| sandbox100 | low | 102 (24) | 0/31 | 3 | 27 | 61/32 | 447k/218k | 2 | 21.2 | 7.17 / 7.29 | 122.4 | 4.03 / 1.55 | 0.22 |
| sandbox100 | high | 102 (24) | 0/29 | 3 | 27 | 62/41 | 481k/269k | 4 | 20.8 | 7.73 / 7.76 | 132 | 2.21 / 4.69 | 0.24 |
| sandbox200 | low | 202 (37) | 0/62 | 60 | 28 | 49/29 | 407k/216k | 2 | 29.4 | 8.72 / 8.57 | 148.9 | 3.55 / 1.58 | 0.42 |
| sandbox200 | high | 202 (36) | 0/60 | 59 | 27 | 52/37 | 433k/244k | 4 | 28.8 | 9.25 / 9.11 | 157.9 | 2.56 / 5.96 | 0.32 |
| m13 | high | 4 (2) | 0/1 | 0 | 3 | 49/31 | 281k/98k | 2 | 2.6 | 3.42 / 3.39 | 58.4 | 2.69 / 1.04 | 0.34 |
| m12 | low | 12 (10) | 0/3 | 2 | 4 | 41/16 | 278k/84k | 2 | 2.4 | 3.26 / 3.24 | 55.6 | 2.41 / 1.56 | 0.63 |
| m12 | high | 12 (12) | 0/3 | 1 | 3 | 41/25 | 303k/139k | 2 | 2.5 | 3.45 / 3.37 | 58.9 | 0.94 / 0.89 | 0.63 |

### Profil CPU (przebieg 1): kubełki ms/s gry

- **sandbox50 low 60 m** (próbkowane 256.38 ms/s): (program) 103; three: draw submit (setProgram, uniforms, GL) 38.43; three: shadow pass (CPU) 18.82; src/render/wagonsView.ts 11.07; three: projectObject (traversal, cull) 11.05; src/ui/sheets.ts 10.53; three: render other 6.2; three: getProgram/getParameters 5.82; src/sim/network.ts 5.58; src/render/view.ts 5.06; src/ui/app.ts 4.27; src/render/buildingsView.ts 3.94
- **sandbox50 low 160 m** (próbkowane 148.89 ms/s): (program) 40.35; three: draw submit (setProgram, uniforms, GL) 26.24; three: shadow pass (CPU) 13.08; three: projectObject (traversal, cull) 7.18; src/ui/sheets.ts 6.24; src/render/wagonsView.ts 6.11; three: render other 5.7; three: getProgram/getParameters 4.33; src/sim/network.ts 3.38; src/ui/hud.ts 3.28; src/ui/app.ts 2.81; src/sim/logistics.ts 2.37
- **sandbox50 high 60 m** (próbkowane 375.23 ms/s): (program) 84.72; three: draw submit (setProgram, uniforms, GL) 79.53; three: shadow pass (CPU) 65.92; three: getProgram/getParameters 22.28; src/render/wagonsView.ts 16.07; three: projectObject (traversal, cull) 13.78; src/ui/sheets.ts 12.05; three: render other 11.24; src/ui/app.ts 5.48; src/render/view.ts 5.07; src/sim/network.ts 4.91; src/ui/eventCard.ts 4.69
- **sandbox50 high 160 m** (próbkowane 244.25 ms/s): (program) 81.23; three: shadow pass (CPU) 30.24; three: draw submit (setProgram, uniforms, GL) 28.73; src/sim/logistics.ts 23.1; src/sim/network.ts 16.06; three: getProgram/getParameters 9.29; src/ui/sheets.ts 6.87; src/render/wagonsView.ts 5.34; three: projectObject (traversal, cull) 4.28; src/ui/stalls.ts 3.75; GC 3.72; three: render other 3.58
- **sandbox100 low 60 m** (próbkowane 305.12 ms/s): (program) 69.82; three: draw submit (setProgram, uniforms, GL) 56.79; three: shadow pass (CPU) 35.95; src/render/wagonsView.ts 17.68; three: projectObject (traversal, cull) 13.49; src/ui/sheets.ts 11.34; three: getProgram/getParameters 9.89; three: render other 9.75; src/ui/app.ts 8.45; src/sim/defs.ts 6.01; src/sim/network.ts 6; src/render/roads.ts 5.33
- **sandbox100 low 160 m** (próbkowane 148.53 ms/s): (program) 37; three: draw submit (setProgram, uniforms, GL) 27.39; three: shadow pass (CPU) 12.13; src/render/wagonsView.ts 7.8; three: projectObject (traversal, cull) 6.47; src/ui/sheets.ts 6.06; three: getProgram/getParameters 4.97; three: render other 4.66; GC 4.03; src/sim/network.ts 3.09; src/render/heightfield.ts 2.65; src/render/roads.ts 2.55
- **sandbox100 high 60 m** (próbkowane 325.74 ms/s): (program) 106.22; three: draw submit (setProgram, uniforms, GL) 51.64; three: shadow pass (CPU) 37.15; src/render/wagonsView.ts 19.61; three: getProgram/getParameters 12.69; src/ui/sheets.ts 10.28; three: projectObject (traversal, cull) 8.78; src/render/roads.ts 7.7; three: render other 7.57; src/ui/app.ts 5.96; src/render/view.ts 5.27; src/sim/network.ts 5.21
- **sandbox100 high 160 m** (próbkowane 157.4 ms/s): (program) 30.28; three: draw submit (setProgram, uniforms, GL) 27.35; three: shadow pass (CPU) 16.54; src/render/wagonsView.ts 10.16; three: getProgram/getParameters 7.53; src/ui/sheets.ts 7.25; src/sim/network.ts 5.68; three: projectObject (traversal, cull) 5.3; three: render other 5.15; src/render/roads.ts 3.83; src/ui/stalls.ts 3.39; src/sim/logistics.ts 3.09
- **sandbox200 low 60 m** (próbkowane 384.39 ms/s): (program) 79.39; three: draw submit (setProgram, uniforms, GL) 58.14; src/render/wagonsView.ts 48.24; three: shadow pass (CPU) 41.48; src/render/roads.ts 19.77; three: projectObject (traversal, cull) 17.62; three: getProgram/getParameters 9.5; src/ui/sheets.ts 8.86; src/sim/network.ts 7.98; three: render other 7.46; src/render/lighting.ts 7.46; src/ui/app.ts 6.44
- **sandbox200 low 160 m** (próbkowane 175.12 ms/s): (program) 68.63; src/render/roads.ts 13.17; src/render/wagonsView.ts 13.15; three: draw submit (setProgram, uniforms, GL) 13.01; three: shadow pass (CPU) 8.93; src/ui/sheets.ts 5.42; src/ui/markers.ts 4.85; three: projectObject (traversal, cull) 4.19; src/sim/network.ts 4.14; GC 3.55; three: render other 3.44; src/render/view.ts 3.11
- **sandbox200 high 60 m** (próbkowane 272.19 ms/s): (program) 88.7; three: draw submit (setProgram, uniforms, GL) 34.04; three: shadow pass (CPU) 28.98; src/ui/sheets.ts 22.08; src/render/wagonsView.ts 16.17; src/render/roads.ts 12.85; three: projectObject (traversal, cull) 8.93; three: getProgram/getParameters 8.36; three: render other 6.25; src/render/view.ts 5.31; src/sim/network.ts 3.94; src/ui/stalls.ts 3.29
- **sandbox200 high 160 m** (próbkowane 220.05 ms/s): (program) 36.62; three: draw submit (setProgram, uniforms, GL) 26.05; src/render/wagonsView.ts 23.99; src/render/roads.ts 21.74; three: shadow pass (CPU) 18.77; three: projectObject (traversal, cull) 10.71; src/ui/sheets.ts 9.38; src/ui/markers.ts 7.17; src/sim/network.ts 7.08; src/render/view.ts 6.44; three: getProgram/getParameters 6.31; three: render other 5.89
- **m13 high 60 m** (próbkowane 196.75 ms/s): (program) 77.96; three: draw submit (setProgram, uniforms, GL) 38.54; three: shadow pass (CPU) 28.71; src/ui/app.ts 9.29; three: render other 6.41; three: getProgram/getParameters 5.18; three: projectObject (traversal, cull) 5.13; src/render/view.ts 3.85; src/ui/hud.ts 2.62; src/render/deckGhost.ts 2.51; src/render/wagonsView.ts 2.35; src/ui/fmt.ts 1.82
- **m13 high 160 m** (próbkowane 130.36 ms/s): (program) 28.87; three: draw submit (setProgram, uniforms, GL) 26.68; three: shadow pass (CPU) 20.14; src/ui/app.ts 13.45; src/render/wagonsView.ts 4.54; three: render other 4.49; three: projectObject (traversal, cull) 4.29; src/ui/markers.ts 3.12; GC 2.69; three: getProgram/getParameters 2.69; src/ui/dom.ts 2.48; src/render/lighting.ts 2.41
- **m12 low 60 m** (próbkowane 189.25 ms/s): (program) 50.27; three: draw submit (setProgram, uniforms, GL) 37.96; three: shadow pass (CPU) 16.99; GC 16.75; src/ui/app.ts 14.33; three: projectObject (traversal, cull) 10.23; three: render other 5.42; three: getProgram/getParameters 5.01; src/ui/dom.ts 3.66; src/render/view.ts 3.3; src/ui/hud.ts 2.86; src/render/wagonsView.ts 2.81
- **m12 low 160 m** (próbkowane 111.83 ms/s): (program) 28.33; three: draw submit (setProgram, uniforms, GL) 25.98; three: projectObject (traversal, cull) 9.38; three: shadow pass (CPU) 7.73; src/ui/app.ts 6.03; three: render other 3.97; three: getProgram/getParameters 3.33; src/ui/hud.ts 3.17; GC 2.41; src/render/wagonsView.ts 2.22; src/sim/sim.ts 1.72; src/ui/markers.ts 1.66
- **m12 high 60 m** (próbkowane 197.65 ms/s): (program) 66.49; three: draw submit (setProgram, uniforms, GL) 25.68; GC 19.29; three: shadow pass (CPU) 17.63; three: render other 11.06; src/ui/app.ts 8.86; three: getProgram/getParameters 7.57; three: projectObject (traversal, cull) 6.59; src/ui/dom.ts 6.18; src/render/view.ts 5.79; src/ui/hud.ts 4.77; src/render/wagonsView.ts 2.06
- **m12 high 160 m** (próbkowane 83.73 ms/s): (program) 36.65; three: draw submit (setProgram, uniforms, GL) 12.68; three: shadow pass (CPU) 6.16; src/ui/app.ts 4.01; src/ui/hud.ts 3.08; three: render other 3.04; src/ui/dom.ts 1.88; three: projectObject (traversal, cull) 1.83; three: getProgram/getParameters 1.75; src/render/wagonsView.ts 1.35; src/ui/fmt.ts 1.34; src/render/view.ts 1.12

### Alokacje (przebieg 1): KB/s gry

- **sandbox50 low 60 m** 7.78 MB/s: src/render/view.ts 1768; src/render/wagonsView.ts 1111; three: getProgram/getParameters 1075; src/render/wagonSpacing.ts 483; src/ui/stalls.ts 405; src/sim/logistics.ts 361; src/render/models/kit.ts 327; src/ui/markers.ts 283
- **sandbox50 low 160 m** 5.79 MB/s: src/render/view.ts 1386; three: getProgram/getParameters 540; src/render/wagonsView.ts 490; src/render/models/kit.ts 439; src/ui/stalls.ts 391; src/sim/logistics.ts 340; src/render/wagonSpacing.ts 324; src/ui/markers.ts 319
- **sandbox50 high 60 m** 8.82 MB/s: src/render/view.ts 2019; three: getProgram/getParameters 1581; src/render/wagonsView.ts 1338; src/render/wagonSpacing.ts 461; src/ui/stalls.ts 402; src/sim/logistics.ts 367; src/render/models/kit.ts 332; src/ui/markers.ts 297
- **sandbox50 high 160 m** 6.43 MB/s: src/render/view.ts 1507; three: getProgram/getParameters 1070; src/render/wagonsView.ts 492; src/render/models/kit.ts 441; src/ui/stalls.ts 374; src/sim/logistics.ts 354; src/render/wagonSpacing.ts 351; src/ui/markers.ts 290
- **sandbox100 low 60 m** 8.03 MB/s: src/render/view.ts 1568; three: getProgram/getParameters 1065; src/render/wagonsView.ts 860; src/render/wagonSpacing.ts 578; src/render/roads.ts 564; src/ui/stalls.ts 387; src/ui/markers.ts 384; src/sim/logistics.ts 374
- **sandbox100 low 160 m** 7.17 MB/s: src/render/view.ts 1454; src/render/wagonsView.ts 849; src/render/models/kit.ts 666; three: getProgram/getParameters 535; src/render/wagonSpacing.ts 524; src/render/heightfield.ts 425; src/ui/markers.ts 415; src/ui/stalls.ts 405
- **sandbox100 high 60 m** 9.14 MB/s: src/render/view.ts 1975; three: getProgram/getParameters 1582; src/render/wagonsView.ts 864; src/render/wagonSpacing.ts 595; src/render/roads.ts 563; src/ui/stalls.ts 402; src/ui/markers.ts 395; src/sim/logistics.ts 371
- **sandbox100 high 160 m** 7.73 MB/s: src/render/view.ts 1591; three: getProgram/getParameters 1066; src/render/wagonsView.ts 801; src/render/models/kit.ts 639; src/render/wagonSpacing.ts 525; src/ui/markers.ts 417; src/ui/stalls.ts 403; src/sim/logistics.ts 390
- **sandbox200 low 60 m** 10.87 MB/s: src/render/view.ts 1661; src/render/roads.ts 1529; src/render/wagonsView.ts 1516; three: getProgram/getParameters 1063; src/render/wagonSpacing.ts 874; src/ui/markers.ts 650; src/render/models/kit.ts 527; src/sim/logistics.ts 422
- **sandbox200 low 160 m** 8.72 MB/s: src/render/view.ts 1432; src/render/roads.ts 1326; src/ui/markers.ts 1249; src/render/wagonsView.ts 1122; src/render/wagonSpacing.ts 638; three: getProgram/getParameters 542; src/sim/logistics.ts 419; src/ui/stalls.ts 411
- **sandbox200 high 60 m** 12 MB/s: src/render/view.ts 2003; src/render/wagonsView.ts 1631; three: getProgram/getParameters 1591; src/render/roads.ts 1575; src/render/wagonSpacing.ts 851; src/ui/markers.ts 628; src/render/models/kit.ts 535; src/sim/logistics.ts 410
- **sandbox200 high 160 m** 9.25 MB/s: src/render/view.ts 1479; src/render/roads.ts 1432; src/ui/markers.ts 1179; src/render/wagonsView.ts 1121; three: getProgram/getParameters 1075; src/render/wagonSpacing.ts 554; src/sim/logistics.ts 418; src/ui/stalls.ts 408
- **m13 high 60 m** 4.21 MB/s: three: getProgram/getParameters 1038; three: render (other) 895; src/render/wagonsView.ts 407; three: shadow pass 385; src/ui/hud.ts 315; src/render/instancedParts.ts 191; src/render/lighting.ts 169; src/ui/stalls.ts 113
- **m13 high 160 m** 3.42 MB/s: three: render (other) 819; three: getProgram/getParameters 533; src/render/wagonsView.ts 499; src/ui/hud.ts 333; three: shadow pass 220; src/render/lighting.ts 122; src/render/instancedParts.ts 106; src/render/wagonSpacing.ts 87
- **m12 low 60 m** 4.13 MB/s: three: render (other) 1007; src/render/wagonsView.ts 599; three: getProgram/getParameters 537; src/ui/hud.ts 274; three: shadow pass 170; src/render/lighting.ts 156; src/render/instancedParts.ts 141; src/render/wagonSpacing.ts 129
- **m12 low 160 m** 3.26 MB/s: three: render (other) 768; three: getProgram/getParameters 538; src/render/wagonsView.ts 309; src/ui/markers.ts 133; src/render/wagonSpacing.ts 128; three: shadow pass 127; src/render/lighting.ts 121; src/ui/dom.ts 119
- **m12 high 60 m** 5.05 MB/s: src/render/view.ts 1489; three: getProgram/getParameters 1044; src/render/wagonsView.ts 586; src/ui/hud.ts 267; src/sim/logistics.ts 233; src/render/lighting.ts 158; src/render/instancedParts.ts 142; src/render/wagonSpacing.ts 128
- **m12 high 160 m** 3.45 MB/s: src/render/view.ts 981; three: getProgram/getParameters 531; src/render/wagonsView.ts 297; src/render/instancedParts.ts 248; src/render/wagonSpacing.ts 138; src/ui/markers.ts 134; src/render/lighting.ts 125; src/ui/dom.ts 121
