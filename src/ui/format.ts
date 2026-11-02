// Player-facing text for sim data (status keys -> i18n), times and icons for reasons.
import { BUILDINGS, RANKS, TICK_HZ, buildingById, type BuildingStatus, type Good, type ReasonLink, type WagonStatus, type World } from '../sim/index';
import { RTL_LANGS, getLang, t, type MessageKey } from '../i18n/index';
import { esc } from './dom';

export function isRtl(): boolean {
  return RTL_LANGS.has(getLang());
}
import { iconSvg, struckIconSvg, type IconId } from './icons';

// Numbers and times go through Intl for the current language (D-18). Latin digits everywhere
// ("-u-nu-latn"): HUD counters keep a stable width and read the same in ar / hi; grouping and
// separators still follow the language. Formatters are cached per language.
const nfCache = new Map<string, Intl.NumberFormat>();
function nf(two = false): Intl.NumberFormat {
  const key = getLang() + (two ? ':2' : '');
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(`${getLang()}-u-nu-latn`, two ? { minimumIntegerDigits: 2, useGrouping: false } : { maximumFractionDigits: 0 });
    nfCache.set(key, f);
  }
  return f;
}

/** Whole number in the current language (grouping, Latin digits). */
export function fmtInt(n: number): string {
  return nf().format(Math.round(n));
}

/** Number with up to `digits` decimals (prices in silver from hundredths). */
export function fmtDec(n: number, digits = 2): string {
  const key = `${getLang()}:d${digits}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(`${getLang()}-u-nu-latn`, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
    nfCache.set(key, f);
  }
  return f.format(n);
}

/** Name of a town rank (0..RANKS.length-1: Osada … Stolica). */
export function rankName(rank: number): string {
  return t(`rank.${Math.max(0, Math.min(RANKS.length - 1, rank))}` as MessageKey);
}

/** m:ss (or h:mm:ss) from seconds. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const two = nf(true), one = nf();
  if (m >= 60) return `${one.format(Math.floor(m / 60))}:${two.format(m % 60)}:${two.format(r)}`;
  return `${one.format(m)}:${two.format(r)}`;
}

export function ticksClock(ticks: number): string {
  return clock(ticks / TICK_HZ);
}

const dtCache = new Map<string, Intl.DateTimeFormat>();
/** Time of day for a day fraction (0 = midnight); 24 h cycle so the rail line never grows an AM/PM. */
export function dayClock(f: number): string {
  const mins = Math.floor(f * 24 * 60);
  let df = dtCache.get(getLang());
  if (!df) {
    df = new Intl.DateTimeFormat(`${getLang()}-u-nu-latn`, { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' });
    dtCache.set(getLang(), df);
  }
  return df.format(new Date(Date.UTC(2000, 0, 1, Math.floor(mins / 60) % 24, mins % 60)));
}

/** Short list joined the way the language joins units ("a, b" / "a、b" / "a وb"). */
export function joinList(parts: string[]): string {
  const p = parts.filter(Boolean);
  try { return new Intl.ListFormat(getLang(), { type: 'unit', style: 'short' }).format(p); } catch { return p.join(' · '); }
}

/** Bidi-isolate a number/time inside a plain-text sentence (FSI … PDI) when the UI is right-to-left. */
export function iso(s: string | number): string {
  return isRtl() ? `\u2068${s}\u2069` : String(s);
}

/** <bdi> around a number/time for HTML: keeps "3:05" and "12/30" in reading order inside Arabic text. */
export function bdi(s: string | number, cls = 'num'): string {
  return `<bdi class="${cls}">${esc(String(s))}</bdi>`;
}

/**
 * A whole-sentence message as escaped HTML with its parameters wrapped in <bdi> (numbers, times,
 * names keep their own direction). Plural parameters are resolved as numbers first.
 */
export function tHtml(key: MessageKey, params: Record<string, string | number>): string {
  const raw = t(key);
  const marks: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) marks[k] = raw.includes(`{${k}, plural,`) ? v : `\u0000${k}\u0000`;
  let s = esc(t(key, marks));
  for (const [k, v] of Object.entries(params)) s = s.split(`\u0000${k}\u0000`).join(bdi(v));
  return s;
}

export function capFirst(s: string): string {
  return s.length ? s[0]!.toLocaleUpperCase(getLang()) + s.slice(1) : s;
}

/** Count word for cells with Polish plural rules (1 pole, 2-4 pola, 5+ pól); English uses one/other. */
export function cellsWord(n: number): string {
  // CLDR plural category of the current language mapped onto the three stored forms
  const cat = new Intl.PluralRules(getLang()).select(n);
  const form = cat === 'one' ? 'one' : cat === 'few' || cat === 'two' ? 'few' : 'many';
  return t(`unit.cell.${form}` as MessageKey);
}

export function goodName(g: Good): string {
  return t(`good.${g}` as MessageKey);
}

export function buildingName(world: World, id: number): string {
  const b = buildingById(world, id);
  return b ? t(`building.${b.type}` as MessageKey) : '—';
}

export function wagonName(id: number): string {
  return t('wagon.name', { id });
}

/** Status keys: 'status.<k>' or 'status.<k>.<cause>'. */
export function buildingStatusText(s: BuildingStatus, world?: World): string {
  // contested input: name the consumer that takes it ("Drewno idzie do: Tartak"), the chain links to it
  if (s.k === 'NO_INPUT' && s.cause === 'CONTESTED' && world && s.blockedBy >= 0 && buildingById(world, s.blockedBy)) {
    return capFirst(t('status.NO_INPUT.CONTESTED.to', { good: goodName(s.good), rival: buildingName(world, s.blockedBy) }));
  }
  const cause = 'cause' in s ? s.cause : null;
  const key = (cause ? `status.${s.k}.${cause}` : `status.${s.k}`) as MessageKey;
  const params: Record<string, string | number> = {};
  if ('good' in s) {
    params.good = goodName(s.good);
    params.goodGen = t(`goodGen.${s.good}` as MessageKey);
    params.goodAcc = t(`goodAcc.${s.good}` as MessageKey);
  }
  if ('wagon' in s) params.wagon = s.wagon;
  return capFirst(t(key, params));
}

export function wagonStatusText(world: World, s: WagonStatus): string {
  if (s.k === 'NO_ROUTE') {
    return s.target >= 0 ? t('wagon.NO_ROUTE', { target: buildingName(world, s.target) }) : t('wagon.NO_ROUTE.home');
  }
  if (s.k === 'BRIDGE_JAM') return t('wagon.BRIDGE_JAM', { blocker: s.blocker });
  if (s.k === 'BRIDGE_CLOSED') return t('wagon.BRIDGE_CLOSED.in', { time: iso(ticksClock(Math.max(0, s.until - world.state.tick))) });
  return t(`wagon.${s.k}` as MessageKey);
}

export function linkText(world: World, l: ReasonLink): string {
  return l.kind === 'building' ? buildingStatusText(l.status, world) : wagonStatusText(world, l.status);
}

export function linkSubject(world: World, l: ReasonLink): string {
  return l.kind === 'building' ? buildingName(world, l.id) : wagonName(l.id);
}

/** A building status counts as a stall worth a bubble. */
export function isStall(s: BuildingStatus): boolean {
  switch (s.k) {
    case 'NO_ROAD':
    case 'NO_INPUT':
    case 'NO_WAGON':
    case 'OUTPUT_FULL':
    case 'WAITING_PICKUP':
    case 'STORAGE_FULL':
      return true;
    default:
      return false;
  }
}

/** Critical stalls get the wax-clay marker: nothing is on the way to fix them. */
export function isCritical(s: BuildingStatus, stalledTicks: number): boolean {
  if (s.k === 'NO_ROAD') return true;
  if (s.k === 'NO_INPUT' && s.cause === 'UNREACHABLE') return true;
  if (s.k === 'NO_WAGON' && s.cause === 'NONE_CAN_REACH') return true;
  if (s.k === 'OUTPUT_FULL' && s.cause === 'NO_DESTINATION') return true;
  return stalledTicks > 45 * TICK_HZ && s.k !== 'WAITING_PICKUP';
}

/** Icon markup for a building status (missing good = good icon with a stroke-through). */
export function buildingStatusIcon(s: BuildingStatus, size: number, type?: keyof typeof BUILDINGS): string {
  switch (s.k) {
    case 'NO_ROAD': return iconSvg('no_road', size);
    case 'NO_INPUT': return s.cause === 'CONTESTED' ? iconSvg('contested', size) : struckIconSvg(s.good, size);
    case 'NO_WAGON': return iconSvg('no_wagon', size);
    case 'OUTPUT_FULL': return iconSvg('output_full', size);
    case 'WAITING_PICKUP': return iconSvg('waiting', size);
    case 'WAITING_DELIVERY': return iconSvg(s.good, size);
    case 'WAITING_UPSTREAM': return iconSvg('waiting', size);
    case 'STORAGE_FULL': return iconSvg('storage_full', size);
    case 'CONTRACT_DONE': return iconSvg('seal', size);
    default: return iconSvg((type ?? 'castle') as IconId, size);
  }
}

export function wagonStatusIcon(s: WagonStatus, size: number): string {
  if (s.k === 'BRIDGE_JAM') return iconSvg('bridge_jam', size);
  if (s.k === 'NO_ROUTE') return iconSvg('no_route', size);
  if (s.k === 'BRIDGE_CLOSED') return iconSvg('bridge_ice', size);
  return iconSvg('wagon', size);
}

/** Seconds a wagon still waits for the ice to clear (its ETA starts after that). */
export function iceWaitSec(world: World, s: WagonStatus): number {
  return s.k === 'BRIDGE_CLOSED' ? Math.max(0, s.until - world.state.tick) / TICK_HZ : 0;
}

/** A wagon status that is a wait worth explaining (bubble, red status line, cause chain). */
export function isWagonWait(s: WagonStatus): boolean {
  return s.k === 'BRIDGE_JAM' || s.k === 'NO_ROUTE' || s.k === 'BRIDGE_CLOSED';
}

export function linkIcon(world: World, l: ReasonLink, size: number): string {
  if (l.kind === 'wagon') return wagonStatusIcon(l.status, size);
  const b = buildingById(world, l.id);
  return buildingStatusIcon(l.status, size, b?.type);
}
