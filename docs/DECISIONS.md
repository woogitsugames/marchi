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
