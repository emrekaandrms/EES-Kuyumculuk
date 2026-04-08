const THEME_STORAGE_KEY = "ees-theme";
const MOBILE_GRID_STORAGE_KEY = "ees-mobile-grid";

const LIST_PAGE_SIZE = 16;
const HOME_LATEST_LIMIT = 8;
const QUICK_FILTERS = [
  { id: "under_10k", label: "10.000 TL altı", minPrice: "", maxPrice: "10000", minGram: "", maxGram: "" },
  { id: "under_1g", label: "1 gram altı", minPrice: "", maxPrice: "", minGram: "", maxGram: "0.99" },
  { id: "2g_products", label: "2 gram ürünler", minPrice: "", maxPrice: "", minGram: "2", maxGram: "2.99" },
  { id: "10k_25k", label: "10.000-25.000 TL", minPrice: "10000", maxPrice: "25000", minGram: "", maxGram: "" },
];
const DEFAULT_FILTERS = {
  minGram: "",
  maxGram: "",
  minPrice: "",
  maxPrice: "",
  sort: "latest",
};

const CATEGORY_LABELS = {
  rings: "Yüzük",
  earrings: "Küpe",
  necklaces: "Kolye",
  bracelets: "Bileklik",
};

const NAME_FIXES = {
  yuzuk: "Yüzük",
  kupe: "Küpe",
  kolye: "Kolye",
  bileklik: "Bileklik",
};

const state = {
  route: parseRoute(window.location.pathname),
  categories: [],
  home: {
    latest: [],
    bestsellers: [],
    stats: { productCount: 0, categoryCount: 0, stlCount: 0 },
  },
  pricePerGramTry: 0,
  displayGramGoldTry: 0,
  collection: {
    filters: { ...DEFAULT_FILTERS },
    quickFilterId: "",
    mobileGrid: "double",
    items: [],
    page: 1,
    totalCount: 0,
    hasMore: false,
    loading: false,
  },
  itemIndex: new Map(),
  ui: {
    menuOpen: false,
    filterOpen: false,
    quickViewOpen: false,
  },
  focusReturnEl: null,
  quickView: {
    item: null,
    tab: "image",
    zoom: { scale: 1, x: 0, y: 0 },
    pointers: new Map(),
    dragOrigin: null,
    pinchStartDistance: 0,
    pinchStartScale: 1,
  },
  viewer3d: null,
  threeModules: null,
};

const els = {
  app: document.getElementById("app"),
  desktopCategoryNav: document.getElementById("desktopCategoryNav"),
  mobileCategoryNav: document.getElementById("mobileCategoryNav"),
  menuToggle: document.getElementById("menuToggle"),
  closeMobileMenu: document.getElementById("closeMobileMenu"),
  mobileMenu: document.getElementById("mobileMenu"),
  mobileMenuBackdrop: document.getElementById("mobileMenuBackdrop"),
  quickViewModal: document.getElementById("quickViewModal"),
  quickViewBackdrop: document.getElementById("quickViewBackdrop"),
  quickViewClose: document.getElementById("quickViewClose"),
  quickViewContent: document.getElementById("quickViewContent"),
  filterDrawer: document.getElementById("filterDrawer"),
  filterBackdrop: document.getElementById("filterBackdrop"),
  closeFilterDrawer: document.getElementById("closeFilterDrawer"),
  filterForm: document.getElementById("filterForm"),
  resetFilters: document.getElementById("resetFilters"),
  drawerMinGram: document.getElementById("drawerMinGram"),
  drawerMaxGram: document.getElementById("drawerMaxGram"),
  drawerMinPrice: document.getElementById("drawerMinPrice"),
  drawerMaxPrice: document.getElementById("drawerMaxPrice"),
  themeToggle: document.getElementById("themeToggle"),
};

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.classList.toggle("theme-light", isLight);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, isLight ? "light" : "dark");
  } catch {
    /* ignore */
  }
  const meta = document.getElementById("metaThemeColor");
  if (meta) {
    meta.setAttribute("content", isLight ? "#ffffff" : "#0c0000");
  }
  const btn = els.themeToggle;
  if (btn) {
    btn.setAttribute("aria-pressed", isLight ? "true" : "false");
    btn.textContent = isLight ? "Koyu tema" : "Açık tema";
    btn.title = isLight ? "Koyu temaya geç" : "Açık temaya geç";
  }
}

function getStoredMobileGrid() {
  try {
    const v = localStorage.getItem(MOBILE_GRID_STORAGE_KEY);
    return v === "single" ? "single" : "double";
  } catch {
    return "double";
  }
}

function setMobileGrid(layout) {
  state.collection.mobileGrid = layout === "single" ? "single" : "double";
  try {
    localStorage.setItem(MOBILE_GRID_STORAGE_KEY, state.collection.mobileGrid);
  } catch {
    /* ignore */
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char];
  });
}

function formatTry(amount) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatCount(value) {
  return new Intl.NumberFormat("tr-TR").format(value || 0);
}

function formatGram(value) {
  return `${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)} gr`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseRoute(pathname) {
  if (pathname === "/" || pathname === "") {
    return { page: "home" };
  }

  if (pathname === "/koleksiyon") {
    return { page: "collection" };
  }

  const match = pathname.match(/^\/kategori\/([^/]+)$/);
  if (match) {
    return { page: "category", slug: decodeURIComponent(match[1]) };
  }

  return { page: "home" };
}

function categoryDisplayName(category) {
  if (!category) return "";
  if (CATEGORY_LABELS[category.slug]) return CATEGORY_LABELS[category.slug];
  const normalized = String(category.name || "").trim().toLowerCase();
  return NAME_FIXES[normalized] || category.name;
}

function getCategoryBySlug(slug) {
  return state.categories.find((category) => category.slug === slug);
}

function currentCategorySlug() {
  return state.route.page === "category" ? state.route.slug : "all";
}

function currentCategoryName() {
  if (state.route.page !== "category") return "Tüm Koleksiyon";
  const category = getCategoryBySlug(state.route.slug);
  return category ? categoryDisplayName(category) : "Koleksiyon";
}

function normalizeItem(item) {
  const category = getCategoryBySlug(item.category_slug);
  const categoryName = item.category_name
    ? categoryDisplayName({ slug: item.category_slug, name: item.category_name })
    : category
      ? categoryDisplayName(category)
      : item.category_slug;

  return {
    ...item,
    category_name: categoryName,
    image_path: item.image_path || "",
    stl_path: item.stl_path || "",
  };
}

function indexItems(items) {
  items.forEach((item) => {
    state.itemIndex.set(Number(item.id), item);
  });
}

function setDocumentTitle() {
  if (state.route.page === "home") {
    document.title = "EES Kuyumculuk | Vitrin";
    return;
  }

  if (state.route.page === "category") {
    document.title = `${currentCategoryName()} | EES Kuyumculuk`;
    return;
  }

  document.title = "Koleksiyon | EES Kuyumculuk";
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`İstek başarısız (${response.status})`);
  }
  return response.json();
}

async function loadThreeModules() {
  if (state.threeModules) {
    return state.threeModules;
  }

  const [THREE, { STLLoader }, { OrbitControls }] = await Promise.all([
    import("three"),
    import("three/addons/loaders/STLLoader.js"),
    import("three/addons/controls/OrbitControls.js"),
  ]);

  state.threeModules = { THREE, STLLoader, OrbitControls };
  return state.threeModules;
}

function setBodyLock() {
  const shouldLock = state.ui.menuOpen || state.ui.filterOpen || state.ui.quickViewOpen;
  document.body.classList.toggle("lock-scroll", shouldLock);
}

function trapFocus(container, event) {
  if (!container) return;
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function activeFocusContainer() {
  if (state.ui.quickViewOpen) return els.quickViewModal;
  if (state.ui.filterOpen) return els.filterDrawer;
  if (state.ui.menuOpen) return els.mobileMenu;
  return null;
}

function setMobileMenuOpen(open) {
  state.ui.menuOpen = open;
  els.mobileMenu.hidden = !open;
  els.mobileMenuBackdrop.hidden = !open;
  els.mobileMenu.classList.toggle("is-open", open);
  els.menuToggle.setAttribute("aria-expanded", String(open));
  els.mobileMenu.setAttribute("aria-hidden", String(!open));
  setBodyLock();

  if (open) {
    state.focusReturnEl = document.activeElement;
    els.closeMobileMenu.focus();
  } else if (state.focusReturnEl && typeof state.focusReturnEl.focus === "function") {
    state.focusReturnEl.focus();
  }
}

function syncDrawerInputs() {
  const filters = state.collection.filters;
  els.drawerMinGram.value = filters.minGram;
  els.drawerMaxGram.value = filters.maxGram;
  els.drawerMinPrice.value = filters.minPrice;
  els.drawerMaxPrice.value = filters.maxPrice;
}

function setFilterDrawerOpen(open) {
  if (open && state.route.page === "home") return;

  state.ui.filterOpen = open;
  els.filterDrawer.hidden = !open;
  els.filterBackdrop.hidden = !open;
  els.filterDrawer.classList.toggle("is-open", open);
  els.filterDrawer.setAttribute("aria-hidden", String(!open));
  setBodyLock();

  if (open) {
    state.focusReturnEl = document.activeElement;
    syncDrawerInputs();
    els.drawerMinGram.focus();
  } else if (state.focusReturnEl && typeof state.focusReturnEl.focus === "function") {
    state.focusReturnEl.focus();
  }
}

function disposeViewer3d() {
  const viewer = state.viewer3d;
  if (!viewer) return;

  cancelAnimationFrame(viewer.frameId);
  viewer.resizeObserver.disconnect();
  viewer.controls.dispose();
  viewer.renderer.dispose();
  if (viewer.host) {
    viewer.host.innerHTML = "";
  }
  state.viewer3d = null;
}

function setQuickViewOpen(open) {
  state.ui.quickViewOpen = open;
  els.quickViewModal.hidden = !open;
  els.quickViewBackdrop.hidden = !open;
  els.quickViewModal.setAttribute("aria-hidden", String(!open));
  setBodyLock();

  if (open) {
    state.focusReturnEl = document.activeElement;
    els.quickViewClose.focus();
  } else {
    disposeViewer3d();
    state.quickView.item = null;
    state.quickView.tab = "image";
    els.quickViewContent.innerHTML = "";
    if (state.focusReturnEl && typeof state.focusReturnEl.focus === "function") {
      state.focusReturnEl.focus();
    }
  }
}

function renderHeader() {
  const desktopLinks = state.categories
    .map((category) => {
      const active = state.route.page === "category" && state.route.slug === category.slug ? "is-active" : "";
      return `<a class="${active}" href="/kategori/${category.slug}" data-link>${escapeHtml(categoryDisplayName(category))}</a>`;
    })
    .join("");

  const mobileLinks = state.categories
    .map((category) => {
      const active = state.route.page === "category" && state.route.slug === category.slug ? "is-active" : "";
      return `<a class="${active}" href="/kategori/${category.slug}" data-link>${escapeHtml(categoryDisplayName(category))}</a>`;
    })
    .join("");

  els.desktopCategoryNav.innerHTML = desktopLinks;
  els.mobileCategoryNav.innerHTML = mobileLinks;

  document.querySelectorAll(".desktop-nav > a, .mobile-main-nav a").forEach((link) => {
    const href = link.getAttribute("href");
    const active =
      (href === "/" && state.route.page === "home") ||
      (href === "/koleksiyon" && (state.route.page === "collection" || state.route.page === "category"));
    link.classList.toggle("is-active", active);
  });
}

function renderProductCard(item) {
  const hasImage = Boolean(item.image_path);
  const hasStl = Boolean(item.stl_path);
  const media = hasImage
    ? `
      <button class="product-media-trigger" type="button" data-action="open-image-view" data-product-id="${item.id}" aria-label="${escapeHtml(item.name)} görselini büyüt">
        <img src="${escapeHtml(item.image_path)}" alt="${escapeHtml(item.name)}" loading="lazy" />
      </button>
    `
    : hasStl
      ? `
        <button class="product-media-trigger product-media-trigger-stl" type="button" data-action="open-stl-view" data-product-id="${item.id}" aria-label="${escapeHtml(item.name)} 3D modelini aç">
          <img src="/public/placeholders/p-1.svg" alt="${escapeHtml(item.name)} STL önizleme" loading="lazy" />
          <span class="stl-badge">3D Önizleme</span>
          <span class="stl-product-label">${escapeHtml(item.name)}</span>
        </button>
      `
      : `<div class="product-media-stl">Görsel hazırlanıyor</div>`;

  return `
    <article class="product-card">
      <div class="product-media">${media}</div>
      <div class="product-info">
        <h3 class="product-title">${escapeHtml(item.name)}</h3>
        <div class="product-meta">
          <strong>${formatTry(item.priceTry)}</strong>
          <span class="product-gram">${formatGram(item.gram)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryCard(category) {
  const image = category.cover_image
    ? `<img src="${escapeHtml(category.cover_image)}" alt="${escapeHtml(categoryDisplayName(category))}" loading="lazy" />`
    : `<div class="product-media-stl">Koleksiyon</div>`;

  return `
    <article class="category-card">
      <a href="/kategori/${category.slug}" data-link>
        <div class="category-media">${image}</div>
        <div class="category-body">
          <h3>${escapeHtml(categoryDisplayName(category))}</h3>
          <p>${formatCount(category.product_count)} ürün</p>
        </div>
      </a>
    </article>
  `;
}

function renderHome() {
  const latest = state.home.latest.slice(0, HOME_LATEST_LIMIT);
  const bestsellers = state.home.bestsellers.slice(0, HOME_LATEST_LIMIT);
  indexItems(latest);
  indexItems(bestsellers);

  const priceText = state.displayGramGoldTry ? formatTry(state.displayGramGoldTry) : "Güncelleniyor";

  return `
    <section class="hero">
      <div>
        <p class="hero-kicker">EES Kuyumculuk</p>
        <h1>Zarif tasarımlar, güçlü vitrin deneyimi.</h1>
        <p>
          Son eklenen ürünleri ve tüm kategorileri hızlıca keşfedin.
          Ürünü seçin, tam ekran inceleyin ve koleksiyon arasında rahatça gezin.
        </p>
        <div class="hero-actions">
          <a class="primary-btn" href="/koleksiyon" data-link>Koleksiyonu Gör</a>
          <a class="secondary-btn" href="#kategoriler">Kategorileri Keşfet</a>
        </div>
      </div>
      <aside class="hero-side">
        <div class="hero-stat">
          <strong>${formatCount(state.home.stats.productCount)}</strong>
          <span>Aktif ürün</span>
        </div>
        <div class="hero-stat">
          <strong>${formatCount(state.home.stats.categoryCount)}</strong>
          <span>Kategori</span>
        </div>
        <div class="hero-stat">
          <strong>${priceText}</strong>
          <span>Güncel gram altın</span>
        </div>
      </aside>
    </section>

    <section class="section-block">
      <div class="section-head">
        <div>
          <h2>Son yüklenenler</h2>
          <p>Vitrine yeni eklenen ürünler</p>
        </div>
        <a class="section-link" href="/koleksiyon" data-link>Tümünü Gör</a>
      </div>
      <div class="product-grid">
        ${latest.map((item) => renderProductCard(item)).join("")}
      </div>
    </section>

    ${
      bestsellers.length
        ? `
    <section class="section-block">
      <div class="section-head">
        <div>
          <h2>Çok satanlar</h2>
          <p>Öne çıkarılan ürünler</p>
        </div>
        <a class="section-link" href="/koleksiyon" data-link>Tümünü Gör</a>
      </div>
      <div class="product-grid">
        ${bestsellers.map((item) => renderProductCard(item)).join("")}
      </div>
    </section>
    `
        : ""
    }

    <section id="kategoriler" class="section-block">
      <div class="section-head">
        <div>
          <h2>Kategorileri Keşfet</h2>
          <p>İstediğiniz ürün grubuna tek adımda geçin</p>
        </div>
      </div>
      <div class="category-grid">
        ${state.categories.map((category) => renderCategoryCard(category)).join("")}
      </div>
    </section>
  `;
}

function activeFilterChipsMarkup() {
  const chips = [];
  const filters = state.collection.filters;

  if (state.route.page === "category") {
    chips.push(`Kategori: ${currentCategoryName()}`);
  }
  if (filters.minGram) chips.push(`Min gram: ${filters.minGram}`);
  if (filters.maxGram) chips.push(`Max gram: ${filters.maxGram}`);
  if (filters.minPrice) chips.push(`Min fiyat: ${filters.minPrice} ₺`);
  if (filters.maxPrice) chips.push(`Max fiyat: ${filters.maxPrice} ₺`);

  return chips.map((label) => `<span class="filter-chip">${escapeHtml(label)}</span>`).join("");
}

function hasActiveFilters() {
  const { minGram, maxGram, minPrice, maxPrice, sort } = state.collection.filters;
  return Boolean(minGram || maxGram || minPrice || maxPrice || sort !== "latest");
}

function resolveQuickFilterId(filters) {
  const hit = QUICK_FILTERS.find(
    (preset) =>
      filters.minGram === preset.minGram &&
      filters.maxGram === preset.maxGram &&
      filters.minPrice === preset.minPrice &&
      filters.maxPrice === preset.maxPrice
  );
  return hit?.id || "";
}

function quickFiltersMarkup() {
  return QUICK_FILTERS.map((preset) => {
    const isActive = state.collection.quickFilterId === preset.id;
    return `<button class="quick-filter-chip ${isActive ? "is-active" : ""}" type="button" data-action="quick-filter" data-quick-id="${
      preset.id
    }">${escapeHtml(preset.label)}</button>`;
  }).join("");
}

function renderCollection() {
  return `
    <section class="collection-shell">
      <div class="collection-toolbar">
        <div class="toolbar-top">
          <h1>${escapeHtml(currentCategoryName())}</h1>
          <div class="toolbar-controls">
            <label class="sort-wrap" for="sortSelect" aria-label="Sıralama">
              <select id="sortSelect" aria-label="Sıralama">
                <option value="latest" ${state.collection.filters.sort === "latest" ? "selected" : ""}>En yeni</option>
                <option value="price_asc" ${state.collection.filters.sort === "price_asc" ? "selected" : ""}>Fiyat artan</option>
                <option value="price_desc" ${state.collection.filters.sort === "price_desc" ? "selected" : ""}>Fiyat azalan</option>
                <option value="gram_asc" ${state.collection.filters.sort === "gram_asc" ? "selected" : ""}>Gram artan</option>
                <option value="gram_desc" ${state.collection.filters.sort === "gram_desc" ? "selected" : ""}>Gram azalan</option>
              </select>
            </label>
            <button id="openFiltersButton" class="secondary-btn" type="button">Filtreler</button>
            <button id="resetToolbarFiltersButton" class="secondary-btn" type="button" ${hasActiveFilters() ? "" : "hidden"}>
              Filtreleri Sıfırla
            </button>
          </div>
        </div>
        <div class="quick-filters" aria-label="Hızlı filtreler">
          ${quickFiltersMarkup()}
        </div>
        <div class="toolbar-sub">
          <p id="resultsText" class="results-text">Ürünler yükleniyor...</p>
          <div id="activeFilterChips" class="filter-chips">${activeFilterChipsMarkup()}</div>
        </div>
      </div>

      <div class="view-layout-row">
        <div class="mobile-grid-toggle" role="group" aria-label="Mobil ürün görünümü">
          <button
            class="layout-toggle-btn ${state.collection.mobileGrid === "double" ? "is-active" : ""}"
            type="button"
            data-action="mobile-grid"
            data-layout="double"
          >
            2'li
          </button>
          <button
            class="layout-toggle-btn ${state.collection.mobileGrid === "single" ? "is-active" : ""}"
            type="button"
            data-action="mobile-grid"
            data-layout="single"
          >
            Tekli
          </button>
        </div>
      </div>

      <div id="collectionGrid" class="product-grid"></div>
      <div id="collectionStatus" class="status-panel" hidden></div>
      <div class="load-more-wrap">
        <button id="loadMoreBtn" class="primary-btn" type="button" hidden>Daha Fazla</button>
      </div>
    </section>
  `;
}

function updateCollectionDom() {
  const grid = document.getElementById("collectionGrid");
  const status = document.getElementById("collectionStatus");
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  const resultsText = document.getElementById("resultsText");
  const chips = document.getElementById("activeFilterChips");
  const resetToolbarFiltersButton = document.getElementById("resetToolbarFiltersButton");
  const quickFilters = document.querySelector(".quick-filters");
  const mobileGridToggle = document.querySelector(".mobile-grid-toggle");

  if (!grid || !status || !loadMoreBtn || !resultsText || !chips) return;

  grid.classList.toggle("mobile-grid-single", state.collection.mobileGrid === "single");
  grid.classList.toggle("mobile-grid-double", state.collection.mobileGrid !== "single");
  chips.innerHTML = activeFilterChipsMarkup();
  if (quickFilters) {
    quickFilters.innerHTML = quickFiltersMarkup();
  }
  if (mobileGridToggle) {
    mobileGridToggle.querySelectorAll(".layout-toggle-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.layout === state.collection.mobileGrid);
    });
  }
  if (resetToolbarFiltersButton) {
    resetToolbarFiltersButton.hidden = !hasActiveFilters();
  }

  if (state.collection.loading && state.collection.items.length === 0) {
    status.hidden = false;
    status.textContent = "Ürünler yükleniyor...";
    grid.innerHTML = "";
    loadMoreBtn.hidden = true;
    resultsText.textContent = "Ürünler yükleniyor...";
    return;
  }

  if (state.collection.items.length === 0) {
    status.hidden = false;
    status.textContent = "Bu filtrelere uygun ürün bulunamadı.";
    grid.innerHTML = "";
    loadMoreBtn.hidden = true;
    resultsText.textContent = "0 ürün bulundu";
    return;
  }

  status.hidden = true;
  grid.innerHTML = state.collection.items.map((item) => renderProductCard(item)).join("");
  loadMoreBtn.hidden = !state.collection.hasMore;
  loadMoreBtn.disabled = state.collection.loading;
  resultsText.textContent = `${formatCount(state.collection.totalCount)} ürün bulundu`;
}

function collectionApiUrl(page) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIST_PAGE_SIZE),
    sort: state.collection.filters.sort,
  });

  const category = currentCategorySlug();
  if (category !== "all") {
    params.set("category", category);
  }

  const filters = state.collection.filters;
  if (filters.minGram) params.set("minGram", filters.minGram);
  if (filters.maxGram) params.set("maxGram", filters.maxGram);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);

  return `/api/products?${params.toString()}`;
}

async function loadCollection({ reset }) {
  if (state.collection.loading) return;

  if (reset) {
    state.collection.items = [];
    state.collection.page = 1;
    state.collection.totalCount = 0;
    state.collection.hasMore = false;
  }

  state.collection.loading = true;
  updateCollectionDom();

  try {
    const data = await fetchJson(collectionApiUrl(state.collection.page));
    const items = data.items.map((item) => normalizeItem(item));
    indexItems(items);

    state.collection.items = reset ? items : [...state.collection.items, ...items];
    state.collection.page = data.page + 1;
    state.collection.totalCount = data.totalCount;
    state.collection.hasMore = data.hasMore;
  } catch (error) {
    console.error(error);
    state.collection.items = [];
    state.collection.totalCount = 0;
    state.collection.hasMore = false;
  } finally {
    state.collection.loading = false;
    updateCollectionDom();
  }
}

function renderQuickView() {
  const item = state.quickView.item;
  if (!item) return;
  if (state.quickView.tab === "stl" && item.stl_path) {
    els.quickViewContent.innerHTML = `<div id="quickStlView" class="quickview-stl" aria-label="${escapeHtml(item.name)} 3D görüntüleyici"></div>`;
    mountQuickViewStl();
    return;
  }

  disposeViewer3d();
  els.quickViewContent.innerHTML = `<img class="quickview-image" src="${escapeHtml(item.image_path)}" alt="${escapeHtml(item.name)}" />`;
}

async function mountQuickViewStl() {
  const host = document.getElementById("quickStlView");
  if (!host || !state.quickView.item?.stl_path) return;

  disposeViewer3d();
  host.innerHTML = `<div class="viewer-empty">3D model yükleniyor...</div>`;

  try {
    const { THREE, STLLoader, OrbitControls } = await loadThreeModules();
    host.innerHTML = "";

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 24;
    controls.maxDistance = 360;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff2df, 0x2d2419, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.45);
    key.position.set(30, 24, 30);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9a35f, 0.75);
    fill.position.set(-16, -10, 20);
    scene.add(fill);

    const resize = () => {
      const width = host.clientWidth || 320;
      const height = host.clientHeight || 320;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const loader = new STLLoader();
    loader.load(
      state.quickView.item.stl_path,
      (geometry) => {
        geometry.center();
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            color: 0xc49657,
            metalness: 0.9,
            roughness: 0.24,
          })
        );
        scene.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        camera.position.set(maxDim * 1.35, maxDim * 1.08, maxDim * 1.65);
        camera.near = maxDim / 120;
        camera.far = maxDim * 180;
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        controls.update();

        const animate = () => {
          controls.update();
          renderer.render(scene, camera);
          if (state.viewer3d) {
            state.viewer3d.frameId = requestAnimationFrame(animate);
          }
        };

        state.viewer3d = {
          host,
          renderer,
          controls,
          resizeObserver,
          frameId: requestAnimationFrame(animate),
        };
      },
      undefined,
      () => {
        host.innerHTML = `<div class="viewer-empty">3D model açılamadı.</div>`;
      }
    );
  } catch (error) {
    console.error(error);
    host.innerHTML = `<div class="viewer-empty">3D görüntüleyici yüklenemedi.</div>`;
  }
}

function openQuickViewById(productId, mode = "image") {
  const item = state.itemIndex.get(Number(productId));
  if (!item) return;

  if (mode === "image" && !item.image_path) return;
  if (mode === "stl" && !item.stl_path) return;

  state.quickView.item = item;
  state.quickView.tab = mode;
  setQuickViewOpen(true);
  renderQuickView();
}

function closeQuickView() {
  setQuickViewOpen(false);
}

async function renderRoute() {
  setDocumentTitle();
  renderHeader();
  closeQuickView();
  setFilterDrawerOpen(false);
  setMobileMenuOpen(false);

  if (state.route.page === "home") {
    els.app.innerHTML = renderHome();
    return;
  }

  els.app.innerHTML = renderCollection();
  await loadCollection({ reset: true });
}

async function navigate(pathname, { replace = false } = {}) {
  if (!pathname || pathname === window.location.pathname) {
    await renderRoute();
    return;
  }

  if (replace) {
    window.history.replaceState({}, "", pathname);
  } else {
    window.history.pushState({}, "", pathname);
  }

  state.route = parseRoute(pathname);
  window.scrollTo({ top: 0, behavior: "smooth" });
  await renderRoute();
}

function readDrawerFilters() {
  return {
    ...state.collection.filters,
    minGram: els.drawerMinGram.value.trim(),
    maxGram: els.drawerMaxGram.value.trim(),
    minPrice: els.drawerMinPrice.value.trim(),
    maxPrice: els.drawerMaxPrice.value.trim(),
  };
}

function resetFilters() {
  state.collection.filters = { ...DEFAULT_FILTERS };
  state.collection.quickFilterId = "";
  syncDrawerInputs();
}

function bindStaticEvents() {
  els.themeToggle?.addEventListener("click", () => {
    applyTheme(getStoredTheme() === "light" ? "dark" : "light");
  });

  els.menuToggle?.addEventListener("click", () => {
    setMobileMenuOpen(!state.ui.menuOpen);
  });

  els.closeMobileMenu?.addEventListener("click", () => setMobileMenuOpen(false));
  els.mobileMenuBackdrop?.addEventListener("click", () => setMobileMenuOpen(false));

  els.quickViewClose?.addEventListener("click", closeQuickView);
  els.quickViewBackdrop?.addEventListener("click", closeQuickView);

  els.closeFilterDrawer?.addEventListener("click", () => setFilterDrawerOpen(false));
  els.filterBackdrop?.addEventListener("click", () => setFilterDrawerOpen(false));

  els.resetFilters?.addEventListener("click", async () => {
    resetFilters();
    setFilterDrawerOpen(false);
    await loadCollection({ reset: true });
  });

  els.filterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.collection.filters = readDrawerFilters();
    state.collection.quickFilterId = resolveQuickFilterId(state.collection.filters);
    setFilterDrawerOpen(false);
    await loadCollection({ reset: true });
  });

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-link]");
    if (link) {
      event.preventDefault();
      const href = link.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      await navigate(href);
      return;
    }

    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;

    if (action === "quick-close") {
      closeQuickView();
      return;
    }

    if (action === "open-image-view") {
      openQuickViewById(actionEl.dataset.productId, "image");
      return;
    }

    if (action === "open-stl-view") {
      openQuickViewById(actionEl.dataset.productId, "stl");
      return;
    }

    if (action === "quick-filter") {
      const quickId = actionEl.dataset.quickId || "";
      const preset = QUICK_FILTERS.find((item) => item.id === quickId);
      if (!preset) return;
      if (state.collection.quickFilterId === quickId) {
        resetFilters();
      } else {
        state.collection.filters = {
          ...state.collection.filters,
          minGram: preset.minGram,
          maxGram: preset.maxGram,
          minPrice: preset.minPrice,
          maxPrice: preset.maxPrice,
        };
        state.collection.quickFilterId = quickId;
        syncDrawerInputs();
      }
      await loadCollection({ reset: true });
      return;
    }

    if (action === "mobile-grid") {
      setMobileGrid(actionEl.dataset.layout || "double");
      updateCollectionDom();
      return;
    }
  });

  document.addEventListener("change", async (event) => {
    if (event.target.id === "sortSelect") {
      state.collection.filters.sort = event.target.value;
      await loadCollection({ reset: true });
    }
  });

  document.addEventListener("click", async (event) => {
    if (event.target.id === "openFiltersButton") {
      setFilterDrawerOpen(true);
      return;
    }

    if (event.target.id === "loadMoreBtn") {
      await loadCollection({ reset: false });
      return;
    }

    if (event.target.id === "resetToolbarFiltersButton") {
      resetFilters();
      await loadCollection({ reset: true });
    }
  });

  window.addEventListener("popstate", async () => {
    state.route = parseRoute(window.location.pathname);
    await renderRoute();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.ui.quickViewOpen) {
        closeQuickView();
        return;
      }
      if (state.ui.filterOpen) {
        setFilterDrawerOpen(false);
        return;
      }
      if (state.ui.menuOpen) {
        setMobileMenuOpen(false);
      }
      return;
    }

    if (event.key === "Tab") {
      trapFocus(activeFocusContainer(), event);
    }
  });
}

async function ensureBootstrapData() {
  const data = await fetchJson("/api/home");
  state.categories = (data.categories || []).map((category) => ({
    ...category,
    name: categoryDisplayName(category),
  }));
  state.home.latest = (data.latest || []).map((item) => normalizeItem(item));
  state.home.bestsellers = (data.bestsellers || []).map((item) => normalizeItem(item));
  state.home.stats = data.stats || state.home.stats;
  state.pricePerGramTry = data.pricePerGramTry || 0;
  state.displayGramGoldTry = data.displayGramGoldTry || state.pricePerGramTry;
  state.collection.quickFilterId = resolveQuickFilterId(state.collection.filters);
  indexItems(state.home.latest);
  indexItems(state.home.bestsellers);
}

async function boot() {
  try {
    window.__eesSetTheme = (mode) => applyTheme(mode === "light" ? "light" : "dark");
    window.__eesToggleTheme = () => applyTheme(getStoredTheme() === "light" ? "dark" : "light");
    setMobileGrid(getStoredMobileGrid());
    applyTheme(getStoredTheme());
    bindStaticEvents();
    await ensureBootstrapData();
    state.route = parseRoute(window.location.pathname);
    await renderRoute();
  } catch (error) {
    console.error(error);
    els.app.innerHTML = `
      <section class="status-panel">
        Veri bağlantısı kurulamadı. Lütfen sunucuyu kontrol edip sayfayı yenileyin.
      </section>
    `;
  }
}

boot();
