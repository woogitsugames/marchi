// Instanced copies of a multi-material model (one InstancedMesh per material part), filled per frame:
// begin(), push(matrix) per instance, end(). Shared by the wagons and the yard workers.
import { type BufferGeometry, type Group, InstancedMesh, type Material, type Matrix4 } from 'three';
import type { ModelPart } from './models/kit';
import { modelMaterial } from './models/materials';

export class Parts {
  readonly meshes: InstancedMesh[];
  count = 0;
  constructor(parts: ModelPart[], readonly cap: number, group: Group, name: string, mat?: (p: ModelPart) => Material, geo?: (g: BufferGeometry) => BufferGeometry) {
    this.meshes = parts.map((p) => {
      const m = new InstancedMesh(geo ? geo(p.geometry) : p.geometry, mat ? mat(p) : (modelMaterial(p.material) as Material), cap);
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
      if (this.count) m.instanceMatrix.needsUpdate = true;
    }
  }
  setShadow(on: boolean): void { for (const m of this.meshes) m.castShadow = on; }
}

