import { applyCommand, createWorld, deserialize, stateHash, step, type World } from '../src/sim/index';
import { makeEnvelope, parseSave } from '../src/platform/saveGate';
import { migrate } from '../src/platform/save';
import { stableId } from '../tools/bot';
import { generateScenario, makeWorld } from '../tools/fuzz-lib';
import { assert, eq, test } from './harness';

function reload(w: World): World {
  const parsed = parseSave(JSON.stringify(makeEnvelope('continuation', w.state, 0)));
  assert(parsed.ok, 'save must pass the save gate');
  if (!parsed.ok) throw new Error('invalid save');
  return deserialize(JSON.stringify(migrate(parsed.envelope).state));
}
function continueBoth(a: World, b: World, ticks: number): void {
  eq(stateHash(a), stateHash(b), 'hash immediately after loading');
  for (let i = 0; i < ticks; i++) { step(a); step(b); }
  eq(stateHash(a), stateHash(b), `hash after ${ticks} ticks`);
}

test('v9 valley with trading post continues identically for five minutes', () => {
  const w = createWorld('sandbox');
  assert(w.state.tradePost && w.state.tradePost.building >= 0, 'trading post exists');
  for (let i = 0; i < 600; i++) step(w);
  continueBoth(w, reload(w), 3000);
});

test('v9 save during WAGON_DUE preserves deterministic continuation', () => {
  const w = createWorld('m4');
  for (let i = 0; i < 2; i++) assert(applyCommand(w, { t: 'buyWagon', stable: stableId(w) }).ok, 'buy wagon');
  let found = false;
  for (let i = 0; i < 12000 && w.state.mission.result === 'running'; i++) {
    step(w);
    if (w.state.buildings.some((b) => b.status.k === 'WAGON_DUE')) { found = true; break; }
  }
  assert(found, 'fixture must actually reach WAGON_DUE');
  continueBoth(w, reload(w), 3000);
});

test('v9 saves from seeded fuzz scenarios continue with the same commands', () => {
  for (const seed of [1301, 1302, 1303]) {
    const scenario = generateScenario(seed, { ticks: 600, missions: ['sandbox'], minCmds: 8, maxCmds: 16 });
    const a = makeWorld(scenario.mission, scenario.coins);
    let b: World | undefined;
    let index = 0;
    for (let t = 0; t < scenario.ticks; t++) {
      if (t === scenario.saveAt) { b = reload(a); eq(stateHash(a), stateHash(b), `seed ${seed} after load`); }
      while (index < scenario.commands.length && scenario.commands[index]!.tick === a.state.tick) {
        const cmd = scenario.commands[index++]!.cmd;
        const first = applyCommand(a, cmd);
        if (b) eq(JSON.stringify(applyCommand(b, cmd)), JSON.stringify(first), `seed ${seed} command result`);
      }
      step(a); if (b) step(b);
    }
    assert(b, `seed ${seed} reached save tick`);
    eq(stateHash(a), stateHash(b), `seed ${seed} final hash`);
  }
});
