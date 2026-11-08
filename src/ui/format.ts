// Player-facing text for sim data (status keys -> i18n), times and icons for reasons.
import { BUILDINGS, RANKS, TICK_HZ, buildingById, castleNameKey, type BuildingStatus, type Good, type ReasonLink, type WagonStatus, type World } from '../sim/index';
import { RTL_LANGS, getLang, onLangChange, t, type MessageKey } from '../i18n/index';
import { bridgeJamCause, type BridgeJamCause } from './bridgeJam';
import { esc } from './dom';
import { granaryLoads, statusKey } from './stallKinds';

export function isRtl(): boolean {
  return RTL_LANGS.has(getLang());
}
import { iconSvg, struckIconSvg, type IconId } from './icons';
import { fmtDayTime, fmtDuration, setFmtLang } from './fmt';

// formatters follow the UI language (cache dropped on every switch)
onLangChange(() => setFmtLang(getLang()));

// Numbers and times: src/ui/fmt.ts (Intl, cache per language, D-49); re-exported for existing imports.
export { fmtDec, fmtInt, fmtPercent, fmtRatio } from './fmt';
/** Name of a town rank (0..RANKS.length-1: Osada … Stolica). */
export function rankName(rank: number): string {
  return t(`rank.${Math.max(0, Math.min(RANKS.length - 1, rank))}` as MessageKey);
}

/** m:ss (or h:mm:ss) from seconds. */
export function clock(sec: number): string {
  return fmtDuration(sec);
}

/** Lateness rounded up to 10 s — one rule for the pace card, the waybill and the castle sheet (D-318). */
export function lateTicks10(ticks: number): number {
  return Math.ceil(ticks / (10 * TICK_HZ)) * 10 * TICK_HZ;
}

export function ticksClock(ticks: number): string {
  return fmtDuration(ticks / TICK_HZ);
}

/** Time of day for a day fraction (0 = midnight); 24 h cycle so the rail line never grows an AM/PM. */
export function dayClock(f: number): string {
  return fmtDayTime(f);
}

/** Short list joined the way the language joins units ("a, b" / "a、b" / "a وb"). */
export function joinList(parts: string[]): string {
  const p = parts.filter(Boolean);
  try { return new Intl.ListFormat(getLang(), { type: 'unit', style: 'short' }).format(p); } catch { return p.join(' · '); }
}

/** Two or more whole sentences in a row: Chinese and Japanese set none after "。", the other scripts one space. */
export function sentences(...parts: string[]): string {
  const l = getLang();
  return parts.filter(Boolean).join(l === 'ja' || l === 'zh-Hans' ? '' : ' ');
}

/** Bidi-isolate a number/time inside a plain-text sentence (FSI … PDI) when the UI is right-to-left. */
export function iso(s: string | number): string {
  return isRtl() ? `\u2068${s}\u2069` : String(s);
}

/** No letter in it: a number, time, price, ratio or percent ("−30", "+2", "3:05", "12/30", "90%"). */
const NO_LETTER = /^[^\p{L}]*$/u;

/**
 * <bdi> around a number/time for HTML: keeps "3:05" and "12/30" in reading order inside Arabic text. Content with
 * no letter is isolated as left-to-right (`dir="ltr"`): a bare <bdi> is dir=auto, and with no strong character it
 * takes the parent's RTL direction, so "−30" showed as "30−" (D-340). Names keep dir=auto.
 */
export function bdi(s: string | number, cls = 'num'): string {
  const v = String(s);
  return `<bdi class="${cls}"${NO_LETTER.test(v) ? ' dir="ltr"' : ''}>${esc(v)}</bdi>`;
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

export function goodName(g: Good): string {
  return t(`good.${g}` as MessageKey);
}

export function buildingName(world: World, id: number): string {
  const b = buildingById(world, id);
  if (!b) return '—';
  // two castles (D-288): each castle by its own name ("Zamek Wschodni", "Zamek Północny")
  const named = b.type === 'castle' ? castleNameKey(world, id) : null;
  return named ? t(`castle.name.${named}`) : t(`building.${b.type}` as MessageKey);
}

/** Fleet number of a wagon ("Wóz 3", D-44), or null when it is gone (sold). */
export function wagonNumber(world: World, id: number): number | null {
  const w = world.state.wagons.find((q) => q.id === id);
  return w ? w.n : null;
}

/** "Wóz 3" by fleet number; a sold wagon (e.g. in the end-letter ledger) is just "Wóz". */
export function wagonName(world: World, id: number): string {
  const n = wagonNumber(world, id);
  return n === null ? t('wagon.kicker') : t('wagon.name', { id: n });
}

/**
 * Status keys: 'status.<k>' or 'status.<k>.<cause>'. `id` (the building with this status) lets a full yard
 * nobody needs right now read as the calm surplus, never "no wagon to collect" (first-10-e N7, D-160).
 */
export function buildingStatusText(s: BuildingStatus, world?: World, id = -1): string {
  // contested input: name the consumer that takes it ("Drewno idzie do: Tartak"), the chain links to it
  if (s.k === 'NO_INPUT' && s.cause === 'CONTESTED' && world && s.blockedBy >= 0 && buildingById(world, s.blockedBy)) {
    return capFirst(t('status.NO_INPUT.CONTESTED.to', { good: goodName(s.good), rival: buildingName(world, s.blockedBy) }));
  }
  // mission XVII (D-356): the input goes to the first castle's chain ("Drewno → Tartak, dla Zamku Wschodniego")
  if (s.k === 'NO_INPUT' && s.cause === 'CHAIN_FIRST' && world && s.blockedBy >= 0 && buildingById(world, s.blockedBy)) {
    const first = world.state.mission.firstCastle ?? -1;
    const named = first >= 0 ? castleNameKey(world, first) : null;
    return capFirst(t('status.NO_INPUT.CHAIN_FIRST.to', {
      good: goodName(s.good), rival: buildingName(world, s.blockedBy), forCastle: named ? t(`castle.for.${named}`) : buildingName(world, first),
    }));
  }
  let key = statusKey(s, world, id);
  const params: Record<string, string | number> = {};
  // "the supplier is making it now" only while it is: a supplier waiting for its own input says so (F5, D-44)
  const sup = s.k === 'WAITING_UPSTREAM' && world ? buildingById(world, s.from) : undefined;
  if (sup && sup.progress < 0 && (sup.status.k === 'WAITING_DELIVERY' || sup.status.k === 'WAITING_UPSTREAM')) {
    key = 'status.WAITING_UPSTREAM.supplierWaits';
    params.supplierGood = goodName(sup.status.good);
    params.supplierGoodAcc = t(`goodAcc.${sup.status.good}` as MessageKey);
  }
  if ('good' in s) {
    params.good = goodName(s.good);
    params.goodGen = t(`goodGen.${s.good}` as MessageKey);
    params.goodAcc = t(`goodAcc.${s.good}` as MessageKey);
  }
  if ('wagon' in s) params.wagon = world ? wagonNumber(world, s.wagon) ?? '—' : s.wagon;
  // a held job (D-155): when the busy wagon should stand at the source, counted down from the sim tick
  if (s.k === 'WAGON_DUE') params.time = world ? iso(ticksClock(Math.max(0, s.at - world.state.tick))) : '—';
  return capFirst(t(key, params));
}

const BRIDGE_JAM_KEY: Record<BridgeJamCause, MessageKey> = {
  ONCOMING: 'wagon.BRIDGE_JAM.ONCOMING',
  SPAN_FULL: 'wagon.BRIDGE_JAM.SPAN_FULL',
  YIELD: 'wagon.BRIDGE_JAM.YIELD',
  UNKNOWN: 'wagon.BRIDGE_JAM',
};

export function wagonStatusText(world: World, s: WagonStatus): string {
  if (s.k === 'NO_ROUTE') {
    return s.target >= 0 ? t('wagon.NO_ROUTE', { target: buildingName(world, s.target) }) : t('wagon.NO_ROUTE.home');
  }
  if (s.k === 'BRIDGE_JAM') return t(BRIDGE_JAM_KEY[bridgeJamCause(world, s)], { blocker: wagonNumber(world, s.blocker) ?? '—' });
  if (s.k === 'BRIDGE_CLOSED') return t('wagon.BRIDGE_CLOSED.in', { time: iso(ticksClock(Math.max(0, s.until - world.state.tick))) });
  return t(`wagon.${s.k}` as MessageKey);
}

export function linkText(world: World, l: ReasonLink): string {
  if (l.kind === 'building' && l.waits === 'CUSTOMER' && 'good' in l.status) {
    const g = l.status.good;
    return capFirst(t('why.waitsCustomer', { good: goodName(g), goodGen: t(`goodGen.${g}` as MessageKey) }));
  }
  return l.kind === 'building' ? buildingStatusText(l.status, world, l.id) : wagonStatusText(world, l.status);
}

export function linkSubject(world: World, l: ReasonLink): string {
  return l.kind === 'building' ? buildingName(world, l.id) : wagonName(world, l.id);
}

export { codexLink, isCritical, isStall, isStallLink, isWagonWait, statusKey } from './stallKinds';

/** Icon markup for a building status (missing good = good icon with a stroke-through). */
export function buildingStatusIcon(s: BuildingStatus, size: number, type?: keyof typeof BUILDINGS): string {
  switch (s.k) {
    case 'NO_ROAD': return iconSvg('no_road', size);
    case 'NO_INPUT': return s.cause === 'CONTESTED' || s.cause === 'CHAIN_FIRST' ? iconSvg('contested', size) : struckIconSvg(s.good, size);
    case 'NO_WAGON': return iconSvg('no_wagon', size);
    case 'OUTPUT_FULL': return iconSvg('output_full', size);
    case 'WAITING_PICKUP': return iconSvg('waiting', size);
    case 'WAGON_DUE': return iconSvg('wagon_due', size);
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


export function linkIcon(world: World, l: ReasonLink, size: number): string {
  if (l.kind === 'wagon') return wagonStatusIcon(l.status, size);
  return buildingStateIcon(world, l.id, l.status, size);
}

/**
 * A building's status icon read against the world: a granary full only of loads no market takes now (D-174, the
 * status text 'status.STORAGE_FULL.saturated') shows the tipped balance of 'market_full' (D-345), not the packed
 * storehouse of a full granary a wagon would empty.
 */
export function buildingStateIcon(world: World, id: number, s: BuildingStatus, size: number): string {
  if (s.k === 'STORAGE_FULL' && granaryLoads(world, id) === 'saturated') return iconSvg('market_full', size);
  return buildingStatusIcon(s, size, buildingById(world, id)?.type);
}
