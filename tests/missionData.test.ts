import { deepStrictEqual, throws } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, stateHash, step } from '../src/sim/sim';
import { MISSIONS, valleySpec } from '../src/sim/missions';
import { M2_VALLEY, M3_VALLEY } from '../src/sim/missions-proposed';
import { generateValley } from '../src/sim/terrain';
import { MISSION_FORMAT_VERSION, MissionDataError, parseMissionData, parseMissionJson } from '../src/sim/missionData';
import { eq, test } from './harness';

const ids = ['m1', 'm2', 'm3'] as const;
const existingValleys = { m1: valleySpec(1301), m2: M2_VALLEY, m3: M3_VALLEY };

function textFor(id: string): string {
  return readFileSync(new URL('../missions/' + id + '.json', import.meta.url), 'utf8');
}

function mutated(id: string, edit: (value: any) => void, expectedPath: string): void {
  const obj: any = JSON.parse(textFor(id));
  edit(obj);
  throws(() => parseMissionData(obj, 'missions/invalid.json'), (error: unknown) => {
    return error instanceof MissionDataError
      && error.path === expectedPath
      && error.message.includes('missions/invalid.json: ' + expectedPath + ':');
  });
}

for (const id of ids) {
  test(id + ': JSON exactly preserves MissionDef, ValleySpec and 600-tick stateHash', () => {
    const parsed = parseMissionJson(textFor(id), 'missions/' + id + '.json');
    eq(parsed.formatVersion, MISSION_FORMAT_VERSION, 'format version');
    deepStrictEqual(parsed.mission, MISSIONS[id], 'mission definition must be identical');
    deepStrictEqual(parsed.valley, existingValleys[id], 'valley definition must be identical');

    const before = createWorld(id);
    deepStrictEqual(generateValley({ ...parsed.valley, seed: parsed.mission.seed }), before.terrain,
      'terrain generated from JSON must match current map');
    const original = MISSIONS[id]!;
    try {
      MISSIONS[id] = parsed.mission;
      const fromJson = createWorld(id);
      for (let tick = 0; tick < 600; tick++) {
        step(before);
        step(fromJson);
      }
      eq(stateHash(fromJson), stateHash(before), id + ' at tick 600');
    } finally {
      MISSIONS[id] = original;
    }
  });
}

test('JSON syntax errors include the source and root path', () => {
  throws(() => parseMissionJson('{', 'missions/broken.json'), (e: unknown) =>
    e instanceof MissionDataError && e.path === '$' && e.message.includes('missions/broken.json'));
});

test('format versions and unknown fields are rejected', () => {
  mutated('m1', (v) => { v.formatVersion = 2; }, '$.formatVersion');
  mutated('m1', (v) => { v.mission.unexpected = true; }, '$.mission.unexpected');
  mutated('m1', (v) => { delete v.valley.fields; }, '$.valley.fields');
});

test('numeric ranges, types and goods names are checked', () => {
  mutated('m1', (v) => { v.mission.wagons = -1; }, '$.mission.wagons');
  mutated('m1', (v) => { v.mission.coins = 1.5; }, '$.mission.coins');
  mutated('m1', (v) => { v.mission.buildings[0].type = 'dragon'; }, '$.mission.buildings[0].type');
  mutated('m1', (v) => { v.mission.buildings[0].stock.gold = 1; }, '$.mission.buildings[0].stock.gold');
  mutated('m1', (v) => { v.mission.roadsOverWater = 'yes'; }, '$.mission.roadsOverWater');
});

test('building footprint, gate and overlaps are checked against the map', () => {
  mutated('m1', (v) => { v.mission.buildings[0].x = 95; }, '$.mission.buildings[0].x');
  mutated('m1', (v) => { v.mission.buildings[0].y = 70; }, '$.mission.buildings[0].facing');
  mutated('m1', (v) => {
    v.mission.buildings[1].x = 14;
    v.mission.buildings[1].y = 13;
  }, '$.mission.buildings[1]');
  mutated('m2', (v) => { v.mission.buildings[3].y = 30; }, '$.mission.buildings[3].facing');
});

test('road waypoints must stay on the map', () => {
  mutated('m1', (v) => { v.mission.roads[0][0][0] = 96; }, '$.mission.roads[0][0][0]');
});

test('the contract requires a castle, full goods map and ordered deadlines', () => {
  mutated('m1', (v) => { v.mission.buildings.pop(); }, '$.mission.buildings');
  mutated('m1', (v) => { delete v.mission.contract.planks; }, '$.mission.contract.planks');
  mutated('m1', (v) => { v.mission.contract.bread = -1; }, '$.mission.contract.bread');
  mutated('m1', (v) => { v.mission.star3Min = 20; }, '$.mission.star3Min');
});

test('river control points, field rectangles and rain intervals are validated', () => {
  mutated('m1', (v) => { v.valley.riverHalfWidth.pop(); }, '$.valley.riverHalfWidth');
  mutated('m1', (v) => { v.valley.fields[0].x = 95; }, '$.valley.fields[0].w');
  mutated('m3', (v) => { v.mission.rain[0].end = 200; }, '$.mission.rain[0].end');
  mutated('m3', (v) => { v.mission.rain.push({ start: 6900, end: 8000 }); }, '$.mission.rain[1].start');
});
