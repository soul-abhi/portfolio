import type { Camera } from '../core/camera';
import { Night } from '../intro/night';
import { Dragon } from './dragon';
import { ZOOM_STEP } from '../world/types';

/**
 * The hero's ground: the intro's night carried on into the site - the moonlit
 * ridges, the ruined tower, the lake and the moon's path on it - along the
 * bottom of the surface, under the star field's sky.
 *
 * It belongs to the surface only. It is screen-fixed, not part of the world,
 * and as the camera descends past the surface it sinks and fades within half
 * a stratum, so the deeper strata keep their plain black ground.
 *
 * Drawn on a cell grid like the intro, one cell per art pixel, at the same
 * pixel scale the intro picks for the viewport.
 */

const HORIZON = 0.73;
/** Background, not the subject: it stays a little under full strength. */
const STRENGTH = 0.82;
/** Log-zoom over which it fades once the camera dives past the surface. */
const FADE = Math.log(ZOOM_STEP) * 0.5;

export class Horizon {
  private ctx: CanvasRenderingContext2D;
  private night: Night;
  private dragon = new Dragon();
  private cols = 1;
  private rows = 1;
  private shown = -1;

  constructor(
    private canvas: HTMLCanvasElement,
    private still: boolean,
  ) {
    // The land drifts past like the view from a train, unless motion is reduced.
    this.night = new Night({ sky: false, moon: [0.8, 0.34], drift: !still });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('horizon: no 2d context');
    this.ctx = ctx;
  }

  resize(w: number, h: number): void {
    const q = cellFor(w, h);
    this.cols = Math.ceil(w / q);
    this.rows = Math.ceil(h / q);
    this.canvas.width = this.cols;
    this.canvas.height = this.rows;
    this.canvas.style.width = `${this.cols * q}px`;
    this.canvas.style.height = `${this.rows * q}px`;
    // Clear of the markers: left of the title between the two rows, or up in
    // the corner on a narrow screen, where the title fills the middle.
    this.night.setMoon(w < 760 ? [0.82, 0.15] : [0.17, 0.62]);
    this.night.layout(this.cols, this.rows, Math.round(this.rows * HORIZON));
    this.shown = -1;
  }

  /** `rootZ` is the camera's z when it is settled on the surface. */
  draw(cam: Camera, t: number, rootZ: number): void {
    const d = Math.max(0, cam.z - rootZ) / FADE;
    const a = (1 - smooth(d)) * STRENGTH;
    if (a !== this.shown) {
      this.canvas.style.opacity = a.toFixed(3);
      this.canvas.style.transform = `translate3d(0, ${(smooth(d) * 6).toFixed(2)}vh, 0)`;
      this.shown = a;
    }
    if (a <= 0.001) return;
    this.night.paintTo(this.still ? 0 : t * 1000, this.ctx);
    if (!this.still) this.dragon.paint(this.ctx, t, this.cols, this.rows);
  }
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** The hero's pixel size: the intro's rule, so everything drawn on a grid shares one cell. */
export function cellFor(w: number, h: number): number {
  return Math.max(2, Math.min(Math.round((h * 0.58) / 165), Math.floor(w / 152), 7));
}
