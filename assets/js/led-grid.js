// led-grid.js — Rideau LED dessiné en canvas.
// Chaque LED = un halo flou + un cœur lumineux, superposés en mélange additif.
// Les scènes écrivent une couleur et une intensité par LED ; la grille gère les transitions
// point par point, le scintillement, et ne dessine que lorsqu'elle est visible à l'écran.

import { COLORS, FONT_BIG, HEART, HEART_SMALL } from './patterns.js?v=dev';

export const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const ease = k => k * k * (3 - 2 * k);

/* ---------- Sprites : un halo et un cœur par couleur, partagés entre les grilles ---------- */

const sprites = new Map();

function radial(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function led(hex) {
  let s = sprites.get(hex);
  if (!s) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const c = a => `rgba(${r},${g},${b},${a})`;
    const hot = k => Math.round(k + (255 - k) * .72);   // centre de la LED : presque blanc
    s = {
      halo: radial(64, [[0, c(.6)], [.16, c(.37)], [.4, c(.13)], [.7, c(.04)], [1, c(0)]]),
      core: radial(48, [[0, `rgb(${hot(r)},${hot(g)},${hot(b)})`], [.32, c(1)], [.62, c(.5)], [1, c(0)]]),
      rgb: [r / 255, g / 255, b / 255],   // pour le rideau 3D
    };
    sprites.set(hex, s);
  }
  return s;
}

/** '#hex' ou ['#hex', intensité] → { s: sprite, v: intensité } */
function paint(spec) {
  const [hex, v = 1] = Array.isArray(spec) ? spec : [spec];
  return { s: led(hex), v };
}

/** n couleurs (hex) réparties sur un dégradé passant par `stops`. */
export function gradient(stops, n) {
  const rgb = stops.map(h => { const x = parseInt(h.slice(1), 16); return [x >> 16, x >> 8 & 255, x & 255]; });
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1) * (rgb.length - 1), k = Math.min(rgb.length - 2, Math.floor(t)), f = t - k;
    return '#' + rgb[k].map((v, j) => Math.round(v + (rgb[k + 1][j] - v) * f).toString(16).padStart(2, '0')).join('');
  });
}

/* ---------- Scènes : render(t, frame, grid) écrit les LED et dit si l'image bouge ---------- */

/** Image fixe ; les caractères listés dans `twinkle` scintillent. */
export class Pattern {
  constructor(rows, { colors = COLORS, twinkle = '' } = {}) {
    this.cells = [];
    rows.forEach((line, r) => [...line].forEach((ch, c) => {
      if (!colors[ch]) return;
      const { s, v } = paint(colors[ch]);
      this.cells.push({ c, r, s, v, tw: twinkle.includes(ch) ? Math.random() * 7 : -1 });
    }));
    this.animated = !!twinkle;
  }
  render(t, f, grid) {
    for (const p of this.cells) {
      const v = p.tw < 0 || !grid.motion ? p.v : p.v * (.66 + .55 * Math.sin(t * 2.7 + p.tw) ** 8 + .1 * Math.sin(t * 1.3 + p.tw));
      grid.put(f, p.c, p.r, p.s, v);
    }
    return this.animated;
  }
}

/** Dessin qui se trace pixel par pixel, comme au doigt dans l'appli, avec un « stylo » blanc. */
export class Drawing {
  constructor(rows, { colors = COLORS, rate = 105 } = {}) {
    this.cells = new Pattern(rows, { colors }).cells.sort((a, b) => a.r - b.r || (a.r % 2 ? b.c - a.c : a.c - b.c));
    this.rate = rate;
    this.pen = led('#FFFFFF');
  }
  render(t, f, grid) {
    const n = this.cells.length, k = grid.motion ? Math.floor(t * this.rate) : n;
    const end = n / this.rate, boost = grid.motion && t > end ? 1 + .4 * clamp(1 - (t - end) / .5) : 1;
    for (let i = 0; i < Math.min(k, n); i++) { const p = this.cells[i]; grid.put(f, p.c, p.r, p.s, p.v * boost); }
    if (k < n) { const p = this.cells[k]; grid.put(f, p.c, p.r, this.pen, 1); }
    return k < n || boost > 1;
  }
}

/** Flocons qui tombent, éventuellement devant un autre motif, avec un sol enneigé. */
export class Snow {
  constructor({ under = null, count = 17, ground = true, seed = 11 } = {}) {
    Object.assign(this, { under, count, ground, seed });
    this.white = led('#F4F8FF');
    this.ice = led('#BDEEFF');
    this.still = 2.6;
  }
  spawn(cols, rows) {
    let s = this.seed;
    const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
    const xs = Array.from({ length: cols }, (_, i) => i).sort(() => rnd() - .5);
    this.flakes = Array.from({ length: this.count }, (_, i) => {
      const big = i % 4 === 0;
      return {
        x: xs[i % cols], y: rnd() * (rows + 4), big, ph: rnd() * 7,
        speed: big ? 1.5 + rnd() * .8 : 2.3 + rnd() * 2.2,
        v: big ? 1 : .55 + rnd() * .45,
        s: rnd() < .35 ? this.ice : this.white,
      };
    });
  }
  render(t, f, grid) {
    const { cols, rows } = grid;
    if (!this.flakes) this.spawn(cols, rows);
    if (this.under) this.under.render(t, f, grid);
    for (const k of this.flakes) {
      const y = (k.y + t * k.speed) % (rows + 4) - 2, y0 = Math.floor(y), fr = y - y0;
      const x = k.x + (k.big ? Math.round(Math.sin(t * .9 + k.ph) * .6) : 0);
      this.dot(grid, f, x, y0, k.s, k.v * (1 - fr));
      this.dot(grid, f, x, y0 + 1, k.s, k.v * fr);
      if (k.big) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        this.dot(grid, f, x + dx, y0 + dy, k.s, k.v * .45 * (1 - fr));
        this.dot(grid, f, x + dx, y0 + dy + 1, k.s, k.v * .45 * fr);
      }
    }
    if (this.ground) for (let c = 0; c < cols; c++) {
      const bump = Math.sin(c * 1.7 + 1);
      this.dot(grid, f, c, rows - 1, this.white, .3 + .2 * bump * bump);
      if (bump > .7) this.dot(grid, f, c, rows - 2, this.white, .2);
    }
    return true;
  }
  dot(grid, f, c, r, s, v) {   // la neige passe devant le motif sans l'assombrir
    if (v < .03 || c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return;
    const i = r * grid.cols + c;
    if (v >= f.v[i] * .7) { f.s[i] = s; f.v[i] = Math.max(v, f.v[i] * .5); }
  }
}

/** Cœur qui bat (mode musique), avec des étincelles sur chaque temps. */
export class Heart {
  constructor({ bpm = 74 } = {}) {
    this.period = 60 / bpm;
    const shape = (mask, tint) => mask.flatMap((line, r) => [...line].flatMap((px, c) =>
      px === 'X' ? [{ c, r, s: tint[Math.round(r / (mask.length - 1) * (tint.length - 1))] }] : []));
    const tint = gradient(['#FF3DD8', '#FF4F9A', '#FF2E4D'], 9).map(led);
    this.big = shape(HEART, tint);
    this.small = shape(HEART_SMALL, tint);
    this.shine = led('#FFFFFF');
    this.sparks = ['#2DE2FF', '#FFC24B', '#FF3DD8'].map(led);
    this.still = .03 * this.period;
  }
  render(t, f, grid) {
    const ph = (t % this.period) / this.period;
    const pulse = Math.max(Math.exp(-(((ph - .03) / .07) ** 2)), .6 * Math.exp(-(((ph - .27) / .07) ** 2)));
    const big = pulse > .4, cells = big ? this.big : this.small;
    const ox = (grid.cols - (big ? 16 : 12)) / 2, oy = Math.round((grid.rows - (big ? 13 : 10)) / 2);
    const v = .72 + .32 * pulse;
    for (const p of cells) grid.put(f, p.c + ox, p.r + oy, p.s, v);
    grid.put(f, ox + (big ? 3 : 2), oy + 2, this.shine, .85 * v);
    if (grid.motion) {
      const beat = Math.floor(t / this.period), life = Math.exp(-ph * 4.5);
      for (let k = 0; k < 6; k++) {
        const h = Math.sin(beat * 12.9898 + k * 78.233) * 43758.5453, a = (h - Math.floor(h)) * Math.PI * 2;
        const d = 8.4 + (k % 2) * 1.1;
        grid.put(f, Math.round((grid.cols - 1) / 2 + Math.cos(a) * d), Math.round((grid.rows - 1) / 2 + Math.sin(a) * d), this.sparks[k % 3], life);
      }
    }
    return true;
  }
}

/** Texte qui défile de droite à gauche, en dégradé néon. */
export class Marquee {
  constructor(text, { font = FONT_BIG, y = 4, gap = 2, speed = 11, lead = 7, still = null } = {}) {
    const tape = Array(20).fill(0), GOLD = 1 << 30;
    for (const ch of text) {
      if (ch === ' ') { tape.push(0, 0, 0, 0, 0); continue; }
      const glyph = font[ch];
      for (let x = 0; x < glyph[0].length; x++) {
        tape.push(glyph.reduce((bits, row, r) => row[x] === 'X' ? bits | 1 << r : bits, ch === '*' ? GOLD : 0));
      }
      for (let i = 0; i < gap; i++) tape.push(0);
    }
    Object.assign(this, { tape, y, speed, lead, rows: font.M.length, GOLD });
    this.tint = gradient(['#2DE2FF', '#8F7BFF', '#FF3DD8', '#8F7BFF', '#2DE2FF'], 32).map(led);
    this.gold = led('#FFC24B');
    this.fixed = still && new Pattern(still);   // version fixe si le mouvement est réduit
  }
  render(t, f, grid) {
    if (!grid.motion && this.fixed) return this.fixed.render(t, f, grid);
    const L = this.tape.length, off = t * this.speed + this.lead, base = Math.floor(off), fr = off - base;
    for (let c = 0; c < grid.cols; c++) {
      const ka = (base + c) % L, a = this.tape[ka], b = this.tape[(ka + 1) % L];
      if (!a && !b) continue;
      const s = (a | b) & this.GOLD ? this.gold : this.tint[Math.floor(ka / L * 32 + t * 2.2) % 32];
      for (let r = 0; r < this.rows; r++) {
        const v = (a >> r & 1) * (1 - fr) + (b >> r & 1) * fr;
        if (v > .02) grid.put(f, c, r + this.y, s, v);
      }
    }
    return true;
  }
}

/* ---------- Boucle d'animation commune : une seule requestAnimationFrame pour toutes les grilles ---------- */

const grids = new Set();
let raf = 0;

function loop(now) {
  raf = 0;
  let again = false;
  for (const g of grids) {
    if (!g.visible || !g.dirty) continue;
    try { g.dirty = g.draw(now / 1000); } catch (err) { g.dirty = false; console.error(err); }   // une grille en panne ne fige pas les autres
    again ||= g.dirty;
  }
  if (again) raf = requestAnimationFrame(loop);
}
const wake = () => { raf ||= requestAnimationFrame(loop); };

const onScreen = new IntersectionObserver(entries => {
  for (const e of entries) {
    const g = e.target.ledGrid;
    g.visible = e.isIntersecting;
    if (g.visible) g.touch();
  }
}, { rootMargin: '80px 0px' });

class Frame {
  constructor(n) { this.s = new Array(n).fill(null); this.v = new Float32Array(n); }
  clear() { this.s.fill(null); this.v.fill(0); }
}

/** Ce que montre un rideau : scène, transition LED par LED, luminosité, allumage ligne par ligne. */
class LedState {
  constructor({ cols = 20, rows = 20, shimmer = true } = {}) {
    Object.assign(this, { cols, rows, n: cols * rows });
    this.motion = motion;
    this.shimmer = shimmer && motion;
    this.a = new Frame(this.n);
    this.b = new Frame(this.n);
    this.scene = this.next = null;
    this.level = 1;          // luminosité générale (0 = rideau éteint)
    this.revealAt = 1;       // allumage ligne par ligne, de haut en bas (0 → 1)
    this.delay = new Float32Array(this.n);
    this.rnd = Float32Array.from({ length: this.n }, Math.random);
    this.jitter = Float32Array.from({ length: cols }, Math.random);
  }

  touch() {}

  put(f, c, r, s, v) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    const i = r * this.cols + c;
    f.s[i] = s;
    f.v[i] = v;
  }

  /** Affiche une scène : instantanément, ou LED par LED dans l'ordre demandé. */
  show(scene, { order = 'random', spread = .6, duration = .22, flash = .6, instant = false } = {}) {
    const now = performance.now() / 1000;
    if (instant || !this.motion) {
      this.scene = scene;
      this.start = now;
      this.next = null;
    } else {
      if (this.next) this.finish();
      Object.assign(this, { next: scene, nextStart: now, tStart: now, spread, ledDur: duration, flash });
      this.order(order, spread);
    }
    this.touch();
  }

  finish() {
    this.scene = this.next;
    this.start = this.nextStart;
    this.next = null;
  }

  order(kind, spread) {
    const { cols, rows, rnd } = this;
    for (let i = 0; i < this.n; i++) {
      const c = i % cols, r = (i - c) / cols, j = rnd[i] * .18;
      let d;
      switch (kind) {
        case 'up': d = (rows - 1 - r) / (rows - 1) * .82 + j; break;
        case 'down': d = r / (rows - 1) * .82 + j; break;
        case 'right': d = c / (cols - 1) * .82 + j; break;
        case 'center': d = Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) / Math.hypot(cols / 2, rows / 2) * .82 + j; break;
        default: d = Math.random();
      }
      this.delay[i] = d * spread;
    }
  }

  setLevel(v) { if (v !== this.level) { this.level = v; this.touch(); } }
  setReveal(p) { if (p !== this.revealAt) { this.revealAt = p; this.touch(); } }

  revealOf(c, r) {
    const p = this.revealAt;
    return p >= 1 ? 1 : p <= 0 ? 0 : clamp(p * (this.rows + 4) - 2 - r + (this.jitter[c] - .5) * 1.6);
  }

  /** Calcule l'image de la scène affichée (A) et, pendant une transition, de la suivante (B). */
  frames(now) {
    if (this.next && now - this.tStart >= this.spread + this.ledDur) this.finish();
    // l'horodatage d'une image peut précéder de quelques ms l'appel à show() : on borne à 0
    const since = t0 => Math.max(0, now - t0);
    this.a.clear();
    const moving = this.scene ? this.scene.render(this.motion ? since(this.start) : this.scene.still ?? 2, this.a, this) : false;
    const fading = !!this.next;
    if (fading) { this.b.clear(); this.next.render(since(this.nextStart), this.b, this); }
    return { moving, fading, tt: fading ? since(this.tStart) : 0 };
  }

  /** Intensité de la LED i : luminosité, allumage ligne par ligne, léger scintillement. */
  gain(i, now) {
    const c = i % this.cols, r = (i - c) / this.cols, rnd = this.rnd;
    const m = this.level * this.revealOf(c, r);
    return this.shimmer ? m * (.9 + .1 * Math.sin(now * (1.1 + rnd[i] * 1.9) + rnd[i] * 50)) : m;
  }
}

/** Mêmes scènes et transitions, sans dessin : la couleur de chaque LED, pour le rideau 3D. */
export class LedSource extends LedState {
  /** Écrit dans `out` (r, g, b de chaque LED, de 0 à 1 environ) l'image de l'instant `now` (en s). */
  sample(now, out) {
    const { a: A, b: B, n } = this, { fading, tt } = this.frames(now), white = led('#FFFFFF').rgb;
    for (let i = 0; i < n; i++) {
      const va = A.v[i], vb = fading ? B.v[i] : 0;
      let r = 0, g = 0, b = 0;
      if (va > 0 || vb > 0) {
        const m = this.gain(i, now), k = fading ? ease(clamp((tt - this.delay[i]) / this.ledDur)) : 1;
        if (va > 0) { const w = va * (fading ? 1 - k : 1) * m, s = A.s[i].rgb; r += s[0] * w; g += s[1] * w; b += s[2] * w; }
        if (vb > 0) {
          const w = vb * k * m, s = B.s[i].rgb, fl = this.flash * Math.sin(Math.PI * k) * vb * (1 - Math.min(1, va)) * m;
          r += s[0] * w + white[0] * fl; g += s[1] * w + white[1] * fl; b += s[2] * w + white[2] * fl;
        }
      }
      out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
    }
  }
}

/** Rideau dessiné en canvas 2D. */
export class LedGrid extends LedState {
  constructor(canvas, { cols = 20, rows = 20, rod = true, shimmer = true, glow = 1, base = 1, dpr = 0 } = {}) {
    super({ cols, rows, shimmer });
    Object.assign(this, { canvas, rod, glow, base, dpr });
    this.ctx = canvas.getContext('2d');
    this.visible = false;
    this.dirty = true;
    canvas.ledGrid = this;
    new ResizeObserver(() => { this.layout(); this.touch(); }).observe(canvas);
    onScreen.observe(canvas);
    grids.add(this);
  }

  touch() { this.dirty = true; wake(); }

  layout() {
    const dpr = this.dpr || Math.min(devicePixelRatio || 1, 2);   // résolution imposée (image de partage) ou écran, plafonnée à 2
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    if (!w || !h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    const pad = .8, top = this.rod ? .7 : 0;
    const cell = this.cell = Math.min(w / (this.cols + pad * 2), h / (this.rows + pad * 2 + top));
    const ox = (w - this.cols * cell) / 2, oy = (h - (this.rows + top) * cell) / 2 + top * cell;
    this.xs = Float32Array.from({ length: this.cols }, (_, c) => ox + (c + .5) * cell);
    this.ys = Float32Array.from({ length: this.rows }, (_, r) => oy + (r + .5) * cell);

    // fond : tringle, fils et LED éteintes, dessinés une fois par taille
    const bg = this.bg ||= document.createElement('canvas');
    bg.width = w;
    bg.height = h;
    const g = bg.getContext('2d'), k = this.base;
    const top0 = this.rod ? oy - cell * .62 : this.ys[0];
    g.strokeStyle = `rgba(255,255,255,${.055 * k})`;
    g.lineWidth = Math.max(1, cell * .04);
    g.beginPath();
    for (const x of this.xs) { g.moveTo(x, top0); g.lineTo(x, this.ys[this.rows - 1]); }
    g.stroke();
    if (this.rod) {
      g.fillStyle = `rgba(255,255,255,${.16 * k})`;
      g.beginPath();
      const rod = [ox - cell * .3, top0 - cell * .1, this.cols * cell + cell * .6, cell * .18];
      g.roundRect ? g.roundRect(...rod, cell * .09) : g.rect(...rod);
      g.fill();
    }
    g.fillStyle = `rgba(255,255,255,${.09 * k})`;
    const rr = cell * .12;
    g.beginPath();
    for (const y of this.ys) for (const x of this.xs) { g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2); }
    g.fill();
  }

  /** Dessine une image ; renvoie true tant qu'il faut continuer à animer. */
  draw(now) {
    if (!this.cell) return false;
    const { ctx, cols, n, xs, ys, cell, a: A, b: B } = this;
    const { moving, fading, tt } = this.frames(now);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.bg, 0, 0);
    const busy = this.motion && (moving || fading || this.shimmer && !!this.scene);
    if (this.level <= 0) return busy;

    ctx.globalCompositeOperation = 'lighter';
    const white = led('#FFFFFF');
    for (let pass = 0; pass < 2; pass++) {
      const halo = pass === 0, rad = halo ? cell * 1.65 * this.glow : cell * .36, size = rad * 2;
      for (let i = 0; i < n; i++) {
        const va = A.v[i], vb = fading ? B.v[i] : 0;
        if (va <= 0 && vb <= 0) continue;
        const c = i % cols, r = (i - c) / cols, m = this.gain(i, now);
        if (m <= .003) continue;
        const x = xs[c] - rad, y = ys[r] - rad;
        let k = 1;
        if (fading) k = ease(clamp((tt - this.delay[i]) / this.ledDur));
        if (va > 0) this.dot(halo ? A.s[i].halo : A.s[i].core, va * (fading ? 1 - k : 1) * m, x, y, size);
        if (vb > 0) {
          this.dot(halo ? B.s[i].halo : B.s[i].core, vb * k * m, x, y, size);
          const fl = this.flash * Math.sin(Math.PI * k) * vb * (1 - Math.min(1, va)) * m;   // éclair blanc à l'allumage
          if (fl > .01) this.dot(halo ? white.halo : white.core, fl, x, y, size);
        }
      }
    }
    return busy;
  }

  dot(img, a, x, y, size) {
    if (a <= .004) return;
    this.ctx.globalAlpha = a > 1 ? 1 : a;
    this.ctx.drawImage(img, x, y, size, size);
  }
}
