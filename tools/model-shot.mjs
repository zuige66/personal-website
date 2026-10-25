import { chromium } from 'playwright';

const views = process.argv.slice(2);
const list = views.length ? views : ['front', 'side', 'back', 'top', 'iso'];

const browser = await chromium.launch({
  executablePath:
    'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

for (const v of list) {
  await page.goto(`http://127.0.0.1:5173/debug.html?view=${v}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 40000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/model-${v}.png` });
  const txt = await page.textContent('#hud');
  console.log(`--- ${v} ---\n${txt}`);
}
await browser.close();
