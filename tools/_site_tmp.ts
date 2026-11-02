import { createWorld, validatePlace } from '../src/sim/index';
const w = createWorld('sandbox'); w.state.coins = 99999;
const tryP = (type: any, x: number, y: number, f: number) => { const r = validatePlace(w, type, x, y, f, true); console.log(type, x, y, f, r.ok ? 'ok' : JSON.stringify(r.err)); };
for (const x of [20, 23, 26, 29, 32, 35, 38, 41]) tryP('farm', x, 25, 2);
tryP('woodcutter', 24, 20, 0); tryP('woodcutter', 30, 21, 0); tryP('woodcutter', 34, 21, 0);
tryP('sawmill', 38, 21, 0);
