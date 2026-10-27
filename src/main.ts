import { Camera } from './core/camera';
import { Input, isDiveMode } from './core/input';
import { Field } from './layers/field';
import { Horizon } from './layers/horizon';
import { Route } from './layers/route';
import { Hud } from './layers/hud';
import { World, type Insets } from './world/build';
import { WORLD } from './world/content';
import { ZOOM_STEP, type WorldNode } from './world/types';

import { Intro } from './intro/gate';
import { saveExperience, storedExperience, type Experience } from './experience';
import { attachTitleFlame } from './fx/flame';
import { attachChroma } from './fx/chroma';

import './styles/tokens.css';
import './styles/base.css';
import './styles/nodes.css';
import './styles/hud.css';
import './styles/intro.css';
import './styles/gate.css';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const fieldCanvas = must<HTMLCanvasElement>('#field');
const horizonCanvas = must<HTMLCanvasElement>('#horizon');
const worldLayer = must<HTMLElement>('#world');
const hudLayer = must<HTMLElement>('#hud');
const stage = must<HTMLElement>('#stage');

const dive = isDiveMode();
if (dive) document.body.classList.add('is-dive');

const cam = new Camera({ cx: 0, cy: 0, z: 0 });
const field = new Field(fieldCanvas);
const horizon = new Horizon(horizonCanvas, reduceMotion);
const world = new World(worldLayer, WORLD, dive);

// A small fire on the dot of the i in the surface title.
const rootTitle = worldLayer.querySelector<HTMLElement>('.root__title');
const dropFlame = rootTitle ? attachTitleFlame(rootTitle, reduceMotion) : null;

attachChroma(worldLayer, reduceMotion);

function sizeToViewport(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  cam.resize(w, h);
  field.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
  horizon.resize(w, h);
}
sizeToViewport();

function hashId(): string | null {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return last && world.byId.has(last) ? last : null;
}

const entryNode = world.byId.get(hashId() ?? '') ?? world.root;

/**
 * The node the view is settled on. Every gesture and key resolves to a
 * node, and the camera always finishes on that node's fitted frame - the
 * visitor never has to do the framing themselves.
 */
let current: WorldNode = entryNode;

/** Space the HUD occupies, so frames are fitted to what is actually visible. */
function insets(node: WorldNode): Insets {
  if (dive) return { top: 96, right: 40, bottom: 56, left: 14 };
  // The breadcrumb column only exists below the surface.
  return { top: 72, right: 104, bottom: 76, left: node === world.root ? 72 : 184 };
}

function frameFor(node: WorldNode): { cx: number; cy: number; z: number } {
  return world.frameOf(node, cam.viewW, cam.viewH, insets(node));
}

/** How far a drag may wander from the fitted frame before it starts to resist. */
const PEEK = 0.12;

function settleOn(node: WorldNode, how: 'travel' | 'quick' | 'instant' = 'travel'): void {
  railStop();
  current = node;
  const f = frameFor(node);
  if (how === 'instant' || reduceMotion) cam.place(f.cx, f.cy, f.z);
  else if (how === 'quick') cam.flyTo(f.cx, f.cy, f.z, { minDuration: 0.36, maxDuration: 0.8 });
  else cam.flyTo(f.cx, f.cy, f.z);

  const s = Math.exp(f.z);
  cam.setBounds({
    x0: f.cx - (cam.viewW * PEEK) / s,
    x1: f.cx + (cam.viewW * PEEK) / s,
    y0: f.cy - (cam.viewH * PEEK) / s,
    y1: f.cy + (cam.viewH * PEEK) / s,
  });
}

function goto(id: string, how: 'travel' | 'quick' | 'instant' = 'travel'): void {
  const node = world.byId.get(id);
  if (node) settleOn(node, how);
}

/** The way into a node: its one real child. The surface has many, so none. */
function diveTarget(node: WorldNode): WorldNode | null {
  const kids = node.children.filter((c) => c.kind !== 'marginalia');
  return kids.length === 1 ? kids[0]! : null;
}

function nearestChild(node: WorldNode, wx: number, wy: number): WorldNode | null {
  let best: WorldNode | null = null;
  let bestD = Infinity;
  for (const c of node.children) {
    if (c.kind === 'marginalia') continue;
    const d = Math.hypot(c.wx - wx, c.wy - wy);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const hud = new Hud(hudLayer, (id) => goto(id));

const projects = world.root.children.filter((n) => n.kind === 'project');
const about = world.root.children.find((n) => n.kind === 'about');
const contact = world.root.children.find((n) => n.kind === 'contact');

/** The guided route through the surface: who, the six systems, then reach. */
const TOUR: WorldNode[] = [about, ...projects, contact].filter((n): n is WorldNode => !!n);

function topLevel(node: WorldNode): WorldNode | null {
  let n: WorldNode | null = node;
  while (n && n.parent && n.parent !== world.root) n = n.parent;
  return n && n.parent === world.root ? n : null;
}

function tour(dir: 1 | -1): void {
  const top = topLevel(current);
  const i = top ? TOUR.indexOf(top) : -1;
  let next: WorldNode;
  if (dir > 0) next = i + 1 >= TOUR.length ? world.root : TOUR[i + 1]!;
  else if (i === -1) next = TOUR[TOUR.length - 1]!;
  else next = i === 0 ? world.root : TOUR[i - 1]!;
  settleOn(next);
}

let focus: WorldNode = world.root;

// ---- scroll: live zoom under the cursor, then a settle onto a panel ----

interface ZoomGesture {
  start: WorldNode;
  net: number;
  sx: number;
  sy: number;
}
let gesture: ZoomGesture | null = null;
/** One stratum of zoom, in the camera's log-scale units. */
const STRATUM = Math.log(ZOOM_STEP);
let idle = 0;

function onZoom(dz: number, sx: number, sy: number): void {
  if (!gesture) gesture = { start: current, net: 0, sx, sy };
  gesture.net += dz;
  gesture.sx = sx;
  gesture.sy = sy;
  window.clearTimeout(idle);
  // Wheels have no "release"; a short silence is the end of the gesture.
  idle = window.setTimeout(settleZoom, 170);
}

/**
 * Resolve a zoom gesture to a node. Scrolling in dives into the panel under
 * the cursor, one stratum per stratum's worth of zoom; scrolling out climbs
 * the same way. A nudge too small to mean anything re-fits the panel you are
 * on.
 */
function settleZoom(): void {
  window.clearTimeout(idle);
  const g = gesture;
  gesture = null;
  if (!g) return;

  // Count strata from how far the gesture actually zoomed, rather than from
  // whatever happens to fill the screen mid-gesture.
  const strata = Math.max(1, Math.round(Math.abs(g.net) / STRATUM));
  let next: WorldNode = g.start;
  if (Math.abs(g.net) < 0.12) next = g.start;
  else if (g.net > 0) {
    const [wx, wy] = cam.screenToWorld(g.sx, g.sy);
    for (let i = 0; i < strata; i++) {
      const child = diveTarget(next) ?? nearestChild(next, wx, wy);
      if (!child) break;
      next = child;
    }
  } else {
    for (let i = 0; i < strata && next.parent; i++) next = next.parent;
  }
  settleOn(next, 'quick');
}

const blocked = () => document.body.classList.contains('has-intro');

// ---- scroll: a rail along the route ----
//
// Scrolling never dives into whatever is under the cursor. It travels the
// route - surface, who, the six systems, reach - one page per gesture.
//
// The wheel moves a goal; the rail's position chases it on a critically
// damped spring, so a notched mouse wheel glides instead of stepping, and a
// change of mind mid-flight reverses with its momentum intact. Between two
// pages the camera follows the smooth pan-and-zoom path of van Wijk & Nuij
// (the one d3.interpolateZoom uses): it pulls back just far enough to see
// both, swings across and settles into the next, while the star field's
// octaves slide past at their own speeds. When the wheel goes quiet the goal
// commits to the next page, or springs back if the nudge was too small.
// Clicking still goes anywhere directly.

const RAIL: WorldNode[] = [world.root, ...TOUR];
const route = new Route(
  hudLayer,
  TOUR.map((n) => n.spec.portal ?? n.id),
);
/** Scroll travel, in px, that carries the camera one whole page. */
const PAGE_PX = 300;
/** Spring stiffness: natural frequency, rad/s. Critically damped. */
const OMEGA = 9.5;
/** Path curvature: how far a flight pulls back to see where it is going. */
const RHO = 1.25;

interface Rail {
  pos: number;
  vel: number;
  goal: number;
  from: number;
  committed: boolean;
  dir: number;
}
let rail: Rail | null = null;
let railIdle = 0;
/** Trackpads keep sending momentum after a flick; it must not start a second page. */
let railLockUntil = 0;
/** The direction the lock holds back; outlives the rail, since momentum can outlast a landing. */
let railLockDir = 0;

function railIndexOf(node: WorldNode): number {
  const i = RAIL.indexOf(node === world.root ? node : (topLevel(node) ?? world.root));
  return i < 0 ? 0 : i;
}

// ---- the WHO panel reads as pages: the route turns them before it travels on ----

const aboutPages = about ? [...about.el.querySelectorAll<HTMLElement>('.about__page')] : [];
const aboutPagerN = about?.el.querySelector<HTMLElement>('.about__pager-n') ?? null;
/** Scroll travel, in px, that turns a WHO page: a nudge or a jiggle must not. */
const TURN_PX = 40;
let aboutPage = 0;
let turnAcc = 0;
let turnIdle = 0;

function showAboutPage(n: number): void {
  aboutPage = n;
  aboutPages.forEach((p, i) => {
    p.classList.toggle('is-current', i === n);
    p.classList.toggle('is-past', i < n);
  });
  if (aboutPagerN) aboutPagerN.textContent = String(n + 1).padStart(2, '0');
}

/** True when the WHO panel is settled in view and has a page in direction `dir`. */
function canTurnAbout(dir: number): boolean {
  if (!about || current !== about || rail || !cam.settled) return false;
  const next = aboutPage + dir;
  return next >= 0 && next < aboutPages.length;
}

function turnAbout(dir: number): void {
  showAboutPage(aboutPage + dir);
  // The rest of this flick is spent; the next page of the route waits for a new one.
  railLockUntil = performance.now() + 420;
  railLockDir = dir;
}

function onScroll(dy: number): void {
  if (blocked() || dy === 0) return;
  const dir = Math.sign(dy);
  const now = performance.now();
  if (now < railLockUntil && dir === railLockDir) {
    // Momentum still arriving: keep the door shut until it stops.
    railLockUntil = Math.max(railLockUntil, now + 260);
    return;
  }
  if (canTurnAbout(dir)) {
    if (Math.sign(turnAcc) !== dir) turnAcc = 0;
    turnAcc += dy;
    window.clearTimeout(turnIdle);
    turnIdle = window.setTimeout(() => (turnAcc = 0), 200);
    if (Math.abs(turnAcc) >= TURN_PX) {
      turnAcc = 0;
      turnAbout(dir);
    }
    return;
  }
  if (!rail) {
    const i = railIndexOf(current);
    rail = { pos: i, vel: 0, goal: i, from: i, committed: false, dir };
    cam.cancelFlight();
  } else if (rail.committed) {
    // A new gesture while still flying: carry on from where it is headed.
    rail.from = rail.goal;
    rail.committed = false;
  }
  rail.dir = dir;
  // One page per gesture, however hard the flick.
  const lo = Math.max(0, rail.from - 1);
  const hi = Math.min(RAIL.length - 1, rail.from + 1);
  rail.goal = Math.max(lo, Math.min(hi, rail.goal + dy / PAGE_PX));
  window.clearTimeout(railIdle);
  railIdle = window.setTimeout(railCommit, 140);
}

/** The gesture is over: commit to the next page for any real nudge, else spring back. */
function railCommit(): void {
  window.clearTimeout(railIdle);
  if (!rail || rail.committed) return;
  const off = rail.goal - rail.from;
  rail.goal = Math.abs(off) < 0.08 ? rail.from : rail.from + Math.sign(off);
  rail.committed = true;
  railLockUntil = performance.now() + 420;
  railLockDir = rail.dir;
  if (reduceMotion) {
    // Gentler, not none: no flight, the pages simply crossfade.
    const node = RAIL[rail.goal]!;
    railStop();
    settleOn(node, 'instant');
  }
}

function railStop(): void {
  window.clearTimeout(railIdle);
  rail = null;
}

/** The page the rail is leaving or approaching, for drawing both during a flight. */
let railOther: WorldNode | null = null;

function railStep(dt: number): void {
  railOther = null;
  if (!rail || reduceMotion) return;
  // Critically damped spring toward the goal, integrated in small steps.
  const steps = Math.max(1, Math.ceil(dt / 0.008));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const acc = OMEGA * OMEGA * (rail.goal - rail.pos) - 2 * OMEGA * rail.vel;
    rail.vel += acc * h;
    rail.pos += rail.vel * h;
  }
  if (rail.committed && Math.abs(rail.goal - rail.pos) < 0.0015 && Math.abs(rail.vel) < 0.02) {
    const node = RAIL[rail.goal]!;
    railStop();
    settleOn(node, 'instant');
    return;
  }
  const p = Math.max(0, Math.min(RAIL.length - 1, rail.pos));
  const i0 = Math.min(RAIL.length - 2, Math.floor(p));
  const a = RAIL[i0]!;
  const b = RAIL[i0 + 1]!;
  const at = zoomPath(frameFor(a), frameFor(b), p - i0);
  cam.place(at.cx, at.cy, at.z);
  // The nearer page owns the view; the other stays drawn until the camera lands.
  current = p - i0 < 0.5 ? a : b;
  railOther = current === a ? b : a;
}

interface View {
  cx: number;
  cy: number;
  z: number;
}

/**
 * Smooth and efficient zooming and panning, van Wijk & Nuij 2003: the path
 * between two views that feels shortest, parameterised by t in [0, 1].
 * Works in visible width (world units), which is what the eye judges.
 */
function zoomPath(A: View, B: View, t: number): View {
  const W = cam.viewW;
  const w0 = W / Math.exp(A.z);
  const w1 = W / Math.exp(B.z);
  const dx = B.cx - A.cx;
  const dy = B.cy - A.cy;
  const d = Math.hypot(dx, dy);
  const r2 = RHO * RHO;
  if (d < w0 * 1e-6) {
    // Pure zoom: straight in log scale.
    return { cx: A.cx + dx * t, cy: A.cy + dy * t, z: A.z + (B.z - A.z) * t };
  }
  const b0 = (w1 * w1 - w0 * w0 + r2 * r2 * d * d) / (2 * w0 * r2 * d);
  const b1 = (w1 * w1 - w0 * w0 - r2 * r2 * d * d) / (2 * w1 * r2 * d);
  const q0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const q1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (q1 - q0) / RHO;
  const s = t * S;
  const coshQ0 = Math.cosh(q0);
  const u = (w0 / r2) * (coshQ0 * Math.tanh(RHO * s + q0) - Math.sinh(q0));
  const w = (w0 * coshQ0) / Math.cosh(RHO * s + q0);
  return { cx: A.cx + (dx * u) / d, cy: A.cy + (dy * u) / d, z: Math.log(W / w) };
}

// ---- arrival: a page's contents cascade in once the camera lands ----

let revealed: WorldNode | null = null;
let pending: WorldNode | null = null;

/** The page the camera is heading for: a flight's destination from its first frame. */
function destination(): WorldNode {
  if (!rail) return current;
  if (rail.committed) return RAIL[rail.goal]!;
  const off = rail.goal - rail.from;
  return Math.abs(off) < 0.02 ? RAIL[rail.from]! : RAIL[rail.from + Math.sign(off)]!;
}

/**
 * Called every frame: a page's contents are held back from the moment the
 * camera sets off for it, so they never show and then vanish mid-flight, and
 * cascade in once it lands.
 */
function choreograph(): void {
  const dest = destination();
  if (dest !== revealed && dest !== pending) {
    if (pending && pending !== revealed) pending.el.classList.remove('is-entering');
    pending = dest;
    if (!reduceMotion) dest.el.classList.add('is-entering');
    // Coming back up the route lands on the WHO panel's last page, as a book would.
    if (dest === about) showAboutPage(railIndexOf(current) > railIndexOf(about) ? aboutPages.length - 1 : 0);
  }
  if (dest === revealed && pending && pending !== revealed) {
    // Sprang back: the page that was coming in is shown again, quietly.
    pending.el.classList.remove('is-entering');
    pending = null;
  }
  if (pending && !rail && cam.settled && pending === current) {
    // The class comes off; each item's transition, staggered by its index, plays.
    pending.el.classList.remove('is-entering');
    revealed = pending;
    pending = null;
  }
}

const input = new Input(stage, cam, {
  onZoom,
  onScroll,
  onGestureEnd: () => {
    // A swipe along the route commits at once; a pinch resolves to a panel; a
    // plain drag was a peek, and springs back to the frame it came from.
    if (rail && !rail.committed) railCommit();
    else if (gesture) settleZoom();
    else if (!rail) settleOn(current, 'quick');
  },
  onAscend: () => {
    if (blocked()) return;
    if (hudLayer.querySelector('.help:not([hidden])')) return hud.toggleHelp(false);
    if (current.parent) settleOn(current.parent);
  },
  onDescend: () => {
    if (blocked()) return;
    const next = diveTarget(current) ?? (current === world.root ? TOUR[0] : null);
    if (next) settleOn(next);
  },
  onTour: (dir) => {
    if (blocked()) return;
    if (canTurnAbout(dir)) turnAbout(dir);
    else tour(dir);
  },
  onJump: (n) => {
    const p = projects[n - 1];
    if (p && !blocked()) settleOn(p);
  },
  onHome: () => {
    if (!blocked()) settleOn(world.root);
  },
  onHelp: () => hud.toggleHelp(),
});

/**
 * One click goes in. A marker flies to the panel it marks; any other panel
 * flies to itself; clicking the panel you are already on goes one stratum
 * deeper. A parent showing behind you is a panel too, so clicking it climbs
 * back out. Real links inside a panel keep working, and a drag that happens
 * to end on something never counts as a click.
 */
worldLayer.addEventListener('click', (e) => {
  if (input.wasDrag) return;
  const t = e.target as HTMLElement;

  const portal = t.closest<HTMLElement>('.portal');
  if (portal) {
    e.preventDefault();
    if (portal.dataset.target) goto(portal.dataset.target);
    return;
  }
  if (t.closest('a')) return;

  const el = t.closest<HTMLElement>('.node');
  const node = el?.dataset.id ? world.byId.get(el.dataset.id) : undefined;
  if (!node) return;
  if (node !== current) settleOn(node);
  else {
    const next = diveTarget(node);
    if (next) settleOn(next);
  }
});

/** Aborted if the visitor chooses the Content view, taking these listeners with it. */
const live = new AbortController();

window.addEventListener(
  'resize',
  () => {
    sizeToViewport();
    // Frames depend on the viewport; keep whatever is on screen fitted to it.
    if (!blocked()) settleOn(current, 'instant');
  },
  { signal: live.signal },
);

window.addEventListener(
  'hashchange',
  () => {
    const id = hashId();
    if (id && id !== focus.id) goto(id);
  },
  { signal: live.signal },
);

let hashKey = '';
function syncHash(path: WorldNode[]): void {
  const key = path.map((n) => n.id).join('/');
  if (key === hashKey) return;
  hashKey = key;
  history.replaceState(null, '', `#/${key}`);
}

// A whisper of motion blur on the world while the camera is really moving:
// it fuses the crossfading plates into one movement instead of two objects.
let lastCam = { cx: cam.cx, cy: cam.cy, z: cam.z };
let blurShown = 0;
function motionBlur(dt: number): void {
  const px = (Math.hypot(cam.cx - lastCam.cx, cam.cy - lastCam.cy) * cam.scale) / Math.max(dt, 1e-3);
  const zoom = (Math.abs(cam.z - lastCam.z) / Math.max(dt, 1e-3)) * cam.viewW * 0.25;
  lastCam = { cx: cam.cx, cy: cam.cy, z: cam.z };
  const b = reduceMotion ? 0 : Math.min(1, Math.max(0, (px + zoom - 1600) / 5200)) * 1.4;
  const q = Math.round(b * 10) / 10;
  if (q === blurShown) return;
  blurShown = q;
  worldLayer.style.filter = q > 0 ? `blur(${q}px)` : '';
}

let prev = performance.now();
let elapsed = 0;
let raf = 0;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  elapsed += dt;

  railStep(dt);
  cam.update(dt);
  const ins = insets(current);
  focus = world.update(cam, current, dt, railOther, reduceMotion ? NaN : cam.viewW / 2 + (ins.left - ins.right) / 2);
  choreograph();
  route.update((rail ? rail.pos : railIndexOf(current)) - 1);
  motionBlur(dt);
  field.draw(cam, elapsed);
  const rootZ = frameFor(world.root).z;
  horizon.draw(cam, elapsed, rootZ);

  const path = world.pathOf(focus);
  hud.update(cam, focus, path);
  if (cam.settled) syncHash(path);

  raf = requestAnimationFrame(frame);
}

// The world is parked at its arrival point from the first frame and renders
// behind the overlay. The katana strike is what releases it.
const target = frameFor(entryNode);
const descent = reduceMotion ? 0 : 1.35;

cam.place(target.cx, target.cy, target.z - descent);

function arrive(): void {
  settleOn(entryNode, reduceMotion ? 'instant' : 'travel');
}

document.body.classList.add('is-ready', 'has-intro');
raf = requestAnimationFrame((t) => {
  prev = t;
  frame(t);
});

/**
 * Set once the Content view is loaded and chosen: the gate then opens onto
 * that page rather than the world. Saved only once the page has loaded, so a
 * failed fetch falls back to the world instead of stranding the visitor.
 */
let openContent: (() => void) | null = null;

async function choose(e: Experience): Promise<void> {
  if (e === 'design') return saveExperience(e);
  const { mountContent } = await import('./content');
  saveExperience(e);
  openContent = () => {
    retire();
    mountContent({ entrance: 'gate' });
  };
}

/**
 * The world steps aside for the Content view: its loop, its listeners (its
 * keyboard handler would otherwise swallow the page's scroll keys) and its
 * layers all go, and the hash it was keeping goes with them.
 */
function retire(): void {
  cancelAnimationFrame(raf);
  window.clearTimeout(idle);
  window.clearTimeout(railIdle);
  window.clearTimeout(turnIdle);
  live.abort();
  input.dispose();
  dropFlame?.();
  for (const el of [fieldCanvas, horizonCanvas, stage, hudLayer]) el.remove();
  history.replaceState(null, '', location.pathname);
}

const intro = new Intro({
  reduced: reduceMotion,
  askChoice: storedExperience() === null,
  onChoose: choose,
  onCut: () => (openContent ? openContent() : arrive()),
});

// Readiness is real signals, never a timer pretending to be progress. There
// is no loading bar: the samurai's stillness is the loading state, and he
// does not move until the world behind him has painted and the fonts landed.
const got = { frame: false, fonts: false };
let released = false;

function release(): void {
  if (released) return;
  released = true;
  intro.ready();
}

requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    got.frame = true;
    if (got.fonts) release();
  }),
);

document.fonts?.ready.then(() => {
  got.fonts = true;
  if (got.frame) release();
});

// Webfonts are the one signal that depends on the network, and they are not
// load-bearing: the site's faces are font-display: swap. So the cap is short on
// purpose - a slow CDN costs a late glyph swap, never a visitor held on a
// loading screen.
window.setTimeout(release, 1500);

void intro.finished.then(() => document.body.classList.remove('has-intro'));

function must<T extends Element>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
}
