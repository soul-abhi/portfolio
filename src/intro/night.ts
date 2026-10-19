import setUrl from './night.png';
import set from './night.json';

/**
 * The night the gate is made of: a dithered sky, stars, the moon, two ridges
 * on the horizon and a still lake that mirrors them. Everything is drawn on
 * the intro's cell grid, one cell per art pixel, so it shares the figure's
 * pixel scale. The parts that never change are composed once per layout; only
 * the stars, the shimmer and the moon's path are redrawn each frame.
 *
 * The ridges and the moon are art/night.aseprite (`npm run art:night`).
 *
 * The intro uses all of it. The hero uses it with `sky: false`: no sky, no
 * stars - the site's own star field is the sky there - just a faint dithered
 * haze above the ridges so their silhouettes read against the black.
 */

export interface NightOpts {
  /** Paint the sky gradient and the stars. */
  sky: boolean;
  /** Where the moon hangs, as shares of the width and of the sky's height. */
  moon: readonly [number, number];
  /**
   * Scroll the land past like the view from a train: far ridge slowest, near
   * ridge faster, and a foreground shore of reeds and pines fastest. The moon
   * and the water stay put, as they would.
   */
  drift?: boolean;
}

/** Drift speeds, in cells per second. */
const DRIFT_FAR = 0.8;
const DRIFT_NEAR = 2.2;
const DRIFT_FORE = 7;
/** The foreground shore: one seamless strip, tiled. */
const FORE_W = 640;
const FORE_H = 40;

type Rect = [number, number, number, number];
const FAR = set.far as Rect;
const NEAR = set.near as Rect;
const MOON = set.moon as Rect;

const SKY = ['#020308', '#03050b', '#05080f', '#070b15', '#0a0f1c', '#0d1424'];
const LAKE = ['#0b111e', '#080d17', '#060910', '#04060b', '#020306'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

interface Star {
  x: number;
  y: number;
  /** 0 dim, 1 plain, 2 bright with a cross. */
  kind: number;
  phase: number;
  speed: number;
}

interface Glint {
  x: number;
  y: number;
  len: number;
  phase: number;
  speed: number;
}

export class Night {
  private img = new Image();
  private loaded = false;
  private base = document.createElement('canvas');
  private fore: HTMLCanvasElement | null = null;
  private world = document.createElement('canvas');
  private worldCtx: CanvasRenderingContext2D;

  private cols = 1;
  private rows = 1;
  private horizon = 1;
  private moonX = 0;
  private moonY = 0;
  private stars: Star[] = [];
  private glints: Glint[] = [];
  private composed = false;
  private opts: NightOpts;

  constructor(opts: NightOpts = { sky: true, moon: [0.2, 0.26] }) {
    this.opts = opts;
    const ctx = this.world.getContext('2d');
    if (!ctx) throw new Error('night: no 2d context');
    this.worldCtx = ctx;
    this.img.onload = () => {
      this.loaded = true;
      this.composed = false;
    };
    this.img.src = setUrl;
  }

  /** Moves the moon; takes effect at the next layout. */
  setMoon(at: readonly [number, number]): void {
    this.opts = { ...this.opts, moon: at };
  }

  /** The water line, in cells from the top. */
  get horizonY(): number {
    return this.horizon;
  }

  layout(cols: number, rows: number, horizon: number): void {
    this.cols = cols;
    this.rows = rows;
    this.horizon = horizon;
    this.base.width = this.world.width = cols;
    this.base.height = this.world.height = rows;
    this.moonX = Math.round(cols * this.opts.moon[0]);
    this.moonY = Math.round(horizon * this.opts.moon[1]);

    seed = 0x2545f491;
    this.stars = [];
    const n = this.opts.sky ? Math.round((cols * horizon) / 115) : 0;
    for (let i = 0; i < n; i++) {
      const y = Math.floor(rnd() * rnd() * (horizon - 18));
      const r = rnd();
      this.stars.push({
        x: Math.floor(rnd() * cols),
        y,
        kind: r < 0.06 ? 2 : r < 0.45 ? 1 : 0,
        phase: rnd() * Math.PI * 2,
        speed: 0.0012 + rnd() * 0.003,
      });
    }
    this.glints = [];
    const g = Math.round((cols * (rows - horizon)) / 260);
    for (let i = 0; i < g; i++) {
      const y = horizon + 2 + Math.floor(rnd() * (rows - horizon - 2));
      const depth = (y - horizon) / (rows - horizon);
      this.glints.push({
        x: Math.floor(rnd() * cols),
        y,
        len: 1 + Math.floor(rnd() * (2 + depth * 6)),
        phase: rnd() * Math.PI * 2,
        speed: 0.0015 + rnd() * 0.002,
      });
    }
    this.composed = false;
  }

  /** Draws the night at time `t` into the two halves of the gate. */
  paint(t: number, left: CanvasRenderingContext2D, right: CanvasRenderingContext2D, split: number): void {
    this.render(t);
    left.drawImage(this.world, 0, 0, split, this.rows, 0, 0, split, this.rows);
    right.drawImage(this.world, split, 0, this.cols - split, this.rows, 0, 0, this.cols - split, this.rows);
  }

  /** Draws the night at time `t` into one canvas the size of the grid. */
  paintTo(t: number, target: CanvasRenderingContext2D): void {
    this.render(t);
    target.clearRect(0, 0, this.cols, this.rows);
    target.drawImage(this.world, 0, 0);
  }

  private render(t: number): void {
    if (!this.composed) this.compose();
    const ctx = this.worldCtx;
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.cols, this.rows);
    ctx.drawImage(this.base, 0, 0);
    const drift = this.opts.drift === true;
    if (drift && this.loaded) {
      const s = t / 1000;
      this.land(ctx, this.anchor() - Math.round(s * DRIFT_FAR), this.anchor() - Math.round(s * DRIFT_NEAR));
    }

    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      if (s.kind === 0) {
        ctx.fillStyle = `rgba(108, 122, 146, ${0.35 + 0.4 * tw})`;
        ctx.fillRect(s.x, s.y, 1, 1);
      } else {
        ctx.fillStyle = `rgba(207, 216, 230, ${0.45 + 0.55 * tw})`;
        ctx.fillRect(s.x, s.y, 1, 1);
        if (s.kind === 2 && tw > 0.5) {
          ctx.fillStyle = `rgba(160, 176, 200, ${(tw - 0.5) * 1.2})`;
          ctx.fillRect(s.x - 1, s.y, 1, 1);
          ctx.fillRect(s.x + 1, s.y, 1, 1);
          ctx.fillRect(s.x, s.y - 1, 1, 1);
          ctx.fillRect(s.x, s.y + 1, 1, 1);
        }
      }
    }

    // Now and then a shooting star, high and to one side.
    const period = 4700;
    const k = (t % period) / 620;
    if (this.opts.sky && k < 1 && t > 1200) {
      const n = Math.floor(t / period);
      const sx = Math.round(this.cols * (0.55 + 0.3 * ((n * 0.618) % 1)));
      const sy = Math.round(this.horizon * (0.08 + 0.12 * ((n * 0.37) % 1)));
      const head = Math.round(k * 26);
      for (let i = 0; i < 9; i++) {
        const p = head - i;
        if (p < 0) continue;
        ctx.fillStyle = `rgba(220, 230, 245, ${(1 - i / 9) * (1 - k) * 0.9})`;
        ctx.fillRect(sx + p, sy + Math.round(p * 0.45), 1, 1);
      }
    }

    // The moon's path: broken streaks under it, widening toward the viewer.
    for (let y = this.horizon + 2; y < this.rows; y += 2) {
      const depth = (y - this.horizon) / (this.rows - this.horizon);
      const half = 1 + Math.round(depth * 7);
      const wob = Math.round(Math.sin(t * 0.0017 + y * 0.7) * (1 + depth * 2));
      const on = Math.sin(t * 0.004 + y * 1.9) > -0.3;
      if (!on) continue;
      ctx.fillStyle = `rgba(159, 179, 200, ${0.22 * (1 - depth * 0.6)})`;
      ctx.fillRect(this.moonX + wob - half, y, half * 2, 1);
    }

    for (const g of this.glints) {
      const v = Math.sin(t * g.speed + g.phase);
      if (v < 0.6) continue;
      const drift = Math.round(Math.sin(t * 0.0006 + g.phase) * 2);
      ctx.fillStyle = `rgba(90, 110, 140, ${(v - 0.6) * 0.9})`;
      ctx.fillRect(g.x + drift, g.y, g.len, 1);
    }

    if (drift) {
      const fore = (this.fore ??= shore());
      const x0 = -Math.round(((t / 1000) * DRIFT_FORE) % FORE_W);
      for (let x = x0; x < this.cols; x += FORE_W) ctx.drawImage(fore, x, this.rows - FORE_H);
    }
  }

  /** Where the ridge tiles start so the tower stands right of centre, behind the lantern. */
  private anchor(): number {
    return Math.round(this.cols * 0.74) - 173;
  }

  /** The ridges, their reflection and the water's ripple lines, at the given tile offsets. */
  private land(ctx: CanvasRenderingContext2D, farX: number, nearX: number): void {
    const { cols, rows, horizon } = this;
    ctx.imageSmoothingEnabled = false;
    const tile = (r: Rect, offset: number, bottom: number, flip: boolean, alpha: number) => {
      ctx.globalAlpha = alpha;
      const start = ((offset % r[2]) - r[2]) % r[2];
      for (let x = start; x < cols; x += r[2]) {
        if (!flip) {
          ctx.drawImage(this.img, r[0], r[1], r[2], r[3], x, bottom - r[3], r[2], r[3]);
        } else {
          ctx.save();
          ctx.translate(0, bottom * 2);
          ctx.scale(1, -1);
          ctx.drawImage(this.img, r[0], r[1], r[2], r[3], x, bottom - r[3], r[2], r[3]);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    };
    tile(FAR, farX, horizon, false, 1);
    tile(NEAR, nearX, horizon + 1, false, 1);
    tile(FAR, farX, horizon, true, 0.38);
    tile(NEAR, nearX, horizon + 1, true, 0.5);
    // Ripple lines break the reflection up, as still water does.
    ctx.fillStyle = 'rgba(8, 13, 23, 0.7)';
    for (let y = horizon + 3; y < Math.min(rows, horizon + 60); y += 3) ctx.fillRect(0, y, cols, 1);
    // A thin line where the water meets the land, catching the sky.
    ctx.fillStyle = 'rgba(45, 58, 82, 0.6)';
    ctx.fillRect(0, horizon + 1, cols, 1);
  }

  /** The unchanging part: sky and lake gradients, the moon, the ridges and their reflection. */
  private compose(): void {
    const { cols, rows, horizon } = this;
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(cols, rows);
    const d = img.data;
    const sky = SKY.map(hex);
    const lake = LAKE.map(hex);
    const haze = 22;
    for (let y = 0; y < rows; y++) {
      if (y < horizon && !this.opts.sky) {
        // No sky: transparent, but for a dithered band of haze above the
        // ridges, densest at the waterline.
        const u = (y - (horizon - haze)) / haze;
        if (u <= 0) continue;
        const c = sky[sky.length - 1]!;
        for (let x = 0; x < cols; x++) {
          if (u * u * u * 0.5 <= BAYER[(y % 4) * 4 + (x % 4)]! / 16) continue;
          const o = (y * cols + x) * 4;
          d[o] = c[0];
          d[o + 1] = c[1];
          d[o + 2] = c[2];
          d[o + 3] = 255;
        }
        continue;
      }
      const stops = y < horizon ? sky : lake;
      const u = y < horizon ? y / Math.max(1, horizon - 1) : (y - horizon) / Math.max(1, rows - horizon - 1);
      const v = u * (stops.length - 1);
      const i0 = Math.min(stops.length - 1, Math.floor(v));
      const frac = v - i0;
      for (let x = 0; x < cols; x++) {
        // Ordered dither between neighbouring stops: banding, the pixel-art way.
        const th = BAYER[(y % 4) * 4 + (x % 4)]! / 16;
        const c = stops[frac > th ? Math.min(stops.length - 1, i0 + 1) : i0]!;
        const o = (y * cols + x) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (!this.loaded) return;
    ctx.imageSmoothingEnabled = false;
    // Drifting land is drawn per frame instead, over the moon, so it can pass in front of it.
    if (!this.opts.drift) this.land(ctx, this.anchor(), this.anchor());

    ctx.drawImage(this.img, MOON[0], MOON[1], MOON[2], MOON[3], this.moonX - 16, this.moonY - 16, MOON[2], MOON[3]);
    this.composed = true;
  }
}

/**
 * The near shore, as one seamless strip: a dark bank with reeds, rocks and
 * the odd pine, each top edge catching a little moonlight. Everything wraps at
 * FORE_W so the strip tiles without a seam.
 */
function shore(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = FORE_W;
  c.height = FORE_H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const ink = '#0b1222';
  const rim = '#24324d';
  const top = new Int16Array(FORE_W).fill(FORE_H);
  const fill = (x: number, y0: number) => {
    const xi = ((x % FORE_W) + FORE_W) % FORE_W;
    const y = Math.max(0, Math.round(y0));
    ctx.fillStyle = ink;
    ctx.fillRect(xi, y, 1, FORE_H - y);
    if (y < top[xi]!) top[xi] = y;
  };
  seed = 0x51ed27;
  // The bank: a low rolling line, periodic so it wraps.
  for (let x = 0; x < FORE_W; x++) {
    const u = (x / FORE_W) * Math.PI * 2;
    fill(x, FORE_H - 7 - 2 * Math.sin(u * 3) - 1.5 * Math.sin(u * 7 + 1) - Math.sin(u * 13 + 2));
  }
  // Rocks.
  for (let i = 0; i < 14; i++) {
    const cx = Math.floor(rnd() * FORE_W);
    const w = 3 + Math.floor(rnd() * 6);
    const h = 2 + rnd() * 3;
    for (let dx = -w; dx <= w; dx++) fill(cx + dx, FORE_H - 8 - h * Math.sqrt(1 - (dx / (w + 1)) ** 2));
  }
  // Reeds, in clumps.
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(rnd() * FORE_W);
    const n = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const x = cx + Math.floor((rnd() - 0.5) * 8);
      const h = 4 + Math.floor(rnd() * 9);
      const lean = (rnd() - 0.5) * 0.5;
      for (let j = 0; j < h; j++) fill(x + Math.round(lean * j), FORE_H - 9 - j);
    }
  }
  // Pines: a stack of widening tiers on a short trunk.
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(((i + rnd() * 0.6) / 5) * FORE_W);
    const h = 20 + Math.floor(rnd() * 12);
    const base = FORE_H - 9;
    for (let y = 0; y < h; y++) {
      const tier = (y % 6) / 6;
      const half = Math.max(0, Math.round((y / h) * 7 * (0.55 + 0.45 * tier)));
      for (let dx = -half; dx <= half; dx++) fill(cx + dx, base - h + y);
    }
    fill(cx, base - 2);
  }
  // Moonlight on whatever is highest in each column.
  ctx.fillStyle = rim;
  for (let x = 0; x < FORE_W; x++) if (top[x]! < FORE_H) ctx.fillRect(x, top[x]!, 1, 1);
  return c;
}

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

let seed = 0x2545f491;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
}
