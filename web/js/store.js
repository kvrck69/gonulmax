// Yerel-öncelikli veri deposu: her şey tarayıcının localStorage'ında durur, sunucuya hiçbir şey gitmez.
// Her okuma ve içe aktarma `sanitize` ile doğrulanır; bozuk veri uygulamayı çökertmez.
import { FAMILIES, OCCASIONS, SEASONS, DAY_PARTS } from './core/types.js';
import { parseIsoDate } from './core/dates.js';

export const STORAGE_KEY = 'gonulmax:v1';
export const SCHEMA_VERSION = 1;
const ITEM_STATUSES = ['owned', 'wishlist'];

function defaults() {
  return {
    v: SCHEMA_VERSION,
    profile: { name: '', locale: null, city: '', lat: null, lon: null, tz: null, onboarded: false },
    items: {}, // parfüm id -> 'owned' | 'wishlist'
    wears: [], // { id, fragranceId, date: 'YYYY-MM-DD' }
    custom: [], // kullanıcının eklediği parfümler
    weatherCache: null, // { ts, lat, lon, data }
  };
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const unit = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function validIsoDate(value) {
  if (typeof value !== 'string') return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/** Geçerli bir parfüm nesnesi döndürür; geçersizse null. */
export function sanitizeFragrance(raw) {
  if (!isObject(raw)) return null;
  const brand = clean(raw.brand, 120);
  const name = clean(raw.name, 160);
  const id = clean(raw.id, 200);
  if (!id || !brand || !name) return null;
  if (!FAMILIES.includes(raw.family)) return null;
  if (!isObject(raw.seasons) || !isObject(raw.dayParts)) return null;
  const seasons = {};
  for (const season of SEASONS) {
    if (!unit(raw.seasons[season])) return null;
    seasons[season] = raw.seasons[season];
  }
  const dayParts = {};
  for (const part of DAY_PARTS) {
    if (!unit(raw.dayParts[part])) return null;
    dayParts[part] = raw.dayParts[part];
  }
  if (!Number.isInteger(raw.intensity) || raw.intensity < 1 || raw.intensity > 5) return null;
  const occasions = Array.isArray(raw.occasions) ? raw.occasions.filter((o) => OCCASIONS.includes(o)) : [];
  return {
    id,
    brand,
    name,
    family: raw.family,
    niche: raw.niche === true,
    seasons,
    dayParts,
    intensity: raw.intensity,
    occasions: [...new Set(occasions)],
  };
}

/** Herhangi bir ham veriyi güvenli, tam şekilli duruma çevirir. */
export function sanitize(raw) {
  const state = defaults();
  if (!isObject(raw)) return state;

  if (isObject(raw.profile)) {
    const p = raw.profile;
    state.profile.name = clean(p.name, 60);
    state.profile.locale = p.locale === 'tr' || p.locale === 'en' ? p.locale : null;
    state.profile.city = clean(p.city, 120);
    const lat = typeof p.lat === 'number' && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 ? p.lat : null;
    const lon = typeof p.lon === 'number' && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180 ? p.lon : null;
    state.profile.lat = lat !== null && lon !== null ? lat : null;
    state.profile.lon = lat !== null && lon !== null ? lon : null;
    state.profile.tz = typeof p.tz === 'string' && p.tz.length <= 80 ? p.tz : null;
    state.profile.onboarded = p.onboarded === true;
  }

  const customIds = new Set();
  if (Array.isArray(raw.custom)) {
    for (const entry of raw.custom.slice(0, 500)) {
      const fragrance = sanitizeFragrance(entry);
      if (fragrance && !customIds.has(fragrance.id)) {
        customIds.add(fragrance.id);
        state.custom.push(fragrance);
      }
    }
  }

  if (isObject(raw.items)) {
    for (const [id, status] of Object.entries(raw.items)) {
      if (ITEM_STATUSES.includes(status) && id.length <= 200) state.items[id] = status;
    }
  }

  if (Array.isArray(raw.wears)) {
    const seen = new Set();
    for (const wear of raw.wears.slice(0, 20000)) {
      if (!isObject(wear) || typeof wear.fragranceId !== 'string' || !validIsoDate(wear.date)) continue;
      const key = `${wear.fragranceId}|${wear.date}`;
      if (seen.has(key)) continue; // aynı gün aynı parfüm tek kayıt (çift dokunma koruması)
      seen.add(key);
      state.wears.push({
        id: typeof wear.id === 'string' && wear.id ? wear.id.slice(0, 64) : makeId(),
        fragranceId: wear.fragranceId.slice(0, 200),
        date: wear.date,
      });
    }
  }

  if (isObject(raw.weatherCache) && typeof raw.weatherCache.ts === 'number' && isObject(raw.weatherCache.data)) {
    const d = raw.weatherCache.data;
    if ([d.tempC, d.humidityPct, d.precipitationMm].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      state.weatherCache = {
        ts: raw.weatherCache.ts,
        lat: raw.weatherCache.lat,
        lon: raw.weatherCache.lon,
        data: { tempC: d.tempC, humidityPct: d.humidityPct, precipitationMm: d.precipitationMm },
      };
    }
  }
  return state;
}

export function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let state = defaults();
const listeners = new Set();
let storageOk = true;

export function load() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    state = text ? sanitize(JSON.parse(text)) : defaults();
  } catch {
    // localStorage yok / bozuk JSON: boş durumla devam et, kullanıcıya uyarı göstermek için işaretle.
    state = defaults();
    storageOk = false;
  }
  return state;
}

export function getState() {
  return state;
}

export function isStorageOk() {
  return storageOk;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}

/** Durumu değiştirir, kaydeder ve dinleyicileri çağırır. */
export function update(mutator) {
  mutator(state);
  persist();
  for (const listener of listeners) listener(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Yedekten geri yükleme: tüm durumu doğrulanmış yeni durumla değiştirir. */
export function replaceAll(raw) {
  state = sanitize(raw);
  persist();
  for (const listener of listeners) listener(state);
}

export function exportJson() {
  return JSON.stringify({ ...state, weatherCache: null, exportedAt: new Date().toISOString() }, null, 2);
}
