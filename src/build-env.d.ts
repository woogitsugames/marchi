/** Injected by vite.config.ts `define` (git short sha); undefined under tsx tests and the bench build. */
declare const __BUILD_SHA__: string | undefined;

/** URL of the prebaked model catalogue emitted by the build (vite.config.ts `baked-models`, D-331); null in dev. */
declare module 'virtual:baked-models' {
  const url: string | null;
  export default url;
}
