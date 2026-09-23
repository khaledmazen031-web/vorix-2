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
    loadMusicSetting();
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

  // ---------- SITE SETTINGS (MUSIC PLAYLIST) ----------
  // Stored in settings(id = "site").music_url as a JSON string:
  // { v: 2, mode: "single" | "sequence" | "shuffle", current: "<track id>",
  //   tracks: [{ id, title, url }, ...] }   (max 4 tracks)
  // An old plain-URL value is still understood and shown as a single track.
  const MAX_TRACKS = 4;
  const musicSettingsForm = document.getElementById("musicSettingsForm");
  const musicListEl = document.getElementById("musicList");
  const musicListEmpty = document.getElementById("musicListEmpty");
  const musicCountEl = document.getElementById("musicCount");
  const addMusicBtn = document.getElementById("addMusicBtn");
  const musicFileInput = document.getElementById("musicFileInput");
  const musicFileMsg = document.getElementById("musicFileMsg");
  const musicSettingsMsg = document.getElementById("musicSettingsMsg");
  const musicModeRadios = musicSettingsForm.querySelectorAll('input[name="musicMode"]');
  const musicSaveBtn = musicSettingsForm.querySelector('button[type="submit"]');

  let musicState = { mode: "single", current: null, tracks: [] };

  function setMusicMsg(el, text, ok) {
    el.style.color = ok ? "var(--success)" : "var(--danger)";
    el.textContent = text || "";
  }

  function newTrackId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function parseMusicConfig(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.charAt(0) === "{") {
      try {
        const cfg = JSON.parse(s);
        if (cfg && Array.isArray(cfg.tracks)) {
          const tracks = cfg.tracks
            .filter(function (t) { return t && t.url; })
            .slice(0, MAX_TRACKS)
            .map(function (t) {
              return { id: t.id || newTrackId(), title: t.title || "أغنية", url: t.url };
            });
          const mode = ["single", "sequence", "shuffle"].indexOf(cfg.mode) !== -1 ? cfg.mode : "single";
          return { mode: mode, current: cfg.current, tracks: tracks };
        }
      } catch (e) { /* fall through */ }
      return null;
    }
    // legacy: a single plain URL
    const id = newTrackId();
    return { mode: "single", current: id, tracks: [{ id: id, title: "الأغنية الحالية", url: s }] };
  }

  function makeIconBtn(label, title, extraClass) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn " + (extraClass || "");
    b.textContent = label;
    b.title = title;
    return b;
  }

  function moveTrack(from, to) {
    const t = musicState.tracks;
    if (to < 0 || to >= t.length) return;
    const item = t.splice(from, 1)[0];
    t.splice(to, 0, item);
    renderMusicList();
  }

  function removeTrack(index) {
    musicState.tracks.splice(index, 1);
    renderMusicList();
    setMusicMsg(musicSettingsMsg, "اضغط حفظ لتطبيق التغييرات.", true);
  }

  function renderMusicList() {
    const tracks = musicState.tracks;

    if (!tracks.some(function (t) { return t.id === musicState.current; })) {
      musicState.current = tracks.length ? tracks[0].id : null;
    }

    musicSettingsForm.dataset.mode = musicState.mode;
    musicModeRadios.forEach(function (r) { r.checked = r.value === musicState.mode; });
    musicCountEl.textContent = tracks.length;
    musicListEmpty.classList.toggle("hidden", tracks.length > 0);
    addMusicBtn.disabled = tracks.length >= MAX_TRACKS;
    addMusicBtn.textContent = tracks.length >= MAX_TRACKS ? "وصلت للحد الأقصى (4 أغاني)" : "+ إضافة أغنية";

    musicListEl.innerHTML = "";
    tracks.forEach(function (track, i) {
      const li = document.createElement("li");
      li.className = "music-item";

      const top = document.createElement("div");
      top.className = "music-item-top";

      const num = document.createElement("span");
      num.className = "music-num";
      num.textContent = i + 1;

      const title = document.createElement("input");
      title.type = "text";
      title.className = "music-title";
      title.maxLength = 60;
      title.value = track.title;
      title.placeholder = "اسم الأغنية";
      title.addEventListener("input", function () { track.title = title.value; });

      const actions = document.createElement("div");
      actions.className = "music-actions";

      const up = makeIconBtn("↑", "تحريك لأعلى", "music-move");
      up.disabled = i === 0;
      up.addEventListener("click", function () { moveTrack(i, i - 1); });

      const down = makeIconBtn("↓", "تحريك لأسفل", "music-move");
      down.disabled = i === tracks.length - 1;
      down.addEventListener("click", function () { moveTrack(i, i + 1); });

      const del = makeIconBtn("✕", "حذف الأغنية", "danger");
      del.addEventListener("click", function () { removeTrack(i); });

      actions.append(up, down, del);
      top.append(num, title, actions);

      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = track.url;
      audio.addEventListener("play", function () {
        musicListEl.querySelectorAll("audio").forEach(function (a) {
          if (a !== audio) a.pause();
        });
      });

      const pick = document.createElement("label");
      pick.className = "music-pick";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "musicCurrent";
      radio.checked = track.id === musicState.current;
      radio.addEventListener("change", function () { musicState.current = track.id; });
      const pickText = document.createElement("span");
      pickText.textContent = "دي الأغنية اللي تشتغل في الموقع";
      pick.append(radio, pickText);

      li.append(top, audio, pick);
      musicListEl.appendChild(li);
    });
  }

  async function loadMusicSetting() {
    const { data, error } = await supabaseClient
      .from("settings")
      .select("music_url")
      .eq("id", "site")
      .single();

    const cfg = !error && data ? parseMusicConfig(data.music_url) : null;
    musicState = cfg || { mode: "single", current: null, tracks: [] };
    renderMusicList();
  }

  musicModeRadios.forEach(function (r) {
    r.addEventListener("change", function () {
      if (!r.checked) return;
      musicState.mode = r.value;
      musicSettingsForm.dataset.mode = r.value;
    });
  });

  addMusicBtn.addEventListener("click", function () { musicFileInput.click(); });

  musicFileInput.addEventListener("change", async function () {
    const files = Array.from(this.files || []);
    this.value = "";
    if (!files.length) return;

    setMusicMsg(musicFileMsg, "", true);
    setMusicMsg(musicSettingsMsg, "", true);

    const slots = MAX_TRACKS - musicState.tracks.length;
    const toUpload = files.slice(0, Math.max(slots, 0));
    if (!toUpload.length) {
      setMusicMsg(musicFileMsg, "الحد الأقصى 4 أغاني. احذف أغنية الأول.", false);
      return;
    }

    addMusicBtn.disabled = true;
    musicSaveBtn.disabled = true;
    let added = 0;

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      setMusicMsg(musicFileMsg, "جاري رفع الأغنية " + (i + 1) + " من " + toUpload.length + "...", true);

      const ext = (file.name.split(".").pop() || "mp3").replace(/[^a-z0-9]/gi, "") || "mp3";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from("site-music")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Music upload error:", uploadError);
        setMusicMsg(musicFileMsg, "فشل رفع \"" + file.name + "\": " + (uploadError.message || "خطأ غير معروف"), false);
        break;
      }

      const { data: publicUrlData } = supabaseClient
        .storage
        .from("site-music")
        .getPublicUrl(fileName);

      musicState.tracks.push({
        id: newTrackId(),
        title: file.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim().slice(0, 60) || "أغنية",
        url: publicUrlData.publicUrl
      });
      added++;
    }

    musicSaveBtn.disabled = false;
    renderMusicList();

    if (added > 0) {
      let msg = "تم رفع " + added + " أغنية. اضغط حفظ لتطبيق التغييرات.";
      if (files.length > toUpload.length) msg += " (الباقي اتجاهل لأن الحد الأقصى 4 أغاني)";
      setMusicMsg(musicFileMsg, "", true);
      setMusicMsg(musicSettingsMsg, msg, true);
    }
  });

  musicSettingsForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    setMusicMsg(musicSettingsMsg, "", true);
    setMusicMsg(musicFileMsg, "", true);

    if (!musicState.tracks.length) {
      setMusicMsg(musicFileMsg, "أضف أغنية واحدة على الأقل.", false);
      return;
    }

    const checkedMode = musicSettingsForm.querySelector('input[name="musicMode"]:checked');
    const config = {
      v: 2,
      mode: checkedMode ? checkedMode.value : musicState.mode,
      current: musicState.current,
      tracks: musicState.tracks.map(function (t) {
        return { id: t.id, title: (t.title || "").trim() || "أغنية", url: t.url };
      })
    };

    musicSaveBtn.disabled = true;
    const { error } = await supabaseClient
      .from("settings")
      .upsert({ id: "site", music_url: JSON.stringify(config) });
    musicSaveBtn.disabled = false;

    if (error) {
      console.error("Music settings save error:", error);
      setMusicMsg(musicSettingsMsg, "حصل خطأ أثناء الحفظ: " + (error.message || ""), false);
    } else {
      setMusicMsg(musicSettingsMsg, "تم حفظ إعدادات الموسيقى بنجاح.", true);
    }
  });

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
        .map(function (it) { return `${it.name} x${it.quantity}`; })
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
    document.getElementById("productImageFile").value = "";
    document.getElementById("productImageMsg").textContent = "";
    const preview = document.getElementById("productImagePreview");
    if (p && p.image) {
      preview.src = p.image;
      preview.classList.remove("hidden");
    } else {
      preview.src = "";
      preview.classList.add("hidden");
    }
    productModal.classList.remove("hidden");
  }

  document.getElementById("productImageFile").addEventListener("change", function () {
    const file = this.files[0];
    const preview = document.getElementById("productImagePreview");
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });

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
    const imageMsg = document.getElementById("productImageMsg");
    const submitBtn = productForm.querySelector('button[type="submit"]');
    const file = document.getElementById("productImageFile").files[0];
    let imageUrl = document.getElementById("productImage").value;

    if (file) {
      submitBtn.disabled = true;
      submitBtn.textContent = "جاري رفع الصورة...";
      imageMsg.style.color = "var(--gray)";
      imageMsg.textContent = "";

      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) {
        console.error("Image upload error:", uploadError);
        imageMsg.style.color = "var(--danger)";
        imageMsg.textContent = "فشل رفع الصورة: " + (uploadError.message || uploadError.error || "خطأ غير معروف");
        submitBtn.disabled = false;
        submitBtn.textContent = "حفظ";
        return;
      }

      const { data: publicUrlData } = supabaseClient
        .storage
        .from("product-images")
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
      submitBtn.textContent = "حفظ";
      submitBtn.disabled = false;
    }

    const payload = {
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value,
      price: Number(document.getElementById("productPrice").value),
      image: imageUrl
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
