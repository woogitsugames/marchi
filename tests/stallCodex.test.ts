import { STALL_CODEX, type CodexKey } from '../src/content/stallCodex';
import { assert, eq, test } from './harness';

const expected = [
  "status.WORKING",
  "status.IDLE",
  "status.NO_ROAD",
  "status.NO_INPUT.NONE_AVAILABLE",
  "status.NO_INPUT.UNREACHABLE",
  "status.WAITING_DELIVERY",
  "status.NO_WAGON.ALL_BUSY",
  "status.NO_WAGON.NONE_CAN_REACH",
  "status.OUTPUT_FULL.NO_WAGON",
  "status.OUTPUT_FULL.NO_DESTINATION",
  "status.WAITING_PICKUP",
  "status.STORAGE_FULL",
  "status.CONTRACT_DONE",
  "wagon.IDLE",
  "wagon.TO_PICKUP",
  "wagon.LOADING",
  "wagon.TO_DROPOFF",
  "wagon.UNLOADING",
  "wagon.RETURNING",
  "wagon.BRIDGE_JAM",
  "wagon.NO_ROUTE"
] as const satisfies readonly CodexKey[];

test('codex entries match all current status and cause variants', () => {
  eq(Object.keys(STALL_CODEX).length, expected.length, 'entry count');
  for (const key of expected) assert(STALL_CODEX[key] !== undefined, `missing ${key}`);
});

test('all PL/EN codex fields are present, short and useful', () => {
  for (const [key, translation] of Object.entries(STALL_CODEX)) {
    for (const lang of ['pl', 'en'] as const) {
      const item = translation[lang];
      eq(item.fixes.length, 2, `${key} ${lang} two fixes`);
      for (const [field, value] of Object.entries({ name: item.name, meaning: item.meaning, check: item.check, 'fix1': item.fixes[0], 'fix2': item.fixes[1], chain: item.chain })) {
        assert(value.trim().length > 0 && value.length <= 220, `${key} ${lang} ${field} invalid length ${value.length}`);
      }
    }
  }
});
