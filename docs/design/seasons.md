# Seasons in the Free Valley — D-31 proposal

**Status:** deterministic data-only proposal. The new module src/sim/proposals/seasons.ts is NOT imported by the active simulation. This PR does not enable seasons in the live Free Valley or change any contract mission. Integration is specified below.

## 1. Calendar and effects

All times are simulation ticks at TICK_HZ = 10; pausing freezes the calendar. Each season lasts **15 game minutes (9,000 ticks)**, each four-season year **60 minutes (36,000 ticks)**. The cycle starts at tick 0 in spring, then summer, autumn, winter, and repeats. No seeded RNG, wall clock, state field, scheduled asynchronous task or destructive weather event is necessary.

| Season | First-year interval | Effect |
| --- | --- | --- |
| Spring | [0:00, 15:00) | Thaw [4:00, 8:00): land dirt-road speed ×0.55 (same number as rain). Stone roads and both bridge surfaces are unaffected by thaw. |
| Summer | [15:00, 30:00) | Farms produce at 120% of normal throughput. |
| Autumn | [30:00, 45:00) | Fair: **beer** alone receives +25% of its current, saturation-adjusted market price. |
| Winter | [45:00, 60:00) | Farm throughput 60%; fisher throughput 50%. Wooden bridge spans freeze in [48:00, 50:00) and [54:00, 56:00). Stone bridges stay open. |

Intervals are **inclusive start, exclusive end** and repeat every year. A frozen wooden bridge reopens automatically. Ice never destroys roads, buildings, goods, jobs or settlements; winter production stays strictly positive. A thaw window deliberately starts later than game start so the first actions are not slowed.

### Public pure API

- **seasonAt(tick)** → one of spring, summer, autumn, winter.
- **effectsAt(tick)** → immutable-by-convention data describing the current season: farmYieldPercent, fisherYieldPercent, dirtSpeedMultiplier, thawWindow, iceWindows, closedBridgeUntilTick, and optional fair with a single good and pricePercent. Every invocation returns independent values; windows are absolute simulation ticks compatible with SimState.ice.
- **nextChange(tick)** → the strictly next event: kind (season / thaw-start / thaw-end / ice-start / ice-end), atTick, ticksUntil, announceAtTick, announced, season, nextSeason. Unlike a season-only timer, this also forecasts bridge closures and reopening.
- **SEASON_WARNING_TICKS** = 1,200 ticks = 2 game minutes before each change. The UI displays an event only when announced is true, deduplicated by kind and atTick.
- Invalid tick values (negative, fractional, non-finite, unsafe integer or insufficient room for a next season boundary) cause RangeError. Valid results depend solely on tick.

**Production-rate caveat:** the current recipes emit a whole grain/fish item per cycle. The percentages are therefore output **throughput per unit time**, not fractional item counts; do not write fractional goods into stocks. At activation, one deterministic integer-cycle strategy is to use Math.ceil(recipe.ticks * 100 / ratePercent) and keep original per-cycle output, consumption, capacity checks and ledger accounting. Exact long-run percentages are subject to one-tick rounding. Progress never resets on a season boundary; completing one interrupted cycle must not complete it twice.

**Market rounding:** beer gains +25% on its already saturation-adjusted cent price, not on an independent market stock. In the follow-up implementation use Math.floor(baseCents * 125 / 100) **per unit**, including each unit of a multi-item sale; market.cents must continue accumulating fractional silver. All other goods remain unchanged. The fair is a predictable opportunity, not a market mandate.

## 2. Integration locations (not part of this PR)

Enable these effects only when world.state.mission.id is sandbox. Existing contract missions, especially M4 ice, retain their authored rain and ice; no changes to their deterministic golden hashes or time limits.

| File / exact function | Required change in a follow-up PR |
| --- | --- |
| **src/sim/sim.ts — step()** | Sample effectsAt(st.tick) once at the start of a fixed tick, guarded for sandbox only; use the same tick for wagons, production, dispatch and market. Never depend on animation frames or real time. |
| **src/sim/sim.ts — produce()** | Derive farm and fisher recipe-cycle thresholds from farmYieldPercent/fisherYieldPercent, rather than changing recipe output quantities. Do not reset b.progress, produce negative goods or circumvent output-cap checks. Keep ledger.produced and conservation intact. |
| **src/sim/logistics.ts — dispatch()** | The free-valley market already sorts GOODS by descending unitCents(st, good). Once town.ts returns season-adjusted values this sort automatically prioritizes fair beer; do not introduce duplicate pricing, and retain existing upstream demand priority, tie-breaking, reservation semantics and wagon-share limits. |
| **src/sim/logistics.ts — DistCache / upstreamReason() / statusFor()** | Consume correct seasonal costs from network.ts. A producing but slowed supplier remains WAITING_UPSTREAM; no fictitious missing input or route failure. Bridge closure must continue to yield BRIDGE_CLOSED from the wagon path. |
| **src/sim/town.ts — unitCents(), quoteCents(), sellAt(), sandboxStatus()** | Apply the fair to cent prices in one shared helper used for delivery payouts, per-unit quotes, dispatcher sorting and displayed prices. Preserve market.saturation, MARKET.base, cents rollover, ledger.sold and renown. Only sandbox receives the bonus. |
| **src/sim/contract.ts — iceUntil()** | Compose existing state.ice windows with effectsAt(st.tick).closedBridgeUntilTick (use -1 when null) only for sandbox, and widen the state type to include mission. This avoids changing the persisted ice array or save migrations. Do not also materialize seasonal windows into state.ice. |
| **src/sim/wagons.ts — iceBlocks()** | Existing iceUntil(), net(world).span, BRIDGE_CLOSED {span,until,since}, periodic reroute, safe entry/exit and reservation preservation already handle freezing. A wagon on the bridge when ice begins must be allowed to exit. Stone bridges are absent from wooden span IDs. |
| **src/sim/network.ts — cellSpeed(), edgeSpeedAt(), edgeTime(), edgeCosts(), dijkstra(), pathTime()** | Treat thaw as **dirt-land-only**. Do not append a generic rain spell: real rain currently also slows cobble and wooden bridges. Add a separate thaw flag and 8 (loaded × rain × thaw) cost-cache variants, or correct invalidation. If real rain and thaw overlap, apply dirt ×0.55 once, not ×0.55 twice. Actual movement, planned route, ETA and bridge wait estimate must agree. |
| **src/sim/diagnose.ts — wagonSlowdown(), cause chain** | Explain dirt-thaw slowdown as a travel condition (not NO_ROUTE), winter producer slowdown as an upstream modifier, and ice via existing BRIDGE_CLOSED. Do not double-book root stall seconds for a single frozen bridge. |
| **src/i18n/pl.ts, src/i18n/en.ts, UI** | Register keys in both dictionaries below and localize banners from nextChange(tick), only for sandbox. Keep the existing wagon.BRIDGE_CLOSED.in and wagon.iceHint text as the actual frozen-bridge cause. UI reads sim state and never mutates it. |
| **tests/, saves and replay** | On activation add tests for 1×/2×/4× equivalence, cold/warm saves midwinter, cargo and reservations on ice closure, season boundary cycles, fair arithmetic, rain + thaw cache state, checkInvariants(), and no changes to M1–M6 golden hashes. |

**Why compose the ice result instead of editing state.ice?** The current ice state is saved, while both wagon movement and Dijkstra read contract.iceUntil(). A calculated sandbox branch in that helper avoids accumulating obsolete winters, changing the state schema, and stale windows after loading a saved midwinter game. It reuses the wooden span IDs: stone bridges and already-occupied bridge exits remain safe.

## 3. Effect on stall explanations

| Situation | Existing reason/status | Player-facing teaching |
| --- | --- | --- |
| Wagon blocked from entering wooden span during a frost interval | BRIDGE_CLOSED {span,until,since} | The bridge is temporarily icy, not demolished; show exact reopening and the stone-bridge alternative. sim.ts:accountStalls() already aggregates this root per span. |
| Mill, malthouse or brewery waiting for a functioning winter farm | WAITING_UPSTREAM; NO_INPUT only for genuinely unavailable input | The farm is still producing, but slower. The chain should lead to the farm instead of suggesting a new road. WAITING_UPSTREAM remains non-stalling. |
| Wagon moving slower on dirt road during spring thaw | Informational slowdown in diagnose.ts, not NO_ROUTE | Dirt is muddy, cobble is more reliable. A genuinely broken route remains NO_ROUTE. |
| Summer farm output is full and cannot be collected | OUTPUT_FULL or WAITING_PICKUP | Faster farming exposes a genuine buffer/wagon bottleneck; do not hide it with a season label. |
| Autumn market premium | No new stall status | A positive supply-chain optimization, not a forced goal. |

Do not create a new stall status solely because a source has a non-100% rate. Do not close stone bridges, land roads or entire rivers. Every winter closure has a visible automatic end; all effects remain non-destructive.

## 4. Proposed PL/EN announcement copy

Documentation only: register all keys in both translation dictionaries on activation, never in pure simulation strings.

| i18n key | Polish | English |
| --- | --- | --- |
| season.spring | Wiosna | Spring |
| season.summer | Lato | Summer |
| season.autumn | Jesień | Autumn |
| season.winter | Zima | Winter |
| season.notice.season | Za {time} rozpocznie się {season}. | {season} begins in {time}. |
| season.notice.thaw-start | Za {time} roztopy spowolnią gruntowe drogi. | Thaw will slow dirt roads in {time}. |
| season.notice.thaw-end | Za {time} drogi gruntowe obeschną. | Dirt roads will dry in {time}. |
| season.notice.ice-start | Za {time} kra zamknie drewniane mosty. Kamienne pozostaną przejezdne. | Ice will close wooden bridges in {time}. Stone bridges stay open. |
| season.notice.ice-end | Za {time} kra ustąpi i drewniane mosty się otworzą. | Ice will recede and wooden bridges reopen in {time}. |
| season.effect.winter-farm | Zima: gospodarstwa pracują około 40% wolniej. | Winter: farms produce about 40% less. |
| season.effect.winter-fisher | Zima: rybacy pracują około 50% wolniej. | Winter: fishers produce about 50% less. |
| season.effect.summer-farm | Lato: gospodarstwa produkują około 20% więcej. | Summer: farms produce about 20% more. |
| season.effect.autumn-fair | Jesienny jarmark: cena piwa +25%. | Autumn fair: beer sells for 25% more. |
| season.effect.spring-thaw | Roztopy: gruntowe drogi wolniejsze (×0,55). | Thaw: dirt roads slower (×0.55). |

Format {time} from ticksUntil and TICK_HZ with the existing localization machinery. The name passed to {season} must already be localized; no wall-clock countdown. Keep current wagon.BRIDGE_CLOSED.in, wagon.iceHint and cause.BRIDGE_CLOSED translations.

## 5. Original woodcut-style icon descriptions (no assets in this PR)

- **Spring:** three stubby reed shoots piercing cracked dark earth, crossed by a narrow meltwater line. Simple, uneven carved hatching; silhouette distinct from wheat.
- **Summer:** upright wheat sheaf with three heavy ears and a small incised sun disc. Thick engraved contours, no gradients.
- **Autumn:** angular market canopy over a single beer cask with a curled leaf. Readable as a fair, not merely another tree symbol.
- **Winter:** two jagged ice slabs beside a wooden bridge trestle, with an interrupted deck line to communicate a temporary crossing closure.

Match docs/UI_STYLE.md: monochrome first, deliberate negative space, hand-cut texture, restrained colors, legible at 24–32 dp; no emoji, stock clip-art, icon-pack reuse or imitation of existing games. This task requests descriptions only.

## 6. Tests

tests/seasons.test.ts validates season and year boundaries, invalid ticks, throughput rates, thaw half-open interval, two winter ice windows and reopening, exactly one fair good, announcement threshold and ordering, purity and independent return objects across years. Run **npm test -- seasons** and **npm run typecheck** in the complete repository. Integration tests above remain future work because this PR intentionally does not wire the module into the live sim.
