import type { Fragrance } from './types.ts';

/** Testler için tam alanlı örnek parfüm üretir. Ad ve değerler uydurmadır; gerçek katalog değildir. */
export function makeFragrance(overrides: Partial<Fragrance> & { id: string }): Fragrance {
  return {
    brand: 'Test Marka',
    name: `Test ${overrides.id}`,
    family: 'woody',
    niche: false,
    seasons: { winter: 0.5, spring: 0.5, summer: 0.5, autumn: 0.5 },
    dayParts: { day: 0.5, night: 0.5 },
    intensity: 3,
    occasions: [],
    ...overrides,
  };
}

/** Yazın gündüz için ideal, hafif narenciye. */
export const citrusLight: Fragrance = makeFragrance({
  id: 'citrus-light',
  family: 'citrus',
  intensity: 2,
  seasons: { winter: 0.1, spring: 0.8, summer: 0.95, autumn: 0.3 },
  dayParts: { day: 0.95, night: 0.4 },
});

/** Kışın gece için ideal, yoğun amber. */
export const amberHeavy: Fragrance = makeFragrance({
  id: 'amber-heavy',
  family: 'oriental',
  intensity: 5,
  seasons: { winter: 0.95, spring: 0.3, summer: 0.1, autumn: 0.85 },
  dayParts: { day: 0.4, night: 0.95 },
});
