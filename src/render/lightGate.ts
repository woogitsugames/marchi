// When the time-of-day lights are recomputed (D-257, D-370). Pure and allocation-free so it is testable headless.
// The lights drift over game minutes: every 2nd frame is invisible, and on skipped frames nothing is touched, so
// three.js re-sends no light uniforms. A forced refresh (world/menu snap, quality switch, resize, speed or pause
// change, a long frame, a clock catching up a jump) never waits for the next even frame. On even frames the lights
// are recomputed only if the smoothed clock or rain moved since the last refresh (a paused game costs nothing).

export interface LightGate {
  /** Frame parity: 0 on refresh frames. */
  parity: number;
  /** Clock and rain of the last refresh. */
  tod: number;
  rain: number;
  /** Refresh on the next call whatever the parity (set by resize, quality, speed change). */
  force: boolean;
  /** Last loop speed seen (0 = paused). */
  speed: number;
}

/** A long frame (stall, resume from background): the clock may have moved a lot. */
export const LIGHT_STALL_MS = 100;
/** Clock smoothing still catching up a jump (forced time, fast-forward), in day fractions. */
export const LIGHT_CATCHUP = 0.002;
/** Below these changes since the last refresh the lights are unchanged (sub-1/255 in every colour). */
export const LIGHT_EPS_TOD = 1e-7;
export const LIGHT_EPS_RAIN = 1e-6;

export function createLightGate(): LightGate {
  return { parity: 1, tod: NaN, rain: NaN, force: true, speed: -1 };
}

/** Speed or pause changed: refresh the lights at once. */
export function noteLightSpeed(g: LightGate, speed: number): void {
  if (speed !== g.speed) { g.speed = speed; g.force = true; }
}

/**
 * Advance the gate by one frame and say whether the lights are recomputed now. `catchUp` is the clock's remaining
 * smoothing distance (target − smoothed, wrapped); `snap` a world or menu change that also snapped the clock.
 */
export function lightsDue(g: LightGate, tod: number, rain: number, dtMs: number, catchUp: number, snap: boolean): boolean {
  g.parity ^= 1;
  let due = snap || g.force || dtMs > LIGHT_STALL_MS || Math.abs(catchUp) > LIGHT_CATCHUP;
  if (!due && g.parity === 0) {
    due = !(Math.abs(tod - g.tod) <= LIGHT_EPS_TOD) || !(Math.abs(rain - g.rain) <= LIGHT_EPS_RAIN);
  }
  if (due) { g.tod = tod; g.rain = rain; g.force = false; }
  return due;
}
