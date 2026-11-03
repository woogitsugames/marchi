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


**D-36 — One save slot per contract mission; starting over always asks (no state change).** Before, every
contract wrote to the single slot `auto`: starting mission V while mission III was unfinished overwrote III
after the first autosave (30 s), and pause → "Start over" deleted a contract save at once. Now contracts write
to `auto-<missionId>` (`src/platform/slots.ts`); the free valley keeps its three ledgers (D-29) unchanged.
`adoptLegacySaves()` (menu start) moves an old `auto` save into its own slot — a contract into
`auto-<missionId>` (the newer copy wins if both exist), a valley game into the first empty ledger as before;
an unreadable one stays in `auto`, which "Continue" still offers so the damaged-save message keeps working.
The copy is written before `auto` is deleted, so a crash in between leaves two copies, never none. A menu row
with an unfinished save says "in progress, m:ss"; tapping it opens a ledger-style sheet (Continue / Start
over → in-row ask), the pause menu asks before "Start over" for contracts too. The end letter's "Again" does
not ask: the save is already deleted when the contract ends. *(decided)*

**D-37 — Arabic RTL: the whole HUD mirrors through logical CSS.** `dir="rtl"` (set by `index.html` before the
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
*Amended 2026-11-02 (owner):* the rail side follows the hand only — in RTL the rail stays on the right for a
right-handed player. `App.applyHand()` sets the `left-handed` class to hand XOR RTL, so the logical CSS lands the
rail physically on the hand's side; `railOnLeft()` then equals the left-handed setting.

**D-38 — Contract pace forecast and shared inputs are read-only diagnosis (F10, F3; no StallReason, no hash
change).** Implements the F3/F10 proposals of docs/research/2026-11-02-seasons-m7-9.md. (1) *F10*: a slower
supply is not a stall (design/seasons.md §3), so the waybill and the castle card read a forecast instead of a new
status. `src/sim/forecast.ts` (pure, sim rules): the UI keeps a `PaceLog` (cumulative `ledger.produced` every 10 s
of game time, sampled in `App.onTick`, window 2 min plus the first sample; never in `SimState`, reset on a new
world or an earlier tick). `contractForecast(world, log)` per ordered good: to make = need − castle stock −
promised − spare producer stock; pace = the better of the 2-min window and the whole log (a passing dip does not
make it panic, a fix shows within the window); ETA = to make ÷ pace + quickest loaded trip (+ load/unload), or the
last promised wagon's `wagonEta` when everything missing is already on the way; two ordered goods made from one
input (m9: planks and charcoal from wood) are also timed as a pool on that input's pace, bounded by the producers'
full-work rate (without this m9 showed "late" in 30 of 55 samples of a won run). Seals from the star ticks minus
tranches already missed; `aim` = pace the bottleneck needs for the next better seal. Ready after one minute of
samples; letters with tranches get no forecast (their waybill reads tranche by tranche). UI (`src/ui/pace.ts`):
waybill "At this pace: done in M:SS" + three seals (pressed as earned; clay when ≤ 1, "N late" past the deadline)
and "<producer> ×n · r/min" with a tap to that producer; the castle card leads with "Delivery pace" (per good now /
at most, e.g. 5.1 vs 6.7 fish/min; "for 3 seals (4:04 left) you need ≈11.2/min") while the castle only waits, or
shows it under the order when the castle is stalled. (2) *F3*: `sharedInput(world, id)` (diagnose.ts): a consumer
waiting for an input (WAITING_DELIVERY, NO_WAGON, WAITING_UPSTREAM, NO_INPUT except UNREACHABLE) while a consumer of
another kind holds or awaits that good; the card puts "Wood also feeds: Charcoal burner — there 6, here 2" (tap →
rival) above the chain, plus "One supplier (Woodcutter's hut) for 2 customers — a second one would help" while
there is one producer. The sim's CONTESTED keeps its narrow meaning. Rejected: m9 data changes (start wood, wagons)
and widening `contestedBy` to reserved stock — both change mission hashes (and the seal tuning). (3) *Proof*
(`tools/pace-readability.ts`, tests/contract-pace.test.ts): m7 forecast seals = outcome in 100 % / 100 % of samples
for "no action" / "right fix" (median error 16 / 42 s), late fix 67 % two minutes after the action, never a false
"late"; m9 61 / 39 / 59 %, 6 / 7 / 1 false "late" samples. m9 lesson on a consumer card: 5.0 % → 84.9 % of the
game without action (3.3 → 81.0 %, 3.8 → 57.1 % with fixes), 0 wrong rivals. m7 and m9 hashes identical with and
without reading every tick for all bot strategies. New PL/EN keys in `PENDING_KEYS`. (decided — retune the pace
window after the playtest)

**D-39 — Missions X–XII in the menu; data rebalanced so each mission teaches its own cause.** Order 49 (GPT,
docs/missions/m10–m12.md) was registered but not in the menu. Probes in the real sim (per-building status shares,
action-time sweeps) showed three teaching faults; all fixes are `MissionDef` data in
`src/sim/proposals/missions-10-12.ts`, no sim code and no mission id in the sim. (1) *X (wood for two workshops)*:
with the stable at (46,35) the binding constraint was the 40-cell wagon trip to the woodcutter (woodcutter
WAITING_PICKUP 24 %, CONTESTED 4 %), and buying a wagon made it worse (11.58 min). The stable moves next to the
woodcutter, (19,35) with road (20,37)–(20,40); stars 9.3 / 10.3 min. Doing nothing now loses (36/48 planks: the
burner keeps turning wood into surplus charcoal) — allowed by the order (≤ 1 seal); the right fix is the second
woodcutter alone (8.34 min), two wagons are a measured wrong fix (10.44, 1 seal). (2) *XI (long route)*: with 26
beer "nothing" took 11.82 of 12 min and one wagon bought at 3:00 lost (all wagons on 2-grain hauls). Contract 22
beer, stars 9.4 / 10.3: nothing 10.94 (1), one wagon 10.06 (2), five 8.88 (3); no loss for 1–6 wagons bought at
any time 0:20–6:40. (3) *XII (granary buffer)*: with 8 wagons linking the granary after 1:00 was worse than doing
nothing (wagons hauled surplus grain into it, the brewery got none) and wagons beat the link. 12 starting wagons,
stars 9.0 / 10.1: link at 0:20 → 8.60 (3), at 2:00 → 9.92 (2), nothing 10.36 (1), two wagons 10.44 (1); the
granary buffers mostly beer, so the letters say beer, not malt. Tests: ladders 0/2/3 (X) and 1/2/3 (XI, XII),
`WRONG_FIXES` ≤ 1 seal, partial–right ≥ 0.8 min. Menu: 12 entries, PL/EN names and short subtitles (≤ 34 chars)
in `PENDING_KEYS`; XII renamed "Wielkie warzenie" (more natural than "piwowarstwo"); castellan letters rewritten
to the new numbers (docs/content/letters-10-12.md). Rejected: changing the dispatcher (load splitting, surplus
priority) — it would move every mission hash. Open: X still reads "wood on the way" most of the time (BACKLOG);
X repeats IX's lesson in isolation; results are sensitive to the action second (dispatcher chaos). (decided)

**D-40 — Horse gait advances with distance, not time; three wagon detail levels.** Owner feedback from the
phone: the horse ran faster than its legs showed. The leg animation was a time-driven sine swing scaled by an
estimated game speed, so hooves always slid. Now (`src/render/gait.ts`, pure TS) every rig keeps a gait phase
advanced by the distance its *drawn* position moves along its heading each frame (`phase += Δd / stride`), and
the wheels roll by the same distance (`angle = Δd / r`). In stance a fetlock moves back relative to the body by
exactly `2·reach / duty` per cycle = the stride, so a planted hoof stays put at ×1/×2/×4 and through any frame
rate (`tests/gait.test.ts` checks the sole's world position over every stance, for walk, trot and the blend, and
fails when the stride is off by 10 %). Gait choice uses the drawn game-time ground speed per sim tick (render
snapshot, not sim internals): walk below 2.3 m/s, trot from 3.2 m/s (dirt 3.6 trots, a wooden bridge 2.8 is in
between, rain/mud slowdowns walk), blended smoothly. Each leg is a pivot → knee/hock → fetlock → hoof chain posed
by two-bone IK on the CPU (≈0.8 µs per horse) and skinned in the vertex shader from four per-instance vec4s; the
shadow pass uses the same skinning (`customDepthMaterial`). The body sinks a few cm while moving so the legs can
reach (half constant, half per-step bob); the driver bobs with the footfalls; a standing horse eases to a square
stance with a little head and tail movement in bouts. Detail: near (< 0.4·lodDist ≈ 48 m at high) full harness,
banded hubs, iron tyres, ~5.5k tris per rig; mid (to lodDist) the same skinned rig with fewer segments, ~3.4k
(the old single LOD0 was ~3.2k); far the static ~620-tri merged rig. Cost with 100 wagons (harness, 412×915):
mid zoom 49 calls / 423k tris (was 49 / 417k), close zoom 57 calls / 446k (was 51 / 429k). At ×4 the cadence is
four times higher (no sliding, but on a 30 fps phone the legs strobe at full trot) — accepted over sliding.
**D-41 — Trees: clump crowns, lit impostors baked from above, dithered LOD crossfade (render only).** The owner
saw cheap trees on the phone; research `docs/research/2026-11-02-trees.md` found black near trees vs bright flat
impostors, vertical streaks in the far forest, "matchstick" pines and dead-stick shrubs. Changes: crowns are a few
large crossed *clump* cards (lobed clump texture, crown+clump blended normals, no back-face normal flip) instead of
~130 confetti cards; trunks are lathes with root flare and taper on their own `trunk` material (bark maps + tree
shader); 2 geometry variants per kind plus per-instance hue/value, XZ/Y scale and ±3° lean from a position hash; a
wider late-autumn palette (russet/ochre accents on oak, ochre/yellow-green birch, olive shrubs). Far cards come from
an albedo **and** normal atlas baked from 30° above (the camera pitch is 27–52°; a level side view of a spruce is the
thin spike that made the streaks), lit with the baked normals, atlas treated as premultiplied (no inked fringe),
silhouette alpha from a finer mip; the blob shadow is pushed away from the light so it no longer cuts its own card in
half. Near↔far is a 12 m screen-space dithered crossfade (trees in the band sit in both lists; complementary
discard from the exact camera distance). Canvas textures become straight-alpha data textures (black under
transparent texels made dark rims); alpha is scaled by the sampled mip level (thin needles no longer vanish at a
distance). High: alpha-to-coverage on near cards and a height-weighted vertex wind; low keeps plain alpha test, no
wind, no tree shadows. Cost (412×915 dpr 2, `r.info.render` incl. shadow pass): m1 high near 39→48 draw calls,
416k→465k tris; mid 37→40, 332k→298k; far 35→35; low near 40→48, 248k→255k; sandbox high near 31→42, 402k→451k
(the +calls are the second variant per kind). Screens: `docs/shots/trees2-{before,after}-*.jpg`,
`trees2-closeup-*.jpg`; script `tools/tree-shots.mjs`. Not done: a multi-view (azimuth) impostor atlas. (decided)

**D-44 — Owner decisions 2026-11-02: one ledger row per held bridge, an honest "supplier" status, wagon fleet
numbers (state v7).** Three approved changes that alter sim results, one commit each on `claude/w-simfix`;
golden hashes re-baselined deliberately. Building statuses do not drive the dispatcher, so no mission plays
differently: every bot strategy (balance.ts m1–m6, bot-missions-7-9, bot-missions-10-12 incl. the wrong fixes,
bot-sandbox, mission-bot m1, bot-m2/m3/m4) gives the same result, time and seals before and after (table below;
`tools/balance.ts` and all `tools/bot-*.ts` outputs byte-identical). The bots now also report the final state hash.

(1) *D-34 fix (F7 in contract missions).* `accountStalls` charges a building whose stall root is a wagon held at
a bridge (BRIDGE_CLOSED / BRIDGE_JAM) as `span:S:K` in **every** world, not only seasonal ones, so the end
letter shows one row per jammed / iced crossing instead of span + per-wagon rows. Only the ledger changes (state
with `ledger.stallSeconds` stripped identical in all 51 runs); changed are exactly the runs whose building chain
ends at a held wagon on a wooden span: m2 without a stone bridge (one-lane jam), m4 before the bridge is stone
(ice), m8 right fix (a 10 s one-lane jam, `span:3305:BRIDGE_JAM`), and bench100 after 2500 ticks. Stone-bridge strategies, m1, m3, m5–m7, m9–m12,
lab and sandbox are unchanged. Test: `stall-readability` "F7 / D-44" (red before the fix).

| run (v4 golden, `chains.test.ts`, v4 view) | before | after |
|---|---|---|
| m2 nothing | 7fc1c8d157ed7f29 | 4b902f1db0533e35 |
| m2 buy 2 wagons | 99d33c2352b3a9c9 | c33b5d92f4dbd83f |
| m2 buy 2 + 2nd wooden bridge x=63 @45s | 06324d3b475478fa | a1da025a585ea7ce |
| m4 nothing | a64f6bf76e6f6110 | f033eff4d9820c10 |
| m4 buy 3 wagons @1:00 | 0b250d6171216846 | 8ec390098e423284 |
| m8 wagon + cobble (final `stateHash`, bot-missions-7-9) | 4a7b8ec112182e75 | 5e35ed5721e83c37 |
| bench100 @2500 / @3000 (`dispatch-reachability`) | ab1282712910a464 / 17f1e2a72d8ad006 | 5a58035c13b27844 / c7f0bbc81a0a4cc6 |

(2) *F5, second half.* `upstreamReason` (logistics.ts) counted a supplier in WAITING_DELIVERY as healthy, so the
consumer said WAITING_UPSTREAM "the supplier is making it now" while the supplier's own input wagon stood at an
iced bridge. Now a reachable *producing* supplier is preferred; a supplier whose delivery wagon is BRIDGE_CLOSED,
BRIDGE_JAM or NO_ROUTE is *held*: the consumer reads `NO_INPUT.NONE_AVAILABLE` blamed on it, the chain runs
consumer → supplier (waiting) → wagon at the bridge, and the ledger charges that span. A supplier whose input is
merely on the way stays WAITING_UPSTREAM — start-up is not a stall (deadlock.test.ts) — but the card now says
"the supplier is itself waiting for grain" (`status.WAITING_UPSTREAM.supplierWaits`, pending key; UI text only).
No new StallReason. Rejected: NO_INPUT for every non-producing supplier — every chain would light up red during
normal start-up (m2: 4054 status-ticks per run). Effect: m2 ≈205 and m4 845–1180 building-status ticks per run
change; all final hashes unchanged (the held consumer's root is the span the wagon loop already charges), 4 of 474
per-minute samples differ (m4 nothing, m4 buy 3). Test: `stall-readability` "F5 / D-44" (m4 ice; 169 wrong
WAITING_UPSTREAM samples before, 0 after; the chain ends at the held wagon).

(3) *Fleet numbers.* `Wagon.n` (1..N in purchase order, from the new counter `SimState.nextWagonN`; a sold
wagon's number is **not** reused) replaces the global `nextId` in player text: wagon sheet title, "wóz {wagon}"
statuses, "czeka przy moście na wóz {blocker}", chain subjects, end-letter ledger (a wagon sold since reads just
"Wóz"). STATE_VERSION 6 → 7; migration 6→7 numbers existing wagons in id order (= purchase order, ids only grow;
numbers of wagons sold before v7 are unknown) in fresh-state key order; the save gate requires unique `n <
nextWagonN` for v7; `checkInvariants` checks the same. Test `save-v7.test.ts` loads a real v6 save written by the
previous build (`tests/fixtures/save-v6-m2-sold-wagon.json`: m2, 3 bought, first starter sold, ids 12–20, grain and
wood on wagons) → n = 1..9, nextWagonN 10, invariants and conservation OK, v7 round trip, stable numbers, no reuse
after a sale, gate rejections. Every state hash changes (two new fields, version 7); with them stripped and version
6, all 474 per-minute samples of every strategy, the lab, sandbox and bench equal the previous commit. The v4
golden view strips them; bench golden re-baselined (bench50 7bfba2c9…3e2b9df1, bench100 365d8f9d…2431f477).
Fuzz 200 runs × 4000 ticks (save/load divergence): 0 failures.

Seal ladder (before = after, minutes | seals): m1 nothing lost 0 · bridge lost 0 · bridge + 2 wagons 10.78 | 1;
m2 10.81 | 1 · 9.94 | 1 · stone 8.51 | 3 · 2nd wooden 9.52 | 2; m3 8.57 | 1 · 7.41 | 2 · 5.60 | 3; m4 11.65 | 1 ·
10.49 | 1 · late stone 8.07 | 2 · early stone 6.43 | 3; m5 9.61 | 1 · 9.41 | 1 · 9.16 | 2 · 8.40 | 3 · 8.04 | 3; m6
8.92 | 1 · 8.80 | 2 · 8.31 | 3 · 8.40 | 3 · 9.76 | 1 · 9.62 | 1; m7 10.90 | 1 · 8.04 | 2 · 6.41 | 3; m8 10.50 | 1 ·
10.11 | 2 · 9.48 | 3; m9 11.22 | 1 · 10.06 | 2 · 8.70 | 3; m10 lost 0 · 10.14 | 2 · 8.34 | 3 (wrong fix 10.44 | 1);
m11 10.94 | 1 · 10.06 | 2 · 8.88 | 3; m12 10.36 | 1 · 9.92 | 2 · 8.60 | 3 (wrong fix 10.44 | 1); sandbox decent
ranks at 10.14 / 26.59 / 45.45 / 78.08 / 123.4 min; mission-bot m1 8.85 | 2. All documented ladders hold
(1/2/3, X 0/2/3); no mission data changed. (decided)
**D-43 — HUD v3: concept "D" on the painted UI kit (UI only; no sim change, hashes identical).** The owner approved
mockup D (docs/mockups/hud/v2 on `claude/hud-mockups`: top from A, bottom from B) and the painted kit
(`public/assets/ui/kit`, `docs/ui-kit.md`). The old waybill parchment and the oak rail are gone — one HUD, not two.
*Top* (`.hud-top`, one CSS grid): menu button, time chip (sun/rain icon) and silver chip (coin icon) on `stat`
plates that grow with their text, the speed control on `segment-bg` (pause / ×1 / ×2 / ×4; in portrait a second
row, right-aligned; the four cells are sized to land on the painted dividers), and the contract under a red
`ribbon` (mission name; tap folds it to a wax seal that fills with progress): three forecast seals (D-38, dim until
the forecast is ready; tranche letters show 3 − missed), the slate "M:SS do śniegu" pill, a `progress` bar per
good with "n/total", and the D-38 pace rows, now real 48 px rows (fold audit P2). The free valley uses the same
panel: rank on the ribbon, the checklist, income and season. *Bottom* (`.rail`): "NAJGORSZY ZASTÓJ — <building>:
<short cause>" on `panel-alert` with an eye button (camera + "Dlaczego stoi?"), the `seal-alert` that cycles
through the stalls (badge = count), and the tool cards (Budynki where the mission allows building, Droga, Bruk,
Rozbiórka, Kup wóz with a cost badge, Ruch). The worst stall is read-only (`src/ui/stalls.ts`): the same
buildings as the pins (`isStall` or NO_INPUT, ≥ 2 s), score = `stalledTicks` × 3 when critical, × 0.25 when it
resolves by itself (waiting for a pickup, a customer that still takes the output, a season), × 1 otherwise; ties
by id. Its *cure* follows the cause chain (`explainBuilding`) from the root: a wagon for `NO_WAGON.ALL_BUSY` or
`OUTPUT_FULL.NO_WAGON` → "Kup wóz" gets `card-highlight`; a road for `NO_ROAD`, `UNREACHABLE`, `NONE_CAN_REACH`,
`NO_ROUTE` → "Droga". Silver short: hatched `card-disabled`, the label becomes the shortfall ("brak 4"), the
badge turns red; the tap still gives the full reason (toast). *Map*: kit pins (red = the worst or a critical stall,
with a wine ring round the cause icon; brass = lesser), the wagon ETA on the slate `eta` plaque. *Sheets* (why,
wagon, market, build card, pause, settings, ledgers, mission save) and the end / rank letters sit in
`frame-sheet` (`-dim` for menus) with content kept 26 px from the frame; a bottom sheet hides the rail under it and
stops under the contract panel (≥ 45 % of the screen; fold audit P3 on 360 px). *Layouts*: landscape and
≥ 720 px portraits put the top in one row (menu, contract, chips, speed) and the bottom in one row (tools under one
thumb, stall card + alarm under the hand's thumb; left-handed mirrors, RTL does not — D-37 as amended); Flex mode
moves the whole HUD under the hinge; the Flip cover keeps menu, speed and the folded seal (opens the castle card),
no tools and no stall card; the Flip main menu got a fade at its foot as the scroll hint (fold audit P2).
*Tech*: 9-slice `border-image` with percentage slices (independent of @2x / @3x) and `image-set`, border width 0;
DOM built once, updated on value change only; rail and top-cluster sizes from `ResizeObserver` (`--rail-h`,
`--hud-top`, `--bar-b`). Arabic gets the D-38 and HUD keys (the i18n-ar test now allows pending keys in `ar`),
which also fixes the "min/4.9" bidi flip of the English fallback. Kept as they were: tutorial anchors
(`.waybill-wrap`, `.wb-line`, `[data-tool="road"]`), toasts, notices (now under the top cluster), undo, "Pokaż
przyciski", build shelf (landscape: a column under the speed row), `window.__marchia.ready`. Screens:
`docs/shots/hud3-*.jpg`; script `tools/hud3-shots.mjs` (also reports small targets, clipped text, off-screen boxes).
Rejected: keeping the oak side rail in landscape (two bottom bars and a side bar fight over a 412 px height; the
mockup's single bottom row reads better); a stall speech bubble on the map (D removed the duplicate; the pin's
cause is one tap away and the card names it). Open: the eye glyph is the existing `inspect` (pointing hand) icon,
not a drawn eye; the other 15 languages fall back to English for the new keys (PENDING_KEYS). (decided)
**D-45 — Camera keeps the sheet's subject in the visible part of the map; idle wagons wait in a drawn row
beside the stable (render only).** (1) Opening a building or wagon sheet (tap, `?open=`, links in the cause chain)
measures the map area left visible: the scene minus the sheet's layout rect (transform ignored, so a sheet still
sliding in counts at its final place), the tool rail and the waybill, cut greedily keeping the largest rect
(`src/ui/focus.ts`). Because the sheet's side is measured, not assumed, bottom sheets (portrait), side sheets
(landscape / ≥720 px), RTL (D-37) and the left-hand swap all work without branches. If the subject's marker (and,
for a building, its gate) is already ≥15 % inside that area the camera does not move; otherwise
`focusCell(cell, screenOffset)` aims the orbit so the cell lands at the area's centre — the ground shift is
computed by unprojecting the offset from a scratch camera at the goal distance/yaw, so zoom and rotation stay
as the player left them. The move is a fixed 220 ms ease-out cubic (no spring, no overshoot); any pan, zoom,
rotate or follow cancels it. Nothing is restored on close (a jump back would lose what the player was looking at).
A followed wagon is kept at the same offset. The 2D fallback view ignores the offset. Measured
(`tools/camera-shots.mjs`, m1, 5 buildings × 412×915, 915×412, 904×1000, ar 915×412, ar 904×1000): a tap on a building
where the sheet docks left the marker or gate under the sheet in 25/25 cases before, 0/25 after (marker clearance
from the sheet edge: median −136 → +273 px); opening by navigation: clearance median +75 → +253 px, min +39 → +183 px. (2) Wagons standing idle or
just back at a stable gate share one sim node (research 2026-11-02-idle-wagons.md: changing the sim is not worth
the hashes/migration). The view now draws them in waiting places beside the stable: side by side along both
flanks (3.2 m pitch, up to 7 per side, then ranks behind), horses toward the gate side / road, only where the whole
rig stands on open ground (no road, gate, footprint, water, field, forest > 0.15). Places go in wagon id order
(same state → same picture); wagons beyond the free places are still tucked into the stable. The drawn offset eases
in and out (1.6/s) so arrivals and departures drive rather than jump. Sim state is untouched (`wagon-spacing`
checks the hash). (decided)
**D-46 — The castellan's letters are shown in game.** The authored letters of `src/content/letters.ts` (missions
I–XII) now open and close each contract. *Opening*: a letter over the paused scene when a contract starts from the
menu (`buildOpeningLetter`, `src/ui/menu.ts`): mission title, the letter, "Do dzieła"; one gesture closes it (a tap
anywhere, the button, Escape or Enter), then the game runs at ×1 and mission I's tutorial starts. Not shown for
debug `?play=` starts (screenshots, bots) nor on the end letter's "Again" (the player has just read it).
*End*: the letter by seals (won 1–3) or the loss replaces the generic sentence; missions without letters keep it.
A language without authored letters falls back to English (D-18) and the paragraphs carry `dir="auto"`, so an
English letter keeps its punctuation in the Arabic UI. (decided)

**D-47 — A thin load names the shortage at its source (mission X; read-only, no hash change).** In mission X the
sawmill reads "wood on the way" most of the time while the real cause is one woodcutter for two workshops:
starving consumers accept small loads (D-30), so wagons run with 2 of 6 wood. Changing `explainBuilding` would
move hashes (`accountStalls` writes `ledger.stallSeconds` from it), so the fix is a separate read:
`thinDelivery(world, id)` (`src/sim/diagnose.ts`, never called by `step()`) returns the delivery when the building
is `WAITING_DELIVERY`, the load is at most half a wagon and comes from a producer (a granary sending little is not a
shortage). The card shows "Wóz 8 wiezie tylko 2 z 6 — Chata drwala nie nadąża z dostawą" with a link to the source,
above the D-38 shared-input note. Measured with `tools/supply-readability.ts` (m10, idle sawmill seconds):
"on the way" with the cause named 0 % → 64.3 % of 437 s doing nothing, 33.8 % with the late woodcutter, 19.8 % with
the right fix; final hashes equal with and without the reads (test `tests/thin-delivery.test.ts`). (decided)

**D-48 — "No road to victory" is said at once (contracts; read-only).** `deadEnd(world)` (`src/ui/deadEnd.ts`,
pure read of the sim) reports a contract that can no longer be won for lack of a road: the castle gate has no road
from the stable (the gap finder `suggestConnection` still needs new cells) and silver + the refund for selling every
wagon but one (`WAGON_REFUND` = half `WAGON_PRICE`, as `sellWagon`) is below the cheapest connection — or no
connection can be built at all. The app checks it every 5 s of game time; once per game it pauses and shows a
letter "Szlak nie do uratowania" with the cost, the silver and the possible refunds (Again / Menu / Keep watching).
Not covered (left to the deadline): a connected castle whose producers cannot reach their inputs, or a time
shortfall — those are forecasts (D-38), not dead ends. (decided)

**D-49 — One formatting module for numbers and time (Intl).** `src/ui/fmt.ts` holds every number / time formatter
of the UI: `fmtInt`, `fmtDec`, `fmtPercent`, `fmtRatio`, `fmtDuration` (game clock m:ss / h:mm:ss) and
`fmtDayTime` (24 h). Latin digits in every language (`-u-nu-latn`, as before), grouping, decimal separator, the
percent sign and spacing follow the language (de "90 %", hi "12,34,567"). Formatters are cached for the current
language and dropped on a switch (`setFmtLang`, called from `onLangChange` in `format.ts`); the module imports no
i18n code so it runs in Node tests (`tests/fmt.test.ts`: en, de, hi, ar, pl). `format.ts` keeps `clock`,
`ticksClock`, `dayClock` as thin wrappers so existing imports stay. `hud.ts` is not touched (HUD redesign in
progress); it already formats through these wrappers. (decided)

**D-50 — Saves: one IndexedDB connection, no JSON copy, a metadata store for the list.** `src/platform/save.ts`:
(1) the connection is opened once per page and reused (dropped on `close` / `versionchange`, reopened on the next
call; a dead handle is retried once). (2) `saveGame` no longer copies the state through JSON: with the connection
open the transaction starts in the caller's own turn and `put()` takes IndexedDB's structured clone of the live
state at once; only the first save of a page (database still opening) takes a `structuredClone` up front, so a
game tick during the open cannot change what is saved. (3) The database goes to version 2 with a `meta` store
(the envelope without `state`), written and deleted in the same transaction as the save; the upgrade fills it
from existing saves. `listSaves` (the menu) reads only `meta`; the ledger picker (`readSlots`) still reads whole
envelopes because it validates them through the save gate. State migrations (STATE_VERSION) and the slots of D-36
are untouched. Tests on `fake-indexeddb` (dev dependency): one `open` for many operations, metadata-only listing,
snapshot at call time, v1 → v2 upgrade, legacy `auto` adoption. (decided)

**D-51 — No tools code in the bundle; the debug handle only on request.** The menu backdrop (mission I with the bridge
and two wagons) and the `?bot=1` plan used by screenshots moved from `tools/bot.ts` into `src/game/menuScene.ts`
(`menuWorld`, `botPlan`, `bridgeA`, `stableId`, `polyline`); `tools/bot.ts` re-exports them, so tests and bots are
unchanged and `src/ui/app.ts` imports nothing from `tools/`. `window.__marchia` always has `ready` (smoke tests and
every screenshot script wait for it); the `App` handle, `findSteepDraft` and `rankUp` exist only with `?debug=1` or
on the Vite dev server (`import.meta.env.DEV`, which the screenshot scripts use). `tools/store-shots.mjs` runs on
`vite preview` (a production build) and now adds `debug=1`. Checked on a production preview: no params → keys
`ready`; `?debug=1` → `app, findSteepDraft, rankUp, ready`; 0 console errors. (decided)

**D-52 — Android: no INTERNET permission; Auto Backup keeps the saves, not the caches.** The game runs offline
from the APK: Capacitor serves the web assets to the WebView from local files, every `fetch` in the app is a
relative asset URL, and the 4K pack downloader (D-24) is not wired into the release (D-21). So
`android.permission.INTERNET` is removed from `AndroidManifest.xml`. `npx cap sync android` does not add it back
(checked; the manifests of `@capacitor/android` 8.6 and `@capacitor/filesystem` 8.1 declare no permissions), and the
merged debug manifest built by Gradle has no INTERNET (only androidx's internal signature permission
`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`). When the 4K download comes back, INTERNET returns with it and the store
data-safety forms must be revised. `allowBackup` stays true — moving progress to a new phone is a player benefit —
with explicit rules (`res/xml/backup_rules.xml` ≤ Android 11, `res/xml/data_extraction_rules.xml` 12+) that keep the
WebView IndexedDB saves and settings and leave out the WebView caches; docs/store/data-safety.md explains why this is
not "data collection". Not verified here: a full APK (Maven Central answered 429 during the Kotlin compile of the
filesystem plugin) — check the morning APK with `aapt dump permissions`. (decided)


**D-53 — HUD v3 polish: a compact landscape contract, engraved bars, one kit button, seals inside the frame (UI
only; no sim change).** Owner review of the D-43 screens before the APK. (1) *Landscape contract* (915×412): the
panel was 330 px wide (36 %) and 192 / 245 / 341 px tall in missions I / VII / IX (47 / 59 / 83 % of the height);
now 272 px (30 %) and 129 / 178 / 178 px (31 / 43 / 43 %), the tranche letter V 340 → 260 px: seals and the snow
pill in one row (24 px seals, 28 px pill), the goods side by side (`.wb-goods`, a cell = icon, count, a 6 px bar
under the count; up to 3 per row), a later or finished tranche in one row, the pace forecast in one 48 px row — the supplier part shrinks to
its good's icon (still a 48 px target to the producer; its words stay visually hidden for screen readers). Portrait
keeps the layout with less padding (10/4 px, 36 px head row; mission I 198 → 186 px). Every tap row stays ≥ 48 px. A folded contract no
longer keeps the 330 px column in landscape. (2) *Bars*: the kit's slate `progress-track` read as a black tube at
0; the track is now a CSS groove engraved into the parchment (a shade darker than the paper, a dark lip above, a
light lip below, brass studs), quarter marks are faint cuts, the fill stays the antique-brass `progress-fill`;
8 px tall (6 px in landscape). (3) *Eye*: the stall card's button shows a drawn woodcut `eye` (`src/ui/icons.ts`:
almond lids, lashes, hatched iris, glint) instead of the pointing hand. (4) *Letters*: the old rosette that hung
over the frame (end, opening, dead end, rank) is replaced by the kit wax inside the frame's top corner —
`seal-full` for an opening or a win, `seal-empty` for a loss or a dead end; the end letter's three seals and the castle card's
pace seals are the kit seals too; letters keep 38 px clear of the bottom ornaments, and on a short landscape screen the end letter reads
in two columns so its buttons stay on screen. (5) *Buttons*: every `.btn` (sheets, letters, menus, settings) is
on the kit — primary = wine wax (chamfered, dark wax rim), secondary = the parchment tool card with its brass
edge (`card-normal / pressed / active / disabled`); no oak buttons are left. The tutorial note sits on `panel` with
the kit seal, "Pomiń" grows to 48 px. Fixed on the way: the speed cells' `.seg` rules also hit the settings'
segmented control (`div.seg`), squeezing "Jakość obrazu" into one 48 px cell — now scoped to `button.seg`; the
rank letter's text no longer runs into its frame. Screens `docs/shots/hud4-*.jpg` (before/after), checked on
412×915, 915×412, 904×1000, 360×740, Flip 360×380, Flex and `lang=ar`: 0 console errors, no target under 48 px.
Rejected: tinting the slate track sprite with filters (muddy at 6–8 px and different per GPU); dropping the pace
row in landscape (the forecast is the point of D-38). (decided)

**D-54 — Valley events in the Free Valley: royal orders, a dynamic fair, a travelling merchant (state v8).**
Owner-approved (design `docs/design/events.md`, texts `docs/content/events.md`). Only the free valley
(`mission.id === 'sandbox'`) gets a `valleyEvents` slice (state v8, appended last; save v7 → v8 migration adds
the neutral slice, the save gate checks it); contract missions carry no new field and draw no extra RNG.
`src/sim/events.ts` runs once per sim second at the end of the tick and writes events and `rng` together.
**Royal orders** (≤ 2 at a time, ≥ 6 sim minutes apart, 30 templates gated by rank *and* a complete existing
chain): an offer waits for **accept** (`orderAccept`); after that, goods arriving at the castle go to the oldest
accepted order before the market (sold to the crown: no saturation, no market price), and a full order pays
`ceil(1.5 × base value) + 8 + 5 × rank` silver and twice that renown, once. No deadline, no failure, set aside
(`orderDecline`) at any time without loss — delivered goods stay delivered (D-21). **The fair** replaces the fixed
autumn beer +25 % (D-33): every third 15-minute season one producible good sells at 125 %, announced 2 sim
minutes ahead; never both bonuses. **The merchant** (every second season) buys up to N units of a spare good at
140 % (`merchantSell`, re-checks the surplus now: unreserved, connected to the castle, working reserve kept; it
is not market income, so it never feeds the silver/min rank flow) or is put aside (`merchantDecline`).
Determinism: same seed + commands ⇒ same hash, cold/warm save identical (tests `valley-events*.test.ts`).
**Contract missions are bit-identical**: 13 missions × {0, 2 wagons bought} hashed every 4 min over 12 min against
golden values recorded on the pre-D-54 build (v7); re-run on base 7983aaa: 26/26 equal. **HUD**: the card
„Wieści z doliny” (`src/ui/eventCard.ts`) sits under the town plaque in portrait and under the speed bar in
landscape (the contract column is taken by the plaque and the rail), on the painted kit panel: per-order title,
reward, per-good delivery bars, accept / set aside, the fair line, the merchant's offer with „Sprzedaj N”; the
header folds it in one tap, every action 48 px, RTL by logical properties; a single toast per new event or fulfilled
order, none on load or after a fast-forward. Balance (`tools/balance-sandbox.ts`, 180 min, 6 policies × 3 seeds,
`docs/balance/sandbox-seasons.md` §D-54): a player who ignores the events keeps the pacing (rank times equal or within ±2.5 min, except stone: seed 1301
R4 146 → 123 min, seed 1302 now reaches R4 at 85 min; silver −1…+4 %, the fair now also pays for planks, bread,
stone); an eager player who accepts every order and sells to every merchant earns +14–46 % silver and reaches
R2–R5 about 20–25 % earlier (R5 at 91–105 min instead of 116–124), and a valley that builds nothing reaches R1
(13–61 min). Kept as designed for the playtest: the events are opt-in work for the crown, the order of
ranks and the late-game wall stay; if the playtest finds R5 too quick, halve order renown first (2× → 1× silver).
Screens `docs/shots/events-*.jpg` (412×915, 915×412, 904×1000, `ar` portrait and landscape, folded): 0 console
errors, no target under 48 px. (decided)
*Amended 2026-11-02 (HUD, BACKLOG P2):* with 3–4 events the open card took ~40 % of a portrait screen, so it now
**starts folded** to its header and count; the player's fold / unfold is kept for the session (sessionStorage via
`prefs.ts`, never the sim or the save). Open, it shows **one item in full** — the oldest accepted order (it takes
the castle's deliveries first), else the newest order, else the merchant; the other orders and the merchant are
48 px rows (title, delivered/required or the silver reward, the merchant's unit price) that open on a tap, one at a
time. A new event while folded lights the header once (one CSS pass, no repeat) next to the single toast. Tool
card labels may break into two balanced lines (de, ru, fr, es, it, nl, sv, ja ran past the card), the cost badge
never covers the label. Screens `docs/shots/events2-*.jpg`.

**D-55 — Landscape side sheet docks opposite the contract, between the top bar and the bottom rail (UI only).**
On a 915×412 screen the game's side sheet docked at the inline start for a right hand (end for a left hand) and
ran from the chips row to the screen foot, so it covered the compact contract (D-53) and, when tall (castle card,
cause chain), the tool cards; the left hand had it over the tools instead. Now, in a landscape game, the sheet
always docks at the **inline end** — opposite the contract, which sits after the menu and mirrors with the
language — and stops above the bottom rail (`max-height` = height − `--bar-b` − `--rail-h` − safe area − gaps;
width `min(380px, 46vw)`). The contract, the tools, the stall card and the alarm stay readable and tappable while
a sheet is open, for either hand; the body scrolls when the content is taller. Kept: the rail follows the hand only
(D-37 as amended: tools under one thumb, stall card under the hand's thumb); portrait bottom sheets, ≥ 720 px
portrait side sheets and the menu's settings sheet are unchanged. Swipe-to-close now follows the end side in a
landscape game too (`sheets.ts`). The D-45 camera focus measures the sheet's layout rect, so the subject moves
into the free area on the start side without code change (checked: m1 "why" farm, m7 castle). Screens
`docs/shots/hud5-*.jpg` (before / after: 915×412 right hand, left hand and `ar`, 412×915, 904×1000, Flip, Flex):
0 console errors, no target under 48 px. Rejected: starting the sheet under the contract (≈ 150 px left on 412 px
with the rail); folding the contract to its seal while a sheet is open (hides the contract the BACKLOG item wants
readable, and moves the tutorial anchors). Also (frame-cost item 3, not a rule): `rankStalls` runs once per tick,
applied command or selection change (`StallRanking`), not every frame. (decided)

**D-56 — On-device benchmark as a hidden second Vite entry (`?debug=1&bench=device`).**
Owner's decision (2026-11-02 23:55): the WebGL benchmark from `gpt/device-bench-22` ships as a hidden page. Kept
from the branch: `tools/device-bench.{html,ts}` (no network, no workflow files; fixed 3 × 60 s camera script at
×4 on the production `GameLoop` with `benchWorld(n)`, JSON export by clipboard or download) and
`vite.bench.config.ts`, a second build that writes only `dist/tools/device-bench.html` plus its own chunk
(`emptyOutDir: false`). `npm run build` runs both, so the APK carries the page; `vite.config.ts`, `index.html`
and every player-facing screen are unchanged and nothing links to it. Entry: `src/main.ts` redirects before boot
only when `debug=1` **and** `bench=device` are both present. The branch's `src/render/view.ts` changes (textures
per quality, ultra DPR cap 3, `quality !== 'low'`) were already on the base and were not re-applied. The page's
copy is Polish only (debug tool, outside i18n by design). Rejected: a menu or settings toggle (player build
change), a third Vite entry in the main config (changes the player build's manifest). (decided)

**D-57 — Valley chronicle wired to the UI; the recorded list is UI-owned (localStorage per ledger), not state.**
The gpt-51 proposal (`src/sim/proposals/chronicle.ts`, 30 entries, texts `docs/content/chronicle.md`) is pure:
`checkChronicle(state, done)` returns newly reached entries and "the caller owns the done IDs". Wired now without
any sim change: `src/ui/chronicle.ts` keeps the recorded IDs per valley ledger in `localStorage`
(`marchia.chronicle.<slot>`, best effort); on entering a valley game it adds silently everything the state already
satisfies (no toast storm after a load), then checks once per game second and shows one toast per new entry
("Kronika: …"). The pause menu of the free valley has "Kronika doliny (n/30)", opening a ledger page: recorded
entries with the seal and the scribe's sentence, the others by title in faded ink with "jeszcze niezapisane" (the
open titles double as gentle goals). A fresh ledger, "start over" and deleting the ledger clear its chronicle. Lost
storage forgets only entries the state no longer shows (momentary: winter, fleet size after selling a wagon).
No reward, no effect on play or hashes; 66 pl/en keys pending for the other languages. Open for the owner: move
the list into the save (envelope field or SimState with a migration — then it travels with Android backup / a
copied save), see HANDOVER „Decyzje na rano”. (decided, storage location open)

**D-58 — Far trees: a multi-view impostor atlas (8 azimuths), per-tier cell size (render only; P3 of D-41).**
D-41 baked one view per kind, so every distant tree showed the same face whatever its yaw and the camera
orbit, and the near→far crossfade swapped a rotated model for an unrotated card. Now `bakeTreeBillboards`
renders each kind from 8 azimuths at the same 30° elevation (`BB_VIEWS`, atlas columns = kinds, rows = views);
the camera direction in the tree's own frame (`bbLF`, already in the card shader) picks the two nearest views.
High/ultra blend them (`TREE_BB_BLEND`: 2 × albedo + 2 × fine-mip albedo + 2 × normal samples, was 2 + 1);
low picks one of the two per pixel, dithered by the blend weight (same 2 + 1 samples as before). Views are baked
row by row into a small 4× MSAA target and copied into single-sample mipmapped atlases, so the big atlases
carry no MSAA buffers. Cell width per tier, re-baked on a tier switch: low 128 px (2 × 7 MB; low caps DPR at
1.25), high 224 px (2 × 21 MB), ultra 256 px (2 × 28 MB) — before: 2 × 1.7 MB textures + 2 × 5.2 MB MSAA
renderbuffers at 256 px. Bake: 80 small renders + 16 copies, once at the first frame. Draw calls and triangles
unchanged (m1 412×915 dpr 2: high near/mid/far/copse 57/48/44/56 calls, 470k/305k/256k/294k tris; low
57/38/40/51, 258k/244k/239k/238k — identical before/after). Not done: the second near variant is not baked
(the card always shows variant 0; +1 atlas row set per variant = 2× memory). Shots `docs/shots/night2-trees-*`.
(decided)
*Amendment 2026-11-03 (owner decision 5):* high now bakes the low-size atlas (128 px cells, 2 × 7 MB =
14.0 MB measured by `view.stats().treeAtlasMB`, was 2 × 21.4 MB = 42.8 MB at 224 px); the full 256 px atlas
(55.9 MB) only on ultra. Reason: the Fold WebView shares GPU memory with the 4× MSAA canvas, and 224 px vs 128 px
cells are hard to tell apart in the far band (cards cover ≤ ~60 px on screen). Draw calls/triangles unchanged
(m1 412×915 dpr 2 high near/mid 55/40 calls, 472k/303k tris).

**D-59 — Water edge and bridge detail (render only).** Water shader: on high/ultra (`uDetail`) the waterline laps
up to 5 cm up the bank and back (slow, out of phase along the river) and a second thin foam line drifts in and
fades; on every tier a wet strip (0.3 m above the waterline, darker and catching a little sky) is drawn by the
water mesh itself (its quads already reached 0.35 m up the bank, so no new geometry). Bridges: bank-end pieces
where a run meets land (`bridgeEndParts`: wood — plank ramp down to the road, sill and crib logs, splayed wing
logs, heavier end posts; stone — splayed wing walls continuing the parapets with coping and a terminal block, a
cobbled ramp, a footing), wheel-guard logs on the wooden deck, a string course and dressed spandrel blocks on
the stone spans (the fieldstone texture alone read as smooth grey at game distance). Piles and piers get a
foam collar and a short broken wake downstream (+x, as the water shader's current) — one transparent mesh,
one draw call for all bridges, discarding empty texels. Cost: +1 draw call on every tier when a bridge exists;
triangles per 4 m segment wood 536→560, stone ≈1100→1312, +348 (wood) / +676 (stone) per bank end; m1 bridge
view high 54→55 calls, 351.6k→352.4k tris. Shots `docs/shots/night2-bridge-*`. (decided)

**D-60 — Contract progress you can feel: delivery tags at the castle gate, a flash on the waybill line, three
milestone notices (UI only).** BACKLOG P2 "10-minute session" (visible delivery progress; countdown with hope).
`Markers` compares the castle's contract goods frame to frame; a rise shows "+N" with the good's icon on the slate
ETA plaque just above the castle gate (where the wagon hands over; the castle's pin anchor tops the keep, mostly
under the waybill), one tag per good, at most three stacked, 180 ms in, 1.3 s held while drifting up 24 px
(linear), 220 ms out; first sight / load / restart only seeds the counts. The waybill line of a good that rose
flashes once (240 ms). `Hud` shows one notice per milestone while the contract runs: half the goods in the castle
("Połowa kontraktu w zamku: 36/50"), two minutes and the last minute before the deadline now due (per tranche),
each with the units still missing — milestones already passed when the HUD first sees the contract stay silent.
Reads state only; no sim change, hashes untouched. Not done from the backlog entry: the seal-press animation
before the end letter and a "hurry" music mood (owner taste; app flow), a delivery sound. Keys `contract.half`,
`contract.twoMin`, `contract.lastMin` (pl/en, PENDING_KEYS). Shots `docs/shots/night2-delivery-*`,
`night2-half-*`. (decided)

**D-61 — Building detail pass: thatch ridges, roof wear, daub weathering, ladders (render only).** For the
commonest thatched and framed buildings (farm, mill, bakery, stable, fisher, malthouse share `thatchRoof` /
`house`): the ridge saddle is pinned with hazel liggers (two rods along each slope under the roll, crossed spars
between them — the stitched ridge of a real thatch, the one detail that reads at game zoom); a repaired patch or
two of paler newer straw in the thatch colour; grey-green lichen on split-shingle roofs, heavier toward the eaves
(woodcutter, sawmill, warehouse); limewashed daub gets rain-splashed mud above the plinth (the kit's base dirt is
measured from the ground, so walls on a tall plinth — the mill's upper storey — stayed spotless), grey run-off
streaks under the wall plate and patchy fresher limewash; a ladder to the mill's hoist window and against the
farm granary, a bench under the farmhouse window. All in vertex colour or small extra geometry in the merged
building meshes: no new draw calls, no new textures. Triangles (model): farm 8220→9496, mill 5612→6292, bakery
5290→5906, stable 3888→4720, fisher 5934→6430, malthouse 5848→6320; others unchanged. Note for screenshot
scripts: the high-tier textures arrive ~10–20 s after load under SwiftShader — earlier "untextured" shots
were taken too early. Shots `docs/shots/night2-bldg-*`. (decided)
*Amendment 2026-11-03 (owner decision 8):* the ridge liggers are softened — the crossed spars (both diagonals
every 0.42 m, `#5e5038`) read as a truss/checker up close. Now one spar per ~0.9 m bay, alternating direction (a
loose zig-zag), rods and spars thinner (0.02 m) and darker (`#4a3f2c`, close to the shaded straw), sunk 8 mm
deeper into the thatch. Fewer triangles (bakery 5906→5498, mill/farm/stable similar). Close-up before/after:
`docs/shots/day1-ridge-before-after.jpg` (model preview view `ridge`).

**D-62 — Measured layout check; pins under the HUD fade; a bottom sheet folds the waybill.** `npm run layout`
(`tools/layout-check.mjs`) opens menu, settings, HUD, the why-sheet, the wagon sheet, the build tool, the M7
waybill, the end letter, the castle and market sheets, the free valley, the opening and rank-up letters at 412×915, 915×412, 904×1000, 360×740 and the Flip cover 360×380, in pl/de/ru/ar and
the pseudo-locale, and measures instead of eyeballing: action controls inside the viewport (or in a scroller that
is), no intersection between the floating HUD pieces, the sheet and the world pins (a component's own badge or
ribbon hanging over its edge is not a component), targets ≥ 48 px, no text spilling out of its box or clipped,
no sideways scroll, no console errors. A positive control injects five known-bad CSS rules first (overlap, small
target, overflowing label, rail pushed off-screen, a veil over the tool cards); a check that stays green there fails the run. Default map is
the Canvas2D view (same DOM, ~10× cheaper under SwiftShader, full matrix ~8 min); `--three` measures over the 3D map.
Fixes from its first run: (1) stall pins that fall under a HUD panel or the sheet fade out (150 ms) and take no
taps — before, the top of a pin peeked out behind the waybill/speed bar and its taps hit the panel; the app
refreshes the occluder rects 4×/s and on every sheet change (render-only, the sim never sees it). (2) While a bottom
sheet is open (portrait, not a side sheet) the waybill folds to its seal, so the sheet's subject has map to be
framed in (D-43): on 412×915 the why-sheet and the expanded waybill used to leave no map at all and the bakery sat
under the waybill; the player's own fold preference is untouched; while folded this way the seal opens the castle card (as on the
Flip cover), so the tutorial's "tap the waybill" step still takes one tap. (3) The framing
treated the empty `.topbar` box as the top obstacle; its pieces (menu, chips, speed) are the obstacles now.
(4) Flip cover: with a sheet open the HUD strip is hidden (it only peeked out above the full-height sheet).
(5) Arabic one-word link buttons in the wagon sheet got `min-width: 48px`. (6) A second pass added a "covered" check (every
line of text and every control's middle, hit-tested with all elements hit-testable: the first element that paints
there must be the element itself) — it found the waybill ribbon (z-index 1 inside the HUD layer) painted over the
end letter's heading whenever the heading wrapped (de/pl on 360 px); each UI layer (`#markers`, `#hud`, `#menu`,
`#sheets`, `#tutorial`, `#overlay`) is now `isolation: isolate`, so DOM order alone stacks the layers. (7) Five more
screens (castle sheet M5, free valley, market sheet, opening letter, rank-up letter) found: in landscape the
season notice sat on the folded valley-news card (same corner) — notices now hang under the card (`--ev-b`,
measured with the top cluster; a fixed card has no offsetParent, which had hidden it from the measurement); on the
Flip cover the notice moves to the bottom edge so it never sits on a toast; on tall unfolded screens (904×1000,
side sheet without landscape) the game sheet started at the top edge over the chips and speed bar — it now starts
under them like the landscape sheet. (8) The tutorial scene (note ≤ 3 lines from 360 px, checked) showed the Flip-cover arrow running
through the "open the phone" hint: the hint hides while the tutorial arrow shows, and the note avoids it. (decided; (2) is a behaviour change —
listed for the owner in HANDOVER, revert = drop `syncSheetFold()`)

**D-63 — Evening ambience loop: constant gain and a calmer excerpt; one-shots preload, a slow first play is
queued.** The audit (docs/research/2026-11-02-audio-mix.md) measured a +5.8 dB bass step at the `ambient.evening`
seam. The crossfade itself was sound-continuous (raw render: second difference at the seam 0.2× p99.9); the step
came from the encoder stage: `loudnorm` with `linear=true` silently falls back to *dynamic* gain when the linear
offset would push the true peak over -6 dBTP, and the gain drifted 26.6 → 23.9 dB across the 30 s file, so the
loop's end and start were boosted differently. `tools/process_audio.py` now detects that case and applies a constant
gain (`volume` + the same `alimiter` used for SFX); tracks where linear loudnorm is feasible get the old filter
string unchanged. The excerpt moved from 0 s to 198.5 s of the same CC0 wind recording (searched every 0.25 s: the
first 30 s swing 20 dB per second in the bass, this window ~5 dB and meets itself within 0.3 dB). Result:
200 ms tail→head 0.56 dB (in-file median between neighbouring 200 ms windows 0.76 dB), -23.5 LUFS, OGG and M4A
seams clean; only that one file was re-rendered (`--track-id ambient/evening`), provenance updated, `--check`
green. The new window has less sub-60 Hz rumble (31 % vs 90 % of energy) — on a phone speaker it is audible at
all now; the owner should listen once on headphones. `AudioEngine`: after the unlock gesture every one-shot
(sfx + ui, ~300 kB) is fetched and decoded in sequence (ambience/cart loops stay on demand: ~10 MB decoded each).
A `play()` that arrives while its buffer is still loading is queued — one pending request per id, later calls only
update its position/gain — and plays when the decode finishes instead of being dropped after 850 ms; only a request
more than 4 s stale is dropped (the moment on screen has passed). Tests: `tests/audio-preload.test.ts` (fake Web
Audio). Also from the audit: `sfx/load-stone` starts 40 ms later in its source (the file opened with 55 ms of
silence, so the strike lagged the load animation; onset now ~25 ms). Re-rendering a bundled Freesound source used to
overwrite its provenance record with nulls (preview URL, licence, download date): the pipeline now merges with the
previous record. (decided)

**D-64 — Far wagons (LOD1) cast no shadow on any quality tier; draw calls counted at the GL level.**
`WagonsView.setShadows(near, far)` was called (`applyQuality`) with `far = high`, so on high/ultra the far rig
(3 meshes) drew in the shadow pass too. Beyond `lodDist` (120 m high, 75 m low) a wagon's shadow is a few texels of a
2048 map fitted to up to 320 m, and comparing the frames side by side shows no visible difference
(`docs/shots/night4-wagon-far-shadow-on-off.jpg`). Measured with `tools/wagon-shadow-calls.mjs` (sandbox, 100
wagons, camera 200 m, 72 on the far rig, SwiftShader): **90 → 87 GL draws per frame, −14.9 k shadow-pass
triangles**; the main pass is unchanged (47). Note for future measurements: `renderer.info.render.calls` (the
`stats()` / `?perf=1` number) is reset by three r181 *after* the shadow pass, so it never counted shadow draws —
the tool wraps `drawArrays/drawElements(Instanced)` instead. Cargo on far wagons keeps casting (shared instanced
meshes with the near rig; splitting them would add draws, not save them). (decided)

**D-65 — A quality switch links no shader inside a frame.** Switching high ↔ low in Settings linked 4 (then 3,
then 2 on every later switch) programs inside the frame (`linkProgram` counted inside `app.frame`, m1, SwiftShader).
Two causes: (1) the new tier's variants (leaves/needles alpha-to-coverage, the billboard `TREE_BB_BLEND` define,
`TERRAIN_LOW`) compiled on first draw; `setQuality` now builds detached clones in the target state
(`treeQualityVariants`, `Terrain.qualityVariant`), compiles them through `ShaderPrewarm.prewarmMaterialSwap`
(the texture-swap path) and applies the tier once they are linked (a generation counter drops a superseded switch;
no world/pre-warm yet → immediate, as before). The terrain hooks read `this.userData`, not the closure's material, so
a clone keys and builds its own variant. (2) The far-tree atlas re-bake per tier disposed its bake and copy
materials, re-linking them every time; they are kept for the session now (5 small programs). Result: 4/3/2/2 →
**0/0/0/0** in-frame links over four switches; the tier lands a few hundred ms later. (decided)

**D-66 — "Naprawa" for a stranded output: build a granary next to it (UI only; owner decision 2, 2026-11-03).**
When the root of a building's cause chain is `OUTPUT_FULL.NO_DESTINATION` (no granary and no customer takes the
good — a full output whose customer still takes it chains on to the customer and gets no cure), `cureFor` returns
`granary`. In a world whose build list has the warehouse (free valley, mission VI) the "Dlaczego stoi?" sheet shows
"Postaw spichlerz −30" (disabled with the rank / silver reason when blocked); one tap closes the sheet, opens the
build tool and picks the granary with its ghost already on the closest valid site around the stalled building
(`siteNear`: rings up to 10 cells, the sim's pure `validatePlace`), so "Postaw" is one more tap. The rail's Buduj
button gets the same cure mark as Kup wóz / Droga. Missions without the warehouse on their build list get a hint
only ("połącz drogą spichlerz albo odbiorcę"). No sim change. Shots `docs/shots/day1-repair-*`. (decided)

**D-67 — Speed hint, never a speed change (UI only; owner decision 7, 2026-11-03).** BACKLOG P3 "speed as a tool":
while the game runs at ×4 and the worst stall is critical and has grown for 60 s of game time (~15 s real), one
toast says "Na ×4 przestój rośnie szybko: {name}. Zwolnij, żeby zdążyć go naprawić." (4.2 s, speed icon). Once per
stall — the same building with the same cause is never hinted again in that mission (`SpeedHint`, pure, reset on a
new world); ×1/×2, a minor or fresh stall, or a finished mission never hint. The speed is never changed for the
player (an auto-×1 was rejected: a hidden speed change confuses). Test `tests/speed-hint.test.ts`; shots
`docs/shots/day1-speed-hint-*`. (decided)

**D-68 — Valley chronicle in the save envelope; best seals and time per contract in a profile store (no sim
change; owner decisions 1 + 13, 2026-11-03).** Replaces D-57's localStorage list. (1) The envelope gets an
optional `chronicle: string[]` beside `state` (format stays 2: the field is optional, read leniently by
`envelopeChronicle` — missing, damaged or unknown items give [] / are dropped, never a load error; the save gate
still caps its size). Valley autosaves write `ChronicleLog.ids()`; a newly recorded entry triggers an autosave
(momentary entries are not lost). The META list omits it. Migration: on entering a ledger the old
`marchia.chronicle.<slot>` list is merged once and removed after the first save that carries it; contracts and
older saves have no field. State and its hash untouched (golden hashes unchanged). (2) IndexedDB v3 adds a
`profile` store (one record `{ id: 'profile', format: 1, best: { m1: { seals, ticks, at } … } }`), because a
contract's save is deleted at its end letter. `showEnd` records a won contract (`stars(world)`, `mission.endTick`)
in one read-write transaction; better = more seals, then less time; a lost contract is not a result.
`sanitizeProfile` drops damaged entries, an absent store/record reads as empty. The mission menu shows under a won
mission's subtitle three small wax seals (pressed = earned) and the best time; the row's accessible name says it in
words (`menu.bestAria`). Tests `tests/save-profile.test.ts` (old v2 database, old envelope, damaged profile,
localStorage migration); `save-robustness` opens its raw stores at the current version and fakes "newer" as v4.
Shots `docs/shots/day1-menu-*` (menu restyled right after, D-70). (decided)

**D-69 — End of a won contract: the castle's seal is pressed before the letter; a quiet delivery sound (UI +
audio only; owner decision 6, 2026-11-03; the rest of D-60's backlog entry).** `pressSeal` (src/ui/sealPress.ts)
dims the map and presses the kit seal (`seal-full`, 96 px — the sprite is 84 px at 3×, larger reads soft): 200 ms
down from 1.45× with a slight turn (ease-out, no overshoot, no spring), a dark wax rim spreading once (220 ms), held
to 1.2 s, then the end letter. A tap or any key skips straight to the letter; reduced motion shortens it to 0.5 s;
a world change cancels it. The wax-seal sound (`contract.won`) already plays on the win. Lost contracts go straight
to the letter (no seal to press). Delivery sound: each contract good handed over at the castle plays
`contract.delivery` — the existing CC0 `sfx/unload-sack`, non-positional on the UI bus at 0.26 with a 1.2 s cooldown,
so it is heard wherever the camera is (the positional unload stays). No new file (`process_audio.py --check` PASS).
Music "hurry" mood: still after the playtest. Shot `docs/shots/day1-seal-press-412x915.jpg`. (decided)

**D-70 — Main menu on the painted kit (UI only; owner request 2026-11-03 from a phone screenshot).** The start
screen was the last screen in the old style (fibre parchment strip, deckled clip, iron pin, diamond bullets). Now:
the lily frame (`frame-sheet-dim`, as the sheets opened from the menu) holds the list, inset from the safe area; the
title sits on the kit wine ribbon with the subtitle under it (beside it on short landscape screens); each contract
row has a brass medallion (`badge`) with its numeral — the numeral leaves the title text when the title starts with
it (the accessible name keeps the full title, subtitle and best result) — and a won contract's medallion is pressed
wax (`seal-full`); the best seals and time from D-68 sit under the subtitle; Wolna dolina has the farm glyph in its
medallion; Continue is the wine kit button with what it continues, Settings the parchment kit card at the foot (still
the last `.menu-item`, which the layout and screenshot tools click). The list scrolls inside the frame with the fade
at its foot on every screen; rows ≥ 48 px (56 normally); two columns on short landscape and the Fold in Flex mode;
RTL mirrors through logical properties. Fonts unchanged (Grenze Gotisch titles, Alegreya Sans text); the live
valley scene stays behind. `npm run layout` over menu/settings/missionsave/valley scenes (75 jobs, all views) and
`--quick` green. Before/after `docs/shots/day1-menu-412x915.jpg`, `day1-menu-915x412.jpg`. (decided)

**D-71 — Yard piles follow the stock (render only; owner decision 15, 2026-11-03).** Each producer model has a
`yard` spot (model space point + turn); `BuildingsView` places it like the yard worker and `WagonsView` draws the
building's first output good there each frame as up to one wagon load (`min(stock, cargoSlots)`: 6, stone 4) of the
same `cargo-*` instanced units the wagons carry, laid out as on a wagon bed set down on the ground (`yardPileLocal`).
A full yard (`OUTPUT_FULL`) is therefore visible without a tap; an empty yard shows nothing. The static output piles
that would now double the stock are gone (woodcutter log pile, the sawmill's plank stack by the gate, the farm's
grain sack, the mill's flour sacks, the quarry's block stack by the gate, the charcoal sacks, the malt bags); props
of inputs or tools stay. No new meshes, materials or textures: the piles reuse the 11 cargo instanced meshes (wagon
cargo is pushed first, piles never overrun the instance buffers), only within the wagon LOD distance and the
frustum. Draw calls: a pile adds calls only when no visible wagon carries that good (the good's cargo mesh becomes
visible: +1–4 incl. shadow), bounded by the cargo meshes already in the budget; m1 high 412×915 at ~34 m:
sawmill 51→52, farm 55→56, mill 55→56, woodcutter 49→53 (wood logs: 2 parts + shadows), triangles +0.1–3k.
Test `tests/yard-piles.test.ts` (every producer has a spot; a full load stays on its footprint); model preview shows
full piles. Shot `docs/shots/day1-yard-sawmill-off-on.jpg`. Not done: the warehouse (many goods) and the castle.
(decided)

**D-72 — The pressed seal is a vector redraw of the kit seal (UI only; day-1 note).** The seal-press cue (D-69)
showed the kit `seal-full` (a 28 dp sprite, 84 px in the @3x file) at 96 CSS px — about 3.4× the file on a
2.6–3 dpr phone, visibly soft. Shrinking the cue to the sprite (28–32 CSS px) would lose the moment; the
`seal-alert` sprite (72 dp) is the HUD alarm and would mix the meanings. So the press draws
`public/assets/ui/kit/seal-press.svg`: the same seal redrawn as vector (gold wax rim with ten lobes, the dark
squeezed ring with gold drops, the red disc with a soft wax gradient, eight cream impressions), colours taken
from the sprite. Sharp at any size and dpr, 7 kB, no new request on the hot path (shown once per won contract).
The small seals elsewhere keep the bitmap kit sprites at their native sizes. Comparison at 2.625 dpr
`docs/shots/day2-seal-press.jpg` (left the vector, right the old sprite at 96 px). (decided)

**D-73 — Contract numerals stay Roman in every language (UI; day-1 question).** The menu medallion repeats the
numeral each contract title starts with, and all 17 translations (Arabic, Hindi, Japanese, Chinese … included)
write the titles as "I. …", "XII. …"; the save-slot margin and the valley books use the same numerals. A locale
digit in the medallion next to a Roman title would show two numbering systems at once, so the numerals are kept
deliberately as part of the contract's name (like a chapter number), not as a count to localize. If a translator
changes a title to another form, the medallion still shows the Roman numeral and the title stays whole (the
existing `startsWith` rule). Comment at `ROMAN_MISSION` in `src/ui/menu.ts`. (decided; owner may overrule —
the change would be the titles and the medallion together)

**D-74 — Yard pile spots checked on all 10 producers (render only; day-1 question).** A geometric check (now in
`tests/yard-piles.test.ts`) samples every model triangle every ~5 cm and fails when any point above the ground
lies inside a pile unit, when the pile reaches within 5 cm of the footprint edge, or when it stands in the 2.2 m
wagon lane of the road that ends at the gate (last 2.5 m inside the footprint). It found: farm sacks touching the
step of the house (moved 0.5 m out), mill sacks in the doorway and on the footprint edge (moved to the left of
the door, clear of the lane), bakery baskets in the road mouth (moved 0.7 m right), fisher creels on the edge,
charcoal sacks in the hut's base (hut 0.4 m back, sacks to the front-right), malt bags in front of the door and
into the firewood (moved to the open front-right corner), brewery barrels in the lane (moved 0.55 m right), and
the quarry's guy rope reading through the block pile from the game camera (pile 0.35 m left). Woodcutter and
sawmill were clear. Model preview: `yard-<kind>` (game-camera close-up with a road stub at the gate) and
`yardtop-<kind>` views. Before/after `docs/shots/day2-yard-piles-before-after.jpg` (mill, quarry, charcoal,
malthouse). (decided)

**D-75 — The last chamfered parchment surfaces move onto the kit cards (UI only).** After D-43/D-53/D-70 the
only surfaces still drawn with the old clip-path chamfer and a flat fill were the why-chain links, the goods
chips (Needs / Produces, castle order), the pace rows, the build shelf cards and the ghost / draft tags over the
map — in a screenshot they read as plain rounded rectangles next to the painted tools. They now wear the same
`card-normal` sprite as the rail tools and secondary buttons (pressed sprite on tap; the building's own first link
`card-active`; a locked build card or market chip the same card under a light hatch — the dark `card-disabled` sprite swallowed the names). The cause link, an empty input chip, the pace
bottleneck and a bad placement take `panel-alert` (its wine edge marks "this one"), drawn on `::before` so the
edge flips to the start side in RTL. Text, sizes, hit areas and layout unchanged; no new sprites. Layout
`--quick` and why/build/castle/valley in pl+ar green. `docs/shots/day2-kit-cards.jpg` (why sheet before, after,
placement with the shelf). (decided)

**D-76 — Market & rank sheet on the kit (UI only).** The free valley's market sheet still had the old diamond
bullets, thin flat bars and plain bordered building chips. Rank requirements now carry the kit wax seal (empty,
pressed once met — the same mark as the contract seals), progress and price saturation use the brass groove
(`kbar`) of the HUD plaque, and the building chips wear `card-normal` (locked: the same card under a light
hatch, rank tag kept). Text and order unchanged. `docs/shots/day2-market-kit.jpg` (before / after). (decided)
