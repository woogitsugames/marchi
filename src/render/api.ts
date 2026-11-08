// Contract between the three.js world view (src/render) and the DOM UI / input (src/ui).
// The view only READS sim state. It never mutates World.
import type { BuildingType, World } from '../sim/index';

export type PickResult =
  | { kind: 'wagon'; id: number }
  | { kind: 'building'; id: number }
  | { kind: 'cell'; cell: number }
  | null;

export type Overlay = 'none' | 'traffic';
/**
 * 'ultra' = 4k albedo/ORM from the downloadable pack (large high-DPI phones, foldables; 2k when the
 * pack is not installed), 'high' = 2k (default), 'low' = 512/1k. Normals are 1k in every tier.
 */
export type Quality = 'ultra' | 'high' | 'low';
/** Tiers this render layer implements (src/ui/tier.ts offers 'ultra' because it is listed). */
export const QUALITIES = ['low', 'high', 'ultra'] as const satisfies readonly Quality[];

export interface ScreenAnchor {
  /** CSS pixels relative to the canvas' top-left. */
  x: number;
  y: number;
  /** false when behind the camera or outside the viewport. */
  visible: boolean;
}

export interface RoadPreview {
  cells: number[];
  /** valid = drawn in ochre, invalid = clay with the offending cell marked. */
  valid: boolean;
  badCell: number;
  /** Proposed, not yet built (e.g. the access road a placement would need): drawn hatched. */
  dashed?: boolean;
  /** Existing dirt road proposed for cobbles (the pace card's mud stretch, D-116): drawn as pale setts (D-132). */
  pave?: boolean;
}

/** Building placement ghost (build tool). x, y = footprint top-left cell, as in the place command. */
export interface PlacementGhost {
  type: BuildingType;
  x: number;
  y: number;
  facing: number;
  /** valid = tinted ochre, invalid = clay with the offending cell marked. */
  valid: boolean;
  /** Offending cell (inside or outside the footprint, e.g. the gate), -1 if none. */
  badCell: number;
}

/** Screen-space offset from the canvas centre, CSS px (+x right, +y down). */
export interface ScreenOffset {
  x: number;
  y: number;
}

export interface CameraControl {
  /** Pan by screen-space CSS pixels (drag). */
  pan(dxPx: number, dyPx: number): void;
  /** Multiply distance by factor around a screen point (pinch / wheel). */
  zoom(factor: number, atX: number, atY: number): void;
  /** Rotate around the vertical axis (two-finger twist / right-drag); with a screen point the ground
   *  under it stays fixed (pivot between the fingers), otherwise the screen centre is the pivot. */
  rotate(radians: number, atX?: number, atY?: number): void;
  /** Glide (~200 ms, ease-out) so a world cell lands at the canvas centre + screenOffset (default: the
   *  centre), e.g. the middle of the map area an open sheet leaves visible. Keeps zoom and rotation. */
  focusCell(cell: number, screenOffset?: ScreenOffset): void;
  /** Follow a wagon until cleared (null), kept at the canvas centre + screenOffset. */
  follow(wagonId: number | null, screenOffset?: ScreenOffset): void;
  /** No glide running and the eased position/zoom have reached their goals (D-245); absent = always settled. */
  settled?(): boolean;
}

export interface WorldView {
  /** Attach to a canvas (creates the WebGL renderer). */
  mount(canvas: HTMLCanvasElement): void;
  /** Use a new world (new game / after load). Rebuilds terrain, roads, buildings. */
  setWorld(world: World): void;
  /** Request the shader programs of the current scene off the main thread, where the driver can (absent = no-op). */
  precompile?(): void;
  /** The loop's speed (0 = paused), told before each frame; a change refreshes the time-of-day lights (absent = no-op). */
  noteSpeed?(speed: number): void;
  /** Render a frame. alpha = interpolation between the previous and current sim tick (0..1). */
  frame(alpha: number, dtMs: number): void;
  /** Call after every sim tick so the view can snapshot previous positions for interpolation. */
  afterTick(): void;
  resize(cssW: number, cssH: number, dpr: number): void;
  /** Wagon > building > road/terrain cell. Coordinates are CSS px relative to the canvas. */
  pick(x: number, y: number): PickResult;
  /** Terrain cell under a screen point, -1 if none (for road drawing). */
  cellAt(x: number, y: number): number;
  /** Screen position of a building's marker point (above the roof) or a wagon. */
  anchorOf(kind: 'building' | 'wagon', id: number): ScreenAnchor;
  readonly camera: CameraControl;
  setRoadPreview(p: RoadPreview | null): void;
  /** Translucent building model + ground outline, gate and offending cell; null hides it. */
  setPlacementGhost?(g: PlacementGhost | null): void;
  /** Shade the ground cells where the building being placed may stand (quarry: rock; fisher: by the
   *  water); null clears. Optional: views without it simply show no hint. */
  setSiteHighlight?(cells: readonly number[] | null): void;
  /** Screen position of a cell's centre at ground (bridge deck) height. Projection only, no ray-march. */
  cellToScreen?(cell: number): ScreenAnchor;
  setOverlay(o: Overlay): void;
  setSelection(sel: PickResult): void;
  setQuality(q: Quality): void;
  /** Cinematic slow drift for the main menu (valley at dawn, wagon on the bridge). */
  setMenuMode(on: boolean): void;
  /** Ground point the camera looks at (metres) and its yaw, for positional audio. */
  audioListener?(): { x: number; z: number; yaw: number };
  /** Renderer stats for the perf HUD / docs/PERF.md. */
  stats(): { fps: number; drawCalls: number; triangles: number; geometries: number; textures: number };
  dispose(): void;
}

export type CreateWorldView = () => WorldView;
