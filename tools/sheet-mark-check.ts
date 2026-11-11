// D-750 check, bundled and run by tests/ui-read-budget.test.ts (i18n needs Vite's import.meta.glob, unavailable under
// tsx): the real building and wagon sheets of src/ui/panels.ts on the DOM stand-in (tools/fake-dom.ts). Every 10 s of
// game time, every building's and wagon's sheet (kept open across the run) is updated as the app would: after a tick
// (must rebuild), again in pause with nothing changed (must skip), on the reading copy after a command in pause (must
// rebuild), on it again (must skip) and back on the world at the next tick (must rebuild). After each update the
// sheet's DOM and ghost calls must equal those of a sheet opened fresh at that moment (which always rebuilds).
import { installFakeDom, FakeElement } from './fake-dom';
installFakeDom();
import { TICK_HZ, applyCommand, createWorld, newPaceLog, samplePace, step, type PaceLog, type World } from '../src/sim/index';
import { buildingSheet, sheetStats, wagonSheet, type PanelNav } from '../src/ui/panels';
import type { Sheet, SheetContent } from '../src/ui/sheets';
import { sampleCalmCosts, sampleInputWaits } from '../src/ui/stalls';
import { sampleFleet } from '../src/ui/paceCard';
import { readingAfterCommand } from '../src/ui/readWorld';
import { setLang } from '../src/i18n/index';
import { valleyDriver } from './robustness';

export interface SheetMarkResult {
  checks: number;
  /** Updates that had to skip (nothing changed) and did / did not. */
  shouldSkip: number;
  skipped: number;
  /** Updates that had to rebuild (tick, copy or world changed) and did. */
  shouldBuild: number;
  built: number;
  /** Updates whose DOM or ghost calls differed from a fresh sheet's (must be empty). */
  mismatches: string[];
}

interface Open { sheet: Sheet; ghosts: string[] }

function tree(el: FakeElement, out: string[]): void {
  out.push(`<${el.tagName} c="${el.className}" h=${el.hidden} t="${el.textContent}">${el.innerHTML}`);
  for (const c of el.children) tree(c, out);
  out.push('>');
}

function dom(s: Sheet): string {
  const out: string[] = [];
  for (const e of [s.icon, s.kicker, s.title, s.body]) tree(e as unknown as FakeElement, out);
  return out.join('');
}

export function checkSheetMarks(ids: string[], minutes: number): SheetMarkResult {
  setLang('pl');
  const r: SheetMarkResult = { checks: 0, shouldSkip: 0, skipped: 0, shouldBuild: 0, built: 0, mismatches: [] };
  for (const id of ids) {
    const w = createWorld(id);
    const drive = id === 'sandbox' ? valleyDriver() : null;
    const pace: PaceLog = newPaceLog();
    let reading: World | null = null;
    let ghostLog: string[] = [];
    const nav: PanelNav = {
      get world() { return reading ?? w; },
      get pace() { return pace; },
      tutorialRunning: () => false, tutorialHut: () => -1,
      go() {}, buyWagon() {}, sellWagon() {}, toggleFollow() {}, following: () => null, buildRoad() {},
      setGhost(cells, pave, frameAt) { ghostLog.push(JSON.stringify([cells, pave, frameAt])); },
      undoPlace() {}, pickBuild() {}, castleFirst() {}, chainFirst() {},
    };
    const el = (t: string) => new FakeElement(t) as unknown as HTMLElement;
    const make = (content: SheetContent): Sheet => ({ el: el('div'), icon: el('div'), kicker: el('div'), title: el('h3'), body: el('div'), content, deferred: [] });
    const open = new Map<string, Open>();
    const subjects = (): [string, () => SheetContent][] => [
      ...w.state.buildings.map((b): [string, () => SheetContent] => ['b' + b.id, () => buildingSheet(nav, b.id)]),
      ...w.state.wagons.map((g): [string, () => SheetContent] => ['w' + g.id, () => wagonSheet(nav, g.id)]),
    ];
    /** Update every open sheet once; `skip`: whether each update must skip. Compared with a fresh sheet. */
    const round = (skip: boolean, what: string) => {
      for (const [k, mk] of subjects()) {
        let o = open.get(k);
        if (!o) { o = { sheet: make(mk()), ghosts: [] }; open.set(k, o); o.sheet.content.update(o.sheet); continue; }
        const b0 = sheetStats.built, s0 = sheetStats.skipped;
        ghostLog = [];
        if (!o.sheet.content.update(o.sheet)) continue;
        const ghosts = ghostLog;
        if (skip) { r.shouldSkip++; r.skipped += sheetStats.skipped - s0; } else { r.shouldBuild++; r.built += sheetStats.built - b0; }
        ghostLog = [];
        const fresh = make(mk());
        fresh.content.update(fresh);
        r.checks++;
        if (dom(fresh) !== dom(o.sheet)) r.mismatches.push(`${id}@${w.state.tick} ${what} ${k}: DOM`);
        if (ghostLog.join('|') !== ghosts.join('|')) r.mismatches.push(`${id}@${w.state.tick} ${what} ${k}: ghost ${ghosts.join('|')} vs ${ghostLog.join('|')}`);
        fresh.content.onClose?.();
      }
    };
    while (w.state.tick < minutes * 60 * TICK_HZ && w.state.mission.result === 'running') {
      if (drive) for (const c of drive(w)) applyCommand(w, c);
      step(w);
      reading = null;
      samplePace(pace, w);
      sampleInputWaits(w);
      sampleCalmCosts(w);
      sampleFleet(w);
      if (w.state.tick % (10 * TICK_HZ) !== 0) continue;
      round(false, 'tick');
      round(true, 'pause');
      reading = readingAfterCommand(w);
      round(false, 'copy');
      round(true, 'copy again');
      reading = null;
      round(false, 'world again');
    }
  }
  return r;
}
