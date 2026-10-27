import ChromaGrid from '../bits/ChromaGrid';
import SplitText from '../bits/SplitText';
import { showcase } from '../data';

const host = (href?: string) => href?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/**
 * Every site as a screenshot. They sit in grey until the pointer comes near,
 * so the grid reads as one quiet surface and the one you are looking at
 * comes up in colour. Each one opens what it shows.
 */
export function Showcase() {
  const items = showcase.shots.map((s) => ({
    image: s.src,
    alt: s.alt,
    title: s.caption,
    subtitle: host(s.href),
    url: s.href,
    accent: '#d71935',
  }));

  return (
    <section id="websites" className="ct-section ct-showcase" aria-label="Websites" tabIndex={-1}>
      <div className="ct-wrap">
        <header className="ct-head">
          <p className="ct-label">Websites</p>
          <SplitText
            tag="h2"
            text={showcase.sub}
            className="ct-h2"
            splitType="words"
            effect="rise"
            mask
            delay={35}
            textAlign="left"
          />
          <p className="ct-head__lede" data-reveal>
            {showcase.lede}
          </p>
        </header>

        <div data-reveal>
          <ChromaGrid
            items={items}
            theme="light"
            columns={3}
            minCardWidth={260}
            gap={18}
            radius={340}
            grayscale={0.85}
            dim={0.12}
            cardRadius={6}
            aspectRatio="16 / 9"
            frame={false}
            className="ct-chroma"
          />
        </div>

        {showcase.why.length > 0 && (
          <div className="ct-why">
            {showcase.why.map((w) => (
              <div key={w.h} className="ct-why__item" data-reveal>
                <h3>{w.h}</h3>
                <p>{w.p}</p>
              </div>
            ))}
            {showcase.whyFacts.length > 0 && (
              <dl className="ct-facts ct-why__facts" data-reveal>
                {showcase.whyFacts.map((f) => (
                  <div key={f.k} className="ct-facts__row">
                    <dt>{f.k}</dt>
                    <dd>{f.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
