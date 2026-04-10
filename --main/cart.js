(() => {
  const CART_KEY = "kidsPatternsCart";

  function safeRead() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function normalizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const id = String(item.productId || item.id || "").trim();
    if (!id) return null;
    const name = String(item.name || item.title || "Товар").trim();
    const price = Number(item.price) || 0;
    const size = String(item.size || "").trim();
    const image = String(item.image || "").trim();
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    return { id, name, price, size, image, qty };
  }

  function normalizeCart(input) {
    const list = Array.isArray(input) ? input : [];
    const map = new Map();
    list.forEach((row) => {
      const item = normalizeItem(row);
      if (!item) return;
      const key = `${item.id}__${item.size}`;
      if (map.has(key)) {
        map.get(key).qty += item.qty;
      } else {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }

  function saveCart(list) {
    const clean = normalizeCart(list);
    localStorage.setItem(CART_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent("kidsCartUpdated"));
    return clean;
  }

  function getCart() {
    const clean = normalizeCart(safeRead());
    // Мягкая миграция старого формата в новый
    localStorage.setItem(CART_KEY, JSON.stringify(clean));
    return clean;
  }

  function addItem(payload) {
    const id = String(payload && payload.id ? payload.id : "").trim();
    const name = String(payload && payload.name ? payload.name : "Товар").trim();
    const price = Number(payload && payload.price ? payload.price : 0) || 0;
    const size = String(payload && payload.size ? payload.size : "").trim();
    const image = String(payload && payload.image ? payload.image : "").trim();
    if (!id) return getCart();

    const cart = getCart();
    const idx = cart.findIndex((x) => x.id === id && x.size === size);
    if (idx >= 0) {
      cart[idx].qty += 1;
    } else {
      cart.push({ id, name, price, size, image, qty: 1 });
    }
    return saveCart(cart);
  }

  function setQty(id, size, qty) {
    const n = Math.max(0, parseInt(qty, 10) || 0);
    const cart = getCart();
    const idx = cart.findIndex((x) => x.id === id && x.size === size);
    if (idx < 0) return cart;
    if (n === 0) cart.splice(idx, 1);
    else cart[idx].qty = n;
    return saveCart(cart);
  }

  function removeItem(id, size) {
    const cart = getCart().filter((x) => !(x.id === id && x.size === size));
    return saveCart(cart);
  }

  function totalQty(cart) {
    return (cart || getCart()).reduce((s, x) => s + (x.qty || 0), 0);
  }

  function totalSum(cart) {
    return (cart || getCart()).reduce((s, x) => s + (x.qty || 0) * (x.price || 0), 0);
  }

  function formatMoney(n) {
    return `${(Number(n) || 0).toLocaleString("ru-RU")} ₽`;
  }

  function updateCartCount() {
    const countEl = document.querySelector("#headerCartCount");
    if (!countEl) return;
    countEl.textContent = String(totalQty());
  }

  function esc(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderCartPage() {
    const listEl = document.querySelector("#cartItems");
    const emptyEl = document.querySelector("#cartEmpty");
    const totalEl = document.querySelector("#cartTotal");
    if (!listEl || !emptyEl || !totalEl) return;

    const cart = getCart();
    if (!cart.length) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      totalEl.textContent = formatMoney(0);
      return;
    }

    emptyEl.hidden = true;
    listEl.innerHTML = cart
      .map((item) => {
        const lineTotal = item.price * item.qty;
        const sizeHtml = item.size ? `<p class="cart-item-size">Рост: ${esc(item.size)}</p>` : "";
        const imgHtml = item.image
          ? `<img src="${esc(item.image)}" alt="" class="cart-item-image" loading="lazy" decoding="async" />`
          : `<div class="cart-item-image cart-item-image--ph" aria-hidden="true"></div>`;
        return `
          <article class="cart-item" data-id="${esc(item.id)}" data-size="${esc(item.size)}">
            ${imgHtml}
            <div class="cart-item-body">
              <h2 class="cart-item-title">${esc(item.name)}</h2>
              ${sizeHtml}
              <p class="cart-item-price">${formatMoney(item.price)}</p>
              <div class="cart-item-actions">
                <button type="button" class="cart-qty-btn" data-action="minus">−</button>
                <span class="cart-qty-val">${item.qty}</span>
                <button type="button" class="cart-qty-btn" data-action="plus">+</button>
                <button type="button" class="cart-remove-btn" data-action="remove">Удалить</button>
              </div>
              <p class="cart-item-subtotal">Сумма: <strong>${formatMoney(lineTotal)}</strong></p>
            </div>
          </article>
        `;
      })
      .join("");

    totalEl.textContent = formatMoney(totalSum(cart));
  }

  function bindCartPageEvents() {
    const listEl = document.querySelector("#cartItems");
    if (!listEl) return;
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      const row = e.target.closest(".cart-item");
      if (!btn || !row) return;
      const id = row.getAttribute("data-id") || "";
      const size = row.getAttribute("data-size") || "";
      const action = btn.getAttribute("data-action");
      const cart = getCart();
      const item = cart.find((x) => x.id === id && x.size === size);
      if (!item) return;
      if (action === "plus") setQty(id, size, item.qty + 1);
      if (action === "minus") setQty(id, size, item.qty - 1);
      if (action === "remove") removeItem(id, size);
      renderCartPage();
    });
  }

  window.KidsCart = {
    getCart,
    addItem,
    setQty,
    removeItem,
    totalQty,
    totalSum,
    updateCartCount,
    renderCartPage,
  };

  window.updateCartCount = updateCartCount;

  updateCartCount();
  renderCartPage();
  bindCartPageEvents();

  document.addEventListener("DOMContentLoaded", () => {
    updateCartCount();
    renderCartPage();
  });

  window.addEventListener("kidsCartUpdated", () => {
    updateCartCount();
    renderCartPage();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === CART_KEY) {
      updateCartCount();
      renderCartPage();
    }
  });
})();

