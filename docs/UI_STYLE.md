# MARCHIA · UI visual system

The UI is the **steward's kit**: painted parchment panels in brass fittings, a red heraldic ribbon, wax seals
(D-43; before it, a waybill on flat parchment and an oak rail).
It speaks only when needed, and it is designed for a thumb on a phone in a moving tram.

## Typography (both SIL Open Font License 1.1, bundled via `@fontsource`, latin-ext for Polish)

| Role | Face | Use | Sizes (CSS px ≈ dp) |
|---|---|---|---|
| Headings, mission titles, seal text | **Grenze Gotisch** (600–700) — a readable textura with 14th-century proportions | screen titles, contract name, building names in panels | 22 / 28 / 40 |
| Body, numbers, labels | **Alegreya Sans** (400, 500, 700) — humanist sans with calligraphic roots, excellent small-size legibility, tabular figures | everything else | 13 (min) / 15 / 17 |

- Numerals in panels use `font-variant-numeric: tabular-nums` so ETA counters don't jitter.
- Never set body text in Grenze Gotisch. Never use more than these two faces.
- Licences: see `docs/ASSETS.md` → Fonts. OFL text ships in `public/licenses/`.

## Materials — the painted UI kit (D-43)

Since D-43 every HUD surface is drawn from the painted kit in `public/assets/ui/kit/` (`<name>@2x.png` /
`@3x.png`, slicing in `docs/ui-kit.md`, previews `docs/ui-kit-*.png`). CSS picks the file with
`image-set(… 2x, … 3x)` (plain `url(@2x)` first as a fallback) and stretches it with **9-slice
`border-image`**: slices in **percent of the file** (so @2x and @3x read the same), `border-image-width` in CSS px
= the kit's dp margins, the border itself 0 px wide (padding decides the content inset). Round sprites
(buttons, seals, pins, badges, the alarm seal) are plain `background … / contain`, never stretched.

| Sprite | Where | 9-slice (file %) / width |
|---|---|---|
| `panel` | contract & valley panel, toasts, notices, undo | 15 % 10 % / 12 px |
| `panel-alert` | worst-stall card (wine bar on the leading edge; mirrored in RTL via `::before`) | 15 % 10 % / 12 px |
| `panel-dim` | build shelf | 15 % 10 % / 12 px |
| `ribbon` | contract title, valley rank (Grenze Gotisch, parchment text) | 23.5 % 19.2 % / 8 × 23 px |
| `stat` | time and silver chips, "Pokaż przyciski" | 25 % 10 % / 10 × 12 px |
| `segment-bg` + `segment-active` | speed: pause / ×1 / ×2 / ×4 | 20.45 % 7.5 % / 9 × 12 px — the four cells are sized to the painted dividers (`.speed`, `--m`) |
| `card-normal / pressed / active / highlight / disabled` | tool cards; highlight = the cure of the worst stall, disabled = hatched | 13.9 % 15.6 % / 10 px |
| `eta` (slate) | "M:SS do śniegu" pill, folded-seal time, wagon ETA plaque | 25 % 16.7 % / 10 × 14 px |
| `progress-fill` | the brass fill of a bar per good / per rank requirement (8 px tall, 6 px in landscape) | 25 % 5 % / 2 × 4 px |
| — (CSS groove, D-53) | the bar's track: a groove engraved into the parchment (a shade darker than the paper, dark lip above, light lip below, brass studs at the ends), quarter marks as faint cuts. The kit's slate `progress-track` is not used: empty, it read as a black tube | — |
| `frame-sheet` / `frame-sheet-dim` | all large sheets (why, wagon, market: bright; pause, settings, ledgers, mission save: dim), end letter, rank letter | 16.07 % 11.875 % / 36 × 38 px (30 × 32 on 360 px, 26 × 28 on Flip) |
| `menu`, `button-normal/pressed` | menu button, the eye button on the stall card (woodcut `eye` icon) | — |
| `card-normal / pressed / active / disabled` | every secondary `.btn` in sheets, letters, menus and notes (D-53) | 13.9 % 15.6 % / 10 px |
| `seal-alert` + `badge` | alarm seal with the stall count | — |
| `seal-empty` / `seal-full` | three forecast seals on the contract panel; the folded contract (fills with progress); the seals earned on the end letter and the castle card's pace forecast; the castle's wax inside the top corner of every letter (full = opening / won, empty = lost / dead end), the rank letter and the tutorial note (D-53) | — |
| `pin-red` / `pin-brass` | stall pins on the map: red = the worst stall or a critical one (plus a wine ring round the cause), brass = lesser | — |
| `badge` / `badge-red` | tool cost (Kup wóz 30); red when the silver is short | — |

Content inside sheets keeps clear of the frame's corner ornaments: 18 px frame padding + 8 px body padding, 26 px
at the bottom (letters: 44 px top, 38 px bottom, 30 px sides). Nothing hangs over a frame: seals sit inside it.
No clip-path on kit surfaces (the old chamfers and torn edges stay only on the main menu strip and the primary
button's chamfer). The tutorial note sits on `panel`.

Shadows: a soft `drop-shadow(0 2px 2px rgb(30 22 14 / .35))` under floating kit pieces (the painted edges already
carry the bevel); no glow, no blur haze.

## Colour tokens

Kit palette (muted, from the sprites): `--wine #6f1d22` (ribbon, alert, primary action in sheets, critical) ·
`--slate #3d4852` (snow pill, ETA) · `--brass #a07a3a` / `--brass-dk #6b5128` (rings, icon wells) · parchment of the
panels (`--kparch #ead6ad`). Text: `--ink #2b2620`, `--ink-soft #4d453a`; `--meadow #56603f` for "done".
Older tokens (`--parchment`, `--iron`, `--clay`, `--ochre`) remain for the main menu strip and settings
controls; `--oak` only for the volume groove and the portrait build shelf — no button is oak any more (D-53). Status colours are always paired with an icon shape (never colour alone).

## Grid and spacing

- Base unit **4 px**; spacing scale 4 / 8 / 12 / 16 / 24 / 32.
- Touch targets **≥ 48 px** (CSS px ≈ dp): speed cells 48 tall, contract rows and pace rows 48, ribbon 48,
  tutorial "Pomiń" 48,
  tool cards 72, eye button 52, alarm seal 72 (64 on 360 px). Text never clips: chips grow with their number,
  long names wrap (ribbon, stall card) — six tool cards on a phone use a 12.5 px label.
- Respect `env(safe-area-inset-*)` on every edge-anchored element (`--safe-s/e` are logical, swap in RTL).
- **Layout (concept D, D-43)**: one grid on top (`.hud-top`): menu · chips · speed · contract. Portrait: menu
  left, chips right, speed as a second row right-aligned, contract panel under them. Landscape and wide /
  near-square portraits (≥ 720 px, unfolded Fold): one row — menu, contract, chips, speed. Bottom (`.rail`):
  portrait = worst-stall card + alarm seal above the row of tool cards; landscape / wide = one row, tools under
  one thumb, stall card + alarm seal under the other.
- **Hand, not language** (D-37 amended): the alarm seal and stall card sit on the hand's side (right for a
  right-handed player, in RTL too); left-handed mirrors it, and in portrait mirrors the tool order.
- Sheets open from the bottom in portrait (stopping under the contract panel, at least 45 % of the screen) and
  hide the rail under them; from the side in landscape (below the speed row) and on screens ≥ 720 px.
- **Foldables** (D-16): Flex mode puts the scene in the top half and the whole HUD (top cluster and rail) on the
  table below the hinge; the Flip cover is a watch mode (menu, speed, the folded contract seal that opens the
  castle card, pins; no tools, no stall card).
- Every overlay closes with one gesture: tap on the empty map, swipe down on the sheet, or the
  Android back button. A "clear screen" tap (two-finger tap) hides all UI except the scene.

## Buttons and states

| State | Tool card | Other |
|---|---|---|
| Rest | `card-normal`, ink icon and label | kit button / segment |
| Pressed | `card-pressed`, content shifts down 1 px | `button-pressed`, 1 px shift; no scale bounce |
| Active tool | `card-active`, wine label | active speed cell: `segment-active` |
| Cure of the worst stall | `card-highlight` (Kup wóz for a missing wagon, Droga for a missing road) | — |
| Disabled | `card-disabled` (hatched) + the reason on the card ("brak 4" in place of the label, red cost badge) and in a toast on tap | `card-disabled` at 60 % |
| Focus (keyboard/a11y) | 2 px ochre outline, offset 2 px | same |

Buttons inside sheets, letters, menus and notes (`.btn`, D-53): **primary** = wine wax (`--wine` with a lighter
top, dark wax rim `#3e1013`, parchment text, chamfered), one per surface; **secondary** = the parchment tool card
with its brass edge (`card-normal`, `card-pressed`, selected = `card-active`, disabled = `card-disabled` at 60 %),
ink text. Same in every language and on every screen.

Motion: 100–250 ms, `cubic-bezier(.2,.7,.2,1)` (decelerate). Sheets slide, markers fade.
No springs, no overshoot, no infinite pulsing — a stall pin breathes once on appearance.
Performance: the HUD DOM is built once; per frame only text, widths and classes change when a value changes;
sizes are measured by `ResizeObserver` (rail height, top cluster), never per frame.

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
| Fish | side-on fish, blunt head left, forked tail right, fins and scale arcs |
| Stone | single rough-hewn block in three-quarter view (lit top, chiselled faces) with a chip beside it |
| Charcoal | low heap of angular lumps, each with a white glint cut on one facet |
| Malt | mound of malted grain on a kiln floor with a malt shovel stuck in it |
| Beer | stave tankard with two hoops, a handle and a foam head over the rim |

The five valley goods (D-30) keep one silhouette class each, distinct from the first five: no other good
is a fish, a cube, a scatter of lumps, a mound with a tool, or a vessel. Grain and malt are told apart by
the sheaf's vertical fan versus the malt's low mound and shovel.

Stall reasons have their own icons (crossed road, empty cart, bridge with two wagons,
full crate, hourglass, missing good = good icon with a stroke-through, ice floes against a wooden
bridge, and a forked cart track for a contested input: one fork worn deep with an arrowhead, the other
fading out in dashes to an empty post).

## Diegetic HUD (what lives in the scene, what in the corners)

- **Contract** = a panel under a red ribbon with the mission name: three forecast seals (D-38), the
  "M:SS do śniegu" pill, a bar per good with "n/total", then the pace rows ("Przy tym tempie: gotowe za …",
  the bottleneck's supplier). In landscape (D-53) it is a compact card ≤ 30 % of the width: seals and pill in one
  row, the goods side by side (icon, count, slim bar), the pace in one 48 px row whose supplier part shrinks to
  the good's icon (the words stay for screen readers). Tapping the ribbon folds it to a wax seal that fills with progress, time below.
- **Free valley** = the same panel: rank on the ribbon, the checklist towards the next rank, income and season.
- **Stall** = a kit pin above the building; its cause opens with one tap. The worst stall (largest
  `stalledTicks × criticality`, `src/ui/stalls.ts`) is also named on the bottom card ("NAJGORSZY ZASTÓJ —
  Młyn: wszystkie wozy zajęte"); the eye button (a woodcut eye) jumps the camera there and opens "Dlaczego stoi?", the alarm
  seal cycles through all stalls (badge = count).
- **ETA** = a slate plaque above the selected wagon.
- Time and silver: two chips at the top, each with its own icon (sun/rain, coin).

## Main menu

A live scene: the valley at dawn, a loaded wagon crossing the bridge, camera slowly drifting.
Left-aligned short list (Continue · Contract · Sandbox · Settings) set in Grenze Gotisch on a
narrow strip of parchment, not a centered panel over a photo. Title "Marchia" in large
textura; subtitle "Szlaki Królestwa" in small caps Alegreya Sans.

## Words

Short, concrete, period-flavoured but plain: "Brak mąki — młyn nie ma zboża", not
"Error: insufficient resources". No "Welcome!", no "Get started".
