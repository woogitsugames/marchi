// Fixed-step game loop. Speed and pause only change how many sim ticks run per
// real second; commands are applied at tick boundaries, so a recorded command list
// replays identically at any speed (see tests/determinism.test.ts).
import { applyCommand, step, TICK_HZ, type Command, type CommandResult, type World } from '../sim/index';

export type Speed = 0 | 1 | 2 | 4;

export interface TimedCommand {
  tick: number;
  cmd: Command;
}

export class GameLoop {
  speed: Speed = 1;
  /** Real milliseconds not yet turned into ticks. */
  private acc = 0;
  private queue: TimedCommand[] = [];
  /** Every command actually applied, with its tick (for replays / bug reports). */
  readonly journal: TimedCommand[] = [];
  /** Cap ticks per frame so a long stall (tab switch) does not freeze the UI. */
  maxTicksPerFrame = 40;
  onCommandResult: ((cmd: Command, r: CommandResult) => void) | null = null;
  onTick: (() => void) | null = null;

  constructor(public world: World) {}

  /** Queue a player command; it runs before the next tick. */
  enqueue(cmd: Command): void {
    this.queue.push({ tick: this.world.state.tick, cmd });
  }

  /** Schedule a command for a specific tick (replays, bots). */
  schedule(tick: number, cmd: Command): void {
    this.queue.push({ tick, cmd });
    this.queue.sort((a, b) => a.tick - b.tick);
  }

  /** Apply queued commands whose tick has come. Also used while paused so building works in pause. */
  flushCommands(): void {
    const st = this.world.state;
    while (this.queue.length && this.queue[0]!.tick <= st.tick) {
      const tc = this.queue.shift()!;
      const r = applyCommand(this.world, tc.cmd);
      this.journal.push({ tick: st.tick, cmd: tc.cmd });
      this.onCommandResult?.(tc.cmd, r);
    }
  }

  /** Run exactly one tick (with commands due before it). */
  tickOnce(): void {
    this.flushCommands();
    step(this.world);
    this.onTick?.();
  }

  /**
   * Advance by real elapsed milliseconds. Returns the interpolation alpha (0..1)
   * between the last two ticks for smooth rendering.
   */
  advance(realMs: number): number {
    if (this.speed === 0) {
      this.flushCommands();
      return 1;
    }
    const tickMs = 1000 / TICK_HZ / this.speed;
    this.acc += realMs;
    let n = 0;
    while (this.acc >= tickMs && n < this.maxTicksPerFrame) {
      this.tickOnce();
      this.acc -= tickMs;
      n++;
    }
    if (n === this.maxTicksPerFrame) this.acc = 0;
    return Math.min(1, this.acc / tickMs);
  }
}
