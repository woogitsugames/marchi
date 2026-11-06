// Startup milestones as User Timing marks (`marchia:<name>`), read by tools/startup-probe.mjs and visible in any
// DevTools performance recording (chrome://inspect on the APK). Each name is marked once; never read by the game.
const done = new Set<string>();

export function startupMark(name: string): void {
  if (done.has(name)) return;
  done.add(name);
  try { performance.mark(`marchia:${name}`); } catch { /* old WebView without User Timing */ }
}
