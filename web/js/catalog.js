import DATA, { CURATED_NOTES } from './catalog-data.js';

// Başlangıç kataloğu: elle derlenmiş, YAKLAŞIK değerler. Kazıma yok, dış veri tabanından kopya yok.
// Mevsim/gündüz-gece/yoğunluk/durum değerleri aile şablonundan ve tahminden gelir; kullanıcı onayına açıktır.
// Eksik parfümü kullanıcı uygulamadan kendisi ekleyebilir.

// Aile şablonları: [kış, ilkbahar, yaz, sonbahar], [gündüz, gece]
const FAMILY_PROFILE = {
  citrus: { seasons: [0.1, 0.8, 0.95, 0.3], parts: [0.95, 0.35] },
  aquatic: { seasons: [0.1, 0.7, 0.95, 0.3], parts: [0.9, 0.4] },
  green: { seasons: [0.2, 0.9, 0.7, 0.5], parts: [0.9, 0.3] },
  aromatic: { seasons: [0.4, 0.8, 0.7, 0.7], parts: [0.8, 0.6] },
  floral: { seasons: [0.3, 0.9, 0.7, 0.6], parts: [0.8, 0.5] },
  woody: { seasons: [0.7, 0.6, 0.5, 0.9], parts: [0.7, 0.7] },
  chypre: { seasons: [0.6, 0.6, 0.4, 0.85], parts: [0.6, 0.8] },
  leather: { seasons: [0.85, 0.3, 0.1, 0.85], parts: [0.4, 0.9] },
  oriental: { seasons: [0.95, 0.3, 0.1, 0.9], parts: [0.3, 0.95] },
  gourmand: { seasons: [0.95, 0.3, 0.05, 0.9], parts: [0.35, 0.95] },
};

const OCCASION_CODES = { o: 'office', c: 'casual', s: 'sport', d: 'date', n: 'night_out', f: 'formal' };

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// [marka, ad, aile, niş(0/1), yoğunluk 1-5, durum kodları]
const RAW = [
  ['Dior', 'Sauvage', 'aromatic', 0, 4, 'cdn'],
  ['Dior', 'Fahrenheit', 'leather', 0, 4, 'dn'],
  ['Dior', 'Homme Intense', 'floral', 0, 4, 'odf'],
  ['Dior', 'Miss Dior', 'floral', 0, 3, 'cd'],
  ['Chanel', 'Bleu de Chanel', 'woody', 0, 3, 'ocdf'],
  ['Chanel', 'Coco Mademoiselle', 'chypre', 0, 3, 'odnf'],
  ['Chanel', 'No. 5', 'floral', 0, 3, 'fd'],
  ['Chanel', 'Allure Homme Sport', 'citrus', 0, 3, 'cs'],
  ['Creed', 'Aventus', 'woody', 1, 4, 'odnf'],
  ['Versace', 'Eros', 'aromatic', 0, 4, 'dn'],
  ['Versace', 'Dylan Blue', 'aromatic', 0, 3, 'cd'],
  ['Rabanne', '1 Million', 'oriental', 0, 4, 'dn'],
  ['Rabanne', 'Invictus', 'aquatic', 0, 3, 'cs'],
  ['Jean Paul Gaultier', 'Le Male', 'oriental', 0, 4, 'dn'],
  ['Giorgio Armani', 'Acqua di Giò', 'aquatic', 0, 3, 'ocs'],
  ['Giorgio Armani', 'Armani Code', 'oriental', 0, 4, 'dnf'],
  ['Yves Saint Laurent', 'Y Eau de Parfum', 'aromatic', 0, 4, 'ocd'],
  ["Yves Saint Laurent", "La Nuit de L'Homme", 'oriental', 0, 3, 'dn'],
  ['Yves Saint Laurent', 'Libre', 'floral', 0, 3, 'cdn'],
  ['Tom Ford', 'Oud Wood', 'woody', 1, 4, 'dnf'],
  ['Tom Ford', 'Tobacco Vanille', 'oriental', 1, 5, 'dnf'],
  ['Tom Ford', 'Black Orchid', 'oriental', 1, 5, 'nf'],
  ['Tom Ford', 'Neroli Portofino', 'citrus', 1, 2, 'oc'],
  ['Tom Ford', 'Ombré Leather', 'leather', 1, 4, 'dn'],
  ['Maison Francis Kurkdjian', 'Baccarat Rouge 540', 'oriental', 1, 4, 'dnf'],
  ['Le Labo', 'Santal 33', 'woody', 1, 4, 'cd'],
  ['Byredo', 'Gypsy Water', 'woody', 1, 3, 'cd'],
  ['Byredo', 'Blanche', 'floral', 1, 2, 'of'],
  ['Diptyque', 'Philosykos', 'green', 1, 2, 'oc'],
  ['Diptyque', 'Do Son', 'floral', 1, 2, 'oc'],
  ['Maison Margiela', 'Replica By the Fireplace', 'woody', 0, 3, 'cd'],
  ['Maison Margiela', 'Replica Jazz Club', 'oriental', 0, 3, 'dn'],
  ['Maison Margiela', 'Replica Beach Walk', 'aquatic', 0, 2, 'cs'],
  ['Maison Margiela', 'Replica Lazy Sunday Morning', 'floral', 0, 2, 'oc'],
  ['Hermès', "Terre d'Hermès", 'woody', 0, 3, 'ocf'],
  ['Hermès', 'Un Jardin sur le Nil', 'green', 0, 2, 'oc'],
  ['Guerlain', 'Shalimar', 'oriental', 0, 4, 'dnf'],
  ['Guerlain', 'Mon Guerlain', 'oriental', 0, 3, 'cd'],
  ['Lancôme', 'La Vie est Belle', 'gourmand', 0, 4, 'cdn'],
  ['Lancôme', 'Idôle', 'floral', 0, 3, 'oc'],
  ['Mugler', 'Angel', 'gourmand', 0, 5, 'nd'],
  ['Mugler', 'Alien', 'floral', 0, 4, 'dn'],
  ['Mugler', 'A*Men', 'gourmand', 0, 5, 'n'],
  ['Carolina Herrera', 'Good Girl', 'floral', 0, 4, 'dn'],
  ['Viktor&Rolf', 'Spicebomb', 'oriental', 0, 4, 'dn'],
  ['Dolce&Gabbana', 'Light Blue', 'citrus', 0, 2, 'ocs'],
  ['Dolce&Gabbana', 'The One for Men', 'oriental', 0, 4, 'dnf'],
  ['Burberry', 'Hero', 'woody', 0, 3, 'ocd'],
  ['Calvin Klein', 'CK One', 'citrus', 0, 2, 'ocs'],
  ['Davidoff', 'Cool Water', 'aquatic', 0, 3, 'ocs'],
  ['Issey Miyake', "L'Eau d'Issey Pour Homme", 'aquatic', 0, 2, 'ocs'],
  ['Hugo Boss', 'Boss Bottled', 'woody', 0, 3, 'of'],
  ['Azzaro', 'Wanted', 'aromatic', 0, 4, 'dn'],
  ['Azzaro', 'Chrome', 'aquatic', 0, 2, 'ocs'],
  ['Montblanc', 'Explorer', 'woody', 0, 3, 'oc'],
  ['Prada', "L'Homme", 'woody', 0, 3, 'of'],
  ['Prada', 'Luna Rossa Carbon', 'aromatic', 0, 3, 'ocd'],
  ['Bvlgari', 'Aqva Pour Homme', 'aquatic', 0, 3, 'cs'],
  ['Acqua di Parma', 'Colonia', 'citrus', 0, 2, 'of'],
  ["Penhaligon's", 'Halfeti', 'oriental', 1, 5, 'nf'],
  ['Frédéric Malle', 'Portrait of a Lady', 'floral', 1, 5, 'nf'],
  ['Jo Malone', 'Wood Sage & Sea Salt', 'aromatic', 0, 2, 'oc'],
  ['Jo Malone', 'English Pear & Freesia', 'floral', 0, 2, 'oc'],
  ['Memo Paris', 'Irish Leather', 'leather', 1, 3, 'od'],
  ['Initio', 'Oud for Greatness', 'woody', 1, 5, 'nf'],
  ['Parfums de Marly', 'Layton', 'oriental', 1, 4, 'dnf'],
  ['Parfums de Marly', 'Herod', 'oriental', 1, 4, 'dn'],
  ['Xerjoff', 'Naxos', 'oriental', 1, 4, 'dnf'],
  ['Amouage', 'Interlude Man', 'oriental', 1, 5, 'nf'],
  ['Amouage', 'Reflection Man', 'floral', 1, 3, 'of'],
  ['Nishane', 'Hacivat', 'woody', 1, 4, 'ocd'],
  ['Nishane', 'Ani', 'oriental', 1, 4, 'dn'],
  ['Mancera', 'Cedrat Boisé', 'citrus', 1, 4, 'cd'],
  ['Mancera', 'Roses Vanille', 'floral', 1, 4, 'dn'],
  ['Lattafa', 'Khamrah', 'gourmand', 0, 4, 'dn'],
  ['Armaf', 'Club de Nuit Intense Man', 'woody', 0, 4, 'cd'],
  ['Rasasi', 'Hawas', 'aquatic', 0, 4, 'cd'],
];

function build([brand, name, family, niche, intensity, codes]) {
  const profile = FAMILY_PROFILE[family];
  if (!profile) throw new Error(`Unknown family: ${family}`);
  return {
    id: slug(`${brand} ${name}`),
    brand,
    name,
    family,
    niche: niche === 1,
    seasons: {
      winter: profile.seasons[0],
      spring: profile.seasons[1],
      summer: profile.seasons[2],
      autumn: profile.seasons[3],
    },
    dayParts: { day: profile.parts[0], night: profile.parts[1] },
    intensity,
    occasions: [...codes].map((code) => OCCASION_CODES[code]),
  };
}

const CURATED = RAW.map(build);
const curatedIds = new Set(CURATED.map((item) => item.id));
const CONC_TAIL = /\s+(edp|edt|edc|parfum|extrait|elixir|cologne)$/i;
const CURATED_NOISE = /\b(millesime|eau de parfum|eau de toilette)\b/gi;

// Elle derlenenler önceliklidir; toplu listede aynı parfüm varsa tekrar eklenmez.
const BULK = [];
const curatedNotes = new Map(); // elle derlenen parfümlere, aynı parfümün toplu listedeki nota verisi aktarılır
const usedIds = new Set(curatedIds);
for (const row of DATA) {
  const item = build(row.slice(0, 6));
  const curatedId = slug(`${item.brand} ${item.name.replace(CONC_TAIL, '').replace(CURATED_NOISE, ' ')}`);
  if (curatedIds.has(curatedId)) {
    if (row[7] && !curatedNotes.has(curatedId)) curatedNotes.set(curatedId, row);
    continue;
  }
  let id = item.id;
  for (let n = 2; usedIds.has(id); n += 1) id = `${item.id}-${n}`;
  usedIds.add(id);
  BULK.push({ ...item, id, unisex: row[6] === 1, ...(row[7] ? { notes: row[7], pyramid: row[8] || null } : {}), estimated: !row[7] });
}

for (const item of CURATED) {
  const manual = CURATED_NOTES[item.id]; // elle onaylı eşleşme, toplu eşleşmeye göre öncelikli
  const row = manual ? [0, 0, 0, 0, 0, 0, 0, manual[0], manual[1]] : curatedNotes.get(item.id);
  if (row) Object.assign(item, { notes: row[7], pyramid: row[8] || null });
  item.estimated = !row;
}

export const CATALOG = [...CURATED, ...BULK];

// Kimlik çakışması olursa uygulama sessizce yanlış çalışmasın diye açılışta hata atar.
{
  const seen = new Set();
  for (const item of CATALOG) {
    if (seen.has(item.id)) throw new Error(`Duplicate catalog id: ${item.id}`);
    seen.add(item.id);
  }
}

export { slug };
