// D-521: the pause menu gives back the speed the player had — also after a double tap on the menu button.
import { MenuPause } from '../src/ui/menuPause';
import { eq, test } from './harness';

test('menu pause: ×4, menu opened twice (double tap), closed -> ×4 again', () => {
  const p = new MenuPause();
  p.hold(4);
  p.hold(0); // the second open sees the game paused by the first
  eq(p.release(), 4, 'speed back');
  eq(p.release(), null, 'a second close (deferred onClose) changes nothing');
});

test('menu pause: menu -> settings -> menu again keeps ×2; a paused game resumes at ×1', () => {
  const p = new MenuPause();
  p.hold(2);
  p.hold(0);
  eq(p.holding, true, 'held');
  eq(p.release(), 2, '×2 back');
  eq(p.holding, false, 'released');
  p.hold(0);
  eq(p.release(), 1, 'paused before the menu: resumes at ×1 (as before)');
  p.hold(1);
  eq(p.release(), 1, 'a fresh pause takes the new speed');
});
