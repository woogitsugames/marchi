// Instanced copies of a multi-material model (one InstancedMesh per material part), filled per frame:
// begin(), push(matrix) per instance, end(). Shared by the wagons and the yard workers.
import { type BufferAttribute, type BufferGeometry, type Group, InstancedMesh, type Material, type Matrix4 } from 'three';
import type { ModelPart } from './models/kit';
import { instancedMaterial } from './models/materials';

/**
 * Mark the first `n` instances of a per-instance attribute for upload. Only that prefix goes to the GPU
 * (bufferSubData of n * itemSize floats) instead of the whole capacity: the instance buffers are sized for the
 * worst case (200+ wagons, every tree near) and were re-sent in full every frame (research 2026-11-04 "Poprawki" #1:
 * ~640 -> ~35 KB per frame). n = 0 uploads nothing; the mesh is hidden or drawn with count 0.
 */
export function markInstances(a: BufferAttribute, n: number): void {
  if (n <= 0) return;
  a.clearUpdateRanges();
  a.addUpdateRange(0, n * a.itemSize);
  a.needsUpdate = true;
}

export class Parts {
  readonly meshes: InstancedMesh[];
  count = 0;
  constructor(parts: ModelPart[], readonly cap: number, group: Group, name: string, mat?: (p: ModelPart) => Material, geo?: (g: BufferGeometry) => BufferGeometry) {
    this.meshes = parts.map((p) => {
      const m = new InstancedMesh(geo ? geo(p.geometry) : p.geometry, mat ? mat(p) : (instancedMaterial(p.material) as Material), cap);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = name;
      group.add(m);
      return m;
    });
  }
  begin(): void { this.count = 0; }
  push(mat: Matrix4): number {
    const i = this.count++;
    for (const m of this.meshes) m.setMatrixAt(i, mat);
    return i;
  }
  end(): void {
    for (const m of this.meshes) {
      m.count = this.count;
      m.visible = this.count > 0;
      markInstances(m.instanceMatrix, this.count);
    }
  }
  setShadow(on: boolean): void { for (const m of this.meshes) m.castShadow = on; }
}

