import Magnet from '../bits/Magnet';
import SplitText from '../bits/SplitText';
import { contact } from '../data';

/** Mail and the web open differently: only the web opens in a new tab, as on the surface. */
const external = (href: string) => /^https?:/.test(href);

export function Contact() {
  const [primary, ...rest] = contact.links;

  return (
    <section id="contact" className="ct-section ct-contact" aria-label="Contact" tabIndex={-1}>
      <div className="ct-wrap ct-contact__grid">
        <header className="ct-head">
          <p className="ct-label">Contact</p>
          <SplitText
            tag="h2"
            text={contact.title}
            className="ct-h2 ct-contact__title"
            splitType="words"
            effect="rise"
            mask
            delay={40}
            textAlign="left"
          />
          <p className="ct-head__lede" data-reveal>
            {contact.sub}
          </p>
          {primary && (
            <div className="ct-contact__primary" data-reveal>
              <Magnet padding={70} magnetStrength={4} wrapperClassName="ct-magnet">
                <a
                  className="ct-btn ct-btn--ink ct-btn--lg"
                  href={primary.href}
                  {...(external(primary.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {primary.label} <span aria-hidden="true">↗</span>
                </a>
              </Magnet>
              <span className="ct-contact__primary-v">{primary.value}</span>
            </div>
          )}
        </header>

        <ul className="ct-channels">
          {rest.map((l) => (
            <li key={l.label} data-reveal>
              <a href={l.href} {...(external(l.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <span className="ct-channels__k">{l.label}</span>
                <span className="ct-channels__v">{l.value}</span>
                <span className="ct-channels__a" aria-hidden="true">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
