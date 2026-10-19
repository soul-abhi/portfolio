/**
 * Spotlight colour reveal for the showcase gallery, after React Bits'
 * ChromaGrid: every shot sits in grayscale, and a soft circle that trails the
 * pointer lets a full-colour copy of the image show through.
 *
 * Plates live inside the camera's scaled transform, so the pointer is measured
 * in screen pixels and divided by the grid's current scale to land in the
 * grid's own CSS pixels - the space the mask is drawn in. One listener on the
 * world layer serves every gallery, mounted or not.
 */

/** 0 = hard-edged circle, 1 = all falloff. */
const SOFTNESS = 0.6;
/** Seconds-ish lag of the spotlight behind the pointer. */
const DAMPING = 0.45;
/** Seconds-ish for the colour to drain once the pointer leaves. */
const FADE_OUT = 0.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Mask stops for a smootherstep falloff from opaque core to transparent edge. */
function falloffStops(softness: number): string {
  const core = clamp(1 - softness, 0, 0.95);
  const stops: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const u = clamp((t - core) / Math.max(0.0001, 1 - core), 0, 1);
    const alpha = 1 - u * u * u * (u * (u * 6 - 15) + 10);
    stops.push(`rgba(0, 0, 0, ${alpha.toFixed(3)}) ${(t * 100).toFixed(1)}%`);
  }
  return stops.join(', ');
}

export function attachChroma(layer: HTMLElement, reduced: boolean): void {
  document.documentElement.style.setProperty('--chroma-stops', falloffStops(SOFTNESS));

  const s = { x: 0, y: 0, tx: 0, ty: 0, power: 0, target: 0 };
  let grid: HTMLElement | null = null;
  let raf = 0;
  let last = 0;

  const write = (g: HTMLElement) => {
    g.style.setProperty('--chroma-x', `${s.x.toFixed(2)}px`);
    g.style.setProperty('--chroma-y', `${s.y.toFixed(2)}px`);
    g.style.setProperty('--chroma-power', s.power.toFixed(4));
  };

  const frame = (now: number) => {
    raf = 0;
    if (!grid) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const follow = reduced ? 1 : 1 - Math.exp(-dt / Math.max(0.01, DAMPING * 0.32));
    s.x += (s.tx - s.x) * follow;
    s.y += (s.ty - s.y) * follow;
    const span = s.target > s.power ? 0.1 : Math.max(0.02, FADE_OUT * 0.35);
    s.power += (s.target - s.power) * (reduced ? 1 : 1 - Math.exp(-dt / span));

    const settled =
      Math.abs(s.tx - s.x) < 0.1 && Math.abs(s.ty - s.y) < 0.1 && Math.abs(s.target - s.power) < 0.002;
    if (settled) {
      s.power = s.target;
      last = 0;
    }
    write(grid);
    if (!settled) raf = requestAnimationFrame(frame);
  };

  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  /** Each shot's offset inside the grid, in the grid's own pixels. */
  const place = (g: HTMLElement) => {
    const box = g.getBoundingClientRect();
    const k = box.width / (g.offsetWidth || 1) || 1;
    g.querySelectorAll<HTMLElement>('.shot').forEach((shot) => {
      const r = shot.getBoundingClientRect();
      shot.style.setProperty('--chroma-ox', `${(r.left - box.left) / k}px`);
      shot.style.setProperty('--chroma-oy', `${(r.top - box.top) / k}px`);
    });
  };

  const onMove = (e: PointerEvent) => {
    const hit = e.target instanceof Element ? e.target.closest<HTMLElement>('.shots') : null;
    if (hit && hit !== grid) {
      if (grid) grid.style.setProperty('--chroma-power', '0');
      grid = hit;
      s.power = 0;
      place(hit);
    }
    if (!hit) {
      s.target = 0;
      wake();
      return;
    }
    const box = hit.getBoundingClientRect();
    const k = box.width / (hit.offsetWidth || 1) || 1;
    s.tx = (e.clientX - box.left) / k;
    s.ty = (e.clientY - box.top) / k;
    // Arriving fresh: start the light under the pointer rather than sliding in.
    if (s.power < 0.02) {
      s.x = s.tx;
      s.y = s.ty;
    }
    s.target = 1;
    wake();
  };

  const onLeave = () => {
    s.target = 0;
    wake();
  };

  layer.addEventListener('pointermove', onMove);
  layer.addEventListener('pointerdown', onMove);
  layer.addEventListener('pointerleave', onLeave);
  layer.addEventListener('pointercancel', onLeave);
}
