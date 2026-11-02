/**
 * Procedural models for MARCHIA (real scale, 1 unit = 1 m, front faces +Z).
 * Every model is a list of `{ geometry, material }` parts — build one `InstancedMesh` per part
 * with `modelMaterial(part.material)`. See each module for frames and pivots.
 */
export { type ModelPart, triangles, mergeParts, transformParts } from './kit';
export { type MatKey, type TextureSet, applyTextures, modelMaterial } from './materials';
export {
  WAGON,
  type WagonModel,
  type WheelMount,
  type HorseMaterials,
  wagonModel,
  wagonLod1,
  createHorseMaterial,
  addHorsePoseAttributes,
  writeHorsePose,
  HORSE_POSE_ATTRS,
} from './wagon';
export { type CargoGood, CARGO_GOODS, CARGO_MAX, cargoParts, cargoSlots, cargoUnitParts } from './cargo';
export {
  type BuildingKind,
  type BuildingModel,
  type PropKind,
  BUILDING_KINDS,
  BUILDING_CELLS,
  PROP_KINDS,
  buildingModel,
  propParts,
} from './buildings';
export { type TreeKind, TREE_KINDS, TREE_SIZE, treeParts, treeBillboard, bakeTreeBillboards } from './trees';
export { type BridgeKind, BRIDGE, bridgeParts } from './bridges';
export { type HumanPose, HUMAN_STYLES, workerParts } from './people';
