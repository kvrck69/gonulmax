// Uygulamanın tek ayar noktası. Ad değişirse yalnızca burası değişir.

export const APP_NAME = 'Gönülmax';

export const SUPPORTED_LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

/** Yaklaşık konum: koordinatlar sunucuya bu kadar ondalıkla gider (2 ondalık ≈ 1 km). */
export const LOCATION_DECIMALS = 2;

/** Konum yoksa varsayılan şehir (kullanıcı değiştirir). */
export const FALLBACK_CITY = { name: 'İstanbul', latitude: 41.01, longitude: 28.98, timeZone: 'Europe/Istanbul' } as const;

/** AI asistan kapalı; açılınca true yapılır (ve Edge Function ile limit eklenir). */
export const FEATURES = {
  assistant: false,
  social: false,
} as const;
