/**
 * cart.js — Shopping cart page logic.
 *
 * Renders cart items, handles quantity +/- controls,
 * item removal, and displays the order summary.
 */

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('cart-items')) return;
    await window.whenSettingsReady;
    loadCart();
});

async function loadCart() {
    const container = document.getElementById('cart-items');
    const summaryEl = document.getElementById('cart-summary');

    try {
        const cart = await api.getCart();

        if (cart.items.length === 0) {
            container.innerHTML = `
        <div class="empty-cart">
          <h2>Your cart is empty</h2>
          <p class="text-light mb-24">Looks like you haven't added anything yet.</p>
          <a href="/products" class="btn btn-primary">Browse Products</a>
        </div>`;
            summaryEl.style.display = 'none';
            return;
        }

        // Render cart table
        let rows = '';
        cart.items.forEach(item => {
            const img = productImage(item.image);
            const linePrice = item.discount_amount > 0
                ? `<span style="color:var(--danger)">${formatPrice(item.discounted_price)}</span> <small style="text-decoration:line-through;color:var(--text-light)">${formatPrice(item.price)}</small>`
                : formatPrice(item.price);

            rows += `
        <tr>
          <td>
            <div class="cart-product">
              <img class="cart-thumb" src="${img}" alt="${item.name}">
              <div>
                <div class="cart-name">${item.name}</div>
                ${item.offer_name ? `<small style="color:var(--primary)">${item.offer_name}</small>` : ''}
              </div>
            </div>
          </td>
          <td>${linePrice}</td>
          <td>
            <div class="qty-selector">
              <button onclick="changeQty(${item.id}, ${item.quantity - 1})">−</button>
              <input type="number" value="${item.quantity}" min="1" readonly>
              <button onclick="changeQty(${item.id}, ${item.quantity + 1})">+</button>
            </div>
          </td>
          <td><strong>${formatPrice(item.line_total)}</strong></td>
          <td><button class="cart-remove" onclick="removeItem(${item.id})">Remove</button></td>
        </tr>`;
        });

        container.innerHTML = `
      <table class="cart-table">
        <thead>
          <tr>
            <th>Product</th><th>Price</th><th>Quantity</th><th>Total</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

        // Summary
        summaryEl.style.display = 'block';
        summaryEl.innerHTML = `
      <div class="summary-row">
        <span>Subtotal</span><span>${formatPrice(cart.subtotal)}</span>
      </div>
      ${cart.discount_total > 0 ? `<div class="summary-row" style="color:var(--success)">
        <span>Discounts</span><span>-${formatPrice(cart.discount_total)}</span>
      </div>` : ''}
      <div class="summary-row total">
        <span>Total</span><span>${formatPrice(cart.total)}</span>
      </div>
      <a href="/checkout" class="btn btn-primary btn-block mt-24">Proceed to Checkout</a>`;

        updateCartBadge();
    } catch (e) {
        container.innerHTML = '<p class="text-center text-light">Failed to load cart.</p>';
        console.error(e);
    }
}

async function changeQty(itemId, newQty) {
    try {
        if (newQty < 1) {
            await api.removeCartItem(itemId);
        } else {
            await api.updateCartItem(itemId, newQty);
        }
        loadCart();
    } catch (e) { showToast('Failed to update item', 'error'); }
}

async function removeItem(itemId) {
    try {
        await api.removeCartItem(itemId);
        showToast('Item removed');
        loadCart();
    } catch (e) { showToast('Failed to remove item', 'error'); }
}
