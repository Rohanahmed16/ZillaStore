/**
 * checkout.js — Checkout page logic.
 *
 * Loads the current cart into the order summary panel,
 * validates the form with inline errors, and submits the order.
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    if (!form) return;
    loadCheckoutSummary();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        await submitOrder();
    });
});

async function loadCheckoutSummary() {
    const el = document.getElementById('checkout-summary');
    if (!el) return;

    try {
        const cart = await api.getCart();
        if (cart.items.length === 0) {
            window.location.href = '/cart';
            return;
        }

        let itemsHtml = cart.items.map(i =>
            `<div class="summary-item">
        <span>${i.name} × ${i.quantity}</span>
        <span>${formatPrice(i.line_total)}</span>
      </div>`
        ).join('');

        el.innerHTML = `
      <h3>Order Summary</h3>
      ${itemsHtml}
      <div class="summary-item" style="margin-top:12px;padding-top:12px;border-top:2px solid var(--border)">
        <span>Subtotal</span><span>${formatPrice(cart.subtotal)}</span>
      </div>
      ${cart.discount_total > 0 ? `<div class="summary-item" style="color:var(--success)">
        <span>Discounts</span><span>-${formatPrice(cart.discount_total)}</span>
      </div>` : ''}
      <div class="summary-item" style="font-weight:800;font-size:1.125rem;margin-top:8px">
        <span>Total</span><span>${formatPrice(cart.total)}</span>
      </div>`;
    } catch (e) {
        el.innerHTML = '<p class="text-light">Failed to load summary.</p>';
    }
}

function validateForm() {
    let valid = true;
    const fields = [
        { id: 'customer_name', label: 'Name', pattern: /.{2,}/ },
        { id: 'email', label: 'Email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        { id: 'phone', label: 'Phone', pattern: /^[\d\s\+\-\(\)]{7,}$/ },
        { id: 'address', label: 'Address', pattern: /.{5,}/ },
    ];

    fields.forEach(f => {
        const group = document.getElementById(f.id).closest('.form-group');
        const val = document.getElementById(f.id).value.trim();
        if (!f.pattern.test(val)) {
            group.classList.add('has-error');
            valid = false;
        } else {
            group.classList.remove('has-error');
        }
    });

    return valid;
}

async function submitOrder() {
    const btn = document.querySelector('#checkout-form button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        const data = {
            customer_name: document.getElementById('customer_name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim(),
        };
        const result = await api.checkout(data);
        window.location.href = '/confirmation/' + result.order_id;
    } catch (e) {
        showToast(e.error || 'Checkout failed. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Place Order';
    }
}
