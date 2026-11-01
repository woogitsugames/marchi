// Where the downloadable 4K texture pack (assets-ultra/, D-17 / D-20) is fetched from.
// See docs/ASSET_PACK.md for hosting and for running the dev mode.

/**
 * Production location of the pack root (the folder that holds manifest.json and textures/).
 * PLACEHOLDER: no hosting is chosen yet (see docs/ASSET_PACK.md). `.invalid` never resolves, so a
 * build that forgets to set a real URL fails fast with a network error instead of hitting a
 * random host.
 */
export const ASSET_PACK_PROD_BASE = 'https://ultra-pack.marchia.invalid/';

/** Pack root inside the repo; the Vite dev server serves it as-is at `<origin>/assets-ultra/`. */
export const ASSET_PACK_DEV_PATH = 'assets-ultra/';

export interface PackBaseEnv {
  /** import.meta.env.DEV */
  dev: boolean;
  /** import.meta.env.VITE_ASSET_PACK_BASE — explicit override, wins in every mode. */
  override?: string | undefined;
  /** Page origin in dev mode, e.g. `http://192.168.1.20:5173`. */
  origin?: string | undefined;
}

/** Pure resolver (unit-tested): override > dev server > production placeholder. Always ends in '/'. */
export function resolvePackBase(env: PackBaseEnv): string {
  const raw = env.override?.trim()
    || (env.dev && env.origin ? `${env.origin.replace(/\/+$/, '')}/${ASSET_PACK_DEV_PATH}` : '')
    || ASSET_PACK_PROD_BASE;
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** The pack base for this build / page. */
export function packBaseUrl(): string {
  const env = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  const override = typeof env.VITE_ASSET_PACK_BASE === 'string' ? env.VITE_ASSET_PACK_BASE : undefined;
  const origin = typeof location !== 'undefined' ? location.origin : undefined;
  return resolvePackBase({ dev: env.DEV === true, override, origin });
}
