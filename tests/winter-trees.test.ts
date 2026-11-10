// Bare deciduous crowns in winter (D-260..D-262): the bare factor follows the season clock without jumps, only the
// broadleaf kinds have leaf cards (conifers stay green), and each leaf card carries one hash for its 4 corners.
import { SEASON_TICKS } from '../src/sim/index';
import { treeParts, TREE_KINDS, TREE_VARIANTS } from '../src/render/models/trees';
import { bareAt, bareBakeLevel, springAt } from '../src/render/leafFall';
import { assert, eq, test } from './harness';

test('winter trees: bare factor 0 in summer, 1 in winter, leaf fall and spring leaves without a jump', () => {
  const S = SEASON_TICKS;
  eq(bareAt(S + S / 2), 0, 'summer in leaf');
  eq(bareAt(2 * S), 0, 'autumn starts in leaf');
  eq(bareAt(3 * S + 10), 1, 'winter bare');
  eq(bareAt(4 * S + S - 1), 0, 'late spring in leaf');
  eq(bareAt(4 * S + 10), 1, 'next year starts bare');
  // the largest step between two ticks a few seconds apart stays small over a whole year (no pop)
  let prev = bareAt(0), maxStep = 0;
  for (let t = 50; t < 4 * S; t += 50) {
    const b = bareAt(t);
    maxStep = Math.max(maxStep, Math.abs(b - prev));
    prev = b;
  }
  assert(maxStep < 0.03, `bare factor steps ${maxStep} per 5 s of game time`);
  // leaf fall is monotonic through autumn
  let last = -1;
  for (let t = 2 * S; t < 3 * S; t += 100) { const b = bareAt(t); assert(b >= last, 'autumn only drops leaves'); last = b; }
  eq(bareBakeLevel(0.1), 0, 'atlas level rounds down');
  eq(bareBakeLevel(0.9), 1, 'atlas level rounds up');
  eq(bareBakeLevel(0.5), 0.5, 'quarter steps');
});

test('crown green: young green rises with the leaves, summer green, rust from mid-autumn, 0 in winter (D-303, D-540)', () => {
  const S = SEASON_TICKS;
  eq(springAt(0), 0, 'spring starts bare, no green');
  eq(springAt(S * 0.8), 1, 'late spring fully green');
  eq(springAt(S + S * 0.5), 2, 'mid summer: summer green, not the autumn palette (D-540)');
  assert(springAt(2 * S + 10) > 1.99, 'autumn starts in summer green');
  eq(springAt(2 * S + S * 0.6), 0, 'rust by the time the leaves fall (60 % of autumn)');
  eq(bareAt(2 * S + S * 0.6), 0, '... which is when they start to fall');
  eq(springAt(3 * S - 10), 0, 'late autumn');
  eq(springAt(3 * S + 10), 0, 'winter');
  // a returning leaf card is already young green: the rise mirrors the bare factor exactly
  for (let t = 0; t < S; t += 37) assert(Math.abs(springAt(t) - (1 - bareAt(t))) < 1e-9, `spring rise = leaf return at ${t}`);
  // ... so their quarter-step atlas levels change together (no extra re-bake in spring)
  for (let t = 0; t < S; t += 37) eq(bareBakeLevel(springAt(t)), 1 - bareBakeLevel(bareAt(t)), `same bake step at ${t}`);
  let prev = springAt(0), maxStep = 0;
  for (let t = 50; t < 4 * S; t += 50) {
    const v = springAt(t);
    maxStep = Math.max(maxStep, Math.abs(v - prev));
    prev = v;
  }
  assert(maxStep < 0.03, `spring factor steps ${maxStep} per 5 s of game time`);
});

test('winter trees: leaf cards only on broadleaf kinds, one hash per card in (0, 1)', () => {
  for (const kind of TREE_KINDS) {
    for (let v = 0; v < TREE_VARIANTS; v++) {
      const parts = treeParts(kind, v);
      const leaves = parts.find((p) => p.material === 'leaves');
      const conifer = kind === 'spruce' || kind === 'pine';
      eq(!!leaves, !conifer, `${kind}:${v} leaf cards`);
      for (const p of parts) {
        const a = p.geometry.getAttribute('aTree');
        assert(a, `${kind}:${v} ${p.material} has aTree`);
        if (p.material !== 'leaves') {
          for (let i = 0; i < a.count; i++) eq(a.getZ(i), 0, `${kind}:${v} ${p.material} keeps z = 0`);
          continue;
        }
        eq(a.count % 4, 0, `${kind}:${v} 4 corners per card`);
        const seen = new Set<number>();
        for (let i = 0; i < a.count; i += 4) {
          const h = a.getZ(i);
          assert(h >= 0.02 && h <= 0.98, `${kind}:${v} card hash ${h} in range`);
          for (let k = 1; k < 4; k++) eq(a.getZ(i + k), h, `${kind}:${v} card ${i / 4} corner ${k}`);
          seen.add(Math.round(h * 50));
        }
        assert(seen.size > 10, `${kind}:${v} hashes spread (${seen.size} buckets)`);
      }
    }
  }
});
