// Device tier and adaptive render scale (src/ui/tier.ts): pure logic, no DOM needed.
import { test, eq, assert } from './harness';
import { DynamicResolution, classifyTier } from '../src/ui/tier';

test('device tier from the WebGL renderer string', () => {
  eq(classifyTier('ANGLE (Qualcomm, Adreno (TM) 840, OpenGL ES 3.2)', 8, 8).tier, 'ultra', 'Fold 8 Ultra / Adreno 840');
  eq(classifyTier('Adreno (TM) 830', 8, 4).tier, 'high', 'Adreno 830 with little memory');
  eq(classifyTier('Adreno (TM) 740', 8, 8).tier, 'high', 'Adreno 740');
  eq(classifyTier('Adreno (TM) 610', 8, 4).tier, 'low', 'Adreno 610');
  eq(classifyTier('Mali-G57 MC2', 8, 4).tier, 'low', 'Mali-G57');
  eq(classifyTier('Mali-G715-Immortalis MC11', 8, 8).tier, 'high', 'Mali-G715');
  eq(classifyTier('Samsung Xclipse 950', 10, 8).tier, 'ultra', 'Xclipse 950');
  eq(classifyTier('Google SwiftShader', 16, 8).tier, 'low', 'software GL');
  eq(classifyTier('', 4, 2).tier, 'low', 'unknown weak device');
  eq(classifyTier('', 8, 8).tier, 'high', 'unknown device');
});

test('dynamic resolution steps down under 55 fps and back up when stable', () => {
  const d = new DynamicResolution();
  let now = 0;
  const run = (fps: number, ms: number): void => {
    const dt = 1000 / fps;
    for (let t = 0; t < ms; t += dt) { now += dt; d.sample(dt, now); }
  };
  eq(d.scale, 1, 'starts at full scale');
  run(30, 1500);
  assert(d.scale < 1, `stepped down at 30 fps (scale ${d.scale})`);
  run(30, 10000);
  eq(d.scale, 0.5, 'bottoms out at 0.5');
  run(60, 20000);
  assert(d.scale > 0.5, `raised again after a stable stretch (scale ${d.scale})`);
  const before = d.scale;
  d.sample(5000, now + 5000); // a hitch (tab switch, resize) is ignored
  eq(d.scale, before, 'hitch ignored');
  d.enabled = false;
  eq(d.scale, 1, 'disabled = full scale');
});
