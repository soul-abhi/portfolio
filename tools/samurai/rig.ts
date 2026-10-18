/**
 * Generator for the intro samurai. Never shipped: build.ts runs it, hands the
 * frames to Aseprite, and from then on the art lives in art/samurai.aseprite.
 *
 * A small skeleton - hip, chest, head, two-bone IK arms and legs, a scabbard
 * on the left hip - is posed through the key() calls below and rasterised into
 * palette-indexed layers. The sword is locked to the scabbard's axis until the
 * blade clears the mouth, so it can never appear in his hand from nowhere, and
 * it is locked back onto that axis to be sheathed.
 *
 * Facing is a mirror applied at the pixel, before rim lighting, so the key
 * light stays upper-right whichever way he faces. The dash is not baked into
 * the frames: each frame records how far along the dash it is and the intro
 * moves the sprite across the screen by a viewport-sized distance. The scarf
 * and the trailing cloth are simulated against a nominal dash so they react to
 * it.
 */

export const W = 144;
export const H = 112;
export const CX = 72;
const HIP_Y = 80;
const GROUND = 104;
const BLADE_LEN = 34;
const SAYA_LEN = BLADE_LEN + 3;
export const FRAME_MS = 1000 / 60;
export const MOTION_MS = 1700;
export const FRAMES = Math.ceil(MOTION_MS / FRAME_MS) + 1;
/** Dash length the secondary motion is simulated against, in sprite pixels. */
const DASH_PX = 64;
/** Visual centre of the figure at rest, for placing him on screen. */
export const FIGURE = { x: CX + 2, y: 68 };

/**
 * Black, white and blood red, nothing else. The greys are tints of the black
 * and white, used only where armour needs a second value to read as form.
 */
export const INK_HEX: readonly string[] = [
  '#00000000', // 0  empty
  '#000000', // 1  void: hakama, the deepest cloth
  '#0e0e0e', // 2  plate: armour base
  '#1d1d1d', // 3  lit plate, facing the key light
  '#2e2e2e', // 4  seam
  '#4a4a4a', // 5  steel: tsuba, kashira, koiguchi
  '#c9c9c9', // 6  spine of the blade
  '#f5f5f5', // 7  white
  '#ffffff', // 8  cutting-edge highlight
  '#5a0712', // 9  deep red
  '#e50924', // 10 blood red
];

const EMPTY = 0;
const VOID = 1;
const PLATE = 2;
const LIT = 3;
const SEAM = 4;
const STEEL = 5;
const SPINE = 6;
const WHITE = 7;
const BRIGHT = 8;
const DEEP = 9;
const RED = 10;

export const LAYERS = ['scarf', 'back', 'body', 'arm', 'katana', 'fx'] as const;

// ---------------------------------------------------------------------------
// Raster target
// ---------------------------------------------------------------------------

type Grid = Uint8Array;

const newGrid = (): Grid => new Uint8Array(W * H);
const idx = (x: number, y: number) => y * W + x;

/** Which way the frame being drawn faces. Applied here, at the pixel. */
let face = 1;

const mirror = (x: number) => (face < 0 ? 2 * CX - x : x);

function put(g: Grid, x: number, y: number, code: number): void {
  const xi = Math.round(mirror(x));
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  g[idx(xi, yi)] = code;
}

function polyFill(g: Grid, pts: Pt[], code: number): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(H - 1, Math.ceil(maxY));

  for (let y = y0; y <= y1; y++) {
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i]!;
      const b = pts[j]!;
      if (a.y <= y && b.y > y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      else if (b.y <= y && a.y > y) xs.push(b.x + ((y - b.y) / (a.y - b.y)) * (a.x - b.x));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.round(xs[k]!);
      const xb = Math.round(xs[k + 1]!);
      for (let x = xa; x <= xb; x++) put(g, x, y, code);
    }
  }
}

function capsule(g: Grid, a: Pt, b: Pt, r: number, code: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    for (let k = -r; k <= r; k += 0.5) put(g, cx + px * k, cy + py * k, code);
  }
}

/** A capsule whose radius runs from `ra` at `a` to `rb` at `b`. */
function taper(g: Grid, a: Pt, b: Pt, ra: number, rb: number, code: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = ra + (rb - ra) * t;
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    for (let k = -r; k <= r; k += 0.5) put(g, cx + px * k, cy + py * k, code);
  }
}

function disc(g: Grid, c: Pt, r: number, code: number): void {
  for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++) {
    for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++) {
      if ((x - c.x) ** 2 + (y - c.y) ** 2 <= r * r) put(g, x, y, code);
    }
  }
}

/**
 * Rim lighting instead of an outline, computed on the mirrored grid so the
 * light never turns with him. One key light from the upper right puts white
 * on edges that face up, steel on edges facing right, and a thin deep-red
 * back light on edges facing left. Below `dimBelow` the right rim drops to
 * `dimCode`, which keeps the hakama from reading as a white-outlined cutout.
 */
function rim(g: Grid, up: number, right: number, left: number, dimBelow = Infinity, dimCode = EMPTY): void {
  const src = g.slice();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (src[i] === EMPTY) continue;
      const upE = y === 0 || src[i - W] === EMPTY;
      const rtE = x === W - 1 || src[i + 1] === EMPTY;
      const lfE = x === 0 || src[i - 1] === EMPTY;
      let c = EMPTY;
      if (upE && up) c = up;
      else if (rtE && right) c = y > dimBelow && dimCode ? dimCode : right;
      else if (lfE && left) c = left;
      if (c) g[i] = c;
    }
  }
}

function over(dst: Grid, src: Grid): void {
  for (let i = 0; i < dst.length; i++) {
    const c = src[i]!;
    if (c !== EMPTY) dst[i] = c;
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;

function at(origin: Pt, angle: number, dist: number): Pt {
  return { x: origin.x + Math.cos(angle) * dist, y: origin.y + Math.sin(angle) * dist };
}

function frame(origin: Pt, angle: number, local: [number, number][]): Pt[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return local.map(([lx, ly]) => ({ x: origin.x + lx * c - ly * s, y: origin.y + lx * s + ly * c }));
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Two-bone IK. `flip` picks which way the joint bends. */
function ik(a: Pt, b: Pt, l1: number, l2: number, flip: number): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const raw = Math.hypot(dx, dy) || 0.001;
  const d = Math.min(raw, l1 + l2 - 0.001);
  const ux = dx / raw;
  const uy = dy / raw;
  const m = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - m * m));
  return { x: a.x + ux * m - uy * h * flip, y: a.y + uy * m + ux * h * flip };
}

// ---------------------------------------------------------------------------
// Choreography
// ---------------------------------------------------------------------------

interface Pose {
  lean: number;
  crouch: number;
  hipX: number;
  head: number;
  /** Feet: x offset from the centre line, and lift off the ground. */
  bf: number;
  bfl: number;
  ff: number;
  ffl: number;
  /** Right hand: 0 at rest by the thigh, 1 on the tsuka. */
  reach: number;
  /** Left hand: 0 at rest, 1 on the koiguchi steadying the scabbard. */
  onSaya: number;
  /** Left hand joins the grip for the two-handed cuts. */
  twoHand: number;
  /** How far the blade has left the scabbard, 0..1 of its length. */
  draw: number;
  /** 0 = sword locked to the scabbard axis, 1 = free in the hands. */
  free: number;
  /** Grip position relative to the chest, once the sword is free. */
  gx: number;
  gy: number;
  /** Blade direction once free, in degrees, unwrapped so a lerp follows the real arc. */
  sword: number;
  /** Apparent blade length while it swings across the body, 0..1. */
  fore: number;
  sayaAng: number;
  /** Saya-biki: the left hand pulling the scabbard back to help the draw. */
  sayaPull: number;
  /** Progress along the dash, 0 at the start mark, 1 at the far one. */
  dash: number;
  /** +1 faces right, -1 faces left; the sign is what counts. */
  face: number;
  /** Skid dust and chiburi drops: 0 not yet, 0..1 in flight, 1 gone. */
  dust: number;
  drops: number;
}

type Ease = (t: number) => number;

const lin: Ease = (t) => t;
const inOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out3: Ease = (t) => 1 - Math.pow(1 - t, 3);
const in3: Ease = (t) => t * t * t;

interface Key {
  m: number;
  ease: Ease;
  p: Pose;
}

const KEYS: Key[] = [];
let cursor: Pose = {
  lean: 0,
  crouch: 0,
  hipX: 0,
  head: 0,
  bf: -9,
  bfl: 0,
  ff: 8,
  ffl: 0,
  reach: 0,
  onSaya: 1,
  twoHand: 0,
  draw: 0,
  free: 0,
  gx: 20,
  gy: 6,
  sword: 160,
  fore: 1,
  sayaAng: 160,
  sayaPull: 0,
  dash: 0,
  face: 1,
  dust: 0,
  drops: 0,
};

/**
 * Each key inherits everything it does not change from the key before it.
 * A key's easing governs the segment that STARTS at it.
 */
function key(m: number, ease: Ease, change: Partial<Pose>): void {
  cursor = { ...cursor, ...change };
  KEYS.push({ m, ease, p: cursor });
}

// Stillness. Upright, left hand on the scabbard, blade sheathed.
key(0, inOut, {});
// The right hand settles on the tsuka.
key(160, inOut, { reach: 1, lean: 3, crouch: 1, head: 2 });
// Koiguchi o kiru: the thumb breaks the seal and a sliver of steel shows.
key(230, out3, { draw: 0.07 });
key(280, out3, {});
// The coil: weight drops onto the front leg, the back leg stretches out, and
// he folds forward over the hilt. It sinks fast and settles slowly.
key(400, in3, { lean: 22, crouch: 9, hipX: -3, head: 6, bf: -17, ff: 9, sayaPull: 3, sayaAng: 165 });
key(440, in3, { lean: 24, crouch: 10, sayaPull: 4 });
// Release. The dash and the draw are one motion: the blade leaves the
// scabbard while the body is already travelling, the left hand hauling the
// scabbard back to meet it.
key(475, lin, {
  dash: 0.45, lean: 30, crouch: 8, hipX: 6, head: 8,
  bf: -22, bfl: 2, ff: 16, ffl: 4, draw: 1, sayaPull: 10, sayaAng: 150,
});
// Nukitsuke: clear of the mouth, the blade swings under and up across the body.
key(505, lin, {
  dash: 0.8, free: 1, sword: 95, fore: 0.72, gx: 14, gy: 14,
  lean: 28, crouch: 9, bf: -26, bfl: 0, ff: 20, ffl: 0,
});
key(540, out3, {
  dash: 1, sword: -28, fore: 1, gx: 21, gy: -6,
  lean: 14, crouch: 7, hipX: 8, head: 4, bf: -24, ff: 22, sayaPull: 6, dust: 0.02,
});
// The skid: he overshoots his mark, dust kicking off the front foot, and the
// blade rides on past the cut before the body absorbs the stop.
key(620, inOut, { dash: 1.04, sword: -40, gx: 19, gy: -10, lean: 6, crouch: 8, hipX: 4, bf: -20, ff: 18, dust: 0.5 });
key(690, inOut, { dash: 1, sword: -30, lean: 4, crouch: 6, dust: 0.75 });
// The turn: both hands take the grip and the blade comes straight up. He
// pivots at the instant it is vertical, when the silhouette is symmetric.
key(758, lin, {
  face: 1, sword: -90, gx: 1, gy: -17, twoHand: 1, onSaya: 0,
  hipX: 0, lean: -4, crouch: 7, head: -2, bf: -8, ff: 8, dust: 0.95,
});
key(762, inOut, { face: -1, dust: 1 });
// Jodan, wound over the shoulder. A breath.
key(820, in3, { sword: -125, gx: -3, gy: -17, lean: -10, crouch: 8, head: -4, bf: -10, ff: 10 });
key(840, in3, { sword: -128 });
// Kesa-giri: down through the diagonal with a step into it, accelerating
// into contact.
key(880, out3, { sword: 34, gx: 20, gy: 10, lean: 24, crouch: 10, hipX: 6, head: 8, bf: -18, ff: 18, dash: 0.86 });
key(940, inOut, { sword: 40, gx: 18, gy: 13, lean: 26, crouch: 11, dash: 0.84 });
// The left hand goes back to the scabbard.
key(1000, inOut, { twoHand: 0, onSaya: 1, sword: 44, gx: 18, gy: 12, lean: 16, crouch: 9 });
// Chiburi: the blade is lifted, then snapped out and down to throw it clean.
key(1080, in3, { sword: -20, gx: 19, gy: -6, lean: 6, crouch: 7, head: 2 });
key(1115, out3, { sword: 50, gx: 22, gy: 8, drops: 0.05 });
key(1200, inOut, { sword: 45, gx: 22, gy: 9, drops: 1 });
// Noto: the blade is brought back onto the scabbard's axis, slid home slowly,
// and the last few centimetres go in with a snap. The screen breaks on it.
key(1290, inOut, { free: 0, lean: 8, crouch: 6, head: 3, sayaPull: 6, sayaAng: 152 });
key(1400, in3, { draw: 0.15, sayaPull: 2 });
key(1430, out3, { draw: 0, sayaPull: 0, lean: 4, crouch: 4 });
key(1560, inOut, { lean: 2, crouch: 2, head: 0, sayaAng: 160 });
key(MOTION_MS, lin, { crouch: 1 });

function poseAt(m: number): Pose {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1]!.m <= m) i++;
  const a = KEYS[i]!;
  const b = KEYS[i + 1] ?? a;
  const span = b.m - a.m || 1;
  const t = a.ease(Math.min(1, Math.max(0, (m - a.m) / span)));
  const out = { ...a.p };
  for (const k of Object.keys(out) as (keyof Pose)[]) out[k] = a.p[k] + (b.p[k] - a.p[k]) * t;
  return out;
}

/** Named stretches of the timeline, as Aseprite tags. */
export const TAGS: readonly { name: string; from: number; to: number }[] = [
  { name: 'ready', from: 0, to: 280 },
  { name: 'coil', from: 280, to: 440 },
  { name: 'nukitsuke', from: 440, to: 560 },
  { name: 'skid', from: 560, to: 700 },
  { name: 'turn', from: 700, to: 840 },
  { name: 'kesa', from: 840, to: 960 },
  { name: 'chiburi', from: 960, to: 1200 },
  { name: 'noto', from: 1200, to: 1440 },
  { name: 'hold', from: 1440, to: MOTION_MS },
];

// ---------------------------------------------------------------------------
// Secondary motion: the scarf
// ---------------------------------------------------------------------------

interface Tail {
  x: Float64Array;
  y: Float64Array;
  px: Float64Array;
  py: Float64Array;
  seg: number;
}

function newTail(n: number, seg: number, anchor: Pt): Tail {
  const t: Tail = {
    x: new Float64Array(n),
    y: new Float64Array(n),
    px: new Float64Array(n),
    py: new Float64Array(n),
    seg,
  };
  for (let i = 0; i < n; i++) {
    t.x[i] = t.px[i] = anchor.x - i * seg;
    t.y[i] = t.py[i] = anchor.y;
  }
  return t;
}

/**
 * Verlet with follow-the-leader constraints, in world space. A light breeze
 * keeps it alive while he stands; the dash does the rest.
 */
function stepTail(t: Tail, anchor: Pt, m: number, stiff: number): void {
  const n = t.x.length;
  // Art over physics: the breeze always streams it behind him, so the turn
  // whips it round instead of laying it across his face.
  const breeze = -face * (0.07 + 0.04 * Math.sin(m * 0.011));
  for (let i = 1; i < n; i++) {
    const vx = (t.x[i]! - t.px[i]!) * 0.9;
    const vy = (t.y[i]! - t.py[i]!) * 0.9;
    t.px[i] = t.x[i]!;
    t.py[i] = t.y[i]!;
    t.x[i] = t.x[i]! + vx + breeze * (i / n);
    t.y[i] = t.y[i]! + vy + 0.11 - stiff * 0.02 * (n - i);
  }
  t.x[0] = t.px[0] = anchor.x;
  t.y[0] = t.py[0] = anchor.y;
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 1; i < n; i++) {
      const dx = t.x[i]! - t.x[i - 1]!;
      const dy = t.y[i]! - t.y[i - 1]!;
      const d = Math.hypot(dx, dy) || 1;
      t.x[i] = t.x[i - 1]! + (dx / d) * t.seg;
      t.y[i] = Math.min(GROUND - 1, t.y[i - 1]! + (dy / d) * t.seg);
    }
  }
}

// ---------------------------------------------------------------------------
// Shapes, in their owning joint's local space. +x faces forward, -y is up.
// ---------------------------------------------------------------------------

type Shape = [number, number][];

const TORSO: Shape = [[-8, -22], [7, -22], [9, -15], [8, -7], [7, -1], [-7, -1], [-8, -9]];
const CHEST_LIGHT: Shape = [[1, -20], [6, -20], [7, -14], [2, -12]];
const SODE: Shape = [[-5, -1], [5, -1], [7, 11], [-4, 11]];
const SHIKORO: Shape = [[-6, -1], [-1, 2], [-3, 7], [-12, 8], [-13, 4]];
const SHIKORO_2: Shape = [[-7, 5], [-2, 8], [-4, 12], [-14, 11], [-15, 8]];
const BRIM: Shape = [[-2, -3], [12, -5], [14, 0], [1, 2]];
const FUKIGAESHI: Shape = [[-1, -1], [-6, -6], [-7, 1], [-3, 3]];
const MENPO: Shape = [[2, 1], [10, 1], [9, 9], [1, 10]];
const THROAT: Shape = [[-3, 7], [8, 8], [7, 14], [-4, 13]];
const FOOT: Shape = [[-3, -2], [5, -2], [6, 0], [-3, 0]];

export interface Blade {
  /** Tsuba and tip, in sprite pixels. */
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  visible: boolean;
  /** The koiguchi, where the seal is broken before the draw. */
  mx: number;
  my: number;
}

export interface Frame {
  layers: Grid[];
  blade: Blade;
  dash: number;
}

interface Ctx {
  scarfA: Tail;
  scarfB: Tail;
  prevDash: number;
}

function buildFrame(m: number, sim: Ctx): Frame {
  const p = poseAt(m);
  face = p.face >= 0 ? 1 : -1;
  const lean = p.lean * RAD;
  // Forward speed in sprite px per frame, in his own facing.
  const vel = (p.dash - sim.prevDash) * DASH_PX * face;
  sim.prevDash = p.dash;

  const hip: Pt = { x: CX + p.hipX, y: HIP_Y + p.crouch };
  const up = -Math.PI / 2 + lean;
  const chest = at(hip, up, 21);
  const hAng = lean + p.head * RAD;
  const headC = at(chest, up + p.head * RAD * 0.3, 15);
  const shoulderNear = frame(chest, lean, [[4, 2]])[0]!;
  const shoulderFar = frame(chest, lean, [[-5, 3]])[0]!;

  // ---- scabbard ----
  const sAng = p.sayaAng * RAD;
  const sDir: Pt = { x: Math.cos(sAng), y: Math.sin(sAng) };
  const mouthBase = frame(hip, lean * 0.3, [[6, -4]])[0]!;
  const mouth: Pt = { x: mouthBase.x + sDir.x * p.sayaPull, y: mouthBase.y + sDir.y * p.sayaPull };
  const kojiri: Pt = { x: mouth.x + sDir.x * SAYA_LEN, y: mouth.y + sDir.y * SAYA_LEN };

  // ---- sword: locked to the scabbard axis until clear, then free ----
  const d = p.draw * BLADE_LEN;
  const gripLocked: Pt = { x: mouth.x - sDir.x * (d + 5), y: mouth.y - sDir.y * (d + 5) };
  const gripFree: Pt = { x: chest.x + p.gx, y: chest.y + p.gy };
  const grip = lerpPt(gripLocked, gripFree, p.free);
  const swordAng = (p.sayaAng + (p.sword - p.sayaAng) * p.free) * RAD;
  const bladeLen = (d + (BLADE_LEN - d) * p.free) * (1 + (p.fore - 1) * p.free);
  const u: Pt = { x: Math.cos(swordAng), y: Math.sin(swordAng) };

  // ---- hands ----
  const restNear: Pt = { x: hip.x + 8, y: hip.y - 1 };
  const restFar: Pt = { x: hip.x - 5, y: hip.y - 2 };
  const nearHand = lerpPt(restNear, grip, p.reach);
  const grip2: Pt = { x: grip.x - u.x * 4.5, y: grip.y - u.y * 4.5 };
  const sayaHand: Pt = { x: mouth.x + sDir.x * 3, y: mouth.y + sDir.y * 3 };
  const farHand = lerpPt(lerpPt(restFar, sayaHand, p.onSaya), grip2, p.twoHand);
  const nearElbow = ik(shoulderNear, nearHand, 11, 11, 1);
  const farElbow = ik(shoulderFar, farHand, 11, 11, 1);

  // ---- scarf: simulated in world space, drawn back in his own ----
  const rootX = p.dash * DASH_PX;
  const knot = frame(headC, hAng, [[-8, 3]])[0]!;
  const knotW: Pt = { x: mirror(knot.x) + rootX, y: knot.y };
  stepTail(sim.scarfA, knotW, m, 0);
  stepTail(sim.scarfB, { x: knotW.x, y: knotW.y + 1 }, m, 0.3);
  const scarf = newGrid();
  drawTail(scarf, sim.scarfB, rootX, knot.x, 1.3, DEEP);
  drawTail(scarf, sim.scarfA, rootX, knot.x, 1.7, RED);
  disc(scarf, knot, 1.6, RED);

  // ---- back layer: the scabbard, then the far arm in shadow ----
  const back = newGrid();
  drawSaya(back, mouth, kojiri, sDir);
  const farArm = newGrid();
  capsule(farArm, shoulderFar, farElbow, 2.4, PLATE);
  capsule(farArm, farElbow, farHand, 2, PLATE);
  disc(farArm, farHand, 1.9, PLATE);
  rim(farArm, SEAM, SEAM, DEEP);
  over(back, farArm);

  // ---- body ----
  const body = newGrid();
  const backFoot: Pt = { x: CX + p.bf, y: GROUND - p.bfl };
  const frontFoot: Pt = { x: CX + p.ff, y: GROUND - p.ffl };
  const backKnee = ik(hip, backFoot, 13, 13, -1);
  const frontKnee = ik(hip, frontFoot, 13, 13, 1);
  // Cloth trails the motion: the faster he goes, the further the hems stream.
  const trail = Math.min(6, Math.max(0, vel) * 0.8);
  hakamaLeg(body, hip, backKnee, backFoot, trail);
  hakamaLeg(body, hip, frontKnee, frontFoot, trail * 0.6);
  polyFill(body, frame(backFoot, 0, FOOT), PLATE);
  polyFill(body, frame(frontFoot, 0, FOOT), PLATE);
  polyFill(
    body,
    frame(hip, lean * 0.35, [[-10, -4], [9, -4], [12, 8], [-12 - trail * 0.5, 9]]),
    VOID,
  );
  polyFill(body, frame(hip, lean, TORSO), PLATE);
  polyFill(body, frame(hip, lean, CHEST_LIGHT), LIT);
  // Kusazuri: three tassets hanging from the waist, swinging back in the dash.
  for (const [x, w] of [[-10, 7], [-3, 7], [4, 7]] as [number, number][]) {
    const a = lean * 0.35 + (-vel * 2.2 - (x < 0 ? 2 : 0)) * RAD;
    const top = frame(hip, lean * 0.35, [[x + w / 2, -2]])[0]!;
    polyFill(body, frame(top, a, [[-w / 2, 0], [w / 2, 0], [w / 2 + 1, 10], [-w / 2 - 1, 10]]), PLATE);
  }
  capsule(body, chest, at(chest, up, 6), 2.2, VOID);
  disc(body, headC, 8.5, PLATE);
  polyFill(body, frame(headC, hAng, SHIKORO_2), PLATE);
  polyFill(body, frame(headC, hAng, SHIKORO), PLATE);
  polyFill(body, frame(headC, hAng, BRIM), PLATE);
  polyFill(body, frame(headC, hAng, FUKIGAESHI), PLATE);
  polyFill(body, frame(headC, hAng, THROAT), PLATE);
  polyFill(body, frame(headC, hAng, MENPO), VOID);
  rim(body, WHITE, STEEL, DEEP, hip.y + 3, SEAM);
  bodyDetail(body, hip, lean, headC, hAng);
  drawSode(body, shoulderFar, farElbow, lean, PLATE, false);

  // ---- near arm, with its own rim so it separates from the torso ----
  const arm = newGrid();
  capsule(arm, shoulderNear, nearElbow, 2.6, PLATE);
  capsule(arm, nearElbow, nearHand, 2.1, PLATE);
  disc(arm, nearHand, 2, PLATE);
  drawSode(arm, shoulderNear, nearElbow, lean, LIT, true);
  rim(arm, WHITE, STEEL, DEEP);
  armDetail(arm, shoulderNear, nearElbow, lean);

  // ---- the sword, over everything ----
  const top = newGrid();
  const blade = drawSword(top, grip, u, bladeLen, p.free > 0.5 || p.draw > 0.999 ? bladeLen : BLADE_LEN);
  disc(top, mouth, 1.5, STEEL);
  if (p.reach > 0.6) {
    disc(top, nearHand, 1.8, PLATE);
    put(top, nearHand.x, nearHand.y - 1.6, WHITE);
  }
  if (p.twoHand > 0.6) {
    disc(top, farHand, 1.7, PLATE);
    put(top, farHand.x, farHand.y - 1.5, LIT);
  }
  // A sliver of steel at the mouth once the seal is broken.
  if (p.draw > 0.03 && p.draw < 0.5 && p.free < 0.5) {
    const s = { x: mouth.x - sDir.x * 1.5, y: mouth.y - sDir.y * 1.5 };
    put(top, s.x, s.y, BRIGHT);
    put(top, s.x - sDir.x, s.y - sDir.y, WHITE);
  }

  // ---- fx: skid dust and the thrown drops ----
  const fx = newGrid();
  if (p.dust > 0 && p.dust < 1) drawDust(fx, frontFoot, p.dust);
  if (p.drops > 0 && p.drops < 1 && blade.visible) drawDrops(fx, grip, u, bladeLen, p.drops);

  return {
    layers: [scarf, back, body, arm, top, fx],
    blade: {
      gx: mirror(blade.gx),
      gy: blade.gy,
      tx: mirror(blade.tx),
      ty: blade.ty,
      visible: blade.visible,
      mx: mirror(mouth.x),
      my: mouth.y,
    },
    dash: p.dash,
  };
}

function drawTail(g: Grid, t: Tail, rootX: number, knotX: number, r0: number, code: number): void {
  const n = t.x.length;
  // Back from world space into his own; put() mirrors it out again. It never
  // streams ahead of the knot, where it would cross his face.
  const lx = (x: number) => Math.min(knotX + 1, mirror(x - rootX));
  for (let i = 1; i < n; i++) {
    const a = { x: lx(t.x[i - 1]!), y: t.y[i - 1]! };
    const b = { x: lx(t.x[i]!), y: t.y[i]! };
    const k = i / n;
    taper(g, a, b, r0 * (1 - k * 0.7), r0 * (1 - (k + 1 / n) * 0.7), code);
  }
}

/** One hakama leg: a thigh, and a shin that widens to a pleated hem. */
function hakamaLeg(g: Grid, hip: Pt, knee: Pt, foot: Pt, trail: number): void {
  capsule(g, hip, knee, 3.8, VOID);
  const hem = lerpPt(knee, foot, 0.86);
  const dx = hem.x - knee.x;
  const dy = hem.y - knee.y;
  const l = Math.hypot(dx, dy) || 1;
  const n: Pt = { x: -dy / l, y: dx / l };
  // n points to the back of a leg that hangs down.
  const backSide = n.x <= 0 ? 1 : -1;
  const wb = 5 + trail;
  const wf = 4.2;
  polyFill(g, [
    { x: knee.x + n.x * 3.4, y: knee.y + n.y * 3.4 },
    { x: knee.x - n.x * 3.4, y: knee.y - n.y * 3.4 },
    { x: hem.x - n.x * (backSide > 0 ? wf : wb), y: hem.y - n.y * (backSide > 0 ? wf : wb) },
    { x: hem.x + n.x * (backSide > 0 ? wb : wf), y: hem.y + n.y * (backSide > 0 ? wb : wf) + (trail > 1 ? -trail * 0.35 : 0) },
  ], VOID);
  capsule(g, knee, hem, 0.4, SEAM);
}

function drawSode(g: Grid, shoulder: Pt, elbow: Pt, lean: number, code: number, laced: boolean): void {
  const armAng = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x);
  const rest = Math.PI / 2 + lean;
  const swing = Math.max(-1, Math.min(1, (armAng - rest) * 0.45));
  const a = lean + swing;
  polyFill(g, frame(shoulder, a, SODE), code);
  if (!laced) return;
  for (const y of [2, 5, 8]) {
    const s = frame(shoulder, a, [[-4, y], [6, y + 0.5]]);
    capsule(g, s[0]!, s[1]!, 0.45, SEAM);
  }
}

function drawSaya(g: Grid, mouth: Pt, kojiri: Pt, dir: Pt): void {
  const n: Pt = { x: -dir.y, y: dir.x };
  const upN: Pt = n.y > 0 ? { x: -n.x, y: -n.y } : n;
  capsule(g, mouth, kojiri, 1.6, PLATE);
  capsule(g, mouth, kojiri, 0.6, LIT);
  // One line of light along the top edge, so the lacquer reads as a tube.
  capsule(
    g,
    { x: mouth.x + upN.x * 1.6, y: mouth.y + upN.y * 1.6 },
    { x: kojiri.x + upN.x * 1.6, y: kojiri.y + upN.y * 1.6 },
    0.4,
    STEEL,
  );
  for (const t of [0.3, 0.58]) {
    const c = lerpPt(mouth, kojiri, t);
    capsule(g, { x: c.x - n.x * 1.8, y: c.y - n.y * 1.8 }, { x: c.x + n.x * 1.8, y: c.y + n.y * 1.8 }, 0.9, RED);
  }
  disc(g, kojiri, 1.5, STEEL);
  // Sageo: the cord tying the scabbard to the obi, hanging slack.
  const s0 = lerpPt(mouth, kojiri, 0.14);
  capsule(g, s0, { x: s0.x - 1.5, y: s0.y + 6 }, 0.45, DEEP);
}

/** `tipAt` is where the kissaki is: past the visible length while the rest is still in the scabbard. */
function drawSword(g: Grid, grip: Pt, u: Pt, len: number, tipAt: number): Blade {
  const n: Pt = { x: -u.y, y: u.x };
  const tsuba: Pt = { x: grip.x + u.x * 5, y: grip.y + u.y * 5 };
  const kashira: Pt = { x: grip.x - u.x * 7, y: grip.y - u.y * 7 };

  // Tsuka: black, with the diamond windows of the wrap picked out in deep red.
  capsule(g, kashira, tsuba, 1.25, VOID);
  for (let i = 1; i < 6; i++) {
    const w = lerpPt(kashira, tsuba, i / 6.5);
    put(g, w.x, w.y, DEEP);
  }
  disc(g, kashira, 1.15, STEEL);

  // Blade: spine, body, cutting edge - three runs, so the steel has a bevel.
  // The last four pixels taper to the kissaki.
  if (len > 0.5) {
    const steps = Math.ceil(len * 2.5);
    for (let i = 0; i <= steps; i++) {
      const s = (i / steps) * len;
      const fromTip = tipAt - s;
      if (fromTip < 0.6) continue;
      const half = fromTip < 4 ? fromTip / 4 : 1;
      const c: Pt = { x: tsuba.x + u.x * s, y: tsuba.y + u.y * s };
      put(g, c.x - n.x * half, c.y - n.y * half, SPINE);
      put(g, c.x, c.y, WHITE);
      put(g, c.x + n.x * half, c.y + n.y * half, half >= 0.99 ? BRIGHT : WHITE);
    }
  }

  disc(g, tsuba, 2.2, STEEL);
  put(g, tsuba.x - n.x * 1.6, tsuba.y - n.y * 1.6, WHITE);

  return {
    gx: tsuba.x,
    gy: tsuba.y,
    tx: tsuba.x + u.x * len,
    ty: tsuba.y + u.y * len,
    visible: len > 2,
    mx: 0,
    my: 0,
  };
}

function drawDust(g: Grid, foot: Pt, k: number): void {
  // Puffs kicked back off the planted foot, swelling and thinning as they go.
  for (let i = 0; i < 4; i++) {
    const age = Math.min(1, k * 1.3 - i * 0.12);
    if (age <= 0) continue;
    const c: Pt = { x: foot.x - 4 - i * 6 - age * 8, y: GROUND - 1 - age * (3 + i * 1.5) };
    const r = 1.2 + age * (2.5 + i * 0.4);
    for (let y = Math.floor(c.y - r); y <= Math.ceil(c.y + r); y++) {
      for (let x = Math.floor(c.x - r); x <= Math.ceil(c.x + r); x++) {
        const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
        if (d2 > r * r) continue;
        // Thin out with age on a checker, so the dust dissolves rather than fades.
        if (age > 0.45 && (x + y) % 2 === 0) continue;
        if (age > 0.75 && (x * 3 + y) % 3 !== 0) continue;
        put(g, x, y, y < c.y - r * 0.4 ? STEEL : SEAM);
      }
    }
  }
}

function drawDrops(g: Grid, grip: Pt, u: Pt, len: number, k: number): void {
  const tip: Pt = { x: grip.x + u.x * (len + 5), y: grip.y + u.y * (len + 5) };
  const drops: [number, number][] = [[9, -3], [12, 1], [7, 3], [14, -1]];
  drops.forEach(([vx, vy], i) => {
    const s = k * (1 + i * 0.12);
    const x = tip.x + vx * s * 1.6;
    const y = tip.y + vy * s + 22 * s * s;
    put(g, x, y, RED);
    put(g, x - vx * 0.08, y - (vy + 44 * s) * 0.05, DEEP);
  });
}

/**
 * Armour detail, drawn after the rim pass so it is not eaten by it. The red is
 * rationed: one column of odoshi lacing, the obi, the maedate, the eye, the
 * scarf.
 */
function bodyDetail(g: Grid, hip: Pt, lean: number, headC: Pt, hAng: number): void {
  for (const y of [-18, -14, -10]) {
    const r = frame(hip, lean, [[-7, y], [7, y]]);
    capsule(g, r[0]!, r[1]!, 0.45, SEAM);
  }
  for (const y of [-16, -12, -8]) {
    const q = frame(hip, lean, [[1, y]])[0]!;
    put(g, q.x, q.y, RED);
  }
  const obi = frame(hip, lean, [[-7, -3], [8, -3]]);
  capsule(g, obi[0]!, obi[1]!, 1.2, DEEP);
  const obiKnot = frame(hip, lean, [[-6, -3], [-9, 2]]);
  capsule(g, obiKnot[0]!, obiKnot[1]!, 0.7, RED);

  for (const x of [-7, 0, 6]) {
    const q = frame(hip, lean * 0.35, [[x, 3]])[0]!;
    put(g, q.x, q.y, DEEP);
  }

  // Helmet: rivet line on the bowl, lames on the neck guard.
  const bowl = frame(headC, hAng, [[-6, -5], [-1, -7.5], [4, -6]]);
  capsule(g, bowl[0]!, bowl[1]!, 0.4, SEAM);
  capsule(g, bowl[1]!, bowl[2]!, 0.4, SEAM);
  for (const s of [
    [[-12, 4], [-2, 4]],
    [[-13, 8], [-3, 8.5]],
  ] as Shape[]) {
    const pts = frame(headC, hAng, s);
    capsule(g, pts[0]!, pts[1]!, 0.4, SEAM);
  }
  const crown = frame(headC, hAng, [[-6, -6.5], [1, -8.2]]);
  capsule(g, crown[0]!, crown[1]!, 0.6, LIT);

  // Menpo: a snarl of white teeth and one red eye with a hot pixel in it.
  const teeth = frame(headC, hAng, [[4, 6.5], [8.5, 6.5]]);
  capsule(g, teeth[0]!, teeth[1]!, 0.35, SPINE);
  const eye = frame(headC, hAng, [[4.5, 2.5], [8, 2]]);
  capsule(g, eye[0]!, eye[1]!, 0.5, RED);
  const glint = frame(headC, hAng, [[7.5, 2]])[0]!;
  put(g, glint.x, glint.y, BRIGHT);

  // Maedate: a crescent moon sweeping up off the brow, the silhouette's
  // signature, on a small red sun.
  const mc = frame(headC, hAng, [[3, -15]])[0]!;
  const arc = (deg: number, r: number) => frame(mc, hAng, [[Math.cos(deg * RAD) * r * 1.15, Math.sin(deg * RAD) * r]])[0]!;
  // The lower half of a circle: it sits on the brow and its horns sweep up.
  const from = 20;
  const to = 160;
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a0 = from + ((to - from) * i) / N;
    const a1 = from + ((to - from) * (i + 1)) / N;
    const mid = 1 - Math.abs((i + 0.5) / N - 0.5) * 2;
    capsule(g, arc(a0, 8), arc(a1, 8), 0.3 + mid * 0.7, WHITE);
  }
  disc(g, frame(headC, hAng, [[3, -7]])[0]!, 1.3, RED);
}

function armDetail(g: Grid, shoulder: Pt, elbow: Pt, lean: number): void {
  const armAng = Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x);
  const a = lean + Math.max(-1, Math.min(1, (armAng - (Math.PI / 2 + lean)) * 0.45));
  for (const y of [3.5, 6.5, 9.5]) {
    const q = frame(shoulder, a, [[1, y]])[0]!;
    put(g, q.x, q.y, RED);
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Every frame of the performance, in order, with the scarf simulated through it. */
export function render(): Frame[] {
  const p0 = poseAt(0);
  face = p0.face >= 0 ? 1 : -1;
  const anchor = { x: CX - 8, y: HIP_Y - 36 };
  const sim: Ctx = {
    scarfA: newTail(12, 2.6, anchor),
    scarfB: newTail(10, 2.4, anchor),
    prevDash: 0,
  };
  // Let the scarf settle in the breeze before the first frame is kept.
  for (let i = 0; i < 180; i++) buildFrame(0, sim);
  sim.prevDash = 0;

  const out: Frame[] = [];
  for (let f = 0; f < FRAMES; f++) out.push(buildFrame(f * FRAME_MS, sim));
  return out;
}
