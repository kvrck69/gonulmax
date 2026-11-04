import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeFragrance } from './fixtures.ts';
import { scentScore } from './scentScore.ts';
import { FAMILIES, OCCASIONS, SEASONS } from './types.ts';
import type { Fragrance } from './types.ts';

describe('scentScore', () => {
  it('boş koleksiyon: 0 puan, geçici, tüm hücreler ve durumlar eksik', () => {
    const score = scentScore([]);
    assert.equal(score.total, 0);
    assert.equal(score.provisional, true);
    assert.equal(score.gaps.uncoveredCells.length, 8);
    assert.equal(score.gaps.missingOccasions.length, OCCASIONS.length);
  });

  it('tek niş parfüm, elle hesaplanan bileşenler: 12,5 + 0 + 8,3 + 25 → 46', () => {
    const only = makeFragrance({
      id: 'only',
      niche: true,
      seasons: { winter: 0.9, spring: 0.9, summer: 0.9, autumn: 0.9 },
      dayParts: { day: 0.9, night: 0.1 },
      occasions: ['casual', 'office'],
    });
    const score = scentScore([only]);
    assert.deepEqual(score.components, {
      seasonCoverage: 12.5,
      diversity: 0,
      versatility: 8.3,
      niche: 25,
    });
    assert.equal(score.total, 46);
    assert.equal(score.provisional, true);
    assert.equal(score.gaps.uncoveredCells.length, 4);
    assert.ok(score.gaps.uncoveredCells.every((cell) => cell.dayPart === 'night'));
    assert.deepEqual(score.gaps.missingOccasions, ['sport', 'date', 'night_out', 'formal']);
  });

  it('çeşitlilik: iki farklı aile tam puan (25)', () => {
    const score = scentScore([
      makeFragrance({ id: 'a', family: 'citrus' }),
      makeFragrance({ id: 'b', family: 'woody' }),
    ]);
    assert.equal(score.components.diversity, 25);
  });

  it('çeşitlilik: 4 parfüm, 2 aile x 2 → 12,5', () => {
    const score = scentScore([
      makeFragrance({ id: 'a', family: 'citrus' }),
      makeFragrance({ id: 'b', family: 'citrus' }),
      makeFragrance({ id: 'c', family: 'woody' }),
      makeFragrance({ id: 'd', family: 'woody' }),
    ]);
    assert.equal(score.components.diversity, 12.5);
  });

  it('çeşitlilik: hepsi aynı aile → 0', () => {
    const score = scentScore([
      makeFragrance({ id: 'a', family: 'citrus' }),
      makeFragrance({ id: 'b', family: 'citrus' }),
      makeFragrance({ id: 'c', family: 'citrus' }),
    ]);
    assert.equal(score.components.diversity, 0);
  });

  it('niş oranı: 3/10 → tam puan, 1/10 → 8,3, hiç niş yok → 0', () => {
    const make = (nicheCount: number): Fragrance[] =>
      Array.from({ length: 10 }, (_, i) => makeFragrance({ id: `f${i}`, niche: i < nicheCount }));
    assert.equal(scentScore(make(3)).components.niche, 25);
    assert.equal(scentScore(make(5)).components.niche, 25);
    assert.equal(scentScore(make(1)).components.niche, 8.3);
    assert.equal(scentScore(make(0)).components.niche, 0);
  });

  it('8 hücrenin hepsi kapsanınca mevsim bileşeni 25', () => {
    const day = makeFragrance({
      id: 'day',
      seasons: { winter: 0.9, spring: 0.9, summer: 0.9, autumn: 0.9 },
      dayParts: { day: 0.9, night: 0.1 },
    });
    const night = makeFragrance({
      id: 'night',
      seasons: { winter: 0.9, spring: 0.9, summer: 0.9, autumn: 0.9 },
      dayParts: { day: 0.1, night: 0.9 },
    });
    const score = scentScore([day, night]);
    assert.equal(score.components.seasonCoverage, 25);
    assert.deepEqual(score.gaps.uncoveredCells, []);
  });

  it('kapsama eşiği: 0,59 kapsamaz, 0,6 kapsar', () => {
    const below = makeFragrance({
      id: 'below',
      seasons: { winter: 0.59, spring: 0, summer: 0, autumn: 0 },
      dayParts: { day: 1, night: 0 },
    });
    const at = makeFragrance({
      id: 'at',
      seasons: { winter: 0.6, spring: 0, summer: 0, autumn: 0 },
      dayParts: { day: 1, night: 0 },
    });
    assert.equal(scentScore([below]).components.seasonCoverage, 0);
    assert.equal(scentScore([at]).components.seasonCoverage, 3.1);
  });

  it('sıra bağımsız: karıştırılmış koleksiyon aynı skoru verir', () => {
    const collection = [
      makeFragrance({ id: 'a', family: 'citrus', niche: true, occasions: ['office'] }),
      makeFragrance({ id: 'b', family: 'woody', occasions: ['date', 'formal'] }),
      makeFragrance({ id: 'c', family: 'oriental', occasions: ['night_out'] }),
    ];
    const reversed = [...collection].reverse();
    assert.deepEqual(scentScore(collection), scentScore(reversed));
  });

  it('3 parfümde geçici etiketi kalkar', () => {
    const three = ['a', 'b', 'c'].map((id) => makeFragrance({ id }));
    assert.equal(scentScore(three).provisional, false);
    assert.equal(scentScore(three.slice(0, 2)).provisional, true);
  });

  it('toplam her zaman 0-100 arasında ve bileşenler 0-25 arasında', () => {
    const everything = FAMILIES.map((family, i) =>
      makeFragrance({
        id: `f${i}`,
        family,
        niche: true,
        seasons: Object.fromEntries(SEASONS.map((s) => [s, 1])) as Fragrance['seasons'],
        dayParts: { day: 1, night: 1 },
        occasions: OCCASIONS,
      }),
    );
    const score = scentScore(everything);
    assert.equal(score.total, 100);
    for (const value of Object.values(score.components)) {
      assert.ok(value >= 0 && value <= 25);
    }
  });
});
