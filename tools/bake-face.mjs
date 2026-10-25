import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.env.OUT || 'D:/Workplace/person-website/.preview';
const views = process.argv.slice(2);
const list = views.length ? views : ['face'];

const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[err]', m.text().slice(0, 400));
});

let saved = null;
for (const spec of list) {
  const [name, qs] = spec.split('::');
  const url = `http://127.0.0.1:5173/bake.html?${qs || ''}&view=${name}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 90000 })
    .catch(() => console.log('timeout', name));
  await page.waitForTimeout(400);
  const hud = await page.evaluate(() => document.getElementById('hud')?.textContent || '');
  console.log(`[${name}] ${hud.replace(/\n/g, ' | ')}`);
  const out = `${OUT}/bake-${name}${qs ? '-' + qs.replace(/[^a-z0-9]/gi, '') : ''}.png`;
  await page.screenshot({ path: out });
  console.log('shot', out);

  if (!saved) {
    const dataUrl = await page.evaluate(() => window.__baked || '');
    if (dataUrl.startsWith('data:image/png;base64,')) {
      const buf = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
      saved = `${OUT}/basecolor-painted.png`;
      fs.writeFileSync(saved, buf);
      console.log('saved png', (buf.length / 1024).toFixed(0) + 'KB');

      for (const [key, tag] of [['__bakedWebp', 'w94'], ['__bakedWebp92', 'w90']]) {
        const du = await page.evaluate((k) => window[k] || '', key);
        if (du.startsWith('data:image/webp;base64,')) {
          const b2 = Buffer.from(du.slice('data:image/webp;base64,'.length), 'base64');
          fs.writeFileSync(`${OUT}/basecolor-${tag}.webp`, b2);
          console.log('saved webp', tag, (b2.length / 1024).toFixed(0) + 'KB');
        }
      }
    }
  }
}

await browser.close();
