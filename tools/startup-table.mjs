// Table for tools/startup-probe.mjs output files <tag>-<quality>-r<N>.json: median (min–max) of every mark over all
// reps of all rounds, the main-thread CPU per startup phase and the GL time.
// Usage: node tools/startup-table.mjs <dir> [marks=boot,fonts,view-module,app,menu-world,menu-sim,menu-dom,first-frame,menu-saves,ready]
import { readdirSync, readFileSync } from 'node:fs';
const [dir, marksS = 'boot,fonts,view-module,app,menu-world,menu-sim,menu-dom,menu-saves,ready,first-frame'] = process.argv.slice(2);
const marks = marksS.split(',');
const groups = new Map();
for (const f of readdirSync(dir).sort()) {
  const m = f.match(/^(.+)-(low|high)-r\d+\.json$/);
  if (!m) continue;
  const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  const k = `${m[1]} ${m[2]}`;
  groups.set(k, [...(groups.get(k) ?? []), ...d.runs]);
}
const med = (a) => { const s = a.filter((x) => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const cell = (a) => { const s = a.filter((x) => typeof x === 'number'); return s.length ? `${med(s)} (${Math.min(...s)}–${Math.max(...s)})` : '—'; };
console.log(`| wersja | jakość | n | ${marks.join(' | ')} |`);
console.log(`|---|---|---:|${marks.map(() => '---:').join('|')}|`);
for (const [k, rs] of groups) console.log(`| ${k.replace(' ', ' | ')} | ${rs.length} | ${marks.map((mk) => cell(rs.map((r) => r.marks[mk]))).join(' | ')} |`);
console.log('\nCPU głównego wątku na fazę (mediana ms; faza = od znacznika do następnego):\n');
const phases = ['pre-boot', 'boot', 'fonts', 'view-module', 'app', 'menu-start', 'menu-world', 'menu-sim', 'menu-dom', 'world', 'ready', 'first-frame'];
console.log(`| wersja | jakość | ${phases.join(' | ')} | GL shader ms | GL tex ms | długie zadania przed ready (ms) |`);
console.log(`|---|---|${phases.map(() => '---:').join('|')}|---:|---:|---:|`);
for (const [k, rs] of groups) console.log(`| ${k.replace(' ', ' | ')} | ${phases.map((p) => { const v = med(rs.map((r) => r.cpu.phases?.[p]?.ms ?? 0)); return Number.isNaN(v) ? '—' : v; }).join(' | ')} | ${med(rs.map((r) => r.gl.shader))} | ${med(rs.map((r) => r.gl.tex))} | ${med(rs.map((r) => r.longPre.ms))} |`);
