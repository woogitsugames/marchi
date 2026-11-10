// D-592: a producer's full yard refused by a full granary while another granary its road reaches has room — the
// next dispatch (≤ 6 ticks) sends the load there. It read as a red card with no cure for that half second (the sheet's
// "Postaw spichlerz" blinked out; valley seed 1320 card-30 tick 30 000, D-431). Now it is calm: "pełne podwórze —
// towar pojedzie do spichlerza, który ma miejsce", one tap to that granary. Synthetic statuses on mission VI.
import { BUILDINGS, applyCommand, createWorld, stateHash, step, suggestLinkToStable, type World } from '../src/sim/index';
import { MIN_STALL_TICKS, calmWhy, cureFor, rankStalls, yardStoreRoom } from '../src/ui/stalls';
import { assert, eq, test } from './harness';

function rig(link: boolean): { w: World; cutter: number; full: number; room: number } {
  const w = createWorld('m6');
  const room = 5;
  if (link) {
    const s = suggestLinkToStable(w, room);
    assert(!!s, 'a road to the second granary');
    w.state.coins += s!.cost;
    assert(applyCommand(w, { t: 'road', surface: 1, cells: s!.cells }).ok, 'link it');
  }
  step(w);
  const full = w.state.buildings.find((b) => b.id === 4)!;
  full.stock.wood = BUILDINGS.warehouse.storeCap!;
  full.status = { k: 'STORAGE_FULL' };
  full.stalledTicks = MIN_STALL_TICKS;
  const cutter = w.state.buildings.find((b) => b.id === 1)!;
  cutter.stock.wood = BUILDINGS.woodcutter.outCap;
  cutter.status = { k: 'OUTPUT_FULL', good: 'wood', cause: 'NO_DESTINATION', blockedBy: full.id };
  cutter.stalledTicks = 10 * MIN_STALL_TICKS;
  return { w, cutter: cutter.id, full: full.id, room };
}

test('yard room: a full yard refused by a full granary while another has room reads calm (D-592)', () => {
  const { w, cutter, room } = rig(true);
  const hash = stateHash(w);
  const b = w.state.buildings.find((q) => q.id === cutter)!;
  eq(yardStoreRoom(w, b), room, 'the granary with room');
  eq(calmWhy(w, b), 'yardRoom', 'the card: the goods will go there');
  const e = rankStalls(w).find((x) => x.id === cutter);
  assert(!!e && e.minor && !e.crit, `a brass pin, not the red card: ${JSON.stringify(e)}`);
  eq(cureFor(w, cutter), null, 'nothing to buy or build');
  eq(stateHash(w), hash, 'read-only');
});

test('yard room: the other granary off the road, or full too -> the red card as before (D-592)', () => {
  const a = rig(false);
  const b = a.w.state.buildings.find((q) => q.id === a.cutter)!;
  eq(yardStoreRoom(a.w, b), -1, 'the granary with room is cut off');
  assert(calmWhy(a.w, b) !== 'yardRoom', 'no calm reading');
  const c = rig(true);
  const other = c.w.state.buildings.find((q) => q.id === c.room)!;
  other.stock.wood = BUILDINGS.warehouse.storeCap!;
  eq(yardStoreRoom(c.w, c.w.state.buildings.find((q) => q.id === c.cutter)!), -1, 'both full');
  assert(calmWhy(c.w, c.w.state.buildings.find((q) => q.id === c.cutter)!) !== 'yardRoom', 'no calm reading');
  const e = rankStalls(c.w).find((x) => x.id === c.cutter);
  assert(!!e && e.crit && !e.minor, `red card: another granary is the cure (${JSON.stringify(e)})`);
});
