# EES Kuyumculuk Showcase

Node.js + SQLite tabanli premium takı vitrin uygulamasi.

## Kurulum

```bash
npm install
npm run seed
npm start
```

## URL'ler

- Site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

Varsayilan admin sifresi: `admin123` (`ADMIN_PASSWORD` ile degistirin).

Admin: sol menuden **Urunler** / **Kategoriler**; gorsel ve STL **dosya sec** ile yuklenir, yol otomatik dolar. Listede **Duzenle** / **Sil**.

### CSV ile toplu urun

- Sablon: `public/templates/urun-import-sablonu.csv` veya admin icinden indirme linki.
- Kolonlar: `slug`, `name`, `category_slug`, `gram`, `image_path`, `stl_path`, `is_active`
- Ayni **slug** varsa satir **guncellenir**, yoksa **yeni** kayit eklenir.
- `category_slug` veritabaninda tanimli bir kategori olmali (once Kategoriler).
- Yukleme hatasi: sunucunun calistigindan emin olun (`npm start`), oturum suresi dolmus olabilir — tekrar giris.

## Ortam Degiskenleri

- `PORT`
- `SESSION_SECRET`
- `ADMIN_PASSWORD`

## Notlar

- STL dosyalari: `uploads/models`
- Gorseller: `uploads/images`
- SQLite veritabani: `data/catalog.db`
