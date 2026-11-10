// D-490/D-491: buildings listed together in one sheet are numbered when names repeat; an empty "Naprawa" header hides.
import { readFileSync } from 'node:fs';
import { numberRepeats } from '../src/ui/buildingLabels';
import { createWorld } from '../src/sim/index';
import { assert, eq, test } from './harness';

test('sheet labels: repeated names get a stable number by id, a single name stays plain', () => {
  const w = createWorld('m2');
  const st = w.state;
  const add = (type: string) => {
    const proto = st.buildings[0]!;
    const id = Math.max(0, ...st.buildings.map((b) => b.id)) + 1;
    st.buildings.push({ ...proto, id, type: type as typeof proto.type });
    return id;
  };
  const nameOf = (id: number) => (st.buildings.find((x) => x.id === id)!.type === 'fisher' ? 'Chata rybaka' : 'Spichlerz');
  const buildingLabels = (world: typeof w, ids: number[]) => numberRepeats(world, ids, nameOf);
  const a = add('fisher'), b = add('fisher'), c = add('fisher'), g = add('granary');
  const all = buildingLabels(w, [c, a, b, g]);
  const base = buildingLabels(w, [a]).get(a)!;
  assert(!/\d$/.test(base), 'a lone building has no number');
  const [la, lb, lc] = [all.get(a)!, all.get(b)!, all.get(c)!];
  assert(/ \d+$/.test(la) && /\d+$/.test(lb) && /\d+$/.test(lc), 'numbered');
  eq(new Set([la, lb, lc]).size, 3, 'distinct');
  eq(la.startsWith(base), true, 'name kept');
  eq(buildingLabels(w, [b, c]).get(b), all.get(b), 'number does not depend on the list');
  assert(!/\d$/.test(all.get(g)!), 'single granary plain');
});

test('sheet header: the "Naprawa" header over the docked fix is hidden by CSS', () => {
  const css = readFileSync(new URL('../src/styles/main.css', import.meta.url), 'utf8');
  assert(/\.section-h:has\(\+ \.fix-dock\)\s*\{\s*display:\s*none/.test(css), 'rule present');
});
