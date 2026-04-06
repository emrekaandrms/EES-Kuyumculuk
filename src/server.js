const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const { initDb } = require("./db");
const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");

const app = express();
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
    secret: process.env.SESSION_SECRET || "local-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  })
);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/public", express.static(path.join(process.cwd(), "public")));

app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "admin.html"));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

app.listen(port, () => {
  console.log(`Jewelry showcase app running on http://localhost:${port}`);
});
