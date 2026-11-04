// Paket gerektirmeyen derleme: app/src altındaki saf TypeScript dosyalarını (core + config)
// Node'un yerleşik tür soyucusuyla tarayıcıda çalışan JS'e çevirip web/js altına yazar.
// Kullanım (proje kökünden): node tools/build.mjs
import { stripTypeScriptTypes } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const jobs = [];
for (const file of readdirSync('app/src/core')) {
  if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file === 'fixtures.ts') continue;
  jobs.push([`app/src/core/${file}`, `web/js/core/${file.replace(/\.ts$/, '.js')}`]);
}
jobs.push(['app/src/config.ts', 'web/js/config.js']);

for (const [from, to] of jobs) {
  const source = readFileSync(from, 'utf8');
  let code = stripTypeScriptTypes(source);
  // './x.ts' içe aktarımlarını './x.js' yap
  code = code.replace(/(from\s+['"][^'"]+)\.ts(['"])/g, '$1.js$2');
  mkdirSync(to.slice(0, to.lastIndexOf('/')), { recursive: true });
  writeFileSync(
    to,
    `// OTOMATİK ÜRETİLDİ: ${from} dosyasından. Elle düzenleme; kaynağı değiştirip \`node tools/build.mjs\` çalıştır.\n${code}`,
  );
  console.log(`${from} -> ${to}`);
}
