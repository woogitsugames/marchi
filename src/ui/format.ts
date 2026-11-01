// Player-facing text for sim data (status keys -> i18n), times and icons for reasons.
import { BUILDINGS, TICK_HZ, buildingById, type BuildingStatus, type Good, type ReasonLink, type WagonStatus, type World } from '../sim/index';
import { t, type MessageKey } from '../i18n/index';
import { iconSvg, struckIconSvg, type IconId } from './icons';

/** m:ss (or h:mm:ss) from seconds. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function ticksClock(ticks: number): string {
  return clock(ticks / TICK_HZ);
}

/** 24 h clock for a day fraction (0 = midnight). */
export function dayClock(f: number): string {
  const mins = Math.floor(f * 24 * 60);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

export function capFirst(s: string): string {
  return s.length ? s[0]!.toLocaleUpperCase() + s.slice(1) : s;
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
export function buildingStatusText(s: BuildingStatus): string {
  const cause = 'cause' in s ? s.cause : null;
  const key = (cause ? `status.${s.k}.${cause}` : `status.${s.k}`) as MessageKey;
  const params: Record<string, string | number> = {};
  if ('good' in s) params.good = goodName(s.good);
  if ('wagon' in s) params.wagon = s.wagon;
  return capFirst(t(key, params));
}

export function wagonStatusText(world: World, s: WagonStatus): string {
  if (s.k === 'NO_ROUTE') {
    return s.target >= 0 ? t('wagon.NO_ROUTE', { target: buildingName(world, s.target) }) : t('wagon.NO_ROUTE.home');
  }
  if (s.k === 'BRIDGE_JAM') return t('wagon.BRIDGE_JAM', { blocker: s.blocker });
  return t(`wagon.${s.k}` as MessageKey);
}

export function linkText(world: World, l: ReasonLink): string {
  return l.kind === 'building' ? buildingStatusText(l.status) : wagonStatusText(world, l.status);
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
    case 'NO_INPUT': return struckIconSvg(s.good, size);
    case 'NO_WAGON': return iconSvg('no_wagon', size);
    case 'OUTPUT_FULL': return iconSvg('output_full', size);
    case 'WAITING_PICKUP': return iconSvg('waiting', size);
    case 'WAITING_DELIVERY': return iconSvg(s.good, size);
    case 'STORAGE_FULL': return iconSvg('storage_full', size);
    case 'CONTRACT_DONE': return iconSvg('seal', size);
    default: return iconSvg((type ?? 'castle') as IconId, size);
  }
}

export function wagonStatusIcon(s: WagonStatus, size: number): string {
  if (s.k === 'BRIDGE_JAM') return iconSvg('bridge_jam', size);
  if (s.k === 'NO_ROUTE') return iconSvg('no_route', size);
  return iconSvg('wagon', size);
}

export function linkIcon(world: World, l: ReasonLink, size: number): string {
  if (l.kind === 'wagon') return wagonStatusIcon(l.status, size);
  const b = buildingById(world, l.id);
  return buildingStatusIcon(l.status, size, b?.type);
}
