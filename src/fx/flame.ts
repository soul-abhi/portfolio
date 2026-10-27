/**
 * A small pixel fire on the dot of the first "i" in the surface title.
 *
 * The title is one shaped text run in a script face, so it is never split
 * into per-letter spans - that would break the letter joins. Instead a Range
 * measures the actual glyph box of the "i", and the flame canvas is anchored
 * above it. The canvas is sized in the title's LOCAL pixels and divided by the
 * camera's scale when the rect is measured, so it stays welded to the dot at
 * every zoom level.
 *
 * The fire is a hand-drawn sprite sheet - four frames at 11x17, extracted
 * from the reference and played at its native 10fps. No blur, no gradients.
 */

/** Native size of one frame in public/fx/fire.png. */
const FW = 11;
const FH = 17;
const FRAMES = 4;
/** The source GIF runs at 10fps. */
const FRAME_MS = 100;

/** Final placement nudge, in the title's local pixels. */
const NUDGE_X = 50;
const NUDGE_Y = -80;

/**
 * `nudgeEm`, when given, replaces the placement nudge with one in ems of the
 * title's font size, for titles set at a size other than the surface's.
 */
export function attachTitleFlame(title: HTMLElement, reduced: boolean, nudgeEm?: [number, number]): () => void {
  const text = title.textContent ?? '';
  const at = text.search(/i/i);
  if (at < 0) return () => undefined;

  title.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.className = 'title-flame';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = FW;
  canvas.height = FH;
  title.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => canvas.remove();
  ctx.imageSmoothingEnabled = false;

  const sheet = new Image();
  let ready = false;
  sheet.addEventListener('load', () => {
    ready = true;
  });
  sheet.src = '/fx/fire.png';

  let placed = false;

  const measure = (): boolean => {
    const node = title.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + 1);
    const box = range.getBoundingClientRect();
    const host = title.getBoundingClientRect();
    // A culled node has no box; try again once it is on screen.
    if (box.width <= 0 || host.width <= 0) return false;

    const scale = host.width / title.offsetWidth || 1;
    const cs = getComputedStyle(title);
    const fs = parseFloat(cs.fontSize) || 1;
    const lh = parseFloat(cs.lineHeight) || fs * 1.2;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
    // The probe must reproduce the title's tracking, or every glyph after the
    // first lands progressively right of where the layout puts it.
    const tracking = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;

    // A Range reports the LINE box, which in a script face sits far above the
    // ink, and the dot of an i sits below the ascenders. So the string is
    // rasterised once and the ink of the single dotted glyph is scanned for.
    let raceX = (box.left + box.width / 2 - host.left) / scale;
    const ascii = 'i';
    const prefix = text.slice(0, at);
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');
    let inkTop = fs * 0.2;

    if (probeCtx) {
      probeCtx.font = font;
      probeCtx.letterSpacing = tracking;
      const start = probeCtx.measureText(prefix).width;
      const end = probeCtx.measureText(prefix + ascii).width;
      const full = probeCtx.measureText(text);
      const ascent = full.fontBoundingBoxAscent || fs * 0.8;
      const descent = full.fontBoundingBoxDescent || fs * 0.2;
      const baselineInBox = (lh - (ascent + descent)) / 2 + ascent;

      const pad = Math.ceil(fs * 0.3);
      probe.width = Math.ceil(end + pad * 2);
      probe.height = Math.ceil(fs * 2.2);
      probeCtx.font = font;
      probeCtx.letterSpacing = tracking;
      probeCtx.textBaseline = 'alphabetic';
      const drawBase = Math.ceil(fs * 1.6);
      probeCtx.fillStyle = '#fff';
      probeCtx.fillText(text, pad, drawBase);

      const img = probeCtx.getImageData(0, 0, probe.width, probe.height);
      let minY = Infinity;
      let sumX = 0;
      let n = 0;
      for (let y = 0; y < probe.height; y++) {
        for (let x = Math.max(0, Math.floor(pad + start)); x < Math.ceil(pad + end); x++) {
          if ((img.data[(y * probe.width + x) * 4 + 3] ?? 0) < 128) continue;
          if (y < minY) minY = y;
          sumX += x;
          n++;
        }
      }
      if (n) {
        // Dot top relative to the layout's own baseline.
        inkTop = baselineInBox - (drawBase - minY);
        // The ink centroid is a more honest horizontal centre than the
        // advance box, which includes the join into the next letter. The
        // probe is drawn at layout size, so probe pixels are local pixels.
        // The knot itself sits a touch right of that centroid, because the
        // loop above it carries more ink than the terminal does.
        raceX = sumX / n - pad + fs * 0.04;
      }
    }

    // Sized to the loop's counter, not the word: the fire sits on the
    // terminal knot of the script "I", at a little over a fifth of the em.
    const h = fs * 0.22;
    const w = h * (FW / FH);
    const top = inkTop + fs * 0.18 - h;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const [nx, ny] = nudgeEm ? [nudgeEm[0] * fs, nudgeEm[1] * fs] : [NUDGE_X, NUDGE_Y];
    canvas.style.left = `${raceX + nx - w / 2}px`;
    canvas.style.top = `${top + ny}px`;
    placed = true;
    return true;
  };

  let last = -1;
  let raf = 0;
  let tries = 0;

  const paint = (frame: number): void => {
    if (!ready) return;
    ctx.clearRect(0, 0, FW, FH);
    ctx.drawImage(sheet, (frame % FRAMES) * FW, 0, FW, FH, 0, 0, FW, FH);
  };

  if (reduced) {
    measure();
    const still = (): void => {
      if (ready) paint(0);
      else requestAnimationFrame(still);
    };
    still();
  } else {
    const loop = (now: number): void => {
      const f = Math.floor(now / FRAME_MS);
      if (!placed && f - tries > 4) {
        tries = f;
        measure();
      }
      if (f !== last) {
        last = f;
        if (placed) paint(f);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  const relayout = (): void => {
    placed = false;
    if (reduced && measure()) paint(0);
  };
  window.addEventListener('resize', relayout);
  // The face may swap in after first paint and move every glyph.
  document.fonts?.ready.then(relayout);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', relayout);
    canvas.remove();
  };
}
