// D-189..D-191: the moderator's playtest screen starts PROTOCOL's setups and copies one results row. The row must
// match docs/playtest/results-template.csv column for column, fill only what the game measured itself, and keep
// every moderator field empty; the starts must be the protocol's own queries.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FIXTURE_IDS, FIXTURE_VERSION, fixtureMission } from '../src/game/fixtures';
import {
  PLAYTEST_STARTS, RESULTS_COLUMNS, cleanDeviceNote, csvCell, playtestQuery, resultsFields, resultsRow, type TrialRecord,
} from '../src/game/playtest';
import { assert, eq, test } from './harness';

const root = fileURLToPath(new URL('..', import.meta.url));
const template = readFileSync(`${root}docs/playtest/results-template.csv`, 'utf8');
const protocol = readFileSync(`${root}docs/playtest/PROTOCOL.md`, 'utf8');

/** Minimal RFC 4180 split of one line (quotes, doubled quotes, commas inside quotes). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

const base: TrialRecord = {
  scenario: 'S4', pid: 'P03', device: 'Pixel 7, Android 15', lang: 'pl', build: 'abc1234',
  fixture: { ok: true, hash: '9f1c2e' }, readyAt: 1000, firstTouchAt: 6000, whyAt: 18_340,
  wagonOpened: true, taps: 7, firstFix: 'road:cobble', outcome: 'running', focusStatus: 'BRIDGE_JAM',
};
const row = (r: TrialRecord): Record<string, string> => {
  const cells = splitCsv(resultsRow(r));
  return Object.fromEntries(RESULTS_COLUMNS.map((c, i) => [c, cells[i]!]));
};

test('playtest row: the column list is the results template header, in order', () => {
  eq(template.split(/\r?\n/)[0], RESULTS_COLUMNS.join(','), 'results-template.csv header');
  assert(template.trim().split(/\r?\n/).length === 1, 'the template holds only the header');
});

test('playtest row: one cell per column; the game fills its own fields', () => {
  const cells = splitCsv(resultsRow(base));
  eq(cells.length, RESULTS_COLUMNS.length, 'cell count');
  const r = row(base);
  eq(r.participant_id, 'P03', 'participant');
  eq(r.device, 'Pixel 7, Android 15', 'device note with a comma survives quoting');
  eq(r.apk_commit, 'abc1234', 'build');
  eq(r.scenario_id, 'S4', 'scenario');
  eq(r.setup_url, '?fixture=bridge-jam&lang=pl&debug=1', 'setup url is the protocol query, no playtest markers');
  eq(r.setup_method, 'fixture', 'method');
  eq(r.fixture_id, 'bridge-jam', 'fixture id');
  eq(r.fixture_version, String(FIXTURE_VERSION), 'fixture version');
  eq(r.fixture_hash, '9f1c2e', 'fixture hash');
  eq(r.invalid_setup, '', 'a valid fixture leaves invalid_setup to the moderator');
  eq(r.taps, '7', 'taps');
  eq(r.opened_why, '1', 'opened why');
  eq(r.opened_wagon, '1', 'opened wagon');
  eq(r.speed_mode, '0', 'fixtures stop paused');
  eq(r.ff_seconds, '', 'fixtures ignore ff');
  eq(r.auto_first_touch_s, '5.0', 'ready -> first touch');
  eq(r.auto_why_open_s, '12.3', 'first touch -> why');
  eq(r.auto_first_fix, 'road:cobble', 'first fix');
  eq(r.auto_outcome, 'running', 'outcome');
  eq(r.auto_focus_status, 'BRIDGE_JAM', 'focus status');
});

test('playtest row: every moderator-observed column stays empty', () => {
  const filled = new Set(Object.keys(resultsFields(base)));
  const r = row(base);
  for (const c of RESULTS_COLUMNS) if (!filled.has(c)) eq(r[c], '', `moderator column ${c}`);
  for (const c of ['time_s', 'correct', 'timeout', 'preflight_ok', 'first_diagnosis_s', 'notes_no_pii', 'order_index', 'segment', 'cohort']) {
    assert(!filled.has(c), `${c} is the moderator's`);
  }
});

test('playtest row: URL start, untouched trial, failed fixture', () => {
  const s1 = row({ ...base, scenario: 'S1', fixture: null, firstTouchAt: null, whyAt: null, firstFix: null, taps: 0, focusStatus: '' });
  eq(s1.setup_url, '?play=m1&ff=90&speed=0&lang=pl&debug=1', 'S1 setup');
  eq(s1.setup_method, 'url', 'url method');
  eq(s1.ff_seconds, '90', 'ff');
  eq(s1.speed_mode, '0', 'speed');
  eq(s1.fixture_id + s1.fixture_version + s1.fixture_hash, '', 'no fixture columns');
  eq(s1.taps + s1.opened_why + s1.auto_first_touch_s + s1.auto_why_open_s, '', 'nothing measured before the first touch');
  const bad = row({ ...base, fixture: { ok: false, hash: null } });
  eq(bad.invalid_setup, '1', 'a failed fixture is invalid_setup=1');
  eq(bad.fixture_hash, '', 'no hash for a failed fixture');
  const noWhy = row({ ...base, whyAt: null });
  eq(noWhy.opened_why, '0', 'touched but never opened why');
  eq(noWhy.auto_why_open_s, '', 'no time without an open');
  eq(row({ ...base, pid: 'Jan' }).participant_id, '', 'only P01..P08, never a name');
});

test('playtest row: CSV escaping and formula defusing', () => {
  eq(csvCell('a,b'), '"a,b"', 'comma');
  eq(csvCell('say "hi"'), '"say ""hi"""', 'quote');
  eq(csvCell('=HYPERLINK(1)'), "'=HYPERLINK(1)", 'formula');
  eq(csvCell('-1'), "'-1", 'minus');
  eq(cleanDeviceNote('  Galaxy\nZ Fold 6\t ' + 'x'.repeat(80)).length, 60, 'one line, at most 60 chars');
  const r = row({ ...base, device: '=cmd|x, "y"' });
  eq(r.device, '\'=cmd|x, "y"', 'device note round-trips defused');
});

test('playtest starts: protocol queries, every fixture once, markers only on the page URL', () => {
  const ids = PLAYTEST_STARTS.map((s) => s.id);
  for (const id of ['T1', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']) assert(ids.includes(id), `start ${id}`);
  eq(new Set(ids).size, ids.length, 'unique ids');
  for (const f of FIXTURE_IDS) eq(PLAYTEST_STARTS.filter((s) => s.fixture === f).length, 1, `fixture ${f}`);
  for (const s of PLAYTEST_STARTS) {
    assert(protocol.includes(`?${s.query}`), `PROTOCOL.md mentions ?${s.query} (${s.id})`);
    if (!s.fixture) assert(s.query.includes(`play=${s.mission}`), `${s.id} plays ${s.mission}`);
    else eq(s.mission, fixtureMission(s.fixture), `${s.id}: the start list names the fixture's mission`);
  }
  const q = new URLSearchParams(playtestQuery(PLAYTEST_STARTS.find((s) => s.id === 'S6')!, { lang: 'en', pid: 'P08', dev: 'Pixel 8' }));
  eq(q.get('fixture'), 'warehouse-full', 'fixture');
  eq(q.get('debug'), '1', 'debug');
  eq(q.get('lang'), 'en', 'lang');
  eq(q.get('pt'), 'S6', 'pt marker');
  eq(q.get('pid'), 'P08', 'pid');
  eq(q.get('dev'), 'Pixel 8', 'dev');
  assert(!new URLSearchParams(playtestQuery(PLAYTEST_STARTS[0]!, { lang: 'pl', pid: 'x', dev: '' })).has('pid'), 'no free-text pid');
});
