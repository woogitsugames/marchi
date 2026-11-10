// Repeated building names in one sheet (D-490). Pure: no i18n, so it runs headless in tests.
import { buildingById, type World } from '../sim/index';

/**
 * Labels for the buildings listed together: when two or more share a name, each gets its number among the buildings
 * of its type, by id ("Chata rybaka 1, 2, 3" — the number stays with the building, not with the list); a name that
 * appears once stays plain. Castles keep their own names.
 */
export function numberRepeats(world: World, ids: readonly number[], nameOf: (id: number) => string): Map<number, string> {
  const out = new Map<number, string>();
  const count = new Map<string, number>();
  for (const id of ids) {
    const n = nameOf(id);
    out.set(id, n);
    count.set(n, (count.get(n) ?? 0) + 1);
  }
  for (const id of ids) {
    const b = buildingById(world, id);
    const base = out.get(id)!;
    if (!b || b.type === 'castle' || (count.get(base) ?? 0) < 2) continue;
    let n = 1;
    for (const o of world.state.buildings) if (o.type === b.type && o.id < id) n++;
    out.set(id, `${base} ${n}`);
  }
  return out;
}
