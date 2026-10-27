import ScrollReveal from '../bits/ScrollReveal';
import { about } from '../data';
import { visitorName } from '../../intro/visitor';

/** The first sentence of the WHO panel is the statement; the rest reads as prose under it. */
function splitLead(text: string): [string, string] {
  const end = text.search(/[.!?]\s/);
  return end < 0 ? [text, ''] : [text.slice(0, end + 1), text.slice(end + 2)];
}

export function About() {
  const [lead, rest] = splitLead(about.paras[0] ?? '');
  const paras = [rest, ...about.paras.slice(1)].filter(Boolean);
  // The gate asked their name; the surface greets them with it, and so does this.
  const hello = about.greeting.replace('{visitor}', visitorName());

  return (
    <section id="about" className="ct-section ct-about" aria-labelledby="ct-about-h" tabIndex={-1}>
      <div className="ct-wrap ct-about__grid">
        <header className="ct-about__side">
          <p className="ct-label" id="ct-about-h">
            About
          </p>
          <p className="ct-about__hello" data-reveal>
            {hello}
          </p>
          <dl className="ct-facts" data-reveal>
            {about.facts.map((f) => (
              <div key={f.k} className="ct-facts__row">
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="ct-about__body">
          <ScrollReveal
            containerClassName="ct-about__lead"
            textClassName="ct-about__lead-text"
            baseOpacity={0.14}
            baseRotation={0}
            blurStrength={3}
            wordAnimationEnd="center center"
          >
            {lead}
          </ScrollReveal>
          {paras.map((p) => (
            <p key={p.slice(0, 24)} className="ct-prose" data-reveal>
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
