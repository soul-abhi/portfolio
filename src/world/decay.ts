/**
 * Decay along a plate's border: dark veins creeping in from the edge, and a
 * few cracks where four or five pixels of the plate have broken clean away.
 *
 * Drawn as pixel art on a coarse grid (one cell = CELL design px) and seeded,
 * so it is the same on every visit. The veins come back as an SVG overlay
 * that sits under the plate's text; the missing pixels come back as a mask
 * that cuts real holes in the plate, so whatever is behind shows through.
 * Everything stays within a band along the border, clear of the content.
 */

const CELL = 5;
/** Darkest at the root in the border, thinning to a bruise further in. */
const VEIN = ['#0b0205', '#22060c', '#3d0a15', '#6a1222'];
const CRACK = '#050204';
/** How far in from the edge anything may reach, in cells. */
const BAND = 9;

export interface Decay {
  /** Overlay markup for the veins and crack lines. */
  svg: string;
  /** A CSS url() for mask-image that removes the missing pixels. */
  mask: string;
}

type Cell = { c: string; a: number } | 'hole';

export function decay(w: number, h: number, seed: number): Decay {
  const gw = Math.max(8, Math.round(w / CELL));
  const gh = Math.max(8, Math.round(h / CELL));
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const grid = new Map<number, Cell>();
  const key = (x: number, y: number) => y * gw + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < gh;
  const depthOf = (x: number, y: number) => Math.min(x, y, gw - 1 - x, gh - 1 - y);
  const paint = (x: number, y: number, c: string, a: number) => {
    if (!inside(x, y) || depthOf(x, y) > BAND) return;
    const k = key(x, y);
    const was = grid.get(k);
    if (was === 'hole') return;
    // Darker wins where veins cross.
    if (was && VEIN.indexOf(was.c) <= VEIN.indexOf(c) && was.a >= a) return;
    grid.set(k, { c, a });
  };

  /** A point on the border, its inward normal and the tangent along it. */
  const edgePoint = () => {
    const per = 2 * (gw + gh);
    let p = Math.floor(rnd() * per);
    if (p < gw) return { x: p, y: 0, nx: 0, ny: 1, tx: 1, ty: 0 };
    p -= gw;
    if (p < gh) return { x: gw - 1, y: p, nx: -1, ny: 0, tx: 0, ty: 1 };
    p -= gh;
    if (p < gw) return { x: gw - 1 - p, y: gh - 1, nx: 0, ny: -1, tx: -1, ty: 0 };
    p -= gw;
    return { x: 0, y: gh - 1 - p, nx: 1, ny: 0, tx: 0, ty: -1 };
  };

  // Veins: thin lines that keep a heading and turn gently, creeping in from
  // the edge, curling back along it when they reach too deep, and branching
  // now and then. Darkest at the root, thinning to a bruise further in.
  const vein = (x0: number, y0: number, heading: number, steps: number, gen: number) => {
    let x = x0;
    let y = y0;
    let a = heading;
    const reach = 3 + rnd() * (BAND - 3);
    for (let i = 0; i < steps; i++) {
      const cx = Math.round(x);
      const cy = Math.round(y);
      if (!inside(cx, cy)) return;
      const d = depthOf(cx, cy);
      const tone = Math.min(VEIN.length - 2, gen + (d > reach * 0.6 ? 1 : 0));
      paint(cx, cy, VEIN[tone]!, Math.max(0.35, 0.95 - i * 0.025 - gen * 0.15));
      if (gen === 0 && i < 3) paint(cx + Math.round(Math.sin(a)), cy - Math.round(Math.cos(a)), VEIN[0]!, 0.9);
      if (rnd() < 0.035) paint(cx, cy, VEIN[3]!, 0.8);
      if (gen < 2 && i > 2 && rnd() < 0.09) vein(x, y, a + (rnd() < 0.5 ? 0.9 : -0.9), Math.floor(steps * 0.45), gen + 1);
      // Too deep: steer back toward running along the edge.
      if (d > reach) {
        const [nx, ny] = inward(cx, cy);
        const along = Math.atan2(ny, nx) + (Math.sin(a - Math.atan2(ny, nx)) >= 0 ? Math.PI / 2 : -Math.PI / 2);
        a += (along - a) * 0.5;
      }
      a += (rnd() - 0.5) * 0.8;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  };
  /** Unit normal pointing in from the nearest edge. */
  const inward = (x: number, y: number): [number, number] => {
    const m = depthOf(x, y);
    if (m === y) return [0, 1];
    if (m === gh - 1 - y) return [0, -1];
    if (m === x) return [1, 0];
    return [-1, 0];
  };

  // Cracks first, so veins never paint over a hole: a small cluster of
  // missing pixels bitten out of the edge, a jagged split running inward.
  for (let i = 0; i < 5; i++) {
    const e = edgePoint();
    const holes: [number, number][] = [[e.x, e.y]];
    const want = 4 + Math.floor(rnd() * 2);
    for (let tries = 0; holes.length < want && tries < 40; tries++) {
      const [hx, hy] = holes[Math.floor(rnd() * holes.length)]!;
      const step = rnd() < 0.6 ? [e.tx * (rnd() < 0.5 ? 1 : -1), e.ty * (rnd() < 0.5 ? 1 : -1)] : [e.nx, e.ny];
      const cx = hx + step[0]!;
      const cy = hy + step[1]!;
      if (!inside(cx, cy) || depthOf(cx, cy) > 1 || holes.some(([a, b]) => a === cx && b === cy)) continue;
      holes.push([cx, cy]);
    }
    for (const [hx, hy] of holes) grid.set(key(hx, hy), 'hole');
    let [x, y] = holes[holes.length - 1]!;
    const len = 4 + Math.floor(rnd() * 6);
    for (let j = 0; j < len; j++) {
      x += e.nx + (rnd() < 0.45 ? e.tx * (rnd() < 0.5 ? 1 : -1) : 0);
      y += e.ny + (rnd() < 0.45 ? e.ty * (rnd() < 0.5 ? 1 : -1) : 0);
      if (!inside(x, y)) break;
      if (grid.get(key(x, y)) !== 'hole') grid.set(key(x, y), { c: CRACK, a: 1 - j * 0.07 });
    }
  }

  const n = Math.round((gw + gh) / 14);
  for (let i = 0; i < n; i++) {
    const e = edgePoint();
    // Set off inward, angled up to ~60 degrees either way.
    const heading = Math.atan2(e.ny, e.nx) + (rnd() - 0.5) * 2.1;
    vein(e.x, e.y, heading, 16 + Math.floor(rnd() * 22), 0);
  }

  // Overlay: one rect per horizontal run of the same paint.
  const rects: string[] = [];
  const holes: string[] = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; ) {
      const cell = grid.get(key(x, y));
      if (!cell) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < gw) {
        const nxt = grid.get(key(x + run, y));
        if (cell === 'hole' ? nxt !== 'hole' : nxt === 'hole' || !nxt || nxt.c !== cell.c || nxt.a !== cell.a) break;
        run++;
      }
      if (cell === 'hole') holes.push(`M${x} ${y}h${run}v1h${-run}Z`);
      else rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${cell.c}" fill-opacity="${cell.a.toFixed(2)}"/>`);
      x += run;
    }
  }
  const svg =
    `<svg class="decay" viewBox="0 0 ${gw} ${gh}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">` +
    rects.join('') +
    `</svg>`;
  // Evenodd: the full plate, minus each hole.
  const maskSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${gw} ${gh}" preserveAspectRatio="none" shape-rendering="crispEdges">` +
    `<path fill-rule="evenodd" d="M0 0H${gw}V${gh}H0Z${holes.join('')}"/></svg>`;
  return { svg, mask: `url("data:image/svg+xml,${encodeURIComponent(maskSvg)}")` };
}
