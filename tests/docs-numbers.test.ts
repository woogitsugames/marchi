// Docs vs code (brief 06 task 10): the numbers the design pages quote match the sim data.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILDINGS, COST_COBBLE, COST_DIRT, COST_STONE_BRIDGE, COST_WOOD_BRIDGE, MISSIONS, SPEED_COBBLE, SPEED_DIRT, SPEED_STONE_BRIDGE, SPEED_WOOD_BRIDGE, TICK_HZ, WAGON_PRICE } from '../src/sim/index';
import { assert, test } from './harness';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

test('DESIGN.md quotes the sim numbers (speeds, costs, cycle times, mission I start and seals)', () => {
  const d = read('../docs/DESIGN.md');
  const mmss = (min: number) => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;
  const want = [
    `| Dirt track (grunt) | ${COST_DIRT} | ${SPEED_DIRT.toFixed(1)} m/s`, `${SPEED_WOOD_BRIDGE.toFixed(1)} m/s`, `${COST_WOOD_BRIDGE} / cell`,
    `| Cobbles (bruk) | ${COST_COBBLE} | ${SPEED_COBBLE.toFixed(1)} m/s`, `${SPEED_STONE_BRIDGE.toFixed(1)} m/s`, `${COST_STONE_BRIDGE} / cell`,
    `| Woodcutter (drwal) | 2×2 | → 1 wood | ${BUILDINGS.woodcutter.recipe!.ticks / TICK_HZ} s`,
    `| Sawmill (tartak) | 3×2 | 1 wood → 2 planks | ${BUILDINGS.sawmill.recipe!.ticks / TICK_HZ} s`,
    `| Farm (farma) | 3×3 | → 1 grain | ${BUILDINGS.farm.recipe!.ticks / TICK_HZ} s`,
    `| Mill (młyn) | 2×2 | 1 grain → 1 flour | ${BUILDINGS.mill.recipe!.ticks / TICK_HZ} s`,
    `| Bakery (piekarnia) | 2×2 | 1 flour → 2 bread | ${BUILDINGS.bakery.recipe!.ticks / TICK_HZ} s`,
    `${MISSIONS.m1!.coins} coins`, `Wagon costs ${WAGON_PRICE}`, `Deadline: ${MISSIONS.m1!.deadlineMin} sim-minutes`,
    `3 seals by ${mmss(MISSIONS.m1!.star3Min)}, 2 seals by ${mmss(MISSIONS.m1!.star2Min)}`,
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

// Every mission page II-XVI: start silver and wagons, the deadline and both seal thresholds as the code has them
// (pages write times as 8:45 / 08:45 or as minutes 8,45 / 8.45 — any of these spellings counts).
test('docs/missions/m2-m17 quote start, deadline and seal thresholds as registered', () => {
  const bad: string[] = [];
  const spell = (min: number): string[] => {
    const m = Math.floor(min), s = Math.round((min - m) * 60);
    const mmss = `${m}:${String(s).padStart(2, '0')}`;
    const dec = String(Math.round(min * 100) / 100);
    return [mmss, mmss.padStart(5, '0'), dec.replace('.', ','), dec, `${dec.replace('.', ',')}${dec.includes('.') ? '' : ',0'}`];
  };
  const has = (d: string, words: string[]) => words.some((w) => new RegExp(`(^|[^\\d:,.])${w.replace(/[.]/g, '\\.')}(?![\\d]|:\\d)`).test(d));
  for (let i = 2; i <= 17; i++) {
    const id = `m${i}`, m = MISSIONS[id]!;
    const d = read(`../docs/missions/${id}.md`);
    const start = /(\d+) srebra, \**(\d+) woz/.exec(d);
    if (!start) bad.push(`${id}: no "N srebra, N wozów" start line`);
    else if (+start[1]! !== m.coins || +start[2]! !== m.wagons) bad.push(`${id}: start ${start[1]} srebra / ${start[2]} wozów, code ${m.coins} / ${m.wagons}`);
    // the quoted value next to its label: "**3** do 08:45", "3 pieczęcie ≤ 8:30", "| 2 pieczęcie | do 9,3 min",
    // "termin **12:00**", "Koniec misji | 13:00", "**1** do 12:00"; a page without the label falls back to "quoted anywhere"
    const seal = (n: number, from: number): RegExpExecArray | null => {
      const re = new RegExp(`(?<![\\d,.:])\\**${n}\\**\\s*(?:pieczę\\S*)?\\s*\\**\\s*\\|?\\s*(?:za ukończenie\\s+|zwycięstwo\\s+)?(?:do|≤)\\s*\\**\\s*(\\d+[:,]\\d+)`, 'g');
      re.lastIndex = from;
      return re.exec(d);
    };
    const val = (q: string) => (q.includes(':') ? +q.split(':')[0]! + +q.split(':')[1]! / 60 : +q.replace(',', '.'));
    const s3 = seal(3, 0), s2 = s3 ? seal(2, s3.index) : null, s1 = s2 ? seal(1, s2.index) : null;
    const term = /(?:termin|koniec misji|koniec|przed)\W{0,6}(\d+:\d\d)/i.exec(d);
    const checks: [string, number, RegExpExecArray | null][] = [['3 seals', m.star3Min, s3], ['2 seals', m.star2Min, s2], ['deadline', m.deadlineMin, term ?? s1]];
    for (const [what, v, hit] of checks) {
      if (hit) { if (Math.abs(val(hit[1]!) - v) > 0.01) bad.push(`${id}: ${what} quoted as ${hit[1]}, code ${spell(v)[0]} (${v} min)`); }
      else if (!has(d, spell(v))) bad.push(`${id}: ${what} ${spell(v)[0]} (${v} min) not quoted`);
    }
  }
  // single-letter contracts: the page names each quantity
  for (const id of ['m2', 'm3', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16', 'm17']) {
    const m = MISSIONS[id]!, d = read(`../docs/missions/${id}.md`);
    for (const [g, n] of Object.entries(m.contract ?? {})) if (n && !new RegExp(`\\b${n}\\b`).test(d)) bad.push(`${id}: contract ${n} ${g} not quoted`);
  }
  assert(bad.length === 0, `mission pages out of date with the code:\n${bad.join('\n')}`);
});
