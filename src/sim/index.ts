// Public simulation API (pure TS, no DOM / three.js).
export * from './types';
export * from './defs';
export * from './sim';
export { applyCommand, validateRoad, validatePlace, gateCell, lineCells, roadCellCost, type Command, type CommandResult, type CommandError } from './commands';
export { MISSIONS, VALLEY_W, VALLEY_H, missionBuildable } from './missions';
export { isRaining, edgeLength, findPath, pathTime, net, hasEdge, grade, type World } from './network';
export { buildingById, gateConnected } from './logistics';
export { explainBuilding, explainWagon, wagonEta, wagonSlowdown, timeOfDay, type ReasonLink, type Slowdown } from './diagnose';
export { hashState } from './hash';
export { suggestConnection, suggestLinkToStable, type RoadSuggestion } from './repair';
export {
  canPlace, canSurface, demolishQuote, flowPerMinute, goodsSold, isMarket, lastUndoable, marketOpen, pricePct, quoteCents,
  rankGated, sandboxStatus, surfaceRank, unitCents, unlockRank,
  type DemolishQuote, type PriceInfo, type RankGateError, type RankGoal, type SandboxStatus,
} from './town';
