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
export { explainBuilding, explainWagon, outputCustomer, seasonalSupplier, sharedInput, thinDelivery, type SharedInput, type ThinDelivery, wagonEta, wagonSlowdown, seasonNote, timeOfDay, type ReasonLink, type SeasonNote, type Slowdown } from './diagnose';
export {
  SEASON_TICKS, SEASON_WARNING_TICKS, YEAR_TICKS, bridgeIceUntil, cycleTicks, effectsAt, nextChange, seasonAt, seasonal,
  thawing, yearAt, type Season, type SeasonChange, type SeasonChangeKind, type SeasonEffects,
} from './seasons';
export { hashState } from './hash';
export { suggestConnection, suggestLinkToStable, type RoadSuggestion } from './repair';
export {
  canPlace, canSurface, castleLevel, demolishQuote, flowPerMinute, goodsSold, isMarket, lastUndoable, marketOpen, pricePct, quoteCents,
  rankGated, sandboxStatus, surfaceRank, unitCents, unlockRank,
  type DemolishQuote, type PriceInfo, type RankGateError, type RankGoal, type SandboxStatus,
} from './town';
export {
  PACE_MIN_TICKS, PACE_SAMPLE_TICKS, PACE_WINDOW_TICKS, contractForecast, newPaceLog, samplePace,
  type ContractForecast, type GoodPace, type PaceLog,
} from './forecast';
export {
  EVENT_CHECK_TICKS, FAIR_PRICE_PERCENT, MAX_ROYAL_ORDERS, MERCHANT_PRICE_PERCENT, ORDER_TEMPLATES,
  fairPercent, fairStage, freshValleyEvents, merchantSurplus, orderOutstanding, producibleGoods,
  type MerchantOffer, type OrderTemplateId, type RoyalOrder, type SeasonalFair, type ValleyEventState,
} from './events';
