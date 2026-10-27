import { useEffect, useRef, useState } from 'react';
import DotGrid from '../bits/DotGrid';
import SplitText from '../bits/SplitText';
import Magnet from '../bits/Magnet';
import { gsap, goToSection, reducedMotion, useGSAP } from '../motion';
import { about, site } from '../data';
import { attachTitleFlame } from '../../fx/flame';

/** Where the surface's pixel fire sits on the script I, in ems of the name. */
const FLAME_NUDGE: [number, number] = [0.14, -0.16];

/**
 * The opening. The name is set in the surface's own display face with the
 * same pixel fire on its I, so the two experiences open on one signature.
 * Behind it, the dot field reads as a manga screentone and answers the
 * pointer; the portrait is a single inked panel.
 */
export function Hero({ entrance }: { entrance: 'gate' | 'load' }) {
  const root = useRef<HTMLElement>(null);
  const name = useRef<HTMLHeadingElement>(null);
  // The gate's halves take about a second to clear; the hero waits under them.
  const lead = entrance === 'gate' ? 0.55 : 0.1;
  const based = about.facts.find((f) => f.k === 'Based')?.v;
  // SplitText starts as it mounts, so under the gate it is mounted late.
  const [lineIn, setLineIn] = useState(entrance === 'load');
  useEffect(() => {
    if (lineIn) return;
    const t = window.setTimeout(() => setLineIn(true), lead * 1000 + 250);
    return () => window.clearTimeout(t);
  }, [lineIn, lead]);

  useGSAP(
    () => {
      const title = name.current;
      let drop: (() => void) | null = null;
      // The flame is placed by measuring the face's ink, so it waits for the face.
      void document.fonts?.ready.then(() => {
        if (title?.isConnected) drop = attachTitleFlame(title, reducedMotion(), FLAME_NUDGE);
      });

      if (!reducedMotion()) {
        gsap
          .timeline({ delay: lead, defaults: { ease: 'expo.out' } })
          // Explicit end states: a .from() would take its end from whatever the
          // page shows at that moment, which can be a CSS transition mid-flight.
          .fromTo('.ct-hero__eyebrow', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8 })
          .fromTo(
            '.ct-hero__name',
            { clipPath: 'inset(0 0 100% 0)', yPercent: 18 },
            { clipPath: 'inset(0 0 0% 0)', yPercent: 0, duration: 1.4, clearProps: 'clipPath' },
            0.05,
          )
          .fromTo('.ct-hero__sub', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0.55)
          .fromTo(
            '.ct-hero__cta > *',
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, clearProps: 'transform' },
            0.65,
          )
          .fromTo(
            '.ct-hero__panel',
            { autoAlpha: 0, rotation: -9, y: 40, scale: 0.94 },
            { autoAlpha: 1, rotation: 0, y: 0, scale: 1, duration: 1.5 },
            0.2,
          )
          .fromTo('.ct-hero__cue', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.1);
      }
      return () => drop?.();
    },
    { scope: root },
  );

  return (
    <section id="top" ref={root} className="ct-hero" aria-labelledby="ct-hero-name" tabIndex={-1}>
      <div className="ct-hero__tone" aria-hidden="true" data-speed="0.6">
        <DotGrid
          dotSize={3}
          gap={15}
          baseColor="#c9c6bf"
          activeColor="#d71935"
          proximity={150}
          strength={0.7}
          shockRadius={260}
          shockStrength={3}
          glow={0.2}
          fade={0.55}
          swell={0.6}
        />
      </div>

      <div className="ct-wrap ct-hero__grid">
        <div className="ct-hero__text">
          <p className="ct-hero__eyebrow ct-label">
            Portfolio{based ? <> · {based}</> : null}
          </p>
          <h1 id="ct-hero-name" className="ct-hero__name" ref={name}>
            {site.title}
          </h1>
          {lineIn ? (
            <SplitText
              tag="p"
              text={about.line}
              className="ct-hero__line"
              splitType="words"
              effect="rise"
              mask
              trigger="load"
              delay={45}
              duration={1.1}
              textAlign="left"
            />
          ) : (
            <p className="ct-hero__line" style={{ visibility: 'hidden' }}>
              {about.line}
            </p>
          )}
          <p className="ct-hero__sub">{site.sub}</p>
          <div className="ct-hero__cta">
            <Magnet padding={60} magnetStrength={4} wrapperClassName="ct-magnet">
              <a
                className="ct-btn ct-btn--ink"
                href="#work"
                onClick={(e) => {
                  e.preventDefault();
                  goToSection('work');
                }}
              >
                Read the case files <span aria-hidden="true">↓</span>
              </a>
            </Magnet>
            <a
              className="ct-btn"
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                goToSection('contact');
              }}
            >
              Get in touch
            </a>
          </div>
        </div>

        <figure className="ct-hero__panel" data-speed="0.88">
          <img src="/pfp.jpg" alt="Abhishek’s avatar: an ink drawing of a grinning character in a red hat" width="320" height="320" />
        </figure>
      </div>

      <p className="ct-hero__cue ct-label" aria-hidden="true">
        Scroll to read <span>↓</span>
      </p>
    </section>
  );
}
