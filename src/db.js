const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "catalog.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

function ensureColumn(tableName, columnName, columnSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
  }
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category_slug TEXT NOT NULL,
      gram REAL NOT NULL CHECK (gram > 0),
      image_path TEXT,
      stl_path TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
    CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  ensureColumn("products", "is_bestseller", "is_bestseller INTEGER NOT NULL DEFAULT 0");

  const upsertSetting = db.prepare(`
    INSERT INTO site_settings (key, value)
    VALUES (@key, @value)
    ON CONFLICT(key) DO NOTHING
  `);
  upsertSetting.run({ key: "pricing_milyem", value: "1000" });
  upsertSetting.run({ key: "pricing_gold_markup_percent", value: "0" });
}

module.exports = { db, initDb };
