// One browser-history entry per open sheet, so the system back (Android, a browser) closes the top sheet (D-520).
// Kept apart from the DOM so the bookkeeping is tested headless (tests/sheet-history.test.ts).
//
// history.back() is asynchronous: its traversal lands a task later. A sheet opened before it lands (a close and an
// open in one turn, or a quick tap) used to push its entry at once — and the pending traversal, aimed at the entry
// below the closed sheet's, then went back over the new entry too. The new sheet was left without an entry: the
// next system back left the game page (on Android: the app). Now an open while our own back is in flight waits for
// that back's popstate and pushes its entry then; a sheet closed before that has no entry to go back over.

export interface HistoryApi {
  /** history.pushState for a sheet at stack depth `depth` (1 = the first sheet). */
  push(depth: number): void;
  /** history.back(). */
  back(): void;
}

export class SheetHistory<S extends object> {
  /** Our own back() calls whose popstate has not arrived yet. */
  private pending = 0;
  /** Sheets that own an entry. */
  private readonly owned = new WeakSet<S>();

  constructor(private readonly api: HistoryApi, private readonly stack: () => readonly S[]) {}

  /** A sheet was put on the stack. */
  opened(s: S): void {
    if (this.pending === 0) this.push(s);
  }

  /** A sheet left the stack; `fromPop`: the player's back already took its entry. */
  closed(s: S, fromPop: boolean): void {
    if (!fromPop && this.owned.has(s)) {
      this.pending++;
      try { this.api.back(); } catch { this.pending--; }
    }
    this.owned.delete(s);
  }

  /** A popstate arrived: true when it was the player's back (close the top sheet), false for our own. */
  popped(): boolean {
    if (this.pending === 0) return true;
    this.pending--;
    if (this.pending === 0) for (const s of this.stack()) if (!this.owned.has(s)) this.push(s);
    return false;
  }

  /** Our own back() calls still in flight (tests). */
  get inFlight(): number {
    return this.pending;
  }

  private push(s: S): void {
    try {
      this.api.push(this.stack().indexOf(s) + 1);
      this.owned.add(s);
    } catch { /* sandboxed frame: no history, the close button and Escape still work */ }
  }
}
