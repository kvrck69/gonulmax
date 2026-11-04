// OTOMATİK ÜRETİLDİ: app/src/config.ts dosyasından. Elle düzenleme; kaynağı değiştirip `node tools/build.mjs` çalıştır.
// Uygulamanın tek ayar noktası. Ad değişirse yalnızca burası değişir.

export const APP_NAME = 'Gönülmax';

export const SUPPORTED_LOCALES = ['tr', 'en']         ;
                                                        
export const DEFAULT_LOCALE         = 'tr';

/** Yaklaşık konum: koordinatlar sunucuya bu kadar ondalıkla gider (2 ondalık ≈ 1 km). */
export const LOCATION_DECIMALS = 2;

/** Konum yoksa varsayılan şehir (kullanıcı değiştirir). */
export const FALLBACK_CITY = { name: 'İstanbul', latitude: 41.01, longitude: 28.98, timeZone: 'Europe/Istanbul' }         ;

/** AI asistan kapalı; açılınca true yapılır (ve Edge Function ile limit eklenir). */
export const FEATURES = {
  assistant: false,
  social: false,
}         ;
