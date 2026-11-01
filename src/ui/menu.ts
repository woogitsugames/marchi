// Main menu strip over the live scene, the settings sheet, the in-game menu sheet and the
// end-of-mission sealed letter.
import { getLang, setLang, t, type Lang, type MessageKey } from '../i18n/index';
import type { Quality } from '../render/api';
import { GOODS, MISSIONS, type World } from '../sim/index';
import { deckle, esc, h, setHtml } from './dom';
import { goodName, ticksClock } from './format';
import { iconSvg } from './icons';
import type { Sheet, SheetContent } from './sheets';

export interface MenuActions {
  continueGame(): void;
  newGame(mission: 'm1' | 'm2' | 'm3' | 'sandbox'): void;
  openSettings(): void;
}

export interface SaveInfo { missionId: string; tick: number }

export function buildMainMenu(act: MenuActions, save: SaveInfo | null): HTMLElement {
  const items: HTMLElement[] = [];
  const item = (label: string, sub: string, fn: () => void, primary = false): void => {
    const b = h(`button.menu-item${primary ? '.primary' : ''}` as 'button.menu-item', null,
      h('span.mi-mark'),
      h('span.mi-text', null, label, sub ? h('span.mi-sub', null, sub) : null));
    b.addEventListener('click', fn);
    items.push(h('li', null, b));
  };
  if (save) {
    const what = save.missionId === 'sandbox' ? t('menu.sandbox') : save.missionId === 'm2' ? t('menu.m2') : save.missionId === 'm3' ? t('menu.m3') : t('menu.m1');
    item(t('menu.continue'), t('menu.continueSub', { what, time: ticksClock(save.tick) }), act.continueGame, true);
  }
  item(t('menu.m1'), t('menu.contractSub'), () => act.newGame('m1'), !save);
  item(t('menu.m2'), t('menu.m2Sub'), () => act.newGame('m2'));
  item(t('menu.m3'), t('menu.m3Sub'), () => act.newGame('m3'));
  item(t('menu.sandbox'), t('menu.sandboxSub'), () => act.newGame('sandbox'));
  item(t('menu.settings'), '', act.openSettings);
  const strip = h('div.menu-strip', null,
    h('h1.title', null, t('app.title')),
    h('p.subtitle', null, t('app.subtitle')),
    h('div.rule'),
    h('ul.menu-list', null, ...items),
  );
  strip.style.clipPath = deckle('bottom', 977, 9, 30);
  return h('div.menu-wrap', null, strip, h('span.menu-pin'));
}

export interface SettingsActions {
  quality(): Quality;
  setQuality(q: Quality): void;
  leftHanded(): boolean;
  setLeftHanded(v: boolean): void;
}

export function settingsSheet(act: SettingsActions): SheetContent {
  return {
    key: 'settings',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('menu', 30));
      sheet.kicker.textContent = '';
      sheet.title.textContent = t('menu.settings');
      const seg = (name: string, opts: [string, string][], cur: string): string =>
        `<div class="seg" role="group">${opts.map(([v, l]) =>
          `<button class="btn cf${v === cur ? ' is-on' : ''}" data-set="${name}:${v}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
      const html = `
        <div class="setting"><span class="s-label">${esc(t('menu.language'))}</span>
          ${seg('lang', [['pl', t('lang.pl')], ['en', t('lang.en')]], getLang())}</div>
        <div class="setting"><span class="s-label">${esc(t('menu.quality'))}</span>
          ${seg('quality', [['high', t('quality.high')], ['low', t('quality.low')]], act.quality())}
          <div class="s-hint">${esc(t('menu.qualityHint'))}</div></div>
        <div class="setting"><span class="s-label">${esc(t('menu.leftHanded'))}</span>
          ${seg('left', [['0', t('menu.off')], ['1', t('menu.on')]], act.leftHanded() ? '1' : '0')}</div>
        <div class="setting"><div class="s-hint">${esc(t('hud.clearHint'))}</div></div>`;
      if (setHtml(sheet.body, html)) {
        sheet.body.querySelectorAll<HTMLElement>('[data-set]').forEach((b) => b.addEventListener('click', () => {
          const [k, v] = (b.dataset.set ?? '').split(':');
          if (k === 'lang') setLang(v as Lang);
          if (k === 'quality') act.setQuality(v as Quality);
          if (k === 'left') act.setLeftHanded(v === '1');
          (sheet.body as HTMLElement & { __html?: string }).__html = undefined;
          this.update(sheet);
        }));
      }
      return true;
    },
  };
}

export interface GameMenuActions {
  resume(): void;
  settings(): void;
  restart(): void;
  toMenu(): void;
}

export function gameMenuSheet(act: GameMenuActions, world: World): SheetContent {
  return {
    key: 'gamemenu',
    update(sheet: Sheet) {
      setHtml(sheet.icon, iconSvg('pause', 30));
      sheet.kicker.textContent = t('menu.paused');
      sheet.title.textContent = world.state.mission.contract ? t('menu.contractItem') : t('hud.sandbox');
      const html = `<div class="sheet-actions" style="flex-direction:column">
        <button class="btn primary cf" data-a="resume">${esc(t('menu.resume'))}</button>
        <button class="btn cf" data-a="settings">${esc(t('menu.settings'))}</button>
        <button class="btn cf" data-a="restart">${esc(t('menu.restart'))}</button>
        <button class="btn cf" data-a="menu">${esc(t('menu.toMenu'))}</button></div>`;
      if (setHtml(sheet.body, html)) {
        sheet.body.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('click', () => {
          const a = b.dataset.a;
          if (a === 'resume') act.resume();
          if (a === 'settings') act.settings();
          if (a === 'restart') act.restart();
          if (a === 'menu') act.toMenu();
        }));
      }
      return true;
    },
  };
}

export interface EndActions { again(): void; menu(): void }

/** The sealed letter at the end of a contract. seals = stars(world) 0..3. */
export function buildEndLetter(world: World, seals: number, act: EndActions): HTMLElement {
  const st = world.state;
  const won = st.mission.result === 'won';
  const c = st.mission.contract;
  const castle = c ? st.buildings.find((b) => b.id === c.castle) : null;
  const delivered = c ? GOODS.filter((g) => c.need[g] > 0).map((g) =>
    `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px">${iconSvg(g, 20)}<span class="num">${Math.min(castle?.stock[g] ?? 0, c.need[g])}/${c.need[g]}</span> ${esc(goodName(g))}</span>`).join('') : '';
  const def = MISSIONS[st.mission.id];
  const sealRow = [0, 1, 2].map((i) => `<span class="s${i < seals ? '' : ' off'}">${iconSvg('seal', 52)}</span>`).join('');
  const letter = h('div.letter' + (won ? '' : '.lost') as 'div.letter', { role: 'dialog', 'aria-modal': 'true' });
  letter.innerHTML = `
    <div class="l-kicker">${esc(t('contract.kicker'))}</div>
    <h2>${esc(t((won ? 'contract.won' : 'contract.lost') as MessageKey))}</h2>
    <p>${esc(t(won ? 'contract.wonText' : 'contract.lostText'))}</p>
    ${won ? `<div class="seals">${sealRow}<span class="s-label">${esc(t('contract.stars', { n: seals }))}</span></div>` : ''}
    <dl class="kv">
      <dt>${esc(t('contract.time'))}</dt><dd class="num">${ticksClock(st.mission.endTick >= 0 ? st.mission.endTick : st.tick)}${def ? ` <span style="font-weight:400;color:var(--ink-soft)">/ ${def.deadlineMin}:00</span>` : ''}</dd>
      <dt>${esc(t('contract.delivered'))}</dt><dd>${delivered}</dd>
      <dt>${esc(t('contract.left'))}</dt><dd class="num">${st.coins}</dd>
    </dl>
    <div class="actions">
      <button class="btn primary cf" data-a="again">${esc(t('contract.again'))}</button>
      <button class="btn cf" data-a="menu">${esc(t('contract.menu'))}</button>
    </div>`;
  letter.style.clipPath = deckle('bottom', 31, 6, 30);
  letter.querySelector('[data-a="again"]')!.addEventListener('click', act.again);
  letter.querySelector('[data-a="menu"]')!.addEventListener('click', act.menu);
  const seal = h('span.big-seal', { html: iconSvg('seal', 72) });
  if (!won) seal.classList.add('broken');
  return h('div.scrim', null, h('div.letter-wrap', null, letter, seal));
}
