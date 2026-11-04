// Saf (bağımsız) çekirdek: tarayıcı, Supabase veya paket gerektirmez.
// Yalnızca "silinebilir" TypeScript sözdizimi kullanılır (enum yok), böylece
// Node'un yerleşik tür soyma özelliğiyle doğrudan test edilebilir.

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type DayPart = 'day' | 'night';

export const SEASONS: readonly Season[] = ['winter', 'spring', 'summer', 'autumn'];
export const DAY_PARTS: readonly DayPart[] = ['day', 'night'];

export const FAMILIES = [
  'citrus',
  'aquatic',
  'green',
  'aromatic',
  'floral',
  'woody',
  'chypre',
  'leather',
  'oriental',
  'gourmand',
] as const;
export type Family = (typeof FAMILIES)[number];

export const OCCASIONS = ['office', 'casual', 'sport', 'date', 'night_out', 'formal'] as const;
export type Occasion = (typeof OCCASIONS)[number];

/** Katalogdaki bir parfüm. Tüm yakınlık değerleri 0-1 aralığındadır. */
export interface Fragrance {
  id: string;
  brand: string;
  name: string;
  family: Family;
  niche: boolean;
  seasons: Record<Season, number>;
  dayParts: Record<DayPart, number>;
  /** 1 (çok hafif) ... 5 (çok yoğun) */
  intensity: number;
  occasions: readonly Occasion[];
}

export interface Weather {
  tempC: number;
  /** 0-100 */
  humidityPct: number;
  /** son saat/gün yağış miktarı, mm; 0 = yağış yok */
  precipitationMm: number;
}
