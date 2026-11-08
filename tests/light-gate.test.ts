// Time-of-day light refresh gate (src/render/lightGate.ts, D-257 / D-370): every 2nd frame while the clock runs,
// at once on a forced refresh, never while paused with a settled clock; and Lighting.update itself is a pure
// function of (time of day, rain).
import { Scene } from 'three';
import { createLightGate, lightsDue, noteLightSpeed } from '../src/render/lightGate';
import { Lighting } from '../src/render/lighting';
import { assert, eq, test } from './harness';

const FRAME = 1000 / 60;

test('light gate: the first frame refreshes, then every 2nd frame while the clock runs', () => {
  const g = createLightGate();
  const due: boolean[] = [];
  let tod = 0.25;
  for (let i = 0; i < 8; i++) { due.push(lightsDue(g, tod, 0, FRAME, 0.0005, false)); tod += 5e-5; }
  eq(due.join(','), 'true,false,true,false,true,false,true,false', 'pattern');
});

test('light gate: paused with a settled clock and rain recomputes nothing', () => {
  const g = createLightGate();
  noteLightSpeed(g, 1);
  lightsDue(g, 0.3, 0.2, FRAME, 0, false);
  noteLightSpeed(g, 0);
  assert(lightsDue(g, 0.3, 0.2, FRAME, 0, false), 'pausing refreshes at once');
  let n = 0;
  for (let i = 0; i < 120; i++) if (lightsDue(g, 0.3, 0.2, FRAME, 0, false)) n++;
  eq(n, 0, 'refreshes in 2 s of pause');
  // the clock still settles a tiny bit after pausing: below the epsilon nothing moves, a visible step refreshes
  let m = 0;
  for (let i = 0; i < 4; i++) if (lightsDue(g, 0.3 + 1e-9 * i, 0.2, FRAME, 0, false)) m++;
  eq(m, 0, 'sub-epsilon drift');
  if (g.parity === 0) lightsDue(g, 0.3, 0.2, FRAME, 0, false); // let the next frame be an even one
  assert(lightsDue(g, 0.3005, 0.2, FRAME, 0, false), 'a real change on the even frame refreshes');
});

test('light gate: forced refreshes do not wait for the even frame', () => {
  const g = createLightGate();
  noteLightSpeed(g, 1);
  lightsDue(g, 0.5, 0, FRAME, 0, false); // frame 0 refreshes; the next is odd
  // each case lands on an odd frame (parity 1) and must refresh anyway
  const cases: [string, () => boolean][] = [
    ['snap (world / menu / weather snap)', () => lightsDue(g, 0.5, 0, FRAME, 0, true)],
    ['long frame (stall, resume)', () => lightsDue(g, 0.5, 0, 250, 0, false)],
    ['clock catching up a jump', () => lightsDue(g, 0.5, 0, FRAME, 0.01, false)],
    ['force (resize, quality)', () => { g.force = true; return lightsDue(g, 0.5, 0, FRAME, 0, false); }],
    ['speed change', () => { noteLightSpeed(g, 4); return lightsDue(g, 0.5, 0, FRAME, 0, false); }],
  ];
  for (const [name, run] of cases) {
    eq(g.parity, 0, `${name}: previous frame was even`);
    assert(run(), name);
    lightsDue(g, 0.5, 0, FRAME, 0, false); // even frame: nothing changed, so skipped
  }
});

test('light gate: a clock wrapping past midnight refreshes', () => {
  const g = createLightGate();
  lightsDue(g, 0.99999, 0, FRAME, 0, false);
  lightsDue(g, 0.99999, 0, FRAME, 0, false);
  assert(lightsDue(g, 0.00001, 0, FRAME, 0, false), 'wrap');
});

test('Lighting.update is a pure function of (time of day, rain): skipping frames cannot drift', () => {
  const a = new Lighting(new Scene()), b = new Lighting(new Scene());
  for (let i = 0; i <= 400; i++) a.update(i / 400, (i % 7) / 6);
  for (const f of [0.0, 0.2, 0.25, 0.26, 0.3, 0.5, 0.72, 0.76, 0.9]) for (const rain of [0, 0.4, 1]) {
    a.update(f, rain); b.update(f, rain);
    eq(a.sun.color.getHexString(), b.sun.color.getHexString(), `sun ${f} ${rain}`);
    eq(a.sun.intensity, b.sun.intensity, `sunI ${f} ${rain}`);
    eq(a.hemi.color.getHexString(), b.hemi.color.getHexString(), `hemi ${f} ${rain}`);
    eq(a.fog.color.getHexString(), b.fog.color.getHexString(), `fog ${f} ${rain}`);
    eq(a.env.exposure, b.env.exposure, `exposure ${f} ${rain}`);
    assert(a.env.sunDir.equals(b.env.sunDir), `sunDir ${f} ${rain}`);
  }
  // key colours at the keyframes themselves (no interpolation): noon sun is the 0.45 key
  a.update(0.45, 0);
  const noon = a.sun.color.getHexString();
  eq(noon, 'ffdcb8', 'noon sun key');
});
