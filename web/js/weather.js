// Open-Meteo (anahtarsız, tarayıcıdan çağrılır). Ağ yoksa ya da yanıt bozuksa null döner;
// çağıran taraf mevsime göre yedek değer kullanır.
const CACHE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 6000;

/** Yanıtı doğrular; geçersizse null. */
export function parseWeather(json) {
  const current = json && json.current;
  if (!current || typeof current !== 'object') return null;
  const tempC = current.temperature_2m;
  const humidityPct = current.relative_humidity_2m;
  const precipitationMm = current.precipitation;
  if (![tempC, humidityPct, precipitationMm].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return {
    tempC,
    humidityPct: Math.min(100, Math.max(0, humidityPct)),
    precipitationMm: Math.max(0, precipitationMm),
  };
}

export async function fetchWeather(lat, lon, fetchImpl = fetch) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation&timezone=auto';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) return null;
    return parseWeather(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Önbellekli hava durumu. Dönüş: { data, source: 'live' | 'cache' } ya da null. */
export async function getWeather(cache, lat, lon, now = Date.now(), fetchImpl = fetch) {
  if (cache && cache.lat === lat && cache.lon === lon && now - cache.ts < CACHE_MS) {
    return { data: cache.data, source: 'cache', ts: cache.ts };
  }
  const data = await fetchWeather(lat, lon, fetchImpl);
  if (data) return { data, source: 'live', ts: now };
  // Ağ yok ama eski (aynı konum) önbellek var: eski de olsa göster.
  if (cache && cache.lat === lat && cache.lon === lon) return { data: cache.data, source: 'stale', ts: cache.ts };
  return null;
}

/** Hava durumu alınamazsa kullanılan mevsimlik tipik değerler (kuzey yarım küre ölçeğinde, mevsime göre). */
export const SEASON_FALLBACK = {
  winter: { tempC: 5, humidityPct: 70, precipitationMm: 0 },
  spring: { tempC: 15, humidityPct: 60, precipitationMm: 0 },
  summer: { tempC: 28, humidityPct: 50, precipitationMm: 0 },
  autumn: { tempC: 15, humidityPct: 65, precipitationMm: 0 },
};
