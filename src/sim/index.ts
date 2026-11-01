// Public simulation API (pure TS, no DOM / three.js).
export * from './types';
export * from './defs';
export * from './sim';
export { applyCommand, validateRoad, lineCells, roadCellCost, type Command, type CommandResult, type CommandError } from './commands';
export { MISSIONS, VALLEY_W, VALLEY_H } from './missions';
export { isRaining, edgeLength, findPath, pathTime, net, hasEdge, grade, type World } from './network';
export { buildingById, gateConnected } from './logistics';
export { explainBuilding, explainWagon, wagonEta, wagonSlowdown, timeOfDay, type ReasonLink, type Slowdown } from './diagnose';
export { hashState } from './hash';
