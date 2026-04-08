const fs = require("fs");
const path = require("path");

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp)$/i;
const OUTPUT_DIR = path.join(process.cwd(), "exports");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "products-from-folders.csv");

function csvEscape(value) {
  const raw = String(value ?? "");
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function normalizeCollectionName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function parseWeightFromBaseName(baseName) {
  // Ornekler:
  // GEO-001 - 2,30gr
  // HYZ-037-2,05
  // HYZ-230-1,95 gr
  // GEO-098 - 4,28gr(F)
  // HYZ-382 - 1,81r
  const match = baseName.match(/(\d+[.,]\d+)\s*(?:gr|r)?(?:\s*\([^)]*\))?$/i);
  if (!match) return null;
  const gram = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(gram) || gram <= 0) return null;
  return Number(gram.toFixed(2));
}

function parseCodeFromBaseName(baseName, collectionUpper) {
  const escapedCollection = collectionUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escapedCollection}\\s*-?\\s*(\\d+)`, "i");
  const match = baseName.match(re);
  if (!match) return null;
  return match[1].padStart(3, "0");
}

function makeProductRow(collectionName, fileName) {
  const collectionUpper = String(collectionName).toUpperCase();
  const productSlugPrefix = normalizeCollectionName(collectionName);
  const collectionSlug = "rings";
  const ext = path.extname(fileName);
  const baseName = fileName.slice(0, -ext.length).trim();

  const code = parseCodeFromBaseName(baseName, collectionUpper);
  const gram = parseWeightFromBaseName(baseName);
  if (!code || !gram) return null;

  const slug = `${productSlugPrefix}-${code}`;
  const displayName = `${collectionUpper} ${code}`;
  const imagePath = `/Urunler/${collectionName}/${fileName}`.replaceAll("\\", "/");

  return {
    slug,
    name: displayName,
    category_slug: collectionSlug,
    gram: gram.toFixed(2),
    image_path: imagePath,
    stl_path: "",
    is_active: "1",
  };
}

function run() {
  const root = process.cwd();
  const urunlerDir = path.join(root, "Urunler");
  if (!fs.existsSync(urunlerDir)) {
    throw new Error("Urunler klasoru bulunamadi.");
  }

  const collections = fs
    .readdirSync(urunlerDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => ["GEO", "HYZ"].includes(name.toUpperCase()));

  if (collections.length === 0) {
    throw new Error("Urunler altinda GEO/HYZ klasorleri bulunamadi.");
  }

  const rows = [];
  const skipped = [];

  for (const collectionName of collections) {
    const collectionPath = path.join(urunlerDir, collectionName);
    const files = fs
      .readdirSync(collectionPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "tr"));

    for (const fileName of files) {
      const row = makeProductRow(collectionName, fileName);
      if (!row) {
        skipped.push({ collection: collectionName, fileName, reason: "Dosya adi parse edilemedi" });
        continue;
      }
      rows.push(row);
    }
  }

  // Slug benzersizligi: ayni slug gelirse sonrakilere -2, -3 ekle
  const slugCounter = new Map();
  for (const row of rows) {
    const count = (slugCounter.get(row.slug) || 0) + 1;
    slugCounter.set(row.slug, count);
    if (count > 1) {
      row.slug = `${row.slug}-${count}`;
      row.name = `${row.name} (${count})`;
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const header = ["slug", "name", "category_slug", "gram", "image_path", "stl_path", "is_active"];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key])).join(","));
  }
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");

  const report = {
    outputFile: OUTPUT_FILE,
    collections,
    totalRows: rows.length,
    skippedCount: skipped.length,
    skippedPreview: skipped.slice(0, 20),
  };
  console.log(JSON.stringify(report, null, 2));
}

run();
