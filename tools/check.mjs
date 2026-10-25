import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('requestfailed', r => console.log('[404]', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(()=>{});
await page.evaluate(() => {
  const el = document.querySelector('#photos');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
});
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('.photo-item img')];
  return imgs.slice(0,4).map(i => ({
    src: i.getAttribute('src'),
    cls: i.className,
    opacity: getComputedStyle(i).opacity,
    complete: i.complete,
    nw: i.naturalWidth,
    parentOpacity: getComputedStyle(i.parentElement).opacity,
  }));
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
