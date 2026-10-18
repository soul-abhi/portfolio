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

const neopassSource = `export async function unseal(blob: Uint8Array, phrase: string) {
  const [salt, nonce, ct] = split(blob, 16, 24);

  // Argon2id, not PBKDF2: the threat model here is an attacker who has
  // already exfiltrated the vault and can spend a GPU-month on it.
  const key = await argon2id({ phrase, salt, m: 256 << 10, t: 3, p: 4 });

  try {
    return decode(await xchacha.open(key, nonce, ct));
  } finally {
    key.fill(0); // the only copy that ever existed outside the enclave
  }
}`;

const owlSource = `async def sweep(scope: Scope, budget: Budget) -> AsyncIterator[Finding]:
    seen: set[str] = set()
    queue = PriorityQueue(scope.seeds)

    # Breadth is cheap, depth is not. Rank by expected information gain so a
    # capped run still surfaces the interesting third of the surface first.
    while not queue.empty() and budget.remaining:
        host = await queue.get()
        if host.key in seen or not scope.contains(host):
            continue
        seen.add(host.key)

        async for f in probe(host, budget.lease(host.weight)):
            queue.offer(f.derived_hosts(), gain=f.novelty)
            yield f`;

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
  sub: 'Security engineering · systems · offensive tooling',
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
      portal: 'I · NEOPASS',
      index: '01',
      title: 'NEOPASS',
      sub: 'A credential vault that never learns your secret',
      year: '2025',
      role: 'Design, cryptography, implementation',
      status: 'In private beta',
      stack: ['TypeScript', 'WebCrypto', 'Argon2id', 'XChaCha20', 'SQLite'],
      lede:
        'Draft lede. One paragraph that states the actual problem in plain language and the single decision that made the project interesting. Two sentences, no more.',
      children: [
        {
          id: 'neopass-study',
          kind: 'study',
          at: [320, -130],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'NEOPASS',
          sub: 'Case file',
          sections: [
            {
              h: 'The problem',
              p: 'Draft. Describe the real constraint you were under - not the feature list. The reader should finish this paragraph understanding why the obvious approach fails.',
            },
            {
              h: 'The decision',
              p: 'Draft. The one architectural call that everything else followed from, and what it cost you. Name the thing you gave up; that is what makes it credible.',
            },
            {
              h: 'What happened',
              p: 'Draft. Outcome in concrete terms. Numbers if you have them, an honest "unresolved" if you do not.',
            },
          ],
          metrics: [
            { k: 'Derivation', v: '256 MiB · t=3 · p=4' },
            { k: 'Vault format', v: 'single-file, append-only' },
            { k: 'Server knowledge', v: 'zero' },
            { k: 'Audit', v: 'self-reviewed, pending external' },
          ],
          children: [
            {
              id: 'neopass-mech',
              kind: 'mechanism',
              at: [382, 182],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Unseal path',
              sub: 'What happens between a passphrase and plaintext',
              stages: [
                { label: 'PHRASE', detail: 'Never leaves the client. Not hashed on input, not logged, not retained after derivation.' },
                { label: 'ARGON2ID', detail: 'Memory-hard derivation sized so a commodity GPU farm gains almost nothing over a laptop.' },
                { label: 'XCHACHA20', detail: 'AEAD over the whole blob. A truncated or tampered vault fails closed, loudly.' },
                { label: 'PLAINTEXT', detail: 'Lives in one zeroed buffer for the duration of the read, then is wiped in a finally block.' },
              ],
              notes: [
                'Draft annotation. The non-obvious failure mode you hit here.',
                'Draft annotation. Why the simpler version was wrong.',
              ],
              children: [
                {
                  id: 'neopass-src',
                  kind: 'source',
                  at: [432, 238],
                  size: [1140, 520],
                  portal: 'SOURCE',
                  title: 'unseal()',
                  file: 'src/vault/unseal.ts',
                  lang: 'ts',
                  code: neopassSource,
                  children: [
                    {
                      id: 'void',
                      kind: 'marginalia',
                      at: [340, 170],
                      size: [620, 200],
                      portal: '·',
                      text: 'You zoomed five strata deep to read a finally block. We should talk. — voidsociety',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'owlsec',
      kind: 'project',
      at: [130, -405],
      size: [1120, 640],
      portal: 'II · OWL-SEC',
      index: '02',
      title: 'OWL-SEC',
      sub: 'Attack-surface reconnaissance under a fixed budget',
      year: '2025',
      role: 'Architecture, scheduler, rule engine',
      status: 'Used in live engagements',
      stack: ['Python', 'asyncio', 'Redis', 'Postgres'],
      lede:
        'Draft lede. The interesting constraint was time, not coverage - state that, and the rest of the project explains itself.',
      children: [
        {
          id: 'owlsec-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'OWL-SEC',
          sub: 'Case file',
          sections: [
            { h: 'The problem', p: 'Draft. Enumeration is unbounded and engagements are not. Explain what that does to the design.' },
            { h: 'The decision', p: 'Draft. Treat scan budget as a currency the scheduler spends, and rank hosts by expected information gain.' },
            { h: 'What happened', p: 'Draft. What the ranking bought you on a real target, and where it misled you.' },
          ],
          metrics: [
            { k: 'Concurrency', v: 'bounded per-host leases' },
            { k: 'Scope safety', v: 'deny-by-default' },
            { k: 'Resumable', v: 'yes, by frontier snapshot' },
            { k: 'Findings schema', v: 'stable, diffable' },
          ],
          children: [
            {
              id: 'owlsec-mech',
              kind: 'mechanism',
              at: [374, 198],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'The frontier',
              sub: 'How a capped sweep decides what to look at next',
              stages: [
                { label: 'SEEDS', detail: 'Operator-declared scope. Everything outside it is unreachable by construction, not by filter.' },
                { label: 'LEASE', detail: 'Each host is granted a slice of the remaining budget proportional to its weight.' },
                { label: 'PROBE', detail: 'Findings are emitted as a stream so an interrupted run is still a useful run.' },
                { label: 'OFFER', detail: 'Derived hosts re-enter the queue ranked by novelty, closing the loop.' },
              ],
              notes: ['Draft annotation. The starvation bug and the fix.', 'Draft annotation. Why novelty beat depth-first.'],
              children: [
                {
                  id: 'owlsec-src',
                  kind: 'source',
                  at: [424, 250],
                  size: [1140, 520],
                  portal: 'SOURCE',
                  title: 'sweep()',
                  file: 'owlsec/engine/sweep.py',
                  lang: 'py',
                  code: owlSource,
                },
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
      sub: 'Secrets do not leave when you delete the line',
      year: '2024',
      role: 'Author',
      status: 'Open source',
      stack: ['Go', 'libgit2', 'Shannon entropy'],
      lede: 'Draft lede. A scanner that reads history rather than the working tree, and why that distinction is the whole tool.',
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
            { h: 'The problem', p: 'Draft. A removed credential is a committed credential. Most tooling scans the wrong snapshot.' },
            { h: 'The decision', p: 'Draft. Walk patches, not trees, and pay the cost of a full history traversal to get it right.' },
            { h: 'What happened', p: 'Draft. False-positive rate, and the fixture heuristic that made the output readable by humans.' },
          ],
          metrics: [
            { k: 'Traversal', v: 'patch-level, all refs' },
            { k: 'Signal gate', v: 'rule match + entropy floor' },
            { k: 'Throughput', v: 'draft: n commits/s' },
            { k: 'Output', v: 'commit · rule · line' },
          ],
          children: [
            {
              id: 'gitrix-mech',
              kind: 'mechanism',
              at: [390, 168],
              size: [1280, 720],
              portal: 'MECHANISM',
              title: 'Two gates',
              sub: 'Why one filter is never enough',
              stages: [
                { label: 'PATCH', detail: 'Added lines only. A deletion is someone else’s problem; an addition is the leak.' },
                { label: 'RULE', detail: 'Shape match for known credential formats. High recall, deliberately poor precision.' },
                { label: 'ENTROPY', detail: 'The second gate. Kills the example keys, the docs, the test fixtures, the placeholders.' },
                { label: 'EMIT', detail: 'Stable identifiers so the same finding is the same finding across runs.' },
              ],
              notes: ['Draft annotation. The fixture problem.', 'Draft annotation. What entropy alone gets wrong.'],
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
      portal: 'IV · SKILLWALLET',
      index: '04',
      title: 'SKILLWALLET',
      sub: 'Credentials you can verify without phoning home',
      year: '2025',
      role: 'Protocol design, frontend',
      status: 'Prototype',
      stack: ['TypeScript', 'Ed25519', 'IndexedDB'],
      lede: 'Draft lede. What a verifiable credential has to prove, and to whom, before any of it is useful.',
      children: [
        {
          id: 'skill-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'SKILLWALLET',
          sub: 'Case file',
          sections: [
            { h: 'The problem', p: 'Draft. Verification that requires a live issuer is not verification, it is a dependency.' },
            { h: 'The decision', p: 'Draft. Offline-first signatures, revocation as a published set rather than a lookup.' },
            { h: 'What happened', p: 'Draft. Where the model held and where revocation latency bit.' },
          ],
          metrics: [
            { k: 'Signature', v: 'Ed25519 detached' },
            { k: 'Verification', v: 'fully offline' },
            { k: 'Revocation', v: 'published accumulator' },
            { k: 'Storage', v: 'local, exportable' },
          ],
        },
      ],
    },

    {
      id: 'voidctf',
      kind: 'project',
      at: [400, 360],
      size: [1120, 640],
      portal: 'V · VOIDCTF',
      index: '05',
      title: 'VOIDCTF',
      sub: 'A capture-the-flag platform that survives its own players',
      year: '2024',
      role: 'Infrastructure, challenge isolation',
      status: 'Ran two events',
      stack: ['Docker', 'nsjail', 'Node', 'Traefik'],
      lede: 'Draft lede. The hard part of a CTF platform is not scoring, it is that every participant is actively attacking you.',
      children: [
        {
          id: 'void-study',
          kind: 'study',
          at: [300, -120],
          size: [1320, 780],
          portal: 'CASE FILE',
          title: 'VOIDCTF',
          sub: 'Case file',
          sections: [
            { h: 'The problem', p: 'Draft. Hostile users with shell access by design. State the isolation requirement that follows.' },
            { h: 'The decision', p: 'Draft. One disposable namespace per attempt, no shared writable state, aggressive reaping.' },
            { h: 'What happened', p: 'Draft. What broke during the live event and what you changed at 2am.' },
          ],
          metrics: [
            { k: 'Isolation', v: 'per-attempt namespace' },
            { k: 'Teardown', v: 'unconditional, timed' },
            { k: 'Events run', v: '2' },
            { k: 'Escapes', v: 'draft: none observed' },
          ],
        },
      ],
    },

    {
      id: 'denox',
      kind: 'project',
      at: [-120, 400],
      size: [1120, 640],
      portal: 'VI · DE-NOX',
      index: '06',
      title: 'DE-NOX',
      sub: 'Reading JavaScript that was written to be unreadable',
      year: '2024',
      role: 'Author',
      status: 'Tooling, internal',
      stack: ['TypeScript', 'AST', 'partial evaluation'],
      lede: 'Draft lede. Obfuscation is a transformation, and most transformations have an inverse if you are patient.',
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
            { h: 'The problem', p: 'Draft. String arrays, control-flow flattening, dead branches. Name what you actually had to undo.' },
            { h: 'The decision', p: 'Draft. Partial evaluation over the AST instead of pattern-matching known packers.' },
            { h: 'What happened', p: 'Draft. The sample it could not recover, and why.' },
          ],
          metrics: [
            { k: 'Passes', v: 'draft: n, fixpoint' },
            { k: 'Approach', v: 'partial evaluation' },
            { k: 'Scope', v: 'ES2020 subset' },
            { k: 'Correctness', v: 'differential against original' },
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
      title: 'Abhishek',
      sub: 'Full stack developer',
      pages: [
        [
          'Hello, {visitor}!',
          'First things first, let me introduce myself. I’m a man of my word, a full-stack developer by profession, and a professional overthinker by choice. I build things based on my own ideas, with AI as my coding sidekick — not my replacement. Yes, there’s a difference.',
          'And no, this portfolio isn’t a reference I copied from somewhere. Every idea, interaction, and detail comes from my own imagination. Basically, this is what happens when a developer is given too much creative freedom and absolutely no supervision.',
        ],
        [
          'Feel free to explore the next panels to check out some of my projects. I’m also working on Chaos Engineering right now, which happens to be my favourite project to date. It’s all about breaking things intentionally so they don’t break unexpectedly. Pretty ironic for someone who spends hours fixing bugs.',
          'Anyway, have a look around. I hope you like what you see — and if you don’t, at least appreciate the loading animation.',
        ],
      ],
      facts: [
        { k: 'Based', v: 'Somewhere in the cloud' },
        { k: 'Focus', v: 'Cloud-native backend, chaos engineering' },
        { k: 'Now', v: 'Making a centralized dependency manager for distributed systems' },
        { k: 'Reading', v: 'The Art of Being Alone' },
      ],
    },

    {
      id: 'contact',
      kind: 'contact',
      at: [-560, 300],
      size: [1040, 560],
      portal: 'REACH',
      title: 'Open channels',
      sub: 'All of these reach me. The first one reaches me fastest.',
      links: [
        { label: 'Mail', value: 'voidsociety@kiet.edu', href: 'mailto:voidsociety@kiet.edu' },
        { label: 'GitHub', value: 'draft/handle', href: '#' },
        { label: 'Signal', value: 'on request', href: '#' },
        { label: 'PGP', value: 'draft fingerprint', href: '#' },
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
