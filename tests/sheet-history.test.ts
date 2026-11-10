// D-520: the system back closes the top sheet — also when a sheet opens while our own back() is still in flight.
// FakeHistory behaves like Chromium (probed 2026-11-10): back() is queued and lands a task later, aimed at the entry
// below the one current WHEN back() WAS CALLED; a pushState before it lands is gone once it lands.
import { SheetHistory } from '../src/ui/sheetHistory';
import { assert, eq, test } from './harness';

class FakeHistory {
  entries: (number | null)[] = [null]; // the game page's own entry
  index = 0;
  left = false;
  private queued: number[] = [];
  onPop: (() => void) | null = null;
  push(depth: number): void {
    this.entries.splice(this.index + 1, Infinity, depth);
    this.index++;
  }
  back(): void {
    this.queued.push(this.index - 1);
  }
  /** The player's system back: lands at once (a separate task). */
  userBack(): void {
    this.back();
    this.settle();
  }
  /** Run the queued traversals (the next tasks). */
  settle(): void {
    for (const target of this.queued.splice(0)) {
      if (target < 0) { this.left = true; return; } // went back past the game page
      this.index = target;
      this.onPop?.();
    }
  }
}

type S = { id: number };

function rig(): { hist: FakeHistory; stack: S[]; nav: SheetHistory<S>; open(id: number): void; close(): void } {
  const hist = new FakeHistory();
  const stack: S[] = [];
  const nav = new SheetHistory<S>({ push: (d) => hist.push(d), back: () => hist.back() }, () => stack);
  const r = {
    hist, stack, nav,
    open(id: number) { const s = { id }; stack.push(s); nav.opened(s); },
    close() { const s = stack.pop(); if (s) nav.closed(s, false); },
  };
  hist.onPop = () => { if (nav.popped()) { const s = stack.pop(); if (s) nav.closed(s, true); } };
  return r;
}

test('sheet history: open, system back closes it and stays on the page', () => {
  const r = rig();
  r.open(1);
  eq(r.hist.index, 1, 'one entry for the sheet');
  r.hist.userBack();
  eq(r.stack.length, 0, 'back closed the sheet');
  eq(r.hist.left, false, 'still in the game');
});

test('sheet history: close and open in one turn — the new sheet still has its entry (D-520)', () => {
  const r = rig();
  r.open(1);
  r.hist.settle();
  r.close();
  r.open(2); // same turn: our back() has not landed yet
  r.hist.settle();
  eq(r.nav.inFlight, 0, 'our back arrived');
  eq(r.hist.index, 1, 'the new sheet got its entry after our back landed');
  r.hist.userBack();
  eq(r.stack.length, 0, 'system back closed the new sheet');
  assert(!r.hist.left, 'system back did not leave the game');
  r.hist.userBack();
  assert(r.hist.left, 'a back with no sheet open leaves the page (as before)');
});

test('sheet history: close, open, close again before our back lands — no extra back', () => {
  const r = rig();
  r.open(1);
  r.close();
  r.open(2);
  r.close(); // sheet 2 never had an entry: nothing to go back over
  r.hist.settle();
  eq(r.stack.length, 0, 'all closed');
  eq(r.hist.index, 0, 'back on the game entry');
  assert(!r.hist.left, 'did not go back past the game page');
  r.open(3);
  eq(r.hist.index, 1, 'a later open pushes at once');
  r.hist.userBack();
  eq(r.stack.length, 0, 'and the system back closes it');
  assert(!r.hist.left, 'in the game');
});

test('sheet history: six quick open/close pairs leave the history balanced', () => {
  const r = rig();
  for (let i = 0; i < 6; i++) { r.open(i); r.close(); }
  r.hist.settle();
  eq(r.hist.index, 0, 'on the game entry');
  eq(r.nav.inFlight, 0, 'nothing in flight');
  r.open(9);
  r.hist.userBack();
  eq(r.stack.length, 0, 'system back closes the next sheet');
  assert(!r.hist.left, 'in the game');
});
