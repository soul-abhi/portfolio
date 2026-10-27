/**
 * The Content view reads the same tree the surface is built from
 * (src/world/content.ts), so the two experiences can never disagree. This
 * file only reshapes it: the zoom strata of each project (plate, case file,
 * mechanism, source) become one record, and the screenshots and links that
 * the surface keeps in its WEBSITES branch are matched back to the projects
 * they belong to.
 */

import { WORLD } from '../world/content';
import type { Link, NodeSpec, Pair, Section, Shot, Stage } from '../world/types';

export interface Project {
  id: string;
  index: string;
  title: string;
  sub: string;
  year: string;
  role: string;
  status: string;
  stack: string[];
  lede: string;
  sections: Section[];
  metrics: Pair[];
  mechanism: { title: string; sub: string; stages: Stage[]; notes: string[] } | null;
  source: { title: string; file: string; lang: string; code: string } | null;
  shots: Shot[];
  links: Link[];
}

export interface Showcase {
  title: string;
  sub: string;
  lede: string;
  shots: (Shot & { href?: string })[];
  why: Section[];
  whyFacts: Pair[];
}

const kids = WORLD.children ?? [];

function walk(node: NodeSpec, visit: (n: NodeSpec) => void): void {
  visit(node);
  node.children?.forEach((c) => walk(c, visit));
}

function first(node: NodeSpec, kind: NodeSpec['kind']): NodeSpec | null {
  let hit: NodeSpec | null = null;
  walk(node, (n) => {
    if (!hit && n.kind === kind && n !== node) hit = n;
  });
  return hit;
}

/** Lowercase letters and digits only, so 'GitrixHunt · AI Guide' matches 'GITRIXHUNT'. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The surface's WEBSITES branch: a gallery, a WHY case file and the live and source links. */
const sites = kids.find((n) => n.kind === 'project' && first(n, 'gallery'));
const gallery = sites ? first(sites, 'gallery') : null;
const allShots = gallery?.shots ?? [];
const allLinks = sites ? (first(first(sites, 'study') ?? sites, 'contact')?.links ?? []) : [];

function linksFor(title: string): Link[] {
  const t = norm(title);
  return allLinks.filter((l) => norm(l.label) === t);
}

function shotsFor(title: string): Shot[] {
  const t = norm(title);
  return allShots.filter((s) => norm(s.caption).startsWith(t));
}

export const projects: Project[] = kids
  .filter((n) => n.kind === 'project' && n !== sites)
  .map((n) => {
    const study = first(n, 'study');
    const mech = first(n, 'mechanism');
    const src = first(n, 'source');
    const title = n.title ?? n.id;
    return {
      id: n.id,
      index: n.index ?? '',
      title,
      sub: n.sub ?? '',
      year: n.year ?? '',
      role: n.role ?? '',
      status: n.status ?? '',
      stack: n.stack ?? [],
      lede: n.lede ?? '',
      sections: study?.sections ?? [],
      metrics: study?.metrics ?? [],
      mechanism: mech
        ? { title: mech.title ?? '', sub: mech.sub ?? '', stages: mech.stages ?? [], notes: mech.notes ?? [] }
        : null,
      source: src?.code
        ? { title: src.title ?? '', file: src.file ?? '', lang: src.lang ?? '', code: src.code }
        : null,
      shots: shotsFor(title),
      links: linksFor(title),
    };
  });

const whyStudy = sites ? first(sites, 'study') : null;

/** Each screenshot opens the live site if there is one, else its source. */
function hrefFor(caption: string): string | undefined {
  const c = norm(caption);
  const match = (group: string) => allLinks.find((l) => l.group === group && c.startsWith(norm(l.label)));
  return (match('LIVE') ?? match('SOURCE'))?.href;
}

export const showcase: Showcase = {
  title: sites?.title ?? 'Websites',
  sub: sites?.sub ?? '',
  lede: sites?.lede ?? '',
  shots: allShots.map((s) => ({ ...s, href: hrefFor(s.caption) })),
  why: whyStudy?.sections ?? [],
  whyFacts: whyStudy?.metrics ?? [],
};

const aboutNode = kids.find((n) => n.kind === 'about');
const contactNode = kids.find((n) => n.kind === 'contact' && n.links?.length);

/** The WHO panel's pages, read straight through. The first is the greeting. */
const aboutParas = (aboutNode?.pages ?? []).flat();

export const about = {
  name: aboutNode?.title ?? '',
  line: aboutNode?.sub ?? '',
  greeting: aboutParas[0] ?? '',
  paras: aboutParas.slice(1),
  facts: aboutNode?.facts ?? [],
};

export const site = {
  title: WORLD.title ?? '',
  sub: WORLD.sub ?? '',
};

export const contact = {
  title: contactNode?.title ?? '',
  sub: contactNode?.sub ?? '',
  links: contactNode?.links ?? [],
};

/** Every source and live link, for the footer. */
export const repos = allLinks;

/**
 * The projects' stacks, grouped by the layer of a system they sit in. Only
 * the grouping is authored here; every entry and the projects listed against
 * it come from the stacks above, so a new project fills this in by itself.
 * Anything not named here falls into the last group.
 */
const LAYERS: { name: string; members: string[] }[] = [
  { name: 'Interface', members: ['React', 'Next.js', 'TypeScript', 'Vite', 'GSAP', 'Three.js', 'Tailwind CSS'] },
  { name: 'Services & data', members: ['Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'JWT', 'Octokit', 'LLMs', 'Cloudinary'] },
  { name: 'Infrastructure & reliability', members: ['Docker', 'Kubernetes', 'Prometheus', 'Grafana', 'Vercel', 'Linux'] },
  { name: 'Systems', members: [] },
];

export interface Skill {
  name: string;
  usedIn: string[];
}

export const stack: { name: string; skills: Skill[] }[] = (() => {
  const used = new Map<string, string[]>();
  for (const p of projects) for (const s of p.stack) used.set(s, [...(used.get(s) ?? []), p.title]);
  const placed = new Set<string>();
  const groups = LAYERS.map((layer) => {
    const skills = layer.members
      .filter((m) => used.has(m))
      .map((m) => {
        placed.add(m);
        return { name: m, usedIn: used.get(m)! };
      });
    return { name: layer.name, skills };
  });
  const rest = [...used.keys()].filter((k) => !placed.has(k));
  groups[groups.length - 1]!.skills.push(...rest.map((name) => ({ name, usedIn: used.get(name)! })));
  return groups.filter((g) => g.skills.length);
})();

export const allSkills = [...new Set(projects.flatMap((p) => p.stack))];
