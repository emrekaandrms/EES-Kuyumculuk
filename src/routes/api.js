const express = require("express");
const { db } = require("../db");
const { resolvePricePerGramTry } = require("../pricing");

const router = express.Router();

router.get("/categories", (_req, res) => {
  const rows = db
    .prepare("SELECT slug, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC")
    .all();
  res.json({ items: rows });
});

router.get("/pricing", async (_req, res) => {
  const pricePerGramTry = await resolvePricePerGramTry();
  res.json({ pricePerGramTry, currency: "TRY" });
});

router.get("/products", async (req, res) => {
  const {
    category = "all",
    minGram = "",
    maxGram = "",
    minPrice = "",
    maxPrice = "",
    cursorCreatedAt = "",
    cursorId = "",
    limit = "24",
  } = req.query;

  const pageSize = Math.min(Math.max(Number.parseInt(limit, 10) || 24, 1), 48);
  const pricePerGramTry = await resolvePricePerGramTry();

  const where = ["is_active = 1"];
  const params = {};

  if (category !== "all") {
    where.push("category_slug = @category");
    params.category = category;
  }

  if (minGram !== "") {
    where.push("gram >= @minGram");
    params.minGram = Number(minGram);
  }
  if (maxGram !== "") {
    where.push("gram <= @maxGram");
    params.maxGram = Number(maxGram);
  }

  if (minPrice !== "") {
    where.push("(gram * @pricePerGramTry) >= @minPrice");
    params.minPrice = Number(minPrice);
  }
  if (maxPrice !== "") {
    where.push("(gram * @pricePerGramTry) <= @maxPrice");
    params.maxPrice = Number(maxPrice);
  }

  params.pricePerGramTry = pricePerGramTry;

  if (cursorCreatedAt && cursorId) {
    where.push("(created_at < @cursorCreatedAt OR (created_at = @cursorCreatedAt AND id < @cursorId))");
    params.cursorCreatedAt = cursorCreatedAt;
    params.cursorId = Number(cursorId);
  }

  const sql = `
    SELECT id, name, slug, category_slug, gram, image_path, stl_path, created_at
    FROM products
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC, id DESC
    LIMIT @pageSize
  `;

  const rows = db.prepare(sql).all({ ...params, pageSize });
  const items = rows.map((row) => ({
    ...row,
    priceTry: Math.round(row.gram * pricePerGramTry),
  }));

  const last = rows[rows.length - 1];
  res.json({
    items,
    nextCursor: last ? { createdAt: last.created_at, id: last.id } : null,
    pricePerGramTry,
  });
});

module.exports = router;
