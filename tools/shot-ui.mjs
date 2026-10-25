import { chromium } from 'playwright';
const OUT = process.env.OUT || 'C:/Users/lirui/AppData/Local/Temp/wbshots';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(()=>{});
await page.waitForTimeout(1500);

// 打开目录
await page.click('#menuBtn');
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/ui-index.png` });
console.log('shot ui-index');

await page.keyboard.press('Escape');
await page.waitForTimeout(900);

// hover 导航（扫描找到会命中的位置）
let found = null;
for (let x = 0.1; x <= 0.9 && !found; x += 0.05) {
  for (let y = 0.3; y <= 0.75; y += 0.05) {
    await page.mouse.move(1440 * x, 900 * y);
    await page.waitForTimeout(90);
    const hot = await page.evaluate(() => document.body.classList.contains('cursor-hot'));
    if (hot) { found = [x, y]; break; }
  }
}
if (found) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/ui-navhover.png` });
  console.log('shot ui-navhover at', found);
} else console.log('未命中导航');
await browser.close();
