// Opening framing of a mission (D-542): where the camera glides when a contract starts. Without an entry here the
// view keeps the generic valley overview (the map's middle at 200 m). Render-only: read from the mission id, the
// sim is not involved.

/** Cell box (inclusive) the opening view must show whole, and the view's yaw. */
export interface OpeningFrame { x0: number; y0: number; x1: number; y1: number; yaw: number }

/**
 * Mission I: the river crossing the player has to build and what it joins — the stable (the wagons start there) with
 * the north road's junction, the gap and the mill on the south bank. Looking straight north (yaw 0, the overview
 * has -0.3) the crossing runs up the screen, which suits the portrait free area. The rest of the chain (woodcutter and
 * sawmill west, farm, bakery, warehouse and castle along the south road) is a pan away: the whole 70 × 42-cell layout
 * (280 × 168 m) needs ~370 m in a 412 px portrait with the HUD (D-542), farther than the old 200 m overview that
 * already cut it; the crossing with the mill's south road needs 220 m, the crossing alone 168 m.
 */
export const OPENING_FRAMES: Readonly<Record<string, OpeningFrame>> = {
  m1: { x0: 41, y0: 19, x1: 49, y1: 39, yaw: 0 },
};

/**
 * Parts of the canvas the contract HUD leaves free over the map at the start (fractions of the canvas; the fit takes
 * the one that shows the box closest): in portrait the waybill covers the top third and the worst-stall row + tool
 * rail the bottom fifth; in landscape and on the near-square foldable the waybill sits top-left, the chips and speed
 * bar top-right, the rail and the stall row along the bottom, so the free part is either right of the waybill or the
 * band under it. Measured on the 412×915 / 915×412 / 904×1000 shots (D-542); a mismatch only shifts the frame a little.
 */
export function openingFree(aspect: number): { l: number; t: number; r: number; b: number }[] {
  if (aspect < 0.8) return [{ l: 0.04, t: 0.35, r: 0.96, b: 0.81 }];
  if (aspect > 1.2) return [{ l: 0.37, t: 0.15, r: 0.97, b: 0.8 }, { l: 0.03, t: 0.34, r: 0.97, b: 0.8 }];
  return [{ l: 0.04, t: 0.2, r: 0.96, b: 0.91 }];
}
