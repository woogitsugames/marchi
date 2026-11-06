// Free-valley build tutorial (docs/content/tutorial-build.md, D-235): the second, optional lesson. It offers itself
// once on a new valley ("Show me" / "Skip"), then teaches place -> join by road -> read the card, one note at a
// time, on the same parchment scrap, ring and arrow as mission I (tutorial.ts). Every step ends on something the
// player does, recognised from the live World and the open card (tutorialBuildSteps.ts); it never issues a
// command, never pauses the game and never blocks a tap: only "Skip" and "Show me" take pointer events.
import type { MessageKey } from '../i18n/index';
import type { BuildingType } from '../sim/index';
import { Tutorial, union, visibleBox, type Box, type TutorialHost } from './tutorial';
import { hutConnected, hutIds, hutStalled, newHut, nextBuildStep, type BuildObs, type BuildStep } from './tutorialBuildSteps';

export interface BuildTutorialHost extends TutorialHost {
  /** The building type the build tool is placing (its ghost is on the map), else null. */
  buildType(): BuildingType | null;
  /** The build shelf is open. */
  buildOpen(): boolean;
}

/** The lesson ends by itself after this much active time (the doc's "first five minutes", never a limit to beat). */
const MAX_ACTIVE_MS = 300_000;

export class BuildTutorial extends Tutorial {
  private baseline: number[];
  private whyOpened = false;

  constructor(private bhost: BuildTutorialHost) {
    super(bhost);
    this.baseline = hutIds(bhost.world);
    this.step = 0;
  }

  override get current(): number { return this.step; }

  override onOpen(kind: 'building' | 'wagon', id: number, prevTop: string | null): void {
    if (this.ended) return;
    // step 5: a cause-chain link followed from the hut's card is the diagnosis opened
    const hut = newHut(this.bhost.world, this.baseline);
    if (this.step === 5 && hut && prevTop === `building:${hut.id}` && `${kind}:${id}` !== prevTop) this.whyOpened = true;
  }

  protected override onAct(): void {
    if (this.step === 0) this.go(1);
  }

  override update(dtMs: number): void {
    if (this.ended) return;
    const top = this.host.topKey();
    if (this.pausedNow(top)) return;
    this.active += dtMs;
    if (this.active > MAX_ACTIVE_MS || this.host.world.state.mission.result !== 'running') { this.end('done'); return; }
    if (this.step !== 0) {
      const o = this.observe(top);
      const next = nextBuildStep(this.step as BuildStep, o);
      if (next === 'done') { this.end('done'); return; }
      if (next !== this.step) {
        this.go(next);
        this.whyOpened = false;
      }
    }
    this.render();
  }

  private observe(top: string | null): BuildObs {
    const world = this.host.world;
    const hut = newHut(world, this.baseline);
    const hutKey = hut ? `building:${hut.id}` : '';
    const card = hut && top === hutKey ? document.querySelector('#sheets .sheet:last-child') : null;
    if (card?.querySelector('.codex.is-open')) this.whyOpened = true;
    return {
      hut: hut ? hut.id : null,
      picking: this.bhost.buildType() === 'woodcutter',
      connected: !!hut && hutConnected(world, hut),
      hutOpen: !!hut && top === hutKey,
      sheetOpen: top !== null,
      stalled: !!hut && hutStalled(hut),
      whyShown: !!this.whyTarget(),
      whyOpened: this.whyOpened,
      since: this.active - this.stepAt,
    };
  }

  // ---------------------------------------------------------------- hooks

  protected override noteKeys(): { from: MessageKey; skip: MessageKey; text: MessageKey; act?: MessageKey } {
    return {
      from: 'tutorial.build.from',
      skip: 'tutorial.m1.skip',
      text: `tutorial.build.step${this.step}` as MessageKey,
      act: this.step === 0 ? 'tutorial.build.show' : undefined,
    };
  }
  protected override scrollsToTarget(): boolean { return this.step === 5; }
  protected override railNeeded(): boolean { return this.step === 1 || this.step === 3; }
  protected override ghostBox(): Box | null { return null; }

  // ---------------------------------------------------------------- targets

  /** The way into the diagnosis on the hut's card: the first cause-chain link, else "what does it mean?". */
  private whyTarget(): HTMLElement | null {
    const card = document.querySelector('#sheets .sheet:last-child');
    if (!card) return null;
    const link = [...card.querySelectorAll<HTMLElement>('.chain button[data-go]:not([disabled])')].find((b) => b.getClientRects().length > 0);
    return link ?? card.querySelector<HTMLElement>('.codex-tog');
  }

  /** The hut (or its gate) on screen: a box round the projected cells. */
  private cellsBox(cells: number[], pad: number): Box | null {
    const pts = cells.map((c) => this.host.cellScreen(c)).filter((p): p is { x: number; y: number; visible: boolean } => !!p && p.visible);
    return union(pts.map((p) => ({ x: p.x - pad, y: p.y - pad, w: 2 * pad, h: 2 * pad })));
  }

  private hutCells(): number[] {
    const world = this.host.world;
    const hut = newHut(world, this.baseline);
    if (!hut) return [];
    const W = world.terrain.w;
    return [hut.y * W + hut.x, (hut.y + 1) * W + hut.x + 1];
  }

  protected override target(): { box: Box | null; probe: Element | null } {
    const el = (s: string): { box: Box | null; probe: Element | null } => {
      const e = document.querySelector(s);
      return { box: visibleBox(e), probe: e };
    };
    switch (this.step) {
      case 1: {
        // the build tool on the rail, then the hut on the shelf, then its cost on the placement bar
        if (!this.bhost.buildOpen()) return el('.rail [data-tool="build"]');
        if (this.bhost.buildType() === null) return el('.build-shelf [data-b="pick:woodcutter"]');
        return el('.build-shelf .pb-card');
      }
      case 2:
        // the ghost's own label: cost, or the standard reason it cannot stand there
        return el('.ghost-tag');
      case 3: {
        if (this.host.tool() !== 'road' && this.host.tool() !== 'cobble') return el('.rail [data-tool="road"]');
        const hut = newHut(this.host.world, this.baseline);
        // the hut's gate, where the road has to start (the pin on the map is the build ghost's, gone now)
        return { box: hut ? this.cellsBox([hut.gate], 20) : null, probe: null };
      }
      case 4:
        return { box: this.cellsBox(this.hutCells(), 26), probe: null };
      case 5: {
        const w = this.whyTarget();
        return { box: visibleBox(w), probe: w };
      }
      case 6:
        return el('#sheets .sheet:last-child .close');
      default:
        return { box: null, probe: null };
    }
  }
}
