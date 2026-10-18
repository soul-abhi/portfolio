/**
 * The camera is the whole site. There are no pages, no routes, no scroll
 * positions - only (cx, cy, z), where z is the NATURAL LOG of the zoom scale.
 *
 * Working in log space is what makes this tractable: a zoom from x1 to x10,000
 * is a straight line in z, so easing, springs and velocity all behave the same
 * at every depth. In linear scale space the same motion would accelerate
 * uncontrollably on the way in and crawl on the way out.
 */

export interface CameraState {
  cx: number;
  cy: number;
  z: number;
}

/** Hard stops so the user can never get lost in featureless space. */
const Z_MIN = Math.log(0.35);
const Z_MAX = Math.log(4.2e7);

/** Exponential-smoothing time constants, in seconds. */
const TAU_PAN = 0.085;
const TAU_ZOOM = 0.105;

export class Camera {
  cx = 0;
  cy = 0;
  z = 0;

  private tcx = 0;
  private tcy = 0;
  private tz = 0;

  private flight: Flight | null = null;

  /** World-space box the pan may roam freely; beyond it, the drag resists. */
  private bounds: Bounds | null = null;

  viewW = 1;
  viewH = 1;

  constructor(initial: CameraState) {
    this.cx = this.tcx = initial.cx;
    this.cy = this.tcy = initial.cy;
    this.z = this.tz = initial.z;
  }

  get scale(): number {
    return Math.exp(this.z);
  }

  get targetScale(): number {
    return Math.exp(this.tz);
  }

  resize(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    const s = this.scale;
    return [(wx - this.cx) * s + this.viewW / 2, (wy - this.cy) * s + this.viewH / 2];
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    const s = this.scale;
    return [(sx - this.viewW / 2) / s + this.cx, (sy - this.viewH / 2) / s + this.cy];
  }

  /**
   * Zoom while pinning the world point under the cursor. Without the pin,
   * wheel-zoom feels like the page is shoving you around.
   */
  zoomAt(screenX: number, screenY: number, dz: number): void {
    this.cancelFlight();
    const nz = clamp(this.tz + dz, Z_MIN, Z_MAX);
    const applied = nz - this.tz;
    if (applied === 0) return;

    // Pin against the TARGET transform, not the rendered one, so that rapid
    // wheel events compose correctly instead of fighting the smoothing.
    const ts = Math.exp(this.tz);
    const wx = (screenX - this.viewW / 2) / ts + this.tcx;
    const wy = (screenY - this.viewH / 2) / ts + this.tcy;
    const ns = Math.exp(nz);

    this.tz = nz;
    this.tcx = wx - (screenX - this.viewW / 2) / ns;
    this.tcy = wy - (screenY - this.viewH / 2) / ns;
  }

  setBounds(b: Bounds | null): void {
    this.bounds = b;
  }

  /**
   * Pan by a screen-pixel delta at the current target scale. Inside the bounds
   * the plane moves 1:1; past them every further pixel of drag buys a quarter
   * of a pixel, so a drag is a peek rather than a way to get lost.
   */
  panByPixels(dx: number, dy: number): void {
    this.cancelFlight();
    const s = Math.exp(this.tz);
    const b = this.bounds;
    this.tcx = b ? resist(this.tcx, -dx / s, b.x0, b.x1) : this.tcx - dx / s;
    this.tcy = b ? resist(this.tcy, -dy / s, b.y0, b.y1) : this.tcy - dy / s;
  }

  nudgeZoom(dz: number): void {
    this.zoomAt(this.viewW / 2, this.viewH / 2, dz);
  }

  /**
   * Cinematic travel. Over any real distance this pulls back far enough to see
   * both endpoints, coasts across, then dives in - the arc you get for free
   * from a parabola in z, and the single detail that separates "flying" from
   * "a linear lerp that looks like a glitch".
   */
  flyTo(cx: number, cy: number, z: number, opts: { minDuration?: number; maxDuration?: number } = {}): void {
    const dist = Math.hypot(cx - this.cx, cy - this.cy);

    // Zoom level at which the whole journey fits on screen, with margin. The
    // curve only sags when the travel actually demands a wider view - a pure
    // zoom with no lateral distance must interpolate straight, or it pulls
    // back from a place it never left.
    const fitZ = dist > 1e-12 ? Math.log(Math.min(this.viewW, this.viewH) / (dist * 2.2)) : Infinity;
    const mid = (this.z + z) / 2;
    const apex = Math.min(mid, fitZ);
    const arc = mid - apex;

    const zTravel = Math.abs(z - this.z) + arc * 2;
    const duration = Math.max(opts.minDuration ?? 0.62, Math.min(opts.maxDuration ?? 2.1, 0.46 + zTravel * 0.2));

    this.flight = {
      t: 0,
      duration,
      from: { cx: this.cx, cy: this.cy, z: this.z },
      to: { cx, cy, z },
      apex,
    };
  }

  /**
   * Hard-set the camera and its target together. Assigning cx/cy/z alone
   * leaves the smoothing targets where they were, and the camera quietly
   * slides back to them on the next tick.
   */
  place(cx: number, cy: number, z: number): void {
    this.flight = null;
    this.cx = this.tcx = cx;
    this.cy = this.tcy = cy;
    this.z = this.tz = z;
  }

  cancelFlight(): void {
    if (!this.flight) return;
    this.flight = null;
    this.tcx = this.cx;
    this.tcy = this.cy;
    this.tz = this.z;
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  update(dt: number): void {
    const f = this.flight;
    if (f) {
      f.t += dt;
      const u = Math.min(1, f.t / f.duration);
      const e = easeInOutCubic(u);

      this.cx = f.from.cx + (f.to.cx - f.from.cx) * e;
      this.cy = f.from.cy + (f.to.cy - f.from.cy) * e;

      // Quadratic through (0, fromZ) and (1, toZ) sagging to the apex.
      const control = f.apex * 2 - (f.from.z + f.to.z) / 2;
      const iu = 1 - e;
      this.z = iu * iu * f.from.z + 2 * iu * e * control + e * e * f.to.z;

      if (u >= 1) {
        this.cx = f.to.cx;
        this.cy = f.to.cy;
        this.z = f.to.z;
        this.tcx = this.cx;
        this.tcy = this.cy;
        this.tz = this.z;
        this.flight = null;
      }
      return;
    }

    // Frame-rate-independent smoothing toward the target. No clamp here on purpose. zoomAt is the only path that moves tz from
    // user input and it clamps already, whereas place() and flyTo legitimately
    // sit outside the range - the intro's descent begins well below Z_MIN.
    const ap = 1 - Math.exp(-dt / TAU_PAN);
    const az = 1 - Math.exp(-dt / TAU_ZOOM);
    this.cx += (this.tcx - this.cx) * ap;
    this.cy += (this.tcy - this.cy) * ap;
    this.z += (this.tz - this.z) * az;
  }

  /** True once motion is below perceptual threshold - used to commit the URL. */
  get settled(): boolean {
    if (this.flight) return false;
    const s = this.scale;
    return (
      Math.abs(this.tcx - this.cx) * s < 0.5 &&
      Math.abs(this.tcy - this.cy) * s < 0.5 &&
      Math.abs(this.tz - this.z) < 0.002
    );
  }
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function resist(v: number, d: number, lo: number, hi: number): number {
  const n = v + d;
  if ((n < lo && d < 0) || (n > hi && d > 0)) return v + d * 0.25;
  return n;
}

interface Flight {
  t: number;
  duration: number;
  from: CameraState;
  to: CameraState;
  apex: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

export { Z_MIN, Z_MAX };
