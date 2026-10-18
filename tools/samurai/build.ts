/**
 * Builds the intro samurai.
 *
 *   npm run art:samurai                  generate the frames, rebuild art/samurai.aseprite, export
 *   npm run art:samurai -- --export-only  export from art/samurai.aseprite as it stands
 *
 * The second form is for after hand edits in Aseprite: it keeps the pixels and
 * reuses the blade and dash data recorded by the last full build, so edits must
 * leave the sword where it was. A full build regenerates every pixel and
 * overwrites the .aseprite file.
 *
 * Needs Aseprite on PATH, or its path in ASEPRITE.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CX, FIGURE, FRAME_MS, H, INK_HEX, LAYERS, TAGS, W, render } from './rig.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = join(root, 'art', 'samurai.aseprite');
const META = join(root, 'art', 'samurai.meta.json');
const SHEET = join(root, 'src', 'intro', 'samurai.png');
const DATA = join(root, 'src', 'intro', 'samurai.json');
const LUA = join(root, 'tools', 'samurai', 'build.lua');
const aseprite = process.env.ASEPRITE || 'aseprite';

interface Meta {
  width: number;
  height: number;
  frameMs: number;
  figure: { x: number; y: number };
  /** Per frame: dash, tsuba x/y, tip x/y, blade visible, koiguchi x/y. */
  frames: [number, number, number, number, number, number, number, number][];
}

interface SheetFrame {
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

const tmp = mkdtempSync(join(tmpdir(), 'samurai-'));
try {
  if (!process.argv.includes('--export-only')) generate();
  exportSheet();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function generate(): void {
  const frames = render();
  const enc = '0123456789abcdefghijklmnopqrstuvwxyz';
  const layerData = frames.map((f) =>
    f.layers.map((g) => {
      if (!g.some((c) => c !== 0)) return '';
      let s = '';
      for (let i = 0; i < g.length; i++) s += enc[g[i]!];
      return s;
    }),
  );
  const toFrame = (ms: number) => Math.min(frames.length, Math.floor(ms / FRAME_MS) + 1);
  const input = join(tmp, 'frames.json');
  writeFileSync(
    input,
    JSON.stringify({
      width: W,
      height: H,
      frameMs: Math.round(FRAME_MS),
      palette: INK_HEX,
      layers: LAYERS,
      frames: layerData,
      tags: TAGS.map((t) => ({ name: t.name, from: toFrame(t.from), to: Math.max(toFrame(t.from), toFrame(t.to) - 1) })),
    }),
  );
  run(['-b', '--script-param', `input=${input}`, '--script-param', `output=${ART}`, '--script', LUA]);

  const meta: Meta = {
    width: W,
    height: H,
    frameMs: FRAME_MS,
    figure: FIGURE,
    frames: frames.map((f) => {
      const b = f.blade;
      return [r1(f.dash), r1(b.gx), r1(b.gy), r1(b.tx), r1(b.ty), b.visible ? 1 : 0, r1(b.mx), r1(b.my)];
    }),
  };
  writeFileSync(META, JSON.stringify(meta) + '\n');
  console.log(`generated ${frames.length} frames (${W}x${H}, centre ${CX}) -> ${ART}`);
}

function exportSheet(): void {
  const meta = JSON.parse(readFileSync(META, 'utf8')) as Meta;
  const json = join(tmp, 'sheet.json');
  run([
    '-b', ART,
    '--sheet', SHEET,
    '--sheet-type', 'packed',
    '--trim',
    '--merge-duplicates',
    '--format', 'json-array',
    '--data', json,
  ]);
  const sheet = JSON.parse(readFileSync(json, 'utf8')) as { frames: SheetFrame[] };
  if (sheet.frames.length !== meta.frames.length) {
    throw new Error(`sheet has ${sheet.frames.length} frames, meta has ${meta.frames.length}: rebuild without --export-only`);
  }

  // One flat row per frame: sheet rect, offset in the sprite, then the meta.
  const rows = sheet.frames.map((f, i) => [
    f.frame.x, f.frame.y, f.frame.w, f.frame.h,
    f.spriteSourceSize.x, f.spriteSourceSize.y,
    ...meta.frames[i]!,
  ]);
  writeFileSync(
    DATA,
    JSON.stringify({ w: meta.width, h: meta.height, frameMs: meta.frameMs, figure: meta.figure, frames: rows }) + '\n',
  );
  console.log(`exported ${rows.length} frames -> ${SHEET}`);
}

function run(args: string[]): void {
  execFileSync(aseprite, args, { stdio: ['ignore', 'inherit', 'inherit'] });
}
