# Performance

## Simulation (headless, Node 22, container CPU)

`npm run perf:sim` — stress scenario `tools/bench.ts`: mission valley + 21 consumer buildings fed
from 15 stocked granaries across the river, two wooden one-lane bridges (deliberately overloaded),
1 minute warm-up, then 3 minutes measured (1800 ticks at 10 Hz).

| wagons | avg ms/tick | p99 ms | max ms | ms/frame at ×4 (60 fps) | moving | heap Δ MB | save KB | invariant errors |
|---|---|---|---|---|---|---|---|---|
| 50 | 0.250 | 2.05–2.35 | 5.53 | 0.17 | 45 | ±1 | 62 | 0 |
| 100 | 0.120 | 1.18–1.38 | 4.32 | 0.08 | 95 | ±3 | 85 | 0 |
| 200 | 0.085 | 0.87–0.88 | 3.16 | 0.06 | 109 | ±2 | 108 | 0 |

Measured 2026-11-01 on `claude/s2-integration` (missions IV–VI, STATE_VERSION 3, save gate, replay),
three runs, ranges shown where they differ. Previous table (before D-13 queue-aware routing landed in
the measurement): 50 → p99 4.62, 100 → 1.65, 200 → 1.20 ms.

**Dispatch spreading (brief 03, task B): not needed.** The trigger was p99 > 1.5 ms at 200 wagons; it is
0.87 ms. With many wagons most are busy, so each dispatch matches few demands. The worst p99 is now at
**50 wagons (≈ 2.2 ms)**: many free wagons mean more Dijkstra runs per dispatch tick. If the device
benchmark confirms that case is a problem on phones (×3–5 → ~7–11 ms on a dispatch tick), spread
demands over the 5 ticks of a dispatch interval, or cache DistMaps per network version between dispatches.
\* first run in the process includes JIT warm-up.

Notes:
- Spikes come from dispatch ticks (every 5 ticks): Dijkstra per source building. Edge masks and
  cost tables are precomputed per network version and (loaded, rain) variant.
- Expect 3–5× slower on a mid-range Android CPU: ~0.5 ms average per tick, p99 ~5 ms. At ×4 that is
  ~2 ms per frame average. Further headroom if needed: incremental dispatch (spread sources over
  ticks), A* with landmarks for wagon re-plans, typed-array state for wagons.
- Save size stays ~100 KB at 200 wagons (JSON).

## Rendering

See the section below (filled after the three.js view lands).
