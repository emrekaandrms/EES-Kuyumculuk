# EES Kuyumculuk Showcase

Node.js + SQLite tabanli premium taki vitrin uygulamasi.

## Kurulum

```bash
npm install
cp .env.example .env
# .env icini doldur
npm run seed
npm start
```

## URL'ler

- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

Admin: sol menuden **Urunler** / **Kategoriler**; gorsel ve STL **dosya sec** ile yuklenir, yol otomatik dolar. Listede **Duzenle** / **Sil**.

### CSV ile toplu urun

- Sablon: `public/templates/urun-import-sablonu.csv` veya admin icinden indirme linki.
- Kolonlar: `slug`, `name`, `category_slug`, `gram`, `image_path`, `stl_path`, `is_active`
- Ayni **slug** varsa satir **guncellenir**, yoksa **yeni** kayit eklenir.
- `category_slug` veritabaninda tanimli bir kategori olmali (once Kategoriler).

### Urunler klasorunden otomatik CSV

- Kaynak klasorler: `Urunler/GEO`, `Urunler/HYZ`
- Calistir:

```bash
npm run build:products-csv
```

- Cikti: `exports/products-from-folders.csv`
- Parser dosya adindan kod + gram ceker (ornek: `GEO-001 - 2,30gr.jpg`, `HYZ-037-2,05.jpg`, `...gr(F)`).
- CSV import etmeden once adminde `geo` ve `hyz` kategori sluglarini olusturun.

## Ortam Degiskenleri

Asagidaki degiskenler zorunludur:

- `SESSION_SECRET`: En az 32 karakterlik rastgele deger
- `ADMIN_PASSWORD`: Guclu admin sifresi

Opsiyonel:

- `PORT`: Varsayilan `3000`
- `NODE_ENV`: Production ortaminda `production`
- `SESSION_COOKIE_SECURE`: Canli HTTPS ortaminda `true` yapin (Secure cerez; yerelde gerekmez)

## Fiyat Hesaplama

- Vitrin fiyati admin ayarlarina gore hesaplanir:
  - `fiyat = gram × gram_altin(24k) × (milyem / 1000) × (1 + tolerans / 100)`
- Admin panelindeki **Fiyat ayarlari** bolumunden:
  - `milyem` (ornek: 585, 750, 1000)
  - `Altin fiyat toleransi (%)`
  degerleri guncellenebilir.
- **Cok satanlar** alani, admin urun formundaki `Cok satanlar bolumunde goster` isaretiyle belirlenir.

## Hostinger Production Checklist

### 1) Uygulama ve domain

- Domaini Node app'e bagla.
- Uygulama root'u proje dizini olacak sekilde ayarla.
- Start command: `npm start`
- Node surumunu LTS (18+ veya 20+) sec.

### 2) SSL

- Hostinger SSL'i aktif et.
- HTTP -> HTTPS yonlendirmesi acik olsun.
- Tarayicida sertifika uyarisiz acildigini kontrol et.

### 3) Guvenlik

- Guclu `SESSION_SECRET` ve `ADMIN_PASSWORD` kullan.
- Admin panel URL'sini sadece bildigin musterilerle paylas.
- Login brute-force korumasi aktif (rate limit).
- Tum admin endpointleri rate limit altinda.
- Guvenlik header'lari aktif (`helmet`).
- Session cookie: canlida `SESSION_COOKIE_SECURE=true` ile `Secure` cerez (HTTPS).
- Arama motoru indeksleme kapali (`robots.txt`, meta robots, `X-Robots-Tag`).

### 4) Veri ve yedek

- `data/catalog.db` dosyasini periyodik yedekle.
- `uploads/` klasorunu (images/models) duzenli yedekle.
- Deploy oncesi son yedekten geri donus testi yap.

### 5) Operasyon

- Deploy sonrasi smoke test:
  - Anasayfa aciliyor mu?
  - Koleksiyon ve filtreler calisiyor mu?
  - Admin login calisiyor mu?
  - Urun ekleme/guncelleme/silme calisiyor mu?
- Loglarda 4xx/5xx artislarini izleyin.
- `npm audit` ve dependency update'i periyodik yapin.

## Notlar

- STL dosyalari: `uploads/models`
- Gorseller: `uploads/images`
- SQLite veritabani: `data/catalog.db`
