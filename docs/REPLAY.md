# Replay reports ("Copy report")

A replay report is a small, versioned record of one play session: the mission, the seed, every
player command with its tick, and state hashes taken along the way. Anyone with the same build can
re-run it headless (`tools/replay.ts`) and see whether, and from which tick, the simulation diverged.
Code: `src/sim/replay.ts` (pure sim), `src/platform/reportCodec.ts` (clipboard encoding),
`tools/replay.ts` (CLI), tests in `tests/replay.test.ts`. Decision: D-25.

## Format (version 1)

```json
{
  "version": 1,
  "game": "0.1.0",
  "missionId": "m1",
  "seed": 1301,
  "stateVersion": 2,
  "journal": [{ "tick": 0, "cmd": { "t": "road", "cells": [2345, 2441], "surface": 1 } },
              { "tick": 5, "cmd": { "t": "buyWagon", "stable": 3 } }],
  "checkpoints": [{ "tick": 0, "hash": "1a26d2dfd10c9eff" }, { "tick": 600, "hash": "2a00770f5a5ce887" }],
  "finalTick": 5314,
  "finalHash": "08ef6351b0d19e89"
}
```

Ordering, identical to `GameLoop` (`src/game/loop.ts`):

- `journal[i]` was applied when `state.tick === tick`, **before** `step()` for that tick; entries of
  the same tick keep their order. Failed commands are journaled too (they replay to the same failure).
- `checkpoints[i].hash` is `stateHash` right after the step that reached `tick`, before that tick's
  commands (where `GameLoop.onTick` fires). Tick 0 is the freshly created world, so a wrong seed or
  changed mission data shows up at tick 0. Default spacing: 600 ticks (one sim minute).
- `finalHash` is taken when the report is built (`state.tick === finalTick`), including commands
  applied at `finalTick` while paused.

Clipboard form: `MR1.` + base64url(deflate-raw(JSON)), produced by `encodeReportText` when
`CompressionStream` exists; otherwise the plain JSON. `decodeReportText` accepts both.
The bot session on m1 (bridge, 4 wagons, a demolish, mission won at tick 5314, 9 checkpoints) is
892 bytes of JSON and 539 characters compressed (base64url adds a third, so compression pays off
mostly on longer sessions, whose size is dominated by road cell lists).

Limits enforced by `parseReport`: journal and checkpoints at most 50 000 entries each, at most
4096 cells per road command, ticks at most 24 h of sim time, raw text at most 16 MiB, inflated
data at most 16 MiB (zip-bomb guard). Unknown keys anywhere are rejected; parsing never throws.

A report can only be built for a session recorded from tick 0. A session continued from a save has
no journal for the earlier part, so `buildReport` refuses it (see D-25, open item).

## Privacy

- **Allowlist by declaration.** `COMMAND_FIELDS` in `src/sim/replay.ts` declares every field of
  every `Command` variant with a type check (integers in range, enums). Commands are re-serialized
  from that declaration, so a field that is not declared cannot reach the report; `parseReport` also
  rejects undeclared keys. The declaration is a mapped type over `Command`, so adding a command or a
  field fails typecheck until it is declared. There is no free-text field type on purpose.
- **Zero personal data.** The report contains only mission id, seed, state schema version, app
  version (charset `[0-9A-Za-z.+_-]`, otherwise replaced by `unknown`), ticks, integers, enums and hashes.
  No names, save slot names, device model, OS, locale, time stamps or identifiers.
- **No network.** The game never sends the report. The player copies it to the clipboard and decides
  where to paste it (e-mail, forum). There is no telemetry and no upload endpoint.

## Running a report

```bash
npx tsx tools/replay.ts report.json            # plain JSON or MR1.<base64url> text in a file
pbpaste | npx tsx tools/replay.ts -            # from stdin
npx tsx tools/replay.ts report.txt --verbose   # also print every command and its result
```

Output: one `OK` / `MISMATCH` line per checkpoint and for the final hash, then either
`RESULT ok` or the first divergence (tick, expected vs actual hash), the commands applied between the
last matching checkpoint and the divergence, and this build's state at that tick (counts, RNG and
an 8-hex digest per top-level state section, to compare with the reporting build at the same tick).
Exit codes: `0` identical, `1` divergence, `2` invalid or unreplayable report (unknown mission,
different `stateVersion`). A report only replays exactly on the build that recorded it (same
`game` version); after balance or sim changes a divergence is expected.

## UI integration (5 lines)

```ts
const rec = createRecorder(world); loop.onTick = () => recordTick(rec, world);          // at mission start (prev onTick chained)
// pause menu: button t('menu.copyReport') ->
const r = buildReport(rec, loop.journal, world, APP_VERSION); if (!r.ok) return toast(t('report.unavailable'));
const text = await encodeReportText(JSON.stringify(r.value));
await navigator.clipboard.writeText(text).then(() => toast(t('report.copied')), () => toast(t('report.copyFailed')));
```

Proposed i18n keys (not added yet, see D-25): `menu.copyReport` (pl "Skopiuj raport", en "Copy report"),
`report.copied` (pl "Raport skopiowany do schowka", en "Report copied to clipboard"),
`report.copyFailed` (pl "Nie udało się skopiować raportu", en "Could not copy the report"),
`report.unavailable` (pl "Raport dostępny tylko dla misji rozpoczętej od nowa", en "Report is only available for a mission started from the beginning").
