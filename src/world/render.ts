import type { Link, NodeSpec } from './types';
import { visitorName } from '../intro/visitor';
import wraithUrl from './wraith.png';

const KEYWORDS: Record<string, string[]> = {
  ts: ['export', 'async', 'function', 'const', 'let', 'await', 'return', 'try', 'finally', 'new', 'if', 'for', 'of', 'in', 'class', 'interface', 'type', 'void', 'null'],
  py: ['async', 'def', 'await', 'return', 'while', 'not', 'and', 'or', 'if', 'continue', 'for', 'in', 'yield', 'set', 'None', 'True', 'False'],
  go: ['func', 'return', 'for', 'range', 'if', 'nil', 'error', 'var', 'type', 'struct', 'continue', 'defer', 'go'],
};

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * A deliberately small highlighter. A real grammar is not worth a dependency
 * for four snippets, and anything it misclassifies simply renders as plain
 * text rather than breaking.
 */
function highlight(code: string, lang: string): string {
  const kw = (KEYWORDS[lang] ?? KEYWORDS['ts'] ?? []).join('|');
  const comment = lang === 'py' ? '#[^\\n]*' : '\\/\\/[^\\n]*';
  const re = new RegExp(
    `(${comment})` +
      `|('(?:[^'\\\\\\n]|\\\\.)*'|"(?:[^"\\\\\\n]|\\\\.)*"|\`(?:[^\`\\\\]|\\\\.)*\`)` +
      `|(\\b\\d[\\d_.]*\\b)` +
      `|(\\b(?:${kw})\\b)` +
      `|(\\b[A-Za-z_$][\\w$]*(?=\\())`,
    'g',
  );

  let out = '';
  let last = 0;
  for (let m = re.exec(code); m !== null; m = re.exec(code)) {
    out += esc(code.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'k' : 'f';
    out += `<span class="t-${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
}

/**
 * The lantern-bearer hovering off the WHO plate's top-right corner. A sibling
 * of the plate, not a child, so the plate's crack mask doesn't clip it where
 * it breaks out of the frame. The glows and embers sit over the flame in its
 * raised hand and the green lantern it carries.
 */
const WRAITH = `<div class="wraith" aria-hidden="true">
  <img class="wraith__body" src="${wraithUrl}" alt="" width="35" height="57" draggable="false" />
  <i class="wraith__glow wraith__glow--flame"></i>
  <i class="wraith__glow wraith__glow--gem"></i>
  <i class="wraith__ember"></i><i class="wraith__ember"></i><i class="wraith__ember"></i>
</div>`;

const ticks = `<i class="tick tick--tl"></i><i class="tick tick--tr"></i><i class="tick tick--bl"></i><i class="tick tick--br"></i>`;

function chips(list: string[] | undefined): string {
  if (!list?.length) return '';
  return `<ul class="chips">${list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
}

function pairs(list: { k: string; v: string }[] | undefined, cls = 'spec'): string {
  if (!list?.length) return '';
  return `<dl class="${cls}">${list
    .map((p) => `<div><dt>${esc(p.k)}</dt><dd>${esc(p.v)}</dd></div>`)
    .join('')}</dl>`;
}

export function renderNode(spec: NodeSpec): string {
  switch (spec.kind) {
    case 'root':
      return `
        <div class="root">
          <div class="root__eyebrow"><span>FIELD SURVEY</span><span class="dot"></span><span>SINGLE SURFACE</span><span class="dot"></span><span>NO PAGES</span></div>
          <h1 class="root__title">${esc(spec.title ?? '')}</h1>
          <div class="root__rule"><i></i></div>
          <p class="root__sub">${esc(spec.sub ?? '')}</p>
          <p class="root__hint">Six systems on this plane. Zoom into any of them.</p>
        </div>`;

    case 'project':
      return `
        <article class="plate plate--project">${ticks}
          <header class="plate__head">
            <span class="idx">${esc(spec.index ?? '')}</span>
            <span class="plate__kind">${esc(spec.label ?? 'SYSTEM')}</span>
            <span class="stamp">${esc(spec.status ?? '')}</span>
          </header>
          <h2 class="plate__title">${esc(spec.title ?? '')}</h2>
          <p class="plate__sub">${esc(spec.sub ?? '')}</p>
          <div class="hr"></div>
          <div class="plate__body">
            <p class="lede">${esc(spec.lede ?? '')}</p>
            <div class="plate__meta">
              ${pairs([
                { k: 'Year', v: spec.year ?? '' },
                { k: 'Role', v: spec.role ?? '' },
              ])}
              ${chips(spec.stack)}
            </div>
          </div>
        </article>`;

    case 'study':
      return `
        <article class="plate plate--study">${ticks}
          <header class="plate__head">
            <span class="plate__kind">${esc(spec.label ?? spec.sub ?? 'CASE FILE')}</span>
            <span class="stamp stamp--ghost">${esc(spec.title ?? '')}</span>
          </header>
          <div class="study">
            <div class="study__main">
              ${(spec.sections ?? [])
                .map(
                  (s, i) => `
                <section class="sec">
                  <h3><span class="sec__n">${String(i + 1).padStart(2, '0')}</span>${esc(s.h)}</h3>
                  <p>${esc(s.p)}</p>
                </section>`,
                )
                .join('')}
            </div>
            <aside class="study__side">
              <h4>SPECIFICATION</h4>
              ${pairs(spec.metrics, 'spec spec--stack')}
            </aside>
          </div>
        </article>`;

    case 'mechanism':
      return `
        <article class="plate plate--mech">${ticks}
          <header class="plate__head">
            <span class="plate__kind">MECHANISM</span>
            <span class="stamp stamp--ghost">${esc(spec.title ?? '')}</span>
          </header>
          <h2 class="plate__title plate__title--sm">${esc(spec.title ?? '')}</h2>
          <p class="plate__sub">${esc(spec.sub ?? '')}</p>
          <div class="flow">
            ${(spec.stages ?? [])
              .map(
                (s, i) => `
              <div class="stage">
                <span class="stage__n">${String(i + 1).padStart(2, '0')}</span>
                <span class="stage__label">${esc(s.label)}</span>
                <p class="stage__detail">${esc(s.detail)}</p>
              </div>`,
              )
              .join('')}
          </div>
          <div class="notes">
            ${(spec.notes ?? []).map((n, i) => `<p><sup>${i + 1}</sup>${esc(n)}</p>`).join('')}
          </div>
        </article>`;

    case 'source':
      return `
        <article class="plate plate--source">${ticks}
          <header class="src__head">
            <span class="src__dot"></span>
            <span class="src__file">${esc(spec.file ?? '')}</span>
            <span class="src__lang">${esc((spec.lang ?? '').toUpperCase())}</span>
          </header>
          <div class="src__body">
            <pre class="src__code"><code>${(spec.code ?? '')
              .split('\n')
              .map(
                (line, i) =>
                  `<span class="ln" data-n="${i + 1}">${highlight(line, spec.lang ?? 'ts') || ' '}</span>`,
              )
              .join('')}</code></pre>
          </div>
        </article>`;

    case 'gallery':
      return `
        <article class="plate plate--gallery">${ticks}
          <header class="plate__head">
            <span class="plate__kind">${esc(spec.label ?? 'SHOWCASE')}</span>
            <span class="stamp stamp--ghost">${esc(spec.title ?? '')}</span>
          </header>
          <div class="shots">
            ${(spec.shots ?? [])
              .map(
                (s) => `
              <figure class="shot${s.wide ? ' shot--wide' : ''}">
                <img src="${esc(s.src)}" alt="${esc(s.alt).replace(/"/g, '&quot;')}" loading="lazy" decoding="async" draggable="false" />
                <img class="shot__color" src="${esc(s.src)}" alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false" />
                <figcaption>${esc(s.caption)}</figcaption>
              </figure>`,
              )
              .join('')}
          </div>
        </article>`;

    case 'about': {
      const pages = spec.pages ?? [spec.paras ?? []];
      const para = (p: string) =>
        `<p>${esc(p).replace('{visitor}', `<span data-visitor>${esc(visitorName())}</span>`)}</p>`;
      const total = String(pages.length).padStart(2, '0');
      return `
        <article class="plate plate--about">${ticks}
          <header class="plate__head">
            <span class="plate__kind">Mr. Soul</span>
            ${
              pages.length > 1
                ? `<span class="about__pager" aria-hidden="true"><span class="about__pager-n">01</span> / ${total}</span>`
                : ''
            }
          </header>
          <h2 class="plate__title plate__title--sm">${esc(spec.title ?? '')}</h2>
          ${spec.sub ? `<p class="plate__sub">${esc(spec.sub)}</p>` : ''}
          <div class="hr"></div>
          <div class="about">
            <div class="about__prose">${pages
              .map((pg, i) => `<div class="about__page${i === 0 ? ' is-current' : ''}">${pg.map(para).join('')}</div>`)
              .join('')}</div>
            <aside>${pairs(spec.facts, 'spec spec--stack')}</aside>
          </div>
          ${
            spec.links?.length
              ? `<ul class="about__links">${spec.links
                  .map(
                    (l) => `<li><a href="${esc(l.href)}"${
                      /^https?:/.test(l.href) ? ' target="_blank" rel="noreferrer"' : ''
                    }><span class="about__link-k">${esc(l.label)}</span><span class="about__link-v">${esc(
                      l.value,
                    )}</span><span class="about__link-arrow">&nearr;</span></a></li>`,
                  )
                  .join('')}</ul>`
              : ''
          }
        </article>
        ${WRAITH}`;
    }

    case 'contact': {
      const links = spec.links ?? [];
      const item = (l: Link) =>
        `<li><a href="${esc(l.href)}"${
          /^https?:/.test(l.href) ? ' target="_blank" rel="noreferrer"' : ''
        }><span class="chan__k">${esc(l.label)}</span><span class="chan__v">${esc(
          l.value,
        )}</span><span class="chan__arrow">&rarr;</span></a></li>`;
      const groups = new Map<string, Link[]>();
      for (const l of links) if (l.group) groups.set(l.group, [...(groups.get(l.group) ?? []), l]);
      const list = groups.size
        ? `<div class="chan-cols">${[...groups]
            .map(
              ([g, ls]) =>
                `<section><h4 class="chan-cols__h">${esc(g)}</h4><ul class="chan chan--compact">${ls
                  .map(item)
                  .join('')}</ul></section>`,
            )
            .join('')}</div>`
        : `<ul class="chan">${links.map(item).join('')}</ul>`;
      return `
        <article class="plate plate--contact">${ticks}
          <header class="plate__head"><span class="plate__kind">${esc(spec.label ?? 'CHANNELS')}</span></header>
          <h2 class="plate__title plate__title--sm">${esc(spec.title ?? '')}</h2>
          <p class="plate__sub">${esc(spec.sub ?? '')}</p>
          ${list}
        </article>`;
    }

    case 'marginalia':
      return `<div class="margin-note">${esc(spec.text ?? '')}</div>`;
  }
}
