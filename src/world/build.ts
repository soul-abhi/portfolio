import type { Camera } from '../core/camera';
import { decay } from './decay';
import { renderNode } from './render';
import { ZOOM_STEP, type NodeSpec, type WorldNode } from './types';

/**
 * Visibility band, expressed as fractions of the viewport diagonal rather than
 * absolute pixels - otherwise the whole world would be mis-scaled on a laptop
 * versus a 5K display.
 *
 * The band is ~8.5x wide at full opacity, which is wider than ZOOM_STEP, so at
 * every possible zoom level at least one stratum is fully legible and the
 * transition between strata is always a crossfade, never a cut.
 *
 * IN_START is deliberately late. A plate that fades in early is just an
 * unreadable grey rectangle, and six of those turn the surface into noise -
 * at stratum 0 the markers ARE the content, and they only step aside once the
 * plate underneath them can actually be read.
 */
/** Design px a parallax layer of depth 1 shifts when its plate is a screen off-centre. */
const PARALLAX = 30;

const IN_START = 0.075;
const IN_END = 0.17;
const OUT_START = 1.45;
const OUT_END = 3.1;

export class World {
  readonly root: WorldNode;
  readonly all: WorldNode[] = [];
  readonly byId = new Map<string, WorldNode>();

  constructor(
    private layer: HTMLElement,
    spec: NodeSpec,
    private portrait = false,
  ) {
    this.root = this.attach(spec, null, 0, 0, 1, 0);
    for (const n of this.all) this.layer.appendChild(n.el);
  }

  private attach(
    spec: NodeSpec,
    parent: WorldNode | null,
    wx: number,
    wy: number,
    s: number,
    depth: number,
  ): WorldNode {
    const land = spec.size ?? [900, 500];
    const [dw, dh] = this.portrait ? portraitOf(land, spec.kind) : land;
    // Authored offsets are in the parent's LANDSCAPE design pixels, so they
    // have to be remapped when the plate is rebuilt portrait.
    const rx = dw / (land[0] || 1);
    const ry = dh / (land[1] || 1);

    const el = document.createElement('div');
    el.className = `node node--${spec.kind}`;
    el.dataset.id = spec.id;
    el.style.width = `${dw}px`;
    el.style.height = `${dh}px`;
    el.style.zIndex = String(10 + depth);
    el.innerHTML = renderNode(spec);

    // Every plate wears its own decay along the border (src/world/decay.ts),
    // drawn for the size it is actually built at, landscape or portrait.
    const plate = el.querySelector<HTMLElement>(':scope > .plate');
    if (plate) {
      const d = decay(dw, dh, hash(spec.id));
      plate.insertAdjacentHTML('afterbegin', d.svg);
      plate.style.setProperty('-webkit-mask-image', d.mask);
      plate.style.setProperty('mask-image', d.mask);
    }

    // Everything a plate says is a reveal item, cascaded in on arrival; the
    // title, subtitle and header also ride at their own parallax depths.
    const body = el.querySelector<HTMLElement>(':scope > .plate, :scope > .root');
    if (body) {
      [...body.children]
        .filter((c): c is HTMLElement => c instanceof HTMLElement && !c.matches('.tick, .decay'))
        .forEach((c, i) => {
          c.classList.add('rv');
          c.style.setProperty('--i', String(i));
        });
    }
    const layers: WorldNode['layers'] = [];
    for (const [sel, k] of [
      ['.plate__title, .root__title', 1],
      ['.plate__sub, .root__sub', 0.6],
      ['.plate__head, .root__eyebrow', 0.32],
    ] as const) {
      const l = body?.querySelector<HTMLElement>(`:scope > :is(${sel})`);
      if (l) layers.push({ el: l, k, at: 0 });
    }

    const node: WorldNode = {
      spec,
      id: spec.id,
      kind: spec.kind,
      depth,
      parent,
      children: [],
      wx,
      wy,
      s,
      dw,
      dh,
      el,
      portalEl: null,
      alpha: 0,
      branch: 1,
      mounted: true,
      layers,
    };

    this.all.push(node);
    this.byId.set(spec.id, node);

    // On a phone a scattered constellation becomes unreadable the moment the
    // type is large enough to read. The surface is re-composed instead: title
    // at the top, systems as an index running down the plate.
    const indexRoot = this.portrait && spec.kind === 'root';
    // The index runs in route order - who, the six systems, reach - so
    // scrolling down the phone travels it top to bottom.
    const rank = (c: NodeSpec) => (c.kind === 'about' ? 0 : c.kind === 'contact' ? 2 : 1);
    const slots = new Map<NodeSpec, number>();
    if (indexRoot) {
      (spec.children ?? [])
        .filter((c) => c.portal)
        .sort((a, b) => rank(a) - rank(b))
        .forEach((c, i) => slots.set(c, i));
    }

    for (const childSpec of spec.children ?? []) {
      let ax: number;
      let ay: number;
      if (indexRoot) {
        ax = 0;
        ay = childSpec.portal ? -240 + (slots.get(childSpec) ?? 0) * 118 : 680;
      } else if (this.portrait && childSpec.portal) {
        // Park the next stratum in the band the portrait frame reserved below
        // the content, so the crossfade never happens on top of text.
        const childH = portraitOf(childSpec.size ?? [900, 500], childSpec.kind)[1];
        ax = 0;
        ay = dh / 2 - childH / ZOOM_STEP / 2 - dh * 0.04;
      } else {
        ax = (childSpec.at?.[0] ?? 0) * rx;
        ay = (childSpec.at?.[1] ?? 0) * ry;
      }
      const child = this.attach(
        childSpec,
        node,
        wx + ax * s,
        wy + ay * s,
        s / ZOOM_STEP,
        depth + 1,
      );
      node.children.push(child);

      if (childSpec.portal) {
        const p = document.createElement('button');
        p.type = 'button';
        p.className = `portal portal--${childSpec.kind}`;
        p.style.left = `${dw / 2 + ax}px`;
        p.style.top = `${dh / 2 + ay}px`;
        p.dataset.target = childSpec.id;
        p.setAttribute('aria-label', `Zoom into ${childSpec.title ?? childSpec.id}`);
        // Below the surface a marker is drawn as a frame around the exact
        // footprint the child will occupy, so the promise and the thing
        // delivered are the same rectangle.
        p.style.setProperty('--pw', `${(child.dw / ZOOM_STEP).toFixed(1)}px`);
        p.style.setProperty('--ph', `${(child.dh / ZOOM_STEP).toFixed(1)}px`);
        p.innerHTML =
          `<i class="portal__mark"></i><span class="portal__cap">${childSpec.portal}</span>` +
          `<span class="portal__go" aria-hidden="true"><span class="portal__go-t">${this.portrait ? 'tap' : 'click'} to go in</span><b class="portal__go-a"></b></span>`;
        el.appendChild(p);
        child.portalEl = p;
      }
    }

    return node;
  }

  /**
   * The camera frame that fits a node into the part of the screen the HUD
   * leaves free, centred in that space rather than in the raw viewport - so a
   * plate never lands under the breadcrumbs or the depth meter.
   */
  frameOf(
    node: WorldNode,
    viewW: number,
    viewH: number,
    inset: Insets = NO_INSETS,
  ): { cx: number; cy: number; z: number } {
    const aw = Math.max(1, viewW - inset.left - inset.right);
    const ah = Math.max(1, viewH - inset.top - inset.bottom);
    const fit = Math.min(aw / node.dw, ah / node.dh) * 0.94;
    const scale = fit / node.s;
    // Shift the camera so the node's centre lands on the free area's centre.
    const ox = (inset.left - inset.right) / 2;
    const oy = (inset.top - inset.bottom) / 2;
    return { cx: node.wx - ox / scale, cy: node.wy - oy / scale, z: Math.log(scale) };
  }

  pathOf(node: WorldNode): WorldNode[] {
    const chain: WorldNode[] = [];
    for (let n: WorldNode | null = node; n; n = n.parent) chain.unshift(n);
    return chain;
  }

  /**
   * One LOD pass: position every node, fade it according to its on-screen size,
   * cull it if off-screen, and report which node the viewer is currently
   * "looking at" so the HUD and the URL can follow.
   *
   * Only the branch being viewed is drawn: `current`, its ancestors and its
   * descendants. Siblings and their subtrees ease out. Without this, panels
   * that sit close together at the same stratum - the portrait index on a
   * phone above all - overlap each other at exactly the zoom you settle on.
   */
  /**
   * `also` keeps a second branch drawn (the page a flight is leaving), and
   * `centre` is the screen x a settled plate is centred on, so parallax is
   * zero at rest; pass NaN to turn parallax off.
   */
  update(cam: Camera, current: WorldNode = this.root, dt = 1, also: WorldNode | null = null, centre = cam.viewW / 2): WorldNode {
    const ease = Math.min(1, dt * 9);
    const camScale = cam.scale;
    const view = Math.hypot(cam.viewW, cam.viewH);
    const inStart = view * IN_START;
    const inEnd = view * IN_END;
    const outStart = view * OUT_START;
    const outEnd = view * OUT_END;
    const ideal = Math.log(view * 0.5);

    let focus = this.root;
    let bestScore = -Infinity;

    for (const n of this.all) {
      const k = n.s * camScale;
      const span = Math.max(n.dw, n.dh) * k;

      let alpha: number;
      if (span <= inStart || span >= outEnd) alpha = 0;
      else if (span < inEnd) alpha = smooth((span - inStart) / (inEnd - inStart));
      else if (span > outStart) alpha = 1 - smooth((span - outStart) / (outEnd - outStart));
      else alpha = 1;

      // In flight between two pages, both stay drawn until the camera lands.
      const want = related(n, current) || (also !== null && related(n, also)) ? 1 : 0;
      n.branch += (want - n.branch) * ease;
      if (Math.abs(want - n.branch) < 0.01) n.branch = want;
      alpha *= n.branch;

      if (alpha <= 0.001) {
        if (n.mounted) {
          n.el.style.display = 'none';
          n.mounted = false;
        }
        n.alpha = 0;
        continue;
      }

      const sx = (n.wx - cam.cx) * camScale + cam.viewW / 2;
      const sy = (n.wy - cam.cy) * camScale + cam.viewH / 2;
      const halfW = (n.dw * k) / 2;
      const halfH = (n.dh * k) / 2;

      if (
        sx + halfW < -40 ||
        sx - halfW > cam.viewW + 40 ||
        sy + halfH < -40 ||
        sy - halfH > cam.viewH + 40
      ) {
        if (n.mounted) {
          n.el.style.display = 'none';
          n.mounted = false;
        }
        n.alpha = 0;
        continue;
      }

      if (!n.mounted) {
        n.el.style.display = '';
        n.mounted = true;
      }

      n.alpha = alpha;
      if (!Number.isNaN(centre) && n.layers.length) {
        const off = (sx - centre) / cam.viewW;
        for (const l of n.layers) {
          const x = -off * l.k * PARALLAX;
          if (Math.abs(x - l.at) < 0.05) continue;
          l.at = x;
          l.el.style.translate = Math.abs(x) < 0.05 ? '' : `${x.toFixed(2)}px 0`;
        }
      }
      n.el.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${k.toFixed(6)}) translate(-50%, -50%)`;
      n.el.style.opacity = alpha.toFixed(3);
      n.el.style.pointerEvents = alpha > 0.55 ? 'auto' : 'none';

      // A portal is a promise of something smaller; retire it as that thing
      // becomes readable on its own. Under the surface the child is always
      // half-drawn as a preview, so the frame stays fully lit until the
      // camera is actually going in.
      if (n.portalEl) {
        const fade = n.depth > 1 ? 1 - smooth((alpha - 0.8) / 0.18) : Math.max(0, 1 - alpha * 1.15);
        n.portalEl.style.opacity = fade.toFixed(3);
        n.portalEl.style.pointerEvents = fade > 0.4 ? 'auto' : 'none';
      }

      if (alpha > 0.4 && n.kind !== 'marginalia') {
        // Prefer the stratum closest to screen-filling, and on a tie the deeper
        // one, so diving always promotes the child rather than sticking.
        const score = -Math.abs(Math.log(span) - ideal) + n.depth * 0.02;
        if (score > bestScore) {
          bestScore = score;
          focus = n;
        }
      }
    }

    return focus;
  }
}

/**
 * Rebuild a landscape plate as a portrait one. Because every measurement
 * inside a plate is authored in container-query units, re-proportioning the
 * frame is the whole of the mobile layout - the type and spacing follow.
 */
const PORTRAIT_ASPECT = 0.5;

function portraitOf(size: readonly number[], kind: string): [number, number] {
  const w = size[0] ?? 900;
  const h = size[1] ?? 500;
  if (kind === 'marginalia') return [Math.round(w * 0.62), Math.round(h * 1.9)];
  // A fixed 1:2 frame, slightly wider than a phone, so every plate is
  // width-constrained and therefore renders at the same on-screen width. The
  // height that buys is spare on purpose: it becomes the dive band.
  const pw = Math.round(h * 0.78);
  return [pw, Math.round(pw / PORTRAIT_ASPECT)];
}

/** True if one node is the other or lies on its path to the root. */
function related(a: WorldNode, b: WorldNode): boolean {
  for (let n: WorldNode | null = a; n; n = n.parent) if (n === b) return true;
  for (let n: WorldNode | null = b; n; n = n.parent) if (n === a) return true;
  return false;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** A stable 32-bit seed from a node id, so each plate decays its own way. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
