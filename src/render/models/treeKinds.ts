// Tree kinds, nominal sizes and variant count: plain data shared by the tree models (trees.ts) and the placement
// (placement.ts), in a module without materials or textures so the placement can be tested headless (D-312).

export type TreeKind = 'spruce' | 'pine' | 'oak' | 'birch' | 'bush';
export const TREE_KINDS: TreeKind[] = ['spruce', 'pine', 'oak', 'birch', 'bush'];

/** Nominal height and crown radius at scale 1 (used for billboards and culling). */
export const TREE_SIZE: Record<TreeKind, { height: number; radius: number }> = {
  spruce: { height: 15, radius: 3.2 },
  pine: { height: 16, radius: 3.6 },
  oak: { height: 12, radius: 5.2 },
  birch: { height: 11, radius: 3.0 },
  bush: { height: 2.8, radius: 2.0 },
};

/** Number of geometry variants per kind (each is its own `InstancedMesh` near the camera). */
export const TREE_VARIANTS = 2;
