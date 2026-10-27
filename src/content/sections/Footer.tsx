import { about, repos, site } from '../data';
import { isDiveMode } from '../../core/input';
import { switchExperience } from '../../experience';

export function Footer() {
  const sources = repos.filter((r) => r.group === 'SOURCE');

  return (
    <footer className="ct-footer">
      <div className="ct-wrap ct-footer__grid">
        <div className="ct-footer__sign">
          <p className="ct-footer__name" aria-hidden="true">
            {site.title}
          </p>
          <p className="ct-footer__line">{about.line}</p>
        </div>

        <nav className="ct-footer__col" aria-label="Source code">
          <p className="ct-label">Source</p>
          <ul>
            {sources.map((r) => (
              <li key={r.href}>
                <a href={r.href} target="_blank" rel="noopener noreferrer">
                  {r.value}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {!isDiveMode() && (
          <div className="ct-footer__col">
            <p className="ct-label">Also as</p>
            <p className="ct-footer__switch-note">The same portfolio as a zoomable night surface.</p>
            <button type="button" className="ct-btn" onClick={() => switchExperience('design')}>
              Open the Design view
            </button>
          </div>
        )}
      </div>
      <div className="ct-wrap ct-footer__base">
        <span>
          © {new Date().getFullYear()} {about.name}
        </span>
        <a href="#top">Back to top ↑</a>
      </div>
    </footer>
  );
}
