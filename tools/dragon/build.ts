/**
 * Builds the background dragon.
 *
 *   npm run art:dragon                   generate the frames, rebuild art/dragon.aseprite, export
 *   npm run art:dragon -- --export-only  export from art/dragon.aseprite as it stands
 *
 * The second form keeps hand edits made in Aseprite; a full build regenerates
 * every pixel and overwrites the .aseprite file. Assembly reuses the samurai's
 * generic frames-to-sprite script.
 *
 * Needs Aseprite on PATH, or its path in ASEPRITE.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FRAME_MS, H, INK_HEX, LAYERS, W, render, type Tag } from './rig.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = join(root, 'art', 'dragon.aseprite');
const SHEET = join(root, 'src', 'layers', 'dragon.png');
const DATA = join(root, 'src', 'layers', 'dragon.json');
const LUA = join(root, 'tools', 'samurai', 'build.lua');
const META = join(root, 'art', 'dragon.meta.json');
const aseprite = process.env.ASEPRITE || 'aseprite';

const tmp = mkdtempSync(join(tmpdir(), 'dragon-'));
try {
  if (!process.argv.includes('--export-only')) generate();
  exportSheet();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

function generate(): void {
  const { frames, tags } = render();
  const enc = '0123456789abcdefghijklmnopqrstuvwxyz';
  const layerData = frames.map((f) =>
    f.layers.map((g) => {
      if (!g.some((c) => c !== 0)) return '';
      let s = '';
      for (let i = 0; i < g.length; i++) s += enc[g[i]!];
      return s;
    }),
  );
  const input = join(tmp, 'frames.json');
  writeFileSync(
    input,
    JSON.stringify({
      width: W,
      height: H,
      frameMs: FRAME_MS,
      palette: INK_HEX,
      layers: LAYERS,
      frames: layerData,
      tags: tags.map((g) => ({ name: g.name, from: g.from + 1, to: g.to + 1 })),
    }),
  );
  run(['-b', '--script-param', `input=${input}`, '--script-param', `output=${ART}`, '--script', LUA]);
  // Per-set timing lives beside the .aseprite so --export-only can reuse it.
  writeFileSync(META, JSON.stringify({ tags }) + '\n');
  console.log(`generated ${frames.length} frames (${W}x${H}) -> ${ART}`);
}

function exportSheet(): void {
  const json = join(tmp, 'sheet.json');
  run(['-b', ART, '--sheet', SHEET, '--sheet-type', 'horizontal', '--format', 'json-array', '--data', json]);
  const sheet = JSON.parse(readFileSync(json, 'utf8')) as { frames: unknown[] };
  const { tags } = JSON.parse(readFileSync(META, 'utf8')) as { tags: Tag[] };
  // Sets, by name: first frame, frame count, frame time.
  const sets = Object.fromEntries(tags.map((g) => [g.name, [g.from, g.to - g.from + 1, g.ms]]));
  writeFileSync(DATA, JSON.stringify({ w: W, h: H, frames: sheet.frames.length, frameMs: FRAME_MS, sets }) + '\n');
  console.log(`exported ${sheet.frames.length} frames -> ${SHEET}`);
}

function run(args: string[]): void {
  execFileSync(aseprite, args, { stdio: ['ignore', 'inherit', 'inherit'] });
}
