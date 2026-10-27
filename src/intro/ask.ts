/**
 * The lantern-bearer's question: a pixel thought-cloud that puffs up beside
 * his head and asks the visitor's name before he opens the gate.
 *
 * The cloud is pixel art drawn on the intro's cell grid - one canvas cell per
 * art pixel, scaled up nearest-neighbour - with a scalloped edge, a dark
 * outline, a shaded underside and a trail of shrinking puffs down to him. The
 * words and the field are real DOM laid over it, so typing, autofill, screen
 * readers and on-screen keyboards all work as they would anywhere else.
 */

import { saveVisitor, storedVisitor, UNNAMED } from './visitor';
import type { Experience } from '../experience';

export interface AskOpts {
  /** After the name, also ask which experience to open onto. */
  choose: boolean;
  /** The visitor picked an experience; called before the greeting. */
  onPick: (e: Experience) => void;
  /** Called when the cloud has fully gone after the greeting. */
  onGone: () => void;
}

/** Where the cloud sits: the intro's cell size and the point its puffs lead to. */
export interface AskAnchor {
  q: number;
  cols: number;
  rows: number;
  /** The head, in cells: the trail of puffs ends just off it. */
  hx: number;
  hy: number;
}

const OUTLINE = '#0a0f1c';
const FILL = '#d8dfe8';
const SHADE = '#9fb0c4';
const LIGHT = '#f4f8fb';

/** Cell codes for the cloud raster. */
const O = 1;
const F = 2;
const S = 3;
const L = 4;

/** Margin of scallops round the text, in cells. */
const PAD = 7;
const GREET_MS = 1250;
/** The cloud deflates to its puffs and refills around the next question. */
const REFILL_MS = 260;

interface Puff {
  x: number;
  y: number;
  r: number;
}

export class Ask {
  readonly el: HTMLElement;
  private cloud: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private body: HTMLFormElement;
  private input: HTMLInputElement;
  private line1: HTMLElement;
  private line2: HTMLElement;
  private picks: HTMLButtonElement[];
  private opts: AskOpts;

  private anchor: AskAnchor | null = null;
  /** Cloud body rect in cells, and the canvas origin, both in grid cells. */
  private rect = { x: 0, y: 0, w: 1, h: 1 };
  private origin = { x: 0, y: 0, w: 1, h: 1 };
  private puffs: Puff[] = [];
  /** How much is drawn: 0 nothing, 1-3 puffs, 4 the cloud. */
  private stage = 0;
  private timers: number[] = [];
  private answered = false;
  private shown = false;
  private picked = false;
  private name = UNNAMED;
  /** The name was remembered from an earlier visit, so it is not asked for. */
  private returning = false;

  constructor(opts: AskOpts) {
    this.opts = opts;
    this.el = document.createElement('div');
    this.el.className = 'ask';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-labelledby', 'ask-q');
    this.el.hidden = true;
    this.el.innerHTML = `
      <canvas class="ask__cloud" aria-hidden="true"></canvas>
      <form class="ask__body" autocomplete="off" novalidate>
        <p class="ask__q" id="ask-q"><span class="ask__l1">Who goes there?</span><span class="ask__l2">Tell me your name to go in.</span></p>
        <label class="ask__field">
          <span class="ask__sr">Your name</span>
          <input class="ask__input" name="visitor" type="text" maxlength="24" spellcheck="false" autocapitalize="words" enterkeyhint="go" />
        </label>
        <p class="ask__hint" aria-hidden="true">press enter</p>
        <div class="ask__pick" role="group" aria-labelledby="ask-q">
          <button type="button" class="ask__opt" data-exp="design"><b>Design</b><span>Explore the zoomable world</span></button>
          <button type="button" class="ask__opt" data-exp="content"><b>Content</b><span>Read it as one page</span></button>
        </div>
      </form>`;
    this.cloud = this.el.querySelector('.ask__cloud')!;
    const ctx = this.cloud.getContext('2d');
    if (!ctx) throw new Error('ask: no 2d context');
    this.ctx = ctx;
    this.body = this.el.querySelector('.ask__body')!;
    this.input = this.el.querySelector('.ask__input')!;
    this.line1 = this.el.querySelector('.ask__l1')!;
    this.line2 = this.el.querySelector('.ask__l2')!;
    this.picks = [...this.el.querySelectorAll<HTMLButtonElement>('.ask__opt')];
    this.picks.forEach((b, i) => {
      b.addEventListener('click', () => this.pick(b.dataset.exp as Experience));
      b.addEventListener('keydown', (e) => {
        // The surface's own key handler sits on window and claims Enter, so
        // these keys are answered here and kept from reaching it.
        e.stopPropagation();
        // Two doors: any arrow moves to the other one, and 1 or 2 picks directly.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          b.click();
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          this.picks[1 - i]!.focus();
        } else if (e.key === '1' || e.key === '2') {
          e.preventDefault();
          this.picks[Number(e.key) - 1]!.click();
        }
      });
    });

    this.body.addEventListener('submit', (e) => {
      e.preventDefault();
      this.answer(this.input.value);
    });
    this.input.addEventListener('keydown', (e) => {
      // Enter answers without leaning on implicit form submission; Escape goes in unnamed.
      if (e.key === 'Enter') {
        e.preventDefault();
        this.answer(this.input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.answer('');
      }
    });
  }

  get isShown(): boolean {
    return this.shown;
  }

  /** Puffs up beside the head: the smallest puff first, then the cloud. */
  show(anchor: AskAnchor): void {
    if (this.shown) return;
    this.shown = true;
    this.el.hidden = false;

    // A visitor who gave their name before is not asked it again: the cloud
    // opens straight onto the choice, or, if that is made too, the greeting.
    const known = storedVisitor();
    if (known) {
      this.answered = true;
      this.returning = true;
      this.name = known;
      if (this.opts.choose) this.setChoosing();
    }

    this.place(anchor);
    this.el.classList.remove('is-open');
    this.stage = 0;
    [0, 110, 220, 340].forEach((ms, i) => this.later(ms, () => this.drawStage(i + 1)));
    if (known && !this.opts.choose) {
      this.later(400, () => {
        this.el.classList.add('is-open');
        this.greet();
      });
    } else {
      this.later(400, () => {
        this.el.classList.add('is-open');
        (known ? this.picks[0]! : this.input).focus({ preventScroll: true });
      });
    }
    // The pixel face may land after the first measure; refit the cloud when it does.
    void document.fonts?.ready.then(() => {
      if (this.shown && this.anchor) this.place(this.anchor);
    });
  }

  /** Lays the cloud out for the current grid. Safe to call again on resize. */
  place(anchor: AskAnchor): void {
    this.anchor = anchor;
    const { q } = anchor;
    this.el.style.setProperty('--q', `${q}px`);
    this.el.classList.toggle('is-small', q < 3);

    // Measure the words at their real size, then fit the cloud round them.
    this.body.style.width = '';
    const bw = Math.ceil(this.body.offsetWidth / q);
    const bh = Math.ceil(this.body.offsetHeight / q);
    const w = bw + PAD * 2;
    const h = bh + PAD * 2;

    // Beside his head, up and to the left, if there is room; otherwise above him.
    const tip = { x: anchor.hx - 10, y: anchor.hy - 12 };
    let x = tip.x - 4 - w;
    let y = tip.y - 8 - h;
    if (x < 3) {
      x = Math.round(anchor.hx - w / 2);
      y = anchor.hy - 26 - h;
    }
    x = Math.max(3, Math.min(anchor.cols - w - 3, x));
    y = Math.max(3, y);
    this.rect = { x, y, w, h };

    // Puffs from the cloud's lower edge, shrinking toward the head.
    const from = { x: Math.min(x + w - 8, Math.max(x + 8, tip.x - 6)), y: y + h - 3 };
    this.puffs = [
      { t: 0.38, r: 3.2 },
      { t: 0.7, r: 2.2 },
      { t: 1, r: 1.5 },
    ].map(({ t, r }) => ({ x: from.x + (tip.x - from.x) * t, y: from.y + (tip.y - from.y) * t + 2, r }));

    let x0 = x;
    let y0 = y;
    let x1 = x + w;
    let y1 = y + h;
    for (const p of this.puffs) {
      x0 = Math.min(x0, Math.floor(p.x - p.r - 1));
      y0 = Math.min(y0, Math.floor(p.y - p.r - 1));
      x1 = Math.max(x1, Math.ceil(p.x + p.r + 2));
      y1 = Math.max(y1, Math.ceil(p.y + p.r + 2));
    }
    this.origin = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    this.cloud.width = this.origin.w;
    this.cloud.height = this.origin.h;
    Object.assign(this.cloud.style, {
      left: `${x0 * q}px`,
      top: `${y0 * q}px`,
      width: `${this.origin.w * q}px`,
      height: `${this.origin.h * q}px`,
    });
    Object.assign(this.body.style, {
      left: `${(x + PAD) * q}px`,
      top: `${(y + PAD) * q}px`,
      width: `${bw * q}px`,
    });
    if (this.stage) this.drawStage(this.stage);
  }

  /** Takes the cloud down, tidily, without an answer: used when the intro is torn down. */
  dispose(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.el.remove();
  }

  private answer(raw: string): void {
    if (this.answered) return;
    this.answered = true;
    const given = raw.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (given) saveVisitor(given);
    this.name = given || UNNAMED;
    this.input.blur();
    if (this.opts.choose) this.askChoice();
    else this.greet();
  }

  /** The second question: the cloud sinks to its puffs, then refills round the two doors. */
  private askChoice(): void {
    this.el.classList.remove('is-open');
    [0, 70, 140].forEach((ms, i) => this.later(ms, () => this.drawStage(3 - i)));
    this.later(REFILL_MS, () => {
      this.setChoosing();
      if (this.anchor) this.place(this.anchor);
      this.drawStage(4);
      this.el.classList.add('is-open');
      this.picks[0]!.focus({ preventScroll: true });
    });
  }

  private setChoosing(): void {
    this.el.classList.add('is-choosing');
    this.line1.textContent = this.welcome();
    this.line2.textContent = 'How would you like to see it?';
  }

  private welcome(): string {
    return `Welcome${this.returning ? ' back' : ''}, ${this.name}.`;
  }

  private pick(e: Experience): void {
    if (this.picked) return;
    this.picked = true;
    this.opts.onPick(e);
    this.picks.forEach((b) => b.classList.toggle('is-picked', b.dataset.exp === e));
    (document.activeElement as HTMLElement | null)?.blur();
    this.later(220, () => this.greet());
  }

  private greet(): void {
    this.el.classList.remove('is-choosing');
    this.el.classList.add('is-greeting');
    this.line1.textContent = this.welcome();
    this.line2.textContent = 'The gate will open for you.';
    if (this.anchor) this.place(this.anchor);
    this.later(GREET_MS, () => {
      this.el.classList.remove('is-open');
      [150, 220, 290, 360].forEach((ms, i) => this.later(ms, () => this.drawStage(3 - i)));
      this.later(420, () => {
        this.el.hidden = true;
        this.opts.onGone();
      });
    });
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private drawStage(n: number): void {
    this.stage = n;
    const { ctx, origin } = this;
    ctx.clearRect(0, 0, origin.w, origin.h);
    if (n <= 0) return;
    const grid = new Uint8Array(origin.w * origin.h);
    // Puffs appear from the head outward: the last puff is the one nearest him.
    const puffs = this.puffs.slice(Math.max(0, 3 - n));
    for (const p of puffs) this.blob(grid, (x, y) => (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r);
    if (n >= 4) this.blob(grid, (x, y) => this.inCloud(x, y));
    this.paint(grid);
  }

  /** A scalloped cloud: a rounded body with bumps standing proud of every edge. */
  private inCloud(x: number, y: number): boolean {
    const { x: rx, y: ry, w, h } = this.rect;
    const b = 4;
    const ix0 = rx + b;
    const iy0 = ry + b;
    const ix1 = rx + w - b;
    const iy1 = ry + h - b;
    const r = 4;
    const cx = Math.max(ix0 + r, Math.min(ix1 - r, x));
    const cy = Math.max(iy0 + r, Math.min(iy1 - r, y));
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
    const rb = 5;
    const step = 9;
    for (let bx = ix0 + 3; bx <= ix1 - 3; bx += step) {
      // A seeded jitter so the bumps are not a picket fence.
      const j = ((bx * 37) % 5) - 2;
      if ((x - bx) ** 2 + (y - (iy0 + 1 + j * 0.3)) ** 2 <= (rb + (j & 1)) ** 2) return true;
      if ((x - bx - 4) ** 2 + (y - (iy1 - 1)) ** 2 <= (rb - 1) ** 2) return true;
    }
    for (let by = iy0 + 4; by <= iy1 - 4; by += 7) {
      if ((x - ix0) ** 2 + (y - by) ** 2 <= (rb - 1) ** 2) return true;
      if ((x - ix1) ** 2 + (y - by) ** 2 <= (rb - 1) ** 2) return true;
    }
    return false;
  }

  /** Marks the cells (in grid space) inside `test` as filled. */
  private blob(grid: Uint8Array, test: (x: number, y: number) => boolean): void {
    const { origin } = this;
    for (let y = 0; y < origin.h; y++) {
      for (let x = 0; x < origin.w; x++) {
        if (test(origin.x + x + 0.5, origin.y + y + 0.5)) grid[y * origin.w + x] = F;
      }
    }
  }

  /** Outline, shaded underside and a highlight along the top, then pixels. */
  private paint(grid: Uint8Array): void {
    const { w, h } = this.origin;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : grid[y * w + x]!);
    const out = grid.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!at(x, y)) continue;
        const i = y * w + x;
        if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) out[i] = O;
        else if (!at(x, y + 2) || !at(x, y + 3)) out[i] = S;
        else if (!at(x, y - 2) && x % 2 === 0) out[i] = L;
      }
    }
    const colours = ['', OUTLINE, FILL, SHADE, LIGHT];
    for (let c = 1; c <= 4; c++) {
      this.ctx.fillStyle = colours[c]!;
      for (let i = 0; i < out.length; i++) if (out[i] === c) this.ctx.fillRect(i % w, Math.floor(i / w), 1, 1);
    }
  }
}
