// shop.js — Bouton d'achat Shopify (Buy Button JS v3, sans iframe : habillé par le CSS du site).
// Chargé par main.js à l'approche de la section « Commander ».

const SHOP = {
  domain: 'eqe0ex-41.myshopify.com',
  storefrontAccessToken: '9d3867e5c67024fc1625e8ffacd9ff14',
  productId: '15934071963988',   // ID numérique du produit dans Shopify : le rideau 2 m × 2 m, 400 LED (une seule variante)
};

const SDK = {
  src: 'https://unpkg.com/@shopify/buy-button-js@3.0.6/dist/buybutton.min.js',
  integrity: 'sha384-q+SpzFSMkp3MVfABVZexbjLONntqR3CvcACav++STehX0NF2Nm/WripdSbYcqcqY',
};

const OPTIONS = {
  product: {
    iframe: false,
    layout: 'vertical',
    contents: { img: false, title: false, price: true, unitPrice: false, options: true, quantity: false, button: true, description: false },
    order: ['price', 'options', 'button'],
    text: { button: 'Ajouter au panier', outOfStock: 'Épuisé', unavailable: 'Indisponible' },
  },
  cart: {
    iframe: false,
    popup: false,   // le paiement s'ouvre dans le même onglet (plus fiable dans les navigateurs intégrés, TikTok compris)
    text: {
      title: 'Ton panier',
      empty: 'Ton panier est vide.',
      total: 'Sous-total',
      button: 'Passer au paiement',
      notice: 'Livraison offerte. Adaptateur USB non inclus.',
      closeAccessibilityLabel: 'Fermer le panier',
    },
  },
  toggle: {
    iframe: false,
    sticky: true,
    contents: { count: true, icon: true, title: false },
    text: { title: 'Panier' },
  },
  lineItem: {
    text: {
      quantityInputAccessibilityLabel: 'Quantité',
      quantityDecrementAccessibilityLabel: 'Retirer un article',
      quantityIncrementAccessibilityLabel: 'Ajouter un article',
    },
  },
};

let node = null;

const note = html => { node.innerHTML = `<p class="shop-note">${html}</p>`; };

function loadSdk() {
  if (window.ShopifyBuy?.UI) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    Object.assign(s, { src: SDK.src, integrity: SDK.integrity, crossOrigin: 'anonymous', async: true, onload: resolve, onerror: reject });
    document.head.append(s);
  });
}

/** Monte le bouton d'achat : prix et « Ajouter au panier ». Une seule variante, donc pas de choix de taille. */
export function mountShop(el, productId = SHOP.productId) {
  node = el;
  return loadSdk()
    .then(() => {
      const client = ShopifyBuy.buildClient({ domain: SHOP.domain, storefrontAccessToken: SHOP.storefrontAccessToken });
      node.innerHTML = '';
      return ShopifyBuy.UI.init(client).createComponent('product', {
        id: productId,
        node,
        moneyFormat: '%7B%7Bamount_with_comma_separator%7D%7D%C2%A0%E2%82%AC',   // 59,90 €
        options: OPTIONS,
      });
    })
    .then(() => true)
    .catch(err => {
      console.warn('Boutique indisponible', err);
      note('La boutique n\'a pas pu se charger. Recharge la page, ou écris-nous à <a href="mailto:[EMAIL]">[EMAIL]</a>.');
      return false;
    });
}
