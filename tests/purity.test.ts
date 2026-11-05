import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, test } from './harness';

const simDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'sim');
const forbidden = [/Math\.random/, /\bDate\b/, /Math\.(sin|cos|tan|exp|pow|atan2|log|hypot|cbrt)\b/, /from ['"]three/, /\bdocument\./, /\bwindow\./, /performance\.now/, /\*\*(?!\/)/];
/** Every Math function the sim may call: exact in IEEE-754 on every engine (research 2026-11-06); constants (SQRT2) are fine. */
const MATH_OK = new Set(['sqrt', 'abs', 'min', 'max', 'floor', 'round', 'ceil', 'trunc', 'sign', 'imul']);

/** Every .ts file under src/sim, subfolders included (src/sim/proposals holds mission data the sim runs). */
function simFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? simFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);
}

test('simulation code uses no DOM, three.js, wall clock or non-deterministic math', () => {
  const files = simFiles(simDir);
  assert(files.some((f) => f.includes('proposals')), 'subfolders are scanned');
  for (const f of files) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const re of forbidden) assert(!re.test(src), `${f} contains ${re}`);
    for (const m of src.matchAll(/Math\.([A-Za-z0-9_]+)/g)) assert(MATH_OK.has(m[1]!) || /^[A-Z0-9_]+$/.test(m[1]!), `${f} calls Math.${m[1]} (not in the exact set)`);
  }
});
