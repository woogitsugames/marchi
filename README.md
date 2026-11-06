# MARCHIA — Szlaki Królestwa

![CI](https://github.com/woogitsugames/marchi/actions/workflows/ci.yml/badge.svg)

A mobile-first medieval logistics strategy game for Android and iOS. Build roads and move physical goods by wagon; diagnose the cause when production or transport stalls. Play short missions or develop the Free valley.

[Polski](docs/README.pl.md) · [Design](docs/DESIGN.md) · [Project guide](CLAUDE.md)

## Getting started

Requires Node.js 20 or newer. From the repository root:

```bash
npm install
npm run dev         # Vite development server
npm test            # headless tests; see the SUMMARY line
npm run typecheck   # application and simulation
npm run build       # production web build
npm run bot         # scripted bot plays mission I headless
npm run perf:sim    # headless sim cost at 50/100/200 wagons
```

For a debug Android APK, install JDK 21 and the Android SDK, then run `npm run setup:android` if the SDK is not already installed and `npm run apk`. The APK is placed in `dist-apk/`. See [CLAUDE.md](CLAUDE.md) for prerequisites and additional commands.

## Repository

- `src/sim/`: deterministic simulation and game rules.
- `src/ui/`, `src/render/`, `src/i18n/`: interface, rendering and translations.
- `src/platform/`, `android/`, `ios/`: persistence and mobile platforms.
- `public/assets/`: game assets; provenance is recorded in [ASSETS.md](docs/ASSETS.md).
- `tests/`, `tools/`: automated tests and development tools.
- `docs/`: design, decisions and production documentation.

Contributors should read [CLAUDE.md](CLAUDE.md) for architecture, asset and workflow rules. Game decisions are recorded in [DECISIONS.md](docs/DECISIONS.md); visual guidance is in [UI_STYLE.md](docs/UI_STYLE.md).

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`): on pushes to `claude/**` and `gpt/**` and PRs from/to them — tests, typecheck,
  build, mission I bot, sim perf in the job summary.
- **Debug APK** (`.github/workflows/apk.yml`): Actions → *Debug APK* → *Run workflow* (or a `v*` tag); the APK is kept
  in *Artifacts* for 14 days. A test build, not signed for release.
