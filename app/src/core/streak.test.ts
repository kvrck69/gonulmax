import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, daysBetween, parseIsoDate } from './dates.ts';
import { dayPartOf, localParts, seasonOf } from './season.ts';
import { wearCountsByDate, wearStreak } from './streak.ts';

describe('dates', () => {
  it('addDays ay ve yıl sınırlarını doğru geçer', () => {
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('daysBetween', () => {
    assert.equal(daysBetween('2026-07-14', '2026-07-15'), 1);
    assert.equal(daysBetween('2026-07-15', '2026-07-14'), -1);
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  });

  it('geçersiz tarih hata verir', () => {
    assert.throws(() => parseIsoDate('2026-02-30'), RangeError);
    assert.throws(() => parseIsoDate('2026-13-01'), RangeError);
    assert.throws(() => parseIsoDate('15.07.2026'), RangeError);
    assert.throws(() => parseIsoDate(''), RangeError);
  });
});

describe('season ve saat', () => {
  it('seasonOf kuzey', () => {
    assert.equal(seasonOf(12), 'winter');
    assert.equal(seasonOf(1), 'winter');
    assert.equal(seasonOf(2), 'winter');
    assert.equal(seasonOf(3), 'spring');
    assert.equal(seasonOf(5), 'spring');
    assert.equal(seasonOf(6), 'summer');
    assert.equal(seasonOf(8), 'summer');
    assert.equal(seasonOf(9), 'autumn');
    assert.equal(seasonOf(11), 'autumn');
  });

  it('seasonOf güney yarım küre ters', () => {
    assert.equal(seasonOf(1, 'south'), 'summer');
    assert.equal(seasonOf(7, 'south'), 'winter');
    assert.equal(seasonOf(12, 'south'), 'summer');
    assert.equal(seasonOf(4, 'south'), 'autumn');
    assert.equal(seasonOf(10, 'south'), 'spring');
  });

  it('seasonOf geçersiz ayda hata', () => {
    assert.throws(() => seasonOf(0), RangeError);
    assert.throws(() => seasonOf(13), RangeError);
  });

  it('dayPartOf sınırları', () => {
    assert.equal(dayPartOf(0), 'night');
    assert.equal(dayPartOf(5), 'night');
    assert.equal(dayPartOf(6), 'day');
    assert.equal(dayPartOf(17), 'day');
    assert.equal(dayPartOf(18), 'night');
    assert.equal(dayPartOf(23), 'night');
    assert.throws(() => dayPartOf(24), RangeError);
  });

  it('localParts saat dilimine göre gün atlar (gece yarısı sınırı)', () => {
    const instant = new Date('2026-10-26T21:30:00Z');
    assert.deepEqual(localParts(instant, 'Europe/Istanbul'), {
      date: '2026-10-27',
      month: 10,
      hour: 0,
    });
    assert.deepEqual(localParts(instant, 'America/Los_Angeles'), {
      date: '2026-10-26',
      month: 10,
      hour: 14,
    });
  });
});

describe('wearStreak', () => {
  it('bugün dahil 3 ardışık gün', () => {
    const result = wearStreak(['2026-07-13', '2026-07-14', '2026-07-15'], '2026-07-15');
    assert.deepEqual(result, { current: 3, longest: 3 });
  });

  it('bugün henüz yok ama dün var: seri dünden sayılır', () => {
    const result = wearStreak(['2026-07-13', '2026-07-14'], '2026-07-15');
    assert.deepEqual(result, { current: 2, longest: 2 });
  });

  it('boşluk seriyi böler; en uzun seri korunur', () => {
    const result = wearStreak(['2026-07-10', '2026-07-11', '2026-07-14'], '2026-07-15');
    assert.deepEqual(result, { current: 1, longest: 2 });
  });

  it('son kayıt 2 gün önceyse güncel seri 0', () => {
    const result = wearStreak(['2026-07-12', '2026-07-13'], '2026-07-15');
    assert.deepEqual(result, { current: 0, longest: 2 });
  });

  it('aynı gün birden fazla kayıt seriyi artırmaz; sıra önemli değil', () => {
    const result = wearStreak(['2026-07-15', '2026-07-14', '2026-07-15', '2026-07-14'], '2026-07-15');
    assert.deepEqual(result, { current: 2, longest: 2 });
  });

  it('ay sınırını geçen seri', () => {
    const result = wearStreak(['2026-02-27', '2026-02-28', '2026-03-01'], '2026-03-01');
    assert.deepEqual(result, { current: 3, longest: 3 });
  });

  it('boş girdi', () => {
    assert.deepEqual(wearStreak([], '2026-07-15'), { current: 0, longest: 0 });
  });

  it('bozuk tarih sessizce geçmez', () => {
    assert.throws(() => wearStreak(['2026-02-30'], '2026-07-15'), RangeError);
    assert.throws(() => wearStreak([], 'bugün'), RangeError);
  });
});

describe('wearCountsByDate', () => {
  it('günlük sayım', () => {
    assert.deepEqual(wearCountsByDate(['2026-07-15', '2026-07-15', '2026-07-14']), {
      '2026-07-15': 2,
      '2026-07-14': 1,
    });
  });
});
