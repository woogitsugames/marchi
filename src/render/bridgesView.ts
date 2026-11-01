// Bridge segments: one model per water road cell, rotated along the road, deck at the sim's
// cellH. Merged into one mesh per material; rebuilt with the road network.
import { type BufferGeometry, Group, Matrix4, Mesh, type Material } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BRIDGE, bridgeParts } from './models/bridges';
import { type MatKey, modelMaterial } from './models/materials';
import type { BridgeCell } from './roads';

const KEEP = new Set(['position', 'normal', 'uv', 'color']);

export class BridgesView {
  readonly group = new Group();
  private meshes: Mesh[] = [];

  rebuild(cells: BridgeCell[]): void {
    for (const m of this.meshes) { this.group.remove(m); m.geometry.dispose(); }
    this.meshes = [];
    if (!cells.length) return;
    const byMat = new Map<MatKey, BufferGeometry[]>();
    const S = new Matrix4(), R = new Matrix4();
    for (const c of cells) {
      const kind = c.surface === 2 ? 'stone' : 'wood';
      const deck = kind === 'stone' ? BRIDGE.stoneDeckY : BRIDGE.woodDeckY;
      const m = new Matrix4().makeTranslation(c.x, c.y - deck, c.z).multiply(R.makeRotationY(c.angle)).multiply(S.makeScale(1, 1, c.stretch * 1.002));
      for (const p of bridgeParts(kind)) {
        const g = p.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
        g.applyMatrix4(m);
        let l = byMat.get(p.material);
        if (!l) byMat.set(p.material, (l = []));
        l.push(g);
      }
    }
    for (const [mat, list] of byMat) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      const mesh = new Mesh(g, modelMaterial(mat) as Material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `bridge-${mat}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  dispose(): void {
    for (const m of this.meshes) m.geometry.dispose();
  }
}
