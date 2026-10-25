import { chromium } from 'playwright';
const OUT = 'C:/Users/lirui/AppData/Local/Temp/wbshots';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/ui-loader.png` });
console.log('ok');
await browser.close();
