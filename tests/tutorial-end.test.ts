// The tutorial's end (D-129, first-10-minutes-c N1): a finished tutorial closes the sheets (step 6 left the castle
// sheet over the worst-stall card in portrait) and puts the road tool away; a skipped one keeps the player's sheet.
// The DOM side is covered by the screenshot tools/day9b-shots.mjs (tut-end); here the policy and its wiring.
import { readFileSync } from 'node:fs';
import { tutorialEndActions } from '../src/ui/tutorialEnd';
import { assert, eq, test } from './harness';

test('tutorial end: done closes the sheets, skipped keeps them', () => {
  eq(tutorialEndActions('done', 'none').closeSheets, true, 'done closes');
  eq(tutorialEndActions('skipped', 'none').closeSheets, false, 'skipped keeps the player sheet');
});

test('tutorial end: the road and cobble tools go away either way, others stay', () => {
  for (const r of ['done', 'skipped'] as const) {
    eq(tutorialEndActions(r, 'road').toolAway, true, `${r}: road`);
    eq(tutorialEndActions(r, 'cobble').toolAway, true, `${r}: cobble`);
    eq(tutorialEndActions(r, 'demolish').toolAway, false, `${r}: demolish stays`);
    eq(tutorialEndActions(r, 'none').toolAway, false, `${r}: none`);
  }
});

test('tutorial end: the app acts on the policy in the tutorial host finish()', () => {
  const src = readFileSync(new URL('../src/ui/app.ts', import.meta.url), 'utf8');
  const fin = src.slice(src.indexOf('finish: (r) =>'), src.indexOf('this.tutorial = tut;'));
  assert(fin.length > 0, 'finish() found in startTutorial');
  assert(/tutorialEndActions\(r, this\.tool\)/.test(fin), 'finish() asks tutorialEndActions');
  assert(/act\.closeSheets\)\s*this\.sheets\.closeAll\(\)/.test(fin), 'closeSheets -> sheets.closeAll()');
  assert(/act\.toolAway\)\s*this\.setTool\('none'\)/.test(fin), "toolAway -> setTool('none')");
  const tut = readFileSync(new URL('../src/ui/tutorial.ts', import.meta.url), 'utf8');
  assert(/this\.end\('done'\)/.test(tut) && /this\.host\.finish\(r\)/.test(tut), 'the tutorial reports done through host.finish');
});
