/**
 * Where the visitor is on the scroll route: a row of ticks, one per page,
 * a line that fills along them, and the current page's number and name.
 *
 * The line is fed the rail's live spring position every frame, so it glides
 * with the camera rather than jumping when a page lands. Only transform and
 * opacity move. The name swaps through a short blur, which reads as one label
 * changing rather than two labels overlapping.
 */
export class Route {
  private el: HTMLElement;
  private fill: HTMLElement;
  private ticks: HTMLElement[];
  private num: HTMLElement;
  private label: HTMLElement;
  private index = -2;
  private shown = false;
  private lastFill = -1;

  constructor(
    parent: HTMLElement,
    private names: string[],
  ) {
    this.el = document.createElement('div');
    this.el.className = 'route';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <span class="route__num"></span>
      <span class="route__track">
        <i class="route__fill"></i>
        ${names.map(() => '<b class="route__tick"></b>').join('')}
      </span>
      <span class="route__label"></span>`;
    parent.appendChild(this.el);
    this.fill = this.el.querySelector('.route__fill')!;
    this.ticks = [...this.el.querySelectorAll<HTMLElement>('.route__tick')];
    this.num = this.el.querySelector('.route__num')!;
    this.label = this.el.querySelector('.route__label')!;
  }

  /**
   * `pos` is a fractional index into the route; below 0 is the surface, where
   * the bar steps aside.
   */
  update(pos: number): void {
    const n = this.names.length;
    const show = pos > -0.5;
    if (show !== this.shown) {
      this.shown = show;
      this.el.classList.toggle('is-shown', show);
    }
    const f = Math.max(0, Math.min(1, pos / (n - 1)));
    if (Math.abs(f - this.lastFill) > 0.0005) {
      this.lastFill = f;
      this.fill.style.transform = `scaleX(${f.toFixed(4)})`;
    }
    const i = Math.max(0, Math.min(n - 1, Math.round(pos)));
    if (i === this.index) return;
    this.index = i;
    this.ticks.forEach((t, k) => t.classList.toggle('is-on', k <= i));
    this.label.classList.add('is-swapping');
    window.setTimeout(() => {
      this.num.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
      this.label.textContent = this.names[i] ?? '';
      this.label.classList.remove('is-swapping');
    }, 120);
  }
}
