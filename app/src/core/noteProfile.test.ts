import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_AXES, noteProfile, noteRadar, suggestFor } from './noteProfile.ts';

test('16 eksen, benzersiz', () => {
  assert.equal(NOTE_AXES.length, 16);
  assert.equal(new Set(NOTE_AXES).size, 16);
});

test('profil: aile + addaki ipucu, değerler 0-1', () => {
  const p = noteProfile({ family: 'woody', name: 'Tobacco Vanille' });
  assert.ok(p.tobacco >= 0.8 && p.oriental >= 0.8 && p.woody >= 0.9);
  for (const a of NOTE_AXES) assert.ok(p[a] >= 0 && p[a] <= 1);
});

test('gerçek notes varsa aileyi ezer', () => {
  const p = noteProfile({ family: 'woody', name: 'X', notes: { citrus: 1 } });
  assert.equal(p.citrus, 1);
  assert.equal(p.woody, 0);
});

test('radar: boş koleksiyonda hepsi eksik; parfüm ekledikçe kapsama artar, asla 1 i aşmaz', () => {
  const empty = noteRadar([]);
  assert.equal(empty.gaps.length, 16);
  const one = noteRadar([{ family: 'citrus', name: 'A' }]);
  const two = noteRadar([{ family: 'citrus', name: 'A' }, { family: 'citrus', name: 'B' }]);
  assert.ok(two.values.citrus > one.values.citrus && two.values.citrus <= 1);
  assert.ok(!one.gaps.includes('citrus'));
  assert.ok(one.gaps.includes('leather'));
});

test('öneri: sahip olunanı önermez, en güçlüyü öne alır', () => {
  const cat = [
    { id: 'a', family: 'leather' as const, name: 'A' },
    { id: 'b', family: 'woody' as const, name: 'B' },
    { id: 'c', family: 'leather' as const, name: 'Leather Noir' },
  ];
  const s = suggestFor('leather', cat, new Set(['a']));
  assert.deepEqual(s.map((x) => x.id), ['c']);
});

test('öneri: gerçek nota verisi olan, tahminliden önce gelir', () => {
  const cat = [
    { id: 'est', family: 'leather' as const, name: 'Leather Noir' },
    { id: 'real', family: 'woody' as const, name: 'X', notes: { leather: 0.7 } },
  ];
  assert.deepEqual(suggestFor('leather', cat, new Set()).map((x) => x.id), ['real', 'est']);
});
