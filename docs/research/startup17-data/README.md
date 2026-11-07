# perf day 17 (D-331..D-333): cold model builds on the way to `ready` — options measured

Question (night order 2026-11-07): the procedural models the menu builds before `ready` run cold (perf day 15: the
same buildings built again in one process take ~35 ms instead of 90–130 ms). Which of (a) a build-time prebaked
catalogue, (b) an IndexedDB cache of built geometry, (c) building only what the first frame shows removes that cost
from the critical path, by numbers?

Setup: headless Chromium (Playwright), SwiftShader, 412×915, dpr 0.5, quality high, a fresh browser per run (cold
HTTP and V8 code cache, as a first start of the APK), variants interleaved per round, load average 7–11 from other
sessions on 4 cores. `vite build` + `vite preview`: before = `9ae57b7` (port 5263), after = `claude/w-geomcache`
(5262: first cut, 5264: final). `?baked=0` on the after build = the same bundle with the catalogue not installed.
Android proxy: CDP `Emulation.setCPUThrottlingRate` 4 (renderer main thread only; the network process is not slowed,
so the fetch is optimistic there — but in the final version the fetch never gates the start, see below).

## Probes

- `marks-probe.mjs <reps> <throttle> <quality> <url>...` — `marchia:*` marks per run up to `first-frame`; medians.
- `idb-probe.mjs <base> <assetUrl> [reps] [throttle]` — (b): the catalogue read back from IndexedDB in a cold
  browser profile vs `fetch(no-store)` of the asset.
- `c-probe.mjs <base>` — (c): which menu building kinds the first frame's camera frustum holds (footprint × 0–25 m
  above the heightfield), at 412×915, 915×412, 904×1000.
- `c-node.ts` — (c) in node (esbuild bundle as `tools/model-probe.ts`): cold thread CPU of building only the visible
  kinds vs all 8 menu kinds.

## Results

Option (a) — prebaked catalogue (`tools/bake-models.ts`, shipped).
- Asset: 66 models (whole game catalogue: 15 building kinds + castle tower + trading-post states, 10 tree models,
  5 far cards, wagon near/mid/far, 12 worker rigs, 9 cargo units, 2 × 2 bridge pieces), 157 geometries:
  7 021 600 B raw first cut; with the box-projected uv recomputed at decode instead of stored (982 KB of 1 010 KB of uv
  is exactly `boxUvArray(position, normal)`): **6 038 632 B raw, 2 369 679 B gzip -9** (the APK's deflate is close
  to that): APK 51,6 MB → ~54,0 MB (+4,6 %). Not committed (made by `vite build`): no repo growth, no binary
  merge conflicts, cannot go stale.
- Node (`tools/model-probe.ts` set, cold process, thread CPU, 7 runs): menu models 113–129 ms built → 3,2–3,5 ms
  install (JSON head) + 3,9–9,5 ms decode.
- Browser, 1× (`run1-b.txt`, 9 runs each): `ready` 998 (before) / 981 (`?baked=0`) → **859 ms** (−122…−139 ms,
  −14 %); `menu-start`→`menu-world` 365 / 362 → **228 ms**; `first-frame` 1 818 / 1 801 → **1 621 ms** (−180…−197).
- Browser, 4× CPU (`run4x-b.txt`, 7 runs each): `ready` 2 499 → **2 132 ms** (−367 ms, −15 %); `menu-start`→
  `menu-world` 906 → **472 ms**; `first-frame` 3 753 → **3 165 ms** (−588 ms).
- First cut vs final (`run4x.txt`, `run4x-b.txt`): the first cut awaited the fetch before making the view; at 4× the
  6 MB response arrived 250 ms after the view chunk (`baked-models` 664 vs module 412 ms in round 0), so `ready` gained
  only −330…−436 ms with the view mount delayed. Final: `<link rel=preload as=fetch>` in the HTML (the fetch starts
  while the HTML is parsed) and the await moved to just before `app.start()`: the catalogue is installed 0,3–2,6 ms
  after the `app` mark in every 4× run and 0,3–0,9 ms at 1× — it never waits.
- World change (`worldload.txt`, `tools/world-load-probe.mjs`, 2 × 3 runs): menu → I / → II `build` and frames
  within the run-to-run noise (the menu has already decoded what I uses; II's new kinds are small).

Option (b) — IndexedDB cache keyed by the model code version (`idb-probe.mjs`, 5 cold profiles each).
- First launch: unchanged by design (builds cold, then also has to serialize and write 6 MB).
- Later launches: IDB `get` of the 6 MB buffer **16 ms** at 1×, **59 ms** at 4× on the main thread, vs the asset
  fetch 43 / 120 ms wall time that runs off the main thread and (with the preload) overlaps the chunk load. So (b)
  is never faster than (a) on any launch, slower on the first, and adds a version key, a write path and an eviction
  story. Not done.

Option (c) — only the kinds the first frame needs, the rest after it (`c-probe.mjs`, `c-node.ts`).
- The menu's first frame holds 1–2 of its 8 building kinds (mill; stable in portrait only).
- Node, cold, 7 runs: those kinds 25–33 ms vs all 8 kinds 86–121 ms → about −60 ms of buildings. Trees (~25 ms:
  every world draws all 5 kinds, D-325) and the near wagon (~8 ms, on screen) stay on the path; the 6 deferred kinds
  then build cold right after the first frame (~60 ms of jank while the menu camera pans) and off-screen buildings
  still cast shadows into the frame, so "frame 1 identical" would need the shadow pass to wait for them too.
  At best half of (a)'s saving with a pixel risk; (a) makes it moot (decoding is ~1 ms per kind). Not done.

Pixels: `../perf17-diff/jam-diff.txt` — the 20 harness scenes of perf day 16 (menu 1/3/30 high and low, missions I,
II, VII, XII, XVI, prior worlds, ultra), before (`9ae57b7`) vs after with `baked=1` (models decoded from a catalogue
the dev server bakes per request): 0 px. Bytes: `tests/models-baked.test.ts` (fresh-process bake twice: same bytes;
decode + encode: same bytes; field-by-field Object.is of decoded vs built models).
