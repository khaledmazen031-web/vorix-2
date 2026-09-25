document.addEventListener("DOMContentLoaded", function () {


const cartButton = document.getElementById("cartButton");
const cartOverlay = document.getElementById("cartOverlay");
const closeCart = document.getElementById("closeCart");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const payBtn = document.getElementById("payBtn");
const checkoutOverlay = document.getElementById("checkoutOverlay");
const closeCheckout = document.getElementById("closeCheckout");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutName = document.getElementById("checkoutName");
const checkoutPhone = document.getElementById("checkoutPhone");
const checkoutError = document.getElementById("checkoutError");
const confirmPaymentBtn = document.getElementById("confirmPaymentBtn");
let selectedPaymentMethod = null;

const categoriesContainer = document.getElementById("categories");

const categoryOverlay = document.getElementById("categoryOverlay");
const closeCategoryBtn = document.getElementById("closeCategory");
const categoryTitle = document.getElementById("categoryTitle");
const categoryProductsContainer = document.getElementById("categoryProductsContainer");

const searchButton = document.getElementById("searchButton");
const searchOverlay = document.getElementById("searchOverlay");
const closeSearchBtn = document.getElementById("closeSearch");
const searchInput = document.getElementById("searchInput");
const searchResultsContainer = document.getElementById("searchResultsContainer");



if (!cartButton || !cartOverlay || !closeCart || !cartItems || !cartCount || !cartTotal || !payBtn) {
    console.error("STYLE TEAM: Some essential cart HTML elements are missing.");
    return;
}



let cart = [];

try {
    const savedCart = localStorage.getItem("styleTeamCart");
    if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        if (Array.isArray(parsedCart)) {
            cart = parsedCart;
        }
    }
} catch (error) {
    console.error("STYLE TEAM: Error loading cart.", error);
    cart = [];
}

function saveCart() {
    try {
        localStorage.setItem("styleTeamCart", JSON.stringify(cart));
    } catch (error) {
        console.error("STYLE TEAM: Error saving cart.", error);
    }
}



const bgMusic = document.getElementById("bgMusic");
const DEFAULT_MUSIC_URL = "https://xgwaqdtufwxqllytpxmv.supabase.co/storage/v1/object/public/Anything/Dave_ft_Tems_-_Raindance.mp3";

// Playlist config lives in settings(id = "site").music_url as JSON:
// { mode: "single" | "sequence" | "shuffle", current: "<track id>", tracks: [{ id, title, url }] }
// A plain URL string (old format) is still supported.
let musicTracks = [];
let musicMode = "single";
let musicIndex = 0;
let musicQueue = [];
let musicFailures = 0;
let musicUnlocked = false;

function parseMusicConfig(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.charAt(0) === "{") {
        try {
            const cfg = JSON.parse(s);
            if (cfg && Array.isArray(cfg.tracks)) {
                const tracks = cfg.tracks.filter(function (t) { return t && t.url; });
                if (tracks.length) {
                    return {
                        mode: ["single", "sequence", "shuffle"].indexOf(cfg.mode) !== -1 ? cfg.mode : "single",
                        current: cfg.current,
                        tracks: tracks
                    };
                }
            }
        } catch (e) { /* ignore, fall back to default */ }
        return null;
    }
    return { mode: "single", current: null, tracks: [{ url: s }] };
}

function shuffleQueue(excludeIndex) {
    const q = musicTracks.map(function (_, i) { return i; });
    for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = q[i]; q[i] = q[j]; q[j] = t;
    }
    // avoid playing the same song twice in a row when a new round starts
    if (q.length > 1 && q[0] === excludeIndex) {
        const t = q[0]; q[0] = q[q.length - 1]; q[q.length - 1] = t;
    }
    musicQueue = q;
}

function playMusic() {
    if (bgMusic && typeof bgMusic.play === "function") {
        bgMusic.play().catch(function(error) {
            console.log("Music auto-play prevented:", error);
        });
    }
}

function loadTrack(i) {
    musicIndex = i;
    bgMusic.src = musicTracks[i].url;
    if (musicUnlocked) playMusic();
}

function nextTrack() {
    if (!musicTracks.length) return;
    if (musicTracks.length === 1) {
        bgMusic.currentTime = 0;
        playMusic();
        return;
    }
    let i;
    if (musicMode === "shuffle") {
        if (!musicQueue.length) shuffleQueue(musicIndex);
        i = musicQueue.shift();
    } else {
        i = (musicIndex + 1) % musicTracks.length;
    }
    loadTrack(i);
}

function startMusic(cfg) {
    musicTracks = cfg.tracks;
    musicMode = cfg.mode;
    // one song (or "single" mode) => the browser loops it; otherwise we move on at "ended"
    bgMusic.loop = musicMode === "single" || musicTracks.length === 1;

    let start = 0;
    if (musicMode === "single") {
        const idx = musicTracks.findIndex(function (t) { return t.id === cfg.current; });
        start = idx >= 0 ? idx : 0;
    } else if (musicMode === "shuffle") {
        shuffleQueue(-1);
        start = musicQueue.shift();
    }
    loadTrack(start);
}

async function loadMusicUrl() {
    if (!bgMusic) return;
    let cfg = null;
    try {
        if (typeof supabaseClient !== "undefined" && supabaseClient) {
            const { data, error } = await supabaseClient
                .from("settings")
                .select("music_url")
                .eq("id", "site")
                .single();
            if (!error && data) {
                cfg = parseMusicConfig(data.music_url);
            }
        }
    } catch (e) {
        console.log("STYLE TEAM: Could not load music setting, using default.", e);
    }
    if (!cfg) {
        cfg = { mode: "single", current: null, tracks: [{ url: DEFAULT_MUSIC_URL }] };
    }
    startMusic(cfg);
}

function unlockMusic() {
    musicUnlocked = true;
    if (bgMusic && bgMusic.getAttribute("src")) playMusic();
}

if (bgMusic) {
    bgMusic.addEventListener("ended", nextTrack);
    bgMusic.addEventListener("playing", function () { musicFailures = 0; });
    bgMusic.addEventListener("error", function () {
        // skip a broken file, but stop if every song fails
        musicFailures++;
        if (musicFailures >= musicTracks.length) return;
        nextTrack();
    });
}
loadMusicUrl();
document.addEventListener("touchstart", unlockMusic, { once: true });
document.addEventListener("click", unlockMusic, { once: true });



// Categories/products are loaded entirely from Supabase (see
// loadCategoriesFromSupabase / loadProductsFromSupabase below). No hardcoded
// fallback data — if Supabase has no rows yet, the sections stay empty until
// the admin adds them from the dashboard.
let categoryData = {};

// Renders the category cards into #categories and (re)binds their click
// handlers. Called once the real sections are loaded from Supabase.
function renderCategoryCards(list) {
    if (!categoriesContainer) return;

    categoriesContainer.innerHTML = list.map(function (cat) {
        const imageHTML = cat.image
            ? `<div class="category-image"><img src="${cat.image}" alt="${escapeHTML(cat.name)}"></div>`
            : "";
        return `
            <div class="category-card${cat.image ? "" : " no-image"}" data-category="${cat.id}">
                ${imageHTML}
                <div class="category-content">
                    <h3>${escapeHTML(cat.name)}</h3>
                    <p>Explore ${escapeHTML(cat.name)}</p>
                </div>
            </div>
        `;
    }).join("");

    attachCategoryCardListeners();
}

function attachCategoryCardListeners() {
    document.querySelectorAll(".category-card").forEach(function (card) {
        card.addEventListener("click", function () {
            openCategoryOverlay(card.getAttribute("data-category"), card.querySelector("h3").innerText);
        });
    });
}

// Pull live sections (admin-managed) from Supabase. Falls back to the
// hardcoded list above if Supabase isn't configured yet or the table is empty.
async function loadCategoriesFromSupabase() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from("categories")
            .select("*")
            .order("created_at", { ascending: true });
        if (error || !data || data.length === 0) return;

        renderCategoryCards(data.map(function (c) {
            return { id: c.id, name: c.name, image: c.image || "" };
        }));
    } catch (e) {
        console.error("STYLE TEAM: Could not load categories from Supabase.", e);
    }
}

// Pull live products from Supabase (admin-managed). If Supabase isn't
// configured yet or the fetch fails, categoryData stays empty.
async function loadProductsFromSupabase() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .eq("is_active", true);
        if (error || !data || data.length === 0) return;

        const grouped = {};
        data.forEach(function (p) {
            if (!grouped[p.category]) grouped[p.category] = [];
            grouped[p.category].push({
                name: p.name,
                price: Number(p.price).toLocaleString() + " EGP",
                img: p.image,
                colors: Array.isArray(p.colors) ? p.colors : []
            });
        });
        categoryData = grouped;
    } catch (e) {
        console.error("STYLE TEAM: Could not load products from Supabase.", e);
    }
}

// Visitor tracking: one row per browser session
async function trackVisit() {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return;
    try {
        if (sessionStorage.getItem("styleTeamVisitLogged")) return;

        let visitorId = localStorage.getItem("styleTeamVisitorId");
        if (!visitorId) {
            visitorId = "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
            localStorage.setItem("styleTeamVisitorId", visitorId);
        }

        await supabaseClient.from("page_views").insert({
            visitor_id: visitorId,
            page: window.location.pathname
        });
        sessionStorage.setItem("styleTeamVisitLogged", "1");
    } catch (e) {
        console.error("STYLE TEAM: Could not log visit.", e);
    }
}
trackVisit();
loadCategoriesFromSupabase();
loadProductsFromSupabase();

// Renders a list of {name, price, img, colors} products as a product-grid,
// with working color swatches and an "Add to cart" button on each card.
// Used by both the category overlay and the search overlay.
function renderProductGrid(container, products) {
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `<p class="empty-cart">No products available.</p>`;
        return;
    }

    container.innerHTML = `<div class="product-grid">` + products.map(function (item, index) {
        const colors = Array.isArray(item.colors) ? item.colors : [];
        const swatchesHTML = colors.length > 0 ? `
            <div class="color-swatches" data-product-index="${index}">
                ${colors.map(function (c, cIndex) {
                    return `<span class="color-swatch ${cIndex === 0 ? 'selected' : ''}" style="background:${c.hex}" data-color-name="${escapeHTML(c.name)}" data-color-hex="${c.hex}" title="${escapeHTML(c.name)}"></span>`;
                }).join("")}
            </div>
        ` : "";

        return `
            <div class="product-card-big" data-product-index="${index}">
                <div class="product-card-img">
                    <img src="${item.img}" alt="${escapeHTML(item.name)}">
                </div>
                <h4 class="product-card-name">${escapeHTML(item.name)}</h4>
                <p class="product-card-price">${item.price}</p>
                ${swatchesHTML}
                <button type="button" class="product-card-add" onclick="window.addToCartFromCategory('${escapeHTML(item.name)}', '${item.price}', '${item.img}', this)">Add 🛒</button>
            </div>
        `;
    }).join("") + `</div>`;

    // color swatch selection
    container.querySelectorAll(".color-swatches").forEach(function (group) {
        group.querySelectorAll(".color-swatch").forEach(function (dot) {
            dot.addEventListener("click", function () {
                group.querySelectorAll(".color-swatch").forEach(function (d) { d.classList.remove("selected"); });
                dot.classList.add("selected");
            });
        });
    });
}

function openCategoryOverlay(catKey, title) {
    const products = categoryData[catKey] || [];

    if (categoryTitle) {
        categoryTitle.innerText = title || "";
    }

    renderProductGrid(categoryProductsContainer, products);

    if (categoryOverlay) {
        categoryOverlay.classList.add("active");
    }
}

if (closeCategoryBtn && categoryOverlay) {
    closeCategoryBtn.addEventListener("click", function () {
        categoryOverlay.classList.remove("active");
    });

    categoryOverlay.addEventListener("click", function (e) {
        if (e.target === categoryOverlay) {
            categoryOverlay.classList.remove("active");
        }
    });
}


// ---------- SEARCH ----------
function runSearch(query) {
    if (!searchResultsContainer) return;

    const term = query.trim().toLowerCase();
    if (!term) {
        searchResultsContainer.innerHTML = `<p class="empty-cart">Start typing to search products.</p>`;
        return;
    }

    const allProducts = Object.keys(categoryData).reduce(function (list, key) {
        return list.concat(categoryData[key]);
    }, []);

    const matches = allProducts.filter(function (item) {
        return item.name.toLowerCase().indexOf(term) !== -1;
    });

    if (matches.length === 0) {
        searchResultsContainer.innerHTML = `<p class="empty-cart">No products match "${escapeHTML(query)}".</p>`;
        return;
    }

    renderProductGrid(searchResultsContainer, matches);
}

function openSearchOverlay() {
    if (!searchOverlay) return;
    searchOverlay.classList.add("active");
    if (searchInput) {
        searchInput.value = "";
        runSearch("");
        setTimeout(function () { searchInput.focus(); }, 50);
    }
}

function closeSearchOverlay() {
    if (searchOverlay) searchOverlay.classList.remove("active");
}

if (searchButton) {
    searchButton.addEventListener("click", function (event) {
        event.preventDefault();
        openSearchOverlay();
    });
}

if (closeSearchBtn) {
    closeSearchBtn.addEventListener("click", closeSearchOverlay);
}

if (searchOverlay) {
    searchOverlay.addEventListener("click", function (event) {
        if (event.target === searchOverlay) closeSearchOverlay();
    });
}

if (searchInput) {
    searchInput.addEventListener("input", function () {
        runSearch(searchInput.value);
    });
}

window.addToCartFromCategory = function(name, price, img, buttonElement) {
    const productItemContainer = buttonElement.closest(".product-card-big");

    const selectedSwatch = productItemContainer ? productItemContainer.querySelector(".color-swatch.selected") : null;
    const selectedColor = selectedSwatch ? selectedSwatch.getAttribute("data-color-name") : null;

    const numericPrice = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
    const cartItemId = `${name}-${selectedColor || "default"}`;

    const existingItem = cart.find(function(item) {
        return item.id === cartItemId;
    });

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: cartItemId,
            name: name,
            color: selectedColor,
            price: numericPrice,
            rawPrice: price,
            img: img,
            quantity: 1
        });
    }

    updateCart();
    alert(`Added ${name}${selectedColor ? " (" + selectedColor + ")" : ""} to cart! 🛒`);
};

window.increaseQuantity = function(id) {
    const item = cart.find(function(i) { return i.id === id; });
    if (item) {
        item.quantity += 1;
        updateCart();
    }
};

window.decreaseQuantity = function(id) {
    const item = cart.find(function(i) { return i.id === id; });
    if (item) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
            cart = cart.filter(function(i) { return i.id !== id; });
        }
        updateCart();
    }
};

window.removeItem = function(id) {
    cart = cart.filter(function(i) { return i.id !== id; });
    updateCart();
};

function updateCart() {
    cartItems.innerHTML = "";
    let total = 0;
    let count = 0;

    // Filter invalid entries
    cart = cart.filter(function (product) {
        return (
            product &&
            product.name &&
            Number(product.price) > 0 &&
            Number(product.quantity) > 0
        );
    });

    if (cart.length === 0) {
        cartItems.innerHTML = `<p class="empty-cart">Your cart is empty.</p>`;
        cartCount.textContent = "0";
        cartTotal.textContent = "0 EGP";
        saveCart();
        return;
    }

    cart.forEach(function (product) {
        const price = Number(product.price);
        const quantity = Number(product.quantity);
        const productTotal = price * quantity;
        const itemId = product.id || `${product.name}-${product.color || 'default'}`;

        total += productTotal;
        count += quantity;

        const item = document.createElement("div");
        item.className = "cart-item";
        item.style.cssText = "display: flex; gap: 12px; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 12px; justify-content: space-between;";
        
        item.innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center;">
                ${product.img ? `<img src="${product.img}" alt="${escapeHTML(product.name)}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 8px;">` : ''}
                <div>
                    <h4 style="font-size: 13px; margin-bottom: 2px; color: #333;">${escapeHTML(product.name)}</h4>
                    <p style="color: #666; font-size: 11px; margin-bottom: 4px;">${product.color ? `Color: <b>${escapeHTML(product.color)}</b> | ` : ''}${price.toLocaleString()} EGP</p>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" onclick="window.decreaseQuantity('${itemId}')" style="background: #eee; border: none; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-weight: bold;">-</button>
                        <span style="font-size: 13px; font-weight: bold;">${quantity}</span>
                        <button type="button" onclick="window.increaseQuantity('${itemId}')" style="background: #eee; border: none; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; font-weight: bold;">+</button>
                    </div>
                </div>
            </div>
            <button type="button" onclick="window.removeItem('${itemId}')" style="background: none; border: none; color: #ff4d4d; cursor: pointer; font-size: 18px; padding: 5px;">×</button>
        `;

        cartItems.appendChild(item);
    });

    cartCount.textContent = count;
    cartTotal.textContent = total.toLocaleString() + " EGP";

    saveCart();
}



function openCart() {
    cartOverlay.classList.add("active");
    document.body.classList.add("cart-open");
}

function closeCartWindow() {
    cartOverlay.classList.remove("active");
    document.body.classList.remove("cart-open");
}

cartButton.addEventListener("click", function (event) {
    event.preventDefault();
    openCart();
});

closeCart.addEventListener("click", function (event) {
    event.preventDefault();
    closeCartWindow();
});

cartOverlay.addEventListener("click", function (event) {
    if (event.target === cartOverlay) {
        closeCartWindow();
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeCartWindow();
        if (categoryOverlay) categoryOverlay.classList.remove("active");
        if (checkoutOverlay) checkoutOverlay.classList.remove("active");
        if (searchOverlay) searchOverlay.classList.remove("active");
    }
});



async function logOrderToSupabase(items, total, paymentMethod, customerName, customerPhone) {
    if (typeof supabaseClient === "undefined" || !supabaseClient) return null;
    try {
        const { data, error } = await supabaseClient.from("orders").insert({
            items: items,
            total: total,
            payment_method: paymentMethod,
            status: "pending",
            customer_name: customerName,
            customer_phone: customerPhone
        }).select().single();
        if (error) throw error;
        return data;
    } catch (e) {
        console.error("STYLE TEAM: Could not log order.", e);
        return null;
    }
}

function openCheckout() {
    if (cart.length === 0) {
        alert("Your cart is empty!");
        return;
    }
    checkoutOverlay.classList.add("active");
}

function closeCheckoutWindow() {
    checkoutOverlay.classList.remove("active");
}

payBtn.addEventListener("click", function (event) {
    event.preventDefault();
    openCheckout();
});

if (closeCheckout) {
    closeCheckout.addEventListener("click", function () {
        closeCheckoutWindow();
    });
}

checkoutOverlay.addEventListener("click", function (event) {
    if (event.target === checkoutOverlay) closeCheckoutWindow();
});

document.querySelectorAll(".payment-method-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".payment-method-btn").forEach(function (b) { b.classList.remove("selected"); });
        btn.classList.add("selected");
        selectedPaymentMethod = btn.dataset.method;
        confirmPaymentBtn.disabled = false;
    });
});

checkoutForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    checkoutError.textContent = "";

    if (!selectedPaymentMethod) {
        checkoutError.textContent = "اختر طريقة الدفع.";
        return;
    }

    const name = checkoutName.value.trim();
    const phone = checkoutPhone.value.trim();
    if (!name || !phone) {
        checkoutError.textContent = "اكتب الاسم ورقم الموبايل.";
        return;
    }

    let total = 0;
    const orderItems = [];
    cart.forEach(function (product) {
        const price = Number(product.price);
        const quantity = Number(product.quantity);
        total += price * quantity;
        orderItems.push({
            name: product.name,
            color: product.color || null,
            price: price,
            quantity: quantity,
            img: product.img || ""
        });
    });

    confirmPaymentBtn.disabled = true;
    confirmPaymentBtn.textContent = "جاري التحويل...";

    const order = await logOrderToSupabase(orderItems, total, selectedPaymentMethod, name, phone);

    try {
        const response = await fetch("/api/create-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: total,
                method: selectedPaymentMethod,
                name: name,
                phone: phone,
                orderId: order ? order.id : null
            })
        });

        const result = await response.json();

        if (!response.ok || !result.redirectUrl) {
            throw new Error(result.error || "Payment initialization failed");
        }

        window.location.href = result.redirectUrl;
    } catch (e) {
        console.error("STYLE TEAM: Payment initialization failed.", e);
        checkoutError.textContent = "حصل خطأ أثناء بدء الدفع. حاول تاني.";
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.textContent = "تأكيد الدفع";
    }
});


// ---------- IMAGE LIGHTBOX ----------
// Clicking any product image (in the products grid, category overlay,
// or search results) opens it enlarged in a full-screen viewer.
const imageLightbox = document.getElementById("imageLightbox");
const imageLightboxImg = document.getElementById("imageLightboxImg");
const closeImageLightbox = document.getElementById("closeImageLightbox");

function openImageLightbox(src, alt) {
    if (!imageLightbox || !imageLightboxImg || !src) return;
    imageLightboxImg.src = src;
    imageLightboxImg.alt = alt || "";
    imageLightbox.classList.add("active");
}

function closeImageLightboxWindow() {
    if (!imageLightbox) return;
    imageLightbox.classList.remove("active");
}

if (closeImageLightbox) {
    closeImageLightbox.addEventListener("click", closeImageLightboxWindow);
}

if (imageLightbox) {
    imageLightbox.addEventListener("click", function (event) {
        if (event.target === imageLightbox) closeImageLightboxWindow();
    });
}

// Delegated listener: works for images rendered now and later (dynamic product cards).
document.addEventListener("click", function (event) {
    const img = event.target.closest(".product-image img, .product-card-img img");
    if (img) {
        event.stopPropagation();
        openImageLightbox(img.getAttribute("src"), img.getAttribute("alt"));
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeImageLightboxWindow();
});



function escapeHTML(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}



updateCart();

});
