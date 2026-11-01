# Marchia app icon v3 - staging and installation

The source of truth is `art/app-icon.svg` (identical to `art/app-icon-wheel-seal.svg`).
The previous wheel/seal artwork is retained as `art/app-icon-v2.svg` for reproducible visual comparison.

The seal's capital **M** is a **vector outline from Grenze Gotisch** (Google Fonts / SIL Open Font License 1.1), not a `<text>` element. No font binary is embedded or distributed with the icon.
Source: https://github.com/google/fonts/tree/main/ofl/grenzegotisch

## Safe staging: does not touch android/ or ios/

```bash
npm ci
npm run icons
npm run icons:check
```

Generated PNGs and metadata are placed at:
- `art/out/android/app/src/main/res/`: 5 launcher sizes, round masks and adaptive/themed foreground
- `art/out/ios/App/App/Assets.xcassets/`: opaque iOS app icons, transparent splash assets and `Contents.json`
- `art/out/app-icon-{foreground,monochrome}.svg`: standalone derived vector layers

Preview sheets:
- `docs/shots/app-icon.png`: 48/96/192/512px on light/dark background and circular mask
- `docs/shots/app-icon-variants.png`: horse vs wheel/seal variants
- `docs/shots/app-icon-v2-v3.png`: the requested v2/v3 visual comparison at 48/96/192px

The default command **never writes under `android/**` or `ios/**`**. Another agent can copy
the staged assets into a native project when ready. Existing native project XML files are not changed by staging.

For an explicit native update, and only after coordinating with the Android agent:

```bash
npm run icons -- --install-native
npm run icons:check -- --native
```

The source files use filled contours without gradients, runtime fonts or stroked hairlines;
the wheel has directional tapered cuts while the embossed wax rim uses a reproducible subtle
irregularity. The 48px layout remains a two-shape silhouette.
