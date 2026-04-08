const express = require("express");
const { db } = require("../db");
const { resolvePricePerGramTry } = require("../pricing");

const router = express.Router();
const HOME_LATEST_LIMIT = 8;
const HOME_BESTSELLERS_LIMIT = 8;

function getPricingSettings() {
  const rows = db
    .prepare("SELECT key, value FROM site_settings WHERE key IN ('pricing_milyem', 'pricing_gold_markup_percent')")
    .all();
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  const milyemRaw = Number(map.pricing_milyem ?? 1000);
  const markupRaw = Number(map.pricing_gold_markup_percent ?? 0);

  const milyem = Number.isFinite(milyemRaw) && milyemRaw > 0 ? milyemRaw : 1000;
  const markupPercent = Number.isFinite(markupRaw) ? markupRaw : 0;
  const priceFactor = (milyem / 1000) * (1 + markupPercent / 100);

  return { milyem, markupPercent, priceFactor };
}

function categoryQuery() {
  return `
    SELECT
      c.slug,
      c.name,
      c.sort_order,
      (
        SELECT COUNT(*)
        FROM products p
        WHERE p.category_slug = c.slug AND p.is_active = 1
      ) AS product_count,
      COALESCE(
        (
          SELECT p.image_path
          FROM products p
          WHERE p.category_slug = c.slug
            AND p.is_active = 1
            AND p.image_path != ''
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT 1
        ),
        ''
      ) AS cover_image,
      COALESCE(
        (
          SELECT p.stl_path
          FROM products p
          WHERE p.category_slug = c.slug
            AND p.is_active = 1
            AND p.stl_path != ''
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT 1
        ),
        ''
      ) AS sample_stl
    FROM categories c
    ORDER BY c.sort_order ASC, c.name ASC
  `;
}

function mapProductRow(row, pricePerGramTry, priceFactor) {
  return {
    ...row,
    category_name: row.category_name || row.category_slug,
    image_path: row.image_path || "",
    stl_path: row.stl_path || "",
    is_bestseller: Number(row.is_bestseller) ? 1 : 0,
    priceTry: Math.round(Number(row.gram) * pricePerGramTry * priceFactor),
  };
}

function parseOptionalNumber(rawValue, fieldName, { min = 0 } = {}) {
  if (rawValue === "" || rawValue == null) {
    return { ok: true, hasValue: false };
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${fieldName} gecerli bir sayi olmali` };
  }
  if (value < min) {
    return { ok: false, error: `${fieldName} en az ${min} olmali` };
  }
  return { ok: true, hasValue: true, value };
}

function buildProductFilters(query, pricePerGramTry, priceFactor) {
  const {
    category = "all",
    minGram = "",
    maxGram = "",
    minPrice = "",
    maxPrice = "",
  } = query;

  const where = ["p.is_active = 1"];
  const params = { pricePerGramTry, priceFactor };
  const errors = [];

  if (category !== "all") {
    where.push("p.category_slug = @category");
    params.category = category;
  }

  const minGramParsed = parseOptionalNumber(minGram, "minGram", { min: 0 });
  const maxGramParsed = parseOptionalNumber(maxGram, "maxGram", { min: 0 });
  const minPriceParsed = parseOptionalNumber(minPrice, "minPrice", { min: 0 });
  const maxPriceParsed = parseOptionalNumber(maxPrice, "maxPrice", { min: 0 });

  [minGramParsed, maxGramParsed, minPriceParsed, maxPriceParsed].forEach((result) => {
    if (!result.ok) errors.push(result.error);
  });

  if (minGramParsed.ok && minGramParsed.hasValue) {
    where.push("p.gram >= @minGram");
    params.minGram = minGramParsed.value;
  }

  if (maxGramParsed.ok && maxGramParsed.hasValue) {
    where.push("p.gram <= @maxGram");
    params.maxGram = maxGramParsed.value;
  }

  if (minPriceParsed.ok && minPriceParsed.hasValue) {
    where.push("(p.gram * @pricePerGramTry * @priceFactor) >= @minPrice");
    params.minPrice = minPriceParsed.value;
  }

  if (maxPriceParsed.ok && maxPriceParsed.hasValue) {
    where.push("(p.gram * @pricePerGramTry * @priceFactor) <= @maxPrice");
    params.maxPrice = maxPriceParsed.value;
  }

  if (minGramParsed.hasValue && maxGramParsed.hasValue && minGramParsed.value > maxGramParsed.value) {
    errors.push("minGram, maxGram degerinden buyuk olamaz");
  }
  if (minPriceParsed.hasValue && maxPriceParsed.hasValue && minPriceParsed.value > maxPriceParsed.value) {
    errors.push("minPrice, maxPrice degerinden buyuk olamaz");
  }

  return {
    whereSql: where.join(" AND "),
    params,
    errors,
  };
}

function resolveOrderBy(sort) {
  const orderMap = {
    latest: "p.created_at DESC, p.id DESC",
    price_asc: "(p.gram * @pricePerGramTry * @priceFactor) ASC, p.id DESC",
    price_desc: "(p.gram * @pricePerGramTry * @priceFactor) DESC, p.id DESC",
    gram_asc: "p.gram ASC, p.id DESC",
    gram_desc: "p.gram DESC, p.id DESC",
  };
  return orderMap[sort] || orderMap.latest;
}

router.get("/categories", (_req, res) => {
  const rows = db.prepare(categoryQuery()).all();
  res.json({ items: rows });
});

router.get("/pricing", async (_req, res) => {
  const pricePerGramTry = await resolvePricePerGramTry();
  const { milyem, markupPercent, priceFactor } = getPricingSettings();
  res.json({
    pricePerGramTry,
    displayGramGoldTry: Math.round(pricePerGramTry * (1 + markupPercent / 100)),
    priceFactor,
    settings: { milyem, markupPercent },
    currency: "TRY",
  });
});

router.get("/home", async (_req, res) => {
  const pricePerGramTry = await resolvePricePerGramTry();
  const { milyem, markupPercent, priceFactor } = getPricingSettings();
  const categories = db.prepare(categoryQuery()).all();
  const latestRows = db
    .prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.category_slug,
        c.name AS category_name,
        p.gram,
        p.image_path,
        p.stl_path,
        p.is_bestseller,
        p.created_at
      FROM products p
      LEFT JOIN categories c ON c.slug = p.category_slug
      WHERE p.is_active = 1
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT @latestLimit
    `)
    .all({ latestLimit: HOME_LATEST_LIMIT });

  const bestsellerRows = db
    .prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.category_slug,
        c.name AS category_name,
        p.gram,
        p.image_path,
        p.stl_path,
        p.is_bestseller,
        p.created_at
      FROM products p
      LEFT JOIN categories c ON c.slug = p.category_slug
      WHERE p.is_active = 1 AND p.is_bestseller = 1
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT @bestsellersLimit
    `)
    .all({ bestsellersLimit: HOME_BESTSELLERS_LIMIT });

  const stats = {
    productCount: db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active = 1").get().count,
    categoryCount: categories.length,
    stlCount: db.prepare("SELECT COUNT(*) AS count FROM products WHERE is_active = 1 AND stl_path != ''").get().count,
  };

  res.json({
    pricePerGramTry,
    displayGramGoldTry: Math.round(pricePerGramTry * (1 + markupPercent / 100)),
    settings: { milyem, markupPercent },
    currency: "TRY",
    categories,
    latest: latestRows.map((row) => mapProductRow(row, pricePerGramTry, priceFactor)),
    bestsellers: bestsellerRows.map((row) => mapProductRow(row, pricePerGramTry, priceFactor)),
    stats,
  });
});

router.get("/products", async (req, res) => {
  const {
    page = "1",
    limit = "12",
    sort = "latest",
  } = req.query;

  const allowedSorts = new Set(["latest", "price_asc", "price_desc", "gram_asc", "gram_desc"]);
  if (!allowedSorts.has(sort)) {
    return res.status(400).json({ error: "Gecersiz siralama tipi" });
  }

  const parsedLimit = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 24) {
    return res.status(400).json({ error: "limit 1 ile 24 arasinda olmali" });
  }
  const parsedPage = Number.parseInt(page, 10);
  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return res.status(400).json({ error: "page en az 1 olmali" });
  }

  const pageSize = parsedLimit;
  const pageNumber = parsedPage;
  const offset = (pageNumber - 1) * pageSize;
  const pricePerGramTry = await resolvePricePerGramTry();
  const { milyem, markupPercent, priceFactor } = getPricingSettings();
  const { whereSql, params, errors } = buildProductFilters(req.query, pricePerGramTry, priceFactor);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Gecersiz filtre degerleri", detail: errors.join("; ") });
  }
  const orderBy = resolveOrderBy(sort);

  const totalCount = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM products p
      WHERE ${whereSql}
    `)
    .get(params).count;

  const rows = db
    .prepare(`
      SELECT
        p.id,
        p.name,
        p.slug,
        p.category_slug,
        c.name AS category_name,
        p.gram,
        p.image_path,
        p.stl_path,
        p.is_bestseller,
        p.created_at
      FROM products p
      LEFT JOIN categories c ON c.slug = p.category_slug
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT @pageSize OFFSET @offset
    `)
    .all({
      ...params,
      pageSize,
      offset,
    });

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  res.json({
    items: rows.map((row) => mapProductRow(row, pricePerGramTry, priceFactor)),
    page: pageNumber,
    pageSize,
    totalCount,
    totalPages,
    hasMore: pageNumber < totalPages,
    pricePerGramTry,
    displayGramGoldTry: Math.round(pricePerGramTry * (1 + markupPercent / 100)),
    settings: { milyem, markupPercent },
    currency: "TRY",
  });
});

module.exports = router;
