import sheetUrl from './samurai.png';
import data from './samurai.json';

/**
 * The samurai, as exported from art/samurai.aseprite by `npm run art:samurai`
 * (see tools/samurai). The sheet is packed and trimmed; each row of
 * samurai.json places one frame back in its full-size cell and carries what
 * the effects need to know about it: how far along the dash it is, where the
 * blade is, and where the scabbard mouth is.
 */

export const SPRITE_W: number = data.w;
export const SPRITE_H: number = data.h;
export const FRAME_MS: number = data.frameMs;
export const FRAMES: number = data.frames.length;
/** Visual centre of the figure, for placing him on screen. */
export const FIGURE: { x: number; y: number } = data.figure;

// Row layout: sheet x, y, w, h, offset x, y, dash, tsuba x, y, tip x, y, visible, koiguchi x, y.
const ROWS = data.frames as number[][];

export interface Blade {
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  visible: boolean;
  mx: number;
  my: number;
}

export function frameAt(m: number): number {
  return Math.max(0, Math.min(FRAMES - 1, Math.floor(m / FRAME_MS)));
}

export function bladeAt(f: number): Blade | undefined {
  const r = ROWS[f];
  if (!r) return undefined;
  return { gx: r[7]!, gy: r[8]!, tx: r[9]!, ty: r[10]!, visible: r[11] === 1, mx: r[12]!, my: r[13]! };
}

/** Progress along the dash, 0 at the start mark and 1 at the far one. */
export function dashAt(f: number): number {
  return ROWS[Math.max(0, Math.min(FRAMES - 1, f))]![6]!;
}

export interface Lit {
  x: number;
  y: number;
  hex: string;
}

export interface Atlas {
  readonly done: boolean;
  readonly failed: boolean;
  /** Draw frame `f` with its cell's top-left at (x, y). `ghost` draws it as a flat red silhouette. */
  draw(ctx: CanvasRenderingContext2D, f: number, x: number, y: number, ghost?: boolean): void;
  /** Frame 0's pixels for the reveal: white highlights first, in a stable shuffled order, then the rest. */
  reveal(): Lit[];
}

export function loadAtlas(): Atlas {
  const img = new Image();
  let ghost: HTMLCanvasElement | null = null;
  let done = false;
  let failed = false;
  let lit: Lit[] | null = null;

  img.onload = () => {
    // The afterimages are the same sheet flooded with red, built once.
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#e50924';
      ctx.fillRect(0, 0, c.width, c.height);
      ghost = c;
    }
    done = true;
  };
  img.onerror = () => {
    failed = true;
  };
  img.src = sheetUrl;

  return {
    get done() {
      return done;
    },
    get failed() {
      return failed;
    },
    draw(ctx, f, x, y, asGhost = false) {
      const r = ROWS[f];
      const src = asGhost ? ghost : img;
      if (!done || !r || !src) return;
      ctx.drawImage(src, r[0]!, r[1]!, r[2]!, r[3]!, x + r[4]!, y + r[5]!, r[2]!, r[3]!);
    },
    reveal() {
      if (lit) return lit;
      if (!done) return [];
      const c = document.createElement('canvas');
      c.width = SPRITE_W;
      c.height = SPRITE_H;
      const ctx = c.getContext('2d');
      if (!ctx) return (lit = []);
      this.draw(ctx, 0, 0, 0);
      const px = ctx.getImageData(0, 0, SPRITE_W, SPRITE_H).data;
      const lights: Lit[] = [];
      const mass: Lit[] = [];
      for (let i = 0; i < SPRITE_W * SPRITE_H; i++) {
        if (px[i * 4 + 3]! < 128) continue;
        const r = px[i * 4]!;
        const g = px[i * 4 + 1]!;
        const b = px[i * 4 + 2]!;
        const p = { x: i % SPRITE_W, y: Math.floor(i / SPRITE_W), hex: `rgb(${r},${g},${b})` };
        (r > 200 && g > 200 ? lights : mass).push(p);
      }
      let seed = 0x9e3779b9;
      const shuffle = (list: Lit[]) => {
        for (let i = list.length - 1; i > 0; i--) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const j = seed % (i + 1);
          const tmp = list[i]!;
          list[i] = list[j]!;
          list[j] = tmp;
        }
      };
      shuffle(lights);
      shuffle(mass);
      return (lit = [...lights, ...mass]);
    },
  };
}
