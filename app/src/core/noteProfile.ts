// Koku çarkı (Drom "Fragrance Circle" tarzı 16 dilim) üzerinden koleksiyon profili.
// Her parfümün 16 nota eksenindeki gücü 0-1 arası TAHMİNDİR: koku ailesinden ve addaki anahtar kelimelerden türer.
// Gerçek nota verisi eklendiğinde yalnızca `Fragrance.notes` doldurulur; hesap aynı kalır.
import type { Family, Fragrance } from './types.ts';

/** Çarkta saat yönünde, en üstten başlayarak. */
export const NOTE_AXES = [
  'citrus',
  'floral',
  'aldehydic',
  'oriental',
  'lavender',
  'fougere',
  'fruity',
  'conifer',
  'chypre',
  'herbaceous',
  'green',
  'spicy',
  'woody',
  'tobacco',
  'leather',
  'musk',
] as const;
export type NoteAxis = (typeof NOTE_AXES)[number];
export type NoteProfile = Record<NoteAxis, number>;

const ZERO = (): NoteProfile => Object.fromEntries(NOTE_AXES.map((a) => [a, 0])) as NoteProfile;

/** Aileden çark eksenlerine ilk tahmin. */
const FAMILY_NOTES: Record<Family, Partial<NoteProfile>> = {
  citrus: { citrus: 0.9, herbaceous: 0.3, green: 0.2 },
  aquatic: { citrus: 0.5, herbaceous: 0.35, musk: 0.35, fougere: 0.25 },
  green: { green: 0.9, herbaceous: 0.5, citrus: 0.2 },
  aromatic: { lavender: 0.6, fougere: 0.6, herbaceous: 0.5, spicy: 0.3 },
  floral: { floral: 0.9, aldehydic: 0.2, fruity: 0.25, musk: 0.25 },
  woody: { woody: 0.9, spicy: 0.3, chypre: 0.2 },
  chypre: { chypre: 0.9, woody: 0.4, green: 0.2, herbaceous: 0.2 },
  leather: { leather: 0.9, tobacco: 0.4, woody: 0.3, spicy: 0.2 },
  oriental: { oriental: 0.9, spicy: 0.5, musk: 0.3, woody: 0.25 },
  gourmand: { oriental: 0.6, tobacco: 0.3, fruity: 0.25, spicy: 0.2 },
};

/** Addaki anahtar kelimeler eksene destek verir (+0.5, en çok 1). */
const NAME_HINTS: ReadonlyArray<readonly [NoteAxis, RegExp]> = [
  ['citrus', /citr|lemon|limon|cedrat|bergamot|orange|agrumi|neroli|mandarin|grapefruit|\byuzu|\blime\b|zest/i],
  ['floral', /ros[ae]|flower|blossom|jasmin|floral|peony|lily|\biris|violet|tuberose|fleur|bloom|lotus|magnolia|orchid|gardenia|mimosa/i],
  ['aldehydic', /aldehyd|\bn[°o.]?\s?5\b|\bno\.? ?5\b|chanel n/i],
  ['oriental', /\boud|\bud\b|oudh|amber|ambre|incense|myrrh|resin|vanill|benzoin|tonka|orient|arab|attar|bakhoor|anbar|sultan/i],
  ['lavender', /lavend|lavande/i],
  ['fougere', /fougere|fougère|\bhomme\b|\bpour homme\b|\buomo\b/i],
  ['fruity', /apple|pineapple|ananas|berry|cherry|peach|plum|fruit|mango|pear\b|\bfig\b|cassis|currant|coconut|melon|raspberry/i],
  ['conifer', /\bpine\b|\bfir\b|spruce|juniper|cypress|conifer|forest|cedar|cèdre|cedre/i],
  ['chypre', /chypre|patchouli|oakmoss|\bpatch/i],
  ['herbaceous', /herb|basil|rosemary|\bsage\b|thyme|mint|\btea\b|\bthe\b|aromat/i],
  ['green', /green|\bvert\b|grass|\bleaf|moss|garden|vetiver/i],
  ['spicy', /spic|pepper|cinnamon|cardamom|saffron|safran|ginger|clove|nutmeg|coriander|baharat|rum\b/i],
  ['woody', /wood|bois|sandal|santal|vetiver|\boak\b|timber|cedar|cedre|\boud/i],
  ['tobacco', /tobacco|tabac|cigar|whisk/i],
  ['leather', /leather|cuir|suede|smok|\bnoir\b|birch/i],
  ['musk', /musk|musc|\bmusc\b|white musk|\bskin\b/i],
];

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Parfümün 16 eksendeki gücü. `notes` varsa (gerçek veri) onu önceliklendirir. */
export function noteProfile(fragrance: Pick<Fragrance, 'family' | 'name'> & { notes?: Partial<NoteProfile> }): NoteProfile {
  const out = ZERO();
  if (fragrance.notes && Object.keys(fragrance.notes).length > 0) {
    for (const axis of NOTE_AXES) out[axis] = clamp01(fragrance.notes[axis] ?? 0);
    return out;
  }
  const base = FAMILY_NOTES[fragrance.family] ?? {};
  for (const axis of NOTE_AXES) out[axis] = clamp01(base[axis] ?? 0);
  for (const [axis, rx] of NAME_HINTS) if (rx.test(fragrance.name)) out[axis] = clamp01(Math.max(out[axis], 0.35) + 0.5);
  return out;
}

export interface NoteRadar {
  /** Eksen başına koleksiyon kapsaması, 0-1. 1 - Π(1 - p): her yeni parfüm boşluğu biraz daha doldurur. */
  values: NoteProfile;
  /** En zayıf eksenler (kapsama < GAP_THRESHOLD), azalan eksiklik sırasıyla. */
  gaps: NoteAxis[];
}

export const GAP_THRESHOLD = 0.3;

export function noteRadar(collection: readonly (Pick<Fragrance, 'family' | 'name'> & { notes?: Partial<NoteProfile> })[]): NoteRadar {
  const values = ZERO();
  const miss = ZERO();
  for (const axis of NOTE_AXES) miss[axis] = 1;
  for (const f of collection) {
    const p = noteProfile(f);
    for (const axis of NOTE_AXES) miss[axis] *= 1 - p[axis];
  }
  for (const axis of NOTE_AXES) values[axis] = Math.round((1 - miss[axis]) * 1000) / 1000;
  const gaps = NOTE_AXES.filter((a) => values[a] < GAP_THRESHOLD).sort((a, b) => values[a] - values[b]);
  return { values, gaps };
}

/** Bir eksendeki boşluğu en iyi dolduracak parfümler (koleksiyonda olmayanlar). */
export function suggestFor<T extends Pick<Fragrance, 'id' | 'family' | 'name'> & { notes?: Partial<NoteProfile> }>(
  axis: NoteAxis,
  catalog: readonly T[],
  ownedIds: ReadonlySet<string>,
  limit = 3,
): T[] {
  return catalog
    .filter((f) => !ownedIds.has(f.id))
    .map((f) => ({ f, s: noteProfile(f)[axis], real: f.notes ? 1 : 0 }))
    .filter((x) => x.s >= 0.6)
    // Gerçek nota verisi olan parfümler önce: tahmini olanlar yalnızca yeterli gerçek veri yoksa önerilir.
    .sort((a, b) => b.real - a.real || b.s - a.s || a.f.id.localeCompare(b.f.id))
    .slice(0, limit)
    .map((x) => x.f);
}
