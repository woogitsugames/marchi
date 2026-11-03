# MARCHIA · Assets

Every third-party file shipped with the game is listed here. Only CC0 (art) and OFL / permissive
(fonts, code) sources are allowed — see `docs/ART_DIRECTION.md`.

## Textures (PBR, CC0)

All ten sets come from **Poly Haven** (https://polyhaven.com, licence **CC0 1.0**, no attribution
required — authors listed anyway). Downloaded at 1k and 4k from `https://dl.polyhaven.org` (JPG:
`_diff`, `_nor_gl`, `_arm`) via `https://api.polyhaven.com/files/<id>` (`tools/textures/fetch.py`).

| Set (`public/assets/textures/<name>/`) | Use | Poly Haven asset | Tile size (m) | Terrain (512 variant) |
|---|---|---|---:|---|
| `meadow` | wet autumn meadow, dominant terrain | Sparse Grass (`sparse_grass`) | 2.0 | yes |
| `mud_track` | dirt road / wheel ruts, wet ground | Brown Mud 02 (`brown_mud_02`) | 1.3 | yes |
| `cobblestone` | village cobbles, castle yard | Cobblestone Floor 13 (`cobblestone_floor_13`) | 2.0 | yes |
| `riverbank` | river bank gravel / wet soil | River Small Rocks (`river_small_rocks`) | 2.9 | yes |
| `forest_floor` | leaf litter under trees | Forest Leaves 03 (`forest_leaves_03`) | 2.3 | yes |
| `wood_planks` | bridges, wagons, timber walls | Old Planks 02 (`old_planks_02`) | 2.0 | no |
| `thatch` | thatched / reed roofs | Reed Roof 04 (`reed_roof_04`) | 2.5 | no |
| `fieldstone_wall` | castle, stone bridge, foundations | Old Stone Wall (`old_stone_wall`) | 2.0 | no |
| `bark` | tree trunks | Bark Brown 02 (`bark_brown_02`) | 1.0 | no |
| `plaster_daub` | lime-washed wattle-and-daub walls | Worn Mossy Plasterwall (`worn_mossy_plasterwall`) | 1.8 | no |

Manifest + loader: `src/render/textures.ts` (`TEXTURES`, `initTextureLoaders(renderer)`,
`loadPbrSet(name, 'ultra' | 'high' | 'low')`, `setUltraBase(url)`); terrain arrays: `src/render/terrainTextures.ts`
(`loadTerrainTextures(quality)`). Contact sheet of all albedos (from the 4k sources): `docs/shots/textures.png`.

### Files per set

Shipped in `public/assets/textures/<set>/` since D-22 (only files some tier loads):

| Set kind | KTX2 | JPG |
|---|---|---|
| terrain (`meadow`, `mud_track`, `cobblestone`, `riverbank`, `forest_floor`) | `albedo_2048`, `orm_2048` (ETC1S q255), `normal` (1024 UASTC) — **not** Y-flipped (array layers) | `albedo_512`, `normal_512`, `orm_512` (low tier + fallback) |
| model (`wood_planks`, `thatch`, `fieldstone_wall`, `bark`, `plaster_daub`) | `orm_2048` (ETC1S q255), `orm` (1024 ETC1S q160, low), `normal` (1024 UASTC) — Y-flipped | `normal`, `orm` (1024, fallback only) |

- Model sets ship **no albedo**: model materials take their colour from vertex colours and load
  `loadPbrSet(name, q, { albedo: false })`.
- `normal*` — **OpenGL convention** (+Y up, Poly Haven `nor_gl`), what three.js expects; JPG q90.
- `orm*` — R = ambient occlusion, G = roughness, B = 0 (Poly Haven `arm` with metal zeroed);
  bind the same texture as `aoMap` and `roughnessMap`. Linear (NoColorSpace).
- Model-set KTX2 are encoded **Y-flipped** so they line up with the JPGs loaded with three.js'
  default `flipY = true` (KTX2 cannot be flipped on upload). Terrain-set KTX2 are not flipped:
  they are stitched into `CompressedArrayTexture`s, which upload unflipped like the canvas-decoded
  512 JPG arrays. Verified in Chromium (2026-11-01, D-22): terrain arrays high/ultra vs low JPG
  arrays correlate 0.60–0.95 same orientation vs −0.05–0.17 flipped (albedo and normal G);
  model normals KTX2 vs JPG 0.13–0.92 vs −0.06–0.04 flipped.
- **One fallback path** (no KTX2 loader, or a KTX2 file fails): terrain → 512 JPG arrays, models →
  1024 normal + ORM JPGs, in every tier.

### Colour grading (subtle)

Done in Python/Pillow on the sRGB values: `lum = Rec.709 luma`, `c' = lum + s·(c − lum)`,
then the whole image is shifted by `k·(target − mean(c'))`, clamped to [0.02, 0.96] (no pure
black/white). Per-set `(s, k, target)` and the resulting mean colour:

| Set | s | k | Target (palette) | Mean before → after | Mean pixel HSV-S before → after |
|---|---:|---:|---|---|---|
| meadow | 0.65 | 0.50 | `#56603f` | `#4f3d15` → `#4f4e31` | 0.74 → 0.40 |
| mud_track | 0.90 | 0.30 | `#5a4a39` | `#4c4437` → `#504638` | 0.29 → 0.30 |
| cobblestone | 0.85 | 0.25 | `#8a8478` | `#8d8064` → `#8b816c` | 0.29 → 0.22 |
| riverbank | 0.85 | 0.25 | `#6a6458` | `#786c5a` → `#736a5c` | 0.25 → 0.21 |
| forest_floor | 0.70 | 0.30 | `#4a4232` | `#44351f` → `#43392a` | 0.58 → 0.41 |
| wood_planks | 0.85 | 0.25 | `#6b5a48` | `#615446` → `#625648` | 0.28 → 0.27 |
| thatch | 0.85 | 0.30 | `#9a8058` | `#9c8767` → `#998566` | 0.35 → 0.34 |
| fieldstone_wall | 0.85 | 0.25 | `#8a8478` | `#867663` → `#857a6a` | 0.27 → 0.20 |
| bark | 0.80 | 0.25 | `#5a5044` | `#5e553f` → `#5c5444` | 0.36 → 0.29 |
| plaster_daub | 0.85 | 0.25 | `#a9a497` | `#847e72` → `#8c887d` | 0.14 → 0.12 |

Targets: Łąka `#56603f`, Błoto `#5a4a39`, Kamień polny `#8a8478`, Strzecha `#9a8058`; riverbank,
forest floor, planks, bark and plaster use in-between values of those (Mgła-ish grey for plaster).
`reed_roof_04` has a ridge band in its top ~80 px: the top 96 px were cropped, the V seam
cross-faded over 96 rows (all three maps; normals renormalised), the albedo's low-frequency
top-to-bottom shading flattened, then resized back to 1024².

### Sizes

See *Quality tiers → Sizes* below for the current numbers. History: the original 1k set (all ten
sets with albedo, KTX2 albedo + ORM, JPG normals, 512 terrain variants) was 13.9 MB; the Basis
transcoder `public/vendor/basis/` (needed by KTX2Loader) is 0.57 MB.

### KTX2 status

Encoded with the npm package `ktx2-encoder@0.6.0` (Basis Universal WASM, MIT; run from a temp
folder, **not** a project dependency). Settings: albedo ETC1S q160 clevel 2, sRGB transfer +
perceptual; orm ETC1S q160 clevel 2, linear; mipmaps on; Y-flip on.

*(1k history; F-TEX-1 is resolved by D-22: 1024 UASTC normals (RDO λ 3, from the 4k sources) for
all tiers, 11.7 MB for the ten sets — see Quality tiers below. JPG normals remain only as the
no-KTX2 fallback.)* Normals were also encoded as UASTC (RDO λ 4, zstd, normal-map tuning) but came out at
0.7–1.3 MB each (10.3 MB for the high set — over the 12 MB budget on their own), so they are
**not shipped**; normals stay JPG. Follow-up (**F-TEX-1**): decide between (a) UASTC normals only
for the 512 terrain set (1.4 MB total), (b) UASTC with stronger RDO (λ 8–10) + zstd 18 and accept
~0.6–0.9 MB each, or (c) keep JPG. Measure GPU memory on a mid-range Android first — a 1k RGBA8
normal with mips is ~5.3 MB VRAM vs ~1.4 MB as ASTC/ETC2 transcoded.

Exact commands to (re)encode later with KTX-Software `toktx` (≥ 4.3) from 8-bit PNGs of the
shipped JPGs (`--lower_left_maps_to_s0t0` performs the same Y flip):

```bash
# albedo (sRGB, ETC1S)
toktx --t2 --encode etc1s --clevel 2 --qlevel 160 --genmipmap --assign_oetf srgb \
      --lower_left_maps_to_s0t0 albedo.ktx2 albedo.png
# orm (linear, ETC1S)
toktx --t2 --encode etc1s --clevel 2 --qlevel 160 --genmipmap --assign_oetf linear \
      --lower_left_maps_to_s0t0 orm.ktx2 orm.png
# normal (linear, UASTC + RDO + zstd). Do NOT use --normal_mode: it moves Y into alpha,
# which MeshStandardMaterial does not read.
toktx --t2 --encode uastc --uastc_quality 2 --uastc_rdo_l 4 --zcmp 18 --genmipmap \
      --assign_oetf linear --lower_left_maps_to_s0t0 normal.ktx2 normal.png
```

Normals are KTX2 since D-20 (`normalKtx2` in `PbrPaths`); since D-22 one 1024 UASTC normal per set
serves every tier (see below).

### Quality tiers: low / high (2K) / ultra (4K) — D-20, D-22

Owner requirement 2026-11-01: much better textures, 4K, running well on Galaxy Z Fold / Flip
(Snapdragon / Adreno, large high-DPI screens). Owner decision D-17: **2K ships in the APK, the 4K pack
is downloaded in-game** when Ultra is chosen.

| Tier | Albedo + ORM | Normals | Where | Anisotropy |
|---|---|---|---|---|
| `low` | terrain 512 JPG → RGBA8 arrays (no normal/ORM reads in the low shader); models ORM 1024 KTX2 ETC1S q160 | 1024 KTX2 UASTC (models) | APK (`public/`) | min(2, GPU) |
| `high` | 2048 — KTX2 ETC1S q255 (models: ORM only) | 1024 KTX2 UASTC | APK (`public/`) | min(8, GPU) |
| `ultra` | 4096 — KTX2 ETC1S q255 (models: ORM only; bark 2048) | 1024 KTX2 UASTC (same files as high) | download pack `assets-ultra/`; 2048 from the APK without it | min(16, GPU) |

**D-22 (APK budget):** high and ultra used 2048 UASTC normals (45 MB of the APK). They now use
1024 UASTC normals (11.7 MB for all ten sets), encoded from the 4k sources (Lanczos + renormalise).
At the closest zoom a 1024 normal is ~1.5 texels/px on the terrain (cobble layer ~5): the relief
reads the same at game distances, while albedo / ORM keep 2K / 4K for the colour detail and
anisotropic filtering. Files no tier loaded were removed (1k terrain JPG/KTX2, 512 KTX2, all
model albedo, 2048 normals); the ultra pack lost the model albedo_4096 (never loaded).

Sources: the same ten Poly Haven assets at **4k** (`_diff_4k`, `_nor_gl_4k`, `_arm_4k` JPG; ARM is Poly
Haven's own AO + Rough + Metal packing, used instead of separate `_ao` / `_rough`), graded with exactly
the same per-set (s, k, target) as the 1k files (means match the table above to ±2/255; thatch crop /
cross-fade lengths scaled ×4). 2048 is a Lanczos downscale of the graded 4k; the 1024 tier normals
are a Lanczos downscale of the 4k normals, renormalised. The 512 terrain JPGs and the model 1k
JPG / ORM KTX2 files are the original 1k-source files.

**Encoder choice (measured, mip 0 PSNR vs the graded source, meadow = worst case):**

| Map | Candidate | Size 4096 | PSNR R/G/B |
|---|---|---:|---|
| albedo | ETC1S q255 | 3.3 MB | 34.8 / 36.3 / 34.5 |
| albedo | ETC1S q200 | 3.2 MB | 34.6 / 35.9 / 34.2 |
| albedo | UASTC + RDO λ12 + zstd | 11.3 MB | 32.4 / 32.5 / 33.2 |
| normal | UASTC + RDO λ8 + zstd | 16.9 MB | 26.6 / 26.4 / 29.3 |
| normal | UASTC + RDO λ20 + zstd | 15.8 MB | 24.5 / 24.3 / 27.6 |
| normal | ETC1S q255 | 4.4 MB | 23.7 / 23.5 / 26.0 |
| normal (2048) | UASTC level 2, RDO λ3, zstd | 5.0 MB | 28.5 / 28.3 / 29.2 (cobblestone: 41.8 / 41.9 / 48.7) |

UASTC + RDO lost to ETC1S q255 for these noisy natural albedos at 3.4× the size, so albedo and ORM
are ETC1S (transcoded to **ETC2 RGB, 0.5 B/texel** on Adreno/Mali — three's KTX2Loader prefers ETC2 for
ETC1S; BC1/BC7 on desktop). Normals are UASTC (→ **ASTC 4×4, 1 B/texel** on Adreno; BC7 desktop):
ETC1S normals are visibly blocky. 4K normals would cost 10–16 MB each (the grass/leaf normals are
pure noise and do not compress), and at the closest zoom (MIN_DIST 16 m, 32° FOV, ~2000 px
drawing buffer) the meadow is already ~3 texels/pixel at 2048 — so ultra reused the 2048 normals
(D-20); D-22 then dropped both tiers to 1024 normals for the APK budget.
Texel density for reference: terrain uv = world / 3.2 m; at 16 m a 1024 layer gives ~1.5 texels/px,
2048 ~3, 4096 ~6 (cobble layer is ×3.4 denser): 4K helps mostly through anisotropic filtering at
grazing angles and in close/oblique views, not in the head-on centre of the screen.

Settings (`tools/textures/ktx.mjs`, npm **`ktx2-encoder@0.5.4`** in a temp folder, not a project
dependency — 0.6.x / Basis 2.5 refuses sources over ~12 Mpix, so it cannot encode 4096²):
albedo `ETC1S qualityLevel 255, compressionLevel 2, perceptual, sRGB transfer`; orm `ETC1S q255
clevel 2, linear`; normal `UASTC, isNormalMap, uastc level 2, RDO λ 3, zstd, linear`; all with
mipmaps. Y-flip on, **except** the tier files (2048/4096 albedo + ORM, 1024 normals) of the five
terrain sets (meadow, mud_track, forest_floor, riverbank, cobblestone): they are only used as `CompressedArrayTexture` layers, which
upload with flipY = false like the canvas-decoded JPG arrays, and the terrain shader's normal-Y sign
assumes that orientation. Equivalent `toktx`: `--encode etc1s --qlevel 255 --clevel 2` /
`--encode uastc --uastc_quality 2 --uastc_rdo_l 3 --zcmp`.

**Sizes** (MB = 10⁶ bytes)

| Bundle | Before (D-20) | After (D-22) |
|---|---:|---:|
| APK `public/assets/textures` total | 77.5 MB (105 files) | **29.5 MB** (55 files) |
| — loaded by `low` (terrain 512 JPG; model ORM 1k KTX2 + normals) | 3.9 MB (JPG normals) | 7.8 MB (1k UASTC normals) |
| — loaded by `high` (2K albedo/ORM + normals) | 58.3 MB (2048 normals) | **24.8 MB** (1024 normals) |
| — fallback-only files (model 1k normal + ORM JPG) | — | 2.6 MB |
| Ultra 4K pack `assets-ultra/`, **download** | 59.0 MB (18 files) | **44.9 MB** (14 files: terrain albedo + ORM 34.3, model ORM 10.6) |
| Loaded for ultra (pack + normals + bark ORM 2K) | ~106 MB | ~57.5 MB |
| `dist/` (whole web build) | — | 46.2 MB |
| debug APK (`npm run apk`, clean packaging) | ~98 MB | **49.6 MB** |

**Estimated GPU memory** (ETC2 RGB 0.5 B/texel, ASTC 4×4 1 B/texel, RGBA8 4 B/texel, mips ×4/3;
terrain = 5-layer arrays × albedo / normal / ORM; models = normal + ORM of wood, thatch, stone,
plaster, bark — no albedo). Terrain figures match `TerrainTextureSet.gpuBytes` measured in Chromium
(SwiftShader picks the same ETC2 RGB / ASTC 4×4 formats as Adreno):

| Tier | Terrain arrays | Models normal + ORM | Total | Before (D-20) |
|---|---:|---:|---:|---:|
| low (512 JPG → RGBA8 arrays; 1k ETC2 ORM + 1k ASTC normals) | 20 MiB | 10 MiB | **30 MiB** | 50 MiB |
| high (2048 albedo/ORM, 1024 normals) | 33 MiB | 20 MiB | **53 MiB** | 93 MiB |
| ultra (4096 albedo/ORM, bark 2048, 1024 normals) | 113 MiB | 52 MiB | **165 MiB** | 205 MiB |

For comparison a 4096 RGBA8 terrain array set would be ~1.3 GB: 2K/4K are never uploaded
uncompressed (terrain arrays are stitched from the per-layer KTX2 into `CompressedArrayTexture`s).
Only if a GPU exposes no ETC2/ASTC/BC format at all does Basis fall back to RGBA32.

**Ultra pack layout**: `assets-ultra/textures/<set>/orm_4096.ktx2` (9 sets, not bark) and
`albedo_4096.ktx2` (5 terrain sets only) + `assets-ultra/manifest.json` (version 2)
(`pack`, `version`, `totalBytes`, per file `path` / `bytes` / `sha256`; regenerate with
`node tools/textures/ultra-manifest.mjs <version>`). Runtime: `setUltraBase(url)` in
`src/render/textures.ts` points at the folder that contains `textures/`; until then (or if a 4K file
fails) 'ultra' loads the 2K files. Not bundled: `assets-ultra/` is outside `public/`. On the Vite
dev server (`import.meta.env.DEV`) the view calls `setUltraBase('/assets-ultra/')` itself, so
ultra can be tested; production gets the base from the pack downloader. A live view picks up a
new base on its next `setQuality('ultra')`.

**Reproduce** (scratch folder outside the repo):

```bash
python3 -I tools/textures/fetch.py $SCRATCH/src4k 4k              # Poly Haven API, md5-checked
python3 -I tools/textures/process.py $SCRATCH/src4k $SCRATCH/out $SCRATCH/raw4 --tiers   # (--normals: only the 1024 normals)
node tools/textures/ktx.mjs $ENC/node_modules/ktx2-encoder/dist/node/index.js $SCRATCH/raw4 $SCRATCH/ktx
#   copy normal.ktx2 + *_2048.ktx2 into public/assets/textures/<set>/ (no albedo_2048 for model sets),
#   *_4096.ktx2 into assets-ultra/textures/<set>/ (no albedo_4096 for model sets)
node tools/textures/ultra-manifest.mjs 2
node tools/textures/sheet.cjs public/assets/textures docs/shots/textures.png $SCRATCH/raw4
npx vite --port 5176 & node tools/textures/tier-shots.mjs http://localhost:5176   # docs/shots/tex-tier-*.png
```

Tier files (KB; all derived from the same Poly Haven assets/authors as above, CC0, graded as above,
full mips; Y-flipped for model sets only):

| Set | albedo_2048 | orm_2048 | normal (1024 UASTC) | albedo_4096 (pack) | orm_4096 (pack) |
|---|---:|---:|---:|---:|---:|
| `meadow` | 878 | 837 | 1298 | 3398 | 3170 |
| `mud_track` | 867 | 889 | 1283 | 3362 | 3329 |
| `cobblestone` | 901 | 761 | 742 | 3403 | 2822 |
| `riverbank` | 936 | 915 | 1240 | 3616 | 3411 |
| `forest_floor` | 919 | 976 | 1299 | 3378 | 3581 |
| `wood_planks` | — | 702 | 863 | — | 2296 |
| `thatch` | — | 920 | 1289 | — | 3457 |
| `fieldstone_wall` | — | 605 | 1210 | — | 1784 |
| `bark` | — | 930 | 1205 | — | — |
| `plaster_daub` | — | 733 | 997 | — | 2807 |

### Per-file table

| File (`public/assets/textures/…`) | Original asset | Author | Source | Licence | Modifications | KB |
|---|---|---|---|---|---|---:|
| `meadow/albedo_512.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_diff_1k`; sat ×0.65, mean shifted 50 % toward #56603f; 512 px | 54 |
| `meadow/normal.ktx2` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips; **not** Y-flipped (terrain array layer) | 1298 |
| `meadow/normal_512.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_nor_gl_1k` (OpenGL); 512 px | 119 |
| `meadow/orm_512.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_arm_1k` → R=AO, G=rough, B=0; 512 px | 51 |
| `mud_track/albedo_512.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_diff_1k`; sat ×0.9, mean shifted 30 % toward #5a4a39; 512 px | 63 |
| `mud_track/normal.ktx2` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips; **not** Y-flipped (terrain array layer) | 1283 |
| `mud_track/normal_512.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_nor_gl_1k` (OpenGL); 512 px | 136 |
| `mud_track/orm_512.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_arm_1k` → R=AO, G=rough, B=0; 512 px | 64 |
| `cobblestone/albedo_512.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 512 px | 64 |
| `cobblestone/normal.ktx2` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips; **not** Y-flipped (terrain array layer) | 742 |
| `cobblestone/normal_512.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_nor_gl_1k` (OpenGL); 512 px | 46 |
| `cobblestone/orm_512.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_arm_1k` → R=AO, G=rough, B=0; 512 px | 50 |
| `riverbank/albedo_512.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_diff_1k`; sat ×0.85, mean shifted 25 % toward #6a6458; 512 px | 74 |
| `riverbank/normal.ktx2` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips; **not** Y-flipped (terrain array layer) | 1240 |
| `riverbank/normal_512.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_nor_gl_1k` (OpenGL); 512 px | 139 |
| `riverbank/orm_512.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_arm_1k` → R=AO, G=rough, B=0; 512 px | 63 |
| `forest_floor/albedo_512.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_diff_1k`; sat ×0.7, mean shifted 30 % toward #4a4232; 512 px | 84 |
| `forest_floor/normal.ktx2` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips; **not** Y-flipped (terrain array layer) | 1299 |
| `forest_floor/normal_512.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_nor_gl_1k` (OpenGL); 512 px | 143 |
| `forest_floor/orm_512.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_arm_1k` → R=AO, G=rough, B=0; 512 px | 78 |
| `wood_planks/normal.jpg` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_nor_gl_1k` (OpenGL); 1024 px | 223 |
| `wood_planks/normal.ktx2` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips, Y-flipped | 863 |
| `wood_planks/orm.jpg` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_arm_1k` → R=AO, G=rough, B=0; 1024 px | 118 |
| `wood_planks/orm.ktx2` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 126 |
| `thatch/normal.jpg` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_nor_gl_1k` (OpenGL); 1024 px; ridge band cropped, V seam cross-faded | 467 |
| `thatch/normal.ktx2` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips, Y-flipped | 1289 |
| `thatch/orm.jpg` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_arm_1k` → R=AO, G=rough, B=0; 1024 px; ridge band cropped, V seam cross-faded | 222 |
| `thatch/orm.ktx2` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_arm_1k` → R=AO, G=rough, B=0; 1024 px; ridge band cropped, V seam cross-faded; KTX2 ETC1S, Y-flipped, mips | 207 |
| `fieldstone_wall/normal.jpg` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_nor_gl_1k` (OpenGL); 1024 px | 412 |
| `fieldstone_wall/normal.ktx2` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips, Y-flipped | 1210 |
| `fieldstone_wall/orm.jpg` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_arm_1k` → R=AO, G=rough, B=0; 1024 px | 105 |
| `fieldstone_wall/orm.ktx2` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 151 |
| `bark/normal.jpg` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_nor_gl_1k` (OpenGL); 1024 px | 420 |
| `bark/normal.ktx2` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips, Y-flipped | 1205 |
| `bark/orm.jpg` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_arm_1k` → R=AO, G=rough, B=0; 1024 px | 209 |
| `bark/orm.ktx2` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 207 |
| `plaster_daub/normal.jpg` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_nor_gl_1k` (OpenGL); 1024 px | 244 |
| `plaster_daub/normal.ktx2` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_nor_gl_4k` (OpenGL); Lanczos to 1024 px, renormalised; KTX2 UASTC level 2, RDO λ3, zstd, mips, Y-flipped | 997 |
| `plaster_daub/orm.jpg` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_arm_1k` → R=AO, G=rough, B=0; 1024 px | 126 |
| `plaster_daub/orm.ktx2` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 163 |

## Fonts (OFL-1.1)

Placeholder — the UI agent wires these in; licence texts are already in `public/licenses/`.

| Family | Use | Package | Source | Licence | Licence file |
|---|---|---|---|---|---|
| Grenze Gotisch | titles, seals, mission names | `@fontsource/grenze-gotisch` | https://fonts.google.com/specimen/Grenze+Gotisch | OFL-1.1 | `public/licenses/OFL-GrenzeGotisch.txt` |
| Alegreya Sans | body text, numbers, HUD | `@fontsource/alegreya-sans` | https://fonts.google.com/specimen/Alegreya+Sans | OFL-1.1 | `public/licenses/OFL-AlegreyaSans.txt` |

Licence texts fetched from `github.com/google/fonts` (`ofl/grenzegotisch/OFL.txt`,
`ofl/alegreyasans/OFL.txt`); identical terms to the `LICENSE` files in the npm packages.

## Code / runtime files

| File | Origin | Licence | Licence file |
|---|---|---|---|
| `public/vendor/basis/basis_transcoder.js`, `.wasm` | copied unmodified from `three@0.181` `examples/jsm/libs/basis/` (Binomial Basis Universal) | Apache-2.0 | `public/licenses/Apache-2.0-basis_universal.txt` |


## Audio — CC0 field recordings (tasks 07, 18 and 46)

The shipped catalogue contains **36 sound IDs and 72 OGG/M4A files**. The 13 additional recordings were delivered in task 50. The strict catalogue checker includes all 72 files.
Ambient is stereo; SFX/UI is mono, 24 kHz. The combined runtime audio (excluding
music) must remain **below 4 MiB**. The reproducible source manifest is
`tools/audio_sources.json`; verified source and output SHA-256 values are written
to `docs/audio-provenance.json` only **after** source files are actually fetched
and rendered.

### Task 07 — OpenGameArt CC0 field recordings

| Runtime ID | Recording | Author | Licence / limitation |
|---|---|---|---|
| ambient/morning | [Park ambiences](https://opengameart.org/content/park-ambiences) + [dog barking](https://opengameart.org/content/dog-barking-mono) | Thimras; Brandon Morris (via HaelDB) | CC0; winter birds, distant dog; jackdaw not confirmed |
| ambient/river | [Park ambiences](https://opengameart.org/content/park-ambiences) | Thimras | CC0; river and Australian frogs (season not verified) |
| ambient/rain | [AMB Rain Loop 2](https://opengameart.org/content/amb-rain-loop-2) | Kresiek The Furry | CC0; genuine rain, surface not documented |
| ambient/evening | [Park ambiences](https://opengameart.org/content/park-ambiences) | Thimras | CC0; wind, no unverified owl |

The previous `sfx/bridge-wood` proxy (CC0 footsteps on wooden floor by
mikeask) is replaced in task 18 with wooden cart wheels crossing a bridge.

### Task 18 — Freesound CC0 recordings, individually verified

> **Status (integration 1, 2026-11-01): sources approved, NOT yet rendered.** PR #19 delivered the
> manifest, the processing tool and its tests, but no audio binaries (its CI job that was meant to
> render and push them was removed: it needed `contents: write` and pushed commits). The licence of
> all 11 Freesound pages below was re-checked on 2026-11-01 (each page shows "Creative Commons 0").
> Until `python3 tools/process_audio.py --only-freesound --fetch` is run and the result committed with
> `docs/audio-provenance.json`, the shipped `sfx/*` files are still the task 07 / task 02 versions
> (OpenGameArt CC0 recordings and the project's own procedural CC0 sounds), as recorded in
> `docs/audio-provenance.json`.

The following 11 Freesound sound pages were checked for their own **Creative
Commons 0** label on 2026-11-01, author and ID. Fourteen SFX tracks use
these sources (load and unload can use distinct excerpts of the same take).

Freesound requires login/OAuth to download original WAV/FLAC. Without an API
key, the tool resolves the **official high-quality OGG preview** published by
Freesound in the sound page metadata. Each preview is a lossy derivative, not
an original WAV. It is bundled as `tools/audio-src/<ID>-hq.ogg`; its SHA-256 and
the generated runtime pair hashes go in `docs/audio-provenance.json`.

| Runtime ID(s) | Freesound page (author) | Sound ID | License | Processing / caveats |
|---|---|---:|---|---|
| `sfx/cart-dirt` | [craigsmith](https://freesound.org/people/craigsmith/sounds/480020/) | 480020 | CC0 1.0 | Wood wheels rolling on gritty dirt road (vintage archive); 4.8 s loop, 0.45 s overlap |
| `sfx/cart-cobble` | [craigsmith](https://freesound.org/people/craigsmith/sounds/437092/) | 437092 | CC0 1.0 | Horse-drawn milk wagon on cobblestone, not modern traffic; 3.51 s loop (re-cut 2026-11-03, D-80: 11 hits, seam on the beat), 0.1 s crossfade |
| `sfx/horse-snort` | [o_ciz](https://freesound.org/people/o_ciz/sounds/475483/) | 475483 | CC0 1.0 | Horse snorting; natural animal recording |
| `sfx/axe` | [xkeril](https://freesound.org/people/xkeril/sounds/753925/) | 753925 | CC0 1.0 | Real small axe chopping a branch, outdoors |
| `sfx/saw` | [LiezelDippenaar](https://freesound.org/people/LiezelDippenaar/sounds/707527/) | 707527 | CC0 1.0 | Real manual handsaw sawing through wooden plank |
| `sfx/mill-wheel` | [Berwitz](https://freesound.org/people/Berwitz/sounds/263583/) | 263583 | CC0 1.0 | Watermill wooden wheel turning with rhythmic water; 5.22 s loop (9 paddle periods, seam between beats; re-cut 2026-11-03 from the shipped 5.5 s loop with a 0.25 s crossfade, D-77) |
| `sfx/bridge-wood` | [craigsmith](https://freesound.org/people/craigsmith/sounds/480042/) | 480042 | CC0 1.0 | Heavy wooden cart wheel rolling on wooden floor/bridge |
| `sfx/load-sack`, `sfx/unload-sack` | [bbrocer](https://freesound.org/people/bbrocer/sounds/382642/) | 382642 | CC0 1.0 | Bag of flour moved from shelf and dropped onto counter |
| `sfx/load-plank`, `sfx/unload-plank` | [Tim_Verberne](https://freesound.org/people/Tim_Verberne/sounds/537755/) | 537755 | CC0 1.0 | Real small wooden planks dropping to ground |
| `sfx/load-log`, `sfx/unload-log` | [ventousawins](https://freesound.org/people/ventousawins/sounds/681416/) | 681416 | CC0 1.0 | Real wooden log dropped |
| `sfx/oven` | [ceich93](https://freesound.org/people/ceich93/sounds/263864/) | 263864 | CC0 1.0 | Real fireplace wood crackling (fire, not oven mechanics) |

**Listening limitations:** `cart-dirt` is a vintage optical archive with
phase artefacts; `cart-cobble` includes a horse and must be trimmed/checked for
speech or street traffic. The oven uses *real fireplace crackling* rather than
a documented bread oven. Each loading/unloading ID uses a different portion
of a real sack, plank or log recording. Reject modern engines, asphalt and
intelligible speech after listening — metadata alone cannot guarantee absence.

### Task 46 — New building and logistics sounds (task 50 delivered)

**Status (2026-11-02):** Task 50 delivered 13 CC0-derived sound effects as 26 OGG/M4A files. Both codec versions total 226081 bytes (limit: 400000 bytes). Original Freesound recordings were accessed through official public HQ OGG previews; filenames, hashes and source metadata are recorded in docs/audio-provenance.json. src/audio/sounds.ts was intentionally not modified.

| New runtime ID(s) | Freesound source / author | Licence | Editing note |
|---|---|---|---|
| `sfx/quarry-chisel` | [Artiom_Constantinov 841053](https://freesound.org/people/Artiom_Constantinov/sounds/841053/) | CC0 1.0 | Real chisel in quarry; 2.4 s |
| `sfx/quarry-rock`, `sfx/load-stone`, `sfx/unload-stone` | [Tim_Verberne 576107](https://freesound.org/people/Tim_Verberne/sounds/576107/) | CC0 1.0 | Falling small rocks, alternate excerpts |
| `sfx/fisher-net`, `sfx/load-fish`, `sfx/unload-fish` | [paulprit 581580](https://freesound.org/people/paulprit/sounds/581580/) | CC0 1.0 | Actual fish being netted in a river; alternate excerpts |
| `sfx/fisher-splash` | [qubodup 210428](https://freesound.org/people/qubodup/sounds/210428/) | CC0 1.0 | Water splash on soil/plants; fishing-water proxy |
| `sfx/charcoal-fire` | [ceich93 263864](https://freesound.org/people/ceich93/sounds/263864/) | CC0 1.0 | Fireplace crackle, **not** a kiln field recording |
| `sfx/malt-bubbles` | [calebrankin 529383](https://freesound.org/people/calebrankin/sounds/529383/) | CC0 1.0 | Water bubbles, **not** an actual fermenting mash |
| `sfx/brewery-barrels`, `sfx/load-barrel`, `sfx/unload-barrel` | [craigsmith 675975](https://freesound.org/people/craigsmith/sounds/675975/) | CC0 1.0 | Vintage recording of wooden barrels dropping, alternate excerpts |

Planned runtime keys (add to `src/audio/sounds.ts` only with the files):
`work.quarry.chisel`, `work.quarry.rock`, `work.fisher.net`, `work.fisher.splash`,
`work.charcoal.fire`, `work.malthouse.bubbles`, `work.brewery.barrels`,
`load.stone`/`unload.stone`, `load.fish`/`unload.fish`, `load.barrel`/`unload.barrel`. Effects
use the existing mono 24 kHz FFmpeg processing and OGG Vorbis + AAC/M4A
encoders; `charcoal-fire` and `malt-bubbles` use short crossfaded loops.
The strict catalogue checker derives the expected file count and paths from
the manifest and rejects missing or unexpected assets.

**Reproduce task 50:** With the promoted manifest and bundled source previews in place, run python3 tools/process_audio.py --track-id sfx/brewery-barrels --track-id sfx/charcoal-fire --track-id sfx/fisher-net --track-id sfx/fisher-splash --track-id sfx/load-barrel --track-id sfx/load-fish --track-id sfx/load-stone --track-id sfx/malt-bubbles --track-id sfx/quarry-chisel --track-id sfx/quarry-rock --track-id sfx/unload-barrel --track-id sfx/unload-fish --track-id sfx/unload-stone, then python3 tools/process_audio.py --check. Listen to all 13 tracks before merging the PR.



#### Task 50 — Source download audit (2026-11-02)

| Runtime ID | Author | Licence | Page | Download date (UTC) | Source SHA-256 |
|---|---|---|---|---|---|
| sfx/quarry-chisel | Artiom_Constantinov | CC0-1.0 | https://freesound.org/people/Artiom_Constantinov/sounds/841053/ | 2026-11-02 | f7b5bad26e2cd5112c8633862de749cd68490cf338fde8541c12e6036453664d |
| sfx/quarry-rock | Tim_Verberne | CC0-1.0 | https://freesound.org/people/Tim_Verberne/sounds/576107/ | 2026-11-02 | 87e0325a702b66139da6b76ddefa1f51fec25b59a1d8c456b570915df2ecf24f |
| sfx/fisher-net | paulprit | CC0-1.0 | https://freesound.org/people/paulprit/sounds/581580/ | 2026-11-02 | 985c7a030b45c4f82ccfb2d6c201bd6cf4d54af21ee72242d926671b36814028 |
| sfx/fisher-splash | qubodup | CC0-1.0 | https://freesound.org/people/qubodup/sounds/210428/ | 2026-11-02 | 38a7e2ab1e90305bdf068dc973b3916dd413eb327aaf1209fddddcf41ccf13e7 |
| sfx/charcoal-fire | ceich93 | CC0-1.0 | https://freesound.org/people/ceich93/sounds/263864/ | 2026-11-02 | 21d61e6da0df08455656c2c9f105e8b2e06848b2c2d3592d7328172146f5219a |
| sfx/malt-bubbles | calebrankin | CC0-1.0 | https://freesound.org/people/calebrankin/sounds/529383/ | 2026-11-02 | e70e4c1c9b06b045f628cd7ae29243839ea72d5462de5b349f4cfaa25783a060 |
| sfx/brewery-barrels | craigsmith | CC0-1.0 | https://freesound.org/people/craigsmith/sounds/675975/ | 2026-11-02 | 0c6e53daeff15d1b70c6d7ac08baca38af0c4107563a58d4cea1011c5af31f1b |
| sfx/load-stone | Tim_Verberne | CC0-1.0 | https://freesound.org/people/Tim_Verberne/sounds/576107/ | 2026-11-02 | 87e0325a702b66139da6b76ddefa1f51fec25b59a1d8c456b570915df2ecf24f |
| sfx/unload-stone | Tim_Verberne | CC0-1.0 | https://freesound.org/people/Tim_Verberne/sounds/576107/ | 2026-11-02 | 87e0325a702b66139da6b76ddefa1f51fec25b59a1d8c456b570915df2ecf24f |
| sfx/load-fish | paulprit | CC0-1.0 | https://freesound.org/people/paulprit/sounds/581580/ | 2026-11-02 | 985c7a030b45c4f82ccfb2d6c201bd6cf4d54af21ee72242d926671b36814028 |
| sfx/unload-fish | paulprit | CC0-1.0 | https://freesound.org/people/paulprit/sounds/581580/ | 2026-11-02 | 985c7a030b45c4f82ccfb2d6c201bd6cf4d54af21ee72242d926671b36814028 |
| sfx/load-barrel | craigsmith | CC0-1.0 | https://freesound.org/people/craigsmith/sounds/675975/ | 2026-11-02 | 0c6e53daeff15d1b70c6d7ac08baca38af0c4107563a58d4cea1011c5af31f1b |
| sfx/unload-barrel | craigsmith | CC0-1.0 | https://freesound.org/people/craigsmith/sounds/675975/ | 2026-11-02 | 0c6e53daeff15d1b70c6d7ac08baca38af0c4107563a58d4cea1011c5af31f1b |

### Original procedural effects retained

Only `sfx/wax-seal`, `ui/stall`, `ui/wood`, `ui/paper` and `ui/error` are
procedural CC0 sound designs from `tools/generate_audio.py`. Never run the
unqualified generator over the delivered field-recorded catalogue.

### Task 59 — Phone-audible wooden alerts (2026-11-02)

`ui/stall` (0.54 s) and `ui/error` (0.48 s) are newly synthesized, original
wooden double-knocks. They retain a little low-frequency thud but concentrate
their energy in 700–1400 Hz; they do not contain voices, samples, bells or
digital beeps. Each is mono 24 kHz, encoded as OGG Vorbis plus AAC/M4A using
the existing UI pipeline (peak-normalized to approximately -6 dBFS). The new
source is deterministic, with independent noise seeds for each impact.

**Safe reproduction (does not touch the CC0 recordings):**

```bash
python3 tools/generate_audio.py --only-ui-alerts
# Update only ui/stall + ui/error output hashes in docs/audio-provenance.json
python3 tools/process_audio.py --check
```

The before/after measurements (spectral energy below 200 Hz, 300–1000 Hz,
1–4 kHz, target 700–1400 Hz, EBU R128 LUFS, 300 Hz high-pass phone model)
and exact OGG/M4A durations are in
`docs/research/2026-11-02-alert-sounds.md`. Runtime `stall.alert` gain
returns to 0.38 after removal of the temporary +3.2 dB workaround; new
bandwidth, rather than simply louder bass, makes it audible on phone speakers.
`ui.error` gain remains 0.36. All other assets are unchanged.

### Reproducing and validating

1. Install Python 3.10+, FFmpeg and FFprobe.
2. Render just the new sources with:
   `python3 tools/process_audio.py --only-freesound --fetch`.
   If online downloads are unavailable, place the verified CC0 HQ OGG previews
   under `tools/audio-src/` and omit `--fetch`.
3. To reproduce all recorded sound tracks, run
   `python3 tools/process_audio.py --fetch` (includes OpenGameArt).
4. Verify: `python3 tools/process_audio.py --check`,
   `python3 -m unittest tools/test_process_audio.py`, `npm test`,
   `npm run typecheck`.
5. Listen to the cart loops and crossfade seams, hand saw, horse, mill and
   all load/unload effects. The PR stays draft until editorial listening.

The workflow writes SHA-256 hashes for all runtime OGG/M4A outputs (72
files once task 46 is finished) and all used CC0 source previews. The hash
manifest must be updated atomically with the committed generated files. Runtime audio is limited to 4 × 1024 × 1024 bytes;
`tools/audio-src/` files are review/reproduction inputs and not deployed.


## Music — owner's own medieval score

Source: the owner's repository `woogitsu/osadale` (`music/*.mp3`), **rights held by the game's publisher; not CC0, not for redistribution outside the game.** Transcoded with
FFmpeg: `loudnorm I=-18 LUFS, TP -1.5 dB`, Opus 48 kbps constrained VBR stereo 48 kHz in WebM (`.webm`) into
`public/assets/music/` (14 tracks, ~13 MB; was 25 MB as AAC 96 kbps). Streamed through
`<audio>` (`src/audio/music.ts`), never decoded to buffers.

Made with **Suno AI** (paid plan on the owner's account at generation time, owner confirmed 2026-11-01, D-16);
mark AI-generated content in the Google Play / App Store questionnaires at release. Per-file provenance (shipped
SHA-256, source mp3 path and SHA-256, Suno id) lives in `docs/legal/music_provenance.json`;
`tests/music-provenance.test.ts` fails when a shipped file has no entry, its hash changed, its Suno COMMENT tag is
gone, an entry has no file, `music.ts` plays a missing track, or this table misses a file. After re-encoding:
`node tools/music-provenance.mjs --write` (report only without the flag).

| File | Original title | Use |
|---|---|---|
| menu-hush-before-sunrise.webm | Hush Before Sunrise | main menu |
| menu-first-light.webm | First Light Over Greystone | main menu |
| play-wheatmill-path.webm | Wheatmill Path | gameplay |
| play-millpond-crossing.webm | Millpond Crossing | gameplay |
| play-harvest-lane.webm | Harvest Lane | gameplay |
| play-wheatfield-lane.webm | Wheatfield Lane | gameplay |
| play-granary-at-stonegate.webm | Granary at Stonegate | gameplay |
| play-oven-hearth-morning.webm | Oven Hearth Morning | gameplay |
| play-bakers-hearth-glow.webm | Bakers Hearth Glow | gameplay |
| play-gleaning-at-dusk.webm | Gleaning at Dusk | gameplay |
| rain-drizzle-on-the-square.webm | Drizzle on the Square | gameplay while raining |
| rain-on-cobblestone.webm | Rain on Cobblestone | gameplay while raining |
| won-silver-pennant-fanfare.webm | Silver Pennant Fanfare | contract fulfilled |
| lost-frost-on-the-rooftops.webm | Frost on the Rooftops | first snow, contract lost |

## App icon v3 (Grenze Gotisch, OFL)

The wax seal's outlined **M** in `art/app-icon.svg` derives from the Google Fonts
**Grenze Gotisch** font (weight 400, original font outlines; SIL OFL 1.1).
Source: https://github.com/google/fonts/tree/main/ofl/grenzegotisch
Only the glyph's filled SVG contours are shipped in the icon, not a font file.
Staged native assets and reproducible v2/v3 preview: see `art/out/README.md`.

### UI art kit — proposal 55

`public/assets/ui/kit/seal-press.svg` (D-72): vector redraw of `seal-full` for the large seal-press cue, drawn for Marchia by Claude from the kit sprite's shapes and colours; licence as the game.

`public/assets/ui/kit/`: obrazy wygenerowane dla Marchii, licencja jak gra. Przeznaczone do oceny przed integracją; wymiary, stany i marginesy 9-slice oraz podglądy są opisane w `docs/ui-kit.md`. Ikony widoczne na makietach pochodzą z istniejącego zestawu gry `src/ui/icons.ts`. Tłem makiet są obrazy referencyjne D dostarczone do zlecenia.


## Store artwork — order 61 (v2 live gameplay captures, 2026-11-02)

- **Rights/provenance:** `docs/store/shots/{pl,en}/` contains only Playwright captures of the publisher's actual Marchia game and a feature image composited from the authentic rendered scene. No third-party artwork, generated/improvised UI, or phone mockup is permitted.
- **Source and reproducibility:** `tools/store-shots-v2.mjs` (build + Vite preview + Chromium, game debug handles only in capture, and deterministic simulation with no state fabrication). `docs/store/screenshots-plan.md` maps each scene to its authenticity checks. GitHub Actions can reproduce the assets and records `docs/store/shots/manifest.json`.
- **Files:** 6 vertical Google Play screenshots 1080×1920, 2 horizontal 1920×1080, 6 App Store 1290×2796, and one 1024×500 Google Play feature image *per language* (PL/EN), 30 optimized PNGs total, ≤25 MiB across both languages.
- **Typography:** bundled game typefaces Grenze Gotisch 700 and Alegreya Sans 700 (SIL OFL; the generator reads its own installed font package locally). No font binaries distributed as separate assets.
- **Composition:** text overlays use the game's dark wood / parchment / wax palette; images remain actual WebGL gameplay, not game-art concept renderings. The feature graphic preserves gameplay footage under the brand title.
- **Pre-release:** view every generated full-resolution image and thumbnail before uploading to either store; scripts reject missing real scenes instead of faking statuses or mechanics.
