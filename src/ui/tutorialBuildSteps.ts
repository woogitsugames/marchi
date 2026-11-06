// Step logic of the free-valley build tutorial (docs/content/tutorial-build.md), free of the DOM so a headless
// test can drive it with a real World. The UI (tutorialBuild.ts) gathers the observations; this module only reads
// the sim and decides the next step. It never issues a command for the player.
import { findPath, type Building, type World } from '../sim/index';
import { isStall } from './stallKinds';

/** 0: the offer ("Show me" / "Skip"); 1: pick the hut; 2: place it; 7: watch the cut-off hut stall (D-259); 5: why
 *  (first on the cut-off hut, else after the road if it stalls); 3: road; 4: open its card; 6: coda. */
export type BuildStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** What the UI sees this frame. */
export interface BuildObs {
  /** The newest woodcutter's hut the player placed since the tutorial began, or null. */
  hut: number | null;
  /** The build tool is placing a woodcutter's hut (its ghost is on the map). */
  picking: boolean;
  /** The hut's gate reaches the settlement (castle) by passable road. */
  connected: boolean;
  /** The top sheet is the hut's card. */
  hutOpen: boolean;
  /** Any card is open. */
  sheetOpen: boolean;
  /** The hut has a stall the player can read ("Dlaczego stoi?" on its card). */
  stalled: boolean;
  /** The card shows a way into the diagnosis: a cause-chain link or the "what does it mean?" toggle. */
  whyShown: boolean;
  /** The player opened that diagnosis (expanded the explanation or followed a chain link). */
  whyOpened: boolean;
  /** The diagnosis step was already passed once (read or passed over) — it is not asked again. */
  whyDone: boolean;
  /** Active ms spent in the current step. */
  since: number;
}

/** Step 5: how long the card gets to show a way into the diagnosis before the step is passed over. */
export const WHY_WAIT_MS = 1500;
/** Step 6: the closing note stays at least this long once the card is closed, at most CODA_MAX_MS. */
export const CODA_MIN_MS = 2500;
export const CODA_MAX_MS = 12_000;
/** Step 7: a cut-off hut fills its yard in 80 s of game time (20 s at ×4); past this much active time the road comes
 *  first and the diagnosis waits for the card (a player who never speeds up still gets the lesson, later). */
export const STALL_WAIT_MS = 90_000;

/**
 * The next step (or 'done'). A correct action taken early is recognised by the state (a hut placed before its note,
 * a road already joined); a hut removed (undo, demolish) sends the player back to picking one, never to a dead step.
 */
export function nextBuildStep(step: BuildStep, o: BuildObs): BuildStep | 'done' {
  if (step === 0) return 0;
  if ((step === 3 || step === 4 || step === 5) && o.hut === null) return 1;
  // The hut stands cut off (D-259, owner 2026-11-06: "trigger the stall on purpose"): it works until its yard is full,
  // then stalls for real with "no road". The lesson lets that happen (step 7, the note points at ×4 — speed is not a
  // sim command), reads the cause (step 5), and only then joins the road (step 3). Never asked twice.
  if (step === 7 && o.hut === null) return 1;
  const whyFirst = o.hut !== null && !o.connected && !o.whyDone && o.hutOpen && o.stalled;
  switch (step) {
    case 1:
    case 2:
      if (o.hut !== null) return o.connected ? 4 : whyFirst ? 5 : o.whyDone ? 3 : 7;
      return o.picking ? 2 : 1;
    case 7:
      if (o.connected) return 4;
      if (whyFirst) return 5;
      // stalled with its card closed: the road step reopens the way (its card shows "Zbuduj drogę")
      if (o.stalled || o.since > STALL_WAIT_MS) return 3;
      return 7;
    case 3:
      return o.connected ? 4 : whyFirst ? 5 : 3;
    case 4:
      if (!o.connected) return 3;
      // the card just opened: step 5 decides on the next frames whether the hut stalls (unless already read)
      return o.hutOpen ? (o.whyDone ? 6 : 5) : 4;
    case 5:
      if (!o.connected) {
        // the cut-off hut: read the cause, then join it
        if (o.whyOpened || !o.hutOpen || !o.stalled) return 3;
        return !o.whyShown && o.since > WHY_WAIT_MS ? 3 : 5;
      }
      // the doc's "if work has stalled": a hut at work (or one whose card shows no way in) skips the step
      if (o.whyOpened || !o.hutOpen || !o.stalled) return 6;
      return !o.whyShown && o.since > WHY_WAIT_MS ? 6 : 5;
    case 6:
      if (o.since > CODA_MAX_MS || (!o.sheetOpen && o.since > CODA_MIN_MS)) return 'done';
      return 6;
  }
}

/** Ids of the woodcutter's huts on the map (the baseline taken when the tutorial starts). */
export function hutIds(world: World): number[] {
  return world.state.buildings.filter((b) => b.type === 'woodcutter').map((b) => b.id);
}

/** The newest woodcutter's hut that is not in the baseline, or null. */
export function newHut(world: World, baseline: readonly number[]): Building | null {
  let best: Building | null = null;
  for (const b of world.state.buildings) {
    if (b.type !== 'woodcutter' || baseline.includes(b.id)) continue;
    if (!best || b.id > best.id) best = b;
  }
  return best;
}

/** The settlement the hut must join: the castle, else the stable (where the wagons wait). */
function anchor(world: World): Building | null {
  const st = world.state;
  return st.buildings.find((b) => b.type === 'castle') ?? st.buildings.find((b) => b.type === 'stable') ?? null;
}

/** The hut's gate reaches the settlement by road (any route the player chose, built before or after the note). */
export function hutConnected(world: World, hut: Building): boolean {
  const a = anchor(world);
  return !!a && findPath(world, hut.gate, a.gate, false) !== null;
}

/** The hut has a stall the card explains ("Dlaczego stoi?"): the same test the card uses for its kicker. */
export function hutStalled(hut: Building): boolean {
  return isStall(hut.status) || hut.status.k === 'NO_INPUT';
}
