// Contract between the three.js world view (src/render) and the DOM UI / input (src/ui).
// The view only READS sim state. It never mutates World.
import type { World } from '../sim/index';

export type PickResult =
  | { kind: 'wagon'; id: number }
  | { kind: 'building'; id: number }
  | { kind: 'cell'; cell: number }
  | null;

export type Overlay = 'none' | 'traffic';
export type Quality = 'high' | 'low';

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
}

export interface CameraControl {
  /** Pan by screen-space CSS pixels (drag). */
  pan(dxPx: number, dyPx: number): void;
  /** Multiply distance by factor around a screen point (pinch / wheel). */
  zoom(factor: number, atX: number, atY: number): void;
  /** Rotate around the vertical axis (two-finger twist / right-drag). */
  rotate(radians: number): void;
  /** Smoothly centre on a world cell (e.g. following a wagon). */
  focusCell(cell: number): void;
  /** Follow a wagon until cleared (null). */
  follow(wagonId: number | null): void;
}

export interface WorldView {
  /** Attach to a canvas (creates the WebGL renderer). */
  mount(canvas: HTMLCanvasElement): void;
  /** Use a new world (new game / after load). Rebuilds terrain, roads, buildings. */
  setWorld(world: World): void;
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
  setOverlay(o: Overlay): void;
  setSelection(sel: PickResult): void;
  setQuality(q: Quality): void;
  /** Cinematic slow drift for the main menu (valley at dawn, wagon on the bridge). */
  setMenuMode(on: boolean): void;
  /** Renderer stats for the perf HUD / docs/PERF.md. */
  stats(): { fps: number; drawCalls: number; triangles: number; geometries: number; textures: number };
  dispose(): void;
}

export type CreateWorldView = () => WorldView;
