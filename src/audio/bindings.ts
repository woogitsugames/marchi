import type { AudioCamera, AudioEngine, PlayOptions } from './audio';
import type { SoundId } from './sounds';
import { CELL_SIZE, DAY_TICKS, START_DAY_FRACTION, TICK_HZ } from '../sim/defs';
import type { Building, Good, SimState, Wagon } from '../sim/types';

/** Camera focus (not eye elevation) and a lightweight terrain view for spatial Foley. */
export interface SimAudioCamera extends AudioCamera {
  mapWidth: number;
  cellSize?: number;
  water?: readonly number[];
  audibleRadius?: number;
  /** Overrides the automatic river-proximity probe (0..1). */
  riverLevel?: number;
}

type BuildingAudio = Pick<Building, 'id' | 'type' | 'x' | 'y' | 'w' | 'h'> & { status: Building['status']['k'] };
type WagonAudio = Pick<Wagon, 'id' | 'at' | 'next' | 'odometer' | 'bridgeFrom' | 'cargoGood'> & {
  status: Wagon['status']['k'];
  good: Good | null;
};

/** Save this small projection before/after each tick; never retain the mutable SimState as "previous". */
export interface AudioSnapshot {
  readonly tick: number;
  readonly result: SimState['mission']['result'];
  readonly buildings: readonly BuildingAudio[];
  readonly wagons: readonly WagonAudio[];
}

export function captureAudioState(state: Readonly<SimState>): AudioSnapshot {
  return {
    tick: state.tick,
    result: state.mission.result,
    buildings: state.buildings.map((b) => ({
      id: b.id, type: b.type, x: b.x, y: b.y, w: b.w, h: b.h, status: b.status.k,
    })),
    wagons: state.wagons.map((w) => ({
      id: w.id, at: w.at, next: w.next, odometer: w.odometer,
      bridgeFrom: w.bridgeFrom, cargoGood: w.cargoGood, status: w.status.k,
      good: w.job?.good ?? w.cargoGood,
    })),
  };
}

/** Inject audio once. The sim is not imported into or modified by AudioEngine. */
let audio: Pick<AudioEngine, 'setCamera' | 'setAmbience' | 'setTraffic' | 'setLoopLevel' | 'play'> | null = null;
export function bindAudioEngine(engine: typeof audio): void { audio = engine; }

const STALLED = new Set<Building['status']['k']>([
  'NO_ROAD', 'NO_INPUT', 'NO_WAGON', 'OUTPUT_FULL', 'STORAGE_FULL',
]);
const WORK_SOUND: Partial<Record<Building['type'], SoundId>> = {
  woodcutter: 'work.axe', sawmill: 'work.saw', bakery: 'work.oven',
};
const ACTIVE_WAGON = new Set<Wagon['status']['k']>(['TO_PICKUP', 'TO_DROPOFF', 'RETURNING']);

function cellPos(cell: number, camera: SimAudioCamera): PlayOptions {
  const size = camera.cellSize ?? CELL_SIZE;
  return { x: ((cell % camera.mapWidth) + 0.5) * size, z: (Math.floor(cell / camera.mapWidth) + 0.5) * size };
}
function buildingPos(b: Pick<Building, 'x' | 'y' | 'w' | 'h'>, camera: SimAudioCamera): PlayOptions {
  const size = camera.cellSize ?? CELL_SIZE;
  return { x: (b.x + b.w / 2) * size, z: (b.y + b.h / 2) * size };
}
function play(id: SoundId, options?: PlayOptions): void {
  if (audio) void audio.play(id, options).catch(() => undefined);
}
function cargoSound(good: Good | null, unload: boolean): SoundId {
  const action = unload ? 'unload' : 'load';
  return `${action}.${good === 'wood' ? 'log' : good === 'planks' ? 'plank' : 'sack'}` as SoundId;
}
function riverProximity(camera: SimAudioCamera): number {
  if (camera.riverLevel !== undefined) return Math.max(0, Math.min(1, camera.riverLevel));
  const water = camera.water;
  if (!water) return 0;
  const size = camera.cellSize ?? CELL_SIZE, w = camera.mapWidth;
  if (w <= 0) return 0;
  const h = Math.floor(water.length / w);
  const cx = Math.floor(camera.x / size), cy = Math.floor(camera.z / size);
  const reach = 9;
  let best = Infinity;
  for (let dy = -reach; dy <= reach; dy += 2) {
    const y = cy + dy;
    if (y < 0 || y >= h) continue;
    for (let dx = -reach; dx <= reach; dx += 2) {
      const x = cx + dx;
      if (x < 0 || x >= w || water[y * w + x] !== 1) continue;
      const d = Math.hypot(dx, dy) * size;
      if (d < best) best = d;
    }
  }
  return Math.max(0, 1 - best / 36);
}

/**
 * Read-only post-tick bridge from simulation to audio.
 * Pass captureAudioState(previous state), NOT a reference to a state mutated in place by step().
 * Performs no pathfinding, 3D queries, writes to state, or per-wagon AudioNode allocation.
 */
export function observeSim(prevState: AudioSnapshot, state: Readonly<SimState>, camera: SimAudioCamera): void {
  if (!audio || camera.mapWidth <= 0) return;
  audio.setCamera(camera);
  const rain = state.rain.some((r) => r.start <= state.tick && state.tick < r.end);
  const day = (START_DAY_FRACTION + state.tick / DAY_TICKS) % 1;
  audio.setAmbience(rain ? 'rain' : day > 0.70 || day < 0.16 ? 'evening' : 'morning', riverProximity(camera));

  const prevBuildings = new Map(prevState.buildings.map((b) => [b.id, b]));
  let stalledNow = false, workingMills = 0;
  for (const b of state.buildings) {
    const old = prevBuildings.get(b.id);
    const p = buildingPos(b, camera);
    if (b.status.k === 'WORKING') {
      if (b.type === 'mill') {
        const range = camera.audibleRadius ?? 80;
        const d = Math.hypot(p.x! - camera.x, p.z! - camera.z);
        workingMills += Math.max(0, 1 - d / range);
      }
      if (old?.status !== 'WORKING') {
        const id = WORK_SOUND[b.type];
        if (id) play(id, p);
      }
    }
    if (old && STALLED.has(b.status.k) && !STALLED.has(old.status)) stalledNow = true;
  }
  audio.setLoopLevel('work.mill', Math.min(0.85, Math.log1p(workingMills) / Math.log(5)));

  const prevWagons = new Map(prevState.wagons.map((w) => [w.id, w]));
  const radius = camera.audibleRadius ?? 88;
  let dirt = 0, cobble = 0, weightedSpeed = 0, weightedCount = 0;
  for (const wagon of state.wagons) {
    const old = prevWagons.get(wagon.id);
    const cell = wagon.next >= 0 ? wagon.next : wagon.at;
    const p = cellPos(cell, camera);
    const d = Math.hypot(p.x! - camera.x, p.z! - camera.z);
    if (d > radius) continue;
    const strength = 1 - d / radius;
    if (old && wagon.status.k === 'LOADING' && old.status !== 'LOADING') {
      play(cargoSound(wagon.job?.good ?? wagon.cargoGood, false), p);
    }
    if (old && wagon.status.k === 'UNLOADING' && old.status !== 'UNLOADING') {
      play(cargoSound(wagon.job?.good ?? wagon.cargoGood, true), p);
    }
    if (old && (old.bridgeFrom < 0 && wagon.bridgeFrom >= 0 ||
        camera.water?.[old.next >= 0 ? old.next : old.at] !== 1 && camera.water?.[cell] === 1 && state.roads[cell] === 1)) {
      play('bridge.wood', p);
    }
    if (wagon.next >= 0 && ACTIVE_WAGON.has(wagon.status.k)) {
      if (state.roads[cell] === 2) cobble += strength;
      else dirt += strength;
      if (old && state.tick > prevState.tick) {
        const speed = Math.max(0, wagon.odometer - old.odometer) * TICK_HZ / (state.tick - prevState.tick);
        weightedSpeed += Math.min(8, speed) * strength;
        weightedCount += strength;
      }
    }
    if (old && old.status !== 'NO_ROUTE' && old.status !== 'BRIDGE_JAM' &&
        (wagon.status.k === 'NO_ROUTE' || wagon.status.k === 'BRIDGE_JAM')) {
      // At most one stall alert per tick across both buildings and wagons (UI cooldown still applies).
      stalledNow = true;
    }
    if (state.tick % (65 * TICK_HZ) === 0 && wagon.next >= 0 && wagon.id % 17 === state.tick / (65 * TICK_HZ) % 17) {
      play('horse.snort', p);
    }
  }
  if (stalledNow) play('stall.alert');
  const rate = weightedCount > 0 ? Math.max(0.75, Math.min(1.3, weightedSpeed / weightedCount / 3.6)) : 1;
  audio.setTraffic(dirt, cobble, rate);

  if (prevState.result !== 'won' && state.mission.result === 'won') play('contract.won');
}
