import type { Camera } from '../core/camera';
import { ZOOM_STEP } from '../world/types';

/**
 * The void. Black, a sparse scatter of stars, and the occasional shooting star.
 *
 * The stars are not a flat backdrop. They live in world space across three
 * octaves, each octave a factor of ZOOM_STEP finer than the one above, so
 * descending a stratum does not magnify the same field - it reveals a finer
 * one that was always there. That is what keeps the sense of real depth now
 * that there is no grid to subdivide.
 *
 * The one real engineering problem is precision. At x4e7 zoom the interesting
 * world coordinates are around 1e-7, and float32 cannot hold "camera position"
 * and "cell size" at that ratio without the field visibly swimming. So the
 * camera is never sent to the GPU. JS computes each octave's PHASE -
 * fract(camera / cell), always in [0,1) - and its CELL INDEX, wrapped to a
 * large period, both in double precision. The shader only ever sees small
 * numbers, and a star keeps its identity whatever zoom it is viewed from.
 */

const CELL_PX = 150;
const OCTAVES = 3;
/**
 * Parallax: each octave pans at its own fraction of the world's speed, so
 * when the camera travels the layers slide past one another as depth. Zoom is
 * shared; only travel separates them.
 */
const DRIFT = [0.42, 0.68, 0.94] as const;
const WRAP = 4096;

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uDpr;
uniform vec3  uS;      // octave cell size, device px
uniform vec3  uPx;     // octave phase, x
uniform vec3  uPy;     // octave phase, y
uniform vec3  uCx;     // octave cell index, x (wrapped)
uniform vec3  uCy;     // octave cell index, y (wrapped)
uniform vec4  uShotA;  // shooting star a: x0,y0,x1,y1
uniform vec4  uShotB;
uniform vec2  uShotT;  // progress for each, < 0 when idle

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 hash2(vec2 p) {
  return fract(vec2(
    sin(dot(p, vec2(127.1, 311.7))) * 43758.5453,
    sin(dot(p, vec2(269.5, 183.3))) * 43758.5453
  ));
}

// Fade an octave in once its cells are wide enough to read as separate stars,
// and out again once they are so wide the octave below has taken over.
float fadeOf(float s) {
  return smoothstep(42.0 * uDpr, 150.0 * uDpr, s) *
         (1.0 - smoothstep(1700.0 * uDpr, 5200.0 * uDpr, s));
}

float octave(vec2 frag, float cell, float px, float py, float cx, float cy) {
  float fade = fadeOf(cell);
  if (fade <= 0.001) return 0.0;

  vec2 g = (frag - uRes * 0.5) / cell + vec2(px, py);
  vec2 id = floor(g) + vec2(cx, cy);
  float h = hash1(id);
  if (h > 0.20) return 0.0;              // sparse on purpose

  vec2 at = hash2(id + 7.3);
  float d = length((fract(g) - at) * cell);
  float bright = 0.3 + 0.7 * hash1(id + 3.1);
  float twinkle = 0.78 + 0.22 * sin(uTime * (0.5 + hash1(id + 5.7) * 0.9) + h * 31.4);
  float r = (0.6 + 1.2 * bright) * uDpr;

  return smoothstep(r, 0.0, d) * bright * twinkle * fade;
}

// A tapered streak with a bright head, travelling a -> b over its life.
float shot(vec2 frag, vec4 seg, float p) {
  if (p < 0.0) return 0.0;
  vec2 dir = seg.zw - seg.xy;
  vec2 head = seg.xy + dir * p;
  vec2 tail = seg.xy + dir * max(0.0, p - 0.22);

  vec2 pa = frag - tail;
  vec2 ba = head - tail;
  float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  float d = length(pa - ba * t);

  float w = 1.0 * uDpr;
  float core = smoothstep(w, 0.0, d);
  float glow = smoothstep(w * 4.0, 0.0, d) * 0.22;
  float life = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.72, 1.0, p));

  return (core + glow) * t * t * life;
}

void main() {
  // gl_FragCoord measures y from the bottom; every coordinate JS hands this
  // shader - camera phase, meteor endpoints - is y-down canvas space. Flip
  // once here so the whole field shares the DOM's convention, otherwise the
  // stars pan against the plates and meteors fly the wrong way.
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

  // Unrolled deliberately: dynamic indexing into a vec3 uniform is a known
  // sore spot on older GLSL ES 1.00 drivers.
  float s = 0.0;
  s += octave(frag, uS.x, uPx.x, uPy.x, uCx.x, uCy.x);
  s += octave(frag, uS.y, uPx.y, uPy.y, uCx.y, uCy.y);
  s += octave(frag, uS.z, uPx.z, uPy.z, uCx.z, uCy.z);

  s += shot(frag, uShotA, uShotT.x);
  s += shot(frag, uShotB, uShotT.y);

  vec2 uv = frag / uRes;
  float vig = 1.0 - smoothstep(0.25, 1.0, length(uv - 0.5) * 1.38);

  // Paper white, never tinted: the ground is black and white only.
  vec3 col = vec3(0.949, 0.941, 0.918) * s * (0.55 + 0.45 * vig);

  // Grain last, unmultiplied, so it sits on the glass.
  float g = hash1(floor(frag * 0.5) + floor(uTime * 24.0)) - 0.5;
  col += g * 0.012;

  gl_FragColor = vec4(col, 1.0);
}
`;

interface Shot {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  start: number;
  dur: number;
}

export class Field {
  private gl: WebGLRenderingContext | null;
  private prog: WebGLProgram | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private sArr = new Float32Array(OCTAVES);
  private pxArr = new Float32Array(OCTAVES);
  private pyArr = new Float32Array(OCTAVES);
  private cxArr = new Float32Array(OCTAVES);
  private cyArr = new Float32Array(OCTAVES);
  private shotT = new Float32Array(2);
  private shots: (Shot | null)[] = [null, null];
  private nextShot = 3;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.gl =
      (canvas.getContext('webgl', { antialias: false, alpha: false, depth: false }) as WebGLRenderingContext | null) ??
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);

    const gl = this.gl;
    if (!gl) {
      // No WebGL: the CSS ground tone on <body> carries the look instead.
      canvas.style.display = 'none';
      return;
    }

    const prog = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!prog || !vs || !fs) {
      canvas.style.display = 'none';
      this.gl = null;
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('field: link failed', gl.getProgramInfoLog(prog));
      canvas.style.display = 'none';
      this.gl = null;
      return;
    }

    gl.useProgram(prog);
    this.prog = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const name of ['uRes', 'uTime', 'uDpr', 'uS', 'uPx', 'uPy', 'uCx', 'uCy', 'uShotA', 'uShotB', 'uShotT']) {
      this.u[name] = gl.getUniformLocation(prog, name);
    }
  }

  get active(): boolean {
    return this.gl !== null;
  }

  resize(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(cam: Camera, time: number): void {
    const gl = this.gl;
    if (!gl || !this.prog) return;

    const scale = cam.scale;
    const logStep = Math.log(ZOOM_STEP);
    // Octave index whose world cell lands nearest CELL_PX on screen.
    const lf = Math.log(CELL_PX / scale) / logStep;
    const l0 = Math.floor(lf);

    for (let j = 0; j < OCTAVES; j++) {
      const cell = Math.pow(ZOOM_STEP, l0 + j);
      // Octaves are assigned by zoom, so the factor follows the octave's
      // absolute level rather than its slot - a star keeps its speed as the
      // slots roll over during a zoom.
      const k = DRIFT[(((l0 + j) % OCTAVES) + OCTAVES) % OCTAVES]!;
      const px = cam.cx * k;
      const py = cam.cy * k;
      this.sArr[j] = cell * scale * this.dpr;
      this.pxArr[j] = phase(px, cell);
      this.pyArr[j] = phase(py, cell);
      this.cxArr[j] = index(px, cell);
      this.cyArr[j] = index(py, cell);
    }

    this.updateShots(time);

    gl.uniform2f(this.u['uRes'] ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u['uTime'] ?? null, time);
    gl.uniform1f(this.u['uDpr'] ?? null, this.dpr);
    gl.uniform3fv(this.u['uS'] ?? null, this.sArr);
    gl.uniform3fv(this.u['uPx'] ?? null, this.pxArr);
    gl.uniform3fv(this.u['uPy'] ?? null, this.pyArr);
    gl.uniform3fv(this.u['uCx'] ?? null, this.cxArr);
    gl.uniform3fv(this.u['uCy'] ?? null, this.cyArr);

    const a = this.shots[0];
    const b = this.shots[1];
    gl.uniform4f(this.u['uShotA'] ?? null, a?.ax ?? 0, a?.ay ?? 0, a?.bx ?? 0, a?.by ?? 0);
    gl.uniform4f(this.u['uShotB'] ?? null, b?.ax ?? 0, b?.ay ?? 0, b?.bx ?? 0, b?.by ?? 0);
    gl.uniform2fv(this.u['uShotT'] ?? null, this.shotT);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** One or two streaks per ten seconds, never more than two at once. */
  private updateShots(time: number): void {
    for (let i = 0; i < 2; i++) {
      const s = this.shots[i];
      if (!s) {
        this.shotT[i] = -1;
        continue;
      }
      const p = (time - s.start) / s.dur;
      if (p >= 1) {
        this.shots[i] = null;
        this.shotT[i] = -1;
      } else {
        this.shotT[i] = p;
      }
    }

    if (time < this.nextShot) return;
    this.nextShot = time + 4.5 + Math.random() * 4.5;

    const slot = this.shots[0] === null ? 0 : this.shots[1] === null ? 1 : -1;
    if (slot < 0) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // Always top-right to bottom-left. One consistent trajectory reads as a
    // property of this sky; random directions read as noise. The entry point
    // is allowed past the right and top edges so a meteor can fly INTO frame
    // rather than always blinking into existence inside it.
    const len = (0.34 + Math.random() * 0.3) * Math.hypot(w, h);
    const angle = (0.17 + Math.random() * 0.14) * Math.PI; // ~31deg to ~56deg below horizontal
    const ax = w * (0.55 + Math.random() * 0.5);
    const ay = h * (-0.08 + Math.random() * 0.5);

    this.shots[slot] = {
      ax,
      ay,
      bx: ax - Math.cos(angle) * len,
      by: ay + Math.sin(angle) * len,
      start: time,
      dur: 0.7 + Math.random() * 0.5,
    };
  }
}

/** fract(v / cell) in double precision, so the shader stays in float32. */
function phase(v: number, cell: number): number {
  const q = v / cell;
  const f = q - Math.floor(q);
  return f < 0 ? f + 1 : f;
}

/**
 * The cell's integer index, wrapped to a large period. Without this the hash
 * would only ever see the on-screen cell offsets and the whole star field
 * would tile every viewport-width of panning.
 */
function index(v: number, cell: number): number {
  const c = Math.floor(v / cell);
  return ((c % WRAP) + WRAP) % WRAP;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('field: compile failed', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}
