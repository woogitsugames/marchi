// D-380 (BACKLOG P2 from D-267): the free valley's grow / rank card names a pair — the producer and its consumer — when
// one more producer lets the consumer grow by the same ratio rules and silver covers both with the fleet's reserve.
import { BUILDINGS, type BuildingType } from '../src/sim/index';
import { FLEET_FREE_KEEP, growThen } from '../src/ui/paceCard';
import { eq, test } from './harness';

const ALL: BuildingType[] = ['farm', 'mill', 'bakery', 'woodcutter', 'sawmill', 'malthouse', 'brewery'];
const counts = (c: Partial<Record<BuildingType, number>>) => (t: BuildingType): number => c[t] ?? 0;
const rich = 1e6;

test('grow pair: malthouse + brewery while the brewery stays below the malthouses', () => {
  eq(growThen('malthouse', counts({ malthouse: 1, brewery: 1 }), ALL, rich), 'brewery', '');
  eq(growThen('malthouse', counts({ malthouse: 2, brewery: 1 }), ALL, rich), 'brewery', '');
  // as many breweries as the malthouses will be: no room for another brewery
  eq(growThen('malthouse', counts({ malthouse: 2, brewery: 3 }), ALL, rich), undefined, '');
});

test('grow pair: none before the consumer unlocks (D-267, the brewery at rank 4)', () => {
  eq(growThen('malthouse', counts({ malthouse: 1 }), ALL.filter((t) => t !== 'brewery'), rich), undefined, '');
});

test('grow pair: the consumer\'s own consumer keeps up (farm + mill only while mills <= bakeries)', () => {
  eq(growThen('farm', counts({ farm: 2, mill: 2, bakery: 2 }), ALL, rich), 'mill', '');
  eq(growThen('farm', counts({ farm: 3, mill: 3, bakery: 2 }), ALL, rich), undefined, '');
});

test('grow pair: silver for both plus the fleet reserve, else the single building', () => {
  const both = BUILDINGS.malthouse.price + BUILDINGS.brewery.price + FLEET_FREE_KEEP;
  eq(growThen('malthouse', counts({ malthouse: 1, brewery: 1 }), ALL, both), 'brewery', '');
  eq(growThen('malthouse', counts({ malthouse: 1, brewery: 1 }), ALL, both - 1), undefined, '');
});

test('grow pair: an end of chain has no pair', () => {
  eq(growThen('bakery', counts({ farm: 3, mill: 3, bakery: 1 }), ALL, rich), undefined, '');
  eq(growThen('brewery', counts({ malthouse: 3, brewery: 1 }), ALL, rich), undefined, '');
});
