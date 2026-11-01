// main.js — Page d'accueil MAVYA : intro 3D, grilles LED, histoire au défilement, « Vu de la rue »,
// apparitions et compteurs (GSAP + ScrollTrigger), défilement fluide (Lenis),
// barre d'achat mobile et chargement différé de la boutique Shopify.

import { LedGrid, Pattern, Drawing, Snow, Heart, Marquee, motion } from './led-grid.js?v=dev';
import { SAPIN, PERE_NOEL, MAVYA_STILL, heartRows } from './patterns.js?v=dev';

const root = document.documentElement;
const { gsap, ScrollTrigger, Lenis } = window;
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* animations au défilement : seulement si le mouvement est autorisé et GSAP bien chargé */
const animated = motion && !!(gsap && ScrollTrigger);
root.classList.toggle('motion', animated);
if (animated) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
}

const sapin = () => new Pattern(SAPIN, { twinkle: 'S' });
const marquee = () => new Marquee('MAVYA * ', { still: MAVYA_STILL });

/* ---------- Défilement fluide (Lenis à la molette ; le tactile reste natif) ---------- */
let lenis = null;
if (animated && Lenis) {
  lenis = new Lenis({ lerp: .12, prevent: node => !!node.closest?.('.shopify-buy-cart-wrapper') });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToY = y => lenis ? lenis.scrollTo(y) : scrollTo({ top: y, behavior: motion ? 'smooth' : 'auto' });

/* liens internes : défilement sous l'en-tête (marge = scroll-padding-top du CSS), puis focus
   sur la cible pour que le clavier reparte de là (lien « Aller au contenu », retour en haut) */
document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  const target = link && link.hash.length > 1 && document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { offset: -(parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) });
  else target.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
  history.replaceState(null, '', link.hash);
  if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
});

/* ---------- 1. Hero : intro 3D (WebGL 2) ; sinon la grille 2D s'allume et dessine un sapin ---------- */
function heroGrid() {
  root.classList.remove('intro-3d');
  const hero = new LedGrid($('[data-led="hero"]'));
  if (motion) setTimeout(() => hero.show(sapin(), { order: 'up', spread: 1.7, duration: .3, flash: 1 }), 450);
  else hero.show(sapin(), { instant: true });
}
if (animated && root.classList.contains('intro-3d')) {
  const fallback = () => { heroGrid(); ScrollTrigger.refresh(); };
  import('./intro3d.js?v=dev')
    .then(m => m.startIntro({ stage: $('.hero__stage'), gsap, ScrollTrigger, onFail: fallback }))
    .catch(err => { console.error(err); fallback(); });
} else heroGrid();

/* ---------- 2. Histoire : un motif par étape, grille épinglée pendant le défilement ---------- */
const story = $('[data-story]');
if (story) {
  const canvas = $('canvas', story);
  const grid = new LedGrid(canvas);
  const steps = $$('[data-step]', story), dots = $$('[data-goto]', story);
  const scenes = [
    [sapin(), { order: 'up', spread: .7 }],
    [new Drawing(PERE_NOEL), { order: 'random', spread: .3, duration: .16, flash: 0 }],
    [new Snow(), { order: 'down', spread: .6 }],
    [new Heart(), { order: 'center', spread: .5 }],
    [marquee(), { order: 'right', spread: .45 }],
  ];
  let current = -1;
  const go = (i, instant = false) => {
    if (i === current) return;
    current = i;
    steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    dots.forEach((d, j) => j === i ? d.setAttribute('aria-current', 'step') : d.removeAttribute('aria-current'));
    canvas.setAttribute('aria-label', `Rideau de LED : ${steps[i].dataset.label}.`);
    const [scene, how] = scenes[i];
    grid.show(scene, instant ? { instant } : how);
  };
  go(0, true);

  if (animated) {
    const st = ScrollTrigger.create({
      trigger: $('.story__track', story), start: 'top top', end: 'bottom bottom',
      onUpdate: self => go(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))),
    });
    dots.forEach((d, i) => d.addEventListener('click', () => scrollToY(st.start + (st.end - st.start) * (i + .5) / steps.length)));
  } else {
    dots.forEach((d, i) => d.addEventListener('click', () => go(i, true)));
  }
}

/* ---------- 3. Vu de la rue : le jour tombe, la fenêtre s'allume ligne par ligne ---------- */
const street = $('[data-street]');
if (street) {
  const scene = $('.street__scene', street), buttons = $$('[data-time]', street);
  const grid = new LedGrid($('canvas', street), { glow: 1.15, base: .8 });
  grid.show(new Snow({ under: sapin(), ground: false, count: 12 }), { instant: true });
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const set = p => {   // p : 0 = plein jour, 1 = nuit et rideau allumé
    scene.style.setProperty('--night', smooth(.04, .5, p).toFixed(3));
    scene.style.setProperty('--glow', smooth(.58, .95, p).toFixed(3));
    grid.setReveal(clamp((p - .46) / .36));
    buttons.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.time === (p < .46 ? 0 : 1))));
  };
  if (animated) {
    const st = ScrollTrigger.create({
      trigger: $('.street__track', street), start: 'top top', end: 'bottom bottom',
      onUpdate: self => set(self.progress),
    });
    set(0);
    buttons.forEach(b => b.addEventListener('click', () => scrollToY(+b.dataset.time ? st.end - 2 : st.start + 2)));
  } else {
    set(1);
    buttons.forEach(b => b.addEventListener('click', () => set(+b.dataset.time)));
  }
}

/* ---------- 4. Apparitions en cascade et compteurs ---------- */
if (animated) {
  for (const el of $$('[data-reveal]')) {
    gsap.from(el, { y: 28, autoAlpha: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  }
  for (const list of $$('[data-stagger]')) {
    gsap.from(list.children, { y: 32, autoAlpha: 0, duration: .8, ease: 'power3.out', stagger: .08, scrollTrigger: { trigger: list, start: 'top 86%', once: true } });
  }
  for (const el of $$('[data-count]')) {
    const end = +el.dataset.count, n = { v: 0 };
    el.textContent = '0';
    gsap.to(n, {
      v: end, duration: 1.8, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => { el.textContent = Math.round(n.v).toLocaleString('fr-FR'); },
    });
  }
}

/* ---------- 5. Tailles : aperçus 16 × 16 et 20 × 20 à la même échelle ---------- */
for (const canvas of $$('[data-led-size]')) {
  const n = +canvas.dataset.ledSize;
  new LedGrid(canvas, { cols: n, rows: n, shimmer: false }).show(new Pattern(heartRows(n)), { instant: true });
}

/* ---------- 6. Commander : grille qui enchaîne les motifs, boutique chargée à l'approche ---------- */
const buyGrid = new LedGrid($('[data-led="buy"]'));
const showcase = [sapin(), new Pattern(PERE_NOEL), new Snow(), new Heart(), marquee()];
let shown = 0;
buyGrid.show(showcase[0], { instant: true });
if (motion) setInterval(() => {
  if (buyGrid.visible && !document.hidden) buyGrid.show(showcase[shown = (shown + 1) % showcase.length], { order: 'random', spread: .55 });
}, 4200);

const shopNode = $('[data-shop]');
let shop = null;
const loadShop = () => shop ||= import('./shop.js?v=dev').then(m => { m.mountShop(shopNode); return m; });
new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); loadShop(); } }, { rootMargin: '1200px 0px' }).observe(shopNode);
for (const link of $$('a[href="#acheter"]')) link.addEventListener('click', loadShop);
for (const btn of $$('[data-pick]')) btn.addEventListener('click', () => loadShop().then(m => m.pickSize(btn.dataset.pick)));

/* ---------- Barre d'achat mobile : visible après le hero, masquée près de la commande ---------- */
const bar = $('[data-buybar]');
let pastHero = false;
const near = new Set();
const updateBar = () => {
  const on = pastHero && near.size === 0;
  bar.classList.toggle('is-visible', on);
  bar.inert = !on;
  root.classList.toggle('has-buybar', on);
};
new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; updateBar(); }).observe($('.hero__cta'));
const nearObserver = new IntersectionObserver(entries => {
  for (const e of entries) e.isIntersecting ? near.add(e.target) : near.delete(e.target);
  updateBar();
});
nearObserver.observe($('#acheter'));
nearObserver.observe($('.site-footer'));
