// Headless trigger-density audit for the audio bindings (no DOM, no WebAudio).
// Drives the real sim with bot strategies (m8-m12 + sandbox DECENT), feeds observeSim() a stub engine
// that mimics AudioEngine.play(): cooldown on the game clock (1x speed), spatial radius cut-off
// (gain = (1-d/r)^2 < 0.008 is dropped). Several camera positions are evaluated in parallel.
//   npx tsx tools/audio-trigger-sim.ts > /tmp/triggers.json
import {
  MISSIONS, TICK_HZ, applyCommand, createWorld, step, stoneAvailable, type World,
} from '../src/sim/index';
import { bindAudioEngine, captureAudioState, observeSim, type SimAudioCamera } from '../src/audio/bindings';
import { SOUNDS, type SoundId } from '../src/audio/sounds';
import { STRATEGIES as S789, withProposal, type Strategy as Strat789 } from './bot-missions-7-9';
import { STRATEGIES as S1012, type Strategy as Strat1012 } from './bot-missions-10-12';
import { DECENT } from './bot-sandbox';
import { sandboxStatus } from '../src/sim/town';

// COOLDOWN=load.sack:0.5,unload.sack:0.5 overrides cooldowns (seconds) to preview a patch.
for (const kv of (process.env.COOLDOWN ?? '').split(',').filter(Boolean)) {
  const [id, v] = kv.split(':');
  (SOUNDS as unknown as Record<string, { cooldown?: number }>)[id!]!.cooldown = Number(v);
}

interface Counter { raw: number; accepted: number; byVariant: Map<string, number> }
class Stub {
  cam: SimAudioCamera = { x: 0, z: 0, mapWidth: 1 };
  now = 0;
  cooldown = new Map<SoundId, number>();
  stats = new Map<SoundId, Counter>();
  setCamera(c: SimAudioCamera): void { this.cam = c; }
  setAmbience(): void {}
  setTraffic(): void {}
  setLoopLevel(): void {}
  async play(id: SoundId, o: { x?: number; z?: number } = {}): Promise<null> {
    const def = SOUNDS[id];
    const s = this.stats.get(id) ?? { raw: 0, accepted: 0, byVariant: new Map() };
    this.stats.set(id, s);
    s.raw++;
    if (this.now - (this.cooldown.get(id) ?? -Infinity) < (def.cooldown ?? 0)) return null;
    if (o.x !== undefined && o.z !== undefined) {
      const d = Math.hypot(o.x - this.cam.x, o.z - this.cam.z);
      const f = Math.max(0, Math.min(1, 1 - d / (('radius' in def ? def.radius : 65) as number)));
      if (f * f < 0.008) return null;
    }
    this.cooldown.set(id, this.now);
    s.accepted++;
    return null;
  }
}

interface Cam { name: string; x: number; z: number }
const typical = (w: World): Cam[] => {
  const sz = w.terrain.cellSize;
  const bs = w.state.buildings;
  const c = (b: { x: number; y: number; w: number; h: number }): Cam => ({ name: '', x: (b.x + b.w / 2) * sz, z: (b.y + b.h / 2) * sz });
  const castle = bs.find((b) => b.type === 'castle') ?? bs[0]!;
  const cx = bs.reduce((a, b) => a + c(b).x, 0) / bs.length, cz = bs.reduce((a, b) => a + c(b).z, 0) / bs.length;
  return [{ ...c(castle), name: 'castle' }, { name: 'centroid', x: cx, z: cz }];
};

interface Row { scenario: string; minutes: number; perId: Record<string, { rawPerMin: number; centroidPerMin: number; castlePerMin: number; worstPerMin: number; x4WorstPerMin: number; variants: Record<string, number> }>; stalls: number }
const rows: Row[] = [];

function run(scenario: string, w: World, maxMin: number, act: (w: World) => void, until: (w: World) => boolean): void {
  const cams = typical(w);
  let prev = captureAudioState(w.state);
  const sz = w.terrain.cellSize;
  // worst case: camera parked on every building in turn (+ the two typical ones)
  const all: Cam[] = [...cams];
  w.state.buildings.forEach((b) => all.push({ name: 'b' + b.id, x: (b.x + b.w / 2) * sz, z: (b.y + b.h / 2) * sz }));
  const engines = all.map(() => new Stub());
  const engines4 = all.map(() => new Stub());
  const variantCount = new Map<string, number>();
  let tick0 = w.state.tick;
  while (!until(w) && w.state.tick - tick0 < maxMin * 60 * TICK_HZ) {
    act(w);
    step(w);
    const t = w.state.tick / TICK_HZ;
    for (let i = 0; i < all.length; i++) {
      for (const [eng, speed] of [[engines[i]!, 1], [engines4[i]!, 4]] as const) {
        eng.now = t / speed;
        bindAudioEngine(eng as never);
        observeSim(prev, w.state, { x: all[i]!.x, z: all[i]!.z, yaw: 0, mapWidth: w.terrain.w, cellSize: sz, water: w.terrain.water, audibleRadius: 90 });
      }
    }
    // alternation bookkeeping: replicate the binding formula per building start
    const pb = new Map(prev.buildings.map((b) => [b.id, b]));
    for (const b of w.state.buildings) {
      if (b.status.k === 'WORKING' && pb.get(b.id)?.status !== 'WORKING') {
        const key = b.type + ':' + (b.id) + ':' + (b.id + (w.state.tick >> 6));
        variantCount.set(key, (variantCount.get(key) ?? 0) + 1);
      }
    }
    prev = captureAudioState(w.state);
  }
  const minutes = (w.state.tick - tick0) / TICK_HZ / 60;
  const perId: Row['perId'] = {};
  const ids = new Set<SoundId>();
  for (const e of engines) for (const k of e.stats.keys()) ids.add(k);
  for (const id of ids) {
    const accs = engines.map((e) => e.stats.get(id)?.accepted ?? 0);
    const accs4 = engines4.map((e) => e.stats.get(id)?.accepted ?? 0);
    const raws = engines.map((e) => e.stats.get(id)?.raw ?? 0);
    perId[id] = {
      rawPerMin: Math.max(...raws) / minutes, centroidPerMin: accs[1]! / minutes, castlePerMin: accs[0]! / minutes,
      worstPerMin: Math.max(...accs) / minutes, x4WorstPerMin: Math.max(...accs4) / (minutes / 4), variants: {},
    };
  }
  rows.push({ scenario, minutes, perId, stalls: 0 });
  (rows[rows.length - 1] as unknown as { variantKeys: [string, number][] }).variantKeys = [...variantCount];
}

// missions m8..m12, "wlasciwa" (right fix) and "nic" (no action -> stalls)
for (const id of ['m8', 'm9', 'm10', 'm11', 'm12'] as const) {
  for (const pick of ['wlasciwa', 'nic']) {
    const go = (): void => {
      const w = createWorld(id);
      const list = (id === 'm8' || id === 'm9' ? S789[id] : S1012[id]) as readonly (Strat789 | Strat1012)[];
      const s = list.find((x) => x.name.startsWith(pick))!;
      let setupDone = false, done = false;
      run(`${id}/${pick}`, w, 25, (ww) => {
        const st = ww.state;
        const s7 = s as Strat789;
        if (s7.setup && !setupDone && st.tick >= s7.setup.after * TICK_HZ) { s7.setup.cmds(ww).forEach((c) => applyCommand(ww, c)); setupDone = true; }
        if (!done && st.tick >= s.after * TICK_HZ && (s7.whenStone === undefined || stoneAvailable(ww) >= s7.whenStone)) {
          s.cmds(ww).forEach((c) => applyCommand(ww, c)); done = true;
        }
      }, (ww) => ww.state.mission.result !== 'running');
    };
    if (id === 'm8' || id === 'm9') withProposal(id, go); else go();
  }
}
// sandbox: DECENT plan, 90 min (rank 4 only arrives at ~78 min)
{
  const w = createWorld('sandbox');
  let k = 0;
  run('sandbox/DECENT', w, 90, (ww) => {
    if (ww.state.tick % TICK_HZ === 0 && k < DECENT.length) {
      const s = DECENT[k]!;
      const st = sandboxStatus(ww);
      if ((s.rank ?? 0) <= st.rank && (s.after ?? 0) * TICK_HZ <= ww.state.tick) {
        let ok = true;
        for (const c of s.cmds(ww)) { const r = applyCommand(ww, c); if (!r.ok) { ok = false; if (r.err.k !== 'NO_COINS' && r.err.k !== 'NO_STONE') k++; break; } }
        if (ok) k++;
      }
    }
  }, () => false);
}
console.log(JSON.stringify({ rows, missionsLoaded: Object.keys(MISSIONS) }, null, 1));
