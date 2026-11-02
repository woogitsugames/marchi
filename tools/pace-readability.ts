// F3 / F10 measurement (docs/research/2026-11-02-seasons-m7-9.md, D-38). npx tsx tools/pace-readability.ts
// F10: in mission VII, how often the waybill forecast (contractForecast over a UI-style pace log)
// names the seals the bot strategy really earns, and how far its finish time is off.
// F3: in mission IX, the share of time the lesson (one wood supply, two kinds of customer) is on a
// consumer's card — before: the sim's CONTESTED status only; after: CONTESTED or sharedInput().
import {
  TICK_HZ, applyCommand, contractForecast, createWorld, hashState, newPaceLog, samplePace, sharedInput, stars, step,
} from '../src/sim/index';
import { STRATEGIES, withProposal, type Strategy } from './bot-missions-7-9';

export interface ForecastRun {
  strategy: string; endMin: number; seals: number; samples: number;
  /** Samples whose forecast seals equal the real outcome (all / from 2 min after the action). */
  sealsRight: number; sealsRightSettled: number; settled: number;
  falseLate: number; medianErrSec: number; p90ErrSec: number; hash: string;
}

function drive(id: 'm7' | 'm9', s: Strategy, onTick: (w: ReturnType<typeof createWorld>) => void): ReturnType<typeof createWorld> {
  const w = createWorld(id);
  let done = false;
  while (w.state.mission.result === 'running') {
    if (!done && w.state.tick >= s.after * TICK_HZ) { for (const c of s.cmds(w)) applyCommand(w, c); done = true; }
    if (w.state.tick > 25 * 60 * TICK_HZ) throw new Error(id + ': mission did not end');
    step(w); // the same order as the app: the step, then the UI reads
    onTick(w);
  }
  return w;
}

export function forecastRun(id: 'm7' | 'm9', s: Strategy, read = true): ForecastRun {
  return withProposal(id, () => {
    const log = newPaceLog();
    const preds: { t: number; f: number; s: number }[] = [];
    const w = drive(id, s, (w) => {
      if (!read) return;
      samplePace(log, w);
      if (w.state.tick % (10 * TICK_HZ) !== 0) return;
      const f = contractForecast(w, log);
      if (f && f.ready) preds.push({ t: w.state.tick, f: f.finishTick, s: f.seals });
    });
    const end = w.state.mission.endTick, seals = stars(w);
    const errs = preds.map((p) => Math.abs(p.f - end) / TICK_HZ).sort((a, b) => a - b);
    const settleTick = (s.after + 120) * TICK_HZ;
    const settled = preds.filter((p) => p.t >= settleTick);
    return {
      strategy: s.name, endMin: end / (60 * TICK_HZ), seals, samples: preds.length,
      sealsRight: preds.filter((p) => p.s === seals).length,
      sealsRightSettled: settled.filter((p) => p.s === seals).length, settled: settled.length,
      falseLate: preds.filter((p) => p.s === 0).length * (seals > 0 ? 1 : 0),
      medianErrSec: errs[errs.length >> 1] ?? -1, p90ErrSec: errs[Math.floor(errs.length * 0.9)] ?? -1,
      hash: hashState(w.state),
    };
  });
}

export interface SharedRun {
  strategy: string; seconds: number;
  /** Seconds in which at least one wood consumer's card shows the lesson. */
  anyBefore: number; anyAfter: number;
  /** Consumer-seconds while not WORKING, and how many of them show it. */
  idle: number; idleBefore: number; idleAfter: number;
  /** Samples whose rival is a consumer of the same kind or not a wood consumer (must stay 0). */
  wrongRival: number;
}

export function sharedRun(s: Strategy): SharedRun {
  return withProposal('m9', () => {
    let ticks = 0, anyB = 0, anyA = 0, idle = 0, idleB = 0, idleA = 0, wrong = 0;
    drive('m9', s, (w) => {
      ticks++;
      let a = false, b = false;
      for (const x of w.state.buildings) {
        if (x.type !== 'sawmill' && x.type !== 'charcoalBurner') continue;
        const con = x.status.k === 'NO_INPUT' && x.status.cause === 'CONTESTED';
        const sh = sharedInput(w, x.id);
        if (sh) {
          const r = w.state.buildings.find((o) => o.id === sh.rival);
          if (!r || r.type === x.type || (r.type !== 'sawmill' && r.type !== 'charcoalBurner')) wrong++;
        }
        const shows = con || !!sh;
        if (x.status.k !== 'WORKING') { idle++; if (con) idleB++; if (shows) idleA++; }
        a ||= con; b ||= shows;
      }
      if (a) anyB++;
      if (b) anyA++;
    });
    const sec = (n: number): number => n / TICK_HZ;
    return { strategy: s.name, seconds: sec(ticks), anyBefore: sec(anyB), anyAfter: sec(anyA), idle: sec(idle), idleBefore: sec(idleB), idleAfter: sec(idleA), wrongRival: wrong };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pct = (n: number, d: number): string => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
  for (const id of ['m7', 'm9'] as const) {
    for (const s of STRATEGIES[id]) {
      const r = forecastRun(id, s);
      console.log(`F10 ${id} | ${r.strategy.padEnd(44)} | end ${r.endMin.toFixed(2)} min, seals ${r.seals} | forecast seals right ${pct(r.sealsRight, r.samples)} (${r.samples} samples), settled ${pct(r.sealsRightSettled, r.settled)} | false late ${r.falseLate} | |err| median ${r.medianErrSec.toFixed(0)} s, p90 ${r.p90ErrSec.toFixed(0)} s`);
    }
  }
  for (const s of STRATEGIES.m9) {
    const r = sharedRun(s);
    console.log(`F3 m9 | ${r.strategy.padEnd(44)} | ${r.seconds.toFixed(0)} s | lesson visible (any consumer): before ${r.anyBefore.toFixed(0)} s = ${pct(r.anyBefore, r.seconds)}, after ${r.anyAfter.toFixed(0)} s = ${pct(r.anyAfter, r.seconds)} | consumer not-working ${r.idle.toFixed(0)} s: before ${pct(r.idleBefore, r.idle)}, after ${pct(r.idleAfter, r.idle)} | wrong rival ${r.wrongRival}`);
  }
}
