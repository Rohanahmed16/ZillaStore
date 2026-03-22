/**
 * admin.js — Admin panel logic for ZILLA Store.
 *
 * Handles: auth guard, dashboard stats, product CRUD, category management,
 * offers management, site settings with live preview, and order management.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check which admin page we're on
    const page = document.body.dataset.adminPage;
    if (page === 'login') { initLoginPage(); return; }
    // All other admin pages need auth
    checkAuth().then(ok => {
        if (!ok) return;
        initAdminSidebar();
        if (page === 'dashboard') initDashboard();
        if (page === 'products') initAdminProducts();
        if (page === 'categories') initAdminCategories();
        if (page === 'offers') initAdminOffers();
        if (page === 'settings') initAdminSettings();
        if (page === 'orders') initAdminOrders();
        if (page === 'users') initAdminUsers();
    });
});

/* ── Auth ─────────────────────────────────────────────────── */
async function checkAuth() {
    try {
        const res = await api.adminCheck();
        if (!res.logged_in) { window.location.href = '/admin/login'; return false; }
        return true;
    } catch (e) { window.location.href = '/admin/login'; return false; }
}

function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error');
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        try {
            await api.adminLogin(user, pass);
            window.location.href = '/admin/dashboard';
        } catch (err) {
            errEl.textContent = 'Invalid username or password';
            errEl.style.display = 'block';
        }
    });
}

function initAdminSidebar() {
    // Logout button
    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await api.adminLogout();
            window.location.href = '/admin/login';
        });
    }
    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('toggle-admin-sidebar');
    const sidebar = document.getElementById('admin-sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
}

/* ── Dashboard ───────────────────────────────────────────── */
async function initDashboard() {
    try {
        const d = await api.getDashboard();
        document.getElementById('stat-orders').textContent = d.total_orders;
        document.getElementById('stat-revenue').textContent = formatPrice(d.total_revenue);
        document.getElementById('stat-products').textContent = d.active_products;
        document.getElementById('stat-lowstock').textContent = d.low_stock_alerts;

        const tbody = document.getElementById('recent-orders');
        if (d.recent_orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-light" style="padding:24px">No orders yet</td></tr>';
            return;
        }
        tbody.innerHTML = d.recent_orders.map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>${formatPrice(o.total)}</td>
        <td><span class="status ${o.status}">${o.status}</span></td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
      </tr>`).join('');
    } catch (e) { console.error(e); }
}

/* ── Admin Products ──────────────────────────────────────── */
let editingProductId = null;

async function initAdminProducts() {
    await loadAdminProducts();
    // Load categories for the form selects
    await loadProductFormSelects();

    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProduct();
    });

    document.getElementById('cancel-product').addEventListener('click', () => {
        resetProductForm();
    });

    // Section change updates subcategories
    document.getElementById('prod-section').addEventListener('change', updateSubcatOptions);
}

async function loadAdminProducts() {
    try {
        const products = await api.adminGetProducts();
        const tbody = document.getElementById('admin-products-list');
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-light" style="padding:24px">No products</td></tr>';
            return;
        }
        tbody.innerHTML = products.map(p => `
      <tr>
        <td><div class="product-cell">
          <img class="product-thumb" src="${productImage(p.image)}" alt="">
          <span>${p.name}</span>
        </div></td>
        <td>${p.section_name || '-'}</td>
        <td>${p.subcategory_name || '-'}</td>
        <td>$${p.price.toFixed(2)}</td>
        <td>${p.stock}</td>
        <td>${p.is_active ? '✓' : '✗'}</td>
        <td class="actions">
          <button class="edit-btn" onclick="editProduct(${p.id})">Edit</button>
          <button class="del-btn" onclick="confirmDeleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Delete</button>
        </td>
      </tr>`).join('');
    } catch (e) { console.error(e); }
}

async function loadProductFormSelects() {
    try {
        const cats = await api.adminGetCategories();
        const secSelect = document.getElementById('prod-section');
        secSelect.innerHTML = '<option value="">Select Section</option>';
        cats.forEach(s => { secSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`; });
        window._adminCats = cats;
    } catch (e) { console.error(e); }
}

function updateSubcatOptions() {
    const secId = parseInt(document.getElementById('prod-section').value);
    const subSelect = document.getElementById('prod-subcat');
    subSelect.innerHTML = '<option value="">Select Subcategory</option>';
    if (!window._adminCats || !secId) return;
    const sec = window._adminCats.find(s => s.id === secId);
    if (sec) {
        sec.subcategories.forEach(sc => {
            subSelect.innerHTML += `<option value="${sc.id}">${sc.name}</option>`;
        });
    }
}

async function saveProduct() {
    const fd = new FormData();
    fd.append('name', document.getElementById('prod-name').value);
    fd.append('price', document.getElementById('prod-price').value);
    fd.append('description', document.getElementById('prod-desc').value);
    fd.append('section_id', document.getElementById('prod-section').value);
    fd.append('subcategory_id', document.getElementById('prod-subcat').value);
    fd.append('stock', document.getElementById('prod-stock').value);
    fd.append('is_active', document.getElementById('prod-active').classList.contains('active') ? '1' : '0');
    fd.append('is_featured', document.getElementById('prod-featured').classList.contains('active') ? '1' : '0');
    const imgInput = document.getElementById('prod-image');
    if (imgInput.files[0]) fd.append('image', imgInput.files[0]);

    try {
        if (editingProductId) {
            await api.adminUpdateProduct(editingProductId, fd);
            showToast('Product updated');
        } else {
            await api.adminCreateProduct(fd);
            showToast('Product created');
        }
        resetProductForm();
        await loadAdminProducts();
    } catch (e) { showToast(e.error || 'Failed to save', 'error'); }
}

async function editProduct(id) {
    try {
        const p = await api.getProduct(id);
        editingProductId = id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-desc').value = p.description;
        document.getElementById('prod-section').value = p.section_id;
        updateSubcatOptions();
        document.getElementById('prod-subcat').value = p.subcategory_id || '';
        document.getElementById('prod-stock').value = p.stock;
        const activeToggle = document.getElementById('prod-active');
        const featToggle = document.getElementById('prod-featured');
        activeToggle.classList.toggle('active', !!p.is_active);
        featToggle.classList.toggle('active', !!p.is_featured);
        document.getElementById('product-form-title').textContent = 'Edit Product';
        document.getElementById('product-form').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { showToast('Failed to load product', 'error'); }
}

function resetProductForm() {
    editingProductId = null;
    document.getElementById('product-form').reset();
    document.getElementById('product-form-title').textContent = 'Add New Product';
    document.getElementById('prod-active').classList.add('active');
    document.getElementById('prod-featured').classList.remove('active');
}

function confirmDeleteProduct(id, name) {
    showModal('Delete Product', `Are you sure you want to delete "${name}"?`, async () => {
        try {
            await api.adminDeleteProduct(id);
            showToast('Product deleted');
            loadAdminProducts();
        } catch (e) { showToast('Failed to delete', 'error'); }
    });
}

/* ── Admin Categories (Sections & Subcategories) ───────────── */
async function initAdminCategories() {
    await loadAdminCategories();

    // Add new section (category)
    const addSectionForm = document.getElementById('add-section-form');
    if (addSectionForm) {
        addSectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('new-section-name');
            const name = input.value.trim();
            if (!name) return;
            try {
                await api.adminCreateSection({ name });
                input.value = '';
                showToast('Category created');
                await loadAdminCategories();
            } catch (e) { showToast(e.error || 'Failed to create category', 'error'); }
        });
    }
}

async function loadAdminCategories() {
    try {
        const sections = await api.adminGetCategories(); // returns sections with their subcategories
        const container = document.getElementById('dynamic-categories-container');
        if (!container) return;

        if (sections.length === 0) {
            container.innerHTML = '<p class="text-light" style="padding:16px;text-align:center;">No categories found.</p>';
            return;
        }

        container.innerHTML = sections.map(sec => `
            <div class="admin-panel mb-4" style="padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #eaeaea;padding-bottom:16px;">
                    <h3 style="margin:0">${sec.name}</h3>
                    <div class="actions">
                        <button class="edit-btn" onclick="renameSection(${sec.id}, '${sec.name.replace(/'/g, "\\'")}')">Rename</button>
                        <button class="del-btn" onclick="deleteSection(${sec.id}, '${sec.name.replace(/'/g, "\\'")}')">Delete</button>
                    </div>
                </div>

                <div class="admin-form mb-16">
                    <form onsubmit="addCategory(event, ${sec.id})" style="display:flex;gap:12px;align-items:flex-end">
                        <div class="form-group" style="flex:1;margin:0">
                            <input type="text" id="new-subcat-${sec.id}" placeholder="Add subcategory to ${sec.name}..." required style="height:36px">
                        </div>
                        <button type="submit" class="btn btn-outline btn-sm" style="height:36px">Add Subcategory</button>
                    </form>
                </div>

                <div class="subcat-list">
                    ${sec.subcategories.length === 0 ? '<p class="text-light" style="font-size:0.875rem">No subcategories</p>' : ''}
                    ${sec.subcategories.map(sc => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--accent)">
                            <span style="font-size:0.95rem">${sc.name}</span>
                            <div class="actions">
                                <button class="edit-btn" onclick="renameCategory(${sc.id}, '${sc.name.replace(/'/g, "\\'")}')">Rename</button>
                                <button class="del-btn" onclick="deleteCategory(${sc.id}, '${sc.name.replace(/'/g, "\\'")}')">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        showToast('Failed to load categories', 'error');
    }
}

async function addCategory(e, sectionId) {
    e.preventDefault();
    const inputId = 'new-subcat-' + sectionId;
    const name = document.getElementById(inputId).value.trim();
    if (!name) return;
    try {
        await api.adminCreateCategory({ name, section_id: sectionId });
        showToast('Subcategory added');
        await loadAdminCategories();
    } catch (err) { showToast(err.error || 'Failed', 'error'); }
}

function renameCategory(id, currentName) {
    const newName = prompt('Rename subcategory:', currentName);
    if (!newName || newName === currentName) return;
    api.adminUpdateCategory(id, { name: newName })
        .then(() => { showToast('Renamed'); loadAdminCategories(); })
        .catch(e => showToast('Failed', 'error'));
}

function deleteCategory(id, name) {
    showModal('Delete Subcategory', `Delete "${name}"? Products in this subcategory will lose it.`, async () => {
        try {
            await api.adminDeleteCategory(id);
            showToast('Deleted');
            loadAdminCategories();
        } catch (e) { showToast(e.error || 'Failed to delete subcategory', 'error'); }
    });
}

function renameSection(id, currentName) {
    const newName = prompt('Rename category (section):', currentName);
    if (!newName || newName === currentName) return;
    api.adminUpdateSection(id, { name: newName })
        .then(() => { showToast('Renamed category'); loadAdminCategories(); })
        .catch(e => showToast(e.error || 'Failed', 'error'));
}

function deleteSection(id, name) {
    showModal('Delete Category', `Delete "${name}" and ALL its subcategories? Products in this category will lose it.`, async () => {
        try {
            await api.adminDeleteSection(id);
            showToast('Category deleted');
            loadAdminCategories();
        } catch (e) { showToast(e.error || 'Failed to delete category', 'error'); }
    });
}

/* ── Admin Offers ────────────────────────────────────────── */
let editingOfferId = null;

async function initAdminOffers() {
    await loadAdminOffers();
    await loadOfferFormSelects();
    document.getElementById('offer-form').addEventListener('submit', async (e) => {
        e.preventDefault(); await saveOffer();
    });
    document.getElementById('cancel-offer').addEventListener('click', resetOfferForm);
    document.getElementById('offer-scope').addEventListener('change', updateOfferScopeFields);
}

async function loadAdminOffers() {
    try {
        const offers = await api.adminGetOffers();
        const tbody = document.getElementById('offers-list');
        if (offers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-light" style="padding:24px">No offers</td></tr>';
            return;
        }
        tbody.innerHTML = offers.map(o => {
            const scope = o.product_id ? 'Product #' + o.product_id : (o.subcategory_id ? 'Category #' + o.subcategory_id : (o.section_id ? 'Section #' + o.section_id : 'None'));
            return `<tr>
        <td>${o.name}</td>
        <td>${o.discount_type === 'percentage' ? o.value + '%' : '$' + o.value}</td>
        <td>${o.start_date}</td><td>${o.end_date}</td>
        <td>${scope}</td>
        <td>${o.is_active ? '✓' : '✗'}</td>
        <td class="actions">
          <button class="edit-btn" onclick="editOffer(${o.id})">Edit</button>
          <button class="del-btn" onclick="deleteOffer(${o.id})">Delete</button>
        </td>
      </tr>`;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadOfferFormSelects() {
    try {
        const products = await api.adminGetProducts();
        const cats = await api.adminGetCategories();
        window._offerProducts = products;
        window._offerCats = cats;
    } catch (e) { console.error(e); }
}

function updateOfferScopeFields() {
    const scope = document.getElementById('offer-scope').value;
    document.getElementById('offer-product-wrap').style.display = scope === 'product' ? 'block' : 'none';
    document.getElementById('offer-category-wrap').style.display = scope === 'category' ? 'block' : 'none';
    document.getElementById('offer-section-wrap').style.display = scope === 'section' ? 'block' : 'none';

    if (scope === 'product' && window._offerProducts) {
        const sel = document.getElementById('offer-product');
        sel.innerHTML = '<option value="">Select Product</option>' +
            window._offerProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    if (scope === 'category' && window._offerCats) {
        const sel = document.getElementById('offer-category');
        sel.innerHTML = '<option value="">Select Category</option>';
        window._offerCats.forEach(s => s.subcategories.forEach(sc => {
            sel.innerHTML += `<option value="${sc.id}">${s.name} > ${sc.name}</option>`;
        }));
    }
    if (scope === 'section' && window._offerCats) {
        const sel = document.getElementById('offer-section-select');
        sel.innerHTML = '<option value="">Select Section</option>' +
            window._offerCats.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
}

async function saveOffer() {
    const scope = document.getElementById('offer-scope').value;
    const data = {
        name: document.getElementById('offer-name').value,
        discount_type: document.getElementById('offer-type').value,
        value: parseFloat(document.getElementById('offer-value').value),
        start_date: document.getElementById('offer-start').value,
        end_date: document.getElementById('offer-end').value,
        is_active: document.getElementById('offer-active').classList.contains('active') ? 1 : 0,
        product_id: scope === 'product' ? parseInt(document.getElementById('offer-product').value) || null : null,
        subcategory_id: scope === 'category' ? parseInt(document.getElementById('offer-category').value) || null : null,
        section_id: scope === 'section' ? parseInt(document.getElementById('offer-section-select').value) || null : null,
    };
    try {
        if (editingOfferId) {
            await api.adminUpdateOffer(editingOfferId, data);
            showToast('Offer updated');
        } else {
            await api.adminCreateOffer(data);
            showToast('Offer created');
        }
        resetOfferForm();
        loadAdminOffers();
    } catch (e) { showToast(e.error || 'Failed', 'error'); }
}

async function editOffer(id) {
    try {
        const offers = await api.adminGetOffers();
        const o = offers.find(x => x.id === id);
        if (!o) return;
        editingOfferId = id;
        document.getElementById('offer-name').value = o.name;
        document.getElementById('offer-type').value = o.discount_type;
        document.getElementById('offer-value').value = o.value;
        document.getElementById('offer-start').value = o.start_date;
        document.getElementById('offer-end').value = o.end_date;
        const activeEl = document.getElementById('offer-active');
        activeEl.classList.toggle('active', !!o.is_active);
        if (o.product_id) { document.getElementById('offer-scope').value = 'product'; }
        else if (o.subcategory_id) { document.getElementById('offer-scope').value = 'category'; }
        else if (o.section_id) { document.getElementById('offer-scope').value = 'section'; }
        else { document.getElementById('offer-scope').value = ''; }
        updateOfferScopeFields();
        if (o.product_id) document.getElementById('offer-product').value = o.product_id;
        if (o.subcategory_id) document.getElementById('offer-category').value = o.subcategory_id;
        if (o.section_id) document.getElementById('offer-section-select').value = o.section_id;
        document.getElementById('offer-form-title').textContent = 'Edit Offer';
        document.getElementById('offer-form').scrollIntoView({ behavior: 'smooth' });
    } catch (e) { showToast('Failed to load offer', 'error'); }
}

function resetOfferForm() {
    editingOfferId = null;
    document.getElementById('offer-form').reset();
    document.getElementById('offer-form-title').textContent = 'Add New Offer';
    document.getElementById('offer-active').classList.add('active');
    document.getElementById('offer-product-wrap').style.display = 'none';
    document.getElementById('offer-category-wrap').style.display = 'none';
    document.getElementById('offer-section-wrap').style.display = 'none';
}

function deleteOffer(id) {
    showModal('Delete Offer', 'Are you sure you want to delete this offer?', async () => {
        try { await api.adminDeleteOffer(id); showToast('Deleted'); loadAdminOffers(); }
        catch (e) { showToast('Failed', 'error'); }
    });
}

/* ── Admin Settings ──────────────────────────────────────── */
async function initAdminSettings() {
    try {
        const s = await api.adminGetSettings();
        document.getElementById('set-name').value = s.store_name || '';
        document.getElementById('set-tagline').value = s.tagline || '';
        document.getElementById('set-seo').value = s.seo_keywords || '';
        document.getElementById('set-currency').value = s.currency || '$';
        document.getElementById('set-primary').value = s.primary_color || '#F5C518';
        document.getElementById('set-secondary').value = s.secondary_color || '#1a1a1a';
        document.getElementById('set-bg').value = s.background_color || '#ffffff';
        document.getElementById('set-text').value = s.text_color || '#1a1a1a';
        if (s.logo) document.getElementById('logo-preview').innerHTML = `<img src="/uploads/${s.logo}">`;
        if (s.favicon) document.getElementById('fav-preview').innerHTML = `<img src="/uploads/${s.favicon}">`;
        updateColorValues();
        updatePreviewBar();
    } catch (e) { console.error(e); }

    // Live preview for colors
    ['set-primary', 'set-secondary', 'set-bg', 'set-text'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            updateColorValues(); updatePreviewBar();
        });
    });

    // Image previews
    document.getElementById('set-logo').addEventListener('change', (e) => {
        previewFile(e, 'logo-preview');
    });
    document.getElementById('set-favicon').addEventListener('change', (e) => {
        previewFile(e, 'fav-preview');
    });

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault(); await saveSettings();
    });
}

function updateColorValues() {
    document.querySelectorAll('.color-picker-group').forEach(g => {
        const input = g.querySelector('input[type="color"]');
        const val = g.querySelector('.color-val');
        if (input && val) val.textContent = input.value;
    });
}

function updatePreviewBar() {
    const bar = document.getElementById('preview-bar');
    if (!bar) return;
    bar.style.background = document.getElementById('set-bg').value;
    bar.style.color = document.getElementById('set-text').value;
    const accent = bar.querySelector('.preview-accent');
    if (accent) accent.style.background = document.getElementById('set-primary').value;
}

function previewFile(e, previewId) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById(previewId).innerHTML = `<img src="${ev.target.result}">`;
    };
    reader.readAsDataURL(file);
}

async function saveSettings() {
    const fd = new FormData();
    fd.append('store_name', document.getElementById('set-name').value);
    fd.append('tagline', document.getElementById('set-tagline').value);
    fd.append('seo_keywords', document.getElementById('set-seo').value);
    fd.append('currency', document.getElementById('set-currency').value);
    fd.append('primary_color', document.getElementById('set-primary').value);
    fd.append('secondary_color', document.getElementById('set-secondary').value);
    fd.append('background_color', document.getElementById('set-bg').value);
    fd.append('text_color', document.getElementById('set-text').value);
    const logo = document.getElementById('set-logo').files[0];
    const favicon = document.getElementById('set-favicon').files[0];
    if (logo) fd.append('logo', logo);
    if (favicon) fd.append('favicon', favicon);
    try {
        await api.adminUpdateSettings(fd);
        showToast('Settings saved! Refresh to see changes.');
    } catch (e) { showToast('Failed to save settings', 'error'); }
}

/* ── Admin Orders ────────────────────────────────────────── */
async function initAdminOrders() {
    await loadAdminOrders();
}

async function loadAdminOrders(sort = 'created_at', dir = 'DESC') {
    try {
        const orders = await api.adminGetOrders(sort, dir);
        window._allOrders = orders; // store for searching
        renderOrders(orders);
    } catch (e) { console.error(e); }
}

function renderOrders(orders) {
    const tbody = document.getElementById('orders-list');
    if (!tbody) return;
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-light" style="padding:24px">No orders found</td></tr>';
        return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.id}</td>
        <td>${o.customer_name}</td>
        <td>${o.email}</td>
        <td title="${o.address}"><div style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.address}</div></td>
        <td>${formatPrice(o.total)}</td>
        <td><span class="status ${o.status}">${o.status}</span></td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
        <td class="actions">
          <button class="edit-btn" onclick="viewOrder(${o.id})">View</button>
        </td>
      </tr>`).join('');
}

function searchOrders() {
    const q = document.getElementById('order-search').value.toLowerCase();
    if (!window._allOrders) return;
    const filtered = window._allOrders.filter(o =>
        o.customer_name.toLowerCase().includes(q) ||
        o.email.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        o.id.toString().includes(q)
    );
    renderOrders(filtered);
}

async function viewOrder(id) {
    try {
        const o = await api.adminGetOrder(id);
        const itemsHtml = o.items.map(i =>
            `<div class="odi"><span>${i.product_name} × ${i.quantity}</span><span>${formatPrice(i.price * i.quantity)}</span></div>`
        ).join('');

        const content = `
      <p><strong>Customer:</strong> ${o.customer_name}</p>
      <p><strong>Email:</strong> ${o.email}</p>
      <p><strong>Phone:</strong> ${o.phone}</p>
      <p><strong>Address:</strong> ${o.address}</p>
      <p><strong>Date:</strong> ${new Date(o.created_at).toLocaleString()}</p>
      <p><strong>Subtotal:</strong> ${formatPrice(o.subtotal)}</p>
      <p><strong>Discounts:</strong> -${formatPrice(o.discount_total)}</p>
      <p><strong>Total:</strong> ${formatPrice(o.total)}</p>
      <div style="margin-top:16px">
        <label style="font-weight:600;font-size:0.875rem">Status:</label>
        <select class="order-status-select" id="order-status-${o.id}" onchange="updateOrderStatus(${o.id}, this.value)">
          ${['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s =>
            `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
        ).join('')}
        </select>
      </div>
      <div class="order-detail-items"><h4 style="margin-top:16px;margin-bottom:8px">Items</h4>${itemsHtml}</div>`;

        showModal(`Order #${o.id}`, content, null, true);
    } catch (e) { showToast('Failed to load order', 'error'); }
}

async function updateOrderStatus(id, status) {
    try {
        await api.adminUpdateOrderStatus(id, status);
        showToast('Status updated');
        loadAdminOrders();
    } catch (e) { showToast('Failed to update status', 'error'); }
}

/* ── Modal helper ────────────────────────────────────────── */
function showModal(title, content, onConfirm, isInfoOnly = false) {
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }

    const actionsHtml = isInfoOnly
        ? `<button class="btn btn-outline btn-sm" id="modal-close">Close</button>`
        : `<button class="btn btn-outline btn-sm" id="modal-close">Cancel</button>
       <button class="btn btn-danger btn-sm" id="modal-confirm">Confirm</button>`;

    overlay.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <div>${content}</div>
      <div class="modal-actions">${actionsHtml}</div>
    </div>`;

    overlay.classList.add('active');

    document.getElementById('modal-close').addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });

    if (!isInfoOnly && onConfirm) {
        document.getElementById('modal-confirm').addEventListener('click', () => {
            overlay.classList.remove('active');
            onConfirm();
        });
    }
}

/* ── Admin Users ─────────────────────────────────────────── */
async function initAdminUsers() {
    await loadAdminUsers();

    document.getElementById('user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const un = document.getElementById('user-username').value;
        const pw = document.getElementById('user-password').value;

        try {
            await api.adminCreateUser({ username: un, password: pw });
            showToast('User created successfully');
            document.getElementById('user-form').reset();
            loadAdminUsers();
        } catch (err) {
            showToast(err.error || 'Failed to create user', 'error');
        }
    });

    document.getElementById('cancel-user').addEventListener('click', () => {
        document.getElementById('user-form').reset();
    });
}

async function loadAdminUsers() {
    try {
        const users = await api.adminGetUsers();
        const tbody = document.getElementById('users-list');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-light" style="padding:24px">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><strong>${u.username}</strong></td>
        <td>${new Date(u.created_at).toLocaleString()}</td>
        <td class="actions">
          <button class="del-btn" onclick="deleteUser(${u.id}, '${u.username.replace(/'/g, "\\'")}')">Delete</button>
        </td>
      </tr>`).join('');
    } catch (e) {
        console.error('Error loading users:', e);
        showToast('Failed to load users', 'error');
    }
}

window.deleteUser = function (id, username) {
    showModal('Delete User', `Are you sure you want to delete admin user "${username}"?`, async () => {
        try {
            await api.adminDeleteUser(id);
            showToast('User deleted successfully');
            loadAdminUsers();
        } catch (err) {
            showToast(err.error || 'Failed to delete user', 'error');
        }
    });
};

/* ── Toggle helper ───────────────────────────────────────── */
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle')) {
        e.target.classList.toggle('active');
    }
});
