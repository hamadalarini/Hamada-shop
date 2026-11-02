
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

  function showOrderForm(product) {
    document.querySelector("#orderModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "orderModal";
    modal.style.cssText = "position:fixed;inset:0;background:#0009;z-index:99999;display:flex;align-items:center;justify-content:center;padding:15px;overflow:auto;";

    modal.innerHTML = `
      <div style="background:white;color:#222;width:100%;max-width:480px;padding:22px;border-radius:14px;max-height:90vh;overflow:auto;">
        <h2>${language === "ar" ? "إتمام الطلب" : "Finaliser la commande"}</h2>
        <p><strong>${escapeHtml(productName(product))}</strong></p>
        <p>${language === "ar" ? "السعر:" : "Prix :"} ${formatPrice(product.price)}</p>

        <form id="customerOrderForm">
          <label>${language === "ar" ? "الاسم الكامل" : "Nom complet"}</label>
          <input name="customer_name" required maxlength="120" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px">

          <label>${language === "ar" ? "رقم الهاتف" : "Téléphone"}</label>
          <input name="phone" type="tel" required maxlength="30" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px">

          <label>${language === "ar" ? "المدينة" : "Ville"}</label>
          <input name="city" required maxlength="100" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px">

          <label>${language === "ar" ? "العنوان بالتفصيل" : "Adresse détaillée"}</label>
          <textarea name="address" required maxlength="500" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px"></textarea>

          <label>${language === "ar" ? "المقاس" : "Taille"}</label>
          <input name="size" maxlength="50" placeholder="مثلاً: 4 سنوات" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px">

          <label>${language === "ar" ? "اللون" : "Couleur"}</label>
          <input name="color" maxlength="50" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px">

          <label>${language === "ar" ? "الكمية" : "Quantité"}</label>
          <input name="quantity" type="number" min="1" max="20" value="1" required style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px">

          <label>${language === "ar" ? "ملاحظات إضافية" : "Remarques"}</label>
          <textarea name="notes" maxlength="500" style="width:100%;box-sizing:border-box;padding:12px;margin:7px 0 14px"></textarea>

          <p><strong>${language === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}</strong></p>

          <button type="submit" style="width:100%;padding:14px;background:#b58a42;color:white;border:0;border-radius:8px;font-size:16px;cursor:pointer">
            ${language === "ar" ? "تأكيد الطلب" : "Confirmer la commande"}
          </button>

          <button type="button" id="closeOrder" style="width:100%;padding:12px;margin-top:8px;border:0;background:#eee;border-radius:8px;cursor:pointer">
            ${language === "ar" ? "إلغاء" : "Annuler"}
          </button>
          <p id="orderMessage" role="status"></p>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    $("#closeOrder").addEventListener("click", () => modal.remove());

    modal.addEventListener("click", event => {
      if (event.target === modal) modal.remove();
    });

    $("#customerOrderForm").addEventListener("submit", async event => {
      event.preventDefault();

      const form = event.currentTarget;
      const message = $("#orderMessage");
      const submit = form.querySelector('button[type="submit"]');
      const values = new FormData(form);
      const quantity = Number(values.get("quantity"));
      const price = Number(product.price);

      if (!supabase) {
        message.textContent = language === "ar"
          ? "تعذر الاتصال بقاعدة البيانات."
          : "Connexion à la base de données impossible.";
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isFinite(price) || price < 0) {
        message.textContent = language === "ar" ? "تحقق من الكمية والسعر." : "Vérifiez la quantité et le prix.";
        return;
      }

      const order = {
        customer_name: String(values.get("customer_name")).trim(),
        phone: String(values.get("phone")).trim(),
        city: String(values.get("city")).trim(),
        address: String(values.get("address")).trim(),
        product_name: productName(product),
        size: String(values.get("size") || "").trim(),
        color: String(values.get("color") || "").trim(),
        quantity,
        unit_price: price,
        notes: String(values.get("notes") || "").trim(),
        status: "جديد"
      };

      if (!order.customer_name || !order.phone || !order.city || !order.address) {
        message.textContent = language === "ar" ? "يرجى ملء المعلومات المطلوبة." : "Veuillez remplir les champs obligatoires.";
        return;
      }

      submit.disabled = true;
      submit.textContent = language === "ar" ? "جارٍ إرسال الطلب..." : "Envoi...";

      try {
        const { error } = await supabase.from("orders").insert([order]);
        if (error) throw error;

        form.innerHTML = `
          <h3 style="color:green">${language === "ar" ? "تم استلام طلبك بنجاح!" : "Votre commande est reçue !"}</h3>
          <p>${language === "ar" ? "سنتواصل معك لتأكيد الطلب. الدفع عند الاستلام." : "Nous vous contacterons pour confirmer. Paiement à la livraison."}</p>
          <button type="button" id="finishOrder" style="width:100%;padding:13px;background:#b58a42;color:white;border:0;border-radius:8px">
            ${language === "ar" ? "إغلاق" : "Fermer"}
          </button>
        `;
        $("#finishOrder").addEventListener("click", () => modal.remove());
      } catch (error) {
        console.error(error);
        message.textContent = language === "ar"
          ? "لم يتم إرسال الطلب. تحقق من إعدادات Supabase وحاول مجددًا."
          : "Commande non envoyée. Vérifiez Supabase et réessayez.";
        submit.disabled = false;
        submit.textContent = language === "ar" ? "تأكيد الطلب" : "Confirmer la commande";
      }
    });
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

    grid.innerHTML = list.map((p, index) => {
      const name = escapeHtml(productName(p));
      const desc = escapeHtml(language === "fr" && p.description_fr ? p.description_fr : (p.description || ""));
      const img = p.image_url
        ? `<img src="${escapeHtml(p.image_url)}" alt="${name}" loading="lazy">`
        : `<div class="image-placeholder">H</div>`;

      return `
        <article class="product-card">
          <div class="product-image">${img}</div>
          <div class="product-info">
            <h3>${name}</h3>
            <p>${desc}</p>
            <div class="product-bottom">
              <strong>${formatPrice(p.price)}</strong>
              <button type="button" class="button small gold-button buy-button" data-index="${index}">
                ${language === "ar" ? "شراء الآن" : "Acheter"}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll(".buy-button").forEach(button => {
      button.addEventListener("click", () => {
        const product = list[Number(button.dataset.index)];
        if (product) showOrderForm(product);
      });
    });
  }

  async function loadProducts() {
    if (!supabase) {
      $("#productsGrid").innerHTML = `<div class="empty-state">${language === "ar" ? "أكمل إعدادات Supabase داخل ملف config.js، ثم أعد نشر الموقع." : "Configurez Supabase dans config.js puis republiez le site."}</div>`;
      return;
    }

    const { data, error } = await supabase.from("products")
      .select("*").eq("is_active", true).order("created_at", { ascending: false });

    if (error) {
      $("#productsGrid").innerHTML = `<div class="empty-state">${language === "ar" ? "تعذر تحميل المنتجات. تحقق من إعدادات Supabase." : "Impossible de charger les produits."}</div>`;
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
