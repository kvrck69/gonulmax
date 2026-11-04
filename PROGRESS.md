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
(yok)

## YAYIN DURUMU (2026-11-04)
- GitHub hesabı bağlandı: kullanıcı `kvrck69`. Oturum yeni depo OLUŞTURAMIYOR (403: "sessions are bound to their configured repositories"); `list_repos` boş.
- Kullanıcıdan istenen: GitHub'da BOŞ, herkese açık bir depo açması (önerilen ad: `gonulmax`, README/lisans ekleme). Sonra `add_repo` ile oturuma ekle (access: push), `/home/claude/gonulmax` içeriğini push et, Pages'i `main` dalı `/docs` klasöründen aç (REST: POST repos/{owner}/{repo}/pages), adres: https://kvrck69.github.io/gonulmax/
- `docs/` = `web/` kopyası (Pages /docs'tan sunar). `web/` veya çekirdek değişince: `node tools/build.mjs && rm -rf docs && cp -r web docs`, sonra push.
- GitHub GraphQL kapalı; yalnızca REST (`gh api repos/...`).

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
