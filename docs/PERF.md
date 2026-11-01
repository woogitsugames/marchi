# Performance

## Simulation (headless, Node 22, container CPU)

`npm run perf:sim` — stress scenario `tools/bench.ts`: mission valley + 21 consumer buildings fed
from 15 stocked granaries across the river, two wooden one-lane bridges (deliberately overloaded),
1 minute warm-up, then 3 minutes measured (1800 ticks at 10 Hz).

| wagons | avg ms/tick | p99 ms | max ms | ms/frame at ×4 (60 fps) | moving | heap Δ MB | save KB | invariant errors |
|---|---|---|---|---|---|---|---|---|
| 50 | 0.330 | 4.62 | 51.77* | 0.22 | 40 | 0.8 | 63 | 0 |
| 100 | 0.133 | 1.65 | 6.93 | 0.09 | 48 | -0.4 | 85 | 0 |
| 200 | 0.122 | 1.20 | 5.97 | 0.08 | 74 | 3.4 | 114 | 0 |

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
