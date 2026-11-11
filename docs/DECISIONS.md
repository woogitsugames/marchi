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

**D-77 — The mill loop keeps its rhythm across the seam (audio only; BACKLOG P3 from night 4).** `work.mill`
(`sfx/mill-wheel`) was 5.5 s = 9.5 paddle periods (0.58 s), so the loop seam put two strokes 0.28 s apart — the
"breath" heard in the audio report. The Freesound source is not reachable from the container, so the shipped
loop was re-cut instead: decoded (OGG and M4A each from its own file), 9 periods = 5.218 s taken from the
continuous looped signal, the head crossfaded 0.25 s (raised cosine) from the tail's continuation, which lands
on the same stroke phase, and encoded with the pipeline's settings (24 kHz mono, 28 kb/s, peak −6 dB kept).
Measured strokes now run 4.82 → 5.40 s across the seam (0.58 s, the period). `audio_sources.json` says
`seconds: 5.22` for a future render from the source; provenance hashes updated; `process_audio.py --check`
PASS. `cart.dirt` (irregular 0.3–0.45 s hits, no gap at the seam) needs nothing; `cart.cobble` has one
0.61 s gap at the seam among 0.3 s hits — left as is (irregular cobbles; a re-cut would need the source). (decided)

**D-78 — Pace forecast for orders in tranches (UI; BACKLOG P3 from D-38).** Missions V and VI (orders in
tranches) had no pace line: the forecast only knew one order with one deadline. Now `contractForecast` takes an
optional need (the castle must hold the sum of the tranches up to the one now due, `trancheNeed`), and
`trancheForecast` gives the forecast of the tranche now due — read against that tranche's deadline (against the
contract's once it is missed). The waybill shows "Przy tym tempie: gotowe za M:SS" / "spóźnienie M:SS" and the
bottleneck's supply under the current tranche; the castle card shows the pace rows for it (no seal row — the
seals belong to the whole order — and no "for N seals you need" aim). A tranche is forecast only once the
two-minute pace window lies inside it (from the start for the first): without that gate the pace of the tranche
before (another good, a sawmill just restarting) said "late" in 18 (m5) and 14 (m6) of the 10-s samples on runs
that met every tranche; with it, none (test in `contract-pace.test.ts`). Until then the castle card says
`why.pace.waitTranche` (new key, PENDING_KEYS). Read-only on the state; hashes unchanged. The 2-minute window
tuning after the playtest stays open. `docs/shots/day2-tranche-pace.jpg`. (decided)

**D-79 — Yard piles at the warehouse and the contract castle (render only; continues decision 15 / D-71).** D-71
left the warehouse (many goods) and the castle without piles. A model may now list extra `piles` spots: the
warehouse shows its two largest stocks either side of the ramp (ties in goods order; its static barrels, crates
and sack are gone — they doubled or contradicted the stock), the contract castle one pile per ordered good
inside the order yard (up to three), filled by the share delivered (`round(stock/need × load)`, at least one unit
once something is there; a full pile = that good is complete). In the free valley the castle (market) shows
nothing. `yardPileGood` (WagonsView) picks good and amount per spot; same instanced cargo units, same LOD /
frustum / buffer limits and draw-call note as D-71. `yardPileLocal` now centres a load on its real ground
footprint (the barrels' unit geometry is off its slot: beer piles sat ~0.5 m off the spot); the brewery spot moved
0.15 m to keep clear of its rack. The clip test checks every load at the store / castle spots and that the spots
of one building do not overlap; a new test checks what each spot shows. `docs/shots/day2-castle-store-piles.jpg`
(m1 castle in game with planks and two baskets of bread delivered; preview of the warehouse). (decided)

**D-80 — The cobble cart loop keeps its rhythm across the seam (audio only; the open half of D-77).** `cart.cobble`
(`sfx/cart-cobble`) was 3.8 s with the wheel hits every 0.23–0.38 s, but across the seam the last hit (3.52 s) was
followed by the next real one 0.61 s later — the old crossfade had left only a faint hit (29 % of a normal one) in
the gap, heard as a stumble on every pass of a cobbled street. Re-cut from the shipped files (source still
unreachable), the same way as D-77: each of OGG and M4A decoded from its own file, the 3.514 s from 0.20 s taken
(11 hits; 3.514 = last hit + 0.31 s − first hit, so the hit after the wrap falls on the beat), the last 0.10 s
crossfaded (raised cosine) with the 0.10 s just before the cut start, so the wrap continues the signal it came from;
both crossfade halves lie between hits. Peak kept (−6.3 dB), pipeline settings (24 kHz mono, 28 kb/s). Measured
onsets of the decoded files: seam gap 0.32 s (OGG) / 0.35 s (M4A, its own encode) among 0.23–0.38 s hits.
`audio_sources.json` says `seconds: 3.51`; provenance hashes and ASSETS.md updated; `process_audio.py --check`
PASS. (decided)

**D-81 — Beer barrels lie on the wagon bed and in their pile (render only; bug).** Each barrel unit got a random
"roll" as the yaw of the same Euler that laid it on its side (`trs(…, π/2, r, 0)`, order YXZ: the yaw is applied
last, about the world vertical), so instead of turning the staves about the barrel's own axis it swung the whole
barrel in a random direction from its slot: on the wagon the six-barrel load reached x 1.11 m (side boards at
±0.64) and z −1.86, barrels hung over the side, in the brewery yard pile and in the castle / warehouse piles they
lay askew in a heap. This is the "barrels' unit geometry is off its slot" of D-79. The roll is now a separate
rotation about the barrel's axis after laying it down; load bounds x ±0.61, z −1.44..0.25. The brewery yard spot
moved 0.1 m (x 1.6 → 1.5) so the straight two-by-two pile clears its rack (clip test). Model-preview view
`beercargo`. `docs/shots/day3-beer-barrels.jpg` (wagon and yard, before / after). (decided)

**D-82 — A won contract's seal is pressed onto the waybill, not over the middle of the screen (UI only).** The
first version of the seal moment (owner decision 6) pressed the seal in the middle of a dimmed screen — a generic
"achievement" stamp that had nothing to do with the document the player had watched all game. Now the seal lands
on the waybill itself: the map and the rest of the HUD dim around a lit window over the waybill's parchment
(`box-shadow` spread from a transparent box in the overlay layer, so the HUD layer underneath keeps its own pixels
and nothing is cloned), the seal comes down 260 ms (scale 1.5 → 1 → 0.96, rotate −12° → −5°, shadow from lifted to
tight on the paper — monotonic, no overshoot), the squeezed wax rim spreads once, and the impression rests on the
goods until the letter at 1.2 s. It is placed below the waybill's head (earned seals and the clock stay readable),
at 64 % of the line (36 % in RTL), size 64–96 px by the body height (landscape 64 px). A folded waybill gets the seal
on its medallion. The waybill's three seals switch from the forecast to the seals actually earned at the moment of
winning (they showed three empty seals). Sound: the existing `contract.won` (`sfx/wax-seal`) already fires on the
tick of the win from the audio bindings — kept there (tests/audio.test.ts) rather than moved into the UI.
`prefers-reduced-motion`: no cue at all, straight to the letter (it held a collapsed stamp for 0.5 s before). One
tap or key still skips. Lost contracts unchanged. `docs/shots/day4-seal-*.jpg`. (decided)

**D-83 — Mud on the wagon card: one plain comparison with cobbles, both against the normal (dry dirt) pace
(BACKLOG H4).** The pace row said "mud — 52% of normal speed; cobbles help": the player learnt the loss but not
what paving would buy. It now reads "Błoto: 52% prędkości — na bruku 114%" / "Mud: 52% speed — on cobbles 114%"
(thaw: "Roztopy: …"). Both numbers share one baseline — the wagon's dry, flat pace on the stretch it is on — so the
cobble figure is honestly above 100 % (cobbles 4.8 vs dirt 3.6, ×0.9 in rain; the thaw does not soften them)
and carries the same grade and load factor as the mud figure. Rejected: "on cobbles 100 %" (percent of each
surface's own dry pace) — it hides that cobbles are also faster in dry weather, which is the reason to pave. The
number comes from a read-only field `Slowdown.paved` in `wagonSlowdown` (src/sim/diagnose.ts; no state, no hash
change). The row is ink-coloured, the status line stays the driving status and never turns red; a test checks a
muddy wagon never carries a stall status (`tests/mud-pace.test.ts`). Percentages through `fmtPercent` (Intl);
`dir="auto"` on the text, so the English fallback reads correctly in RTL until the translation round. New keys
`wagon.mudVsCobble`, `wagon.thawVsCobble` (PENDING_KEYS); `wagon.slowMud`/`wagon.slowThaw` are now unused
(left for the dictionary clean-up, like `hud.coins`). `docs/shots/day4-mud-*.jpg`. (decided)

**D-84 — Full storage says its count, its cap and its effect (BACKLOG H5; UI only).** "Pełno zboża — brak wozu
do odbioru" named the state but not that the yard is at its limit, and "Spichlerz pełny" had no numbers; the
output chip with 8/8 sat at the bottom of the card. Now, right under the status (or the chain), a panel-alert
box (the kit's wine-edged panel, mirrored in RTL) reads "8/8 zboża — brak miejsca na nowy towar" (a yard short of
room for one more batch: "7/8 … — następna partia (2) się nie zmieści") or, for a granary, "12/12 — brak miejsca
na odbiór" (held + already promised, the same count the sim uses for STORAGE_FULL). Below it the effect, in the
chain's terms: "Skutek: produkcja stoi, dopóki towar nie wyjedzie." / "Skutek: spichlerz nie przyjmie nic
więcej.", then the buildings that suffer, one tap each (48 px): those whose cause chain runs through this one
(a producer refused by a full granary) and, for a full yard, the customers short of this very good meanwhile
("Na drewno czeka: Tartak" — the wood lies here while the sawmill waits for a wagon). A building whose chain
ends at a full one shows the same count with that building's name as a link. Nothing is promised: the existing
cure section (buy a wagon / build a granary only where the mission lets you build one, otherwise the hint) stays
the only action. Pending keys read the English fallback as `lang="en" dir="ltr"` (new `translated()` in
i18n/index.ts), as the codex does. Keys `why.full.*` (PENDING_KEYS). `docs/shots/day4-full-*.jpg`. (decided)

**D-85 — A full yard nobody needs is a calm surplus; a fleet held at a bridge is the cause of "no wagon"
(diagnosis audit 2026-11-03, fixes 1 + 2; UI and read-only diagnosis, no hash change).** The audit found
`OUTPUT_FULL.NO_WAGON` behind 27 % of all worst-stall samples, waxed critical in 74 % of them, while "Kup wóz"
cleared it within 60 s only 11 % of the time: the dispatcher hauls a surplus to the granary last, so the new
wagon takes a more urgent job. A consumer actually waiting for the good was there in 6 of 140 samples.
Now a read-only `outputSurplus()` (src/sim/diagnose.ts) calls such a yard **SPARE** when no consumer waits for
the good (NO_INPUT / NO_WAGON / WAITING_UPSTREAM on it), the contract castle holds its whole order of it, and no
granary asks for road stone by the dispatcher's own rule (a reserve gap of at least one full load, 4 stone —
the audit's estimate used "any gap"; we follow the dispatcher, so a calm card never hides a run the dispatcher
would make. In m8 the granary's gap is 6 ≥ 4, so the quarry stays a real "no wagon" stall — see D-90). A SPARE yard is a calm stall
(minor pin, never wax), the HUD card says "nadwyżka, nikt jej teraz nie potrzebuje", the sheet replaces "Kup
wóz" with one plain line ("Nadwyżka: nikt teraz nie potrzebuje zboża, poczeka na placu. Nowy wóz tego nie
przyspieszy.") and the wagon tool is not highlighted. In the free valley the market still buys it: **MARKET** —
calm (minor, no wax) but the wagon cure stays, since three wagons cleared it there in half the samples (the
audit's section 5 wording; its section 4 estimate left the valley unchanged — we chose the minor pin because
surplus for sale is an opportunity, not an alarm).
Fix 2: in the player's chain (`explainBuilding(..., customers = true)`; the sim's ledger chain is untouched),
NO_WAGON.ALL_BUSY and OUTPUT_FULL.NO_WAGON go on to the nearest held wagon (BRIDGE_CLOSED / BRIDGE_JAM /
NO_ROUTE) when at least a third of the fleet is held. The existing ice hint, jam hint and road fix then apply
by themselves, and `cureFor` stops at a held wagon (a new wagon would wait at the same bridge). The jam hint now
shows for a jammed wagon anywhere in the chain, not only at its end (a jam's chain ends at the wagon it waits
for). Threshold one third: below it the fleet still moves and "every wagon busy" is the honest reading.
Keys `fix.surplus`, `cause.surplus` (PENDING_KEYS). Tests: `tests/diagnosis-audit-fixes.test.ts`, new reads in
`tests/determinism-reads.test.ts`. (decided)

**D-86 — "Co to znaczy?" explains the last stall of the chain (diagnosis audit 2026-11-03, fix 4; UI only).**
The fold took the chain's last link. In 33 % of worst-stall samples that link was no stall at all — a producer
that is WORKING, a wagon TO_PICKUP / TO_DROPOFF / LOADING — so the player read "Produkuje — pozwól dokończyć
cykl" under "Dlaczego stoi?". Now `codexLink()` (src/ui/stallKinds.ts, pure) takes the last link that is a stall
(the same test `chainHtml` already used for the "przyczyna" tag, now shared as `isStallLink`), falling back to
the subject's own status. Same rule on the building sheet and the wagon card. No new text. `isWagonWait` moved
to stallKinds.ts (re-exported by format.ts) so headless tests can use it. (decided)

**D-87 — A full granary points at the granary to link, or stays calm when another has room (diagnosis audit
2026-11-03, fix 3; UI and read-only diagnosis, no hash change).** `STORAGE_FULL` offered nothing in 100 % of the
audit samples, though in m6/m12 a large granary without a road stood next to the full small one (2 silver of
road solves the mission), and after the lesson the small granary stayed a waxed worst stall (m6: 94 % of the
time) while the large one had room. A read-only `granaryRelief()` (src/sim/diagnose.ts) now answers, in this
order: **ROOM** — another granary on the roads, reachable from this one, has room (held + promised under its
cap, the sim's own STORAGE_FULL count): a calm stall, minor pin, the card says "pełny, ale inny spichlerz ma
miejsce", the sheet "Inny spichlerz ma jeszcze miejsce — nowy towar pojedzie tam:" with one tap to it;
**UNLINKED** — another granary has no road: the player chain goes on to it, so the existing road fix (gap
finder) offers the cheapest link from the stable; otherwise `cureFor` = granary (a granary where the mission
lets you build one, else the existing hint). ROOM wins over UNLINKED: with room nearby the second link is not
needed. Keys `fix.storeRoom`, `cause.storeRoom` (PENDING_KEYS). (decided)

**D-88 — "Every wagon busy" with no source in reach of the stable is a missing road (diagnosis audit
2026-11-03, fix 5; UI only).** In mission I before the bridge the sim says NO_WAGON.ALL_BUSY as soon as both
wagons are out: while no wagon is free the dispatcher only asks whether the source reaches the customer
(component labels), not whether a wagon from the stable can reach the source. The card offered "Kup wóz",
which never helped (the farm is across the river). A read-only `busyOutOfReach()` (src/sim/diagnose.ts) finds
that case — sources of the good exist, none is in reach of any stable — and the UI treats it like
NONE_CAN_REACH: `cureFor` = road and the gap finder (`gapTarget`, moved from panels.ts to stalls.ts so tests can
reach it, re-exported) links the stable to that source (bridge included). Rejected: counting reachability from
the stable inside the dispatcher (cleaner, but it changes statuses in the state and so every golden hash; not
before the logistics playtest — BACKLOG). (decided)

**D-89 — A good whose order is filled is the end of the job, not a stall (diagnosis audit 2026-11-03, fix 6;
UI and read-only diagnosis, no hash change).** In m10 (and m9 after the lesson) the charcoal burner stood waxed
"pełny magazyn, nie ma dokąd wieźć" with "connect a granary" for 86 % of the card's time, after the castle
already held all the charcoal the contract asks for — pulling the eye away from the real lesson (a second
woodcutter). A read-only `contractFilled()` (src/sim/diagnose.ts): OUTPUT_FULL.NO_DESTINATION, the contract
castle holds its whole order of this good (the total, not only the tranche due) and no other customer takes it
(`outputCustomer`). Such a stall is calm (minor pin, never wax), the card says "zamówienie wypełnione, reszta
czeka", the sheet "Zamówienie na węgiel drzewny wypełnione — reszta zostaje na placu, nic nie trzeba robić."
and no granary cure or hint. Keys `fix.orderFilled`, `cause.orderFilled` (PENDING_KEYS). (decided)

**D-90 — Calm lines sit above the codex fold; m8's quarry left as it is (diagnosis audit follow-up).** The calm
lines of D-85/D-87/D-89 first rendered in the cure slot, below "Co to znaczy?", whose generic entry for
OUTPUT_FULL.NO_WAGON still says "Kup wóz": the player met the advice before the reason it does not apply. They
now sit right under the full-storage count (`.calm-hint`: plain ink, no alert colour, 48 px link). The codex
text is not specialised per calm case (it stays one entry per status, D-codex). m8 after the re-run: the quarry
is still a waxed "no wagon" stall in 70 % of samples and one more wagon clears it in 0/14 — the granary does
ask for stone (gap 6 ≥ load 4), but the new wagon takes the bread/planks inputs first (prio 1). An honest
answer there needs either a dispatcher change (hash) or a new reading ("W spichlerzu jest 12 kamienia —
wystarczy na bruk", audit 3G); left for the owner (BACKLOG). `docs/shots/day5-*.jpg`. (decided)

**D-91 — Mission I tutorial, step 5: the ghost is the part to draw, on screen, never under the note (day 6,
first-ten-minutes research P0; UI only, no hash change).** The research run reported the step "stuck": the
note still showed step 4 while `tutorial.current` read 5, and six drags along the ghost built nothing.
Reproduced with real Playwright input (`tools/repro-step5.mjs`, cold start, 412x915, mouse and CDP touch).
Verdict: **the stale text was a scripting artefact, the failed drag was a real bug.** (1) `current` changes
in the tap handler, the note on the next frame; under SwiftShader a frame takes ~1 s, so the script read 5
with step-4 text, tapped "Droga" a second time and toggled the tool off, which correctly sends the
tutorial back to step 4 — on a phone the frame is 16 ms. (2) Real: the ghost was `suggestConnection`'s whole
sawmill-gate-to-castle-gate route, 62 cells with both ends off a 412 px screen and mostly drawn over
existing road; the part to draw started under the note or off the left edge, and after step 3 the camera
is wherever the wagon card glided it (in one run the river was not on screen at all). Fix:
`crossingSpan()` (src/ui/tutorialCrossing.ts, read-only, tested headless) cuts the ghost to the new cells
plus one road cell at each end (17 cells in mission I); on entering step 5 the camera glides once so the
whole crossing, both road ends included, lies in the free part of the map (zooming out only if it does
not fit) — the tutorial's only camera move; the note treats the ghost as an obstacle. With these, the
same touch drag from the north road end to the south one builds the bridge and moves to step 6 (portrait,
three runs). Note placement (research P2): the note no longer slides (`transition: transform` removed —
it slid from its last spot across the waybill, which is what the step 1/4 shots caught), and the
no-free-band fallback picks the full-width slot that hides least (target and waybill weighted) instead of
"top of the waybill". Steps 2-3 scroll the chain link into a short card's view once (landscape 915x412:
the link lay below the fold, so no ring was drawn). `docs/shots/day6-tut-step5-412x915.jpg`. (decided)

**D-92 — The worst-stall card waits until the tutorial's re-check note (day 6, research P3; UI only).** During
notes 4-5 mission I's mill already showed "Najgorszy zastój: Młyn wodny: żaden wóz nie dojedzie" with the alarm
seal "3" — a third pointer beside the ring and the note, about the very problem the notes are teaching the
player to fix. Options: hide it until the tutorial reaches the stalls, or have a step point at it. Chosen:
while a tutorial note 1-5 is up, the HUD gets an empty stall list (card, alarm, cure mark on a tool, speed
hint, worst-stall pin), so nothing competes with the note; from note 6 ("check the castle again") or when the
tutorial ends, is skipped or times out, the card appears — and because `firstCritSeen` was not spent, it
appears with the usual one-time first-stall flash, which is the natural hand-over from the notes to the
stall card. Rejected: a seventh note pointing at the eye (m1.md caps the tutorial at six notes and 110 s; the
flash already says "here"). The sim and the ranking are untouched; only what the HUD is handed changes. (decided)

**D-93 — A won contract leads on; the cold-start menu says where to begin (day 6, research P4-P5; UI only).**
(1) The won end letter gets a wine "Następna misja" button with the next contract's title under it (missions
I-XI; XII and the free valley have none), above "Jeszcze raz" / "Do menu", which stay. It starts the next
contract with its opening letter; when that contract has an unfinished save, it goes through the menu's
existing ask sheet instead (D-36: never overwrite a save unasked). A lost letter is unchanged ("Jeszcze raz"
stays primary). (2) Until mission I is won, its row carries a small wine "zacznij tutaj" kicker and a rule on
its start edge (logical border, so it mirrors in RTL); nothing is locked or hidden — the brief's "everything
unlocked" stands. (3) "Ustawienia" moves out of the scrolling list into the frame's foot, so it is on screen
at 412x915 (y 839-887) and 915x412 without scrolling; it is still the last `.menu-item` for the tools.
(4) Mission I's subtitle no longer repeats its title: new key `menu.m1Sub` ("Przerzuć most przez rzekę i
zdąż przed śniegiem"); `menu.contractSub` stays for the other languages until translated. Keys
`contract.next`, `menu.startHere`, `menu.m1Sub` are in PENDING_KEYS. Not done (research idea): folding
missions III-XII into one row — the frame scrolls and the kicker gives the direction; left for playtest.
`docs/shots/day6-menu-*.jpg`, `day6-end-next-412x915.jpg`. (decided)

**D-94 — Free valley: workshops top up in loads of at least four (owner decision A, day 6; research
2026-11-03-partial-loads.md, rule "sb4").** In the free valley a workshop that still has input for a cycle (or
some on the way) asks for more of an input only once `min(load, TOP_UP_MIN = 4)` units fit; a starving one asks
at once as before. Contract missions are untouched — `topUpHold()` (src/sim/logistics.ts, read-only, also used
by the card) returns 0 outside `sandbox` — so every mission golden hash, the balance ladder and `npm run bot`
(m1: won 8.85 min, 2 seals, 26 silver, identical) stay as they were. **No state version bump:** the rule reads
only `stock`, `incoming` and the recipe; no new field, no migration (`STATE_VERSION` stays 8). An old valley
ledger simply starts sending fuller wagons after loading; ranks are latched in the state, so a ledger already
past a raised threshold keeps its rank.
Rank retune: research measured ranks 3 and 4 ~8 and ~11 min early (38.1 / 66.9 against the 40-50 / 70-90
windows). The suggested ~+10 % (2750 / 6600 renown) lands on the window edges (40.5 / 71.4 min) — one later
change away from failing — so ranks 3 and 4 go to **3000 / 7200 renown (+20 %)**, which puts them back near the
old pace with margin. Valley bot, `tools/balance.ts sandbox`:

| plan | before (base) | after (rule + thresholds) |
|---|---|---|
| decent, 150 min: silver earned | 17 188 | 19 706 (+14.7 %) |
| decent: ranks 1/2/3/4/5 (min) | 10.1 / 26.6 / 45.9 / 77.9 / 122.8 | 10.4 / 22.3 / 42.8 / 76.3 / 108.7 |
| decent: best flow | 208 sr/min | 225 sr/min |
| only wagons (5 more), 30 min: earned / rank 1 | 485 / 12.5 min | 446 / 12.7 min |
| 3 wagons + cobble, 30 min: earned / rank 1 | 474 / 12.7 min | 438 / 13.5 min |
| nothing, 30 min | 204, rank 0 | 204, rank 0 |

(Rule alone, old thresholds: 20 264 earned, ranks 10.4 / 22.3 / 38.1 / 66.9 / 105.4.) The small-fleet openings
earn ~8 % less in the first 30 minutes (two wagons wait for a fuller load instead of carrying ones); rank 5 at
108.7 is inside its 105-135 window but near the edge — watch it in the playtest.
Tests: two valley tests lost the situation they test, not their meaning, and were re-staged honestly —
`stall-readability › F1` (winter CONTESTED names the slowed farm) now plays the decent plan without the
malthouse's own two farms, so malthouse and mills really share grain (344 winter samples, 0 outside winter);
`diagnosis-audit-fixes › fix 1` (a market surplus stays "worth a wagon") plays it with 7 bought wagons instead
of 30, so a yard still waits for a wagon. New `tests/valley-top-up.test.ts`: no fed workshop in the valley gets
a top-up below the threshold; mission I still does. Card: the workshop sheet adds one calm line under its
inputs while a request is held — "Ma drewna na pracę; dowóz zamówi, gdy zmieści się 4 — pełniejszy wóz, mniej
kursów." (key `why.topUp`, PENDING_KEYS); status stays "Produkuje", no stall, no cure.
`docs/shots/day6-valley-topup-412x915.jpg`. (decided)

**D-95 — Mission VIII: a quarry waiting for the reserve run says the granary already has paving stone; no "Kup
wóz" (owner decision, day 6; UI and read-only diagnosis, no hash change).** D-90 left m8's quarry as a waxed
OUTPUT_FULL.NO_WAGON for ~60 % of the mission with "Kup wóz" as the cure, which helps 0 of 14 times: the granary
does ask for stone (reserve gap ≥ one load), but the dispatcher serves workshop inputs (prio 1) before the
stone reserve (prio 2), so a new wagon carries bakery/sawmill inputs first. The owner chose the reading over a
dispatcher change. A read-only `stoneInStore()` (src/sim/diagnose.ts): a contract mission with road stone, the
quarry full and waiting for a wagon, the castle needs no more stone, no workshop waits for stone, and the
granaries (and castle) hold at least one cobbled cell's worth of unreserved stone; it returns that stone. Then
the stall is calm (minor pin, never wax), the HUD card says "czeka na wóz, a spichlerz ma już kamień na bruk",
the Why sheet under the count: "W spichlerzu jest 12 kamieni — wystarczy na bruk (12 pól). Kamieniołom poczeka
na wolny wóz; nowy wóz i tak najpierw wiezie wkład warsztatów." (numbers from the state, plurals by ICU), and
`cureFor` gives no wagon cure. Not in the free valley (the market buys stone; the valley surplus stays as it is,
calm with the wagon cure — owner). Keys `cause.stoneStored`, `fix.stoneStored` (PENDING_KEYS). In the m8 baseline
run every one of the 188 "no wagon" samples of the quarry now reads this way (`tests/m8-stone-stored.test.ts`).
Rejected: the stone reserve before producer inputs in the dispatcher (hash, mission re-tuning; after the
playtest, BACKLOG). `docs/shots/day6-m8-stone-412x915*.jpg`. (decided)

**D-96 — Tutorial note placement: free-slot scan before the fallback; the fallback looks at both sides and
spares the rail and the open card's head (day 7; BACKLOG P2 from D-91).** At 915x412 in step 5 every band
`placeNote` tried (the waybill's row, under the waybill, under the target, around the crossing) crossed the
waybill, the clock chips, the docked card or the ghost crossing, so the note fell back to "x = 10, the slot that
hides least", which weighed the tool rail at 2 against 6 for the ghost — and lay on "Droga", the tool step 5
needs. Now: (1) after the fixed bands, `tryBand` is tried every 12 px down the screen, so any free slot wins
(landscape with no card open: under the waybill, `day7-tut-step5-915x412.jpg`); (2) the fallback tries both the
left and the right edge, the rail weighs 6 in step 5, and the open card's head (title and close button) weighs
6, so the note never sits on the X of a card. Measured with `tools/repro-step5.mjs` (real input, built game):
915x412 with the wagon card docked on the right — note bottom right, clear of rail and crossing, over the
card's lower edge only (`-sheet.jpg`); `?lang=ar` (card on the left, rail mirrored) — note right of the
crossing, clear of rail, card and waybill (`-ar.jpg`; before the card-head weight it lay on the card's close
button); 412x915 — unchanged, between the waybill and the crossing. The drag across the river still builds the
bridge and moves on (915x412 run: coins 180 -> 150, bridge on the map). Heights are measured once per width per
placement (a cache), so the scan costs no extra layouts in steady state. Fold book/flex not run: the repro tool
has no hinge emulation and the machine was saturated (SwiftShader ~1.5 min per step); `tools/fold-audit.mjs`
remains the check for those. `tools/repro-step5.mjs` gains `LANG_Q` and `ONLY5`. (decided)

**D-97 — Free valley rank 5: 13 000 → 14 500 renown (day 7; sim constant only, missions untouched).** After D-94
(top-up in loads of four, ranks 3/4 at 3000/7200) the decent-player bot (`tools/bot-sandbox.ts`, plan `DECENT`,
150 min) reached rank 5 at **108.7 min**, at the very start of the target window 105–135 min, while ranks 1–4 had
moved to the middle of theirs. Rank 5 unlocks nothing (castle look only), so it is the long goal and should sit
mid-window. Threshold sweep, same plan, everything else equal (ranks 1–4 10.4 / 22.3 / 42.8 / 76.3 min and 19 706
silver earned in every run, no invariant violations):

| rank 5 renown | rank 5 reached |
|---|---|
| 13 000 (old) | 108.7 min |
| 14 000 | 116.0 min |
| **14 500** | **119.7 min** |
| 15 000 | 123.1 min |
| 16 000 | 129.1 min |

14 500 lands nearest the middle (120). 16 000 leaves only ~6 min to the top edge (a slower player misses the
window); 14 000 stays in the lower third. Bench 180 min: "mixed" 106.5–108.7 → 117.7–119.7 min; with
`--events` 87.5–90.0 → 95.3–96.9 min (still under the window, as before — events add silver; not tuned here).
`docs/playtest/PROTOCOL.md` rank table updated to 3000 / 7200 / 14 500. Only `RANKS[5].renown` in
`src/sim/defs.ts` changes: no state field, state version stays 8, mission golden hashes unchanged (no mission
reads the valley ranks). Owner confirmed 14 500 (~22:30). (decided)

**D-98 — Calm codex variant for a full yard that needs nothing ("Pełno — nic pilnego"; day 7; UI/content only).**
The "Co to znaczy?" fold under a calm stall (D-85 surplus, a filled order, D-95 stone already in the granary) read
the ordinary `status.OUTPUT_FULL.NO_WAGON` entry, whose first cure is "Kup wóz w połączonej stajni" — right under
the calm line that says "Nowy wóz tego nie przyspieszy". Two texts on one card contradicted each other, and the
codex is what a new player trusts. Now `STALL_CODEX_CALM` (`src/content/stallCodex.ts`, mirrored in
`docs/content/stall-codex.md` under "Wersje spokojne") holds a calm variant of that key: "Pełno — nic pilnego",
"to nie awaria", fixes "Nie kupuj wozu z tego powodu…", "Zajmij się postojem z czerwoną pieczęcią…", "Gdy towar
znów będzie potrzebny, wóz przyjedzie sam." The fold takes it exactly when `calmWhy()` is non-null for the
chain's last building (`codexCalm()` in `src/ui/stalls.ts`), so the fold and the calm line can never disagree.
Only keys whose normal entry advises a cure a calm stall does not need get a variant (one today). Measured over
whole missions: m4 898 calm / 15 ordinary samples, m8 340 / 139 — the ordinary entry (with "Kup wóz") still shows
where a wagon would help (`day7-codex-wagon-m8-sawmill-412x915.jpg`). Tests: calm variants only for real keys,
never "Kup wóz"/"Buy a wagon"; the fold follows the calm line on m4/m8/m9. Rejected: deleting the wagon cure from
the normal entry (it is right for a real stall). `docs/shots/day7-codex-calm-m4-*.jpg`. (decided)

**D-99 — Watch mode (Flip cover): the folded seal shows "gotowe za M:SS" under its clock (day 7; UI only;
BACKLOG P3 from D-43).** On the Flip cover (`is-mini`) the waybill folds to its seal, which showed only the time
left; the pace forecast was one tap away in the castle card. Two previews were built behind `?sealpace=a|b`:
A — one short line under the seal's clock ("gotowe za 3:05", "spóźni się 1:20" when the forecast misses the due
time, amber in the last minute); B — three small seals pressed by the forecast, no words. Owner chose **A** (~22:30):
words read on a 360 px cover without decoding three 16 px seals that sit next to the bigger seal of the order, and
it says the same as the waybill's "Przy tym tempie: gotowe za …" line. A is now the default whenever the HUD is
in watch mode (`Hud.compact`), with no URL flag; variant B, its CSS and the `?sealpace` flag are removed. The line
is not added when the player folds the waybill on a big screen (the full waybill is one tap away there). Empty
until the forecast is ready. Keys `contract.sealPace.eta/.late` (PENDING_KEYS). `day7-flip-a-m3-360x380.jpg`
(m3, 7:00 left, "gotowe za 3:05"). (decided)

**D-100 — "Naprawa" docks to the bottom edge of the "Dlaczego stoi?" sheet (UI only; first-10-minutes-b items 1,
2, 4).** At 915×412 the side sheet's body shows ~136 px (it sits between the chips and the bottom rail, D-55), so the
fix (header, 56 px button, hint) lay 120–180 px below the fold (`day7-fix-before-915x412.jpg`); the research run
tapped beside it and the wagon was never bought. Two options: (a) move `fixHtml`/`cureHtml` above the chain, or (b)
keep the order and stick the button to the sheet's bottom. **Chosen: (b).** The game is about diagnosing: the card
reads cause → fix, and with (a) a 136 px body would show only the button and hide the cause under it, teaching
"tap the red button" instead of "read why". With (b) the chain header and its first link stay on top, the button
is always on screen, and the rest scrolls beneath it with a 14 px paper fade (no rule line — a hairline over the
text read as strike-through). Portrait is unchanged where the fix already fits (it simply does not stick).
Mechanics: the sheet body renders in three `display: contents` parts (lead, fix, rest), so `.fix-dock`
(`position: sticky; inset-block-end: 0`) is a box child of the scrolling body; the body drops its bottom padding
when it has a dock (`:has`), otherwise the scrolled text showed through an 8 px strip under the button. Only the
button (and, when disabled, its "Brakuje N srebra") is in the dock; the explaining hint follows in the flow.
The same parts make each section re-render only when its own HTML changes (the stall clock ticks in the lead,
the button node stays), and a sheet waits with its refresh while a pointer is down on it — the button never
changes under the finger. Measured (`tools/fix-shots.mjs`, `tools/fix-tap.mjs`, built game): fix button inside the
visible body at 915×412 pl/ar and 412×915; the node survives refreshes at ×1; a real tap builds the bridge
(180 → 150) and, in m3, buys a wagon (270 → 240, 4 → 5 wagons). Headless (`tests/m1-eye-fix.test.ts`): tapping only
the worst stall's card and its fix wins mission I with a tap pair every 10 s (10.6 min) or 30 s; every 60 s is
too slow (lost at 12:00) — so the research run's loss came from the fix that was never applied, not from the
path. `docs/shots/day7-fix-dock-*.jpg`. (decided)

**D-101 — Workers at the sawmill, farm and fisher (night 6; render only).**
Same three-piece rig and instancing as the night-2 woodcutter/miller/baker, animated only while the building is
`WORKING`, calm otherwise. Sawmill: two sawyers at a pit saw — the top sawyer on the log, the pit man under it; the
saw is a fourth instanced rig piece (`WorkerRig.tool`) lifted by the pose's new `lift`, so both men share one
stroke (same building, same phase). The high trestles moved from under the shed roof into the open yard (the
camera never saw the old frame saw under the shingles); the shed keeps a log on blocks and a sawdust heap.
Farmer: hoeing, placed on the nearest free tilled field cell within 6 cells of the farm (no road, no building,
no water), facing along the furrows, re-placed when `netVersion` changes; the yard spot is the fallback for a map
without fields. Fisherman: a lift net on a 3.3 m pole near the end of the landing stage, kept on the footprint
(the stage reaches past it). `BuildingModel.worker` became `workers[]` (+ `fieldWorker`); the feet take `at.y`.
Cost: ≤ 1.25k triangles per figure (test), +10 draw calls in m1 (41 → 51, both sawyers + saw + farmer),
frame JS in noise (SwiftShader, `tools/frame-cost.mjs` m1 low, two runs each: render 12.4/13.4 ms → 18.7/12.6 ms,
frame 18.4/19.2 → 28.1/18.9 ms). Shots: `docs/shots/night6-workers-*.jpg` (`tools/night6-workers-shots.mjs`,
`tools/model-preview.html?view=workers`). (decided, owner to look)

**D-102 — Mission XIII "Pierwsze piętro łańcucha": one wagon for the whole map (night 6; data only).**
BACKLOG P4: the raw goods are already in the granary (14 wood, 10 grain; the order needs 12 and 8), the sawmill,
mill and bakery wait on one road in the dry `valley-m3`, and the march starts with **one wagon** and 150 silver.
Contract 24 planks + 16 bread, deadline 10:00, 3 seals ≤ 5:30, 2 seals ≤ 8:00. The stalls read
`NO_WAGON.ALL_BUSY` (bakery, sawmill, mill) for 556 of 600 s without a fix; the bakery's sheet offers "Kup wóz −30".
Measured (`tools/bot-m13.ts`): nothing loses (planks 24/24, bread 0/16); one wagon at 0:20 7.61 min (2 seals); three
at 0:20 5.06 (3); one at 1:30 8.77 (1); two at 0:20 5.79 (2); three at 1:00 / 2:00 4.94 / 5.93; 4–5 wagons 4.47.
**Placement: appended as XIII**, not inserted as II: the Roman numeral is part of every title in 17 languages and of
save margins (D-73), so renumbering would rewrite all of them; `MENU_MISSIONS` order is the only list to change if the
owner wants it earlier (then titles need renumbering). Letters authored in all 17 languages (the letters module never
falls back to English); menu title/subtitle in pl/en, others pending. Golden hashes recorded for m13; all others
unchanged. Overlap with XI (also "buy wagons"): XI is a long route where 3 wagons almost suffice (nothing = 1 seal),
XIII is short routes where one wagon cannot serve three workshops (nothing = loss). (decided, owner to confirm order)

**D-103 — Gap finder links from the supplier's side, straight before diagonal (night 6; research 2026-11-04 P2;
read-only, no hash changes).** `suggestLinkToStable` searches from the cut-off building's gate out to the stable's
road network (cells a loaded wagon from the stable reaches) and ranks the links lexicographically: silver, then the
number of diagonal new steps, then drive time on the existing roads from the building that has to reach the target
(`linkAnchor`: the OUTPUT_FULL producer with the longest stall for a granary, an input supplier for a workshop, a
customer — another workshop or the contract castle — otherwise; the stable when none). The "robust variant" the
research asked for; its quick patch (`EXISTING_ROAD = 0` + diagonal penalty in `suggestConnection`) was not used.
`suggestConnection` (tutorial ghost, dead-end check) is unchanged. Result: missions V, VI, XII offer the authored
straight link (37,38)–(37,39) instead of the diagonal toward the stable (test `tests/gap-finder.test.ts`). Measured
(`tools/balance-night6.ts`, eye 10/30/60 s): V 3/2/2★ (8,28/8,39 late tranche/9,20; was 3/2/2), XII 3/3/3★ (8,46/8,80/
8,52; was 3/2/3), I 1/1/1★ (10,06/9,91/11,38; was 1/1/lost). **VI stays 1★ (8,94)**: the link is now exactly the
lesson (lesson alone 8,31, 3★), but the reasonable player then taps "Kup wóz" at 3:00 and "Postaw spichlerz" at 5:30
and those cost 38 s; the research's quick patch landed one cell further west, (36,40), and the same taps then gave
8,37 — dispatcher chaos (research §6.1), not the link. Left for the owner (see HANDOVER). (decided)

**D-104 — The worst-stall card names a single producer shared by two workshops (night 6; research P5; UI only).**
`sharedOneProducer` (stalls.ts): `sharedInput` with one producer and ≥ 2 consumers, in a contract mission whose
`buildable` list has that producer type (IX, X; never the ranked free valley). Such a building is critical on the
card from the first look (score as if stalled 45 s more), even while it only waits for a delivery — its lesson state
`CONTESTED` lasts too briefly to win the card by duration. Card: "Węglarnia: Chata drwala to jedyny dostawca dla 2
warsztatów"; cure `producer` (Buduj highlighted); sheet: "Postaw jeszcze: Chata drwala −20" opens the build tool
with the ghost by the first producer (`siteNear`). Measured eye 10/30/60 s: IX 3/3/2★ (8,12/8,99/10,08; was
1/lost/1), X 1/2/2★ (10,58/9,87/10,21; was 1/lost/lost). Open: in X the build tool's site is worse than the authored
(12,34) — the research suggests highlighting the authored site (mission data hint). (decided)

**D-105 — A wagon held at a wooden span reaches the card, with "pave the bridge in stone" (night 6; research P4; UI
only).** `heldSpanFor`: a wagon `BRIDGE_JAM`/`BRIDGE_CLOSED` for ≥ 20 s whose job picks up at or delivers to the
building puts that building on the card, critical ("Tartak: Wóz 2 stoi przed mostem zamkniętym przez krę" / "…przed
wąskim mostem"); cure `pave` (Bruk highlighted); sheet: "Wyłóż most kamieniem −N" lays a stone bridge over that span
(cells in drive order; `validateRoad` decides silver, stone and rank — disabled with the reason otherwise). Only when
stone surfaces are allowed (`canSurface(2)`). Measured eye 10/30/60 s: II 2/1/1★ (9,24/9,82/10,81; was 1/1/1 — the
2★ threshold 10:00 the research proposes would make 30 s a 2★, **waits for the owner**), IV 30/60 s 2/2★ (7,58/7,96;
was 1/1). Both cards: `tests/shared-card.test.ts`, `tests/held-span-card.test.ts`; shots
`docs/shots/night6-card-*.jpg` (`tools/night6-cards-shots.mjs`). (decided)

**D-106 — A later letter's goods are a surplus on the card, not "Kup wóz" (night 6b; BACKLOG P2 from D-103; UI
read helper only).** Why VI stayed 1★ after the authored link: between the two letters the castle does not take
planks yet (`contractTarget`: with tranches only the letter now due counts), so the sawmill's full yard
(`OUTPUT_FULL.NO_WAGON`) waits only for a wagon that would park the planks in a granary — which the dispatcher does
last. `outputSurplus` compared against the *whole* order, so the card said "Kup wóz" at 3:00 (link alone 8,31 → link
+ wagon 8,50 min); the eleventh wagon then left both granaries full and the card said "Postaw spichlerz" at 5:30
(→ 8,94, 1★). `outputSurplus` now compares against `contractTarget` (the letter now due): the yard is a calm
surplus ("Nadwyżka: nikt teraz nie potrzebuje desek … Nowy wóz tego nie przyspieszy"), no cure, and the granary hint
never comes because its cause was the wagon. Generic (every mission with tranches: V, VI, XII), no mission case,
hashes unchanged (diagnose helpers are UI-only). Reasonable player (eye 10/30/60 s, `tools/balance-night6.ts`, now
with XIII): **VI 1/1/1★ (8,94) → 3/3/3★ (8,31)**; V 3/2/2★ unchanged (8,28/8,39/9,20 → 8,22/8,59/8,76 — 30 s 12 s
slower but no missed tranche any more), XII 3/3/3★ unchanged (8,46/8,80/8,52 → 8,80/8,55/8,52, 120 silver less
spent at 10 s); every other mission identical. Test `tests/next-letter-surplus.test.ts`; shots
`docs/shots/night6b-m6-surplus-*.jpg`. (decided)

**D-107 — Authored build sites as mission data; the "Naprawa" ghost starts there (night 6b; BACKLOG P2 from D-104).**
`MissionDef.siteHints` (`{ type, x, y, facing }[]`, `missionSiteHint`) — read only by the UI, never copied into the
state (hashes unchanged): VII fisher, IX and X woodcutter (the existing `M7_FISHER_SITE`, `M9_WOODCUTTER_SITE`,
`M10_SECOND_WOODCUTTER`). `buildSite` (new `src/ui/site.ts`, pure, also used by the balance tool) returns the hint
when `validatePlace` accepts it, else the old ring search around the building (`siteNear`, moved here); the build
tool takes the hint's gate side, and when the site is off screen the camera glides to it (`showCells` →
`frameCells`, the tutorial's framing) — in X the sawmill sheet's camera did not show the woodcutter's side at all.
No sim special case. Balance tool now places the "producer" cure where the ghost starts (before: a spiral from the
producer's gate, which was not what the game offers). Reasonable player eye 10/30/60 s, ghost without → with hint:
**X 3/3/1★ (8,41/8,59/11,12) → 3/3/3★ (9,04/8,59/9,11)**; IX 3/3/1★ (8,06/9,10/11,16) → 3/3/2★ (8,71/8,99/9,24);
others identical. (The night-6 figure X 1/2/2★ was the gate spiral, not the ghost.) Test `tests/site-hint.test.ts`;
shots `docs/shots/night6b-m10-ghost-*.jpg`. (decided)

**D-108 — Mission I seal thresholds 3★ 9:15, 2★ 10:45 (day 8; research P1; owner 2026-11-04 morning).** The
tutorial's 3★ was out of reach: the best plan found (bridge + 4 wagons, all the silver = `npm run bot`) wins at
8,85 min against a 7:00 threshold; more silver (240) or 3 start wagons still gives 8,27–8,72. Moving the thresholds
is cheaper and keeps the river lesson intact: `star3Min 7 → 9.25`, `star2Min 9 → 10.75` (`src/sim/missions.ts`,
`missions/m1.json`; deadline 12:00 unchanged). Measured (`tools/balance-night6.ts m1`): bot/optimum 8,85 → **3★
(+24 s)**; reasonable player eye 10/30/60 s 1/1/1★ → **2/2/1★** (10,06 / 9,91 / 11,38; −49/−40/−128 s to 3★);
scan+ 30 s 11,01 (1★), letter + eye+ 30 s 11,15 (1★); passive, wagons only and bridge only still lose. Seal
thresholds live in the state (`mission.contract.star*Tick`), so every M1 golden hash changes and nothing else:
`V4_GOLDEN` m1 ×3, `valley-events-live` m1 ×2 (buy0/buy2). DESIGN.md quotes the new thresholds and
`docs-numbers` now checks them. (decided)

**D-109 — Mission IV: 140 silver, seals 3★ 7:30, 2★ 10:00 (day 8; research P3; owner 2026-11-04 morning).** Five
bought wagons beat the lesson (6,52 min, 3★, k = 5 — and 4 or 6 wagons gave 1★: a knife edge). With 140 silver
(was 180, `coins` override in `src/sim/missions-s2.ts`; `proposals/m4.ts` keeps the proposal's 180) at most four
wagons can be bought, and the stone bridge (87) plus one wagon still fit. Thresholds 7:00/9:30 → 7:30/10:00 so the
lesson alone is a clear 3★. Measured (`tools/balance-night6.ts m4`, before → after): wagons only best 6,52 (3★,
k=5) → **10,16 (1★, k=2; −10 s to 2★)**; lesson only @0:00 7,01 (2★, −0 s) → **3★ (+30 s)**; optimum 5,98 → 5,99
(lesson @20 s + 1 wagon, +91 s); letter + eye+ 30 s 6,59 → 7,15 (**3★, +21 s**); passive 11,65 (1★) unchanged;
reasonable player eye 10/30/60 s **1/2/2★ unchanged** (10,56 / 7,58 / 7,96; −184/−5/−27 s to 3★). One loss:
scan+ 30 s 6,83 (3★) → 11,77 (1★) — it buys three wagons first and then cannot afford the bridge. Authored
strategies (`tools/balance.ts m4`): nothing 11,65 (1), 3 wagons 10,49 (1), stone bridge late 8,07 (2), before the
ice 6,43 (3), all `expect`s hold. Hashes: `V4_GOLDEN` m4 ×4 and `valley-events-live` m4 ×2 change, nothing else.
(decided)

**D-110 — The "one producer for two workshops" card waits 30 s (day 8; owner 2026-11-04 morning; amends D-104).**
From the first second the card handed IX/X's lesson over before the player had seen a workshop stand. Now the card
(ranking, card line, cure `producer`) appears only once the workshop has waited for its input **30 s without a
break** (`SHARED_CARD_WAIT_TICKS`). The sim keeps no such clock (`stalledTicks` resets on `WAITING_DELIVERY`, which
is most of the wait), so the UI samples it: `sampleInputWaits(world)` runs every tick from the app's `onTick` (like
the pace log) and remembers since when each building has waited for an input (`NO_INPUT` other than `UNREACHABLE`,
`NO_WAGON`, `WAITING_DELIVERY`, `WAITING_UPSTREAM` of an input good); a `WeakMap` per world, never in the state, only
in missions that may build a producer. A world never sampled (a freshly loaded save) shows the card 30 s later —
harmless. The building's sheet keeps its text hint (`why.sharedOne`) from the start: tapping a building is the
player's own question. Balance tool samples after every `step()`, and its "text hint" player now places the producer
where the ghost starts (D-107), as the card's button does (it still used the old gate spiral). Reasonable player
eye 10/30/60 s, before → after: **IX 3/3/2★ (8,71/8,99/9,24) → 3/3/2★ (8,50/8,63/9,24)**; **X 3/3/3★
(9,04/8,59/9,11) → 3/3/3★ (9,05/9,13/9,11)** — X at 30 s is 32 s slower (margin to 3★ +43 → +10 s): the first
look at 0:30 no longer shows the card (the sawmill has waited 29,9 s by then), the producer goes up at 1:00.
Hashes unchanged (UI only). Test `tests/shared-card.test.ts` (never before 30 s; no card without a wait log).
(decided)

**D-111 — Short landscape cause chain: subject, then directly the root; middle links behind "+N" (day 8b; owner 2026-11-04).**
On a side sheet with at most 500 px of height (landscape phones 915×412, the HUD half in Flex mode; class
`is-short` from `layout.ts`) the fix dock (D-100) covered the root of the "Dlaczego stoi?" chain: the body is
~146 px and the dock takes its lower half. Now the chain shows its subject on one line (icon, status, stall clock —
the "Łańcuch przyczyn" header goes, the kicker already asks the question) and directly the root; the links between
fold behind one "+N ogniw(a) pośrednich" button (48 px target, on the connector) that unfolds them in place. The
open state lives in a UI-only `Set` keyed by subject and survives the sheet's refreshes until it closes. Both forms
are in the markup and CSS picks one, so portrait and Fold book keep the full chain unchanged. The tutorial's
chain-link target is the first *visible* link (the root when folded). Measured (`tools/chain-shots.mjs`): at
915×412 the root sits at 184–232 px above the dock top 234 in VI/IX/XIII (before: below it); unfolded, the body
scrolls. `why.more` is pl/en; other languages fall back to English (PENDING_KEYS). UI only, hashes unchanged.
(decided)

**D-115 — The pace card: a producer too slow for the next seal takes the card slot (day 8c; mission VII).**
A slow order is no stall, so no building carries a `StallReason` for it, and in VII the worst-stall card was empty
(50 of 65 looks at 10 s) or calm while the lone fisher made the order miss two seals; the lesson ("a second fisher on
the water") lived only in the letter, and the reasonable player had 1★ at every reaction time. New UI read
`paceCard(world, forecast)` (`src/ui/paceCard.ts`): when the contract forecast (F10, `forecastFor`, moved here from
`pace.ts` so headless tools can use it) is ready and has an aim, the bottleneck good's producers working **flat out**
(`capPerMin`) still miss the next seal, **one more** producer would reach it (3★, else 2★), and the mission may build
that type → the card slot shows "Tempo zamówienia · Chata rybaka ×1: 5,3/min, na 3 pieczęcie trzeba ≈8,8/min —
postaw więcej". It takes the slot only when no real stall needs it (no stall, or the worst one is calm), on the plain
parchment panel (no wine bar, ink kicker): calm, never red; the alarm seal keeps cycling the calm pins. The eye opens
the producer's sheet, whose "Naprawa" is "Postaw jeszcze: Chata rybaka" (the existing `producer:` act: build tool with
the ghost on the mission's authored site, D-107). Generic: no mission names, only the forecast, `buildable` and the
rank gate; the tutorial's first notes hide it with the stall card. Reasonable player VII eye 10/30/60 s **1/1/1★
(10,90) → 3/3/3★ (6,96/6,91/7,21)**; no other mission changes (it only fires where a producer of the bottleneck
good may be built and is too slow). UI only, hashes unchanged. Test `tests/pace-card.test.ts`.
(decided — owner may find 3★ too easy: the ghost places the fisher on the authored site, so "where" is given away
as in D-107)

**D-116 — Mud on a contract delivery: a calm line on the pace card, the cobble cure only when seals are at risk (day 8c; mission III).**
Mud slows wagons but is no stall, so III's card never showed the cobble lesson (reasonable player 1/1/2★). The pace
card (D-115) gets a second kind, `mud`: while it rains (or thaws) on a running contract and cobbles are allowed, it
takes the delivery of a good the castle still lacks (producer -> castle, loaded path) that loses the most time to mud
and its longest contiguous stretch of land dirt (≥ 6 cells, ≥ 15 % quicker on cobbles under the same rain; time from
edge length and cell speed, slope left out because only the ratio counts). The card's calm slot says "Tartak: błoto
spowalnia dostawy — bruk na 49 polach przyspieszy je o 53 %"; the producer's sheet marks the stretch on the map (the
gap finder's ghost) and offers "Wybrukuj odcinek: 49 pól −147" **only when the forecast misses three seals** (or a
tranche's deadline); otherwise a calm line says the order makes it anyway. Never red, never in the stall ranking; a
real (non-calm) stall keeps the slot. Reasonable player III eye 10/30/60 s **1/1/2★ (8,15/9,30/7,66) → 2/3/2★
(6,32/5,97/6,46)**. VIII (old version, rain from 1:40) shows the mud line too; its cobbles need quarry stone, so the
button reports the missing stone and VIII keeps 3/3/3★ (eye+ 10 s 9,07 → 9,28). UI only, hashes unchanged.
(decided)

**D-117 — Before the ice, "Kup wóz" yields to the stone span when a wagon would cost the bridge (day 8c; D-109 follow-up, mission IV).**
At 140 silver the "scan" player bought a wagon from each pin and had no silver left for the stone bridge when the ice
came (1★). Generic rule in `cureFor`: when a running contract has an authored ice window still ahead
(`state.ice`, start > now), cobbles are allowed and the span most producer -> castle trips cross (`iceAheadSpan`,
wooden span cells from the network) costs `price`, a `wagon` cure becomes `pave` if the player can afford the
bridge now but **one more wagon would leave less than its price** (`coins ≥ price > coins − 30`). The card then
reads "Zamek: za 2:00 kra zamknie most — kamienny kosztuje 72 srebra, a wóz zostawi za mało", the sheet's "Naprawa"
is "Wyłóż most kamieniem" (the held-span button of research P4, now `paveSpanFor`: a held wagon first, else the ice
ahead) with "Za 2:00 kra zamknie drewniany most…". With more silver the wagon cure stays; after the ice starts the
held-span card takes over as before. Measured IV (eye 10/30/60 s / scan+ 30 s): **1/2/2★ / 1★ → 3/2/2★ / 3★**
(eye 10 s 10,56 → 6,33; scan 11,77 → 7,00: two wagons, then the bridge at 1:00–2:00). Eye 30/60 s unchanged (they
never meet a wagon cure while short of silver before the ice). No other mission has authored ice. UI only, hashes
unchanged. Test `tests/ice-ahead.test.ts`.
(decided)

**D-118 — Letters are real modals, game sheets are non-modal dialogs (day 8d; a11y audit 2026-11-04 F3/F4).**
Every dialog claimed `aria-modal="true"`, yet Tab walked out of it into the HUD and the pins: screen readers hid
controls that keyboard and switch focus still reached. Now two kinds, honestly labelled. **Letters** (opening,
dead end, end of contract; `src/ui/modal.ts` `showModal`) block the game: on insertion every other `#ui` layer, the
scene canvas and body-level controls get `inert`, focus goes to the letter's first action ("Do dzieła", "Jeszcze
raz", on a won contract "Następna misja"), game shortcuts are off; when the letter leaves or starts its exit the
hold is released and focus returns to where it was. The end letter is named by its heading (`end-title`).
**Game sheets** (Dlaczego stoi?, wagon, castle, settings…) are `role="dialog"` named by their title **without**
`aria-modal`: the map and HUD work beside them on purpose, so Tab walks on into the page (no trap) and comes back
by the usual order; focus still moves in on open and back to the opener on close. `npm run a11y` checks both.
(decided)

**D-119 — Keyboard shortcuts never take a key from a control; a setting turns them off (day 8d; a11y audit F5).**
Space paused the game even with keyboard focus on a tool card (the card could not be pressed with Space), and the
single letters (R C X B G H) fired everywhere, `h` hiding the whole HUD with no way back for a keyboard. Now
(`app.ts` `onKey`, `shortcutTarget`): no shortcut while typing in a field or while a control has **keyboard**
focus (Tab, switch access, a screen reader or our own focus moves) — Space/Enter press the control, letters do
nothing. A control focused by a mouse or finger keeps the shortcuts (click "×1", then Space pauses; the key is
consumed so it does not click the button a second time). Settings → "Skróty klawiszowe" (Tak/Nie, `prefs.shortcuts`);
until the player chooses, on when the device has a mouse or trackpad (`(any-pointer: fine)`, also a tablet with a
paired mouse), off on touch-only devices (rare keyboards, Voice Access / on-screen keyboards would fire letters by
accident). `h` hides the
HUD and moves focus to "Pokaż przyciski", now on its stat plate (the old rule's `border` shorthand had wiped the
kit plate: bare ink over the map); `h` again or that button brings the HUD back. Escape keeps closing sheets and
tools regardless of the setting. Letters (D-118) switch all game keys off.
(decided — owner 2026-11-04: default on with a fine pointer, off on touch-only)

**D-120 — Large system text: side sheets take the full height; focus stays above the docked fix (day 8d; a11y F1/F2).**
`layout.ts` `watchTextScale` (16 px probe, ResizeObserver) sets `body.is-bigtext` at ≥ 150 % (Android font size →
WebView textZoom). Landscape side sheet: full height beside the top bar and over the rail, no kicker/icon; portrait
bottom sheet may grow to the chips row. `.sheet-body` gets `scroll-padding-block-end: var(--dock-h)` (measured in
`sheets.ts`) plus a focusin fallback, so a focused control never sits under "Naprawa".
At 200 % in landscape the side sheet covers the seal tokens and the pace card while it is open; accepted.
(decided — owner 2026-11-04)

**D-121 — Stall pins: severity and time in the name, a parchment halo, a scalloped seal for critical (day 8d; a11y F7).**
The red pin sank into the daytime grass (1.5–2.1:1) and differed from the brass one only by colour. Now: the pin's
accessible name leads with its weight and ends with the time stood — "Najgorszy zastój — Piekarnia: brak mąki, stoi
1:30" (`pin.worst` / `pin.critical` / `pin.stood`); the time in the name moves in 10 s steps so a screen reader is
not told a new name every second (the visible tally still counts each second). Every pin gets a 1 px parchment
`drop-shadow` halo before the kit's shadow. The critical / worst pin uses `pin-alarm@2x/3x.png`
(`tools/make-pin-alarm.py`): the red pin's disc at 86 % on a 14-lobe wax rim, the shape of the HUD's alarm seal —
scalloped = critical, smooth = lesser, readable without colour.
(decided — owner 2026-11-04: the scalloped wax-seal critical pin is accepted)

**D-122 — Contrast: menu subtitles, "brak N", ETA/income, slate (day 8d; a11y F11, F12, F13, F21).**
Menu mission subtitles and the menu's small lines go from `--ink-soft` to `--ink` (14 px): the translucent menu
paper over the live scene left them at 3.4–3.6:1. The "brak N" reason on the hatched "Kup wóz" tool sits on a
parchment plaque (`--kparch`, 2 px spread) in darker wine `#5c1418`, so the hatching never crosses the letters
(was 1.3:1 at worst). ETA and income `#7d5d23` → `#6b4f1d` (≈5.3:1 on parchment); the "Zacznij tutaj" kicker
`#561418`; `--slate` `#3d4852` → `#36404a`; the snow pill itself is the kit's `eta` sprite, so its text goes `#eef0ee` →
`#fbfbf8` (4.45 → ≈4.9:1). No hue changes, only darker steps of the same inks.
(decided)

**D-123 — Two-tone focus ring (day 8d; a11y F8).**
The ochre ring was 2.31:1 on parchment. `:focus-visible` (buttons, `[tabindex]`, links, selects, textareas, the
volume slider) now draws a 2 px ink outline (`--focus-ink #1d1813`, 11:1 on parchment) between two pale bands
(`--focus-pale #f6e9c8`, `box-shadow` 2 px inside the offset and 6 px outside), so one of the two tones keeps
≥ 3:1 against the map, the oak plates and the wine wax alike. While focused, the ring replaces a control's own
`box-shadow`; sheets themselves (`section.sheet:focus`) draw no ring. `button:focus { outline: none }` stays:
mouse and touch focus show nothing.
(decided)

**D-124 — Reduced motion reaches the renderer (day 8d; a11y F14).**
CSS and the seal press already honoured `prefers-reduced-motion`; the camera and the terrain shader did not.
`src/render/motion.ts` holds one shared `MediaQueryList` (`reducedMotion()`, read per frame). With it set:
`CameraRig.focusCell` cuts to the subject (no 220 ms glide), the main menu's slow camera sway stops, and the
bad-draft / blocked-ghost overlay in `terrain.ts` holds a steady 0.85 alpha instead of the ~1 Hz pulse (`uMotion`
uniform). Wagons, water and weather keep moving: they are the game state, not decoration. A settings toggle
"Ogranicz ruch" waits until a device shows whether Android WebView maps "Remove animations" to the media query.

**D-125 — Owner decisions on day 8c (2026-11-04 ~18:00): VII's fisher ghost on the nearest bank, III's mud line only at risk.**
M7: mission VII loses its authored fisher site (`siteHints` removed; `M7_FISHER_SITE` stays as bot/balance data), so
the pace card's "Postaw jeszcze: Chata rybaka" opens the build tool with the ghost on the nearest valid bank by the
existing hut (`buildSite` ring search) — the card says *what*, the player still picks *where*. Reasonable player VII
eye 10/30/60 s **3/3/3★ (6,96/6,91/7,21) → 2/2/2★ (8,07/8,04/8,04)**: the nearest bank fishes slower water, so 3★
now needs the player to look for a better spot (the owner's intent; the authored site is still the 3★ answer).
M3: the mud kind of the pace card (D-116) appears only when the forecast misses three seals (or a tranche's
deadline); the calm "zamówienie zdąży" line and its key `fix.mudCalm` are gone. III eye 10/30/60 s unchanged
(2/3/2★). M4: 2★ for the slow reaction stays. UI/mission data only, hashes unchanged. Tests `pace-card`, `site-hint`.
(decided)

**D-126 — Render #4: the mid wagon rig casts no shadow on low and high; far cargo never casts (owner 2026-11-04, option B).**
Research `docs/research/2026-11-04-render4-shadows.md` (shots `docs/research/shots-render4/`). The mid rig (horse,
wheels, driver of wagons at 0.4–1.0 × `lodDist`: high 48–120 m, low 30–75 m) keeps its shadow only on **ultra**;
the wagon body and its cargo still cast, so a wagon never "floats". Cargo on far (LOD1) wagons moves to its own
`cargo-far-*` meshes that never cast (invisible in every shot). Shadow pass: high −14/−24/−26 % triangles at
50/80/110 m, low −27 % at 50 m and −7…−10 % farther; main pass unchanged. Visible on a phone only at 50 m on low
(lighter horses on the road); the LOD1 shadow proxy variant was not chosen. Render only, hashes unchanged.
(decided)

**D-127 — The pace card's fleet kind: a long pickup wait with the whole fleet on the road cues "Kup wóz" (day 9a; mission XI, I at 60 s).**
Why XI's 60 s player never met a wagon cue: XI's bottleneck is three wagons on a 60-cell haul, but no building ever
*stalls* on it — the malthouse "waits for a delivery" (no stall: "(no card)" at 6 of 10 looks), the farm stands with a
full yard in `WAITING_PICKUP` (a wagon is assigned, still on another trip), which is always calm/minor and has no
cure, and `OUTPUT_FULL.NO_DESTINATION` there is calm because the malthouse is full of incoming grain (a wagon would
not help it). `NO_WAGON.ALL_BUSY` appeared once in a whole run. Why I at 60 s got an unusable mud card: at 6:00–7:00
the player holds 60 silver and the cobble stretch costs more (`validateRoad` → `NO_COINS`); the eye opened a sheet
with a disabled button. New kind `fleet` of `paceCard` (`src/ui/paceCard.ts`), same slot rules as D-115 (only when no
real stall needs the card; calm panel, never red): a building of the forecast's **bottleneck chain** (the bottleneck
good and, upstream, its producers' inputs) has stood `WAITING_PICKUP` ≥ 20 s (`FLEET_WAIT_TICKS`), its assigned wagon
is not held (`isHeld`), no wagon idles at a stable and the fleet was on the road (none idle, none held at a bridge)
≥ 90 % of the last minute (`sampleFleet`, one bit per game second, UI-owned `WeakMap` like D-110's wait log, sampled
from the app's `onTick`), the forecast is ready and has an `aim` (a better seal in reach) at least **3:30**
(`FLEET_ROOM_TICKS`) away, a wagon is affordable and would not cost the stone bridge before the ice (`iceBeforeWagon`,
D-117). Card: "Gospodarstwo: pełno zboża od 0:50, wszystkie 3 wozy w trasie — kup wóz" (time in 10 s steps for the
live region); the eye opens the farm's sheet with "Kup wóz −30" and why. A mud card whose cobbles the player cannot
pay for (`NO_COINS`; stone or rank refusals keep it, D-116) yields to the fleet card; with no fleet card it stays.
Each gate was measured (all m1..m13, eye/eye+ 10/30/60 s, scan+, letter+eye+; `tools/balance-night6.ts --no-search`,
new `FLEET=0` and `EYE_PHASE=s` switches): without the room/chain/held gates the wagon cue cost seals in I, II, VI, X,
XI, XII (a late wagon often *slows* these maps — X loses 3★ from one wagon at 4:00 or 6:00); room 150–190 s or 240 s
still lost X; 200–225 s lost nothing. Result (0 seal losses at phase 0, 5 and 20 s): **XI eye 10/30/60 s 2/2/1★
(9,87/10,12/10,94) → 2/2/2★ (9,61/10,07/10,07)**; IV eye 60 s 2 → 3★ (7,34); II eye+ 10 s 2 → 3★, II letter+eye+
2 → 3★; IX/X/XI faster at the same seals; every other row identical. XI's 3★ needs the wagons before ~2:00 (measured:
k wagons at ≤ 2:00 → k ≥ 3 gives 3★; at ≥ 3:00 nothing beats 2★), before the forecast can tell (it needs a minute
of deliveries; XI's first beer reaches the castle at ~4:00). **I at 60 s stays 1★**: after 5:00 no wagon helps in I
(extra wagons at 5:30–9:00 give 11,65–12,00 min, the one-lane bridge jams) — the mud card now names the shortfall
honestly or yields; I's 60 s gap is earlier (see D-128). UI only, hashes unchanged. Test `tests/fleet-card.test.ts`;
shots `docs/shots/day9a-m11-*.jpg` (`tools/day9a-shots.mjs`). (decided)

**D-128 — A long "waiting for pickup" gets "Kup wóz" on its own sheet, under the fleet rule (day 9a; first-10-minutes-c N2; decided by coordinator — owner to confirm).**
Research c: in mission I `WAITING_PICKUP` is the #1 time loss on both end letters and its sheet offered no cure.
Coordinator's call: make a long pickup wait (≥ ~30 s) actionable with "Kup wóz" + the wagon's travel time when every
wagon is busy and one is affordable, calm otherwise. Measured before shipping it as a generic rule
(`pickupCue`: ≥ 30 s, assigned wagon ≥ 10 s away and not held, no idle wagon, affordable, not before the ice):
**as the sheet's cure only — 7 seal losses** (VI, VIII, XII scan 3 → 2★; X eye/eye+/scan/letter 30 s 3 → 2★);
**also lifted out of the calm pins (non-minor ranking) — 21 losses** (IV eye 30/60 s 2 → 1★, VIII 3 → 2★ at 30/60 s,
XII 3 → 2★ …); adding the fleet-busy share and a "3:30 before 2★" gate still lost 7. A wagon bought on a pickup wait
mid-game makes several maps slower (dispatcher chaos), so the shipped rule is the D-127 gate: the sheet of **any** yard
that meets the fleet card's conditions (not only the one the card names, `fleetCueFor`) shows "Kup wóz −30" with
"Wóz 2 dojedzie po ładunek za 0:40; drugi wóz odbierze go wcześniej." plus the D-127 reason. Outside it the wait
stays calm and minor, never critical (`isCritical` unchanged: a wagon *is* on its way). Measured: identical to D-127
(0 losses). Mission I's tutorial window (2:00–5:00, forecast not ready) therefore still has no wagon cue on a pickup
wait — **owner to decide** whether to accept seal losses elsewhere for it. (decided by coordinator — owner to confirm)

**D-129 — The tutorial's end closes the sheets (day 9a; first-10-minutes-c N1).** Step 6 leaves the castle sheet open;
in portrait it covered the worst-stall card and the tool rail, so the first stall after the tutorial was invisible.
`host.finish('done')` now calls `sheets.closeAll()` (next to putting the road tool away); a skipped tutorial keeps
the player's own sheet. UI only. (decided by coordinator — owner to confirm)

**D-130 — The loss letter gives one action line for the #1 cause; I's loss letter no longer advises a crossing (day 9a; first-10-minutes-c N3).**
Under "Gdzie stracono czas" a lost contract shows one line for the #1 cause — or, when one of the three listed is
a missing road (no road, unreachable, no wagon can reach, no route), for that one: no wagon helps where none can drive
(a lost I without the crossing listed "Gospodarstwo: pełny magazyn, brak wozu" above "Młyn: żaden wóz nie dojedzie").
The line comes from the cause's kind (`lossActionKey`, `src/ui/stallKinds.ts`):
pickup wait / all busy / full yard without a wagon → "Następnym razem: Gospodarstwo — 4:12 czekania na wóz. Kup wóz
wcześniej (−30)."; no road / unreachable → link at once (the eye shows the stretch); bridge jam/ice → stone bridge or
a second crossing; full granary / nowhere to deliver → granary or link the customer; else "open «Dlaczego stoi?» at
the first stall". The wording avoids gendered verbs (any building name fits). Mission I's authored loss text no
longer says "check that both banks have a road" (pl/en): "Spójrz niżej, co stało najdłużej, i od tego zacznij
następnym razem." Other languages keep their old line until translated. Keys `end.act.*` pl/en (PENDING_KEYS).
Test `tests/loss-action.test.ts`. UI/content only. (decided by coordinator — owner to confirm)

**D-131 — A11y leftovers of day 8d: the disabled "Sprzedaj za 15" reads; the HUD under a letter is out of the contrast count (day 9b; audit F19).**
(a) The wagon card's "Sprzedaj za 15" is really disabled while the wagon has a job, cargo, is loading or moving (the
sim's `sellWagon` rule, `canSell` in `panels.ts`); it was drawn at the kit's 0.6 opacity (2.0:1). Now the kit's
disabled card stays (hatched, `card-disabled`), the card itself at full opacity, the coin icon at .45, and the
label on a parchment plaque (`--kparch`, 2 px spread) in `--ink-soft` — the D-122 "brak N" treatment; the reason
("Sprzedasz go, gdy skończy kurs i stanie pusty") is tied to the button by `aria-describedby`. Audit: 2.05 → none
below 4.5:1. Other disabled kit buttons keep their opacity (no low-contrast report outside this one).
(b) The end letter's 13–14 low-contrast items were all HUD under the letter's scrim (waybill "do śniegu", counts,
the worst-stall card, the tool rail) — already `inert` (`modal.ts`, D-118), so out of the AX tree and dimmed on
purpose; no letter text was below 4.5:1. `tools/a11y-audit.mjs` now flags text inside `[inert]` as `inert` and leaves
it out of `lowContrast` (`inertText=N` in its summary); `tools/a11y-check.mjs` gained an end-letter check (modal,
named, no live text outside the letter). UI/tools only, hashes unchanged. (decided)

**D-132 — The mud stretch to pave has its own ghost: pale setts, not the dirt-road ochre (day 9b; BACKLOG P3 from D-116).**
Checked at 412×915 in mission III's rain (2:50, the mud card's sheet): the ochre road ghost on the wet track read as
one more dry dirt road — visible, but it did not say "cobbles here" (`docs/shots/day9b-m3-mud{,-near}-before-412x915.jpg`).
`RoadPreview.pave` (render API) → `OverlayData.previewPave` → `uPrevPave` in the terrain shader: staggered grey-buff
setts (~0.95 m) with dark joints and an ochre rim; the setts grow in blended octaves with screen footprint, so from
the game's usual height the stretch is a pale stone band and close up it is a laid course. The flat (2D) view draws
the stretch as a dashed pale-stone line. Only the pace card's mud stretch uses it (`nav.setGhost(cells, true)`); the
gap finder and tutorial ghosts are unchanged. Render/UI only, hashes unchanged. Shots `day9b-m3-mud{,-near}-412x915.jpg`.
(decided — owner to look at the shots)

**D-133 — Render #5: instanced parts draw a mirror of each kind's material, with a guard (night 9; coordinator).**
Research `docs/research/2026-11-05-render5-materials.md`: one material per kind was drawn by InstancedMesh (wagons,
cargo, yard workers) and plain meshes (buildings, bridges), so three.js rebuilt program parameters at every switch.
`instancedMaterial(key)` (materials module) is a clone sharing the shader hook and program key; `syncInstanced` copies
maps, defines and alpha state on every base change made in the module (`applyTextures`, `setTreeQuality`), the
texture/quality pre-warm (D-65) lists both (`materialsFor`, `treeQualityVariants`). Parameter rebuilds per render
10 → 6 at 60 m, 10 → 2 at 320 m; `getParameters` allocations −40…−80 %; same program count (44/47/48), pixels
bit-identical (low/high/ultra, winter night). Guard: `instancedMaterial('billboard')` throws (the impostor bake
rewrites that material outside the module), `mirrorDrift()` lists out-of-sync mirrors, test
`tests/materials-mirror.test.ts`. Pixel-identical, so no owner decision needed (owner had asked for shots only
where pixels change). Render only, hashes unchanged. (decided)

**D-134 — The stone-span cure draws the sett ghost on the wooden deck (day 9c; BACKLOG P3 from D-132).**
"Wyłóż most kamieniem" (`cure === 'pave'`: a wagon held at a wooden span, D-105, or the ice ahead outranking a
wagon, D-117 `paveSpanFor`) drew nothing on the map: the sheet only called `setGhost` for the gap finder and the mud
card. The building sheet now passes the span's cells with `pave = true` whenever its fix section is this cure. The
span's cells are water cells under a wooden deck, where the terrain-draped preview (D-132) lies on the river bed,
under the water and the planks — so the render gets a deck ghost (`src/render/deckGhost.ts`, owned by the view,
fed from `setRoadPreview` and rebuilt with the network): one quad per proposed wooden bridge cell, 4 cm above the
deck, 3 m wide, the same staggered grey-buff setts with dark joints and blended size octaves as the ground ghost,
each sett slightly lighter or darker, an ochre rim along the parapets, depth-tested (a wagon on the deck covers it).
Land cells of a proposal keep the terrain ghost; the flat (2D) view already draws the dashed stone line. Shots
mission IV at 1:00 with two wagons bought (the D-117 state): `day9c-m4-pave{,-near}{-before,}-{412x915,915x412}.jpg`.
Open: from the castle's sheet the span is off screen in both orientations at the game's usual zoom (the eye centres
the castle), so the ghost is seen only after a pan — as with the mud stretch, no camera move was added.
Render/UI only, hashes unchanged. (decided — owner to look at the shots)

**D-135 — Research c's N5 ("0 words at three stalls") was the audit reading a sheet mid-fade; the fade itself was broken (day 9c; first-10-minutes-c N5, fix list item 6).**
What the audit measured: after the eye tap it counted the words of every visible text node (`deepVis`: no hidden,
transparent or `aria-hidden` ancestor) and the enabled `.fix-btn`s. Repeating portrait with a diagnostic on an empty
screen reproduced it at once (the first Why sheet): `words 0, letters 18` (only the HUD's numbers), while the
screenshot taken right after shows the full sheet. The sheet was in its entry fade: under swiftshader a frame takes
seconds after the camera move, and CSS transitions only advance with frames, so `getComputedStyle(sheet).opacity`
stayed near 0 for 5–15 s of wall time. The card and sheet were fine — run c's #6–#8 ("pełny magazyn, brak wozu")
offered "Kup wóz" exactly as #5 did; the portrait run lost those wagons to the tool, not to the game.
Found on the way, real: `Sheets.place` added `is-entering` *after* appending the sheet and running `update` and
`syncDock`, which reads `offsetHeight` when a fix dock exists — the sheet resolved at full opacity first, so it
dipped out (toward the entry state) and back in for two frames instead of fading up and sliding in. The class is
now set before the sheet enters the DOM (`src/ui/sheets.ts`), so the 100–250 ms fade/slide is the one the style
guide describes. Side effect for headless tools: a sheet now really starts at opacity 0, and under swiftshader the
compositor starts its fade seconds late, so a DOM audit right after opening reads it as invisible (or, multiplying
opacity, as low contrast) — screenshots are unaffected (a capture forces a frame). Tools: `tools/first10-minutes.mjs`
waits (≤ 30 s) until the top sheet is fully up after every settle, and so does `tools/a11y-audit.mjs`; first10 also
shoots every Why sheet without a fix (not only the first three), writes an `EMPTY SCREEN` diagnostic when a sheet counts
0 words, and ignores elements scrolled out of a scroll/clip container (words, covered targets, overlaps) — run c's
A5 "Ustawienia covers rows XIII / IV–V" was such a row (menu now: no covered target, no overlap). Portrait rerun
with the fixes (`docs/research/shots-first10d/`): no empty screen in 10 Why sheets, every "pełny magazyn, brak wozu"
and "wszystkie wozy zajęte" offered "Kup wóz" (5 bought, run c: 3), mission I **won** at 7174 ticks (run c portrait
lost by 2 breads), "Następna misja" → II. UI/tools only, hashes unchanged. (decided)

**D-136 — Day 9d: the full layout matrix green again (castle 915×412 de/pseudo), the landscape valley events card keeps its open item's actions in view, and quality switches link no program inside a frame (D-65 gap closed).**
*Castle cause chain (`castle|915x412|de`, `|pseudo`).* On a short landscape side sheet (`body.is-short`) the
subject row of the cause chain was one line with an ellipsis, so a long reason ("Warten auf Bretter – der Lieferant
wartet selbst auf Holz", pseudo +40 %) lost its end — the part that says *why*. It now wraps (`overflow-wrap:
anywhere; hyphens: auto`, line-height 1.15) to a second line, padding 4 px so the text clears the card frame; the row
stays ≤ 48 px (44 px measured in de). The waybill's clock pill in landscape was `nowrap` in a `nowrap` head and spilled
13 px out of the 272 px card in pseudo; the pill may now wrap its words (the clock `<bdi>` stays whole) and grows a line
instead. Shots `day9d-castle-915x412-{de,pseudo}{-before,}.jpg`.
*Valley events card in landscape (research sandbox-first-30 B5/P3).* Measured: the card itself never reached the rail
(bottom 322 px, alarm seal 332 px); what lay "under the seal" was the open item's action row scrolled below the
list's fold — an item opened lower in the list (third of three) showed "Odłóż ofertę" cut by the list edge, and its
off-screen rectangle sat on the seal's badge, which the audit read as covered. Fix: when the card opens or another
item opens, the list scrolls the item shown in full so its bottom (the buttons) is inside the visible part
(`EventCard.revealFocus`, only on a focus/open change, so delivery progress re-renders do not fight the player's
scroll); the list's height is now tied to the measured `--rail-h` (ends 14 px above the rail, the badge hangs 2 px
over it) instead of a fixed 156 px. Shots `day9d-valley-ev-915x412{-before,}.jpg`.
*Shader pre-warm on quality switches (BACKLOG P1, render #5).* Cause, from the program cache keys before/after a
low → high switch: (1) `WebGLShadowMap` draws depth with `renderBufferDirect(cam, null, …)` — no scene, so **no fog** —
while the pre-warm compiled every depth stand-in with the scene bound, i.e. with `FogExp2` in the key: the
pre-warmed depth programs were never the ones the shadow pass used. On a high start this went unnoticed because the
first real shadow pass (before the deferred pre-warm) linked them; on a low start the trees do not cast, so the first
high frame linked the tree depth program (plain depth + leaf map, alpha test) and `billboard-depth`. (2) A
`customDepthMaterial` (far-tree `billboard-depth`, horse skin depth) was compiled in its constructed state, while
the shadow pass copies side, maps, alpha test and clipping from the drawn material onto it each draw — a FrontSide,
map-less variant nobody draws. Not the cause: the billboard atlas (128 px cells on low and high, no re-bake) and the
shadow map size (not in the key). Fix in `src/render/prewarm.ts`: depth stand-ins compile with `scene.fog`
cleared for that synchronous call; custom depth materials get the same per-draw state as the shadow pass gives them;
`prewarmMaterialSwap` (used by `View.setQuality`) also compiles the depth variant of every swapped material. Measured
with `tools/render5-materials.mjs` (sandbox, 200 wagons, 412×915, SwiftShader): in-frame links low → high **2 → 0**,
high → low → high **0 / 0** (ultra not re-measured); a low start holds 42 programs instead of 44 (the two fog depth
duplicates are gone). Render/UI only, golden hashes unchanged. (decided)

**D-140 — The fleet cue in the free valley (owner 2026-11-05; research sandbox-first-30).**
The fleet kind of the pace card (D-127) and the yard sheet's "Kup wóz" (D-128) needed a contract, so the valley's most
common state ("czekanie na odbiór", 74 % of the card's time) never got a wagon cue and card-only players reached rank 1
at 14–17 min with 600–1000 silver unspent. Without a contract (`freeFleetGate`, generic: no mission id) the gate drops
the forecast parts (no seal to aim at, `seals = -1`) and keeps the rest — a wagon buyable, none idle, the fleet on the
road ≥ 90 % of the last minute, the yard waiting ≥ 20 s — plus a reserve: silver ≥ wagon price + 40 for the next
building. `sampleFleet` now samples whenever the game runs. Sheet line `fix.paceFleetWhyFree` (pl/en, PENDING_KEYS).
Missions unchanged (their branch is untouched). Research prototype: rank 1 at ~11.3 min, +27 % silver, no failed
purchase. Test `tests/valley-fleet.test.ts`. UI only, hashes unchanged. (decided — owner 2026-11-05)

**D-141 — Queued wagons walk the road back once per change, not per frame (research frame-cost day 9 #2).**
A waiting wagon's slot in its queue (`roads.walkBack` from the head cell, `k × QUEUE_GAP` metres) was recomputed
every frame for every queued wagon (O(k²) per queue; the largest allocator at 200 wagons, 1.2–1.4 MB/s, 5–10 % CPU).
The snap keeps the inputs (cell, slot, heading, road-network version) and the result; it walks again only when one
changes. `jam-diff` (60 wagons, 48 queued, 90 frames): 0 differing pixels. Render only, hashes unchanged. (decided)

**D-150 — Shadow map refreshed every 2nd frame on low and high (owner 2026-11-05, option A; research shadow pass).**
Research `docs/research/2026-11-05-shadow-pass.md` (shots `docs/research/shots-shadow9/`). `Lighting.shadowEvery`
= 2 on low/high, 1 on ultra: the single sun shadow map (no cascades) is redrawn every 2nd frame, at once whenever the
camera pans or zooms (fit target/radius changed) or the sun turned > 0.002 rad since the last refresh; on skipped
frames the map and its matrix stay as last drawn, so only moving casters lag one frame. Shadow draws 61 → 30 (high),
34 → 17 (low), shadow-pass CPU about −50 % (≈ −7…14 % of the frame); a still frame differs in 0.25 % of pixels.
Options B (tighter frustum: no CPU gain) and C (cached static casters: ~150 lines, seam risk) not taken. (decided)

## D-152 — Free-valley rank card (2026-11-05)

Owner decision 2026-11-05 (research `docs/research/2026-11-05-sandbox-first-30.md`, prototype `sbRank` in
`tools/sandbox-first30.ts`): instead of lowering the rank-2 threshold, the free valley gets a **rank card** in the
calm slot of the worst-stall card.

- New pace-card kind `rank` (`src/ui/paceCard.ts`, `rankCard`). Shown only with no contract, a running mission,
  the castle market open, and the next rank still short of distinct goods sold (`sandboxStatus`: `goodsSold <
  next.goods`); the HUD and the sheets already only consult the pace card when the slot is empty or calm.
- It names the next unbuilt producer of an unsold good that the rank allows, in a fixed generic order: farm; mill
  once a farm stands; bakery once a mill stands; fisher; quarry. No mission ids.
- Priority: the D-140 fleet card first (`fleetCard ?? mud ?? rankCard`), the rank card only when there is no fleet
  card — a full yard waiting for a wagon is lost silver now, the rank goal is the longer horizon.
- The card's subject is the castle: its eye opens the castle's sheet, whose "Naprawa" offers "Postaw: <name>"
  (`data-act="rank:<type>"` → `nav.pickBuild(type, castle)`, the ghost by the castle via `buildSite`). The card is
  shown also when silver is short; the button is then disabled with "Brakuje N srebra" (`fix.short`).
- Read-only UI; tests `tests/valley-rank.test.ts` (fresh valley → farm by the castle, read-only; build-order rules
  while driven by the research's minimal plan; never in any contract mission). `valley-fleet.test.ts` now admits the
  rank kind beside the fleet kind.

**D-151 — The free valley opens with the castellan's letter and on the castle (owner 2026-11-05; research sandbox-first-30).**
A new valley ledger (not a continued save, not a debug `?play=` start — the same rules as the contract letters, D-46/D-118)
now shows a short opening letter from Wszebor: no order, no deadline; renown from goods sold at the castle market and
the count of different goods raise the rank, the rank plaque shows what is missing; first step — a farm by the castle
road, the wagons carry its harvest to the market. `buildOpeningLetter` falls back to the i18n key
`letter.valleyOpening` (pl/en, PENDING_KEYS) when the mission has no contract letter, so the letter closes with one
gesture and pauses the game exactly like the contract letters. The portrait start view was an empty meadow (the map's
default orbit target); a new game without a contract now frames the castle footprint and gate (`frameCastleSoon` →
`frameCells`, which keeps the view when the castle is already well inside the free map area, so landscape is untouched
when it already shows it). UI only, hashes unchanged. Shots `docs/shots/valley-letter-*.jpg`. (decided — owner 2026-11-05)

**D-153 — The HUD rebuilds its cards once per state change, the waybill pill once per shown second (research frame-cost day 9 #3, HUD part).**
`Hud.update` ran the stall/pace card (`paceCard`, `cureFor`, `calmWhy`, `JSON.stringify(status)`) and the whole
`updateContract` (pill HTML via `iconSvg` + `tHtml`, milestone texts) on every frame, then let `setHtml` find that
nothing changed. Now a key of what that part reads — world and state objects, tick, the stall-ranking array (replaced
on every command applied in pause, `StallRanking`), pace log, cards flag, language, coins, net version, building count —
skips the cobble gate, the pace card, the stall card and the waybill between ticks; folding sets `contractDirty`.
Inside the waybill the title, the pill and the folded seal keep their own keys (mission/lang; tranche, rounded second,
lang; got/total/second/lang plus the forecast object), and milestone notices build their text only when one fires.
Verified: DOM of `#ui` every 5 s of ×4 play (paused, 200 ticks stepped per snapshot), missions I and XI, before vs
after: identical 24/24 against a second "before" run (the two differences against the first run — pin fade class, a
notice fading out — also differ between two "before" runs). `Hud.update` timed directly in Chromium (1800 calls,
after 2 min of play): mission I 19→12 µs/frame at 1 tick per 6 frames (×1), 42→18 µs at a tick every frame;
mission XI 59→14 µs and 254→72 µs (noisy, −40–75 %). UI only, hashes unchanged. (decided)

**D-154 — No program rebuilds left per render: one instanced depth material, a grass-tuft mirror (research rebuilds).**
Research `docs/research/2026-11-05-rebuilds.md`. three.js draws every opaque shadow caster without its own depth
material with one shared depth material; instanced casters (trunks, shrubs, workers, wagon parts) and plain meshes
alternate, so it rebuilt program parameters at every switch (4 per shadow render at 60 m). Instanced casters now get
one shared instanced depth material (`shareInstancedDepth`, skipped for alpha-tested / A2C materials and meshes with
their own depth material); grass tufts (per-instance colour) draw a mirror of `model-grass` like D-133. Rebuilds per
render high 60 m 6 → 0, low 60 m 4 → 0, high 320 m 2 → 0; render allocations −22 % at high 60 m; same draws and
programs; 0 differing pixels (low/high 60, high 320, winter night), no in-frame links on night/winter/quality switch.
Test `tests/rebuilds.test.ts`. Render only, hashes unchanged. (decided)

**D-137 — The focus ring is painted on chamfered (`.cf`) surfaces too (day 9e; ui audit day 9, P1).**
`.cf` cut its corners with `clip-path` on the host, and a clip-path clips the element's own outline and box-shadow:
the D-123 two-tone ring was computed (`:focus-visible` true, outline 2 px ink) but no pixel of it reached the screen
on any wine button — "Naprawa" (Kup wóz, Postaw jeszcze, Wybrukuj, Wyłóż most), "Jeszcze raz", "Do dzieła",
"Następna misja", exactly where D-118 moves focus. While focused, a `.cf` drops its clip and paints its frame colour
as four corner-cut linear gradients (45°, leg `--c`, the same chamfer); the fill pseudo-element keeps its own
`chamfer-in` clip, so the button looks the same and the ring lies outside it. Unfocused buttons are untouched (no
risk to drop shadows that the clip used to hide). Verified by pixels, not styles: `npm run a11y` now Tabs to the
fix button in XI and reads 20 samples 3 px (ink) and 5 px (outer pale band) outside its top and bottom edges
(ink 20/20, pale 20/20). The docked hint under the button keeps 10 px clear of it so its text does not cover the ring. Shots `day9e-ring-{before,after}-412x915-pl.jpg`. (decided)

**D-138 — Short landscape: the fix's hint docks beside the button; the chain's subject is a plain row (day 9e; ui audit day 9, P2-2/P2-3).**
On a short side sheet the dock (D-100) covered the hint under the button, and for the pace cures that hint *is* the
reason (D-115 "bez przerwy najwyżej 6,7/min", D-128 "Wóz 1 dojedzie po ładunek za 1:19", D-116 "błoto to nie
przestój"). The hint now lives inside the dock in every layout (under the button on a tall sheet; portrait gains
2–4 lines in the dock), and with `body.is-short` the dock is a two-column grid: the button (15 px, may wrap to three
lines; 14 px, column 1.45fr so it stays at 48 px in pseudo) and the hint at 12.5 px, at most three lines (`line-clamp`), so the dock is no taller than
before. The subject row of the folded chain (`.c-first .link.is-self`, a `div` since fa5676f) loses the kit card
frame whose rails touched the letters at 26 px: icon, reason and clock on the parchment over a thin painted rule (a background line, not a border, block padding 3 px: the row is 2–3 px shorter and the root below keeps clear of the dock). The
reason still wraps instead of an ellipsis (D-136). Shots `day9e-fixnote-{before,after}-*.jpg`. (decided)

**D-139 — The Flip cover screen folds the cause chain like a short landscape sheet (day 9e; ui audit day 9, P2-4).**
`is-short` (D-111) needed a side sheet; Flip (360×380, `is-mini`) has a bottom sheet and three links plus the dock
left the root ("PRZYCZYNA") under "Zbuduj drogę". `is-short` is now also set for `is-mini`: the middle links fold
behind "+N", the subject is the one-line row of D-138, the root shows above the dock (`chain-m6`, m3, m11, m13 at
360×380 pl/pseudo, no new layout issue). Shots `day9e-flipchain-*.jpg`, `day9e-flipsheet-m3-after-360x380-pseudo.jpg`. (decided)

**D-142 — The end letter's action line and buttons: under the signature in landscape, under the title on Flip (day 9e; ui audit day 9, P2-5).**
The end letter is three parts in the markup (`.l-words` kicker/title/letter, `.l-record` seals/record/ledger,
`.l-do` the D-130 action line and the buttons), `display: contents` on a tall screen (reading order unchanged). On
a short landscape screen (the D-53 two-column letter) it is a grid: words top-left, record the whole right column,
the action under the signature in the left column — de and pseudo no longer push the buttons past the fold. On Flip
(`is-mini`) the letter is a flex column with the action and buttons right under the title; the castellan's words and
the record follow and scroll, and the ledger keeps its worst cause only. `showModal` (modal.ts) now scrolls the
focused button into view (`scrollIntoView({block:'nearest'})` after the focus without scroll), so the D-118 focus is
never off screen. Won letters follow the same layout ("Następna misja" under the signature / title). Shots
`day9e-lost-{before,after}-*.jpg`, `day9e-won-after-915x412-pl.jpg`. (decided)

**D-143 — A pin hidden under the HUD leaves the Tab order (day 9e; ui audit day 9, P2-6).**
A pin under the rail, the card or a sheet is faded out (`.bubble.is-under`, D-62) but stayed a Tab stop, so a
keyboard focus landed on something invisible. When a pin goes under, its `tabIndex` becomes -1 (0 again when it comes
out); the building stays reachable through the card, the alarm seal and the sheet above it. `npm run a11y` checks it at
915×412 (m1 at 1:30: one pin under the HUD, 0 Tab stops on it in 40 Tabs; 3 before). (decided)

**D-144 — The sett ghost of a mud stretch or stone span is framed once in the free map (day 9e; ui audit day 9, P2-7; owner 2026-11-05).**
Owner decision: when a sheet shows the mud/span sett ghost (D-132/D-134) off screen or under the side sheet, the
camera makes ONE move to frame those cells in the visible map area, like the tutorial's crossing (D-107); a cut, no
glide, under reduced motion. The owner also approved the sett ghost's look as it is. Implementation: `App.go` for a
building whose sheet sets a pave ghost frames the ghost plus the building's gate instead of the D-43 subject glide;
a pave ghost that appears later on an open sheet is framed by `applyGhost`; once per ghost (`ghostFramed`, reset when
the ghost goes), so panning away afterwards is the player's choice. `frameCells` (shared with the tutorial) was
fixed on the way: the camera zoom only sets its goal distance, so the box measured right after it was the old one
and the centring offset came out by the zoom factor; it now scales the offset by the factor instead of re-measuring.
It may zoom out up to 3× for a ghost (2× for the tutorial), and `freeRect` takes an optional box size: the free part
of the map that shows *that* box largest wins (a long flat stretch goes under a short side sheet, not into the tall
column beside it). Measured in 3D (m3 at 2:50, 49 cells): 904×1000 hidden or under the sheet 14 → 0, 412×915 → 0.
Shots `day9e-ghost-{before,after}-904x1000-pl.jpg`, `day9e-ghost-after-412x915-pl.jpg`. (decided — owner 2026-11-05)

**D-145 — The side sheet on a tall unfolded screen is only as tall as its content (day 9e; ui audit day 9, P3-1).**
On 904×1000 the side sheet started under the top bar (layout check) but kept the split dock's bottom edge above the
rail (`body.is-split:not(.is-flex) .sheet`), so a short card (VII, III, a wagon) ended at ~500 px with ~350 px of
empty parchment over the map. That rule now also sets `bottom: auto`: the sheet hangs under the bar, grows with its
content up to the old max-height, and the map under it is free — which is where D-144 puts the ghost.
Shots `day9e-sideheight-before-904x1000-pl.jpg` / `day9e-ghost-after-904x1000-pl.jpg`. (decided)

**D-146 — The cause chain's root stands above the fix dock; the layout check reads it strictly (day 9f; ui audit day 9, P3-5 + day 9e measurement).**
On a short landscape side sheet (915×412) the docked "Naprawa" leaves ~60 px of body; the root (the reason the fix
answers) lay 16–80 px under the dock while the subject row — already named by the title — took the space; unfolding
"+N" scrolled 12 px and left the root under it. Now `revealAboveDock` (sheets.ts, block: nearest, never pushing the
element's top above the body) runs on the chain's last link when a sheet opens or its content is replaced, and
after "+N" unfolds (and once more two frames after opening, unless the player scrolled: a sheet opened while the
layout classes were settling measured a different body); the subject may scroll away above. Same-key refreshes do not scroll (the player's own scroll
wins). After unfolding, focus goes to the root's link instead of the first middle one (a focused link scrolled out
above would hide its ring; Shift+Tab walks back up). The sheet parts now keep focus across re-renders
(`setHtmlKeep`, matched by `data-go`/`data-act`): the stall clock and the unfolded state used to drop focus to
`<body>` once a second. `layout-check` gains check 7 `root-under-dock` (every line of the root's text above the
dock's top, no 40 px edge band) and scenes `chain`/`chain-open` (VI farm); the base build fails it at 915×412
(pl dy=43 open, pseudo dy=16 / 78), this branch passes. The covered check now treats text under the sticky dock
while the body can still scroll down as scrolled under it (as its edge band does). UI only, hashes unchanged. (decided)

**D-147 — Round focus rings on the stall card's eye and on pins (day 9f; ui audit day 9, P3-3).**
The D-123 two-tone ring (pale 2 / ink 2 / pale 2 px) was a square box round the 52 px wax eye and the 48×56 pin.
The eye takes `border-radius: 50%` while focused (outline and shadow follow it); the pin drops its box ring and
draws the same three bands as a circle round its 40 px head (`.bb::before`, scales with minor/wagon pins, tip bare).
`npm run a11y` reads pixels: ink on 12 points of a circle 3 px outside the eye and the pin head, no ink where a square
ring's corners were. UI only. (decided)

**D-148 — Pace fix reasons start with a complete short sentence; English fallbacks get their own direction (day 9f; day 9e D-138 note, ui audit P3-2).**
The note beside the fix button in short landscape is clamped to 3 lines (~60 characters). `fix.paceProducerWhy`,
`fix.paceFleetWhy`, `fix.paceFleetWhyFree` (pl/en, still in PENDING_KEYS, no other language has them) now open with
the reason in ≤ 50 characters ("Najwyżej 6,7/min, na 3 pieczęcie trzeba ≈8,8/min." / "Przez minutę żaden wóz nie stał
wolny."); the rest follows, so portrait and tablet keep the full text from one key. `.fix-note` and the text spans
of `.fix-why` carry `dir="auto"`, and `.sc-text` too (the rank card's line is now plain text so the container's
direction comes from it): an English fallback in ar reads LTR with its full stop at the end. Harmless once
translated (the direction then comes from the Arabic text). UI only. (decided)

**D-149 — Rank card follow-ups: a card-following player test, the bottom sheet's dock clears the frame (day 9f; D-152).**
`tests/valley-rank.test.ts` adds a player who only follows the card: "Postaw: <name>" places the producer at the
ghost (`buildSite` by the castle), the gap road to it is pressed, a fleet card's "Kup wóz" too; the card must lead
farm → mill → bakery and every placement must be valid where the ghost stands. On a bottom sheet (412×915) the
frame's 36 px border image overlaps the body's last 10 px and the dock had 8 px of bottom padding, so a 3-line hint
under the button (the rank card's) ran into the frame; the dock now keeps 18 px there (side sheets and the Flip
unchanged: 904×1000 41 px clear, 915×412 note beside the button). UI only, hashes unchanged. (decided)

**D-156 — Dispatcher 2 "L1": rule A only with a fleet well above the authored one; rule C off (owner 2026-11-05, ~15:00).**
Rules from `claude/w-dispatch2` (D-155): **A** — a job waits for a busy wagon that stands at the source sooner than
the nearest free one (the building shows the calm `WAGON_DUE` "Wóz N przyjedzie po … za 0:12"); **C** — a contract
workshop whose output nobody wants gets no more input. C + A broke the bots' lesson ladders (VIII, X, XII, XIII and
IV-VI: 23 red tests). Research `docs/research/2026-11-05-dispatcher2-lesson-safe.md` (~220 variants, runner
`tools/dispatch2-ab.ts`) found no variant that keeps every ladder and removes the harm of a bought wagon: in VIII one
wagon is the "partial" rung and in X / XII two wagons are the "wrong fix", so any rule that makes wagons stop hurting
also lifts those rungs. Shipped variant **L1** (`DISPATCH2` in `src/sim/logistics.ts`): rule A acts only when the
fleet has ≥ the mission's starting wagons + 2 (`fleetGate`) and the nearest free wagon would drive ≥ 50 s empty
(`minFreeRunS`); rule C is off (`ruleC` stays only for the A/B tools, which flip `DISPATCH2` before a run).
Numbers vs the greedy dispatcher: one-more-wagon survey (13 missions × eye-30/60 × a wagon at 1:00 … 9:00) — slower
runs 56 → 40, lost seals 28 → 19 (C + A: 26 / 4; 5 of L1's 19 are m4's silver-before-ice economics); eye player
without the extra wagon 61 → 63 seals; bot I (`npm run bot`) 8,85 → 7,94 min ★3; balance-night6 (128 rows) 9 seals
up, 1 down (m12 "wagons only", XII's wrong fix 2 → 1★), no win ↔ loss flip, −18,8 min. Every lesson-ladder test
passes unchanged. Hashes: only runs with ≥ 2 bought wagons change — v4 golden 7 of 26, v7 contract golden 9 of 26
(buy2 of m2–m6, m8, m9, m11, m12), dispatcher bench 50/100 from the 2nd sample; with `ruleA = false` all previous
values are reproduced. The v5 save-gate test now samples the first tick a stone wagon is on the road (from 3:00)
and asserts it. `tests/wagon-due.test.ts`: no hold below the gate (m3, m4, m8 with 0/1 extra wagons); with the gate
open (m8 +2) every `WAGON_DUE` is calm, names a busy wagon, offers no "buy a wagon" cure and ends within a minute.
The D-127/D-128 gate of the "Kup wóz" card stays: a bought wagon still hurts in 19 of 193 tries.
Full monotonicity needs a lesson redesign of VIII / X / XII (wagons not a ladder rung) — open. (decided — owner 2026-11-05)

**D-155 — Watch mode (Flip cover): one "tempo" line under the folded seal, the full pace card on tap; i18n round day 9 (owner 2026-11-05 ~14:30).**
On the Flip cover (`Hud.compact`) the rail with the pace card (producer / mud / fleet / rank kinds, `src/ui/paceCard.ts`)
is hidden and its 2-line text does not fit 360 px. While the pace card holds the card slot, one short line now hangs
under the folded seal, below the D-99 "gotowe za M:SS" line (in the free valley under the plaque's seal): "tempo: za
mało ryb" (producer, `{goodGen}` of the bottleneck good), "tempo: błoto spowalnia wozy" (mud), "tempo: kup wóz" (fleet),
"ranga: sprzedaj ryby" (rank, `{goodAcc}`). Amber on the slate ETA plaque, 13 px, one line with an ellipsis; the button
is ≥ 48×48 px and absolutely placed, so the seal does not move when the line comes and goes. A tap opens the card's
subject sheet with the cure (the same `showStall(producer)` as the card's eye). No line on big screens, nor when a real
stall holds the slot (the alarm pins say that), hidden while the valley's rank-up letter shows (it sits under the seal
on the cover; `npm run layout -- --quick` caught the overlap). Keys `seal.tempo.producer/mud/fleet/rank`, translated with the rest.
Same round: all 77 PENDING_KEYS (days 5–9 incl. D-155) and mission I's new loss letter (D-130) translated into de, es,
fr, it, nl, pt_BR, sv, tr, ru, uk, ja, ko, zh_Hans, ar, hi; PENDING_KEYS is empty. Numbers in ar texts are
bidi-isolated (⁨…⁩). Shots `docs/shots/i18n9-*` (`tools/i18n9-shots.mjs`). UI only, hashes unchanged. (decided)

**D-157 — Layout is read at the start of the frame; the "Naprawa" dock height comes from a ResizeObserver (research frame-cost day 9 #3, part a).**
Every 250 ms `App.frame` ran `sheets.update` → `syncDock` (`offsetHeight` of the docked fix) and then `occluderRects`
(`getBoundingClientRect` + `getComputedStyle` of the HUD pieces and the sheet paper) after the HUD, the pins and the
sheet content had written the DOM: a forced synchronous layout, landing in whichever of the two read first. Now the
occluder rects are read first thing in `App.frame`, from the DOM the browser laid out for the last paint, and the
pins use them in the same frame (before: from the previous 250 ms read, so they are not staler). The dock's height is
written by a ResizeObserver on the current `.fix-dock` (it reports after the browser's layout and before paint, so
`--dock-h` still lands in the same frame); `syncDock` only re-targets the observer when the dock element changes, and
measures in place only when a sheet opens or its content is replaced (once, as before) or without ResizeObserver.
A closed sheet's dock leaves the observer. Verified: `#ui` innerHTML every 200 ticks (paused, stepped), 24 snapshots
per scene, mission I, mission XI with the worst stall's sheet open, free valley with a sheet open: after vs before as
equal as before vs before (I 22–23/24 in every pairing, XI 23–24/24; the valley differs run to run in pin positions
from the camera glide — b1 vs b2 0/24 — and the second pair is 24/24). Cost (synthetic frames at ×4, a layout flush
before each frame standing in for the browser's rendering step; ms per 10 s, two runs): XI + sheet `occluderRects`
33.5/32.4 → 5.6/5.6, `sheets.update` 14/14 → 16/15; valley + sheet `sheets.update` 50/65 → 22/19, occluders 6–8 → 6;
mission I without a sheet 6–9 → 5–6. UI only, hashes unchanged. (decided)

**D-158 — Season notices, the plaque and the event card follow the HUD's state key too (frame-cost day 9, rest of D-153).**
`updateSeasons`, `sandboxStatus` + `updatePlaque` (signature string every frame) and `EventCard.update` (two
`JSON.stringify` of the orders and the merchant every frame) ran on every frame. They read the state only, so they
now run when the D-153 key moves (tick, command applied in pause, world, language, …); the plaque also redraws when a
fold cleared its signature, the event card when the player opened/folded it or picked an item (its own dirty flag).
The waybill/plaque `hidden` flags are written on state changes only. DOM verified with D-157 (same snapshots).
`Hud.update` in the free valley, 600 synthetic frames (5 reps, two runs): ×1 12–16 → 5–6 ms (median of reps;
−55 %), ×4 within noise (26–34 → 27–28 ms: a tick lands in 2 of 3 frames, so the key moves anyway).
UI only, hashes unchanged. (decided)

**D-159 — `status.WAGON_DUE` uses `{goodAcc}` in every language; the dispatcher-2 keys are translated (PENDING_KEYS empty).**
pl already said "przyjedzie po {goodAcc}"; en's `{good}` became `{goodAcc}` (the same word in English) so all
15 dictionaries share one placeholder set and case languages (ru, uk, de) can use their accusative. Romance and
Germanic languages use the pickup pattern of `status.WAITING_PICKUP` ("Collecte de {goodAcc} : chariot {wagon} dans
{time}"); `cause.WAGON_DUE` is a short "wagon coming soon". `npm run i18n:coverage`: 0 pending, 0 placeholder
mismatches. Native-speaker review stays with the other agent-written strings. (decided)

**D-160 — A surplus yard's status title follows the calm variant (day 9h; first-10-minutes-e N7).**
The sheet of a full yard nobody needs right now read "Pełno zboża — brak wozu do odbioru" above "Nadwyżka: … Nowy wóz
tego nie przyspieszy." — two answers to "kupić wóz?" in one look. `statusKey()` (`src/ui/stallKinds.ts`, pure) picks
`status.OUTPUT_FULL.surplus` ("Nadwyżka zboża — teraz nikt jej nie potrzebuje") for `OUTPUT_FULL.NO_WAGON` when
`outputSurplus` is `SPARE`, the same test the HUD card (`cause.surplus`) and the calm hint use. `buildingStatusText`
takes the building id (sheet status line, chain links, pins). 17 languages. UI only, hashes unchanged.
Test `tests/day9h-diagnosis.test.ts`; shots `docs/shots/day9h-n7-surplus{-before,}-412x915.jpg`. (decided)

**D-161 — A wagon wait that resolved while its sheet opened keeps "Kup wóz" for 20 s (day 9h; first-10-minutes-e N8).**
The card "Zamek: wszystkie wozy zajęte" opened a castle sheet with no fix: headless, the castle's `NO_WAGON.ALL_BUSY`
in mission I lasts 5–35 s and resolves as soon as a wagon takes the job — at ×4 often between the card and the sheet.
The card was right, the sheet honest, the player left without a cure. `StallRanking` (once per sim tick) now remembers
the last tick each building waited for a free wagon (`ALL_BUSY` with a reachable source, or a full yard that is not a
surplus; UI memory, not state). A sheet with no stall and no other fix shows the wagon cure for `BUSY_MEMO_TICKS`
(20 s) after that wait, with the reason "Przed chwilą czekano tu na wolny wóz — wszystkie były w trasie. Kolejny wóz
skróci następne takie czekanie." Not during the tutorial, not when the ice ahead outranks a wagon (D-117). Alternative
rejected: point the card at another building — the castle *is* the one that waited. UI only, hashes unchanged. (decided)

**D-162 — Every sheet: the body scrolls above the fix dock, never under it (day 9h; first-10-minutes-e N6).**
The sticky dock (D-100) let "Młyn wodny" (the full-yard hint's link) scroll under "Kup wóz −30": a tap on the link
bought a wagon. The dock is now absolute in the sheet's paper below the body (outside the body's scroll clip) and the
body keeps a bottom margin of the dock's height (`--dock-h` from `sheets.ts` minus the 14 px fade) plus 14 px padding,
so its last line clears the fade at the end of the scroll. First done for `is-short` only; the new check then found
"Co to znaczy?" under the docked fix on the portrait bottom sheet (chain scene, pseudo), so it applies to every sheet.
`layout-check`: new `under-fix` check (a body link/button whose middle, where the body
shows it, lies on the fix button), a `full-yard` scene (I at 1:30, farm sheet) and a positive control (the old sticky
dock at 915×412 must be caught). Shots `docs/shots/day9h-n6-farm{-before,,-scrolled}-915x412.jpg`. (decided)

**D-163 — Free valley: the rank card goes before the fleet card from two wagons per producer; rank 1 timing is an economy question (day 9h; first-10-minutes-e V2, V1).**
`paceCard`: in the valley the rank card (D-152) takes the slot ahead of the fleet card (D-140) once
`wagons ≥ 2 × producing buildings` (`fleetEnough`, `FLEET_ENOUGH_PER_PRODUCER`). Measured with the new card-only players of
`tools/sandbox-first30.ts` (`card-10/30/60`, the game's own pace cards and their cures; seeds default/1301–1303): rank 1 at
11.3–12.8 min with 6–8 wagons, **identical with and without the rule** (and for "rank first always", "≥ 1×", "start + 2"):
in 30 min the two cards never compete. The research's reading of V2 was off: after the farm the rank-1 goods requirement
(2) is met, so the rank card has nothing to name; rank 1 waits for **renown 200** (57–112 at 8:00). Even 2× producers + 12
wagons reach rank 1 at 9.7 min (DECENT bot 10.4), so the < 8 min target needs a balance decision (rank-1 renown, sim) —
in BACKLOG for the owner. Browser (`tools/valley-first5.mjs`, 412×915, 8 min): farm after 4 taps, road fix +4 at once,
4 "Kup wóz" from the fleet card, 8:00 rank 0, 7 wagons, 172 silver. **V1 was a tool artifact:** Escape after "Postaw"
closed the new building's sheet (the build tool stays open) and the next tap hit the leaving sheet; tapped directly,
"Zbuduj drogę" works in pause (230 → 226, roads +4). The tool no longer presses Escape over a sheet. UI only, hashes
unchanged. Test `tests/day9h-diagnosis.test.ts`. (decided — measurement; owner question in BACKLOG)

**D-165 — Mission VIII redesigned around one muddy lane that every load crosses (owner 2026-11-05 ~17:40, BACKLOG P4).**
Owner criterion (2026-11-04): wagons alone ≤ 2★, cobbles + 1 wagon 3★ with ≥ 20 s, reasonable player ≥ 2★ at
10/30/60 s and 3★ at 10 s, nothing ≤ 1★. The old map failed it (2 wagons 9,05 = 3★; cobbles saved 13 s because 12
cobbled cells were a sliver of a 47-cell rain road, and the mud card proposed 47 cells — more stone than a granary
holds). Data only (`src/sim/proposals/missions-7-9.ts`, same valley `valley-m8:1301`): the hamlet (farm, bakery,
sawmill) and the castle side (mill, woodcutter, castle) face each other across a 23-cell dirt lane `x=31..53, y=24`
(`M8_LANE`); bread crosses it three times (grain → mill → bakery → castle), planks twice. Rain 1:30–11:00. Contract
40 planks + 40 bread, 240 silver, 7 wagons, deadline 11:00, seals 6:51 / 7:36. Why it holds: wagons shorten the wait
for a wagon, not the crossing; cobbles make every crossing ~2.2× faster in rain. Variant search (layouts, lane 16–30,
fleet 3–12, rain 1:00–2:30, contract 24–44, silver; `tools/m8-ladder.ts` + a robustness sweep over buy/pave timings
and eye phases) picked the region where the margin stays ≥ 30 s for neighbouring settings (dispatcher chaos moves
single runs ±20 s). Measured: nothing 8,64 (1★); wagons only k = 1…7 at 0:00/0:30/1:30 7,71–9,36 (1★), all silver
k = 8 7,23 (2★, −23 s to 3★); cobbles + 1 wagon 5,84–6,22 (3★, +38…+61 s), bot 6,32 (+32 s); eye 10 s 5,95–6,28
(3★), 30 s 6,27–6,66, 60 s 6,43–6,47 (3★). Without the pace card (PACE=0) the eye players only buy wagons → 1★: the
mud card (D-116) and the letter carry the lesson. Golden hashes: only `m8|buy0` / `m8|buy2` (valley-events-live)
re-recorded; every other mission bit-identical (the sim is untouched). (decided)

**D-166 — Two granaries in mission VIII, 8 stone each at the start; the quarry's 8 must still be hauled.**
`STONE_RESERVE` (18) caps what one granary pulls, so a 23-cell lane needs two (a stone yard by the quarry road and the
village granary on the lane). 16 of the 23 stand ready, the rest comes from the quarry four to a wagon (ready ~1:23),
so `NO_STONE` with real numbers and "material needs transport" stay part of the mission. When both granaries are full
the quarry's wait reads as a calm surplus; after paving the D-95 "stone in store" line returns (test covers both).
(decided)

**D-167 — Mission VIII tests follow the lane, not the old numbers.** The ladder bot rungs are nothing (1★) / all silver in
wagons @0:30 (2★) / wagon @0:30 + cobble the lane when 23 stone (3★); the NO_STONE edge test counts 16 → 21 → 23; the
fleet-card test reads 3:10 (when a yard waits with every wagon busy); the WAGON_DUE semantics test samples m4 +2, m3 +3
and m8 +2 together (the redesigned VIII holds only 8 jobs with +2). Menu title/subtitle unchanged (still true); the
letter is rewritten in all 17 languages (agent translations, native review pending with the rest). (decided)

**D-168 — Free valley rank 1 at renown 120 instead of 200 (owner 2026-11-05 ~18:50).**
Research run e / day 9h (`docs/research/2026-11-05-first-10-minutes-e.md`, D-163): a player who follows only the
cards reached rank 1 at 11.3–12.8 min; the brake was renown (57–112 at 8:00), not the cards. `RANKS[1].renown`
200 → 120 (goods 2 and flow 8 unchanged). Card-only players (tools/sandbox-first30.ts `card-10/30/60`, 4 seeds):
rank 1 at 7.7–10.4 min; the DECENT bot 6.8–7.1 min (was 10.4; test window 8–12 → 5.5–9). Ranks 2–4 unchanged.
Sim change for the free valley only (missions have no rank gate); valley hashes move, mission hashes do not. (decided)

**D-170 — Free valley late game: the trading post across the river (owner 2026-11-04, reconfirmed 2026-11-05).**
Implemented per `docs/specs/2026-11-04-valley-trade-post.md` (the spec's D-111). A new map building `tradePost`
(4×4 at (37,58), gate north at (39,57) with a dirt stub; fallbacks (43,58), (33,58), (37,62)) and a
`state.tradePost` slice only in `sandbox` states (last key, so contract states serialize as before). From rank 4 it
buys every good at 125 % of the castle formula with its own saturation (recovering 1 / 10 s), pays into the shared
`market.cents`, counts for renown and flow; royal orders stay the castle's (an owed good is not sold at the post
meanwhile — spec says "only to the castle"; without this the post's 125 % pair took planks from an accepted
order once the castle's in-flight cap was reached). Dispatch sorts (market, good) pairs: owed → price → GOODS order
→ id. `NO_ROAD` until a stable's network reaches the gate, shown as a calm brass pin (`cause.postNoRoad`); the
gap finder offers the road with a bridge. Cannot be demolished. Rank 5 renown 14 500 → 17 000. State v9, migration
v8 → v9 places the post with the sim's `place()` on a clone (id = old `nextId` — wagons share the id counter, so not
always 6 as the spec assumed; no free site → `building: -1`, no post). Save gate checks the slice. Real v8
fixture `tests/fixtures/save-v8-sandbox.json` (pre-v9 build, DECENT 40 min). DECENT gets "road to the trading
post" at rank 4. Measured (`tools/valley-3h.ts`, seeds 1301–1303, 180 min, on top of D-168): DECENT + post R1–R5
6,9 / 20,5 / 39,9 / 73,5 / **117,1** (target 112–126), silver 31 453; without the post R5 **131,7** (≤ 135),
silver 25 023 (+26 % with it); +eye (paves the iced span) 116,3. Idle wagons 90–180 min 1–3 % with the post; the
winter "iced span" card ~15 % of winter bands. Contract goldens (CONTRACT_GOLDEN, V4_GOLDEN, bench 50/100, terrain)
unchanged. Render: own model (closed shutters / open counter, wares, Glina pennant), ice floes and deck frost on
wooden spans while the ice holds (+1 draw call only then). (decided)

**D-171 — "Wąskie gardło": the free valley's bottleneck card, and its place in the calm slot.**
`src/ui/bottleneck.ts` (spec §3, the spec's D-112): UI-only samples, one per sim second, 3-minute ring per world.
Card when the window is full and the mean of workshops waiting for one input is ≥ 1,50 (kept until < 1,10), with
≥ 2 consumers, a placeable producer, and not when half its producers wait themselves (the card names grain, not
flour); cure "build a producer" (or "wagon" when half the waits are `NO_WAGON`). Fleet variant from rank 2: no idle
wagon in any second of the window. The waiting set is `stalls.ts` `waitsForInput`, which since D-155 also counts
`WAGON_DUE` (the research tool `tools/valley-bottleneck.ts` predates it). **Priority in the calm slot:** a real
(non-minor) stall first, then the pace cards (D-140 fleet cue, D-152/D-163 rank card), then the bottleneck card,
then the calm pins. Why: the fleet cue is a yard losing silver now with a one-tap cure, the rank card is the goal the
player is working towards and only exists while goods are missing (early game); the bottleneck card is a 3-minute
structural hint that matters once both are quiet (it appears from ~90 min). The workshop's sheet gets
"Postaw jeszcze: …" via `producerCure` (the D-110 shared card or the bottleneck); Build is highlighted. Measured on
DECENT with the post (tool rule): shown 26 / 27 / 36 % of the 90–120 / 120–150 / 150–180 bands (always grain,
producer), +2 farms 10 / 8 / 5 %, passive and small fleet 0 %. Missions unchanged (D-110 still missions only).
(decided)

**D-172 — A placement never cuts a diagonal road step (sim `validatePlace`) (decided — owner 2026-11-06).**
Research valley-ranks-2-3 F2: the build ghost could put a building on the corner cell of a diagonal road step
(`network.hasEdge` needs both corners free), silently cutting an earlier building off (seed 1301: a second farm by
the castle cut the first). `validatePlace` now returns `BLOCKED` at that corner cell (`cutsDiagonalRoad`) when the
step is drivable and its other corner is not a road (with a road there the orthogonal detour survives). In the sim,
not only in the ghost (`buildSite` calls `validatePlace`), so hand placement is protected too and the ghost shows the
offending cell red. Why the sim is safe: every balance strategy of missions I–VI (all 25, full state hash), the
contract goldens, every mission bot (`bot-m2..m13`, `bot-sandbox` DECENT) and `balance-night6 --no-search` are
byte-identical before/after — no authored or scripted placement cuts a diagonal. (decided by the agent because the
hashes hold; the research's owner question 3 — sim or ghost only — stays open: reverting to ghost-only is small)

**D-173 — A producer cut off from the network gets the road cure.**
A producer whose yard is full with nowhere to go (`OUTPUT_FULL.NO_DESTINATION`) points at the first granary it cannot
reach (`blockedBy` = `cutOffWh`), so the chain ended at an empty granary and the critical card had no cure (research:
3 600–3 700 s "no-cure" per 60 min run). `stalls.ts` `cutOffProducer`: such a producer whose gate is off the stable's
road component makes `gapTarget` return it (sheet's gap finder: `suggestLinkToStable`) and `cureFor` = `road`. UI only.
(decided)

**D-174 — "Kup wóz" for a full granary only when a market takes another load; otherwise calm "rynek nasycony".**
F3: `clogNeedsWagon` proposed a wagon for any full granary holding a load of a sellable good; in a saturated market
(in-flight limit `MARKET.inflightPerGood` per good, price at the floor) the card-only player bought 135–163 wagons per
60 min. Now `granaryLoads` → `wagon` only for a good some market (castle, open trading post) has in-flight room for a
load of and, at the castle, a price above `floorPct`; loads only of goods no market takes → `saturated`: the granary
(and a producer it refuses) is a calm stall (`calmWhy` `marketFull`, brass pin), no cure, sheet line `fix.marketFull`
("Rynek bierze tyle, ile zje — nowy wóz tylko by czekał. Sprzedaj inny towar albo przyjmij zamówienie."). Measured
(card-10/30/60 + the research's `+grow` prototype, seeds 1301–1304, 60 min): wagons bought from a full granary
534 → 24; card-10+grow fleet 137–165 → 36–39 wagons, silver at the end 23–1 066 → 3 718–4 264. UI only.
(decided)

**D-175 — The rank card skips a building the ghost finds no site for.**
F4: seed 1304 has no rock within 10 cells of the castle; "Postaw: kamieniołom" opened a red ghost every minute.
`rankCard` now requires `siteExists` (`buildSite` around the castle, silver aside — the card still shows when silver
is short), memoised per world/type until the network, building count or rank changes, and names the next building in
`RANK_ORDER` instead (or nothing). Measured: `build?fail:quarry` 13 → 0 looks (card-*), 65 → 0 (`+grow`). UI only.
(decided)

**D-176 — A ghost refused for cutting a diagonal road says "Przetnie drogę".**
D-172 follow-up: `validatePlace` answers BLOCKED at the corner cell of the cut diagonal step, which the ghost read as
"a building is in the way". The ghost's reason is now picked by `blockedWhy` (`src/ui/site.ts`, pure, tested): when
the BLOCKED cell is not a road and the exported pure `cutsDiagonalRoad` names the same cell for the ghost's footprint,
the label is `place.cutsRoad` ("Przetnie drogę" / "Would cut the road"). The sim result is unchanged (no new error
kind, hashes unchanged). UI only. (decided)

**D-177 — The ghost's access-road estimate is the sheet's link.**
BACKLOG P3 (day 9h): the ghost priced `suggestConnection` from the stable's gate, the sheet after placing offers
`suggestLinkToStable` (cheapest silver from the stable's network, ties by diagonals, then by drive time from the link
anchor) — "droga 5" vs 4. `suggestLinkToStable` is now a wrapper over `linkToStable(world, target, footprint)`, and
`suggestLinkForSite(world, type, gate, footprint)` runs the same search for an unplaced building: its footprint blocks
cells and diagonal corners as the placed building would, its gate counts as road (`place` lays it). Exact, not "ok. N":
`tests/ghost-link.test.ts` places 40 sites per map (m1 woodcutter, m3 farm, sandbox sawmill) and compares cost and
cells with the sheet. The old nearest-road fallback stays for a map with no stable network. Read-only, hashes
unchanged. (decided)

**D-178 — A calm stall heading the stall list keeps its brass pin.**
D-174 follow-up shots (`docs/shots/day9j-market-full-412x915.jpg`, `-915x412.jpg`, staged by `tools/day9j-shots.mjs`:
sandbox granary full of wood, castle wood price on the floor, trading post wood in flight at its limit — the natural
state needs the 60-min card-only run; no mission reaches it with an idle player). The sheet line "Rynek bierze tyle,
ile zje…" reads well, dark ink with the coin, no fix button. But as the only stall the granary was `stalls[0]` and the
markers drew it as the crimson "worst" pin, although the HUD already treats a minor first stall as no stall (pace
card). Now the worst pin is passed only when `stalls[0]` is not minor. UI only. (decided)

**D-179 — The long fuzz covers every mission.**
`ALL_FUZZ_MISSIONS` (default of `npm run fuzz`) is m1–m13 + sandbox (was m1–m6 + sandbox). The run count stays 50,
so each map gets ~3–4 runs a default fuzz (it prints `missions: m1:3 …`); 50 runs × 6000 ticks take ~54 s, 0
failures. `DEFAULT_FUZZ_MISSIONS` of `npm test` is unchanged (its seeds keep their scenarios). (decided)

**D-180 — A calm stall reads calm in its whole sheet: "Spichlerz pełny — rynek nasycony", ink title, plain row.**
Day 9j shots (D-178 follow-up): the saturated granary's sheet said the calm "Rynek bierze tyle, ile zje…" under a
title "Spichlerz pełny" in clay and the "60/60 — brak miejsca na odbiór" row on the wine-barred `panel-alert` — the
same mixed message D-160 fixed in words for the surplus yard (whose row kept the red bar too). Now `statusKey`
(`src/ui/stallKinds.ts`) gives `status.STORAGE_FULL.saturated` ("Spichlerz pełny — rynek nasycony" / "Granary full
— the market is saturated", 17 languages) when `granaryLoads` is `saturated`; the sheet's status line, the chain
links and the pin's accessible name all read it through `buildingStatusText(…, id)`. For any stall with a calm
reason (`calmWhy` ≠ null: surplus, saturated market, room in another granary, filled order, stone in store, the
trading post's road) the sheet uses calm styling: status line `.calm` in ink, the full row `.full-hint.is-calm` on the
plain `panel` (count in ink, no wine bar), a calm chain root `.link.is-root.is-calm` (brass hairline, ink icon, the
"przyczyna" tag in dark brass — the cause is still named), the chain header's stall time in `--ink-soft`, and a full
granary's capacity bar in brass instead of clay. A real full granary (a market takes a load) keeps every red cue.
`marketTakesLoad` / `granaryLoads` move from `stalls.ts` to `stallKinds.ts` (re-exported) so the pure status title
can read them without a cycle. Test `tests/valley-cures.test.ts` (title with/without the world, unsaturated). UI only,
hashes unchanged. Shots `docs/shots/day9k-{before,after}-{412x915,915x412}.jpg` (`tools/day9k-shots.mjs`). (decided)

**D-181 — The alarm seal is crimson wax only while a real stall stands.**
D-115 put the pace card on the plain panel ("calm, never red") while "the alarm seal keeps cycling the calm pins",
and D-121 made the scalloped wax rim the shape of "critical". But the seal itself stayed the crimson `seal-alert` with
only calm pins on the map (landscape and portrait, `day9k-before-hud-*`): the loudest object on screen for nothing to
do. Now `.alarm-seal.is-calm` when every ranked stall is `minor` (D-178's test): a smooth parchment disc with a brass
rim and a dark-brass icon (CSS radial gradient, the family of the HUD chips' medallions and the brass pin — smooth =
lesser, no new sprite); the badge still counts the stalls and a tap still cycles them. Any non-minor stall turns it
crimson again. Likewise a calm stall heading the stall card when no pace / bottleneck card claims the slot gets
`.stall-row.is-calm` — the pace card's plain panel and ink kicker (it was the wine-barred alarm panel); the card's
signature now includes `minor`. UI only. Shots `docs/shots/day9k-{before,after}-hud-{412x915,915x412}.jpg`. (decided)

**D-182 — Audit of calm states shown red (day 9k).**
Grepped every colour decision on `crit` / `minor` / calm (`stallKinds`, `stalls.rankStalls`, `markers`, `hud`,
`panels`, `main.css`): pins were already right (calm → brass and smaller, crit only when not calm, worst only when
not minor, D-178). Fixed here: the sheet (D-180) and the seal/card (D-181). Left open (BACKLOG day 9k), because they
are calm-ish but not "nothing to do": (a) `minor` stalls without a `calmWhy` — `WAITING_PICKUP`, a full yard whose
customer still takes it (`outputCustomer`), an input a season slows — keep the clay status line and the wine-barred
full row in the sheet, although their pin is brass; (b) the stall card's kicker still says "Najgorszy zastój" over a
calm stall (needs a key, e.g. "Postój"); (c) a wagon held by seasonal ice keeps the clay status line (a stone bridge
is a real cure); (d) the codex fold already reads its calm variant (D-98), nothing to do. (decided)

**D-184 — A calm stall heading the stall card gets a calm kicker (D-182 item b).**
D-181 gave the card headed by a `minor` stall the pace card's plain panel, but the kicker above it still said
"Najgorszy zastój" — an alarm word over a yard that only waits for pickup. New key `hud.calmStall` (pl "Postój",
en "Waiting", 15 more languages as agent translations, native review pending with the rest); the kicker follows
`w.minor` in the same branch that toggles `.is-calm`, and the unconditional `hud.worst` reset before the signature
check is gone (pace and bottleneck signatures differ, so the kicker is always rewritten when the card changes kind).
UI only, hashes unchanged. Shots `docs/shots/day9l-after-{412x915,915x412}.jpg` (`tools/day9l-shots.mjs`, mission
III at 1:00: two calm stalls, no pace card). (decided)

**D-185 — Playtest fixtures play the real sim to the stall, then pause and validate (`?fixture=`).**
PROTOCOL §3 asked for deterministic, debug-only setups for S2/S3/S4/S6 instead of `ff` guesses and console state
edits. `src/game/fixtures.ts` holds one script per fixture: the mission's own seed, commands applied at tick
boundaries (the same `Command`s a player sends), `step()` until the scenario's predicate has held 1 s in a row,
then `checkFixture()` (status, `checkInvariants`, `unexplainedStalls`, mission running, scenario-specific checks such
as a reachable source for ALL_BUSY or an unreachable destination for NO_ROUTE). No state is written by hand, so the
ledger is true by construction. The app runs the script through its own `GameLoop` (commands in the journal, ticks
via `tickOnce`, HUD and dead-end letter quiet as during `ff`), pauses, and publishes `window.__marchia.fixture`
(`ok`, `problem`, `version`, `tick`, `focus`, `hash`) even without the full debug handle. The stop is found by a
predicate but is deterministic: the same tick and hash headless and in Chromium; `tests/playtest-fixtures.test.ts`
pins tick + subject ids (the numbers the protocol quotes) and checks rerun, GameLoop path and journal replay give
the same hash. `FIXTURE_VERSION` (1) goes into the results CSV (`fixture_id`, `fixture_version`, `fixture_hash`).
Gate: `debug=1` or the Vite dev server, like the D-51 handle; without it, with an unknown id, or when validation
fails, a red notice ("Nieprawidłowe przygotowanie … invalid_setup=1", one tap clears it, key `fixture.invalid`
pending translation) and `console.error` — never a silent fallback to a different state. S2 uses the player's
`demolish` on one free span cell on a loaded wagon's route (stop 39.4 s, wagon 12); S3 and S4 need no commands
(mission II as dealt reaches ALL_BUSY at 159.5 s, bakery 9, and a real oncoming BRIDGE_JAM at 98.2 s, wagon 11).
(decided)

**D-186 — A fixture page never touches the save store.**
Any URL with `fixture` makes the whole page session `noSave`: no autosave (interval, hidden page, chronicle), no
`deleteSave` (end letter, restart, "start afresh", valley ledgers), no legacy-slot adoption, no best result in the
profile — whatever the participant taps afterwards, including "Again" or the menu. One flag at the write points of
`App` (`dropSave`, `autosave`, `recordContractResult`), not a separate store: the fixture is a disposable debug
state, and the participant's real contract saves on the same phone stay as they were. `tools/playtest-shots.mjs`
checks that the store is empty after `pagehide`. Plain `?play=` keeps its old behaviour (it still autosaves). (decided)

**D-187 — `openId` / `wagonId` open an exact card; `open` / `wagon` unchanged.**
The protocol's preflight needs the fixture's subject, and `open=type` / `wagon=jam` fall back to the first match or
the first moving wagon. New params take an exact building / wagon id and do nothing when it does not exist (no
fallback). Moderator only, never in a measured trial (the open card gives the answer away). (decided)

**D-188 — S6 (`warehouse-full`) cuts the castle road: mission I cannot fill its granary otherwise.**
Probed headless: with the lesson's bridge and 0–4 extra wagons the castle takes every plank and loaf it still lacks,
the mill outruns the farm and the bakery's flour surplus is ~2.5/min, so the granary stays empty or below 10 units
until the win or the 12-minute snow; removing the woodcutter makes it worse. The fixture therefore builds the bridge,
buys 4 wagons and demolishes one cell of the castle's spur `(72, 50)`; planks, bread and spare flour then go to the
granary, which reaches STORAGE_FULL (stock 35 + 25 on the way = 60, the sim's and the card's "60/60") at 612.5 s.
Honest cost, written into PROTOCOL S6: the worst-stall card names the castle ("brak dojazdu do zapasów"), the
contract stands at 0/30 + 0/20 with 1:48 to snow, so a neutral question will likely be answered with the cut castle
(the true root of the pile-up). The old console fixture (60 grain written into a fresh m1) was cleaner to look at but
false ledger-wise and carried its own confound (no bridge). Whether S6 counts toward the main metric is an owner
decision (BACKLOG). (decided; S6 scoring: owner)

**D-189 — A hidden moderator screen starts the playtest setups on the APK: a 3 s press on the menu title.**
The APK has no address bar and `chrome://inspect` is not guaranteed on the study phone, so the protocol's starts
(T1, S1–S9; S2/S3/S4/S6 as the D-185 fixtures) are a list on a sheet (`src/ui/playtestSheet.ts`). Gesture: one
finger held **3 s** on the menu title (moves > 12 px, a second finger or lifting cancel it). Chosen over "7 taps on
the version line" because the menu has no version line and a long hold on a non-interactive heading is never part
of play; the title gets `user-select: none` + no context menu so the hold does not select text. No visual hint, no
haptic. A start reloads the page with the protocol's own query + `lang` + `debug=1` + `pt=<scenario>`
(`pid`/`dev` = participant code P01–P08 and a device note): every trial starts from a fresh page, exactly as the
documented URL would. `pt` makes the page `noSave` like `fixture` (D-186), so URL starts (S1, S5, S7–S9, T1) also
leave the participant's saves and profile untouched; plain `?play=` keeps autosaving. The screen is localized in all
17 languages like every other debug surface (`?diag=1`), so the i18n gates stay without exceptions; `fixture.invalid`
is translated and `PENDING_KEYS` is empty again. (decided)

**D-190 — The game fills only what it measured; a results row with five `auto_*` columns.**
"Copy results row" puts one CSV row into the clipboard (fallback: a selected read-only text field) in the order of
`docs/playtest/results-template.csv`. Filled by the game: `participant_id` (P01–P08 only, never free text),
`device` (note, one line ≤ 60 chars), `apk_commit` (git short sha via Vite `define __BUILD_SHA__`), `scenario_id`,
`setup_url` (the protocol query, no `pt` markers), `setup_method` (`fixture|url`), `invalid_setup=1` only for a
failed fixture validation, `taps`, `opened_why`, `opened_wagon`, `ff_seconds`, `speed_mode`, `fixture_id/version/hash`.
Time to the first "Dlaczego stoi?" card and the first fix are not `time_s`/`action_correct` (those are the
moderator's verbal T0→T1 and judgment), so they go into new columns appended to the template: `auto_first_touch_s`
(page ready → participant's first touch = hand-over), `auto_why_open_s` (first touch → first card of a stalled
building or waiting wagon), `auto_first_fix` (first command the sim accepted after the first touch: `road:dirt`,
`road:cobble`, `place:<type>`, `demolish`, `buyWagon`, …), `auto_outcome` (mission result) and `auto_focus_status`
(the fixture subject's status kind). Counting stops when the page leaves its first game (menu, "Again", next
mission). Every other column stays empty. Cells are RFC 4180-quoted and a leading `= + - @` is defused.
`tests/playtest-row.test.ts` pins the header, the fields and the protocol queries. (decided)

**D-191 — Playtest screen in the steward's ledger style, checked by a browser script.**
The sheet reuses the valley-ledger entry (`.slots`, folio code in the margin, ruled rows, 64 px targets), the
segmented P01–P08 control (4×2, 48 px), a 48 px parchment input and the wine primary button; the query is small
monospace, the fixture tag a wine underline — no new kit pieces, no cards. `tools/playtest-picker-shots.mjs` checks
on a build: 1.2 s press opens nothing, 3.3 s opens the screen, S4 reloads into `pt=S4&fixture=bridge-jam`, the copied
row has the template's columns and the measured fields, and the save store stays empty
(`docs/shots/playtest-picker-{menu,starts,copied}.jpg`). (decided)

**D-192 — Free valley "rozbuduj": the grow card names one more producer when the next rank lacks only renown (decided — owner 2026-11-06).**
Research valley-ranks-2-3 F1 (`docs/research/2026-11-05-valley-ranks-2-3.md`, prototype `+grow`): a player who follows
only the cards reached rank 2 at ~31 min and rank 3 at 65–72 min with 2 700–2 900 silver idle, because once the goods
were sold no card ever asked him to grow a working chain. New pace-card kind `grow` (`src/ui/paceCard.ts` `growCard`):
free valley, rank ≥ 1, the next rank's goods sold **and** flow reached, renown below; silver ≥ price + `FLEET_FREE_KEEP`
(40, the fleet card's reserve: the card spends idle silver, never the last of it, so it is never shown disabled). It
names one more producer of a chain that already stands — bread `farm → mill → bakery`, `fisher`, planks
`woodcutter → sawmill` — keeping ratios (farm ≤ mill, mill < farm, bakery < mill, woodcutter ≤ sawmill, sawmill <
woodcutter), fewest built first, ties upstream first; not when the chain's end good (what its most downstream standing
building makes) is saturated — saturation ≥ half of `MARKET.cap` or a full granary holding a load of it no market takes
(D-174 `granaryLoads` = `saturated`); a type without a site by the castle is skipped (D-175 `siteExists`). HUD: kicker
"Droga do rangi" (as the rank card), "Do rangi 2 (…) brakuje już tylko renomy — postaw jeszcze: Drwal"; watch-mode seal
"ranga: więcej {goodGen}"; the castle's sheet: "Postaw jeszcze: …" (`fix.producer`) + `fix.growWhy` (renown n of m,
the market still pays a fair price); the button opens the build tool with the ghost by the castle (as D-152).
**Priority:** last among the calm-slot cards — real stall → pace cards (fleet D-140, rank D-152/D-163) → bottleneck card
(D-171) → grow → calm pins. Why: the fleet cue is a yard losing silver now; the rank card and the grow card never meet
(goods missing vs goods met); the bottleneck card is a measured shortage that names the right producer, while the grow
card only keeps ratios, so it yields (`paceCard` returns grow only when `bottleneckCard` is null).
Measured (`tools/sandbox-first30.ts` card-10/30/60, seeds 1301–1304; before = base `c7ad33d` 90 min, after 60 min):

| player | R2 before → after | R3 before → after | silver @R3 before → after | wagons @R3 before → after |
|---|---|---|---|---|
| card-10 | 30,3–31,8 → 23,2–24,1 | 64,7–71,9 → 38,8–40,0 | 2 724–2 807 → 1 411–1 584 | 12–13 → 30–35 |
| card-30 | 30,5–31,4 → 23,8–24,9 | 66,1–71,1 → 39,5–42,0 | 2 774–2 901 → 1 813–2 070 | 11–13 → 23–28 |
| card-60 | 31,3–32,4 → 26,6–28,5 | 65,9–71,7 → 46,6–54,6 | 2 754–2 892 → 2 369–2 561 | 10–12 → 15–18 |
| DECENT | 20,2–20,7 (same) | 39,3–40,4 (same) | 1 891–1 924 (same) | 23–25 (same) |

Impossible cures (`build?fail` / `grow?fail`): 0 before, 0 after; no-cure card seconds 0–1. Outlier card-60 seed 1303
(R3 54,6): from minute 33 bread, planks and fish all sit at 18–23/24 saturation, so the card stays silent by design
(more of the same would only fill granaries). card-10 lands on the window's lower edge (like the bot) and builds up to
8 fishers (a one-building chain grows fastest under "fewest built first"; the fish price gates it). `tools/valley-ranks23.ts`:
renown stays the binding requirement in every run, renown/min 1→2 ~40 → 46–63, 2→3 ~57 → 76–133. UI only: the sim is
untouched, DECENT and every mission hash unchanged. Tests `tests/valley-grow.test.ts`. Shots
`docs/shots/valley-grow-{card,sheet,ghost}-412x915.jpg` (`tools/valley-grow-shots.mjs`, staged state).
Owner question: ship the card (UI) instead of lowering renown thresholds (the research's balance alternative takes
DECENT out of its test windows). (decided — owner 2026-11-06)

**D-197 — Playtest S6 "pełny magazyn" moves to mission VI; the `warehouse-full` fixture plays m6 with no commands (decided — owner 2026-11-06).**
FIXTURE_VERSION 1 reached a full granary in mission I only by demolishing the castle's spur road, so the worst-stall
card named the cut-off castle, not the granary (D-188). Owner decision 08:45: S6 belongs in mission VI, where the
full granary is the lesson and `buildable: ['warehouse']` lets the player build a second one. The fixture now plays
m6 as dealt from tick 0 — no command at all — and stops (paused) when, for 1 s in a row: the small granary
(`capOverride` 12, id 4) is `STORAGE_FULL` with its **own stock** at 12/12 (not loads booked on their way in), the
sawmill is `OUTPUT_FULL` with `blockedBy` = that granary, and `rankStalls` puts that granary first as a critical,
non-calm stall (what the HUD's worst-stall card shows). Result: tick 1310 (131.0 s), focus building 4, hash
`052fbbbd66b7d912`; also waiting on it: farms 7 and 8, woodcutter 1; the first letter (24 bread by 06:00) is open,
castle 6/24. `checkFixture` checks the same (plus `calmWhy` null and a producer blocked by it), so it works on a
hand-prepared world too. The card's Why sheet chains "Spichlerz pełny" → large granary id 5 "Brak drogi do bramy"
with the "Zbuduj drogę: 2 srebra" cure — the sim's true root (no reachable room); success in PROTOCOL counts
building a second granary or connecting the large one, not buying a wagon. Known: granaries 4 and 5 tie on stall
time (both from tick 0) and the ranking's lower-id rule picks 4 — deterministic and pinned by the test. `fixtures.ts`
now reads `rankStalls`/`calmWhy` from `src/ui/stalls.ts` (pure reads, no DOM). The moderator start list (D-189) shows
S6 under mission VI; a test ties each fixture start's mission to `fixtureMission`. S6 overlaps S9 (same mission,
same granary): PROTOCOL says not to give both to one participant. Shots `docs/shots/playtest-warehouse-full{,-card}.jpg`.

**D-193 — Calm everywhere: every brass-pinned stall reads calm in its sheet (D-182 item a; decided — owner 2026-11-06).**
Owner decision 2026-11-06 ~08:45: "calm everywhere". The `minor` stalls without a `calmWhy` — a pickup whose wagon is
already on its way (`WAITING_PICKUP`), a full yard whose customer still takes the good (`outputCustomer`), an input
the season slows (`seasonalSupplier`) — had brass pins and a calm HUD card (D-181/D-184) but a wine "Dlaczego stoi?"
kicker, a clay stall time and the wine-barred full row in the sheet. New pure read `quietStall` (`src/ui/stalls.ts`):
`calmWhy` ≠ null, or (not a shared-producer / held-span card) a `WAITING_PICKUP` whose wagon is not itself held
(`isWagonWait`: bridge jam, ice, no route — then the root is a real wait and keeps its clay), or `calmStall`. The
building sheet, the full row (`fullHtml`) and the capacity bar use it instead of `calmWhy`; the sheet kicker gets
`.kicker.is-calm` (ink-soft; `Sheets.place` clears it when the sheet navigates to other content). A pickup wait gets
a calm line under the chain: `fix.pickupDue` "Wóz 1 już jedzie po ładunek — będzie za 0:10." (`wagonEta.toDest` when
the wagon's destination is this yard, else `fix.pickupOnWay` without the time; 17 languages, 15 agent translations
for native review); not when the fleet cue shows, whose own hint already names the ETA (`fix.paceFleetEta`).
"Kup wóz" stays only where the fleet card offers it (D-127/D-128/D-140): a calm sheet drops a `wagon` cure from its own
chain (a full yard whose customer waits on busy wagons) and the sheet then consults the fleet cue as before; the HUD
card headed by a `minor` stall no longer lights the rail's "Kup wóz" from `cureFor` either (the fleet card still
does). A `WAITING_PICKUP` has no own cure, so the D-128 sheet "Kup wóz" for a long pickup wait still appears whenever
the fleet gate holds (test). Codex fold unchanged (`codexCalm` stays on `calmWhy`: the WAITING_PICKUP entry already
says "wait for the wagon"). UI only: `tools/balance-night6.ts --no-search` output identical to the base, sim hashes
unchanged. Tests `tests/calm-sheet.test.ts`. Shots `docs/shots/day10a-{before,after}-{412x915,915x412}.jpg`
(`tools/day10a-shots.mjs`: mission II at 0:45, the farm waiting for wagon 1).

**D-200 — Workers at the late-chain yards and the open trading post; legs and torso batched per clothing variant (graphics polish 10, owner direction 2026-11-06).**
The quarry, charcoal burner, malthouse and brewery had no one in the yard, the open trading post an empty counter.
Five new rig kinds in the D-101 pattern (instanced legs / torso / arms, posed per frame, at rest while the building is
not WORKING): `mallet` — a stone cutter at a new splitter's block on the quarry floor (groove, four wedges, chips),
driving the wedges with a short iron sledge (1.3 s); `rake` — the collier at the foot of the kiln mound, by the ladder,
drawing earth over the vents (4.2 s; the leaning rake prop went, he carries it); `shovel` — the maltster at the end of
the steeping tub turning the grain (3.4 s; the tub now shows a heap of steeped grain, the leaning shovel prop went);
`paddle` — the brewer stirring the yard tun with a mash oar (2.8 s); `trader` — behind the open stall's counter,
legs not drawn (they would stand in the wall), leaning on the counter with a hand raised now and then (7 s), drawn
only while `postOpen` (no worker behind closed shutters). Cost rule: legs and torso no longer depend on the kind —
`workerBody(variant)` builds them once per clothing variant and `BuildingsView` keeps one instanced batch per variant
(the arms with the tool stay per kind). A yard with a new kind adds one draw (its arms) instead of three; the bench
sandbox (sawmill, mill, bakery: four kinds in three variants) drops from 13 to 11 worker draws. Worker cycles are
exported (`WORKER_CYCLE`) for the model preview. Test `tests/workers.test.ts` (each new yard's worker, the trader
spot, shared body batches). Shots `docs/shots/gfx10-{before,after}-*` (`tools/gfx10-shots.mjs`).

**D-201 — Malt travels in hooped tubs, not small pale bags (goods by shape).**
At game distance the malt load (twelve small pale bags) read as the grain sacks or the flour sacks — same pale lumps.
A unit of malt is now a squat open tub of staves with two dark hoops, heaped with amber kilned malt: a low round drum
with a bright dome, apart from the upright grain sacks, flat flour sacks, bread baskets, fish creels (tall, tails),
charcoal (black upright sacks), barrels lying (beer) and grey blocks (stone). Same slots, same unit count; the yard
pile at the malthouse uses the same unit. Shots `gfx10-{before,after}-cargo-*` (the eight confusable loads side by
side on the bench road).

**D-202 — Building looks that change with the rank rebuild at the rank-up, not at the next road.**
`BuildingsView.sync` ran only on a network change; its signature already held the castle level and `postOpen`, but a
rank-up that opens the trading post (rank 4) or adds the castle tower (rank 5) touches no road, so the shutters stayed
closed (and now the trader would stay away) until the player next built something. `WorldView.afterTick` compares a
small integer (castle level × 2 + post open) with the value seen at the last sync and forces the network sync when it
changes (a rank-up: a handful of times per game; no per-tick allocation).

**D-203 — Winter hoarfrost on the buildings, sleet flecks instead of rain streaks.**
In winter the terrain shader frosts the valley pale (no snow cover, no new assets), but every roof stayed
summer-brown: the white valley with brown roofs read as a rendering mistake. The plain-mesh materials of the buildings
(`wood`, `bark`, `thatch`, `stone`, `plaster`) get the same frost: up-facing faces (roofs, wall tops, fence and log
tops, the kiln mound) mix toward the terrain's frost colour by `smoothstep(0.4, 0.8, worldNormal.y)` × `frostUniform`
(view: winter × 0.6, eased with the terrain's winter). The code is always in the programs (one shared uniform), so a
season change links nothing; the instanced users (wagons, cargo, yard piles, workers) skip it by `USE_INSTANCING` —
moving loads are not frosted. Precipitation in winter: the same rain streaks fall slowly, short and pale (sleet and
snow flecks), by uniform values only (`Effects.update(…, snow)`).
Cost (D-200..D-203, `tools/render5-materials.mjs`, sandbox 200 wagons, 60 m, one render): high 1975 → 1950 draws
(−1.3 %), low 1700 → 1675 (−1.5 %); programs high 44 → 46, low 42 → 44 (the frost program and its instanced mirror,
compiled by the pre-warm); night / winter-night / winter-day switches: 0 draw-time links, 0 new programs.

**D-210 — Missions XIV "Węgiel z lasu" and XV "Skład pod zamkiem" in the game, appended after XIII (owner 2026-11-06).**
Owner decision 2026-11-06 ~11:30 on the research `docs/research/2026-11-06-missions-14-15.md`: both missions go in at the
end of the menu as XIV ("Wypal węgiel tam, gdzie drewno") and XV ("Zapas tam, gdzie będzie potrzebny"), names as in the
report. `MISSIONS_14_15` (`src/sim/proposals/missions-14-15.ts`, data only) is registered in `src/sim/missions.ts`; the
`register/unregisterMissions1415()` test hack is gone. `MENU_MISSIONS`/`ROMAN_MISSION` add XIV, XV; save slots follow
the D-36 per-mission pattern unchanged (`contract-m14`, `contract-m15`). Castellan letters (opening, 1-3 seals, loss)
and menu titles in 17 languages (15 agent translations, native review pending). Bots `tools/bot-m14.ts`,
`tools/bot-m15.ts` (ladder 1/2/3, shared runner `runSiteBot`), pages `docs/missions/m14.md`, `m15.md`, golden hashes
recorded for m14/m15 (`tests/valley-events-live.test.ts`; older entries unchanged), smoke, fuzz and the robustness
save/load sweep cover both. Layout scenes and the moderator start list do not enumerate missions: unchanged. Shots
`docs/shots/m14-{letter,lesson}-412x915.jpg`, `docs/shots/m15-{letter,lesson,calm}-412x915.jpg`
(`tools/m14-15-shots.mjs`). (decided)

**D-211 — XIV/XV thresholds: the wrong site with a wagon misses three seals by >= 20 s (owner 2026-11-06).**
Owner: "wrong fix + 1 wagon" must miss 3★ by >= 20 s over the 0:00–2:00 build sweep, the lesson keeps >= 20 s, the
reasonable player (balance-night6 LESSON) keeps >= 2★ at 10/30/60 s and 3★ at 10 s. XIV by thresholds alone: 3★ 8:36 ->
**8:21** (`star3Min` 8.35); the castle-side burner with 0/1 wagon is 8.71–12.04 min over the sweep (>= 21 s late), the
forest burner at 0:00 7.75 min (+36 s), eye 10/30/60 s 7.64/7.59/8.67 min = 3/3/2★. Cost: the forest burner in the sweep
gives 2★ at 1:40 (8.46) and 2:00 (8.67) instead of only at 2:00 (dispatcher noise ±0.5 min). XV could not be fixed by
thresholds (gap lesson -> wrong+1w only 41 s, and D-212 moves the eye player's granary from 0:02 to ~0:45), so data:
second letter 36 -> **40 wood**, due 7:30 -> **8:30**, deadline 11 -> **12:00**, 3★ **7:24**, 2★ **8:36** (castle moved
east and more silver were tried and were worse). Wrong site with 0/1 wagon 8.14–8.52 min (>= 44 s late, often a late
letter = 1★), lesson at 0:00 6.35 min (+63 s), eye 10/30/60 s 6.90/6.86/6.86 = 3★; castle granary 3★ up to 1:50, 2★ at
2:00. Tests `tests/missions-14-15.test.ts` (wrong k=0/1 at 0/40/80/120 s, lesson, eye). (decided)

**D-212 — A full granary of goods nobody wants reads calm (owner 2026-11-06; generic rule).**
Owner: a full granary holding goods no order or market wants now (XV's fish) reads calm, no repair or wagon cure,
consistent with D-160/D-174/D-180/D-193. Pure read `granaryUnwanted` (`src/ui/stallKinds.ts`): `STORAGE_FULL` and every
stored good has no unfilled contract need (any letter — the next letter's goods stay wanted), no consumer building on
the map, no open market taking a load, and is not road stone. It feeds `calmStall` (brass pin, minor), `calmWhy`
`'unwanted'` (card "pełny — tego towaru nikt teraz nie potrzebuje"), `statusKey` `status.STORAGE_FULL.unwanted`, the
sheet's calm line `fix.unwanted`, and `cureFor` (no cure when the granary heads its own chain; a producer of a wanted
good it refuses keeps the "another granary" cure — XV's woodcutters). 17 languages (15 agent translations). UI only.
balance-night6 m1..m15 before/after: m1–m13 identical; XV's reasonable player builds one granary instead of two
(coins at the end 13 -> 50), all 3★. (decided)

**D-213 — Names: "Posterunek handlowy" and "sława"; UI kit rights confirmed (owner 2026-11-06 ~14:30).**
The building across the river is "Posterunek handlowy" everywhere in Polish (was "Punkt handlowy" in the building name
and its lines); the valley's renown is "sława" in Polish (was mixed "renoma"/"sława"). Other languages keep their
current terms (GPT order 66/89 checks them against the glossary). The UI art kit (`public/assets/ui/kit/`) was made
for Marchia; the owner holds all rights (docs/ASSETS.md updated). Text only. (decided)

**D-230 — A wagon without a route never parks on a one-lane span (GPT long fuzz, order 93).**
Fuzz seeds 255 (m2, demolish cell 2937 at tick 2065) and 91 (valley-75, 5 commands, demolish 2823): a road demolished
beyond a wooden one-lane bridge cut the target of a wagon that was **on** the span (255: loaded planks to the castle;
91: an empty wagon returning to a stable that became unreachable). `ensurePath` failed, the wagon stood still on the
span with `NO_ROUTE`, and `bridgeBlocker` kept counting it as oncoming traffic: every wagon at the other bridgehead sat
in `BRIDGE_JAM` forever (the whole economy across the river stopped). Not a reservation leak — the bridge has no
reservation; the blocker is the physical occupant. Fix (`src/sim/wagons.ts`, `leaveSpan`): a wagon with no route (or a
loaded wagon with no destination) whose node is on a span drives to the nearest bridgehead (fewest drivable hops along
the span, deterministic BFS order) and waits there; it keeps `NO_ROUTE` (with its `since`) while doing so, so the queued
wagon's chain reads `BRIDGE_JAM` → wagon N → `NO_ROUTE` (the cut road) for the few seconds it lasts. If the network
changes meanwhile, the normal re-plan takes over. Golden hashes: none changed (`npm test` 550/0 before moving the
repros) — no recorded golden run ever has a wagon lose its route while on a span. Repros moved from
`tests/known-failing/` into `tests/bridge-span-noroute.test.ts` (both fail without the fix). (decided)

**D-231 — fuzz `shrink` counts duration relative to the snapshot start.** `runScenario` runs `sc.ticks` ticks from the
start state while command and failure ticks are absolute; for a snapshot (`valley-75` starts at tick 45000) `shrink`
set `ticks = failure.tick + 1`, i.e. 45000 ticks too long, so an empty scenario "reproduced" a different late failure
("0 cmds"). New pure helper `cutAfterFailure(sc, failTick, baseTick)` in `tools/fuzz-lib.ts` (used everywhere shrink
cuts), `rerundiverge` now reports the absolute end tick too. Checked on the pre-D-230 sim: seed 91 shrinks to the same
5 commands / 8602 ticks GPT found by hand. Test `tests/fuzz-shrink.test.ts`. (decided)

**D-232 — valley-3h `grow` plan: third malthouse at (46, 25).** At (38, 25) its 2×2 footprint covered (39, 25), the
first cell of DECENT's later "road to the trading post" (column x = 39, added with D-170), so the step ended `BLOCKED`
at cell 2439 on every seed — a tool artifact, not a game bug. After the move: plan 63/63, violations 0, rank 5 at
~111 min, earned ~33.4–33.9k (was ~28k without the post) on seeds 1301–1304. (decided)

**D-233 — a granary's "Kup wóz" counts only markets reachable by road (UI, real cue loop).** sandbox-first30
`card-10` (90 min) bought 142 wagons: from 73 min (rank 4, trading post open) every look showed eleven granaries
`STORAGE_FULL` **critical** with cure "Kup wóz", pressed every 10 s. Cause: `granaryLoads` → `marketTakesLoad` saw the
trading post with room for every good, but the card player never builds the river road, so the post is `NO_ROAD` and
unreachable; the castle was at its in-flight limit. A real player pressing the card's button gets the same loop.
`marketTakesLoad(world, good, from)` now skips markets not `reachable` (road component) from the granary's gate (also in
`granaryUnwanted`). Pure read, no hash change. card-10: 142 → 41 wagons, earned 9891 → 9841 (noise), rank minutes
unchanged; card-30/60 identical; balance-night6 `--no-search` identical to the base. The granaries now read calm
"rynek nasycony"; what would actually help (a road to the post) is not named — BACKLOG P2. (decided)

**D-220 — Startup milestones as `marchia:*` User Timing marks; startup and memory probes (perf day 10, owner direction 2026-11-06).**
`startupMark(name)` (`src/platform/marks.ts`, once per name, never read by the game) marks boot, fonts, view-module,
app, menu-start/-world/-sim/-dom/-saves, world, ready, first-frame, textures-<tier> and prewarm-<n>; any DevTools
recording on the APK (chrome://inspect) shows them. `tools/startup-probe.mjs` reads them per fresh browser with the main
thread's CPU per phase (CPU profile aligned to the marks), GL time by kind and long tasks; `tools/memory-probe.mjs`
samples heap after GC, `renderer.info.memory`, programs, DOM counters and draws at the menu, across start → menu →
start cycles and through a 3 h valley. Report `docs/research/2026-11-06-perf-day10.md`. (decided)

**D-221 — Startup: the view chunk loads with the fonts, the shader noise bakes in O(n²), the save list is read while the menu world is built.**
`boot` awaited the fonts (and the dictionary) before it even requested the three.js view chunk; the import now starts
first and is awaited after. `noiseTexture` box-blurred 256² × 4 channels by summing 2r+1 taps per texel (r up to 18,
~250 ms on desktop on the startup path); it is a running sum now — `tests/noise-tex.test.ts` checks the baked bytes
against the old per-texel sum: identical. The menu's save list and profile (IndexedDB) were read only after the menu
world (terrain, models, 70 s of menu sim) was built; the read is started before it and taken by the first
`refreshSaves`, so the I/O overlaps the CPU work; `ready` and the first frame still come after the list (a variant that
drew the first frame before the list made "Continue" appear seconds later under software GL: the pre-warm's compile
tasks ran ahead of the IndexedDB callbacks — not taken). Render pixels unchanged (jam-diff 0). (decided)

**D-222 — A world change disposes everything of the previous world: trees, wagon and worker batches, the road mask.**
`VegetationView.dispose` disposed its instanced meshes but left them in the view's shared tree group, still holding
their instance counts: every world change kept the previous world's trees in the scene and **drawn** — the menu valley's
trees stood in every mission started from the menu (a mission opened by `?play=`, as all screenshots and perf tools
do, never showed it). XII after ten menu ↔ mission restarts: 786 draws per two frames instead of 138, 662 scene objects
instead of 133–142. `WagonsView.dispose` did not free its geometries (horse pose attributes, cargo), `BuildingsView`
kept its worker batches, `RoadField`'s mask texture was never disposed: +5–6 geometries and +1 texture per world change.
Now the tree meshes leave the group and every per-view geometry and the old mask are disposed; restarts are flat in
draws, scene objects, geometries and textures. The trees a mission shows after the menu are now exactly those of a
direct start (harness `prior=m12` check). Render only, hashes unchanged. (decided)

**D-223 — Two per-frame allocators gone: one reused update range per instance attribute, light keys parsed once.**
`markInstances` called `addUpdateRange`, a new `{start, count}` per instanced attribute per frame; a WeakMap keeps one
range object per attribute and puts it back in the (emptied) list — with a single range three.js never merges, so the
upload is the same `bufferSubData`. `Lighting.lerpKey` parsed two hex strings with `Color.set` six times a frame (plus
the rain hemi colour); the keys are parsed once into cached Colors. Mission XII 60 m high 3.68 → 3.35 MB/s allocated
(−9 %), 160 m 2.71 → 2.34 (−14 %); XV −3…−7 %, valley 200 −2…−6 %; `lighting.ts` 181 → 56 KB/s. Pixels identical
(jam-diff). (decided)

## Late valley content (owner decisions 2026-11-06 ~14:30, GPT orders 73 / 74 / 91)

**D-240 — Six rank 4–5 royal orders with story conditions; amounts and rewards from the existing generator.**
`post_shelter` (wood, planks), `post_stores` (bread, fish), `ice_bridge_boards` (planks, wood), `fair_tables` (planks,
beer) at rank 4; `ice_bridge_stone` (stone, charcoal), `fair_provisions` (bread, fish, beer) at rank 5. Quantities,
silver and renown come from the same formula as the 36 earlier orders (no per-template numbers: the generator is the
balance). Optional template fields add the story condition, checked before the draw (no extra RNG use): `post` — the
trading post stands and is usable, i.e. road-connected to the castle (the merchant's `usable` predicate; GPT asked
whether `post_*` needs an open post — yes, otherwise "at the post" is false); `seasons` — `ice_bridge_boards` in spring
only ("after winter"), `ice_bridge_stone` in winter or spring (a season, not a claim that the bridge froze); `fair` —
both fair orders only while a fair is announced or open. Tuned copy: `fair_tables` lost "before the merchants arrive"
because it is drawn for the whole announced+open fair. valley-3h (`orders`, DECENT incl. the post road, seeds
1301–1306, 240 min): all six offered and completed (post_shelter 5/5 in ~12 min like the other wood orders,
post_stores 5/5 ~2 min, ice_bridge_stone 3/3 ~9.5 min, ice_bridge_boards, fair_tables, fair_provisions 1/1 each — the
fair/spring ones are rare by design). Ranks 1–4 identical to the base for decent/orders/eager (seeds 1301–1303; rank 4
at 71.9–74.9 min, inside the 70–90 window of `tests/chains.test.ts`); rank 5 moves by −2.7…+0.9 min (114.0–118.1),
order income 3424–4981 silver vs 3683–4427 before. Valley hashes in tests unchanged; missions untouched. (decided)

**D-241 — Seven chronicle entries for the late valley; `checkChronicle` takes the World for the live road graph.**
`post_connected` (the trading post's gate reaches the castle gate on the live graph — `reachable`, so the World is an
optional third argument; without it the entry never fires), `post_first_sale` / `post_three_goods` (from
`tradePost.sold`, kept apart from the castle's `ledger.sold`), `frozen_bridge` (a wagon is held `BRIDGE_CLOSED` right
now — winter alone does not count), `bridge_thaw` (new condition `after: frozen_bridge`, read from the caller's done IDs,
so frost and thaw are never written in the same call, plus no ice window and no held wagon), `capital_rank` (rank 5),
`flow_record` (`bestFlow` ≥ 200 silver/min, above the rank-5 requirement of 160; a threshold, not a running "record" —
DECENT reaches it at ~78 min with or without the post road). `stronghold_rank_alt` is not a new entry (no duplicate
rank entry): its Polish sentence replaced `stronghold_rank`'s ("Drogi i handel wyniosły…"). DECENT 180 min: post road
73–74 min, first post sale ~75, three goods ~75, frost 108, thaw 110, capital 117. The chronicle test allows up to 40
entries (was 30). (decided)

**D-242 — Shorter menu subtitles for I–V, VII, VIII, XI, XII, XIV and the free valley; VI, IX, X, XIII, XV kept.**
Taken where shorter and as clear (all 17 languages). Kept: VI ("hamuje" is weaker than the stall it names), IX and X
(the proposals were vaguer and sounded alike), XIII ("dla marchii" loses "the whole march"), XV ("Skład bliżej zamku"
gives away the lesson). EN valley: "Grow the valley, no deadlines" (shorter than the proposal). Translations of the new
subtitles, order and chronicle keys are agent work — native review in BACKLOG. (decided)

**D-235 — Build tutorial: a second, optional lesson on a new free valley (GPT order 90, owner 2026-11-06 ~14:30).**
Follows docs/content/tutorial-build.md: the free valley, not mission VI (the doc targets "the first five minutes of a
new valley", and the valley already has a woodcutter, sawmill, roads and a castle to join). Offered once per device
on a **new** valley (`prefs.tutorialBuild`, like `tutorialM1`; a loaded ledger never offers it; `?tut=build` forces it
without the opening letter): step 0 is the doc's "consent" — the note asks and carries "Pokaż"; "Pomiń" ends it with no
change to the world. Then the doc's six notes: (1) build tool → woodcutter's hut → its cost (the ring walks rail →
shelf card → price card), (2) move the preview by the forest, "Postaw" (ring on the ghost's own cost/refusal label),
(3) join the hut to the network — the game itself opens a cut-off building's card with the gap finder ("Zbuduj drogę",
D-100), so the ring goes on that button while the card shows it, else on the rail's Road button, then on the hut's gate
on the map; the note names both ways, (4) open the hut (ring on the hut; passed at once when its card is already open,
which is the usual case after the card's own road fix — we never close a card the player is reading), (5) only if it stalls: tap the first cause-chain link or "Co to znaczy?", (6) "return to the
valley" (ring on the card's close; ends when the card is closed after 2.5 s, or after 12 s). Same engine as mission I:
`BuildTutorial extends Tutorial` (the m1 class now exposes protected hooks — `noteKeys`, `onAct`, `target`,
`scrollsToTarget`, `railNeeded`, `pausedNow` — m1 behaviour unchanged), parchment note, double rule, woodcut arrow; no
scrim, never pauses, never issues a command; only "Pomiń"/"Pokaż" take taps; the game menu, settings, help and the
cleared screen pause its clock. Steps are decided by `nextBuildStep` (src/ui/tutorialBuildSteps.ts, no DOM) from the
live World: the newest woodcutter not in the start baseline, `findPath` from its gate to the castle (any route, built
before or after the note); a hut placed early skips ahead, a removed hut (undo, demolish) goes back to step 1, a road
removed at step 4 back to 3; ends by itself after 5 min active. The finished tool is put away (UI only, like mission
I's end): the build shelf when step 3 begins (it covers the rail in portrait), the road tool when step 4 begins (else
the tap on the hut would draw a road). One camera move per step, as in mission I: the hut (step 4) or its gate (step
3 with the road tool) is brought into the free part of the map — in landscape the valley card lay over the hut. Framing now counts the free valley's town plaque (the second `.waybill-wrap`; `visibleScene` took only the first,
hidden one, so every valley framing ignored the plaque). The note also avoids the valley news card, the seal pace
line, the build shelf and the ghost's gate pin (shared placement obstacles; none of them is on screen in mission I's
tutorial).
The landscape main menu's 21 px row size no longer applies to Settings (it kept its 17 px only in portrait), so Help
and Settings match. Deviation from the doc: the game has no separate
"Dlaczego stoi?" button — it is the card's kicker over the cause chain — so step 5 asks for the chain link or the
codex fold ("Co to znaczy?"), and is skipped at once when the hut works. Tests: tests/tutorial-build.test.ts (step
logic + a real valley: baseline, new hut, connection via the old woodcutter's road, demolish). 9 keys
`tutorial.build.*` in 17 languages (15 agent translations, BACKLOG). (decided)

**D-236 — Help sheet from the pause menu and the main menu (GPT order 78).** docs/content/help.md as one sheet
(`key: 'help'`, src/ui/help.ts): six topics — find the cause, seals, wagons, roads and cobbles, granaries, valley and
ranks — each a 52 px ruled fold with a woodcut glyph from the game's own set (inspect, seal, wagon, dirt road,
granary, castle) and the heading in the display face; one open at a time (the first visit opens "Znajdź przyczynę"),
so a phone shows the list plus one answer. A "Pomoc" button in the pause menu (under Settings; the game stays paused,
the sheet replaces the menu like Settings) and beside Settings in the main menu's foot row (not a `.menu-item`:
Settings stays the last one for the tools). Closes like every sheet (close, swipe down, Back/Escape). Text from the
doc, unchanged except "posterunek handlowy" (D-213). 14 keys (`menu.help`, `help.title`, `help.<topic>.h/.p`) in 17
languages (15 agent translations, BACKLOG). (decided)

## Trading post road card (BACKLOG P2 from D-233)

**D-245 — A saturated granary leads to the unlinked trading post's road; the calm slot gets a "post" card.**
From rank 4, a full granary (`STORAGE_FULL`) reads calm "rynek nasycony" (D-174/D-233) while the open trading post,
not reachable from the granary's gate, keeps room in flight for one of its full loads: `postWouldTake(world, granary)`
(`src/ui/stallKinds.ts`, pure read) returns the post. Then (1) the granary's sheet takes the post as its gap-finder
target: "Zbuduj drogę i most: N srebra" with the D-132-style road ghost, and the reason docks with the button
("Posterunek handlowy za rzeką kupi więcej.", D-138 style — a short landscape side sheet scrolls the lead away);
(2) a new pace card `k: 'post'` (`postCard`, link search cached per network version) names the post itself —
"Posterunek handlowy: kupi więcej niż nasycony zamek — doprowadź drogę z mostem" (`…drogę` when a bridge already
stands), kicker "Droga do rangi", road tool marked as the cure, watch-mode tempo "droga do posterunku"; its eye opens
the post's sheet, which already offers the same road (D-170). Shown also when silver is short (the sheet says how
much, as the rank card). **Priority:** a real stall → producer / payable mud (contracts only) → the rank card when the
fleet is enough (D-163) → **post** → fleet cue → mud → rank → bottleneck (D-171) → grow (D-192). Why: with every
reachable market saturated, one more wagon (fleet cue) only carries loads into full granaries and one more producer
(bottleneck, grow) only fills them faster; the post opens a second market at 125 % once and the card is gone for good
after one tap. The rank card stays ahead because a missing good is the next rank's hard gate and costs one building.
Never in a mission (`contract` → null). Measured (`tools/sandbox-first30.ts --minutes 120 --seeds 1301,1302,1303,1304
--only card-10,card-30,card-60`, the tool now logs `postMin` and presses the post card / the granary's road):
post linked — card-10 never → 72,8 / 69,7 / 72,7 min (seeds 1301–1303; rank 4 at 72,7 / 69,6 / 72,5), card-30 seed
1303 never → 77,5 (rank 4 at 77,3), card-30 1302 72,5 → 71,5; all others identical (card-60 and card-30 1301 linked
the road from the post's own NO_ROAD pin already; seed 1304 never reaches rank 4 in 120 min). Earned (= renown) at
120 min: card-10 14 113 / 14 675 / 13 893 → **16 932 / 17 625 / 16 744** (+20 %), card-30 1303 12 814 → 14 951; wagons
card-10 49 / 47 / 56 → 46 / 43 / 48. Rank 5 is reached by no card player before or after (goods 7/9: the rank card
names no charcoal burner / malthouse / brewery — BACKLOG); renown is no longer what holds them (17 000 needed). Silver
left unspent grows with income (card-10 coins at 120 min 11 664 → 14 639; at 90 min 7 737 → 8 821): the card players
spend only on cards, the post card costs ~50 silver once. balance-night6 `--no-search`: identical output (missions
untouched). UI read only, no hash change. Tests `tests/post-road-card.test.ts`. Shots `docs/shots/postroad-{hud,post,
granary}-{412x915,915x412}.jpg` (staged: valley at 1:00 lifted to rank 4, granary of wood at the floor price;
`tools/postroad-shots.mjs`). (decided)

**D-246 — The trading post's road ghost is framed once like the sett ghost (D-144 extended), and the frame avoids the
valley's plaque and event card.** `setGhost(cells, pave, frameAt)`: a plain road ghost is framed when the sheet asks
(`frameAt` = the post's centre cell, kept in view with the ghost — the gate alone left the building under the sheet).
Fixes on the way: `visibleScene` measured only the first `.waybill-wrap` — in the free valley that is the hidden
contract waybill, so the rank plaque was never an obstacle (the ghost landed under it in landscape); every
`.waybill-wrap` and the event card (`.ev-card`) now count. `CameraRig.focusCell` may move the orbit target off the map
by its own screen shift (`slack`, the last focus's shift; pan/zoom keep it): the post stands on the map's south edge
and the portrait free area is above a tall sheet, so the clamp pushed the post under the sheet. A far ghost (the
castle-to-post road starts on screen and ends ~2 000 px below it) is measured through a steep perspective, so the
first move lands only roughly; once the camera reports `settled()` (glide over, zoom and position eased; at most 3 s)
the same framing runs once more — a no-op when it already fits. Measured in 3D, staged state: 412×915 post centre from
(−259, 2115) (off screen) to (147, 253) inside the free rect l 74 / t 116 / r 412 / b 329; 915×412 ghost and post
between the plaque and the side sheet. Render only, hashes unchanged; layout `--quick` 102/0. (decided)

**D-250 — The valley's rank card also names the charcoal burner, the malthouse and the brewery (ranks 3–4).** BACKLOG P2
(D-245): `RANK_ORDER` (`src/ui/paceCard.ts`) knew only farm, mill, bakery, fisher and quarry, so a card-only player
sold 7 of the 10 goods and stood at "goods 7/9" for rank 5 (Stolica) with renown already near 17 000. The order is now
farm → mill (farm stands) → bakery (mill stands) → fisher → quarry → **charcoal burner** (a woodcutter stands) →
**malthouse** (a farm stands) → **brewery** (a malthouse stands). Why this order: the charcoal burner is the cheapest
(35) and burns the wood the woodcutters pile up anyway (their yards wait for pickup most of the late game); the malthouse
uses the farms' grain; the brewery needs malt, so it comes once a malthouse stands (it may still be named before the
first malt is sold — 60 silver while 10 000+ lie unspent, and beer at base 9 is the dearest good). The rule is unchanged:
only while the next rank still lacks distinct goods sold, only a building the rank allows, never a sold good or a type
already standing, only with a site by the castle (D-175); same card text, sheet button "Postaw: …" and ghost by the
castle as the other entries (no new keys). In practice the card names them at rank 4 (rank 5 needs 9 goods), or at rank
3 when the player sold only 6 goods (seed 1304: before stuck at rank 3 with 6/7 goods all 120 min). UI read only.
Tests `tests/valley-rank.test.ts` (order, brewery after the malthouse, gone once the goods are sold, each placed at its
ghost). Shots `docs/shots/rank5-{hud,sheet,ghost}-{412x915,915x412}.jpg` (staged: valley at 1:00 lifted to rank 4, the
seven goods sold; `tools/rank5-shots.mjs`). (decided)

**D-251 — The grow card (D-192) grows the rank-5 chains too.** `GROW_CHAINS` gains `['charcoalBurner']` and
`['malthouse', 'brewery']` with the same ratio rule (malthouse ≤ brewery, brewery < malthouse); the D-174 saturation
check closes a chain whose end good is cheap. Why: once rank 5 lacks only renown, the fresh goods (charcoal 4, beer 9)
fetch more than a fourth farm or sawmill, and the chain counts are low, so "fewest built first" picks them. Measured
together with D-250 (`tools/sandbox-first30.ts --minutes 120 --seeds 1301,1302,1303,1304 --only card-10,card-30,card-60,
decent`), rank-5 minute (– = not reached; renown at 120 min in brackets):

| player | before (seeds 1301/1302/1303/1304) | after |
|---|---|---|
| card-10 | – / – / – / – (16 932 / 17 625 / 16 744 / 13 608; goods 7/9, 7/9, 7/9, 6/7 at rank 3) | **108,7 / 103,8 / 109,3 / 107,4** |
| card-30 | – / – / – / – (15 202 / 15 767 / 14 951 / 12 188) | – / **117,5** / – / – (16 919 / – / 16 660 / 16 467; goods 9/9) |
| card-60 | – / – / – / – (10 758 / 11 281 / 8 349 / 10 452) | – (11 486 / 12 160 / 8 349 / 12 428; goods 9/9 except 1303) |
| decent | 117,6 / 116,7 / 117,0 / 115,6 | identical |

D-250 alone gave card-10 111,8 / 106,0 / 112,8 / 107,8; D-251 adds 0,4–3,5 min. Goods are no longer what holds any card
player (9/9 everywhere rank 4 is reached); card-30 misses rank 5 by 81–533 renown, card-60 by ~5 000 — renown/fleet, not
the card's knowledge (the slot is held by calm pickup waits 5 000+ s per run, silver piles up unspent: BACKLOG).
card-60 seed 1303 stays at rank 3 on flow (107/120) before and after. Mission hashes (`tools/mission-hashes.ts`, 45
strategies) identical; UI read only. Test `tests/valley-grow.test.ts` (ratios of the new chains). (decided)

**D-254 — Help from the map: a "?" on the game's own cards (owner 2026-11-06 ~21:20).** The building, wagon and
market sheets carry a 48 px "?" in the head, beside the close button, in the display face (no icon from a pack, no
new key: its accessible name is `menu.help`). It replaces the card with the help sheet (D-236) opened on the card's
topic — building → "Znajdź przyczynę", wagon → "Wozy", market → "Dolina i rangi" (`HELP_TOPIC_OF_KIND`,
src/ui/sheets.ts) — like a chain link replaces a card, so Back / close / swipe close it as one sheet and the game is
not paused. Menus, settings and help itself show no "?". Why the head and not the worst-stall card: the question
"what does this mean?" comes up while reading a card, and the head is the one place every card shares without
crowding the pace card on a phone. Test tests/help-map.test.ts; shots tools/help-map-shots.mjs →
docs/shots/helpmap-*.jpg (412×915, 915×412, 904×1000). (decided)

**D-255 — Menu world build: models are merged without clones or JS index arrays, one shore sample per ground height
(perf day 11, BACKLOG P1 D-221).** The ~1,0 s of main-thread CPU between `menu-start` and `menu-world` (SwiftShader
desktop, quiet machine ~0,6 s) went mostly to `kit.ts`: `PartBuilder.add` cloned each primitive with `src.clone()`,
which in three.js first runs the primitive's own constructor with default parameters (a 32 × 16 sphere for every
`SphereGeometry` piece, a 32-segment cylinder for every rod) and copies each attribute twice; every piece also carried
an all-zero `rig` array that was merged and deleted again; `mergeGeometries` builds the index as a JS array and converts
it back (`setIndex(array)`); `BuildingsView.sync` cloned and transformed every part of every building before merging.
Now `add` copies only index/position/normal/uv (plain typed-array slices), the `rig` attribute exists only on rigged
pieces (`build()` zero-fills the others when a model has a rig), and `mergeIndexed(list, mats?, keep?)` merges with
the per-building transform baked in one pass (same `Vector3.applyMatrix4` / `applyNormalMatrix` calls, same index
width rule as three's `arrayNeedsUint32`). `Heightfield.height` evaluated `shoreDist` twice (in `base` and `detail`);
now once. **Bit-identical**: SHA-256 of all 222 model geometries (buildings, props, wagons, cargo, 48 worker rigs, trees,
bridges) and of the merged building / wagon meshes and 1,1 M height samples of four worlds unchanged;
`tests/model-merge.test.ts` checks `mergeIndexed` against `mergeGeometries`. Cold build of all models (tsx) 1110–1254 →
588–746 ms. Not done: the terrain grid (~110 ms, `hf.height` per vertex) and vegetation placement are per world and
already lean; a cache of primitives by parameters was not needed once the clone was gone. (decided)

**D-256 — Lazy wagon rigs and cargo; shared cached models are not disposed with a view.** `Parts` (instanced copies of a
model) accepts a function: the mid wagon rig, the far rig (LOD1) and the cargo of each of the 10 goods (near and far)
are built on first `push`, or after the first frame (`WagonsView.buildPending`, called right before the shader pre-warm
walks the scene, so the pre-warm still sees every mesh). `cargoUnitParts` is cached (it was built twice per view, once
for near and once for far cargo, and again on every world). `WagonsView` 125 → 64 ms of the menu build. `Parts.dispose`
frees the instance buffers and only the geometries it made itself (`geo`: the horse copies with their pose
attributes); the cached models (wagon, cargo, worker rigs) stay uploaded for the next world instead of being re-sent
after every world change. Bounded: memory probe (high, 6 × menu → XII → menu) geometries in XII 62 → 76 and in the menu
77 → 80, flat over all cycles; heap slope unchanged (+0,17 MB/cycle before and after); draws identical (XII 86, menu
140 per 2 frames). Pixels: `jam-diff` 0 px (low 30 wagons 90 frames; high 40 wagons 60 m; high moving clock with the
D-257 lights reverted). (decided)

**D-257 — Time-of-day lights refresh every 2nd frame (owner decision 2026-11-06, BACKLOG P2 allocator).**
`Lighting.update` (sun/hemisphere colour and intensity, fog colour, sky uniforms) and the derived foliage lift and tone
mapping exposure run on even frames only; the clock smoothing still runs every frame. Fresh at once on a world change
and on entering/leaving the menu (`snapEnv`), after a quality switch, after a long frame (> 100 ms: stall, resume from
background) and while the clock catches up a jump (|Δ| > 0,002 of a day: forced time, fast-forward). The lights move
over game minutes, so the one-frame lag is invisible; on unchanged frames three.js sends no light uniforms
(`setValueV3f`). Allocations (`frame9-cost`, high, run 1 / 2): XII 60 m 3,55 / 3,52 → 3,34 / 3,41 MB/s (three.js
render 1144 → 981 KB/s), XV 60 m 2,94 / 2,92 → 2,72 / 2,70, 160 m −2…−4 %. Pixels: identical with a fixed time of day;
with the clock running (`jam-diff` case g, 40 frames) 13 430 px of 376 980 differ, 96 % of them by 1 level, max 12 — all
on shadow edges (the sun direction, and with it the shadow-map refresh, lags one frame). (decided)

**D-258 — With KHR_parallel_shader_compile the menu's programs are requested right after the menu world is built.**
`App.showMenu` calls `view.precompile()` after `setWorld`, before the 70 s menu sim and the save list:
`ShaderPrewarm.request` compiles the scene's colour programs and their shadow depth variants (the same stand-ins as
the full pre-warm) without waiting or forcing the first use; the driver links them while the main thread runs the
menu sim and waits for IndexedDB, so the first frame finds them linked. Guarded: only when the renderer has the
extension (`ShaderPrewarm.parallel`); otherwise nothing happens (a compile there would block before `ready`). Mark
`marchia:precompile` (its phase = the cost of the request). SwiftShader does not expose the extension, so the probes
here show no change; to be measured on the Fold (`ready` → `first-frame`, `?diag=1`). Low risk: the same
`renderer.compile` path as the existing pre-warm; the full pre-warm still runs after the first frame. (decided, to
measure on device)

**D-259 — Build tutorial: the stall is triggered on purpose (owner 2026-11-06 ~21:20, "wywołać celowo").** D-235's
step 5 ("only if it stalls") almost never showed: a joined woodcutter's hut works. A hut placed **before** its road
works too (`WORKING`, its card says "Produkuje") until its yard is full, then stalls for real with `NO_ROAD` — 800
ticks, 80 s of game time. So the lesson now lets that happen instead of hurrying to the road: after "Postaw" a new
step 7 ("Chata pracuje, ale bez drogi drewno nie ma dokąd jechać. Przyspiesz do ×4 i patrz na jej podwórze.") rings
×4 (speed is the loop's, not a sim command — the tutorial still never issues one; the player may also just wait);
when the hut stalls with its card open (the game opened it with the gap finder), step 5 reads the cause with its own
text `tutorial.build.step5road` ("Chata drwala stoi — nie ma drogi. Tak wygląda każdy przestój: …", ring on "Co to
znaczy?"), then step 3 joins the road, step 4 is passed (the card is open) and the coda follows. The diagnosis is
asked once (`whyDone`); if the card was closed while waiting, the road step comes first and reopening the card asks
for the cause; after 90 s active without a stall (never sped up) the road comes first. A hut placed on a road keeps
D-235's flow. Logic in `nextBuildStep` (no DOM), tests in tests/tutorial-build.test.ts (incl. a real valley: a
cut-off hut stalls `NO_ROAD` within 900 ticks); shots `tools/onboard-shots.mjs` → `onboard-s7-*`, `onboard-s5road-*`.
2 keys × 17 languages (15 agent translations, BACKLOG). (decided)

## Valley fame gap (BACKLOG P2 from D-251, research 2026-11-07-valley-fame-gap)

**D-264 — The grow card also shows while the next rank lacks silver flow, and says so; the card players press the
bottleneck card.** BACKLOG P2 (D-251): card-30/card-60 missed rank 5 in 120 min. Research (`tools/valley-fame-gap.ts`)
found two things. (1) The calm slot after minute 40 is held 75–80 % of the time by the bottleneck card (D-171), not by
"czeka na odbiór": `topSubjects` only counted `rankStalls()`, and the scripted card players never pressed that card's
cure. They now do (its eye opens the waiting workshop's sheet: "Postaw: <producer>" by the nearest producer, or "Kup
wóz"); `--no-neck` keeps the old player. A producer born with its gate boxed in is taken back instead of holding the
slot with a critical no-road card (the tool's demolish used the gate cell, which the sim refuses with `IS_GATE`). With
the tool fixed and the game unchanged, card-30 already reaches rank 5 on 4/4 seeds (100,8–109,9). (2) A rank held on
flow alone had no card at all: `growCard` required the flow met ("only renown missing"); card-60 seed 1303 sat at rank 3
for 66 min with renown 8 419/7 200, goods 7/7, flow 107/120 and an empty or calm slot. Now the grow card shows when the
goods are met and renown **or** flow is short; `PaceGrow.short` is `'flow'` whenever the flow is short (the rarer gate),
else `'renown'`, and the card/sheet text follow it: `cause.paceGrowFlow` "Do rangi {rank} ({rankName}) brakuje przepływu
srebra — postaw jeszcze: {name}", `fix.growWhyFlow` "Przepływ {flow} z {need} srebra na minutę…" (17 languages). Why
not a new card: more producers raise flow exactly as they raise renown; one card, same slot order (last, after the fleet
cue and the bottleneck card), same button. Shots `docs/shots/fame-{hud,sheet}-{412x915,915x412}.jpg`
(`tools/fame-shots.mjs`: valley at 1:00 staged at rank 3, renown 8 000, best flow 100/120). Test
`tests/valley-fame.test.ts`, `tests/valley-grow.test.ts` (gate updated). (decided)

**D-265 — When every standing chain is saturated, the grow card names a good never sold.** Bread, fish and planks
saturate (≥ ½ cap) long before rank 5, and the D-174 check then closes every standing chain; the producers of charcoal,
malt and beer — goods the valley never sold, paying the full price — were named only by the rank card, which is gone
once the goods count is met. Now, when no chain qualifies, `growCard` falls back to the rank card's own order
(`RANK_ORDER`: a producer of a good never sold, type not standing, input's maker standing, allowed by the rank). Same card
and text ("postaw jeszcze: Węglarz"). Why the rank order: it already encodes cheapest-first and the input dependencies
(D-250), so the two cards cannot disagree. (decided)

**D-266 — In the free valley the build ghost prefers a site a road can reach; the rank and grow cards count only
such sites, by the castle first.** Late in a busy valley (90+ buildings) `buildSite` returned the first valid site, which
could have its gate walled in by neighbours: the rank card named the brewery, the building was born cut off, and
card-10 seed 1304 stayed at rank 4 with goods 8/9 (257 failed placements). `buildSite` now, only when `rankGated`
(the free valley), returns the first valid site that `siteLinked` accepts — a road cell next to the gate (diagonal steps
must not cross the new footprint) or a link `suggestLinkForSite` would build — and falls back to the first valid site;
`siteExists` (D-175) counts only linked sites there (memoized per network version and building count). The cards'
ghost anchor (`anchorFor`, src/ui/paceCard.ts): the castle while it has a linked site; else a building of the same
type, then its input's maker, then the stable — that building becomes the card's subject (its sheet holds the same
cure). Missions keep the old ghost (mission hashes identical, 45 strategies). (decided)

**D-267 — The malthouse grows on its own malt while the brewery is still locked.** The grow ratio rule (malthouse ≤
brewery) blocked a second malthouse at rank 3, where malt is the chain's end good and often the only unsaturated one. A
`GROW_FEEDS` consumer the rank does not allow yet no longer counts: the supplier grows on its own good until the
consumer unlocks, then the D-251 ratio applies again. Measured together with D-264..D-266 (`tools/sandbox-first30.ts
--minutes 120 --seeds 1301,1302,1303,1304 --only card-10,card-30,card-60,decent`), rank-5 minute (– = not reached;
renown at 120 min):

| player | D-251 (old tool) | game before, fixed tool | after |
|---|---|---|---|
| card-10 | 108,7 / 103,8 / 109,3 / 107,4 | 102,2 / 100,0 / 104,9 / – (R4, goods 8/9) | **92,9 / 87,8 / 108,8 / 93,9** |
| card-30 | – (16 919) / 117,5 / – (16 660) / – (16 467) | 106,2 / 104,4 / 109,9 / 100,8 | **97,0 / 102,5 / 104,6 / 100,0** |
| card-60 | – (11 486) / – (12 160) / – (R3, 8 349) / – (12 428) | – (15 820) / – (13 195) / – (R3, 8 419) / 117,3 | **– (16 387) / – (16 789) / – (14 281) / 116,6** |
| decent | 117,6 / 116,7 / 117,0 / 115,6 | identical | identical |

The bottleneck-blind player (`--no-neck`) after: card-30 116,3 / 112,6 / 111,4 / – (16 612) (D-251: 1/4). card-10
seed 1303 is 3,9 min slower than "game before, fixed tool" (denser building by the castle) but faster than D-251.
Left: card-60 still short on 3/4 seeds by 211–2 719 renown; the bottleneck card ignores its consumers' saturation
(BACKLOG). (decided)

## Bottleneck card and saturation, grow reason in landscape (BACKLOG P2 from D-264)

**D-268 — The bottleneck card skips an input whose every consumer works in a chain ending in a saturated good.**
BACKLOG P2 (D-264): in a crowded valley the "Wąskie gardło" card (D-171) kept naming grain and wood — the scripted
card-10 player built woodcutters and farms whose charcoal, planks and bread already sold at the floor, so the new
goods only filled granaries (card-10 seed 1303: 116 buildings, rank 5 at 108,8 min). Now `computeCard` drops a good
when every consumer of it on the map has a saturated chain end: `chainEndGood(type)` follows the grow chain's feed
(`GROW_FEEDS`: a mill by a standing bakery ends in bread, a mill alone in flour; the charcoal burner in charcoal) and
`goodSaturated` is the grow card's own D-174 test (saturation ≥ ½ cap, or a full granary holding a load no market
takes), moved to `src/ui/saturation.ts` so both cards share one rule. One consumer with a chain that still sells
keeps the card (its producer feeds that consumer too). The slot then falls through as before: the grow card (D-192)
names a chain that sells, or a good never sold (D-265). Why skip, not redirect: the grow card already redirects to
the right chain with the same button, and a second redirecting rule inside the bottleneck card would have to repeat
its ratios. UI only; mission hashes identical (`tools/mission-hashes.ts`, 45 strategies). Test
`tests/bottleneck.test.ts` (bread saturated → no grain card; without bakeries flour is the end good). (decided)

**D-269 — The valley site check (D-266) accepts a neighbouring road only as the network would drive it.**
With D-268 card-10 seed 1304 built differently and then stalled at rank 4 (goods 8/9): the rank card named the
brewery 256 times, each placement was born cut off and taken back. `siteLinked` had accepted a road cell diagonal to
the gate whose corner cells were held by an older building (network `hasEdge` refuses that step) — it only checked
the new footprint. Now a neighbouring road counts only when the network would use the step (no building on it, a
diagonal's corners free of every building, the grade ≤ `MAX_GRADE`) and the road joins the stable's component (an
orphan stretch does not); otherwise the gap finder's link decides, as before. UI only (`buildSite` asks only in the
free valley); mission hashes identical. (decided)

Measured with D-268 + D-269 (`npx tsx tools/sandbox-first30.ts --minutes 120 --seeds 1301,1302,1303,1304 --only
card-10,card-30,card-60,decent`), rank-5 minute (– = not reached; renown at 120 min):

| player | before (D-267) | after |
|---|---|---|
| card-10 | 92,9 / 87,8 / 108,8 / 93,9 | **89,1 / 90,0 / 91,7 / 90,2** |
| card-30 | 97,0 / 102,5 / 104,6 / 100,0 | **96,4 / 95,5 / 95,8 / 99,9** |
| card-60 | – (16 387) / – (16 789) / – (14 281) / 116,6 | **119,9 / – (16 659) / – (13 822) / 118,2** |
| decent | 117,6 / 116,7 / 117,0 / 115,6 | identical |

card-10 mean 95,9 → 90,3 min (seed 1302 2,2 min slower), with fewer buildings (100/121/116/106 → 111/107/102/105);
card-30 mean 101,0 → 96,9, faster on every seed, 60–70 buildings instead of 70–100; card-60 reaches rank 5 on 2/4
seeds (was 1/4), seed 1304 1,6 min slower, seeds 1302/1303 130–460 renown lower at 120 min. With D-268 alone (no
D-269) card-10 seed 1304 stayed at rank 4 — the site bug, not the card.

**D-270 — On a short landscape sheet the grow card's reason wraps in the wider column instead of a three-line clamp.**
In 915×412 (`body.is-short`) the docked fix stands beside its button (D-138: two columns 1,45 : 1, the reason clamped
at three lines / 48 px), so `fix.growWhyFlow` ("Przepływ 100 z 120 srebra…; towary już są. Przepływ rośnie ze
sprzedaży: …", ~150 characters in pl) ended in "Przepływ…" — the half that says why one more building helps was cut
(`docs/shots/fame-sheet-915x412-before.jpg`). The grow card's fix section now carries `fix-wide` (`fixSection(…,
wide)`, both `fix.growWhy` and `fix.growWhyFlow`): on a short sheet the columns become 1,15 : 1,45 (the reason gets
the wider one), the reason wraps without a clamp (12 px, line-height 1,2, hyphens) and the button label may break a
long compound ("Holzfäller-hütte"). Why not a full-width row under the button (tried first): the dock grew to ~105 px
and pushed the castle's status line under the fade and "Naprawa" out of view; beside the button it is 94 px in pl
(button 62 px, ≥ 48). Measured in the built game (staged as `tools/fame-shots.mjs`, 915×412 and Flip 360×380, pl /
de / en / pseudo): the reason's scrollHeight = clientHeight (nothing clipped), button and label without overflow,
the dock inside the sheet; pseudo (+40 %) takes 8 lines and the dock 123 px, the status line then sits under the
fade but scrolls. Portrait and other fix notes unchanged (only the grow card is wide). Shots
`docs/shots/fame-sheet-915x412{-before,}.jpg`, `fame-{hud,sheet}-{412x915,915x412}.jpg` re-shot. (decided)

**D-276 — The valley's `jsEventListeners` growth is lazy sweeping, not a leak: no code change.** Day 10 saw the
counter grow ~150 per 30 min of valley play at constant heap and nodes (BACKLOG P2). Reproduced on the built preview
with `tools/listeners-probe.mjs` (valley3, bench roads + 100 wagons, the real autosave every 30 s of game time; every
`addEventListener`/`removeEventListener` tracked by target type as connected / detached / collected, every `on*`
setter of IndexedDB requests, transactions and audio sources counted with a weak handle to its object). Each sample
reads `Memory.getDOMCounters` raw, after `HeapProfiler.collectGarbage` ×2 (what day 10 read), and "settled" (a further
3 s + GC + 1 s + GC). No sheets, 90 min: raw 94 → 246 / 249 / 237, after GC 231 / 213 / 204, **settled 94 → 105 / 105 /
105**; `addEventListener` +12 in total (11 marker pins: the pool grows to its size once, day 10), 62 autosave transactions per
30 min × 3 handlers (`oncomplete`/`onerror`/`onabort`, `run()` in `src/platform/save.ts`) = the rest; every transaction
object was collected (on*-objects alive: 2 = the open request and the connection). Two sheets opened and closed per
minute (building, wagon, market, pause menu, help), 90 min: 2 582 adds, 540 removes, the other 2 000 on sheet nodes
that were all collected, detached-but-alive listeners 3 throughout (two music `<audio>` elements and one button,
constant), nodes 473 → 438–470, raw up to 874, **settled 94 → 99 / 99 / 103**. Start → XII → menu ×6: 78 → 79,
flat. With audio unlocked (`audio=1`) ended `AudioBufferSourceNode`s (each with `onended`) are collected too. Blink
counts a listener down only when its owner is swept, which happens after V8's GC, lazily — a counter read right after a
forced GC still includes the last ~30 min of autosaves. Why no code change: nothing is retained (the settled count is
flat, every target is collected), and trimming `run()` to fewer handlers would change which error a failed save rejects
with (the `error` event fires before `tr.error` is set) for no memory gain. The opening letter's window `keydown`
(`src/ui/menu.ts`) is removed only by `close()`; leaving the game with the letter open is not reachable (modal), so it
stays. (decided)

**D-277 — Memory probes read a settled listener count.** `tools/memory-probe.mjs` adds `listenersSettled` (wait +
GC twice after the existing reading) beside `listeners`, so the next perf day does not read autosave churn as a leak;
`tools/listeners-probe.mjs <base> [blocks] [minutes] [sheetsPerMinute] [audio]` attributes the count by target type and
`on*` owner (D-276). Tools only; no game code. (decided)

## Menu world build: terrain and vegetation (perf day 12, BACKLOG P3 from D-255)

**D-280 — Heightfield skips the blurred water-mask interpolation where every tap is 0.** `shoreDist` evaluated a
16-tap Catmull-Rom of the blurred water mask for every height sample, although inland (most of the map) all taps are
exactly 0 and the result only feeds `m < 0.004` → 12. `Heightfield` now keeps one byte per `cellField` cell index
(`far`, -1 ≤ ix < w, -1 ≤ iz < h): 1 when its 4 × 4 clamped taps are all 0; `shoreDist` computes the same index and
returns 12 at once. Same answer by construction (the sum of zeros is ±0, < 0.004). This speeds every `height` call —
terrain mesh, water strip, tree placement, reeds, wagons and picking per frame. The pure grid code moved from
`terrain.ts` to `terrainGrid.ts` (no texture loaders), so `tests/ground-identity.test.ts` can build and compare it.
(decided)

**D-281 — Leaner ground build, bit for bit.** `vnoise` hashes its 8 lattice corners from 7 `Math.imul` products
(was 32; the int32 products sum exactly in a double, so `mix3` gets the same input as `hash3`) — this also speeds the
models (`kit.ts` noise). `Heightfield.raw` clamps its taps once per row and column (was 16 `corner()` calls, 32
clamps). Terrain chunk bounds are computed straight over the position array with three's own operations
(`Box3.expandByPoint`'s min/max, centre (min + max) · 0.5, the largest squared distance, sqrt) instead of a `Vector3`
per vertex in two passes. The apron and the water strip ask `hf.base` once per clamped border point (`apronGrid`,
`ApronRow`; a whole apron row or column clamps to one point; the water strip runs 280 m into the apron on both
sides). The water strip is built in two passes straight into typed arrays (no `number[]` pushes; index width by
three's `setIndex(array)` rule), the reeds sample the height once per candidate. Proof: `tools/terrain-hash.ts`
(SHA-256 of all terrain attributes/index/bounds, 300 000 scattered `height`/`base`/`detail` samples, the water strip,
tree lists, tree instance matrices and reed matrices) identical on 14 worlds (menu, I–IV, VII, X, XII–XV, free valley
seeds default / 7 / 1234); `tests/ground-identity.test.ts` compares `vnoise`/`hash3`/`fnoise` (150 000 inputs up to
1e13), `raw` and `shoreDist` (60 000 points on 4 grounds, also past the map edges), the 10 terrain grids (3 grounds)
and the water strip (17 grounds) with copies of the replaced code. Cost with D-280 (startup probes, 3 × 3 runs
interleaved, load 11–14): menu-world CPU high 781 → 676 ms, low 762 → 729 ms; node, cold menu ground, thread CPU,
median of 21: terrain + water + trees + reeds 143,6 → 129,6 ms (terrain 55 → 49, water 26 → 21). Pixels: `jam-diff`
0 px (research 2026-11-06-perf-day10, "After day 12"). (decided)

**D-282 — Terrain grids, water strip and apron trees are kept for the last two grounds.** They depend only on the
terrain's size, water level, corners and water cells (all `Heightfield` reads). `groundMemo(kind, terrain, build)`
(`src/render/groundCache.ts`) keeps the last two results per kind and hands one back when a world has the same
ground, compared value for value (`Object.is` on corners, not a hash). Two, not one: the sim already caches terrain
per map id (menu, mission I and the default free valley share one object, which `setWorld` never rebuilds), so the
win is menu → mission → menu → next mission, where the menu ground and the mission ground alternate; missions
II/IV/VII and III/X/XII–XV also share grounds under different map ids. Users treat the arrays as read-only (one
`BufferGeometry` per view over the shared arrays; bounds cloned). World change, warm (node, median of 9): terrain
29–30 → 0,3 ms, water strip 14–24 → 0,3 ms, apron trees 2,5 → 0 ms. Cost: up to ~4,5 MB of JS arrays for the other
ground (GPU buffers are still freed with each view). The vegetation hunk is one line in the constructor (`this.apron =
groundMemo(...)`), apart from the `claude/w-winter` changes to `bake`/`setBare`. (decided)

**D-283 — Not kept: one-pass grid evaluator, "certainly dry" water skip; deferred chunks wait for `view.ts`.**
Measured and dropped (cold menu build, node, interleaved runs): a `Heightfield.heightGrid` that inlines the whole
height (per-column/per-row weights and noise lattices, one loop) gave the same numbers but was 10–20 % slower cold —
Turbofan needs 14–20 ms to compile the big loop while it runs unoptimised, and it deopts on the first river vertex;
the small functions it replaced are optimised and inlined within a few thousand calls. A water-strip pre-pass that
skips points whose cell lower bound clears the water level (rigorous: Catmull-Rom negative weights ≤ 0,28125, detail ≥
-0,215) saved ~25 000 height samples but its three extra passes over 80 000 points cost more cold. Not done because it
needs `view.ts` (changed on `claude/w-winter`): building the terrain chunks outside the menu camera's frustum after the
first frame (portrait: 2 of 6 chunks and the west apron piece; three uploads attributes before `onBeforeRender`, so a
self-contained lazy chunk is not possible), and the forced `vegetation.update` in `syncNetwork` that runs before the
menu camera is placed (~10 ms, redone in the first frame). Both go to BACKLOG for after the winter merge. (decided)

## QA sweep of the night's UI (D-254, D-259, D-264..D-270), 2026-11-07

**D-284 — In Arabic the card's "?" (D-254) is mirrored.** The Arabic question mark (؟, U+061F) is the mirror image of
the Latin one, and the card under the button already asks "ماذا يعني هذا؟"; a Latin "?" in the head of an RTL card read
as a foreign glyph (`helpmap-*-ar-*` shots). The display face has no U+061F, so the button keeps its own "?" and flips
it: `:root[dir='rtl'] .sheet-head .sh-help { transform: scaleX(-1) }`. The button already sits beside the close button
on the left in RTL (flex order follows `dir`); its accessible name (`menu.help`) is unchanged. Why flip instead of the
character: a fallback font for one glyph would break the display face the button was drawn in (D-254).
`tools/help-map-shots.mjs --lang ar` checks the computed transform. (decided)

**D-285 — On a short RTL sheet the grip is 8 px.** In 915×412 (`body.is-short`) the grip is 4 px, so the head starts
~26 px under the frame's outer edge; Latin small caps fit under the frame's inner rule, but Arabic ascenders (lam,
alif) in the kicker ("لماذا توقف؟", "عربة") touched it. RTL short sheets get 8 px; other scripts unchanged. Seen in
the help-map shots (building/wagon, ar, 915×412). (decided)

**D-286 — Help opened from a card's "?" scrolls its topic into view.** D-254 opens help on the card's topic, but
"Wozy" and "Dolina i rangi" are low in the list; on a short landscape game sheet (915×412, the sheet ends above the
rail) only the topic's heading showed at the bottom edge and the answer lay under the fold
(`helpmap-wagon-help-ar-915x412.jpg`). `helpSheet(topic)` now scrolls the sheet body (its own `scrollTop`, not
`scrollIntoView`: the sheet is still sliding in and no ancestor may scroll) so the open topic's heading and answer are
in view, one frame after it is built. Help from the menu keeps its scroll at the top. `tools/help-map-shots.mjs`
checks the answer is in view; it also now starts a real game (`play=m1&ff=60`) — `play=1` is not a mission key, so its
cards had opened over the menu world. (decided)

**D-260 — Deciduous crowns go bare in winter, conifers stay green (owner decision 2026-11-06, follow-up of D-203).**
In the free valley (seasonal worlds only; contract missions keep their late-autumn look bit for bit) oak, birch and the
hazel/blackthorn shrubs lose their leaves; spruce and pine have no leaf cards (`needles` only) and are untouched. The
season comes from the sim clock, read only: `bareAt(tick)` (`src/render/leafFall.ts`) is 0 in summer, the leaves fall
over the last 40 % of autumn (6 game minutes, smoothstep, done when winter starts), 1 all winter, and the leaves come
back over 15–55 % of spring (with the thaw); the view follows it directly (it moves < 0,03 per 5 s of game time, and a
jump of the clock — load, fast-forward — then re-bakes the far trees once, not at every step, D-262). No pop:
every leaf card carries its own hash in `aTree.z` (the far-card lift slot, unused on near parts; one value for the 4
corners, `addTreeAttr`), and a card whose hash is below the bare factor switches to the bare twig spray — the crown thins
card by card over the 6 minutes (at ×4 speed 90 s) and fills again in spring. The switch is in the vertex shader of the
`leaves` material (`TWIG_GLSL`: the UV moves into the right half of the leaf texture, the vertex colour becomes the twig
colour, the per-tree autumn tint and most of the flutter are dropped): one shared uniform `treeUniforms.uBare`, no new
meshes, no extra draw calls, no per-frame allocation (a number written per frame). The ground-cover shrubs use the same
material and follow. Test `tests/winter-trees.test.ts`: no step above 0,03 per 5 s of game time over a year, leaf fall
monotonic, leaf cards only on broadleaf kinds, one hash per card. (decided)

**D-261 — The bare crown: a woodcut twig spray in the leaf texture, thin scaffold branches, a third of the cards open.**
Bare trees must read as naturalistic trees, not sticks. The leaf texture is 512 × 256 now: the leaf clump as before on
the left, on the right a twig spray drawn for this game (`drawTwigSpray`): six limbs from the clump's lower centre fork
five times with a small crook per node, short spurs on the older twigs, tips curling up, all inside the same lobed
outline as the leaf clump (a bare crown keeps its summer silhouette); woodcut reading — a dark stroke per twig with a
pale cut along its upper edge (light and rime from above), no soft shading. Twig albedo `TWIG_COL` cold grey-brown.
About a third of the bare cards show nothing (a transparent texel), so a bare crown is more open than the three crossed
cards of a leaf clump. Oak and birch get a thin branch (3-sided open rod, 6 triangles) from the nearest limb / the stem
into every outer clump (`branchTo`), so no twig spray floats; hidden in the leaf mass in summer. Shrubs get none: their
five stems and sprays carry the look, and they are the most numerous near model. Thin twigs vanish in coarse mips under
a plain alpha cut, so twig cards get a stronger mip alpha hold-up, and on the low tier (no alpha to coverage) they are
screen-doored by their coverage (a pattern offset from the LOD dither's), keeping the thin haze high gets from alpha to
coverage. (decided)

**D-262 — Shadows and far trees turn bare too: a leaf depth material, the far atlas re-baked in quarter steps.**
WebGLShadowMap draws alpha-tested cards with its own depth clone and the plain UVs, so bare trees cast full summer
crowns: leaf meshes get `leafDepthMaterial()` (`shareInstancedDepth` picks it for the `leaves` material; same card
selection, map and alpha test copied per draw by three). Far cards (billboards, apron hills) show what the atlas holds,
so the atlas is re-baked at `bareBakeLevel` = the eased factor in quarter steps (0, ¼, ½, ¾, 1): 4 re-bakes per leaf fall
and 4 per spring, into the targets it already has (no new GPU memory; a tier switch still re-allocates), without
`needsUpdate` on the billboard material (no program work). The bake uses the same `TWIG_GLSL` selection and colour;
twig cards go into the multisampled bake row with alpha to coverage at about half their coverage, so the resolved,
premultiplied atlas holds a bare crown as a thin haze of twigs with its limbs showing, not a solid brown mass (leaf and
needle cards still write alpha 1: the summer atlas is unchanged). Rejected: extra bare columns in the atlas (+60 %
atlas memory, 2 × 4 MB on low/high, 2 × 17 MB on ultra) and a per-frame bake. The bake itself got cheaper: the card
sizes are cached (each bake walked every vertex of every model 80 times in `treeExtent`), the bake meshes are built once
per pass instead of once per view, one bake camera. Re-bake cost (SwiftShader, high, 128 px cells, loaded machine,
CPU incl. `gl.finish`): 2,4–5,5 ms per season step, tier re-bake 2,1–3,2 ms. (decided)

**D-263 — Cost of the bare winter trees and the acceptance shots.**
Forest edge of the free valley (`tree-probe`, sandbox, forced noon, autumn / winter / summer at 70 and 110 m), before →
after: draw calls identical in every state (high 56 / 57 / 54 / 53 / 56, low 52 / 53 / 41 / 40 / 52); triangles high
305 740 → 308 548 (+0,9 %) at 70 m, 284 775 → 286 917 (+0,8 %) at 110 m, low 258 249 → 259 725 (+0,6 %), 110 m
unchanged (the scaffold branches); programs high 45 → 47, low 43 → 45 (the leaf depth program and the alpha-to-coverage
bake program, both compiled before play: pre-warm / first bake); 0 new programs on autumn ↔ winter ↔ summer switches.
Allocations (`tools/alloc-probe.mjs`, low, 100 wagons, 15 s, ×4): 534,1 → 535,2 KB/frame (20,3 → 19,9 MB sampled), no
tree code among the allocators; a first run with the eased factor showed `treeExtent` and bake meshes (4 re-bakes after
the probe's clock jump) — fixed as above. Shots (`tools/winter-trees-shots.mjs`,
412 × 915 and 915 × 412, low and high, forest edge of the valley at 45 / 70 / 110 m): `docs/shots/winter-trees-before-*`
(winter, winter-far, autumn) and `winter-trees-after-*` (winter, winter-far, winter-near, autumn, late-autumn, spring).
Inspected: winter oaks and birches read as bare trees with limbs and a fine twig haze, pines and spruces green, far
copses bare, shadows lacy; autumn unchanged. Open: the regrown spring leaves keep the late-autumn colours of the art
direction (a fresh spring tint would be a separate owner decision). (decided)

## Menu world build: deferred terrain pieces, no forced tree re-bucket (perf day 13, BACKLOG P3 from D-283)

**D-296 — Terrain pieces outside the first frame are built after it.** `TerrainView(…, defer)` creates its 10 meshes
(6 map chunks, 4 apron pieces) at once, hidden, each with its own empty `BufferGeometry`, in the old order — so object
ids, group order and the opaque sort among the terrain draws stay as they were. Before each frame is drawn,
`View.buildTerrainInView` fills the pieces whose box meets the camera frustum, and after the first frame one task
(queued before the pre-warm's timer, so the pre-warm sees every piece) fills the rest. The box is known before the
piece exists (`pieceBox`): its x/z extent exactly, heights from `hf.bounds()` for a map chunk, and for the apron the
border base − 0,35 plus `apronFrom`'s ceiling (rise ≤ 0,24 m per metre beyond the border, largest at a piece corner),
1 m of slack; `tests/ground-identity.test.ts` checks the box holds the built grid on 17 grounds and that pieces built one
by one in any order equal `terrainGrids` bit for bit. The grids stay in the ground memo (D-282), now filled per piece,
so a world on a kept ground builds none. Menu, portrait 412×915: `terrain-0-0`, `terrain-2-1` and the west and east
apron are deferred; landscape 915×412: `terrain-2-1` and the west apron. It applies to every world change (a mission
on a new ground too), not only the menu: the frustum test is what keeps it safe, and a piece the camera turns to is
built before the frame that would show it. Why not lazy inside the mesh: three.js uploads the attributes before
`onBeforeRender`, so the view has to decide before `render`. Pixels: menu frames 1–5 (high) and 1/3/5 (low), menu
frame 30, mission frame 1 at 240 m and the three settled day-12 scenes — **0 px** against `20cb94c`; the deferral alone
(build with only D-297 applied vs. this branch, `prior=m12`) — **0 px**. A `marchia:terrain-rest` mark records when the
rest is built. (decided)

**D-297 — `syncNetwork` no longer re-buckets the trees.** It ran `vegetation.update(camera, force)` right after
`rebuild`, with whatever camera stood there: at startup the camera the menu had not placed yet (`setMenuMode` comes
after `setWorld`), on a world change the previous world's camera (`rig.set` only moves the camera in the next
`update`). `rebuild` already marks the buckets stale (`lastX = Infinity`), so the frame's own `update` sorts the trees
from the camera it draws with. One visible difference, a correction: when the new world's camera stood within 6 m of
the old one's (harness `prior=m12`), the old code kept the buckets of the previous world's camera until the player moved
6 m — 1 675 px of tree shadow on a field differ from `20cb94c` (all of it this change: before vs. before-without-the-
forced-update is the same 1 675 px). The menu path is unchanged (its camera always moves > 6 m before frame 1). The
cost moves rather than vanishes: the cold first `update` (~10–15 ms, JIT) is now frame 1's, and what is saved is the
second, warm one (~2–3 ms) — D-283's "~10 ms" counted the cold one. (decided)

**D-298 — What day 13 buys: tens of ms of CPU out of the menu world build, a few out of the first frame; not a wall-
clock change on this machine.** Startup probe (`startup13-data/run.sh 4`, 4 rounds × 3 runs interleaved, load 5–9 from
other sessions): CPU of the menu world build (`menu-start`) high 502 → 471 ms, low 487 → 453 ms; `terrainGrid.ts` there
60 / 56 → 0 (the pieces in view, 42 / 39 ms, now run in frame 1; the rest, 8 / 8 ms warm, after it). Frame 1's own CPU
(`ready` phase) rose by the pieces it now builds and by shader-compile noise (high 754 → 871, low 680 → 724 ms);
`ready` 1134 → 1055 / 1096 → 1096 ms and first frame 1941 → 1910 / 1777 → 1858 ms (medians) are within this machine's
spread. Cold node probe (`tools/defer-probe.ts`, 15 interleaved cold processes): all 10 grids 78,8 ms vs. 64,6 in view
+ 12,7 deferred; tree re-bucket cold 15–16, warm 3 ms. Net: ~12–16 ms (loaded) less work before the first frame, and
`ready` earlier by the in-view pieces. Kept because it is identical in pixels and costs nothing after start; on the
Fold the share should be the same (measure `menu-world` → `first-frame` there). (decided)

**D-288 — Mission XVI "Dwa zamki": two castle orders in one mission, state v10.**
Owner decision 2026-11-07 (research `docs/research/2026-11-07-two-castles.md`, option 2, design A). The state keeps
`mission.contract` as the main castle's order (its deadline, star and end ticks stay the mission's) and gains two
optional keys, absent in every other mission so they serialize byte for byte as before (the `valleyEvents` pattern):
`mission.extraContracts` (further castles, one tranche each carrying that castle's own deadline) and
`mission.firstCastle` (D-289). `contractsOf` / `runningContractOf` (`src/sim/contract.ts`) replace the single-castle
checks in dispatch, `accepts` / `acceptsUpTo`, the castle status (a castle whose own order is complete reads
`CONTRACT_DONE` while the other runs), `checkMission`, `stars`, the forecast seals and the read-only helpers
(`outputCustomer`, `outputSurplus`, `stoneInStore`, `contractFilled`, the link anchor in `repair.ts`); for one castle
they return exactly what the old checks read. Authoring: `MissionDef.castles` (`{ name, need, dueMin }[]` in building
order, the first = `contract`; `name` keys the castle's player-facing name and is never in the state). Seals: one set
for the mission from the last delivery, minus one per castle late on its own deadline (the tranche rule of V / XV),
at least one for a win; loss only at the mission's end. `STATE_VERSION` 9 → 10 with an identity migration (a v9 save
cannot hold a XVI state; an old build refuses a XVI save as newer). `saveGate` validates `extraContracts` (needs a main
contract, an array of orders with one tranche each, every castle a castle holding one order) and `firstCastle` (a castle
holding an order, only with two orders); tests in `tests/two-castles.test.ts`. Proof of "nothing else changed":
`tools/mission-hashes.ts` now hashes with `version: 0` (`tools/golden-hash.ts`, the `CONTRACT_GOLDEN` convention) and
covers XIII–XV (71 rows): identical output before the sim change (commit b0869ba) and after every later commit;
`CONTRACT_GOLDEN` gains m16 only, `V4_GOLDEN` unchanged. (decided)

**D-289 — "Ten zamek pierwszy": a real command, priority on the castle leg only.**
`{ t: 'castleFirst', castle }` (`src/sim/commands.ts`, in the replay allowlist with `castle` ∈ −1..maxInt) sets
`mission.firstCastle`; `castle: -1` deletes the key, so a cleared switch serializes exactly like one never touched.
Refused (BAD_TARGET) outside a running mission with two orders or for a building holding no order. The dispatcher gives
the first castle's demands `prio −1` (before every other demand); everything else is the unchanged even split by fill,
then id — the castle leg only, no lift of the workshops upstream (the prototype's chain priority starved the other
castle and is gone). The dispatcher never picks the earlier deadline by itself: doing nothing must lose the early letter.
The castle card holds the switch (`src/ui/castles.ts`): "Ten zamek pierwszy" with what it brings ("gotowe ok. 3:13" or
"…ale i tak po terminie"), and once on, "Dziel po równo"; a toast confirms; a woodcut pennant icon `first` drawn for it.
The fuzzer draws the command only in a mission with two orders, so every other mission's seeds keep their scenarios.
(decided)

**D-290 — Castle forecast, the castle pace card and the two-row waybill.**
`castleForecast(world, log, castle)` (read-only, `src/sim/forecast.ts`): the shared good's pace serves a pool — this
castle's rest alone when it is first, the first castle's rest before it ('after'), both rests when they fill evenly
('even': both finish together) — plus the shortest drive; `firstTick` is the same if it went first. It is ready from the
first tick: the producers' capacity until the two-minute pace window is full, then the measured pace (the better of the
window and the long run) — the decision is worth most at 0:00 and the old forecast waited two minutes. In a two-castle
mission `contractForecast` reads the whole order of every castle (stock, promised goods, the farthest drive), so the
producer and fleet cards see the mission's finish. New calm pace card `castle`: the castle whose own deadline falls first
among those forecast late and not first ("Zamek Wschodni: spóźni się o 0:50 — towar dzielony po równo" / "— pierwszy jest
Zamek Północny"); it takes the slot before the other pace cards (the switch is free and decides the lesson); its sheet is
the castle's with the switch. Waybill: one row per castle (name and own deadline, bar, a brass "pierwszy" tag, state "na
czas" / "spóźni się o M:SS" / delivered / "po terminie — minus pieczęć"); the pill counts to the earliest open castle
deadline. (decided)

**D-291 — Which castle took the goods: `castleRival`, castle names, the late castle in the end letter.**
`contestedBy` in the sim skips consumers of the same type, so a castle starved by the other castle read
WAITING_UPSTREAM ("the sawmill is making it"). `castleRival(world, castle)` (read-only, `src/sim/diagnose.ts`, the
counterpart of `sharedInput` F3/D-38) names the castle whose wagons carry this castle's missing good now, with the
wagons and units on the way; the castle card shows it above the chain: "Zamek Północny dostaje teraz deski: 2 wozy w
drodze. Tu brakuje 18 do 5:00." (the rival a link). No sim change, no hash change. Castles are named "Zamek Wschodni" /
"Zamek Północny" everywhere a building is named (`buildingName` reads `castleNameKey`). The end letter lists each
castle's delivery and adds "Po terminie: Zamek Wschodni (6:58, termin 5:00)" for a castle that missed its deadline.
(decided)

**D-292 — Mission XVI data, thresholds and ladder.**
Dry valley (`valley-m3`), no rain, no building: 2 woodcutters and 1 sawmill (4 wood each), stable, east castle (84,42) =
main contract, north castle (62,27) on the spur (64,31)–(64,40); 60 silver, 4 wagons. East 24 planks by 5:00, north 30
by 9:00, end 12:00, 3 seals by 7:05, 2 by 9:00 (owner's working thresholds, unchanged after the ladder). Ladder
(`tools/bot-m16.ts`, `tools/m14-ladder.ts m16`): nothing 7:40 east late 1★; east first @0:00/@1:00/@1:30 7:15 2★;
@2:00 7:56 east late 1★ (from 1:40 on the switch no longer saves the east letter); north first 7:31 1★; +1 wagon without
the switch 7:08 east late 1★ (the wrong fix); +2 wagons without it 6:31 2★; east first + 1 wagon 6:43–6:44 3★ (+21 s);
east first + 2 wagons 6:32 3★. The reasonable player (`eyePlayer`, 10/30/60 s, with and without hints, scan, letter)
taps the castle card at its first look: 7:15, no castle late, 2★. The third seal needs a wagon the fleet card does not
offer here (the whole-order forecast is ~20 s optimistic on this map) — BACKLOG. (decided)

**D-293 — Mission XVI content: menu, letters and 26 keys in 17 languages.**
Appended to the menu as XVI after XV (no renumbering, save keys unchanged): "XVI. Dwa zamki" / "Kto pierwszy, ten na
czas". The castellan's letters (opening with both orders and times, 1–3 seals, loss) in 17 languages; the opening says
the wagons share evenly and the switch is on the castle card ("zdecyduj wcześnie"), the signal from 0:00 the decision
window needs. pl/en authored; the 15 other letters and the 26 new UI keys are agent translations, flagged in BACKLOG for
native review. Mission page `docs/missions/m16.md`; smoke, robustness (save → load bit-identity of the winning strategy)
and fuzz cover m16; screenshots `docs/shots/m16-{letter,card,castle,switch}-{412x915,915x412,904x1000}.jpg`. Layout check (scenes `waybill-m16`,
`castle-m16`, 50 jobs, then the `--quick` matrix, 126 jobs): 0 failures after three fixes — the castle row's state is a
read-out, not a 32 px control; the deadline pill no longer names the castle (it spilled at 904x1000 in pseudo), and
`castle.fcFirst` is dropped because the dock's note says the same; and the sheets' root reveal (D-146)
repeats for 2 s with scroll anchoring off, which had moved the castle card back 33 px at 360x740 ru/pseudo. (decided)

## Spring tint of the regrown crowns (owner decision 2026-11-07, BACKLOG P3 from D-263)

**D-303 — Regrown spring crowns wear a muted young green, back to the late-autumn palette by summer.**
In the free valley (seasonal worlds only; contract missions keep `uSpring` = 0, i.e. their look bit for bit) oak,
birch and the hazel/blackthorn shrubs come back in spring in a restrained young green — new leaves under an overcast
sky: desaturated, a little yellow, never the candy green the art direction forbids — and settle back to the normal
(late-autumn) palette in early summer; spruce and pine have no leaf cards and are untouched. The curve
`springAt(tick)` (`src/render/leafFall.ts`) rises exactly as the leaves return (`1 − bareAt`, 15–55 % of spring, so a
card that switches back from twigs is already green), holds to the end of spring and fades over the first 40 % of
summer (6 game minutes, smoothstep, ≤ 0,021 per 5 s of game time); 0 in autumn and winter. The colour
(`springLeaf`, in the shared `TWIG_GLSL` block): the leaf vertex colour moves toward a young green *of the same
luminance*, so the baked clump occlusion and the per-clump value spread stay and a dark oak clump turns dark olive while
a light birch clump turns light yellow-green; each card picks its own shade between olive-green and yellow-green
(linear `SPRING_COL` 0,165/0,25/0,07 … `SPRING_COL2` 0,215/0,255/0,065) and its own strength (78–100 %) from the card
hash it already carries for the leaf fall (`aTree.z`), so a crown does not go one flat colour. The per-tree broadleaf
tint loses 60 % of its russet/ochre hue spread at full spring (it would brown the green), keeping its value spread.
(decided)

**D-304 — The spring tint costs one shared uniform; far trees follow in the same quarter steps.**
One number `treeUniforms.uSpring` written per frame next to `uBare` (`VegetationView.setBare(bare, spring)`), read by
the `leaves` material (near trees, ground-cover shrubs) and by the per-tree tint of the `billboard` cards; no new
meshes, attributes, textures or draw calls, no per-frame allocation, no `needsUpdate`. The far atlas bakes the same
`springLeaf` with `bakeSpring`; the view re-bakes when `bareBakeLevel(spring)` changes (quarter steps, into the targets
it has). Because the rise mirrors the leaf return, the spring steps fall on the same frames as the bare steps — the
only extra re-bakes are the 4 of the early-summer fade (8 re-bakes a year → 12). Shadows are unaffected (colour only).
(decided)

**D-305 — Cost of the spring tint and the acceptance shots.**
Forest edge of the free valley (scratch `tree-probe`, sandbox with seasons forced on, noon; autumn, winter, early /
mid / late spring at 70 and 110 m, early summer, summer, autumn of the next year), before → after: draw calls identical
in every state (high 56 / 57 / 56 / 56 / 56 / 53 / 56 / 56 / 56, low 52 / 53 / 52 / 52 / 52 / 40 / 52 / 52 / 52),
triangles identical (high 308 548 at 70 m, 286 917 at 110 m; low 259 725 / 244 351), shader programs identical (high
43 → 47, low 41 → 45 in both builds: the deferred pre-warm and the first bake, not a season step); 0 new programs on
any season switch, the spring tint added no program. Allocations (`tools/alloc-probe.mjs`, low, 100 wagons, 15 s, ×4;
a scratch copy also forces seasons on at spring 30 %, so `uSpring` moves and the atlas re-bakes during sampling),
before → after: plain 507,3 → 509,3 KB/frame, spring 604,6 → 497,6 KB/frame (20 frames per run under SwiftShader:
noise of ±100 KB), no leaf-fall, vegetation, tree or bake code among the allocators. Inspected against the forbidden
list: muted olive to yellow-green crowns, AO and per-card spread kept, no candy or neon green, conifers and the
summer shots unchanged, far copses follow. Shots
(`tools/winter-trees-shots.mjs`, scenes `spring-early` (spring 30 %), `spring-mid` (50 %), `spring-mid-far` (110 m),
`spring-late` (85 %), `spring-late-near` (45 m), `summer-early` (summer 20 %, fading), `summer` (60 %, normal palette);
412 × 915 and 915 × 412, low and high): `docs/shots/spring-trees-before-*` and `spring-trees-after-*`. (decided)

**D-300 — Small a11y fixes after the 7 XI audit: ETA plaque near-white, a forced-colors outline on the map pin, the
docked hint grows at large text.** (a11y ar, 7 XI; `tools/a11y-audit.mjs` hud/why/wagon/castle, pl + ar, 412×915 and
915×412.) (1) The ETA plaque on the map (`.eta-tag span.num`) sits on the kit's slate `eta` sprite like the snow pill,
so it takes the same near-white `#fbfbf8` (D-122) instead of `#eef0ee`: 4.45–4.51 → 4.92–4.98:1 (pl, ar, both viewports). (2) The critical pin's
keyboard ring was there all along — the D-123 two-tone ring is drawn on the pin's head (`.bb::before`, D-147) and a
screenshot of the Tab-focused pin with the bakery sheet open shows it — but the audit only read the button's own
outline / box-shadow. The audit now also counts a two-tone ring on a descendant's `::before`/`::after`. The pin's
`outline: none` became `outline: 2px solid transparent`: nothing changes on screen (touch and mouse focus still show
nothing, `button:focus`), but forced-colors / high-contrast mode drops box-shadows and paints outlines in a system
colour, so there the focus no longer vanishes. A transparent outline does not count as a ring in the audit. (3) At
200 % text in a short landscape sheet the docked hint beside the fix button (D-138, a 48 px box and a three-line
clamp) cut "Brakujący odcinek zaznaczono na mapie." in half. Under `body.is-short.is-bigtext` the note drops both and
wraps in full; the dock grows and the body above gives way through `--dock-h` (as D-270). The clamp stays at normal
text size, where three lines fit 48 px anyway. The audit waits for `body.is-bigtext` before reading the 200 % layout
(a loaded machine needed > 300 ms for the ResizeObserver and reported the pre-bigtext dock) and reports text cut by a
fixed-height ancestor (the hint was cut by `.fix-note`, not by its own box). Audit hud/why/wagon/castle × pl/ar ×
412×915/915×412, before → after: low contrast 3 → 2, clipped at 200 % 2 → 0, focus without ring 0 → 0 (the old check:
2 → 0). The remaining two are `wagon-915x412` pl "Dostawa za" / `dd.eta` sampled over the map, unchanged. (decided)
## Mission XVI: an honest two-castle forecast and the wagon cue (BACKLOG P2 from D-292)

**D-306 — The two-castle whole-order forecast: long-run pace, the castle served last, the wait for a wagon.**
Why the forecast was early (east first, four wagons, the run ends at 7:15): `contractForecast` read the whole order
of both castles (D-290) but (1) took the better of the two-minute window and the long run — when the sawmill catches up
after waiting for wagons the window reads 11–12 planks a minute against 9 in the long run (3:10–3:30); (2) drove the
last unit to the *nearest* castle (min over producers × castles), though D-290 meant the farthest, and with a castle
first the last unit goes to the other one; (3) left out the load's wait for a wagon — on XVI's long castle leg the last
planks stand 20–40 s at the sawmill. It said 6:17 at 3:20 (58 s early) and "three seals" from 2:30 to 3:40. Now, only
with two castle orders (one castle takes the unchanged path, so I–XV read exactly what they read before): the long-run
pace alone; the lag is the nearest producer's drive to each castle served last (not first while it is still short,
else every castle still short; the longest of those) plus `wagonWait` = one round trip over the fleet
(2 × drive / wagons, `src/sim/forecast.ts`); the same wait is added to `castleForecast`'s drive (the castle card's
"gotowe ok." for east first at 0:00: 3:12 → 3:43; the run makes 4:47 — the per-castle forecast keeps the producers'
capacity until its window is full, D-290, because the decision is worth most at 0:00). Measured on the switch-only run
(10 s samples, 1:10–5:00): at most 21 s early (was 58 s); with one wagon bought at 0:30 at most 7 s early (was 47 s).
Still pessimistic in the first minutes (1:30: 10:00 for 7:15 — the long run carries the start-up wait for wood, as
before). Read-only, in `src/sim/` but never in the state: `tools/mission-hashes.ts` (71 rows) identical before and
after; I–XV balance rows (`tools/balance-night6.ts --no-search`, 148 rows) identical as JSON. (decided)

**D-307 — The haul card: the fleet cannot keep the shared producer at work (two castles only).**
The fleet card (D-127) needs a yard waiting 20 s for pickup. On XVI that wait first shows at 3:10–3:40 (sawmill
WAITING_PICKUP after the output fills); a wagon bought then no longer helps (7:15), and the forecast said three seals
there anyway. A wagon pays off when bought by ~1:40 (east first + wagon at 0:00–1:40: 6:44–6:47; later the dispatch is
chaotic: 2:10 → 7:08, 2:30 → 6:27, 3:30 → 7:15). From 1:30 the evidence is there, only not in a yard: no wagon stood
free for the last minute and the sawmill makes 6–9 planks a minute of the 12 it could, while two woodcutters could feed
it flat out. New pace kind `haul` (`src/ui/paceCard.ts`, `haulCard`): a two-castle mission, the fleet card's gate (a
better seal in reach with 210 s to spare, a wagon buyable, none idle, the fleet on the road the whole last minute, no
ice), the bottleneck good's producers below `HAUL_RATE_SHARE` = 90 % of their capacity, and their inputs' makers able
to feed that capacity (else more makers, not wagons, would help). It comes after the castle switch card (the free fix
and the lesson go first: while the early castle is late at the even split or behind the wrong castle, no wagon cue —
the ladder's "wagon without the switch" stays at 1–2★) and after the fleet card. Card: "Tartak: robi 6 z 12 desek na
minutę, wszystkie 4 wozy w trasie — kup wóz" (`cause.paceHaul`); the seal reads "tempo: kup wóz"; the rail's wagon
lights as the cure; the sawmill's sheet: "Kup wóz −30" and "Przez minutę żaden wóz nie stał wolny, a wozy nie nadążają
odbierać desek. Na 3 pieczęcie do 7:05 towar musi ruszać szybciej; nowy wóz zdąży się zwrócić." (`fix.paceHaulWhy`,
own full-width row on a short landscape sheet, D-270). The sheet names the seal in reach and its time, not the
forecast's finish (the early pessimism of D-306). UI only: no sim change, no hash change. (decided)

**D-308 — XVI ladder after D-306/D-307: the reasonable player earns three seals.**
`tools/m14-ladder.ts m16`: every scripted row unchanged (nothing 7:40 1★; east first @0:00/0:30/1:00 7:15 2★, @2:00
7:56 1★; north first 7:31 1★; +1 wagon without the switch 7:08 1★; +2 wagons without it 6:31 2★; east first + 1 / 2
wagons 6:43 / 6:32 3★). Reasonable player before → after: eye / eye+ 10 s 7:15 2★ → 6:27 3★ (switch 0:10, wagons 1:30
and 2:40), 30 s 7:15 2★ → 6:43 3★ (switch 0:30, wagon 1:30), 60 s 7:15 2★ → 6:34 3★ (switch 1:00, wagon 2:00);
scan 30 s and letter + eye+ 30 s 2★ → 3★ (6:43). Robustness (`EYE_PHASE` 3/5/7 s): 10 s and 30 s stay 3★ (6:27–6:37);
60 s drops to 2★ (7:19: the wagon lands at 2:03–2:07, inside the dispatcher's chaotic window, later than 7:15 of the
switch alone) — XVI's sensitivity to a wagon's minute, not a false cue. Other missions: I–XV balance rows identical. The
second wagon of the 10 s player is the same card after the first wagon: the forecast still misses three seals at 2:40
and the fleet is busy again; it lands at 6:27 (better, not worse). (decided)

**D-309 — XVI content after D-307: two keys in 17 languages, shots.**
`cause.paceHaul` and `fix.paceHaulWhy` (pl/en authored; 15 agent translations, for native review in BACKLOG; the plural
of the wagon count follows each language's `cause.paceFleet`). Tests (`tests/two-castles.test.ts`): the reasonable
player 10/30/60 s buys a wagon from the haul card and earns three seals; east first alone: the forecast at most 25 s
early until 5:00 and the haul card by 1:40 with the sawmill as subject; no haul card at the even split (castle card) or
with one castle (XI). Shots (`tools/m16-shots.mjs`, `haul` and `haulsheet`: east first at 0:00, 1:30, 412 × 915 and
915 × 412): `docs/shots/m16-haul-*.jpg` (the card on the HUD, the waybill "pierwszy / na czas") and
`docs/shots/m16-haulsheet-*.jpg` (the sawmill's sheet with "Kup wóz"); inspected against the forbidden list — the
calm brass pace card and the existing sheet, no new visual element. The D-293 shots of the castle card still show the
old "gotowe ok." times (D-306 moved them by the wait for a wagon). (decided)

## World build: road mask, reeds and tree plan (perf day 14, BACKLOG P3 from D-255)

**D-310 — The road mask encodes only the texel spans its segments swept.** The startup profile of the menu world build
(browser, `menu-start` phase, function level) put `RoadField.rebuild` first among the ground's own functions (19 ms
self, plus 7 ms in `segment`); day 13 listed it as the next item. Most of it was the encode loop over all 768 × 576
texels (3 × `Math.round` each), run cold. A texel no segment swept holds `ROAD_MAXD` in all three distance fields, and
`Math.round((6 / 6) * 255)` is 255: the texture now starts as `fill(255)` and each texel row encodes only the span
between the first and last column any segment of this rebuild swept (`rowLo` / `rowHi`, widened per segment). Same bytes
by construction; `tests/road-mask-identity.test.ts` compares with the replaced full encode on 7 worlds, also after half
and all of the roads are removed (texels written by the previous rebuild must return to 255 — checked to fail without
the `fill`). Measured and not kept: skipping `sqrt` for texels with d² ≥ 36 in `segment` (exact, but no gain within
the noise). Cost (node, `tools/world-probe.ts`, cold process per run, thread CPU, median of 21 interleaved): menu
`roads.rebuild` 28,3 → 20,0 ms; browser (startup probe, `menu-start`, 9 runs per version) `roads.ts` 26 → 15 ms. The
rebuild runs on every network change too (warm, ~8 ms, now mostly `segment`). (decided)

**D-311 — Reeds: the scan visits only cells near water, and its ground-only result is kept per ground.** `buildReeds`
walked every metre of the map (442 000 points) to test the cell's water distance; the new `reedCandidates`
(`src/render/placement.ts`) walks the same rows and, inside a row, only the cells with `waterDist ≤ 2,5`, their 4 points
in order (`x = cx · 4 + k`, exactly what `x += 1` from 0 gave) — the same points in the same order. Every test except the
road clearance depends on the ground alone, so the candidates (x, y, z, rotation, scale) go into the ground memo (D-282,
kind `reed-candidates`) and each rebuild only filters them by `roads.distAt < 3,6`: a road change, or a world on the
same ground (menu → mission I), no longer samples any height for reeds. Cost (node, as D-310): menu reeds 14,8 → 10,1
ms (the rest is the instanced mesh, its matrices and bounding sphere); menu → mission I 10,5 → 0,0 ms; menu → mission
II (a new ground, warm) 17,1 → 8,6 ms. (decided)

**D-312 — Trees: a plan per ground, filtered per world; placement in its own headless module.** `placeTrees` depends
on the world only through buildings, yards, roads (`blocked`, `rd`, `roads.distAt`); the rest — the per-cell generators,
forest / scrub-belt / hedgerow / bank / copse rules, the water and field cells, field clearance, height, water line and
matrices — depends on the ground (with its forest and fields). `planTrees` records, per map cell, the candidates its
generator yields (main, then the bank shrubs, which the old code made only where `rd > 2` and which are that cell's last
use of its generator) and the copses that pass the ground tests, each with its road clearance and cell; `placeTrees`
skips blocked cells and candidates, the bank shrubs where `rd ≤ 2` and copses near the network, and runs the old
`put`'s remaining tests (field clearance, then height and water line) and `makeTree` once per candidate and ground, on
first use — so the first build does no more work than before (eagerly testing every candidate cost +5–10 ms cold:
the old `put` rejected candidates near roads before sampling the height). Two details found by measuring: candidate data
in growable typed arrays (number[] pushes of doubles were slower than the placement), and `kind | 0` when a tree is
made from the Float64Array (a double in `Tree.kind` turned the field representation to Double and slowed every
`filter` and `update` over the trees). The plan is kept per ground with `sameTreeGround` (`sameGround` plus forest and
fields; `groundMemo` takes the comparison as a new optional argument). Tree kinds, sizes and the variant count moved
to `models/treeKinds.ts` and the placement (trees, apron trees, reeds) to `placement.ts`, both without materials, so
`tests/tree-plan-identity.test.ts` runs them under tsx: it keeps the replaced `placeTrees` and reed scan as references
and compares trees and reed items bit for bit on menu, I, II, VII, the free valley (seed 7), menu and II again (kept
plans), each as built, with 250 more roads, with half the roads, with half the buildings (checked to fail with
`rd ≥ 2`). Cost (node, as D-310): menu tree placement 18,8 → 19,9 ms (same within the noise), menu → mission I
13,2 → 6,8 ms (what is left: `rd`, the yards, the instanced meshes). Whole render-side world build in node: menu
189 → 179 ms, menu → mission I (same ground: network sync only) 34,3 → 20,1 ms, menu → mission II 77,3 → 72,7 ms.
Browser (SwiftShader, 412×915, high, `docs/research/startup14-data/run.sh`, 3 rounds × 3 runs interleaved, load 6–8
from other sessions): CPU of the menu world build (`menu-start`) 463 → 418 ms (−10 %), `menu-world` mark 839 → 761,
`ready` 1055 → 1032, first frame 1936 → 1899 (the last two within the spread); `newGame('m1')` after the menu
(`tools/world-load-probe.mjs`, synchronous) 102 → 92 ms median (runs 39–125, noisy), mission II 158 → 161 (unchanged:
a new ground still builds everything). Identity: pixels `docs/research/perf14-diff/jam-diff.txt` — 15 harness scenes
before (`28d3076`) vs after, menu frames 1/3/30 high and low, mission I at 60–240 m with 20–40 wagons, II, VII, XII,
XVI as built (new `world=` harness parameter), `prior=m12`, `prior=m1` (same terrain object: resync only), II after VII
and VII after II (one ground, two map ids, kept plans) — **0 px** in all; `tools/terrain-hash.ts` (terrain, heights,
water, tree lists, instances, reeds) identical on 15 worlds; `tools/mission-hashes.ts` identical (71 rows, sim
untouched). Not done: the terrain mesh itself. D-283's one-pass grid evaluator was slower cold; since D-296 only the
pieces in the first frame's view are built before it (~20 ms of frame 1 in the browser profile, no longer ~110 ms
before `ready`), and a second world on a kept ground builds none. Left in the menu world build: the building and tree
models (`kit.ts`, three's geometry code, ~100 ms of `menu-start`). (decided)
## Mission XVI: a forecast honest from the first minute (BACKLOG P3 from D-290 and D-306/D-308)

**D-313 — Two castles: the forecast models the chain (producers and fleet) instead of reading the measured pace.**
Why both forecasts were wrong early: the whole-order forecast (`contractForecast`, two castles, D-306) divided what
was left by the long-run production pace, which in the first minutes still carries the start-up — the sawmill making
nothing while the wagons fetch the first wood (WAITING_DELIVERY 0:50–1:20) — and later the sawmill's waits for a
wagon (3:10–3:50): east first, a run ending at 7:15, it said 10:00 at 1:30 (+164 s) and 7:58 at 4:00 (+43 s). The
per-castle forecast (`castleForecast`, D-290) took the sawmill's capacity (12 planks a minute) for its first two minutes,
while the wagons bring ~7: at the even split the card said "late by 0:33–0:50" for a castle 1:58 late, then jumped to
the measured pace at 2:00 (+94 s). Now, only with two castle orders (one castle takes the unchanged path: I–XV read
exactly what they read before), both use one model of the chain, `chainTicks` (`src/sim/forecast.ts`): the later of
(a) the producers making what is still to make at `CHAIN_SHARE` of their capacity (bounded by what their inputs' makers
can feed) plus the last drive and the wait for a wagon (D-306), and (b) the fleet finishing its current jobs (each
wagon's time to deliver, plus the empty drive back from a castle) and then a round trip of every leg for each unit a
castle still owes — the castle leg from the nearest producer and, per unit, the input legs of its recipe
(`unitHaulTicks`; on XVI 24.4 s of wagon time per plank to the east castle, 19.1 s to the north one) — shared by the
wagons at `CHAIN_SHARE`. `CHAIN_SHARE` = 0.85 is the share of full work a shared long haul keeps (the producer waits
for input or a wagon, a wagon drives to a load not ready yet, the dispatcher sends wood while planks wait), measured on
XVI: 0.83–0.87 all keep the error within ±37 s; 1.0 is 38–66 s early, a 0.85 fleet with a 1.0 sawmill 38–66 s early.
The castle forecast serves the same pool as before (this castle alone when first, the first castle's rest before it,
both rests at the even split) through `chainTicks`; its `measured` flag is gone (nothing read it). The measured pace
stays on the goods (`perMin`, the haul card's "robi 6 z 12"). Blending the model into the measured long run over 3–15
minutes was tried and is worse (up to +59 s: the long run's start-up lingers). The whole-order forecast keeps its
one-minute gate (ready from 1:10). Error against the run played on passively from each 10 s sample
(`tools/m16-forecast-error.ts`, 10 strategies incl. the reasonable player 10/30/60 s), before → after: whole order
from 1:10 worst +164…+192 s → −36…+27 s (east first: 1:10 8:05 → 6:50, 1:30 10:00 → 6:58, 2:00 8:08 → 7:03, 3:00
6:59 → 7:09, 4:00 7:58 → 7:37, 5:00 7:19 → 7:27, actual 7:15); east castle from 0:10 worst −63…+104 s → −49…+48 s
(even split, actual 6:58: 0:10 6:14 → 7:02, 1:00 6:24 → 7:05, 2:00 8:33 → 7:17); north castle −111 → −66 s (the even
split still assumes both castles finish together; the north one is never late on 9:00). Cost per recompute (only when
a pace sample lands or a castle's goods change, cached as before): whole order 0.09 → 0.20 ms, both castles 0.13 →
0.47 ms (desktop Node). Read-only and outside the state. (decided)

**D-314 — The haul card aims at a seal the forecast reaches by less than 30 s.**
With the forecast honest, the D-307 gate (a better seal than the forecast earns) hid the card on XVI: east first, the
forecast says 6:50–6:58 at 1:10–1:40 (three seals by 7:05) for a run that ends at 7:15 (two). Before, the start-up
pessimism (10:00) had shown the card by accident. The forecast's error bound is now known, so the haul card
(`haulAim`, `src/ui/paceCard.ts`, two castles only) also aims at the seal the forecast earns when its finish lies within
`HAUL_MARGIN_TICKS` = 30 s of that seal's time: "Na 3 pieczęcie do 7:05 towar musi ruszać szybciej" stays true. The
fleet card's gate takes the aim as a parameter (default the forecast's `aim`: the fleet card and every one-castle
mission unchanged). The card's seal row shows what the forecast earns, as before. (decided)

**D-315 — The haul sheet prints the forecast finish again.**
While the haul card shows, the whole-order forecast is at most 19 s early and never late (east first: 17–19 s; eye
players 17–19 s; east first + wagon at 0:30: 7 s; `haul` column of `tools/m16-forecast-error.ts`), so the sheet opens
with "Przy tym tempie całe zamówienie będzie gotowe ok. 7:00." (new key `fix.paceHaulAt`, `{finish}` = the forecast's
finish on the mission clock; "ok." = around) before the D-307 reason and the seal in reach. pl/en authored, 15 agent
translations (Arabic with the clock isolated as in `fix.paceHaulWhy`), for native review in BACKLOG. Shots
(`tools/m16-shots.mjs`, this worktree's build on port 5212 — 5202 was held by another session's preview): all 18
`docs/shots/m16-*` refreshed — `haulsheet` shows the new line;
`castle`/`switch`/`card` show the D-313 castle forecast (the even split: "spóźni się o ~2:00" instead of 0:33–0:50).
(decided)

**D-316 — XVI ladder after D-313/D-314; I–XV unchanged.**
`tools/m14-ladder.ts m16`: every scripted row unchanged (passive 7:40 1★, wagons-1/2 7:08/6:31 1★/2★, lesson+0/1/2w
7:15/6:43/6:32 2★/3★/3★, wrong+0/1/2w 7:31/7:11/6:41 1★/1★/2★, lesson@30/60 s 7:15 2★, @120 s 7:56 1★). Reasonable
player before → after: eye / eye+ 10 s 6:27 3★ → 6:27 3★ (switch 0:10, wagons 1:30 and 2:40, unchanged); 30 s 6:43 3★ →
6:15 3★ (switch 0:30, wagons 1:30 and 3:00); 60 s 6:34 3★ → 6:29 3★ (switch 1:00, wagons 2:00 and 3:00); scan 30 s and
letter + eye+ 30 s 6:43 → 6:15 3★. The second wagon is the D-314 margin (the forecast after the first wagon says ~6:45,
within 30 s of 7:05); XVI has no other use for silver. Robustness (`EYE_PHASE` 3/5/7 s): 10 s 6:32/6:27/6:27 3★, 30 s
6:37 3★, 60 s 7:19 2★ → 6:16 3★ — the BACKLOG item "eye 60 s with a phase shift ends at 7:19" is gone (the card now
offers the wagon at 2:00, before the dispatcher's chaotic window). Other missions: `tools/balance-night6.ts
--no-search --json` 148 rows of I–XV identical before and after; `tools/mission-hashes.ts` 71 rows identical. Tests
(`tests/two-castles.test.ts`): error bounds over time for all 10 strategies (whole order ≤ 40 s from 1:10, ≤ 25 s
while the haul card shows, east castle ≤ 50 s and north ≤ 70 s from 0:10; at the even split the east card says late by
≥ 1:30 and within 30 s of the truth through 1:50). (decided)

**D-317 — The XVI "stale waybill" was the shot tool reading the folded parchment; the UI is consistent.**
Report: in `m16-castle-412x915` the waybill read 0/24 while the east castle held 6 planks. Probe (paused at tick 1500,
`ff=150&speed=0&openId=5`, this worktree's build on port 5222): the castle sheet opened in portrait folds the waybill to
its seal (D-62), the folded `.waybill` is `display:none` and `updateCastles`/`updateContract` return before the rows
(D-153), so the hidden DOM still held the tick-0 text — which `tools/m16-shots.mjs` printed as "waybill". On screen the
seal fill was 11.1 % = 6/54 (both orders), the card "spóźni się o 2:20" and the sheet "7:12 — 2:12 po terminie" (same
forecast; the card and the waybill round the lateness up to 10 s, the sheet prints the exact finish). Closing the sheet
in pause unfolds the waybill and `applyFold` clears `lastSig` and sets `contractDirty`, so the next frame draws 6/24,
"spóźni się o 2:20"; 915×412 and 904×1000 (not folded) showed 6/24 directly, still after 8 s of pause. XI–XV use the
same fold path (`updateContract`), and no other shot tool reads the waybill text, so no older shot was affected. Fix in
the tool only: after the last step it waits two animation frames, logs the state's castle counts, reads the waybill rows
only when they are shown (else the seal's text and fill) and reports a mismatch between the shown counts or seal fill
and the state as an error. All 18 `docs/shots/m16-*` regenerated, 0 errors. No UI, no sim change (`tools/mission-hashes.ts`
identical). (decided)

**D-318 — One rounding for a castle's lateness: the castle sheet also rounds up to 10 s.**
D-317 found the pace card and the waybill saying "spóźni się o 2:20" (lateness rounded up to 10 s) while the castle
sheet said "ok. 7:12 — 2:12 po terminie" (exact); in landscape both are on screen and read as two different forecasts.
The sheet's `castle.fcLate` now prints the deadline plus the rounded lateness ("ok. 7:20 — 2:20 po terminie"), through
one helper `lateTicks10` in `src/ui/format.ts` used by all three places. Rounding up keeps the "late" message on the
safe side; the exact second is not something the player can act on. On-time forecasts (`castle.fcOk`) and the switch
line keep the forecast's own time. UI only, no sim change. (decided)
## Menu world build: the procedural models (perf day 15, BACKLOG P3 from D-312)

**D-320 — Primitives are shared read-only templates (`prim`).** Profile first (node `tools/model-probe.ts`, a cold
process per run building what the menu builds before `ready`: 10 tree models, 5 far cards, the menu's 8 building kinds,
the near wagon and the far wagon; browser function-level profile of the startup): the menu's models make 1 977
`PartBuilder.add` calls on only 360 distinct primitives (1 356 boxes of 218 shapes, 551 cylinders of 115), and three
builds every one through JS arrays converted to typed arrays (`three: other (shapes.ts)` ~32 ms of `menu-start`, the
largest garbage source). `prim(Ctor, ...args)` in `kit.ts` builds one template per constructor and argument list
(key `args.join(',')`); every `b.add(mat, new Box|Cylinder|Sphere|TorusGeometry(...))` in the models, the bridge ice
and the field stones now passes `prim(...)` (92 sites, plus three `const g = new ...` in `shapes.ts` that were never
written). `add` only reads its source, so sharing is safe; the test checks a template is unchanged after use.
Lathe/Extrude (Vector2 or Shape arguments) and geometries the models edit before `add` stay `new`. (decided)

**D-321 — `PartBuilder.add`/`build` on plain arrays.** A piece is now `{ index: Uint32Array, count, attrs }`, not a
BufferGeometry (no uuid, attribute objects, index slice per primitive); position and normal are copied and transformed
in one pass with the exact double operations of `Vector3.applyMatrix4` and `applyNormalMatrix` (normal matrix, then
`1 / (length || 1)`); the vertex colour runs in scalars (`Color.copy / multiplyScalar / lerp` written out), with the
`shade` callbacks still getting a Color and two Vector3; colour strings are parsed once (`baseColor` cache); renormal is
three's indexed `computeVertexNormals` + `normalizeNormals` on the arrays (all three corners read before any write,
accumulation through the float32 array, as three); `build` merges with width-specific index loops (one loop writing
both Uint16 and Uint32 ran on generic element access) and `computeBounds` gives three's box (Math.min/max), centre and
radius in two plain loops. The rare source without plain float normals keeps the old three path. Bit for bit:
`tests/part-builder-identity.test.ts` keeps the pre-D-320 builder as the reference and compares attributes, index and
bounds (Object.is) on boxes, segmented boxes, cylinders, spheres, lathe, torus, a non-indexed custom geometry, leaf cards
with kept uvs, shades that `set` a CSS string, renormal, a rigged model and a >65 535-vertex piece (fails with the
dim-face factor changed by 1e-7); `tools/model-probe.ts HASH=1` hashes every part of the whole catalogue (all building
kinds, props, castle upgrade, trading post, cargo, bridges, both wagon rigs, trees, far cards): identical. (decided)

**D-322 — Noise once per shared vertex; per-vertex waste out of the shades; bridges merged like buildings.** Jitter and
the colour noise are pure functions of the position, and half the vertices of the menu's buildings share a position
with another (a box's 24 corners are 8 points; cylinder seams and caps): `firstAt` (open addressing over the float bits,
scratch arrays) finds the first vertex at each spot, the others copy its jittered position and noise factor (kept as a
double). The shade colour's `set('#…')` copies the cached parse (shades set literals per vertex, each a setStyle parse
and sRGB conversion); `logGeom` works its end-grain axis out once per log, not per vertex, and the bakery flue builds its
stone shade once (it made `stoneO()` per vertex). `BridgesView.rebuild` merges spans with `mergeIndexed(geos, mats,
KEEP)` (as D-255's buildings) instead of clone + deleteAttribute + applyMatrix4 + mergeGeometries; bridge meshes hashed
before/after on 9 mixed cells: identical, attribute order included. Measured, not done: a trie instead of the joined
key (slower), own typed-array BoxGeometry (~5 ms cold, not worth a second box). What the rest is: cold code — the same
building models built again warm in the same process take ~35 ms instead of ~90–130 ms cold; the builders themselves
(`house`, `castle`, `box`, `trs`) run once each. Cost: node (`tools/model-probe.ts`, cold, thread CPU, median of 10
interleaved, `docs/research/startup15-data/node-model-probe.txt`) menu models 167 → 125 ms (buildings 124 → 92, trees
31 → 26, wagon 13 → 8). Browser (SwiftShader, 412×915, high, 3 × 3 startup runs interleaved, load 5–8 from other
sessions): model buckets of `menu-start` (`kit.ts` + `three: other (kit.ts)` + `three: other (shapes.ts)`) 137 → 105 ms,
whole `menu-start` CPU 415 → 336 ms median (spread 250–470, noisy); function-level profile (12 runs each, inclusive)
`buildingModel` + `treeParts` + `wagonModel` + `workerRig` + bridges 170 → 145 ms, `buildingsView.sync` 131 → 113.
Identity: pixels `docs/research/perf15-diff/jam-diff.txt` — 18 harness scenes (day 14's 15 plus menu frames 1/3/30
in the other quality: menu 1/3/30 high and low, missions I, II, VII, XII, XVI, priors) before (`5f62eb3`) vs after: 0 px; `tools/mission-hashes.ts` identical
(71 rows, sim untouched). Left: `bakeTreeBillboards` (~50 ms, GPU bake in SwiftShader), the ground memo, cold builders.
(decided)

**D-323 — The trader at the open trading post answers each sale with a short gesture (BACKLOG P3 from D-200).**
The trader behind the open post's counter (D-200) ran his fixed 7 s idle loop whatever happened at the post, so a
wagon selling there had no answer at the counter. Now, when a wagon sells, he plays one 3 s gesture blended over the
idle pose and eases back into the loop: he leans over the counter and reaches out to the carter (takes the coin,
0–0.8 s), straightens with both hands raised before his face (weighs it, 0.8–1.6 s), bends down to the strongbox
under the counter (drops it in, 1.6–2.3 s), then the idle loop fades back in (to 3 s). Same rig, same two angles
(hip bend, arm swing) — no new parts, no prop, no new draw: the D-200 batching (legs/torso per clothing variant,
arms per kind) is unchanged. Smoothstep transitions only, no overshoot; at most ~210°/s at the arms (a calm
movement, tested at 60 fps steps). `traderSalePose(age, pose)` in `src/render/models/people.ts`, `TRADER_SALE = 3`.

**D-324 — The sale is read from `tradePost.recent`, not stored anywhere new.**
Each wagon unloading at the post already appends a `TradeSale` with its tick to `state.tradePost.recent` (D-170, for
the sheet). `BuildingsView` reads the newest tick each frame (`lastPostSaleTick`) and compares it with the one it saw
last frame (`freshPostSale`, `src/render/postSale.ts`, pure): a changed tick that is at most 2 s of sim time old and
not in the future starts the gesture. The first look of a fresh view only records (a loaded game does not open with
a gesture); an old sale revealed by a load or a jump, or a save of another game swapped in, plays nothing. Two
wagons selling within one frame play one gesture; a sale during a gesture restarts it. The gesture clock is the
view's real frame time like the idle loop (×4 does not hurry the trader; a pause cannot produce a sale). No sim
state, no command, sim hashes unchanged (`tools/mission-hashes.ts`). Cost: one array read and a few multiplies per
frame for the one trader (~60 ns in node with the idle pose); draw count identical by construction (no mesh
added) — `tools/frame-cost.mjs` sandbox, low, 50 wagons, 15 s, SwiftShader, twice each: 47 calls before and after,
render 7.4 / 8.4 ms before, 8.7 / 7.5 ms after (run-to-run noise). Tests `tests/trader-sale.test.ts`
(the cue as a pure function, live trade at the post: gestures ≤ sales, hash identical with and without reading,
the gesture shape and its smoothness). Shots `docs/shots/merchant-{before,after}-<size>-seq.jpg` (idle, reach,
weigh, drop) and the full frames at "weigh" (`tools/merchant-shots.mjs`).
## Menu world build: the far-tree bake (perf day 16, BACKLOG P3 from D-322)

**D-325 — The bake holds the main thread for nothing: programs requested at mount, mips built once, no early
bake.** Profile first. `bakeTreeBillboards` runs in the first frame (not before `ready`); its CPU part in the startup
profile (SwiftShader, function-level, inclusive) was 45–125 ms, and two thirds of that was three's `onFirstUse`: link
checks of the bake programs, the copy program's check after the first row's trees had been queued (so it also waited for
them). The rest of its cost is GPU work that no CPU profile shows: a warm re-bake timed with a `readPixels` after it
took ~430 ms (load 6) to ~900 ms (load 20) of SwiftShader time — tree draws ~280 ms, the 80 per-kind passes' resolves of
the whole multisampled row ~70 ms (empty passes 110 ms vs none 38), the rest the 16 full mip-chain rebuilds (three
rebuilds the chain after every render into a mipmapped target, i.e. after each of the 8 row copies per atlas). That
work is executed when something waits for it — under SwiftShader the first frame's compositor commit, which reads the
canvas back and so waits for the bake plus the frame (the `first-frame` mark is set when the frame's JS ends, ~4–5 s
before the frame is composited in the probe). Changes: `requestTreeBakePrograms` (called from `View.mount`) compiles the
bake and copy programs into a 1×1 render target (same program keys as in the bake: linear output, no tone mapping) and
flushes, so the driver links them during the world build; inside the bake the copy program is first used before any
tree (a draw into the albedo atlas just before its clear), and each atlas's mip chain is built once, after its last row
(`generateMipmaps` off for rows 0–6; the flag stays on when the target is allocated, three sizes the storage from it).
Measured and not done: baking before the world build so the GPU renders during it (`setWorld`, before the terrain) —
`ready` +700 ms: the menu DOM's compositor commit then waited for the bake in its canvas read-back, and under SwiftShader
the GPU threads compete with the build for the CPU; a `flush()` at the end of the bake — the frame's JS +450 ms
(`first-frame` mark), the composited frame about the same; deferring the bake past the first frame or baking only the
kinds present — every world has all 5 kinds and draws 5 000–6 500 far cards in its first frame (apron hills included),
so the first frame needs the atlas; reuse across worlds — already (one atlas pair per session in `trees.ts`, a call with
the levels it holds returns at once; the prior-world harness scenes cover it). (decided)

**D-326 — One ArrayCamera pass per atlas row.** The bake drew each kind with its own `render()` into its column of the
multisampled row (viewport + scissor), and every `render()` into a multisampled target ends in a resolve of the whole
target: 5 resolves per row where 1 is needed. Now one `ArrayCamera` of 5 orthographic sub-cameras (sub-camera i: the
card frustum of kind i, viewport = column i, layer i + 1; the kind's meshes on layer i + 1, `frustumCulled` off since the
frustum of the array camera is not the views' and every view holds its whole tree) renders the row in one pass. Same
matrices (built by the same calls), same draw order per kind (all meshes at the origin, so the sort keys are equal as
before), no scissor needed (triangles are clipped to each view's frustum = its column). 80 → 16 passes and resolves per
bake (8 after D-327). (decided)

**D-327 — Albedo and normal atlases from one pass (two render targets).** Both atlases came from the same draws with
the same coverage, only the output differed (`mode` uniform). The bake shader is GLSL3 now and writes albedo to location
0 and normals to location 1 of a `count: 2` multisampled row; attachment 0's alpha drives alpha to coverage as before
(albedo and normal alpha are the same value), the resolved row is copied into each atlas. 80 → 40 model draws, one bake
program pair instead of two. Identity of D-325..D-327: atlas texels read back after bakes at five (cell, bare, spring)
sets — (128, 0, 0), (128, 0.5, 0.25), (128, 1, 0), (256, 0.25, 1), (256, 0, 0) — hash-identical at mip levels 0, 3 and
6 for both atlases; the renderer holds 50 programs after the pre-warm, as before. Cost and pixels: PERF day 16.

**D-328 — QA of 7 XI: `prim` templates only for shapes that repeat; the slope plinth is a one-off box.**
`prim` (D-320) keeps one shared BufferGeometry per constructor and argument list for the session. Every call site was
checked: the model shapes, the bridge deck frost (fixed sizes) and the ice floes (a fixed-seed stream, so the same
radii on every rebuild) repeat their arguments; the field-stone plinth under a building on a slope
(`BuildingsView`) did not — its width, depth and height follow the ground under each placement, so each building
ever placed kept its own template until the page closed. It is a plain `new BoxGeometry` again (the pre-D-320 code;
`PartBuilder.add` only reads it, so it is garbage once the merged part is built). Same geometry, tests 611/0. Rule:
pass `prim` only arguments drawn from code constants or a fixed-seed stream, never world-dependent values.
Probe (`scratchpad`, 30 world switches menu → I…XVI → menu in one page, low and high, GC between samples): JS heap
14 → ~20.7 MB after the first round of missions, then flat (20.5–20.9 MB over the next 20 switches); array-buffer
backing store 83–91 MB with no trend; three.js live geometries 70–85 and textures 22–25 throughout — the ground memo
(2 grounds per kind), the tree plan and the reed candidates do not grow with switches.
(decided)

**D-329 — QA of 7 XI: the haul card and the castle rows in every language; three small UI fixes; the layout check measures the haul card.**
Full layout matrix on the merged base (`npm run layout`, own preview of the build): 525 jobs, 0 failures, positive
control ok. The haul card (D-307) and its sheet were not in the matrix: two scenes `haul-m16` / `haulsheet-m16`
(XVI, east castle first from 0:00, the app's loop to 1:30, the card's eye tapped; the switch's toast waited out; the
card only attached, since the Flip cover folds it into the seal). Run in all 17 languages + pseudo at 412 x 915 and
915 x 412, and in the default five at every view. They found, and the shots of `tools/m16-shots.mjs` in 17 languages
showed (scratchpad, flat map):
1. Short landscape, French and pseudo: the waybill overlapped the tool rail (62 px²) once a castle goes first — the
   pennant tag's word ("d'abord", "первый", "primero") broke "Château de l'Est — avant 5:00" onto two lines. On the
   compact landscape card (D-53) the tag keeps its pennant and the row its brass tint; the word is screen-reader only,
   as the supplier's name there. All 18 languages pass. Shots `docs/shots/qa17-waybill-flag-{before,after}-915x412-fr.jpg`.
2. Every sheet's good chip with a sub-line ("+2 unterwegs", "В пути: +2", "+2运输中"): the sub-line's descenders sat on
   the kit frame's lower rule (CJK glyphs crossed it). The chip with a sub-line pads 2/6 px instead of 4/4: the text
   moves up 2 px, the chip keeps its height (an 8 px bottom first grew it and pushed the 360 x 740 pseudo castle chain
   under the dock — caught by the layout check, D-146). Shots `docs/shots/qa17-chip-{before,after}-412x915-{de,zh}.jpg`.
3. The haul sheet's two sentences were joined with a space, so Chinese and Japanese showed a gap after "。".
   `sentences(...)` in `src/ui/format.ts` joins with nothing for ja / zh-Hans, a space otherwise (Korean spaces).
4. Russian and Ukrainian said "the only wagon is on the road" for 21, 31 … wagons too (the CLDR `one` category):
   `cause.paceFleet` and `cause.paceHaul` use `=1` there; test in `tests/i18n-plural.test.ts`.
Checked and left: RTL (ar) sheet and card read in order, the period of "XVI." sits left of the numeral as Arabic
bidi puts it; long words (de, ru, uk) wrap whole; no console errors; nothing on the forbidden list. Sim untouched.
(decided)

**D-330 — Bridge ice uses one-off geometries; a test guards `prim` against world-dependent sizes.**
After D-328 (slope plinth) a scan of the remaining `prim` call sites found the same leak in `bridgesView.ts`: the
winter frost sheet on wooden bridges took its length from the bridge (`BRIDGE.cell * c.stretch`) and each of the
three floes per pile pair a random radius (`icePb.r(0.45, 0.8)`), so every frozen bridge cell and floe kept a shared
template for the whole session. Both are now `new BoxGeometry` / `new CylinderGeometry` (same arguments, same
geometry; the PartBuilder copies it, so the one-off is garbage). `primCount()` in `kit.ts` counts live templates;
`tests/prim-guard.test.ts` builds the whole model catalogue twice (count must not change) and fails if any world-driven
module directly under `src/render/` calls `prim`. The model catalogue itself is a fixed set, so its templates are
bounded. (decided)
## Menu world build: cold model builds (perf day 17, BACKLOG P3 from D-322)

**D-331 — The model catalogue is baked at build time and decoded at startup.** The procedural models built before
`ready` (10 tree models, 5 far cards, the menu's 8 building kinds, wagon rigs, yard workers) cost ~115–130 ms cold in
node and ~140 ms of `menu-start` in the browser (day 15), most of it cold code: built a second time they take a third.
Now `tools/bake-models.ts` runs every call of `src/render/models/catalogue.ts` (66 models: all building kinds and their
extras, trees, far cards, wagon near/mid/far, the 12 worker rigs, cargo units, bridge pieces) under `recordModels` and
writes one binary file: a JSON head (each model as plain data — parts, Vector3s, numbers incl. -0/NaN, undefined fields
— with geometries by index) and a data block of the geometries' own typed arrays (index, attributes in insertion order,
bounds as doubles, userData). A geometry shared between models (near/mid wagon body, worker legs/torso) is stored once
and decodes to one object. A uv that is exactly `boxUvArray(position, normal)` (97 % of the uv bytes) is not stored but
recomputed by the same function (7,0 → 6,0 MB). Each model function wraps its build in `bakedOr(key, build)`: with a
catalogue installed and the key in it, the stored value is decoded (typed-array views into the file); otherwise it
builds as before (dev server, tests, tools, `?baked=0`, a failed fetch, a model not listed). Anything the format cannot
hold (groups, morph targets, draw range, interleaved or non-default attributes, a class instance) is refused at bake
time. The file is not committed: the Vite plugin `baked-models` bakes it in a fresh node process at every `vite build`
and emits it as a hashed asset (`virtual:baked-models` = its URL), so it cannot go stale, the repo does not grow by
~2,4 MB per model change and parallel branches have no binary to conflict on. `tests/models-baked.test.ts`: two fresh
processes bake the same bytes (the build's file is the code's), decode + re-encode gives the same bytes, and decoded
models equal built ones field by field (Object.is on every number and array element, shared geometry stays shared).
Size: 6 038 632 B, 2,37 MB gzip — the APK grows ~4,6 % (51,6 → ~54 MB); resident memory +~3 MB at the menu (the file
stays whole; the models later worlds decode are views into it). Engine note: the file is made by node's V8; Android's
WebView is V8 too (same `Math.sin/cos`), an iOS WebView (JavaScriptCore) now gets V8's last-ulp results instead of its
own — models only, never the sim. (decided)

**D-332 — The catalogue is preloaded by the HTML and installed just before the first world.** The first cut fetched it
from `main.ts` and waited for it before making the view: at 4× CPU the 6 MB response came ~250 ms after the view chunk
and delayed the mount. Now the build adds `<link rel="preload" as="fetch" crossorigin>` for the asset (the fetch starts
while the HTML is parsed; `main.ts`'s `fetch` takes the preloaded response) and `boot()` awaits it only after the view
and the App are made, right before `app.start()` (no model is built before `setWorld`). In every measured run it was
already there (installed 0,3–2,6 ms after the `app` mark at 4×). The view harness decodes with `?baked=1` from
`/__baked-models.bin`, which the dev server bakes per request (the game on the dev server builds, so model edits show at
once). Result (SwiftShader, 412×915, high, fresh browser per run, interleaved, before = `9ae57b7`): `ready` 998 → 859 ms
at 1× (−14 %), 2 499 → 2 132 ms at 4× CPU (−15 %); `menu-start`→`menu-world` 365 → 228 / 906 → 472 ms; `first-frame`
1 818 → 1 621 / 3 753 → 3 165 ms. Pixels: 20 harness scenes 0 px (`docs/research/perf17-diff/`); sim untouched
(`tools/mission-hashes.ts` identical, 71 rows). Data: `docs/research/startup17-data/`. (decided)

**D-333 — Not done: an IndexedDB cache of built models, building only the first frame's kinds.** (b) IndexedDB keyed by
the model code version: the first launch stays cold (and must also write 6 MB); later launches read the buffer in 16 ms
(59 ms at 4×) on the main thread — not faster than the preloaded asset, whose fetch runs off the main thread and
overlaps the chunk load — plus a version key, a write path and eviction. (c) Only the kinds in the first frame: the
menu's first frame holds 1–2 of its 8 building kinds, which cuts the cold buildings ~92 → ~31 ms in node, but trees
(all 5 kinds in every first frame, D-325) and the near wagon stay, the deferred kinds then build cold right after the
first frame (~60 ms of jank while the menu camera pans) and off-screen buildings cast shadows into the frame. Both are
moot with D-331 (decoding a building kind is ~1 ms). (decided)

**D-334 — RTL: the pennant icons turn with the script; an audit of which icons mirror (QA 2026-11-07, BACKLOG P3).**
Arabic showed the "first" pennant (waybill row tag, the castle sheet's split line and its "Ten zamek pierwszy" switch,
the toast) flying right, against the script. Rule (as in the platform guidelines): an icon mirrors under `dir=rtl` when
its drawing points along the reading direction; pictures of things, physical turns and time do not. `RTL_MIRROR` in
`src/ui/icons.ts` = `first` and `no_route` (its destination pennant flies the same way at the end of the broken way);
`iconSvg`/`struckIconSvg` give those SVGs `class="ico-rtl"`, and `:root[dir='rtl'] svg.ico-rtl { scale: -1 1 }` mirrors
them (the `scale` property composes with the `:active` translate transforms on buttons). Already handled at their call
sites and left so: `back`/`undo` (`.rtl-flip`), the back arrow as "go to" (`.fwd`, which relies on the unflipped glyph),
the CSS chevrons (`.codex-chev`, `.ev-chev`), the alert hairlines. Never mirrored: goods and buildings (shape is their
identity, D-18), `wagon`/`no_wagon`/`buy_wagon` (a cart; the 3D wagons keep their real heading), `rotate` (a clockwise
turn of the building), `speed1/2/4` (playback speed, like media controls), `contested` (a fork as on the ground),
weather, coin, seal, eye, the map and numerals. Shots `docs/shots/m16-{card,castle,switch}-{412x915,915x412}-ar.jpg`
and the castle sheet before/after (class dropped in the page) `docs/shots/rtl-first-{before,after}-{412x915,915x412}-ar.jpg`. UI only. (decided)

**D-335 — The loss letter's three costs leave out calm seconds (BACKLOG P3 from D-212).** XV's letter named the small
fish store (`STORAGE_FULL` from 0:02) among the three costs: the ledger (`ledger.stallSeconds`, sim) charges a root every
second whether or not it reads calm. The sim stays as it is (hashes); the UI counts the calm part. `sampleCalmCosts`
(`src/ui/stalls.ts`, called every tick from `App.onTick` next to `sampleInputWaits`) looks once per sim second at every
ledger root the sim charged since the last look and books those seconds as calm when the root's building still stands in
the charged status, reads `calmWhy` (nothing to do about it: unwanted goods, a spare yard, a full granary next to one with
room, a filled order, stored road stone, a saturated market, the trading post's road) and no other building whose stall
is not calm hangs on it (its `explainBuilding` chain). The last rule keeps XV's store a cost from ~0:44, when the
woodcutters it refuses stand — the letter keeps D-212's "build a granary" with the time they really lost (passive at the
2-seal mark: 514 → 293 s). `lossCauses` (both the ledger list and the action line in `menu.ts`) subtracts the calm
seconds, drops what falls under 5 s and keeps the ledger's order; seconds the sampler did not watch (a game loaded
mid-way) are judged by the root's reading at the end. Wagons and spans are never calm; the pickup on its way and the
season stay costs (too few wagons is a real cause). Survey (`m1..m16` × passive, 1/2 wagons, lesson at 0:00 and 2:00,
the wrong site, eye 60 s; the ledger at half the deadline, at the 3- and 2-seal marks and at a real loss — most runs win
late — 225 ledgers): three costs changed in 71, the action line in 23, all from a calm root: IV's surplus farm
("wagon") gives way to the iced bridge ("bridge"; IV's lesson is the stone bridge); X's burner with its order filled ("granary") to the
contested sawmill (X's lesson); V/XII players who connected late now read "road"; VI, XII and XV players who already
built a granary no longer read "build a granary" for a store next to one with room (→ "wagon"); XV without a granary keeps
"granary". m2, m3, m7, m11, m13, m14, m16 unchanged; I changes only its third line. Test `tests/loss-causes-calm.test.ts`.
`tools/mission-hashes.ts` identical (71 rows). (decided)

**D-336 — Dispatch distance maps are memoized across ticks (sim cost night, `docs/research/2026-11-07-sim-cost.md`).**
Profile of the 50/100/200-wagon bench: 53–67 % of the tick was full Dijkstra searches of the dispatcher, ~96 % of
them inside `dispatch` (`from`, `to`, rule A's `toLoaded`), and in ~80 % of dispatch ticks the network, weather and
bridge queue penalties were the same as in the previous dispatch — the same maps were recomputed. `dijkstraMemo`
(`src/sim/network.ts`) keeps full-search distances by (start, reverse, loaded) while the `NetCache` object, rain, thaw
and the queue penalties (by content; the per-tick `spanPenalties` map, re-read only when it is a new object) stay the
same; bridge ice makes a search tick-dependent, so nothing is memoized while it lasts. The context is checked on every
call, at the moment the search itself would read it. Distances only (no reader walks `prev`), at most 64 maps
(≈ 3.5 MB on a 96×72 map; the bench holds ≤ 50), never saved, like `cache`/`scratch`. `DistCache` takes memo maps
first and recycles only the maps it computed itself. Result: identical maps, so identical choices — mission hashes,
bench and free-valley bot hashes byte-identical; `tests/dist-memo.test.ts` compares memo and fresh search at many ticks
(queues, rain, ice, a cut network). (decided)

**D-337 — Dijkstra walks cached neighbour lists.** One search was ~29 µs on the bench (362 road cells): the inner loop
scanned 8 directions with bounds checks per settled cell. `adjacency` (once per network version, on the `NetCache`)
lists for each cell the directions with an edge either way, in direction order 0..7, with the forward and reverse
cost-table indices; a missing edge still reads Infinity from the cost table, so the search relaxes exactly the same
edges in the same order (same ties, same `prev`) — ~15 µs. The memo searches straight into its own array (no copy),
and `alternativeDestination` searches in the scratch buffers (each call used to drain the recycling pool). Test: the
pre-D-337 search kept verbatim in `tests/dist-memo.test.ts` against the new one on randomized networks (rain, queues,
ice, `stopAt`), dist and prev equal. (decided)

**D-338 — Fewer searches in rule A, and small per-tick savings; behaviour unchanged.** Rule A (D-155) searched the
loaded run of every wagon in drop-off phase; it is skipped when the lower bound (a full unloading + the onward run to
the source) already fails `t < dueT` — the run is never negative and float addition is monotone, so the same wagon is
chosen. `buildingById` binary-searches the id-sorted list, with the old linear scan as fallback (hand-built states).
Rain and thaw are read once per `stepWagons` (they depend on the tick only). The surplus pass reads each granary's free
space once per dispatch and re-reads it after a job books space there. Bench medians (5 runs, own process per count),
avg ms/tick 0.108/0.222/0.234 → 0.056/0.058/0.067, p99 1.52/1.57/1.68 → 0.63/0.57/0.65 at 50/100/200 wagons (D-336..338
together). The replan budget (BACKLOG P3) stays unneeded: wagon `findPath` is ~3 % of the tick. (decided)

**D-339 — Situational entries of the stall codex, in all 17 languages (orders 72 + 102, taken over from GPT).** The
"Co to znaczy?" fold explained a bare status (`src/content/stallCodex.ts`, PL/EN, English in the other 15 languages),
so where the sheet already reads a state its own way the fold said something else: a surplus yard or a saturated
granary got the generic calm "Pełno — nic pilnego" or the red STORAGE_FULL advice ("build a granary"), the trading post
the generic NO_ROAD, the build tutorial's hut the generic NO_ROAD although the lesson rings the fold (D-259),
WAGON_DUE no fold at all (it is not a stall), and XVI's castles nothing (a starved castle reads WAITING_UPSTREAM).
Now `codexSituation(world, link, hut)` (`src/ui/codexSituations.ts`, pure read) picks an own entry for the link the
fold explains: `wagonDue` (any WAGON_DUE, D-156), `surplus` / `marketFull` / `postNoRoad` (the same `calmWhy` the
calm line reads, D-160 / D-174 / D-180 / D-170), `tutorialNoRoad` (the build tutorial's new hut while the lesson runs —
`PanelNav.tutorialHut`, from `BuildTutorial.hutId()`); a two-castle castle card always gets one via
`castleCodexSituation` — `castleRival` (another castle takes its good while it is not first, D-291), `castleEven`
(nobody first) or `castleFirst` (a castle is first, D-289/D-290), the readings of its own lead lines. Each entry:
name, one-sentence meaning, how to check, two fixes, example chain — only actions the game has ("Ten zamek pierwszy" /
"Dziel po równo", the card's road, the Road tool, accept an order, sell another good, wait); never "buy a wagon"
where a wagon does not help. Texts are i18n keys `codex.s.<situation>.<field>` (48 keys × 17 languages; terms taken
from each dictionary's own keys and docs/reviews/i18n-66-105-latin.md; ru/uk/ja/ko/zh_Hans/ar/hi only appended, their
review pass runs in parallel). The status entry for WAGON_DUE is aligned to the same PL/EN text (two fixes, the bridge
check moved into "how to check"); docs/content/stall-codex.md gains a "Wpisy sytuacyjne" section, kept in sync by
tests/stall-codex.test.ts. Test tests/codex-situations.test.ts (17 dictionaries complete, ≤ 220 characters; each
situation picked in a real or staged state, read-only). UI only, mission hashes identical. (decided)

**D-340 — RTL code fixes from the Arabic review (`docs/research/gpt-rtl-ar.md`, code issues 1–7).** (1) `bdi()` in
`src/ui/format.ts` gives content with no letter (a price, count, time, ratio: "−30", "+2", "1:30") `dir="ltr"`: a bare
`<bdi>` is dir=auto and, with no strong character, takes the parent's RTL direction, so every fix button showed "30−" and
the undo refund "5+". Names keep dir=auto (an Arabic name inside an LTR isolate would reverse its words). The two
`\u0001` link placeholders (castles.ts, pace.ts) now split on `bdi('\u0001')`. (2) The card's "?" was already mirrored
by D-284 (the reviewer read the code, not the stylesheet); the shots show "؟" (computed transform `matrix(-1, 0, 0, 1,
0, 0)`), so no change. (3) The manicule (`inspect`: menu help button, the moderator screen, help sheet, the
"ماذا يعني هذا؟" fold) joins `RTL_MIRROR` (D-334): a hand pointing at the start of a line points along the reading
direction. (4) The waybill's "أولًا" in landscape is screen-reader-only on purpose (D-329; the overflow check counted the
1 px sr-only box as "clipped"). Elsewhere the tag gets `flex: none` and the castle line `min-width: 0`, so a long line
wraps instead of squeezing the tag. (5) See D-341. (6) `t()` isolates number parameters itself in RTL
(`isolateNumberParams`, `src/i18n/bidi.ts`): a parameter whose value has no letter is wrapped in FSI…PDI together with
a sign before it ("+{n}", "−{price}", "×{k}"), a percent after it and number parameters joined by "/", ":" or "–";
a parameter the translation already isolates (⁨{time}⁩, ⁨+{n}⁩) or an `iso()` value is left alone, and names are never
wrapped (an isolate between two Arabic letters breaks their joining). Only `ar` is in `RTL_LANGS`, so the other 16
languages are byte-identical; `tHtml` markers contain letters and keep their `<bdi>`. The existing marks in `ar.ts`
stay (harmless, and they cover HTML paths). Test `tests/i18n-bidi.test.ts` (units + every Arabic message balanced, no
doubled isolate); the dictionary lists of the codex test and the i18n tools skip `bidi`. (7) The moderator screen's
device field has `dir="auto"`. Shots `docs/shots/rtlui-*-ar.jpg`. UI only, mission hashes identical. (decided)

**D-341 — In Arabic the contract numeral is rubricated.** "I. الخبز والألواح" in the HUD ribbon: a lone "I" in the
display face, with the period on its left as Arabic bidi puts it (D-329), reads as an alef. Arabic ordinals or Arabic-
Indic numerals would break D-73 (Roman numerals in every language, shared with the menu medallions). `missionTitleHtml`
(`src/ui/menu.ts`) puts the leading numeral and its period in `<span class="roman">` (no isolate: the reading order is
unchanged); in RTL the ribbon draws it in light brass (#e6c27a on the wine ribbon) and the opening letter's heading in
wine, as a scribe rubricates a number. Latin scripts look as before; accessible names keep the plain title. (decided)

**D-342 — Goods shape audit (order 81, taken over from GPT): the icons stay; bread vs malt on the wagon bed is a proposal.**
The goods icons are one ink colour, so shape was always their only identity. In grayscale at 16–48 px, struck through,
light on dark and blurred, all ten read apart (`docs/shots/goods-shapes-icons-{gray,blur}.jpg`; pair scores by
`tools/goods-shapes.mts`, IoU of the 18 px masks: highest flour–stone 0.63). The weakest pair, wood–stone at 16 px, still
separates by proportion and outline, so `icons.ts` is unchanged — a redraw would not be clearly better. The 3D loads
seen from above in grayscale (`tools/model-preview.html` views `cargoBase` / `cargoChain`, shots
`goods-shapes-cargo-*.jpg`) have one weak pair: bread baskets and malt tubs (D-201), both six round open containers in
a 2×3 grid. At the default zoom a wagon is ~25 px and the ETA tag's icon names the good, so it matters only zoomed in.
Proposal (BACKLOG P3, art owner): oblong bread baskets. Not done here: a render change with a catalogue re-bake
(D-331). Report `docs/research/goods-shapes.md`. (decided)
**D-343 — Playtest scene S16 "Two castles" (mission XVI): a decision fixture, its own CSV columns and hypothesis H6
(order 103, taken over from GPT).** The order named the scene "S10", but PROTOCOL §3E already uses S10–S15 for missions
VII–XII and `scenario_id` is the aggregation key, so two different scenes would merge in the per-scene table; the scene
is **S16** (mission XVI), its columns `s16_*`, its hypothesis H6 (BACKLOG, next after H1–H5). It is not a stall but a
decision, so the fixture `two-castles` (`src/game/fixtures.ts`, mission m16) plays the mission as dealt with no command
and stops at the first tick where, for 1 s, the east castle (main contract, building 5) is late at the even split while
"this castle first" would bring it in on time — tick 10 (0:01), forecast 6:52 vs 5:00, first 3:56 (`castleForecast`,
D-290/D-313); `checkFixture` also requires two orders, none done, no castle first and a tick inside the 1:30 switch
window. The moderator screen lists it as start S16 tagged "prepared state" + "decision, no stall"
(`playtest.decision`, 17 languages). The results row keeps its column order and appends five columns at the end:
`s16_castle_named`, `s16_switch_named` (moderator) and `s16_first_set_s`, `s16_first_castle`, `s16_east_result` (game:
the first accepted castleFirst after the first touch, in seconds of play, its castle, the east letter on exit), filled
only for S16. `tools/playtest-aggregate.ts` prints an S16 block: H6 passes when `correct=1`, unassisted, `time_s<30`
AND the east castle was set first before 1:30 of play. Fixture version stays 2 (no existing script or check changed).
UI and tooling only, mission hashes identical. (decided)

**D-344 — Seventh help topic "Several castles", opened by the "?" of a two-castle castle card (order 104, taken over
from GPT).** Text in docs/content/help.md (PL/EN, same length class as the six others: deadline per castle, even
split by default, "This castle first" acts on the last leg only, the card says who gets the goods now, decide early),
keys `help.castles.h/.p` in all 17 languages using each dictionary's own `castle.first` label and quotation marks. Icon:
the existing woodcut `first` pennant (no new pack icon). Placed after "Granaries", before "Valley and ranks". The "?"
mapping stays by sheet kind (`HELP_TOPIC_OF_KIND`, D-254); `SheetContent` gains an optional `helpTopic()` that wins
over it, and only the building card uses it: a castle holding one of two castle orders while the mission runs
(`twoCastleOrder`) opens "castles", every other building card still "cause". Tests: tests/help-map.test.ts. (decided)

**D-347 — A11y fixes after the 8 XI audit: the castle switch is two action buttons, castle bars and playtest starts
are named in full, AA contrast on the two-castle waybill and the dim frame, the codex fold scrolls into view (order 82,
taken over from GPT).** Report `docs/research/a11y-2026-11-08.md`; `tools/a11y-audit.mjs` gains the scenes of UI since
5 XI (castle16, castle16-codex, help-castles, haul16, playtest). (1) The XVI switch had `aria-pressed` while its label
changes with the state, so with the castle first a screen reader said "Share evenly, pressed" — the opposite. Both
states are plain action buttons now (the lead line and the toast say the state); the icon dim moved to
`.castle-switch.is-on`. (2) The two-castle waybill bars were "planks 0/24" and "planks 0/30"; each carries
"<castle>: <good> n/need" as its name. (3) "on time" (`--meadow`, 15 px) measured 3.4–3.7:1 and "first" (12 px)
4.1:1 on the HUD panel, which paints darker than a sheet: new token `--meadow-dk #3a4428` for `.castle-eta` and
`.tr-state`, the tag in `#5a4117`. Soft ink on `frame-sheet-dim` (settings hint, the moderator's screen) 3.43:1 →
`--ink-soft #352f27` inside dim-frame sheets. (4) At 200 % text in short landscape the second castle row ran under
the tool rail; `body.is-landscape.is-bigtext` lets the two-castle waybill panel (`:has(.wb-castles)`) scroll above the rail (a better layout stays
BACKLOG P2). (5) Opening "Co to znaczy?" under the docked fix showed nothing new on screen; the fold now scrolls the
answer's first line into view (the body's scroll-padding keeps it above the dock) and has `aria-controls`. (6) A
playtest start's accessible name carries its tags ("S16: XVI. …, decision, no stall"). Source tests
`tests/a11y-markup.test.ts` (i18n cannot load under tsx). Audit before → after on the new scenes: low contrast
8 → 1 (412×915), 9 → 3 (915×412: a 1 px sr-only word, text by the dim frame's ornament on the moderator's screen), clipped at 200 % 6–8 → 0–1. UI only, mission hashes
identical. (decided)

**D-348 — Forced colors: woodcut icons on a Canvas plate, the progress bar outlined.** In forced-colors / high-contrast
mode the browser keeps the painted kit (url images) and puts a backplate behind text, but the icons draw in
`currentColor` = the system text colour straight onto the parchment — white on paper in a dark theme — and the
bar's groove (gradients, inset shadows) disappears. Under `@media (forced-colors: active)` every `svg[role=img]`
gets `background: Canvas` (the same plate as text), `.kbar` a 1 px `CanvasText` border and its fill `Highlight`.
Chosen over `forced-color-adjust: none` on the kit, which would keep the authored colours and ignore the user's theme.
`npm run a11y` checks it (dark palette: every visible icon plated, every contract bar outlined). Shots
`docs/shots/a11y82-forced-colors-before-after.jpg`. (decided)

**D-349 — Layout in de, ru, ar, ja, hi (order 83, taken over from GPT): three shorter Japanese strings and a smaller
Cyrillic sheet title in short landscape.** `npm run shots` gains `SHOTS_LANG` / `SHOTS_OUT` (one language for every
screen, plus the XVI screens), and `road-steep` / `haul16` pass `debug=1` (their helpers are debug-only on a built
preview, D-51). 195 shots (flat map) and a DOM clipping probe over 180 runs: no clipped text. Fixed: ja
`cause.NO_WAGON.NONE_CAN_REACH` 「届く荷車なし」, `cause.paceCastleEven` 「{late}遅れ — 均等に分配中」,
`cause.paceCastleAfter` 「{late}遅れ — {rival}が優先」 (each left a one-character orphan line on the stall card or
the pace card); ru "Восточный замок" broke into three lines in Ruslan Display in a short side sheet —
`:root[data-script='cyrillic'] body.is-short .sheet-head h3` 22 px (two lines). de "Wa-gen kaufen" on the tool
card stays (readable; a shorter label loses the verb). The full `npm run layout` stays with the coordinator.
Report `docs/research/layout-17-2026-11-08.md`. (decided)
**D-345 — Order 68 (taken over from GPT): four new woodcut state icons; the trading post and the bottleneck keep the
woodcuts they already had.** The order listed six concepts. Two already had their own icon drawn for this game:
`tradePost` (steelyard on a post, D-170) and `bottleneck` (mill hopper on a trestle, D-171). A second picture for
the same thing would make the player learn two shapes, so they stay. Four new ones in `src/ui/icons.ts`, on the same
kit (filled polygons only, hand-cut contour, gouge cuts, white-line hatching, `currentColor`, 24×24):
`wagon_due` — the bare cart rolling forward over a rut trail that breaks up behind it, with a small hourglass above
(not `wagon`'s horse, not `buy_wagon`'s plus, not `waiting`'s big hourglass); `market_full` — a two-pan balance on a
column, tipped hard: the pan of goods heaped over the rim sits low, the pan with one coin rides high (a centred column
and pans on cords, leaning the other way from the steelyard of `tradePost`); `grow` — two gabled houses of one
trade on a ground line and a plus of two squared timbers, the cross-beam laid over the upright (not `build`'s open
frame, not `buy_wagon`'s plain cross); `cut_road` — two wheel ruts running corner to corner from lower left to upper
right, with a gabled house standing across them, the ruts breaking off before its walls (against the strike bar's
slant, so it never reads as a crossed-out icon). At 18 px the closest silhouette (IoU of ink masks, from
`tools/icons68-sheet.ts`) is 0.37 / 0.35 / 0.46 / 0.34 (brewery, mill, malthouse, follow). None of these is a
near-identical shape (goods pairs run 0.5–0.6).
Where they appear: `WAGON_DUE` status (pins, chain rows, building card status line; D-156) and the "pickup on its
way, due in …" calm hint (D-193) → `wagon_due`. A granary full only of loads no market takes (D-174, the
`status.STORAGE_FULL.saturated` text) → `market_full` on its pin, the worst-stall seal, the chain row and the status
line (new `buildingStateIcon(world, id, status, size)` in `format.ts` reads the world; `buildingStatusIcon` stays
world-free), plus the "market full" calm hint (D-180), which used the coin. The grow card (D-192) puts `grow` on the
alarm seal, as the bottleneck card does with its hopper (the rank card keeps the first pin's icon: its missing good is
read there). The trading-post pace card (D-245) puts `tradePost` on the seal, and the post's "buying" status line
shows the post instead of the coin. A ghost refused because it would cut a diagonal road step (D-176,
`place.cutsRoad`) leads its tag with `cut_road` (20 px). RTL (D-334): only `wagon_due` joins `RTL_MIRROR`, because
the cart drives in the reading direction and its trail lies behind it. The balance, the houses with the plus and the
road with the house are pictures of things, so they do not mirror. Sheet `docs/shots/icons68-sheet.png` (18/32/64 px
on parchment and on oak, grayscale beside the nearest existing icons, the RTL row, the IoU table), shots
`docs/shots/icons68-{market,grow,cut}-{412x915,915x412}.jpg` (`tools/icons68-shots.mjs`). UI only, no sim change.
(decided)

**D-350 — Orders 69, 79, 80 (taken over from GPT): nine sounds of own synthesis, CC0, reproducible.** GPT delivered no
files. Downloading CC0 recordings again would mean a licence check per page; synthesis has no licence question, so
all nine are own work, rendered by `tools/synth-sfx.py` (numpy + ffmpeg, fixed seeds; method and numbers per file in
`docs/ASSETS.md`). Format per the orders, not the older 24 kHz pipeline: 48 kHz, cues mono at -16 LUFS (true peak
<= -0.9 dBTP, silent first sample, faded last), loops stereo at -23 LUFS (the catalogue checker wants stereo under
`ambient/`). A sub-second cue reads 1–2 LU differently per codec in ebur128 (400 ms block alignment, AAC pre-echo),
so each codec file gets its own gain trim to its decoded reading. Loops are built circularly — events wrap, noise is
shaped in a circular STFT, reverb is a circular convolution — so the OGG seam is continuous (jump/p99 0.3–0.9).
The coin exchange (order 80) is a one-shot, mastered like the cues; "as 79" read as format and licence rules.
Cue energy in 600–2500 Hz: 70–98 % (phone speaker). New runtime size ~0.92 MB, catalogue 2.55 of 4 MiB.
Not yet heard on a phone: the owner listens before the merge (BACKLOG). (decided)

**D-351 — Where the new sounds play (audio only reads state).** `ui.rankUp` (two bell strokes) replaces `ui.paper` on
a rank-up; when that rank opens the trading post (the rank letter carries the post line), `event.postOpen` follows
1.3 s later, after the bell. `ui.rankCard` / `ui.grow`: the HUD calls `cardCue` once per new rank/grow suggestion
(kind, building type, rank) — not when the same suggestion returns after a fleet card held the slot, never for the
card already up when the HUD is built (a loaded game stays quiet); 8 s cooldown on top. `world.iceCrack`: once,
unpositioned, when the wooden bridges ice over (authored ice or the free valley's winter windows), and positionally
where a wagon becomes `BRIDGE_CLOSED`. Winter in a seasonal world (`World.seasons`, passed in the audio camera)
swaps morning/evening for `ambient.winterWind` (rain still wins); while the bridges are iced the river loop yields
to `ambient.iceCreak` at the same river-proximity level. The open trading post (rank >= 4, market open, no
contract) plays `ambient.market` within 75 m of it (level 0.7 × proximity, gain 0.45: quiet), and `post.coins` at
the post on every rise of `tradePost.earnedCents` (a sale). Gains put the cues in the existing mix (audit, effective
level through a 300 Hz phone model): rank-up -26.5 dB (the loudest UI cue, as befits a rank; paper -28.8), post
open -30.2, ice crack -30.4, grow -31.6, rank card -31.9 (stall alert -33.4), coins -36.4 at the post (load sounds
-35…-50). All go through the existing sfx/ui/ambient buses, so the effects slider and mute apply. Tests in
`tests/audio.test.ts`. (decided)
**D-352 — Bread rides in oblong trays (D-342's proposal, prepared for the owner's yes).** In grayscale the bread
baskets and the malt tubs (D-201) were the one confusable load pair: six round open containers in the same 2×3 grid.
Bread now rides in long oval wicker trays, about 1 : 1.6 along the bed (a 12-sided open lathe with a rolled rim,
squeezed to 0.46 × 0.73 m, 0.2 m high), each holding three long loaves lying lengthwise (two side by side, one on
top). Seen from above and from the game camera the load is a row of long ovals with ridged filling against malt's
round domed tubs, grain's upright sacks and flour's flat pale pillows (`docs/shots/bread-cargo-compare-gray.jpg`:
old bread, new bread, malt). The trays keep one heading along the bed (slot yaw ±0.04 instead of the random spin the
round baskets had), so the ovals never turn crosswise or poke over the side boards; slots, unit count (qty 1..6) and
the yard pile placement (D-71, from the unit's bounding box) are unchanged. Cost: the same two parts per unit (wood +
cloth, so the same instanced draws per good), 186 triangles per unit instead of 180 (full load 1116 vs 1080; the
tray drops the outer bottom disc, which stands on the bed and is never seen, to pay for the smoother oval). Only
`src/render/models/cargo.ts`; the catalogue is re-baked by the build as for any model change (D-331,
`tests/models-baked.test.ts` passes). Pixel checks: model preview `cargoChain` 0 px changed, `cargoBase` changes only
on the bread wagon and the bakery yard pile; harness menu frame 1 and the other scenes in
`docs/research/bread-diff.txt`. Reverting is the one commit. (decided — owner yes 2026-11-08)

**D-353 — The landscape waybill keeps the order and its pace above the rail at any text size: a measured room, a
compact form when short of it, and the card moves over the tools when the stall card would be under it (a11y
follow-up of 8 XI, BACKLOG P2).** In short landscape at 200 % text the waybill hanging from the top bar met the rail
growing from the bottom: with one order (IV winter, III autumn) the pace line ran under the tool cards; with two
castles the D-347 scroll used a fixed height (screen − rail − 120 px, ~80 px at 915×412) and showed only the head.
(1) `hud.ts` measures `--wb-room` from the panel's top to the highest rail piece *beneath the panel* (tool, stall
card or alarm seal that overlaps it horizontally), on the existing ResizeObserver (now also the rail, the stall row,
the panel body and the pill). The panel's `max-height` is that room in every layout but the Flip cover (portrait too: at 200 % the pace card
covered the waybill's supplier row) and it scrolls inside it; with normal text it always fits (unchanged look). (2) When the full form would scroll, `.is-tight` (decided
with the class off, so it cannot flip-flop) gives a compact form that hides no information: the pill shows its icon
and the bare clock (as the folded seal and the Flip cover do) and the pace line the Flip cover's short form
("gotowe za 7:38", `contract.sealPace.*`, D-99), both with the full sentence kept for screen readers; with two
castles the panel's head (seals, clock to the nearest deadline — both repeat what the castle rows say) goes under
the list. (3) At large text in landscape the card is wider (`clamp(272px, 36vw, 330px)`, the ribbon fits one line
more often), the seals are 20 px, and a castle row is its name over one row of good, count and state (bar slim under
the count; the count keeps its width, the state wraps in the rest) instead of three rows. (4) With the hand's side on the logical start (RTL right-handed, or LTR
left-handed: `body.left-handed`) the stall card lies under the card's usual place and left one row of room at 200 %;
there, at large text only, the bar keeps menu, chips and speed together at the start and the card takes the far end,
above the tools. Chosen over folding the waybill to its seal at large text (the order is the one thing the player
reads all the time) and over scrolling alone (the key rows would still be cut). Result at 915×412, 200 %: IV/III
pl, de, ar — seals, clock, both goods and the pace line on screen; XVI pl, de — both castles' name, count and state on
screen (head scrolls), ar — the castle names take two lines each, the second castle's count row is cut by ~10 px
and scrolls; portrait 412×915 at 200 % — the whole card (compact) above the pace card in pl/ar, de: goods and pace
line, the supplier row scrolls; 904×1000 and normal text unchanged; Flip cover (360×380)
already shows clock + pace line + tempo (watch mode, D-99/D-155). UI only, mission hashes identical. (decided)

**D-354 — Forced colors: the primary button gets a system border and focus a 3 px Highlight ring; language names in
the game's body face first.** Forced colors drop gradients and box-shadows, so the wine primary button was a white
field with no edge in a light theme and the two-tone focus ring lost its pale bands (2 px left, same colour as
everything else). Under `@media (forced-colors: active)`: `.btn.primary` has `2px solid ButtonBorder`, every
`:focus-visible` a `3px solid Highlight` outline (offsets unchanged, so the map pin keeps its inner ring).
`npm run a11y` checks both in the light palette (start button of the mission letter). Separately (layout 8 XI, P4):
the language grid sets `font-family: 'Alegreya Sans', var(--font-body)` — under a CJK interface the stack began with
Noto Sans CJK, whose wide Cyrillic made "Українська" 2 px wider than its cell; Latin and Cyrillic names now read in
the game face in every language, CJK, Arabic and Devanagari names fall through to their script's face. (decided)

**D-355 — Help opened from a card's "?" focuses the asked topic's heading; an open "Co to znaczy?" fold gets the
rail's height in a short landscape sheet.** (1) `SheetContent.initialFocus` (new, optional): `Sheets.open` focuses
what it returns two frames after the sheet is laid out (after the sheet's own focus and the content's first
scroll). Help opened on a topic (D-254/D-286/D-344) returns that topic's fold button (expanded), so a screen reader
starts at "Kilka zamków, rozwinięte" with the answer next, not at the close button above seven headings; help
from the menus still focuses the sheet. `npm run a11y` checks it on the XVI castle card. (2) The XVI castle card at
915×412 is a side sheet between the bar and the rail (~200 px), so the opened fold showed 3–4 lines between the
lead lines and the docked switch. While a codex fold is open in a short landscape side sheet, the sheet runs down
over the rail on its own side (the tools on the other side stay free) and is wider (`min(460px, 50vw)`); closing the
fold or the sheet gives the rail back. Chosen over folding the rival line (BACKLOG idea): the rival line is the
card's own diagnosis and the fold explains it, so both stay; the room comes from the rail, which the reader is not
using while reading. Applies to every codex fold (why sheet, wagon) in short landscape, not only XVI. (decided)

## Mission XVII "Drewno na dwa listy": chain priority (owner approval 2026-11-08, research §3 C)

**D-356 — "Cały łańcuch dla tego zamku": the `chainFirst` command and the chain lift in the dispatcher.**
Research §3 C (`docs/research/2026-11-07-two-castles.md`) found that with two castles wanting *different* goods made
from one input (planks from the sawmill, charcoal from the burner, both on the same wood), the XVI castle-leg switch
does not help (the planks lack wood, not wagons) and a chain priority is needed. `{ t: 'chainFirst', castle }`
(`src/sim/commands.ts`, in the replay allowlist) sets `mission.firstCastle` and the new optional `mission.chainFirst:
true`; `castle: -1` deletes both keys, and `castleFirst` (the leg switch) deletes `chainFirst`, so a cleared or a
leg-only state serializes exactly like one never touched. Refused (BAD_TARGET) unless the mission def has
`chainPriority` (only m17; XVI keeps its one switch). The dispatcher (`src/sim/logistics.ts`) computes `chainLift`:
walk down from the first castle — a good it still lacks (order − stock − on the way) minus what its producers hold or
are making is what the chain must still make; by the recipe, that much input minus what those producers hold or have on
the way is what they still need; while it is above zero they are *lifted* (input demands at `CHAIN_PRIO` 0.5: after
the castles' −1/0, before every other workshop's 1) and the input goes on down. While a lifted workshop asks for a good
and cannot get a full load yet, the other workshops do not take that good in this dispatch (`chainHeld`), so the next
load goes to the chain instead of being nibbled away by the starving consumer's two-unit restarts. Why "only as much
as the order needs": the prototype's strict lift (until the castle holds everything) starved the other castle (research
§1.4: B 7:42 → 9:22, C 6:45 → 8:42); measured here, the lift ends at ~0:50 once the sawmill holds the wood for the east
castle's last planks, and the wood is split again. `saveGate` checks the key (only `true`, only with `firstCastle`);
the fuzzer draws `chainFirst` only where the mission offers it. Everything is behind `mission.chainFirst` /
`MissionDef.chainPriority`: `npx tsx tools/mission-hashes.ts` — the 71 rows of I–XV identical before and after (new m17
rows appended after them), `tools/bot-m16.ts` output identical, `CONTRACT_GOLDEN` gains m17 only. (decided)

**D-357 — Mission XVII data, thresholds and ladder; the castle-leg switch is "no help", not "worse".**
Dry valley (`valley-m3`), no rain, no building: **one** woodcutter (22,37) for the sawmill (38,42) and the charcoal
burner (52,42) (4 wood each), stable, east castle (84,42) = main contract, north castle (62,27) on the spur; 60 silver,
6 wagons. East 24 planks by 5:30, north 6 charcoal by 8:00, end 12:00; 3 seals by 7:30, 2 by 9:30 (working
thresholds). Research C as written (2 woodcutters, 4 wagons, 30 planks by 5:00, 10 charcoal by 8:00) is wagon-bound,
not wood-bound: there the chain lever only reorders wagons, a bought wagon fixes everything (+1 wagon: 3★) and the
results are chaotic (chain @0:00 east 6:31, @1:00 5:50). A sweep (~1300 configurations: woodcutters 1–2 and their
position, wagons 3–6, both orders, starting wood) picked the shape where wood is the shared bottleneck and wagons are
plenty, with the widest margins. Ladder (`npx tsx tools/bot-m17.ts`):

| Strategy | End | East | North | Late | Seals |
|---|---:|---:|---:|---|---:|
| nothing (even split) | 7:11 | 7:11 | 3:33 | east | 2 |
| east castle leg first @0:00 (XVI switch) | 7:11 | 7:11 | 3:33 | east | 2 |
| **east whole chain first @0:00** | **6:18** | **3:51** | 6:18 | — | **3** |
| east chain @1:00 / @1:30 / @2:00 | 4:59 / 4:59 / 5:16 | same | 4:22 / 3:39 / 3:33 | — | 3 |
| east chain @3:00 (too late) | 6:17 | 6:17 | 3:33 | east | 2 |
| north chain first @0:00 (wrong castle) | 7:51 | 7:51 | 3:31 | east | 1 |
| +1 / +2 wagons @0:30, no switch | 7:11 | 7:11 | 3:33 | east | 2 |
| east chain + 1 wagon | 7:02 | 3:51 | 7:02 | — | 3 |

Margins: nothing 19 s under the 3-seal line (so 2★, not 1★), the chain 72 s under it, the east letter 99 s early with
the chain at 0:00 and 14 s at 2:00 (decision window ~2:00, as XVI's ~1:40). The castle-leg switch gives the **same run**
as doing nothing (every row: wagons are never short here, so the order of the plank wagons changes nothing) — wrong
because it does not help and costs the decision window, but it does not cost a seal. A config where it is strictly
worse in seals exists only with a 1–5 s margin (2 woodcutters, 3–4 wagons) where the chain itself is fragile; I chose
the robust ladder and leave this to the owner (BACKLOG, question 1). Mission page `docs/missions/m17.md`, tests
`tests/m17-chain.test.ts`. (decided — thresholds working, owner to confirm)

**D-358 — Diagnosis: NO_INPUT.CHAIN_FIRST, the castle card's chain line, the forecast's share of the shared input.**
(1) New stall cause `NO_INPUT.CHAIN_FIRST` (data, `blockedBy` = the workshop on the first castle's chain; the castle is
`mission.firstCastle`): read by a consumer outside that chain waiting for an input that a wagon takes to a workshop on it
(`chainShops`: every producer of what the first castle still lacks in store, and of their inputs) or that a lifted
workshop still asks for; checked after WAITING_DELIVERY and WAGON_DUE, before NO_WAGON and CONTESTED. Status line
"Drewno → Tartak, dla Zamku Wschodniego"; the cause chain goes burner → sawmill; stall codex entry (pl/en,
`docs/content/stall-codex.md`). With the chain on, the burner reads it for 35 s of the ladder run; never without
`chainFirst` (test). (2) `castleChainRival(world, castle)` (read-only, `src/sim/diagnose.ts`): this castle's producer
stands idle short of an input another castle's workshop holds or gets for a good that castle still lacks. The castle
card line (`src/ui/castles.ts`): "Tartak stoi — drewno idzie na węgiel drzewny dla Zamku Północnego." at the even split
from 0:41 (the lesson's first read: the east castle's own card says why its planks are late) and "Węglarnia stoi —
drewno idzie na deski dla Zamku Wschodniego." with the east chain first; the producer is a link. Codex situation
`castleChain` (17 languages). Never in XVI (one good, one producer; `castleRival` names that case). (3) The XVI castle
forecast took the sawmill's full wood for each castle (east "on time" at the even split). `castleForecast` and the
two-castle `contractForecast` now give a chain `inputShare` of the input capacity: 1 when it goes first with its chain
or nobody else's chain takes the input, else 1/(1 + rivals) — 0 rivals in XVI, so its forecasts are unchanged. At 0:30
the even split now forecasts east 5:48 (late; real 7:11) and "first with the chain" 3:51 (real 3:51). (4) The card's
switch dock (XVII only): "Cały łańcuch dla tego zamku" (primary, note "gotowe ok. …") above "Ten zamek pierwszy" (note:
"Tylko gotowy towar jedzie najpierw tutaj — surowca nie przybędzie."), then "Dziel po równo" once
on; both ≥ 48 px dock buttons; a toast confirms. (decided)

**D-359 — Mission XVII content: menu, letters, 22 keys in 17 languages, screenshots.**
Appended to the menu as XVII after XVI (no renumbering): "XVII. Drewno na dwa listy" / "Jedno drewno, dwa łańcuchy".
The castellan's letters (opening with both orders and times, the hint "Wozów masz dość — brakuje drewna. Na karcie
zamku dasz pierwszeństwo samym wozom albo całemu łańcuchowi. Zdecyduj od razu.", 1–3 seals, loss) in 17 languages;
pl/en authored, the other 15 letters and the 22 new UI keys (status/cause lines, castle-card lines, switch notes,
toast, menu, codex situation) are agent translations, flagged in BACKLOG for native review. Screenshots
`docs/shots/m17-{letter,card,castle,chain,burner}-{412x915,915x412,904x1000}.jpg` (`tools/m17-shots.mjs`). (decided)

**D-370 — Time-of-day lights: a pure refresh gate, nothing recomputed while paused, forced on resize and speed change; keyframes parsed into columns (owner approval 2026-11-08, follow-up of D-223/D-257).**
The every-2nd-frame refresh itself already shipped as D-257; this closes what it left. (1) The decision moved out of
`view.frame` into `src/render/lightGate.ts` (`lightsDue`, allocation-free, `tests/light-gate.test.ts`): refresh on
even frames, at once on a snap (world, menu, weather/season snap at load), a quality switch, a **resize** (new), a
**speed or pause change** (new, `WorldView.noteSpeed` from `App.frame`), a long frame (> 100 ms) and while the clock
catches up a jump (> 0,002 day); on even frames only if the smoothed clock or rain moved since the last refresh
(> 1e-7 / 1e-6), so a settled pause recomputes nothing. Skipped frames touch no light, fog, sky or shadow value;
`fitShadow` still re-fits only when the sun direction moved, i.e. on refresh frames (shadow cadence as in D-257).
(2) `Lighting.update` read the keyframes through 11 `(k) => k.field` closures per call (closure objects and boxed
return values in unoptimised code); the keys are now parsed once into one Color / Float64Array column per field and
the segment is found once per update. Output bit-identical (60 000 (time, rain) pairs swept against the old code: 0
differences). Measured: Node microbench `update` 0,41–0,48 → 0,17–0,23 µs (heap growth ≈ 0 before and after: TurboFan
already escape-analysed the closures); in the page (production build, m12 high): refreshes per 40 frames 20 at ×4,
20 at ×1, 1 on pausing, then **0** while paused (D-257: 20). `frame9-cost` m12 high, 2 runs each: total allocation
near 2,88 / 2,88 → 2,84 / 2,88 MB/s, mid 2,27 / 2,26 → 2,26 / 2,27 (unchanged within noise); `lighting.ts` near
49 / 50 KB/s → below the report's top-14 cut in both runs; the rest of the light cost is three.js `setValueV3f`
(~320 KB/s near, mostly the probe's own GL-call wrapper, identical before/after); frame CPU not comparable (SwiftShader
shared with another agent's browser). Visual (412×915, dusk 0,742 at the ×4 clock rate, synthetic frames, warm state):
frame-to-frame change every-frame lights 4,6–15,6 k px (mean 0,017–0,051 /255) vs gated 3,0–20,9 k px (0,012–0,067) —
same order, dominated by water/foliage animation, no stepping; same frame gated vs every-frame 18–25 k px of 377 k
(mean 0,08–0,10), only on shadow edges (one-frame sun lag, as D-257). Shots
`docs/shots/d370-dusk-412x915-every-frame.jpg` / `-every-2nd-frame.jpg`. Render only, hashes unchanged. (decided)

**D-380 — The free valley's card builds a chain step in one tap: producer + consumer (owner yes 2026-11-08, BACKLOG P2 from D-267).**
The card-60 player (one look a minute) did not reach rank 5 in two of four valleys: every malthouse and every brewery
was its own minute, and silver piled up unspent (11–15 k at 120 min). The grow card (D-192) and the rank card (D-152) now
carry an optional `then`: the chain consumer of the named producer (farm → mill, mill → bakery, woodcutter → sawmill,
malthouse → brewery), when one more producer lets that consumer grow by the same ratio rules (`growThen` in
`src/ui/paceCard.ts`: consumer < supplier after the +1, the consumer's own consumer keeps up, the consumer unlocked by
rank — D-267) and silver covers both plus the fleet reserve (grow) / both (rank). The card and its button read
"Postaw jeszcze: Słodownia + Browar" with the sum of both prices (`build.pair`, `src/ui/cardBuild.ts`). One tap opens
the build tool with the producer's ghost as before; once it stands, the tool reopens at once with the consumer's ghost
by it (`App.buildThen`). A producer whose gate is cut off gets the gap finder first, as before, and the card names the
consumer next; leaving the build tool drops the pair. No sim change (mission hashes identical).
Measured (`tools/sandbox-first30.ts --minutes 120 --seeds 1301,1302,1303,1304 --only card-10,card-30,card-60`,
`--no-pairs` for before), rank-5 minute:

| player | before | after |
|---|---|---|
| card-10 | 89,1 / 90,0 / 91,7 / 90,2 | 89,4 / 86,6 / 90,6 / 88,4 |
| card-30 | 96,4 / 95,5 / 95,8 / 99,9 | 95,7 / 97,6 / 99,6 / 93,7 |
| card-60 | 119,9 / – (R4) / – (R4) / 118,2 | **108,2 / 117,9 / 113,7 / 113,2** |

Card-10/30 within noise (they already had the minutes); card-60 now reaches rank 5 in every valley. Tests
`tests/card-pair.test.ts`. (decided)


**D-390 — A valley card never names a building the build tool cannot place; the grey stone button gets a quarry (2026-11-08).**
Coordinator's measurement (`tools/sandbox-first30.ts --minutes 120 --seeds 1302 --only card-60 --no-pairs`): from 97:00
to 119:00 the bottleneck card (D-171, D-264) read "Postaw: farm" every minute and the tool could not place it, with 14 k
silver in hand. Cause, in the game, not the tool: `computeCard` anchored the ghost at the nearest farm and never asked
whether the build tool finds a site there (D-175 `siteExists` guarded the rank card only) — `buildSite` returned null
(the farms walled in by later buildings), so the game's build tool would have opened the ghost at the screen centre.
Fixes (`src/ui/bottleneck.ts`, `src/ui/site.ts` `siteAnchor`):
1. The anchor (`neckAnchor`) is the first, in order, of: the producers by loaded travel time to the waiting consumer,
   that consumer, the other consumers, the castle, the stable — with a site a road reaches (`siteExists`, D-266). None:
   the card skips the good (next good, then the fleet card). The sheet's "Postaw: …" button now carries the type
   (`producer:<anchor>:<type>`), since the anchor may be a mill or the castle (it used to build the anchor's own type).
2. A good whose producers sit on a full yard (OUTPUT_FULL) half the window on average is no shortage (new `full` ring,
   like the D-171 "starved" rule): the consumers wait for the haul, not for grain. Without it the now-live card had the
   card-10 player build a farm every 10 s (a hundred farms OUTPUT_FULL.NO_DESTINATION, grain still "short").
3. Trading post `IDLE (crit) -> pave?unhandled`: a tool gap in 3 of 4 valleys — the sheet's "Wyłóż most kamieniem" is
   live and the tool now presses it (the span paves, the card goes). Seed 1304 was a real dead end: no quarry (no rock
   within 10 cells of the castle, so the rank card never offered one, D-175), the stone button grey with "postaw
   kamieniołom" for ~20 min. `quarryForPave` (`src/ui/stalls.ts`, free valley only): held span + NO_STONE + no quarry ->
   the sheet's button is "Postaw: Kamieniołom" by the first building with a quarry site (this one, castle, stable, any),
   hint `fix.paveQuarry` (17 languages); once a quarry stands the stone button returns.
Tool (`tools/sandbox-first30.ts`): presses the sheet's pave / producer / quarry cures, opens the granary ghost by the
sheet's anchor (D-391), and takes back a producer cut off later with no link left (as D-264 for NO_ROAD). No sim change.
Dead-card time (looks ending `?fail` / `?unhandled` / `?NO_STONE`, in minutes of 120, seeds 1301–1304):

| player | before | after | before `--no-pairs` | after `--no-pairs` |
|---|---|---|---|---|
| card-10 | 54,8 / 19,2 / 34,5 / 13,5 | 0 / 0 / 0 / 0 | 33,8 / 27,7 / 38,8 / 14,2 | 0 / 0 / 0 / 0 |
| card-30 | 17,0 / 9,5 / 0 / 15,0 | 0 / 0 / 0 / 0,5 | 31,0 / 10,5 / 10,5 / 13,5 | 0 / 0 / 0 / 0,5 |
| card-60 | 15,0 / 7,0 / 13,0 / 9,0 | 0 / 0 / 0 / 1,0 | 12,0 / 23,0 / 15,0 / 12,0 | 0 / 0 / 0 / 0 |

(the rest: one look of "the quarry is still digging" after the quarry went up.) Rank-5 minute card-60: 108,2 / 117,9 /
113,7 / 113,2 -> 109,8 / 115,5 / 111,0 / 111,6; `--no-pairs` seed 1302 now reaches rank 5 (118,9; before rank 4).
Earned at 120 min up for every player (card-10 28–30 k -> 31–34 k). Tests `tests/dead-cards.test.ts`. (decided)

**D-391 — The granary cure opens by an anchor with a site, and is not offered without one (2026-11-08).**
Same class as D-390: the sheet's "Postaw spichlerz" opened the ghost by the building itself (`buildSite` null late in
the valley -> ghost at the screen centre); card-10 read `granary?fail` for 2–17 min per valley. `granaryAnchor`
(`src/ui/stalls.ts`): this building, the chain's root, another granary, the castle, the stable — the first with a site a
road reaches; in the free valley `cureFor` drops the granary cure when none has one. Missions keep the building itself.
The tool used the chain root, the game the building: both now use `granaryAnchor`. (decided)

**D-392 — The bottleneck card counts a fresh producer as one workshop served (2026-11-08).**
Backlog P2 (D-390): the card-10 player (looks every 10 s) built 29–79 farms (`neck:farm`) in 120 min, often one on every
look. Cause: the card's 180 s mean still held the waits from before the farm it had just asked for, while a farm needs
~50 s for its first load plus the haul — a person pressing the card's cure would have walled in the valley the same
way. `src/ui/bottleneck.ts`: every sample counts the producers of each good; a producer that stood up within the last
window (`added`, any source — the card's own cure, the grow or rank card) takes `NECK_FRESH_X100` = 100 off the mean
before the show / hide thresholds (a farm makes 1 grain / 8 s, a mill eats 1 / 7 s: one farm ~ one mill served). Two
waiting mills and a farm placed a moment ago: no card; a deep shortage (three or more waiting) still asks for the next
one at once. The card's "n of m wait" keeps the plain mean. Tried first: silence the good for a whole window after a new
producer (equivalently, restart its window) — farms fell to 8–10, but card-10's earned fell 20 % (25–26.5 k) and rank 5
came 9 min later; 60–90 s silences cost 10–14 %. The discount keeps the pace. Measured (below). (decided)

**D-393 — A granary "full" of loads on the way is filling, not full; no second granary while a fresh one fills (2026-11-08).**
Same P2: card-10 built 30–45 granaries. Trace (seed 1303, 75–100 min): every new granary stood at once at 0 in stock +
60 incoming — STORAGE_FULL by reservations — and, its loads being under a wagon load (`granaryLoads` null), it was the
card's red stall with "Postaw spichlerz" by itself; the next look built another. `src/ui/stallKinds.ts`, free valley only:
`granaryFilling` — STORAGE_FULL, stock under the cap, loads on the way, no market load lying there (that one still asks
for a wagon): calm (`calmWhy` 'filling', "zapełnia się — wozy już wiozą tu towar", sheet hint `fix.filling`), no cure.
`freshGranary` — a producer's full yard (OUTPUT_FULL.NO_DESTINATION, not a wagon load) while a filling granary holds
under half its cap: calm 'granaryFilling', the sheet names that granary (one tap), `cureFor` drops the granary cure
whichever end of the chain it came from; once the fresh one is half full the cure returns. Four new keys are
`PENDING_KEYS` (pl/en; the other languages read English). `cureFor`'s cache key also takes the building count. (decided)

**D-394 — A consumer cut off from the stable gets the gap finder's road (2026-11-08).**
Found by the D-392 measurement (`--no-pairs` seed 1303, a different layout): from 69 min a brewery read NO_INPUT.UNREACHABLE
(crit) for the rest of the game, its own gate off the stable's network (a later building cut its diagonal step), the link
4 cells — but the chain ended at a working malthouse, so `gapTarget` offered nothing (36,5 dead minutes). Mirror of D-173's
`cutOffProducer`: `cutOffConsumer` (`src/ui/stalls.ts`, free valley only) — the chain's own building waits for an
unreachable input and the stable does not reach its gate: the gap finder's target is that building. No sim change in
D-392..D-394 (mission hashes untouched). Tests `tests/card-pace.test.ts`.

`tools/sandbox-first30.ts --minutes 120 --seeds 1301,1302,1303,1304` (before -> after, per seed):

| player | granaries (`granary`) | farms (`neck:farm`) | buildings | earned (k) | rank 5 (min) |
|---|---|---|---|---|---|
| card-10 | 43/41/45/30 -> 10/18/12/3 | 39/44/29/79 -> 36/27/30/21 | 159/151/155/194 -> 144/137/134/101 | 33,7/31,5/33,3/31,0 -> 32,4/31,5/30,8/34,1 | 86,2/88,2/87,4/87,1 -> 87,0/88,1/89,9/85,3 |
| card-10 `--no-pairs` | 54/32/29/16 -> 12/7/9/0 | 59/66/65/50 -> 33/24/28/23 | 194/174/172/142 -> 137/111/121/95 | 30,5/29,4/29,0/28,1 -> 32,7/34,6/30,8/30,6 | 90,9/88,3/88,8/90,0 -> 88,9/84,6/89,8/89,5 |
| card-30 | 15/10/6/14 -> 5/2/1/4 | 19/21/9/17 -> 14/9/12/14 | 83/79/65/77 -> 66/60/59/65 | 26,7/26,4/25,1/27,8 -> 27,6/26,2/25,1/28,7 | 96,7/97,7/96,8/93,7 -> 93,5/96,6/97,7/92,0 |
| card-60 | 1/1/1/1 -> 0/0/0/0 | 3/14/19/17 -> 10/7/5/12 | 46/57/57/55 -> 51/46/44/49 | 20,0/18,4/20,0/19,5 -> 19,7/19,0/20,4/19,6 | 109,8/115,5/111,0/111,6 -> 111,7/113,4/109,4/112,4 |

Means: card-10 earned 32,4 k -> 32,2 k, rank 5 87,2 -> 87,6 min; `--no-pairs` 29,3 k -> 32,2 k, 89,5 -> 88,2; card-30
26,5 k -> 26,9 k, 96,2 -> 95,0; card-60 unchanged within a minute. Dead-card time stays 0 (one or two looks of "the quarry
is still digging", as D-390). A player looking every 10 s still builds more than one every minute — about 20–36 farms and
0–18 granaries in two hours, each one asked for by a real shortage, no longer by the same one twice. (decided)

**D-400 — The playtest trial records the whole-chain switch as the castle lever.** `onCommandResult` (`src/ui/app.ts`)
recorded only `castleFirst` for S16's "which castle first, and when". Mission XVII's primary switch is `chainFirst`
(D-356), so the same field now takes both commands (east/north by the main contract's castle). No sim change.
(decided)

**D-401 — No "przyda się drugi" where nothing can be built.** The consumer sheet's shared-input line
(`sharedHtml`, `src/ui/pace.ts`) named the single supplier and added "przyda się drugi". In a mission whose
`buildable` list is empty (XVII, and the other missions that forbid building) there is no second supplier to build, so
the supplier line is dropped there; the shared-input line itself ("tu {n} / tam {n}") stays. Free valley and missions
with a buildable list are unchanged. The HUD stall card's `cause.sharedOne` ("jedyny dostawca") only names the shortage, no advice, so it stays;
`stalls.ts` was not touched. (decided)

**D-402 — `tools/balance-night6.ts` knows the chain switch.** The `castle` card branch of the reasonable-player
bot applies `chainFirst` in a `chainPriority` mission (the sheet's primary button there), `castleFirst` otherwise;
`LESSON.m17` = east castle's chain first, `WRONG.m17` = the castle leg only. Rows of missions I–XVI are unchanged
(the new branch and entries only fire for m17). (decided)

**D-410 — A building cut off later with no road left gets "Rozbierz", not a red card with an empty sheet (2026-11-08).**
Backlog P2 (D-390). D-173 (`cutOffProducer`) and D-394 (`cutOffConsumer`) send the gap finder to a building whose own
gate fell off the stable's network; when later neighbours boxed that gate in, `suggestLinkToStable` has no link and the
sheet offered nothing: the card (critical or plain) stayed for the rest of the game. The tool hid it by taking the
building back on its own (D-390), so the dead-card counts read 0. Measured honestly (the tool's silent take-back off,
`tools/sandbox-first30.ts --minutes 120`, card-10 / card-30, with and without `--no-pairs`): seeds 1301–1304 never hit
the case any more after D-392..D-394 (0 min); seeds 1305–1308 do — card-10 seed 1305 a brewery from 78:30 (41,5 dead
min, `OUTPUT_FULL.NO_DESTINATION -> road?none`), seed 1307 a malthouse from 74:40 (`NO_INPUT.UNREACHABLE`, the D-394
mirror, 41 min) and a brewery (4 min). Two options were weighed: a calm card (the building is dead weight — a quiet pin
hides a workshop that will never work again, and the chain behind it keeps waiting) or a cure. Chosen: the cure, the
smaller one. `cutOffNoLink` (`src/ui/stalls.ts`, free valley only, not castle / stable / trading post): the cut-off
building of the chain when no link is left (link search cached per network version and building count); `cureFor`
returns the new `Cure` `'demolish'` there (before the road branch). The sheet's fix dock: "Rozbierz: {name}" with the
refund (`demolishQuote`, half the price) and the hint `fix.cutOffWhy` ("rozbierz i postaw w innym miejscu przy drodze");
the button re-checks the cut-off and enqueues the ordinary demolish command (`nav.undoPlace`). Moving (demolish + build
ghost) was not added: the bottleneck / grow cards ask for the building again by an anchor with a site (D-390), so one
tap stays one act. Missions keep the road cure (their maps keep their links). No sim change (mission hashes untouched).
Tests `tests/cut-off-link.test.ts` (ground around the gate raised past `MAX_GRADE` on a copied terrain). (decided)

**D-411 — The card says why, and the rail lights the demolish tool (2026-11-08).** When the card's own building is the
cut-off one, its line reads `cause.cutOff` ("bez dojazdu — do bramy nie da się już poprowadzić drogi"), not "pełne
podwórze" / "nie dojedzie", which pointed at a road the player cannot build; the rail lights the demolish tool for
`'demolish'` as it lights the road tool for `'road'`. The card's signature takes the cure, so the line follows it.
Three new keys (`cause.cutOff`, `fix.cutOff`, `fix.cutOffWhy`) are `PENDING_KEYS` (pl/en; the other languages read
English, as D-393). (decided)

**D-412 — The scripted card player presses the sheet's "Rozbierz", and no longer takes buildings back on its own.**
`tools/sandbox-first30.ts`: the target path demolishes only when `cureFor` says `'demolish'` (act `cutoff:demolish`,
the chain's cut-off building, which may not be the card's subject); the D-264 take-back stays for a building born with
its gate boxed in (`NO_ROAD`, the build tool's undo). The per-second `actionable` count no longer counts a gap target
with no link left. Dead-card time from a cut-off building with no link (minutes of 120, card-10; card-30 never hit it):

| seed (card-10) | 1301–1304 | 1305 | 1306 | 1307 | 1308 |
|---|---|---|---|---|---|
| before (game, no silent take-back) | 0 / 0 / 0 / 0 | 41,5 | 0 | 45,0 | 0 |
| after | 0 / 0 / 0 / 0 | 0 | 0 | 0 | 0 |

(`--no-pairs`: 0 before and after on all eight seeds.) Earned and rank 5 within noise (1305 31,1 k -> 31,2 k, 87,3 ->
87,1 min; 1307 29,9 k -> 30,6 k, 89,2 min both). What is left of dead-card time is the grey stone button while the
quarry has not dug a load yet (`pave?NO_STONE`, 0–7,7 min, mostly seed 1307), backlog. (decided)

**D-420 — A stone bridge that only waits for stone being dug is a calm pin with the wait, not a grey button (2026-11-08).**
Backlog P2 (D-412): with a quarry standing but its stone not yet in a granary, the red card for a wagon held at a wooden
span opened a sheet whose only cure was a grey "Wyłóż most kamieniem" (`pave?NO_STONE`): 0–7,7 dead minutes per 120
(card-10 seed 1307 7,7, `--no-pairs` 3,0; card-30 up to 2,0). The stone comes by itself; there is nothing to press.
Two options were weighed: a live button that "reserves" the paving (a sim change, mission hashes at risk) or a calm
card with the wait. Chosen: the calm card, the smaller one and readable at a glance. `paveStoneWait`
(`src/ui/stalls.ts`, free valley only): the held span's pave fails on NO_STONE, a quarry stands, and the missing stone is
already dug (on its way / lying at a quarry) or a working quarry digs the rest; `digTicks` = the rest of the shortest
running cycle plus one cycle per further unit per working quarry (`cycleTicks`, the season counts), 0 when all of it is
dug. A quarry that does not dig (full yard, no road) gives null: its own stall is the card, the red span card stays.
`rankStalls`: such a held span is a minor pin (`W_MINOR`, never critical). `cureFor` stays `'pave'` (the sheet owns the
span, its ghost still shows on the deck); the sheet's pave branch shows, after D-390's quarry offer, a calm hint with
the quarry icon and no button: `fix.stoneDig` ("brakuje kamienia: {n}. Kamieniołom wykopie go za ok. {time}, potem wóz
zawiezie go do spichlerza…") or `fix.stoneComing` ("jest już wykopany (w drodze: {incoming}, przy kamieniołomie:
{quarry})…"). Haul time is not guessed. Once the stone is in a granary the pin is red again with a live button. No sim
change (mission hashes untouched). Tests `tests/stone-wait.test.ts`. (decided)

**D-421 — The calm stone card says which wait it is, and lights no tool.** The HUD card for a held span in D-420's
wait reads `cause.stoneDig` ("{wagon} stoi przed mostem — kamieniołom jeszcze kopie kamień na bruk") or
`cause.stoneComing` ("… kamień na bruk już jedzie") instead of `cause.heldJam`; no clock on the card (the sheet has it,
the card would re-render every second). A calm card never lights the rail's cobble tool (as D-193 for the wagon): the
card's cure is null while minor. The card's signature carries dig / coming. Four new keys (`cause.stoneDig`,
`cause.stoneComing`, `fix.stoneDig`, `fix.stoneComing`) are `PENDING_KEYS` (pl/en; the other languages read English,
as D-393/D-410). (decided)

**D-422 — The scripted card player reads the calm stone wait (`pave:wait`), and measures it.** `tools/sandbox-first30.ts`:
the pave branch logs `pave:wait` (not dead) when `paveStoneWait` holds; the leftover `DBG` stderr line is gone.
Dead-card time (looks ending `?fail` / `?unhandled` / `?NO_STONE`, minutes of 120, seeds 1301–1308):

| player | before | after |
|---|---|---|
| card-10 | 0 / 0 / 0 / 0,2 / 0 / 0 / 7,7 / 0 | 0 / 0 / 0 / 0 / 0 / 0 / 0,3* / 0 |
| card-30 | 0 / 0 / 0 / 0,5 / 0 / 0 / 0,5 / 0 | 0 on all eight |
| card-10 `--no-pairs` | 0 / 0 / 0 / 0,2 / 0 / 0 / 3,0 / 0 | 0 on all eight |
| card-30 `--no-pairs` | 0 / 0 / 0 / 0 / 1,0 / 0 / 2,0 / 0 | 0 on all eight |

(* two looks of `grow:malthouse+?fail`, the grow card's follow-up building, there before too — not this case.)
`pave?NO_STONE` is 0 everywhere; the calm wait itself reached the card for 1,3 min (card-10 seed 1307), the rest of
the time the slot went to other cards. Earned and rank 5 unchanged within noise (means: card-10 31,57 k -> 31,58 k,
87,9 min both; card-30 26,32 k -> 26,35 k, 96,0 -> 96,1; `--no-pairs` card-10 30,84 k both, 89,4 both; card-30
25,47 k -> 25,43 k, 98,0 both). (decided)

**D-430 — A quarry whose full yard waits for a booked wagon still counts as digging for the calm stone wait (2026-11-10).**
Found by the bug hunt of 2026-11-10 (D-431): the trading post's red card (a wagon held at a wooden span, D-420) opened a
sheet whose only cure was a grey "Wyłóż most kamieniem" (`pave?NO_STONE`) while a quarry stood. Repro: valley seed 1314,
`card-30`, 96:01–101:22 (37 s in three spells); seed 1329 `card-60` 44 s; 1328 / 1317 / 1310 / 1326 `card-60` 14–29 s. The
granaries held 4–8 of the 9 stone needed; the quarry's yard (8) was all booked by wagons, mostly for the trading post,
which buys stone (status WAITING_PICKUP, `progress` -1). `paveStoneWait` counted only quarries with `progress >= 0` as
digging, so with nothing left unreserved at the quarry it returned null — "the quarry's own stall is the card" — but a
yard waiting for a booked pickup is no stall (a calm pin), so nothing on the HUD said why the stone button was grey.
Fix (`src/ui/stalls.ts` `paveStoneWait`, UI only): a quarry in WAITING_PICKUP counts as working, its next unit a whole
cycle away (the pickup time is not guessed, as D-420 does not guess the haul). A quarry stalled on its own yard
(OUTPUT_FULL, no wagon booked) still gives null and the red card. No sim change (mission hashes untouched), no new key.
Grey-button seconds (red card, cure `pave`, NO_STONE, no quarry offer, no calm wait; `tools/dead-seconds.ts`, seeds
1309–1330 × card-10 / card-30 / card-60, 120 min): 243 -> 70 s in 66 runs; what is left is one-second readings on the
tool's look ticks (the look's command lands before the step) plus 9–11 s spells while a quarry's full yard waits for a
free wagon (OUTPUT_FULL.NO_WAGON, the D-420 case, seeds 1310 / 1317 / 1318 / 1328 `card-60`). Look-based dead-card time
(`tools/sandbox-first30.ts`, looks ending `?fail` / `?unhandled` / `?NO_STONE`, the same 22 seeds, card-10/30/60 and
card-10/30 `--no-pairs`, 110 runs): 4,7 min in 7 runs (15 looks) -> 0. Earned unchanged (card-30 `--no-pairs` mean
25 102 -> 25 090, the rest identical); rank 5 in all 110 runs before and after. Test `tests/stone-wait.test.ts`. (decided)

**D-431 — Bug hunt 2026-11-10: what was searched, and what was found clean.** New seeds, none used before (earlier runs:
1–500, 1000+, 7001+, 9001+; late 1–100, 501+). Sim invariants (goods conservation, StallReason consistency, NaN, stuck
wagons incl. BRIDGE_JAM / NO_ROUTE deadlocks, save/load clone, rerun hash determinism) every tick, `tools/fuzz.ts`:
`--runs 400 --ticks 8000 --seed 31001` (m1–m17 + sandbox, 8,0 M ticks), `--runs 200 --ticks 9000 --seed 32001 --missions
m14,m15,m16,m17,sandbox@5` (4,5 M), `--runs 60 --ticks 33000 --seed 41001 --missions sandbox,sandbox@5` (through winter,
4,9 M), `--runs 300 --ticks 12000 --seed 51001` (8,9 M); `tools/fuzz-late.ts --runs 80 --seed 4001` and `--runs 60
--ticks 12000 --seed 6001` (valley from 75/100/120 min; 73 k units sold at the post, 61 k wagon-ticks at an iced span):
1 100 runs, ~27 M ticks, **0 failures**. Mission bots: `npm run bot`, `bot-m2..m17`, `bot-missions-7-9`, `-10-12` — every
row as before, no violations; `tools/balance-night6.ts --no-search` (eye / eye+ / scan / letter players, I–XVII): no
card whose cure fails (`?` acts other than no-coins); plain cards with nothing to press are the readable waits
(XIII mill NO_INPUT, IX/X CONTESTED, XVII CHAIN_FIRST). Valley seeds 1309–1330 (D-430's table, 110 runs × 120 min):
0 invariant / unexplained-stall violations, rank 5 everywhere. Besides D-430, one sub-second reading, not fixed: a
producer's full yard (OUTPUT_FULL.NO_DESTINATION) blocked by a granary while another granary has just got room reads
critical with no cure until the next dispatch (≤ 6 ticks, e.g. seed 1320 `card-30` tick 30 000); the sheet's
"Postaw spichlerz" blinks out for that half second. Longest calm readings (seeds 1311 / 1318, `card-30`): granary
filling 255 s, store room 150 s, market full 132 s, post without road 147 s — each with the goods really moving, no
card found saying something false. New tool `tools/dead-seconds.ts` (per-second dead-card reading of one player).
(decided)

**D-450 — Readability audit of the recent stall cards: real game states, three sizes (2026-11-10).** The cards of
D-393 ("zapełnia się", "nowy spichlerz dopiero przyjmuje ładunki"), D-410/D-411 ("bez dojazdu", "Rozbierz") and
D-420/D-421 ("kamieniołom jeszcze kopie") were only seen in tests. `tools/read-states.ts` runs the card-10 player of
`tools/sandbox-first30.ts` (seeds 1301–1308, 120 min) and writes the world (state + terrain) the first second each card
holds the HUD slot (a calm top entry only when no pace / bottleneck card takes it); `tools/read-shots.mjs` stages each
world in a built page (`window.__marchia.app.enterGame`, speed 0), shoots the card and the sheet its eye opens at
412×915, 915×412, 904×1000, and lists buttons under 48 px and clipped text in both. Shots `docs/shots/read-*` (the
`read-before-*` ones show the defects). Checked: cause + one next step, 48 dp, nothing cut or covered, plain words,
calm cards apart from red ones (plain panel and kicker "Postój" vs wine bar, "Najgorszy zastój" and the red seal —
clear on all three sizes), contrast, the CLAUDE.md list (no emoji, no SaaS look). Found and fixed D-451..D-455; owner
questions in BACKLOG. The plain stone wait (no ice) never reached the card in 8×120 min of card-10 (every hit was under
ice, D-455), so it has no shot. (decided)

**D-451 — A saturated market outranks "zapełnia się" on the card, as on the sheet.** Seed 1301 at 26:40: the card read
"Spichlerz: zapełnia się — wozy już wiozą tu towar", the sheet below it "Spichlerz pełny — rynek nasycony" and "Rynek
bierze tyle, ile zje … Sprzedaj inny towar" (seed 1303 at 89:10 the same for a charcoal burner's "nowy spichlerz dopiero
przyjmuje ładunki"): two causes and two opposite next steps (wait vs. sell something else). `calmStall`/`calmHtml`/the
status title already put the saturated market first; `calmWhy` (`src/ui/stalls.ts`) checked D-393's two waits before it.
Now neither wait is the card's reason while `marketSaturated` holds (the rest of the order unchanged). The other
readers of `calmWhy` only compare it with null and the scripted players only log it, so pins, cures and D-392..D-394's
measurements stand. Tests
`tests/read-cards.test.ts`. (decided)

**D-452 — In-text link buttons in sheet hints are at least 48 px wide.** "Nie mogą oddać towaru: Tartak" measured
39 × 48 px; `.calm-hint`, `.shared-hint`, `.thin-hint`, `.full-hint` links get `min-width: 48px` (as `.kv` had). (decided)

**D-453 — "Rozbierz" keeps its whole reason in a short landscape sheet.** At 915×412 the docked hint beside "Rozbierz:
Słodownia +22" was clamped to three lines and lost "Rozbierz ten budynek (wraca połowa ceny) i postaw go w innym
miejscu przy drodze" — the next step. The demolish fix is a wide dock (D-270): the reason wraps in full. (decided)

**D-454 — A filling granary's sheet says "zapełnia się", not "pełny".** Seed 1307 at 62:50 (after D-451): the card
"zapełnia się", the sheet title "Spichlerz pełny" and "60/60 — brak miejsca na odbiór" above "W spichlerzu: 11/60".
`statusKey` (`src/ui/stallKinds.ts`) returns `status.STORAGE_FULL.filling` ("Spichlerz zapełnia się — ładunki w
drodze"; the card's longer line wrapped the title under its icon at 412 px) while `granaryFilling` holds (after the saturated and unwanted titles), and the full hint's count line reads
`why.full.storeFilling` ("60/60 — leży tu 11, w drodze 49"). Two new keys are `PENDING_KEYS` (pl/en; the other
languages read English, as D-393). (decided)

**D-455 — A wagon held by ice reads the ice on the card, not the quarry.** Seed 1307 at 108:30: the calm card said
"Wóz 68 stoi przed mostem — kamieniołom jeszcze kopie kamień na bruk" while the sheet's chain said "Kra na moście —
otwarcie za 1:27" and the notice "Za 1:27 kra ustąpi". D-421 chose the stone text whenever `paveStoneWait` held, ice
or not; the wagon waits for the ice, which clears by itself, long before the stone could help. The HUD now takes the
stone text only for a span that is not `BRIDGE_CLOSED`; under ice the card reads `cause.heldIce` ("… stoi przed
mostem zamkniętym przez krę"), still calm (`rankStalls` unchanged), and the sheet keeps D-420's stone hint. No sim
change. (decided)

**D-490 — Repeated building names in one sheet are numbered (owner, 2026-11-10; answers the D-450 question).** "Nie mogą
oddać towaru: Chata rybaka Chata rybaka Chata rybaka" gave three links nobody could tell apart. The full-yard hint's
list of blocked buildings now goes through `buildingLabels` (`src/ui/format.ts`, pure part `numberRepeats` in
`src/ui/buildingLabels.ts`): when two or more share a name each reads "Chata rybaka 1 / 2 / 3". The number is the
building's rank among buildings of its type by id, so it does not depend on which of them are listed; a name that appears
once stays plain, castles keep their own names. No new i18n key (name + number). No sim change. (decided)

**D-491 — A section header with nothing under it hides (owner, 2026-11-10; answers the D-450 question).** The docked fix
(D-162) is absolute at the sheet's bottom edge, so "Naprawa" stayed in the flow above an empty gap. `.section-h:has(+
.fix-dock) { display: none }` (`main.css`): the header returns by itself where the dock is in the flow after it. Covers
fixSection, castle switches and the dock-based hints alike. Seen in `read-cutOffCrit-sheet-412x915.jpg` (after). Not
covered: "Produkuje" over a body that scrolled beneath the dock (a scroll position, not markup) - left as is. No sim change. (decided)

**D-492 — Tests.** `tests/sheet-labels.test.ts`: stable numbers by id independent of the listed subset, a lone name plain,
and the CSS rule present. (decided)


**D-470 — Recipe input/output lists are no longer `Object.freeze`d (sim cost round 2,
`docs/research/2026-11-10-sim-cost-2.md`).** `inputGoods`/`outputGoods` hand out one cached array per building type,
iterated with `for...of` in `produce`, `dispatch`, the diagnosis and the forecast. V8 has no fast path for `for...of` over
a frozen array: a micro-benchmark of the same loop ran 2.4× slower and did 4036 minor GCs instead of 10. The arrays keep
their contents and the `readonly` type (callers still must not mutate them); `npm run perf:sim` does 44 scavenges
instead of 50. A plain object keyed by type instead of the `Map` was tried and was slower (622–698 vs 454–509 ms in a
micro-benchmark) — not taken. (decided)

**D-471 — A path search resets only the cells the previous search wrote.** After D-336/D-337 the search itself was the
largest item (bench 22 % of the tick, late valley 15 %), and 12.5 % of it was `dist.fill(Infinity)` over the whole
96×72 map for a network of ~360 road cells. An array written only by `search` — the scratch pair of `findPath` and
`alternativeDestination`, and the memo arrays of D-336 (their list sits in a `WeakMap` keyed by the array, so it moves
with the array between memo generations) — carries the list of cells the last search wrote (a cell is listed on its
first write, when `dist` was Infinity; every write is the start or a listed neighbour, so the list fits
`adj.node.length + 1`). The next search resets just those cells, which gives the same contents as the full fill. A new
array, or one from the `releaseDistMap` pool (its holder may have read it), is still filled whole. Memo searches no
longer write `prev` at all (no memo reader walks it; before, they scribbled into the scratch `prev`). Memo-miss search
45.9 → 37.0 µs, `findPath` 11.6 → 10.1 µs on the 200-wagon bench. Test: one world whose network grows and is cut, whole
scratch and memo arrays equal the reference search; it fails on either deliberate bug (no `prev` reset, truncated list).
(decided)

**D-472 — Cheapest test first in the per-wagon and per-source loops; a parked wagon keeps its IDLE status object.**
`bridgeBlocker` runs for every queued wagon every tick over every wagon (865 loop turns per tick at 200 wagons): the
same pure conditions now test `bridgeFrom >= 0` (most wagons are on no bridge) and `next < 0` (most are moving) first.
`dispatch`'s `isSource` tests the unreserved stock before the recipe lookup (most buildings hold none of the good).
`idleStatus` kept allocating `{ k: 'IDLE' }` every tick for every wagon parked at home (141 of 200 in the bench); a
status that already reads IDLE (a field-less object) is kept — same JSON, same hash, and the UI's identity caches see no
change where nothing changed. (decided)

**D-473 — Sim cost round 2: measured, and what stays.** New `tools/perf-late.ts`: the DECENT valley player to minute
100, then 20 minutes of `step` timed (24 buildings, 30 wagons: 0.02–0.03 ms/tick — cheaper than the bench, which stays
the stress case). The container was loaded by another agent (load 4–8) during the night, so wall times scattered by up to
±50 % between runs of the same build; the deciding measure is instructions per tick (cachegrind, state loaded from a
snapshot, start-up and JIT warm-up subtracted): bench 50/100/200 518 780 / 777 718 / 857 488 → 500 291 / 715 272 /
780 500 (−4 / −8 / −9 %), late valley 431 789 → 422 843 (−2 %). Proof of identical results: `tools/mission-hashes.ts` byte-identical
(86 rows), bench and late-valley end hashes identical, 8 fuzz scenarios with end hashes (incl. the valley through the
winter ice) identical old vs new, `npm test` 679/0. Not done, and why: incremental Dijkstra after a bridge penalty
change (equal-length routes could differ in the last float bit), a per-span wagon index for `bridgeBlocker` (array-order
semantics, ~2–3 % of the bench), caching edge length/grade (indexing costs as much as the formula). The replan budget
(BACKLOG P3) stays unneeded. (decided)

**D-520 — A sheet opened while our own `history.back()` is in flight gets its history entry when that back lands.**
UI bug hunt (Playwright, `claude/w-uibug`): close a card (X, Escape, a tap on the map) and open another in the same
turn, or before the asynchronous back traversal arrives — the new sheet pushed its entry at once, and the pending
traversal (Chromium aims it at the entry below the one current when `back()` was called) went back over that new entry
too. The sheet stayed open without an entry; its popstate was swallowed as "ours", and the next system back left the
game page. Same-turn paths in the game: the damaged valley ledger (`closeAll` + `openValley`), any close + `go()`.
The bookkeeping moved to `src/ui/sheetHistory.ts` (no DOM): an open while one of our backs is pending does not push;
when the last pending popstate lands, every open sheet without an entry gets one; a close goes back only over an entry
the sheet owns (so close / open / close before the back lands goes back once, not twice). Test
`tests/sheet-history.test.ts` with a Chromium-like fake history (the old code fails three of its four cases);
`tools/back-probe.mjs` checks it in the built game. (decided)

**D-521 — The pause menu takes the player's speed once per pause.** A double tap on the menu button (or the menu opened
again from Settings, or Escape after the HUD's button) ran `openGameMenu` twice: the second run read the speed the first
had just set to 0, mapped it to ×1, and the same-key refresh dropped the first content's `onClose` — "Resume" came back at
×1 instead of ×2 / ×4. `src/ui/menuPause.ts` holds the speed until the menu releases it (idempotent: the deferred
`onClose` of a menu replaced by Settings or a card may run twice). Unchanged then: a game the player had paused
resumed at ×1 when the menu closed (asked in BACKLOG; decided in D-560). Test `tests/menu-pause.test.ts`. (decided)

**D-522 — The Android system back is offered to the page first.** Capacitor's `BridgeActivity` has no back handling of
its own (it lives in the `@capacitor/app` plugin, which the game does not use; checked in `node_modules/@capacitor/android`
8.6): on the APK the system back always closed the activity — also with a card, the pause menu or a tool open — and the
per-sheet history entries (and the `GoBack` key branch) were never reached. `MainActivity` registers an
`OnBackPressedCallback` that evaluates `window.__marchiaBack()`; `App.systemBack()` is the former Escape branch (top sheet →
build shelf from placement → tool away → pause menu) and returns false when there was nothing to step back from (a letter
holds the screen, the main menu with no sheet, the end of a mission): Android's default then runs (the root activity goes
to the background; pagehide/visibilitychange autosave as before). Chosen over adding `@capacitor/app` (a new dependency
and native plugin for one listener). Java compiled (`gradlew :app:compileDebugJavaWithJavac` after `cap sync`); not yet
run on a device — BACKLOG. (decided)

**D-500 — Graphics: weathering stains on the buildings (graphics audit 11, 2026-11-10).** The audit
(`tools/gfx11-shots.mjs`, D-502) found the buildings' plain materials the most "toy" thing in the frame: albedo lives in
vertex colours, one flat tone per part, so up close the castle read as painted clay (grey-beige, S 17 %, luminance sd
4.9/255 over a wall). The shared frost hook of the plain building kinds (`wood`, `bark`, `thatch`, `stone`, `plaster`;
`src/render/models/materials.ts`) now also multiplies the albedo by a world-space stain from the shared noise texture
(`noiseTex.ts`, one mipmapped fetch, so it fades to its mean from afar instead of shimmering): broad damp patches
(~1 m), rain streaks stretched down the walls (world y squeezed 0.42×) and fine mottling (~0.2 m), centred on the
channel means; darker spots also go a little greyer (lichen, soot, wet). Amplitude ±40 % albedo (1 sd), clamped to
−55 %/+50 %: a ±20 % stain was invisible after AgX (sd 4.9 → 6.9), the final one gives 4.9 → 9.9 on the castle wall
and visible streaks on the roofs at 110 m; frame brightness unchanged (mean L 31.4 → 30.4 % close up, 28.5 → 28.3 %
at 110 m). Instanced users (wagons, cargo, yard piles, workers) skip it like the frost
(a moving wagon would drag stains through world space). One program as before (cache key `frost1` → `frost2`), one
more sampler in it. Shots `docs/shots/gfx11-{before,after}-valley-close-*`, `-valley-autumn-*`, missions. (decided)

**D-501 — Graphics: patchy winter hoarfrost on the ground.** In the free valley's winter the terrain frost (D-203) laid
one flat pale sheet over the meadow (valley S 14–17 %, all the meadow's wet/dry patches gone): "jednolita tekstura". The
frost amount is now modulated by the meadow noise already sampled in the terrain shader (`nzM.g` broad drifts, `nzS.b`
tussocks, less in the wet hollows `wetP`), 0.15–1.6× around the old mean; roads and the river bed unchanged (they carry
the diagnosis). Three ALU lines, no new fetch. Shots `gfx11-{before,after}-valley-winter-*`. (decided)

**D-502 — Graphics audit 11: method, measurements, what was not changed.** New `tools/gfx11-shots.mjs` (built game,
`vite preview --port 5199`): menu; missions I (menu bot + 150 s), VII, XIII, XVII (60 s) with the HUD; the free valley
with the bench network (`tools/frame-cost-bench.json`, cobble laid as dirt: the sandbox has no stone and the failed
cobble rows left 31 lone road cells that drew as round mud discs) at noon in each season, in autumn at dawn / morning /
dusk / night, and at 230 m and 38 m — 412×915 and 915×412, low and high (60 shots per tag, `gfx11-before-*`,
`gfx11-after-*`). `tools/gfx11-sat.mjs` prints mean HSL saturation and the share of pixels above the art direction's
S 35 %: the meadow samples at S 21–27 %, the water is grey (S 3–7 %, not blue), the above-35 % share comes from the
autumn crowns (rust, S 37–40 %) and is 2–5 % in the valley, 17–41 % in the mission openings. Cost: SwiftShader rAF
frame time, A/B interleaved against a build without D-500/D-501 (the container shared with another agent, ±8 %
between runs): castle close-up high 1901 → 1768 ms, winter 110 m high 1690 → 1595 ms, close-up low 769 → 794 ms
(+3 %) — no regression above the noise; < 5 % by the instruction count (one fetch + ~12 ALU on building pixels only).
Pixel regressions: no committed pixel baselines exist (the `0 px` checks of earlier rounds — `jam-diff.mjs`,
`render5-diff.py` — are ad hoc); `terrain-golden` hashes sim terrain and is unaffected; nothing to update.
Style findings that need the owner (BACKLOG P3 questions): summer shows the late-autumn crowns; AgX squeezes all albedo
contrast (the flat, milky look of the whole scene); mission I opens on an empty meadow with wagons a few pixels long;
the portrait main menu hides the whole scene; autumn crowns are the most saturated thing in the frame and compete with
the clay/ochre "warm = problem" rule; dawn is dark and green rather than misty. (decided)

**D-560 — A game the player paused stays paused after the pause menu closes (owner decision 2026-11-10).** The menu used
to map a paused game to ×1 on close (`speedBeforeMenu = 0 ? 1`, D-521 kept it and asked). Now `MenuPause.hold(current)`
stores the speed as it is, 0 included; `release()` gives it back, so a player pause stays a pause and a menu opened over
×1/×2/×4 still returns that speed (D-521). Only `src/ui/menuPause.ts` changed; no sim change. (decided)

**D-561 — A held pause is tracked by "holding", not by the speed.** `held` is `Speed | null`; 0 is a valid held value,
so a second `hold` (double tap, menu reopened from Settings) while the first holds the game never overwrites it, and
`release()` stays idempotent (the deferred `onClose` may run twice). (decided)

**D-562 — Settings and Help opened from the menu behave the same.** Settings replace the menu content in the same sheet
(`closeWithSheet`) and Help is a sheet over it; neither calls `hold` or `release`, so the speed taken at menu open
(0 or ×N) comes back when the sheet closes. Settings opened from the HUD never paused the game and are unchanged. (decided)

**D-563 — The system back is consistent.** `App.systemBack()` (D-522) opens the menu through the same `openGameMenu()`, and
closes it through the sheet stack, whose `onClose` is `release`; so Escape/back on a player-paused game opens the menu and
the next back leaves it paused. No change needed in `app.ts`. (decided)

**D-564 — Test.** `tests/menu-pause.test.ts`: paused stays paused (also double open and a second release), ×4 returns ×4,
the first take wins. (decided)

**D-565 — BACKLOG.** The P4 question on the paused game after the menu is ticked off. (decided)

**D-540 — Graphics: green summer crowns, rust only in autumn (owner, graphics audit 12, 2026-11-10).** The owner's
answer to the D-502 question: the deciduous crowns are green in summer and rust/warm only in autumn (warm stays the
sign of a problem, art direction "Warm marks the problem"), fresh green in spring. The crown-green factor of D-303
(`springAt`, `src/render/leafFall.ts`) now runs 0 … 2 instead of 0 … 1: 0 the late-autumn palette, 1 the young spring
green, 2 a darker, muted summer green (`SUMMER_COL` / `SUMMER_COL2`, sRGB #4f5a38 … #47553a, HSL S ≈ 23 %: inside the
terrain's middle band, a little darker than the leaf it replaces). Spring as before (0 → 1 with the returning leaves,
15–55 %); summer matures 1 → 2 over its first 35 %; autumn turns 2 → 0 over its first 60 % — through the yellow-green
of 1, as real leaves lose their green — so the crowns are rust exactly when they start to fall (D-260, 60 %); winter 0
(bare). ≤ 0,028 per 5 s of game time (test). In `springLeaf` (shared by the leaf material, its depth material and the
far-card bake, so near and far trees match) the summer colour is luminance-matched like the spring one (×0,9 instead
of ×1,05) and almost every card takes it (92–100 % instead of 78–100 %); the per-tree russet/ochre tint spread is
damped a little more in summer. Cost: no new uniform, program or pass — the same `uSpring` / bake `spring` value, a
few ALU in the vertex shader. The far-card atlas is still re-baked in quarter steps of the factor (now over 0 … 2): 4
more bakes in early summer and 8 over the first 60 % of autumn (one every ~40–70 s of game time, into the same
targets, D-260). Contract missions have no seasons and keep factor 0: their autumn look is bit for bit unchanged.
Shots `docs/shots/gfx12-{before,after}-valley-{spring,summer,autumn}-high-*` (spring and autumn unchanged, summer
green). (decided)

**D-541 — Graphics: a gentle contrast look inside AgX (owner, graphics audit 12).** The owner's answer to the D-502
question "AgX flattens the whole scene": raise the contrast carefully. `src/render/toneLook.ts` patches three's AgX
tone-mapping chunk once at mount (before any program is built) with a look step right after the AgX sigmoid, where the
AgX reference has its unused `agxLook`: a contrast curve on the luminance of the sigmoid output (≈ display value)
around a pivot of 0,30 (near the frames' mean), each side a cubic x + c·x²·(x − 1) in the normalised distance from its
end — slope 1,30 below and 1,25 above the pivot, slope 1 and value fixed at black and at white, so the deep shadows of
dusk / night and the dark forest beside the HUD keep their value and gradation, and the sky cannot clip. The three
channels are scaled together (contrast, not saturation: the art direction's S < 35 % holds, `gfx11-sat.mjs` S within
±0,5 pt). Exposure unchanged. Measured on the shots (luminance over the whole frame, before → after): noon valley mean
29,2 → 29,0 % (summer) and 31,2 → 31,2 % (autumn), sd +11 … +13 %, 5th percentile −1,3 pt, 99,9th +2,2 pt (≈ 62 %, far
from clipping); castle close-up sd +12/+13 %; mission XIII's scene (HUD cropped) mean −0,7 pt, sd +9/+10 %; dusk mean
14,1 → 13,2 %, sd unchanged. Rejected on the way: a plain power curve (pivot 0,32, powers 1,25 / 1,15) took dusk's
mean from 14,1 % to 11,7 % (the dark scene sank); the same with a smoothstep toe and pow() cost +7,6 % frame time at
the castle close-up on SwiftShader (D-543) — the cubic has no pow and no measurable cost. The road ruts against the
meadow, the wagons' shadows and the stone/thatch stains of D-500 read more clearly; the HUD is DOM and untouched. No
new program (the chunk is in every lit material already; the program count of D-325 stays), no new pass. Stronger or
brighter variants are a BACKLOG question. Shots `gfx12-{before,after}-*`. (decided)

**D-542 — Mission I opens on the river crossing (owner, graphics audit 12).** The owner's answer to the D-502
question: frame the start closer, on the crossing and the nearest buildings. Render-only (`src/render/opening.ts`,
`View.frameOpening`, `CameraRig.fitGround`; no sim change): leaving the menu for a mission with an entry in
`OPENING_FRAMES` (only `m1`) glides — or jumps, on a new terrain — to the closest view that shows its cell box whole
inside the part of the canvas the contract HUD leaves free (`openingFree`: portrait under the waybill and above the
stall row / rail; landscape and the near-square foldable either right of the waybill or the band under it, whichever
is closer), the box centred in that part. `fitGround` bisects the distance (the pitch follows it as in play) and
solves the target with a few screen-space corrections. Mission I's box: the stable (the wagons start there) with the
north road's junction, the gap the player has to bridge and the mill on the south bank (cells 41–49 × 19–39), looking
straight north (yaw 0 instead of the overview's −0,3: the north–south crossing then runs up the screen). Distances:
412×915 168 m, 915×412 151 m, 904×1000 150 m (before: the 200 m glide target from the menu, 230 m on a direct start;
always the map's middle). The wagons at the stable are now 1,2–1,5× larger and the stable and the mill are in the free
part of the screen (before, the stable was behind the waybill in portrait and the lower half was empty meadow). Not
the whole chain: the 70 × 42-cell layout (woodcutter … castle) needs ~370 m in a portrait with the HUD, farther than
the old overview that already cut it; the stable–crossing–mill box is what the first minutes are about, the rest is a
pan away. A landscape view turned by 90° would be 103 m instead of 151 m, but with another north than portrait and the
menu — BACKLOG question, as is a fly-over of the chain. The other missions keep the generic overview. Shots
`gfx12-{before,after}-m1-open-*` (first seconds), `gfx12-{before,after}-m1-*` (bot, 150 s). (decided)

**D-543 — Graphics audit 12: method and cost.** Shots with `tools/gfx11-shots.mjs` (now `GFX_PREFIX=gfx12` and a
`m1-open` scene: mission I in its first seconds without the bot), before = the build of `9fddad7` served from a copy,
after = this branch; high, 412×915 and 915×412 (and 904×1000 for the opening): missions I (open + bot), XIII, the free
valley in spring / summer / autumn at noon, autumn dusk and the castle close-up. Frame cost: new
`tools/gfx12-frame-ab.mjs`, SwiftShader rAF frame time, A/B interleaved, same camera in both builds (the valley rig
set by hand; `m1-fixed` the old overview camera, `m1-bot` each build's own camera); summer valley (green crowns on).
Final build, high, 3 rounds: valley 110 m −4,1 %, castle close-up −1,4 %, `m1-fixed` −0,4 %, `m1-bot` −0,4 % (the
closer opening costs nothing measurable); low, 2 rounds: close-up +1,0 %, `m1-fixed` −0,8 %; valley 110 m low read
+8,0 / +8,4 % in two runs, then before → build without the look +1,0 %, that → final −0,7 % and a fresh direct A/B (4
rounds) −0,2 % — load drift of the shared container, not the change. The first look (pow + smoothstep toe) read +7,6 %
(close-up high) and +9,7 % (`m1-bot` high) and was replaced by the cubic. No new program, pass, texture or uniform.
(decided)

## Render frame cost: culling per ground tile (BACKLOG P1, research `docs/research/2026-11-10-render-frame-cost.md`)

**D-570 — Merged building meshes are split per 64 m ground tile for the heavy materials.** GL-level counters
(`tools/rperf-probe.mjs`) on the free valley with the bench network showed the merged building meshes (one per
material for the whole map, D-255) as the largest triangle source: 180 k of 404 k main-pass triangles and 175 k of
223 k per shadow refresh at low, while only 7 of 38 buildings were in the 110 m view and 18 in the shadow camera.
`BuildingsView.sync` now keys each part by (material, tile of the footprint centre) when the material has ≥ 4000
triangles over all buildings (`CHUNK_M = 64`, `CHUNK_MIN_TRIS = 4000`); light materials stay one mesh. three culls each
tile mesh on its own in the main and the shadow pass. Same vertices, matrices and materials — only the buffers are cut
differently — so the picture is the same (D-573). The meshes are static (`matrixAutoUpdate = false`). A 96 m tile with
an 8000 threshold was measured too: worse in the valley (296 k vs 268 k main triangles at the same draw count), six
shadow draws fewer in mission I; 64 m stays. Cost: +4..+11 main draws and +12..+19 per shadow refresh (tiles the sun
sees), against −130 k main and −50..−90 k shadow triangles in the valley. (decided)

**D-571 — Yard workers outside the view and the shadow camera are not drawn.** The worker batches (`Parts`) have
`frustumCulled = false` because their instances spread over every building; ~45 workers in the bench valley cost
~32 k main and ~16 k shadow triangles wherever the camera looked. `BuildingsView.update(world, dt, seen)` takes the
camera frustum and the sun's shadow-camera frustum (computed in `WorldView.frame` with `sun.shadow.updateMatrices(sun)`,
the call `WebGLShadowMap` makes with the same light and target, so it is the frustum the shadow pass uses) and skips a
worker whose 3 m sphere touches neither. Pose clocks (the hoeing walk, the trader's gesture) run before the test, so a
worker entering the view is where he would have been. No shader reads the instance index. (decided)

**D-572 — Reeds: one instanced batch per 64 m tile.** The reeds (776 clumps along every bank, one `InstancedMesh`)
were drawn whole whenever any bank was in view: 23 k triangles. `GroundCover.buildReeds` now makes one batch per tile
with a shared blade geometry; instance matrices are computed exactly as before (the per-reed `i % 7` height factor
keeps the global index). (decided)

**D-573 — Pixel identity: frozen-clock shots, 15 of 18 at 0 px, the other 3 differ between two runs of the old build
the same way.** `tools/rperf-shots.mjs` (new): `speed=0` in the URL (with `speed=1` the sim ran a varying number of
ticks before the scene was set up, so worker poses and wagons differed between two runs of one build), the game loop
stopped, the view / worker / mill-wheel / farmer-walk / trader clocks fixed, 4 frames at dt = 0. 18 shots (valley
summer / winter / close 38 m / far 230 m and mission I; low and high; 412×915 for all, 915×412 and 904×1000 for valley
summer and mission I) before (`a10af8b`) vs after: 15 shots 0 px. Valley close, far (412×915) and summer 915×412 at
high differ by 0.20 / 0.22 / 0.37 % of pixels in one corner — and a second run of the old build differs from the first
by 768 / 828 / 1302 px in the same rectangles (after vs that second run: 0 / 0 / 1484 px): run-to-run noise of the
high shots (tree wind and near trees), not this change. (decided)

**D-574 — Measurement method and what was not done.** `tools/rperf-probe.mjs` (new) wraps the WebGL draw calls in an
init script and reports per frame the main pass (default framebuffer) and per shadow refresh (the map refreshes every
2nd frame, D-150 — averaging per frame made the counts jump by ±15 with the parity of the window) the draws and
triangles, `useProgram` / `bindTexture` / `uniform*` calls, buffer upload bytes, the bytes of all live GL textures
(ASTC / ETC2 counted compressed), `renderer.info` programs / geometries / textures, rAF and `App.frame` JS ms;
`RP_SPLIT=1` splits draws and triangles per object. It waits for `view.texturesReady` (high KTX2 transcodes take
> 12 s under SwiftShader; without the wait high was measured without its PBR textures). Results (A/B interleaved, 3
rounds, median; valley 110 m summer / winter, 50 / 200 wagons at 160 m, mission I; low and high): valley main triangles
−33 %, shadow −18..−41 %, mission I main −20 %; programs (46 / 48), texture memory (33.8 / 175.8 MB), program switches,
texture binds and uniforms unchanged. SwiftShader time −5.5 % median over 10 pairs, spread ±10 % (fill-bound: toggling
the terrain off saves 45 % of the frame, trees 40 %, buildings 22 %, the shadow pass 11 %). Not done because they change
the picture: terrain LOD, fewer tree cards, a smaller or rarer shadow map; not done because they are not measurable
here: front-to-back `renderOrder` for early-z (same draws and triangles), `BatchedMesh` for buildings (another program,
matrices from a texture — float differences in positions). Next: the device bench on the Fold (BACKLOG). (decided)

**D-590 — A leaving sheet or letter takes no taps; "Sprzedaj" works once (2026-11-10).** A closed sheet stayed on
the page for its 240 ms fade (`.sheet.is-leaving`) and kept `pointer-events: auto` (`#ui .sheet`): a second tap on
"Sprzedaj" in the closing wagon sheet (or in the open one before its 250 ms refresh) sold a wagon that no longer
existed and showed a red toast; the fading opening letter (220 ms) and rank letter swallowed the next tap meant for
the map. `src/ui/retire.ts` (new): `retire(el, cls, ms)` sets `inert` at once (hit-testing passes through, as
`pointer-events: none`, also for children that set `auto`; no keyboard focus) and removes the element after the
fade; `sheets.closeTop` (after its focus hand-back — an inert sheet would drop focus first), the opening letter and
the rank letter use it, plus a CSS rule for the three leaving states. `pressOnce(el)` greys the sell button on its
first press. No look change (the fade is the same). Test `tests/retire.test.ts`. (decided)

**D-591 — Paving stone dug but stuck in a quarry yard no wagon collects: "Kup wóz", not the grey stone button.**
The rest of D-430: the trading post's red card (a wagon held at a wooden span) offered only the grey "Wyłóż most
kamieniem" for 9–11 s while the quarry's yard was full (OUTPUT_FULL.NO_WAGON, every wagon busy; seeds 1310 / 1317
`card-60`, 110:37–110:45, 8 of 9 stone at the quarry), and for 1–2 s more while a wagon was already driving there
(WAGON_DUE, progress -1). Now (`src/ui/stalls.ts`, UI only): `paveStoneWait` counts a quarry in WAGON_DUE as digging
(as WAITING_PICKUP, D-430) — the calm wait; `paveStoneHaul` names a quarry whose unbooked stone waits for a free
wagon when no calm wait holds, and then `cureFor` gives 'wagon': the card reads "{wagon} stoi przed mostem — kamień
na bruk czeka w kamieniołomie na wolny wóz", the rail lights the wagon and the sheet offers "Kup wóz" with the reason
("Kamieniołom ma już {quarry} na placu, ale wszystkie wozy są zajęte — … Kup wóz albo zaczekaj"). The `cureFor`
cache key now holds the quarries' statuses (the post's own status does not change when the quarry's does) and its
world (a second world with the same counters got the first one's cure — the new test showed it). Seeds 1310 / 1317:
9–10 s -> 0 (the 1 s at 109:00 is the tool's look tick). New keys pending translation. Test
`tests/stone-wait.test.ts`. (decided)

**D-592 — A full yard refused by a full granary while another granary has room reads calm.** D-431's half second:
a producer OUTPUT_FULL.NO_DESTINATION blocked by a full granary while another granary its road reaches has just got
room (a new one, or loads left) read as the red card with no cure until the next dispatch (≤ 6 ticks). It is the
producer side of 'storeRoom' (audit fix 3): `yardStoreRoom` (the granary of `granaryRelief(blockedBy)` when the
producer's gate reaches it) makes it a calm stall (`calmStall`), `calmWhy` 'yardRoom' — the card "pełne podwórze —
towar pojedzie do spichlerza, który ma miejsce", the sheet's calm line "Inny spichlerz ma jeszcze miejsce — nowy
towar pojedzie tam:" with one tap to it. Valley seeds 1309–1330 × card-10/30/60, 120 min (`tools/dead-seconds.ts`):
OUTPUT_FULL.NO_DESTINATION dead-card seconds 229 -> 2 (all dead seconds 387 -> 135); look player (`sandbox-first30`):
no failed look, rank 5 in 66/66, earned card-10 / 60 identical, card-30 +27. `calmStall`'s cache is now per world
(two worlds with the same id, status and second shared one answer). Test `tests/yard-room.test.ts`. (decided)

**D-593 — UI read caches hold their world.** Three module-level caches keyed only by ids and counters answered a new
game with the last game's result when building id, network version and building count matched: `cutOffNoLink`
(D-410: "Rozbierz" offered — or withheld — from the old map's link search), the sheet's gap road `gapSuggestion`
(moved from `panels.ts` to `stalls.ts`; its "fix" button laid the old map's cells) and `calmStall` / `cureFor`
(D-591, D-592). Each is now per world (WeakMap or a `world` field). Tests in `tests/cut-off-link.test.ts` fail
without the fix. (decided)

**D-594 — Bug hunt 2026-11-10 (stall cards): what was left.** Valley seeds 1309–1330 × card-10/30/60, 120 min, per
second (`tools/dead-seconds.ts`), and missions I–XVII with no input, 10 min: 135 dead seconds left — NO_INPUT.CONTESTED
with nothing to press 82 s (longest 20 s, a charcoal burner beside the sawmill; the card names the cause, the producer
cure comes with the bottleneck card after 3 min, D-171, and in missions after 30 s, D-110 — left for the playtest),
one-second `pave-grey` readings on the tool's look ticks and from `cureFor`'s 2 s key, and a 1 s red flash of a
producer at a saturated granary while a wagon takes a load from it (seed 1322 card-10 30:11). Missions: IX / X / XVII
CONTESTED waits as in D-431, II bakery NO_INPUT with nothing built. Mission hashes 86/86 unchanged (no sim change).
BACKLOG P4. (decided)

**D-610 — Mission XVII: the workshop starved by the other castle's chain is a calm pin.** Bug hunt 2026-11-10 (late
missions): at the even split (and with the castle leg only, the "wrong" lever) the sawmill read
NO_INPUT.CONTESTED from 2:09 and became critical at 2:53 — a red card with nothing to press for 76 s, which also took
the HUD slot from the castle pace card that carries the lesson and the chain switch (D-358). With the east chain first
(the right answer) the charcoal burner read NO_INPUT.CHAIN_FIRST as a red card for 33 s (and the north castle's
NONE_AVAILABLE behind it). `chainSwitchStall` (`src/ui/stalls.ts`): in a mission with `chainPriority`, NO_INPUT
CONTESTED / CHAIN_FIRST whose rival is a workshop of another kind on the same input, and a castle or workshop
NO_INPUT.NONE_AVAILABLE whose producer is such a workshop, are calm (`calmStall`), so the castle card keeps the slot;
the sheet still names the rival. XVI (one good) keeps its red contest. XVII red cards with nothing to press: 76 s ->
0 over every bot strategy. No sim change. Test `tests/late-mission-cards.test.ts`. (decided)

**D-611 — A building cut off from the stable's roads gets the road even when it reads NONE_AVAILABLE.** Fuzz in
missions X–XVII (seeded random commands, mission build lists respected): a castle whose last road cell was taken back
read NO_INPUT.NONE_AVAILABLE ("brak zapasów do przywiezienia") while the sawmill held planks below a full load —
critical, no cure, for up to 8 min (XIII). `cutOffConsumer` (D-394) now also takes NONE_AVAILABLE with a producer on
the map and works in missions; new `cutOffSource`: the head waits on a producer whose gate is off the network (XIV:
the burner's road taken back) — the gap finder links that producer. The card says "brak dojazdu do zapasów"
(`cause.NO_INPUT.UNREACHABLE`) for the cut-off consumer; `cureFor` returns 'road'. No sim change (the sim's status
stays; changing it would move the mission hashes). (decided)

**D-612 — XVII castle card: "pierwszy jest …" with the other chain first; the castle leg alone does not hide the
card.** `castleCard` read the forecast's share, which says 'after' only when both castles want the same good — with
the north chain first the east castle's card said "towar dzielony po równo" (wrong), and with the east castle leg on
(no chain) the late east castle had no card at all (share 'first'), though the leg does not move the wood (D-357).
In a `chainPriority` mission the card now exempts only the castle first with its whole chain, and its share is
'after' (rival: the first castle) while any chain is first, else 'even'. XVI unchanged. (decided)

**D-613 — Dead-end letter for an order nobody can make any more.** After the "cannot be rebuilt" warning (second tap)
the player may take down the only mill of mission XIII; the castle's bread was then lost for good, but the card stayed
red ("brak zapasów") until the deadline, up to 10 min. `deadEnd` (`src/ui/deadEnd.ts`) now also returns
`NO_SOURCE` (castle, good, need, left): the most the map can still bring — stock in yards, granaries and wagons, plus
what the remaining or buildable workshops can make from inputs left (endless when a producer of the chain's raw good
stands or can be built) — is below what the castles still lack. Generous bound on purpose: never reported in the
60 bot / no-input runs of missions I–XVII; in 204 fuzz runs reported 13 times and none of those games was won. The
letter is the same D-48 letter with the text `deadEnd.noSource` (new key, pending translation). (decided)

**D-614 — A workshop starving after its whole order is in is calm ("zamówienie wypełnione").** XIII: once the castle
holds its 24 planks and the granary's wood is gone, the sawmill read NO_INPUT.NONE_AVAILABLE as a critical red card
while the bread was still on its way. `inputOrderFilled`: NO_INPUT, every product ordered by a castle that holds it
in full, and no building uses it as an input — calm, `calmWhy` 'orderFilled'. (decided)

**D-615 — A producer taken down that the mission can rebuild is offered on the card.** XIV's lesson is the burner's
site; a player who takes the first burner down to rebuild it by the forest saw the castle's red "brak zapasów" with
nothing to press (fuzz: up to 7 min). `missingProducer`: a chain link NO_INPUT.NONE_AVAILABLE with no producer to blame
and a type in the mission's build list that makes the good — cure 'producer' (`producerCure` source 'missing'), the
ghost by a producer of its input (the woodcutter), hint `fix.producerMissing` (new key, pending). Also X (woodcutter).
(decided)

**D-616 — Mission X: once the shared-supply card has shown, a later contest keeps the second-producer cure.** The
shared card waits 30 s of uninterrupted waiting (D-110, owner: do not give the lesson away). Later in the game the
sawmill read NO_INPUT.CONTESTED between deliveries for up to 20 s at a time with no cure (the wait counter had
restarted). `sharedContested`: after the card has shown once for the workshop (UI memory per world), CONTESTED keeps
cure 'producer'. Before the first card nothing changes (the opening 2–20 s stay the lesson). (decided)

**D-617 — Starved for a good nothing can bring is calm.** A workshop NO_INPUT.NONE_AVAILABLE with no producer of the
good on the map or in the build list and not a unit left anywhere (XIII's mill once the granary's grain is used) can
never work again: if the castles still needed it, D-613's letter says so; otherwise it is idle for good — calm
(`starvedForGood`). (decided)

**D-618 — Stranded wagons: the gap finder links their road piece.** A wagon NO_ROUTE to a target that is on the
stable's network (its own road piece cut off with a farm), or every workshop NO_WAGON.NONE_CAN_REACH while the only
wagon stands on a castle whose road was taken back: the gap target was the connected building, so the sheet had no
road while the rail lit the road tool. `strandedTarget` returns a building on a stranded wagon's piece (the castle
allowed), and the gap finder links it. (decided)

**D-619 — Bug hunt 2026-11-10 (late missions, free valley): results.** `tools/fuzz.ts` 300 runs (m1–m17 + valley)
and `tools/fuzz-late.ts` 60 runs: 0 failures (invariants, unexplained stalls, NaN, stuck wagons, save/load, rerun).
Bots m10–m17: ladders unchanged, no invariant or command errors. Mission dead-card scan (every bot strategy plus 25
fuzz runs per mission, X–XVII, red card with nothing to press and no dead-end letter): longest stretches 641 s
(cut-off castle), 629 s (stranded wagon), 544 s (XVII), 467 s (XIV burner taken down) -> remaining ≤ 19 s, all the X
opening contest kept by D-110, plus 1–7 s flashes. Valley `tools/dead-seconds.ts` card-10 1303/1305, card-30 1314,
card-60 1328: unchanged (card-60 1328's 11 s trading post `pave-grey:NO_STONE` at 110:37 predates this hunt, BACKLOG).
No sim change; mission hashes unchanged. (decided)

**D-630 — A market load the next dispatch books reads calm for 2 s.** Seed 1322 card-10 30:11: a load of flour just
unloaded into the full granary while wagons stood idle; the fisher it refused flashed red ("Kup wóz" with a wagon
standing idle) for a second between two calm "rynek nasycony" reads. `granaryLoads` returns 'pending' when a market
load is unbooked but a wagon without a job reaches the granary and the market's share of the fleet
(`MARKET.wagonSharePct`) is not used up — for 2 s from when the load was first seen (UI memory per world; a load the
dispatcher still leaves after that needs a wagon after all). `granaryPending` makes the granary and the producer it
refuses calm; `cureFor` offers nothing. `calmStall`'s key includes the fleet size. (decided)

**D-631 — `cureFor` is cached per world, building and tick.** The key held a 2 s bucket, so a cure read in its first
tick (a quarry's yard, a granary's load, a stone count) stayed up to 2 s after the state had moved on; the dead-card
scan saw those as 1 s flashes. One cache per world and building (the HUD card and an open sheet ask for different
buildings in the same frame). Cost on a cache miss in the late valley: ≈ 0,01 ms on average, worst ≈ 2 ms. (decided)

**D-632 — A quarry between two cycles digs.** WORKING with no cycle running (placed this tick, or a cycle just done
and the next dispatch about to book the yard) counted as not digging, so the held span's sheet read the grey stone
button for a tick (a paused game showed it until it ran again). `paveStoneWait` counts it as digging. (decided)

**D-633 — Stone dug into a quarry yard a full granary refuses: a calm pin that points to the quarry.** Valley card-60
seed 1328 110:37–110:46: the trading post's wagon held at the bridge (ice), its red card offered only the grey "Wyłóż
most kamieniem" for 11 s — the stone it lacked lay in the quarry's full yard (OUTPUT_FULL.NO_DESTINATION, the granary
full). `paveStoneYard`: the held span lacks stone, no calm stone wait and no wagon short (D-591), and a quarry's yard is
refused by a granary (`blockedBy` ≥ 0) — the held building is a calm pin (`cause.stoneYard`; ice keeps
`cause.heldIce`, D-455), its sheet says the stone lies at the quarry with one tap to the quarry, whose own card has the
cure (a wagon, a granary, or calm "rynek nasycony"). New keys `cause.stoneYard`, `fix.stoneYard` (pending). (decided)

**D-634 — A workshop whose own gate lost its road, with no link left, gets "Rozbierz".** Seed 1321 card-10 64:41: a
malthouse NO_ROAD (a road or building laid later took its gate's cell) and the gap finder had nothing — red card,
nothing to press. `cutOffNoLink` takes a NO_ROAD root as cut off too (D-410). (decided)

**D-635 — The dead-end letter checks every castle with an order.** XVI / XVII: the second castle cut off with no
silver to link it was never reported (only the main castle was). Each castle whose order is not in yet, main first;
the letter text is the same ("Zamek nie ma drogi do stajni…"). (decided)

**D-636 — A cycle already running counts toward what the map can still bring.** Fuzz m17 seed 104: the woodcutter
taken down at 4:40, the sawmill's last cycle running — the letter said 10 of 12 planks left and would have cleared at
5:01 when that cycle came out (its wood had left the yard when it started). `onMap` adds a running cycle's output.
(decided)

**D-637 — `tools/dead-seconds.ts` reads the state the running game shows.** It read after the look's command and
before the step — a state a running game never draws (a command is stepped before the next frame; only a paused game
shows it). `sandbox-first30` option `secondBeforeLook`. Valley 22 seeds × card-10/30/60, 120 min: 135 dead seconds
with the old order; with the new order before D-630..D-634 100 s, after 72 s — all but 4 s NO_INPUT.CONTESTED (D-594 a,
left for the playtest); the 4 s are a bakery NO_INPUT at 8:34 (card-30 1309), present before too. (decided)

**D-638 — Dead-end letter: a workshop on the build list no silver can pay for counts as none.** D-613 counted any
type on the build list as buildable. Now only when its price fits all the silver the player can still raise in a
contract mission, where nothing pays but refunds: coins, every wagon but one sold, every building (not castle, stable,
trading post) and every road cell taken back (`silverBound`; Infinity where a market pays). The letter
`deadEnd.noSilver` names the cheapest such price. Generous by construction (a road to the new workshop is free here).
Never seen in fuzz (missions start with silver); test on a stripped XIV. (decided)

**D-639 — Dead-end letter: too late for an order that can still be filled.** TOO_LATE when, for a castle good, even
every standing workshop of its chain working without a pause from now on (a running cycle only if it ends by the
deadline, the next one after it, +1 tick of slack) with no wagon time cannot make the rest by the main deadline, and
no new workshop can be built (not on the list, or D-638's silver). Missing source and a cut-off castle are named
first. Seasons skip the bound (cycles vary). `tools/dead-end-scan.ts` (bots XVI/XVII, every balance-night6 player
I–XVII with `--balance`, 3 000+ fuzz games with and without the mission's own silver, up to 30 min): 0 letters in a
game won or cleared later. Example: the m1 players that never bridge get it at 10:01 of 12:00. Key `deadEnd.late` (pending). (decided)

**D-650 — A granary cut off from a producer that is still on the stable's roads gets the road.** Bug hunt 2026-11-11
(missions I–IX, own scanner: HUD red card with nothing to press and no dead-end letter, every game second, 360 fuzz
games with 4 000 silver, 360 with the mission's silver, every balance-night6 player I–IX). The sim names the first
granary a full producer cannot reach (`OUTPUT_FULL.NO_DESTINATION`, `blockedBy`); `cutOffProducer` (D-173) only
covered the producer itself off the stable's network. Mission IV: one artery cell taken back left the stable and the
woodcutters on one piece, the sawmill and the granary on the other — the woodcutters' card stayed critical with nothing
to press for up to 8 min (also I, before the bridge, 42–91 s). `cutOffGranary` (`src/ui/stalls.ts`): the producer
reaches the stable, the named granary (not full) does not — the gap finder links the granary, `cureFor` 'road'. Card
text unchanged ("pełny magazyn, nie ma dokąd wieźć"). No sim change. (decided)

**D-651 — The stable's own road taken back: the sheet links the stable.** The road cell in front of the stable's gate
taken back (III, IX): the stable read NO_ROAD as the critical card, but `suggestLinkToStable` links a building *to* the
stable's network and returned nothing for the stable itself — an empty sheet for up to 4.5 min while a bought wagon had
nowhere to go. `gapSuggestion` now answers the stable with `stableLink`: the cheapest road from its gate to the
castle (no contract: the first building whose gate is on a road), the same `fix:` button. (decided)

**D-652 — A castle behind a workshop whose input wagon stands at the ice gets the stone bridge.** IV: the castle short
of planks (`NO_INPUT.NONE_AVAILABLE` blamed on the sawmill) while the sawmill's wood wagon stood at the ice was the
critical card with nothing to press for up to 87 s; the held-span cure (research P4) looked only at wagons of the
building's own job. `heldSpanFor` now follows `NONE_AVAILABLE`'s producer one level (either leg of the producer's
job: the wagon may be held on its way to the pickup). Not for CONTESTED / CHAIN_FIRST (`blockedBy` is a rival
consumer). The first 20 s of a hold stay the wait (HELD_SPAN_TICKS, as before). (decided)

**D-653 — A building whose delivery wagon has no road is a red card.** VII: the fisher taken down while its wagon
loaded, then the road behind the wagon: the castle read WAITING_DELIVERY (six fish on a wagon NO_ROUTE) for the rest
of the game — no stall in the sim, so the HUD had **no card at all** and the order was lost silently (the wagon's own
red pin on the map was the only sign). `routeLostFor`: WAITING_DELIVERY / WAITING_PICKUP whose wagon has been NO_ROUTE
for MIN_STALL_TICKS — a critical card "{wagon} nie ma drogi do celu" (new key `cause.routeLost`, pending), cure 'road'
from the chain. Never shown in any balance-night6 player I–IX (only after roads or producers taken back). (decided)

**D-654 — A wagon stranded on a road piece with no building: the cheapest road from the wagon.** D-618's
`strandedTarget` links a building on the stranded wagon's piece; with none there (the producer it loaded at taken down,
or two cells around it taken back) the target needed no road of its own and the sheet had nothing. `gapSuggestion`
falls back to `strandLink`: a NO_ROUTE wagon of the target's job → `suggestConnection(wagon cell, target gate)`. After
the delivery the castle reads NONE_AVAILABLE and D-615 offers the new fisher. Test `tests/early-mission-cards.test.ts`
(D-650..D-654). (decided)

**D-655 — Bug hunt 2026-11-11 (missions I–IX): results.** `tools/fuzz.ts` 300 runs (m1–m9): 0 failures. Bots I–IX
(`mission-bot`, `bot-m2/3/4/7/8/9`): ladders unchanged, no invariant or command errors. Own scanner (scratchpad, after
`tools/dead-end-scan.ts` / `dead-seconds.ts`): longest red card with nothing to press 479 s (IV cut-off granary),
276 s (IX stable), 151 s (III stable), 124/87 s (IV castle at the ice) -> remaining ≤ 20 s, all the first 20 s of a
held span (by design) or a castle whose input wagon is due (≤ 7 s). Not counted as "nothing to press": a grey "Kup wóz"
or stone-bridge button with "brakuje N srebra" (the reason is on the button). Lost games without a dead-end letter: a
repair bot (gap roads, stone bridge, missing producer, wagons) from 30 s snapshots wins most of them — the losses are
play, not dead ends the letter misses; VII after the fisher was taken down and the stable cut from the castle stays in
BACKLOG. Mission I's "too late" letter (D-639) unchanged, owner's decision pending. No sim change; mission hashes
unchanged. (decided)

**D-670 — IX / X opening: the wood contest offers "Postaw drwala" at once (owner 2026-11-11; amends D-110, D-616).**
Owner's decision on the BACKLOG questions (D-616, D-655): the red "surowiec zabiera inny odbiorca" card of the
sawmill (NO_INPUT.CONTESTED) at the opening of missions IX and X (0:02–0:21, every game) no longer waits for the
30 s shared-supply card with nothing to press. `sharedContested` (`src/ui/stalls.ts`) drops D-616's "after the card
has shown once" memory: NO_INPUT.CONTESTED with one shared producer the mission can build (`sharedOneProducer`) has
cure 'producer' from the first second — the sheet's "Postaw drwala" with the ghost by the shared woodcutter, the
build tool lit. The card's text stays the contest; the shared-supply card itself ("{woodcutter} zaopatruje {n}
warsztaty", D-104) still waits 30 s of waiting (D-110 otherwise unchanged: every other input wait keeps its 30 s).
It generalises cleanly: `sharedOneProducer` exists only in IX and X (shared-card test: no other mission offers it;
the free valley is 'ranked'). Scan (scratch, missions I–XVII, no input + 8 fuzz games each, 10 min): contested
seconds with nothing to press IX 161 → 11 (contests with two producers left after fuzz), X 216 → 0, every other
mission and every dead-card count unchanged. Valley `tools/dead-seconds.ts` card-10 1321 / card-30 1323 (60 min)
and `tools/sandbox-first30.ts`: output identical. Balance (`balance-night6 m9 m10`): only the 10 s eye moves — IX
8,04 → 7,82 min, X 8,88 → 9,04 min, both 3★ (X margin to 3★ +25 → +15 s); 30 / 60 s eyes, scan and letter players
unchanged. Tests `tests/shared-card.test.ts` (opening contest cure in IX and X, card still after 30 s),
`tests/late-mission-cards.test.ts` (D-616/D-670: every contest of X offers the woodcutter). No sim change. (decided)

**D-671 — Mission I keeps the "too late" dead-end letter (owner 2026-11-11).** The D-639 TOO_LATE letter in the
tutorial mission (players who never bridge get it at 10:01 of 12:00) stays as it is. No change. (decided)

**D-672 — A command in pause refreshes the cards and sheets at once; the sim does not tick (owner 2026-11-11).**
Statuses are taken only by `dispatch` inside `step`, so a command applied in pause (applied at once) left the
old reading on screen: seed 1321 card-10 73:10, the road to a cut-off brewery built in pause kept its red
"nieosiągalny" card with nothing to press until the game ran (D-637, BACKLOG P4). New sim read helper
`pausedReading(world)` (`src/sim/sim.ts`): a JSON copy of the state, terrain shared, `dispatch` run on the copy at
the same tick — the real world is untouched (no tick, no RNG draw, same hash). The app (`onCommandResult`, only with
speed 0 and an accepted command) keeps that copy as `reading` until the next tick (`onTick` drops it, a new world
too); the HUD card, the ranking, the map pins and the building / wagon sheets (`sheetNav`, a PanelNav whose `world`
is `readWorld()`) read it, while commands, tools, the tutorial, saves and the scene keep the real world. UI memory
sampled per tick (input waits D-110, fleet bits D-127, bottleneck windows D-171, wagon-wait memo D-161, calm costs
D-335, market load memory D-630) is keyed by the real world: `memoryWorld` (`src/ui/readWorld.ts`) maps the copy
back. On a dispatch tick the copy equals the state after the next step (test); on other ticks it is the dispatcher's
answer a few ticks early — the reading the running game shows within 0,5 s. Cost: one state copy and one dispatch per
command in pause. Mission hashes 86/86 identical (`tools/mission-hashes.ts`, also against the base before D-670).
Test `tests/pause-reading.test.ts` (seed 1321 card-10 73:10: stale card in the paused state, none in the reading,
same statuses as after the next tick; IV road in pause: hash untouched, readings never reach a replay; X: the
shared card reads through the copy). (decided)
