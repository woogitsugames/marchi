// What the game does when the mission I tutorial ends (kept free of DOM so a headless test can check it).
import type { Tool } from './hud';
import type { TutorialResult } from './tutorial';

export interface TutorialEndActions {
  /** Put the road / cobble tool away, so the next tap on the map opens a card (first-10-minutes-b, item 3). */
  toolAway: boolean;
  /**
   * Close every sheet: the last step leaves the castle sheet open, and in portrait it covered the worst-stall card,
   * so the first stall after the tutorial was invisible (first-10-minutes-c N1, D-129). A skipped tutorial keeps
   * the player's own sheet.
   */
  closeSheets: boolean;
}

export function tutorialEndActions(r: TutorialResult, tool: Tool): TutorialEndActions {
  return { toolAway: tool === 'road' || tool === 'cobble', closeSheets: r === 'done' };
}
