const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let editingProductId = null;

function toast(msg, isError = false) {
  const el = document.createElement("div");
  el.className = `toast${isError ? " err" : ""}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(data?.error || r.statusText || "Istek basarisiz");
    err.status = r.status;
    throw err;
  }
  return data;
}

function showLogin() {
  $(".login-gate").style.display = "grid";
  $(".app").classList.remove("is-visible");
}

function showApp() {
  $(".login-gate").style.display = "none";
  $(".app").classList.add("is-visible");
}

function setSection(name) {
  $$(".nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.section === name));
  $("#section-products").classList.toggle("section-hidden", name !== "products");
  $("#section-categories").classList.toggle("section-hidden", name !== "categories");
}

async function loadCategoriesForSelect() {
  const data = await api("/api/categories");
  const sel = $("#pCategory");
  const current = sel.value;
  sel.innerHTML = '<option value="">Kategori secin</option>';
  data.items.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.slug;
    o.textContent = `${c.name} (${c.slug})`;
    sel.appendChild(o);
  });
  if (current) sel.value = current;
}

async function refreshCategoryTable() {
  const data = await api("/api/admin/categories");
  const tbody = $("#categoryRows");
  tbody.innerHTML = "";
  data.items.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.id}</td>
      <td><span class="badge">${c.slug}</span></td>
      <td>${c.name}</td>
      <td>${c.sort_order}</td>
      <td><button type="button" class="btn-danger" data-del-cat="${c.id}">Sil</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("[data-del-cat]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Bu kategoriyi silmek istediginize emin misiniz?")) return;
      await api(`/api/admin/categories/${btn.dataset.delCat}`, { method: "DELETE" });
      toast("Kategori silindi");
      await loadCategoriesForSelect();
      await refreshCategoryTable();
    });
  });
}

async function refreshProductTable() {
  const data = await api("/api/admin/products");
  const tbody = $("#productRows");
  tbody.innerHTML = "";
  data.items.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${p.category_slug}</td>
      <td>${p.gram}</td>
      <td>${p.is_active ? "Aktif" : "Pasif"}</td>
      <td>
        <button type="button" class="btn-ghost" data-edit="${p.id}" style="height:36px;padding:0 0.75rem;font-size:0.82rem;">Duzenle</button>
        <button type="button" class="btn-danger" data-del="${p.id}">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.edit);
      const { items } = await api("/api/admin/products");
      const p = items.find((x) => x.id === id);
      if (!p) return;
      editingProductId = p.id;
      $("#pName").value = p.name;
      $("#pSlug").value = p.slug;
      $("#pCategory").value = p.category_slug;
      $("#pGram").value = p.gram;
      $("#pImagePath").value = p.image_path || "";
      $("#pStlPath").value = p.stl_path || "";
      $("#pActive").checked = Boolean(p.is_active);
      $("#imagePathHint").textContent = p.image_path || "—";
      $("#stlPathHint").textContent = p.stl_path || "—";
      $("#productSubmit").textContent = "Guncelle";
      setSection("products");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast("Urun duzenleme modunda");
    });
  });

  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Bu urunu silmek istediginize emin misiniz?")) return;
      await api(`/api/admin/products/${btn.dataset.del}`, { method: "DELETE" });
      toast("Urun silindi");
      await refreshProductTable();
    });
  });
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/admin/upload", {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(data.error || "Yukleme basarisiz");
  return data.path;
}

function resetProductForm() {
  editingProductId = null;
  $("#productForm").reset();
  $("#pImagePath").value = "";
  $("#pStlPath").value = "";
  $("#imagePathHint").textContent = "Dosya secilmedi";
  $("#stlPathHint").textContent = "Dosya secilmedi";
  $("#productSubmit").textContent = "Urunu Kaydet";
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#password").value }),
    });
    showApp();
    await loadCategoriesForSelect();
    await refreshCategoryTable();
    await refreshProductTable();
    toast("Hos geldiniz");
  } catch (e) {
    toast("Sifre hatali veya baglanti sorunu", true);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    /* ignore */
  }
  showLogin();
  toast("Cikis yapildi");
});

$$(".nav-btn").forEach((b) => {
  b.addEventListener("click", () => setSection(b.dataset.section));
});

document.getElementById("addCatBtn").addEventListener("click", async () => {
  try {
    await api("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({
        slug: $("#catSlug").value.trim(),
        name: $("#catName").value.trim(),
        sort_order: Number($("#catOrder").value || 0),
      }),
    });
    $("#catSlug").value = "";
    $("#catName").value = "";
    $("#catOrder").value = "";
    toast("Kategori eklendi");
    await loadCategoriesForSelect();
    await refreshCategoryTable();
  } catch (e) {
    toast(e.message || "Kategori eklenemedi (slug benzersiz olmali)", true);
  }
});

document.getElementById("imageFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const path = await uploadFile(file);
    $("#pImagePath").value = path;
    $("#imagePathHint").textContent = path;
    $("#imagePathHint").classList.add("ok");
    toast("Gorsel yuklendi");
  } catch (err) {
    toast(err.message, true);
  }
  e.target.value = "";
});

document.getElementById("stlFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const path = await uploadFile(file);
    $("#pStlPath").value = path;
    $("#stlPathHint").textContent = path;
    $("#stlPathHint").classList.add("ok");
    toast("STL yuklendi");
  } catch (err) {
    toast(err.message, true);
  }
  e.target.value = "";
});

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    name: $("#pName").value.trim(),
    slug: $("#pSlug").value.trim(),
    category_slug: $("#pCategory").value,
    gram: Number($("#pGram").value),
    image_path: $("#pImagePath").value.trim(),
    stl_path: $("#pStlPath").value.trim(),
    is_active: $("#pActive").checked ? 1 : 0,
  };
  try {
    if (editingProductId) {
      await api(`/api/admin/products/${editingProductId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          slug: payload.slug,
          category_slug: payload.category_slug,
          gram: payload.gram,
          image_path: payload.image_path,
          stl_path: payload.stl_path,
          is_active: payload.is_active,
        }),
      });
      toast("Urun guncellendi");
    } else {
      await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast("Urun eklendi");
    }
    resetProductForm();
    await refreshProductTable();
  } catch (err) {
    toast(err.message || "Kayit basarisiz", true);
  }
});

document.getElementById("clearProductBtn").addEventListener("click", () => {
  resetProductForm();
});

setSection("products");
