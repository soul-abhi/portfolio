import type { Camera } from './camera';

/**
 * Input reports intent, not camera positions. Pinch and drag still move the
 * camera live, so the surface answers the hand immediately, but every gesture
 * ends by handing control back to main.ts, which settles the view onto a
 * properly fitted panel. The visitor never has to finish the framing.
 *
 * Scrolling is not zoom. A wheel, or a vertical swipe on a phone, only says
 * how far along the route to go; main.ts moves the camera.
 */
export interface InputHooks {
  /** A live zoom step happened at screen point (sx, sy). Pinch only. */
  onZoom(dz: number, sx: number, sy: number): void;
  /** Scroll travel in px: positive goes on along the route, negative back. */
  onScroll(dy: number): void;
  /** A drag, pinch or swipe has been released. */
  onGestureEnd(): void;
  onAscend(): void;
  onDescend(): void;
  /** Step the tour: who -> 1..6 -> reach -> surface. */
  onTour(dir: 1 | -1): void;
  onJump(n: number): void;
  onHome(): void;
  onHelp(): void;
}

interface Pointer {
  x: number;
  y: number;
}

const DRAG_SLOP = 5;

/** Touch or narrow viewport: the world becomes a descent rather than a map. */
export function isDiveMode(): boolean {
  return matchMedia('(max-width: 860px), (pointer: coarse)').matches;
}

/**
 * Two modes:
 *
 *   SURVEY (pointer, desktop) - drag peeks, wheel scrolls the route, a
 *                               trackpad pinch zooms at the cursor.
 *   DIVE   (touch, narrow)    - a vertical swipe scrolls the route, the same
 *                               way the wheel does on a desktop.
 */
export class Input {
  readonly dive: boolean;
  private pointers = new Map<number, Pointer>();
  private dragging = false;
  private moved = 0;
  private last = { x: 0, y: 0 };
  private pinchDist = 0;
  private pinched = false;

  constructor(
    private el: HTMLElement,
    private cam: Camera,
    private hooks: InputHooks,
  ) {
    this.dive = isDiveMode();

    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
  }

  /** True if the gesture that just ended was a drag, so clicks can be ignored. */
  get wasDrag(): boolean {
    return this.moved > DRAG_SLOP;
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = e.deltaY * unit;
    if (!e.ctrlKey) {
      this.hooks.onScroll(dy);
      return;
    }
    // ctrlKey on a wheel event is the trackpad pinch gesture: that one is zoom.
    const dz = clamp(-dy * 0.013, -0.6, 0.6);
    this.cam.zoomAt(e.clientX, e.clientY, dz);
    this.hooks.onZoom(dz, e.clientX, e.clientY);
  };

  private onDown = (e: PointerEvent): void => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Pointer, Pointer];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinched = true;
      this.dragging = false;
      return;
    }
    if (this.pointers.size > 2) return;

    this.dragging = true;
    this.pinched = false;
    this.moved = 0;
    this.last = { x: e.clientX, y: e.clientY };
    // No pointer capture yet. A captured pointer retargets the click that
    // follows onto the capturing element, so a plain press on a marker would
    // never reach the marker. Capture starts only once this is really a drag.
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()] as [Pointer, Pointer];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinchDist > 0) {
        const dz = Math.log(dist / this.pinchDist);
        this.cam.zoomAt(mid.x, mid.y, dz);
        this.hooks.onZoom(dz, mid.x, mid.y);
      }
      this.pinchDist = dist;
      this.moved = DRAG_SLOP + 1;
      return;
    }

    if (!this.dragging) return;

    const dx = e.clientX - this.last.x;
    const dy = e.clientY - this.last.y;
    this.moved += Math.abs(dx) + Math.abs(dy);
    this.last = { x: e.clientX, y: e.clientY };
    if (this.moved <= DRAG_SLOP) return;
    if (!this.el.hasPointerCapture(e.pointerId)) this.el.setPointerCapture(e.pointerId);

    if (this.dive) {
      // A finger pushed up scrolls on, as a page would.
      this.hooks.onScroll(-dy * 1.3);
    } else {
      this.cam.panByPixels(dx, dy);
    }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.el.hasPointerCapture?.(e.pointerId)) this.el.releasePointerCapture(e.pointerId);

    const wasGesture = (this.dragging && this.moved > DRAG_SLOP) || (this.pinched && this.pointers.size === 0);
    this.dragging = false;
    if (this.pointers.size === 0) this.pinched = false;
    if (wasGesture) this.hooks.onGestureEnd();
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Keys typed into a field are text, not navigation.
    if (isEditable(e.target)) return;

    switch (e.key) {
      case 'Enter':
        this.hooks.onTour(e.shiftKey ? -1 : 1);
        break;
      case 'ArrowRight':
        this.hooks.onTour(1);
        break;
      case 'ArrowLeft':
        this.hooks.onTour(-1);
        break;
      case 'ArrowDown':
      case ' ':
      case '+':
      case '=':
        this.hooks.onDescend();
        break;
      case 'ArrowUp':
      case 'Escape':
      case '-':
      case '_':
        this.hooks.onAscend();
        break;
      case '0':
        this.hooks.onHome();
        break;
      case '?':
        this.hooks.onHelp();
        break;
      default: {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= 6) this.hooks.onJump(n);
        return;
      }
    }
    e.preventDefault();
  };
}

function isEditable(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || t.matches('input, textarea, select'));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
