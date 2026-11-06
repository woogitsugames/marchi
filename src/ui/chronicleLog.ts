// Valley chronicle record (D-57, D-68): which entries a ledger has written. Pure apart from the best-effort
// localStorage migration (no i18n, no DOM), so headless tests drive it. See chronicle.ts for the page.
import { CHRONICLE, checkChronicle } from '../sim/proposals/chronicle';
import type { World } from '../sim/index';

const KEY = 'marchia.chronicle.';

function read(slot: string): string[] {
  try {
    const raw = localStorage.getItem(KEY + slot);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

/** A fresh or deleted valley ledger starts a new chronicle (also drops a pre-day-1 localStorage list). */
export function clearChronicle(slot: string): void {
  try { localStorage.removeItem(KEY + slot); } catch { /* storage unavailable */ }
}

export class ChronicleLog {
  readonly done = new Set<string>();
  private slot = '';

  /**
   * A valley game was entered: the entries of its save envelope (`saved`), any left in the old localStorage list
   * (migration), plus everything already true — silently (no toast storm).
   */
  attach(slot: string, world: World, saved: readonly string[] = []): void {
    this.slot = slot;
    this.done.clear();
    for (const id of saved) this.done.add(id);
    for (const id of read(slot)) this.done.add(id);
    for (const id of checkChronicle(world.state, this.done, world)) this.done.add(id);
  }

  /** The recorded ids for the save envelope (CHRONICLE order, unknown ids from a newer build kept last). */
  ids(): string[] {
    const known = CHRONICLE.map((e) => e.id).filter((id) => this.done.has(id));
    return [...known, ...[...this.done].filter((id) => !known.includes(id))];
  }

  /** A save with ids() is stored: the old localStorage copy is no longer needed (migration done). */
  saved(slot: string): void {
    if (slot === this.slot) clearChronicle(slot);
  }

  detach(): void { this.slot = ''; this.done.clear(); }

  get active(): boolean { return this.slot !== ''; }

  /** Newly reached entries since the last call (CHRONICLE order); recorded at once. */
  check(world: World): string[] {
    if (!this.slot) return [];
    const fresh = checkChronicle(world.state, this.done, world);
    if (!fresh.length) return fresh;
    for (const id of fresh) this.done.add(id);
    return fresh;
  }
}

