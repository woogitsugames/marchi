/**
 * Standalone preview of the procedural models (`src/render/models/`).
 * Run `npx vite` at the repo root and open /tools/model-preview.html?view=overview
 * Views: overview, wagons, close, far, buildings, castle, trees, bridges, chains (D-29 buildings and loads).
 */
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  BufferAttribute,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CARGO_GOODS, type CargoGood, cargoParts } from '../src/render/models/cargo';
import { fnoise, type ModelPart, triangles, trs } from '../src/render/models/kit';
import { modelMaterial } from '../src/render/models/materials';
import { addHorsePoseAttributes, createHorseMaterial, wagonLod1, wagonModel, writeHorsePose } from '../src/render/models/wagon';
import { horsePose, POSE_SIZE } from '../src/render/gait';
import { BUILDING_KINDS, buildingModel, CHAIN_KINDS, PROP_KINDS, propParts } from '../src/render/models/buildings';
import { bakeTreeBillboards, billboardDepthMaterial, treeBillboard, treeParts, TREE_KINDS, TREE_SIZE, TREE_VARIANTS } from '../src/render/models/trees';
import { bridgeParts } from '../src/render/models/bridges';
import { workerParts } from '../src/render/models/people';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'overview';
const tone = params.get('tone') ?? 'agx';

const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = tone === 'aces' ? ACESFilmicToneMapping : AgXToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const MIST = new Color('#c9c6bb');
const scene = new Scene();
scene.background = MIST;
scene.fog = new FogExp2(MIST, view === 'far' || view === 'overview' ? 0.0032 : 0.005);

const hemi = new HemisphereLight('#c4c6c4', '#4a3f33', 1.25);
scene.add(hemi);
const sun = new DirectionalLight('#ffd6ad', 3.2);
// low sun (≈18°) from the south-west-ish, shadows fall toward the camera's right
const sunDir = new Vector3(-0.62, 0.33, 0.55).normalize();
sun.position.copy(sunDir).multiplyScalar(120);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 300;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- ground
{
  const g = new PlaneGeometry(400, 400, 200, 200);
  g.rotateX(-Math.PI / 2);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const mud = new Color('#5a4a39'), meadow = new Color('#56603f'), road = new Color('#4a3d2f');
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = fnoise(x * 0.08, 0, z * 0.08, 5) * 0.5 + 0.5;
    c.copy(meadow).lerp(mud, Math.min(1, Math.max(0, n * 1.4 - 0.25)));
    // the convoy road along X at z≈0, and a strip of water for bridges at x≈-40
    const dRoad = Math.abs(z - 0) - 2.0 + fnoise(x * 0.3, 1, 0, 2) * 0.4;
    if (dRoad < 0) c.lerp(road, 0.85);
    const fine = 1 + fnoise(x * 1.3, 2, z * 1.3, 9) * 0.07;
    c.multiplyScalar(fine);
    col.set([c.r, c.g, c.b], i * 3);
    // river channel: banks drop ~1.9 m around x = -44
    const dr = Math.abs(x + 44);
    const bed = dr < 5 ? -1.9 : dr < 7 ? -1.9 * (1 - (dr - 5) / 2) : 0;
    pos.setY(i, fnoise(x * 0.05, 4, z * 0.05, 3) * 0.12 + bed);
    if (dr < 7) c.lerp(mud, 0.6);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.computeVertexNormals();
  const ground = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
  // river channel for the bridges: a sunk grey-green plane
  const water = new Mesh(new PlaneGeometry(12, 120), new MeshStandardMaterial({ color: '#4c5b5c', roughness: 0.25, metalness: 0 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-44, -1.2, -10);
  water.receiveShadow = true;
  scene.add(water);
}

// ---------------------------------------------------------------- helpers
const stats: string[] = [];
/** Scene children up to here (lights, ground, water) stay visible in every view. */
const baseChildren = scene.children.length;

function addParts(parts: ModelPart[], m: Matrix4, shadow = true): void {
  for (const p of parts) {
    const mesh = new Mesh(p.geometry, modelMaterial(p.material));
    mesh.applyMatrix4(m);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function addInstanced(parts: ModelPart[], ms: Matrix4[], material?: MeshStandardMaterial): void {
  for (const p of parts) {
    const im = new InstancedMesh(p.geometry, material ?? modelMaterial(p.material), ms.length);
    ms.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    // far tree cards cast one soft blob, as in the game
    if (p.material === 'billboard') im.customDepthMaterial = billboardDepthMaterial();
    scene.add(im);
  }
}

// ---------------------------------------------------------------- wagons (convoy on the road)
const wm = wagonModel();
const horseMat = createHorseMaterial();
/** Posed horses: gait phase per rig, walk/trot blend from ?gait=walk|trot (default walk). */
const horses: { im: InstancedMesh; attrs: ReturnType<typeof addHorsePoseAttributes>; phases: number[] }[] = [];
const gaitB = params.get('gait') === 'trot' ? 1 : 0;
function addHorses(ms: Matrix4[], phase0 = 0.12): void {
  for (const p of wm.horse) {
    const g = p.geometry.clone();
    const attrs = addHorsePoseAttributes(g, ms.length);
    const im = new InstancedMesh(g, horseMat.material, ms.length);
    im.customDepthMaterial = horseMat.depth;
    ms.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
    horses.push({ im, attrs, phases: ms.map((_, i) => phase0 + i * 0.37) });
  }
}
const _pose = new Float32Array(POSE_SIZE);
function poseHorses(t: number): void {
  for (const h of horses) {
    h.phases.forEach((ph, i) => {
      horsePose(ph + t, gaitB, 1, _pose);
      writeHorsePose(h.attrs, i, _pose);
    });
    for (const a of h.attrs) a.needsUpdate = true;
  }
}
const BASE_GOODS: CargoGood[] = ['wood', 'planks', 'grain', 'flour', 'bread'];
const CHAIN_GOODS: CargoGood[] = CARGO_GOODS.filter((g) => !BASE_GOODS.includes(g));
const goods = [null, ...BASE_GOODS] as const;
{
  const rigs: Matrix4[] = [];
  goods.forEach((good, i) => {
    const m = trs(-14 + i * 9, 0, 0, 0, Math.PI / 2, 0);
    rigs.push(m);
    if (good) addParts(cargoParts(good, 6), m);
  });
  addInstanced(wm.body, rigs);
  addInstanced(wm.driver, rigs);
  addHorses(rigs);
  for (const w of wm.wheels) {
    const parts = w.kind === 'front' ? wm.wheelFront : wm.wheelRear;
    addInstanced(parts, rigs.map((r, i) => r.clone().multiply(new Matrix4().makeTranslation(w.position)).multiply(new Matrix4().makeRotationX(i * 0.7))));
  }
  // quantity ramp 1..6 for wood and grain, and LOD1 rigs, along a second track
  for (let q = 1; q <= 6; q++) {
    const m = trs(-14 + (q - 1) * 9, 0, -7, 0, Math.PI / 2, 0);
    addParts(cargoParts(q % 2 ? 'grain' : 'flour', q), m);
    addParts(wagonLod1(), m);
  }
  const t = (parts: ModelPart[]) => triangles(parts);
  const rig = t(wm.body) + t(wm.driver) + t(wm.horse) + 2 * t(wm.wheelFront) + 2 * t(wm.wheelRear);
  stats.push(`wagon LOD0 rig ${rig} tris (body ${t(wm.body)}, wheel F ${t(wm.wheelFront)} R ${t(wm.wheelRear)}, horse ${t(wm.horse)}, driver ${t(wm.driver)})`);
  const wmid = wagonModel('mid');
  stats.push(`wagon mid rig ${t(wmid.body) + t(wmid.driver) + t(wmid.horse) + 2 * t(wmid.wheelFront) + 2 * t(wmid.wheelRear)} tris (wheel F ${t(wmid.wheelFront)} R ${t(wmid.wheelRear)}, horse ${t(wmid.horse)}, driver ${t(wmid.driver)})`);
  stats.push(`wagon LOD1 ${t(wagonLod1())} tris`);
  stats.push('cargo x6: ' + BASE_GOODS.map((g) => `${g} ${t(cargoParts(g, 6))}`).join(', '));
}

// ---------------------------------------------------------------- buildings
{
  let x = -30;
  for (const kind of BUILDING_KINDS.filter((k) => !CHAIN_KINDS.includes(k))) {
    const bm = buildingModel(kind);
    const w = bm.cells[0] * 4, d = bm.cells[1] * 4;
    const z = -16 - d / 2;
    const m = trs(x + w / 2, 0, z);
    // footprint plate so the grid fit is visible
    const plate = new Mesh(new PlaneGeometry(w - 0.1, d - 0.1), new MeshStandardMaterial({ color: '#5a4a39', roughness: 1 }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(x + w / 2, 0.02, z);
    plate.receiveShadow = true;
    scene.add(plate);
    addParts(bm.parts, m);
    if (bm.wheel) addParts(bm.wheel.parts, m.clone().multiply(new Matrix4().makeTranslation(bm.wheel.pivot)));
    stats.push(`${kind} ${w}x${d} m: ${triangles(bm.parts) + (bm.wheel ? triangles(bm.wheel.parts) : 0)} tris`);
    x += w + 2;
  }
  let px = -14;
  for (const kind of PROP_KINDS) {
    addParts(propParts(kind), trs(px, 0, 6.5, 0, 0.4));
    stats.push(`prop ${kind}: ${triangles(propParts(kind))} tris`);
    px += kind === 'fence' ? 5 : 2.5;
  }
  for (let i = 0; i < 4; i++) addParts(workerParts(i, i === 3 ? 'work' : 'stand'), trs(px + i * 1.2, 0, 6.5, 0, -0.6 + i * 0.5));
  stats.push(`worker: ${triangles(workerParts(0))} tris`);
}

// ---------------------------------------------------------------- D-29 chains: buildings in a row at z≈22
// facing the camera (+Z), a pond behind the fisher, and a convoy with the new loads in front
const chainFrom = scene.children.length;
{
  let x = -30;
  for (const kind of CHAIN_KINDS) {
    const bm = buildingModel(kind);
    const w = bm.cells[0] * 4, d = bm.cells[1] * 4;
    const z = 22;
    const plate = new Mesh(new PlaneGeometry(w - 0.1, d - 0.1), new MeshStandardMaterial({ color: '#5a4a39', roughness: 1 }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(x + w / 2, 0.02, z);
    plate.receiveShadow = true;
    scene.add(plate);
    addParts(bm.parts, trs(x + w / 2, 0, z));
    if (kind === 'fisher') {
      const pond = new Mesh(new PlaneGeometry(6.5, 7), new MeshStandardMaterial({ color: '#4c5b5c', roughness: 0.25 }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(x + w / 2 + 3.4, 0.06, z - 4.2);
      pond.receiveShadow = true;
      scene.add(pond);
    }
    const tris = triangles(bm.parts);
    stats.push(`${kind} ${w}x${d} m: ${tris} tris, gate ${bm.gate.toArray().map((v) => v.toFixed(1)).join(',')}${bm.smoke ? ', smoke' : ''}`);
    x += w + 3;
  }
  const rigs: Matrix4[] = [];
  CHAIN_GOODS.forEach((good, i) => {
    const m = trs(-23 + i * 10.5, 0, 33, 0, Math.PI / 2 + 0.25, 0);
    rigs.push(m);
    addParts(cargoParts(good, good === 'stone' ? 4 : 6), m);
  });
  // partial loads (a stone wagon takes 4) and the crate fallback for goods without a load model
  const ramps: [CargoGood, number][][] = [
    [['stone', 1], ['stone', 2], ['stone', 3], ['beer', 2], ['beer', 4], ['crate', 6]],
    [['fish', 2], ['charcoal', 3], ['malt', 2], ['malt', 4], ['charcoal', 5], ['fish', 4]],
  ];
  ramps.forEach((row, r) => row.forEach(([g, q], i) => {
    const m = trs(-25 + i * 9 + r * 2, 0, 40 + r * 7, 0, Math.PI / 2 + 0.25, 0);
    rigs.push(m);
    addParts(cargoParts(g, q), m);
  }));
  addInstanced(wm.body, rigs);
  addInstanced(wm.driver, rigs);
  addHorses(rigs);
  for (const w of wm.wheels) {
    const parts = w.kind === 'front' ? wm.wheelFront : wm.wheelRear;
    addInstanced(parts, rigs.map((r, i) => r.clone().multiply(new Matrix4().makeTranslation(w.position)).multiply(new Matrix4().makeRotationX(i * 0.7))));
  }
  stats.push('chain cargo: ' + CHAIN_GOODS.map((g) => `${g} x${g === 'stone' ? 4 : 6} ${triangles(cargoParts(g, g === 'stone' ? 4 : 6))}`).join(', '));
}

const chainTo = scene.children.length;

// ---------------------------------------------------------------- people line-up (close-up view 'people')
{
  for (let i = 0; i < 4; i++) addParts(workerParts(i, i === 3 ? 'work' : 'stand'), trs(58 + i * 1.1, 0, 60, 0, -0.35 + i * 0.25));
  // a lone rig beside them so the seated driver can be seen up close
  const m = trs(64, 0, 59, 0, Math.PI / 2 + 0.5, 0);
  addInstanced(wm.body, [m]);
  addInstanced(wm.driver, [m]);
  addHorses([m], 0.4);
  for (const w of wm.wheels) addInstanced(w.kind === 'front' ? wm.wheelFront : wm.wheelRear, [m.clone().multiply(new Matrix4().makeTranslation(w.position))]);
}

// ---------------------------------------------------------------- trees
// Overview rows at x 80–108 (full models left, far cards right). Close-up views `tree-<kind>`
// show one species alone: both variants (and a rotated copy) beside three far cards.
bakeTreeBillboards(renderer);
const treeObjs = new Map<string, Object3D[]>();
{
  TREE_KINDS.forEach((kind, k) => {
    const from = scene.children.length;
    const near: Matrix4[][] = [[], []];
    const far: Matrix4[] = [];
    for (let i = 0; i < 6; i++) {
      const s = 0.85 + ((i * 37) % 10) / 30;
      near[i % TREE_VARIANTS]!.push(trs(80 + (i % 3) * 5 + k * 1.3, 0, -4 - k * 6 - Math.floor(i / 3) * 3.5, 0, i * 1.3, 0, s));
      far.push(trs(98 + (i % 3) * 5, 0, -4 - k * 6 - Math.floor(i / 3) * 3.5, 0, i * 1.3, 0, s));
    }
    for (let v = 0; v < TREE_VARIANTS; v++) addInstanced(treeParts(kind, v), near[v]!);
    const bb = treeBillboard(kind);
    addInstanced(bb, far);
    const sp = TREE_SIZE[kind].radius * 2.4 + 1;
    const cz = 70 + k * 28;
    for (let v = 0; v < 3; v++) addInstanced(treeParts(kind, v % TREE_VARIANTS), [trs(-1.5 * sp + v * sp, 0, cz, 0, v * 2.1, 0)]);
    addInstanced(bb, [0, 1, 2].map((i) => trs(1.7 * sp + i * sp, 0, cz, 0, i * 2.1, 0)));
    treeObjs.set(kind, scene.children.slice(from));
    stats.push(`tree ${kind}: ${Array.from({ length: TREE_VARIANTS }, (_, v) => triangles(treeParts(kind, v))).join('/')} tris, billboard ${triangles(bb)}`);
  });
}

// ---------------------------------------------------------------- bridges (across the river at x≈-44)
{
  for (let i = 0; i < 3; i++) addParts(bridgeParts('wood'), trs(-48 + i * 4, 0, -2, 0, Math.PI / 2));
  for (let i = 0; i < 3; i++) addParts(bridgeParts('stone'), trs(-48 + i * 4, 0, -22, 0, Math.PI / 2));
  stats.push(`bridge wood ${triangles(bridgeParts('wood'))} / stone ${triangles(bridgeParts('stone'))} tris per 4 m cell`);
}

// ---------------------------------------------------------------- camera views
const camera = new PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.5, 900);
const views: Record<string, [Vector3, Vector3]> = {
  overview: [new Vector3(70, 75, 100), new Vector3(25, 0, -10)],
  wagons: [new Vector3(16, 30, 52), new Vector3(14, 0.5, -3)],
  close: [new Vector3(-6.5, 3.2, 8.5), new Vector3(-11, 1.2, 0)],
  far: [new Vector3(75, 110, 150), new Vector3(30, 0, -8)],
  buildings: [new Vector3(10, 32, 30), new Vector3(10, 2, -22)],
  castle: [new Vector3(50, 30, 14), new Vector3(64, 5, -24)],
  bwest: [new Vector3(-10, 26, 22), new Vector3(-12, 2, -20)],
  trees: [new Vector3(108, 16, 26), new Vector3(90, 5, -12)],
  bridges: [new Vector3(-28, 14, 12), new Vector3(-44, 0, -12)],
  props: [new Vector3(2, 5, 16), new Vector3(-2, 0.8, 6)],
  mill: [new Vector3(25, 8, -9), new Vector3(12, 2, -20)],
  chains: [new Vector3(0, 31, 86), new Vector3(0, 0, 34)],
  chainsW: [new Vector3(-17, 13, 42), new Vector3(-17, 1.5, 21)],
  chainsE: [new Vector3(17, 16, 44), new Vector3(17, 1.5, 22)],
  chaincargo: [new Vector3(-14, 10, 50), new Vector3(-12, 1, 36)],
  // models2 close-ups: horse side view, wagon 3/4, people
  horse: [new Vector3(-10.6, 1.25, 6.2), new Vector3(-10.6, 0.95, 0)],
  wagon34: [new Vector3(-6.2, 3.4, 7.2), new Vector3(-13.6, 0.9, 0)],
  people: [new Vector3(60.2, 1.55, 64.6), new Vector3(60.4, 0.95, 60)],
  driver: [new Vector3(67.5, 2.6, 63.2), new Vector3(64.6, 1.4, 59.6)],
};
TREE_KINDS.forEach((kind, k) => {
  const H = TREE_SIZE[kind].height, sp = TREE_SIZE[kind].radius * 2.4 + 1;
  const cx = 1.1 * sp, cz = 70 + k * 28, back = sp * 5 + H * 0.5;
  views[`tree-${kind}`] = [new Vector3(cx, H * 0.55 + back * 0.12, cz + back), new Vector3(cx, H * 0.45, cz)];
});
const [eye, target] = views[view] ?? views.overview;
if (view.startsWith('tree-')) {
  const keep = new Set(treeObjs.get(view.slice(5)) ?? []);
  scene.children.forEach((c, i) => { if (i >= baseChildren && !keep.has(c)) c.visible = false; });
}
// the chain views show only the D-29 set, without the older rows behind it
if (view.startsWith('chain')) {
  scene.children.forEach((c, i) => {
    if (i >= baseChildren && (i < chainFrom || i >= chainTo)) c.visible = false;
  });
}
camera.position.copy(eye);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.update();
sun.target.position.copy(target);
sun.position.copy(target).addScaledVector(sunDir, 120);

const info = document.getElementById('info');
if (info) info.textContent = params.has('still') ? '' : stats.join('\n');
if (info && params.has('still')) info.style.display = 'none';
const nav = document.getElementById('views');
if (nav) for (const k of Object.keys(views)) {
  const a = document.createElement('a');
  a.href = `?view=${k}`;
  a.textContent = k;
  nav.appendChild(a);
}
(window as unknown as { __stats: string[] }).__stats = stats;

let frames = 0;
const t0 = performance.now();
renderer.setAnimationLoop(() => {
  poseHorses(params.has('still') ? 0 : (performance.now() - t0) / 1000 / 1.4);
  controls.update();
  renderer.render(scene, camera);
  if (++frames === 3) {
    (window as unknown as { __ready: boolean }).__ready = true;
    // screenshot mode: stop rendering so the capture is not starved by the software GL
    if (params.has('still')) renderer.setAnimationLoop(null);
  }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
