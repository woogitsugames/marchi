// The free valley's rank / grow card: its building, or its pair (D-380), as the card and its sheet name it.
import { BUILDINGS, type BuildingType } from '../sim/index';
import { t, type MessageKey } from '../i18n/index';

/** The card's building, or its pair (D-380: "Słodownia + Browar"), and the price of both. */
export function cardBuild(pc: { type: BuildingType; then?: BuildingType }): { name: string; price: number } {
  const a = t(`building.${pc.type}` as MessageKey);
  if (!pc.then) return { name: a, price: BUILDINGS[pc.type].price };
  return { name: t('build.pair', { a, b: t(`building.${pc.then}` as MessageKey) }), price: BUILDINGS[pc.type].price + BUILDINGS[pc.then].price };
}
