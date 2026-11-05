// Research day 9g (docs/research/2026-11-05-more-wagons-slower.md): what does ONE extra wagon do?
// Runs the "reasonable player" (eye-N of balance-night6) with and without extra wagons bought at given
// seconds and reports, per run: result, wagon-time by activity (empty run to pickup, loaded, bridge queue,
// idle), loads (partial vs full), and the job list around the purchase.
//   npx tsx tools/wagon-probe.ts m10 60 240        # eye-60 in X, extra wagon at 4:00
//   npx tsx tools/wagon-probe.ts m1 60 330,390     # two extra wagons in I
//   JOBS=1 prints every job assigned after the first purchase.
import { TICK_HZ, applyCommand, buildingById, capacityOf, stars, type World } from '../src/sim/index';
import { eyePlayer, probe, run, stableOf } from './balance-night6';

interface JobRec { t: number; wagon: number; good: string; qty: number; loaded: number; cap: number; from: string; to: string; done: number }
interface Probe {
  /** wagon-ticks by activity */
  act: Record<string, number>;
  jobs: JobRec[];
  /** castle stock per good at the end of each minute */
  pickupWait: number;
  /** extra purchases that went through */
  bought: number;
  jamTicks: number;
}

const name = (w: World, id: number): string => { const b = buildingById(w, id); return b ? `${b.type}#${id}` : `?${id}`; };

export function probeRun(mission: string, react: number, extra: number[]): { row: ReturnType<typeof run>; p: Probe } {
  const p: Probe = { act: {}, jobs: [], pickupWait: 0, jamTicks: 0, bought: 0 };
  const open = new Map<number, JobRec>(); // job id -> record
  probe.onTick = (w) => {
    const t = w.state.tick;
    for (const wg of w.state.wagons) {
      const s = wg.status.k;
      const loaded = wg.cargoQty > 0;
      let k: string;
      if (s === 'BRIDGE_JAM') k = loaded ? 'jam-loaded' : 'jam-empty';
      else if (s === 'TO_PICKUP') k = 'empty-to-pickup';
      else if (s === 'IDLE' || s === 'RETURNING') k = wg.job ? 'empty-to-pickup' : 'idle';
      else if (s === 'TO_DROPOFF') k = 'loaded';
      else k = s.toLowerCase();
      p.act[k] = (p.act[k] ?? 0) + 1;
      const j = wg.job;
      if (j && !open.has(j.id)) {
        const r: JobRec = { t, wagon: wg.n, good: j.good, qty: j.qty, loaded: -1, cap: capacityOf(j.good), from: name(w, j.from), to: name(w, j.to), done: -1 };
        open.set(j.id, r);
        p.jobs.push(r);
      }
      if (j && j.phase === 'dropoff') { const r = open.get(j.id); if (r && r.loaded < 0) r.loaded = j.qty; }
    }
    for (const [id, r] of open) {
      if (!w.state.wagons.some((x) => x.job?.id === id)) { r.done = t; open.delete(id); }
    }
    for (const b of w.state.buildings) if (b.status.k === 'WAITING_PICKUP') p.pickupWait++;
  };
  const a: Record<string, number> = {}, seen: Record<string, number> = {};
  const eye = eyePlayer(react, false, a, seen);
  const player = (w: World): void => {
    eye(w);
    for (const s of extra) if (w.state.tick === s * TICK_HZ && applyCommand(w, { t: 'buyWagon', stable: stableOf(w) }).ok) p.bought++;
  };
  const row = run(mission, `eye-${react}+${extra.join(',')}`, player, a, seen);
  probe.onTick = null;
  return { row, p };
}

const sec = (ticks: number): string => (ticks / TICK_HZ).toFixed(0);
const mmss = (ticks: number): string => { const s = Math.round(ticks / TICK_HZ); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function summarize(label: string, r: { row: ReturnType<typeof run>; p: Probe }, from = 0): string {
  const { row, p } = r;
  const after = p.jobs.filter((j) => j.t >= from);
  const partial = after.filter((j) => j.loaded >= 0 && j.loaded < j.cap).length;
  const units = after.reduce((s, j) => s + Math.max(0, j.loaded), 0);
  const acts = Object.entries(p.act).sort().map(([k, v]) => `${k} ${sec(v)}`).join(', ');
  return `${label.padEnd(22)} ${row.result} ${row.minutes.toFixed(2)} min ★${row.seals} wagons ${row.wagons} | jobs≥${mmss(from)} ${after.length} (partial ${partial}, units ${units}, u/job ${(units / Math.max(1, after.length)).toFixed(2)}) | pickup-wait ${sec(p.pickupWait)} b·s\n    wagon-s: ${acts}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mission = 'm10', react = '60', at = '240'] = process.argv.slice(2);
  const extra = at === '-' ? [] : at.split(',').map(Number);
  const base = probeRun(mission, Number(react), []);
  const ext = probeRun(mission, Number(react), extra);
  const from = Math.min(...extra) * TICK_HZ;
  console.log(summarize('base', base, from));
  console.log(summarize(`+wagon@${extra.join(',')}s`, ext, from));
  if (process.env.JOBS) {
    for (const [lbl, r] of [['base', base], ['extra', ext]] as const) {
      console.log(`-- jobs ${lbl}`);
      for (const j of r.p.jobs) if (j.t >= from - 30 * TICK_HZ) console.log(`  ${mmss(j.t)} W${j.wagon} ${j.good} ${j.loaded}/${j.qty}/${j.cap} ${j.from} -> ${j.to} done ${j.done < 0 ? '-' : mmss(j.done)} (${sec(j.done - j.t)} s)`);
    }
  }
  void stars;
}
