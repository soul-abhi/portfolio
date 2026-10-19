/**
 * ============================================================================
 *  THIS FILE IS THE ENTIRE SITE'S CONTENT.  ALL COPY BELOW IS DRAFT.
 * ============================================================================
 *  Every string here is placeholder written to the right length and rhythm so
 *  the layout can be judged for real. Swap the words, keep the shapes. The six
 *  project names were taken from directory names on this machine purely as
 *  stand-ins - nothing here is a claim about what those projects actually do.
 *
 *  See CONTENT.md for the replacement checklist, and delete the DRAFT stamp in
 *  src/layers/hud.ts once the real copy is in.
 * ============================================================================
 */

import type { NodeSpec } from './types';

const gitrixSource = `func (h *Hunter) walk(ctx context.Context, repo *git.Repository) error {
	// Secrets live in the diff, not the tree. A credential committed and then
	// "removed" is still sitting in history, which is the whole point.
	return repo.Commits(ctx, func(c *git.Commit) error {
		for _, patch := range c.Patches() {
			for _, hunk := range patch.Added() {
				for _, m := range h.rules.Match(hunk.Text) {
					if h.entropy(m.Value) < h.floor || h.isKnownFixture(m) {
						continue
					}
					h.emit(Finding{Commit: c.Hash, Rule: m.Rule, Line: hunk.Line})
				}
			}
		}
		return nil
	})
}`;

export const WORLD: NodeSpec = {
  id: 'root',
  kind: 'root',
  size: [1800, 1000],
  title: 'ABHISHEK',
  sub: 'Full-stack development · DevOps · system reliability',
  // The surface reads as one route in a loose ring round the name, clockwise
  // from who on the left, through I-VI, to reach at the lower left. The ring
  // is deliberately uneven, but every marker keeps clear of the title block
  // (roughly x ±520, y ±235 here). Scrolling travels it in that order (see the
  // rail in main.ts).
  children: [
    {
      id: 'neopass',
      kind: 'project',
      at: [-330, -370],
      size: [1120, 640],
      portal: 'I · ENTROPY_CHAOS',
      index: '01',
      title: 'ENTROPY_CHAOS',
      sub: 'Decides whether a system can safely withstand injected failures',
      year: '2025–2026',
      role: 'Solo developer, system design',
      status: 'Complete, evolving',
      stack: ['Node.js', 'Express', 'Docker', 'Kubernetes', 'Prometheus', 'Grafana'],
      lede:
        'Traditional chaos engineering injects failures on a schedule, often without checking whether a system can tolerate them. ENTROPY_CHAOS introduces an explainable risk gate that evaluates live service health before authorizing pod deletion, blocking experiments when the system is unstable or observability is unavailable.',
      children: [
        {
          id: 'neopass-study',
          kind: 'study',
          at: [320, -130],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'ENTROPY_CHAOS',
          sub: 'Case file',
          sections: [
            {
              h: 'The problem',
              p: 'Scheduled fault injection can destabilize services that are already unhealthy, while missing telemetry can make the system’s true condition unclear.',
            },
            {
              h: 'The decision',
              p: 'Use a weighted Resilience Risk Score based on latency, error rate, CPU, and memory, with a fail-closed policy and a recovery cooldown.',
            },
            {
              h: 'What happened',
              p: 'A monitoring-to-decision-to-recovery workflow with four risk classifications, least-privilege access, a campaign harness, and 13 zero-dependency regression tests.',
            },
          ],
          metrics: [
            { k: 'Live signals', v: '4 health metrics' },
            { k: 'Risk classes', v: '4 classifications' },
            { k: 'Cooldown', v: '90 seconds minimum' },
            { k: 'Regression tests', v: '13 passing' },
          ],
          children: [
            {
              id: 'neopass-mech',
              kind: 'mechanism',
              at: [382, 182],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Risk gate',
              sub: 'How live health becomes a decision to inject a failure',
              stages: [
                { label: 'MONITOR', detail: 'Prometheus scrapes service metrics every five seconds to keep the risk engine informed about current health.' },
                { label: 'SCORE', detail: 'The engine normalizes four health signals into a weighted Resilience Risk Score from 0 to 100.' },
                { label: 'GATE', detail: 'Chaos is permitted only when the score is below 40, metrics are available, and the cooldown has expired.' },
                { label: 'RECOVER', detail: 'Kubernetes recreates the deleted pod while the system records the decision and continues monitoring recovery.' },
              ],
              notes: [
                'Latency has the highest individual weight in the risk calculation, alongside error rate, CPU, and memory.',
                'Missing or degraded observability fails closed, preventing a chaos action when the system’s condition is unknown.',
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'denox',
      kind: 'project',
      at: [130, -405],
      size: [1120, 640],
      portal: 'II · DE-NOX',
      index: '02',
      title: 'DE-NOX',
      sub: 'Reclaims disk space without sacrificing active projects',
      year: '2026',
      role: 'Solo developer',
      status: 'Working CLI',
      stack: ['Rust', 'Ratatui', 'Crossterm', 'Walkdir', 'Linux'],
      lede:
        'Development directories accumulate regenerable dependencies and build artifacts that consume disk space. DE-NOX scans project activity rather than relying on artifact timestamps alone, then presents cleanup candidates for review before deletion.',
      children: [
        {
          id: 'denox-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'DE-NOX',
          sub: 'Case file',
          sections: [
            {
              h: 'The problem',
              p: 'Large development workspaces accumulate node_modules, build output, and framework caches, while artifact timestamps can misrepresent whether a project is still active.',
            },
            {
              h: 'The decision',
              p: 'Scan directories without following symbolic links, assess project activity while excluding known artifact directories, and revalidate eligibility before deletion.',
            },
            {
              h: 'What happened',
              p: 'A terminal-based cleanup workflow with candidate review, safeguards, and a documented scan that identified potential reclaimable space in a real home-directory tree.',
            },
          ],
          metrics: [
            { k: 'Directories scanned', v: '8,859 directories' },
            { k: 'Potential space', v: '11.2 GB reclaimable' },
            { k: 'Candidates found', v: '390 directories' },
            { k: 'Test suite', v: '22 passing tests' },
          ],
          children: [
            {
              id: 'denox-mech',
              kind: 'mechanism',
              at: [382, 182],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Cleanup pass',
              sub: 'How a directory earns its way onto the delete list',
              stages: [
                { label: 'SCAN', detail: 'Walk the selected filesystem tree, identify known artifact directories, and avoid following symbolic links.' },
                { label: 'ASSESS', detail: 'Evaluate project activity using modification times while excluding artifact directories that could distort the activity signal.' },
                { label: 'REVIEW', detail: 'Show cleanup candidates and protected directories so the user can inspect the proposed actions before proceeding.' },
                { label: 'CONFIRM', detail: 'Revalidate candidate eligibility and path containment before deletion to reduce the risk of removing the wrong files.' },
              ],
              notes: [
                'Dependency-folder timestamps can be misleading, so activity assessment considers the surrounding project rather than the artifact alone.',
                'Unreadable timestamps and filesystem errors should be treated conservatively to avoid unsafe cleanup decisions.',
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'gitrixhunt',
      kind: 'project',
      at: [620, -350],
      size: [1120, 640],
      portal: 'III · GITRIXHUNT',
      index: '03',
      title: 'GITRIXHUNT',
      sub: 'Finds beginner-friendly open-source issues beyond labels',
      year: '2026',
      role: 'Solo developer, full stack',
      status: 'In development',
      stack: ['Next.js', 'TypeScript', 'PostgreSQL', 'Octokit', 'LLMs', 'Vercel'],
      lede:
        'Open-source issue labels can be stale, ambiguous, or misleading for newcomers trying to find approachable work. GitrixHunt combines scheduled issue ingestion, rule-based filtering, and LLM-assisted scoring to help developers discover issues using richer signals than labels alone.',
      children: [
        {
          id: 'gitrix-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'GITRIXHUNT',
          sub: 'Case file',
          sections: [
            {
              h: 'The problem',
              p: 'Beginner contributors can waste time on issues that are already assigned, closed, poorly described, or more difficult than their labels suggest.',
            },
            {
              h: 'The decision',
              p: 'Separate scheduled ingestion and scoring from the browsing path, store precomputed results in PostgreSQL, and generate contextual guidance on demand with content-hash caching.',
            },
            {
              h: 'What happened',
              p: 'A two-path architecture designed to reduce repeated GitHub and LLM calls while surfacing scored issues with estimated difficulty, required skills, time, category, reasoning, and potential red flags.',
            },
          ],
          metrics: [
            { k: 'Batch scoring', v: 'About 20 issues per call' },
            { k: 'Beginner score', v: '0–100 scale' },
            { k: 'Architecture', v: '2 separate paths' },
            { k: 'Guide caching', v: 'Content-hash based' },
          ],
          children: [
            {
              id: 'gitrix-mech',
              kind: 'mechanism',
              at: [390, 168],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Scoring pipeline',
              sub: 'How a raw issue becomes a scored, guided recommendation',
              stages: [
                { label: 'INGEST', detail: 'A scheduled worker fetches repository issues and stores candidate records for processing.' },
                { label: 'FILTER', detail: 'Rule-based checks remove closed, assigned, archived, empty, and pull-request-linked issues before expensive scoring.' },
                { label: 'SCORE', detail: 'An LLM evaluates batches of issues and records a beginner score, difficulty, skills, time estimate, category, reasoning, and red flags.' },
                { label: 'GUIDE', detail: 'When a contributor opens an issue, the system generates contextual guidance and caches it by content hash to avoid unnecessary regeneration.' },
              ],
              notes: [
                'PostgreSQL acts as the durable processing queue, using unscored records to identify work that remains to be processed.',
                'Background ingestion and scoring are kept separate from the browsing path to limit expensive work during user requests.',
              ],
              children: [
                {
                  id: 'gitrix-src',
                  kind: 'source',
                  at: [438, 228],
                  size: [1140, 520],
                  portal: 'SOURCE',
                  title: 'walk()',
                  file: 'internal/hunt/walk.go',
                  lang: 'go',
                  code: gitrixSource,
                },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'skillwallet',
      kind: 'project',
      at: [690, 40],
      size: [1120, 640],
      portal: 'IV · BIXBEE',
      index: '04',
      title: 'BIXBEE',
      sub: 'Express emotions anonymously through immersive interactive experiences',
      year: '2026',
      role: 'Frontend developer',
      status: 'Frontend prototype',
      stack: ['React', 'Vite', 'GSAP', 'Three.js', 'Tailwind CSS'],
      lede:
        'Bixbee explores anonymous emotional expression through an immersive, interaction-led web experience. Its frontend combines editorial styling, scroll-driven storytelling, and WebGL visuals to make the interface feel more like a guided experience than a conventional content page.',
      children: [
        {
          id: 'skill-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'BIXBEE',
          sub: 'Case file',
          sections: [
            {
              h: 'The problem',
              p: 'Conventional web layouts can feel static and impersonal when the intended experience depends on emotion, discovery, and a sense of progression.',
            },
            {
              h: 'The decision',
              p: 'Combine React and Vite with GSAP-driven motion, Three.js visuals, and a responsive layout to build a more expressive interface.',
            },
            {
              h: 'What happened',
              p: 'A frontend prototype centered on scroll-based reveals and interactive visual elements, with responsive behavior and explicit lifecycle cleanup for animation and rendering resources.',
            },
          ],
          metrics: [
            { k: 'Frontend', v: 'React and Vite' },
            { k: 'Motion system', v: 'GSAP ScrollTrigger' },
            { k: '3D visuals', v: 'Three.js WebGL' },
            { k: 'Styling', v: 'Tailwind CSS' },
          ],
          children: [
            {
              id: 'skill-mech',
              kind: 'mechanism',
              at: [382, 182],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Experience flow',
              sub: 'How the interface paces a visitor through the story',
              stages: [
                { label: 'INTRODUCE', detail: 'Establish the experience with an editorial interface that frames anonymous emotional expression as the central interaction.' },
                { label: 'REVEAL', detail: 'Use scroll-driven animation to reveal content progressively and create a more deliberate visual rhythm.' },
                { label: 'INTERACT', detail: 'Combine interface controls and WebGL visuals to give the experience a more dynamic, exploratory feel.' },
                { label: 'ADAPT', detail: 'Adjust the presentation for smaller screens, replacing desktop-oriented pinned storytelling with a more suitable stacked layout.' },
              ],
              notes: [
                'Desktop storytelling can use pinned scroll sections, while mobile layouts should prioritize a readable stacked flow.',
                'Animation callbacks and WebGL resources require explicit cleanup to avoid lingering work after components unmount.',
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'voidctf',
      kind: 'project',
      at: [400, 360],
      size: [1120, 640],
      portal: 'V · SHANTIKUNJ LMS',
      index: '05',
      title: 'SHANTIKUNJ LMS',
      sub: 'Coordinates audiobook production from translation to publication',
      year: '2024',
      role: 'Full-stack developer',
      status: 'Application prototype',
      stack: ['React', 'Express', 'MongoDB', 'JWT', 'Cloudinary'],
      lede:
        'Shantikunj Audiobooks LMS organizes audiobook production into a role-based workflow that moves from source-book setup and text translation through review, recording, audio checks, and publication. It provides dedicated work queues and permissions for each stage of the process.',
      children: [
        {
          id: 'void-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'SHANTIKUNJ LMS',
          sub: 'Case file',
          sections: [
            {
              h: 'The problem',
              p: 'Audiobook production involves multiple contributors and review stages, making handoffs, ownership, and approval status difficult to coordinate without a shared workflow.',
            },
            {
              h: 'The decision',
              p: 'Model the process as staged tasks with role-based authorization, claim and lock behavior, review actions, and support for file uploads or external links.',
            },
            {
              h: 'What happened',
              p: 'A documented eight-step workflow across six defined roles, with role-specific dashboards and a unified work queue for managing translation and audio production.',
            },
          ],
          metrics: [
            { k: 'Workflow roles', v: '6 defined roles' },
            { k: 'Process stages', v: '8 documented steps' },
            { k: 'Application layers', v: '2 major layers' },
            { k: 'Backend', v: 'Express API' },
          ],
          children: [
            {
              id: 'void-mech',
              kind: 'mechanism',
              at: [382, 182],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Production workflow',
              sub: 'How a book moves from registration to a published audiobook',
              stages: [
                { label: 'REGISTER', detail: 'The Central Team adds a book and initiates the audiobook production workflow.' },
                { label: 'TRANSLATE', detail: 'A Text Translator claims the task and submits translated text as a file or link.' },
                { label: 'REVIEW', detail: 'Text Checkers and SPOCs review submissions, request corrections when needed, and move approved work forward.' },
                { label: 'PUBLISH', detail: 'Recorders submit audio, Audio Checkers and SPOCs complete reviews, and the Central Team publishes approved work.' },
              ],
              notes: [
                'Users can hold multiple roles, so permissions must be checked against the specific action rather than a single fixed role.',
                'Cloudinary can support media uploads, while link-based submissions provide an alternative workflow.',
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'owlsec',
      kind: 'project',
      at: [-120, 400],
      size: [1120, 640],
      portal: 'VI · WEBSITES',
      index: '06',
      title: 'WEBSITES',
      sub: 'Everything I’ve built, all in one place',
      year: '2025',
      role: 'Draft. e.g. Design and development',
      status: 'Draft status',
      stack: ['Draft', 'stack', 'entries'],
      lede:
        'These are snapshots of my projects, and the URLs are there for you to explore. Feel free to navigate through them, investigate how things work, and see what I’ve built for yourself. Every project you see here is mine, built from my own ideas and execution.',
      children: [
        {
          id: 'owlsec-showcase',
          kind: 'gallery',
          at: [300, -120],
          size: [1320, 780],
          portal: 'SHOWCASE',
          title: 'WEBSITES',
          shots: [
            { src: '/clients/voidctf.webp', alt: 'VOID CTF landing page', caption: 'VOID CTF', wide: true },
            { src: '/clients/root2rise.webp', alt: 'Root2Rise landing page', caption: 'Root2Rise' },
            { src: '/clients/bixbee.webp', alt: 'BIXBEE landing page', caption: 'BIXBEE' },
            { src: '/clients/gitrixhunt.webp', alt: 'GitrixHunt landing page', caption: 'GitrixHunt' },
            { src: '/clients/blockcraft.webp', alt: 'BlockCraft Realms landing page', caption: 'BlockCraft Realms' },
            {
              src: '/clients/entropy-chaos.webp',
              alt: 'ENTROPY_CHAOS risk gate dashboard in Grafana',
              caption: 'ENTROPY_CHAOS · Risk Gate',
              wide: true,
            },
            { src: '/clients/blockcraft-mechanics.webp', alt: 'BlockCraft Realms mechanics section', caption: 'BlockCraft · Mechanics' },
            { src: '/clients/gitrixhunt-guide.webp', alt: 'GitrixHunt AI guide section', caption: 'GitrixHunt · AI Guide' },
            { src: '/clients/denox.webp', alt: 'DE-NOX terminal cleanup interface', caption: 'DE-NOX' },
          ],
          children: [
            {
              id: 'owlsec-study',
              kind: 'study',
              // The empty bottom-right cell of the 4x3 shot grid.
              at: [450, 234],
              size: [1320, 780],
              portal: 'WHY ?',
              label: 'WHY ?',
              title: 'WEBSITES',
              sections: [
                {
                  h: 'Why build them?',
                  p: 'Tutorials promised “real projects” and delivered a to-do app. So I built a Minecraft gallery, a CTF platform, and a node_modules shredder instead.',
                },
                {
                  h: 'Why not a template?',
                  p: 'Templates are great if you want to look like four thousand other sites. I fought my own CSS at 3am instead and called it a design decision.',
                },
                {
                  h: 'Why should you care?',
                  p: 'Honestly, you shouldn’t. But you zoomed this far, so the links are one level down. If something breaks, congrats: you found my next bug.',
                },
              ],
              metrics: [
                { k: 'Clients', v: 'None. I am the client.' },
                { k: 'Live sites', v: '5, last time I checked' },
                { k: 'Repositories', v: '6, commits unreviewed' },
                { k: 'Sleep schedule', v: 'Deprecated' },
              ],
              children: [
                {
                  id: 'owlsec-links',
                  kind: 'contact',
                  at: [382, 182],
                  size: [1320, 780],
                  portal: 'LINKS',
                  label: 'LINKS',
                  title: 'Live & source',
                  sub: 'Open them up and look around.',
                  links: [
                    { group: 'LIVE', label: 'BlockCraft', value: 'minecraft-showcase.netlify.app', href: 'https://minecraft-showcase.netlify.app/' },
                    { group: 'LIVE', label: 'Shantikunj LMS', value: 'shantikunj-lms.netlify.app', href: 'https://shantikunj-lms.netlify.app/home' },
                    { group: 'LIVE', label: 'BIXBEE', value: 'bixbee.netlify.app', href: 'https://bixbee.netlify.app/' },
                    { group: 'LIVE', label: 'VOID CTF', value: 'ctf.void-society.in', href: 'http://ctf.void-society.in/' },
                    { group: 'LIVE', label: 'Root2Rise', value: 'root2rise.co.in', href: 'https://root2rise.co.in/' },
                    { group: 'SOURCE', label: 'BIXBEE', value: 'soul-abhi/bixbee', href: 'https://github.com/soul-abhi/bixbee' },
                    { group: 'SOURCE', label: 'ENTROPY_CHAOS', value: 'soul-abhi/entropy_chaos', href: 'https://github.com/soul-abhi/entropy_chaos' },
                    { group: 'SOURCE', label: 'GitrixHunt', value: 'soul-abhi/gitrixhunt', href: 'https://github.com/soul-abhi/gitrixhunt' },
                    { group: 'SOURCE', label: 'DE-NOX', value: 'soul-abhi/de-nox', href: 'https://github.com/soul-abhi/de-nox' },
                    { group: 'SOURCE', label: 'TarnishTab', value: 'soul-abhi/TarnishTab', href: 'https://github.com/soul-abhi/TarnishTab' },
                    { group: 'SOURCE', label: 'BlockCraft', value: 'soul-abhi/minecraft-showcase', href: 'https://github.com/soul-abhi/minecraft-showcase' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'about',
      kind: 'about',
      at: [-640, -170],
      size: [1160, 760],
      portal: 'WHO',
      title: 'Abhishek Kumar',
      sub: 'Building resilient systems and expressive interfaces with engineering precision',
      pages: [
        [
          'Hello, {visitor}!',
          'I’m a computer science student and full-stack developer interested in building practical tools, resilient systems, and expressive web experiences. My work spans interactive frontend engineering, backend workflows, and reliability-focused tooling.',
        ],
        [
          'I’m currently exploring the intersection of developer experience, system reliability, and thoughtful interface design. Projects such as ENTROPY_CHAOS, GitrixHunt, and DE-NOX reflect my interest in solving concrete engineering problems rather than building demos for appearance alone.',
        ],
      ],
      facts: [
        { k: 'Based', v: 'Ghaziabad, Uttar Pradesh, India' },
        { k: 'Focus', v: 'Full-stack development, DevOps, and system reliability' },
        { k: 'Interests', v: 'Developer tools and chaos engineering' },
        { k: 'Reading', v: 'Thinking, Fast and Slow' },
      ],
    },

    {
      id: 'contact',
      kind: 'contact',
      at: [-560, 300],
      size: [1040, 680],
      portal: 'REACH',
      title: 'Open channels',
      sub: 'All of these reach me. The first one reaches me fastest.',
      links: [
        { label: 'GitHub', value: 'github.com/soul-abhi', href: 'https://github.com/soul-abhi' },
        { label: 'LinkedIn', value: 'in/soul-bot', href: 'https://www.linkedin.com/in/soul-bot/' },
        { label: 'Mail', value: 'iamabhisheksingh28@gmail.com', href: 'mailto:iamabhisheksingh28@gmail.com' },
        { label: 'Instagram', value: '@soul.shreyash', href: 'https://www.instagram.com/soul.shreyash/' },
        { label: 'WhatsApp', value: '+91 70783 66938 · WhatsApp only', href: 'https://wa.me/917078366938' },
      ],
    },

    {
      id: 'field-note',
      kind: 'marginalia',
      at: [-790, 450],
      size: [700, 180],
      text: 'Everything on this plane is one surface. Nothing here is a page.',
    },
  ],
};
