// Player commands. The only way input reaches the simulation. Applied at tick boundaries.
import {
  BUILDINGS, COST_COBBLE, COST_DIRT, COST_STONE_BRIDGE, COST_WOOD_BRIDGE, DEMOLISH_REFUND, MAX_GRADE,
  MAX_WAGONS, QUARRY_MIN_HEIGHT, SITE_RULE, STONE_COBBLE, STONE_STONE_BRIDGE, WAGON_PRICE, emptyGoods, GOODS, inputGoods,
} from './defs';
import { buildingById, upstreamOf } from './logistics';
import { grade, net, type World } from './network';
import { cancelJob } from './wagons';
import { canPlace, canSurface, demolishQuote, rankGated } from './town';
import type { BuildingStatus, BuildingType, SurfaceKind, Terrain } from './types';

export type Command =
  | { t: 'road'; cells: number[]; surface: SurfaceKind }
  | { t: 'demolish'; cell: number }
  | { t: 'buyWagon'; stable: number }
  /** Sell an idle wagon back for half its price (recovery when silver runs out). */
  | { t: 'sellWagon'; wagon: number }
  | { t: 'place'; type: BuildingType; x: number; y: number; facing: number };

export type CommandError =
  | { k: 'OUT_OF_BOUNDS' }
  | { k: 'NOT_CONTIGUOUS'; cell: number }
  | { k: 'TOO_STEEP'; cell: number; grade: number; max: number }
  | { k: 'BLOCKED'; cell: number }
  | { k: 'NO_COINS'; need: number; have: number }
  | { k: 'NOTHING_THERE' }
  | { k: 'IS_GATE'; building: number }
  | { k: 'WAGON_ON_ROAD'; wagon: number }
  | { k: 'CANNOT_DEMOLISH'; building: number }
  | { k: 'TOO_MANY_WAGONS' }
  | { k: 'NOT_FLAT'; cell: number }
  | { k: 'BAD_TARGET' }
  | { k: 'WAGON_BUSY'; wagon: number }
  /** Free valley: this building type / road surface needs a higher town rank. */
  | { k: 'LOCKED'; rank: number }
  /** Free valley: the player cannot build this type at all (the castle). */
  | { k: 'NOT_PLACEABLE' }
  /** A fisher's hut needs water next to its footprint or its gate. */
  | { k: 'NOT_NEAR_WATER' }
  /** A quarry needs high, rocky ground (hills, the ridge): QUARRY_MIN_HEIGHT above the water. */
  | { k: 'NOT_ON_ROCK' }
  /**
   * Free valley / roadStone missions: cobbles and stone bridges also need stone lying in the
   * granaries (or castle). `incoming`: stone already on its way to them (wagon jobs); `atQuarry`:
   * unreserved stone waiting at quarries; `quarries`: how many quarries exist (0 = none mines it).
   */
  | { k: 'NO_STONE'; need: number; have: number; incoming: number; atQuarry: number; quarries: number };

/** `stone`: units of stone the command takes from the granaries (free valley roads), 0 otherwise. */
export type CommandResult = { ok: true; cost: number; stone?: number } | { ok: false; err: CommandError };

export function roadCellCost(world: World, cell: number, surface: SurfaceKind): number {
  const cur = world.state.roads[cell]!;
  if (cur >= surface) return 0;
  const water = world.terrain.water[cell] === 1;
  const price = (s: number) => (s === 0 ? 0 : water ? (s === 2 ? COST_STONE_BRIDGE : COST_WOOD_BRIDGE) : s === 2 ? COST_COBBLE : COST_DIRT);
  return price(surface) - price(cur);
}

/** Validate a road path without applying it. Returns cost or an error. */
export function validateRoad(world: World, cells: readonly number[], surface: SurfaceKind): CommandResult {
  const t = world.terrain;
  const c = net(world);
  if (cells.length === 0) return { ok: false, err: { k: 'NOT_CONTIGUOUS', cell: -1 } };
  if (surface !== 1 && surface !== 2) return { ok: false, err: { k: 'BAD_TARGET' } };
  const seen = new Set<number>();
  let cost = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (!Number.isInteger(cell) || cell < 0 || cell >= t.w * t.h) return { ok: false, err: { k: 'OUT_OF_BOUNDS' } };
    if (c.occupied[cell] !== -1) return { ok: false, err: { k: 'BLOCKED', cell } };
    if (i > 0) {
      const a = cells[i - 1]!;
      const ax = a % t.w, ay = (a - ax) / t.w, bx = cell % t.w, by = (cell - bx) / t.w;
      if (Math.abs(ax - bx) > 1 || Math.abs(ay - by) > 1 || a === cell) return { ok: false, err: { k: 'NOT_CONTIGUOUS', cell } };
      if (ax !== bx && ay !== by && (c.occupied[ay * t.w + bx] !== -1 || c.occupied[by * t.w + ax] !== -1)) {
        return { ok: false, err: { k: 'BLOCKED', cell } };
      }
      const g = grade(t, a, cell);
      if (Math.abs(g) > MAX_GRADE + 1e-9) return { ok: false, err: { k: 'TOO_STEEP', cell, grade: Math.abs(g), max: MAX_GRADE } };
    }
    if (!seen.has(cell)) {
      seen.add(cell);
      cost += roadCellCost(world, cell, surface);
    }
  }
  if (cost > 0) {
    const gate = canSurface(world, surface);
    if (!gate.ok) return gate;
  }
  if (cost > world.state.coins) return { ok: false, err: { k: 'NO_COINS', need: cost, have: world.state.coins } };
  const stone = roadStoneCost(world, cells, surface);
  if (stone > 0) {
    const have = stoneAvailable(world);
    if (stone > have) return { ok: false, err: { k: 'NO_STONE', need: stone, have, ...stoneOutlook(world) } };
    return { ok: true, cost, stone };
  }
  return { ok: true, cost };
}

/**
 * Stone a road command needs (free valley, design S5, and missions with `roadStone`, D-32):
 * STONE_COBBLE per newly cobbled land cell, STONE_STONE_BRIDGE per new stone-bridge cell. Other
 * missions build with silver alone.
 */
export function roadStoneCost(world: World, cells: readonly number[], surface: SurfaceKind): number {
  if (surface !== 2 || !(rankGated(world) || world.state.mission.roadStone)) return 0;
  const seen = new Set<number>();
  let n = 0;
  for (const cell of cells) {
    if (seen.has(cell) || !(cell >= 0 && cell < world.state.roads.length)) continue;
    seen.add(cell);
    if (world.state.roads[cell]! >= 2) continue;
    n += world.terrain.water[cell] === 1 ? STONE_STONE_BRIDGE : STONE_COBBLE;
  }
  return n;
}

/** Stone the player can build with: unreserved stone in every granary and the castle. */
export function stoneAvailable(world: World): number {
  let n = 0;
  for (const b of world.state.buildings) {
    if (b.type === 'warehouse' || b.type === 'castle') n += b.stock.stone - b.reservedOut.stone;
  }
  return n;
}

/**
 * Where the missing building stone is (for NO_STONE): on its way to a granary / the castle, lying
 * unreserved at a quarry, and how many quarries there are. Read-only.
 */
export function stoneOutlook(world: World): { incoming: number; atQuarry: number; quarries: number } {
  let incoming = 0, atQuarry = 0, quarries = 0;
  for (const b of world.state.buildings) {
    if (b.type === 'warehouse' || b.type === 'castle') incoming += b.incoming.stone;
    else if (b.type === 'quarry') { quarries++; atQuarry += b.stock.stone - b.reservedOut.stone; }
  }
  return { incoming, atQuarry, quarries };
}

/** Take `n` unreserved stone from the granaries (then the castle), lowest id first; it is consumed. */
function takeStone(world: World, n: number): void {
  const st = world.state;
  for (const pass of ['warehouse', 'castle'] as const) {
    for (const b of st.buildings) {
      if (n <= 0) return;
      if (b.type !== pass) continue;
      const k = Math.min(n, b.stock.stone - b.reservedOut.stone);
      if (k <= 0) continue;
      b.stock.stone -= k;
      st.ledger.consumed.stone += k;
      n -= k;
    }
  }
}

export function applyCommand(world: World, cmd: Command): CommandResult {
  const st = world.state;
  switch (cmd.t) {
    case 'road': {
      const r = validateRoad(world, cmd.cells, cmd.surface);
      if (!r.ok) return r;
      for (const cell of cmd.cells) if (st.roads[cell]! < cmd.surface) st.roads[cell] = cmd.surface;
      st.coins -= r.cost;
      if (r.stone) takeStone(world, r.stone);
      st.netVersion++;
      return r;
    }
    case 'demolish':
      return demolish(world, cmd.cell);
    case 'buyWagon': {
      const stable = buildingById(world, cmd.stable);
      if (!stable || stable.type !== 'stable') return { ok: false, err: { k: 'BAD_TARGET' } };
      if (st.wagons.length >= MAX_WAGONS) return { ok: false, err: { k: 'TOO_MANY_WAGONS' } };
      if (st.coins < WAGON_PRICE) return { ok: false, err: { k: 'NO_COINS', need: WAGON_PRICE, have: st.coins } };
      st.coins -= WAGON_PRICE;
      spawnWagon(world, stable.id);
      return { ok: true, cost: WAGON_PRICE };
    }
    case 'sellWagon': {
      const i = st.wagons.findIndex((w) => w.id === cmd.wagon);
      if (i < 0) return { ok: false, err: { k: 'BAD_TARGET' } };
      const w = st.wagons[i]!;
      if (w.job || w.cargoQty > 0 || w.busyTicks > 0 || w.next >= 0) return { ok: false, err: { k: 'WAGON_BUSY', wagon: w.id } };
      st.wagons.splice(i, 1);
      const refund = Math.floor(WAGON_PRICE * 0.5);
      st.coins += refund;
      return { ok: true, cost: -refund };
    }
    case 'place':
      return place(world, cmd.type, cmd.x, cmd.y, cmd.facing, false);
  }
}

export function spawnWagon(world: World, stableId: number): number {
  const st = world.state;
  const stable = buildingById(world, stableId)!;
  const id = st.nextId++;
  st.wagons.push({
    id, n: st.nextWagonN++, home: stable.id, at: stable.gate, next: -1, edgeT: 0, path: [], dest: stable.gate, pathVer: -1,
    cargoGood: null, cargoQty: 0, job: null, status: { k: 'IDLE' }, busyTicks: 0, bridgeFrom: -1, odometer: 0,
  });
  return id;
}

function demolish(world: World, cell: number): CommandResult {
  const st = world.state, t = world.terrain;
  if (cell < 0 || cell >= t.w * t.h) return { ok: false, err: { k: 'OUT_OF_BOUNDS' } };
  const c = net(world);
  const bid = c.occupied[cell] !== -1 ? c.occupied[cell]! : -1;
  if (bid >= 0) return demolishBuilding(world, bid);
  if (!st.roads[cell]) return { ok: false, err: { k: 'NOTHING_THERE' } };
  if (c.gateOf[cell] !== -1) return { ok: false, err: { k: 'IS_GATE', building: c.gateOf[cell]! } };
  for (const w of st.wagons) {
    if (w.at === cell || w.next === cell) return { ok: false, err: { k: 'WAGON_ON_ROAD', wagon: w.id } };
  }
  const surface = st.roads[cell] as 1 | 2;
  st.roads[cell] = 0;
  const refund = Math.floor(roadCellCost(world, cell, surface) * DEMOLISH_REFUND);
  st.coins += refund;
  st.netVersion++;
  return { ok: true, cost: -refund };
}

function demolishBuilding(world: World, id: number): CommandResult {
  const st = world.state;
  const b = buildingById(world, id)!;
  if (b.type === 'castle' || b.type === 'stable') return { ok: false, err: { k: 'CANNOT_DEMOLISH', building: id } };
  // Release every reservation pointing at this building before it disappears.
  for (const w of st.wagons) {
    if (!w.job) continue;
    if (w.job.from === id && w.job.phase === 'pickup') cancelJob(world, w);
  }
  // full refund while the building is fresh (undo window), half afterwards
  const refund = demolishQuote(world, b).refund;
  for (const g of GOODS) {
    st.ledger.destroyed[g] += b.stock[g];
  }
  st.buildings = st.buildings.filter((x) => x.id !== id);
  // Wagons delivering here keep their cargo; repairJob() re-targets them next tick.
  st.coins += refund;
  st.netVersion++;
  return { ok: true, cost: -refund };
}

export function gateCell(world: World, x: number, y: number, w: number, h: number, facing: number): number {
  const W = world.terrain.w;
  switch (facing & 3) {
    case 0: return (y + h) * W + (x + (w >> 1));
    case 1: return (y + (h >> 1)) * W + (x + w);
    case 2: return (y - 1) * W + (x + (w >> 1));
    default: return (y + (h >> 1)) * W + (x - 1);
  }
}

/**
 * Validate a building placement without changing anything (pure: the state hash is the same
 * before and after). `free` (map setup) skips silver and the rank gate. Returns the cost or the
 * first error; BLOCKED / NOT_FLAT carry the offending cell for the placement ghost.
 */
export function validatePlace(world: World, type: BuildingType, x: number, y: number, facing: number, free = false): CommandResult {
  const st = world.state, t = world.terrain;
  if (!Object.prototype.hasOwnProperty.call(BUILDINGS, type)) return { ok: false, err: { k: 'BAD_TARGET' } };
  const def = BUILDINGS[type];
  if (!free) {
    const gate = canPlace(world, type);
    if (!gate.ok) return gate;
  }
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(facing)) return { ok: false, err: { k: 'OUT_OF_BOUNDS' } };
  const c = net(world);
  if (x < 0 || y < 0 || x + def.w > t.w || y + def.h > t.h) return { ok: false, err: { k: 'OUT_OF_BOUNDS' } };
  const gate = gateCell(world, x, y, def.w, def.h, facing);
  const gx = gate % t.w, gy = Math.floor(gate / t.w);
  if (gate < 0 || gy < 0 || gy >= t.h || gx < 0 || gx >= t.w) return { ok: false, err: { k: 'OUT_OF_BOUNDS' } };
  let lo = Infinity, hi = -Infinity;
  for (let yy = y; yy < y + def.h; yy++) {
    for (let xx = x; xx < x + def.w; xx++) {
      const i = yy * t.w + xx;
      if (t.water[i] || st.roads[i] || c.occupied[i] !== -1 || c.gateOf[i] !== -1) return { ok: false, err: { k: 'BLOCKED', cell: i } };
      lo = Math.min(lo, t.cellH[i]!);
      hi = Math.max(hi, t.cellH[i]!);
    }
  }
  if (t.water[gate] || c.occupied[gate] !== -1) return { ok: false, err: { k: 'BLOCKED', cell: gate } };
  if (hi - lo > 2.5) return { ok: false, err: { k: 'NOT_FLAT', cell: y * t.w + x } };
  const rule = SITE_RULE[type];
  if (rule === 'NEAR_WATER' && !nearWater(t, x, y, def.w, def.h, gate)) return { ok: false, err: { k: 'NOT_NEAR_WATER' } };
  if (rule === 'ON_ROCK' && !onRock(t, x, y, def.w, def.h)) return { ok: false, err: { k: 'NOT_ON_ROCK' } };
  const cost = free ? 0 : def.price;
  if (cost > st.coins) return { ok: false, err: { k: 'NO_COINS', need: cost, have: st.coins } };
  return { ok: true, cost };
}

/** Is any cell 8-adjacent to the footprint, or to the gate, water? (fisher's hut) */
export function nearWater(t: Terrain, x: number, y: number, w: number, h: number, gate: number): boolean {
  const gx = gate % t.w, gy = (gate - gx) / t.w;
  const wet = (x0: number, y0: number, x1: number, y1: number): boolean => {
    for (let yy = Math.max(0, y0); yy <= Math.min(t.h - 1, y1); yy++) {
      for (let xx = Math.max(0, x0); xx <= Math.min(t.w - 1, x1); xx++) if (t.water[yy * t.w + xx] === 1) return true;
    }
    return false;
  };
  return wet(x - 1, y - 1, x + w, y + h) || wet(gx - 1, gy - 1, gx + 1, gy + 1);
}

/** Is a cell rock: dry land at least QUARRY_MIN_HEIGHT above the water level? (render/UI overlay) */
export function isRockCell(t: Terrain, cell: number): boolean {
  return t.water[cell] !== 1 && t.cellH[cell]! - t.waterLevel >= QUARRY_MIN_HEIGHT;
}

/** Quarry ground: some rock cell in the footprint or the one-cell ring around it (hills, the ridge). */
export function onRock(t: Terrain, x: number, y: number, w: number, h: number): boolean {
  for (let yy = Math.max(0, y - 1); yy <= Math.min(t.h - 1, y + h); yy++) {
    for (let xx = Math.max(0, x - 1); xx <= Math.min(t.w - 1, x + w); xx++) if (isRockCell(t, yy * t.w + xx)) return true;
  }
  return false;
}

/** Place a building. `free` skips cost and the rank gate (map setup). */
export function place(world: World, type: BuildingType, x: number, y: number, facing: number, free: boolean): CommandResult {
  const r = validatePlace(world, type, x, y, facing, free);
  if (!r.ok) return r;
  const st = world.state, def = BUILDINGS[type];
  const gate = gateCell(world, x, y, def.w, def.h, facing);
  st.coins -= r.cost;
  if (!st.roads[gate]) st.roads[gate] = 1;
  st.buildings.push({
    id: st.nextId++, type, x, y, w: def.w, h: def.h, gate, facing: facing & 3,
    stock: emptyGoods(), reservedOut: emptyGoods(), incoming: emptyGoods(), progress: -1,
    status: initialStatus(world, type), stalledTicks: 0, capOverride: -1,
    placedTick: free ? -1 : st.tick,
  });
  st.netVersion++;
  return r;
}

/** A fresh building explains itself before the first dispatch (review F-04). */
function initialStatus(world: World, type: BuildingType): BuildingStatus {
  const ins = inputGoods(type);
  if (ins.length > 0) return { k: 'NO_INPUT', good: ins[0]!, cause: 'NONE_AVAILABLE', blockedBy: upstreamOf(world, ins[0]!, -1) };
  return BUILDINGS[type].recipe ? { k: 'WORKING' } : { k: 'IDLE' };
}

/** 8-connected raster line between two cells (inclusive), for drag-to-build. */
export function lineCells(w: number, a: number, b: number): number[] {
  let x0 = a % w, y0 = (a - x0) / w;
  const x1 = b % w, y1 = (b - x1) / w;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const out: number[] = [];
  for (;;) {
    out.push(y0 * w + x0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return out;
}
