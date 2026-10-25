import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text()); });
for (const [name, src] of [['min-front','/character.min.glb']]) {
  await page.goto(`http://127.0.0.1:5173/debug.html?view=front&src=${encodeURIComponent(src)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 40000 }).catch(()=>console.log('timeout', name));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `C:/Users/lirui/AppData/Local/Temp/wbshots/${name}.png` });
  console.log(name, await page.textContent('#hud'));
}
await browser.close();
