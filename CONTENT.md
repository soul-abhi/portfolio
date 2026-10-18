# Replacing the draft copy

Everything written on the site lives in one file: `src/world/content.ts`.
You never touch layout, CSS or geometry to change content.

The six project names were taken from directory names on this machine purely as
stand-ins. Nothing currently written about them is a claim about what they
actually do — **all of it is draft**.

---

## 1. The shape of the world

The site is a tree. Depth in the tree is depth in the zoom:

```
root                     stratum I    the surface, your name
└── project              stratum II   the plate: name, one line, stack
    └── study            stratum III  the case file: problem / decision / outcome
        └── mechanism    stratum IV   how one part actually works
            └── source   stratum V    the code
```

Each stratum is `ZOOM_STEP` (6x) smaller than its parent. You do not have to
fill all five for every project — two of the six currently stop at `study`, and
that asymmetry reads as honest rather than unfinished.

## 2. Positioning

- `at: [x, y]` — offset from the **parent's** centre, in the parent's design
  pixels. This is where the child plate lives, and where the parent draws the
  marker that advertises it.
- `size: [w, h]` — the node's own design size.

The only rule: put `at` somewhere the parent's own content is not. A child
plate fades in **inside** its parent, so if you drop it on a paragraph it will
crossfade on top of that paragraph. The current offsets are already placed in
each layout's empty region — if you keep the same plate sizes you can leave
them alone.

Mobile ignores `at` entirely and re-composes the surface as an index column, so
you never have to think about phone positioning.

## 3. The replacement checklist

**Per project** (`kind: 'project'`)
- [ ] `title`, `sub` — the name and one honest line. The `sub` is set in italic
      serif at display size; it is the most-read sentence on the whole site.
- [ ] `index` — `01`..`06`, shown large in red
- [ ] `year`, `role`, `status` — `status` is the rotated stamp, keep it short
- [ ] `stack` — 4–6 entries, they render as hairline chips
- [ ] `lede` — two sentences. Problem, then the one interesting decision.

**Per case file** (`kind: 'study'`)
- [ ] `sections` — keep the three-beat structure: the problem / the decision /
      what happened. Name what you gave up in "the decision" — that is the part
      that makes it credible.
- [ ] `metrics` — four rows. Concrete values, not adjectives.

**Per mechanism** (`kind: 'mechanism'`)
- [ ] `title`, `sub` — name the process, not the project
- [ ] `stages` — exactly four reads best across the rail
- [ ] `notes` — the non-obvious failure you hit. Two lines.

**Per source** (`kind: 'source'`)
- [ ] `file`, `lang` (`ts` | `py` | `go`), `code`
- [ ] Keep it **under ~14 lines**. The plate is sized for that, and a short
      excerpt with a real comment in it beats a long one nobody reads.

**Once**
- [ ] `root.title` / `root.sub`
- [ ] `about` — see the WHO panel section below
- [ ] `contact.links` — GitHub handle and PGP fingerprint are still `draft`
- [ ] The two `marginalia` notes (one is five strata deep inside `neopass-src`)

### The WHO panel

First person, and the only panel on the site that should sound like a person
rather than an instrument. It is built to hold:

- [ ] `title` — your name, set large in serif
- [ ] `sub` — one line of positioning. What you do, not a job title.
- [ ] `paras` — 2–3 paragraphs, in this order:
      1. what you actually do, in plain language
      2. the evidence — how you got here, named concretely
      3. what you want next — the only persuasive line on the site
- [ ] `facts` — four rows: `Based`, `Focus`, `Now`, `Reading`. Keep `Now`
      current; a stale one is worse than none.
- [ ] `links` — 3–4 entries along the bottom edge. `label` is the small red
      type, `value` is what is set beside it. Anything starting `http` opens
      in a new tab; `mailto:` does not.

The plate is `1160 × 760` design px. Three paragraphs plus four facts plus one
row of links fills it; a fourth paragraph will crowd the facts column.

## 4. When the copy is real

Delete the draft stamp — one line in `src/layers/hud.ts`:

```html
<span class="draft">DRAFT COPY</span>
```

## 5. Adding or removing a project

Add or delete a `kind: 'project'` entry under `root.children`. Then:

- renumber the `index` fields,
- give it an `at` that does not collide with its neighbours on the surface,
- keyboard shortcuts `1`–`6` map to projects in tree order, so if you go past
  six, widen the range in `src/core/input.ts` (`n >= 1 && n <= 6`).

Nothing else needs to change. The camera, the level-of-detail system and the
URL routing all derive from the tree.
