/**
 * Mission balance grid search; run: npx tsx tools/balance-grid.ts [--quick] [m1|m2|m3].
 * Candidate mission settings are substituted only in memory, never persisted in src/sim.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  applyCommand, createWorld, lineCells, stateHash, step, TICK_HZ, WAGON_PRICE,
  type Command, type World,
} from '../src/sim/index';
import { MISSIONS, type MissionDef } from '../src/sim/missions';

type Strategy = 'nothing' | 'wagons' | 'repair' | 'repair+wagons';
const STRATEGIES: Strategy[] = ['nothing', 'wagons', 'repair', 'repair+wagons'];
const EXTRA_WAGONS = 2;
const HORIZON_MIN = 12;
const OFFSETS = [0, 1, 7, 19, 41, 73] as const;
const TARGET_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] as const;

interface Physical {
  planks: number; bread: number; coins: number; wagons: number;
}
interface Thresholds {
  deadline: number; star3: number; star2: number;
}
interface Outcome {
  seed: number;
  strategy: Strategy;
  minutes: number | null;
  coinsLeft: number;
  errors: string[];
  hash: string;
  jamSamples: number;
}
type Runs = Record<Strategy, Outcome>;
interface Ranking {
  tuning: Thresholds;
  stable: number;
  points: number;
  distance: number;
  objective: number;
}
interface Candidate { physical: Physical; ranking: Ranking }
interface MissionResult {
  id: string;
  original: MissionDef;
  originalRuns: Runs[];
  best: Candidate;
  top: Candidate[];
  runs: Runs[];
  deterministic: boolean;
  searched: number;
}
const cache = new Map<string, Outcome>();
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const requested = args.filter((s) => /^m[1-6]$/.test(s));
const outputIndex = args.indexOf('--out');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : 'docs/balance/REPORT.md';
if (!outputPath || outputPath.startsWith('--')) throw new Error('Expected file path after --out');

function unique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}
function qty(n: number, scale: number): number {
  return Math.max(2, 2 * Math.round(n * scale / 2));
}
function physicalOf(def: MissionDef): Physical {
  if (!def.contract) throw new Error('Mission without a contract: ' + def.id);
  return { planks: def.contract.planks, bread: def.contract.bread, coins: def.coins, wagons: def.wagons };
}
function grid(def: MissionDef): Physical[] {
  const p = physicalOf(def);
  const factors = def.id === 'm1' ? (quick ? [0.5, 1] : [0.5, 0.67, 0.8, 1]) : (quick ? [0.8, 1] : [0.8, 1, 1.2]);
  const cOffsets = quick ? [0, 30] : [-30, 0, 30];
  const wOffsets = def.id === 'm1' ? (quick ? [0, 2, 4] : [-1, 0, 1, 2, 3, 4]) : (quick ? [0, 1] : [-1, 0, 1]);
  const result: Physical[] = [];
  for (const planks of unique(factors.map((s) => qty(p.planks, s))))
    for (const bread of unique(factors.map((s) => qty(p.bread, s))))
      for (const coins of unique(cOffsets.map((s) => Math.max(0, p.coins + s))))
        for (const wagons of unique(wOffsets.map((s) => Math.max(1, p.wagons + s))))
          result.push({ planks, bread, coins, wagons });
  if (!result.some((v) => JSON.stringify(v) === JSON.stringify(p))) result.push(p);
  return result;
}
function col(w: World, x: number, y1: number, y2: number): number[] {
  return lineCells(w.terrain.w, y1 * w.terrain.w + x, y2 * w.terrain.w + x);
}
function row(w: World, y: number, x1: number, x2: number): number[] {
  return lineCells(w.terrain.w, y * w.terrain.w + x1, y * w.terrain.w + x2);
}
function intervention(id: string, w: World): { at: number; commands: Command[] } {
  switch (id) {
    case 'm1':
      return { at: 0, commands: [{ t: 'road', surface: 1, cells: col(w, 41, 24, 44) }] };
    case 'm2':
      return { at: 45, commands: [{ t: 'road', surface: 2, cells: col(w, 51, 30, 42) }] };
    case 'm3':
      return { at: 25, commands: [{ t: 'road', surface: 2, cells: row(w, 40, 32, 80) }] };
    default:
      throw new Error('No authored intervention for ' + id);
  }
}
function runOne(id: string, p: Physical, seed: number, strategy: Strategy): Outcome {
  const key = JSON.stringify([id, p.planks, p.bread, p.coins, p.wagons, seed, strategy]);
  const hit = cache.get(key);
  if (hit) return hit;
  const original = MISSIONS[id];
  if (!original || !original.contract) throw new Error('Missing contract for ' + id);
  const replacement: MissionDef = {
    ...original, coins: p.coins, wagons: p.wagons,
    contract: { ...original.contract, planks: p.planks, bread: p.bread },
    deadlineMin: HORIZON_MIN, star3Min: 5, star2Min: 10,
  };
  let w: World;
  MISSIONS[id] = replacement;
  try {
    w = createWorld(id, seed);
  } catch (e) {
    const err: Outcome = {
      seed, strategy, minutes: null, coinsLeft: p.coins,
      errors: ['init: ' + String(e)], hash: '', jamSamples: 0,
    };
    cache.set(key, err);
    return err;
  } finally {
    MISSIONS[id] = original;
  }
  const errors: string[] = [];
  const stable = w.state.buildings.find((b) => b.type === 'stable');
  const needsWagons = strategy === 'wagons' || strategy === 'repair+wagons';
  const needsRepair = strategy === 'repair' || strategy === 'repair+wagons';
  const fix = needsRepair ? intervention(id, w) : null;
  const command = (cmd: Command): void => {
    const r = applyCommand(w, cmd);
    if (!r.ok) errors.push(r.err.k + ' (' + cmd.t + ', tick=' + w.state.tick + ')');
  };
  if (needsWagons) {
    if (!stable) errors.push('No stable');
    else for (let i = 0; i < EXTRA_WAGONS; i++) command({ t: 'buyWagon', stable: stable.id });
  }
  let jamSamples = 0;
  while (w.state.mission.result === 'running' && w.state.tick < HORIZON_MIN * 60 * TICK_HZ + 1) {
    if (fix && w.state.tick === fix.at * TICK_HZ) for (const c of fix.commands) command(c);
    step(w);
    if (w.state.tick % TICK_HZ === 0 &&
        w.state.wagons.some((wagon) => wagon.status.k === 'BRIDGE_JAM')) jamSamples++;
  }
  const result: Outcome = {
    seed, strategy,
    minutes: w.state.mission.result === 'won' ? w.state.mission.endTick / (60 * TICK_HZ) : null,
    coinsLeft: w.state.coins, errors, hash: stateHash(w), jamSamples,
  };
  cache.set(key, result);
  return result;
}
function runSet(id: string, p: Physical, seed: number): Runs {
  return {
    nothing: runOne(id, p, seed, 'nothing'),
    wagons: runOne(id, p, seed, 'wagons'),
    repair: runOne(id, p, seed, 'repair'),
    'repair+wagons': runOne(id, p, seed, 'repair+wagons'),
  };
}
function score(o: Outcome, t: Thresholds): number {
  if (o.errors.length || o.minutes === null || o.minutes > t.deadline + 1e-9) return 0;
  if (o.minutes <= t.star3 + 1e-9) return 3;
  if (o.minutes <= t.star2 + 1e-9) return 2;
  return 1;
}
function validTime(o: Outcome): boolean {
  return o.minutes !== null && o.minutes >= 5 && o.minutes <= HORIZON_MIN && o.errors.length === 0;
}
function partialStrategy(r: Runs, t: Thresholds): Strategy | null {
  if (validTime(r.repair) && score(r.repair, t) === 2) return 'repair';
  if (validTime(r.wagons) && score(r.wagons, t) === 2) return 'wagons';
  return null;
}
function attributes(r: Runs, t: Thresholds): { pass: boolean; points: number } {
  const clean = STRATEGIES.every((s) => r[s].errors.length === 0);
  const noAction = clean && score(r.nothing, t) <= 1;
  const partial = clean && partialStrategy(r, t) !== null;
  const full = clean && score(r['repair+wagons'], t) === 3 && validTime(r['repair+wagons']);
  return {
    pass: noAction && partial && full,
    points: (noAction ? 3 : 0) + (partial ? 3 : 0) + (full ? 4 : 0),
  };
}
function distance(id: string, p: Physical, t: Thresholds): number {
  const d = MISSIONS[id]!;
  const o = physicalOf(d);
  return Math.abs(p.planks - o.planks) / Math.max(1, o.planks) +
    Math.abs(p.bread - o.bread) / Math.max(1, o.bread) +
    Math.abs(p.coins - o.coins) / Math.max(1, o.coins) +
    Math.abs(p.wagons - o.wagons) / Math.max(1, o.wagons) +
    Math.abs(t.deadline - d.deadlineMin) / 4 +
    Math.abs(t.star3 - d.star3Min) / 4 +
    Math.abs(t.star2 - d.star2Min) / 4;
}
function thresholds(): Thresholds[] {
  const out: Thresholds[] = [];
  for (let d = 7; d <= HORIZON_MIN; d += 0.5)
    for (let a = 5; a <= d - 0.75; a += 0.25)
      for (let b = a + 0.5; b <= d - 0.25; b += 0.25)
        out.push({ deadline: d, star3: a, star2: b });
  return out;
}
const THRESHOLD_GRID = thresholds();
function rate(id: string, p: Physical, runs: Runs[]): Ranking {
  let best: Ranking | null = null;
  for (const t of THRESHOLD_GRID) {
    let stable = 0, points = 0;
    for (const r of runs) {
      const a = attributes(r, t);
      if (a.pass) stable++;
      points += a.points;
    }
    const dist = distance(id, p, t);
    const objective = stable * 100000 + points * 100 - dist;
    if (!best || objective > best.objective) best = {
      tuning: t, stable, points, distance: dist, objective,
    };
  }
  if (!best) throw new Error('Threshold grid empty');
  return best;
}
function formatOutcome(o: Outcome, t: Thresholds): string {
  if (o.errors.length) return 'BŁĄD: ' + o.errors[0]!;
  if (o.minutes === null) return 'porażka (0)';
  return o.minutes.toFixed(2) + ' min (' + score(o, t) + ')';
}
function formatPhysical(p: Physical): string {
  return p.planks + ' desek / ' + p.bread + ' chleba';
}
function formatSeals(r: Runs, t: Thresholds): string {
  return STRATEGIES.map((s) => s + '=' + score(r[s], t)).join(', ');
}
function tableHead(head: string[]): string {
  return '| ' + head.join(' | ') + ' |\n| ' + head.map(() => '---').join(' | ') + ' |';
}
function runOneUncached(id: string, p: Physical, seed: number, strategy: Strategy): Outcome {
  const key = JSON.stringify([id, p.planks, p.bread, p.coins, p.wagons, seed, strategy]);
  const old = cache.get(key);
  cache.delete(key);
  try { return runOne(id, p, seed, strategy); }
  finally {
    if (old) cache.set(key, old);
    else cache.delete(key);
  }
}
function missionSearch(id: string): MissionResult {
  const original = MISSIONS[id]!;
  const mainSeed = original.seed;
  const variations = OFFSETS.map((delta) => mainSeed + delta);
  const phys = grid(original);
  const baseline = physicalOf(original);
  const originalRuns = [runSet(id, baseline, mainSeed)];
  const baseCandidates: Candidate[] = [];
  for (const [i, p] of phys.entries()) {
    baseCandidates.push({ physical: p, ranking: rate(id, p, [runSet(id, p, mainSeed)]) });
    if ((i + 1) % 20 === 0)
      console.log(id + ': physical grid ' + (i + 1) + '/' + phys.length);
  }
  baseCandidates.sort((a, b) => b.ranking.objective - a.ranking.objective);
  const finalists = baseCandidates.slice(0, quick ? 4 : (id === 'm1' ? 20 : 10));
  if (!finalists.some((c) => JSON.stringify(c.physical) === JSON.stringify(baseline))) {
    const found = baseCandidates.find((c) => JSON.stringify(c.physical) === JSON.stringify(baseline));
    if (found) finalists.push(found);
  }
  const robust = finalists.map((c) => {
    const runs = variations.map((seed) => runSet(id, c.physical, seed));
    return { physical: c.physical, ranking: rate(id, c.physical, runs), runs };
  }).sort((a, b) => b.ranking.objective - a.ranking.objective);
  const chosen = robust[0]!;
  const deterministic = STRATEGIES.every((s) => {
    const again = runOneUncached(id, chosen.physical, mainSeed, s);
    return JSON.stringify(again) === JSON.stringify(chosen.runs[0]![s]);
  });
  const best = { physical: chosen.physical, ranking: chosen.ranking };
  console.log(id + ': best ' + JSON.stringify(best) +
    '; reproducible=' + deterministic +
    '; runs=' + variations.map((_, i) => formatSeals(chosen.runs[i]!, best.ranking.tuning)).join(' | '));
  return { id, original, originalRuns, best, top: robust.map((r) => ({
    physical: r.physical, ranking: r.ranking,
  })).slice(0, 5), runs: chosen.runs, deterministic, searched: phys.length };
}
function render(results: MissionResult[], missing: string[]): string {
  const lines: string[] = [
    '# Raport siatkowego balansu misji MARCHIA',
    '',
    '> Wygenerowano przez §npx tsx tools/balance-grid.ts§ z rzeczywistego symulatora §src/sim§.',
    '> To **rekomendacje**, nie zmiany danych w §src/sim§.',
    '',
    '## Metoda i kryteria',
    '',
    '- Strategie: **nic**, **+2 wozy na starcie** (koszt ' + (2 * WAGON_PRICE) +
      ' srebra), **właściwa naprawa**, **naprawa +2 wozy**. Interwencja M1: drewniany most §x=41,y=24..44§ na starcie; M2: kamienna modernizacja mostu §x=51,y=30..42§ po 45 s; M3: bruk §x=32..80,y=40§ po 25 s.',
    '- Cel: **nic = 0–1 pieczęć**, **częściowa strategia (same wozy albo sama naprawa) = 2**, **pełna interwencja (naprawa + wozy) = 3**, zwycięstwa w przedziale **5–12 min**.',
    '- Wyniki czterech strategii na tym samym seedzie są porównywane bez zmian AI, tras, terenu ani zasad produkcji. Nieudane komendy i błędy inicjalizacji dyskwalifikują wariant.',
    '- Siatka fizyczna: ilości desek/chleba × srebro × początkowe wozy (warianty 80%, 100%, 120% ilości, a dla M1 50%, 67%, 80%, 100%; srebro −30/0/+30; wozy −1/0/+1, a dla M1 również +2/+3/+4). Termin kontraktu: **7–12 min co 0,5 min**; pieczęcie: próg 3 od 5 min co 0,25 min, próg 2 co 0,25 min z warunkiem §5 ≤ 3★ < 2★ < termin§.',
    '- Dla każdej konfiguracji symulacja trwa maksymalnie 12 min (10 ticków/s). Terminy i progi pieczęci są przeszukiwane **analitycznie** z uzyskanych czasów zwycięstwa — nie zmieniają zachowania dyspozytora przed końcem kontraktu.',
    '- Każda konfiguracja fizyczna jest sprawdzana na seedzie misji. **10** najlepszych kandydatów (M1: 20) + ustawienia pierwotne są oceniane na sześciu seedach: bazowy oraz przesunięcia **+1, +7, +19, +41, +73**. Finalista wygrywa według liczby seedów spełniających wszystkie warunki, następnie sumy zgodnych kryteriów i odległości od danych obecnych.',
    '- Reprodukowalność: zwycięski wariant jest uruchamiany jeszcze raz na bazowym seedzie dla każdej z czterech strategii, z porównaniem wyników i hasza stanu.',
    '',
    '## Rekomendowane ustawienia (bez modyfikacji kodu misji)',
    '',
  ];
  lines.push(tableHead(['Misja', 'Kontrakt', 'Srebro', 'Wozy', '3★', '2★', 'Termin', 'Zgodne seedy / 6', 'Deterministyczna']));
  for (const r of results) {
    const { physical: p, ranking: q } = r.best, t = q.tuning;
    lines.push('| ' + r.id.toUpperCase() + ' | ' + formatPhysical(p) + ' | ' + p.coins +
      ' | ' + p.wagons + ' | ' + t.star3.toFixed(2) + ' min | ' +
      t.star2.toFixed(2) + ' min | ' + t.deadline.toFixed(2) + ' min | ' +
      q.stable + '/6 | ' + (r.deterministic ? 'tak' : '**NIE**') + ' |');
  }
  lines.push('', '**Interpretacja:** 6/6 oznacza spełnienie wszystkich trzech poziomów pieczęci i czasu na sześciu seedach. Wynik mniejszy nie jest pełną walidacją balansu; wymaga poprawki projektu misji lub szerszego przeszukania.', '');
  for (const r of results) {
    const p = r.best.physical, t = r.best.ranking.tuning;
    const baseT = { deadline: r.original.deadlineMin, star3: r.original.star3Min, star2: r.original.star2Min };
    lines.push('## ' + r.id.toUpperCase() + ' — porównanie i uzasadnienie', '');
    lines.push('**Dane obecne:** ' + formatPhysical(physicalOf(r.original)) + ', ' +
      r.original.coins + ' srebra, ' + r.original.wagons + ' wozów, ' +
      r.original.star3Min + ' / ' + r.original.star2Min + ' / ' + r.original.deadlineMin +
      ' min (3★ / 2★ / koniec).');
    lines.push('**Rekomendacja:** ' + formatPhysical(p) + ', ' + p.coins + ' srebra, ' +
      p.wagons + ' wozów, progi ' + t.star3 + ' / ' + t.star2 + ' / ' + t.deadline +
      ' min. Trafność: **' + r.best.ranking.stable + '/6** seedów.');
    lines.push('', '**Stan obecny — bazowy seed ' + r.original.seed + ':**', '');
    lines.push(tableHead(['Nic', '+2 wozy', 'Sama naprawa', 'Naprawa + wozy']));
    const before = r.originalRuns[0]!;
    lines.push('| ' + STRATEGIES.map((s) => formatOutcome(before[s], baseT)).join(' | ') + ' |');
    lines.push('', '**Po rekomendacji — porównanie sześciu seedów:**', '');
    lines.push(tableHead(['Seed', 'Nic', '+2 wozy', 'Sama naprawa', 'Naprawa + wozy', 'Częściowa (2★)', 'Kryteria']));
    for (const [i, run] of r.runs.entries()) {
      const a = attributes(run, t);
      const partial = partialStrategy(run, t);
      lines.push('| ' + (r.original.seed + OFFSETS[i]!) + ' | ' +
        STRATEGIES.map((s) => formatOutcome(run[s], t)).join(' | ') +
        ' | ' + (partial ?? 'brak') +
        ' | ' + (a.pass ? '**TAK**' : 'NIE') + ' |');
    }
    lines.push('', '**Uzasadnienie:** Bez interwencji wyznaczamy punkt odniesienia; pozostałe strategie rozdzielają koszt przepustowości i floty. Test seeda uwzględnia również wykonalność komend i wpływ terenu. ' +
      (r.best.ranking.stable === 6 ?
        'Wymagany podział pieczęci uzyskano na wszystkich sześciu seedach.' :
        '**Nie osiągnięto pełnej stabilności na sześciu seedach**: wartości są najlepszą znalezioną propozycją, nie potwierdzonym balansem.') +
      ' Dwa dodatkowe wozy kosztują ' + (2 * WAGON_PRICE) + ' srebra.');
    lines.push('', '**Najlepsze sprawdzone alternatywy:**', '');
    lines.push(tableHead(['Deski/chleb', 'Srebro', 'Wozy', '3★ / 2★ / termin', 'Seedy zgodne']));
    for (const c of r.top) {
      const z = c.ranking.tuning;
      lines.push('| ' + c.physical.planks + '/' + c.physical.bread + ' | ' +
        c.physical.coins + ' | ' + c.physical.wagons + ' | ' +
        z.star3 + ' / ' + z.star2 + ' / ' + z.deadline + ' | ' + c.ranking.stable + '/6 |');
    }
    lines.push('');
  }
  lines.push('## Ograniczenia / dalsza weryfikacja', '',
    '- To przeszukiwanie **siatki dyskretnej**, nie dowód globalnej optymalności. Zakres: ' +
      results.map((r) => r.id + ' = ' + r.searched + ' konfiguracji').join('; ') +
      '; dodatkowe seedy badano dla finalistów, a nie dla całej siatki.',
    '- „Częściowa” to **sama naprawa albo +2 wozy**, nie ukryta zmiana mechaniki.',
    '- Zmiana seeda regeneruje teren; niemożliwe komendy dyskwalifikują wynik.',
    '- W M3 magazyn pośredni nie należy do czterech strategii: obecny dispatcher nie gwarantuje jego wpływu na czas.',
    '- Liczby pieczęci wyznaczono z rzeczywistego czasu dostaw i istniejącej reguły gry; pliki §src/sim§ pozostały nienaruszone.',
    '- Wyniki bota należy potwierdzić playtestem ludzi.',
    '');
  if (quick) lines.push('**Uwaga:** raport z siatki §--quick§. Do oceny końcowej uruchom bez tej flagi.', '');
  if (missing.length) lines.push('**Nieanalizowane:** ' + missing.join(', ') + ' — brak aktywnej definicji kontraktu lub strategii naprawy.', '');
  return lines.join('\n').replaceAll('§', String.fromCharCode(96));
}

const active = TARGET_IDS.filter((id) => MISSIONS[id]?.contract && ['m1', 'm2', 'm3'].includes(id) &&
  (!requested.length || requested.includes(id)));
const missing = TARGET_IDS.filter((id) => !MISSIONS[id]?.contract || !['m1', 'm2', 'm3'].includes(id));
const results = active.map(missionSearch);
if (!results.length) throw new Error('No supported contracted missions selected');
const report = render(results, missing);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, report, 'utf8');
console.log('Wrote ' + outputPath + ' (' + report.length + ' bytes); runs=' + cache.size +
  '; thresholds=' + THRESHOLD_GRID.length + '; quick=' + quick);
if (results.some((r) => !r.deterministic)) {
  console.error('ERROR: deterministic rerun mismatch');
  process.exitCode = 1;
}
