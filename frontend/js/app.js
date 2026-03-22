/**
 * app.js — Core application logic for ZILLA Store.
 *
 * Handles:
 *   • Loading site settings from DB and applying CSS custom properties
 *   • Rendering the shared header & footer on every page
 *   • Cart badge count updates
 *   • Toast notifications
 *   • Mobile menu toggle
 *   • SEO meta tag injection
 */

document.addEventListener('DOMContentLoaded', init);

/** Global site settings cache */
let siteSettings = null;
let siteSections = [];

async function init() {
    try {
        const [settings, sections] = await Promise.all([
            api.getSettings(),
            api.getSections()
        ]);
        siteSettings = settings;
        siteSections = sections;

        applyTheme(siteSettings);
        renderHeader(siteSettings, siteSections);
        renderFooter(siteSettings, siteSections);
        updateCartBadge();
        updateSEO();
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

/* ── Theme: apply DB colors to CSS custom properties ─────── */
function applyTheme(s) {
    if (!s) return;
    const r = document.documentElement.style;
    if (s.primary_color) { r.setProperty('--primary', s.primary_color); r.setProperty('--primary-hover', darkenColor(s.primary_color, 10)); }
    if (s.secondary_color) r.setProperty('--secondary', s.secondary_color);
    if (s.background_color) r.setProperty('--bg', s.background_color);
    if (s.text_color) r.setProperty('--text', s.text_color);
    // Favicon
    if (s.favicon) {
        let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.rel = 'icon'; link.href = '/uploads/' + s.favicon;
        document.head.appendChild(link);
    }
}

/** Darken a hex color by a percentage */
function darkenColor(hex, pct) {
    hex = hex.replace('#', '');
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    r = Math.max(0, Math.floor(r * (1 - pct / 100)));
    g = Math.max(0, Math.floor(g * (1 - pct / 100)));
    b = Math.max(0, Math.floor(b * (1 - pct / 100)));
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/* ── Header ──────────────────────────────────────────────── */
function renderHeader(s, sections) {
    const hdr = document.getElementById('site-header');
    if (!hdr) return;
    const name = s ? s.store_name : 'ZILLA Store';
    const logoSrc = s && s.logo ? '/uploads/' + s.logo : '';
    const logoImg = logoSrc ? `<img src="${logoSrc}" alt="${name} logo">` : '';
    const currentPath = window.location.pathname;

    const navLinks = sections.map(sec =>
        `<a href="/section/${sec.slug}" class="${currentPath.includes(sec.slug) ? 'active' : ''}">${sec.name}</a>`
    ).join('');

    hdr.innerHTML = `
    <div class="container header-inner">
      <a href="/" class="header-logo">${logoImg}<span>${name}</span></a>
      <nav class="nav-links" id="nav-links">
        <a href="/" class="${currentPath === '/' ? 'active' : ''}">Home</a>
        ${navLinks}
        <a href="/products" class="${currentPath === '/products' ? 'active' : ''}">All Products</a>
      </nav>
      <div class="header-actions">
        <a href="/cart" class="cart-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Cart
          <span class="cart-badge" id="cart-badge" style="display:none">0</span>
        </a>
        <button class="menu-toggle" id="menu-toggle" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>`;

    // Mobile menu toggle
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('nav-links').classList.toggle('open');
    });
}

/* ── Footer ──────────────────────────────────────────────── */
function renderFooter(s, sections) {
    const ftr = document.getElementById('site-footer');
    if (!ftr) return;
    const name = s ? s.store_name : 'ZILLA Store';

    const footerNavLinks = sections.map(sec =>
        `<a href="/section/${sec.slug}">${sec.name}</a>`
    ).join('');

    ftr.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <h4>${name}</h4>
          <p style="color:rgba(255,255,255,0.4);font-size:0.875rem;line-height:1.6">
            ${s && s.tagline ? s.tagline : 'Your Custom Tagline Here'}
          </p>
        </div>
        <div class="footer-col">
          <h4>Shop</h4>
          ${footerNavLinks}
          <a href="/products">All Products</a>
        </div>
        <div class="footer-col">
          <h4>Support</h4>
          <a href="/cart">Shopping Cart</a>
        </div>
      </div>
      <div class="footer-bottom">
        &copy; ${new Date().getFullYear()} ${name}. All rights reserved.
      </div>
    </div>`;
}

/* ── Cart badge ──────────────────────────────────────────── */
async function updateCartBadge() {
    try {
        const cart = await api.getCart();
        const badge = document.getElementById('cart-badge');
        if (!badge) return;
        if (cart.item_count > 0) {
            badge.textContent = cart.item_count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) { /* silent */ }
}

/* ── Toast notifications ─────────────────────────────────── */
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

/* ── SEO helper ──────────────────────────────────────────── */
function updateSEO(opts = {}) {
    const s = siteSettings || {};
    const storeName = s.store_name || 'ZILLA Store';
    const defaults = {
        title: storeName,
        description: s.tagline || 'Premium bags and suits store',
        image: s.logo ? window.location.origin + '/uploads/' + s.logo : '',
        url: window.location.href,
    };
    const o = { ...defaults, ...opts };
    document.title = o.title.includes(storeName) ? o.title : `${o.title} | ${storeName}`;
    setMeta('description', o.description);
    if (s.seo_keywords) setMeta('keywords', s.seo_keywords);
    setMeta('og:title', o.title, 'property');
    setMeta('og:description', o.description, 'property');
    setMeta('og:image', o.image, 'property');
    setMeta('og:url', o.url, 'property');
    // Canonical
    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = o.url;
}

function setMeta(name, content, attr = 'name') {
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
}

/* ── Utility: format price ───────────────────────────────── */
function formatPrice(n) {
    const symbol = (window.siteSettings && window.siteSettings.currency) || '$';
    return symbol + Number(n).toFixed(2);
}

/* ── Utility: product image src ──────────────────────────── */
function productImage(img) {
    if (!img) return '/images/placeholder.svg';
    if (img.startsWith('http')) return img;
    return '/uploads/' + img;
}

/* ── Utility: build product card HTML ────────────────────── */
function productCardHTML(p) {
    const img = productImage(p.image);
    const badge = p.offer_badge ? `<span class="badge">${p.offer_badge}</span>` : '';
    const priceHtml = p.discount_amount > 0
        ? `<span class="discounted">${formatPrice(p.discounted_price)}</span><span class="original">${formatPrice(p.price)}</span>`
        : `${formatPrice(p.price)}`;
    return `
    <a href="/product/${p.id}" class="product-card" data-price="${p.discounted_price}">
      ${badge}
      <img class="product-card-img" src="${img}" alt="${p.name}" loading="lazy">
      <div class="product-card-body">
        <div class="product-card-name">${p.name}</div>
        <div class="product-card-price">${priceHtml}</div>
      </div>
    </a>`;
}
