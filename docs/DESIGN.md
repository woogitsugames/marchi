# MARCHIA — Szlaki Królestwa · Game design (stage 1)

## Pillar

**A game about diagnosing stalls, not about a pretty settlement.** Goods only exist where they
physically are: in a building's stock or on a wagon. A bakery next to a mill is useless until
flour actually rolls over a road. Every stalled building and every waiting wagon exposes a
*reason* as data; the player reads it with one tap. Target: the player understands why
something is blocked in **under 30 seconds**.

Format: contract missions of 5–12 minutes ("30 planks and 20 loaves to the castle before
winter") plus a sandbox. Short phone sessions. Free with a one-time full-version purchase.
No energy, no wait timers, no pay-to-win.

## World and scale

| Item | Value | Notes |
|---|---|---|
| Grid cell | 4 m × 4 m | roads, buildings, water snap to cells |
| Mission 1 map | 96 × 72 cells (384 × 288 m) | one valley, river crossing it |
| Heightfield | (W+1) × (H+1) corner heights, metres | render refines it, sim reads corners |
| Sim tick | 10 Hz (`TICK_HZ`) | fixed step, sim-seconds = real seconds at ×1 |
| Speeds | pause, ×1, ×2, ×4 | loop runs 0/1/2/4 ticks per 100 ms |

Time is compressed for play: a wagon on a dirt road travels ~3 m/s (a brisk, game-scaled
walk). Day/night: one day = 1440 sim-s (24 min), so a 12-minute contract runs from early morning to dusk.

## Roads

Roads are built cell-by-cell (8-neighbourhood path drawn by drag). Each road cell is a graph
node; adjacent road cells are connected by edges (diagonals only when both orthogonal
neighbours are free of buildings/water so wagons don't cut corners through walls).

| Surface | Cost / cell | Base speed | In rain | Bridge over water |
|---|---|---|---|---|
| Dirt track (grunt) | 1 | 3.0 m/s | ×0.55 (mud) | wooden bridge, **one lane**, 2.4 m/s, 6 / cell |
| Cobbles (bruk) | 4 | 4.2 m/s | ×0.90 | stone bridge, two lanes, 4.0 m/s, 15 / cell |

- **Slope**: grade = Δh / horizontal length. Uphill speed × 1/(1 + k·grade) with k = 6 loaded,
  3 empty; downhill × 1/(1 + 1.5·|grade|) (braking). Segments steeper than **14 %** are rejected
  with a message showing the measured grade.
- **Bridges** are created automatically when a road crosses water. A wooden bridge span
  (connected bridge cells) admits wagons in one direction at a time, max 3 on it. An opposing
  wagon waits at the bridgehead with reason `BRIDGE_JAM` (who blocks it, how long).
- Road usage is counted per cell (decaying counter) → road load overlay.

## Goods and buildings

Goods: **wood (log), planks, grain, flour, bread**. Wagon capacity: 6 units of one good.

| Building | Size | Recipe | Time | Buffers |
|---|---|---|---|---|
| Woodcutter (drwal) | 2×2 | → 1 wood | 12 s | out 8 |
| Sawmill (tartak) | 3×2 | 1 wood → 2 planks | 10 s | in 8, out 12 |
| Farm (farma) | 3×3 | → 1 grain | 9 s | out 8 |
| Mill (młyn) | 2×2 | 1 grain → 1 flour | 7 s | in 8, out 8 |
| Bakery (piekarnia) | 2×2 | 1 flour → 2 bread | 12 s | in 8, out 12 |
| Warehouse (magazyn) | 3×2 | stores any good | — | 60 units total |
| Stable (stajnia) | 3×2 | home of wagons, buy wagon here | — | — |
| Castle (zamek) + order yard | 4×4 | consumes contract goods | — | contract |

Every building has a **gate cell** (entrance) in front of its footprint which is a road node.
A building is connected when its gate is a road node.

## Logistics

1. **Demand**: input buffers below target, the castle for outstanding contract goods,
   warehouses for surplus.
2. **Supply**: output buffers and warehouse stock minus reservations.
3. The dispatcher (every 0.5 s) matches demand to the cheapest reachable supply
   (Dijkstra over travel *time*, including slope, surface and weather), then picks the
   **nearest free wagon** (time to the source), creates a `Job` and **reserves** the cargo at
   the source (`reservedOut`) and the space at the destination (`incoming`).
4. A unit of goods is always in exactly one place: building stock *or* wagon cargo.
   Loading moves it stock → cargo, unloading cargo → stock.
5. Producers push surplus to warehouses before their output buffer fills up.

### Re-routing and cancellations

- Wagons re-plan their path at every node if the network changed (version counter).
- If no path exists, the wagon waits with reason `NO_ROUTE` (target named). After 20 s:
  an unloaded wagon cancels its job (both reservations released); a loaded wagon looks for
  another reachable destination (any demand or warehouse) and otherwise keeps waiting.
- A road cell cannot be demolished while a wagon is physically on it (message says so).

## Stall reasons (data)

Building `status`: `WORKING`, `NO_INPUT{good}`, `WAITING_DELIVERY{good, wagon, eta}`,
`NO_WAGON{good}`, `OUTPUT_FULL{good}`, `NO_ROAD`, `STORAGE_FULL`, `CONTRACT_DONE`.
Wagon `status`: `IDLE`, `TO_PICKUP`, `LOADING`, `TO_DROPOFF`, `UNLOADING`, `RETURNING`,
`BRIDGE_JAM{bridge, blocker}`, `NO_ROUTE{target}`.
Reasons may point to a cause elsewhere (`blockedBy`: building or wagon id) so the
“Why is it stalled?” panel can follow the chain: *bakery → no flour → mill → no grain →
farm cut off: no road.*

## Mission 1 — „Chleb i deski przed zimą” / “Bread and planks before winter”

The castle orders **30 planks and 20 bread**. The valley is split by a river: forest and
sawmill north, fields and mill south, castle on a rise on the south bank. Start: 2 wagons,
120 coins, roads on both banks but no crossing. Wagon costs 30. Deadline: 12 sim-minutes
(the first snow); stars for < 7 and < 9 minutes. Sandbox: same valley, no contract, more coins.

## Player tools (stage 1)

Build road (dirt / cobbles, auto bridge, steepness check), demolish, buy wagon, tap building
→ "Why is it stalled?", tap wagon → cargo / destination / ETA, road load overlay, pause / ×1 / ×2 / ×4.

## Out of scope (until the logistics playtest)

Combat, diplomacy, multiplayer, settler life-sim, building placement economy beyond the
pre-placed map (the sim supports `PlaceBuilding`, UI exposes it later).
