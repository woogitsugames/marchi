import { GameLoop } from '../src/game/loop';
import { applyCommand, createWorld, stateHash, step, type Command, type World } from '../src/sim/index';
import { bridgeA, bridgeB, stableId } from '../tools/bot';
import { assert, eq, test } from './harness';

function scripted(w: World): { tick: number; cmd: Command }[] {
  return [
    { tick: 0, cmd: bridgeA(w) },
    { tick: 5, cmd: { t: 'buyWagon', stable: stableId(w) } },
    { tick: 400, cmd: { t: 'buyWagon', stable: stableId(w) } },
    { tick: 900, cmd: bridgeB(w) },
    { tick: 1500, cmd: { t: 'demolish', cell: 34 * w.terrain.w + 41 } },
  ];
}

function runDirect(ticks: number): string {
  const w = createWorld('m1');
  const cmds = scripted(w);
  while (w.state.tick < ticks) {
    for (const c of cmds) if (c.tick === w.state.tick) applyCommand(w, c.cmd);
    step(w);
  }
  return stateHash(w);
}

test('same seed + same commands => identical hash (two runs)', () => {
  const a = runDirect(3000), b = runDirect(3000);
  eq(a, b, 'hash');
});

test('different seed => different state', () => {
  const a = createWorld('m1', 1), b = createWorld('m1', 2);
  for (let i = 0; i < 200; i++) { step(a); step(b); }
  assert(stateHash(a) !== stateHash(b), 'seeds should diverge');
});

test('pause and speed changes do not change the outcome (GameLoop, fake clock)', () => {
  const ref = runDirect(3000);
  for (const pattern of [[1], [4], [2, 0, 4, 1, 0, 2], [4, 4, 0, 0, 1]] as const) {
    const w = createWorld('m1');
    const loop = new GameLoop(w);
    for (const c of scripted(w)) loop.schedule(c.tick, c.cmd);
    let frame = 0;
    while (w.state.tick < 3000) {
      loop.speed = pattern[Math.floor(frame / 50) % pattern.length]! as 0 | 1 | 2 | 4;
      // variable frame times like a real phone (8..34 ms)
      loop.maxTicksPerFrame = Math.max(1, Math.min(40, 3000 - w.state.tick));
      loop.advance(8 + ((frame * 7919) % 27));
      frame++;
      if (w.state.tick > 3000) throw new Error('overshoot');
    }
    eq(stateHash(w), ref, `hash with speed pattern ${pattern.join(',')}`);
  }
});
