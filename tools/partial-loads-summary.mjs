// Summarise tools/partial-loads.ts output (one JSONL file per policy) into Markdown tables.
//   node tools/partial-loads-summary.mjs res-base.jsonl res-d4.jsonl ...
import { readFileSync } from 'node:fs';

const runs = process.argv.slice(2).flatMap((f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const policies = [...new Set(runs.map((r) => r.policy))];
const keyOf = (r) => `${r.scenario} | ${r.strategy}`;
const keys = [...new Set(runs.map(keyOf))];
const get = (k, p) => runs.find((r) => keyOf(r) === k && r.policy === p);

const sumHist = (m) => { const h = [0, 0, 0, 0, 0, 0, 0]; for (const v of Object.values(m ?? {})) v.forEach((n, i) => (h[i] += n)); return h; };
function loads(r, which = 'loaded') {
  const h = sumHist(r.probe[which]);
  const jobs = h.reduce((a, b) => a + b, 0);
  const units = h.reduce((a, n, i) => a + n * i, 0);
  return { h, jobs, units, small: h[1] + h[2] + h[3], mean: jobs ? units / jobs : 0 };
}
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '-');
const f1 = (x) => x.toFixed(1).replace('.', ',');
const f2 = (x) => x.toFixed(2).replace('.', ',');

// 1. outcome per strategy
console.log('### Wynik każdej strategii (min do końca / pieczęcie; * = inny wynik niż base)\n');
console.log(`| scenariusz | strategia | ${policies.join(' | ')} |`);
console.log(`|---|---|${policies.map(() => '---').join('|')}|`);
for (const k of keys) {
  const b = get(k, 'base');
  const cells = policies.map((p) => {
    const r = get(k, p);
    if (!r) return '-';
    const diff = b && (r.seals !== b.seals || r.result !== b.result) ? '*' : '';
    const late = r.missed ? ` (spóźn. ${r.missed})` : '';
    return r.scenario === 'sandbox' ? `${r.result}, ${r.extra.earned} sr${diff}` : `${r.result === 'won' ? f2(r.minutes) : r.result} / ${r.seals}${late}${diff}`;
  });
  console.log(`| ${k.replace(' | ', ' | ')} | ${cells.join(' | ')} |`);
}

// 1b. seal changes vs base and balance ladder (expected seals: balance.ts `expect`, m7-m12 1/2/3)
console.log('\n### Zmiany pieczęci względem base i drabinka balansu (nic=1 / częściowa=2 / właściwa=3)\n');
console.log('| polityka | biegi misji | pieczęć w górę | w dół | wygrana→porażka | porażka→wygrana | poza oczekiwaną drabinką | Σ minut (wygrane w obu) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const p of policies) {
  let n = 0, up = 0, down = 0, wl = 0, lw = 0, off = 0, dm = 0;
  for (const r of runs.filter((x) => x.policy === p && x.scenario !== 'sandbox')) {
    const b = get(keyOf(r), 'base');
    n++;
    if (r.expect !== undefined && r.expect !== r.seals) off++;
    if (!b) continue;
    if (r.seals > b.seals) up++; if (r.seals < b.seals) down++;
    if (b.result === 'won' && r.result !== 'won') wl++;
    if (b.result !== 'won' && r.result === 'won') lw++;
    if (b.result === 'won' && r.result === 'won') dm += r.minutes - b.minutes;
  }
  console.log(`| ${p} | ${n} | ${up} | ${down} | ${wl} | ${lw} | ${off} | ${dm >= 0 ? '+' : ''}${f2(dm)} |`);
}

// 2. logistics per policy, summed over all runs (missions only, then sandbox)
for (const group of ['missions', 'sandbox']) {
  const sel = (r) => (group === 'sandbox') === (r.scenario === 'sandbox');
  console.log(`\n### Logistyka — ${group === 'missions' ? 'wszystkie strategie m1–m12 (suma)' : 'wolna dolina (plan DECENT)'}\n`);
  console.log('| polityka | kursy | jedn. | śr. ładunek | kursy 1–3 jedn. | m / dostarczoną jedn. | czas wozów bez zlecenia | zatrzymane decyzje (wolny wóz) | „mylący” status (próbki) |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const p of policies) {
    const rs = runs.filter((r) => r.policy === p && sel(r));
    let jobs = 0, units = 0, small = 0, odo = 0, del = 0, wt = 0, idle = 0, held = 0, heldFree = 0, conf = 0;
    for (const r of rs) {
      const l = loads(r);
      jobs += l.jobs; units += l.units; small += l.small;
      odo += r.probe.odometer; del += r.probe.delivered; wt += r.probe.wagonTicks; idle += r.probe.idleTicks;
      held += r.probe.heldPrevented; heldFree += r.probe.heldWithFreeWagon;
      conf += Object.values(r.probe.confusing).reduce((a, b) => a + b, 0);
    }
    console.log(`| ${p} | ${jobs} | ${units} | ${f2(units / jobs)} | ${small} (${pct(small, jobs)} %) | ${f1(odo / del)} | ${pct(idle, wt)} % | ${held} (${heldFree}) | ${conf} |`);
  }
}

// 3. load histograms per policy (assigned vs loaded), m1 bot and all missions
console.log('\n### Rozkład ładunków (liczba kursów o 1..6 jedn.; przydział → po dobraniu przy załadunku)\n');
console.log('| polityka | zakres | przydział 1/2/3/4/5/6 | załadunek 1/2/3/4/5/6 |');
console.log('|---|---|---|---|');
for (const p of policies) {
  for (const [label, sel] of [['m1 `npm run bot`', (r) => r.strategy === 'npm run bot'], ['m1–m12 wszystkie', (r) => r.scenario !== 'sandbox'], ['dolina', (r) => r.scenario === 'sandbox']]) {
    const rs = runs.filter((r) => r.policy === p && sel(r));
    const a = [0, 0, 0, 0, 0, 0, 0], l = [0, 0, 0, 0, 0, 0, 0];
    for (const r of rs) { loads(r, 'assigned').h.forEach((n, i) => (a[i] += n)); loads(r).h.forEach((n, i) => (l[i] += n)); }
    console.log(`| ${p} | ${label} | ${a.slice(1).join('/')} | ${l.slice(1).join('/')} |`);
  }
}

// 4. per-kind loads (base): where do small loads come from?
console.log('\n### Skąd małe ładunki (base, po załadunku, kursy 1–3 jedn. / wszystkie)\n');
for (const p of policies) {
  const by = {};
  for (const r of runs.filter((x) => x.policy === p)) for (const [k, v] of Object.entries(r.probe.loaded)) {
    const o = (by[k] ??= { small: 0, all: 0 });
    o.small += v[1] + v[2] + v[3]; o.all += v.reduce((a, b) => a + b, 0);
  }
  console.log(`- ${p}: ` + Object.entries(by).map(([k, o]) => `${k} ${o.small}/${o.all}`).join(', '));
}

// 5. status shown while held, and confusing statuses
console.log('\n### Co widzi gracz, gdy decyzja jest wstrzymana (status budynku zaraz po decyzji, suma)\n');
for (const p of policies.filter((x) => x !== 'base')) {
  const t = {};
  for (const r of runs.filter((x) => x.policy === p)) for (const [k, v] of Object.entries(r.probe.heldStatus)) t[k] = (t[k] ?? 0) + v;
  console.log(`- ${p}: ` + Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
}
console.log('\n### Status „brak / czeka na producenta”, choć osiągalne źródło ma towar (próbki co 1 s, suma)\n');
for (const p of policies) {
  const t = {};
  for (const r of runs.filter((x) => x.policy === p)) for (const [k, v] of Object.entries(r.probe.confusing)) t[k] = (t[k] ?? 0) + v;
  console.log(`- ${p}: ` + (Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '0'));
}
console.log('\n### Błędy (inwarianty / niewyjaśnione postoje / komendy)\n');
for (const p of policies) console.log(`- ${p}: ${runs.filter((r) => r.policy === p).reduce((a, r) => a + r.errors, 0)} w ${runs.filter((r) => r.policy === p).length} biegach`);
