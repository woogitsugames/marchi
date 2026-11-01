# MARCHIA · Assets

Every third-party file shipped with the game is listed here. Only CC0 (art) and OFL / permissive
(fonts, code) sources are allowed — see `docs/ART_DIRECTION.md`.

## Textures (PBR, CC0)

All ten sets come from **Poly Haven** (https://polyhaven.com, licence **CC0 1.0**, no attribution
required — authors listed anyway). Downloaded at 1k from `https://dl.polyhaven.org` (JPG:
`_diff_1k`, `_nor_gl_1k`, `_arm_1k`) via `https://api.polyhaven.com/files/<id>`.

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
`loadPbrSet(name, 'high' | 'low')`). Contact sheet of all albedos: `docs/shots/textures.png`.

### Files per set

- `albedo.jpg` — sRGB, colour-graded (below), q85.
- `normal.jpg` — **OpenGL convention** (+Y up, Poly Haven `nor_gl`), what three.js expects; q90.
- `orm.jpg` — R = ambient occlusion, G = roughness, B = 0 (Poly Haven `arm` with metal zeroed);
  bind the same texture as `aoMap` and `roughnessMap`. Linear (NoColorSpace).
- `albedo.ktx2`, `orm.ktx2` — Basis ETC1S, full mip chain, encoded **Y-flipped** so they line up
  with the JPGs loaded with three.js' default `flipY = true` (KTX2 cannot be flipped on upload).
  Verified in Chromium: KTX2 vs JPG pixel diff 1.6–5.4/255 same-orientation vs 2.8–13.9 flipped.
- Terrain sets also have `*_512.jpg` / `*_512.ktx2` for the low-quality mode.

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

| Bundle | Size |
|---|---:|
| High quality as loaded at runtime (KTX2 albedo+orm, JPG normals, 10 sets) | **7.7 MB** |
| High quality JPG-only (fallback path, 10 sets) | 8.3 MB |
| Low quality terrain 512 variants (KTX2 albedo+orm + JPG normals, 5 sets; non-terrain sets reuse the 1k files) | 1.2 MB |
| Everything on disk in `public/assets/textures` (JPG + KTX2, both qualities) | 13.9 MB |
| Basis transcoder `public/vendor/basis/` (needed by KTX2Loader) | 0.57 MB |

### KTX2 status

Encoded with the npm package `ktx2-encoder@0.6.0` (Basis Universal WASM, MIT; run from a temp
folder, **not** a project dependency). Settings: albedo ETC1S q160 clevel 2, sRGB transfer +
perceptual; orm ETC1S q160 clevel 2, linear; mipmaps on; Y-flip on.

Normals were also encoded as UASTC (RDO λ 4, zstd, normal-map tuning) but came out at
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

If normals become KTX2, add `normalKtx2` to `PbrPaths` in `src/render/textures.ts` and pass it
to `loadOne(...)` for the normal map.

### Per-file table

| File (`public/assets/textures/…`) | Original asset | Author | Source | Licence | Modifications | KB |
|---|---|---|---|---|---|---:|
| `meadow/albedo.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_diff_1k`; sat ×0.65, mean shifted 50 % toward #56603f; 1024 px | 233 |
| `meadow/albedo.ktx2` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_diff_1k`; sat ×0.65, mean shifted 50 % toward #56603f; 1024 px; KTX2 ETC1S, Y-flipped, mips | 193 |
| `meadow/albedo_512.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_diff_1k`; sat ×0.65, mean shifted 50 % toward #56603f; 512 px | 54 |
| `meadow/albedo_512.ktx2` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_diff_1k`; sat ×0.65, mean shifted 50 % toward #56603f; 512 px; KTX2 ETC1S, Y-flipped, mips | 58 |
| `meadow/normal.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_nor_gl_1k` (OpenGL); 1024 px | 541 |
| `meadow/normal_512.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_nor_gl_1k` (OpenGL); 512 px | 119 |
| `meadow/orm.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_arm_1k` → R=AO, G=rough, B=0; 1024 px | 216 |
| `meadow/orm.ktx2` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 192 |
| `meadow/orm_512.jpg` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_arm_1k` → R=AO, G=rough, B=0; 512 px | 51 |
| `meadow/orm_512.ktx2` | Sparse Grass | Amal Kumar | https://polyhaven.com/a/sparse_grass | CC0 | `sparse_grass_arm_1k` → R=AO, G=rough, B=0; 512 px; KTX2 ETC1S, Y-flipped, mips | 57 |
| `mud_track/albedo.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_diff_1k`; sat ×0.9, mean shifted 30 % toward #5a4a39; 1024 px | 227 |
| `mud_track/albedo.ktx2` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_diff_1k`; sat ×0.9, mean shifted 30 % toward #5a4a39; 1024 px; KTX2 ETC1S, Y-flipped, mips | 192 |
| `mud_track/albedo_512.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_diff_1k`; sat ×0.9, mean shifted 30 % toward #5a4a39; 512 px | 63 |
| `mud_track/albedo_512.ktx2` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_diff_1k`; sat ×0.9, mean shifted 30 % toward #5a4a39; 512 px; KTX2 ETC1S, Y-flipped, mips | 58 |
| `mud_track/normal.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_nor_gl_1k` (OpenGL); 1024 px | 542 |
| `mud_track/normal_512.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_nor_gl_1k` (OpenGL); 512 px | 136 |
| `mud_track/orm.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_arm_1k` → R=AO, G=rough, B=0; 1024 px | 235 |
| `mud_track/orm.ktx2` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 205 |
| `mud_track/orm_512.jpg` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_arm_1k` → R=AO, G=rough, B=0; 512 px | 64 |
| `mud_track/orm_512.ktx2` | Brown Mud 02 | Rob Tuytel | https://polyhaven.com/a/brown_mud_02 | CC0 | `brown_mud_02_arm_1k` → R=AO, G=rough, B=0; 512 px; KTX2 ETC1S, Y-flipped, mips | 61 |
| `cobblestone/albedo.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 1024 px | 243 |
| `cobblestone/albedo.ktx2` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 1024 px; KTX2 ETC1S, Y-flipped, mips | 203 |
| `cobblestone/albedo_512.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 512 px | 64 |
| `cobblestone/albedo_512.ktx2` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 512 px; KTX2 ETC1S, Y-flipped, mips | 62 |
| `cobblestone/normal.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_nor_gl_1k` (OpenGL); 1024 px | 130 |
| `cobblestone/normal_512.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_nor_gl_1k` (OpenGL); 512 px | 46 |
| `cobblestone/orm.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_arm_1k` → R=AO, G=rough, B=0; 1024 px | 180 |
| `cobblestone/orm.ktx2` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 179 |
| `cobblestone/orm_512.jpg` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_arm_1k` → R=AO, G=rough, B=0; 512 px | 50 |
| `cobblestone/orm_512.ktx2` | Cobblestone Floor 13 | Rob Tuytel | https://polyhaven.com/a/cobblestone_floor_13 | CC0 | `cobblestone_floor_13_arm_1k` → R=AO, G=rough, B=0; 512 px; KTX2 ETC1S, Y-flipped, mips | 54 |
| `riverbank/albedo.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_diff_1k`; sat ×0.85, mean shifted 25 % toward #6a6458; 1024 px | 306 |
| `riverbank/albedo.ktx2` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_diff_1k`; sat ×0.85, mean shifted 25 % toward #6a6458; 1024 px; KTX2 ETC1S, Y-flipped, mips | 206 |
| `riverbank/albedo_512.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_diff_1k`; sat ×0.85, mean shifted 25 % toward #6a6458; 512 px | 74 |
| `riverbank/albedo_512.ktx2` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_diff_1k`; sat ×0.85, mean shifted 25 % toward #6a6458; 512 px; KTX2 ETC1S, Y-flipped, mips | 62 |
| `riverbank/normal.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_nor_gl_1k` (OpenGL); 1024 px | 507 |
| `riverbank/normal_512.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_nor_gl_1k` (OpenGL); 512 px | 139 |
| `riverbank/orm.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_arm_1k` → R=AO, G=rough, B=0; 1024 px | 212 |
| `riverbank/orm.ktx2` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 212 |
| `riverbank/orm_512.jpg` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_arm_1k` → R=AO, G=rough, B=0; 512 px | 63 |
| `riverbank/orm_512.ktx2` | River Small Rocks | Rob Tuytel, Rico Cilliers | https://polyhaven.com/a/river_small_rocks | CC0 | `river_small_rocks_arm_1k` → R=AO, G=rough, B=0; 512 px; KTX2 ETC1S, Y-flipped, mips | 62 |
| `forest_floor/albedo.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_diff_1k`; sat ×0.7, mean shifted 30 % toward #4a4232; 1024 px | 282 |
| `forest_floor/albedo.ktx2` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_diff_1k`; sat ×0.7, mean shifted 30 % toward #4a4232; 1024 px; KTX2 ETC1S, Y-flipped, mips | 213 |
| `forest_floor/albedo_512.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_diff_1k`; sat ×0.7, mean shifted 30 % toward #4a4232; 512 px | 84 |
| `forest_floor/albedo_512.ktx2` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_diff_1k`; sat ×0.7, mean shifted 30 % toward #4a4232; 512 px; KTX2 ETC1S, Y-flipped, mips | 63 |
| `forest_floor/normal.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_nor_gl_1k` (OpenGL); 1024 px | 528 |
| `forest_floor/normal_512.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_nor_gl_1k` (OpenGL); 512 px | 143 |
| `forest_floor/orm.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_arm_1k` → R=AO, G=rough, B=0; 1024 px | 260 |
| `forest_floor/orm.ktx2` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 225 |
| `forest_floor/orm_512.jpg` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_arm_1k` → R=AO, G=rough, B=0; 512 px | 78 |
| `forest_floor/orm_512.ktx2` | Forest Leaves 03 | Rob Tuytel, Dimitrios Savva | https://polyhaven.com/a/forest_leaves_03 | CC0 | `forest_leaves_03_arm_1k` → R=AO, G=rough, B=0; 512 px; KTX2 ETC1S, Y-flipped, mips | 64 |
| `wood_planks/albedo.jpg` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_diff_1k`; sat ×0.85, mean shifted 25 % toward #6b5a48; 1024 px | 132 |
| `wood_planks/albedo.ktx2` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_diff_1k`; sat ×0.85, mean shifted 25 % toward #6b5a48; 1024 px; KTX2 ETC1S, Y-flipped, mips | 175 |
| `wood_planks/normal.jpg` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_nor_gl_1k` (OpenGL); 1024 px | 223 |
| `wood_planks/orm.jpg` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_arm_1k` → R=AO, G=rough, B=0; 1024 px | 118 |
| `wood_planks/orm.ktx2` | Old Planks 02 | Rob Tuytel | https://polyhaven.com/a/old_planks_02 | CC0 | `old_planks_02_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 126 |
| `thatch/albedo.jpg` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_diff_1k`; sat ×0.85, mean shifted 30 % toward #9a8058; 1024 px; ridge band cropped, V seam cross-faded; row shading flattened | 326 |
| `thatch/albedo.ktx2` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_diff_1k`; sat ×0.85, mean shifted 30 % toward #9a8058; 1024 px; ridge band cropped, V seam cross-faded; row shading flattened; KTX2 ETC1S, Y-flipped, mips | 214 |
| `thatch/normal.jpg` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_nor_gl_1k` (OpenGL); 1024 px; ridge band cropped, V seam cross-faded | 467 |
| `thatch/orm.jpg` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_arm_1k` → R=AO, G=rough, B=0; 1024 px; ridge band cropped, V seam cross-faded | 222 |
| `thatch/orm.ktx2` | Reed Roof 04 | Rob Tuytel | https://polyhaven.com/a/reed_roof_04 | CC0 | `reed_roof_04_arm_1k` → R=AO, G=rough, B=0; 1024 px; ridge band cropped, V seam cross-faded; KTX2 ETC1S, Y-flipped, mips | 207 |
| `fieldstone_wall/albedo.jpg` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 1024 px | 244 |
| `fieldstone_wall/albedo.ktx2` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_diff_1k`; sat ×0.85, mean shifted 25 % toward #8a8478; 1024 px; KTX2 ETC1S, Y-flipped, mips | 196 |
| `fieldstone_wall/normal.jpg` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_nor_gl_1k` (OpenGL); 1024 px | 412 |
| `fieldstone_wall/orm.jpg` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_arm_1k` → R=AO, G=rough, B=0; 1024 px | 105 |
| `fieldstone_wall/orm.ktx2` | Old Stone Wall | Charlotte Baglioni | https://polyhaven.com/a/old_stone_wall | CC0 | `old_stone_wall_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 151 |
| `bark/albedo.jpg` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_diff_1k`; sat ×0.8, mean shifted 25 % toward #5a5044; 1024 px | 288 |
| `bark/albedo.ktx2` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_diff_1k`; sat ×0.8, mean shifted 25 % toward #5a5044; 1024 px; KTX2 ETC1S, Y-flipped, mips | 218 |
| `bark/normal.jpg` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_nor_gl_1k` (OpenGL); 1024 px | 420 |
| `bark/orm.jpg` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_arm_1k` → R=AO, G=rough, B=0; 1024 px | 209 |
| `bark/orm.ktx2` | Bark Brown 02 | Rob Tuytel | https://polyhaven.com/a/bark_brown_02 | CC0 | `bark_brown_02_arm_1k` → R=AO, G=rough, B=0; 1024 px; KTX2 ETC1S, Y-flipped, mips | 207 |
| `plaster_daub/albedo.jpg` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_diff_1k`; sat ×0.85, mean shifted 25 % toward #a9a497; 1024 px | 311 |
| `plaster_daub/albedo.ktx2` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_diff_1k`; sat ×0.85, mean shifted 25 % toward #a9a497; 1024 px; KTX2 ETC1S, Y-flipped, mips | 201 |
| `plaster_daub/normal.jpg` | Worn Mossy Plasterwall | Amal Kumar | https://polyhaven.com/a/worn_mossy_plasterwall | CC0 | `worn_mossy_plasterwall_nor_gl_1k` (OpenGL); 1024 px | 244 |
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


## Audio — procedural CC0 original sound design (task 02)

All files below were **generated specifically for MARCHIA**, with no input recordings, external
samples, instruments, or third-party sound libraries. Author-generated procedural waveforms
are expressly dedicated to **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/).
The source is `tools/generate_audio.py` (deterministic seed 1300; NumPy/SciPy synthesis; FFmpeg
Vorbis / AAC encoding). The sources are original synthetic sound-design effects, **not**
actual documentary field recordings. No external licences or attribution are needed.

- **Budget (both formats, all 46 files):** 1539860 bytes (1.47 MiB; limit 4 MiB).
- **Formats:** 24 kHz OGG Vorbis (`.ogg`) and AAC-LC (`.m4a`) Safari fallback.
  Mono for 19 SFX/UI (including three mechanical loops), stereo for four ambient beds.
- **Dynamics:** source ambient beds processed for −24 LUFS integrated (FFmpeg loudnorm);
  discrete SFX sources normalized to −6 dBFS peak before lossy encoding. Codec encoding may
  alter final codec-reconstructed peak by a fraction of a dB; retest after replacements.
- **Looping:** seamless fade-in/out within all loop files, with scheduled 1.4–1.5 s
  crossfades at gain changes in the Web Audio engine.

| OGG (relative to repository) | M4A (relative) | Seconds | Channels | OGG B | M4A B | License |
|---|---|---:|---:|---:|---:|---|
| `public/assets/audio/ambient/evening.ogg` | `public/assets/audio/ambient/evening.m4a` | 40.0 | 2 | 181633 | 155174 | CC0 1.0 (original) |
| `public/assets/audio/ambient/morning.ogg` | `public/assets/audio/ambient/morning.m4a` | 36.0 | 2 | 163686 | 139723 | CC0 1.0 (original) |
| `public/assets/audio/ambient/rain.ogg` | `public/assets/audio/ambient/rain.m4a` | 32.0 | 2 | 178250 | 124267 | CC0 1.0 (original) |
| `public/assets/audio/ambient/river.ogg` | `public/assets/audio/ambient/river.m4a` | 34.0 | 2 | 186548 | 131993 | CC0 1.0 (original) |
| `public/assets/audio/sfx/axe.ogg` | `public/assets/audio/sfx/axe.m4a` | 0.8 | 1 | 4790 | 3373 | CC0 1.0 (original) |
| `public/assets/audio/sfx/bridge-wood.ogg` | `public/assets/audio/sfx/bridge-wood.m4a` | 1.4 | 1 | 6942 | 4771 | CC0 1.0 (original) |
| `public/assets/audio/sfx/cart-cobble.ogg` | `public/assets/audio/sfx/cart-cobble.m4a` | 3.8 | 1 | 17663 | 10952 | CC0 1.0 (original) |
| `public/assets/audio/sfx/cart-dirt.ogg` | `public/assets/audio/sfx/cart-dirt.m4a` | 4.8 | 1 | 21302 | 13689 | CC0 1.0 (original) |
| `public/assets/audio/sfx/horse-snort.ogg` | `public/assets/audio/sfx/horse-snort.m4a` | 1.6 | 1 | 9239 | 5305 | CC0 1.0 (original) |
| `public/assets/audio/sfx/load-log.ogg` | `public/assets/audio/sfx/load-log.m4a` | 1.2 | 1 | 7131 | 4404 | CC0 1.0 (original) |
| `public/assets/audio/sfx/load-plank.ogg` | `public/assets/audio/sfx/load-plank.m4a` | 1.1 | 1 | 7011 | 3954 | CC0 1.0 (original) |
| `public/assets/audio/sfx/load-sack.ogg` | `public/assets/audio/sfx/load-sack.m4a` | 0.9 | 1 | 7338 | 3571 | CC0 1.0 (original) |
| `public/assets/audio/sfx/mill-wheel.ogg` | `public/assets/audio/sfx/mill-wheel.m4a` | 5.5 | 1 | 25070 | 15454 | CC0 1.0 (original) |
| `public/assets/audio/sfx/oven.ogg` | `public/assets/audio/sfx/oven.m4a` | 1.3 | 1 | 8718 | 4590 | CC0 1.0 (original) |
| `public/assets/audio/sfx/saw.ogg` | `public/assets/audio/sfx/saw.m4a` | 1.9 | 1 | 11200 | 6022 | CC0 1.0 (original) |
| `public/assets/audio/sfx/unload-log.ogg` | `public/assets/audio/sfx/unload-log.m4a` | 1.4 | 1 | 7576 | 4907 | CC0 1.0 (original) |
| `public/assets/audio/sfx/unload-plank.ogg` | `public/assets/audio/sfx/unload-plank.m4a` | 1.4 | 1 | 7595 | 4579 | CC0 1.0 (original) |
| `public/assets/audio/sfx/unload-sack.ogg` | `public/assets/audio/sfx/unload-sack.m4a` | 1.1 | 1 | 8074 | 4013 | CC0 1.0 (original) |
| `public/assets/audio/sfx/wax-seal.ogg` | `public/assets/audio/sfx/wax-seal.m4a` | 1.1 | 1 | 6776 | 3812 | CC0 1.0 (original) |
| `public/assets/audio/ui/error.ogg` | `public/assets/audio/ui/error.m4a` | 0.5 | 1 | 4357 | 2413 | CC0 1.0 (original) |
| `public/assets/audio/ui/paper.ogg` | `public/assets/audio/ui/paper.m4a` | 0.5 | 1 | 5520 | 2482 | CC0 1.0 (original) |
| `public/assets/audio/ui/stall.ogg` | `public/assets/audio/ui/stall.m4a` | 0.6 | 1 | 5082 | 2681 | CC0 1.0 (original) |
| `public/assets/audio/ui/wood.ogg` | `public/assets/audio/ui/wood.m4a` | 0.3 | 1 | 4381 | 1849 | CC0 1.0 (original) |

Regenerate: `python tools/generate_audio.py` with `numpy`, `scipy` and FFmpeg installed.
Every rendered audio asset must be checked for codec support, gapless loops, and combined size.
