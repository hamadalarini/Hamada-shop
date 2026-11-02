(() => {
  const cfg = window.HAMADA_CONFIG || {};
  const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT")
    && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  const supabase = ready && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  let language = "ar";
  let selectedCategory = "all";
  let allProducts = [];

  const $ = (s) => document.querySelector(s);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));

  function applyLanguage() {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-ar][data-fr]").forEach(el => {
      el.textContent = el.dataset[language];
    });
    $("#langToggle").textContent = language === "ar" ? "Français" : "العربية";
    renderProducts();
  }

  function formatPrice(price) {
    const n = Number(price);
    return Number.isFinite(n) ? `${n.toFixed(2)} ${cfg.CURRENCY || "DH"}` : "";
  }

  function productName(p) {
    return language === "fr" && p.name_fr ? p.name_fr : p.name;
  }

  function renderProducts() {
    const grid = $("#productsGrid");
    if (!grid) return;
    const list = allProducts.filter(p =>
      selectedCategory === "all" || p.category === selectedCategory
    );
    $("#productCount").textContent = `${list.length}`;
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">${language === "ar" ? "لا توجد منتجات في هذه الفئة حالياً." : "Aucun produit dans cette catégorie pour le moment."}</div>`;
      return;
    }
    grid.innerHTML = list.map(p => {
      const name = escapeHtml(productName(p));
      const desc = escapeHtml(language === "fr" && p.description_fr ? p.description_fr : (p.description || ""));
      const img = p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${name}" loading="lazy">` : `<div class="image-placeholder">H</div>`;
      const message = language === "ar"
        ? `السلام عليكم، أريد طلب: ${productName(p)} — الثمن: ${p.price} DH`
        : `Bonjour, je souhaite commander : ${productName(p)} — Prix : ${p.price} DH`;
      const wa = `https://wa.me/${encodeURIComponent(cfg.WHATSAPP_NUMBER || "212766445061")}?text=${encodeURIComponent(message)}`;
      return `<article class="product-card"><div class="product-image">${img}</div><div class="product-info"><h3>${name}</h3><p>${desc}</p><div class="product-bottom"><strong>${formatPrice(p.price)}</strong><a class="button small gold-button" target="_blank" rel="noopener" href="${wa}">${language === "ar" ? "اطلب عبر واتساب" : "Commander"}</a></div></div></article>`;
    }).join("");
  }

  async function loadProducts() {
    if (!supabase) {
      $("#productsGrid").innerHTML = `<div class="empty-state">${language === "ar" ? "أكمل إعدادات Supabase داخل ملف config.js، ثم أعد نشر الموقع." : "Configurez Supabase dans config.js puis republiez le site."}</div>`;
      return;
    }
    const { data, error } = await supabase.from("products")
      .select("*").eq("is_active", true).order("created_at", { ascending: false });
    if (error) {
      $("#productsGrid").innerHTML = `<div class="empty-state">${language === "ar" ? "تعذر تحميل المنتجات. تحقق من أسماء الأعمدة وسياسات الوصول في Supabase." : "Impossible de charger les produits. Vérifiez les colonnes et les règles d'accès Supabase."}</div>`;
      console.error(error);
      return;
    }
    allProducts = data || [];
    renderProducts();
  }

  $("#langToggle").addEventListener("click", () => {
    language = language === "ar" ? "fr" : "ar";
    applyLanguage();
  });
  document.querySelectorAll(".category-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".category-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedCategory = btn.dataset.category;
      renderProducts();
    });
  });
  $("#year").textContent = new Date().getFullYear();
  applyLanguage();
  loadProducts();
})();
