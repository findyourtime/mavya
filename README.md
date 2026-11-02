# MAVYA

Site de MAVYA : rideau lumineux LED connecté à accrocher derrière une fenêtre
(« Ta fenêtre devient un écran lumineux. »). Direction visuelle futuriste, premium et
nocturne. Le rideau est dessiné en code : grille de 20 × 20 LED en canvas, et rideau 3D temps
réel (WebGL 2, sans bibliothèque) de l'intro jusqu'à la maison. Seules images importées : la
façade de « Vu de la rue », générée par IA, de jour (`assets/img/maison.jpg`) et de nuit
(`assets/img/maison-nuit.jpg`, retouche de la première, même cadrage).

## Structure

```
index.html                 La page : hero, histoire au défilement, « Vu de la rue », fonctionnalités, dimensions, commande, FAQ
mentions-legales.html      Pages légales (même design, sans JavaScript)
cgv.html
confidentialite.html
livraison-retours.html
assets/css/main.css        Styles communs, mobile d'abord
assets/js/intro3d.js       Intro 3D : le plan se trace, le rideau se monte, s'allume, puis le logo apparaît
assets/js/led-grid.js      Moteur de la grille LED : halos, scènes animées, transitions point par point
assets/js/patterns.js      Pixel-arts (sapin, Père Noël, cœurs) et polices lumineuses
assets/js/main.js          Animations au défilement (GSAP + ScrollTrigger, Lenis), barre d'achat mobile
assets/js/shop.js          Bouton d'achat Shopify (Buy Button JS v3, sans iframe, habillé par le CSS)
assets/js/ui.js            Toutes les pages : en-tête réduit au défilement, barre de progression, retour en haut
assets/img/                Favicon, icône iOS et image de partage (générées par tools/og-image.html),
                           maison.jpg et maison-nuit.jpg (façade de « Vu de la rue », générée par IA)
tools/serve.pl             Aperçu local sans Python ni Node
tools/og-image.html        Génère l'image de partage et l'icône iOS à partir de la grille LED
tools/publish.pl           Publie le dossier sur GitHub sans git (via GitHub CLI)
```

HTML, CSS et JS statiques, sans étape de build. Bibliothèques chargées depuis un CDN, en
version exacte et avec empreinte d'intégrité (SRI) : GSAP 3.15.0 + ScrollTrigger (cdnjs),
Lenis 1.3.27 et Shopify Buy Button JS 3.0.6 (unpkg, chargé seulement à l'approche de la commande).

## À remplir avant la mise en ligne

Tous les champs à compléter sont entre crochets :

- `[NOM PRÉNOM]`, `[ADRESSE]`, `[EMAIL]`, `[TÉLÉPHONE]`, `[MENTION TVA …]`, `[MÉDIATEUR]`,
  `[ADRESSE RETOUR]`, `[en cours d'immatriculation]` dans les pages légales et le pied de page ;
- `[DATE LIMITE]` (commande avant Noël) sur l'accueil, la FAQ, les CGV et Livraison & retours ;
- `[DATE]` (« Dernière mise à jour », en bas de chaque page légale) : à changer à chaque modification.

Pour tous les retrouver : `grep -rn "\[[A-Z]" *.html assets/js`

Un seul format est en vente : 2 m × 2 m, 400 LED, produit Shopify n° 15934071963988 (une seule
variante). Le prix affiché en dur (59,90 €, sur l'accueil, dans ses métadonnées et dans les CGV)
doit rester identique à celui de Shopify ; le bouton d'achat, lui, affiche directement le prix Shopify.

## Aperçu local

```
perl tools/serve.pl
```

puis ouvrir http://localhost:4321/. Le mouvement réduit (réglage d'accessibilité du système)
coupe toutes les animations : l'intro 3D laisse la place au hero classique, la grille affiche
des images fixes et l'histoire devient une série d'onglets. Sans WebGL 2, seule l'intro 3D
est remplacée.

L'intro 3D suit une timeline de 0 à 1 : le début (plan de la fenêtre, tringle) se joue seul au
chargement, la suite avance avec le défilement ; légendes et plans de caméra sont réglés en
tête de `intro3d.js`. Le rideau 3D est dessiné dans un calque fixe derrière la page : après
l'intro, il descend se poser dans l'histoire (il y affiche les motifs des étapes, calculés par
`LedSource` dans `led-grid.js`), puis entre dans la baie vitrée de la maison « Vu de la rue »,
qui occupe tout l'écran : la vitre est découpée dans la photo (`clip-path`) à l'emplacement donné
par `data-window` sur `.street__scene` (`index.html`, en fractions de la photo), que `main.js`
recadre en pixels comme la photo (`object-fit: cover`) ; son reflet ne s'efface qu'à la nuit
tombée. Si la photo change, remesurer `data-window` et reporter sa taille (`width`, `height`).
Partout, les fils du rideau 3D réagissent au curseur ou au doigt : un passage les entraîne, un
appui les écarte (pendules amortis, fonction `feel` de `intro3d.js`).

## Cookies et pixel publicitaire

Aujourd'hui, aucun cookie ni traceur : donc aucun bandeau. Son emplacement est prêt sur chaque
page (`<div class="consent" id="consent" hidden>`, juste avant `</body>`), et le CSS réserve sa
place : en donnant la hauteur du bandeau à la variable `--consent-h`, la barre d'achat et les
boutons flottants remontent d'autant. Le jour où un pixel publicitaire est installé :

- afficher le bandeau dans `#consent`, avec « Tout refuser » aussi visible que « Tout accepter » ;
- ne charger le pixel qu'après l'accord, et retenir le choix (refus compris) ;
- ajouter un lien « Gérer les cookies » dans le pied de page pour changer d'avis ;
- mettre à jour `confidentialite.html`, la rubrique cookies des mentions légales et la phrase
  « Ce site n'utilise ni cookie, ni traceur » du pied de page.

## Image de partage

`tools/og-image.html` dessine l'image Open Graph (1200 × 630) et l'icône iOS (180 × 180) avec
le moteur de la grille LED. Avec `perl tools/serve.pl` lancé, ouvrir
http://localhost:4321/tools/og-image.html et cliquer sur « Enregistrer » : les fichiers sont
écrits dans `assets/img/`.

## Mise en ligne

Le site est publié sur GitHub Pages depuis le dépôt `findyourtime/mavya`, à l'adresse
https://findyourtime.github.io/mavya/. `.github/workflows/pages.yml` le déploie à chaque commit
sur `main` (dossier `tools/` exclu, `?v=dev` remplacé par le commit pour vider les caches).

Sans git, `tools/publish.pl` envoie tout le dossier en un seul commit sur `main` grâce à
GitHub CLI (`~/.local/bin/gh`, connecté une fois avec `gh auth login`) :

```
perl tools/publish.pl "Mentions légales complétées"
```

Avec un domaine personnalisé, mettre à jour les URL absolues (`canonical`, Open Graph,
`sitemap.xml`, `robots.txt`) ; `robots.txt` n'est lu par les moteurs qu'à la racine d'un domaine.
