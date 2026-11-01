// Versioned, dependency-free JSON mission decoding and map validation.
// The caller owns loading the JSON; this module stays platform-independent.
import { lineCells } from './commands';
import { BUILDINGS, GOODS, MAX_WAGONS } from './defs';
import { generateValley, type ValleySpec } from './terrain';
import type { MissionDef } from './missions';
import type { BuildingType, GoodMap, RainSpell } from './types';

export const MISSION_FORMAT_VERSION = 1;

export interface MissionData {
  formatVersion: typeof MISSION_FORMAT_VERSION;
  mission: MissionDef;
  valley: ValleySpec;
}

export class MissionDataError extends Error {
  constructor(readonly source: string, readonly path: string, detail: string) {
    super(source + ': ' + path + ': ' + detail);
    this.name = 'MissionDataError';
  }
}

class Reader {
  constructor(private readonly source: string) {}

  fail(path: string, message: string): never {
    throw new MissionDataError(this.source, path, message);
  }

  object(value: unknown, path: string): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return this.fail(path, 'expected an object');
    }
    return value as Record<string, unknown>;
  }

  keys(value: Record<string, unknown>, path: string, required: readonly string[], optional: readonly string[] = []): void {
    for (const key of Object.keys(value)) {
      if (!required.includes(key) && !optional.includes(key)) this.fail(path + '.' + key, 'unknown field');
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) this.fail(path + '.' + key, 'required field is missing');
    }
  }

  array(value: unknown, path: string, min = 0, max = 2048): unknown[] {
    if (!Array.isArray(value)) return this.fail(path, 'expected an array');
    if (value.length < min || value.length > max) this.fail(path, 'expected ' + min + '..' + max + ' entries');
    return value;
  }

  number(value: unknown, path: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      return this.fail(path, 'expected a finite number in [' + min + ', ' + max + ']');
    }
    return value;
  }

  integer(value: unknown, path: string, min: number, max: number): number {
    const n = this.number(value, path, min, max);
    if (!Number.isSafeInteger(n)) return this.fail(path, 'expected an integer');
    return n;
  }

  name(value: unknown, path: string): string {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(value)) {
      return this.fail(path, 'expected a lowercase identifier (a-z, 0-9, hyphen)');
    }
    return value;
  }

  goods(value: unknown, path: string, full: true): GoodMap;
  goods(value: unknown, path: string, full: false): Partial<GoodMap>;
  goods(value: unknown, path: string, full: boolean): GoodMap | Partial<GoodMap> {
    const obj = this.object(value, path);
    this.keys(obj, path, full ? GOODS : [], full ? [] : GOODS);
    const result: Partial<GoodMap> = {};
    for (const good of GOODS) {
      if (Object.prototype.hasOwnProperty.call(obj, good)) {
        result[good] = this.integer(obj[good], path + '.' + good, 0, 1000000);
      }
    }
    return result;
  }

  valley(value: unknown, path: string): ValleySpec {
    const obj = this.object(value, path);
    this.keys(obj, path, [
      'w', 'h', 'seed', 'waterLevel', 'spacing', 'riverY', 'riverHalfWidth',
      'hills', 'northRidge', 'southRidge', 'forestNorthOf', 'fields',
    ]);
    const w = this.integer(obj.w, path + '.w', 8, 256);
    const h = this.integer(obj.h, path + '.h', 8, 256);
    const seed = this.integer(obj.seed, path + '.seed', 0, 4294967295);
    const waterLevel = this.number(obj.waterLevel, path + '.waterLevel', -1000, 1000);
    const spacing = this.integer(obj.spacing, path + '.spacing', 1, w);
    const riverY = this.array(obj.riverY, path + '.riverY', 2, 512).map((y, i) =>
      this.number(y, path + '.riverY[' + i + ']', 0, h));
    const riverHalfWidth = this.array(obj.riverHalfWidth, path + '.riverHalfWidth', 2, 512).map((v, i) =>
      this.number(v, path + '.riverHalfWidth[' + i + ']', 0.01, h));
    if (riverHalfWidth.length !== riverY.length) this.fail(path + '.riverHalfWidth', 'must match riverY length');
    // Integer ceil without Math.ceil (sim may use only floor/round/min/max/abs/sqrt).
    if (riverY.length < Math.floor((w + spacing - 1) / spacing) + 1) {
      this.fail(path + '.riverY', 'not enough control points to span the map width');
    }
    const hills = this.array(obj.hills, path + '.hills', 0, 256).map((item, i) => {
      const p = path + '.hills[' + i + ']';
      const hill = this.object(item, p);
      this.keys(hill, p, ['x', 'y', 'r', 'h']);
      return {
        x: this.number(hill.x, p + '.x', 0, w),
        y: this.number(hill.y, p + '.y', 0, h),
        r: this.number(hill.r, p + '.r', 0.01, 512),
        h: this.number(hill.h, p + '.h', -100, 100),
      };
    });
    const northRidge = this.integer(obj.northRidge, path + '.northRidge', 0, h);
    const southRidge = this.integer(obj.southRidge, path + '.southRidge', 0, h);
    if (northRidge > southRidge) this.fail(path + '.southRidge', 'must not be north of northRidge');
    const forestNorthOf = this.integer(obj.forestNorthOf, path + '.forestNorthOf', 0, h);
    const fields = this.array(obj.fields, path + '.fields', 0, 256).map((item, i) => {
      const p = path + '.fields[' + i + ']';
      const rect = this.object(item, p);
      this.keys(rect, p, ['x', 'y', 'w', 'h']);
      const x = this.integer(rect.x, p + '.x', 0, w - 1);
      const y = this.integer(rect.y, p + '.y', 0, h - 1);
      const fw = this.integer(rect.w, p + '.w', 1, w);
      const fh = this.integer(rect.h, p + '.h', 1, h);
      if (x + fw > w) this.fail(p + '.w', 'field extends beyond the map');
      if (y + fh > h) this.fail(p + '.h', 'field extends beyond the map');
      return { x, y, w: fw, h: fh };
    });
    return { w, h, seed, waterLevel, riverY, riverHalfWidth, spacing, hills, northRidge, southRidge, forestNorthOf, fields };
  }

  mission(value: unknown, valley: ValleySpec, path: string): MissionDef {
    const obj = this.object(value, path);
    this.keys(obj, path, [
      'id', 'mapId', 'seed', 'coins', 'wagons', 'buildings', 'roads',
      'contract', 'deadlineMin', 'star3Min', 'star2Min',
    ], ['rain', 'roadsOverWater']);
    const id = this.name(obj.id, path + '.id');
    const mapId = this.name(obj.mapId, path + '.mapId');
    const seed = this.integer(obj.seed, path + '.seed', 0, 4294967295);
    const coins = this.integer(obj.coins, path + '.coins', 0, 2147483647);
    const wagons = this.integer(obj.wagons, path + '.wagons', 0, MAX_WAGONS);
    const buildings: MissionDef['buildings'] = this.array(obj.buildings, path + '.buildings', 0, 1024).map((item, i) => {
      const p = path + '.buildings[' + i + ']';
      const b = this.object(item, p);
      this.keys(b, p, ['type', 'x', 'y', 'facing'], ['stock']);
      if (typeof b.type !== 'string' || !Object.prototype.hasOwnProperty.call(BUILDINGS, b.type)) {
        this.fail(p + '.type', 'unknown building type');
      }
      const placement: MissionDef['buildings'][number] = {
        type: b.type as BuildingType,
        x: this.integer(b.x, p + '.x', 0, valley.w - 1),
        y: this.integer(b.y, p + '.y', 0, valley.h - 1),
        facing: this.integer(b.facing, p + '.facing', 0, 3),
      };
      if (Object.prototype.hasOwnProperty.call(b, 'stock')) {
        placement.stock = this.goods(b.stock, p + '.stock', false);
      }
      return placement;
    });
    const roads: MissionDef['roads'] = this.array(obj.roads, path + '.roads', 0, 2048).map((item, i) => {
      const p = path + '.roads[' + i + ']';
      return this.array(item, p, 2, 256).map((point, j) => {
        const pp = p + '[' + j + ']';
        const xy = this.array(point, pp, 2, 2);
        return [
          this.integer(xy[0], pp + '[0]', 0, valley.w - 1),
          this.integer(xy[1], pp + '[1]', 0, valley.h - 1),
        ] as [number, number];
      });
    });
    const contract = obj.contract === null ? null : this.goods(obj.contract, path + '.contract', true);
    const deadlineMin = this.number(obj.deadlineMin, path + '.deadlineMin', 0, 1440);
    const star3Min = this.number(obj.star3Min, path + '.star3Min', 0, 1440);
    const star2Min = this.number(obj.star2Min, path + '.star2Min', 0, 1440);
    if (contract) {
      if (GOODS.every((good) => contract[good] === 0)) this.fail(path + '.contract', 'at least one good must be required');
      if (buildings.filter((b) => b.type === 'castle').length !== 1) {
        this.fail(path + '.buildings', 'a contract requires exactly one castle');
      }
      if (!(star3Min > 0 && star3Min <= star2Min && star2Min <= deadlineMin)) {
        this.fail(path + '.star3Min', 'expected 0 < star3Min <= star2Min <= deadlineMin');
      }
    } else if (deadlineMin !== 0 || star3Min !== 0 || star2Min !== 0) {
      this.fail(path + '.contract', 'missions without a contract must have zero deadlines');
    }
    if (wagons > 0 && !buildings.some((b) => b.type === 'stable')) {
      this.fail(path + '.wagons', 'wagons require a stable');
    }
    const mission: MissionDef = {
      id, mapId, seed, coins, wagons, buildings, roads, contract, deadlineMin, star3Min, star2Min,
    };
    if (Object.prototype.hasOwnProperty.call(obj, 'rain')) {
      let previousEnd = -1;
      const rain: RainSpell[] = this.array(obj.rain, path + '.rain', 0, 512).map((item, i) => {
        const p = path + '.rain[' + i + ']';
        const spell = this.object(item, p);
        this.keys(spell, p, ['start', 'end']);
        const start = this.integer(spell.start, p + '.start', 0, 2147483647);
        const end = this.integer(spell.end, p + '.end', 0, 2147483647);
        if (end <= start) this.fail(p + '.end', 'must be greater than start');
        if (i > 0 && start < previousEnd) this.fail(p + '.start', 'rain spells must not overlap');
        previousEnd = end;
        return { start, end };
      });
      mission.rain = rain;
    }
    if (Object.prototype.hasOwnProperty.call(obj, 'roadsOverWater')) {
      if (typeof obj.roadsOverWater !== 'boolean') this.fail(path + '.roadsOverWater', 'expected a boolean');
      mission.roadsOverWater = obj.roadsOverWater;
    }
    this.validatePlacement(mission, valley, path);
    return mission;
  }

  private validatePlacement(mission: MissionDef, valley: ValleySpec, path: string): void {
    // The same seeded terrain and footprint/gate rules as commands.place().
    const terrain = generateValley({ ...valley, seed: mission.seed });
    const { w, h } = valley;
    const occupied = new Int32Array(w * h).fill(-1);
    const gates = new Int32Array(w * h).fill(-1);
    for (let i = 0; i < mission.buildings.length; i++) {
      const b = mission.buildings[i]!;
      const p = path + '.buildings[' + i + ']';
      const def = BUILDINGS[b.type];
      if (b.x + def.w > w) this.fail(p + '.x', 'building footprint extends beyond map width');
      if (b.y + def.h > h) this.fail(p + '.y', 'building footprint extends beyond map height');
      let gx = b.x, gy = b.y;
      switch (b.facing) {
        case 0: gx += def.w >> 1; gy += def.h; break;
        case 1: gx += def.w; gy += def.h >> 1; break;
        case 2: gx += def.w >> 1; gy--; break;
        case 3: gx--; gy += def.h >> 1; break;
      }
      if (gx < 0 || gy < 0 || gx >= w || gy >= h) {
        this.fail(p + '.facing', 'gate falls outside map at (' + gx + ', ' + gy + ')');
      }
      const gate = gy * w + gx;
      let low = Infinity, high = -Infinity;
      for (let y = b.y; y < b.y + def.h; y++) {
        for (let x = b.x; x < b.x + def.w; x++) {
          const cell = y * w + x;
          if (terrain.water[cell]) this.fail(p, 'footprint overlaps water at (' + x + ', ' + y + ')');
          if (occupied[cell] >= 0) this.fail(p, 'footprint overlaps buildings[' + occupied[cell] + ']');
          if (gates[cell] >= 0) this.fail(p, 'footprint covers buildings[' + gates[cell] + '] gate');
          low = Math.min(low, terrain.cellH[cell]!);
          high = Math.max(high, terrain.cellH[cell]!);
        }
      }
      if (high - low > 2.5) this.fail(p, 'footprint is not flat enough for placement');
      if (terrain.water[gate]) this.fail(p + '.facing', 'gate is on water at (' + gx + ', ' + gy + ')');
      if (occupied[gate] >= 0) this.fail(p + '.facing', 'gate overlaps buildings[' + occupied[gate] + ']');
      for (let y = b.y; y < b.y + def.h; y++) {
        for (let x = b.x; x < b.x + def.w; x++) occupied[y * w + x] = i;
      }
      gates[gate] = i;
    }
    for (let i = 0; i < mission.roads.length; i++) {
      const poly = mission.roads[i]!;
      for (let j = 1; j < poly.length; j++) {
        const a = poly[j - 1]!, b = poly[j]!;
        const start = a[1] * w + a[0], end = b[1] * w + b[0];
        for (const cell of lineCells(w, start, end)) {
          if (occupied[cell] >= 0) {
            this.fail(path + '.roads[' + i + '][' + j + ']', 'road crosses buildings[' + occupied[cell] + '] footprint');
          }
        }
      }
    }
  }
}

/** Decode unknown data; errors include a JSON field path and source name. */
export function parseMissionData(value: unknown, source = 'mission data'): MissionData {
  const reader = new Reader(source);
  const obj = reader.object(value, '$');
  reader.keys(obj, '$', ['formatVersion', 'mission', 'valley']);
  if (obj.formatVersion !== MISSION_FORMAT_VERSION) {
    reader.fail('$.formatVersion', 'unsupported version ' + String(obj.formatVersion) + ' (expected 1)');
  }
  const valley = reader.valley(obj.valley, '$.valley');
  const mission = reader.mission(obj.mission, valley, '$.mission');
  return { formatVersion: MISSION_FORMAT_VERSION, mission, valley };
}

/** Parse JSON text without Node, DOM, JSON imports, or other runtime dependencies. */
export function parseMissionJson(text: string, source = 'mission JSON'): MissionData {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new MissionDataError(source, '$', 'invalid JSON: ' + String(error));
  }
  return parseMissionData(value, source);
}
