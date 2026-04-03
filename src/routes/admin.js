const path = require("path");
const bcrypt = require("bcryptjs");
const express = require("express");
const multer = require("multer");
const { db } = require("../db");

const router = express.Router();
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const isModel = file.mimetype.includes("model") || file.originalname.toLowerCase().endsWith(".stl");
    cb(null, isModel ? path.join(process.cwd(), "uploads", "models") : path.join(process.cwd(), "uploads", "images"));
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok =
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp") ||
      name.endsWith(".stl");
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

router.post("/login", async (req, res) => {
  const { password } = req.body;
  const hash = await bcrypt.hash(adminPassword, 8);
  const ok = await bcrypt.compare(password || "", hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  req.session.isAdmin = true;
  return res.json({ ok: true });
});

router.post("/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/products", requireAdmin, (_req, res) => {
  const items = db.prepare("SELECT * FROM products ORDER BY created_at DESC, id DESC").all();
  res.json({ items });
});

router.post("/products", requireAdmin, (req, res) => {
  const { name, slug, category_slug, gram, image_path, stl_path, is_active = 1 } = req.body;
  const stmt = db.prepare(`
    INSERT INTO products (name, slug, category_slug, gram, image_path, stl_path, is_active)
    VALUES (@name, @slug, @category_slug, @gram, @image_path, @stl_path, @is_active)
  `);
  const info = stmt.run({
    name,
    slug,
    category_slug,
    gram: Number(gram),
    image_path: image_path || "",
    stl_path: stl_path || "",
    is_active: Number(is_active) ? 1 : 0,
  });
  res.json({ id: info.lastInsertRowid });
});

router.patch("/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, category_slug, gram, image_path, stl_path, is_active } = req.body;
  db.prepare(`
    UPDATE products
    SET name=@name, category_slug=@category_slug, gram=@gram, image_path=@image_path, stl_path=@stl_path, is_active=@is_active
    WHERE id=@id
  `).run({
    id,
    name,
    category_slug,
    gram: Number(gram),
    image_path: image_path || "",
    stl_path: stl_path || "",
    is_active: Number(is_active) ? 1 : 0,
  });
  res.json({ ok: true });
});

router.delete("/products/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

router.get("/categories", requireAdmin, (_req, res) => {
  const items = db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, name ASC").all();
  res.json({ items });
});

router.post("/categories", requireAdmin, (req, res) => {
  const { slug, name, sort_order = 0 } = req.body;
  const info = db
    .prepare("INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)")
    .run(slug, name, Number(sort_order));
  res.json({ id: info.lastInsertRowid });
});

router.post("/upload", requireAdmin, upload.single("file"), (req, res) => {
  const normalizedPath = req.file.path.replace(process.cwd(), "").replaceAll("\\", "/");
  res.json({ path: normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}` });
});

module.exports = router;
