# EES Kuyumculuk — Premium Vitrin Sitesi Tasarım Spesifikasyonu

**Tarih:** 2026-04-03  
**Durum:** Onay bekliyor (implementasyondan önce)

## 1. Amaç

Yüksek kaliteli, koyu temalı, lüks ve minimal bir **görsel katalog** sitesi. E-ticaret yok (sepet, ödeme, ürün detay sayfası yok). Ziyaretçiyi tasarım, hareket ve premium estetik ile etkilemek.

## 2. Tasarım Dili

- **Renk:** Siyah, kömür, derin gri; altın vurgular; tipografi için yumuşak beyaz/off-white.
- **Tipografi:** Serif (başlıklar) + modern sans-serif (gövde) — rafine, pahalı hissi.
- **Stil sınırları:** Neon, cyberpunk, futuristik UI yok. Parıltı abartısı yok; ince hover ve yansıma.

## 3. Bilgi Mimarisi ve Sayfalar

| Bölüm | İçerik |
|--------|--------|
| **Home** | Hibrit hero: sinematik fotoğraf + ince Three.js katmanı (yavaş, dikkat dağıtmayan). Kısa marka hikayesi. |
| **Collection** | Sonsuz kaydırmalı katalog; filtreler; URL ile paylaşılabilir durum. |
| **Kategori** | `/collection/:slug` — yüzük, küpe, bileklik ve diğer kategoriler; aynı filtre mantığı. |
| **About** | Butik, sakin anlatım. |
| **Navigasyon** | Minimal: Home, Collection, About (+ kategori erişimi collection içinden veya alt menü). |

## 4. Katalog Kartı (ürün detayına gitmeden)

Her kartta:

- Görsel
- Ürün adı
- Gram
- **TRY** cinsinden dinamik fiyat (sunucu tarafından hesaplanmış veya tutarlı formülle)

Tıklama **ürün detay sayfasına yönlendirmez**; isteğe bağlı: STL varsa “3D İncele” ile modal.

## 5. Filtreleme ve Sıralama

- **Filtreler:** Kategori, gram aralığı, fiyat aralığı (TRY).
- **Sıralama:** Yeniden eskiye (`created_at` azalan).
- **Sonsuz kaydırma:** Cursor tabanlı API; sayfa başına ~24 ürün (mobilde 12’ye indirilebilir).
- Filtre durumu **URL query** ile saklanır (ör. paylaşılabilir link).

## 6. Fiyatlandırma

- **İlk aşama:** Uluslararası altın fiyat kaynağı + kur ile **yalnızca TRY** gösterimi.
- **Gelecek:** Harem Altın API entegrasyonu (aynı arayüz; fiyat servisi değiştirilebilir).
- Sunucu, altın/kur verisini **kısa süreli cache** ile tutar; istemci her kart için ağır hesap yapmaz.

## 7. Üç Boyut

- **Three.js:** Hero’da hafif 3D (ör. dönen yüzük silüeti / yansıma), yavaş animasyon.
- **STL:** Ürün bazlı; `STLLoader` ile modal içinde önizleme; yalnız modal açıldığında init (performans).
- **3DM:** Bu fazda yok; ileride ayrı karar (dönüştürme veya harici pipeline).

## 8. Admin Panel

- Yol: `/admin` (session ile korunur).
- **Ürün:** CRUD — ad, slug, kategori, gram, görsel yolu, STL yolu (opsiyonel), aktif/pasif, oluşturulma tarihi.
- **Kategori:** CRUD — ad, slug, sıra.
- **Yükleme:** Whitelist (ör. jpg, png, webp, stl); boyut limiti; güvenli dosya adı.
- **Güvenlik:** httpOnly cookie, `SESSION_SECRET`, admin şifre hash; admin route’larda basit rate limit.

## 9. Veri Katmanı (Shared Hosting, Harici DB Yok)

- **SQLite** tek dosya: `/data/catalog.db` (veya proje köküne göre yapılandırılabilir).
- **Gerekçe:** 500+ ürün için JSON’dan daha güvenli sorgu ve tutarlılık; filtre/sıralama/sonsuz kaydırma için uygun; sunucu yükü düşük.
- **Yedek:** `catalog.db` ve `uploads/` düzenli yedeklenmeli; deploy sırasında üzerine yazılmamalı.

## 10. API Özeti (REST, JSON)

| Metod | Yol | Açıklama |
|--------|-----|----------|
| GET | `/api/products` | Cursor, filtreler (kategori, gram, min/max fiyat TRY), `sort=created_at_desc` |
| GET | `/api/categories` | Kategori listesi |
| GET | `/api/pricing` | Cache’li gram altın TRY veya çarpan bilgisi |
| POST | `/api/admin/login` | Oturum |
| * | `/api/admin/*` | Ürün/kategori yönetimi (oturum gerekli) |
| POST | `/api/admin/upload` | Görsel / STL |

Fiyat filtresi sunucuda, o anki TRY birim fiyatı ile `gram * unitTry` tutarlılığıyla uygulanır.

## 11. Teknik Stack (Hedef)

- **Backend:** Node.js (Express veya Fastify), SQLite (better-sqlite3 veya sqlite3).
- **Frontend:** Modern SPA veya SSR hafif seçenek (Vite + React önerilir); statik çıktı `public/` altında servis edilir.
- **Three.js:** Hero ve STL modal.
- **SEO:** Gerekli değil (bilinçli olarak düşük öncelik).

## 12. Performans ve Hosting

- Shared hosting uyumlu: tek Node süreç, statik varlıklar CDN’siz de verilebilir.
- Liste görselleri lazy load; Three.js ağır sahneler tek instance veya görünürdeyken mount.
- 500 ürün için cursor + indeksli SQLite sorguları.

## 13. Bilinçli Olmayanlar (Bu Faz)

- E-ticaret, kullanıcı girişi (müşteri), SEO odaklı yapı.
- Supabase veya ücretsiz harici DB zorunluluğu.
- 3DM yerel görüntüleyici.

## 14. Açık Noktalar (Implementasyon Öncesi)

- Uluslararası altın API sağlayıcısı ve kur kaynağı (ortam değişkenleri).
- Admin ilk şifre kurulumu (env veya tek seferlik setup).
- Reverse proxy / SSL shared hosting dokümantasyonuna göre ayar.

---

**Onay:** Bu doküman, kullanıcı tarafından gözden geçirilip onaylandıktan sonra implementasyon planına (`docs/superpowers/plans/`) dönüştürülür.
