import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WEIGHTS, dailyPicks, freshnessScore, targetWarmth } from './dailyPick.ts';
import type { PickContext } from './dailyPick.ts';
import { amberHeavy, citrusLight, makeFragrance } from './fixtures.ts';

const hot: PickContext = {
  weather: { tempC: 32, humidityPct: 40, precipitationMm: 0 },
  season: 'summer',
  dayPart: 'day',
  today: '2026-07-15',
  lastWornOn: {},
};

const cold: PickContext = {
  weather: { tempC: 2, humidityPct: 70, precipitationMm: 0 },
  season: 'winter',
  dayPart: 'night',
  today: '2026-01-15',
  lastWornOn: {},
};

describe('dailyPick', () => {
  it('ağırlıklar toplamı 100', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(sum, 100);
  });

  it('sıcak yaz gündüzü: narenciye amberi geçer (elle hesaplanan puan 94,15 ve 35,95)', () => {
    const picks = dailyPicks([amberHeavy, citrusLight], hot);
    assert.equal(picks[0].fragrance.id, 'citrus-light');
    assert.equal(picks[0].score, 94.15);
    assert.equal(picks[1].fragrance.id, 'amber-heavy');
    assert.equal(picks[1].score, 35.95);
  });

  it('soğuk kış gecesi: amber narenciyeyi geçer (elle hesaplanan amber puanı 93,05)', () => {
    const picks = dailyPicks([citrusLight, amberHeavy], cold);
    assert.equal(picks[0].fragrance.id, 'amber-heavy');
    assert.equal(picks[0].score, 93.05);
    assert.equal(picks[1].fragrance.id, 'citrus-light');
  });

  it('son 3 günde giyilen parfümün puanı düşer, giyilmeyen öne geçer', () => {
    const a = makeFragrance({ id: 'a' });
    const b = makeFragrance({ id: 'b' });
    const context: PickContext = { ...hot, lastWornOn: { a: '2026-07-14' } };
    const picks = dailyPicks([a, b], context);
    assert.equal(picks[0].fragrance.id, 'b');
    assert.equal(picks[0].score - picks[1].score, WEIGHTS.freshness);
  });

  it('puan eşitse id sırası belirleyici (girdi sırası fark etmez)', () => {
    const a = makeFragrance({ id: 'a' });
    const b = makeFragrance({ id: 'b' });
    assert.deepEqual(
      dailyPicks([b, a], hot).map((p) => p.fragrance.id),
      ['a', 'b'],
    );
    assert.deepEqual(
      dailyPicks([a, b], hot).map((p) => p.fragrance.id),
      ['a', 'b'],
    );
  });

  it('aynı girdi aynı sonucu verir', () => {
    const collection = [citrusLight, amberHeavy, makeFragrance({ id: 'x' })];
    assert.deepEqual(dailyPicks(collection, hot), dailyPicks(collection, hot));
  });

  it('boş koleksiyonda boş dizi, count sınırı uygulanır', () => {
    assert.deepEqual(dailyPicks([], hot), []);
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => makeFragrance({ id }));
    assert.equal(dailyPicks(many, hot).length, 3);
    assert.equal(dailyPicks(many, hot, 2).length, 2);
    assert.equal(dailyPicks(many, hot, 0).length, 0);
  });

  it('yağış ağır parfümün nem bileşenini düşürür', () => {
    const dry = dailyPicks([amberHeavy], hot)[0].breakdown.humidity;
    const rainy = dailyPicks([amberHeavy], {
      ...hot,
      weather: { ...hot.weather, precipitationMm: 2 },
    })[0].breakdown.humidity;
    assert.equal(dry, 1);
    assert.equal(rainy, 0.5);
  });

  it('geçersiz sıcaklıkta hata verir', () => {
    assert.throws(
      () => dailyPicks([citrusLight], { ...hot, weather: { ...hot.weather, tempC: Number.NaN } }),
      RangeError,
    );
  });

  it('targetWarmth sınır değerleri', () => {
    assert.equal(targetWarmth(30), 0);
    assert.equal(targetWarmth(26), 0);
    assert.equal(targetWarmth(8), 1);
    assert.equal(targetWarmth(-5), 1);
    assert.equal(targetWarmth(17), 0.5);
  });

  it('freshnessScore: hiç giyilmedi=1, 2 gün=0, 3 gün>0, 14+ gün=1', () => {
    const last = { x: '2026-07-01' };
    assert.equal(freshnessScore('yok', '2026-07-15', last), 1);
    assert.equal(freshnessScore('x', '2026-07-03', last), 0);
    assert.ok(freshnessScore('x', '2026-07-04', last) > 0);
    assert.equal(freshnessScore('x', '2026-07-15', last), 1);
    assert.equal(freshnessScore('x', '2026-08-30', last), 1);
  });
});
