const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const express = require("express");
const multer = require("multer");
const { db } = require("../db");
const { importProductsFromCsvText } = require("../importProductsCsv");

const router = express.Router();
const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
const adminPasswordHash = bcrypt.hashSync(adminPassword, 10);

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: "Unauthorized", detail: "Oturum yok veya suresi doldu; tekrar giris yapin." });
  }
  return next();
}

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    const isModel =
      file.mimetype.includes("model") ||
      file.mimetype === "application/octet-stream" ||
      file.originalname.toLowerCase().endsWith(".stl");
    cb(null, isModel ? path.join(process.cwd(), "uploads", "models") : path.join(process.cwd(), "uploads", "images"));
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

function fileFilterUpload(_req, file, cb) {
  const name = file.originalname.toLowerCase();
  const ok =
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".stl");
  cb(ok ? null : new Error("Desteklenmeyen dosya turu (jpg, png, webp, stl)"), ok);
}

/** Gorsel ve STL: buyuk STL icin 50 MB */
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilterUpload,
});

const tempDir = path.join(process.cwd(), "uploads", "temp");
const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `csv-${Date.now()}-${safe}`);
  },
});

const uploadCsv = multer({
  storage: csvStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok = name.endsWith(".csv") || file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel";
    cb(ok ? null : new Error("Sadece .csv dosyasi"), ok);
  },
});

function handleMulterUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "Dosya boyutu cok buyuk (limit asildi)" });
        }
        return res.status(400).json({ error: err.message || "Yukleme hatasi" });
      }
      return res.status(400).json({ error: err.message || "Yukleme reddedildi" });
    });
  };
}

router.post("/login", async (req, res) => {
  const { password } = req.body;
  const ok = await bcrypt.compare(password || "", adminPasswordHash);
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
  try {
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
  } catch (e) {
    if (e && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "Bu slug zaten kayitli",
        detail: "Ayni slug ile tekrar eklenemez; mevcut urunu Duzenleyin veya farkli slug kullanin.",
      });
    }
    console.error(e);
    return res.status(500).json({ error: "Veritabani hatasi", detail: e.message });
  }
});

router.patch("/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, slug, category_slug, gram, image_path, stl_path, is_active } = req.body;
  try {
    db.prepare(`
      UPDATE products
      SET name=@name, slug=@slug, category_slug=@category_slug, gram=@gram, image_path=@image_path, stl_path=@stl_path, is_active=@is_active
      WHERE id=@id
    `).run({
      id,
      name,
      slug,
      category_slug,
      gram: Number(gram),
      image_path: image_path || "",
      stl_path: stl_path || "",
      is_active: Number(is_active) ? 1 : 0,
    });
    res.json({ ok: true });
  } catch (e) {
    if (e && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Bu slug baska bir urunde kullaniliyor" });
    }
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
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
  try {
    const info = db
      .prepare("INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)")
      .run(slug, name, Number(sort_order));
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (e && e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Bu kategori slug zaten var" });
    }
    console.error(e);
    return res.status(500).json({ error: e.message || "Kategori eklenemedi" });
  }
});

router.delete("/categories/:id", requireAdmin, (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

router.post(
  "/upload",
  requireAdmin,
  handleMulterUpload(upload.single("file")),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Dosya alinamadi", detail: "Sunucu calisiyor mu ve dosya sectiniz mi kontrol edin." });
    }
    const normalizedPath = req.file.path.replace(process.cwd(), "").replaceAll("\\", "/");
    res.json({ path: normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}` });
  }
);

router.post(
  "/products/import-csv",
  requireAdmin,
  handleMulterUpload(uploadCsv.single("file")),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "CSV dosyasi yok" });
    }
    let text;
    try {
      text = fs.readFileSync(req.file.path, "utf8");
    } catch (e) {
      return res.status(500).json({ error: "CSV okunamadi", detail: e.message });
    } finally {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }

    try {
      const result = importProductsFromCsvText(text, db);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "CSV parse hatasi", detail: e.message });
    }
  }
);

router.get("/products/csv-template", requireAdmin, (_req, res) => {
  const p = path.join(process.cwd(), "public", "templates", "urun-import-sablonu.csv");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="urun-import-sablonu.csv"');
  res.send(fs.readFileSync(p, "utf8"));
});

module.exports = router;
