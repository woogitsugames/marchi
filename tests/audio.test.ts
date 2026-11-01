import { bindAudioEngine, captureAudioState, observeSim } from '../src/audio/bindings';
import { AudioEngine } from '../src/audio/audio';
import type { SoundId } from '../src/audio/sounds';
import type { SimState } from '../src/sim/types';
import { assert, eq, test } from './harness';

class Recorder {
  played: SoundId[] = [];
  traffic: [number, number, number] = [0, 0, 1];
  levels = new Map<SoundId, number>();
  setCamera(): void {}
  setAmbience(): void {}
  setTraffic(dirt: number, cobble: number, rate: number): void { this.traffic = [dirt, cobble, rate]; }
  setLoopLevel(id: SoundId, v: number): void { this.levels.set(id, v); }
  async play(id: SoundId): Promise<null> { this.played.push(id); return null; }
}
function mock(): Recorder {
  const r = new Recorder();
  bindAudioEngine(r as unknown as AudioEngine);
  return r;
}
function state(tick = 0): SimState {
  return { tick, roads: new Array<number>(800).fill(1), buildings: [], wagons: [], rain: [],
    mission: { result: 'running' } } as unknown as SimState;
}
function b(id: number, status: string, type = 'woodcutter'): SimState['buildings'][number] {
  return { id, type, status: { k: status }, x: 4, y: 4, w: 2, h: 2 } as unknown as SimState['buildings'][number];
}
function w(id: number, status: string, at: number, next = -1, odometer = 0, bridgeFrom = -1, good = 'wood'): SimState['wagons'][number] {
  return { id, status: { k: status }, at, next, odometer, bridgeFrom, cargoGood: good,
    job: { good } } as unknown as SimState['wagons'][number];
}
const camera = { x: 22, z: 22, mapWidth: 20, audibleRadius: 200 };

test('never constructs an AudioContext before a gesture; init without DOM stays silent', async () => {
  const engine = new AudioEngine();
  eq(engine.activeVoiceCount, 0, 'not unlocked');
  eq(await engine.init(), false, 'Node cannot initialize browser audio');
  eq(await engine.play('ui.wood'), null, 'no playback before gesture');
  engine.setTraffic(200, 0);
  eq(engine.activeVoiceCount, 0, 'no audio nodes for 200 carts before init');
  engine.dispose();
});

test('a stalled building signals only its transition (not every tick)', () => {
  const r = mock(), old = state();
  old.buildings.push(b(7, 'WORKING'));
  const next = state(1);
  next.buildings.push(b(7, 'NO_INPUT'));
  const unchanged = JSON.stringify(next);
  observeSim(captureAudioState(old), next, camera);
  eq(r.played.filter((id) => id === 'stall.alert').length, 1, 'one stall alert');
  r.played.length = 0;
  observeSim(captureAudioState(next), { ...next, tick: 2 }, camera);
  eq(r.played.length, 0, 'no repeated alert');
  eq(JSON.stringify(next), unchanged, 'sim state not mutated');
  r.played.length = 0;
  const otherStall = state(3);
  otherStall.buildings.push(b(7, 'NO_WAGON'));
  observeSim(captureAudioState(next), otherStall, camera);
  eq(r.played.filter((id) => id === 'stall.alert').length, 0, 'no second signal between stall causes');
});

test('loading, bridge entry, unloading and winning contract produce exact sound cues', () => {
  const r = mock(), prev = state();
  prev.wagons.push(w(2, 'TO_PICKUP', 22, 23, 4));
  const curr = state(1);
  curr.wagons.push(w(2, 'LOADING', 22, -1, 4));
  observeSim(captureAudioState(prev), curr, camera);
  assert(r.played.includes('load.log'), 'loading logs');
  r.played.length = 0;
  const next = state(2);
  next.wagons.push(w(2, 'TO_DROPOFF', 22, 23, 5, 22));
  observeSim(captureAudioState(curr), next, camera);
  assert(r.played.includes('bridge.wood'), 'enter wooden bridge');
  r.played.length = 0;
  const delivered = state(3);
  delivered.wagons.push(w(2, 'UNLOADING', 23, -1, 6, -1));
  delivered.mission.result = 'won';
  observeSim(captureAudioState(next), delivered, camera);
  assert(r.played.includes('unload.log'), 'unloading logs');
  assert(r.played.includes('contract.won'), 'contract won');
  r.played.length = 0;
  observeSim(captureAudioState(delivered), { ...delivered, tick: 4 }, camera);
  eq(r.played.length, 0, 'winning sound occurs only once');
});

test('200 moving wagons produce TWO aggregate loops, never 200 playback voices', () => {
  const r = mock(), old = state();
  const next = state(1);
  next.roads[25] = 2;
  for (let i = 0; i < 200; i++) {
    const cell = 21 + i % 60;
    old.wagons.push(w(i + 1, 'TO_PICKUP', cell, i % 2 ? 25 : 26, 10));
    next.wagons.push(w(i + 1, 'TO_PICKUP', cell, i % 2 ? 25 : 26, 10.3));
  }
  observeSim(captureAudioState(old), next, camera);
  assert(r.traffic[0] > 0 && r.traffic[1] > 0, 'both wheel surfaces');
  eq(r.played.length, 0, 'no one-shot per cart');
});

test('observer stays under 1 ms per call for 200 carts on a representative CPU', () => {
  mock();
  const old = state(), curr = state(1);
  for (let i = 0; i < 200; i++) {
    old.wagons.push(w(i, 'TO_PICKUP', 20 + i % 100, 21 + i % 100, 5));
    curr.wagons.push(w(i, 'TO_PICKUP', 20 + i % 100, 21 + i % 100, 5.25));
  }
  const snap = captureAudioState(old);
  for (let i = 0; i < 300; i++) observeSim(snap, curr, camera);
  const started = performance.now();
  for (let i = 0; i < 1000; i++) observeSim(snap, curr, camera);
  const mean = (performance.now() - started) / 1000;
  assert(mean < 1, `observer mean ${mean.toFixed(3)} ms, 200 carts`);
});

bindAudioEngine(null);
