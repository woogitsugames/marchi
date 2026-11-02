// Docs vs code (brief 06 task 10): the numbers the design pages quote match the sim data.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILDINGS, COST_COBBLE, COST_DIRT, COST_STONE_BRIDGE, COST_WOOD_BRIDGE, MISSIONS, SPEED_COBBLE, SPEED_DIRT, SPEED_STONE_BRIDGE, SPEED_WOOD_BRIDGE, TICK_HZ, WAGON_PRICE } from '../src/sim/index';
import { assert, test } from './harness';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

test('DESIGN.md quotes the sim numbers (speeds, costs, cycle times, mission I start)', () => {
  const d = read('../docs/DESIGN.md');
  const want = [
    `| Dirt track (grunt) | ${COST_DIRT} | ${SPEED_DIRT.toFixed(1)} m/s`, `${SPEED_WOOD_BRIDGE.toFixed(1)} m/s`, `${COST_WOOD_BRIDGE} / cell`,
    `| Cobbles (bruk) | ${COST_COBBLE} | ${SPEED_COBBLE.toFixed(1)} m/s`, `${SPEED_STONE_BRIDGE.toFixed(1)} m/s`, `${COST_STONE_BRIDGE} / cell`,
    `| Woodcutter (drwal) | 2×2 | → 1 wood | ${BUILDINGS.woodcutter.recipe!.ticks / TICK_HZ} s`,
    `| Sawmill (tartak) | 3×2 | 1 wood → 2 planks | ${BUILDINGS.sawmill.recipe!.ticks / TICK_HZ} s`,
    `| Farm (farma) | 3×3 | → 1 grain | ${BUILDINGS.farm.recipe!.ticks / TICK_HZ} s`,
    `| Mill (młyn) | 2×2 | 1 grain → 1 flour | ${BUILDINGS.mill.recipe!.ticks / TICK_HZ} s`,
    `| Bakery (piekarnia) | 2×2 | 1 flour → 2 bread | ${BUILDINGS.bakery.recipe!.ticks / TICK_HZ} s`,
    `${MISSIONS.m1!.coins} coins`, `Wagon costs ${WAGON_PRICE}`, `Deadline: ${MISSIONS.m1!.deadlineMin} sim-minutes`,
  ];
  const missing = want.filter((w) => !d.includes(w));
  assert(missing.length === 0, `DESIGN.md out of date with the code:\n${missing.join('\n')}`);
});

test('docs/missions/m2.md quotes mission II as registered', () => {
  const d = read('../docs/missions/m2.md'), m = MISSIONS.m2!;
  const mmss = (min: number) => `${String(Math.floor(min)).padStart(2, '0')}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;
  const want = [
    `**${m.contract!.planks} desek`, `${m.contract!.bread} bochenków`, `termin **${mmss(m.deadlineMin)}**`,
    `do ${mmss(m.star3Min)}`, `**2** do ${mmss(m.star2Min)}`, `**${m.coins} srebra, ${m.wagons} wozów**`,
  ];
  const missing = want.filter((w) => !d.includes(w));
  assert(missing.length === 0, `m2.md out of date with the code:\n${missing.join('\n')}`);
});
