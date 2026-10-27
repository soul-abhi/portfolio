import SplitText from '../bits/SplitText';
import { ProjectCard } from './ProjectCard';
import { goToSection } from '../motion';
import { projects } from '../data';

const COUNT = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

export function Work() {
  const count = COUNT[projects.length] ?? String(projects.length);

  return (
    <section id="work" className="ct-section ct-work" aria-label="Work" tabIndex={-1}>
      <div className="ct-wrap">
        <header className="ct-head">
          <p className="ct-label">Work</p>
          <SplitText
            tag="h2"
            text="Selected work, written up as case files"
            className="ct-h2"
            splitType="words"
            effect="rise"
            mask
            delay={35}
            textAlign="left"
          />
          <p className="ct-head__lede" data-reveal>
            {count} systems. Each one goes from the problem to the decision to what happened, then opens up the
            mechanism at its core.
          </p>
        </header>

        <nav className="ct-index" aria-label="Projects" data-reveal>
          <ol>
            {projects.map((p) => (
              <li key={p.id}>
                <a
                  href={`#p-${p.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    goToSection(`p-${p.id}`);
                  }}
                >
                  <span className="ct-index__n">{p.index}</span>
                  <span className="ct-index__t">{p.title}</span>
                  <span className="ct-index__s">{p.sub}</span>
                  <span className="ct-index__y">{p.year}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ct-projects">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
