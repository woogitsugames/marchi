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

**D-16 — Foldables and big screens (Galaxy Z Fold / Flip).** Screen classes (CSS px at the default
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
