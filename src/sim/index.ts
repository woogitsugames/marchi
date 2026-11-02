// Public simulation API (pure TS, no DOM / three.js).
export * from './types';
export * from './defs';
export * from './sim';
export {
  applyCommand, validateRoad, validatePlace, gateCell, lineCells, roadCellCost, roadStoneCost, stoneAvailable, stoneOutlook, nearWater, onRock, isRockCell,
  type Command, type CommandResult, type CommandError,
} from './commands';
export { MISSIONS, VALLEY_W, VALLEY_H, demolishIsFinal, missionBuildable, missionSeasons } from './missions';
export { isRaining, edgeLength, findPath, pathTime, net, hasEdge, grade, type World } from './network';
export { buildingById, gateConnected } from './logistics';
export { explainBuilding, explainWagon, outputCustomer, seasonalSupplier, wagonEta, wagonSlowdown, seasonNote, timeOfDay, type ReasonLink, type SeasonNote, type Slowdown } from './diagnose';
export {
  SEASON_TICKS, SEASON_WARNING_TICKS, YEAR_TICKS, AUTUMN_FAIR_GOOD, bridgeIceUntil, cycleTicks, effectsAt, nextChange, seasonAt, seasonal,
  thawing, yearAt, type Season, type SeasonChange, type SeasonChangeKind, type SeasonEffects,
} from './seasons';
export { hashState } from './hash';
export { suggestConnection, suggestLinkToStable, type RoadSuggestion } from './repair';
export {
  canPlace, canSurface, castleLevel, demolishQuote, flowPerMinute, goodsSold, isMarket, lastUndoable, marketOpen, pricePct, quoteCents,
  rankGated, sandboxStatus, surfaceRank, unitCents, unlockRank,
  type DemolishQuote, type PriceInfo, type RankGateError, type RankGoal, type SandboxStatus,
} from './town';
