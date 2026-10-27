import { useRef } from 'react';
import { gsap, ScrollSmoother, ScrollTrigger, useGSAP } from './motion';
import { Nav } from './sections/Nav';
import { Hero } from './sections/Hero';
import { About } from './sections/About';
import { Work } from './sections/Work';
import { Showcase } from './sections/Showcase';
import { Stack } from './sections/Stack';
import { Contact } from './sections/Contact';
import { Footer } from './sections/Footer';

/**
 * The page. One smoothed scroll carries everything; the motion that is not
 * owned by a single component is set up here, in one place, so the effects
 * are consistent and none of them is applied twice:
 *
 *   [data-reveal]     rises into place once, as it enters
 *   [data-parallax]   drifts against the scroll by its value, as a fraction of its height
 *   [data-speed]      the smoother's own parallax, for whole layers
 *
 * Everything is visible before any of it runs. Motion only ever starts from
 * a hidden state it sets itself, so a failure leaves a readable page, and
 * reduced motion simply never sets it.
 */
export function App({ entrance }: { entrance: 'gate' | 'load' }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        ScrollSmoother.create({
          wrapper: '#ct-smooth',
          content: '#ct-scroll',
          smooth: 1.1,
          effects: true,
          normalizeScroll: false,
        });

        gsap.set('[data-reveal]', { autoAlpha: 0, y: 36 });
        ScrollTrigger.batch('[data-reveal]', {
          start: 'top 90%',
          once: true,
          onEnter: (els) =>
            gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, overwrite: true }),
        });

        gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
          const k = Number(el.dataset.parallax) || 0.1;
          gsap.fromTo(
            el,
            { yPercent: -k * 100 },
            {
              yPercent: k * 100,
              ease: 'none',
              scrollTrigger: { trigger: el.parentElement ?? el, start: 'top bottom', end: 'bottom top', scrub: true },
            },
          );
        });
      });

      // Webfonts reflow every block; measure the triggers again once they land.
      void document.fonts?.ready.then(() => ScrollTrigger.refresh());
    },
    { scope: root },
  );

  return (
    <div ref={root} className="ct">
      <a className="ct-skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <div id="ct-smooth">
        <div id="ct-scroll">
          <main id="main" tabIndex={-1}>
            <Hero entrance={entrance} />
            <About />
            <Work />
            <Showcase />
            <Stack />
            <Contact />
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
}
