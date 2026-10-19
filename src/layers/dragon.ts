import sheetUrl from './dragon.png';
import data from './dragon.json';

/**
 * Now and then a dragon crosses the surface's sky. Its body and wing motion
 * are four looping sets baked by `npm run art:dragon` (see tools/dragon):
 * flap, climb, glide and dive. This decides the flight and which set fits it.
 *
 * Each pass follows one route through depth as well as across the screen: a
 * swoop that dives in close and climbs away, an approach that comes at the
 * viewer, a departure that dwindles into the distance, a stoop from high up
 * that pulls out low, and a turn-back that comes in, wheels round and leaves
 * the way it came. Along the way it rides a wavy line, banks into climbs and
 * dives, crosses faster when near, and is dimmed by distance. The flight
 * picks its own movement: climbing flaps hard, a steep descent folds into a
 * dive, a gentle one glides, and a turn glides through with the sprite
 * narrowing to edge-on and opening out the other way.
 *
 * It is drawn into the horizon's canvas, so whatever its size it is resampled
 * onto the night scene's cell grid and stays pixel art.
 */

const W: number = data.w;
const H: number = data.h;
type SetName = 'flap' | 'climb' | 'glide' | 'dive';
const SETS = data.sets as Record<SetName, [number, number, number]>;

/** The sprite's chest: the point the flight path carries. */
const PIVOT_X = 64;
const PIVOT_Y = 60;
const PASS_S = 28;
const REST_MIN_S = 10;
const REST_MAX_S = 22;
const FIRST_S = 5;
/** Size on screen when nearest and farthest, in sheet pixels per cell. */
const NEAR = 0.85;
const FAR = 0.36;
const MAX_BANK = (16 * Math.PI) / 180;
/** Seconds a new movement must be called for before the sprite switches to it. */
const SETTLE_S = 0.45;
/** How quickly the sprite turns round, in facing units per second. */
const TURN_RATE = 2.4;

const smooth = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

interface Route {
  /** Progress across the screen: 0 off the entry edge, 1 off the far one. May turn back. */
  x: (u: number) => number;
  /** 0 far, 1 close. */
  near: (u: number) => number;
  /** Chest height as a share of the screen, before the wave. */
  alt: (u: number) => number;
}

const ROUTES: Route[] = [
  // Swoop: in from afar, dive close mid-sky, climb away.
  {
    x: (u) => u,
    near: (u) => Math.sin(Math.PI * u) ** 1.5,
    alt: (u) => 0.07 + 0.14 * Math.sin(Math.PI * u) ** 1.5,
  },
  // Approach: comes at the viewer, dropping as it nears.
  { x: (u) => u, near: (u) => smooth(u), alt: (u) => 0.06 + 0.13 * smooth(u) },
  // Departure: starts close and low, climbs off into the distance.
  { x: (u) => u, near: (u) => 1 - Math.sqrt(u), alt: (u) => 0.21 - 0.15 * smooth(u) },
  // Stoop: high and far, a steep dive, then pulls out low and levels.
  {
    x: (u) => u,
    near: (u) => 0.25 + 0.55 * smooth((u - 0.25) / 0.5),
    alt: (u) => 0.05 + 0.18 * smooth((u - 0.28) / 0.25) - 0.06 * smooth((u - 0.6) / 0.35),
  },
  // Turn-back: comes in close, wheels round, climbs away the way it came.
  {
    x: (u) => 0.66 * Math.sin(Math.PI * u) - 0.12 * u,
    near: (u) => 0.85 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.9,
    alt: (u) => 0.07 + 0.15 * Math.sin(Math.PI * u * 0.9),
  },
];

export class Dragon {
  private sheet = new Image();
  private ready = false;
  private start = FIRST_S;
  /** Which edge the pass enters from: 1 the left, -1 the right. */
  private dir: 1 | -1 = -1;
  private route: Route = ROUTES[0]!;
  private wave = 0;
  private last = -1;

  private set: SetName = 'flap';
  private want: SetName = 'flap';
  private wantFor = 0;
  /** Frames advanced within the current set, fractional. */
  private phase = 0;
  /** -1 facing left .. 1 facing right; passes through 0 mid-turn. */
  private facing = 0;

  constructor() {
    this.sheet.src = sheetUrl;
    this.sheet.decode().then(
      () => (this.ready = true),
      () => undefined,
    );
  }

  private where(u: number, cols: number, rows: number): { x: number; y: number; near: number } {
    const r = this.route;
    const near = Math.max(0, Math.min(1, r.near(u)));
    const margin = W * NEAR;
    const travel = cols + margin * 2;
    const p = r.x(u);
    const x = this.dir === 1 ? -margin + p * travel : cols + margin - p * travel;
    const wave = 0.03 * Math.sin(Math.PI * 2 * 2.2 * u + this.wave) * (1 - 0.4 * near);
    return { x, y: rows * (r.alt(u) + wave), near };
  }

  private newPass(t: number): void {
    this.start = t + REST_MIN_S + Math.random() * (REST_MAX_S - REST_MIN_S);
    this.dir = this.dir === 1 ? -1 : 1;
    this.route = ROUTES[Math.floor(Math.random() * ROUTES.length)]!;
    this.wave = Math.random() * Math.PI * 2;
    this.facing = 0;
  }

  /** `t` is elapsed seconds; `cols`/`rows` are the canvas size in cells. */
  paint(ctx: CanvasRenderingContext2D, t: number, cols: number, rows: number): void {
    const dt = this.last < 0 ? 0 : Math.min(0.1, t - this.last);
    this.last = t;
    if (!this.ready) return;
    const u = (t - this.start) / PASS_S;
    if (u > 1) {
      this.newPass(t);
      return;
    }
    if (u < 0) return;

    const here = this.where(u, cols, rows);
    const du = 0.003;
    const next = this.where(Math.min(1, u + du), cols, rows);
    // Screen velocity in cells per second.
    const vx = (next.x - here.x) / (du * PASS_S);
    const vy = (next.y - here.y) / (du * PASS_S);

    // Face the way it is going; a reversal swings through edge-on.
    const target = vx >= 0 ? 1 : -1;
    if (this.facing === 0) this.facing = target;
    this.facing += Math.sign(target - this.facing) * Math.min(Math.abs(target - this.facing), TURN_RATE * dt);
    const turning = Math.abs(this.facing) < 0.85;

    // Pick the movement from the path: climbing flaps hard, a steep drop
    // folds into a dive, a gentle one glides. Held a moment before switching
    // so the wings don't stutter between sets.
    const scaleNow = FAR + (NEAR - FAR) * here.near;
    const climb = -vy / scaleNow;
    const want: SetName = turning ? 'glide' : climb > 3.5 ? 'climb' : climb < -7 ? 'dive' : climb < -2.2 ? 'glide' : 'flap';
    if (want !== this.want) {
      this.want = want;
      this.wantFor = 0;
    }
    this.wantFor += dt;
    if (this.want !== this.set && this.wantFor >= SETTLE_S) this.set = this.want;
    const [first, count, ms] = SETS[this.set];
    this.phase += (dt * 1000) / ms;
    const f = first + (Math.floor(this.phase) % count);

    // Bank along the path, easing off while side-on in a turn.
    const bank = Math.max(-MAX_BANK, Math.min(MAX_BANK, Math.atan2(vy, Math.abs(vx) + 1e-3))) * Math.abs(this.facing);
    const face = this.facing >= 0 ? 1 : -1;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Distance thins it into the night.
    ctx.globalAlpha = 0.55 + 0.45 * smooth(here.near);
    ctx.translate(Math.round(here.x), Math.round(here.y));
    ctx.rotate(face * bank);
    // The sheet faces right; the facing value mirrors and, mid-turn, narrows it.
    const sx = Math.abs(this.facing) < 0.08 ? 0.08 * face : this.facing;
    ctx.scale(sx * scaleNow, scaleNow);
    ctx.drawImage(this.sheet, f * W, 0, W, H, -PIVOT_X, -PIVOT_Y, W, H);
    ctx.restore();
  }
}
