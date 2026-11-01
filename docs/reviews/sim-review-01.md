# Simulation review 01 — fuzzing + code review of `src/sim`

Date: 2026-11-01 · Base: `claude/eager-cori-08wt8e` @ `b209db4` (D-13 queue-aware routing) ·
Branch: `claude/sim-fuzz-review`

Scope: reservations (`reservedOut` / `incoming`) when buildings or roads are demolished in every
phase of a job, one-lane bridges (deadlock, starvation), dispatch cost (p99), cross-engine
determinism (forbidden math, iteration order, hidden state).

## How it was checked

| Tool | What it does |
|---|---|
| `tools/fuzz-lib.ts` | Seeded command generator (road dirt/cobble, diagonal river crossings, demolish road / bridge / building, buyWagon, place with the gate on a road) drawing from the live state; replay; checks; delta-debugging shrinker. |
| `tests/fuzz.test.ts` (in `npm test`) | 12 seeded scenarios × 3000 ticks on `m1` / `sandbox`, rerun for determinism, save/load clone side by side; 8 property tests: demolish the job source / destination while the wagon is `TO_PICKUP`, `LOADING`, `TO_DROPOFF`, `UNLOADING`. |
| `tools/fuzz.ts` (`npm run fuzz -- --runs 500`) | Long mode. Options: `--ticks`, `--seed`, `--save` (writes shrunk cases to `tests/regressions/`), `--timing` (step p50/p99), `--no-stalls`. |
| `tests/regressions/*.json` + `tests/regressions.test.ts` | Shrunk cases. `status: fixed` → replayed by `npm test`; `known-failing` → replayed by `npm run test:known-failing`. |
| `tests/known-failing/` | Tests that assert the intended behaviour of open bugs (fail while the bug is open). Runner exits 0 and reports `open=N nowPassing=M`. |
| `tests/determinism-reads.test.ts` | Regression for F-02 (in `npm test`). |

Checks after **every tick**: `checkInvariants()` (conservation + reservations == jobs), `unexplainedStalls()`,
no NaN/Infinity/undefined in wagons and buildings (whole state every 100 ticks — `JSON.stringify`
would silently turn NaN into `null`, so the walker inspects numbers directly), stuck wagons
(a wagon **with a job** whose position + status + job did not change for 5 sim-minutes; `NO_ROUTE` counts
only when a BFS over `hasEdge` shows the target *is* reachable). A save/load clone
(`deserialize(serialize())` at a random tick) runs side by side and gets UI-style `wagonEta()` reads
between ticks; hashes are compared every 250 ticks. Each scenario is replayed from scratch and the
final hash compared.

### Volume

| Run | Scenarios | Ticks / scenario | Simulated ticks (main + rerun + save/load clone) | Commands applied / rejected | Failures |
|---|---|---|---|---|---|
| `npx tsx tools/fuzz.ts --runs 500 --ticks 9000 --seed 1000 --timing` | 500 | 9000 (15 sim-min) | **11 219 387** | 7801 / 4310 | 6 × `stuck` (all F-01) |
| development runs (seeds 1–100, 3000–4000 ticks) | 100 | 3000–4000 | ~0.9 M | ~1500 / ~800 | 12 × `stall` (F-04, before the 5-tick grace) |
| `npm test` (`tests/fuzz.test.ts`) | 12 | 3000 | ~90 k | — | 0 |

All 6 long-run failures (seeds 1055, 1309, 1337, 1376, 1470, 1473) are the F-01 bridge deadlock; with the
proposed one-line fix applied locally all 6 run clean (incl. rerun + save/load). No invariant, NaN,
save/load or rerun divergence was found in 11.2 M ticks. Up to 18 wagons per scenario (random
`buyWagon`); high wagon counts are covered by the stress/perf benches below.
Step timing in the long run (random networks, ≤18 wagons, machine shared with other jobs): non-dispatch
tick p50 0.002 ms / p99 0.054 ms; dispatch tick p50 0.079 ms / p99 0.437 ms (max 67 ms = GC / scheduler
outlier).

## Findings

Severity: **critical** = breaks a pillar (deadlock, desync), **medium** = wrong data shown to the player or
avoidable cost, **low** = edge case / cosmetic.

### F-01 — Diagonal river crossing deadlocks permanently (critical, open)

- **Where:** `src/sim/network.ts:60` (span flood fill is 4-connected) together with
  `src/sim/wagons.ts:116` (`bridgeFrom` set when moving span → span) and `src/sim/wagons.ts:150-154`
  (wagons standing on a span count as "on it", opposing when `bridgeFrom !== w.at`).
- **Scenario:** any road drawn across the river at an angle (`lineCells` makes diagonal steps)
  produces water cells that touch only diagonally, so each becomes its **own** one-lane span. Wagon A
  heading south stands on span S1 and wants to enter S2; wagon B heading north stands on S2 and wants
  S1. Each is "opposing traffic on the span" for the other → both `BRIDGE_JAM` forever, the queue
  behind them grows, the crossing is dead. Queue-aware rerouting does not help when no other bridge
  exists.
- **Reproduction:** found independently by the fuzzer (seed 1055, shrunk to 3 commands:
  a diagonal crossing, a mill, one wagon) — `tests/regressions/stuck-fuzz-1055.json`; hand-built case
  `tests/regressions/stuck-diagonal-bridge.json` (polyline `[30,24]→[30,30]→[25,35]→[25,44]` on m1,
  8 extra wagons, deadlock at tick ~7500). Both in `npm run test:known-failing`.
- **Proposed fix (verified locally, not committed):** flood-fill spans over the 8-neighbourhood —
  `network.ts:60` `d < 4` → `d < 8`. With it both regressions pass and `npm test` stays green
  (stress max bridge wait unchanged, 52 s). Side effect: two separate wooden bridges that touch
  diagonally share one lane controller (acceptable, conservative). Alternative: keep spans, but
  make `bridgeBlocker` treat a chain of diagonally connected spans as one (more code).
  Not applied here because it changes bridge semantics in a file another session is editing.

### F-02 — UI reads between ticks change the simulation (critical, **fixed** in this branch)

- **Where:** `src/sim/network.ts:114-129` — `spanPenalties()` caches per `(tick, netVersion)` in
  `world.queue`. `wagonEta()` (called by `src/ui/markers.ts:97` every frame and `src/ui/panels.ts:138`)
  → `findPath` → `dijkstra` → `spanPenalties()` computed the cache from the *pre-step* state, and
  the next `step()` reused it instead of the state at its first path search.
- **Scenario:** a session with the UI open and a headless replay of the same commands (or the same
  save loaded later) diverge. Reproduced with `benchWorld(120)`: hashes split at tick 1577.
- **Fix:** `src/sim/sim.ts:44` `world.queue = null;` at the start of `step()` (separate commit with
  regression `tests/determinism-reads.test.ts`, which fails without the line). The fuzzer's
  save/load clone now also gets `wagonEta()` reads between ticks.
- **Follow-up suggestion:** derived caches inside `World` that depend on more than `netVersion`
  should be invalidated by `step()` itself, never lazily keyed by tick.

### F-03 — Stranded cargo: "stalled for" timer reset every tick + 2 full path searches per tick (medium, open)

- **Where:** `src/sim/wagons.ts:293-294` (`repairJob`, branch "destination gone, no alternative")
  sets `status = NO_ROUTE{since: tick}` **every tick**; `src/sim/wagons.ts:90-95` (`strandedCargo`)
  then sees `(tick - since) % 50 === 0` every tick and runs `alternativeDestination` again.
- **Scenario:** demolish the warehouse, then demolish the bakery while a wagon carries flour to it.
  The wagon waits with `NO_ROUTE{target:-1}` — correct — but the panel (`src/ui/panels.ts:163`) shows
  "stalled for 0:00" forever, and the wagon runs two full-map Dijkstras per tick (`alternativeDestination`
  in `repairJob` and in `strandedCargo`) instead of one per 5 s. With several stranded wagons this is
  the most expensive per-tick path in the sim.
- **Reproduction:** `tests/known-failing/sim-bugs.test.ts` ("[F-03] …"): `since` moves from 1461 to 1761
  in 300 ticks.
- **Proposed fix:** in `repairJob`, when `j.to` is already `-1`, return early (let `strandedCargo` own
  the retry), and only set the status when it is not already `NO_ROUTE{target:-1}`:
  `if (j.to === -1) return;` before the `alternativeDestination` call.

### F-04 — Freshly placed producer is `IDLE` without reason for up to 4 ticks (low, open)

- **Where:** `src/sim/commands.ts:185` (new building starts as `IDLE`) + statuses are only computed in
  `dispatch()` (`src/sim/sim.ts:47`, every `DISPATCH_INTERVAL` ticks); `unexplainedStalls()`
  (`src/sim/sim.ts:179`) flags it.
- **Scenario:** place a sawmill (no input) between dispatch ticks → for 1–4 ticks the "why stalled" panel
  says "idle" with no cause. This was the first thing the fuzzer hit (12 of 30 runs).
- **Reproduction:** `tests/regressions/stall-new-producer-idle.json` (1 command, 34 ticks,
  `placeGraceTicks: 0`). The main fuzz tolerates 5 ticks after a `place` so it can find deeper bugs.
- **Proposed fix:** initialise a producer with `{k:'NO_INPUT', good, cause:'NONE_AVAILABLE', blockedBy:-1}`
  (or `NO_ROAD` when the gate has no edge) in `place()`, or run `diagnose()` for buildings whose status
  is the placeholder at the end of `step()`.

### F-05 — Lane direction is the entry *cell*, not the bank (low, open, from reading)

- **Where:** `src/sim/wagons.ts:154` `o.bridgeFrom !== w.at`.
- **Scenario:** a two-cell-wide wooden bridge, or a road that reaches the bridgehead from two cells on
  the same bank: two wagons going the same way but entering from neighbouring bank cells count as
  opposing; the empty-bridge rival rule (`o.at !== w.at`) also treats them as rivals. Throughput drops,
  no deadlock (wagons never wait for the span they are on).
- **Proposed fix:** compare the *bank* — e.g. a per-span side id computed in `net()` (connected land
  component of the bank cell after removing the span) — instead of the node.

### F-06 — Edge validity changes under a moving wagon when a building is placed (low, open, from reading)

- **Where:** `src/sim/commands.ts:159` (`place`) — roads under wagons are protected (`commands.ts:118`), but
  placing a building next to a **diagonal** edge makes that edge invalid (`hasEdge` corner rule) while a
  wagon is halfway along it. The wagon finishes the edge through the building corner (edges are only
  re-validated at nodes, `wagons.ts:51`). Visual only; invariants hold.
- **Proposed fix:** in `place()`, reject (`WAGON_ON_ROAD`) when any wagon's current edge would lose
  validity, or accept it as cosmetic.

### F-07 — A wagon can reverse on a one-lane bridge when it gets a new job mid-span (low, theoretical)

- **Where:** `src/sim/logistics.ts:77` (`free` = no job, not busy — includes empty wagons on a span) +
  `assignJob` (`logistics.ts:63`) resets the path; `bridgeFrom` keeps the original entry.
- **Scenario:** an empty wagon returning over a span gets a pickup behind it and turns around; it
  still counts as travelling in its original direction. Not observed in
  `benchWorld(40)` / m1 runs (0 reversals counted), so listed only for completeness.
- **Proposed fix:** skip wagons with `bridgeFrom >= 0` in `isFree` for dispatch (they are free again
  a few seconds later).

### F-08 — Dispatch cost (info)

Measured on this container (desktop CPU, other processes running), `benchWorld(N)`, 3000 ticks after warm-up:

| wagons | dispatch tick p50 | p99 | max | other tick p50 | p99 |
|---|---|---|---|---|---|
| 50 | 1.19 ms | 4.06 ms | 18.9 ms | 0.03 ms | 0.21 ms |
| 100 | 0.84 ms | 3.11 ms | 3.8 ms | 0.05 ms | 0.20 ms |
| 200 | 0.10 ms | 2.29 ms | 3.4 ms | 0.05 ms | 0.24 ms |

Fuzz runs (random networks, up to the wagon counts above): see "Volume". Cost is dominated by
one full Dijkstra per distinct source gate (`logistics.ts:125`) and per chosen source; each call
allocates a fresh `Float64Array` + `Int32Array` of `W*H` (`network.ts:232`, ~83 KB) — GC pressure on
mobile. p99 is fine at ×4 today (PERF.md expects 3–5× on mid-range Android → ~10–20 ms p99 on a
dispatch tick, i.e. one dropped frame per dispatch at ×4 in the worst case). Suggestions, in order of
value: (1) reuse dist/prev buffers from a pool inside `DistCache`; (2) fix F-03 (per-tick Dijkstras);
(3) spread demands over the 5 ticks of a dispatch interval.

### Determinism across engines (no findings besides F-02)

- No `Math.sin/cos/exp/pow/atan2/random`, no `Date` in `src/sim` (grep + `tests/purity.test.ts`).
  Only `+ - * /`, `Math.sqrt`, `Math.abs/min/max/floor/round`, `Math.imul`, `Math.SQRT2` (a constant).
- Iteration order: state is arrays only; `Map`s (`DistCache`, `spanPenalties`, invariant counters) are
  insertion-ordered and only used for lookups; `demands.sort` has a total comparator (prio, fill,
  id, good index) and `Array.prototype.sort` is stable in all current engines; heap ties are broken
  by node index. `Object.entries/keys` only over string-keyed literals (insertion order is spec'd).
- Hash: FNV over `JSON.stringify` — number formatting is specified (shortest round-trip), so V8 and
  JavaScriptCore agree.
- Hidden state in `World` outside `SimState`: `cache` (keyed by `netVersion`, pure function of state —
  safe), `scratch` (buffers + stamp; stamp wraps after 2³² searches — negligible), `queue` (F-02, fixed).
- Save/load: fuzz clones at random ticks never diverged (after the F-02 fix, also with UI reads).

### Reservations on demolition (no findings besides F-03)

Covered by the 8 phase tests and the fuzz: demolishing the source in `TO_PICKUP`/`LOADING` (job cancelled,
both reservations released; a loading wagon finishes its busy ticks empty), the destination in any
phase (`repairJob` re-targets to the nearest accepting building, or holds the cargo as `NO_ROUTE{-1}`),
roads/bridges mid-delivery (refused under a wagon; others re-plan at the next node; unloaded jobs
cancel after 20 s). `checkInvariants()` held on every tick, including between the command and the
next tick.

## Open items for the sim session

1. F-01 (critical): apply the 8-neighbourhood span fill (or equivalent) and flip both
   `stuck-*.json` regressions to `status: "fixed"`.
2. F-03 (medium): early return in `repairJob` for `j.to === -1`; move the test from
   `tests/known-failing/sim-bugs.test.ts` into the main suite.
3. F-04 (low): initial producer status; flip `stall-new-producer-idle.json`.
4. F-05..F-07: decide (low).
