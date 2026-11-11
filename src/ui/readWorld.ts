// What the UI reads while the game is paused (D-672). A command applied in pause changes the state at once, but the
// building and wagon statuses are only taken again by the next tick's dispatch — a road built in pause to a cut-off
// brewery left its red "nieosiągalny" card with nothing to press until the game ran. After such a command the app
// reads a fresh copy (`pausedReading`: the dispatcher's reading at the same tick, the sim itself never steps) until the
// next tick. UI memory sampled per tick (input waits, fleet bits, bottleneck windows, ...) belongs to the real world;
// `memoryWorld` maps the copy back to it so those logs are shared, never restarted.
import { pausedReading, type World } from '../sim/index';

const owners = new WeakMap<World, World>();

/** A reading copy of `world` after a command in pause; read only, never stepped or saved. */
export function readingAfterCommand(world: World): World {
  const copy = pausedReading(world);
  owners.set(copy, memoryWorld(world));
  return copy;
}

/** The world whose per-tick UI memory this world reads: the real world for a paused reading copy, else itself. */
export function memoryWorld(world: World): World {
  return owners.get(world) ?? world;
}
