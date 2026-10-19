import { isDiveMode } from './core/input';

/**
 * The phone layout is not finished, so phones get a plain notice instead of
 * the surface. The surface is imported dynamically, which keeps its code and
 * assets off the device entirely. Same test as the dive layout uses, decided
 * once at load just as that is.
 */
if (isDiveMode()) {
  document.body.innerHTML = `
    <main style="min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 16px;text-align:center;font-family:'IBM Plex Mono',ui-monospace,monospace;letter-spacing:0.2em;color:#fff">
      <p style="margin:0;font-size:16px">UNDER CONSTRUCTION</p>
      <p style="margin:0;font-size:12px;opacity:0.7">OPEN IN DESKTOP</p>
    </main>`;
} else {
  void import('./main');
}
