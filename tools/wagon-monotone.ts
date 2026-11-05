// Research day 9g: "does one more wagon ever hurt?" For every mission and the eye-30/eye-60 reasonable
// players, compares the plain run with the same player plus ONE wagon bought at 1:00, 2:00, ... 9:00.
//   npx tsx tools/wagon-monotone.ts [m1 m2 ...]   (RULE_ARRIVE / RULE_TOPUP as in balance-night6)
import { MISSIONS } from '../src/sim/index';
import { probeRun } from './wagon-probe';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MISSIONS).filter((k) => /^m\d+$/.test(k));
const AT = [60, 120, 180, 240, 300, 360, 420, 480, 540];
let worse = 0, sealLoss = 0, sealGain = 0, total = 0, sumD = 0, worstD = 0, baseSeals = 0, baseMin = 0;
for (const id of ids) {
  for (const react of [30, 60]) {
    const base = probeRun(id, react, []);
    baseSeals += base.row.seals; baseMin += base.row.minutes;
    const cells: string[] = [];
    for (const at of AT) {
      if (at / 60 >= base.row.minutes) break;
      const r = probeRun(id, react, [at]);
      if (r.p.bought === 0) { cells.push('·'); continue; } // not affordable
      const d = Math.round((r.row.minutes - base.row.minutes) * 60);
      total++; sumD += d; worstD = Math.max(worstD, d);
      if (d > 3) worse++;
      if (r.row.seals < base.row.seals) sealLoss++;
      if (r.row.seals > base.row.seals) sealGain++;
      cells.push(`${d > 0 ? '+' : ''}${d}${r.row.seals !== base.row.seals ? `(${r.row.seals}★)` : ''}`);
    }
    console.log(`${id.padEnd(4)} eye-${react} base ${base.row.minutes.toFixed(2)} ★${base.row.seals}  Δs @1..9 min: ${cells.join(' ')}`);
  }
}
console.log(`SUMMARY runs=${total} slower>3s=${worse} sealLoss=${sealLoss} sealGain=${sealGain} meanΔ=${(sumD / Math.max(1, total)).toFixed(1)}s worst=+${worstD}s baseSeals=${baseSeals} baseMin=${baseMin.toFixed(2)}`);
