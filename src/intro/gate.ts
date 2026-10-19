import { Ask, type AskAnchor } from './ask';
import { Night } from './night';
import sheetUrl from './wanderer.png';
import data from './wanderer.json';

/**
 * The front door: a lantern-bearer on a stone slab floating out on a lake at
 * night, standing in the gate while the site loads. When it is ready he asks
 * the visitor's name in a pixel thought-cloud (ask.ts); given it, he lifts
 * his staff and plants it; the strike flares the lantern, rings the water, and splits the
 * gate down the middle. The halves part, and he and everything with him
 * drifts up and dissolves onto the world behind.
 *
 * The figure is art/wanderer.aseprite, baked by `npm run art:wanderer` into a
 * packed sheet (wanderer.png) and one row of data per frame (wanderer.json).
 * He is blitted 1:1 into a low-resolution canvas whose cells are one sprite
 * pixel, so he stays hard-edged at any size; the night behind him (night.ts)
 * is drawn on the same grid, into the two halves of the gate. The light
 * around him - glow, flash, seam, mist - is smooth, on a full-resolution
 * overlay.
 */

export interface IntroOpts {
  /** Fired once, as the gate opens. Start the camera flight here. */
  onCut: () => void;
  reduced: boolean;
}

const SEEN_KEY = 'zoom:intro-seen';

// Row layout: sheet x, y, w, h, offset x, y, duration ms, staff lift.
const ROWS = data.frames as number[][];
const SPRITE_W: number = data.w;
const SPRITE_H: number = data.h;
const LANTERN = data.lantern as [number, number];
const FOOT = data.foot as [number, number];
const IMPACT: number = data.impact;
const TAGS = data.tags as Record<'idle' | 'raise' | 'hold' | 'strike' | 'settle', [number, number]>;

// ---- idle clock: from the first painted frame ----
/** The water and the gate come up out of black; the lantern catches first. */
const NIGHT_MS = 900;
const LANTERN_FROM = 250;
const FIGURE_FROM = 450;
const FIGURE_MS = 700;
/** He stands at least this long, longer if the site is not ready. */
const GATE_MIN = 1900;
/**
 * Scales the baked raise and hold durations so the staff comes down sooner.
 * Applied here rather than in the sheet so `art:wanderer` can rebake freely;
 * the strike frames themselves keep their timing.
 */
const WINDUP_PACE = 0.8;

// ---- after the strike lands ----
const SEAM_MS = 170;
const OPEN_AT = 140;
const OPEN_MS = 1150;
const RISE_AT = 220;
const RISE_MS = 950;
const END_AT = OPEN_AT + OPEN_MS + 60;

const GLOW: readonly [number, number, number] = [255, 176, 92];
/** Where things sit, as a share of the screen's height. */
const HORIZON = 0.56;
const SLAB = 0.87;

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  delay: number;
  life: number;
  colour: string;
}

export class Intro {
  readonly finished: Promise<void>;

  private root: HTMLElement;
  private halves: HTMLElement[];
  private halfCtx: CanvasRenderingContext2D[];
  /** The moon hangs right, over the lantern side, leaving the left for the question. */
  private nightSet = new Night({ sky: true, moon: [0.8, 0.24] });
  private split = 1;
  /** The slab floats: the figure rides a slow swell, a cell either way. */
  private bob = 0;
  private scene: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private fx: HTMLCanvasElement;
  private fxCtx: CanvasRenderingContext2D;
  private night: HTMLElement;
  private mirror = document.createElement('canvas');
  private mirrorCtx: CanvasRenderingContext2D;

  private img = new Image();
  private loaded = false;
  private failed = false;

  private vw = 1;
  private vh = 1;
  private q = 3;
  private cols = 1;
  private rows = 1;
  private dpr = 1;
  private ax = 0;
  private ay = 0;

  private t0 = 0;
  private isReady = false;
  private ask: Ask;
  /** A click or key before the question: ask now rather than after the minimum stand. */
  private askNow = false;
  /** Clock time the visitor's answer released him; null until then. */
  private goAt: number | null = null;
  /** Where the idle loop was last frame, to catch the moment it wraps. */
  private lastInto = 0;
  /** Motion: null while idling; then the clock time the raise began. */
  private playFrom: number | null = null;
  private impactAt: number | null = null;
  private motes: Mote[] = [];
  private cutFired = false;
  private over = false;
  private raf = 0;
  private resolve!: () => void;
  private onCut: () => void;

  constructor(opts: IntroOpts) {
    this.onCut = opts.onCut;
    this.finished = new Promise<void>((r) => (this.resolve = r));

    this.root = document.createElement('div');
    this.root.id = 'intro';
    this.root.className = 'gate';
    // Everything here is decoration except the question, which must be reachable.
    this.root.innerHTML = `
      <div class="gate__half gate__half--l" aria-hidden="true"><canvas></canvas></div>
      <div class="gate__half gate__half--r" aria-hidden="true"><canvas></canvas></div>
      <canvas class="gate__scene" aria-hidden="true"></canvas>
      <canvas class="gate__fx" aria-hidden="true"></canvas>
      <div class="gate__night" aria-hidden="true"></div>`;
    this.ask = new Ask({
      onGone: () => (this.goAt = performance.now() - this.t0),
    });
    this.root.appendChild(this.ask.el);
    document.body.appendChild(this.root);

    this.halves = [...this.root.querySelectorAll<HTMLElement>('.gate__half')];
    this.halfCtx = this.halves.map((h) => {
      const c = h.querySelector('canvas')!.getContext('2d');
      if (!c) throw new Error('intro: no 2d context');
      return c;
    });
    this.scene = this.root.querySelector('.gate__scene')!;
    this.fx = this.root.querySelector('.gate__fx')!;
    this.night = this.root.querySelector('.gate__night')!;
    const sceneCtx = this.scene.getContext('2d');
    const fxCtx = this.fx.getContext('2d');
    const mirrorCtx = this.mirror.getContext('2d');
    if (!sceneCtx || !fxCtx || !mirrorCtx) throw new Error('intro: no 2d context');
    this.sceneCtx = sceneCtx;
    this.fxCtx = fxCtx;
    this.mirrorCtx = mirrorCtx;

    // A visitor who has already seen it gets the world, not the ceremony.
    if (opts.reduced || read(SEEN_KEY)) {
      this.shortCircuit();
      return;
    }
    write(SEEN_KEY, '1');

    this.img.onload = () => (this.loaded = true);
    this.img.onerror = () => (this.failed = true);
    this.img.src = sheetUrl;
    this.mirror.width = SPRITE_W;
    this.mirror.height = SPRITE_H;

    this.layout();
    window.addEventListener('resize', this.onResize);
    this.root.addEventListener('pointerdown', this.skip);
    window.addEventListener('keydown', this.skip);
    this.raf = requestAnimationFrame(this.frame);
  }

  ready(): void {
    this.isReady = true;
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  private layout(): void {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    // Integer cells only, so every sprite pixel is the same size.
    const byH = Math.round((this.vh * 0.58) / SPRITE_H);
    const byW = Math.floor(this.vw / (SPRITE_W * 1.15));
    const q = Math.max(2, Math.min(byH, byW, 7));
    this.q = q;
    this.cols = Math.ceil(this.vw / q);
    this.rows = Math.ceil(this.vh / q);
    // Centred on the figure, the slab low in the foreground of the lake.
    this.ax = Math.round(this.cols / 2 - SPRITE_W / 2);
    this.ay = Math.round(this.rows * SLAB - SPRITE_H);

    // The halves split the grid on a whole cell, so the night meets itself exactly.
    this.split = Math.floor(this.cols / 2);
    this.halves.forEach((h, i) => {
      const w = i ? this.cols - this.split : this.split;
      const c = h.querySelector('canvas')!;
      c.width = w;
      c.height = this.rows;
      c.style.width = `${w * q}px`;
      c.style.height = `${this.rows * q}px`;
      h.style.width = `${w * q}px`;
      h.style.left = `${i ? this.split * q : 0}px`;
    });
    this.nightSet.layout(this.cols, this.rows, Math.round(this.rows * HORIZON));

    this.scene.width = this.cols;
    this.scene.height = this.rows;
    this.scene.style.width = `${this.cols * q}px`;
    this.scene.style.height = `${this.rows * q}px`;
    this.sceneCtx.imageSmoothingEnabled = false;

    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.fx.width = Math.round(this.vw * this.dpr);
    this.fx.height = Math.round(this.vh * this.dpr);
    if (this.ask.isShown) this.ask.place(this.anchor());
  }

  /** The head, in cells, for the thought-cloud to point at. */
  private anchor(): AskAnchor {
    return { q: this.q, cols: this.cols, rows: this.rows, hx: this.ax + 66, hy: this.ay + 40 };
  }

  /** Resizing is honoured until the strike; after that the geometry is committed. */
  private onResize = (): void => {
    if (this.impactAt === null) this.layout();
  };

  // -------------------------------------------------------------------------
  // The loop
  // -------------------------------------------------------------------------

  private frame = (now: number): void => {
    if (this.over) return;
    if (!this.t0) this.t0 = now;
    const t = now - this.t0;

    // Without the sheet there is no figure; the world is not held hostage to it.
    if (this.failed && this.playFrom === null) {
      this.shortCircuit();
      return;
    }

    // Once the site is ready and he has stood a moment, he asks.
    if (!this.ask.isShown && this.loaded && this.isReady && (t >= GATE_MIN || this.askNow)) this.ask.show(this.anchor());

    const f = this.currentFrame(t);
    // Reached or passed: a slow frame can step right over the impact frame.
    if (f >= IMPACT && this.impactAt === null) this.strike(t);
    const k = this.impactAt === null ? -1 : t - this.impactAt;

    this.bob = Math.round(Math.sin(t * 0.0017) * 1.2);
    if (k < OPEN_AT + OPEN_MS) this.nightSet.paint(t, this.halfCtx[0]!, this.halfCtx[1]!, this.split);
    this.paintScene(t, f, k);
    this.paintFx(t, f, k);

    if (k >= END_AT) {
      this.teardown();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /**
   * Idle loops until the visitor has answered; the raise then starts at the
   * top of the next loop, so the cape never jumps.
   */
  private currentFrame(t: number): number {
    const [i0, i1] = TAGS.idle;
    if (this.playFrom === null) {
      const loop = sum(i0, i1);
      const into = t % loop;
      // Start on the wrap, whatever the frame rate; a slow frame can never skip it.
      const wrapped = into < this.lastInto;
      this.lastInto = into;
      if (this.goAt !== null && t >= this.goAt && (wrapped || t - this.goAt > loop)) this.playFrom = t - into;
      else return this.loaded ? frameIn(i0, i1, into) : i0;
    }
    let e = t - this.playFrom;
    for (let f = TAGS.raise[0]; f < ROWS.length; f++) {
      e -= ROWS[f]![6]! * (f <= TAGS.hold[1] ? WINDUP_PACE : 1);
      if (e < 0) return f;
    }
    return ROWS.length - 1;
  }

  /**
   * Before the question, any key or click brings it on at once. From then on
   * the question has the keyboard: only the answer moves him.
   */
  private skip = (e: Event): void => {
    if (this.over || this.ask.isShown) return;
    if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey)) return;
    this.isReady = true;
    this.askNow = true;
  };

  // -------------------------------------------------------------------------
  // The figure and his reflection
  // -------------------------------------------------------------------------

  private paintScene(t: number, f: number, k: number): void {
    const ctx = this.sceneCtx;
    ctx.clearRect(0, 0, this.cols, this.rows);
    if (!this.loaded) return;

    const appear = smooth((t - FIGURE_FROM) / FIGURE_MS);
    if (appear <= 0) return;

    const ay = this.ay + this.bob;

    // The reflection: the same frame upside down below the slab, rows nudged
    // by a slow swell, sunk into the dark water and fading with depth.
    const m = this.mirrorCtx;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, SPRITE_W, SPRITE_H);
    this.drawFrame(m, f, 0, 0);
    m.globalCompositeOperation = 'source-atop';
    m.fillStyle = 'rgba(4, 8, 16, 0.6)';
    m.fillRect(0, 0, SPRITE_W, SPRITE_H);
    const top = ay + SPRITE_H;
    const depth = Math.min(SPRITE_H, this.rows - top);
    for (let r = 0; r < depth; r++) {
      const fade = 1 - r / depth;
      const swell = Math.round(Math.sin(t * 0.0021 + r * 0.31) * (0.4 + r * 0.025));
      ctx.globalAlpha = appear * 0.42 * fade * fade;
      ctx.drawImage(this.mirror, 0, SPRITE_H - 1 - r, SPRITE_W, 1, this.ax + swell, top + r, SPRITE_W, 1);
    }

    ctx.globalAlpha = appear;
    this.drawFrame(ctx, f, this.ax, ay);
    ctx.globalAlpha = 1;
    // Night: a cold wash over him, so the lantern is the only warm thing here.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(8, 14, 34, 0.36)';
    ctx.fillRect(0, 0, this.cols, this.rows);
    ctx.globalCompositeOperation = 'source-over';

    this.paintRipples(t, ay, appear);
    this.paintFireflies(t, ay, appear * (k < 0 ? 1 : 1 - smooth(k / 500)));

    // As the gate opens, everything rises and thins away.
    const rise = k < RISE_AT ? 0 : smooth((k - RISE_AT) / RISE_MS);
    if (rise > 0) {
      this.scene.style.transform = `translate3d(0, ${(-rise * this.vh * 0.09).toFixed(1)}px, 0)`;
      this.scene.style.opacity = `${(1 - rise) * (1 - rise)}`;
    }
  }

  /** Rings drifting out from the slab as it rides the water. */
  private paintRipples(t: number, ay: number, a: number): void {
    const ctx = this.sceneCtx;
    const cx = this.ax + SPRITE_W / 2;
    const cy = ay + SPRITE_H - 1;
    for (let i = 0; i < 3; i++) {
      const u = ((t + i * 900) % 2700) / 2700;
      const rx = SPRITE_W * (0.5 + u * 0.32);
      const ry = 2 + u * 5;
      ctx.fillStyle = `rgba(140, 165, 200, ${0.3 * a * (1 - u) * Math.min(1, u * 6)})`;
      // The near half of the ellipse only: the slab hides the far one.
      for (let s = 0; s <= 64; s++) {
        const ang = (s / 64) * Math.PI;
        const x = Math.round(cx + Math.cos(ang) * rx);
        const y = Math.round(cy + Math.sin(ang) * ry);
        if ((s + i) % 3 === 0) continue;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  /** A few warm motes wandering around him, blinking slowly. */
  private paintFireflies(t: number, ay: number, a: number): void {
    if (a <= 0.01) return;
    const ctx = this.sceneCtx;
    for (let i = 0; i < 8; i++) {
      const bx = this.ax + SPRITE_W * (0.05 + ((i * 0.37) % 1) * 0.95);
      const by = ay + SPRITE_H * (0.35 + ((i * 0.61) % 1) * 0.55);
      const x = Math.round(bx + Math.sin(t * 0.0007 * (1 + i * 0.13) + i * 2.1) * 9);
      const y = Math.round(by + Math.sin(t * 0.0011 * (1 + i * 0.07) + i) * 6);
      const blink = Math.max(0, Math.sin(t * 0.0023 + i * 1.7));
      if (blink < 0.1) continue;
      ctx.fillStyle = `rgba(255, 207, 138, ${a * blink})`;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = `rgba(255, 176, 92, ${a * blink * 0.35})`;
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
    }
  }

  private drawFrame(ctx: CanvasRenderingContext2D, f: number, x: number, y: number): void {
    const r = ROWS[f];
    if (!r) return;
    ctx.drawImage(this.img, r[0]!, r[1]!, r[2]!, r[3]!, x + r[4]!, y + r[5]!, r[2]!, r[3]!);
  }

  // -------------------------------------------------------------------------
  // Light
  // -------------------------------------------------------------------------

  private paintFx(t: number, f: number, k: number): void {
    const ctx = this.fxCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.globalCompositeOperation = 'lighter';
    const q = this.q;
    const lift = ROWS[f]?.[7] ?? 0;

    // Mist lying on the lake, drifting: along the far shore and round the slab.
    const ay = this.ay + this.bob;
    const waterY = (ay + SPRITE_H - 4) * q;
    const shoreY = (this.nightSet.horizonY + 2) * q;
    const mist = smooth(t / NIGHT_MS) * (k < 0 ? 1 : 1 - smooth(k / RISE_MS));
    for (let i = 0; i < 5; i++) {
      const my = i < 3 ? waterY + i * 8 : shoreY + (i - 3) * 10;
      const x = ((t * (0.012 + i * 0.006) + i * 380) % (this.vw + 600)) - 300;
      const g = ctx.createRadialGradient(x, my, 0, x, my, 260 + i * 60);
      g.addColorStop(0, `rgba(90, 115, 160, ${0.05 * mist})`);
      g.addColorStop(1, 'rgba(90, 115, 160, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 340, waterY - 340, 680, 680);
    }

    // The lantern: a warm, unsteady light that rides the staff.
    const lit = smooth((t - LANTERN_FROM) / 500);
    const flicker = 0.86 + 0.08 * Math.sin(t * 0.017) + 0.06 * Math.sin(t * 0.041 + 1.3);
    const flare = k < 0 ? 0 : Math.max(0, 1 - k / 520);
    const fade = k < RISE_AT ? 1 : 1 - smooth((k - RISE_AT) / RISE_MS);
    const lx = (this.ax + LANTERN[0] + 0.5) * q;
    const ly = (ay + LANTERN[1] - lift + 0.5) * q;
    const glow = lit * fade * (flicker + flare * 1.4);
    if (glow > 0.01) {
      const R = q * (34 + flare * 60);
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
      g.addColorStop(0, `rgba(${GLOW[0]}, ${GLOW[1]}, ${GLOW[2]}, ${0.42 * glow})`);
      g.addColorStop(0.25, `rgba(${GLOW[0]}, ${GLOW[1] - 40}, ${GLOW[2] - 40}, ${0.16 * glow})`);
      g.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
      // Its light on the water, a long soft streak below the slab.
      const sy = waterY + q * 14;
      const s = ctx.createRadialGradient(lx, sy, 0, lx, sy, q * 30);
      s.addColorStop(0, `rgba(${GLOW[0]}, ${GLOW[1]}, ${GLOW[2]}, ${0.12 * glow})`);
      s.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.save();
      ctx.translate(lx, sy);
      ctx.scale(0.35, 1);
      ctx.translate(-lx, -sy);
      ctx.fillStyle = s;
      ctx.fillRect(lx - q * 30, sy - q * 30, q * 60, q * 60);
      ctx.restore();
    }

    if (k >= 0) this.paintStrike(ctx, k);
    if (this.motes.length) this.paintMotes(ctx, k);

    ctx.globalCompositeOperation = 'source-over';
    this.night.style.opacity = `${1 - smooth(t / NIGHT_MS)}`;
  }

  /** The flash at the staff's foot, rings across the water, and the seam the gate opens along. */
  private paintStrike(ctx: CanvasRenderingContext2D, k: number): void {
    const q = this.q;
    const fx = (this.ax + FOOT[0] + 0.5) * q;
    const fy = (this.ay + this.bob + FOOT[1] + 0.5) * q;

    const flash = Math.max(0, 1 - k / 260);
    if (flash > 0) {
      const R = q * 40;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, R);
      g.addColorStop(0, `rgba(255, 244, 220, ${0.9 * flash})`);
      g.addColorStop(0.3, `rgba(255, 176, 92, ${0.35 * flash})`);
      g.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx - R, fy - R, R * 2, R * 2);
    }

    for (let i = 0; i < 3; i++) {
      const rk = (k - i * 110) / 900;
      if (rk <= 0 || rk >= 1) continue;
      const r = q * (6 + 110 * (1 - Math.pow(1 - rk, 2.2)));
      ctx.beginPath();
      ctx.ellipse(fx, fy + q * 3, r, r * 0.16, 0, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, q * 0.7 * (1 - rk));
      ctx.strokeStyle = `rgba(210, 240, 230, ${0.55 * Math.pow(1 - rk, 1.5)})`;
      ctx.stroke();
    }

    // The seam: a line of light down the middle of the screen, growing out
    // from the strike's height. Once the halves move, their own lit edges
    // (gate.css) carry it.
    const cx = this.vw / 2;
    const grow = smooth(k / SEAM_MS);
    const a = grow * (1 - smooth((k - OPEN_AT) / 260));
    if (a > 0.01) {
      const y0 = fy - grow * fy;
      const y1 = fy + grow * (this.vh - fy);
      const w = 2;
      const g = ctx.createLinearGradient(cx - w * 3, 0, cx + w * 3, 0);
      g.addColorStop(0, 'rgba(255, 200, 140, 0)');
      g.addColorStop(0.5, `rgba(255, 236, 200, ${0.95 * a})`);
      g.addColorStop(1, 'rgba(255, 200, 140, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - w * 3, y0, w * 6, y1 - y0);
    }
  }

  private paintMotes(ctx: CanvasRenderingContext2D, k: number): void {
    const q = this.q;
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.motes) {
      const age = k - RISE_AT - p.delay;
      if (age < 0 || age > p.life) continue;
      const s = age / 1000;
      const u = age / p.life;
      ctx.globalAlpha = (1 - u) * (u < 0.1 ? u * 10 : 1);
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x + p.vx * s, p.y + p.vy * s - 40 * s * s, q, q);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
  }

  // -------------------------------------------------------------------------
  // The strike, and the gate
  // -------------------------------------------------------------------------

  private strike(t: number): void {
    this.impactAt = t;
    this.motes = this.sampleMotes();
    window.setTimeout(() => this.root.classList.add('is-open'), OPEN_AT);
    const ease = 'cubic-bezier(.72, 0, .18, 1)';
    this.halves.forEach((el, i) => {
      el.animate([{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${i ? '' : '-'}102%, 0, 0)` }], {
        duration: OPEN_MS,
        delay: OPEN_AT,
        easing: ease,
        fill: 'forwards',
      });
    });
    window.setTimeout(() => this.fireCut(), OPEN_AT);
  }

  /** Pixels lifted off the figure as it dissolves: they rise in its own colours. */
  private sampleMotes(): Mote[] {
    const out: Mote[] = [];
    let data: Uint8ClampedArray;
    try {
      data = this.sceneCtx.getImageData(this.ax, this.ay + this.bob, SPRITE_W, SPRITE_H).data;
    } catch {
      return out;
    }
    seed = 0x6d2b79f5;
    const q = this.q;
    const want = this.vw < 760 ? 120 : 220;
    for (let tries = 0; out.length < want && tries < want * 40; tries++) {
      const x = Math.floor(rnd() * SPRITE_W);
      const y = Math.floor(rnd() * SPRITE_H);
      const o = (y * SPRITE_W + x) * 4;
      if (data[o + 3]! < 200) continue;
      out.push({
        x: (this.ax + x) * q,
        y: (this.ay + this.bob + y) * q,
        vx: (rnd() - 0.5) * 40,
        vy: -(50 + rnd() * 120),
        delay: (1 - y / SPRITE_H) * 120 + rnd() * 380,
        life: 600 + rnd() * 700,
        colour: `rgb(${data[o]}, ${data[o + 1]}, ${data[o + 2]})`,
      });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Exits
  // -------------------------------------------------------------------------

  private fireCut(): void {
    if (this.cutFired) return;
    this.cutFired = true;
    this.onCut();
  }

  private shortCircuit(): void {
    this.fireCut();
    this.root.classList.add('is-leaving');
    window.setTimeout(() => this.teardown(), 280);
  }

  private teardown(): void {
    if (!this.root.isConnected) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.skip);
    this.ask.dispose();
    this.root.remove();
    this.fireCut();
    this.resolve();
  }
}

/** Total duration of frames a..b inclusive. */
function sum(a: number, b: number): number {
  let ms = 0;
  for (let f = a; f <= b; f++) ms += ROWS[f]![6]!;
  return ms;
}

/** The frame `ms` into the run a..b. */
function frameIn(a: number, b: number, ms: number): number {
  for (let f = a; f <= b; f++) {
    ms -= ROWS[f]![6]!;
    if (ms < 0) return f;
  }
  return b;
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Deterministic, so the dissolve is the same every time. */
let seed = 0x6d2b79f5;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
}

function read(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}

function write(k: string, v: string): void {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* private mode: the ceremony simply plays again */
  }
}
