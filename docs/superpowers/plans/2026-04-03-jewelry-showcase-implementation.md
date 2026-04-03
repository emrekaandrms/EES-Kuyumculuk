# Jewelry Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shared hosting uyumlu Node.js uygulamasında premium takı vitrinini, admin panelini, SQLite veri katmanını, TRY dinamik fiyatı ve STL görüntüleyiciyi devreye almak.

**Architecture:** Express tabanlı tek süreç uygulama; API + statik frontend birlikte servis edilir. Ürün ve kategori verisi SQLite üzerinde tutulur. Frontend katalog ekranı sonsuz kaydırma, filtreleme ve modal STL görüntüleme içerir.

**Tech Stack:** Node.js, Express, better-sqlite3, express-session, multer, Three.js

---

### Task 1: Proje iskeleti ve bağımlılıklar

**Files:**
- Create: `package.json`
- Create: `src/server.js`
- Create: `src/db.js`
- Create: `src/pricing.js`
- Create: `src/seed.js`

- [ ] `npm init` ve temel bağımlılıkları kur.
- [ ] Çalıştırma komutlarını (`start`, `dev`) tanımla.
- [ ] Sunucu açılışında SQLite dosyasını ve temel tabloları hazırla.

### Task 2: API ve admin endpoint'leri

**Files:**
- Create: `src/routes/api.js`
- Create: `src/routes/admin.js`
- Modify: `src/server.js`

- [ ] Ürün listeleme endpoint'inde cursor + filtreleri uygula.
- [ ] Fiyat bilgisi endpoint'inde cache'li TRY hesaplamayı sun.
- [ ] Admin login/logout ve CRUD endpoint'lerini ekle.
- [ ] Upload endpoint'i için whitelist ve boyut limiti ekle.

### Task 3: Frontend premium katalog

**Files:**
- Replace: `index.html`
- Create: `public/app.js`
- Create: `public/styles.css`

- [ ] Hero, koleksiyon, about bölümlerini premium koyu temada tasarla.
- [ ] Filtre paneli + sonsuz kaydırma + kategori sekmelerini ekle.
- [ ] Ürün kartında görsel, isim, gram, TRY fiyat ve STL butonunu bağla.

### Task 4: Three.js STL viewer ve mikro animasyonlar

**Files:**
- Modify: `public/app.js`
- Modify: `index.html`
- Modify: `public/styles.css`

- [ ] Hero için hafif 3D dekoratif katman (dikkat dağıtmayan) kur.
- [ ] Modal tabanlı STL viewer (lazy init) ekle.
- [ ] Hover, fade ve geçiş animasyonlarını premium histe tamamla.

### Task 5: Doğrulama ve çalıştırma

**Files:**
- Modify: `README.md` (varsa oluştur)

- [ ] Uygulamayı lokal aç ve endpoint'leri test et.
- [ ] Admin panelinden ürün ekleyip katalogda göründüğünü doğrula.
- [ ] TRY fiyatın dinamik güncellendiğini doğrula (API + fallback).
