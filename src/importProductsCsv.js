const { parse } = require("csv-parse/sync");

function parseBool(v) {
  if (v === undefined || v === null || String(v).trim() === "") return 1;
  const s = String(v).trim().toLowerCase();
  if (["0", "false", "hayir", "h", "no", "pasif", "inactive"].includes(s)) return 0;
  return 1;
}

function normalizeHeaderKeys(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    out[key] = v;
  }
  return out;
}

function normalizeRow(raw) {
  const slug = raw.slug != null ? String(raw.slug).trim() : "";
  const name = raw.name != null ? String(raw.name).trim() : "";
  const category_slug = raw.category_slug != null ? String(raw.category_slug).trim() : "";
  const gramRaw = raw.gram;
  const gram = typeof gramRaw === "number" ? gramRaw : Number.parseFloat(String(gramRaw ?? "").replace(",", "."));
  const image_path = raw.image_path != null ? String(raw.image_path).trim() : "";
  const stl_path = raw.stl_path != null ? String(raw.stl_path).trim() : "";
  const is_active = parseBool(raw.is_active);
  return { slug, name, category_slug, gram, image_path, stl_path, is_active };
}

/**
 * @param {string} csvText
 * @param {import('better-sqlite3').Database} db
 */
function importProductsFromCsvText(csvText, db) {
  let text = csvText;
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const categorySlugs = new Set(
    db.prepare("SELECT slug FROM categories").all().map((r) => r.slug)
  );

  const selectBySlug = db.prepare("SELECT id FROM products WHERE slug = ?");
  const insert = db.prepare(`
    INSERT INTO products (name, slug, category_slug, gram, image_path, stl_path, is_active)
    VALUES (@name, @slug, @category_slug, @gram, @image_path, @stl_path, @is_active)
  `);
  const update = db.prepare(`
    UPDATE products
    SET name=@name, category_slug=@category_slug, gram=@gram, image_path=@image_path, stl_path=@stl_path, is_active=@is_active
    WHERE slug=@slug
  `);

  let inserted = 0;
  let updated = 0;
  /** @type {{ line: number, slug?: string, error: string }[]} */
  const errors = [];

  records.forEach((raw, index) => {
    const line = index + 2;
    try {
      const row = normalizeRow(normalizeHeaderKeys(raw));
      if (!row.slug) throw new Error("slug bos olamaz");
      if (!row.name) throw new Error("name bos olamaz");
      if (!row.category_slug) throw new Error("category_slug bos olamaz");
      if (!Number.isFinite(row.gram) || row.gram <= 0) throw new Error("gram gecersiz (pozitif sayi olmali)");
      if (!categorySlugs.has(row.category_slug)) {
        throw new Error(`Kategori yok: "${row.category_slug}" (once kategoriyi ekleyin)`);
      }

      const existing = selectBySlug.get(row.slug);
      const payload = {
        name: row.name,
        slug: row.slug,
        category_slug: row.category_slug,
        gram: row.gram,
        image_path: row.image_path || "",
        stl_path: row.stl_path || "",
        is_active: row.is_active ? 1 : 0,
      };

      if (existing) {
        update.run(payload);
        updated += 1;
      } else {
        insert.run(payload);
        inserted += 1;
      }
    } catch (e) {
      errors.push({
        line,
        slug: raw.slug != null ? String(raw.slug) : undefined,
        error: e.message || String(e),
      });
    }
  });

  return { inserted, updated, errors, total: records.length };
}

module.exports = { importProductsFromCsvText };
