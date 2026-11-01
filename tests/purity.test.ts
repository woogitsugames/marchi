import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, test } from './harness';

const simDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'sim');
const forbidden = [/Math\.random/, /\bDate\b/, /Math\.(sin|cos|tan|exp|pow|atan2|log|hypot|cbrt)\b/, /from ['"]three/, /\bdocument\./, /\bwindow\./, /performance\.now/];

test('simulation code uses no DOM, three.js, wall clock or non-deterministic math', () => {
  for (const f of readdirSync(simDir)) {
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(join(simDir, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const re of forbidden) assert(!re.test(src), `${f} contains ${re}`);
  }
});
