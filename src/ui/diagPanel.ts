// `?diag=1` panel (BACKLOG P2): live p50/p95/p99 of the frame time for the current speed bucket and a button that
// copies the whole report (every bucket, histogram, device and layout) as JSON for docs/PERF.md. Debug only: the
// App creates it only for ?diag=1. The collector is src/game/frameDiag.ts; protocol in docs/PERF.md (?diag=1).
import { FrameDiag, type DiagReport } from '../game/frameDiag';
import { t } from '../i18n/index';
import { h } from './dom';

export class DiagPanel {
  readonly diag = new FrameDiag();
  private el: HTMLElement;
  private text: HTMLElement;
  private shownAt = 0;
  private key = '';

  constructor(parent: HTMLElement, private meta: () => Record<string, unknown>) {
    this.text = h('div.diag-text.num');
    const copy = h('button.diag-btn', { type: 'button' }, t('diag.copy'));
    const reset = h('button.diag-btn', { type: 'button' }, t('diag.reset'));
    copy.addEventListener('click', () => void this.copy(copy));
    reset.addEventListener('click', () => { this.diag.reset(); this.shownAt = 0; });
    this.el = h('div.diag', null, this.text, h('div.diag-row', null, copy, reset));
    parent.append(this.el);
    (window as unknown as { __marchiaDiag?: unknown }).__marchiaDiag = {
      report: () => this.report(), reset: () => this.diag.reset(),
    };
  }

  report(): DiagReport {
    return this.diag.report(this.meta());
  }

  /** One frame. `key`: the speed bucket ('pause', 'x1', …, 'menu'). */
  frame(key: string, frameMs: number, simMs: number, viewMs: number, now: number): void {
    this.diag.record(key, frameMs, simMs, viewMs);
    if (key === this.key && now - this.shownAt < 1000) return;
    this.key = key;
    this.shownAt = now;
    const b = this.diag.bucket(key);
    if (!b) return;
    const f = b.frameMs;
    this.text.textContent = `${key}  ${b.seconds.toFixed(0)} s  ${b.frames} f\n` +
      `p50 ${f.p50.toFixed(1)}  p95 ${f.p95.toFixed(1)}  p99 ${f.p99.toFixed(1)} ms\n` +
      `>33 ms ${b.jank} (${(b.jankShare * 100).toFixed(1)} %)  sim ${b.simMsP95.toFixed(2)}  view ${b.viewMsP95.toFixed(2)}`;
  }

  private async copy(btn: HTMLElement): Promise<void> {
    const json = JSON.stringify(this.report(), null, 1);
    console.info(json);
    try {
      await navigator.clipboard.writeText(json);
      btn.textContent = t('diag.copied');
    } catch {
      // WebView without clipboard permission: show the JSON selected, to copy by hand
      const area = h('textarea.diag-json', { readonly: true }) as HTMLTextAreaElement;
      area.value = json;
      this.el.querySelector('.diag-json')?.remove();
      this.el.append(area);
      area.select();
    }
    setTimeout(() => { btn.textContent = t('diag.copy'); }, 1500);
  }
}
