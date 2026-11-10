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

test('menu pause: menu -> settings -> menu again keeps ×2; a paused game stays paused', () => {
  const p = new MenuPause();
  p.hold(2);
  p.hold(0);
  eq(p.holding, true, 'held');
  eq(p.release(), 2, '×2 back');
  eq(p.holding, false, 'released');
  p.hold(0);
  eq(p.release(), 0, 'paused before the menu: stays paused (D-560)');
  p.hold(1);
  eq(p.release(), 1, 'a fresh pause takes the new speed');
});

test('menu pause: a game the player paused stays paused after the menu (also double open, Settings, system back)', () => {
  const p = new MenuPause();
  p.hold(0);
  p.hold(0); // double tap / menu opened again from Settings
  eq(p.holding, true, 'held although the speed is 0');
  eq(p.release(), 0, 'closed (resume, X, system back): still paused');
  eq(p.release(), null, 'a second close changes nothing');
  p.hold(4);
  eq(p.release(), 4, 'a pause taken from a running game gives its speed back');
  p.hold(0);
  p.hold(4); // nothing in the UI can raise the speed under an open menu, but a held pause is not retaken
  eq(p.release(), 0, 'the first take wins');
});
