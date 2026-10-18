# ZOOM

A portfolio with no pages.

The whole site is one infinite plane, and zoom level *is* information depth.
Far out you see a constellation of six systems; zoom into one and it unfolds
into a plate, then a case file, then the mechanism, then the source. Five
strata, one continuous surface, no page loads and no scroll sections.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run typecheck
```

Content lives entirely in `src/world/content.ts`. See **CONTENT.md** for the
replacement checklist — all copy currently in the repo is draft.

---

## The front door

The site opens on solid black. A summoning wind spins up — long arcs of air
spiralling around the spot — and the samurai materialises inside it, katana in
its scabbard. He draws, cuts twice, and the screen itself falls apart along the
cuts onto the world behind. It is not a preloader sitting in front of the site:
the world is live underneath from the first frame, and the break is what
releases the camera.

```
0.00s  solid black
0.14s  the wind jutsu begins: long arcs spiral around the spot he will take
0.65s  the burst: ring, gust and flash; his pixels begin to arrive in it
1.08s  fully formed, the vortex still settling
       ── he stands here until the site is actually ready (min 1.46s) ──
+0.00  the right hand settles on the tsuka; the thumb breaks the seal
+0.28  the coil: weight drops onto the front leg, a red glow builds at the scabbard mouth
+0.44  the iai dash: he launches across the screen, drawing as he goes, red afterimages behind him
+0.47  first cut: the draw, rising left to right across the top of the screen
+0.56  he skids past his mark, dust off the front foot
+0.76  he turns on the vertical blade and winds up over the shoulder
+0.85  second cut: kesa-giri, falling right to left to the bottom-left corner
+1.00  chiburi: the blade is snapped clean
+1.20  noto: slid home slowly, the last of it with a snap
+1.43  on the click the cuts become physical: three pieces part along them
+1.71  the pieces fall, tumbling in 3D, heavier ones slower, fading as they go
+1.86  the samurai fades from his finishing pose
+2.97  the last piece clears; the constellation has already landed
```

**The summon is the opening.** Seven long wind strokes spiral around the centre
on the smooth overlay, with dust and chakra motes riding them, then a ring, a
radial gust and a flash land at the moment the samurai's pixels arrive. The
idle clock starts on the first painted frame, not at module load, so time spent
building the atlas or loading fonts cannot eat the ceremony.

**The swing is staged like a cut, not a swing.** The coil is held; the strike
lasts about four frames and accelerates (a cubic ease-in) instead of easing out
of the wind-up; the lean, crouch and feet all commit to it. After contact the
blade decelerates through a follow-through, then whips back up for the second
cut, which mirrors the first across the body. On each strike the blade leaves an
anime smear: its last few atlas positions are drawn as an additive fan of
white-and-red streaks under the figure, so the arc reads in the handful of
frames the cut actually lasts.

**Two resolutions, on purpose.** The sprite is blitted 1:1 into a
low-resolution canvas whose cells are exactly one sprite pixel, and the
fragments are carved from that same grid, so the character and the debris share
one pixel scale. The cuts are light, not sprite: they are drawn on a
full-resolution overlay with anti-aliased strokes — a white-hot core, a red
neon edge, a faint haze — because the light off a blade is not made of square
pixels. The lit edges of the pieces are drawn the same way, at device
resolution, so the cut stays smooth while the piece tumbles.

**The cuts are the fragment boundaries, not lines drawn over them.** Each cut
is a quadratic arc whose control point lies between its endpoints in x, so it
is a function of x and every cell is unambiguously above or below it. Two
non-crossing diagonals — one left-to-right across the top, one right-to-left
across the bottom — divide the screen into three regions with no polygon
clipping at all. The same curves drive the live slash, the residual seam and
the lit edges of the pieces; each piece's edge is clipped to its own side of
the cut.

Each live cut has a white-hot core, a red neon edge and a faint haze, tapers at
its tail and at both screen edges, carries a hot point at its head, and sheds a
sparse, deterministic scatter of pixels. It is drawn additively and
anti-aliased; the pixel sparks are the only part of the effect that stays on
the cell grid.

**The pieces are real.** Each is its own pair of canvases — black body, lit
edge — inside a wrapper with explicit translation, rotation on all three axes,
and opacity. They part along the cuts first, then fall, lowest first; heavier
pieces rotate less and fall longer. The lit edge holds through the separation,
then dims ahead of the piece itself.

**The stillness is the loading state.** He does not move until the world has
painted and the fonts have landed (capped at 1.5s, so a slow font CDN can never
strand anyone), and until every frame of him has been rasterised. There is no
loading bar and no fake percentage.

It plays once per session (`sessionStorage`), any key or click jumps to the
first cut, and `prefers-reduced-motion` gets a 280ms curtain with no fracture.
Everything is seeded, so every run cuts the same screen the same way. In every
path the overlay is removed from the DOM, never left as an invisible sheet.

**The samurai is an Aseprite sprite** (`art/samurai.aseprite`), exported as a
packed, trimmed sheet (`src/intro/samurai.png`) plus one row of data per frame
(`src/intro/samurai.json`): where the frame sits in its cell, how far along the
dash it is, where the blade and the scabbard mouth are. The intro moves him
across the screen by a viewport-sized distance; the frames themselves never
travel, which keeps the sheet small.

The frames are generated, not hand-placed. `tools/samurai/rig.ts` poses a
skeleton — hip, chest, head, two-bone IK arms and legs, a scabbard on the left
hip, a simulated scarf — through its `key()` calls, and `tools/samurai/build.lua`
assembles the result in Aseprite as an indexed, layered, tagged sprite. The
sword is locked to the scabbard's axis until the blade clears the mouth, and
locked back onto it to be sheathed, so it never appears in his hand from
nowhere. Facing is a mirror applied before rim lighting, so the light stays
upper-right when he turns.

```
npm run art:samurai                   # regenerate every frame, rebuild the .aseprite, export
npm run art:samurai -- --export-only  # export the .aseprite as it stands, after hand edits
```

Both need Aseprite on `PATH` or in `ASEPRITE`. A full run overwrites
`art/samurai.aseprite`; after hand edits use `--export-only`, which keeps the
pixels and reuses the blade data from the last full run, so keep the sword
where it was. If you retime the keys, move the matching constants at the top
of `katana.ts` (`SLASHES`, `SEPARATE_AT`) with them.

He is rim-lit rather than outlined: white on edges that face up, steel grey on
edges facing right, a thin deep-red back light on edges facing left. The figure
stays predominantly black; red is rationed to the scarf, the lacing, the obi,
the scabbard bands, the maedate's sun and the eye.

## Controls

| | |
|---|---|
| click a panel or marker | fly into it; click the panel you are on to go one stratum deeper |
| scroll / swipe | along the route, one page per gesture: surface → who → 1–6 → reach |
| pinch | descend or ascend one stratum, settling onto a fitted frame |
| `enter` / `shift+enter` | next / previous on the tour: who → 1–6 → reach → surface |
| `←` / `→` | previous / next on the tour |
| `↓` / `space` | descend one stratum |
| `↑` / `esc` | ascend one stratum |
| `1`–`6` | jump to a system |
| `0` | return to the surface |
| drag | a short peek; it resists past a margin and springs back |
| `?` | all keys |
| any key / click | skip the intro to the first cut |

**The view always finishes on a fitted frame.** Every gesture and key resolves
to a panel, and the camera settles on that panel's frame, fitted to the part of
the screen the HUD leaves free. Only the branch being viewed is drawn —
sibling panels ease out — so nothing overlaps the panel you are on.

**Scroll travels the route, it does not zoom.** From anywhere, scrolling down
goes to the next page on the route — surface, who, the six systems in order,
reach — and scrolling up goes back. One gesture is one page, however hard the
flick; trackpad momentum cannot start a second one, even after the first has
landed.

The motion, in order of what the eye notices:

- **A spring, not steps.** The wheel moves a goal and the camera chases it on
  a critically damped spring, so a notched mouse wheel glides, and a change of
  mind mid-flight reverses with its momentum instead of restarting.
- **The shortest-feeling path.** Between two pages the camera follows the
  smooth pan-and-zoom curve of van Wijk & Nuij (the one d3's `interpolateZoom`
  uses): it pulls back just far enough to see both pages, swings across, and
  settles into the next. Both stay drawn until it lands.
- **Parallax at three depths.** The star field's octaves pan at different
  fractions of the camera's speed, and inside each plate the header, subtitle
  and title shift by different amounts as it slides across the screen.
- **Arrival.** A page's contents are held back from the moment the camera sets
  off for it and cascade in once it lands, 55ms apart, each rising a touch out
  of a soft blur. Leaving is instant.
- **A whisper of motion blur** (at most 1.4px) on the world while the camera is
  really moving, which fuses the crossfading plates into one movement.
- **The route bar** at the bottom: a tick per page and a line that fills with
  the spring's live position, so it moves with the camera rather than after it.

With `prefers-reduced-motion` there is no flight, no blur and no rise: pages
crossfade in place.
Clicking still goes straight to any marker or panel, and a trackpad pinch
still zooms.

On touch a vertical swipe does the same as the wheel, and the surface
re-composes as an index column in route order.

## How it works

No runtime dependencies. Vite and TypeScript are the only packages, both dev-only.
Build output is ~59 kB of JS and ~19 kB of CSS (~28 kB gzipped, all in), intro
and samurai included, plus the 46 kB samurai sheet. The fracture is canvases carved from the cell grid plus the Web Animations
API; no animation library, and no rendering engine beyond the one fullscreen
WebGL pass the star field already needed.

**`core/camera.ts`** — the entire site's state is `(cx, cy, z)`, where `z` is the
*natural log* of the zoom scale. Log space is what makes the rest tractable: a
zoom from x1 to x10,000 is a straight line in `z`, so easing, momentum and
smoothing behave identically at every depth. `flyTo` interpolates `z` along a
parabola that sags to an apex where both endpoints fit on screen, which gives
the pull-back-travel-dive arc for free.

**`world/build.ts`** — level of detail. Every node carries a world scale `s`; its
on-screen size is `s x cameraScale`, and it fades in and out of a visibility
band expressed as fractions of the viewport diagonal (not pixels, so the world
is not mis-scaled on a 5K display). The band is ~8.5x wide at full opacity,
wider than the 6x between strata, so at least one stratum is always fully
legible and every transition is a crossfade. Nodes outside the band are
`display: none` and cost nothing.

**`layers/field.ts`** — the void, one fullscreen WebGL pass: black, a sparse
scatter of stars, and a meteor every few seconds, always falling
top-right to bottom-left. The stars are not a
flat backdrop — they live in world space across three octaves, each a factor
of 6 finer than the one above, so descending a stratum does not magnify the
same field, it reveals a finer one that was always there. That is what keeps
the sense of real depth with no grid to subdivide.

> The one real engineering problem is precision. At x4e7 zoom the interesting
> world coordinates are around 1e-7, and float32 cannot hold "camera position"
> and "cell size" at that ratio without the field visibly swimming. So the
> camera is never sent to the GPU. JS computes each octave's *phase* —
> `fract(camera / cell)`, always in `[0,1)` — and its wrapped *cell index*,
> both in double precision. The shader only ever sees small numbers, and a star
> keeps its identity whatever zoom it is viewed from. That is what lets the
> zoom run seven orders of magnitude deep and stay solid.

**Typography** is authored in container-query units against each plate, so one
set of rules serves both the landscape desktop plates and the portrait mobile
ones. `world/build.ts` rebuilds every plate at a fixed 1:2 frame on touch; the
extra height it buys is deliberate, and becomes the band the next stratum sits
in.

**Routing** — the focused node writes itself to the URL hash once the camera
settles, so any depth is linkable and the back button works. Arriving on a deep
link starts the camera outside and flies in.

## Accessibility and fallbacks

- Every marker is a real `<button>` with an `aria-label`; channels are real links.
- The intro overlay is `aria-hidden` — no animation frame is ever announced —
  and the site behind it is in the accessibility tree from the first paint.
- Full keyboard navigation; `prefers-reduced-motion` replaces flights with cuts
  and the fracture with a short curtain.
- No WebGL: the canvas removes itself and a CSS ground tone carries the look.
- No JavaScript: a `<noscript>` card with the short version and an email address.

## Palette

Three colours, strictly rationed: black ground, pixel-white content, red as the
only signal. The background is black and white *only* — the stars, the vignette
and the grain never touch red, so every red mark on the page is content.

Two reds exist for one reason. `#d71935` on black is 3.85:1, which is right for
marks, rules and stamps but short of what small text needs, so anything set at
label size steps up to `--red-soft` (6.5:1). Code follows the same split:
keywords red, everything else white and grey, with weight rather than hue
separating function names from strings.

Dark by intent. There is no light theme, the same way an oscilloscope does not
have one.

## Typography

Three faces, each with a job:

- **Candy Inc** — headings and the handwritten margin note. `--display`.
- **Instrument Serif** — italic emphasis lines (the positioning line on the
  surface and on every plate), contact values, and the `01`–`06` indices.
- **IBM Plex Mono** — everything technical: body copy, labels, code, the HUD.

**Candy Inc is a trial cut, and the site is written around that.** Its letters
are clean, but every digit renders as a watermarked star glyph and most
punctuation is absent. So it is only ever applied to headings that contain
neither — project names, section headings, the name, the contact title. The
`01`–`06` indices stay in Instrument Serif because they are digits. Where a
character is missing, the browser falls back per-glyph to Instrument Serif;
that pairing is deliberate, not a failure.

The license is **freeware, non-commercial, personal use only** — see
`public/fonts/CandyInc-LICENSE.txt`. Commercial licensing is sold separately by
the designer. If this site ever promotes paid work, buy the commercial license
or swap `--display` to the serif fallback; that token is the only place the
face is named.

It is self-hosted in `public/fonts/` as WOFF (fetched) and OTF (fallback), and
preloaded in `index.html`. Instrument Serif and IBM Plex Mono still come from
Google Fonts.

## The fire on the i

The surface title carries a small fire on the dot of its `i`. It is a
four-frame, 11×17 pixel sprite sheet (`public/fx/fire.png`), extracted from the
supplied reference GIF and played at its native 10fps on an 11×17 canvas. No
blur or filter scaling anywhere: the canvas is driven by nearest-neighbour.

It is anchored by measurement, not by hard-coded percentages. The title is one
shaped text run in a script face, so splitting it into per-letter spans would
break the joins. Instead a Range finds the `i`'s box, and an offscreen
rasterisation of the same string finds the ink: the vertical comes from the top
of that glyph, the horizontal from the ink centroid, nudged onto the rounded
terminal knot that reads as the letter's dot. The probe reproduces the title's
negative tracking — without it, the anchor drifts right of the glyph by one
letter-space for every character before the `i`. Everything is divided by the
camera scale, which keeps the flame welded to the knot at every zoom level. It
re-measures on resize and after the webfont resolves.

The flame is 0.22em tall, roughly the height of the loop's counter, so it sits
inside the letter rather than over the word.

Note that this sprite uses orange and pale yellow from the reference, which
sits outside the site's black/white/red palette. It was used as supplied. If
the strict palette matters more than the reference's colour, remapping the
sprite's three inks to red/white is a one-file change.
