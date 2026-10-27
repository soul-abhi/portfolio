import { useRef } from 'react';
import DotGrid from '../bits/DotGrid';
import Magnet from '../bits/Magnet';
import { gsap, goToSection, reducedMotion, SplitText, useGSAP } from '../motion';
import { about, site } from '../data';
import { attachTitleFlame } from '../../fx/flame';

/** Where the surface's pixel fire sits on the script I, in ems of the name. */
const FLAME_NUDGE: [number, number] = [0.14, -0.16];

/** The longest the entrance waits for its faces; past this a slow network gets the fallback rather than a blank hero. */
const FACE_WAIT = 1200;

/**
 * Resolves once the two faces the hero is drawn in have arrived. Only these
 * two: waiting on document.fonts.ready would also wait for the body face,
 * which the hero barely uses and which loads last.
 */
function heroFaces(): Promise<unknown> {
  if (!document.fonts) return Promise.resolve();
  return Promise.race([
    Promise.all([document.fonts.load('1em "Candy Inc"'), document.fonts.load('italic 400 1em "Instrument Serif"')]),
    new Promise((r) => window.setTimeout(r, FACE_WAIT)),
  ]).catch(() => undefined);
}

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
  const lead = entrance === 'gate' ? 550 : 0;
  const based = about.facts.find((f) => f.k === 'Based')?.v;

  useGSAP(
    (_ctx, contextSafe) => {
      const title = name.current;
      let drop: (() => void) | null = null;
      let split: SplitText | null = null;
      let gone = false;
      const flame = () => {
        // The flame is placed by measuring the face's ink, so it waits for the face.
        if (title?.isConnected && !drop) drop = attachTitleFlame(title, reducedMotion(), FLAME_NUDGE);
        return title?.querySelector('.title-flame');
      };

      if (reducedMotion()) {
        void heroFaces().then(() => !gone && flame());
        return () => {
          gone = true;
          drop?.();
        };
      }

      // Everything starts hidden in the same frame React paints it, so nothing
      // is seen in the fallback face or ahead of its turn while the faces load.
      gsap.set(['.ct-hero__eyebrow', '.ct-hero__line', '.ct-hero__sub', '.ct-hero__cta > *', '.ct-hero__cue'], {
        autoAlpha: 0,
      });
      gsap.set('.ct-hero__name', { clipPath: 'inset(-40% 0 100% 0)' });
      gsap.set('.ct-hero__panel', { autoAlpha: 0 });

      const play = contextSafe!(() => {
        if (gone) return;
        // Split only now: the words are measured in the face they will be read in.
        split = new SplitText('.ct-hero__line', { type: 'words', mask: 'words' });
        gsap.set('.ct-hero__line', { autoAlpha: 1 });

        // Explicit end states throughout: a .from() would take its end from
        // whatever the page shows at that moment, which can be a CSS transition mid-flight.
        gsap
          .timeline({
            defaults: { ease: 'power3.out' },
            onComplete: () => {
              split?.revert();
              split = null;
            },
          })
          .fromTo('.ct-hero__eyebrow', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7 })
          // The name is drawn up out of its baseline, the way the surface's title lands.
          .fromTo(
            '.ct-hero__name',
            { clipPath: 'inset(-40% 0 100% 0)', yPercent: 22 },
            { clipPath: 'inset(-40% 0 0% 0)', yPercent: 0, duration: 1.15, ease: 'power4.out', clearProps: 'clipPath' },
            0.1,
          )
          .fromTo(
            split.words,
            { yPercent: 110 },
            { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.04 },
            0.45,
          )
          // The fire catches once the I it sits on is fully drawn.
          .add(() => {
            const f = flame();
            if (!f) return;
            gsap.fromTo(
              f,
              { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 100%' },
              { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)' },
            );
          }, 0.95)
          .fromTo('.ct-hero__sub', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.85)
          .fromTo(
            '.ct-hero__cta > *',
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: 'transform' },
            0.95,
          )
          .fromTo(
            '.ct-hero__panel',
            { autoAlpha: 0, rotation: -9, y: 40, scale: 0.94 },
            { autoAlpha: 1, rotation: 0, y: 0, scale: 1, duration: 1.4, ease: 'expo.out' },
            0.25,
          )
          .fromTo('.ct-hero__cue', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.3);
      });

      void Promise.all([heroFaces(), new Promise((r) => window.setTimeout(r, lead))]).then(play);

      return () => {
        gone = true;
        split?.revert();
        drop?.();
      };
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
          <p className="ct-hero__line">{about.line}</p>
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
