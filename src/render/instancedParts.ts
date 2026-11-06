// Instanced copies of a multi-material model (one InstancedMesh per material part), filled per frame:
// begin(), push(matrix) per instance, end(). Shared by the wagons and the yard workers.
import { type BufferAttribute, type BufferGeometry, type Group, InstancedMesh, type Material, type Matrix4 } from 'three';
import type { ModelPart } from './models/kit';
import { instancedMaterial, shareInstancedDepth } from './models/materials';

/**
 * Mark the first `n` instances of a per-instance attribute for upload. Only that prefix goes to the GPU
 * (bufferSubData of n * itemSize floats) instead of the whole capacity: the instance buffers are sized for the
 * worst case (200+ wagons, every tree near) and were re-sent in full every frame (research 2026-11-04 "Poprawki" #1:
 * ~640 -> ~35 KB per frame). n = 0 uploads nothing; the mesh is hidden or drawn with count 0.
 */
export function markInstances(a: BufferAttribute, n: number): void {
  if (n <= 0) return;
  // one reused range object per attribute (D-223): `addUpdateRange` allocated a fresh {start, count} per attribute
  // per frame. three uploads the ranges and empties the list each render; with a single range it never merges
  // (never writes to it), so the upload is the same bufferSubData as before.
  let r = ranges.get(a);
  if (!r) { r = { start: 0, count: 0 }; ranges.set(a, r); }
  r.start = 0;
  r.count = n * a.itemSize;
  a.clearUpdateRanges();
  a.updateRanges.push(r);
  a.needsUpdate = true;
}

const ranges = new WeakMap<BufferAttribute, { start: number; count: number }>();

/**
 * Instanced copies of a model, one InstancedMesh per material part. `parts` may be a function: the model is then
 * built and its meshes created on first use (`push`, `meshes` or `build`), not up front (D-256: the mid wagon rig,
 * the far rig and the cargo of goods nobody carries yet cost ~50-90 ms before the menu was ready). Geometries made
 * by `geo` belong to these parts and go with `dispose`; the model's own (cached, shared) geometries stay.
 */
export class Parts {
  count = 0;
  private built: InstancedMesh[] | null = null;
  private shadow = true;
  private readonly owned: BufferGeometry[] = [];
  constructor(
    private readonly parts: ModelPart[] | (() => ModelPart[]),
    readonly cap: number,
    private readonly group: Group,
    private readonly name: string,
    private readonly mat?: (p: ModelPart) => Material,
    private readonly geo?: (g: BufferGeometry) => BufferGeometry,
    private readonly init?: (m: InstancedMesh) => void,
  ) {
    if (typeof parts !== 'function') this.build();
  }
  /** Created (and added to the group) yet. */
  get ready(): boolean { return this.built !== null; }
  get meshes(): InstancedMesh[] { return this.built ?? this.build(); }
  build(): InstancedMesh[] {
    if (this.built) return this.built;
    const list = typeof this.parts === 'function' ? this.parts() : this.parts;
    this.built = list.map((p) => {
      let g = p.geometry;
      if (this.geo) { g = this.geo(g); this.owned.push(g); }
      const m = new InstancedMesh(g, this.mat ? this.mat(p) : (instancedMaterial(p.material) as Material), this.cap);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = this.shadow;
      m.receiveShadow = true;
      m.name = this.name;
      shareInstancedDepth(m);
      this.init?.(m);
      this.group.add(m);
      return m;
    });
    return this.built;
  }
  begin(): void { this.count = 0; }
  push(mat: Matrix4): number {
    const i = this.count++;
    for (const m of this.meshes) m.setMatrixAt(i, mat);
    return i;
  }
  end(): void {
    if (!this.built) return; // nothing pushed since creation
    for (const m of this.built) {
      m.count = this.count;
      m.visible = this.count > 0;
      markInstances(m.instanceMatrix, this.count);
    }
  }
  setShadow(on: boolean): void {
    this.shadow = on;
    if (this.built) for (const m of this.built) m.castShadow = on;
  }
  /** Instance buffers and the geometries made by `geo`; the model's shared geometries are kept (D-256). */
  dispose(): void {
    for (const m of this.built ?? []) { this.group.remove(m); m.dispose(); }
    for (const g of this.owned) g.dispose();
    this.owned.length = 0;
    this.built = null;
  }
}
