# Store screenshot generator

`tools/store-shots.mjs` captures **real gameplay**, overlays the bilingual captions from
[`screenshots-plan.md`](screenshots-plan.md), and exports fixed-size PNGs for store marketing and review.
The framing falls back to the parchment, oak, iron and wax vocabulary of
[`UI_STYLE.md`](../UI_STYLE.md) until the separate store-frame design is available.
No screenshot substitutes a texture sheet, illustration, or synthetic panel for gameplay.

## Usage

From the repository root, with Node.js 22+, dependencies and Playwright already installed
in the development environment:

```bash
node tools/store-shots.mjs
node tools/store-shots.mjs --lang=pl --orientation=portrait --shot=1,2,6
```

The generator always runs `npm run build`, then starts and closes its own local
`vite preview` server. It uses the debug URL parameters already implemented in
`src/ui/app.ts`, pauses the simulation, and captures with Playwright Chromium.
**Do not install a browser locally for this order.** The manual GitHub Actions
workflow [`.github/workflows/store-shots.yml`](../../.github/workflows/store-shots.yml)
installs its own Chromium and uploads the generated files as an artifact.

## Output

- `art/store/screens/pl/01-valley-portrait.png` … `06-contract-landscape.png`
- `art/store/screens/en/01-valley-portrait.png` … `06-contract-landscape.png`
- `art/store/screens/manifest.json` — actual simulation evidence and any failures

Each language receives six **1080 × 1920** portrait and six **1920 × 1080** landscape
PNGs, 24 images total. The game is rendered at phone-like DPR **2.625** for portrait;
the final frame is composed at exactly the export dimensions. Generated files are
ignored by Git and published through the workflow artifact instead. Check the\nindividual store's current device-specific screenshot size requirements before\nuploading, particularly for iOS.

## Authenticity and QA

The script refuses to export a scene unless its simulation provides the advertised
evidence: a loaded wagon in the valley, an actual bakery → mill shortage explanation,
different loaded goods on wagons, a visible road draft with genuine cost next to a
real bridge, an **M2 `BRIDGE_JAM`** status, and partial progress on M1's
**30 planks / 20 bread** contract. For the jam it reproduces the two extra wagon
purchases from `tools/bot-m2.ts` using real in-game commands. It does not assign
fake status values or manipulate inventories. A missing mechanic or WebGL renderer
causes a nonzero exit and a diagnostic in the manifest; it must not be silently
replaced with a mock UI.

**Before publication**, inspect all exported screenshots at full size and at
phone thumbnail size. In particular, check that two different *visible* cargoes
are legible in #3, that the drafted route and bridge are identifiable in #4, and
that the physical queue at the bridge is legible behind the #5 panel. Automated
simulation evidence does not prove final composition or store acceptance.
