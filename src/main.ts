// Entry point: fonts, styles, language, world view (three.js if available, else Canvas2D), app.
import '@fontsource/grenze-gotisch/latin-600.css';
import '@fontsource/grenze-gotisch/latin-ext-600.css';
import '@fontsource/grenze-gotisch/latin-700.css';
import '@fontsource/grenze-gotisch/latin-ext-700.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-ext-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-ext-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/alegreya-sans/cyrillic-400.css';
import '@fontsource/alegreya-sans/cyrillic-500.css';
import '@fontsource/alegreya-sans/cyrillic-700.css';
import '@fontsource/alegreya-sans/cyrillic-ext-400.css';
import '@fontsource/ruslan-display/cyrillic-400.css';
import '@fontsource/alegreya-sans/latin-ext-700.css';
import './styles/main.css';

import { RTL_LANGS, detectLang, onLangChange, parseLang, scriptOf, setLang, t } from './i18n/index';
import type { CreateWorldView, WorldView } from './render/api';
import { App } from './ui/app';
import { createFlatView } from './ui/flatView';

// The three.js view is written separately; the glob keeps the build working when it is absent.
const renderModules = import.meta.glob<{ createWorldView?: CreateWorldView }>('./render/view.ts');

async function pickView(params: URLSearchParams): Promise<{ view: WorldView; kind: 'three' | 'flat' }> {
  const load = renderModules['./render/view.ts'];
  if (params.get('view') !== 'flat' && load) {
    try {
      const mod = await load();
      if (mod.createWorldView) {
        const view = mod.createWorldView();
        return { view, kind: 'three' };
      }
    } catch (e) {
      console.warn('three.js view failed to load, using the flat view', e);
    }
  }
  return { view: createFlatView(), kind: 'flat' };
}

async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const lang = parseLang(params.get('lang')) ?? detectLang();
  // lang/dir before the first frame (the dictionary loads lazily); title and the canvas label follow every switch
  const root = document.documentElement;
  root.lang = lang;
  root.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  root.dataset.script = scriptOf(lang);
  const label = (): void => {
    document.title = t('app.docTitle');
    document.getElementById('scene')?.setAttribute('aria-label', t('app.valley'));
  };
  onLangChange(label);
  // the dictionary, the document title and the canvas label are ready before the first frame (with the fonts)
  const langReady = setLang(lang).then(label);
  // Fonts first so the first frame of the menu is set in the right faces.
  try {
    await Promise.race([
      Promise.all([
        langReady,
        document.fonts.load("600 28px 'Grenze Gotisch'", 'Marchia ąęłńóśźż'),
        document.fonts.load("700 56px 'Grenze Gotisch'", 'Marchia'),
        document.fonts.load("400 15px 'Alegreya Sans'", 'ąęłńóśźż'),
        document.fonts.load("700 15px 'Alegreya Sans'", '0123'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* fonts are a nicety */ }

  // No page zoom: block iOS gesture events and double-tap zoom outside scrollable sheet bodies.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  let picked = await pickView(params);
  let app: App;
  try {
    app = new App({ canvas, ui, view: picked.view, params });
  } catch (e) {
    if (picked.kind !== 'three') throw e;
    console.warn('three.js view failed to mount, using the flat view', e);
    picked = { view: createFlatView(), kind: 'flat' };
    const fresh = canvas.cloneNode() as HTMLCanvasElement; // a canvas that never had a WebGL context
    canvas.replaceWith(fresh);
    ui.innerHTML = '';
    app = new App({ canvas: fresh, ui, view: picked.view, params });
  }
  document.body.dataset.view = picked.kind;
  // screenshot/perf scripts drive the camera through this handle (debug only, never read by the game)
  if (params.get('perf') === '1') (window as unknown as { __marchiaView?: WorldView }).__marchiaView = picked.view;
  await app.start();
}

void boot();
