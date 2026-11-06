
### Kamera 60 m — ms CPU na sekundę gry (×4, 60 kl.), mediana przebiegu 1 / 2

| scena | jakość | razem | rozrzut razem (min–max) | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne | ms/kl. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base-m12 | high | 258 / 179 | 155–353 | 15.6 / 5.30 | 1.50 / 3.10 | 1.20 / 0.50 | 10.8 / 11.3 | 162 / 112 | 21.6 / 27.6 | 17.4 / 8.70 | 28.2 / 11.2 | 2.90 / 2.70 | 3.60 / 2.90 | 10.2 / 20.0 | 4.30 / 2.99 |
| base-sandbox100 | high | 219 / 452 | 174–858 | 8.00 / 22.4 | 4.10 / 6.80 | 0.70 / 1.10 | 17.5 / 186 | 116 / 213 | 16.3 / 16.2 | 10.9 / 10.1 | 15.7 / 11.3 | 3.00 / 3.30 | 2.80 / 6.20 | 18.9 / 37.5 | 3.66 / 7.54 |
| base-sandbox200 | high | 297 / 300 | 166–364 | 8.40 / 15.3 | 9.40 / 10.9 | 1.00 / 1.00 | 36.2 / 28.5 | 148 / 170 | 26.9 / 30.4 | 8.10 / 8.00 | 7.70 / 23.0 | 3.80 / 8.20 | 4.00 / 8.90 | 16.4 / 11.0 | 4.95 / 5.01 |
| base-sandbox200 | low | 1154 / 438 | 251–1652 | 28.5 / 10.9 | 53.2 / 22.9 | 5.00 / 0.90 | 210 / 43.4 | 680 / 255 | 63.1 / 12.3 | 26.0 / 8.10 | 31.1 / 9.50 | 23.4 / 4.60 | 26.6 / 5.20 | 24.5 / 19.3 | 19.2 / 7.30 |
| cur-m12 | high | 148 / 144 | 140–242 | 5.30 / 3.00 | 1.70 / 1.90 | 0.50 / 0.50 | 9.70 / 11.0 | 94.1 / 86.0 | 20.5 / 19.6 | 10.8 / 6.70 | 14.2 / 18.3 | 2.00 / 2.40 | 1.90 / 0.90 | 8.00 / 14.4 | 2.47 / 2.40 |
| cur-m15 | high | 146 / 146 | 86.9–358 | 9.30 / 1.90 | 1.50 / 1.80 | 0.30 / 0.70 | 4.20 / 3.50 | 79.6 / 62.6 | 29.5 / 24.5 | 5.80 / 16.0 | 11.4 / 8.20 | 3.60 / 1.40 | 0.90 / 1.90 | 5.40 / 5.00 | 2.44 / 2.42 |
| cur-sandbox100 | high | 160 / 433 | 151–509 | 8.10 / 12.1 | 4.80 / 7.00 | 0.50 / 1.00 | 16.7 / 19.6 | 93.5 / 234 | 16.5 / 19.3 | 7.50 / 11.2 | 12.3 / 14.6 | 2.30 / 3.40 | 2.60 / 3.80 | 10.0 / 14.3 | 2.67 / 7.21 |
| cur-sandbox200 | high | 355 / 311 | 159–573 | 13.4 / 11.9 | 13.0 / 8.80 | 1.40 / 0.90 | 59.6 / 68.5 | 180 / 149 | 20.8 / 30.1 | 26.5 / 12.9 | 27.1 / 17.8 | 5.40 / 3.70 | 10.5 / 3.50 | 22.5 / 19.3 | 5.92 / 5.17 |
| cur-sandbox200 | low | 984 / 184 | 167–1194 | 76.7 / 11.3 | 24.8 / 9.00 | 2.40 / 1.50 | 131 / 26.9 | 546 / 89.1 | 47.7 / 10.5 | 35.0 / 9.90 | 73.4 / 12.4 | 15.2 / 3.40 | 11.3 / 6.20 | 79.7 / 13.1 | 16.4 / 3.06 |

### Kamera 60 m — liczniki (przebieg 1)

| scena | jakość | wozy (jedzie) | rys. mid/far | piny | przestoje | draw main/cień | tris main/cień | przebudowy progr./render | upload KB/kl. | alloc MB/s gry | KB/kl. | GC ms/s | style+layout ms/kl. (realne) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base-m12 | high | 12 (12) | 2/0 | 0 | 6 | 62/21 | 401k/112k | 0 | 3.4 | 3.71 / 3.63 | 63.2 | 4.45 / 14.1 | 0.33 |
| base-sandbox100 | high | 102 (29) | 9/0 | 1 | 27 | 79/31 | 586k/199k | 0 | 16.7 | 6.61 / 6.60 | 112.7 | 1.35 / 0.00 | 0.36 |
| base-sandbox200 | high | 202 (51) | 18/0 | 1 | 27 | 80/31 | 629k/198k | 0 | 28.9 | 8.61 / 8.67 | 147 | 1.08 / 1.20 | 0.65 |
| base-sandbox200 | low | 202 (51) | 14/4 | 1 | 27 | 67/17 | 522k/128k | 0 | 28.7 | 8.16 / 8.11 | 139.3 | 1.95 / 1.53 | 1.18 |
| cur-m12 | high | 12 (12) | 2/0 | 0 | 6 | 64/22 | 403k/113k | 0 | 3.6 | 3.80 / 3.53 | 64.9 | 3.56 / 2.56 | 0.41 |
| cur-m15 | high | 5 (5) | 1/0 | 0 | 3 | 46/17 | 324k/88k | 0 | 0.6 | 3.07 / 3.12 | 52.4 | 3.23 / 8.20 | 0.20 |
| cur-sandbox100 | high | 102 (41) | 14/0 | 1 | 27 | 78/30 | 597k/198k | 0 | 20.0 | 7.54 / 7.43 | 128.7 | 2.21 / 17.7 | 0.23 |
| cur-sandbox200 | high | 202 (77) | 9/0 | 2 | 27 | 85/33 | 652k/205k | 0 | 31.2 | 8.63 / 8.63 | 147.3 | 3.92 / 4.72 | 0.79 |
| cur-sandbox200 | low | 202 (77) | 8/1 | 2 | 27 | 67/17 | 535k/131k | 0 | 30.0 | 8.21 / 8.22 | 140.2 | 76.3 / 0.00 | 15.61 |

### Kamera 160 m — ms CPU na sekundę gry (×4, 60 kl.), mediana przebiegu 1 / 2

| scena | jakość | razem | rozrzut razem (min–max) | sim | afterTick | onTick UI | wagons.frame | render() | z tego cień | view inne | hud | pinezki | ranking | App inne | ms/kl. |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base-m12 | high | 105 / 80.0 | 39.3–118 | 6.10 / 1.00 | 1.90 / 1.20 | 0.30 / 0.60 | 4.30 / 16.5 | 46.6 / 45.3 | 8.20 / 5.20 | 3.30 / 3.30 | 8.70 / 3.80 | 1.50 / 1.30 | 0.40 / 0.80 | 8.20 / 4.40 | 1.75 / 1.33 |
| base-sandbox100 | high | 127 / 108 | 84.0–133 | 13.4 / 6.00 | 2.20 / 3.20 | 0.40 / 0.30 | 8.90 / 10.0 | 58.7 / 58.5 | 9.20 / 8.30 | 4.60 / 5.00 | 6.00 / 7.20 | 3.20 / 3.40 | 2.60 / 3.10 | 13.7 / 9.50 | 2.11 / 1.80 |
| base-sandbox200 | high | 188 / 165 | 97.1–220 | 6.80 / 8.50 | 4.80 / 7.80 | 0.70 / 0.60 | 12.7 / 18.1 | 63.1 / 76.6 | 7.30 / 8.20 | 5.20 / 6.60 | 8.90 / 9.40 | 8.50 / 11.0 | 4.80 / 5.10 | 12.9 / 15.9 | 3.14 / 2.74 |
| base-sandbox200 | low | 140 / 125 | 106–315 | 7.60 / 8.00 | 5.90 / 4.80 | 0.20 / 0.60 | 18.6 / 12.2 | 65.7 / 58.6 | 10.3 / 5.70 | 4.50 / 5.70 | 8.20 / 6.50 | 11.0 / 9.50 | 3.50 / 2.90 | 12.9 / 15.9 | 2.34 / 2.08 |
| cur-m12 | high | 89.8 / 57.9 | 50.2–102 | 2.20 / 2.10 | 1.50 / 1.10 | 0.40 / 0.50 | 3.70 / 2.70 | 55.2 / 38.0 | 11.0 / 6.70 | 5.30 / 2.90 | 7.50 / 4.90 | 1.80 / 1.50 | 2.40 / 0.70 | 5.60 / 3.90 | 1.50 / 0.96 |
| cur-m15 | high | 74.8 / 75.1 | 57.6–106 | 1.00 / 1.50 | 1.60 / 1.00 | 0.30 / 0.40 | 1.80 / 2.70 | 36.5 / 50.2 | 7.10 / 10.0 | 2.20 / 4.50 | 8.70 / 6.70 | 0.60 / 0.60 | 0.40 / 0.70 | 8.50 / 5.70 | 1.25 / 1.25 |
| cur-sandbox100 | high | 133 / 127 | 106–210 | 10.1 / 8.90 | 5.30 / 3.60 | 0.50 / 0.80 | 16.1 / 10.9 | 62.7 / 70.7 | 9.30 / 10.5 | 6.40 / 5.50 | 10.5 / 9.30 | 4.20 / 3.70 | 3.30 / 3.50 | 10.8 / 9.20 | 2.21 / 2.11 |
| cur-sandbox200 | high | 132 / 144 | 93.4–201 | 7.80 / 8.60 | 6.90 / 6.70 | 0.30 / 0.70 | 21.9 / 23.2 | 60.2 / 71.6 | 6.40 / 7.00 | 5.80 / 5.00 | 10.8 / 8.10 | 2.20 / 3.50 | 2.80 / 4.10 | 9.70 / 11.2 | 2.20 / 2.41 |
| cur-sandbox200 | low | 251 / 142 | 113–412 | 10.2 / 8.10 | 19.9 / 7.50 | 5.60 / 0.70 | 40.1 / 18.3 | 66.0 / 58.8 | 7.30 / 6.00 | 13.6 / 4.90 | 15.7 / 13.6 | 4.60 / 3.70 | 10.9 / 3.10 | 10.0 / 8.70 | 4.18 / 2.36 |

### Kamera 160 m — liczniki (przebieg 1)

| scena | jakość | wozy (jedzie) | rys. mid/far | piny | przestoje | draw main/cień | tris main/cień | przebudowy progr./render | upload KB/kl. | alloc MB/s gry | KB/kl. | GC ms/s | style+layout ms/kl. (realne) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base-m12 | high | 12 (12) | 0/3 | 1 | 3 | 41/13 | 303k/70k | 0 | 2.1 | 2.53 / 2.49 | 43.2 | 1.22 / 1.01 | 0.66 |
| base-sandbox100 | high | 102 (24) | 0/28 | 3 | 27 | 62/21 | 481k/134k | 0 | 17.8 | 6.21 / 6.20 | 105.9 | 1.41 / 56.2 | 1.44 |
| base-sandbox200 | high | 202 (37) | 0/60 | 59 | 27 | 52/19 | 433k/122k | 0 | 25.9 | 6.79 / 6.68 | 115.9 | 2.32 / 2.96 | 0.32 |
| base-sandbox200 | low | 202 (36) | 0/61 | 60 | 28 | 49/14 | 406k/108k | 0 | 26.5 | 6.84 / 6.71 | 116.8 | 3.47 / 2.12 | 0.65 |
| cur-m12 | high | 12 (12) | 0/3 | 1 | 3 | 43/14 | 305k/71k | 0 | 2.3 | 2.69 / 2.66 | 45.9 | 1.59 / 1.52 | 0.67 |
| cur-m15 | high | 5 (4) | 0/1 | 0 | 2 | 37/12 | 287k/56k | 0 | 1.7 | 2.25 / 2.27 | 38.3 | 2.57 / 1.41 | 9.32 |
| cur-sandbox100 | high | 102 (35) | 0/37 | 3 | 27 | 61/20 | 489k/137k | 0 | 18.6 | 6.89 / 6.90 | 117.6 | 18.5 / 2.34 | 0.24 |
| cur-sandbox200 | high | 202 (58) | 0/60 | 2 | 27 | 58/20 | 516k/139k | 0 | 28.2 | 8.90 / 8.22 | 151.9 | 2.41 / 13.3 | 0.23 |
| cur-sandbox200 | low | 202 (59) | 0/63 | 3 | 27 | 58/16 | 477k/112k | 0 | 30.0 | 8.98 / 8.99 | 153.3 | 12.3 / 0.00 | 3.87 |

### Profil CPU (przebieg 1): kubełki ms/s gry

- **base-m12 high 60 m** (próbkowane 256.83 ms/s): three: draw submit (setProgram, uniforms, GL) 64.21; (program) 61.85; three: shadow pass (CPU) 25.23; three: projectObject (traversal, cull) 22.32; native getBoundingClientRect 14.15; native frame 10.89; three: render other 4.57; GC 4.45; native lastUndoable 4; native setHtml 3.76; three (outside render) 3.39; native querySelectorAll 3.22
- **base-m12 high 160 m** (próbkowane 116.86 ms/s): three: draw submit (setProgram, uniforms, GL) 36.43; (program) 18.82; three: projectObject (traversal, cull) 10.56; three: shadow pass (CPU) 8.99; native getBoundingClientRect 5.82; three: render other 4.98; native frame 3.26; native update 3.14; native fmtDayTime 1.47; GC 1.22; native vnoise 1.18; native setHtml 1.15
- **base-sandbox100 high 60 m** (próbkowane 221.63 ms/s): (program) 73.5; three: draw submit (setProgram, uniforms, GL) 39.96; three: shadow pass (CPU) 14; three: projectObject (traversal, cull) 10.72; native getBoundingClientRect 7.86; native frame 7.05; three: render other 5.93; native dijkstra 4.6; three (outside render) 4.03; native obj.<computed> 3.8; native outputGoods 3.49; native update 3.47
- **base-sandbox100 high 160 m** (próbkowane 150.39 ms/s): three: draw submit (setProgram, uniforms, GL) 32.19; (program) 32.02; three: projectObject (traversal, cull) 13.16; three: shadow pass (CPU) 8.95; three: render other 6.12; native frame 6.11; native getBoundingClientRect 5.86; native fmtInt 4.27; native dijkstra 3.78; native update 3.44; three (outside render) 2.6; native stableParking 2.09
- **base-sandbox200 high 60 m** (próbkowane 234.4 ms/s): (program) 94.37; three: draw submit (setProgram, uniforms, GL) 36.94; native frame 15.13; three: projectObject (traversal, cull) 13.93; three: shadow pass (CPU) 8.63; three: render other 6.21; three (outside render) 5.95; native dijkstra 5.14; native getBoundingClientRect 4.56; native obj.<computed> 2.31; native update 2.18; native granaryRelief 2.17
- **base-sandbox200 high 160 m** (próbkowane 288.32 ms/s): (program) 51.4; three: draw submit (setProgram, uniforms, GL) 41.5; native idleStatus 37.95; three: render other 27.08; native update 15.84; three: projectObject (traversal, cull) 14.58; native frame 12.56; native markOpposing 11.01; three: shadow pass (CPU) 9.86; native getBoundingClientRect 8.3; native dijkstra 6.1; native afterTick 4.23
- **base-sandbox200 low 60 m** (próbkowane 291.89 ms/s): (program) 134.81; three: draw submit (setProgram, uniforms, GL) 45.05; three: projectObject (traversal, cull) 16.68; native afterTick 14.64; three: shadow pass (CPU) 7.5; native frame 7.11; three (outside render) 5.61; three: render other 4.88; native update 3.89; native getBoundingClientRect 3.79; native pushRig 3.7; native dijkstra 3.01
- **base-sandbox200 low 160 m** (próbkowane 231.6 ms/s): three: draw submit (setProgram, uniforms, GL) 65.65; (program) 25.1; three: projectObject (traversal, cull) 18.11; native frame 12.3; three: shadow pass (CPU) 11.07; native getBoundingClientRect 9.56; three: render other 8.53; native update 7.98; native dijkstra 5.33; native anchorOf 3.74; three (outside render) 3.71; GC 3.47
- **cur-m12 high 60 m** (próbkowane 280.39 ms/s): (program) 56.45; three: draw submit (setProgram, uniforms, GL) 48.82; native remove 41.61; three: projectObject (traversal, cull) 19.83; three: shadow pass (CPU) 17.19; native obj.<computed> 13.62; three: render other 10.35; native update 9.15; native setHtml 7.69; three (outside render) 6.39; native getBoundingClientRect 6.34; native frame 5.98
- **cur-m12 high 160 m** (próbkowane 133.82 ms/s): three: draw submit (setProgram, uniforms, GL) 39.08; (program) 26.89; three: projectObject (traversal, cull) 11.31; three: shadow pass (CPU) 9.61; native getBoundingClientRect 6.48; three: render other 5.56; native update 3.67; native frame 2.78; native fmtDayTime 2.33; native end 2.17; native dijkstra 1.82; native wagonDrawLag 1.77
- **cur-m15 high 60 m** (próbkowane 242.49 ms/s): (program) 86.24; three: draw submit (setProgram, uniforms, GL) 42.44; three: shadow pass (CPU) 19.61; native afterTick 13.45; native updateContract 11.01; three: render other 7.4; native getBoundingClientRect 6.3; three: projectObject (traversal, cull) 5.65; native obj.<computed> 5.12; native update 4.77; native fmtDayTime 4.28; native frame 3.67
- **cur-m15 high 160 m** (próbkowane 67.28 ms/s): (program) 19.72; three: draw submit (setProgram, uniforms, GL) 13.86; three: shadow pass (CPU) 5.03; three: projectObject (traversal, cull) 3.46; native frame 2.81; three: render other 2.69; GC 2.57; native getBoundingClientRect 2.29; native update 1.58; native obj.<computed> 1.33; three (outside render) 0.85; native fmtInt 0.66
- **cur-sandbox100 high 60 m** (próbkowane 298.84 ms/s): three: draw submit (setProgram, uniforms, GL) 91.91; (program) 57.98; three: projectObject (traversal, cull) 30.39; three: shadow pass (CPU) 21.52; three: render other 8.08; native frame 8.05; native put 6.77; native dijkstra 6; three (outside render) 4.67; native getBoundingClientRect 4.65; native obj.<computed> 4.36; native update 3.89
- **cur-sandbox100 high 160 m** (próbkowane 211.2 ms/s): three: draw submit (setProgram, uniforms, GL) 48.79; (program) 37.51; GC 18.47; three: render other 10.24; three: projectObject (traversal, cull) 10.1; three: shadow pass (CPU) 9.6; native getBoundingClientRect 9.21; native frame 8.28; native obj.<computed> 5.58; native update 5.48; native dispatch 4.89; native dijkstra 4.84
- **cur-sandbox200 high 60 m** (próbkowane 362.07 ms/s): (program) 85.42; three: draw submit (setProgram, uniforms, GL) 64.27; native isRaining 63.97; three: projectObject (traversal, cull) 28.36; three: shadow pass (CPU) 23.54; native getBoundingClientRect 8.59; native frame 7.86; three: render other 7.84; native dijkstra 6.19; native update 5.12; three (outside render) 4.76; GC 3.92
- **cur-sandbox200 high 160 m** (próbkowane 169.84 ms/s): three: draw submit (setProgram, uniforms, GL) 38.97; (program) 28.58; three: shadow pass (CPU) 13.75; native frame 10.59; three: projectObject (traversal, cull) 10.49; native getBoundingClientRect 5.97; three: render other 5.74; native update 5.22; native dijkstra 4.72; three (outside render) 3.61; native anchorOf 2.67; native wagonDrawLag 2.42
- **cur-sandbox200 low 60 m** (próbkowane 596.55 ms/s): (program) 203.1; three: draw submit (setProgram, uniforms, GL) 117.18; GC 76.34; three: projectObject (traversal, cull) 67.31; three: render other 19.68; three (outside render) 14.81; native frame 9.71; three: shadow pass (CPU) 8.52; native dijkstra 7.08; native afterTick 6; native obj.<computed> 5.74; native getBoundingClientRect 5.73
- **cur-sandbox200 low 160 m** (próbkowane 353.37 ms/s): (program) 97.83; native setHtml 69.84; three: draw submit (setProgram, uniforms, GL) 36.45; native obj.<computed> 21.48; three: projectObject (traversal, cull) 15.89; GC 12.28; native setText 12.18; native frame 9.7; native afterTick 8.36; native window.requestAnimationFrame 7.46; three: shadow pass (CPU) 6.97; three: render other 5.86

### Alokacje (przebieg 1): KB/s gry

- **base-m12 high 60 m** 3.71 MB/s: three: render (other) 1149; buildingById 278; frame 185; three: shadow pass 165; update 125; yardPileGood 122; end 118; next 113
- **base-m12 high 160 m** 2.53 MB/s: three: render (other) 765; end 178; frame 177; next 134; update 111; addUpdateRange 89; wagonDrawLag 81; three: shadow pass 80
- **base-sandbox100 high 60 m** 6.61 MB/s: three: render (other) 1272; update 541; frame 516; hash3 246; three: shadow pass 232; dispatch 202; wagonDrawLag 194; join 189
- **base-sandbox100 high 160 m** 6.21 MB/s: three: render (other) 1022; frame 634; hash3 530; update 513; detail 324; next 304; calmStall 228; anchorOf 212
- **base-sandbox200 high 60 m** 8.61 MB/s: three: render (other) 1299; frame 882; update 754; hash3 435; wagonDrawLag 296; subarray 289; detail 275; stableParking 259
- **base-sandbox200 high 160 m** 6.79 MB/s: update 1247; three: render (other) 896; frame 726; anchorOf 318; next 255; calmStall 234; wagonDrawLag 223; set 191
- **base-sandbox200 low 60 m** 8.16 MB/s: three: render (other) 1164; frame 857; update 794; hash3 430; wagonDrawLag 299; stableParking 269; set 267; detail 250
- **base-sandbox200 low 160 m** 6.84 MB/s: update 1302; three: render (other) 880; frame 752; anchorOf 343; next 287; calmStall 240; wagonDrawLag 220; set 204
- **cur-m12 high 60 m** 3.8 MB/s: three: render (other) 1157; frame 190; buildingById 172; three: shadow pass 165; next 162; end 132; yardPileGood 126; update 119
- **cur-m12 high 160 m** 2.69 MB/s: three: render (other) 794; frame 185; end 180; next 145; update 112; addUpdateRange 99; wagonDrawLag 85; three: shadow pass 80
- **cur-m15 high 60 m** 3.07 MB/s: three: render (other) 948; frame 211; next 145; three: shadow pass 144; buildingById 129; update 86; end 85; push 85
- **cur-m15 high 160 m** 2.25 MB/s: three: render (other) 693; frame 179; next 113; update 87; yardPileGood 77; three: shadow pass 68; exec 56; push 49
- **cur-sandbox100 high 60 m** 7.54 MB/s: three: render (other) 1273; frame 618; update 557; hash3 355; dispatch 271; wagonDrawLag 251; subarray 239; three: shadow pass 228
- **cur-sandbox100 high 160 m** 6.89 MB/s: three: render (other) 1013; frame 714; hash3 706; update 487; detail 439; next 418; calmStall 235; wagonDrawLag 220
- **cur-sandbox200 high 60 m** 8.63 MB/s: three: render (other) 1334; frame 861; update 796; hash3 386; wagonDrawLag 316; dispatch 302; stableParking 271; set 262
- **cur-sandbox200 high 160 m** 8.9 MB/s: hash3 1120; frame 1093; three: render (other) 969; update 776; detail 694; next 352; vnoise 285; wagonDrawLag 265
- **cur-sandbox200 low 60 m** 8.21 MB/s: three: render (other) 1137; frame 828; update 825; hash3 385; wagonDrawLag 328; dispatch 297; stableParking 272; set 255
- **cur-sandbox200 low 160 m** 8.98 MB/s: hash3 1183; frame 1151; three: render (other) 970; update 743; detail 726; next 354; vnoise 291; wagonDrawLag 269
