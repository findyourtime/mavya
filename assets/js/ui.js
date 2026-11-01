// ui.js — Détails d'interface communs à toutes les pages : en-tête qui se réduit et se floute
// au défilement, barre de progression de lecture et bouton « retour en haut ».

const root = document.documentElement;
const header = document.querySelector('.site-header');
const progress = document.querySelector('[data-progress]');
const toTop = document.querySelector('[data-totop]');

function update() {
  const y = scrollY, max = root.scrollHeight - innerHeight;
  header?.classList.toggle('is-scrolled', y > 8);
  progress?.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, y / max)).toFixed(4) : 0);
  toTop?.classList.toggle('is-visible', y > innerHeight);   // après le premier écran
}

addEventListener('scroll', update, { passive: true });
addEventListener('resize', update);
update();
