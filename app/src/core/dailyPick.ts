import { daysBetween } from './dates.ts';
import type { DayPart, Family, Fragrance, Season, Weather } from './types.ts';

/**
 * Günlük seçim puanı (0-100), plan 6. bölüm:
 *   P = 35·sıcaklık + 25·mevsim + 15·saat + 10·nem/yağış + 15·yenilik
 * Her bileşen 0-1 aralığındadır. Ağırlıklar ilk sürümde varsayımdır; beta verisiyle ayarlanır.
 */
export const WEIGHTS = {
  temperature: 35,
  season: 25,
  time: 15,
  humidity: 10,
  freshness: 15,
} as const;

/** 0 = çok ferah/serin, 1 = çok sıcak/ağır karakterli. */
export const FAMILY_WARMTH: Record<Family, number> = {
  citrus: 0.05,
  aquatic: 0.1,
  green: 0.2,
  aromatic: 0.35,
  floral: 0.4,
  woody: 0.6,
  chypre: 0.6,
  leather: 0.75,
  oriental: 0.9,
  gourmand: 0.95,
};

/** Bu kadar günden yeni giyilen parfümün yenilik puanı 0'dır. */
export const RECENT_WEAR_DAYS = 3;
/** Yenilik puanı bu kadar günde tam değere (1) ulaşır. */
export const FRESHNESS_FULL_DAYS = 14;

export interface PickContext {
  weather: Weather;
  season: Season;
  dayPart: DayPart;
  /** Kullanıcının yerel günü, "YYYY-MM-DD" */
  today: string;
  /** parfüm id -> en son giyildiği yerel gün ("YYYY-MM-DD"). Hiç giyilmediyse anahtar yoktur. */
  lastWornOn: Readonly<Record<string, string>>;
}

export interface PickBreakdown {
  temperature: number;
  season: number;
  time: number;
  humidity: number;
  freshness: number;
}

export interface ScoredPick {
  fragrance: Fragrance;
  /** 0-100, 2 ondalığa yuvarlanmış */
  score: number;
  breakdown: PickBreakdown;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be a finite number`);
}

/** Havaya göre istenen "sıcaklık karakteri": 26 °C ve üstü 0 (ferah), 8 °C ve altı 1 (sıcak/ağır). */
export function targetWarmth(tempC: number): number {
  assertFinite('tempC', tempC);
  return clamp01((26 - tempC) / (26 - 8));
}

/** Parfümün sıcaklık karakteri: aile (yüzde 70) + yoğunluk (yüzde 30). */
export function fragranceWarmth(fragrance: Fragrance): number {
  const intensity = clamp01((fragrance.intensity - 1) / 4);
  return 0.7 * FAMILY_WARMTH[fragrance.family] + 0.3 * intensity;
}

/**
 * Nem ve yağış etkisi: nem 60'ın üstüne çıktıkça (100'de tam) ağır parfümün puanı düşer.
 * Yağış varsa etki en az 0,5'tir.
 */
export function humidityScore(fragrance: Fragrance, weather: Weather): number {
  assertFinite('humidityPct', weather.humidityPct);
  assertFinite('precipitationMm', weather.precipitationMm);
  const humidFactor = clamp01((weather.humidityPct - 60) / 40);
  const factor = weather.precipitationMm > 0 ? Math.max(humidFactor, 0.5) : humidFactor;
  const heaviness = clamp01((fragrance.intensity - 1) / 4);
  return 1 - factor * heaviness;
}

/** Yenilik: hiç giyilmediyse 1; son 3 günde giyildiyse 0; sonra 14. güne kadar doğrusal artar. */
export function freshnessScore(
  fragranceId: string,
  today: string,
  lastWornOn: Readonly<Record<string, string>>,
): number {
  const last = lastWornOn[fragranceId];
  if (last === undefined) return 1;
  const days = daysBetween(last, today);
  if (days < RECENT_WEAR_DAYS) return 0;
  return clamp01(days / FRESHNESS_FULL_DAYS);
}

export function scoreFragrance(fragrance: Fragrance, context: PickContext): ScoredPick {
  const { weather, season, dayPart, today, lastWornOn } = context;

  const breakdown: PickBreakdown = {
    temperature: 1 - Math.abs(fragranceWarmth(fragrance) - targetWarmth(weather.tempC)),
    season: clamp01(fragrance.seasons[season]),
    time: clamp01(fragrance.dayParts[dayPart]),
    humidity: humidityScore(fragrance, weather),
    freshness: freshnessScore(fragrance.id, today, lastWornOn),
  };

  const raw =
    WEIGHTS.temperature * breakdown.temperature +
    WEIGHTS.season * breakdown.season +
    WEIGHTS.time * breakdown.time +
    WEIGHTS.humidity * breakdown.humidity +
    WEIGHTS.freshness * breakdown.freshness;

  return { fragrance, score: Math.round(raw * 100) / 100, breakdown };
}

/**
 * Koleksiyondan en uygun `count` parfümü döndürür (varsayılan 3: 1 ana + 2 alternatif).
 * Aynı girdi her zaman aynı sonucu verir; puan eşitse id'si küçük olan öne geçer.
 * Koleksiyon boşsa boş dizi döner.
 */
export function dailyPicks(
  collection: readonly Fragrance[],
  context: PickContext,
  count = 3,
): ScoredPick[] {
  const scored = collection.map((fragrance) => scoreFragrance(fragrance, context));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.fragrance.id < b.fragrance.id) return -1;
    if (a.fragrance.id > b.fragrance.id) return 1;
    return 0;
  });
  return scored.slice(0, Math.max(0, count));
}
