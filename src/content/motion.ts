import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, useGSAP);

export { gsap, ScrollTrigger, ScrollSmoother, useGSAP };

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Height of the fixed nav, so a section scrolled to never sits underneath it. */
const NAV_CLEAR = 88;

/**
 * Goes to a section by id. The smoother, when there is one, glides there;
 * otherwise the browser jumps. Focus follows, so keyboard and screen-reader
 * users land where they were taken rather than back on the nav.
 */
export function goToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  const smoother = ScrollSmoother.get();
  if (smoother) smoother.scrollTo(el, !reducedMotion(), `top ${NAV_CLEAR}px`);
  else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - NAV_CLEAR });
  el.focus({ preventScroll: true });
}
