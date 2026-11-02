// WCAG contrast of every text/background pair used by the palette mockups: node contrast.cjs
global.window = {}; require('./palettes.js');
const lum = (h) => { const n = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [['text', 'panel'], ['dim', 'panel'], ['num', 'panel'], ['alertInk', 'panel'], ['alertText', 'alert'], ['activeText', 'active'], ['text', 'dock'], ['dim', 'dock'], ['num', 'dock'], ['text', 'panel2']];
let min = 99;
for (const [k, p] of Object.entries(window.PALETTES)) {
  const r = pairs.map(([f, b]) => { const v = cr(p[f], p[b]); min = Math.min(min, v); return `${f}/${b} ${v.toFixed(1)}${v < 4.5 ? ' FAIL' : ''}`; });
  console.log(k, p.name, '\n  ' + r.join(' | '));
}
console.log('min', min.toFixed(2));
// separation of panel/dock grounds and the frame edge from the map (mean meadow / forest colour of bg-412x915)
for (const [k, p] of Object.entries(window.PALETTES)) {
  console.log(k, 'vs meadow #5b5b3a: panel', cr(p.panel, '#5b5b3a').toFixed(2), 'dock', cr(p.dock, '#5b5b3a').toFixed(2), 'edge', cr(p.edge, '#5b5b3a').toFixed(2), '| vs forest #464936: panel', cr(p.panel, '#464936').toFixed(2), 'edge', cr(p.edge, '#464936').toFixed(2));
}
