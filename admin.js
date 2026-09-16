document.addEventListener("DOMContentLoaded", function () {

  if (!supabaseClient) {
    alert("Supabase غير مُعدّ. افتح supabase-config.js وضِف الـ URL والـ anon key.");
    return;
  }

  const loginScreen = document.getElementById("loginScreen");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const dashboard = document.getElementById("dashboard");
  const logoutBtn = document.getElementById("logoutBtn");

  // ---------- AUTH ----------
  async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.classList.remove("hidden");
    dashboard.classList.add("hidden");
  }

  function showDashboard() {
    loginScreen.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadOverview();
    loadOrders();
    loadCategories().then(loadProducts);
  }

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loginError.textContent = "";
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = "بيانات الدخول غير صحيحة.";
      return;
    }
    showDashboard();
  });

  logoutBtn.addEventListener("click", async function () {
    await supabaseClient.auth.signOut();
    showLogin();
  });

  // ---------- TABS ----------
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ---------- OVERVIEW ----------
  async function loadOverview() {
    const { count: visitorCount } = await supabaseClient
      .from("page_views")
      .select("visitor_id", { count: "exact", head: true });

    const { data: orders } = await supabaseClient
      .from("orders")
      .select("total, status");

    document.getElementById("statVisitors").textContent = visitorCount || 0;

    if (orders) {
      const totalRevenue = orders.reduce(function (sum, o) { return sum + Number(o.total || 0); }, 0);
      const pending = orders.filter(function (o) { return o.status === "pending"; }).length;
      document.getElementById("statOrders").textContent = orders.length;
      document.getElementById("statRevenue").textContent = totalRevenue.toLocaleString() + " EGP";
      document.getElementById("statPending").textContent = pending;
    }
  }

  // ---------- ORDERS ----------
  const ordersBody = document.getElementById("ordersBody");
  const ordersEmpty = document.getElementById("ordersEmpty");

  async function loadOrders() {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    ordersBody.innerHTML = "";

    if (error || !data || data.length === 0) {
      ordersEmpty.classList.remove("hidden");
      return;
    }
    ordersEmpty.classList.add("hidden");

    data.forEach(function (order) {
      const itemsText = (order.items || [])
        .map(function (it) { return `${it.name} (${it.size || "M"}) x${it.quantity}`; })
        .join("، ");

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${new Date(order.created_at).toLocaleString("ar-EG")}</td>
        <td>${escapeHTML(order.customer_name || "-")}<br><span style="color:var(--gray);font-size:11px;">${escapeHTML(order.customer_phone || "")}</span></td>
        <td>${escapeHTML(itemsText)}</td>
        <td>${Number(order.total).toLocaleString()} EGP</td>
        <td>${escapeHTML(order.payment_method || "-")}</td>
        <td>
          <select class="status-select" data-id="${order.id}">
            ${["pending", "confirmed", "shipped", "completed", "cancelled"].map(function (s) {
              return `<option value="${s}" ${s === order.status ? "selected" : ""}>${statusLabel(s)}</option>`;
            }).join("")}
          </select>
        </td>
        <td><button class="icon-btn danger" data-delete-order="${order.id}">حذف</button></td>
      `;
      ordersBody.appendChild(row);
    });

    document.querySelectorAll(".status-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        await supabaseClient.from("orders").update({ status: sel.value }).eq("id", sel.dataset.id);
        loadOverview();
      });
    });

    document.querySelectorAll("[data-delete-order]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("حذف الطلب؟")) return;
        await supabaseClient.from("orders").delete().eq("id", btn.dataset.deleteOrder);
        loadOrders();
        loadOverview();
      });
    });
  }

  function statusLabel(s) {
    const map = { pending: "قيد الانتظار", confirmed: "مؤكد", shipped: "تم الشحن", completed: "مكتمل", cancelled: "ملغي" };
    return map[s] || s;
  }

  document.getElementById("refreshOrders").addEventListener("click", loadOrders);

  // ---------- CATEGORIES ----------
  const categoriesBody = document.getElementById("categoriesBody");
  const categoriesEmpty = document.getElementById("categoriesEmpty");
  const categoryModal = document.getElementById("categoryModal");
  const categoryForm = document.getElementById("categoryForm");
  const productCategorySelect = document.getElementById("productCategory");

  let categoriesCache = [];

  async function loadCategories() {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("*")
      .order("created_at", { ascending: true });

    categoriesCache = (!error && data) ? data : [];

    // Fill the product form's category dropdown
    productCategorySelect.innerHTML = categoriesCache
      .map(function (c) { return `<option value="${c.id}">${escapeHTML(c.name)}</option>`; })
      .join("");

    // Render the categories table
    categoriesBody.innerHTML = "";
    if (categoriesCache.length === 0) {
      categoriesEmpty.classList.remove("hidden");
      return;
    }
    categoriesEmpty.classList.add("hidden");

    categoriesCache.forEach(function (c) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${c.image ? `<img class="prod-thumb" src="${c.image}" alt="">` : "-"}</td>
        <td>${escapeHTML(c.name)}</td>
        <td><button class="icon-btn danger" data-delete-category="${c.id}">حذف</button></td>
      `;
      categoriesBody.appendChild(row);
    });

    document.querySelectorAll("[data-delete-category]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("حذف القسم؟ المنتجات المرتبطة به لن تُحذف لكنها ستختفي من الموقع حتى تغيّر قسمها.")) return;
        await supabaseClient.from("categories").delete().eq("id", btn.dataset.deleteCategory);
        loadCategories().then(loadProducts);
      });
    });
  }

  document.getElementById("addCategoryBtn").addEventListener("click", function () {
    categoryForm.reset();
    categoryModal.classList.remove("hidden");
  });

  document.getElementById("cancelCategoryBtn").addEventListener("click", function () {
    categoryModal.classList.add("hidden");
  });

  categoryModal.addEventListener("click", function (e) {
    if (e.target === categoryModal) categoryModal.classList.add("hidden");
  });

  categoryForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = document.getElementById("categoryName").value.trim();
    const image = document.getElementById("categoryImage").value.trim();
    if (!name) return;

    await supabaseClient.from("categories").insert({ name: name, image: image || null });

    categoryModal.classList.add("hidden");
    loadCategories();
  });

  function categoryName(id) {
    const cat = categoriesCache.find(function (c) { return c.id === id; });
    return cat ? cat.name : id;
  }

  // ---------- PRODUCTS ----------
  const productsBody = document.getElementById("productsBody");
  const productsEmpty = document.getElementById("productsEmpty");
  const productModal = document.getElementById("productModal");
  const productForm = document.getElementById("productForm");
  const productModalTitle = document.getElementById("productModalTitle");

  async function loadProducts() {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    productsBody.innerHTML = "";

    if (error || !data || data.length === 0) {
      productsEmpty.classList.remove("hidden");
      return;
    }
    productsEmpty.classList.add("hidden");

    data.forEach(function (p) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p.image ? `<img class="prod-thumb" src="${p.image}" alt="">` : "-"}</td>
        <td>${escapeHTML(p.name)}</td>
        <td>${escapeHTML(categoryName(p.category))}</td>
        <td>${Number(p.price).toLocaleString()} EGP</td>
        <td>
          <button class="icon-btn" data-edit='${JSON.stringify(p).replace(/'/g, "&apos;")}'>تعديل</button>
          <button class="icon-btn danger" data-delete-product="${p.id}">حذف</button>
        </td>
      `;
      productsBody.appendChild(row);
    });

    document.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const p = JSON.parse(btn.getAttribute("data-edit"));
        openProductModal(p);
      });
    });

    document.querySelectorAll("[data-delete-product]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (!confirm("حذف المنتج؟")) return;
        await supabaseClient.from("products").delete().eq("id", btn.dataset.deleteProduct);
        loadProducts();
      });
    });
  }

  function openProductModal(p) {
    productModalTitle.textContent = p ? "تعديل المنتج" : "منتج جديد";
    document.getElementById("productId").value = p ? p.id : "";
    document.getElementById("productName").value = p ? p.name : "";
    document.getElementById("productCategory").value = p ? p.category : (categoriesCache[0] ? categoriesCache[0].id : "");
    document.getElementById("productPrice").value = p ? p.price : "";
    document.getElementById("productImage").value = p ? p.image || "" : "";
    productModal.classList.remove("hidden");
  }

  document.getElementById("addProductBtn").addEventListener("click", function () {
    if (categoriesCache.length === 0) {
      alert("أضف قسم واحد على الأقل من تبويب \"الأقسام\" قبل إضافة منتج.");
      return;
    }
    openProductModal(null);
  });
  document.getElementById("cancelProductBtn").addEventListener("click", function () {
    productModal.classList.add("hidden");
  });

  productForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const id = document.getElementById("productId").value;
    const payload = {
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value,
      price: Number(document.getElementById("productPrice").value),
      image: document.getElementById("productImage").value.trim()
    };

    if (id) {
      await supabaseClient.from("products").update(payload).eq("id", id);
    } else {
      await supabaseClient.from("products").insert(payload);
    }

    productModal.classList.add("hidden");
    loadProducts();
  });

  function escapeHTML(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  checkSession();
});
