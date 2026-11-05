# PROGRESS – Gönülmax (kaldığın yerden devam dosyası)

> DEVAM KURALI: Yeni oturumda ÖNCE bu dosyayı oku, sonra `scentmax_notlar.md`. "SIRADAKİ ADIM"dan devam et. Her adım bitince bu dosyayı güncelle. Bağlam/limit %95'e yaklaşırsa: bitmiş işi kaydet, "YARIM KALAN"a yaz, dur.

## Proje
- Kullanıcı kendisi ve arkadaşları için istiyor. Mağaza YOK, bilgisayar YOK (kullanıcı yalnızca telefondan çalışıyor).
- ScentMax'in işlevleri (koleksiyon, günlük hava-durumu seçimi, skor, giyme takibi), ÖZGÜN ad ve tasarımla. ScentMax marka varlıkları kopyalanmadı/kopyalanmayacak.
- Plan doc'u: https://claude.ai/artifact/1dSe4PPu44i796x5DV5U8o (doc id 05169386-dea8-4871-9bcc-c6206fda3df0). DİKKAT: doc hâlâ "Supabase + davet kodu" mimarisini anlatıyor; aşağıdaki karar değişikliği henüz doc'a işlenmedi.

## KARAR DEĞİŞİKLİĞİ (bu oturum)
Kullanıcı bilgisayarı olmadığını söyledi; npm/PyPI de bu ortamda engelli. Bu yüzden mimari değişti:
- **Yerel-öncelikli, hesapsız, paket gerektirmeyen PWA** (`web/`): saf HTML + CSS + ES modülleri. Veri her kişinin kendi cihazında (localStorage); yedek al / geri yükle var. Arkadaşlar birbirinin verisini görmez.
- Supabase (`supabase/migrations/0001_init.sql`), davet kodu ve sosyal akış: ERTELENDİ. SQL dosyası duruyor ama hiç çalıştırılmadı/doğrulanmadı; şu an KULLANILMIYOR.
- AI asistan: ertelendi (`app/src/features/assistant/types.ts` boş arayüz; `FEATURES.assistant=false`).

## Kararlar
| Konu | Durum |
| --- | --- |
| Ad | KESİN: Gönülmax |
| Dil | KESİN: Türkçe + İngilizce (`web/js/i18n.js`) |
| Katalog | 76 parfüm, elle derlenmiş, değerler YAKLAŞIK tahmin (`web/js/catalog.js`); kazıma yok; kullanıcı eksikleri uygulamadan ekler |
| Veri | Yalnızca cihazda (localStorage `gonulmax:v1`) |
| Hava durumu | Open-Meteo (tarayıcıdan, anahtarsız); alınamazsa mevsimlik yedek değer |
| Hesap/senkron/sosyal | YOK (v2 adayı) |
| AI | Ertelendi |

## Dosya haritası
- `app/src/core/*.ts` – KAYNAK: günlük seçim, skor, seri, tarih, mevsim (saf TS) + `*.test.ts` (39 test). Çalıştır: `node --test app/src/core/*.test.ts`
- `app/src/config.ts` – ad, özellik bayrakları
- `tools/build.mjs` – TS → `web/js/core/*.js` ve `web/js/config.js` üretir (`node tools/build.mjs`). `web/js/core/*` ve `web/js/config.js` OTOMATİK ÜRETİLİR, elle düzenleme.
- `web/` – yayınlanacak uygulama: `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js` (çevrimdışı), `icons/`, `js/app.js` (ekranlar), `js/store.js` (doğrulamalı depo), `js/weather.js`, `js/catalog.js`, `js/i18n.js`
- `tools/make-icons.mjs` – ikonları üretir (Playwright)
- `tools/e2e.mjs` – tarayıcı uçtan uca testi: `NODE_PATH=$(npm root -g) node tools/e2e.mjs [ekran-klasörü]`

## Doğrulananlar (SON DURUM)
- Çekirdek birim testleri: 39/39 geçti.
- Tarayıcı (Chromium, 390x844) uçtan uca: 15/15 adım geçti, konsolda hata yok. Kapsam: karşılama, Türkçe karakterli arama (hermes→Hermès), koleksiyona ekleme, sahte saat + sahte hava ile yaz öğleden sonrası (Light Blue öne çıkar) ve kış gecesi (Tobacco Vanille öne çıkar), giydim/geri al/çift dokunma, seri, skor, özel parfüm formu ve doğrulama hataları, yedek al → sil → geri yükle, bozuk yedek reddi, dil değişimi, çevrimdışı açılış (service worker), hava durumu yokken yedek değer ve sonsuz istek döngüsü yok, bozuk localStorage.
- Ekran görüntüleri incelendi: düzen temiz.

## Doğrulanmayanlar / dikkat
- Gerçek iPhone/Android cihazda denenmedi (ana ekrana ekleme, tam ekran, klavye davranışı). iPhone'da bildirim (Web Push) YAPILMADI.
- Konum izni akışı gerçek cihazda denenmedi (testte yalnızca "konum yok → İstanbul" yolu).
- Katalog değerleri (mevsim/yoğunluk/ortam) aile şablonundan türetilmiş tahmin; gerçek koku özellikleriyle birebir değil.
- Algoritma ağırlıkları varsayım; gerçek kullanımla ayarlanmalı.
- Barındırma: uygulama henüz bir adreste YAYINDA DEĞİL (bkz. SIRADAKİ ADIM).
- `0001_init.sql` hiç çalıştırılmadı.

## YARIM KALAN
KATALOG GENİŞLETME (2026-11-05): kullanıcı Boyner+Sephora TR+Beymen'deki TÜM erkek/unisex parfümleri istiyor (boyut tekrarı yok; EDP/EDT/Parfum ayrı satır). Plan: 3 ajan ham TSV üretir -> scratchpad/raw_{sephora,boyner,beymen}.tsv (brand,name,concentration,gender,url) -> birleştir/dedupe -> web/js/catalog.js yeniden üret (aile/mevsim tahmini işaretli) -> sw.js cache bump, build, docs, test, push. Sephora erkek=473 ürün (24/sayfa), Beymen erkek=3162 (?sayfa=N), Boyner ?-sayfalama.

## YAYIN DURUMU (2026-11-04)
- GitHub hesabı bağlandı: kullanıcı `kvrck69`. Oturum yeni depo OLUŞTURAMIYOR (403: "sessions are bound to their configured repositories"); `list_repos` boş.
- Kullanıcıdan istenen: GitHub'da BOŞ, herkese açık bir depo açması (önerilen ad: `gonulmax`, README/lisans ekleme). Sonra `add_repo` ile oturuma ekle (access: push), `/home/claude/gonulmax` içeriğini push et, Pages'i `main` dalı `/docs` klasöründen aç (REST: POST repos/{owner}/{repo}/pages), adres: https://kvrck69.github.io/gonulmax/
- `docs/` = `web/` kopyası (Pages /docs'tan sunar). `web/` veya çekirdek değişince: `node tools/build.mjs && rm -rf docs && cp -r web docs`, sonra push.
- GitHub GraphQL kapalı; yalnızca REST (`gh api repos/...`).

- 2026-11-04 14:55: Kullanıcı boş `kvrck69/gonulmax` deposunu açtı, `add_repo` ile oturuma eklendi, klon `/home/claude/gm-repo` (NOT: `/home/claude/gonulmax` proje klasörü, klonla karıştırma). Commit hazır (652c31d) ama `git push` 403: "Claude doesn't have GitHub access to kvrck69/gonulmax". ÇÖZÜM: kullanıcı Claude GitHub uygulamasını yüklemeli: https://github.com/apps/claude/installations/select_target (hesap: kvrck69, depo: gonulmax). Sonra: `cd /home/claude/gm-repo && git push -u origin main`, ardından Pages (main, /docs).

- 2026-11-04 14:58: Claude GitHub uygulaması yüklendi, push BAŞARILI (main, 2 commit). Pages API'si proxy'de engelli (403) → kullanıcı Pages'i elle açmalı: depo → Settings → Pages → Source "Deploy from a branch" → Branch `main`, klasör `/docs` → Save. Adres: https://kvrck69.github.io/gonulmax/ (1-2 dk sonra). Açılınca: tarayıcıda test et (index, sw.js, manifest, konum, hava durumu).

## SIRADAKİ ADIM
0. (YUKARIDAKİ YAYIN DURUMU) depo → push → Pages → adresi test et (tarayıcıda aç, sw.js ve manifest 200 dönüyor mu).
1. Yayınlama: kullanıcı bilgisayarsız. Seçenekler: (a) Artifact olarak yayınla (claude.ai sayfası), (b) GitHub Pages (kullanıcının GitHub deposu/izni gerekir), (c) Netlify/Cloudflare Pages'e telefondan yükleme.
2. Kullanıcıdan gerçek cihaz geri bildirimi al (ekran görüntüsü/hata), düzelt.
3. İstek varsa: kataloğu büyüt (kullanıcı onayıyla), sosyal/senkron (Supabase) v2, AI asistan.
4. Plan doc'unu bu mimariye göre güncelle.

## Günlük
- Plan doc'u yazıldı, web/PWA'ya revize edildi.
- Kararlar: Gönülmax, TR+EN, elle katalog, AI ertelendi.
- npm/PyPI engeli; çekirdek algoritmalar + SQL yazıldı (39 test).
- Kullanıcı "bilgisayar yok" dedi → paket gerektirmeyen yerel-öncelikli PWA yazıldı, tarayıcıda test edildi (15/15).

## KATALOG GENİŞLETME (2026-11-05)
- İstek: Boyner+Sephora+Beymen erkek/unisex tüm parfümler; aynı parfümün ml'leri tek, EDP/EDT vb. ayrı.
- BEYMEN BİTTİ: 3161 liste satırı çekildi → temizlenip birleştirildi → 2376 benzersiz parfüm (161 marka; 1831 m / 545 u; 608'inde konsantrasyon boş). Dosya: scratchpad/raw_beymen.tsv (build.py ile üretilir). Katalog dosyasına HENÜZ aktarılmadı (web/js/catalog.js hâlâ 76).
- KULLANICI: Beymen sonrası DUR, onay bekle. Sonra Sephora (473) ve Boyner.
- 2026-11-06: 3 mağaza birleştirildi → tools/catalog-merged.json (3472; Beymen 2376 + Sephora 237 yeni + Boyner 859 yeni; çapraz-mağaza tekilleştirme) → tools/make-catalog.py → web/js/catalog-data.js (3353 satır, boş-konsantrasyon yinelemeleri elendi) ; catalog.js 76 elle + toplu = 3339 benzersiz. Aile/yoğunluk/durum TAHMİN (addan anahtar kelime + konsantrasyon). Arayüz: "Daha fazla göster" sayfalama. sw cache v2. Testler: 39 birim + 15 e2e geçti.
- Eksikler: Sephora yalnızca 390 satır (site 473 ürün diyor); gerçek koku aileleri/notaları yok; Boyner'de adı belirsiz ("Erkek Parfüm") 88 ürün atlandı.
