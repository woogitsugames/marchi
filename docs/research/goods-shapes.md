# Goods: told apart by shape without colour (order 81)

Date: 2026-11-07 · branch `claude/w-rtlui` · Claude, taking over GPT order `docs/orders/gpt6-13/81-goods-shape-audit.md`.
CLAUDE.md requires goods icons that can be told apart by **shape**. This audit checks the ten goods (wood, planks,
grain, flour, bread, fish, stone, charcoal, malt, beer) in two places: the UI icons (`src/ui/icons.ts`) and the loads
drawn on wagons (`src/render/models/cargo.ts`). Both were checked with colour removed.

Note: `npm run icons:check` (`tools/check-icons.mjs`) checks the **app launcher** icons (Android/iOS sizes, safe
zone), not the goods. The goods sheet comes from a new script, `tools/goods-shapes.mts`.

## Method

- **Icons:** `npx tsx tools/goods-shapes.mts <dir>` writes an HTML sheet of the ten goods. The sheet shows them at 16,
  18, 24 and 48 px, struck through at 18 px (the "missing" variant), and light on dark at 18 and 24 px (HUD chips). It
  is rendered with `filter: grayscale(1)`. The script also scores every pair of 18 px silhouettes: ink-mask IoU, and
  the mean difference on a 6×6 grid (the coarse shape). Then the sheet was blurred (σ 2.2 px at 2× scale) to
  imitate a glance at a phone.
- **Cargo:** `tools/model-preview.html` has two new views, `cargoBase` and `cargoChain`. They show full loads from
  above, at about the pitch of the game camera. Shots at 1400×900 @2×, converted to grayscale with sharp.
- **In-game scale:** wagon and why-sheet shots at 412×915 (`docs/shots/gpt-rtl-ar-wagon-412x915.jpg`,
  `rtlui-*-pl.jpg`).

Shots:
- `docs/shots/goods-shapes-icons-gray.jpg`
- `goods-shapes-icons-blur.jpg`
- `goods-shapes-cargo-{base,chain}-{gray,color}.jpg`
- `goods-shapes-cargo-round-gray.jpg` (grain, flour, bread, fish, charcoal and malt cropped side by side, grayscale)

## Icons: no confusable pair

The icons are drawn in one ink colour (`currentColor`), so colour never told them apart: shape is their only
identity. Each icon has its own outline, and that outline survives at 16 px and under blur:

| good | silhouette |
|---|---|
| wood | horizontal log, end rings |
| planks | three stepped boards |
| grain | open sheaf (fan on a tied stem) |
| flour | tall sack with a crown knot |
| bread | low dome with slashes |
| fish | fish with a forked tail |
| stone | cube in perspective with a chip |
| charcoal | pyramid of lumps |
| malt | low heap with a shovel handle |
| beer | tankard with handle and foam |

Most similar pairs by score:

| pair | IoU | coarse diff | judgement |
|---|---|---|---|
| flour – stone | 0.63 | 0.117 | both compact blobs. The sack's crown knot and the cube's corner and chip separate them at 16 px. |
| flour – bread | 0.60 | 0.119 | tall sack vs low wide dome: the proportions differ. |
| bread – stone | 0.60 | 0.116 | dome vs cube. |
| wood – stone | 0.58 | 0.130 | **weakest pair** at 16 px: two dense blocks of similar size. Still separable: the log is wider than tall and has a round end; the cube has a slanted top. |
| charcoal – malt | 0.41 | 0.147 | both triangles. Charcoal is a stepped pyramid of blocks; malt is a flat heap with a handle sticking out. |

IoU flags compact shapes that overlap, but people tell icons apart by outline features. Under blur, all ten stay
distinct (`goods-shapes-icons-blur.jpg`), and so do the struck and dark variants. **No change to `icons.ts`.**
Redrawing the weakest pair (wood/stone) would not clearly improve it. It would also cost the familiar log and block
that the build tools and the stock rows already use.

## Cargo on wagons: one pair is weak in grayscale

| load | what stays without colour |
|---|---|
| wood | long logs overhanging the tailboard: unique length |
| planks | one flat, pale, long slab: unique |
| grain | six upright sacks with tied necks: tall, pear-shaped |
| flour | flat square pillows, two layers: the only flat rectangles |
| bread | six round baskets with lumpy loaves |
| fish | tall creels with tails sticking out |
| stone | four low blocks, the wagon half empty: unique count |
| charcoal | six dark open sacks: the darkest load (a value difference, so it holds in grayscale) |
| malt | six round tubs with a smooth pale dome and dark hoops (D-201) |
| beer | barrels lying lengthwise: unique |

**Bread – malt is the one confusable pair without colour** (`goods-shapes-cargo-round-gray.jpg`, 3rd and 6th crop).
Both are six round open containers in the same 2×3 grid with a pale filling. In colour the ochre loaves and the amber
malt on dark staves still differ in hue, but in grayscale only small details remain: the malt's smooth dome, its two
dark hoops and a slightly lighter top. Grain is not part of this: its upright sacks read clearly.

How much this matters in play: at the default zoom a wagon is about 25 px long on a 412 px phone
(`gpt-rtl-ar-wagon-412x915.jpg`). The load is a few pixels, and the good is named by the ETA tag's icon over the
wagon and by the wagon sheet. Those icons are the shapes above, and none of them is confusable. The loads matter only
when the player zooms in.

**Proposal (not implemented):** give bread an **oblong** wicker basket, scaled about 1 : 1.6 along the bed, three in a
row per side as long trays with two or three loaves each. Bread would then be the one load of long ovals, against
malt's round tubs and grain's upright sacks. Alternative: put malt in fewer, bigger tubs (two rows of two). That keeps
bread as is but changes malt's unit count against the sim's qty 1..6 slots.

Not done here because:
- it is a render change, not an icon;
- the model catalogue is baked at build time (D-331/D-332), so a new load means a re-bake and its check;
- the art direction of the loads (ART_DIRECTION §2, D-29, D-201) is the art owner's call.

BACKLOG entry P3 added.

Stale comment found: the header of `src/render/models/cargo.ts` still describes malt as "small pale tied bags lying
in pairs". Since D-201 malt is a tub, as the code below that header draws it. The comment was fixed with this audit.

## Follow-up 2026-11-08 (D-352, branch `claude/w-bread`)

The oblong-basket proposal is built and waits for the owner's yes: long oval wicker trays (~1 : 1.6 along the bed),
three long loaves each, fixed heading along the bed. Grayscale comparison old bread / new bread / malt:
`docs/shots/bread-cargo-compare-gray.jpg`; in game at 412×915: `bread-game-crop-412x915.jpg`. Pixel checks in
`docs/research/bread-diff.txt`.
