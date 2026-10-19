/**
 * The background dragon: flight cycles generated from a small rig rather than
 * drawn frame by frame, so every pose stays physically consistent and the
 * whole thing can be re-tuned and rebuilt.
 *
 * Four movement sets are baked into one sheet, each a seamless loop:
 *   flap    level flight; the head counters the bob and stays steady
 *   climb   harder strokes, neck raised, tail swinging low
 *   glide   wings held in a shallow V, neck swaying, head looking about
 *   dive    wings swept back and half folded, neck stretched down
 * The runtime (src/layers/dragon.ts) picks between them from the flight path.
 *
 * Look: royal-blue scaled hide, a cream segmented belly from throat to tail,
 * ringed tail, pale horns and teeth, bat wings with pale bones, scalloped
 * trailing edges and a mottled membrane. The base blues and the cyan glow were
 * extracted from the first reference with the pixel plugin's
 * analyze_reference; the belly and membrane ramps follow the second.
 *
 * Volume: the body and limbs are lit as cylinders by a moon above and to the
 * left of the viewer, with ordered dithering between ramp steps so the form
 * turns smoothly instead of banding. The wings are 3D planes: each is a
 * membrane on an arm and four fingers, rotated about the body axis and viewed
 * from slightly above, and its brightness follows its real normal, so a wing
 * catches the moon as it sweeps and darkens as it turns away. The near wing
 * casts a shadow onto the body. Membrane texture lives in the wing's own plan
 * coordinates, so the mottling stays stuck to the wing as it moves.
 */

export const W = 128;
export const H = 104;
/** Rest-pose spine is authored high; this drops it to leave room for the raised wings. */
const DROP = 14;
/** Default frame time, for the .aseprite preview; each set carries its own. */
export const FRAME_MS = 100;

/** Index 0 is transparent. */
export const INK_HEX: readonly string[] = [
  '#00000000',
  '#070c1a', // 1 outline
  '#0d1530', // 2 deepest navy
  '#172a5a', // 3 shadow
  '#1f3f86', // 4 body
  '#2d58a8', // 5 mid
  '#3f6fc4', // 6 scale blue
  '#6f9be0', // 7 highlight
  '#36caf5', // 8 glow
  '#a8eeff', // 9 hot glow
  '#2a3f73', // 10 far membrane
  '#e2dbbd', // 11 belly light
  '#b5ae95', // 12 belly mid
  '#7a7c8e', // 13 belly seam
  '#86a8e2', // 14 membrane light
  '#5578c0', // 15 membrane mid
  '#4366ae', // 16 membrane dark
  '#2f4b8f', // 17 membrane mottle
  '#b4cdf2', // 18 bone
];

/** Hide ramp, dark to light, and the belly's. */
const HIDE = [2, 3, 4, 5, 6, 7];
const BELLY = [13, 12, 11];
const MEMBRANE = [17, 16, 15, 14];
const FAR_MEMBRANE = [2, 3, 10, 16];

export const LAYERS = ['outline', 'wing-far', 'body', 'wing-near', 'glow'] as const;
const L = { outline: 0, far: 1, body: 2, near: 3, glow: 4 } as const;

export interface Frame {
  layers: Uint8Array[];
}

export interface Tag {
  name: string;
  /** 0-based, inclusive. */
  from: number;
  to: number;
  ms: number;
}

type V2 = [number, number];
type V3 = [number, number, number];

/** Camera pitch: seen a little from above, so the near wing drops below the far one. */
const PITCH = (24 * Math.PI) / 180;
/** Moonlight, in view space (x right, y up, z toward the viewer). */
const LIGHT: V3 = norm([-0.35, 0.75, 0.55]);
/** The same light in screen space (y down), for the body. */
const LIGHT_SCREEN: V3 = [LIGHT[0], -LIGHT[1], LIGHT[2]];
/** Flap range in degrees above the horizontal. */
const UP = 64;
const DOWN = -40;
/** Share of the cycle spent on the (faster) downstroke. */
const DOWNSTROKE = 0.42;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const rad = (d: number) => (d * Math.PI) / 180;
const lerp2 = (a: V2, b: V2, k: number): V2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Pick from a ramp by light level 0..1, dithered between neighbouring steps. */
function ramp(r: readonly number[], level: number, x: number, y: number): number {
  const v = clamp01(level) * (r.length - 1);
  const i = Math.floor(v);
  const th = BAYER[(y & 3) * 4 + (x & 3)]! / 16;
  return r[Math.min(r.length - 1, v - i > th ? i + 1 : i)]!;
}

/** Smooth value noise, 0..1, for membrane mottling. */
function noise(x: number, y: number): number {
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = ease(x - xi);
  const fy = ease(y - yi);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * fx;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * fx;
  return a + (b - a) * fy;
}

// --- poses ----------------------------------------------------------------------

/** Everything that varies between movement sets, as functions of loop phase t. */
interface Pose {
  /** Wing elevation (radians) at phase t; the hand and fingers sample it later. */
  wingAt: (t: number) => number;
  spread: (t: number) => number;
  /** Extra sweep-back of the hand, in plan units. */
  sweep: number;
  bob: (t: number) => number;
  /** Neck bend (radians, negative raises) and head pitch on top of it. */
  neck: (t: number) => number;
  head: (t: number) => number;
  tailAmp: number;
  /** Tail droop in pixels at the tip. */
  tailDrop: number;
}

/** Elevation for the powered stroke. Starts at the top. */
function stroke(t: number): number {
  const p = ((t % 1) + 1) % 1;
  if (p < DOWNSTROKE) return rad(UP + (DOWN - UP) * ease(p / DOWNSTROKE));
  return rad(DOWN + (UP - DOWN) * ease((p - DOWNSTROKE) / (1 - DOWNSTROKE)));
}

/** 1 = fully spread; the wing folds partway through the upstroke. */
function strokeSpread(t: number): number {
  const p = ((t % 1) + 1) % 1;
  if (p < DOWNSTROKE) return 1;
  return 1 - 0.4 * Math.sin((Math.PI * (p - DOWNSTROKE)) / (1 - DOWNSTROKE));
}

/** Highest at the end of the downstroke, lowest at the end of the upstroke. */
const strokeBob = (t: number) => -1.6 * Math.sin(2 * Math.PI * (t - DOWNSTROKE / 2 + 0.25) - Math.PI / 2);
const TAU = Math.PI * 2;

const POSES: Record<string, Pose> = {
  flap: {
    wingAt: stroke,
    spread: strokeSpread,
    sweep: 0,
    bob: strokeBob,
    // The neck gives a little against the bob so the head rides level.
    neck: (t) => 0.05 * Math.sin(TAU * t + 0.6),
    head: (t) => -0.05 * Math.sin(TAU * t + 0.6),
    tailAmp: 2.2,
    tailDrop: 0,
  },
  climb: {
    wingAt: (t) => stroke(t) + rad(6),
    spread: strokeSpread,
    sweep: 0,
    bob: (t) => strokeBob(t) * 1.3,
    neck: (t) => -0.3 + 0.05 * Math.sin(TAU * t + 0.6),
    head: () => 0.12,
    tailAmp: 2.8,
    tailDrop: 5,
  },
  glide: {
    // A shallow V, the tips trembling in the air.
    wingAt: (t) => rad(16 + 3 * Math.sin(TAU * t)),
    spread: () => 1,
    sweep: 0,
    bob: (t) => 0.5 * Math.sin(TAU * t),
    // The long neck sways and the head looks about.
    neck: (t) => 0.1 * Math.sin(TAU * t),
    head: (t) => -0.14 * Math.sin(TAU * t + 1.4),
    tailAmp: 1.5,
    tailDrop: 1,
  },
  dive: {
    wingAt: (t) => rad(30 + 4 * Math.sin(TAU * t)),
    spread: () => 0.5,
    sweep: -9,
    bob: () => 0,
    neck: (t) => 0.32 + 0.03 * Math.sin(TAU * t),
    head: () => 0.1,
    tailAmp: 0.8,
    tailDrop: -3,
  },
};

export const SETS: readonly { name: keyof typeof POSES & string; frames: number; ms: number }[] = [
  { name: 'flap', frames: 12, ms: 100 },
  { name: 'climb', frames: 12, ms: 80 },
  { name: 'glide', frames: 12, ms: 130 },
  { name: 'dive', frames: 8, ms: 90 },
];

// --- the body ---------------------------------------------------------------

/** Spine from tail tip to snout, with radius, in the rest pose. */
const SPINE: { p: V2; r: number }[] = [
  { p: [4, 50], r: 0.6 },
  { p: [16, 54], r: 1.4 },
  { p: [30, 53], r: 2.2 },
  { p: [42, 49], r: 3.4 },
  { p: [52, 46], r: 4.8 },
  { p: [62, 46], r: 5.8 },
  { p: [72, 46], r: 5.6 },
  { p: [80, 44], r: 4.6 },
  { p: [87, 40], r: 3.7 },
  { p: [92, 35], r: 3.3 },
  { p: [97, 31], r: 3.5 },
  { p: [104, 30], r: 4.3 },
  { p: [111, 31], r: 3.1 },
  { p: [117, 33], r: 1.7 },
];
/** Where the neck starts to bend, and where the head does. */
const NECK_S = 7 / 13;
const HEAD_S = 0.84;

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

interface Sample {
  x: number;
  y: number;
  r: number;
  s: number;
  /** Arc length from the tail tip, in pixels: drives plates and rings. */
  len: number;
}

function rotateAbout(x: number, y: number, cx: number, cy: number, a: number): V2 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
}

/** Densely sampled spine for one pose at phase t. */
function spine(pose: Pose, t: number): Sample[] {
  const raw: { x: number; y: number; r: number; s: number }[] = [];
  const n = SPINE.length;
  const STEPS = 24;
  const bob = pose.bob(t);
  for (let i = 0; i < n - 1; i++) {
    const a = SPINE[Math.max(0, i - 1)]!;
    const b = SPINE[i]!;
    const c = SPINE[i + 1]!;
    const d = SPINE[Math.min(n - 1, i + 2)]!;
    for (let k = 0; k < STEPS; k++) {
      const u = k / STEPS;
      const s = (i + u) / (n - 1);
      let x = catmull(a.p[0], b.p[0], c.p[0], d.p[0], u);
      let y = catmull(a.p[1], b.p[1], c.p[1], d.p[1], u) + DROP;
      const r = b.r + (c.r - b.r) * u;
      // A travelling wave down the tail, damped toward the hips, plus droop.
      const tail = Math.max(0, 1 - s / 0.55);
      y += pose.tailAmp * Math.sin(TAU * t - 5 * s) * tail * tail + pose.tailDrop * tail * tail;
      x += 0.6 * Math.cos(TAU * t - 5 * s) * tail * tail;
      raw.push({ x, y: y + bob, r, s });
    }
  }
  // Bend the neck as a curve: each sample turns about the neck's base by an
  // angle that grows along it, then the head pitches on top of that.
  const base = raw.find((p) => p.s >= NECK_S)!;
  const neck = pose.neck(t);
  const headPitch = pose.head(t);
  let bent = raw.map((p) => {
    if (p.s <= NECK_S) return p;
    const w = ease(clamp01((p.s - NECK_S) / (1 - NECK_S)));
    const [x, y] = rotateAbout(p.x, p.y, base.x, base.y, neck * w);
    return { ...p, x, y };
  });
  const hb = bent.find((p) => p.s >= HEAD_S)!;
  bent = bent.map((p) => {
    if (p.s <= HEAD_S) return p;
    const [x, y] = rotateAbout(p.x, p.y, hb.x, hb.y, headPitch);
    return { ...p, x, y };
  });
  const out: Sample[] = [];
  let len = 0;
  for (const p of bent) {
    const prev = out[out.length - 1];
    if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
    out.push({ ...p, len });
  }
  return out;
}

// --- raster helpers -----------------------------------------------------------

function put(g: Uint8Array, x: number, y: number, c: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  g[yi * W + xi] = c;
}

function line(g: Uint8Array, a: V2, b: V2, c: number): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) put(g, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, c);
}

type Shade = (x: number, y: number, w0: number, w1: number, w2: number) => number;

function tri(g: Uint8Array, a: V2, b: V2, c: V2, shade: Shade): void {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 0.01) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
      const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) g[y * W + x] = shade(x, y, w0, w1, w2);
    }
  }
}

function segDist(p: V2, a: V2, b: V2): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l));
  return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t);
}

/** Lambert term for a cylinder seen side-on, `across` from -1 (top) to 1 (bottom). */
function cylinderLight(across: number, sideways = 0): number {
  const ny = Math.max(-1, Math.min(1, across));
  const nz = Math.sqrt(Math.max(0, 1 - ny * ny - sideways * sideways));
  const d = sideways * LIGHT_SCREEN[0] + ny * LIGHT_SCREEN[1] + nz * LIGHT_SCREEN[2];
  // A little ambient so the shadow side never goes flat black.
  return 0.12 + 0.88 * Math.max(0, d);
}

/**
 * A tapered limb segment: a capsule from a (radius ra) to b (radius rb), lit
 * as a cylinder across its own axis.
 */
function limb(g: Uint8Array, a: V2, b: V2, ra: number, rb: number): void {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const l2 = vx * vx + vy * vy || 1;
  const l = Math.sqrt(l2);
  const r = Math.max(ra, rb) + 1;
  for (let y = Math.floor(Math.min(a[1], b[1]) - r); y <= Math.ceil(Math.max(a[1], b[1]) + r); y++) {
    for (let x = Math.floor(Math.min(a[0], b[0]) - r); x <= Math.ceil(Math.max(a[0], b[0]) + r); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const px = x + 0.5 - a[0];
      const py = y + 0.5 - a[1];
      const k = clamp01((px * vx + py * vy) / l2);
      const dx = px - vx * k;
      const dy = py - vy * k;
      const rr = ra + (rb - ra) * k;
      const d = Math.hypot(dx, dy);
      if (d > rr) continue;
      // Signed distance across the bone, toward screen-up being negative.
      const nx = -vy / l;
      const ny = vx / l;
      const across = ((dx * nx + dy * ny) / rr) * Math.sign(ny || 1);
      g[y * W + x] = ramp(HIDE, cylinderLight(across) - 0.08, x, y);
    }
  }
}

/** Three claws fanning from a foot, pointing along dir (-1 = backward). */
function claws(g: Uint8Array, foot: V2, dir: 1 | -1): void {
  for (const [ox, oy] of [[0, -1], [0, 0], [0, 1]] as const) {
    put(g, foot[0] + dir * (1 + Math.abs(oy)) + ox, foot[1] + oy, 12);
    put(g, foot[0] + dir * (2 + Math.abs(oy)) + ox, foot[1] + oy + (oy === 0 ? 0 : oy * 0.5), 11);
  }
}

// --- the wings ----------------------------------------------------------------

/** Wing plan, seen from above: x forward, z out along the span. */
const ELBOW: V2 = [4, 14];
const WRIST: V2 = [-2, 27];
const TIPS: V2[] = [
  [-8, 48],
  [-22, 44],
  [-34, 34],
  [-40, 20],
];
const ROOT: V2 = [-30, 1];

/** A wing point both on screen and in the wing's own plan. */
interface WP {
  s: V2;
  p: V2;
}

interface WingPose {
  shoulder: WP;
  elbow: WP;
  wrist: WP;
  tips: WP[];
  /** The membrane's outer rim, tip to tip and back to the body, scallops included. */
  rim: WP[];
  /** Moonlight on the inner and outer wing, 0..1, from their real normals. */
  lightIn: number;
  lightOut: number;
}

/** How brightly a wing plane at elevation `ang` catches the moon, seen from this side. */
function wingLight(ang: number, side: 1 | -1): number {
  // Normal of the rotated wing plane, then into view space through the pitch.
  const n: V3 = [0, Math.cos(ang), -side * Math.sin(ang)];
  const v: V3 = [n[0], n[1] * Math.cos(PITCH) - n[2] * Math.sin(PITCH), n[1] * Math.sin(PITCH) + n[2] * Math.cos(PITCH)];
  // Whichever face is toward the viewer is the one we see.
  const f: V3 = v[2] < 0 ? [-v[0], -v[1], -v[2]] : v;
  const d = f[0] * LIGHT[0] + f[1] * LIGHT[1] + f[2] * LIGHT[2];
  // The underside still glows a little: moonlight through the membrane.
  // Capped short of the top step so a wing square to the moon keeps its mottling.
  return v[2] < 0 && d < 0 ? 0.15 : 0.15 + 0.6 * Math.max(0, d);
}

function wing(pose: Pose, t: number, shoulder: V2, side: 1 | -1): WingPose {
  const a = pose.wingAt(t);
  // The hand trails the arm, so the outer wing whips through the stroke; each
  // finger trails the one ahead of it, which fans the hand open.
  const aOut = pose.wingAt(t - 0.06);
  const aFinger = (i: number) => pose.wingAt(t - 0.06 - 0.025 * i) - rad(4 * i);
  const f = pose.spread(t);
  const project = (x: number, z: number, ang: number): V2 => {
    const y3 = z * Math.sin(ang);
    const z3 = side * (1.5 + z * Math.cos(ang));
    const yv = y3 * Math.cos(PITCH) - z3 * Math.sin(PITCH);
    return [shoulder[0] + x, shoulder[1] - yv];
  };
  const elbowP: V2 = [ELBOW[0], ELBOW[1] * (0.85 + 0.15 * f)];
  const wristP: V2 = [WRIST[0] + (1 - f) * 4 + pose.sweep * 0.4, WRIST[1] * (0.8 + 0.2 * f)];
  const tipsP = TIPS.map(
    ([x, z]): V2 => [
      wristP[0] + (x - WRIST[0]) * (0.7 + 0.3 * f) - (1 - f) * 6 + pose.sweep,
      wristP[1] + (z - WRIST[1]) * f,
    ],
  );
  const sh: WP = { s: shoulder, p: [0, 0] };
  const el: WP = { s: project(elbowP[0], elbowP[1], a), p: elbowP };
  const wr: WP = { s: project(wristP[0], wristP[1], (a + aOut) / 2), p: wristP };
  const tips: WP[] = tipsP.map((p, i) => ({ s: project(p[0], p[1], aFinger(i)), p }));
  const root: WP = { s: project(ROOT[0], ROOT[1], a), p: ROOT };

  // Each span of trailing edge sags toward the wrist in a curve: three points
  // pulled in by a parabola, interpolated in plan and projected at the angle
  // of the fingers either side.
  const rim: WP[] = [tips[0]!];
  const span = (from: WP, to: WP, angFrom: number, angTo: number, depth: number) => {
    for (const k of [0.25, 0.5, 0.75]) {
      const m = lerp2(from.p, to.p, k);
      const pull = depth * 4 * k * (1 - k);
      const p = lerp2(m, wristP, pull);
      rim.push({ s: project(p[0], p[1], angFrom + (angTo - angFrom) * k), p });
    }
    rim.push(to);
  };
  for (let i = 0; i < tips.length - 1; i++) span(tips[i]!, tips[i + 1]!, aFinger(i), aFinger(i + 1), 0.34);
  span(tips[tips.length - 1]!, root, aFinger(tips.length - 1), a, 0.26);
  rim.push(sh, el);
  return { shoulder: sh, elbow: el, wrist: wr, tips, rim, lightIn: wingLight(a, side), lightOut: wingLight(aOut, side) };
}

function drawWing(g: Uint8Array, w: WingPose, near: boolean): void {
  const leading: V2[] = [w.shoulder.p, w.elbow.p, w.wrist.p, w.tips[0]!.p];
  const fingers: [V2, V2][] = w.tips.slice(1).map((tp) => [w.wrist.p, tp.p]);
  const span = Math.hypot(w.tips[0]!.p[0], w.tips[0]!.p[1]) || 1;
  const shadePlan = (p: V2, x: number, y: number): number => {
    // Inner and outer wing turn at different angles; blend their light by span.
    const out = clamp01(Math.hypot(p[0], p[1]) / span);
    let light = w.lightIn + (w.lightOut - w.lightIn) * out;
    let d = Infinity;
    for (let i = 0; i < leading.length - 1; i++) d = Math.min(d, segDist(p, leading[i]!, leading[i + 1]!));
    // Taut near the leading edge, sagging and darker toward the trailing edge.
    light += d < 2.6 ? 0.2 : d < 11 ? 0.05 : -0.1;
    if (!near) return ramp(FAR_MEMBRANE, light * 0.75, x, y);
    let fd = Infinity;
    for (const [a, b] of fingers) fd = Math.min(fd, segDist(p, a, b));
    if (fd < 0.7) light += 0.15;
    if (noise(p[0] / 5 + 3.1, p[1] / 5 - 1.7) > 0.72) light -= 0.3;
    return ramp(MEMBRANE, light, x, y);
  };

  // Fan the membrane from the wrist: no self-intersection holes when the wing
  // is nearly edge-on. Plan coordinates ride along through the barycentrics.
  const fill = (a: WP, b: WP, c: WP) =>
    tri(g, a.s, b.s, c.s, (x, y, w0, w1, w2) =>
      shadePlan([a.p[0] * w0 + b.p[0] * w1 + c.p[0] * w2, a.p[1] * w0 + b.p[1] * w1 + c.p[1] * w2], x, y),
    );
  for (let i = 0; i < w.rim.length - 1; i++) fill(w.wrist, w.rim[i]!, w.rim[i + 1]!);
  fill(w.wrist, w.elbow, w.tips[0]!);

  // Bones: pale on the near wing, a dark seam under the forearm for weight.
  const bone = near ? 18 : 4;
  for (const tp of w.tips.slice(1)) line(g, w.wrist.s, tp.s, near ? 14 : 4);
  if (near) {
    line(g, [w.shoulder.s[0], w.shoulder.s[1] + 1], [w.elbow.s[0], w.elbow.s[1] + 1], 3);
    line(g, [w.elbow.s[0], w.elbow.s[1] + 1], [w.wrist.s[0], w.wrist.s[1] + 1], 3);
  }
  line(g, w.shoulder.s, w.elbow.s, bone);
  line(g, w.elbow.s, w.wrist.s, bone);
  line(g, w.wrist.s, w.tips[0]!.s, bone);
  // The thumb claw hooks forward off the wrist.
  put(g, w.wrist.s[0] + 1, w.wrist.s[1] - 1, near ? 18 : 5);
  put(g, w.wrist.s[0] + 2, w.wrist.s[1] - 1, near ? 11 : 5);
  if (near) for (const tp of w.tips) put(g, tp.s[0], tp.s[1], 18);
}

// --- one frame ------------------------------------------------------------------

function renderFrame(pose: Pose, t: number): Frame {
  const layers = LAYERS.map(() => new Uint8Array(W * H));
  const sp = spine(pose, t);

  // Body: for every pixel keep the spine sample it sits deepest inside, and
  // light it as a cylinder by where it falls across the body.
  const body = layers[L.body]!;
  const best = new Float32Array(W * H).fill(Infinity);
  const across = new Float32Array(W * H);
  const along = new Float32Array(W * H);
  const arc = new Float32Array(W * H);
  for (let si = 0; si < sp.length; si++) {
    const smp = sp[si]!;
    // The spine's local direction, so "across" is measured square to it even
    // where the neck curves up.
    const nb = sp[Math.min(sp.length - 1, si + 1)]!;
    const pb = sp[Math.max(0, si - 1)]!;
    let tx = nb.x - pb.x;
    let ty = nb.y - pb.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const r = smp.r + 0.35;
    for (let y = Math.floor(smp.y - r); y <= Math.ceil(smp.y + r); y++) {
      for (let x = Math.floor(smp.x - r); x <= Math.ceil(smp.x + r); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = y * W + x;
        const ox = x + 0.5 - smp.x;
        const oy = y + 0.5 - smp.y;
        const d = Math.hypot(ox, oy) / r;
        if (d <= 1 && d < best[k]!) {
          best[k] = d;
          // Perpendicular to the spine, pointing to the belly side.
          across[k] = (-ty * ox + tx * oy) / r;
          along[k] = smp.s;
          arc[k] = smp.len;
        }
      }
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (best[i] === Infinity) continue;
    const v = across[i]!;
    const s = along[i]!;
    const len = arc[i]!;
    const x = i % W;
    const y = (i / W) | 0;
    let light = cylinderLight(v);
    // Overlapping scales: a staggered grid of darker scale edges on the flank.
    const scaleEdge = (y & 1) === 0 && ((x + ((y >> 1) & 1) * 2) & 3) === 0;
    if (scaleEdge) light -= 0.14;
    // Dark rings round the tail.
    if (s < 0.4 && len % 3.4 < 0.9) light -= 0.22;
    let c: number;
    if (v > 0.3 && s > 0.06 && s < 0.97) {
      // The belly: cream plates, still lit, with a seam every couple of pixels.
      c = len % 2.6 < 0.75 ? 13 : ramp(BELLY, light + 0.55, x, y);
    } else {
      c = ramp(HIDE, light, x, y);
      // A sheen where the moon hits square on.
      if (light > 0.86 && (x * 7 + y * 13) % 5 === 0) c = 7;
    }
    body[i] = c;
  }

  const at = (s: number): Sample => sp[Math.min(sp.length - 1, Math.round(s * (sp.length - 1)))]!;
  const dirAt = (s: number): V2 => {
    const a = at(Math.max(0, s - 0.02));
    const b = at(Math.min(1, s + 0.02));
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return [(b.x - a.x) / l, (b.y - a.y) / l];
  };

  // Dorsal spines from tail to skull, raking back, tallest over the shoulders,
  // standing square off the spine wherever it bends.
  for (let s = 0.12; s <= 0.9; s += 0.032) {
    const p = at(s);
    const [tx, ty] = dirAt(s);
    const up: V2 = [ty, -tx];
    const h = 1 + 2.8 * Math.sin(Math.PI * ((s - 0.12) / 0.78));
    const base: V2 = [p.x + up[0] * (p.r - 0.4), p.y + up[1] * (p.r - 0.4)];
    const tip: V2 = [base[0] + up[0] * h - tx * h * 0.7, base[1] + up[1] * h - ty * h * 0.7];
    line(body, base, tip, 5);
    put(body, tip[0], tip[1], 18);
  }

  // Tail blade: two fins at the tip.
  const tailTip = at(0);
  const tailBack = at(0.06);
  const dx = tailTip.x - tailBack.x;
  const dy = tailTip.y - tailBack.y;
  const tlen = Math.hypot(dx, dy) || 1;
  const nx = -dy / tlen;
  const ny = dx / tlen;
  tri(body, [tailBack.x, tailBack.y], [tailTip.x + nx * 3 - dx * 0.3, tailTip.y + ny * 3 - dy * 0.3], [tailTip.x, tailTip.y], (x, y) =>
    ramp(HIDE, 0.75, x, y),
  );
  tri(body, [tailBack.x, tailBack.y], [tailTip.x - nx * 3 - dx * 0.3, tailTip.y - ny * 3 - dy * 0.3], [tailTip.x, tailTip.y], (x, y) =>
    ramp(HIDE, 0.45, x, y),
  );

  // Head features in the head's own frame, so horns, jaw and eye turn with it.
  // Offsets are authored for the rest pose; hp() rotates them by however far
  // the head has turned from rest.
  const head = at(0.9);
  const snout = at(1);
  const restDir = Math.atan2(33 - 31, 117 - 111);
  const hd = dirAt(0.95);
  const turn = Math.atan2(hd[1], hd[0]) - restDir;
  const ct = Math.cos(turn);
  const st = Math.sin(turn);
  const hp = (ox: number, oy: number): V2 => [head.x + ox * ct - oy * st, head.y + ox * st + oy * ct];
  const sp2 = (ox: number, oy: number): V2 => [snout.x + ox * ct - oy * st, snout.y + ox * st + oy * ct];
  // Mouth line, then the lower jaw below it, with teeth.
  line(body, sp2(1, 0.5), hp(-1, 2.2), 2);
  line(body, sp2(0, 1.6), hp(0, 3.4), 4);
  line(body, sp2(-1, 2.5), hp(1, 4.2), 3);
  for (let k = 0.15; k < 0.8; k += 0.22) {
    const a = sp2(1, 1.5);
    const b = hp(-1, 3.2);
    put(body, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, 11);
  }
  // Brow ridge, catching the light.
  line(body, hp(-1, -2.5), sp2(-2, -2), 6);
  // Horns.
  line(body, hp(-1, -3), hp(-10, -9), 18);
  line(body, hp(-2, -3), hp(-9, -7.5), 7);
  put(body, ...hp(-11, -10), 11);
  line(body, hp(-2, -1), hp(-11, -4), 7);
  put(body, ...hp(-12, -4), 18);
  // Frills off the back of the jaw.
  line(body, hp(-3, 1), hp(-9, 1), 6);
  line(body, hp(-3, 2), hp(-8, 4), 5);
  put(body, ...hp(-9, 1), 18);
  put(body, ...sp2(-1, -1.5), 7);

  // Legs tucked up under the belly: muscled thigh and upper arm tapering to the
  // shin and forearm, each foot ending in three pale claws.
  const hip = at(0.36);
  const chest = at(0.6);
  const hKnee: V2 = [hip.x - 1, hip.y + 7];
  const hAnkle: V2 = [hip.x - 8, hip.y + 9];
  limb(body, [hip.x + 1, hip.y + 1], hKnee, 3.6, 2.4);
  limb(body, hKnee, hAnkle, 2.1, 1.5);
  claws(body, hAnkle, -1);
  const fElbow: V2 = [chest.x + 2, chest.y + 6];
  const fWrist: V2 = [chest.x - 3, chest.y + 9];
  limb(body, [chest.x + 1, chest.y + 2], fElbow, 2.8, 2);
  limb(body, fElbow, fWrist, 1.8, 1.3);
  claws(body, fWrist, -1);

  // Wings hinge at the shoulder, on top of the back.
  const sh = at(0.62);
  const shoulder: V2 = [sh.x, sh.y - sh.r * 0.6];
  drawWing(layers[L.far]!, wing(pose, t, shoulder, -1), false);
  const nearPose = wing(pose, t, shoulder, 1);
  const near = layers[L.near]!;
  drawWing(near, nearPose, true);

  // The near wing shades the body just below it, the moon being overhead.
  for (let i = 0; i < W * H; i++) {
    if (!body[i] || near[i]) continue;
    const y = (i / W) | 0;
    if ((y > 0 && near[i - W]) || (y > 1 && near[i - 2 * W])) {
      const c = body[i]!;
      const hi = HIDE.indexOf(c);
      if (hi > 0) body[i] = HIDE[hi - 1]!;
      const bi = BELLY.indexOf(c);
      if (bi > 0) body[i] = BELLY[bi - 1]!;
    }
  }

  // Where the near wing crosses the body, darken its edge so the two read apart.
  const edge: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!near[i] || near[i] === 18) continue;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = yy * W + xx;
      if (!near[k] && body[k]) {
        edge.push(i);
        break;
      }
    }
  }
  for (const i of edge) near[i] = 2;

  // The glow: the eye, a few lit scales on the flank, a wingtip glint.
  const glow = layers[L.glow]!;
  for (let s = 0.4; s <= 0.6; s += 0.06) {
    const p = at(s);
    put(glow, p.x, p.y - p.r * 0.1, 8);
  }
  put(glow, ...hp(2, -1), 9);
  put(glow, ...hp(3, -1), 8);
  put(glow, nearPose.tips[0]!.s[0], nearPose.tips[0]!.s[1], 8);

  // Silhouette outline on its own layer, under everything.
  const outline = layers[L.outline]!;
  const solid = (k: number) => layers.some((g, li) => li !== L.outline && g[k] !== 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (solid(k)) continue;
      if (
        (x > 0 && solid(k - 1)) ||
        (x < W - 1 && solid(k + 1)) ||
        (y > 0 && solid(k - W)) ||
        (y < H - 1 && solid(k + W))
      )
        outline[k] = 1;
    }
  }
  return { layers };
}

export function render(): { frames: Frame[]; tags: Tag[] } {
  const frames: Frame[] = [];
  const tags: Tag[] = [];
  for (const set of SETS) {
    const from = frames.length;
    for (let i = 0; i < set.frames; i++) frames.push(renderFrame(POSES[set.name]!, i / set.frames));
    tags.push({ name: set.name, from, to: frames.length - 1, ms: set.ms });
  }
  return { frames, tags };
}
