import { FIGURE, FRAME_MS, SPRITE_H, bladeAt, dashAt, frameAt, loadAtlas, type Atlas, type Lit } from './sprite';

/**
 * The front door: stillness, then an iai dash - he draws as he launches and
 * cuts on the way past, rising left to right across the top of the screen -
 * a turn into a kesa cut falling right to left across the bottom, the blade
 * flicked clean and sheathed, and on the click of the sheath the screen falls
 * apart along the two cuts onto the world behind.
 *
 * Two things use the pixel grid. The sprite is blitted 1:1 into a low-
 * resolution canvas whose cells are exactly one sprite pixel, and the falling
 * fragments are carved from that same grid - so the character and the debris
 * share one pixel scale. The cuts themselves are drawn on a full-resolution
 * overlay with anti-aliased strokes: the blade is pixel art, the light off it
 * is not.
 *
 * The cuts are x-monotonic curves, which means every cell is unambiguously
 * above or below each one. Two non-crossing curves therefore divide the screen
 * into three regions with no polygon clipping at all, and a cell's distance
 * from the nearest cut decides the lit edge of its fragment.
 */

export interface IntroOpts {
  /** Fired once, as the screen breaks. Start the camera flight here. */
  onCut: () => void;
  reduced: boolean;
}

const SEEN_KEY = 'zoom:intro-seen';

type RGB = readonly [number, number, number];
const HOT: RGB = [255, 255, 255];
const RED: RGB = [229, 9, 36];
const DEEP: RGB = [90, 7, 18];

// ---- idle clock: from the moment the overlay exists ----
/** The summoning wind builds, bursts, then the figure materialises in it. */
const WIND_FROM = 140;
const WIND_FULL = 620;
const SUMMON_AT = 650;
const WIND_END = 1400;
const REVEAL_FROM = 680;
const REVEAL_TO = 1080;
/** After the summon he stands at least this long; longer if the site is not ready. */
const GATE_MIN = 1460;

// ---- motion clock: from the moment he moves. Matches the keys in tools/samurai/rig.ts. ----
const GLOW_FROM = 290;
const GLOW_FULL = 420;
interface SlashDef {
  start: number;
  dur: number;
  /** Which way the head travels: +1 left to right, -1 right to left. */
  dir: 1 | -1;
}
const SLASHES: readonly SlashDef[] = [
  { start: 470, dur: 130, dir: 1 },
  { start: 850, dur: 130, dir: -1 },
];
const FLASH_MS = 60;
/** The tsuba meets the scabbard mouth. */
const SEPARATE_AT = 1430;
const FALL_AT = 1710;
const ACTOR_FADE_AT = 1860;
const ACTOR_FADE_MS = 420;

/** The space the figure is fitted into, in sprite pixels. */
const VIEW_W = 130;
const VIEW_H = 148;
/** Afterimages trail the dash at these frame lags, oldest first. */
const GHOSTS: readonly [number, number][] = [
  [6, 0.14],
  [4, 0.26],
  [2, 0.42],
];

/** Live trail length, as a share of the viewport width. */
const TRAIL = 0.3;
/** Live trail half-width at its head, in cells. */
const WMAX = 2.5;
/** Sparks only. px/s². */
const GRAVITY = 1100;

interface Curve {
  /** Cut height at each column centre, px. */
  ys: Float32Array;
  slope: Float32Array;
  /** sqrt(1 + slope²): turns a vertical offset into a perpendicular one. */
  sec: Float32Array;
  /** Dense polyline, for the smooth stroke pass. */
  px: Float32Array;
  py: Float32Array;
}

interface Spark {
  t0: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  hot: boolean;
}

interface Stat {
  minC: number;
  minR: number;
  maxC: number;
  maxR: number;
  sumC: number;
  sumR: number;
  n: number;
}

export class Intro {
  readonly finished: Promise<void>;

  private root: HTMLElement;
  private ground: HTMLElement;
  private frags: HTMLElement;
  private fx: HTMLCanvasElement;
  private fxCtx: CanvasRenderingContext2D;
  private air: HTMLCanvasElement;
  private airCtx: CanvasRenderingContext2D;
  private actor: HTMLCanvasElement;
  private actorCtx: CanvasRenderingContext2D;
  private atlas!: Atlas;
  private reveal: Lit[] = [];

  private vw = 1;
  private vh = 1;
  private q = 4;
  private cols = 1;
  private rows = 1;
  private dpr = 1;
  /** Where his cell sits at the start of the dash, and how far the dash carries him, in cells. */
  private ax = 0;
  private ay = 0;
  private dash = 0;

  private curves: Curve[] = [];
  private region = new Uint8Array(0);
  private cross = { x: 0, y: 0 };
  private buf: ImageData | null = null;
  private sparks: Spark[] = [];

  private t0 = 0;
  private gateAt: number | null = null;
  private isReady = false;
  private separated = false;
  private actorFading = false;
  private fxDirty = false;
  private endAt = Infinity;
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
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <div class="intro__ground"></div>
      <div class="intro__frags"></div>
      <canvas class="intro__fx"></canvas>
      <canvas class="intro__air"></canvas>
      <canvas class="intro__actor"></canvas>`;
    document.body.appendChild(this.root);

    this.ground = this.root.querySelector('.intro__ground')!;
    this.frags = this.root.querySelector('.intro__frags')!;
    this.fx = this.root.querySelector('.intro__fx')!;
    this.air = this.root.querySelector('.intro__air')!;
    this.actor = this.root.querySelector('.intro__actor')!;
    const fxCtx = this.fx.getContext('2d');
    const airCtx = this.air.getContext('2d');
    const actorCtx = this.actor.getContext('2d');
    if (!fxCtx || !airCtx || !actorCtx) throw new Error('intro: no 2d context');
    this.fxCtx = fxCtx;
    this.airCtx = airCtx;
    this.actorCtx = actorCtx;

    // A visitor who has already seen it gets the world, not the ceremony.
    if (opts.reduced || read(SEEN_KEY)) {
      this.shortCircuit();
      return;
    }
    write(SEEN_KEY, '1');

    this.atlas = loadAtlas();
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
  // Layout: one grid for everything
  // -------------------------------------------------------------------------

  private layout(): void {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    const fit = Math.min(this.vw / VIEW_W, this.vh / VIEW_H);
    const q = Math.max(3, Math.min(8, Math.floor(fit)));
    this.q = q;
    this.cols = Math.ceil(this.vw / q);
    this.rows = Math.ceil(this.vh / q);
    // The dash is centred on the screen and kept clear of its edges.
    this.dash = Math.round(Math.max(0, Math.min(this.cols * 0.36, this.cols - 90)));
    this.ax = Math.round(this.cols / 2 - FIGURE.x - this.dash / 2);
    this.ay = Math.round(this.rows * 0.52 - FIGURE.y);

    for (const c of [this.fx, this.actor]) {
      c.width = this.cols;
      c.height = this.rows;
      c.style.width = `${this.cols * q}px`;
      c.style.height = `${this.rows * q}px`;
    }
    // The cuts live above the pixel grid: full CSS resolution (capped at 2x),
    // anti-aliased strokes, never nearest-neighbour scaled.
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.air.width = Math.round(this.vw * this.dpr);
    this.air.height = Math.round(this.vh * this.dpr);
    this.actorCtx.imageSmoothingEnabled = false;
    this.buf = this.fxCtx.createImageData(this.cols, this.rows);

    this.buildCuts();
    this.sparks = this.buildSparks();
  }

  /** Resizing is honoured until he moves; after that the geometry is committed. */
  private onResize = (): void => {
    if (this.gateAt === null) this.layout();
  };

  /** Top-left of his cell in frame `f`, in cells. */
  private originX(f: number): number {
    return this.ax + Math.round(dashAt(f) * this.dash);
  }

  /**
   * Two diagonal cuts that never meet. The first is the draw: it runs left to
   * right, rising from a little under half way down the left edge to the top
   * right corner. The second is the kesa cut: it runs right to left, falling
   * from two thirds down at the right edge to the bottom-left corner. Endpoints sit beyond the side edges and each
   * control point lies between them in x, so both are functions of x and every
   * cell is cleanly above or below each one.
   */
  private buildCuts(): void {
    const { vw, vh, q, cols, rows } = this;

    const defs = [
      { a: [-0.12, 0.42], b: [1.12, -0.03], bow: 0.012, side: 1 },
      { a: [-0.12, 1.04], b: [1.12, 0.627], bow: 0.012, side: -1 },
    ];

    this.curves = defs.map((def) => {
      const A = { x: def.a[0]! * vw, y: def.a[1]! * vh };
      const B = { x: def.b[0]! * vw, y: def.b[1]! * vh };
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const n = { x: -dy / len, y: dx / len };
      const C = {
        x: (A.x + B.x) / 2 + n.x * def.side * def.bow * vh * 2,
        y: (A.y + B.y) / 2 + n.y * def.side * def.bow * vh * 2,
      };

      const N = 720;
      const xs = new Float32Array(N + 1);
      const ys = new Float32Array(N + 1);
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const mt = 1 - t;
        xs[i] = mt * mt * A.x + 2 * mt * t * C.x + t * t * B.x;
        ys[i] = mt * mt * A.y + 2 * mt * t * C.y + t * t * B.y;
      }

      const colY = new Float32Array(cols);
      const slope = new Float32Array(cols);
      const sec = new Float32Array(cols);
      let k = 0;
      for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * q;
        while (k < N - 1 && xs[k + 1]! < x) k++;
        const x0 = xs[k]!;
        const x1 = xs[k + 1]!;
        const y0 = ys[k]!;
        const y1 = ys[k + 1]!;
        const s = (y1 - y0) / (x1 - x0 || 1e-6);
        colY[c] = y0 + (x - x0) * s;
        slope[c] = s;
        sec[c] = Math.sqrt(1 + s * s);
      }
      return { ys: colY, slope, sec, px: xs, py: ys };
    });

    this.region = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * q;
      for (let c = 0; c < cols; c++) {
        let bits = 0;
        for (let j = 0; j < this.curves.length; j++) {
          const cv = this.curves[j]!;
          const d = (y - cv.ys[c]!) / cv.sec[c]!;
          if (d > 0) bits |= 1 << j;
        }
        this.region[r * cols + c] = bits;
      }
    }

    // The pieces part from the middle of the band between the two cuts.
    this.cross = { x: vw / 2, y: vh / 2 };
  }

  /** A sparse, deterministic scatter of pixels shed by each blade as it passes. */
  private buildSparks(): Spark[] {
    seed = 0x2f6e2b1;
    const per = this.vw < 760 ? 7 : 12;
    const run = this.vw * (1 + TRAIL);
    const out: Spark[] = [];
    SLASHES.forEach((s, j) => {
      const cv = this.curves[j]!;
      for (let i = 0; i < per; i++) {
        const x = this.vw * (0.08 + 0.84 * rnd());
        const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.q)));
        const sl = cv.slope[c]!;
        const sc = cv.sec[c]!;
        const along = 80 + 220 * rnd();
        const across = (rnd() - 0.5) * 180;
        const dir = s.dir;
        // Distance the head still has to travel to reach this x.
        const travel = dir > 0 ? x : this.vw - x;
        out.push({
          // Spawned as the head passes: the inverse of the head's easeOutQuad.
          t0: s.start + (1 - Math.sqrt(Math.max(0, 1 - travel / run))) * s.dur,
          x,
          y: cv.ys[c]! + (rnd() - 0.5) * this.q * 2,
          vx: dir * ((1 / sc) * along - (sl / sc) * across),
          vy: dir * ((sl / sc) * along + (1 / sc) * across) - 60,
          life: 240 + 280 * rnd(),
          size: rnd() < 0.22 ? 2 : 1,
          hot: rnd() < 0.32,
        });
      }
    });
    return out;
  }

  // -------------------------------------------------------------------------
  // The loop
  // -------------------------------------------------------------------------

  private frame = (now: number): void => {
    if (this.over) return;
    // The ceremony is timed from the first painted frame, not from construction:
    // building the atlas must not eat the summon.
    if (!this.t0) this.t0 = now;
    const t = now - this.t0;

    // Without the sheet there is no samurai; the world is not held hostage to it.
    if (this.atlas.failed && this.gateAt === null) {
      this.shortCircuit();
      return;
    }

    // The stillness is the loading state: he does not move until the site is
    // ready and the sheet that holds him has loaded.
    if (this.gateAt === null && t >= GATE_MIN && this.isReady && this.atlas.done) this.gateAt = now;
    const m = this.gateAt === null ? -1 : now - this.gateAt;

    this.paintActor(t, m);
    this.paintFx(m);
    this.paintAir(t, m);

    if (m >= SEPARATE_AT && !this.separated) this.separate();
    if (m >= ACTOR_FADE_AT && !this.actorFading) {
      this.actorFading = true;
      this.actor.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: ACTOR_FADE_MS,
        easing: 'ease-in',
        fill: 'forwards',
      });
    }
    if (m >= this.endAt) {
      this.teardown();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Any key or click jumps straight to the first cut. */
  private skip = (e: Event): void => {
    if (this.over || this.separated) return;
    if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey)) return;
    const jump = SLASHES[0]!.start - 20;
    const now = performance.now();
    const m = this.gateAt === null ? -1 : now - this.gateAt;
    if (m >= jump) return;
    this.isReady = true;
    // Without the sheet he cannot be shown mid-dash; the gate opens the moment it lands.
    if (!this.atlas.done) return;
    this.gateAt = now - jump;
  };

  // -------------------------------------------------------------------------
  // The samurai
  // -------------------------------------------------------------------------

  private paintActor(t: number, m: number): void {
    if (this.actorFading && m > ACTOR_FADE_AT + ACTOR_FADE_MS) return;
    const ctx = this.actorCtx;
    ctx.clearRect(0, 0, this.cols, this.rows);

    if (m < 0) {
      if (!this.reveal.length) this.reveal = this.atlas.reveal();
      const r = Math.min(1, Math.max(0, (t - REVEAL_FROM) / (REVEAL_TO - REVEAL_FROM)));
      if (r < 1) this.paintReveal(r);
      else this.blit(0, 1);
      return;
    }

    const f = frameAt(m);
    // While he is travelling he leaves red afterimages at the spots he has
    // just left; standing still, a smear only through the cut itself.
    if (Math.abs(dashAt(f) - dashAt(f - 2)) > 0.03) {
      for (const [lag, a] of GHOSTS) this.blit(f - lag, a, true);
    } else if (SLASHES.some((s) => m >= s.start - 70 && m <= s.start + s.dur)) {
      this.blit(f - 4, 0.12);
      this.blit(f - 2, 0.26);
    }
    this.blit(f, 1);
  }

  private blit(f: number, alpha: number, ghost = false): void {
    if (f < 0) return;
    const ctx = this.actorCtx;
    ctx.globalAlpha = alpha;
    this.atlas.draw(ctx, f, this.originX(f), this.ay, ghost);
    ctx.globalAlpha = 1;
  }

  /** The highlights arrive first, a few deliberate white pixels; the black fills in behind. */
  private paintReveal(r: number): void {
    const list = this.reveal;
    const n = Math.floor(list.length * smooth(r));
    const ctx = this.actorCtx;
    const ox = this.originX(0);
    for (let i = 0; i < n; i++) {
      const p = list[i]!;
      ctx.fillStyle = p.hex;
      ctx.fillRect(ox + p.x, this.ay + p.y, 1, 1);
    }
  }

  // -------------------------------------------------------------------------
  // Light: the blade glow, the cuts, the sparks
  // -------------------------------------------------------------------------

  private paintFx(m: number): void {
    const buf = this.buf;
    if (!buf) return;
    if (m < GLOW_FROM) {
      if (this.fxDirty) {
        this.fxCtx.clearRect(0, 0, this.cols, this.rows);
        this.fxDirty = false;
      }
      return;
    }
    buf.data.fill(0);
    this.paintGlow(m);
    this.paintSparks(m);
    this.fxCtx.putImageData(buf, 0, 0);
    this.fxDirty = true;
  }

  /** Max-blend a colour into one cell, so overlapping light never muddies. */
  private lit(i: number, c: RGB, k = 1): void {
    const d = this.buf!.data;
    const o = i * 4;
    if (c[0] > d[o]!) d[o] = c[0];
    if (c[1] > d[o + 1]!) d[o + 1] = c[1];
    if (c[2] > d[o + 2]!) d[o + 2] = c[2];
    const a = 255 * k;
    if (a > d[o + 3]!) d[o + 3] = a;
  }

  /**
   * In the coil a restrained red builds where the seal has been broken, at
   * the scabbard mouth, and rides the blade out as it is drawn.
   */
  private paintGlow(m: number): void {
    const s1 = SLASHES[0]!;
    if (m > s1.start + 40) return;
    const ramp = smooth((m - GLOW_FROM) / (GLOW_FULL - GLOW_FROM));
    const off = m > s1.start ? 1 - (m - s1.start) / 40 : 1;
    const g = ramp * off;
    if (g <= 0.02) return;

    const f = frameAt(m);
    const b = bladeAt(f);
    if (!b) return;
    const ox = this.originX(f);
    let x0: number, y0: number, x1: number, y1: number;
    if (b.visible) {
      x0 = ox + b.gx + (b.tx - b.gx) * 0.25 + 0.5;
      y0 = this.ay + b.gy + (b.ty - b.gy) * 0.25 + 0.5;
      x1 = ox + b.gx + (b.tx - b.gx) * 0.9 + 0.5;
      y1 = this.ay + b.gy + (b.ty - b.gy) * 0.9 + 0.5;
    } else {
      x0 = x1 = ox + b.mx + 0.5;
      y0 = y1 = this.ay + b.my + 0.5;
    }

    const cMin = Math.max(0, Math.floor(Math.min(x0, x1) - 3));
    const cMax = Math.min(this.cols - 1, Math.ceil(Math.max(x0, x1) + 3));
    const rMin = Math.max(0, Math.floor(Math.min(y0, y1) - 3));
    const rMax = Math.min(this.rows - 1, Math.ceil(Math.max(y0, y1) + 3));
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const d = segDist(c + 0.5, r + 0.5, x0, y0, x1, y1);
        const i = r * this.cols + c;
        if (d < 1.6) this.lit(i, RED, g);
        else if (d < 2.7) this.lit(i, DEEP, g);
      }
    }
  }

  /**
   * Everything in the air, on one smooth full-resolution overlay below the
   * samurai: the summoning wind (while he is not yet there) and the cuts.
   * Anti-aliased strokes only — a wide red haze, a neon edge, a white-hot
   * core and a hot head. Behind each head a residual seam stays until the
   * screen breaks; after that the fragments' own lit edges carry the cut and
   * this overlay goes away.
   */
  private paintAir(t: number, m: number): void {
    const ctx = this.airCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);

    const wind = this.windAmount(t, m);
    if (wind > 0.001) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.drawWind(ctx, t, wind);
    }

    this.paintBladeSmear(ctx, m);

    if (this.separated || m < SLASHES[0]!.start) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let j = 0; j < SLASHES.length; j++) this.drawSlash(ctx, j, m);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /** How strongly the summoning wind is present, before the motion clock. */
  private windAmount(t: number, m: number): number {
    if (m >= 0 || t <= WIND_FROM) return 0;
    const build = smooth((t - WIND_FROM) / (WIND_FULL - WIND_FROM));
    if (t <= SUMMON_AT) return build;
    return build * (1 - smooth((t - SUMMON_AT) / (WIND_END - SUMMON_AT)));
  }

  /**
   * The summon: a vortex of long wind strokes spiralling around the spot he
   * will occupy, dust and chakra motes riding it, and a single burst — ring,
   * gust and flash — at the moment he materialises. Drawn additively so the
   * overlapping strokes build light instead of mud.
   */
  private drawWind(ctx: CanvasRenderingContext2D, t: number, w: number): void {
    const cx = (this.originX(0) + FIGURE.x) * this.q;
    const cy = (this.ay + SPRITE_H * 0.52) * this.q;
    const R = Math.min(this.vw, this.vh) * 0.34;

    // Long strokes, each a rotating arc with a slight outward spiral.
    const arcs = 7;
    for (let i = 0; i < arcs; i++) {
      const dir = i % 2 ? -1 : 1;
      const speed = 0.0016 + (i % 3) * 0.0004;
      const phase = i * 2.399 + t * speed * dir;
      const rad = R * (0.45 + 0.05 * ((i * 7) % 10));
      const sweep = 1.5 + 0.09 * ((i * 3) % 10);
      const steps = 28;
      let px = 0;
      let py = 0;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const ang = phase + sweep * u;
        const rr = rad * (0.8 + 0.35 * u) * (1 + 0.05 * Math.sin(t * 0.006 + i));
        const x = cx + Math.cos(ang) * rr * 1.25;
        const y = cy + Math.sin(ang) * rr * 0.72;
        if (s > 0) {
          const taper = Math.pow(Math.sin(Math.PI * u), 0.8);
          const weight = (1.6 + 3.4 * taper) * (0.6 + 0.5 * w) * taper;
          const a = taper * w;
          this.strokeSegment(ctx, px, py, x, y, weight * 2.6, `rgba(200,206,212,${0.1 * a})`);
          this.strokeSegment(ctx, px, py, x, y, Math.max(0.7, weight * 1.1), `rgba(242,244,246,${0.3 * a})`);
          if (i % 3 === 2) {
            this.strokeSegment(ctx, px, py, x, y, Math.max(0.7, weight * 0.4), `rgba(255,36,66,${0.26 * a})`);
          }
        }
        px = x;
        py = y;
      }
    }

    // Dust and chakra motes, deterministic, riding the vortex.
    for (let i = 0; i < 26; i++) {
      const dir = i % 2 ? -1 : 1;
      const ang = i * 0.9 + t * (0.0018 + (i % 4) * 0.0004) * dir;
      const rr = R * (0.35 + 0.6 * (((i * 13) % 17) / 17));
      const x = cx + Math.cos(ang) * rr * 1.2;
      const y = cy + Math.sin(ang) * rr * 0.7;
      const a = w * (0.25 + 0.5 * (((i * 5) % 11) / 11));
      ctx.fillStyle = i % 5 === 0 ? `rgba(255,36,66,${a})` : `rgba(240,243,246,${a * 0.8})`;
      const sz = i % 3 === 0 ? 2 : 1;
      ctx.fillRect(x, y, sz, sz);
    }

    // The burst: an expanding ring, a radial gust, and a central flash.
    const bt = (t - SUMMON_AT) / 430;
    if (bt >= 0 && bt <= 1) {
      const b = smooth(bt);
      const ringR = R * (0.35 + 1.1 * b);
      const alpha = Math.pow(1 - bt, 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, ringR * 1.25, ringR * 0.72, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,24,56,${0.42 * alpha})`;
      ctx.lineWidth = 10 + 18 * (1 - bt);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.72 * alpha})`;
      ctx.lineWidth = 2 + 8 * (1 - bt);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const ang = i * 0.628 + t * 0.002;
        const r0 = ringR * 0.7;
        const r1 = ringR * (1.05 + 0.2 * (((i * 3) % 5) / 5));
        this.strokeSegment(
          ctx,
          cx + Math.cos(ang) * r0 * 1.25,
          cy + Math.sin(ang) * r0 * 0.72,
          cx + Math.cos(ang) * r1 * 1.25,
          cy + Math.sin(ang) * r1 * 0.72,
          1.5 + 3 * (1 - bt),
          `rgba(255,255,255,${0.32 * alpha})`,
        );
      }
    }

    const flash = Math.max(0, 1 - Math.abs(t - SUMMON_AT) / 220);
    if (flash > 0) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
      g.addColorStop(0, `rgba(255,255,255,${0.55 * flash})`);
      g.addColorStop(0.4, `rgba(255,90,110,${0.22 * flash})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * An anime smear: the blade's last few positions drawn as a fan of streaks
   * under the figure, additive so the overlap reads as a single hot arc. This
   * is the "multiple" smear, not a blur — the eye reads the arc even in the
   * three or four frames the strike actually lasts.
   */
  private paintBladeSmear(ctx: CanvasRenderingContext2D, m: number): void {
    let active = false;
    for (const s of SLASHES) {
      if (m >= s.start - 50 && m <= s.start + s.dur) {
        active = true;
        break;
      }
    }
    if (!active) return;

    const q = this.q;
    const samples = 7;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = samples - 1; i >= 0; i--) {
      const f = frameAt(m - i * FRAME_MS * 1.6);
      const b = bladeAt(f);
      if (!b?.visible) continue;
      const ox = this.originX(f);
      const gx = (ox + b.gx) * q;
      const gy = (this.ay + b.gy) * q;
      const tx = (ox + b.tx) * q;
      const ty = (this.ay + b.ty) * q;
      const age = i / samples;
      const a = Math.pow(1 - age, 1.3);
      this.strokeSegment(ctx, gx, gy, tx, ty, q * (2.8 + age * 2.2), `rgba(255,24,56,${0.18 * a})`);
      this.strokeSegment(ctx, gx, gy, tx, ty, q * (1.2 + age * 0.9), `rgba(255,255,255,${0.55 * a})`);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawSlash(ctx: CanvasRenderingContext2D, j: number, m: number): void {
    const s = SLASHES[j]!;
    if (m < s.start) return;
    const cv = this.curves[j]!;
    const run = this.vw * (1 + TRAIL);
    const k = Math.min(1, (m - s.start) / s.dur);
    const travelled = (1 - (1 - k) * (1 - k)) * run;
    // The head starts at the edge it enters from; the tail drags behind it.
    const headX = s.dir > 0 ? travelled : this.vw - travelled;
    const tailX = headX - s.dir * this.vw * TRAIL;
    const live = k < 1;

    // The second cut is the main impact: a brief white-red flash as the head
    // leaves the screen.
    const exitK = 1 - Math.sqrt(1 - 1 / (1 + TRAIL));
    const flashAt = s.start + exitK * s.dur;
    const flash = j === SLASHES.length - 1 && m >= flashAt && m < flashAt + FLASH_MS;

    // The cut left behind the head: a thin white core inside a neon edge.
    const seamA = s.dir > 0 ? 0 : Math.max(0, Math.min(headX, this.vw));
    const seamB = s.dir > 0 ? Math.max(0, Math.min(headX, this.vw)) : this.vw;
    if (seamB > seamA) {
      this.traceCurve(ctx, cv, seamA, seamB, 2);
      ctx.strokeStyle = 'rgba(110,10,24,0.34)';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = flash ? 'rgba(255,24,56,1)' : 'rgba(255,24,56,0.7)';
      ctx.lineWidth = flash ? 6.5 : 3.4;
      ctx.stroke();
      ctx.strokeStyle = flash ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.82)';
      ctx.lineWidth = flash ? 2.2 : 1.15;
      ctx.stroke();
    }

    if (!live) return;

    // Live trail: tapered per segment, additive, so overlaps never muddy.
    const span = Math.abs(headX - tailX) || 1;
    const taperPx = this.vw * 0.07;
    const x0 = Math.max(Math.min(headX, tailX), -24);
    const x1 = Math.min(Math.max(headX, tailX), this.vw + 24);
    const step = 5;
    for (let x = x0; x < x1; x += step) {
      const xn = Math.min(x + step, x1);
      const behind = s.dir > 0 ? x - tailX : tailX - x;
      const u = Math.max(0, Math.min(1, behind / span));
      const taper = Math.max(0, Math.min(1, x / taperPx, (this.vw - x) / taperPx));
      const w = this.q * WMAX * Math.pow(u, 0.75) * taper;
      if (w < 0.15) continue;
      const a = Math.min(1, 0.25 + u);
      const y = this.curveY(cv, x);
      const yn = this.curveY(cv, xn);
      this.strokeSegment(ctx, x, y, xn, yn, w * 2.4, `rgba(110,10,24,${0.3 * a})`);
      this.strokeSegment(ctx, x, y, xn, yn, w * 1.2, `rgba(255,24,56,${0.62 * a})`);
      this.strokeSegment(ctx, x, y, xn, yn, Math.max(0.8, w * 0.42), `rgba(255,255,255,${0.92 * a})`);
    }

    // A hot point at the head, so the eye reads a moving blade.
    if (headX > -30 && headX < this.vw + 30) {
      const hy = this.curveY(cv, headX);
      const r = this.q * 6;
      const g = ctx.createRadialGradient(headX, hy, 0, headX, hy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.3, 'rgba(255,80,90,0.55)');
      g.addColorStop(1, 'rgba(110,10,24,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(headX, hy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private traceCurve(
    ctx: CanvasRenderingContext2D,
    cv: Curve,
    x0: number,
    x1: number,
    step: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x0, this.curveY(cv, x0));
    for (let x = x0 + step; x < x1; x += step) ctx.lineTo(x, this.curveY(cv, x));
    ctx.lineTo(x1, this.curveY(cv, x1));
  }

  private strokeSegment(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    colour: string,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.stroke();
  }

  /** y of the cut at x, from the dense polyline built with the curves. */
  private curveY(cv: Curve, x: number): number {
    const xs = cv.px;
    const ys = cv.py;
    const n = xs.length;
    if (x <= xs[0]!) return ys[0]!;
    if (x >= xs[n - 1]!) return ys[n - 1]!;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid]! < x) lo = mid;
      else hi = mid;
    }
    const t = (x - xs[lo]!) / (xs[hi]! - xs[lo]! || 1e-6);
    return ys[lo]! + (ys[hi]! - ys[lo]!) * t;
  }

  private paintSparks(m: number): void {
    const q = this.q;
    for (const p of this.sparks) {
      const age = m - p.t0;
      if (age < 0 || age > p.life) continue;
      const sec = age / 1000;
      const x = p.x + p.vx * sec;
      const y = p.y + p.vy * sec + 0.5 * GRAVITY * sec * sec;
      const c0 = Math.floor(x / q);
      const r0 = Math.floor(y / q);
      const k = 1 - age / p.life;
      for (let dy = 0; dy < p.size; dy++) {
        for (let dx = 0; dx < p.size; dx++) {
          const c = c0 + dx;
          const r = r0 + dy;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          this.lit(r * this.cols + c, p.hot ? HOT : RED, k);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // The break
  // -------------------------------------------------------------------------

  /**
   * The cuts become physical. Every cell already knows which side of each cut
   * it is on, so each region is a fragment; its body is the screen's black and
   * its edge is lit by the same distance function the seam was drawn with. The
   * flat ground is swapped out in the same frame, so nothing visibly changes
   * until the pieces start to move.
   */
  private separate(): void {
    this.separated = true;
    const { cols, rows } = this;

    const stats = new Map<number, Stat>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bits = this.region[r * cols + c]!;
        let s = stats.get(bits);
        if (!s) {
          s = { minC: c, minR: r, maxC: c, maxR: r, sumC: 0, sumR: 0, n: 0 };
          stats.set(bits, s);
        }
        if (c < s.minC) s.minC = c;
        if (c > s.maxC) s.maxC = c;
        if (r < s.minR) s.minR = r;
        if (r > s.maxR) s.maxR = r;
        s.sumC += c;
        s.sumR += r;
        s.n++;
      }
    }

    // Unsupported pieces go first: the lowest centroid falls before the rest.
    const pieces = [...stats.entries()].sort((a, b) => b[1].sumR / b[1].n - a[1].sumR / a[1].n);
    const maxN = Math.max(...pieces.map(([, s]) => s.n));
    seed = 0x51f3a7d;
    let longest = 0;
    pieces.forEach(([bits, s], order) => {
      longest = Math.max(longest, this.throwPiece(bits, s, order, maxN));
    });
    this.endAt = SEPARATE_AT + longest + 60;

    this.ground.style.display = 'none';
    this.fireCut();
  }

  /** Builds one fragment and sets it falling. Returns its total animation time. */
  private throwPiece(bits: number, s: Stat, order: number, maxN: number): number {
    const { cols, q } = this;
    const bw = s.maxC - s.minC + 1;
    const bh = s.maxR - s.minR + 1;

    const body = document.createElement('canvas');
    const edge = document.createElement('canvas');
    body.width = bw;
    body.height = bh;
    // The edge is light, not sprite: keep it at device resolution so the cut
    // stays a smooth line even while the piece tumbles.
    const res = this.dpr;
    edge.width = Math.max(1, Math.round(bw * q * res));
    edge.height = Math.max(1, Math.round(bh * q * res));
    const bctx = body.getContext('2d');
    const ectx = edge.getContext('2d');
    if (!bctx || !ectx) return 0;
    const bimg = bctx.createImageData(bw, bh);

    for (let r = s.minR; r <= s.maxR; r++) {
      for (let c = s.minC; c <= s.maxC; c++) {
        const i = r * cols + c;
        if (this.region[i] !== bits) continue;
        const o = ((r - s.minR) * bw + (c - s.minC)) * 4;
        bimg.data[o] = 5;
        bimg.data[o + 1] = 5;
        bimg.data[o + 2] = 5;
        bimg.data[o + 3] = 255;
      }
    }
    bctx.putImageData(bimg, 0, 0);

    // The lit edge is the cut itself, redrawn in the fragment's local space.
    // The canvas clips it, so only the light on this piece's side survives.
    ectx.setTransform(res, 0, 0, res, 0, 0);
    ectx.lineCap = 'round';
    ectx.lineJoin = 'round';
    const stamp = Math.max(1, q);
    for (const cv of this.curves) {
      ectx.beginPath();
      const step = 4;
      for (let x = 0; x <= bw * q; x += step) {
        const sx = s.minC * q + x;
        const sy = this.curveY(cv, sx) - s.minR * q;
        if (x === 0) ectx.moveTo(x, sy);
        else ectx.lineTo(x, sy);
      }
      ectx.strokeStyle = 'rgba(90,7,18,0.9)';
      ectx.lineWidth = stamp * 3.8;
      ectx.stroke();
      ectx.strokeStyle = 'rgba(229,9,36,0.95)';
      ectx.lineWidth = stamp * 2.1;
      ectx.stroke();
      ectx.strokeStyle = 'rgba(245,245,245,0.95)';
      ectx.lineWidth = Math.max(1, stamp * 0.65);
      ectx.stroke();
    }

    const wrap = document.createElement('div');
    wrap.className = 'intro__frag';
    wrap.style.left = `${s.minC * q}px`;
    wrap.style.top = `${s.minR * q}px`;
    wrap.style.width = `${bw * q}px`;
    wrap.style.height = `${bh * q}px`;
    const cx = s.sumC / s.n + 0.5;
    const cy = s.sumR / s.n + 0.5;
    wrap.style.transformOrigin = `${(cx - s.minC) * q}px ${(cy - s.minR) * q}px`;
    edge.className = 'intro__edge';
    wrap.append(body, edge);
    this.frags.appendChild(wrap);

    // Heavier pieces rotate less and fall longer; light ones tumble.
    const mass = s.n / maxN;
    const light = 1 - mass;
    let dx = cx * q - this.cross.x;
    let dy = cy * q - this.cross.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const side = Math.sign(dx) || 1;
    const spin = rnd() < 0.5 ? -1 : 1;

    const sepPx = 9 + 9 * light;
    const sx = dx * sepPx;
    const sy = dy * sepPx;
    const sepRot = side * (0.8 + 1.2 * light);
    const delay = order * 65;
    const dur = 940 + 300 * mass;
    const fallX = dx * this.vw * (0.04 + 0.08 * light);
    const fallY = this.vh * (1.15 + 0.2 * (1 - (cy * q) / this.vh));
    const rx = spin * (16 + 20 * light);
    const ry = side * (8 + 16 * light);
    const rz = side * (5 + 13 * light);

    const sepMs = FALL_AT - SEPARATE_AT;
    const total = sepMs + delay + dur;
    const o1 = sepMs / total;
    const o2 = (sepMs + delay) / total;
    const tf = (x: number, y: number, a: number, b: number, c: number) =>
      `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateX(${a.toFixed(2)}deg) rotateY(${b.toFixed(2)}deg) rotateZ(${c.toFixed(2)}deg)`;

    wrap.animate(
      [
        { offset: 0, transform: tf(0, 0, 0, 0, 0), easing: 'cubic-bezier(.16,.84,.3,1)' },
        { offset: o1, transform: tf(sx, sy, 0, 0, sepRot), easing: 'linear' },
        { offset: o2, transform: tf(sx, sy, 0, 0, sepRot), easing: 'cubic-bezier(.45,0,.92,.5)' },
        { offset: 1, transform: tf(sx + fallX, sy + fallY, rx, ry, sepRot + rz) },
      ],
      { duration: total, fill: 'forwards' },
    );
    wrap.animate(
      [
        { offset: 0, opacity: 1 },
        { offset: o2 + (1 - o2) * 0.42, opacity: 1 },
        { offset: 1, opacity: 0 },
      ],
      { duration: total, fill: 'forwards' },
    );
    // The freshly cut edge holds its light through the separation, then dims.
    edge.animate(
      [
        { offset: 0, opacity: 1 },
        { offset: o2, opacity: 1 },
        { offset: o2 + (1 - o2) * 0.38, opacity: 0 },
        { offset: 1, opacity: 0 },
      ],
      { duration: total, fill: 'forwards' },
    );

    return total;
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
    this.root.remove();
    this.fireCut();
    this.resolve();
  }
}

/**
 * The one colour rule for a cut, by distance from it in cells. It draws the
 * seam before the break and the fragments' edges after it, which is what makes
 * the hand-off invisible.
 */
function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** Deterministic, so every run cuts the same screen the same way. */
let seed = 0x2f6e2b1;
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
