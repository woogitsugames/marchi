// Animated yard workers (night 2: woodcutter, miller, baker; night 6: two sawyers, the farmer, the fisherman).
// Render-only data: budget per figure, one mesh per rig piece, spots on the footprint, rest pose still.
import { BUILDING_KINDS, buildingModel } from '../src/render/models/buildings';
import { triangles } from '../src/render/models/kit';
import { WORKER_KINDS, type WorkerPose, workerPose, workerRig } from '../src/render/models/people';
import { assert, eq, test } from './harness';

test('workers: every kind stays near ~1.1k triangles and draws in one call per rig piece', () => {
  for (const kind of WORKER_KINDS) {
    const r = workerRig(kind, 1);
    const tris = triangles(r.legs) + triangles(r.torso) + triangles(r.arms);
    assert(tris <= 1300, `${kind}: ${tris} triangles per figure`);
    eq(r.legs.length + r.torso.length + r.arms.length, 3, `${kind}: three meshes`);
    if (r.tool) assert(r.tool.length === 1 && triangles(r.tool) <= 200, `${kind}: the free tool is one small mesh`);
  }
});

test('workers: the new yards have their workers; spots stay on the footprint', () => {
  const want: Record<string, string> = { sawmill: 'sawTop,sawPit', fisher: 'net', woodcutter: 'chop', mill: 'sack', bakery: 'peel' };
  for (const kind of BUILDING_KINDS) {
    const m = buildingModel(kind);
    const ws = m.workers ?? [];
    if (want[kind]) eq(ws.map((w) => w.kind).join(','), want[kind], `${kind} workers`);
    const hx = (m.cells[0] * 4) / 2, hz = (m.cells[1] * 4) / 2;
    for (const w of [...ws, ...(m.fieldWorker ? [m.fieldWorker] : [])]) {
      assert(Math.abs(w.at.x) < hx && Math.abs(w.at.z) < hz, `${kind}: ${w.kind} at ${w.at.x},${w.at.z} on the footprint`);
    }
  }
  eq(buildingModel('farm').fieldWorker?.kind, 'hoe', 'the farmer goes out to the field');
});

test('workers: at rest nobody moves the saw; both sawyers share one stroke', () => {
  const a: WorkerPose = { bend: 0, arm: 0, lift: 0 }, b: WorkerPose = { bend: 0, arm: 0, lift: 0 };
  for (const kind of WORKER_KINDS) {
    workerPose(kind, 3.3, false, a);
    eq(a.lift, 0, `${kind}: rest lift`);
    assert(Math.abs(a.bend) < 0.06, `${kind}: rest bend ${a.bend}`);
  }
  for (let t = 0; t < 3; t += 0.1) {
    workerPose('sawTop', t, true, a);
    workerPose('sawPit', t, true, b);
    eq(a.lift, b.lift, `same saw stroke at ${t.toFixed(1)} s`);
    assert(Math.abs(a.lift) <= 0.17 + 1e-9, 'stroke within the kerf');
  }
});
