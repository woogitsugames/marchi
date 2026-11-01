# MARCHIA · Art direction

**One sentence:** a damp late-autumn morning in a Central-European border march around
1300–1400 — mud, split timber, thatch, field stone, wet meadows, mist on the river, a low
sun that makes every wagon cast a long shadow.

The world is observed, not decorated. It should look like a place someone walked through
with a sketchbook in November, not a toy diorama.

## Palette (named, with roles)

| Name | Hex | Role |
|---|---|---|
| **Torf** (peat) | `#2b2620` | darkest value: shadows under eaves, UI ink, menu backdrop |
| **Błoto** (mud) | `#5a4a39` | dirt roads, wheel ruts, wet ground, wagon wood when wet |
| **Strzecha** (thatch) | `#9a8058` | roofs, straw, grain sacks, dry stubble fields |
| **Łąka** (wet meadow) | `#56603f` | grass, the dominant mid-value of the terrain |
| **Bór** (pine forest) | `#2f3a2c` | forest masses, distant hills in shadow |
| **Kamień polny** (field stone) | `#8a8478` | stone bridge, castle, cobbles, foundations |
| **Rzeka** (river) | `#4c5b5c` | water body: grey-green, reflecting a pale sky, never blue |
| **Mgła** (mist) | `#c9c6bb` | sky near horizon, fog colour, parchment highlights |
| **Glina** (red clay) | `#8c4a2f` | **the only warm accent**: castle banner, wax seal, selected road, active stall marker |
| **Ochra** (ochre) | `#b8893a` | secondary accent: bread crust, lantern light at dusk, ETA text on wagons |

Rules: terrain lives in the desaturated middle (S < 35 %). Glina and Ochra are reserved for
things that need the player's attention (a seal, a stall, a selection) — if everything is
warm, nothing is. Never pure black or pure white in the scene.

## Season and light

- **Late autumn (listopad)**, morning to early afternoon in mission 1, then dusk.
- Sun low (8–22° elevation), slightly warm (≈ 4 300 K) against a cool overcast sky.
- Long, soft-edged directional shadows. Hemisphere/sky light provides the ambient, plus a
  cheap AO term (baked into vertex colours for terrain and buildings).
- Atmospheric fog (exponential, Mgła colour) — the far side of the valley is half-lost.
  Mist sits lower and denser over the river in the morning.
- Tone mapping **AgX** (fallback ACES), sRGB output, exposure kept slightly under so the
  sky never clips.
- Rain darkens and raises the gloss of dirt (roughness ↓), puddles in ruts, sky goes flat.
  Rain is gameplay: mud slows wagons on dirt tracks.

## Materials

PBR (albedo, normal, roughness) from CC0 sources only (Poly Haven, ambientCG), re-graded to
the palette above so they read as one world. Every file is listed in `docs/ASSETS.md`.
Textures: KTX2/Basis when shipped, ≤ 1k for the terrain splats, atlases for buildings.

## Composition rules

1. **Roads are the drawing.** The road network is the most legible line in the frame: ruts
   are darker and wetter than the meadow, cobbles are lighter. Buildings and trees frame it,
   they never compete with it.
2. **Cargo reads at a glance.** Load on a wagon is drawn at real scale and with a distinct
   silhouette per good (logs = long cylinders, planks = flat stack, grain = round sacks,
   flour = pale square sacks, bread = baskets). From far zoom the silhouette must still
   separate.
3. **Warm marks the problem.** Clay/ochre are only used where the player should look: a
   stall marker over a building, the selected wagon's ETA, the castle's order yard.

## What we do NOT do

- No pastels, no candy saturation, no "toy diorama" tilt-shift, no bloom glow on everything.
- No low-poly faceting, no cel-shading, no outlines, no pixel art.
- No exaggerated proportions (giant mushrooms, chunky doors, bobble-head people).
- No blue water, no green-screen grass, no pure white snow glare.
- No mixing of asset styles: a CC0 asset is re-graded or not used.
- No fantasy elements (magic, dragons, glowing crystals). This is a historical march.
- No HUD decoration over the scene that the scene itself can show (cargo, smoke, queues).
