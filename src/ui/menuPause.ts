// The pause menu holds the game paused and gives the speed back when it closes (D-521, D-560).
// Kept apart from the DOM so it is tested headless (tests/menu-pause.test.ts).
import type { Speed } from '../game/loop';

export class MenuPause {
  /** The speed to go back to while the menu holds the game; null when it does not. */
  private held: Speed | null = null;

  /**
   * The menu opens with the game at `current`. Taken once per pause: a second open while the menu already holds
   * the game (a double tap on the menu button, the menu opened again from Settings) finds the game paused by the
   * first one and must not take that pause for the player's speed. A game the player had paused stays paused (D-560).
   */
  hold(current: Speed): void {
    if (this.held === null) this.held = current;
  }

  /** The menu closed: the speed to set, or null when it had already given it back. */
  release(): Speed | null {
    const s = this.held;
    this.held = null;
    return s;
  }

  get holding(): boolean {
    return this.held !== null;
  }
}
