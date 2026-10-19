import { Z_MAX, Z_MIN, type Camera } from '../core/camera';
import { ZOOM_STEP, type WorldNode } from '../world/types';

const KIND_LABEL: Record<string, string> = {
  root: 'SURFACE',
  project: 'SYSTEM',
  study: 'CASE FILE',
  mechanism: 'MECHANISM',
  source: 'SOURCE',
  gallery: 'SHOWCASE',
  about: 'SUBJECT',
  contact: 'CHANNELS',
  marginalia: 'NOTE',
};

/**
 * The HUD is an instrument panel, not chrome. Its job is to answer the two
 * questions an infinite surface creates: how deep am I, and how do I get back.
 */
export class Hud {
  private needle: HTMLElement;
  private readScale: HTMLElement;
  private readFov: HTMLElement;
  private crumbs: HTMLElement;
  private help: HTMLElement;
  private stratum: HTMLElement;
  private lastPath = '';

  constructor(
    root: HTMLElement,
    private onGoto: (id: string) => void,
  ) {
    root.innerHTML = `
      <div class="hud__tl">
        <a class="mark" href="#/root" data-goto="root">
          <img class="mark__pfp" src="/pfp.jpg" alt="" width="320" height="320" />
          <span class="mark__text">ABHISHEK</span>
        </a>
        <nav class="crumbs" aria-label="Depth"></nav>
      </div>

      <div class="hud__tr">
        <span class="draft">DRAFT COPY</span>
      </div>

      <div class="meter" aria-hidden="true">
        <span class="meter__title">DEPTH</span>
        <div class="meter__track">
          <div class="meter__ticks"></div>
          <div class="meter__needle"><i></i><b class="meter__stratum">I</b></div>
        </div>
      </div>

      <div class="hud__bl">
        <ul class="legend">
          <li><kbd>click</kbd> go in</li>
          <li><kbd>scroll</kbd> next / previous</li>
          <li><kbd>enter</kbd> next system</li>
          <li><kbd>esc</kbd> ascend</li>
          <li><kbd>?</kbd> all keys</li>
        </ul>
      </div>

      <div class="hud__br">
        <div class="readout">
          <span class="readout__row"><em>MAG</em><span class="r-scale">&times;1.00</span></span>
          <span class="readout__row"><em>FOV</em><span class="r-fov">&mdash;</span></span>
        </div>
      </div>

      <div class="help" hidden>
        <div class="help__panel">
          <h3>Controls</h3>
          <dl>
            <div><dt>click</dt><dd>fly into a panel or marker; again to go deeper</dd></div>
            <div><dt>scroll</dt><dd>along the route: surface &rarr; who &rarr; 1&ndash;6 &rarr; reach</dd></div>
            <div><dt>pinch</dt><dd>descend or ascend one stratum, fitted</dd></div>
            <div><dt>enter</dt><dd>next: who &rarr; 1&ndash;6 &rarr; reach &rarr; surface</dd></div>
            <div><dt>shift + enter</dt><dd>previous</dd></div>
            <div><dt>&larr; / &rarr;</dt><dd>previous / next</dd></div>
            <div><dt>&darr; / space</dt><dd>descend one stratum</dd></div>
            <div><dt>&uarr; / esc</dt><dd>ascend one stratum</dd></div>
            <div><dt>1 &ndash; 6</dt><dd>jump to a system</dd></div>
            <div><dt>0</dt><dd>return to the surface</dd></div>
            <div><dt>drag</dt><dd>peek; it springs back</dd></div>
          </dl>
          <p>Five strata. Nothing is a page.</p>
          <button type="button" class="help__close">close</button>
        </div>
      </div>`;

    this.needle = q(root, '.meter__needle');
    this.stratum = q(root, '.meter__stratum');
    this.readScale = q(root, '.r-scale');
    this.readFov = q(root, '.r-fov');
    this.crumbs = q(root, '.crumbs');
    this.help = q(root, '.help');

    this.buildTicks(q(root, '.meter__ticks'));

    root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const goto = t.closest<HTMLElement>('[data-goto]');
      if (goto) {
        e.preventDefault();
        this.onGoto(goto.dataset.goto ?? 'root');
        return;
      }
      if (t.closest('.help__close') || t.classList.contains('help')) this.toggleHelp(false);
    });
  }

  private buildTicks(host: HTMLElement): void {
    const step = Math.log(ZOOM_STEP);
    let html = '';
    for (let n = 0; n * step <= Z_MAX; n++) {
      const z = n * step;
      const pct = ((z - Z_MIN) / (Z_MAX - Z_MIN)) * 100;
      html += `<span class="tk" style="top:${pct.toFixed(3)}%"><i></i><em>${fmtMag(
        Math.pow(ZOOM_STEP, n),
      )}</em></span>`;
    }
    host.innerHTML = html;
  }

  update(cam: Camera, focus: WorldNode, path: WorldNode[]): void {
    const pct = ((cam.z - Z_MIN) / (Z_MAX - Z_MIN)) * 100;
    this.needle.style.top = `${clamp(pct, 0, 100).toFixed(3)}%`;
    this.stratum.textContent = ROMAN[Math.min(ROMAN.length - 1, focus.depth)] ?? '';

    this.readScale.textContent = `×${fmtMag(cam.scale)}`;
    this.readFov.textContent = `${(cam.viewW / cam.scale).toPrecision(3)} u`;

    const key = path.map((n) => n.id).join('/');
    if (key === this.lastPath) return;
    this.lastPath = key;

    this.crumbs.innerHTML = path
      .slice(1)
      .map((n) => {
        // A stratum that reuses its parent's name adds nothing to the trail -
        // its kind label already says what it is.
        const title = n.spec.title ?? n.id;
        const name = title === n.parent?.spec.title ? '' : `<span>${title}</span>`;
        return `<button type="button" data-goto="${n.id}"><em>${
          n.spec.label ?? KIND_LABEL[n.kind] ?? ''
        }</em>${name}</button>`;
      })
      .join('');
  }

  toggleHelp(force?: boolean): void {
    const show = force ?? this.help.hasAttribute('hidden');
    if (show) this.help.removeAttribute('hidden');
    else this.help.setAttribute('hidden', '');
  }
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function fmtMag(s: number): string {
  if (s >= 1e6) return `${(s / 1e6).toFixed(s < 1e7 ? 1 : 0)}M`;
  if (s >= 1e3) return `${(s / 1e3).toFixed(s < 1e4 ? 1 : 0)}K`;
  if (s >= 10) return String(Math.round(s));
  return s.toFixed(2);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function q(root: HTMLElement, sel: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`hud: missing ${sel}`);
  return el;
}
