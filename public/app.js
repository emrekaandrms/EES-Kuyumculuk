import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { STLLoader } from "https://unpkg.com/three@0.162.0/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js";

const state = {
  cursor: null,
  loading: false,
  done: false,
  filters: { category: "all", minGram: "", maxGram: "", minPrice: "", maxPrice: "" },
};

const els = {
  catalog: document.getElementById("catalog"),
  loading: document.getElementById("loading"),
  priceBadge: document.getElementById("priceBadge"),
  categoryFilter: document.getElementById("categoryFilter"),
  minGram: document.getElementById("minGram"),
  maxGram: document.getElementById("maxGram"),
  minPrice: document.getElementById("minPrice"),
  maxPrice: document.getElementById("maxPrice"),
  applyFilters: document.getElementById("applyFilters"),
  modal: document.getElementById("stlModal"),
  closeModal: document.getElementById("closeModal"),
  viewer: document.getElementById("viewer3d"),
};

function formatTry(amount) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(
    amount
  );
}

async function initCategories() {
  const response = await fetch("/api/categories");
  const data = await response.json();
  data.items.forEach((c) => {
    const o = document.createElement("option");
    o.value = c.slug;
    o.textContent = c.name;
    els.categoryFilter.appendChild(o);
  });
}

async function initPricing() {
  const response = await fetch("/api/pricing");
  const data = await response.json();
  els.priceBadge.textContent = `Anlik gram altin: ${formatTry(data.pricePerGramTry)} (${data.currency})`;
}

function productCard(item) {
  const node = document.createElement("article");
  node.className = "card";
  node.innerHTML = `
    <img src="${item.image_path || "/public/placeholders/p-1.svg"}" alt="${item.name}">
    <div class="card-body">
      <h3 class="card-title">${item.name}</h3>
      <p class="meta">Kategori: ${item.category_slug}</p>
      <p class="meta">${Number(item.gram).toFixed(2)} gr</p>
      <p class="meta price">${formatTry(item.priceTry)}</p>
      ${item.stl_path ? `<button class="stl-btn" data-stl="${item.stl_path}">3D Incele</button>` : ""}
    </div>
  `;
  return node;
}

async function fetchProducts(reset = false) {
  if (state.loading || state.done) return;
  state.loading = true;
  els.loading.style.display = "block";

  const query = new URLSearchParams({
    ...state.filters,
    limit: "24",
  });
  if (state.cursor && !reset) {
    query.set("cursorCreatedAt", state.cursor.createdAt);
    query.set("cursorId", String(state.cursor.id));
  }

  const response = await fetch(`/api/products?${query.toString()}`);
  const data = await response.json();
  if (reset) {
    els.catalog.innerHTML = "";
  }
  data.items.forEach((item) => els.catalog.appendChild(productCard(item)));
  state.cursor = data.nextCursor;
  if (!data.nextCursor || data.items.length === 0) {
    state.done = true;
    els.loading.textContent = "Tum urunler yuklendi.";
  } else {
    els.loading.textContent = "Urunler yukleniyor...";
  }

  state.loading = false;
}

function applyFilters() {
  state.filters = {
    category: els.categoryFilter.value,
    minGram: els.minGram.value,
    maxGram: els.maxGram.value,
    minPrice: els.minPrice.value,
    maxPrice: els.maxPrice.value,
  };
  state.cursor = null;
  state.done = false;
  fetchProducts(true);
}

function bootInfiniteScroll() {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        fetchProducts(false);
      }
    },
    { threshold: 0.2 }
  );
  observer.observe(els.loading);
}

let activeRenderer = null;
let activeAnimation = null;
function openStlViewer(stlPath) {
  els.modal.classList.add("open");
  els.viewer.innerHTML = "";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f0f0f);
  const camera = new THREE.PerspectiveCamera(55, els.viewer.clientWidth / els.viewer.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 110);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(els.viewer.clientWidth, els.viewer.clientHeight);
  els.viewer.appendChild(renderer.domElement);
  activeRenderer = renderer;

  scene.add(new THREE.HemisphereLight(0xf4e8d4, 0x181818, 0.7));
  const dir = new THREE.DirectionalLight(0xffddaa, 1.1);
  dir.position.set(60, 40, 60);
  scene.add(dir);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;

  const loader = new STLLoader();
  loader.load(
    stlPath,
    (geometry) => {
      geometry.center();
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: 0xbe9463, metalness: 0.9, roughness: 0.3 })
      );
      mesh.scale.setScalar(1.2);
      scene.add(mesh);
    },
    undefined,
    () => {
      const p = document.createElement("p");
      p.textContent = "STL yuklenemedi.";
      els.viewer.appendChild(p);
    }
  );

  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    activeAnimation = requestAnimationFrame(animate);
  };
  animate();
}

function closeStlViewer() {
  els.modal.classList.remove("open");
  if (activeAnimation) cancelAnimationFrame(activeAnimation);
  if (activeRenderer) activeRenderer.dispose();
  activeRenderer = null;
}

function bootHero3D() {
  const canvas = document.getElementById("hero3d");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 55);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const light = new THREE.PointLight(0xffd59f, 1.3);
  light.position.set(12, 10, 16);
  scene.add(light);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(9, 2.1, 32, 120),
    new THREE.MeshStandardMaterial({ color: 0xba9463, metalness: 0.95, roughness: 0.28 })
  );
  ring.position.set(15, 2, -8);
  scene.add(ring);

  const animate = () => {
    ring.rotation.x += 0.002;
    ring.rotation.y += 0.004;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

els.applyFilters.addEventListener("click", applyFilters);
els.closeModal.addEventListener("click", closeStlViewer);
els.modal.addEventListener("click", (event) => {
  if (event.target === els.modal) closeStlViewer();
});

els.catalog.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-stl]");
  if (button) openStlViewer(button.dataset.stl);
});

bootHero3D();
initCategories().then(() => {
  initPricing();
  fetchProducts(true);
  bootInfiniteScroll();
});
