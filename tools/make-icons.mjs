// SVG ikondan PNG ikonları üretir (Playwright + Chromium gerekir; ortamda hazır).
// Kullanım: node tools/make-icons.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// Özgün tasarım: koyu zemin, amber damla ve elmas.
const drop = (padding) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#16120f"/>
  <g transform="translate(256 256) scale(${padding}) translate(-256 -256)">
    <path d="M256 92c-52 74-112 128-112 204a112 112 0 0 0 224 0c0-76-60-130-112-204z" fill="#e0a458"/>
    <path d="M256 214l34 46-34 62-34-62z" fill="#16120f"/>
  </g>
</svg>`;

mkdirSync('web/icons', { recursive: true });
writeFileSync('web/icons/icon.svg', drop(1).replace('width="512" height="512"', ''));

const browser = await chromium.launch();
const page = await browser.newPage();
const targets = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['apple-touch-icon.png', 180, 1],
  ['icon-maskable-512.png', 512, 0.7], // güvenli alan için küçültülmüş
];
for (const [file, size, scale] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${drop(scale).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`);
  await page.screenshot({ path: `web/icons/${file}`, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('yazıldı', file);
}
await browser.close();
