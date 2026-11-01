// intro3d.js — Intro 3D de l'accueil, en WebGL 2 et sans bibliothèque. Sous les yeux du
// visiteur, le plan de la fenêtre se trace, la tringle, les 20 fils et leurs 400 LED se
// montent, le boîtier s'assemble et le courant passe : le rideau s'allume (sapin), affiche
// le logo, puis le nom MAVYA apparaît. Le début se joue seul, la suite suit le défilement.

import { SAPIN, COLORS } from './patterns.js?v=dev';

/* ---------- Le rideau (en mètres) ---------- */
const COLS = 20, ROWS = 20, N = COLS * ROWS, PITCH = .1;
const ROD_Y = 1.06, ROD_LEN = 2.14, X0 = -.95;
const LED_DROP = .11, STRAND_LEN = LED_DROP + (ROWS - 1) * PITCH + .05;   // 1re LED à 11 cm sous la tringle
const FLOOR_Y = -1.42;
const BOX = [-1.13, .8, 0], BOX_H = [.085, .045, .025];                     // boîtier : centre, demi-dimensions
const FRAME = { x0: -1.34, x1: 1.34, y0: -1.22, y1: 1.28, z: .08 };
const SUBJECT = { w: 2.75, h: 2.55, y: .03 };                               // ce que la caméra doit cadrer
const CURTAIN = { w: 2.24, h: 2.1, y: .055 };                               // le rideau seul (dans la fenêtre de la maison)
const FOV = 32 * Math.PI / 180;

/* ---------- Timeline (T de 0 à 1) ---------- */
const AUTO = .16, AUTO_SECONDS = 2.8;             // le tracé du plan et la tringle se jouent seuls
const CAPTIONS = [[0, .2], [.2, .36], [.37, .52], [.52, .6], [.6, .78]];   // la 1re reste lisible après le début automatique
const SHOTS = [                                   // plans : T, azimut°, élévation°, distance (× cadrage), cible x, y
  [0, -40, 20, 1.32, 0, .2],
  [.16, -31, 13, 1.12, 0, .12],
  [.3, -23, 4, .98, 0, .03],
  [.44, -30, 11, .52, -.95, .72],
  [.56, -17, 6, .78, -.5, .55],
  [.7, -5, 2, 1, 0, SUBJECT.y],
  [.86, 0, 0, 1, 0, SUBJECT.y],
  [1, 0, 0, .97, 0, SUBJECT.y],
];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lin = (t, a, b) => clamp((t - a) / (b - a));
const smooth = x => x * x * (3 - 2 * x);
const seg = (t, a, b) => smooth(lin(t, a, b));
const mix = (a, b, k) => a + (b - a) * k;
const back = x => x <= 0 ? 0 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;   // arrivée avec léger dépassement
const spring = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6 * x) * Math.cos(9 * x);  // chute qui rebondit
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* ---------- Les 400 LED : sapin, puis le « M » en points du logo ---------- */
const M5 = ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X'];
const NEON = ['#2DE2FF', '#8F7BFF', '#FF3DD8'].map(hex);
const neon = u => { const k = Math.min(1.999, u * 2), i = Math.floor(k); return NEON[i].map((v, c) => mix(v, NEON[i + 1][c], k - i)); };
const LEDS = Array.from({ length: N }, (_, n) => {
  const i = n % COLS, j = Math.floor(n / COLS), code = SAPIN[j][i];
  const [color, k = 1] = [].concat(COLORS[code] ?? []);
  const inLogo = M5[j >> 2][i >> 2] === 'X' && j % 4 > 0 && j % 4 < 3 && i % 4 > 0 && i % 4 < 3;
  return {
    i, j, s: LED_DROP + j * PITCH,
    tree: color ? hex(color) : null, treeK: k, star: code === 'S',
    logo: inLogo ? neon(i / (COLS - 1)) : null,
    on: .6 + (i * PITCH + .12) / ROD_LEN * .045 + j * .0032,   // le courant arrive par la gauche de la tringle
    phase: (i * 7.13 + j * 3.71) % 6.283,
  };
});

/* ---------- Matrices (colonnes, comme WebGL) ---------- */
function perspective(out, aspect, sx, sy) {
  const f = 1 / Math.tan(FOV / 2), near = .05, far = 60, nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[8] = -sx; out[9] = -sy;                     // décentrage : la cible tombe en (sx, sy) à l'écran
  out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}
function lookAt(out, eye, target) {
  const z = norm(sub(eye, target)), x = norm([z[2], 0, -z[0]]), y = cross(z, x);
  out.set([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  return out;
}
function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
/** Écrit translation × rotation (Z·Y·X) × échelle à l'indice o d'un tableau d'instances. */
function compose(out, o, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
  const cx = Math.cos(rx), snx = Math.sin(rx), cy = Math.cos(ry), sny = Math.sin(ry), cz = Math.cos(rz), snz = Math.sin(rz);
  out[o] = cz * cy * sx; out[o + 1] = snz * cy * sx; out[o + 2] = -sny * sx; out[o + 3] = 0;
  out[o + 4] = (cz * sny * snx - snz * cx) * sy; out[o + 5] = (snz * sny * snx + cz * cx) * sy; out[o + 6] = cy * snx * sy; out[o + 7] = 0;
  out[o + 8] = (cz * sny * cx + snz * snx) * sz; out[o + 9] = (snz * sny * cx - cz * snx) * sz; out[o + 10] = cy * cx * sz; out[o + 11] = 0;
  out[o + 12] = tx; out[o + 13] = ty; out[o + 14] = tz; out[o + 15] = 1;
}

/* ---------- Géométries ---------- */
const geometry = (pos, nor, idx) => ({ pos: new Float32Array(pos), nor: new Float32Array(nor), idx: new Uint16Array(idx) });

function sphere(seg = 14, rings = 10) {
  const pos = [], idx = [];
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= seg; s++) {
    const phi = r / rings * Math.PI, th = s / seg * Math.PI * 2;
    pos.push(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
    const a = r * (seg + 1) + s, b = a + seg + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return geometry(pos, pos, idx);
}

/** Cylindre d'axe Y, de rayon 1, de y = -0,5 à 0,5, avec ses deux fonds. */
function cylinder(seg = 16) {
  const pos = [], nor = [], idx = [];
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
    pos.push(x, -.5, z, x, .5, z); nor.push(x, 0, z, x, 0, z);
  }
  for (let k = 0; k < seg; k++) idx.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3);
  for (const y of [-.5, .5]) {
    const c = pos.length / 3;
    pos.push(0, y, 0); nor.push(0, Math.sign(y), 0);
    for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; pos.push(Math.cos(a), y, Math.sin(a)); nor.push(0, Math.sign(y), 0); }
    for (let k = 0; k < seg; k++) idx.push(c, c + 1 + k, c + 2 + k);
  }
  return geometry(pos, nor, idx);
}

/** Cube unité centré. */
function cube() {
  const pos = [], nor = [], idx = [];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const u = (a + 1) % 3, v = (a + 2) % 3, base = pos.length / 3;
    for (const [du, dv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = [0, 0, 0], n = [0, 0, 0];
      p[a] = s / 2; p[u] = du / 2; p[v] = dv / 2; n[a] = s;
      pos.push(...p); nor.push(...n);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geometry(pos, nor, idx);
}

/** Boîte aux arêtes arrondies (demi-dimensions h, rayon r) : la grille de chaque face se resserre près des bords. */
function roundedBox(h, r) {
  const ticks = e => { const t = [0, .268, .577, 1].map(k => e - r + r * k); return [...t.map(v => -v).reverse(), ...t]; };
  const pos = [], nor = [], idx = [];
  for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
    const u = (a + 1) % 3, v = (a + 2) % 3, tu = ticks(h[u]), tv = ticks(h[v]), base = pos.length / 3;
    for (const pv of tv) for (const pu of tu) {
      const p = [0, 0, 0];
      p[a] = s * h[a]; p[u] = pu; p[v] = pv;
      const q = p.map((x, k) => clamp(x, -(h[k] - r), h[k] - r));
      const d = sub(p, q), l = Math.hypot(...d);
      const n = l > 1e-6 ? d.map(x => x / l) : [0, 0, 0].map((_, k) => k === a ? s : 0);
      pos.push(q[0] + n[0] * r, q[1] + n[1] * r, q[2] + n[2] * r); nor.push(...n);
    }
    for (let y = 0; y < tv.length - 1; y++) for (let x = 0; x < tu.length - 1; x++) {
      const k = base + y * tu.length + x;
      idx.push(k, k + 1, k + tu.length, k + 1, k + tu.length + 1, k + tu.length);
    }
  }
  return geometry(pos, nor, idx);
}

/** Courbe de Catmull-Rom échantillonnée à travers des points de passage. */
function curve(ctrl, steps = 48) {
  const out = [], n = ctrl.length - 1;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps * n, i = Math.min(n - 1, Math.floor(t)), u = t - i;
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n, i + 2)];
    out.push([0, 1, 2].map(c => .5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u * u * u)));
  }
  return out;
}

/** Câble : tube le long d'une courbe ; les triangles suivent la longueur, pour le dérouler. */
function tube(points, radius, radial = 8) {
  const pos = [], nor = [], idx = [];
  let n = null;
  points.forEach((p, k) => {
    const t = norm(sub(points[Math.min(k + 1, points.length - 1)], points[Math.max(k - 1, 0)]));
    n = norm(n ? sub(n, t.map(x => x * dot(n, t))) : cross(t, Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const b = cross(t, n);
    for (let r = 0; r <= radial; r++) {
      const a = r / radial * Math.PI * 2, d = [0, 1, 2].map(c => n[c] * Math.cos(a) + b[c] * Math.sin(a));
      pos.push(p[0] + d[0] * radius, p[1] + d[1] * radius, p[2] + d[2] * radius); nor.push(...d);
    }
  });
  for (let k = 0; k < points.length - 1; k++) for (let r = 0; r < radial; r++) {
    const a = k * (radial + 1) + r, b = a + radial + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return Object.assign(geometry(pos, nor, idx), { step: radial * 6 });
}

/* ---------- Shaders ---------- */
const MESH_VS = `#version 300 es
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_nor;
layout(location = 2) in mat4 i_m;
layout(location = 6) in vec4 i_col;
uniform mat4 u_vp;
out vec3 v_pos;
out vec3 v_nor;
out vec4 v_col;
void main() {
  vec4 w = i_m * vec4(a_pos, 1.);
  v_pos = w.xyz;
  v_nor = mat3(i_m) * a_nor;
  v_col = i_col;
  gl_Position = u_vp * w;
}`;

// matières simples : diffus + brillance, reflets d'un studio (boîtes à lumière, néons cyan et
// magenta), lumière colorée du rideau allumé, puis tons ACES et fondu dans le décor
const MESH_FS = `#version 300 es
precision highp float;
in vec3 v_pos;
in vec3 v_nor;
in vec4 v_col;
uniform vec3 u_cam, u_base, u_glowPos, u_glowCol, u_bg;
uniform float u_metal, u_gloss, u_alpha, u_rim;
out vec4 o;
vec3 env(vec3 r) {
  vec3 c = mix(vec3(.002, .002, .004), vec3(.018, .02, .028), smoothstep(-.3, .9, r.y));
  c += vec3(2.4) * smoothstep(.55, .8, r.y) * (1. - smoothstep(.25, .6, abs(r.x)));
  c += vec3(.06, .75, 1.) * 1.2 * smoothstep(.5, .95, -r.x) * (1. - smoothstep(0., .5, abs(r.y - .05)));
  c += vec3(1., .14, .72) * .9 * smoothstep(.5, .95, r.x) * (1. - smoothstep(0., .5, abs(r.y - .15)));
  return c;
}
vec3 aces(vec3 x) { return clamp(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0., 1.); }
void main() {
  vec3 n = normalize(v_nor), v = normalize(u_cam - v_pos);
  if (dot(n, v) < 0.) n = -n;
  vec3 l = normalize(vec3(-.45, .85, .55)), h = normalize(l + v);
  float diff = max(dot(n, l), 0.), nv = max(dot(n, v), 0.);
  float spec = pow(max(dot(n, h), 0.), mix(12., 220., u_gloss)) * u_gloss * 1.6;
  float fres = .04 + .96 * pow(1. - nv, 5.);
  vec3 refl = env(reflect(-v, n));
  vec3 lg = u_glowPos - v_pos;
  float dg = length(lg);
  vec3 glow = u_glowCol * max(dot(n, lg / dg), 0.) / (1. + dg * dg * 1.4);
  vec3 dielectric = u_base * (.06 + diff * .55 + glow) + spec * .5 + refl * fres * u_gloss;
  vec3 metal = u_base * (refl * (.35 + .65 * u_gloss) + spec + glow * 1.2);
  vec3 rim = mix(vec3(.12, .55, 1.), vec3(.75, .3, 1.), .5 + .5 * n.x) * pow(1. - nv, 2.5) * u_rim;   // contre-jour : détache les objets du fond
  vec3 c = mix(dielectric, metal, u_metal) + rim + v_col.rgb * v_col.a;
  c = pow(aces(c), vec3(1. / 2.2));
  float far = smoothstep(3., 8., length(v_pos.xz));   // au loin, tout se fond dans le noir (le sol translucide s'efface)
  o = vec4(mix(c, u_bg, far), u_alpha < 1. ? u_alpha * (1. - far) : 1.);
}`;

const GLOW_VS = `#version 300 es
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec4 a_col;
layout(location = 2) in float a_size;
uniform mat4 u_vp;
uniform float u_ppu, u_max;
out vec4 v_col;
void main() {
  vec4 c = u_vp * vec4(a_pos, 1.);
  gl_Position = c;
  gl_PointSize = min(u_max, a_size * u_ppu / max(c.w, .001));
  v_col = a_col;
}`;

const GLOW_FS = `#version 300 es
precision mediump float;
in vec4 v_col;
out vec4 o;
void main() {
  vec2 p = gl_PointCoord * 2. - 1.;
  float d = dot(p, p);
  if (d >= 1.) discard;
  o = vec4(v_col.rgb * v_col.a * (exp(-d * 9.) * .9 + exp(-d * 3.) * .28) * (1. - d), 1.);
}`;

const HAZE_VS = `#version 300 es
void main() { gl_Position = vec4(vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2. - 1., 0., 1.); }`;

const HAZE_FS = `#version 300 es
precision mediump float;
uniform vec2 u_res, u_center;
uniform vec3 u_bg, u_col;
uniform float u_radius;
out vec4 o;
void main() {
  vec2 q = (gl_FragCoord.xy - u_center) / u_radius, uv = gl_FragCoord.xy / u_res - .5;
  o = vec4((u_bg + u_col * exp(-dot(q, q) * 1.6)) * (1. - dot(uv, uv) * .6), 1.);
}`;

const GLASS_VS = `#version 300 es
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_uv;
uniform mat4 u_vp;
out vec2 v_uv;
out vec3 v_pos;
void main() { v_uv = a_uv.xy; v_pos = a_pos; gl_Position = u_vp * vec4(a_pos, 1.); }`;

// vitre : presque invisible de face, deux reflets en biais, plus présente de profil
const GLASS_FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec3 v_pos;
uniform vec3 u_cam;
uniform float u_alpha;
out vec4 o;
void main() {
  float band = v_uv.x * .55 + v_uv.y;
  float streak = smoothstep(.09, 0., abs(band - .95)) + .55 * smoothstep(.035, 0., abs(band - 1.12));
  float fres = pow(1. - abs(normalize(u_cam - v_pos).z), 3.);
  o = vec4(vec3(.85, .9, 1.), (.02 + .1 * streak + .22 * fres) * u_alpha);
}`;

/**
 * Lance le rideau 3D, dessiné dans un calque fixe derrière la page : l'intro dans `stage` (le
 * décor collant du hero), puis sa descente vers l'histoire et jusque dans la fenêtre de la
 * maison. `story` et `street` : { slot, track, leds } — l'emplacement à rejoindre, la piste
 * épinglée et la source des couleurs de leurs motifs (LedSource). `onFail` est appelé si le
 * contexte WebGL est perdu ; une exception est levée si WebGL 2 manque, pour revenir au 2D.
 */
export function startIntro({ stage, story, street, gsap, ScrollTrigger, onFail }) {
  const canvas = document.querySelector('[data-intro]');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL 2 indisponible');

  const heroTrack = stage.parentElement, heroIn = stage.querySelector('.hero__in'), text = stage.querySelector('.hero__text');
  const cta = stage.querySelector('.hero__cta'), hint = stage.querySelector('.intro__hint'), kicker = stage.querySelector('.intro__kicker');
  const captions = [...stage.querySelectorAll('.intro__captions li')], letters = [...stage.querySelectorAll('.intro__logo span')];
  const captionBox = stage.querySelector('.intro__captions'), header = document.querySelector('.site-header');

  /* programmes */
  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
      const { name } = gl.getActiveUniform(p, i);
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }
  const MESH = program(MESH_VS, MESH_FS), GLOW = program(GLOW_VS, GLOW_FS), HAZE = program(HAZE_VS, HAZE_FS), GLASS = program(GLASS_VS, GLASS_FS);

  /* tampons */
  const buffer = (target, data, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
  const upload = g => ({ pos: buffer(gl.ARRAY_BUFFER, g.pos), nor: buffer(gl.ARRAY_BUFFER, g.nor), idx: buffer(gl.ELEMENT_ARRAY_BUFFER, g.idx), n: g.idx.length, step: g.step });
  /** Groupe d'objets d'une même matière : une géométrie, des instances (matrice + couleur émise). */
  function group(geo, count, mat) {
    const vao = gl.createVertexArray(), inst = new Float32Array(count * 20);
    gl.bindVertexArray(vao);
    for (const [loc, b] of [[0, geo.pos], [1, geo.nor]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.idx);
    const ib = buffer(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
    for (let k = 0; k < 5; k++) {
      gl.enableVertexAttribArray(2 + k);
      gl.vertexAttribPointer(2 + k, 4, gl.FLOAT, false, 80, k * 16);
      gl.vertexAttribDivisor(2 + k, 1);
    }
    gl.bindVertexArray(null);
    return { vao, ib, inst, count, geo, mat };
  }
  const material = (color, metal, gloss, alpha = 1, rim = .5) => ({ base: hex(color).map(v => v ** 2.2), metal, gloss, alpha, rim });

  const SPHERE = upload(sphere()), CYL = upload(cylinder()), CUBE = upload(cube());
  const LINK = curve([[-1.07, ROD_Y, 0], [-1.17, ROD_Y - .05, .02], [-1.15, .93, .01], [BOX[0], BOX[1] + BOX_H[1], 0]], 24);
  const USB = curve([[BOX[0], BOX[1] - BOX_H[1], 0], [-1.16, .35, .03], [-1.21, -.6, .05], [-1.25, FLOOR_Y + .007, .3], [-1.95, FLOOR_Y + .007, .62], [-3.3, FLOOR_Y + .007, .9]], 60);
  const G = {
    floor: group(upload(geometry([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3])), 1, material('#07080C', .55, .72, .84, 0)),
    frame: group(CUBE, 4, material('#2A2D36', .85, .62)),
    rod: group(CYL, 3, material('#D5DAE4', 1, .82)),
    clips: group(CYL, COLS, material('#4A4F5C', .9, .6)),
    strands: group(CYL, COLS, material('#2A2D38', .2, .5)),
    beads: group(SPHERE, N + 1, material('#22262F', 0, .95)),        // 400 LED + voyant du boîtier
    box: group(upload(roundedBox(BOX_H, .012)), 1, material('#111319', .15, .85)),
    button: group(CYL, 1, material('#2B2F3B', .25, .7)),
    link: group(upload(tube(LINK, .0055)), 1, material('#14151B', 0, .45)),
    usb: group(upload(tube(USB, .0065)), 1, material('#14151B', 0, .45)),
  };
  compose(G.floor.inst, 0, 0, FLOOR_Y, 0, 0, 0, 0, 14, 1, 14);
  for (const g of [G.link, G.usb]) compose(g.inst, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1);

  /* halos lumineux (points additifs) : scène et reflets dans le sol */
  function glows(cap) {
    const vao = gl.createVertexArray(), data = new Float32Array(cap * 8);
    gl.bindVertexArray(vao);
    const b = buffer(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    [[0, 3, 0], [1, 4, 12], [2, 1, 28]].forEach(([loc, size, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, off); });
    gl.bindVertexArray(null);
    return { vao, b, data, n: 0, cap };
  }
  const HALO = glows(1200), REFL = glows(N + 8);
  const push = (g, x, y, z, r, gr, b, a, size) => {
    if (g.n >= g.cap) return;
    const o = g.n++ * 8, d = g.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r; d[o + 4] = gr; d[o + 5] = b; d[o + 6] = a; d[o + 7] = size;
  };

  const glassVao = gl.createVertexArray();
  gl.bindVertexArray(glassVao);
  {
    const x0 = FRAME.x0 + .03, x1 = FRAME.x1 - .03, y0 = FRAME.y0 + .03, y1 = FRAME.y1 - .03, z = FRAME.z;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer(gl.ARRAY_BUFFER, new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z])));
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0])));
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  }
  const hazeVao = gl.createVertexArray();
  gl.bindVertexArray(null);
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1];

  /* cadrage (en pixels CSS du calque) : pendant l'intro, la fenêtre tient entre les légendes
     (ou l'en-tête) et le texte du bas ; ensuite, elle rejoint l'emplacement de chaque section */
  const proj = new Float32Array(16), view = new Float32Array(16), vp = new Float32Array(16);
  let screenW = 1, screenH = 1, frames = null, slots = null;
  function fit(top, bottom, share) {
    const tan = Math.tan(FOV / 2), fh = Math.max(.25, (bottom - top) / screenH);
    const d = Math.max(SUBJECT.h / (2 * fh * tan), SUBJECT.w / (2 * share * tan * screenW / screenH));
    return { d, cy: 1 - (top + bottom) / screenH };
  }
  /** Plan de face qui fait tenir `subject` dans le rectangle `r` de l'écran. */
  const frameIn = (r, subject) => ({
    az: 0, el: 0, d: Math.max(subject.h / r.h, subject.w / r.w) * screenH / (2 * Math.tan(FOV / 2)),
    cx: (r.x + r.w / 2) / screenW * 2 - 1, cy: 1 - (r.y + r.h / 2) / screenH * 2, tx: 0, ty: subject.y,
  });
  const liveRect = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  /** Rectangle d'un emplacement une fois son décor collant épinglé en haut de l'écran. */
  const pinnedRect = el => ({ ...liveRect(el), y: el.getBoundingClientRect().top - el.closest('.story__stage, .street__stage').getBoundingClientRect().top });
  function layout() {
    const dpr = Math.min(devicePixelRatio || 1, 2), sh = stage.clientHeight, head = header?.offsetHeight ?? 64;
    screenW = canvas.clientWidth || 1;
    screenH = canvas.clientHeight || 1;
    canvas.width = Math.round(screenW * dpr);
    canvas.height = Math.round(screenH * dpr);
    if (matchMedia('(min-width: 900px)').matches) {   // même seuil que le CSS (barre de défilement comprise)
      const f = fit(head + 12, sh - 24, .52);
      f.d *= 1.03;   // marge : la fenêtre finale, vue de face, tient dans l'écran même en 16:9
      frames = { mid: { ...f, cx: .42 }, end: { ...f, cx: .42 } };
    } else {
      const capBottom = captionBox.offsetTop + Math.max(...captions.map(li => li.offsetHeight));
      frames = { mid: { ...fit(capBottom + 12, sh - 24, .92), cx: 0 }, end: { ...fit(head + 8, heroIn.offsetTop - 8, .92), cx: 0 } };
    }
    slots = { story: pinnedRect(story.slot), street: pinnedRect(street.slot) };
  }

  /* caméra : plans de l'intro (Catmull-Rom), puis plans de face sur les emplacements */
  const eye = [0, 0, 0], target = [0, 0, 0];
  function introShot(T, time) {
    let k = SHOTS.findIndex(s => s[0] > T) - 1;
    if (k < 0) k = T < 0 ? 0 : SHOTS.length - 2;
    const a = SHOTS[Math.max(0, k - 1)], b = SHOTS[k], c = SHOTS[k + 1], d = SHOTS[Math.min(SHOTS.length - 1, k + 2)];
    const u = lin(T, b[0], c[0]);
    const cr = i => .5 * (2 * b[i] + (c[i] - a[i]) * u + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * u * u + (3 * b[i] - a[i] - 3 * c[i] + d[i]) * u * u * u);
    const e = seg(T, .8, .92);
    return {
      az: cr(1) + 1.4 * Math.sin(time * .23), el: cr(2) + .7 * Math.sin(time * .29), d: cr(3) * mix(frames.mid.d, frames.end.d, e),
      cx: mix(frames.mid.cx, frames.end.cx, e), cy: mix(frames.mid.cy, frames.end.cy, e), tx: cr(4), ty: cr(5),
    };
  }
  /** D'un plan à l'autre, avec un léger balancement et un creux : le rideau descend, comme porté. */
  function travel(a, b, k) {
    const e = smooth(k), arc = Math.sin(k * Math.PI), s = {};
    for (const key in a) s[key] = mix(a[key], b[key], e);
    s.az += 14 * arc;
    s.el += 6 * arc;
    s.cy -= .18 * arc;
    return s;
  }
  function shotAt(T, k1, k2, time) {
    if (k2 >= 1) return frameIn(liveRect(street.slot), CURTAIN);   // suit la fenêtre quand la rue défile
    if (k2 > 0) return travel(frameIn(slots.story, SUBJECT), frameIn(slots.street, CURTAIN), k2);
    if (k1 >= 1) return frameIn(liveRect(story.slot), SUBJECT);
    if (k1 > 0) return travel(introShot(1, time), frameIn(slots.story, SUBJECT), k1);
    return introShot(T, time);
  }
  function place(s) {
    const az = s.az * Math.PI / 180, el = s.el * Math.PI / 180;
    target[0] = s.tx; target[1] = s.ty; target[2] = 0;
    eye[0] = s.tx + s.d * Math.sin(az) * Math.cos(el);
    eye[1] = s.ty + s.d * Math.sin(el);
    eye[2] = s.d * Math.cos(az) * Math.cos(el);
    perspective(proj, canvas.width / canvas.height, s.cx, s.cy);
    multiply(vp, proj, lookAt(view, eye, target));
  }

  /* état de la scène pour un instant T de la timeline */
  const CYAN = [.18, .9, 1], CYAN_LIN = CYAN.map(v => v ** 2.2), WHITE = [1, 1, 1];
  const ledXY = new Float32Array(N * 2);
  const tint = [0, 0, 0], glowCol = [0, 0, 0];   // couleur moyenne des LED allumées (écran), et sa lumière (linéaire)
  let flutter = 0;   // le rideau ondule quand on le déplace
  const storyRGB = new Float32Array(N * 3), streetRGB = new Float32Array(N * 3);
  function scene(T, k1, k2, time) {
    HALO.n = REFL.n = 0;
    const floorK = 1 - smooth(k1), props = 1 - smooth(k2);   // le sol s'efface après l'intro ; cadre, vitre et boîtier, en entrant dans la maison

    // 1. le plan : les quatre côtés de la fenêtre se tracent au néon, puis deviennent des montants
    const drawn = lin(T, .005, .085) * 4, solid = seg(T, .3, .4), blue = 1 - seg(T, .32, .44);
    const th = mix(.007, .05, solid) * props, depth = mix(.007, .06, solid) * props;
    const edges = [[FRAME.x0, FRAME.y1, 1, 0], [FRAME.x1, FRAME.y1, 0, -1], [FRAME.x1, FRAME.y0, -1, 0], [FRAME.x0, FRAME.y0, 0, 1]];
    edges.forEach(([sx, sy, dx, dy], e) => {
      const k = clamp(drawn - e), l = (dx ? FRAME.x1 - FRAME.x0 : FRAME.y1 - FRAME.y0) * k, o = e * 20;
      compose(G.frame.inst, o, sx + dx * l / 2, sy + dy * l / 2, FRAME.z, 0, 0, 0, l > 0 ? (dx ? l + th : th) : 0, dy ? l + th : th, depth);
      G.frame.inst.set(CYAN_LIN, o + 16);
      G.frame.inst[o + 19] = 2.6 * blue;
      if (blue > 0) for (let s = 0; s < l; s += .12) push(HALO, sx + dx * s, sy + dy * s, FRAME.z, ...CYAN, .35 * blue, .14);
      if (k > 0 && k < 1) push(HALO, sx + dx * l, sy + dy * l, FRAME.z, ...WHITE, 1, .24);   // la pointe qui trace
    });
    const dots = 1 - seg(T, .22, .34);   // un point cyan par future LED
    if (dots > 0) for (const L of LEDS) {
      const a = lin(T, .035 + L.j * .0035, .05 + L.j * .0035) * dots;
      if (a > 0) push(HALO, X0 + L.i * PITCH, ROD_Y - L.s, 0, ...CYAN, .5 * a, .05);
    }

    // 2. la tringle s'étire depuis le centre, avec ses embouts
    const rodK = back(lin(T, .085, .155)), rodLen = ROD_LEN * rodK, capK = seg(T, .12, .16);
    compose(G.rod.inst, 0, 0, ROD_Y, 0, 0, 0, Math.PI / 2, .022, rodLen, .022);
    compose(G.rod.inst, 20, -rodLen / 2, ROD_Y, 0, 0, 0, Math.PI / 2, .028 * capK, .034 * capK, .028 * capK);
    compose(G.rod.inst, 40, rodLen / 2, ROD_Y, 0, 0, 0, Math.PI / 2, .028 * capK, .034 * capK, .028 * capK);

    // 3. les fils tombent un à un, avec leurs LED, et se balancent avant de se poser
    for (let i = 0; i < COLS; i++) {
      const start = .165 + i * .0062, x = lin(T, start, start + .075), L = STRAND_LEN * spring(x);
      const sway = (i % 2 ? 1 : -1) * .16 * Math.sin(x * 10) * Math.exp(-x * 4)
        + (.004 * Math.sin(time * .9 + i * .7) + .07 * flutter * Math.sin(time * 5.5 + i * .55)) * Math.min(1, x * 3);
      const ax = X0 + i * PITCH, dx = Math.sin(sway), dy = -Math.cos(sway), clip = back(lin(T, start - .012, start + .02));
      compose(G.strands.inst, i * 20, ax + dx * L / 2, ROD_Y + dy * L / 2, 0, 0, 0, sway, L > 0 ? .0045 : 0, L, .0045);
      compose(G.clips.inst, i * 20, ax, ROD_Y, 0, 0, 0, Math.PI / 2, .021 * clip, .028 * clip, .021 * clip);
      for (let j = 0; j < ROWS; j++) {
        const n = j * COLS + i, s = LED_DROP + j * PITCH, a = clamp((L - s) / .06) * .021;
        ledXY[n * 2] = ax + dx * s; ledXY[n * 2 + 1] = ROD_Y + dy * s;
        compose(G.beads.inst, n * 20, ledXY[n * 2], ledXY[n * 2 + 1], 0, 0, 0, 0, a, a, a);
      }
    }

    // 4. le boîtier arrive en tournoyant, le bouton se clipse, les câbles se déroulent
    const bk = lin(T, .37, .47), be = smooth(bk), spin = 1 - be, bs = (bk > 0 ? mix(.35, 1, be) : 0) * props;
    const bounce = Math.sin(lin(T, .47, .5) * Math.PI) * -.012;
    compose(G.box.inst, 0, mix(-2.4, BOX[0], be), mix(.2, BOX[1], be) + Math.sin(bk * Math.PI) * .3 + bounce, mix(1.4, BOX[2], be), spin * 2.4, spin * -3.1, spin * 1.2, bs, bs, bs);
    const btn = back(lin(T, .47, .5)) * props;
    compose(G.button.inst, 0, BOX[0] - .035, BOX[1] + bounce, BOX_H[2] + .004, Math.PI / 2, 0, 0, .015 * btn, .012 * btn, .015 * btn);
    const ledOn = lin(T, .565, .575) * props, sk = back(lin(T, .48, .5)) * .0065 * props;
    compose(G.beads.inst, N * 20, BOX[0] + .045, BOX[1] + bounce, BOX_H[2] + .002, 0, 0, 0, sk, sk, sk);
    G.beads.inst.set(CYAN_LIN, N * 20 + 16);
    G.beads.inst[N * 20 + 19] = 4 * ledOn;
    if (ledOn > 0) push(HALO, BOX[0] + .045, BOX[1], BOX_H[2] + .01, ...CYAN, ledOn * (.85 + .15 * Math.sin(time * 3)), .09);
    const wired = props > .7 ? 1 : 0;   // dans la maison, les câbles restent hors de vue
    G.link.draw = Math.floor(seg(T, .44, .48) * (LINK.length - 1)) * G.link.geo.step * wired;
    G.usb.draw = Math.floor(seg(T, .46, .53) * (USB.length - 1)) * G.usb.geo.step * wired;

    // 5. le courant : une étincelle remonte le câble USB, traverse le boîtier, puis longe la tringle
    const along = (pts, u) => { const f = clamp(u) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), t = f - k; return [0, 1, 2].map(c => mix(pts[k][c], pts[k + 1][c], t)); };
    const spark = u => u < .565 ? along(USB, 1 - lin(u, .525, .565)) : u < .585 ? along(LINK, 1 - lin(u, .565, .585)) : [mix(-1.07, 1.07, lin(u, .585, .645)), ROD_Y, 0];
    if (T > .525 && T < .645) for (let k = 0; k < 4; k++) {
      const p = spark(T - k * .0025);
      push(HALO, p[0], p[1], p[2] + .01, ...(k ? CYAN : WHITE), 1.3 - k * .3, .2 - k * .035);
    }

    // 6. allumage : un éclair blanc balaie le rideau, le sapin reste ; puis le « M » du logo.
    //    En descendant, colonne par colonne, les motifs de l'histoire puis ceux de la rue prennent le relais.
    const now = performance.now() / 1000;
    if (k1 > 0 && k2 < 1) story.leds.sample(now, storyRGB);
    if (k2 > 0) street.leds.sample(now, streetRGB);
    let lit = 0, count = 0;
    tint[0] = tint[1] = tint[2] = 0;
    const mirror = .16 * (1 - .75 * seg(T, .82, .95)) * floorK;   // reflets plus discrets quand le texte final arrive
    for (let n = 0; n < N; n++) {
      const L = LEDS[n], k = lin(T, L.on, L.on + .022), o = n * 20, wave = .1 + L.i * .025;
      const wIntro = 1 - seg(k1, wave, wave + .35), wStreet = seg(k2, wave, wave + .35), wStory = (1 - wIntro) * (1 - wStreet);
      let r = 0, g = 0, b = 0, m = 0;
      if (k > 0 && wIntro > 0) {
        const flash = Math.sin(k * Math.PI) * .9;
        m = seg(T, .765 + L.i * .0035, .79 + L.i * .0035);
        const tw = L.star ? .72 + .28 * (.5 + .5 * Math.sin(time * 5.3 + L.phase)) : .93 + .07 * Math.sin(time * 2.1 + L.phase);
        const tree = L.tree ? L.treeK * tw * smooth(k) * (1 - m) : 0, logo = L.logo ? m * (.9 + .1 * Math.sin(time * 1.7 + L.i * .3)) : 0;
        const dip = 1 - .85 * Math.sin(m * Math.PI);
        r = Math.min(1, ((L.tree ? L.tree[0] * tree : 0) + (L.logo ? L.logo[0] * logo : 0)) * dip + flash) * wIntro;
        g = Math.min(1, ((L.tree ? L.tree[1] * tree : 0) + (L.logo ? L.logo[1] * logo : 0)) * dip + flash) * wIntro;
        b = Math.min(1, ((L.tree ? L.tree[2] * tree : 0) + (L.logo ? L.logo[2] * logo : 0)) * dip + flash) * wIntro;
        m *= wIntro;
      }
      if (wStory > 0) { r += storyRGB[n * 3] * wStory; g += storyRGB[n * 3 + 1] * wStory; b += storyRGB[n * 3 + 2] * wStory; }
      if (wStreet > 0) { r += streetRGB[n * 3] * wStreet; g += streetRGB[n * 3 + 1] * wStreet; b += streetRGB[n * 3 + 2] * wStreet; }
      r = Math.min(1, r); g = Math.min(1, g); b = Math.min(1, b);
      const bright = Math.max(r, g, b);
      G.beads.inst[o + 16] = r ** 2.2;
      G.beads.inst[o + 17] = g ** 2.2;
      G.beads.inst[o + 18] = b ** 2.2;
      G.beads.inst[o + 19] = 2.8 * bright;
      if (bright > .01) {
        const x = ledXY[n * 2], y = ledXY[n * 2 + 1], size = .3 * (.4 + .6 * bright) * (1 + .3 * m);
        push(HALO, x, y, .012, r, g, b, 1, size);
        push(REFL, x, 2 * FLOOR_Y - y, .012, r, g, b, mirror, size * 1.2);
        lit += bright; count++;
        tint[0] += r; tint[1] += g; tint[2] += b;
      }
    }
    const share = lit / N;
    for (let c = 0; c < 3; c++) {
      tint[c] = count ? tint[c] / count : 0;
      glowCol[c] = tint[c] ** 2.2 * share * 2.2;
    }
    return share;
  }

  /* rendu */
  const BG_RGB = hex('#05060A');
  const center = new Float32Array(4);
  function render(T, k1, k2, time, shot) {
    place(shot);
    const share = scene(T, k1, k2, time);
    const W = canvas.width, H = canvas.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(BG_RGB[0], BG_RGB[1], BG_RGB[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);

    // halo d'ambiance derrière la fenêtre : bleuté pendant le plan, puis teinté par les LED allumées
    const w = vp[7] * SUBJECT.y + vp[15];
    center[0] = ((vp[4] * SUBJECT.y + vp[12]) / w * .5 + .5) * W;
    center[1] = ((vp[5] * SUBJECT.y + vp[13]) / w * .5 + .5) * H;
    const blue = .08 * (1 - seg(T, .3, .5)), warm = .22 * Math.sqrt(share);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.useProgram(HAZE.p);
    gl.uniform2f(HAZE.u.u_res, W, H);
    gl.uniform2f(HAZE.u.u_center, center[0], center[1]);
    gl.uniform1f(HAZE.u.u_radius, Math.max(60, SUBJECT.h / (2 * shot.d * Math.tan(FOV / 2)) * H * .78));   // à l'échelle du rideau
    gl.uniform3fv(HAZE.u.u_bg, BG_RGB);
    gl.uniform3f(HAZE.u.u_col, CYAN[0] * blue + tint[0] * warm, CYAN[1] * blue + tint[1] * warm, CYAN[2] * blue + tint[2] * warm);
    gl.bindVertexArray(hazeVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // reflets des LED, vus à travers le sol brillant
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    drawGlows(REFL, H);

    // objets (le sol, translucide, laisse passer les reflets)
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(MESH.p);
    gl.uniformMatrix4fv(MESH.u.u_vp, false, vp);
    gl.uniform3fv(MESH.u.u_cam, eye);
    gl.uniform3f(MESH.u.u_glowPos, 0, SUBJECT.y, .25);
    gl.uniform3fv(MESH.u.u_glowCol, glowCol);
    gl.uniform3fv(MESH.u.u_bg, BG_RGB);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    G.floor.mat.alpha = .84 * (1 - smooth(k1));
    if (G.floor.mat.alpha > .01) drawGroup(G.floor);
    gl.disable(gl.BLEND);
    for (const g of [G.frame, G.rod, G.clips, G.strands, G.beads, G.box, G.button, G.link, G.usb]) drawGroup(g);

    // halos des LED, de l'étincelle et du plan
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    drawGlows(HALO, H);

    // vitre
    const glass = seg(T, .34, .44) * (1 - smooth(k2));
    if (glass > 0) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(GLASS.p);
      gl.uniformMatrix4fv(GLASS.u.u_vp, false, vp);
      gl.uniform3fv(GLASS.u.u_cam, eye);
      gl.uniform1f(GLASS.u.u_alpha, glass);
      gl.bindVertexArray(glassVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }
  function drawGroup(g) {
    const { mat } = g;
    gl.uniform3fv(MESH.u.u_base, mat.base);
    gl.uniform1f(MESH.u.u_metal, mat.metal);
    gl.uniform1f(MESH.u.u_gloss, mat.gloss);
    gl.uniform1f(MESH.u.u_alpha, mat.alpha);
    gl.uniform1f(MESH.u.u_rim, mat.rim);
    gl.bindVertexArray(g.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.ib);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.inst);
    const n = g.draw ?? g.geo.n;
    if (n > 0) gl.drawElementsInstanced(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, 0, g.count);
  }
  function drawGlows(g, H) {
    if (!g.n) return;
    gl.useProgram(GLOW.p);
    gl.uniformMatrix4fv(GLOW.u.u_vp, false, vp);
    gl.uniform1f(GLOW.u.u_ppu, H * proj[5] / 2);
    gl.uniform1f(GLOW.u.u_max, maxPoint);
    gl.bindVertexArray(g.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.b);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.data, 0, g.n * 8);
    gl.drawArrays(gl.POINTS, 0, g.n);
  }

  /* textes : légendes, lettres du logo, puis slogan et bouton */
  let shownT = -1;
  function overlay(T, hintK) {
    if (Math.abs(T - shownT) > 1e-4) {
      shownT = T;
      captions.forEach((li, c) => {
        const [a, b] = CAPTIONS[c], inK = c ? seg(T, a, a + .03) : 1, outK = seg(T, b - .03, b);
        li.style.opacity = (inK * (1 - outK)).toFixed(3);
        li.style.transform = `translateY(${((1 - inK) * 18 - outK * 18).toFixed(1)}px)`;
      });
      letters.forEach((s, k) => s.style.setProperty('--k', seg(T, .84 + k * .02, .9 + k * .02).toFixed(3)));
      kicker.style.opacity = (1 - seg(T, .84, .9)).toFixed(3);   // le texte final reprend le nom et le prix
      const end = seg(T, .9, .98);
      text.style.setProperty('--end', end.toFixed(3));
      cta.inert = end < .5;
    }
    hint.style.opacity = hintK.toFixed(3);
  }

  /* boucle : début automatique, puis défilement (intro, descente vers l'histoire, puis vers la rue) ;
     le calque est masqué et la boucle arrêtée au-delà de la rue */
  let T = 0, auto = 0, autoDoneAt = 0, running = false, last = null;
  const run = on => {
    canvas.style.visibility = on ? '' : 'hidden';
    if (on === running) return;
    running = on;
    on ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
  };
  const hero = ScrollTrigger.create({ trigger: heroTrack, start: 'top top', end: 'bottom bottom' });
  const toStory = ScrollTrigger.create({ trigger: heroTrack, start: 'bottom bottom', endTrigger: story.track, end: 'top top' });
  const toStreet = ScrollTrigger.create({ trigger: story.track, start: 'bottom bottom', endTrigger: street.track, end: 'top top' });
  const range = ScrollTrigger.create({ trigger: heroTrack, start: 'top bottom', endTrigger: street.track, end: 'bottom top', onToggle: self => run(self.isActive) });
  let k1 = toStory.progress, k2 = toStreet.progress;   // page rechargée plus bas : le rideau y est déjà,
  if (hero.progress > 0 || k1 > 0) { auto = 1; T = AUTO + (1 - AUTO) * hero.progress; }   // sans rejouer le début
  const approach = (v, goal, k) => Math.abs(goal - v) < 1e-3 ? goal : v + (goal - v) * k;
  function tick(time, deltaMs) {
    const dt = Math.min(.05, deltaMs / 1000), follow = 1 - Math.exp(-dt * 6);
    if (auto < 1) { auto = Math.min(1, auto + dt / AUTO_SECONDS); if (auto === 1) autoDoneAt = time; }
    T = approach(T, AUTO * smooth(auto) + (1 - AUTO) * hero.progress, follow);
    k1 = approach(k1, toStory.progress, follow);
    k2 = approach(k2, toStreet.progress, follow);
    const shot = shotAt(T, k1, k2, time);
    if (last) flutter = Math.min(1, flutter * Math.exp(-dt * 2.5) + (Math.abs(shot.cx - last.cx) + Math.abs(shot.cy - last.cy) + Math.abs(shot.d - last.d) / shot.d) * 2.5);
    last = shot;
    render(T, k1, k2, time, shot);
    overlay(T, auto < 1 ? 0 : clamp((time - autoDoneAt - .8) / .6) * (1 - lin(hero.progress, 0, .015)));
  }
  layout();
  run(range.isActive);
  document.documentElement.dataset.intro = 'on';   // le filet de sécurité du <head> ne retirera plus l'intro
  ScrollTrigger.addEventListener('refresh', layout);   // emplacements remesurés après chaque recalcul des pistes
  new ResizeObserver(layout).observe(canvas);
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    run(false);
    for (const t of [hero, toStory, toStreet, range]) t.kill();
    onFail?.();
  }, { once: true });
}
