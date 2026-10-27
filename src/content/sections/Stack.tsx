import LogoLoop from '../bits/LogoLoop';
import SpotlightCard from '../bits/SpotlightCard';
import SplitText from '../bits/SplitText';
import { allSkills, stack } from '../data';

/**
 * The tools, two ways: a slow running band of every name for the overview,
 * then the same names grouped by the layer of a system they work in, each
 * with the projects above that actually use it.
 */
/**
 * Built once: LogoLoop re-measures whenever it is handed a new array, so the
 * rows must keep their identity across renders.
 */
const half = Math.ceil(allSkills.length / 2);
const ROWS = [allSkills.slice(0, half), allSkills.slice(half)].map((row) =>
  row.map((name) => ({ node: <span className="ct-loop__item">{name}</span>, title: name })),
);

export function Stack() {
  return (
    <section id="stack" className="ct-section ct-stack" aria-label="Stack" tabIndex={-1}>
      <div className="ct-wrap">
        <header className="ct-head">
          <p className="ct-label">Stack</p>
          <SplitText
            tag="h2"
            text="What the work is built with"
            className="ct-h2"
            splitType="words"
            effect="rise"
            mask
            delay={35}
            textAlign="left"
          />
        </header>
      </div>

      <div className="ct-loops" aria-hidden="true">
        {ROWS.map((row, i) => (
          <LogoLoop
            key={i}
            logos={row}
            speed={i ? 38 : 46}
            direction={i ? 'right' : 'left'}
            logoHeight={44}
            gap={44}
            pauseOnHover
            fadeOut
            fadeOutColor="#f3f2ef"
            ariaLabel="Tools used across the projects"
          />
        ))}
      </div>

      <div className="ct-wrap">
        <div className="ct-layers">
          {stack.map((g) => (
            <SpotlightCard
              key={g.name}
              theme="light"
              spotlightColor="rgba(215, 25, 53, 0.08)"
              className="ct-layer"
              data-reveal
            >
              <h3 className="ct-layer__name">{g.name}</h3>
              <ul>
                {g.skills.map((s) => (
                  <li key={s.name}>
                    <span className="ct-layer__skill">{s.name}</span>
                    <span className="ct-layer__used">{s.usedIn.join(', ')}</span>
                  </li>
                ))}
              </ul>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
