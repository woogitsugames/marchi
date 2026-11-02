# Decisions log

Format: **D-NN — title.** Decision. *Why.* (Status: decided / to confirm with owner.)

**D-01 — Stack.** TypeScript 5.9, three.js r181, Vite 7, Capacitor 7 (Android + iOS), tsx for
headless tests. *Stable majors with long support; TS 7 (native) is new and tooling around Vite
still targets 5.x.* (decided)

**D-02 — Simulation is pure TS on a 10 Hz fixed step.** No three/DOM imports (enforced by
`tsconfig.sim.json` with `lib: ES2022` only). Rendering interpolates between ticks.
*10 Hz is enough for wagons at 3–4 m/s on 4 m cells and keeps 200 wagons cheap at ×4.* (decided)

**D-03 — Determinism by restricted math + state-held RNG.** Only IEEE-exact operations
(`+ - * / sqrt`) in the sim; RNG (sfc32) state lives in the game state, so save/load
continues identically. Terrain noise uses polynomial interpolation, not trig. *`Math.sin` and
friends are not guaranteed bit-identical across JS engines (V8 vs JavaScriptCore on iOS).* (decided)

**D-04 — Grid-cell road graph (4 m cells, 8-neighbourhood).** *Easy, precise touch-drag
building on a phone; cheap pathfinding; bridges and slope checks fall out per cell.*
Visual roads are smoothed splines over the cells, so the grid does not show. (decided)

**D-05 — Bridge capacity as gameplay.** Wooden bridge = one lane (one direction at a time,
max 3 wagons); stone bridge = two lanes but expensive. *Gives the "jam on the bridge" stall a
real cause and a real fix.* (decided)

**D-06 — Reservations as counters, goods as single-location units.** `reservedOut` at the
source, `incoming` at the destination; units move stock → cargo → stock atomically on
load/unload. *Conservation is then checkable every tick with one equation.* (decided)

**D-07 — No demolishing a road cell under a wagon.** The tool refuses with a message.
*Avoids teleporting or stranded wagons; the "bridge demolished during delivery" case is
covered by re-routing the wagons approaching it.* (decided)

**D-08 — Fonts: Grenze Gotisch (headings) + Alegreya Sans (text).** Both OFL, both with
latin-ext (Polish diacritics). *IM Fell English was considered but lacks latin-ext (no ą, ę, ł).* (decided)

**D-09 — Visual direction: late autumn, damp morning, palette of 10 named colours**
(`docs/ART_DIRECTION.md`). (decided — accepted by owner 2026-11-01)

**D-10 — Monetisation implementation deferred.** Stage 1 has no store code; the free/full split
(proposal: mission 1–3 + sandbox small valley free, rest in full version) is accepted by owner 2026-11-01; store code comes in a later stage. (decided)

**D-11 — i18n as typed TS dictionaries** (`pl.ts` is the source of keys, `en.ts` must satisfy
the same type). *Missing translations become compile errors, no runtime JSON loading.* (decided)

**D-12 — Capacitor 8.6 with Android compileSdk/targetSdk 36.** Upgraded `@capacitor/*` from 7.6
to 8.6.0 (latest stable): its Android template already targets SDK 36 (AGP 8.13.0, Gradle
8.14.3 wrapper, minSdk 24), so no hand-edited `variables.gradle` is needed. iOS uses the
Capacitor 8 SwiftPM template (no CocoaPods). Debug APKs are built in the Linux container with
`npm run apk` against an SDK in `/opt/android-sdk` (platform android-36, build-tools 36.1.0,
JDK 21), installed by `npm run setup:android`. Manifest: no orientation lock,
`resizeableActivity="true"` for foldables / multi-window. *Owner asked for SDK 36; Capacitor 7
targets 35, and staying on 7 would mean patching a template that 8 already ships.* (decided)

**D-13 — Queue-aware routing at one-lane bridges.** Path cost adds a derived penalty when a route
enters a wooden span: 9 s per wagon queued there (BRIDGE_JAM) + 4 s per wagon on it. Wagons queued
≥ 10 s re-plan every 3 s and take a detour when it is cheaper. Penalties are recomputed from state
each tick (not saved), so determinism and save/load are unaffected. *Without it a second wooden bridge
did not relieve the first (found by GPT-6 in the mission 2 proposal); stress test max wait fell from
279 s to 52 s, moving wagons at 200 rose from 74 to 109.* (decided)

**D-15 — Music as Opus 48 kbps in WebM, loudness-normalised.** 14 tracks from the publisher's own score,
-18 LUFS, ~13 MB total (AAC 96 kbps was 25 MB). Opus at 48 kbps stereo is transparent enough for background
music on phone speakers/earbuds. Supported by Android WebView and iOS 17+; on older engines music stays
silent (feature-detected) rather than failing. *Keep the APK small; the music plays under ambience anyway.* (decided)

**D-19 — Foldables and big screens (Galaxy Z Fold / Flip).** Screen classes (CSS px at the default
display scale) live in `src/ui/layout.ts` and are tested by `npm run shots -- --fold`:
Fold 8 / 8 Ultra cover 412×960 @2.625 (21:9), older Fold cover 344×882 (narrow: menu joins the tool
row), Fold inner 874×787 / 787×874 @2.5, Fold 8 Ultra inner 911×820 @2.75, Flip main 412×1004,
Flip cover 360×380, phone 412×915 / 915×412, tablet 904×1000.
- *Near-square / wide portrait (≥ 720 px)*: the rail splits into two oak pads in the thumb corners —
  tools bottom-left, coins/time/speed/menu bottom-right (mirrored for left-handed); sheets dock at the
  side from 720 px (was 840) so the scene centre stays visible on the unfolded inner screen.
- *Flex mode* (horizontal separating hinge, each segment ≥ 200 px): the canvas covers only the top
  segment (the camera target stays centred there); waybill, tools, speed and any sheet sit in the
  bottom segment with an 8–16 px gutter at the crease. On the Fold (wide) the bottom segment has three
  columns: waybill + tools | sheet | speed. Hinge sources, first wins: `window.viewport.segments`,
  `env(viewport-segment-*)` (mirrored into CSS custom properties), and a native fallback —
  `MainActivity` listens to androidx.window `FoldingFeature` (window / window-java 1.5.1) and sends the
  hinge rect in CSS px as `window.__marchiaFold` + a `marchia:fold` event, re-sent after page loads.
  `navigator.devicePosture` only triggers a re-layout: 'folded' does not say where the hinge is.
- *Flip cover screen* → **watch mode**, not an "open the phone" wall: the scene, stall bubbles, seal,
  coins and speed stay usable (checking on wagons while the phone is shut is the natural use of a cover
  screen), building tools are hidden with a one-line hint to unfold. Controls sit on the **top** edge
  because the Flip's cover cameras cut into the bottom of the panel.
- *Live fold/unfold*: one coalesced layout per frame from resize / visualViewport / ResizeObserver /
  DPR media query / posture / `marchia:fold`. A large change cancels in-flight gestures (road draft,
  pinch, sheet drag), snaps sheets to the new dock without transitions (`is-relayout`) and resizes the
  view with the new DPR. No reload: the activity handles screenSize|smallestScreenSize|screenLayout|density.
- *Performance*: default quality 'auto' from a device tier (WebGL renderer string — Adreno 830+ →
  ultra, 640+ → high; Mali/Xclipse/PowerVR rules; cores and deviceMemory otherwise). Drawing-buffer DPR is
  capped per quality (low 1, high 2, ultra 3) and scaled by an adaptive step (1 → 0.5) when a ≥ 1 s
  window averages < 55 fps, raised again after 5 good windows with a growing cooldown. DOM text is
  never scaled. 'ultra' is handed to the view only if the render advertises it (`QUALITIES` export,
  `view.qualities` or `view.supportsQuality`), otherwise it renders as 'high' with the higher DPR cap.
*A Fold is a phone, a small tablet and a laptop-on-a-table in one device; one breakpoint at 840 px
covered none of them well.* (decided)

**D-16 — Music provenance is tracked per file.** The 14 music tracks are AI-generated (Suno, per the source
ID3 comments, e.g. `made with suno; created=…; id=…`). Rights are held by the publisher (owner, 2026-11-01).
`docs/legal/music_provenance.json` records source path, source SHA-256, Suno id and shipped-file SHA-256,
because transcoding drops ID3. Before store release: confirm the Suno plan that applied at generation time
and answer the stores' AI-generated-content questions accordingly (Google Play / App Store). Owner confirmed
2026-11-01: the Suno plan was paid at generation time. (decided; store AI-content answers remain a release step)

**D-17 — Owner decisions 2026-11-01.** (1) Textures: 2K ship inside the APK; the 4K pack is downloaded
in-game when Ultra is chosen (Play Asset Delivery or own download — to be designed). (2) Order of work after
4K + foldables: tutorial + playtest readiness → missions IV–VI → building in the free valley; store,
billing and release builds are postponed until the game is fully playable. (3) Languages beyond PL/EN:
the owner will send a list. (4) No Google Play release/signing yet — debug APKs only. (decided)

**D-18 — 17 languages (owner's list).** en, pl, de, fr, es, it, pt-BR, nl, sv, tr, ru, uk, ja, ko, zh-Hans, ar, hi.
Dictionaries `src/i18n/<lang>.ts` (`pt_BR.ts`, `zh_Hans.ts`; export name = file name) typed `Partial<Dict>` are
lazy-loaded (Vite glob) so each language costs only when chosen; missing keys fall back to English. Plurals use
ICU-lite blocks `{n, plural, one {…} few {…} many {…} other {…}}` resolved with `Intl.PluralRules`. Arabic sets
`dir="rtl"`. Fonts: Latin + Cyrillic bundled (Grenze Gotisch / Ruslan Display for Cyrillic headings, Alegreya Sans
incl. Cyrillic), CJK / Arabic / Devanagari use the OS Noto families (Android/iOS ship them) — bundling CJK would
add tens of MB. The picker shows only languages present in the build. (decided)

**D-20 — Texture quality tiers low / high (2K) / ultra (4K), all GPU-compressed.** `Quality` is now
`'ultra' | 'high' | 'low'`. Low = existing 512/1k files; high = 2048 albedo + ORM as KTX2 ETC1S q255
and 2048 normals as KTX2 UASTC (in the APK, +63 MB); ultra = 4096 albedo + ORM ETC1S (bark stays 2048)
as a separate download pack `assets-ultra/` (59 MB, manifest with SHA-256, per D-17), reusing the 2048
normals. Anisotropy min(2 / 8 / 16, GPU max). Terrain layers are stitched from per-layer KTX2 into
`CompressedArrayTexture`s, so nothing above 1k is ever uploaded as RGBA8 (est. VRAM low 50 / high 93 /
ultra 205 MiB vs ~1.3 GB for an uncompressed 4K terrain array set). Loader: `setUltraBase(url)`;
without the pack or on a 4K error, ultra falls back to 2K, then to the 1k JPGs.
*Measured: UASTC+RDO albedo was 3.4× larger than ETC1S q255 and scored lower PSNR on these noisy
scans; 4K UASTC normals were 10–16 MB each while 2048 normals already give ~3 texels per pixel at the closest zoom, so
they are not worth the download. ETC1S → ETC2 RGB also halves VRAM versus ASTC.* (decided)

**D-21 — Owner decisions 2026-11-01 (night).** (1) Monetisation CHANGED: the game is **free**, possibly
with ads (no energy/timers/pay-to-win — the original ban stays); the one-time full-version purchase (D-10)
is dropped, so billing work (docs/BILLING.md, entitlements stub) is parked. All missions are free.
(2) Sandbox becomes a relaxing **city-builder mode**: grow the town in the free valley (placing buildings,
roads, more wagons) — still logistics-driven, still no settler life-sim. (3) 4K pack: no hosting yet;
Ultra works only in dev builds, release APKs top out at 2K. (4) Night work: one APK in the morning with a
summary. (5) Flip cover screen: the "watch" mode is approved. (decided)

**D-22 — 1024 normals for every tier; ship only files a tier loads (APK budget).** The 2048 UASTC
normals were 45 MB of the 77.5 MB `public/assets/textures`. High and ultra (and the low-tier models)
now share one 1024 UASTC normal per set (encoded from the 4k sources, renormalised; terrain sets
unflipped like their other array layers): 11.7 MB for ten sets. Files no tier loads were deleted
(2048 normals, 1k terrain JPG/KTX2, 512 KTX2, every model-set albedo — models are vertex-coloured
and load `{ albedo: false }`), and the ultra pack lost the never-loaded model `albedo_4096`
(manifest v2, 44.9 MB). One no-KTX2 fallback remains: terrain 512 JPG arrays, model 1k normal + ORM
JPGs. Result: textures 29.5 MB, `dist/` 46 MB, debug APK 49.6 MB; est. VRAM low 30 / high 53 /
ultra 165 MiB. Ultra keeps a 2048 shadow map (4096 = ~+96 MB of render targets and 4× shadow fill
for a frustum already fitted to the zoom); pixel-ratio cap ultra 3 / high 2 / low 1.25. The dev
server sets the ultra base to `/assets-ultra/`; release builds stay at 2K until the pack is hosted
(D-21 (3)). *At game distances a 1024 normal still gives ≥ 1.5 texels/px on the terrain; colour
detail and anisotropic filtering come from the 2K/4K albedo + ORM.* (decided)
**D-26 — Missions IV–VI mechanics in the sim (STATE_VERSION 3).** (1) *Ice*: `state.ice` holds windows
[start, end) in ticks; wooden one-lane spans cannot be **entered** inside a window (wagons already on a span leave
it). A wagon at the bridgehead waits with `BRIDGE_CLOSED{span, until, since}`, keeps job, cargo and reservations
(never turned into `NO_ROUTE`, so nothing is cancelled), and re-plans every 3 s. Routing charges the wait until the
thaw when a path enters a span (forward searches subtract the travel time to the bridge), so a stone bridge or
another crossing wins when it is cheaper; stone bridges are not spans and are never closed. No cache depends on
time, so determinism and save/load are unaffected. (2) *Tranches*: `Contract.tranches[]` `{need, deadlineTick,
doneTick, missed}` is the waybill in the state; needs add up in order; the castle orders only up to the tranche
currently due; a late tranche costs one seal (min 1 for a win), only the last deadline loses the mission.
(3) *Granary capacity per building*: `Building.capOverride` (-1 = type default). Warehouses report
`STORAGE_FULL` counting promised arrivals; an overflowing producer whose only granary is cut off points at it
(`blockedBy`) so the chain shows `NO_ROAD`. Migration v2→v3 in `src/platform/save.ts` keeps the key order of a
fresh state (the hash is taken over `JSON.stringify`). *Measured seal ladders are in docs/missions/m4–m6.md;
m5/m6 margins are thin because surplus hauls to a granary compete with demand for wagons.* (decided)

**D-23 — Save gate before migration + golden terrain hash.** Every load goes through
`src/platform/saveGate.ts` (pure, Node-tested, never mutates or throws) before `migrate()`:
raw size cap (4 M chars, `parseSave` only) → one structural walk (depth ≤ 16, arrays ≤ 65,536 checked by
`.length` before iterating, ≤ 4,096 keys per object, strings ≤ 256, ≤ 2 M values, no `__proto__` /
`constructor` / `prototype` keys, only plain objects and finite numbers) → envelope (`format` 1..2,
`stateVersion` integer 1..STATE_VERSION, newer is refused untouched) → known state fields (types, integer
ranges, cell indexes < W·H from the map id, footprints inside the map and non-overlapping, gate = footprint +
facing, roads/traffic length = W·H, unique ids, wagon home = stable, pickup source exists, contract castle
exists, ≤ 2,048 buildings / MAX_WAGONS wagons) → the sim's own `checkInvariants()` (conservation,
reservations = jobs). Unknown extra fields are tolerated so a newer state schema (e.g. v3 tranches,
`capOverride`) does not need a gate change first; the gate validates what it knows. Errors are
`{code, path, detail}` with machine codes; the UI maps codes to i18n keys (`saveErrorMessageKey`).
Terrain is not saved but regenerated from `mapId + seed`, so the envelope (format 2) stores
`terrainHash` (FNV over the JSON of corners / cellH / water / forest / field, prefix `t1-`) and the loader
refuses a mismatch with `TERRAIN_CHANGED`. Format-1 envelopes are upgraded on load by computing the hash
from today's generator (trust-on-first-load: they were made before the hash existed, nothing better is
known). `tests/terrain-golden.test.ts` pins the hash of every map/seed used by MISSIONS, so a generator
change fails CI with instructions (new mapId, or accept invalidating saves and record it here). The
envelope format is versioned separately from STATE_VERSION on purpose: the terrain check is metadata
about the save, not sim state. (decided)
**D-24 — 4K pack: own download, per-version folders, CDN hosting proposed.** The Ultra pack (D-17 / D-20) is
fetched by `src/platform/assetPack.ts`, not Play Asset Delivery: PAD needs Play/AAB distribution (we ship
sideloaded debug APKs), a custom native plugin and has no iOS counterpart. Each pack version installs into its
own folder (native `Directory.Data/ultra-pack/v<N>`, web cache `marchia-ultra-v<N>`); the active version
switches only after every file passed its SHA-256 check, so an interrupted upgrade never breaks the installed
pack. Files restart from byte 0 on failure (no HTTP Range; 2–4 MB each). Native serves files via
`Capacitor.convertFileSrc`; web serves Cache Storage through a tiny service worker (`public/ultra-pack-sw.js`)
and falls back to the network URL without one. Hosting: Cloudflare R2 + custom domain recommended (CORS, free
egress); GitHub Releases rejected (no CORS headers). Production URL is still a placeholder. Details:
docs/ASSET_PACK.md. (decided: mechanism; proposed: hosting — owner to confirm)
**D-25 — Replay reports: allowlisted journal + checkpoint hashes, copy to clipboard only.** "Copy report"
produces `{version, game, missionId, seed, stateVersion, journal, checkpoints, finalTick, finalHash}`
(`src/sim/replay.ts`, format in `docs/REPLAY.md`). (1) Commands are re-serialized from a per-variant field
declaration (`COMMAND_FIELDS`, a mapped type over `Command`, so new fields fail typecheck until declared);
no free-text field type exists, so no personal data can enter. (2) A checkpoint hash is taken after the step
that reached its tick and before that tick's commands (where `GameLoop.onTick` fires), every 600 ticks plus
tick 0; the final hash includes commands applied at the final tick while paused. This needs no change to the
sim or to `GameLoop`. (3) Compression (deflate-raw + base64url, `MR1.` prefix) lives in
`src/platform/reportCodec.ts`, never in the sim. (4) No network: the player copies the text. (5) Only sessions
recorded from tick 0 are reportable; the journal is not persisted in saves, so a continued mission cannot be
reported yet (open: store journal + recorder in the save envelope, or start reports from a saved state hash).
(6) The UI keys were not added in this change: every locale file is typed `Dict` and tested for identical keys,
so adding keys only to pl/en would break typecheck; they are listed in `docs/REPLAY.md` and land with the
pause-menu button. (decided)

**D-27 — Free valley economy in the sim: market, undo, ranks (STATE_VERSION 4).** Implements design tasks
S2, S3 and the minimal S4 of docs/design/sandbox.md. (1) *Market*: with no contract and `state.market.open`
the castle buys every good on arrival (`town.ts sellAt`): stock → `ledger.consumed` (+ `ledger.sold`), so
conservation holds. Price = base × pct, pct = max(50, 100 − ⌊sat·50/24⌋), integer; payouts counted in
hundredths (`market.cents` keeps the remainder). Saturation recovers one unit per good every **10 s** (design
said 20 s: with 20 s one sawmill alone pinned planks at the floor and the decent bot never reached rank 2).
The dispatcher adds market demand after producer inputs (they get first call) and before the granary push:
full loads only, most valuable good first, ≤ 12 units of a good in flight, ≤ 75 % of the fleet (min 1).
(2) *Placement*: `validatePlace` is pure (hash before = after; agrees with `place` on fuzzed input);
`Building.placedTick` (−1 for map buildings). Demolishing an empty, unreserved building within 30 s
(`UNDO_TICKS`) refunds 100 %, later 50 % — the undo is the existing `demolish`, no new command, so replays
and the command allowlist are unchanged. (3) *Ranks* (`state.town`): renown = silver earned from sales; rank
needs renown + distinct goods sold + best silver/min over an 18 × 10 s ring, latched. Gating only for mission
`sandbox`: rank 0 woodcutter/sawmill/farm/stable/warehouse, rank 1 mill/bakery, rank 2 cobble + stone bridges
(`LOCKED{rank}`), castle `NOT_PLACEABLE`. Thresholds tuned with tools/balance.ts sandbox: renown 200/1000/3000
(design 400/1500/4000), goods 2/4/5 (only 5 goods exist), flow 8/20/40. Measured: decent bot rank 1 at 9.8 min,
rank 2 at 25.6 min, income covers 40 silver at 2.3 min; "nothing" stays rank 0 (one good) with 204 silver earned.
(4) *Start*: 260 silver, 2 wagons, woodcutter + sawmill (with 6 planks in stock) by the north road, stable,
granary, castle on the same bank (≈ 200 m haul, ~60 s each way). The old sandbox (m1 layout, 600 silver,
4 wagons) stays as hidden mission `lab` with the market closed, for tests and tools/bench. (5) Migration v3→v4
appends `placedTick: -1`, `ledger.silverEarned/sold`, fresh `market` (open iff no contract: old free-valley
saves start trading) and `town`; contract missions run byte-identically apart from the new fields (checked on
m1–m6 after 10 min). (decided — numbers are a first tuning, re-run tools/balance.ts sandbox after changes)

**D-28 — Building inside contract missions is per mission.** Missions I–V hide the build tool; mission VI
offers only the granary (its 3-seal strategy). Now data: `MissionDef.buildable` (sim), read via `missionBuildable(id)`
(sandbox → 'ranked'). Sandbox subtitle uses the new key `menu.valleySub`
("Rozbuduj miasteczko, bez terminów"); the old `menu.sandboxSub` stays until translations are refreshed. (decided)

**D-29 — Owner decisions 2026-11-02 (morning).** (1) Free valley: **3 save slots** with a slot picker.
(2) **No ads** for now (v1.0 ad-free, no data collection). (3) **More ranks right away**: beyond Osada / Wieś
targowa / Miasteczko / Miasto add long-term ranks (working names Gród, Stolica) that unlock the new chains.
(4) Next priority: **new production chains in the valley** — fisher, quarry (stone for cobbles and stone
bridges), charcoal burner, malthouse + brewery — each teaching a new stall cause. (decided)

**D-30 — Data-driven goods, the valley chains and ranks 4-5 (STATE_VERSION 5).** Implements D-29 (3)-(4) and
design tasks S1/S5 of docs/design/sandbox.md. (1) *Goods are data*: `GOODS` in `defs.ts` is the only list
(append-only; `Good`/`GoodMap = Record<Good, number>` derive from it), every goods map is a plain object with
all goods in GOODS order (`emptyGoods`, `goodsOf`), invariants and the save gate iterate GOODS. New goods: fish,
stone, charcoal, malt, beer (base prices 3/2/4/4/9, same saturation rules). Wagon loads per good
(`WAGON_CAPACITY_BY_GOOD`, `capacityOf`): stone 4, everything else 6. (2) *Buildings*: fisher 2×2 (1 fish/9 s,
footprint or gate 8-adjacent to water, else `NOT_NEAR_WATER`), quarry 3×2 (1 stone/12 s, some cell of the
footprint or its ring ≥ 5 m above the water: the ridge and the hills, else `NOT_ON_ROCK`), charcoal burner 2×2
(2 wood → 1 charcoal/20 s), malthouse 2×2 (2 grain → 1 malt/12 s), brewery 3×2 (1 malt → 2 beer/16 s).
(3) *Competition*: an input that is promised to a consumer of another kind (sawmill vs charcoal burner, mill
vs malthouse) reads `NO_INPUT{cause: 'CONTESTED', blockedBy: rival}`; same-kind consumers keep the old causes.
To split fairly a consumer that cannot run one more cycle counts as starving (accepts a small load), and in the
free valley ties go to the consumer stalled longer (contract missions keep the lower id). Measured: one
woodcutter, sawmill + burner, 5 wagons: ~55/45 % of the wood. (4) *Stone builds roads* (free valley only):
`STONE_COBBLE` 1 per cobbled cell, `STONE_STONE_BRIDGE` 3 per stone-bridge cell, taken from unreserved stone in
granaries (then the castle) and counted as consumed; short → `NO_STONE{need, have}`. Granaries pull a reserve of
`STONE_RESERVE` 18 before the market, and the market never buys stone out of a granary. (5) *Ranks*: 0-2 as
D-27 (rank 2 also unlocks fisher + quarry), rank 3 renown 2500 / 6 goods / flow 60 (charcoal burner, malthouse),
rank 4 Gród 6000 / 7 / 120 (brewery), rank 5 Stolica 13000 / 9 / 160 (no building, `castleLevel` 1).
Measured with the extended decent bot (tools/bot-sandbox.ts, 150 min): ranks at 9.8 / 25.3 / 44.4 / 75.6 /
120.5 min. (6) *Saves*: migration v4 → v5 rebuilds every goods map in GOODS order (new goods 0) and grows
`town.rankTicks` to six entries; the gate expects five goods / four ranks for v1-v4 and ten / six for v5.
Missions I-VI run bit-identically to state v4 with the new fields stripped (all 26 balance runs compared;
golden hashes in tests/chains.test.ts). (decided — numbers are a first tuning, re-run tools/balance.ts sandbox)

**D-31 — Owner decisions 2026-11-02 (day).** (1) Rank names 4–5: **Gród** and **Stolica**. (2) **Seasons** in the
free valley, gently: announced in advance, change conditions (winter: river ice, lower farm yields; spring: thaw slows
dirt roads) and teach new stall causes, never destroy the settlement. (3) Next after the chains UI, all in order:
missions VII–IX → valley events (royal orders, fairs, merchants, soft goals) → playtest + polish; GPT designs part of
it (pack 06). (4) The title is **„Marchia” in every language**; the subtitle is translated. (decided)

**D-32 — Missions VII–IX in the menu; road stone as mission data (STATE_VERSION 6).** Missions VII–IX
(order 42, docs/missions/m7–m9.md) are registered in `MISSIONS` from `src/sim/proposals/missions-7-9.ts`
under own map ids `valley-m7` / `valley-m8` / `valley-m9` (the mission II river, the original valley, the
mission III valley; same generator input, so the golden terrain hashes equal those maps'). Mission VIII's
lesson (stone must be hauled to a granary before it can pave) is a data field, never a mission id in sim
code: `MissionDef.roadStone?: boolean` is copied into `state.mission.roadStone` at build, and the sim reads the
state. With it set, `roadStoneCost` charges stone for cobbles / stone bridges exactly as in the free valley
(D-30 (4): `stoneAvailable`, `takeStone`, `NO_STONE{need, have}`) and granaries pull the `STONE_RESERVE`
before the market. The free valley keeps getting this through rank gating and its flag stays false, so
pre-v6 valley saves behave the same after migration. Migration v5 → v6 appends `mission.roadStone: false`
(no earlier mission used stone); the gate requires a boolean from v6 on. Missions I–VI, the lab and the free
valley run bit-identically with the flag stripped and the version zeroed (final hashes of every balance plan
and four sandbox plans compared before/after; `tools/balance.ts` output unchanged; golden v4 hashes in
tests/chains.test.ts). Measured seals (tools/bot-m7…m9.ts): VII 10.90 / 8.04 / 6.41 min → 1/2/3, VIII 10.50 /
10.11 / 9.48 min → 1/2/3 (repair paves 12 cells after 12 stone reached the granary at 2:59.7), IX 11.22 /
10.06 / 8.70 min → 1/2/3. Menu names, subtitles and castellan letters PL/EN; the six new i18n keys are in
`PENDING_KEYS` until the next translation round. (decided)

**D-33 — Seasons wired into the free valley (no state change).** Implements D-31 (2) from docs/design/seasons.md.
(1) *Switch*: `MissionDef.seasons` (only `sandbox: true`), read by `missionSeasons(id)` and copied by `createWorld` /
`worldFromState` into `World.seasons` — derived like the terrain, never saved. The date is the tick (15-min seasons,
60-min year from tick 0 = spring). So **no STATE_VERSION bump and no migration**: an old free-valley save loads with
seasons at the date its tick implies (a midwinter save opens with the ice window it is in), contract saves never get
them. Rejected: a `state.seasons` field — it would change every contract state's JSON (hash) and collide with the
parallel v6 bump for missions VII–IX for no behavioural gain. Cost: a free-valley replay recorded before this build
diverges after minute 4 (replays are local text, only from tick 0; acceptable). (2) *Hooks* (`src/sim/seasons.ts`,
allocation-free, agree with `effectsAt` — tested over two years): `produce()` uses `cycleTicks()`: farm/fisher cycle =
ceil(ticks·100/pct) via `Math.floor`, whole-item output kept, progress carries over a season change (completes once);
wooden spans close via `bridgeIceUntil()` = max(authored `state.ice`, winter window) in wagons and Dijkstra — existing
`BRIDGE_CLOSED{span,until}`, nothing written into `state.ice`; thaw = land dirt ×0.55 (`RAIN_DIRT`), once when it rains
too, cobble and both bridge kinds untouched, own cost-table variants (`NetCache.costs` 4 → 8, key loaded+2·rain+4·thaw);
fair = `fairPercent(world, good)` → `unitCents/quoteCents(…, fairPct)`, per unit floor(c·125/100) on the saturation price,
used by `sellAt`, the dispatcher's price sort and the market sheet. (3) *Diagnosis*: `Slowdown.thaw` ("roztopy … bruk nie
rozmięka"), `seasonNote()` on farm/fisher/castle cards, a consumer waiting on a winter-slowed farm says "slower supply,
not a stall" (WAITING_UPSTREAM stays non-stalling), winter BRIDGE_CLOSED adds "ice recedes on its own". No new
StallReason — a slower rate is not a stall (design §3). (4) *UI*: plaque line "Zima · dzień N" (existing icons stand in for
the season icons), notices from `nextChange()` 2 game minutes ahead (once per event) and when a season / the thaw starts;
terrain gets one `uWinter` uniform (frost, roads and the river bed excluded) and the thaw keeps the ground half wet.
New PL/EN keys are in `PENDING_KEYS`. (5) *Proof*: m1–m9 and lab state hashes identical to the base build for every
balance strategy, sampled every minute (29 runs); free-valley decent bot ranks 10.1 / 26.6 / 45.4 / 78.1 / 123.4 min
(before 9.8 / 25.3 / 44.4 / 75.6 / 120.5; all inside the windows), earned 17 118 vs 17 488 silver; fuzz 40 runs and a
3-run full-year sandbox fuzz without failures. (decided — numbers as in the design proposal; retune after playtest)

**D-34 — Stall readability after the seasons / VII–IX playtest (no StallReason change).** Fixes F1, F2, F4–F9 of
docs/research/2026-11-02-seasons-m7-9.md. Rule: the player's explanation is read-only diagnosis on top of the sim's
statuses; building statuses, the dispatcher and contract hashes stay as they were. (1) *F1*: `seasonalSupplier()`
(diagnose.ts) — a building at NO_INPUT (CONTESTED / NONE_AVAILABLE) or WAITING_UPSTREAM whose good comes from a
season-slowed farm/fisher; the card shows "slower supply, not a stall" with a tap to that farm **above** the chain
when the status is NO_INPUT, and its bubble is minor, never critical. (2) *F2*: `outputCustomer()` — OUTPUT_FULL
.NO_DESTINATION with no granary at all (blockedBy −1) while a reachable customer still takes the good (consumer
recipe, contract castle still short of it, open market). Player chains (`explainBuilding(…, customers = true)`) link
it to that customer with "waiting for the customer to take more"; the bubble is calm. The sim's own chain (stall
ledger) is unchanged, a truly stranded output stays critical. Rejected: a new OUTPUT_FULL cause in logistics.ts — it
changes building statuses, hence every contract hash, for the same player text. (3) *F4*: `NO_STONE` gains
`incoming` (stone promised to granaries/castle), `atQuarry` (unreserved at quarries) and `quarries`; the toast and the
road preview add "on the way N, at the quarry M" / "still cutting" / "build a quarry". Command results are not state.
(4) *F7*: a building whose stall root is a wagon held at a bridge charges `span:S:BRIDGE_CLOSED|JAM` (the key the
wagon loop already uses), not `wagon:N:…` — **only in seasonal worlds**: `ledger.stallSeconds` is hashed, and making
it general changes the final hash of 6 of 34 contract runs (m2 ×3, m4 ×2, m8 ×1; ledger only, hashes with the ledger
stripped identical) and the v4 golden test. Contract letters in m2/m4 therefore still split a jam into span + wagon
rows; extending it is a golden-hash re-baseline for the owner to decide. (5) *F5/F6/F8/F9* (UI): ice hint on a
building chain that ends at an iced bridge; market % column = saturation × fair with an "autumn fair" line; the winter
notice names fishers too; plaque "Zima · rok N" (`yearAt`) instead of a 24-min day that does not fit 15-min seasons.
(6) *Proof*: m1–m9 + lab state hashes identical to the base build for every balance strategy sampled each minute
(34 runs), `tools/balance.ts` output identical; tests/stall-readability.test.ts (F7 red without the fix). F3 and F10:
proposals only, in the research doc. (decided)

**D-35 — Wagon spacing is drawn, not simulated.** Wagons going the same way are drawn at least 5 m apart
(`src/render/wagonSpacing.ts`, used by `wagonsView`): on each directed edge, from the front wagon back, a
follower is drawn behind the one ahead (also across the next node); the drawn lag grows at once, shrinks at
0.35 m per tick so nothing jumps, may put the wagon back on its previous edge, and is capped at 8 m (one
cell back). The sim is unchanged. *Tried first in the sim (a follower may not get closer than 5 m to a moving
wagon ahead; no deadlock because only moving wagons are leaders), measured with tools/balance.ts against
the current tuning: with one-node lookahead m1 "bridge + 2 wagons" turned from a win (10.78 min) into a
loss, m4 "stone bridge before the ice" went 6.43 → 7.24 min (3 → 2 seals), m6 "nothing" 8.92 → 8.76 (1 → 2)
and "connect the granary" 8.31 → 8.74 (3 → 2); same-edge only: m1 still lost, m4 7.95, m5/m6 ladders off.
4 m cells and 3.6 m/s mean a 5 m gap is a real throughput cut on every shared stretch, i.e. a rebalance of
every mission, not a cosmetic fix. Drawn: m1 bot fleet and m2 show 0 overlapping same-direction pairs (53
and 78 sampled in the sim positions); the deliberately overloaded 120-wagon bench keeps ~78 % (dozens of
wagons on a few cells exceed the capped lag).* (decided — revisit as a sim rule together with a balance pass)

**D-36 — Arabic RTL: the whole HUD mirrors through logical CSS.** `dir="rtl"` (set by `index.html` before the
first paint and by `src/i18n/index.ts` on a language change) now mirrors the UI: `src/styles/main.css` uses only
logical properties (`inset-inline-*`, `margin/padding-inline-*`, `border-inline-*`, `text-align: start/end`;
4-value paddings split into `padding-block` + `padding-inline`). Safe areas read through a logical pair
`--safe-s` / `--safe-e` that swaps in RTL, and `--ix` (+1 / −1) flips the few physical x offsets (shadows
thrown from the rail and the build shelf, slide-in of side sheets). Mirrored: tool rail (landscape: left edge;
portrait: tool order), sheets and their dock side, waybill (collapse origin), town plaque, toasts, notices,
undo, "Pokaż przyciski", menu strip and the valley ledgers. The left-handed setting still swaps sides on top
(rail side = hand XOR RTL, `railOnLeft()` in `src/ui/dom.ts` for the JS-placed tool caption; swipe-to-close
follows). Not mirrored: the map, camera and gestures; boxes placed from screen coordinates (stall bubbles,
ETA tags, ghost labels, tutorial ring); boxes centred with `left: 50%`; the speed buttons and ETA tags keep
LTR order (playback-like, as in RTL apps); goods and building icons. Direction icons: the chain / "dalej"
arrow (`.fwd`) and back / undo (`.rtl-flip`) mirror. Numbers: `iso()` / `<bdi>` isolate parameters; plural
`#` numbers now use Latin digits like `fmtInt` and are isolated in RTL. `tests/css-logical.test.ts` fails on
any physical left/right outside the listed exceptions. *Owner asked for a mirrored HUD (brief 05); the
research note (BACKLOG) had suggested mirroring content only — superseded. Open: whether an Arabic
right-hander prefers the landscape rail on the right (then "left-handed" reads backwards in RTL).* (decided)

