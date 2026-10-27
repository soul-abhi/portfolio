import { useEffect, useRef } from 'react';
import SpotlightCard from '../bits/SpotlightCard';
import { gsap, reducedMotion, useGSAP } from '../motion';
import type { Project } from '../data';
import type { Link, Pair, Shot } from '../../world/types';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];

const host = (href: string) => href.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * One project, read top to bottom in the order the surface descends through
 * it: the plate (what it is), the case file (problem, decision, outcome, and
 * the numbers), the mechanism, and where there is one, the source.
 */
export function ProjectCard({ project: p }: { project: Project }) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      // The mechanism is a sequence, so it is drawn as one: the rail fills
      // with the scroll and each stage arrives as the rail reaches it.
      const flow = root.current?.querySelector<HTMLElement>('.ct-flow');
      if (!flow) return;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: flow, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
      });
      // The rail runs across on wide screens and down on narrow ones; CSS picks the axis.
      tl.fromTo(flow, { '--fill': 0 }, { '--fill': 1, ease: 'none', duration: 1 }, 0);
      // The dots stay on the rail; only each stage's words arrive.
      gsap.utils.toArray<HTMLElement>('.ct-flow__stage', root.current).forEach((stage, i, all) => {
        tl.fromTo(
          stage.querySelectorAll('b, p'),
          { autoAlpha: 0.15, y: 18 },
          { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.35 },
          (i / all.length) * 0.85,
        );
      });
    },
    { scope: root },
  );

  // The rail runs from the first dot's centre to the last one's, across or down
  // depending on the layout, so its far end is measured rather than guessed.
  useEffect(() => {
    const flow = root.current?.querySelector<HTMLElement>('.ct-flow');
    const dots = flow?.querySelectorAll<HTMLElement>('.ct-flow__dot');
    if (!flow || !dots?.length) return;
    const last = dots[dots.length - 1]!;
    const place = () => {
      const f = flow.getBoundingClientRect();
      const d = last.getBoundingClientRect();
      flow.style.setProperty('--rail-x', `${f.right - (d.left + d.width / 2)}px`);
      flow.style.setProperty('--rail-y', `${f.bottom - (d.top + d.height / 2)}px`);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(flow);
    return () => ro.disconnect();
  }, []);

  const live = p.links.find((l) => l.group === 'LIVE');
  const source = p.links.find((l) => l.group === 'SOURCE');

  return (
    <article id={`p-${p.id}`} ref={root} className="ct-project" aria-labelledby={`p-${p.id}-t`} tabIndex={-1}>
      <SpotlightCard theme="light" spotlightColor="rgba(215, 25, 53, 0.07)" spotlightSize={520} className="ct-project__card">
        <header className="ct-project__head" data-reveal>
          <span className="ct-project__index" aria-hidden="true">
            {p.index}
          </span>
          <div className="ct-project__name">
            <h3 id={`p-${p.id}-t`} className="ct-project__title">
              {p.title}
            </h3>
            <p className="ct-project__sub">{p.sub}</p>
          </div>
          <dl className="ct-project__meta">
            <div>
              <dt>Year</dt>
              <dd>{p.year}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{p.role}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="ct-stamp">{p.status}</span>
              </dd>
            </div>
          </dl>
        </header>

        <div className="ct-project__intro">
          <div className="ct-project__lede" data-reveal>
            <p className="ct-prose ct-prose--lead">{p.lede}</p>
            <ul className="ct-chips" aria-label="Stack">
              {p.stack.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {(live || source) && (
              <p className="ct-project__links">
                {live && <OutLink link={live} kind="Live site" />}
                {source && <OutLink link={source} kind="Source" />}
              </p>
            )}
          </div>
          <Preview project={p} shots={p.shots} live={live} />
        </div>

        {p.sections.length > 0 && (
          <section className="ct-case" aria-label="Case file">
            {p.sections.map((s, i) => (
              <div key={s.h} className="ct-case__beat" data-reveal>
                <h4>
                  <span className="ct-case__n" aria-hidden="true">
                    {ROMAN[i] ?? i + 1}
                  </span>
                  {s.h}
                </h4>
                <p>{s.p}</p>
              </div>
            ))}
          </section>
        )}

        {p.metrics.length > 0 && <Metrics metrics={p.metrics} />}

        {p.mechanism && (
          <section className="ct-mech" aria-label={`How it works: ${p.mechanism.title}`}>
            <header className="ct-mech__head" data-reveal>
              <p className="ct-label">How it works</p>
              <h4 className="ct-mech__title">{p.mechanism.title}</h4>
              <p className="ct-mech__sub">{p.mechanism.sub}</p>
            </header>
            <div className="ct-flow">
              <span className="ct-flow__rail" aria-hidden="true">
                <i />
              </span>
              <ol>
              {p.mechanism.stages.map((s, i) => (
                <li key={s.label} className="ct-flow__stage">
                  <span className="ct-flow__dot" aria-hidden="true">
                    {i + 1}
                  </span>
                  <b>{s.label.toLowerCase()}</b>
                  <p>{s.detail}</p>
                </li>
              ))}
              </ol>
            </div>
            {p.mechanism.notes.length > 0 && (
              <aside className="ct-notes" aria-label="Notes" data-reveal>
                {p.mechanism.notes.map((n) => (
                  <p key={n.slice(0, 24)}>{n}</p>
                ))}
              </aside>
            )}
          </section>
        )}

        {p.source && (
          <figure className="ct-source" data-reveal>
            <figcaption>
              <span>{p.source.file}</span>
              <span className="ct-source__fn">{p.source.title}</span>
            </figcaption>
            <pre tabIndex={0} aria-label={`Source excerpt from ${p.source.file}`}>
              <code>
                {p.source.code.split('\n').map((line, i) => (
                  <span key={i} className={/^\s*\/\//.test(line) ? 'ct-source__c' : undefined}>
                    {line + '\n'}
                  </span>
                ))}
              </code>
            </pre>
          </figure>
        )}
      </SpotlightCard>
    </article>
  );
}

function OutLink({ link, kind }: { link: Link; kind: string }) {
  return (
    <a className="ct-out" href={link.href} target="_blank" rel="noopener noreferrer">
      <span className="ct-out__k">{kind}</span>
      <span className="ct-out__v">{link.value}</span>
      <span className="ct-out__a" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}

/**
 * The screenshot, inked into a panel, drifting slightly against the scroll.
 * A project with no screenshot gets an honest panel instead of a stand-in
 * image: its live address if it has one, its stack if it does not.
 */
function Preview({ project: p, shots, live }: { project: Project; shots: Shot[]; live?: Link }) {
  const [main, inset] = shots;
  if (!main) {
    return (
      <div className="ct-preview ct-preview--plain" data-reveal>
        <div className="ct-preview__panel">
          <p className="ct-preview__word" aria-hidden="true">
            {p.title}
          </p>
          {live ? (
            <a className="ct-btn ct-btn--ink" href={live.href} target="_blank" rel="noopener noreferrer">
              Open {host(live.href)} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <p className="ct-preview__note">{p.stack.join(' · ')}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <figure className="ct-preview" data-reveal>
      <div className="ct-preview__panel">
        <div className="ct-preview__frame">
          <img src={main.src} alt={main.alt} loading="lazy" width="1280" height="720" data-parallax="0.06" />
        </div>
        {inset && (
          <div className="ct-preview__inset">
            <img src={inset.src} alt={inset.alt} loading="lazy" width="1280" height="720" />
          </div>
        )}
      </div>
      <figcaption>{[main, inset].filter(Boolean).map((s) => s!.caption).join('  ·  ')}</figcaption>
    </figure>
  );
}

/** Splits '8,859 directories' into a figure and its unit, so the figure can be set large and counted up. */
function parse(v: string): { n: number; text: string; decimals: number; unit: string } | null {
  const m = /^(\d[\d,]*(?:\.\d+)?)\s+(.+)$/.exec(v);
  if (!m) return null;
  const text = m[1]!;
  return { n: Number(text.replace(/,/g, '')), text, decimals: text.split('.')[1]?.length ?? 0, unit: m[2]! };
}

function Metrics({ metrics }: { metrics: Pair[] }) {
  const root = useRef<HTMLDListElement>(null);

  useGSAP(
    () => {
      if (reducedMotion()) return;
      const figs = gsap.utils.toArray<HTMLElement>('[data-count]', root.current);
      // The written figure is kept on the element: the count only borrows the text.
      const settle = () => figs.forEach((el) => (el.textContent = el.dataset.text ?? ''));
      figs.forEach((el) => {
        const to = Number(el.dataset.count);
        const decimals = Number(el.dataset.decimals);
        const state = { v: 0 };
        el.textContent = (0).toFixed(decimals);
        gsap.to(state, {
          v: to,
          duration: 1.6,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onUpdate: () => {
            el.textContent = state.v.toLocaleString('en-US', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            });
          },
          onComplete: () => {
            el.textContent = el.dataset.text ?? '';
          },
        });
      });
      return settle;
    },
    { scope: root },
  );

  return (
    <dl ref={root} className="ct-metrics" data-reveal>
      {metrics.map((m) => {
        const f = parse(m.v);
        return (
          <div key={m.k} className="ct-metrics__cell">
            <dt>{m.k}</dt>
            <dd>
              {f ? (
                <>
                  <span className="ct-sr">{m.v}</span>
                  <span className="ct-metrics__fig" aria-hidden="true">
                    <span data-count={f.n} data-decimals={f.decimals} data-text={f.text}>
                      {f.text}
                    </span>{' '}
                    <small>{f.unit}</small>
                  </span>
                </>
              ) : (
                <span className="ct-metrics__fig ct-metrics__fig--text">{m.v}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
