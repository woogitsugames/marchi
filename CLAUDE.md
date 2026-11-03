# MARCHIA — Szlaki Królestwa · project guide for agents

Medieval economic-logistics strategy game, mobile-first (Android + iOS via Capacitor).
The core idea: **the game is about diagnosing stalls, not about a pretty settlement.**
Every wagon carries visible cargo with a destination, ETA and reserved goods. Every stall
has an explicit cause the player can read with one tap (target: understood in < 30 s).

Talk to the owner in **Polish**. Code, comments, commit messages: **English**.
All player-facing text goes through i18n (`src/i18n/pl.ts`, `src/i18n/en.ts`) — never hard-code UI strings.

## Commands

```bash
npm install            # once
npm run dev            # Vite dev server (http://localhost:5173)
npm test               # headless sim tests (tsx), prints SUMMARY, exit != 0 on failure
npm test -- determinism  # run test files whose name contains "determinism"
npm run typecheck      # whole project + sim-only config (no DOM, no three.js)
npm run build          # typecheck + production build into dist/
npm run bot            # scripted bot plays mission 1 headless, prints result
npm run perf:sim       # headless sim cost at 50/100/200 wagons
npm run shots          # Playwright screenshots at 412x915, 915x412, 904x1000 -> docs/shots/
npx cap sync           # copy dist/ into android/ and ios/
```

### Android APK (debug)

```bash
npm run setup:android     # once per fresh container: Android SDK -> /opt/android-sdk
                          # (cmdline-tools, platform-tools, platforms;android-36, build-tools;36.1.0)
npm run apk               # web build + cap sync + gradlew assembleDebug
npm run apk -- --skip-web # package the existing dist/ as-is
```

Output: `dist-apk/marchia-debug-<git short sha>.apk` (gitignored). Needs JDK 21 on PATH;
`ANDROID_HOME` defaults to `/opt/android-sdk`. Capacitor 8.6, compile/target SDK 36, AGP 8.13,
Gradle 8.14.3 wrapper (see D-12). First Gradle run downloads dependencies; Maven Central may
answer 429 — the script retries. Build outputs under `android/` and `ios/` are gitignored by
the platform `.gitignore` files; commit the rest of `android/` and `ios/`.

## Architecture (hard rules)

- `src/sim/` — **pure TypeScript simulation**. No `three`, no DOM, no `Math.random`, no
  `Date`, no `Math.sin/cos/exp/pow/atan2` (cross-engine float differences). Only `+ - * /`,
  `Math.sqrt`, `Math.abs`, `Math.min/max/floor/round`. Fixed step (`TICK_HZ`), seeded RNG
  stored *in the state*. State is plain JSON-serializable data (no classes, no Maps).
  Same seed + same commands ⇒ identical state hash. `tsconfig.sim.json` enforces no DOM.
- Player input reaches the sim only as **commands** (`src/sim/commands.ts`) applied at tick
  boundaries. Pause and ×1/×2/×4 only change how many ticks run per frame (`src/game/loop.ts`).
- `src/render/` (three.js) and `src/ui/` (DOM) **only read** sim state. Never mutate it.
- Goods are conserved: a unit is in exactly one place (building stock or wagon cargo).
  Reservations are markers, not copies. Tests check this every tick.
- Every idle/stalled building and wagon carries a `StallReason` (data, not a string).
- Saves: IndexedDB, versioned envelope + migrations (`src/platform/save.ts`).

## Conventions

- TypeScript strict. Small modules. Named exports. No default exports except configs.
- Tests: `tests/*.test.ts`, registered via `tests/harness.ts` (`test(name, fn)`), headless,
  fixed seed. The runner prints `SUMMARY passed=N failed=M` as the last line.
- Decisions go to `docs/DECISIONS.md` as D-NN with reasoning. Assets go to `docs/ASSETS.md`.
- Small, descriptive commits. Work on feature branches; the integration base is `claude/eager-cori-08wt8e`. After every green merge into the base (typecheck, test, build, smoke, layout), fast-forward `main` to the base (owner decision 2026-11-03). PRs from other sessions target the base.

## Forbidden (from the brief)

- Copying code, art, names or UI from other games (KaM, Manor Lords, Settlers, …). Mechanics only.
- Combat, diplomacy, multiplayer, settler life-sim (not before the logistics playtest).
- Timers/energy/pay-to-win. Model: free + one-time full-version purchase.
- Visuals: pastels, candy saturation, toy/diorama look, low-poly, cel-shading, pixel art.
- UI "AI slop": purple-blue gradients, glassmorphism, neon, generic rounded SaaS cards with
  default shadows, emoji icons, ✨, Inter/Roboto/system font as the only typography,
  everything centered in an empty window, "Welcome!", "Get Started", dashboard charts,
  unmodified icons from a popular pack.
- UI required: own visual system (`docs/UI_STYLE.md`), woodcut-style icons drawn for this game,
  goods icons distinguishable by **shape**, minimal diegetic HUD, touch targets ≥ 48 dp,
  safe-area, portrait + landscape + foldables, every screen clearable with one gesture,
  animations 100–250 ms, no bouncy springs.
- After each major screen: Playwright screenshots (412×915, 915×412, 904×1000), inspect them
  against this list, rework anything that looks like a generic template before committing.
