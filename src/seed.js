const { db, initDb } = require("./db");

initDb();

const categories = [
  ["rings", "Yuzuk", 1],
  ["earrings", "Kupe", 2],
  ["bracelets", "Bileklik", 3],
  ["necklaces", "Kolye", 4],
];

const upsertCategory = db.prepare(`
  INSERT INTO categories (slug, name, sort_order)
  VALUES (?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET name=excluded.name, sort_order=excluded.sort_order
`);

categories.forEach((c) => upsertCategory.run(...c));

const existing = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
if (existing === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, slug, category_slug, gram, image_path, stl_path, is_active)
    VALUES (@name, @slug, @category_slug, @gram, @image_path, @stl_path, 1)
  `);

  for (let i = 1; i <= 48; i += 1) {
    const category = categories[i % categories.length][0];
    insert.run({
      name: `Atolye Koleksiyonu #${i}`,
      slug: `atolye-${i}`,
      category_slug: category,
      gram: (2 + (i % 11) * 0.65).toFixed(2),
      image_path: "/public/placeholders/p-1.svg",
      stl_path: "",
    });
  }
}

console.log("Seed tamamlandi.");
