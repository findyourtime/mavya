// patterns.js — Pixel-arts et polices de la grille LED.
// Motifs génériques dessinés à la main : une chaîne par ligne, un caractère par LED (« . » = éteinte).

/** Couleurs des LED : '#hex' ou ['#hex', intensité]. */
export const COLORS = {
  S: '#FFD266',            // étoile (scintille)
  Y: '#FFC24B',            // doré
  G: '#25F06F',            // vert sapin
  g: ['#25F06F', .42],     // vert dans l'ombre
  b: ['#FF7A1F', .5],      // tronc
  R: '#FF2E4D',            // rouge
  W: '#F2F6FF',            // blanc
  K: '#FFAE85',            // visage
  C: '#2DE2FF',            // cyan
  M: '#FF3DD8',            // magenta
  P: '#FF5FA2',            // rose
};

export const SAPIN = [
  '.........SS.........',
  '.......SSSSSS.......',
  '........SSSS........',
  '........S..S........',
  '.........Gg.........',
  '........GGGg........',
  '.......GGRGgg.......',
  '......GGGGGGgg......',
  '.......GGGGgg.......',
  '......GGCGGGgg......',
  '.....GGGGGGMGgg.....',
  '....GGGGGGGGGGgg....',
  '......GGGGGGgg......',
  '.....GGYGGGRGgg.....',
  '....GGGGGCGGGGgg....',
  '...GGMGGGGGGGYGgg...',
  '..GGGGGGGRGGGGGGgg..',
  '..RYR....bb....CYC..',
  '..YYY...bbbb...YYY..',
  '..RYR..........CYC..',
];

export const PERE_NOEL = [
  '..............WW....',
  '............RRWW....',
  '..........RRRRR.....',
  '........RRRRRRR.....',
  '......RRRRRRRRRR....',
  '....WWWWWWWWWWWW....',
  '....WWWWWWWWWWWW....',
  '.....KKKKKKKKKK.....',
  '.....KK.KKKK.KK.....',
  '.....KKKKKKKKKK.....',
  '....WPKKKRRKKKPW....',
  '...WWWWWWWWWWWWWW...',
  '...WWWWWWRRWWWWWW...',
  '...WWWWWWWWWWWWWW...',
  '....WWWWWWWWWWWW....',
  '.....WWWWWWWWWW.....',
  '......WWWWWWWW......',
  '.......WWWWWW.......',
  '.........WW.........',
  '....................',
];

/** Cœur battant : grand (16 × 13) et petit (12 × 10). */
export const HEART = [
  '..XXXX....XXXX..',
  '.XXXXXX..XXXXXX.',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  '.XXXXXXXXXXXXXX.',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '.....XXXXXX.....',
  '......XXXX......',
  '.......XX.......',
];

export const HEART_SMALL = [
  '..XXX..XXX..',
  '.XXXXXXXXXX.',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  'XXXXXXXXXXXX',
  '.XXXXXXXXXX.',
  '..XXXXXXXX..',
  '...XXXXXX...',
  '....XXXX....',
  '.....XX.....',
];

/** Police du texte défilant (12 LED de haut) ; « * » = losange doré. */
export const FONT_BIG = {
  M: ['XX.....XX', 'XXX...XXX', 'XXXX.XXXX', 'XX.XXX.XX', 'XX..X..XX', 'XX.....XX', 'XX.....XX', 'XX.....XX', 'XX.....XX', 'XX.....XX', 'XX.....XX', 'XX.....XX'],
  A: ['..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX', 'XX....XX', 'XX....XX', 'XXXXXXXX', 'XXXXXXXX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX'],
  V: ['XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XX....XX', 'XXX..XXX', '.XX..XX.', '.XXXXXX.', '..XXXX..', '..XXXX..', '...XX...'],
  Y: ['XX....XX', 'XX....XX', 'XXX..XXX', '.XX..XX.', '.XXXXXX.', '..XXXX..', '...XX...', '...XX...', '...XX...', '...XX...', '...XX...', '...XX...'],
  '*': ['....', '....', '....', '....', '.XX.', 'XXXX', 'XXXX', '.XX.', '....', '....', '....', '....'],
};

/** Petite police 5 × 7 (logo, version fixe du texte). */
export const FONT_SMALL = {
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
};

/** Grille vide de n × n, à remplir avec stamp(). */
const blank = n => Array.from({ length: n }, () => Array(n).fill('.'));

/** Écrit `text` dans la grille `rows` avec la police `font`, en couleur `ch`. */
function stamp(rows, font, text, x, y, ch, gap = 1) {
  for (const letter of text) {
    font[letter].forEach((line, r) => [...line].forEach((px, c) => { if (px === 'X') rows[y + r][x + c] = ch; }));
    x += font[letter][0].length + gap;
  }
}

/** « MAVYA » sur deux lignes : version fixe du texte défilant (mouvement réduit). */
export const MAVYA_STILL = (() => {
  const rows = blank(20);
  stamp(rows, FONT_SMALL, 'MAV', 2, 2, 'C');
  stamp(rows, FONT_SMALL, 'YA', 5, 11, 'M');
  return rows.map(r => r.join(''));
})();

/** Cœur procédural pour une grille n × n (aperçus des deux tailles). */
export function heartRows(n) {
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
    const x = ((c + .5) / n - .5) * 2.75, y = (.5 - (r + .5) / n) * 2.75 + .2;
    if ((x * x + y * y - 1) ** 3 - x * x * y ** 3 > 0) return '.';
    return r < n * .4 ? 'M' : r < n * .62 ? 'P' : 'R';
  }).join(''));
}
