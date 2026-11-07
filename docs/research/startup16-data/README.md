# perf day 16 (D-325..D-327): far-tree bake — data

Probes (copied from the session scratchpad; `createRequire` points at the worktree's package.json):
- `bb-probe.mjs <base> [reps] [quality]` — CPU profile from navigation to `first-frame`: inclusive time of
  `bakeTreeBillboards`, its leaf functions (`onFirstUse` = link checks), the `marchia:*` marks. Needs a sourcemap build
  (`vite build --sourcemap --outDir …`).
- `trace.mjs <base> <out.json>` + `tr-ff.py` — Chrome trace; `done` = end of the task holding the first frame, i.e.
  after its compositor commit, which under SwiftShader reads the canvas back and so waits for the GPU work (bake + frame).
- `rebake.mjs <base>` — warm re-bake at the menu, timed to a `readPixels` after it (CPU + SwiftShader GPU time).
- `atlas-hash.mjs <base> <outPrefix>` (`LEVEL=n`) — atlas texels after bakes at five (cell, bare, spring) sets.
- `kinds.mjs` — far cards per kind in the first frame (menu, I, II, VII, XII, XVI).

Files: `first-frame-final.jsonl` + `composited-final.txt` + `rebake-final.txt` = before (`eaed157`) vs after
(`678322d`), interleaved, load 15–20 from other sessions. `first-frame-variants.jsonl`, `composited-variants.txt`:
v0 = with a `flush()` after the bake, v1 = without (the shipped choice), v2 = v0 with per-row mips.
