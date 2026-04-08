const fs = require("fs");
const path = require("path");
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const { initDb } = require("./db");
const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");

const app = express();
const requiredEnv = ["SESSION_SECRET", "ADMIN_PASSWORD"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.set("trust proxy", 1);
}

/**
 * Secure cerez sadece acikca acilir. NODE_ENV=production + http://localhost cok kullaniliyor;
 * otomatik secure=true bu durumda cerezi tamamen devre disi birakiyordu (401).
 * Canli HTTPS: .env icine SESSION_COOKIE_SECURE=true ekleyin.
 */
function sessionCookieSecure() {
  const v = String(process.env.SESSION_COOKIE_SECURE ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

const port = Number(process.env.PORT || 3000);

initDb();

["uploads/images", "uploads/models", "uploads/temp", "public/placeholders"].forEach((dir) => {
  const abs = path.join(process.cwd(), dir);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(abs, { recursive: true });
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    name: "ees.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: sessionCookieSecure(),
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  })
);
app.use((_req, res, next) => {
  res.setHeader(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate, max-snippet:0, max-image-preview:none, max-video-preview:0"
  );
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/Urunler", express.static(path.join(process.cwd(), "Urunler")));
app.use("/public", express.static(path.join(process.cwd(), "public")));
app.use("/vendor/three", express.static(path.join(process.cwd(), "node_modules", "three")));

app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "admin.html"));
});

function sendStorefront(_req, res) {
  res.sendFile(path.join(process.cwd(), "index.html"));
}

app.get(["/", "/koleksiyon", "/kategori/:slug"], sendStorefront);

app.listen(port, () => {
  const env = process.env.NODE_ENV || "development";
  console.log(`Jewelry showcase app running on http://localhost:${port} (${env})`);
  if (isProduction && !sessionCookieSecure()) {
    console.warn(
      "[session] SESSION_COOKIE_SECURE=true degil — cerezler HTTP uzerinden de gider (yerel http:// icin uygun). Canli HTTPS'te guvenlik icin .env'e SESSION_COOKIE_SECURE=true ekleyin."
    );
  }
});
