import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { about } from './data';
import './content.css';

export interface MountOpts {
  /**
   * 'gate': the surface's gate is opening over this page, so the hero holds
   * its entrance a beat for the halves to clear. 'load': a direct visit.
   */
  entrance: 'gate' | 'load';
}

/** The Content view's faces. The surface's are already on the page; these add the reading face. */
const FONTS =
  'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500&display=swap';

export function mountContent({ entrance }: MountOpts): void {
  const html = document.documentElement;
  html.dataset.experience = 'content';
  document.title = `${about.name} — Portfolio`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f3f2ef');

  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = FONTS;
  document.head.appendChild(fonts);

  // The surface's empty layers from index.html have no part in this page.
  document.querySelectorAll('#field, #horizon, #stage, #hud').forEach((el) => el.remove());
  document.body.classList.add('is-ready');

  const host = document.createElement('div');
  host.id = 'content';
  document.body.prepend(host);
  createRoot(host).render(
    <StrictMode>
      <App entrance={entrance} />
    </StrictMode>,
  );
}
