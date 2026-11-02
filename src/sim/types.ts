import type { ValleyEventState } from './events';

// Core simulation data types. Everything in SimState is plain JSON data:
// no classes, no Maps, no undefined values (use null / -1), so that
// JSON.stringify(state) is a canonical, hashable, saveable snapshot.

/** A good id; the list (and its order) lives in `GOODS` in defs.ts. */
export type Good = (typeof import('./defs'))['GOODS'][number];
/** Units per good: a plain object with every good as a key, in GOODS order (see emptyGoods). */
export type GoodMap = Record<Good, number>;

export type BuildingType =
  | 'woodcutter'
  | 'sawmill'
  | 'farm'
  | 'mill'
  | 'bakery'
  | 'warehouse'
  | 'stable'
  | 'castle'
  // free valley chains (D-29)
  | 'fisher'
  | 'quarry'
  | 'charcoalBurner'
  | 'malthouse'
  | 'brewery';

/** Road surface per cell. 0 = none. Water cells with a road are bridges. */
export const SURFACE_NONE = 0;
export const SURFACE_DIRT = 1;
export const SURFACE_COBBLE = 2;
export type SurfaceKind = 1 | 2;

/** Why a building is (not) working. `k` is the stable machine key used by UI/i18n. */
export type BuildingStatus =
  | { k: 'WORKING' }
  | { k: 'IDLE' }
  | { k: 'NO_ROAD' }
  /**
   * Input missing and nothing on the way. cause tells what the dispatcher saw. CONTESTED: the good
   * exists but goes to another kind of consumer; `blockedBy` is that consumer (free valley chains).
   */
  | { k: 'NO_INPUT'; good: Good; cause: 'NONE_AVAILABLE' | 'UNREACHABLE' | 'CONTESTED'; blockedBy: number }
  /** Input missing, but a reachable producer is making it right now: not a stall (start-up, slow supply). */
  | { k: 'WAITING_UPSTREAM'; good: Good; from: number }
  /** Input is on its way on a wagon. */
  | { k: 'WAITING_DELIVERY'; good: Good; wagon: number }
  /** Goods available somewhere reachable, but no free wagon could take the job. */
  | { k: 'NO_WAGON'; good: Good; cause: 'ALL_BUSY' | 'NONE_CAN_REACH' }
  /** Output buffer full and nobody hauls it away. */
  | { k: 'OUTPUT_FULL'; good: Good; cause: 'NO_WAGON' | 'NO_DESTINATION'; blockedBy: number }
  /** Output full, but a wagon is already on its way to collect it. */
  | { k: 'WAITING_PICKUP'; good: Good; wagon: number }
  | { k: 'STORAGE_FULL' }
  | { k: 'CONTRACT_DONE' };

export type WagonStatus =
  | { k: 'IDLE' }
  | { k: 'TO_PICKUP' }
  | { k: 'LOADING' }
  | { k: 'TO_DROPOFF' }
  | { k: 'UNLOADING' }
  | { k: 'RETURNING' }
  /** Waiting at a bridgehead for opposing traffic to clear the one-lane bridge. */
  | { k: 'BRIDGE_JAM'; span: number; blocker: number; since: number }
  /** The road to the target is broken. target: building id or -1 for home. */
  | { k: 'NO_ROUTE'; target: number; since: number }
  /** Ice closed the wooden span ahead until tick `until` (inclusive start, exclusive end window). */
  | { k: 'BRIDGE_CLOSED'; span: number; until: number; since: number };

export interface Job {
  id: number;
  good: Good;
  qty: number;
  from: number; // building id
  to: number; // building id
  /** 'pickup' until loaded, then 'dropoff'. */
  phase: 'pickup' | 'dropoff';
}

export interface Wagon {
  id: number;
  /** Fleet number shown to the player ("Wóz 3"): 1..N in purchase order, never reused (state v7, D-44). */
  n: number;
  home: number; // stable building id
  /** Current node (cell index). When moving, the node we left. */
  at: number;
  /** Node we are moving towards, or -1 when standing at `at`. */
  next: number;
  /** Metres travelled along the current edge (at -> next). */
  edgeT: number;
  /** Remaining nodes after `next`. */
  path: number[];
  /** Destination node of `path` (-1 when none). */
  dest: number;
  /** Network version the path was planned on. */
  pathVer: number;
  cargoGood: Good | null;
  cargoQty: number;
  job: Job | null;
  status: WagonStatus;
  /** Ticks remaining for LOADING / UNLOADING. */
  busyTicks: number;
  /** Bridgehead node we entered the current bridge span from, -1 when not on a bridge. */
  bridgeFrom: number;
  /** Total metres travelled (stats). */
  odometer: number;
}

export interface Building {
  id: number;
  type: BuildingType;
  /** Footprint top-left cell and size in cells. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Gate (entrance) cell index; always a road node. */
  gate: number;
  /** Facing of the gate side: 0 = south (+y), 1 = east, 2 = north, 3 = west. */
  facing: number;
  stock: GoodMap;
  /** Units in stock promised to a wagon (still physically here). */
  reservedOut: GoodMap;
  /** Units promised to arrive here (space is held for them). */
  incoming: GoodMap;
  /** Ticks into the current production cycle; -1 when not producing. */
  progress: number;
  status: BuildingStatus;
  /** Ticks spent stalled continuously (for UI "stalled for 1:20"). */
  stalledTicks: number;
  /** Warehouse capacity for this building (units, all goods); -1 = the type default (BUILDINGS.storeCap). */
  capOverride: number;
  /** Tick the player placed this building; -1 for buildings that came with the map (state v4). */
  placedTick: number;
}

export interface RainSpell {
  start: number; // tick
  end: number; // tick
}

/** One part of a contract with its own deadline. Needs are per tranche; they add up in order. */
export interface Tranche {
  need: GoodMap;
  deadlineTick: number;
  /** Tick at which the castle held everything up to and including this tranche; -1 = not yet. */
  doneTick: number;
  /** The deadline passed before the tranche was complete (costs one seal; delivery still counts later). */
  missed: boolean;
}

export interface Contract {
  /** Total of all tranches (or the whole order when there are no tranches). */
  need: GoodMap;
  castle: number; // building id
  deadlineTick: number;
  star3Tick: number;
  star2Tick: number;
  /** Waybill: ordered tranches. Empty = a single order due at deadlineTick. */
  tranches: Tranche[];
}

export interface MissionState {
  id: string;
  contract: Contract | null;
  result: 'running' | 'won' | 'lost';
  endTick: number;
  /**
   * Cobbles and stone bridges cost stone in this contract mission, and granaries keep a stone
   * reserve (state v6, D-32; copied from MissionDef.roadStone). The free valley always builds with
   * stone (rank gating) and keeps this false.
   */
  roadStone: boolean;
}

export interface Ledger {
  produced: GoodMap;
  consumed: GoodMap;
  /** Lost with demolished buildings. */
  destroyed: GoodMap;
  /**
   * Seconds lost per ROOT cause (end of the explain chain), so one missing bridge that stalls the
   * mill, the bakery and the castle counts once. Key: `<kind>:<id>:<statusKey>`, e.g.
   * `building:5:NO_ROAD`, `wagon:12:NO_ROUTE`, `span:3315:BRIDGE_JAM`. For the end-of-mission summary.
   */
  stallSeconds: Record<string, number>;
  /** Silver earned by selling goods at the market (state v4). */
  silverEarned: number;
  /** Units sold at the market per good; a subset of `consumed` (state v4). */
  sold: GoodMap;
}

/** Market prices (free valley). Present in every state; trades only when `open`. */
export interface MarketState {
  /** The castle buys every good (missions without a contract, except test maps). */
  open: boolean;
  /** Saturation units per good (0..MARKET.cap); one recovers every MARKET.recoverTicks. */
  saturation: GoodMap;
  /** Fraction of a silver coin earned but not paid out yet, in hundredths (0..99). */
  cents: number;
}

/** Town renown and rank (free valley). Ranks latch: they never go down. */
export interface TownState {
  renown: number;
  rank: number;
  /** Tick each rank was reached, -1 = not yet (index 0 is the start). */
  rankTicks: number[];
  /** Silver earned per 10 s bucket, ring of FLOW_BUCKETS indexed by floor(tick / FLOW_BUCKET_TICKS). */
  flow: number[];
  /** Best silver/min ever measured over the full 3-minute window (latched). */
  bestFlow: number;
}

export interface SimState {
  version: number; // state schema version (for saves)
  mapId: string;
  seed: number;
  tick: number;
  rng: [number, number, number, number];
  coins: number;
  /** Per cell road surface (Surface), length W*H. */
  roads: number[];
  /** Incremented whenever the road network or buildings change. */
  netVersion: number;
  /** Per cell traffic counter for the road-load overlay (halved every minute). */
  traffic: number[];
  buildings: Building[];
  wagons: Wagon[];
  nextId: number;
  /** Next fleet number for a new wagon (`Wagon.n`); sold wagons' numbers are not reused (state v7). */
  nextWagonN: number;
  rain: RainSpell[];
  /** Ice windows: wooden bridges (one-lane spans) cannot be entered while tick is in [start, end). */
  ice: RainSpell[];
  mission: MissionState;
  ledger: Ledger;
  market: MarketState;
  town: TownState;
  /**
   * Free valley events (state v8, D-54): royal orders, fair, merchant. Present only in 'sandbox'
   * states (the key is absent everywhere else, so contract missions serialize exactly as before).
   */
  valleyEvents?: ValleyEventState;
}

export interface Terrain {
  w: number;
  h: number;
  cellSize: number;
  /** (w+1)*(h+1) corner heights in metres. */
  corners: number[];
  /** w*h cell centre heights (bridge deck height on water cells). */
  cellH: number[];
  /** w*h, 1 = water. */
  water: number[];
  /** w*h tree density 0..1 (render + building clearance). */
  forest: number[];
  /** w*h, 1 = tilled field (render). */
  field: number[];
  waterLevel: number;
}
