// Dispatcher 2 A/B runner (research 2026-11-05, lesson-safe round). One command, one table:
//   npx tsx tools/dispatch2-ab.ts                      every variant in VARIANTS, 4 at a time
//   npx tsx tools/dispatch2-ab.ts base CA ratio2 ...   only these
//   npx tsx tools/dispatch2-ab.ts --spec 'x:ruleC=true,fleetGate=3'   an ad-hoc variant (fields of DISPATCH2)
// Per variant (child process, DISPATCH2 from src/sim/logistics.ts set before anything runs):
//   ladder = the mission lesson-ladder tests (tests/missions*.test.ts, m1-eye-fix) — failures listed;
//   bot1   = `npm run bot` (mission I scripted bot) seals/minutes;
//   survey = tools/wagon-monotone.ts (eye-30/60 + one wagon at 1:00..9:00): slower>3 s, seal losses,
//            and the plain eye-30/60 player's seal total / minutes (must not drop below baseline).
// FAST=1 skips bot and survey for a variant that already fails a ladder test.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISPATCH2 } from '../src/sim/logistics';

const here = dirname(fileURLToPath(import.meta.url));
type Rules = typeof DISPATCH2;

export const VARIANTS: Record<string, Partial<Rules>> = {
  base: { ruleA: false, ruleC: false },
  CA: { ruleA: true, ruleC: true, minFreeRunS: 0, fleetGate: 0 },
  A: { ruleA: true, ruleC: false, minFreeRunS: 0, fleetGate: 0 },
  C: { ruleA: false, ruleC: true, fleetGate: 0 },
  L1: {},
  g3CA: { ruleA: true, ruleC: true, minFreeRunS: 0, fleetGate: 3 },
};

function parseSpec(spec: string): [string, Partial<Rules>] {
  const [name, kv = ''] = spec.split(':');
  const r: Record<string, number | boolean> = {};
  for (const p of kv.split(',').filter(Boolean)) { const [k, v] = p.split('='); r[k!] = v === 'true' ? true : v === 'false' ? false : Number(v); }
  return [name!, r as Partial<Rules>];
}

async function child(rules: Partial<Rules>): Promise<void> {
  Object.assign(DISPATCH2, rules);
  const { registry, setFile } = await import('../tests/harness');
  const files = ['missions.test.ts', 'missions-7-9.test.ts', 'missions-10-12.test.ts', 'missions-13.test.ts', 'm1-eye-fix.test.ts'];
  for (const f of files) { setFile(f); await import(join(here, '..', 'tests', f)); }
  const fails: string[] = [];
  for (const tc of registry) {
    try { await tc.fn(); } catch (e) { fails.push(`${tc.name.slice(0, 12)}: ${(e as Error).message.slice(0, 110)}`); }
  }
  if (process.env.FAST && fails.length) { console.log('RESULT ' + JSON.stringify({ ladderFails: fails, bot1: '-', survey: { total: 0, worse: 0, loss: 0, gain: 0, mean: 0, worst: 0, baseSeals: 0, baseMin: 0, wins: 0, lossAt: [] } })); return; }
  const { runBot } = await import('./bot');
  const bot = runBot({ checkEvery: 50 });
  const { MISSIONS } = await import('../src/sim/index');
  const { probeRun } = await import('./wagon-probe');
  const ids = Object.keys(MISSIONS).filter((k) => /^m\d+$/.test(k));
  const AT = [60, 120, 180, 240, 300, 360, 420, 480, 540];
  let worse = 0, loss = 0, gain = 0, total = 0, sumD = 0, worst = 0, baseSeals = 0, baseMin = 0, wins = 0;
  const lossAt: string[] = [];
  for (const id of ids) for (const react of [30, 60]) {
    const base = probeRun(id, react, []);
    baseSeals += base.row.seals; baseMin += base.row.minutes; if (base.row.seals > 0) wins++;
    for (const at of AT) {
      if (at / 60 >= base.row.minutes) break;
      const r = probeRun(id, react, [at]);
      if (r.p.bought === 0) continue;
      const d = Math.round((r.row.minutes - base.row.minutes) * 60);
      total++; sumD += d; worst = Math.max(worst, d);
      if (d > 3) worse++;
      if (r.row.seals < base.row.seals) { loss++; lossAt.push(`${id}/${react}@${at / 60}`); }
      if (r.row.seals > base.row.seals) gain++;
    }
  }
  console.log('RESULT ' + JSON.stringify({
    ladderFails: fails, bot1: `${bot.stars}★ ${(bot.endTick / (await import("../src/sim/index")).TICK_HZ / 60).toFixed(2)}`,
    survey: { total, worse, loss, gain, mean: +(sumD / Math.max(1, total)).toFixed(1), worst, baseSeals, baseMin: +baseMin.toFixed(1), wins, lossAt },
  }));
}

function runChild(name: string, rules: Partial<Rules>): Promise<{ name: string; rules: Partial<Rules>; res: any }> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--import', 'tsx', join(here, 'dispatch2-ab.ts'), '--child', JSON.stringify(rules)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', (b) => { out += b; });
    p.on('close', () => {
      const line = out.split('\n').find((l) => l.startsWith('RESULT '));
      resolve({ name, rules, res: line ? JSON.parse(line.slice(7)) : { error: out.slice(-400) } });
    });
  });
}

const argv = process.argv.slice(2);
if (argv[0] === '--child') {
  await child(JSON.parse(argv[1]!));
} else {
  const list: [string, Partial<Rules>][] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--spec') list.push(parseSpec(argv[++i]!));
    else list.push([argv[i]!, VARIANTS[argv[i]!]!]);
  }
  if (!list.length) for (const [k, v] of Object.entries(VARIANTS)) list.push([k, v]);
  const results: Awaited<ReturnType<typeof runChild>>[] = [];
  const queue = [...list];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (queue.length) { const [n, r] = queue.shift()!; const x = await runChild(n, r); results.push(x); console.error(`done ${n}`); }
  }));
  results.sort((a, b) => list.findIndex((l) => l[0] === a.name) - list.findIndex((l) => l[0] === b.name));
  console.log('| variant | rules | ladder fails | bot I | survey runs | slower | seal loss | gain | mean Δ s | worst | eye Σ seals | eye Σ min |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const { name, rules, res } of results) {
    if (res.error) { console.log(`| ${name} | ERROR ${res.error.replace(/\n/g, ' ')} |`); continue; }
    const s = res.survey;
    console.log(`| ${name} | ${JSON.stringify(rules).replace(/["{}]/g, '')} | ${res.ladderFails.length} | ${res.bot1} | ${s.total} | ${s.worse} | ${s.loss} | ${s.gain} | ${s.mean} | +${s.worst} | ${s.baseSeals} | ${s.baseMin} |`);
  }
  for (const { name, res } of results) {
    if (res.error) continue;
    for (const f of res.ladderFails) console.log(`  ${name}: ${f}`);
    if (res.survey.lossAt.length) console.log(`  ${name}: seal loss at ${res.survey.lossAt.join(' ')}`);
  }
}
