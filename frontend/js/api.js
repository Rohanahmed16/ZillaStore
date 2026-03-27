/**
 * api.js — Centralized API helper for ZILLA Store frontend.
 *
 * All fetch calls go through this module so:
 *   1. The base URL is configured once.
 *   2. Credentials (cookies) are always sent.
 *   3. Errors are handled consistently.
 */

const API_BASE = '';  // Same origin — Flask serves both

const api = {
    /**
     * Generic fetch wrapper that auto-parses JSON.
     */
    async request(url, options = {}) {
        const defaults = {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        };
        // If sending FormData, remove Content-Type so browser sets boundary
        if (options.body instanceof FormData) {
            delete defaults.headers['Content-Type'];
        }
        const res = await fetch(API_BASE + url, { ...defaults, ...options });
        const data = await res.json();
        if (!res.ok) throw { status: res.status, ...data };
        return data;
    },

    // ── Site Settings ──────────────────────────────────────
    getSettings() { return this.request('/api/settings'); },

    // ── Sections & Categories ─────────────────────────────
    getSections() { return this.request('/api/sections'); },
    getCategories() { return this.request('/api/categories'); },

    // ── Products ──────────────────────────────────────────
    getProducts(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request('/api/products' + (qs ? '?' + qs : ''));
    },
    getProduct(id) { return this.request('/api/products/' + id); },
    getActiveOffers() { return this.request('/api/offers/active'); },

    // ── Cart ──────────────────────────────────────────────
    getCart() { return this.request('/api/cart'); },
    addToCart(productId, quantity = 1) {
        return this.request('/api/cart/add', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity }),
        });
    },
    updateCartItem(itemId, quantity) {
        return this.request('/api/cart/' + itemId, {
            method: 'PUT',
            body: JSON.stringify({ quantity }),
        });
    },
    removeCartItem(itemId) {
        return this.request('/api/cart/' + itemId, { method: 'DELETE' });
    },
    clearCart() { return this.request('/api/cart', { method: 'DELETE' }); },

    // ── Checkout ──────────────────────────────────────────
    checkout(data) {
        return this.request('/api/checkout', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // ── Admin Auth ────────────────────────────────────────
    adminLogin(username, password) {
        return this.request('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    },
    adminLogout() { return this.request('/api/admin/logout', { method: 'POST' }); },
    adminCheck() { return this.request('/api/admin/check'); },

    // ── Admin Dashboard ───────────────────────────────────
    getDashboard() { return this.request('/api/admin/dashboard'); },

    // ── Admin Products ────────────────────────────────────
    adminGetProducts() { return this.request('/api/admin/products'); },
    adminCreateProduct(formData) {
        return this.request('/api/admin/products', {
            method: 'POST', body: formData,
        });
    },
    adminUpdateProduct(id, formData) {
        return this.request('/api/admin/products/' + id, {
            method: 'PUT', body: formData,
        });
    },
    adminDeleteProduct(id) {
        return this.request('/api/admin/products/' + id, { method: 'DELETE' });
    },

    // ── Admin Sections & Categories ───────────────────────
    adminGetCategories() { return this.request('/api/admin/categories'); },
    adminCreateSection(data) {
        return this.request('/api/admin/sections', {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    adminUpdateSection(id, data) {
        return this.request('/api/admin/sections/' + id, {
            method: 'PUT', body: JSON.stringify(data),
        });
    },
    adminDeleteSection(id) {
        return this.request('/api/admin/sections/' + id, { method: 'DELETE' });
    },
    adminCreateCategory(data) {
        return this.request('/api/admin/categories', {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    adminUpdateCategory(id, data) {
        return this.request('/api/admin/categories/' + id, {
            method: 'PUT', body: JSON.stringify(data),
        });
    },
    adminDeleteCategory(id) {
        return this.request('/api/admin/categories/' + id, { method: 'DELETE' });
    },

    // ── Admin Offers ──────────────────────────────────────
    adminGetOffers() { return this.request('/api/admin/offers'); },
    adminCreateOffer(data) {
        return this.request('/api/admin/offers', {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    adminUpdateOffer(id, data) {
        return this.request('/api/admin/offers/' + id, {
            method: 'PUT', body: JSON.stringify(data),
        });
    },
    adminDeleteOffer(id) {
        return this.request('/api/admin/offers/' + id, { method: 'DELETE' });
    },

    // ── Admin Settings ────────────────────────────────────
    adminGetSettings() { return this.request('/api/admin/settings'); },
    adminUpdateSettings(formData) {
        return this.request('/api/admin/settings', {
            method: 'PUT', body: formData,
        });
    },

    // ── Admin Orders ──────────────────────────────────────
    adminGetOrders(sort = 'created_at', dir = 'DESC') {
        return this.request(`/api/admin/orders?sort=${sort}&dir=${dir}`);
    },
    adminGetOrder(id) { return this.request('/api/admin/orders/' + id); },
    adminUpdateOrderStatus(id, status) {
        return this.request('/api/admin/orders/' + id + '/status', {
            method: 'PUT', body: JSON.stringify({ status }),
        });
    },

    // ── Admin Users ───────────────────────────────────────
    adminGetUsers() { return this.request('/api/admin/users'); },
    adminCreateUser(data) {
        return this.request('/api/admin/users', {
            method: 'POST', body: JSON.stringify(data),
        });
    },
    adminDeleteUser(id) { return this.request('/api/admin/users/' + id, { method: 'DELETE' }); },
};
