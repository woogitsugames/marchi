# MARCHIA · UI visual system

The UI is the **steward's kit**: a waybill on parchment, an iron-shod tally board, a wax seal.
It speaks only when needed, and it is designed for a thumb on a phone in a moving tram.

## Typography (both SIL Open Font License 1.1, bundled via `@fontsource`, latin-ext for Polish)

| Role | Face | Use | Sizes (CSS px ≈ dp) |
|---|---|---|---|
| Headings, mission titles, seal text | **Grenze Gotisch** (600–700) — a readable textura with 14th-century proportions | screen titles, contract name, building names in panels | 22 / 28 / 40 |
| Body, numbers, labels | **Alegreya Sans** (400, 500, 700) — humanist sans with calligraphic roots, excellent small-size legibility, tabular figures | everything else | 13 (min) / 15 / 17 |

- Numerals in panels use `font-variant-numeric: tabular-nums` so ETA counters don't jitter.
- Never set body text in Grenze Gotisch. Never use more than these two faces.
- Licences: see `docs/ASSETS.md` → Fonts. OFL text ships in `public/licenses/`.

## Materials (used sparingly and functionally — never as wallpaper)

| Material | Where | Implementation |
|---|---|---|
| **Pergamin** (parchment) | panels with text the player reads: waybill, "Why is it stalled?", wagon card | flat `#e4dccb` + very low-contrast fibre noise (SVG turbulence), torn/deckled edge only on the contract waybill |
| **Drewno** (oak) | the action bar (tool rail) and speed control | dark oak `#3b3127` with a 1 px lighter top edge, no photographic wood texture |
| **Żelazo** (iron) | borders of buttons, the active tool ring, dividers | `#4a4843` hairlines 1.5 px; square corners with small chamfers (cut corners, not rounded) |
| **Wosk** (wax) | the contract seal, the single primary call-to-action, critical stall markers | Glina `#8c4a2f`, slightly irregular disc |

Corner rule: **chamfered (cut) corners** of 6 px, never border-radius pills. Shadows: only one —
a hard 2 px offset in Torf at 40 % under floating elements (like paper on a table), no blur haze.

## Colour tokens

`--ink #2b2620` · `--parchment #e4dccb` · `--parchment-dim #cfc5b0` · `--oak #3b3127` ·
`--oak-hi #5a4a39` · `--iron #4a4843` · `--clay #8c4a2f` (wax / alert) · `--ochre #b8893a` (ETA,
progress) · `--meadow #56603f` (OK / working) · `--mist #c9c6bb`.
Status colours are always paired with an icon shape (never colour alone).

## Grid and spacing

- Base unit **4 px**; spacing scale 4 / 8 / 12 / 16 / 24 / 32.
- Touch targets **≥ 48 px** (CSS px ≈ dp), primary actions 56 px.
- Respect `env(safe-area-inset-*)` on every edge-anchored element.
- **Thumb zone**: tools and speed live on the bottom edge in portrait, on the right edge in
  landscape (right-handed default, mirrored for left-handed). On near-square / wide portrait screens
  (width ≥ 720 px, unfolded Fold, tablets) the rail splits into two pads: tools bottom-left, speed
  bottom-right. Panels open from the bottom in portrait, from the side in landscape / on foldables
  (width ≥ 720 px: side sheet, map stays visible).
- **Foldables** (D-16): Flex mode puts the scene in the top half and every control in the bottom half;
  the Flip cover screen is a watch mode (scene, bubbles, speed; no building tools; controls on top).
- Every overlay closes with one gesture: tap on the empty map, swipe down on the sheet, or the
  Android back button. A "clear screen" tap (two-finger tap) hides all UI except the scene.

## Buttons and states

| State | Look |
|---|---|
| Rest | oak fill, iron hairline, parchment icon/label |
| Pressed | fill darkens 8 %, content shifts down 1 px (no scale bounce) |
| Active tool | iron ring becomes wax-clay, label under the icon |
| Disabled | 40 % opacity + diagonal hatching; the reason is shown on long-press |
| Focus (keyboard/a11y) | 2 px ochre outline, offset 2 px |

Motion: 100–250 ms, `cubic-bezier(.2,.7,.2,1)` (decelerate). Sheets slide, markers fade.
No springs, no overshoot, no infinite pulsing — a stall marker breathes once on appearance.

## Iconography

Drawn **for this game** as single-colour SVG in a **woodcut / engraving** idiom: a firm
silhouette, parallel hatching for shadow, slightly uneven contour. 24 × 24 grid, drawn at
48 px for markers. Stroke-free fills so they survive scaling. Source in `src/ui/icons.ts`.

Goods must differ by **shape** (accessibility, colour-blind safe):

| Good | Silhouette |
|---|---|
| Wood (log) | horizontal cylinder with a ringed end-grain circle |
| Planks | three stacked flat bars, stepped |
| Grain | upright sheaf: bundle with fan of ears |
| Flour | squat square sack tied at the top |
| Bread | round loaf with three scored cuts |

Stall reasons have their own icons (crossed road, empty cart, bridge with two wagons,
full crate, hourglass, missing good = good icon with a stroke-through).

## Diegetic HUD (what lives in the scene, not in corners)

- **Contract** = a waybill (list przewozowy) pinned top-left: two lines with ticks, plus the
  wax seal that fills as the contract completes. Collapses to the seal alone.
- **Stall** = a small parchment speech-bubble with the reason icon above the building.
- **ETA** = small ochre label beside the selected wagon / wagons on hover-tap.
- Coins and day time: one compact line on the tool rail, not a corner dashboard.

## Main menu

A live scene: the valley at dawn, a loaded wagon crossing the bridge, camera slowly drifting.
Left-aligned short list (Continue · Contract · Sandbox · Settings) set in Grenze Gotisch on a
narrow strip of parchment, not a centered panel over a photo. Title "Marchia" in large
textura; subtitle "Szlaki Królestwa" in small caps Alegreya Sans.

## Words

Short, concrete, period-flavoured but plain: "Brak mąki — młyn nie ma zboża", not
"Error: insufficient resources". No "Welcome!", no "Get started".
