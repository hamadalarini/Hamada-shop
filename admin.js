
(() => {
  const cfg = window.HAMADA_CONFIG || {};

  const configured =
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const client = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const $ = s => document.querySelector(s);
  const loginPanel = $("#loginPanel");
  const dashboard = $("#dashboard");

  const msg = (selector, text, bad = false) => {
    const el = $(selector);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("error", bad);
  };

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])
  );

  const statuses = ["جديد", "قيد المعالجة", "مكتمل", "ملغي"];

  async function isAdmin(user) {
    if (!user || !client) return false;

    const { data, error } = await client.from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    return !error && !!data;
  }

  async function refreshSession() {
    if (!client) {
      msg("#loginMessage", "تحقق من إعدادات config.js.", true);
      return;
    }

    const { data } = await client.auth.getSession();
    const user = data.session?.user;

    if (user && await isAdmin(user)) {
      showDashboard();
    } else {
      loginPanel.classList.remove("hidden");
      dashboard.classList.add("hidden");
    }
  }

  function showDashboard() {
    loginPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadAdminProducts();
    loadAdminOrders();
  }

  $("#loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    if (!client) {
      return msg("#loginMessage", "تحقق من إعدادات config.js.", true);
    }

    msg("#loginMessage", "جارٍ تسجيل الدخول...");

    const { data, error } = await client.auth.signInWithPassword({
      email: $("#email").value.trim(),
      password: $("#password").value
    });

    if (error) return msg("#loginMessage", error.message, true);

    if (!await isAdmin(data.user)) {
      await client.auth.signOut();
      return msg("#loginMessage", "هذا الحساب غير موجود في قائمة admin_users.", true);
    }

    msg("#loginMessage", "");
    showDashboard();
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    await client.auth.signOut();
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  });

  // تحميل الطلبات
  async function loadAdminOrders() {
    const box = $("#adminOrders");
    if (!box || !client) return;

    box.textContent = "جارٍ تحميل الطلبات...";
    msg("#ordersMessage", "");

    const { data, error } = await client.from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      box.textContent = "تعذر تحميل الطلبات: " + error.message;
      msg("#ordersMessage", error.message, true);
      return;
    }

    if (!data?.length) {
      box.textContent = "لا توجد طلبات حالياً.";
      return;
    }

    box.innerHTML = data.map(order => `
      <article class="panel">
        <h3>طلب رقم ${esc(order.id)}</h3>
        <p><strong>الزبون:</strong> ${esc(order.customer_name)}</p>
        <p><strong>الهاتف:</strong> ${esc(order.phone)}</p>
        <p><strong>المدينة:</strong> ${esc(order.city)}</p>
        <p><strong>العنوان:</strong> ${esc(order.address)}</p>
        <p><strong>المنتج:</strong> ${esc(order.product_name)}</p>
        <p><strong>المقاس:</strong> ${esc(order.size)}</p>
        <p><strong>اللون:</strong> ${esc(order.color)}</p>
        <p><strong>الكمية:</strong> ${esc(order.quantity)}</p>
        <p><strong>سعر القطعة:</strong> ${esc(order.unit_price)} درهم</p>
        <p><strong>الإجمالي:</strong>
          ${esc(Number(order.unit_price || 0) * Number(order.quantity || 0))} درهم
        </p>
        <p><strong>ملاحظات:</strong> ${esc(order.notes)}</p>
        <p><strong>التاريخ:</strong>
          ${esc(order.created_at ? new Date(order.created_at).toLocaleString("ar-MA") : "")}
        </p>

        <label>
          حالة الطلب:
          <select class="order-status" data-order-id="${esc(order.id)}">
            ${statuses.map(status => `
              <option value="${esc(status)}"
                ${order.status === status ? "selected" : ""}>
                ${esc(status)}
              </option>
            `).join("")}
          </select>
        </label>

        <button class="button gold-button save-order-status"
          type="button" data-order-id="${esc(order.id)}">
          حفظ الحالة
        </button>

        <button class="button print-order"
          type="button" data-order-id="${esc(order.id)}">
          طباعة الفاتورة
        </button>

        <p class="order-status-message"
          data-message-id="${esc(order.id)}"></p>
      </article>
    `).join("");

    box.querySelectorAll(".save-order-status").forEach(button => {
      button.addEventListener("click", () =>
        updateOrderStatus(button.dataset.orderId)
      );
    });

    box.querySelectorAll(".print-order").forEach(button => {
      button.addEventListener("click", () => {
        const order = data.find(
          item => String(item.id) === String(button.dataset.orderId)
        );
        if (order) printInvoice(order);
      });
    });
  }

  // طباعة الفاتورة
  function printInvoice(order) {
    const total =
      Number(order.unit_price || 0) * Number(order.quantity || 0);

    const date = order.created_at
      ? new Date(order.created_at).toLocaleString("ar-MA")
      : "";

    const w = window.open("", "_blank");

    if (!w) {
      alert("تعذر فتح الفاتورة. اسمح بالنوافذ المنبثقة في المتصفح.");
      return;
    }

    w.document.open();
    w.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>فاتورة Hamada Shop</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            padding: 20px;
            color: #222;
          }
          .invoice {
            max-width: 700px;
            margin: auto;
            border: 2px solid #c5a34a;
            padding: 25px;
          }
          h1, h2 { text-align: center; }
          h1 { color: #b18b2e; }
          .line {
            border-bottom: 1px solid #ddd;
            padding: 10px 0;
          }
          .total {
            font-size: 22px;
            font-weight: bold;
            color: #9a7623;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 35px;
          }
          button {
            display: block;
            margin: 20px auto;
            padding: 12px 25px;
            background: #c5a34a;
            border: 0;
            font-size: 16px;
          }
          @media print {
            button { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice">
          <h1>Hamada Shop</h1>
          <h2>فاتورة طلب</h2>
          <div class="line"><strong>رقم الطلب:</strong> ${esc(order.id)}</div>
          <div class="line"><strong>التاريخ:</strong> ${esc(date)}</div>
          <div class="line"><strong>الزبون:</strong> ${esc(order.customer_name)}</div>
          <div class="line"><strong>الهاتف:</strong> ${esc(order.phone)}</div>
          <div class="line"><strong>المدينة:</strong> ${esc(order.city)}</div>
          <div class="line"><strong>العنوان:</strong> ${esc(order.address)}</div>
          <div class="line"><strong>المنتج:</strong> ${esc(order.product_name)}</div>
          <div class="line"><strong>المقاس:</strong> ${esc(order.size)}</div>
          <div class="line"><strong>اللون:</strong> ${esc(order.color)}</div>
          <div class="line"><strong>الكمية:</strong> ${esc(order.quantity)}</div>
          <div class="line"><strong>سعر القطعة:</strong> ${esc(order.unit_price)} درهم</div>
          <div class="line"><strong>الحالة:</strong> ${esc(order.status)}</div>
          <div class="line"><strong>ملاحظات:</strong> ${esc(order.notes)}</div>
          <div class="total">الإجمالي: ${esc(total)} درهم</div>
          <div class="footer">شكراً لثقتكم في Hamada Shop</div>
        </div>
        <button onclick="window.print()">طباعة الفاتورة</button>
      </body>
      </html>
    `);
    w.document.close();
  }

  // حفظ حالة الطلب
  async function updateOrderStatus(id) {
    const select = document.querySelector(
      `.order-status[data-order-id="${CSS.escape(String(id))}"]`
    );

    const message = document.querySelector(
      `.order-status-message[data-message-id="${CSS.escape(String(id))}"]`
    );

    if (!select || !message) return;

    message.textContent = "جارٍ حفظ الحالة...";

    const { data, error } = await client.from("orders")
      .update({ status: select.value })
      .eq("id", id)
      .select("id, status");

    if (error) {
      message.textContent = "فشل الحفظ: " + error.message;
      return;
    }

    message.textContent = data?.length
      ? "تم حفظ حالة الطلب بنجاح."
      : "لم يتم تحديث الطلب. تحقق من صلاحيات الإدارة.";
  }

  $("#refreshOrders")?.addEventListener("click", loadAdminOrders);

  // تحميل المنتجات
  async function loadAdminProducts() {
    const box = $("#adminProducts");
    if (!box || !client) return;

    const { data, error } = await client.from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      box.textContent = "تعذر تحميل المنتجات: " + error.message;
      return;
    }

    if (!data?.length) {
      box.textContent = "لا توجد منتجات بعد.";
      return;
    }

    box.innerHTML = data.map(p => `
      <div class="admin-product">
        <div>
          <strong>${esc(p.name)}</strong>
          <small>
            ${esc(p.category)} · ${Number(p.price).toFixed(2)} DH ·
            ${p.is_active ? "ظاهر" : "مخفي"}
          </small>
        </div>
        <button class="button small" data-edit="${esc(p.id)}">تعديل</button>
        <button class="button danger small" data-delete="${esc(p.id)}">حذف</button>
      </div>
    `).join("");

    box.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () =>
        editProduct(btn.dataset.edit, data)
      );
    });

    box.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () =>
        deleteProduct(btn.dataset.delete)
      );
    });
  }

  async function editProduct(id, products) {
    const p = products.find(item => String(item.id) === String(id));
    if (!p) return;

    const name = prompt("اسم المنتج بالعربية:", p.name || "");
    if (name === null) return;

    const name_fr = prompt("اسم المنتج بالفرنسية:", p.name_fr || "");
    if (name_fr === null) return;

    const priceText = prompt("السعر بالدرهم:", p.price);
    if (priceText === null) return;

    const price = Number(priceText);
    if (!Number.isFinite(price) || price < 0) {
      alert("يرجى إدخال سعر صحيح.");
      return;
    }

    const category = prompt("الفئة:", p.category || "");
    if (category === null) return;

    const image_url = prompt("رابط الصورة:", p.image_url || "");
    if (image_url === null) return;

    const description = prompt("الوصف بالعربية:", p.description || "");
    if (description === null) return;

    const description_fr = prompt("الوصف بالفرنسية:", p.description_fr || "");
    if (description_fr === null) return;

    const { error } = await client.from("products").update({
      name: name.trim(),
      name_fr: name_fr.trim() || null,
      price,
      category: category.trim(),
      image_url: image_url.trim() || null,
      description: description.trim() || null,
      description_fr: description_fr.trim() || null
    }).eq("id", id);

    if (error) {
      alert("تعذر تعديل المنتج: " + error.message);
      return;
    }

    alert("تم تعديل المنتج بنجاح.");
    loadAdminProducts();
  }

  $("#productForm")?.addEventListener("submit", async e => {
    e.preventDefault();

    const payload = {
      name: $("#name").value.trim(),
      name_fr: $("#name_fr").value.trim() || null,
      price: Number($("#price").value),
      category: $("#category").value,
      image_url: $("#image_url").value.trim() || null,
      description: $("#description").value.trim() || null,
      description_fr: $("#description_fr").value.trim() || null,
      is_active: true
    };

    const { error } = await client.from("products").insert(payload);

    if (error) {
      return msg("#productMessage", error.message, true);
    }

    e.target.reset();
    msg("#productMessage", "تمت إضافة المنتج.");
    loadAdminProducts();
  });

  async function deleteProduct(id) {
    if (!confirm("هل تريد حذف هذا المنتج؟")) return;

    const { error } = await client.from("products")
      .delete()
      .eq("id", id);

    if (error) {
      alert("تعذر الحذف: " + error.message);
      return;
    }

    loadAdminProducts();
  }

  refreshSession();
})();
