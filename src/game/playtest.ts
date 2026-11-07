// Moderator playtest starts and the results row (docs/playtest/PROTOCOL.md §2, D-189..D-191). The APK has no
// address bar, so the hidden playtest screen (src/ui/playtestSheet.ts) starts these by reloading the page with
// the protocol's query plus `pt=<scenario>`; such a page writes nothing to the save slots or the profile (the
// fixture no-save mode, D-185). At the end of a trial the screen copies one CSV row in the column order of
// docs/playtest/results-template.csv: only the fields the game measured itself are filled, everything the
// moderator observes or codes stays empty. Pure strings, no DOM: tests/playtest-row.test.ts runs it headless.
import { TICK_HZ } from '../sim/defs';
import { FIXTURE_VERSION, type FixtureId } from './fixtures';

/** One start on the playtest screen: PROTOCOL's scenario id and its query (without lang/debug). */
export interface PlaytestStart {
  id: string;
  /** Mission key (m1..m12) the start plays; its title is shown on the screen. */
  mission: string;
  /** The protocol's query, exactly as PROTOCOL.md writes it (tests check that). */
  query: string;
  fixture: FixtureId | null;
  /** A decision task, not a stall diagnosis (S16, D-343): the screen tags it so `correct` is scored as PROTOCOL says. */
  decision?: boolean;
}

/**
 * PROTOCOL §3/§3A/§3B starts: the four validated fixtures for S2/S3/S4/S6, the URL starts for S1, S5, S7..S9
 * and the first-run tutorial T1 (`tut=1`, which must come first for its participant). T2 uses S1's start.
 * S16 "Two castles" (§3H, D-343): mission XVI from its first second, a decision fixture (no stall).
 */
export const PLAYTEST_STARTS: readonly PlaytestStart[] = [
  { id: 'T1', mission: 'm1', query: 'play=m1&tut=1&speed=1', fixture: null },
  { id: 'S1', mission: 'm1', query: 'play=m1&ff=90&speed=0', fixture: null },
  { id: 'S2', mission: 'm2', query: 'fixture=bridge-cut-in-transit', fixture: 'bridge-cut-in-transit' },
  { id: 'S3', mission: 'm2', query: 'fixture=all-busy', fixture: 'all-busy' },
  { id: 'S4', mission: 'm2', query: 'fixture=bridge-jam', fixture: 'bridge-jam' },
  { id: 'S5', mission: 'm3', query: 'play=m3&ff=35&speed=1', fixture: null },
  { id: 'S6', mission: 'm6', query: 'fixture=warehouse-full', fixture: 'warehouse-full' },
  { id: 'S7', mission: 'm4', query: 'play=m4&ff=200&speed=0', fixture: null },
  { id: 'S8', mission: 'm5', query: 'play=m5&ff=120&speed=0', fixture: null },
  { id: 'S9', mission: 'm6', query: 'play=m6&ff=180&speed=0', fixture: null },
  { id: 'S16', mission: 'm16', query: 'fixture=two-castles', fixture: 'two-castles', decision: true },
];

export function playtestStart(id: string | null): PlaytestStart | null {
  return PLAYTEST_STARTS.find((s) => s.id === id) ?? null;
}

/** P01..P08 (PROTOCOL §1). */
export const PARTICIPANT_CODES = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08'] as const;

export function isParticipantCode(x: string | null | undefined): boolean {
  return (PARTICIPANT_CODES as readonly string[]).includes(x ?? '');
}

/** A device note is free text typed by the moderator: one line, no more than 60 characters. */
export function cleanDeviceNote(x: string | null | undefined): string {
  return (x ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** The setup query the protocol writes into `setup_url` (no playtest markers). */
export function setupQuery(s: PlaytestStart, lang: string): string {
  return `?${s.query}&lang=${lang}&debug=1`;
}

/** The page the playtest screen loads: the setup query plus the trial's markers (`pt`, `pid`, `dev`). */
export function playtestQuery(s: PlaytestStart, o: { lang: string; pid: string; dev: string }): string {
  const q = new URLSearchParams(setupQuery(s, o.lang));
  q.set('pt', s.id);
  if (isParticipantCode(o.pid)) q.set('pid', o.pid);
  const dev = cleanDeviceNote(o.dev);
  if (dev) q.set('dev', dev);
  return `?${q.toString()}`;
}

/** The column order of docs/playtest/results-template.csv (tests compare it with the file). */
export const RESULTS_COLUMNS = [
  'participant_id', 'segment', 'device', 'android_version', 'apk_commit', 'scenario_id', 'order_index', 'setup_url',
  'setup_method', 'preflight_ok', 'invalid_setup', 'time_s', 'correct', 'timeout', 'taps', 'opened_why', 'opened_wagon',
  'followed_chain', 'chain_steps', 'action_correct', 'assistance', 'issue_codes', 'quote_anonymized', 'notes_no_pii',
  'cohort', 'prior_training', 'task_time_s', 'task_success', 'letter_understood', 'tutorial_step', 'tutorial_result',
  'repair_offered', 'repair_seen', 'repair_used', 'tranche_read_correct', 'save_ok', 'fold_state', 'layout_ok',
  'session_id', 'device_class', 'screen_mode', 'orientation', 'layout_classes', 'device_unsupported', 'ff_seconds',
  'speed_mode', 'stalls_count', 'worst_stall_id', 'observed_status', 'first_diagnosis_s', 'first_diagnosis_correct',
  'pace_seen', 'pace_understood', 'road_stone_understood', 'ix_x_new_lesson', 'buffer_understood', 'hud_find_s',
  'hud_found', 'hud_cause_s', 'hud_show_used', 'alarm_count_understood', 'alarm_cycle_used', 'tool_cards_understood',
  'cure_highlight_seen', 'wagon_shortfall_understood', 'rank_understood', 'season_understood', 'goods_identified',
  'misclicks', 'unintended_commands', 'clipped_ui', 'perceived_smoothness_x1', 'perceived_smoothness_x4',
  'horse_step_x1_ok', 'horse_step_x4_ok', 'heat_before', 'heat_after', 'perf_fps_note', 'fixture_id',
  'fixture_version', 'fixture_hash',
  // measured by the game itself (D-190, PROTOCOL §5A): never typed by the moderator
  'auto_first_touch_s', 'auto_why_open_s', 'auto_first_fix', 'auto_outcome', 'auto_focus_status',
  // S16 "Two castles" (PROTOCOL §3H, D-343): the moderator codes the first two, the game fills the last three
  's16_castle_named', 's16_switch_named', 's16_first_set_s', 's16_first_castle', 's16_east_result',
] as const;
export type ResultsColumn = (typeof RESULTS_COLUMNS)[number];

/** What the game recorded about one trial page (src/ui/playtestSheet.ts TrialRecorder). Times in ms. */
export interface TrialRecord {
  scenario: string;
  pid: string;
  device: string;
  lang: string;
  /** The build's git short sha, '' when unknown. */
  build: string;
  /** The fixture's outcome when the start is a fixture: ok, the state hash after the run. */
  fixture: { ok: boolean; hash: string | null } | null;
  /** Page ready (the start is set up) .. the participant's first touch. */
  readyAt: number;
  firstTouchAt: number | null;
  /** First time a "Why is it stalled?" card (a stalled building or a waiting wagon) was on screen. */
  whyAt: number | null;
  wagonOpened: boolean;
  taps: number;
  /** First command the participant issued that the sim accepted, as `road:dirt`, `place:warehouse`, … */
  firstFix: string | null;
  /** Mission result when the row is copied. */
  outcome: string;
  /** The fixture subject's status kind when the row is copied ('' without a subject). */
  focusStatus: string;
  /** Two castles (S16): the participant's first accepted "this castle first", by castle and sim tick. */
  castleFirst?: { castle: 'east' | 'north'; tick: number } | null;
  /** Two castles (S16): the east castle's letter when the row is copied: on_time, late or open. */
  eastResult?: '' | 'on_time' | 'late' | 'open';
}

/** S16's three game-measured fields; empty for every other scenario. */
function twoCastleFields(r: TrialRecord): Partial<Record<ResultsColumn, string>> {
  if (r.scenario !== 'S16') return {};
  const f = r.castleFirst ?? null;
  return {
    s16_first_set_s: f ? (f.tick / TICK_HZ).toFixed(1) : '',
    s16_first_castle: f ? f.castle : '',
    s16_east_result: r.eastResult ?? '',
  };
}

const secs = (ms: number): string => (Math.round(ms / 100) / 10).toFixed(1);

/** The game's own fields of the results row, by column; every other column stays empty. */
export function resultsFields(r: TrialRecord): Partial<Record<ResultsColumn, string>> {
  const s = playtestStart(r.scenario);
  const ff = s && !s.fixture ? new URLSearchParams(s.query).get('ff') : null;
  const speed = s ? (s.fixture ? '0' : new URLSearchParams(s.query).get('speed')) : null;
  const touched = r.firstTouchAt !== null;
  return {
    participant_id: isParticipantCode(r.pid) ? r.pid : '',
    device: cleanDeviceNote(r.device),
    apk_commit: r.build,
    scenario_id: r.scenario,
    setup_url: s ? setupQuery(s, r.lang) : '',
    setup_method: s ? (s.fixture ? 'fixture' : 'url') : '',
    // only a failed fixture validation is known to the game; a passed one still needs the moderator's preflight
    invalid_setup: r.fixture && !r.fixture.ok ? '1' : '',
    taps: touched ? String(r.taps) : '',
    opened_why: touched ? (r.whyAt !== null ? '1' : '0') : '',
    opened_wagon: touched ? (r.wagonOpened ? '1' : '0') : '',
    ff_seconds: ff ?? '',
    speed_mode: speed ?? '',
    fixture_id: s?.fixture ?? '',
    fixture_version: s?.fixture ? String(FIXTURE_VERSION) : '',
    fixture_hash: r.fixture?.hash ?? '',
    auto_first_touch_s: touched ? secs(r.firstTouchAt! - r.readyAt) : '',
    auto_why_open_s: touched && r.whyAt !== null ? secs(Math.max(0, r.whyAt - r.firstTouchAt!)) : '',
    auto_first_fix: r.firstFix ?? '',
    auto_outcome: r.outcome,
    auto_focus_status: r.focusStatus,
    ...twoCastleFields(r),
  };
}

/** RFC 4180 cell; a leading = + - @ is defused so a spreadsheet never runs a typed note as a formula. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One results row (no header, no line break) in the template's column order. */
export function resultsRow(r: TrialRecord): string {
  const f = resultsFields(r);
  return RESULTS_COLUMNS.map((c) => csvCell(f[c] ?? '')).join(',');
}

