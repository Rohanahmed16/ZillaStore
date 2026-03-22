/**
 * products.js — Product listing, filtering, and price-range slider logic.
 *
 * Used on: bags.html, suits.html, products.html (all products)
 * Reads the page's data-section attribute to know which section to load.
 */

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('product-grid');
    if (!grid) return; // not a product listing page
    initProductPage();
});

let allProducts = [];    // full data from API
let filteredProducts = []; // after subcategory + price filter

async function initProductPage() {
    let section = document.body.dataset.section || '';
    if (!section && window.location.pathname.startsWith('/section/')) {
        section = window.location.pathname.split('/').pop();
    }

    const grid = document.getElementById('product-grid');
    const sidebar = document.getElementById('sidebar');

    // Show loading skeletons
    grid.innerHTML = Array(8).fill('<div class="product-card skeleton" style="height:340px"></div>').join('');

    try {
        // Fetch products (filtered by section or all)
        const params = {};
        if (section) params.section = section;
        allProducts = await api.getProducts(params);
        filteredProducts = [...allProducts];

        // Load categories for sidebar
        const categories = await api.getCategories();
        renderSidebar(categories, section, sidebar);

        // Update page title if section is provided
        if (section) {
            const secData = categories.find(c => c.slug === section);
            if (secData) {
                const titleEl = document.querySelector('.page-banner h1');
                const pEl = document.querySelector('.page-banner p');
                if (titleEl) titleEl.textContent = secData.name;
                if (pEl) pEl.textContent = 'Browse our complete catalog of ' + secData.name.toLowerCase();
                document.title = secData.name + ' — ZILLA Store';
            }
        }

        // Render products
        renderProducts(filteredProducts, grid);

        // Init price range slider
        initPriceFilter();

        // Filter toggle for mobile
        const filterBtn = document.getElementById('filter-toggle');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }
    } catch (e) {
        grid.innerHTML = '<p class="text-center text-light">Failed to load products.</p>';
        console.error(e);
    }
}

/* ── Render sidebar categories ───────────────────────────── */
function renderSidebar(categories, sectionFilter, sidebar) {
    if (!sidebar) return;
    let html = '';

    // If viewing a specific section, show only that section's subcategories
    const filteredCats = sectionFilter
        ? categories.filter(c => c.slug === sectionFilter)
        : categories;

    filteredCats.forEach(section => {
        html += `<div class="sidebar-section">
      <h3>${section.name}</h3>
      <div class="subcat-list">
        <a href="#" class="subcat-link active" data-section-id="${section.id}" data-id="">All ${section.name}</a>`;
        section.subcategories.forEach(sc => {
            html += `<a href="#" class="subcat-link" data-section-id="${section.id}" data-id="${sc.id}">${sc.name}</a>`;
        });
        html += '</div></div>';
    });

    // Price filter placeholder
    html += `
    <div class="sidebar-section">
      <h3>Price Range</h3>
      <div class="price-filter">
        <div class="range-display">
          <span id="price-min-label">$0</span>
          <span id="price-max-label">$500</span>
        </div>
        <div class="range-slider">
          <input type="range" id="price-min" min="0" max="500" value="0" step="1">
          <input type="range" id="price-max" min="0" max="500" value="500" step="1">
          <div class="range-track" id="range-track"></div>
        </div>
      </div>
    </div>`;

    sidebar.innerHTML = html;

    // Subcategory click handlers
    sidebar.querySelectorAll('.subcat-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Update active state within this section
            const parent = link.closest('.sidebar-section');
            parent.querySelectorAll('.subcat-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            applyFilters();
        });
    });
}

/* ── Price range slider initialization ───────────────────── */
function initPriceFilter() {
    const minSlider = document.getElementById('price-min');
    const maxSlider = document.getElementById('price-max');
    if (!minSlider || !maxSlider) return;

    // Set range based on actual product prices
    if (allProducts.length === 0) return;
    const prices = allProducts.map(p => p.discounted_price);
    const dataMin = Math.floor(Math.min(...prices));
    const dataMax = Math.ceil(Math.max(...prices));

    minSlider.min = dataMin; minSlider.max = dataMax; minSlider.value = dataMin;
    maxSlider.min = dataMin; maxSlider.max = dataMax; maxSlider.value = dataMax;

    updatePriceLabels();
    updateRangeTrack();

    const handler = () => {
        // Prevent crossing
        if (parseInt(minSlider.value) > parseInt(maxSlider.value)) {
            minSlider.value = maxSlider.value;
        }
        updatePriceLabels();
        updateRangeTrack();
        applyFilters();
    };

    minSlider.addEventListener('input', handler);
    maxSlider.addEventListener('input', handler);
}

function updatePriceLabels() {
    const symbol = (window.siteSettings && window.siteSettings.currency) || '$';
    const minSlider = document.getElementById('price-min');
    const maxSlider = document.getElementById('price-max');
    const minLabel = document.getElementById('price-min-label');
    const maxLabel = document.getElementById('price-max-label');

    if (minLabel) minLabel.textContent = symbol + minSlider.value;
    if (maxLabel) maxLabel.textContent = symbol + maxSlider.value;
}

function updateRangeTrack() {
    const min = document.getElementById('price-min');
    const max = document.getElementById('price-max');
    const track = document.getElementById('range-track');
    if (!min || !max || !track) return;
    const range = max.max - min.min;
    const left = ((min.value - min.min) / range) * 100;
    const right = ((max.value - min.min) / range) * 100;
    track.style.left = left + '%';
    track.style.width = (right - left) + '%';
}

/* ── Apply all filters (subcategory + price range) ───────── */
function applyFilters() {
    const grid = document.getElementById('product-grid');
    const minSlider = document.getElementById('price-min');
    const maxSlider = document.getElementById('price-max');
    const minPrice = minSlider ? parseFloat(minSlider.value) : 0;
    const maxPrice = maxSlider ? parseFloat(maxSlider.value) : Infinity;

    // Get active subcategory filters
    const activeSubcats = [];
    document.querySelectorAll('.subcat-link.active').forEach(link => {
        const id = link.dataset.id;
        const sectionId = link.dataset.sectionId;
        if (id) activeSubcats.push(parseInt(id));
        // if id is empty, it means "All" for that section — no filter
    });

    filteredProducts = allProducts.filter(p => {
        // Price filter
        if (p.discounted_price < minPrice || p.discounted_price > maxPrice) return false;

        // Subcategory filter — if any specific subcat is selected
        if (activeSubcats.length > 0 && !activeSubcats.includes(p.subcategory_id)) return false;

        return true;
    });

    renderProducts(filteredProducts, grid);
}

/* ── Render products into the grid ───────────────────────── */
function renderProducts(products, grid) {
    if (!grid) return;
    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center text-light mt-48" style="grid-column:1/-1">No products match your filters.</p>';
        return;
    }
    grid.innerHTML = products.map(p => productCardHTML(p)).join('');
}
