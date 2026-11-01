// Core simulation data types. Everything in SimState is plain JSON data:
// no classes, no Maps, no undefined values (use null / -1), so that
// JSON.stringify(state) is a canonical, hashable, saveable snapshot.

export type Good = 'wood' | 'planks' | 'grain' | 'flour' | 'bread';
export type GoodMap = { wood: number; planks: number; grain: number; flour: number; bread: number };

export type BuildingType =
  | 'woodcutter'
  | 'sawmill'
  | 'farm'
  | 'mill'
  | 'bakery'
  | 'warehouse'
  | 'stable'
  | 'castle';

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
  /** Input missing and nothing on the way. cause tells what the dispatcher saw. */
  | { k: 'NO_INPUT'; good: Good; cause: 'NONE_AVAILABLE' | 'UNREACHABLE'; blockedBy: number }
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
  | { k: 'NO_ROUTE'; target: number; since: number };

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
}

export interface RainSpell {
  start: number; // tick
  end: number; // tick
}

export interface Contract {
  need: GoodMap;
  castle: number; // building id
  deadlineTick: number;
  star3Tick: number;
  star2Tick: number;
}

export interface MissionState {
  id: string;
  contract: Contract | null;
  result: 'running' | 'won' | 'lost';
  endTick: number;
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
  rain: RainSpell[];
  mission: MissionState;
  ledger: Ledger;
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
