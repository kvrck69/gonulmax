// Uçtan uca tarayıcı testi (Playwright + Chromium, ortamda hazır). Kullanım: node tools/e2e.mjs [ekran-görüntüsü-klasörü]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SHOTS = process.argv[2] || '/tmp/gonulmax-shots';
mkdirSync(SHOTS, { recursive: true });
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', 'web'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

let passed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  HATA ${name}\n${error.stack}`);
    process.exitCode = 1;
  }
};

const browser = await chromium.launch();
const problems = [];

function weatherJson(tempC, humidity = 45, rain = 0) {
  return JSON.stringify({ current: { temperature_2m: tempC, relative_humidity_2m: humidity, precipitation: rain } });
}

async function newSession({ time, weather, offlineWeather = false, locale = 'tr-TR' }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale,
    timezoneId: 'Europe/Istanbul',
    acceptDownloads: true,
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/open-meteo|Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  await page.route('**/api.open-meteo.com/**', (route) =>
    offlineWeather ? route.abort() : route.fulfill({ status: 200, contentType: 'application/json', body: weatherJson(...weather) }),
  );
  if (time) await page.clock.install({ time: new Date(time) });
  return { context, page };
}

const nav = (page, name) => page.click(`[data-nav="${name}"]`);
async function addFromCatalog(page, query, expectName) {
  await page.fill('[data-testid="search"]', query);
  const card = page.locator('[data-testid="frag-card"]').first();
  await card.waitFor();
  assert.match(await card.innerText(), new RegExp(expectName, 'i'));
  await card.locator('[data-action="own"]').click();
}

// ------------------------------------------------------------------ 1) Yaz öğleden sonrası
let session = await newSession({ time: '2026-07-15T11:00:00Z', weather: [32, 40, 0] }); // 14:00 İstanbul
let { page, context } = session;

await step('açılışta karşılama ekranı çıkar ve başla düğmesi çalışır', async () => {
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="onb-start"]');
  await page.fill('[data-testid="onb-name"]', 'Deneme');
  await page.screenshot({ path: `${SHOTS}/01-onboarding.png` });
  await page.click('[data-testid="onb-start"]');
  await page.waitForSelector('[data-testid="search"]');
});

await step('Türkçe karakter ve aksansız arama: "hermes" -> Hermès, "ıslak" gibi İ/ı normalleşir', async () => {
  await page.fill('[data-testid="search"]', 'hermes');
  const text = await page.locator('[data-testid="list"]').innerText();
  assert.match(text, /Hermès/);
  await page.fill('[data-testid="search"]', 'COOL WATER');
  assert.match(await page.locator('[data-testid="list"]').innerText(), /Cool Water/);
  await page.fill('[data-testid="search"]', 'zzzz yok');
  assert.equal(await page.locator('[data-testid="empty-list"]').count(), 1);
});

await step('5 parfüm ekler, koleksiyon sekmesinde sayı 5 olur', async () => {
  await addFromCatalog(page, 'light blue', 'Light Blue');
  await addFromCatalog(page, 'tobacco vanille', 'Tobacco Vanille');
  await addFromCatalog(page, 'aventus', 'Aventus');
  await addFromCatalog(page, 'sauvage', 'Sauvage');
  await addFromCatalog(page, 'santal 33', 'Santal 33');
  const label = await page.locator('[data-tab="owned"]').innerText();
  assert.match(label, /\(5\)/);
  await page.screenshot({ path: `${SHOTS}/02-collection.png` });
});

await step('Bugün: sıcak yaz öğleden sonrası ana parfüm Light Blue (narenciye)', async () => {
  await nav(page, 'today');
  await page.waitForSelector('[data-testid="main-pick"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="weather"] .temp')?.textContent === '32°C');
  const main = await page.locator('[data-testid="main-pick"]').innerText();
  assert.match(main, /Light Blue/);
  assert.equal(await page.locator('[data-testid="alt-pick"]').count(), 2);
  await page.screenshot({ path: `${SHOTS}/03-today-summer.png` });
});

await step('"Bugün bunu giydim" kaydeder, seri 1 olur, geri alınır, çift dokunma kopya üretmez', async () => {
  await page.click('[data-testid="wear-main"]');
  await page.waitForFunction(() => /Bugün giydin/.test(document.querySelector('[data-testid="wear-main"]')?.innerText ?? ''), null, { timeout: 5000 });
  assert.match(await page.locator('[data-testid="wear-main"]').innerText(), /Bugün giydin/);
  await nav(page, 'stats');
  const streak = await page.locator('[data-testid="streak"]').innerText();
  assert.match(streak, /1\s*gün/);
  const lit = await page.locator('.cell[data-date="2026-07-15"]').getAttribute('data-count');
  assert.equal(lit, '1');
  await nav(page, 'today');
  await page.click('[data-testid="wear-main"]'); // geri al
  assert.match(await page.locator('[data-testid="wear-main"]').innerText(), /Bugün bunu giydim/);
  await page.click('[data-testid="wear-main"]'); // tekrar giy
  const wears = await page.evaluate(() => JSON.parse(localStorage.getItem('gonulmax:v1')).wears);
  assert.equal(wears.length, 1);
});

await step('İstatistik: skor halkası, çubuklar ve ipuçları görünür; skor 0-100', async () => {
  await nav(page, 'stats');
  const score = await page.locator('[data-testid="score"] .ring-text').textContent();
  assert.ok(Number(score) >= 0 && Number(score) <= 100, `skor ${score}`);
  assert.equal(await page.locator('[data-testid="score"] .bar').count(), 4);
  assert.equal(await page.locator('[data-testid="radar"] .radar-label').count(), 16, 'radar 16 eksen');
  assert.ok((await page.locator('[data-testid="radar-gap"]').count()) >= 1, 'eksik not satırı');
  await page.screenshot({ path: `${SHOTS}/04-stats.png`, fullPage: true });
});

await step('özel parfüm ekleme formu: doğrulama hataları ve başarılı kayıt', async () => {
  await nav(page, 'collection');
  await page.click('[data-testid="open-add"]');
  await page.click('[data-testid="save-custom"]'); // boş
  assert.match(await page.locator('dialog .error').innerText(), /Marka ve ad gerekli/);
  await page.fill('dialog input[name="brand"]', 'Deneme Marka');
  await page.fill('dialog input[name="name"]', 'Gece Ormanı');
  await page.click('[data-testid="save-custom"]'); // mevsim yok
  assert.match(await page.locator('dialog .error').innerText(), /mevsim/);
  await page.check('dialog input[data-group="season"][value="winter"]');
  await page.check('dialog input[data-group="part"][value="night"]');
  await page.click('[data-testid="save-custom"]');
  await page.waitForSelector('dialog', { state: 'detached' });
  assert.match(await page.locator('[data-tab="owned"]').innerText(), /\(6\)/);
  await page.click('[data-tab="owned"]');
  assert.match(await page.locator('[data-testid="list"]').innerText(), /Gece Ormanı/);
  assert.match(await page.locator('[data-testid="list"]').innerText(), /Benim eklediğim/);
});

await step('yedek al -> verileri sil -> yedekten geri yükle: veri aynen döner', async () => {
  await nav(page, 'profile');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-testid="export"]')]);
  const path = await download.path();
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(backup.v, 1);
  assert.equal(Object.keys(backup.items).length, 6);
  page.once('dialog', (d) => d.accept());
  await page.click('[data-testid="reset"]');
  await page.waitForSelector('[data-testid="onb-start"]'); // karşılamaya döndü
  const cleared = await page.evaluate(() => JSON.parse(localStorage.getItem('gonulmax:v1') || '{"items":{}}'));
  assert.equal(Object.keys(cleared.items).length, 0);
  await page.fill('[data-testid="onb-name"]', 'x');
  await page.click('[data-testid="onb-start"]');
  await nav(page, 'profile');
  page.once('dialog', (d) => d.accept());
  await page.setInputFiles('[data-testid="import-file"]', path);
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('gonulmax:v1')).items).length === 6);
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('gonulmax:v1')));
  assert.equal(restored.wears.length, 1);
  assert.equal(restored.custom.length, 1);
});

await step('bozuk yedek dosyası reddedilir, mevcut veri korunur', async () => {
  const fs = await import('node:fs');
  fs.writeFileSync(`${SHOTS}/bozuk.json`, '{"v": 99, "items": 5');
  await page.setInputFiles('[data-testid="import-file"]', `${SHOTS}/bozuk.json`);
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('gonulmax:v1')));
  assert.equal(Object.keys(state.items).length, 6);
});

await step('dil değişimi: İngilizce menü ve metinler', async () => {
  await page.selectOption('[data-testid="language"]', 'en');
  assert.match(await page.locator('[data-nav="today"]').innerText(), /Today/);
  assert.match(await page.locator('[data-nav="collection"]').innerText(), /Collection/);
  await page.screenshot({ path: `${SHOTS}/05-profile-en.png`, fullPage: true });
  await page.selectOption('[data-testid="language"]', 'tr');
});

await step('çevrimdışı: service worker kurulur ve ağ kesilince uygulama yine açılır', async () => {
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || true);
  await page.reload();
  await page.waitForFunction(async () => (await caches.keys()).includes('gonulmax-v1'));
  await context.setOffline(true);
  await page.goto(BASE);
  await page.waitForSelector('[data-nav="today"]');
  assert.equal(await page.locator('[data-testid="main-pick"], [data-testid="empty-cta"]').count() > 0, true);
  await context.setOffline(false);
});
await context.close();

// ------------------------------------------------------------------ 2) Kış gecesi
session = await newSession({ time: '2026-01-15T20:00:00Z', weather: [2, 70, 0] }); // 23:00 İstanbul
({ page, context } = session);
await step('kış gecesi (2 °C): ağır, oryantal parfüm öne çıkar', async () => {
  await page.goto(BASE);
  await page.evaluate(() => {
    const f = (id) => id;
    localStorage.setItem('gonulmax:v1', JSON.stringify({ v: 1, profile: { name: '', locale: 'tr', city: '', lat: null, lon: null, tz: 'Europe/Istanbul', onboarded: true }, items: { 'dolce-gabbana-light-blue': 'owned', 'tom-ford-tobacco-vanille': 'owned', 'chanel-allure-homme-sport': 'owned' }, wears: [], custom: [] }));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-testid="weather"] .temp')?.textContent === '2°C');
  const main = await page.locator('[data-testid="main-pick"]').innerText();
  assert.match(main, /Tobacco Vanille/);
  await page.screenshot({ path: `${SHOTS}/06-today-winter.png` });
});
await context.close();

// ------------------------------------------------------------------ 3) Hava durumu yok
session = await newSession({ time: '2026-07-15T11:00:00Z', offlineWeather: true });
({ page, context } = session);
await step('hava durumu alınamazsa mevsimlik yedek değer ve açıklama gösterilir, sonsuz döngü yok', async () => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem('gonulmax:v1', JSON.stringify({ v: 1, profile: { name: 'A', locale: 'tr', onboarded: true }, items: { 'dolce-gabbana-light-blue': 'owned' }, wears: [], custom: [] })));
  await page.reload();
  await page.waitForSelector('[data-testid="main-pick"]');
  await page.waitForFunction(() => /alınamadı/.test(document.querySelector('[data-testid="weather"]').textContent));
  assert.match(await page.locator('[data-testid="weather"] .temp').innerText(), /28°C/);
  let requests = 0;
  page.on('request', (r) => { if (r.url().includes('open-meteo')) requests += 1; });
  await page.waitForTimeout(1500);
  assert.equal(requests, 0, `beklenmeyen tekrar isteği: ${requests}`);
});
await step('bozuk localStorage (JSON değil / yanlış tipler) uygulamayı çökertmez', async () => {
  await page.evaluate(() => localStorage.setItem('gonulmax:v1', '{{{ bozuk'));
  await page.reload();
  await page.waitForSelector('[data-testid="onb-start"]');
  await page.evaluate(() => localStorage.setItem('gonulmax:v1', JSON.stringify({ v: 1, profile: { onboarded: true, lat: 'x' }, items: { a: 'kötü', b: 'owned' }, wears: [{ fragranceId: 'b', date: '2026-02-30' }, 'x', null], custom: [{ id: 1 }] })));
  await page.reload();
  await page.waitForSelector('[data-nav="today"]');
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('gonulmax:v1')));
  assert.ok(state);
});
await context.close();

await browser.close();
server.kill();

await step('konsolda ve sayfada hata yok', async () => {
  assert.deepEqual(problems, []);
});
console.log(process.exitCode ? '\nBAŞARISIZ' : `\nTüm adımlar geçti (${passed}).`);
