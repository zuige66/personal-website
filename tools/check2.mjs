import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(()=>{});
await page.evaluate(() => {
  const el = document.querySelector('#contact');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
});
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('.contact__words span')];
  return {
    count: spans.length,
    html: document.querySelector('#contactWords').innerHTML.slice(0, 200),
    items: spans.map(s => {
      const i = s.querySelector('i');
      return { text: i?.textContent, style: i?.getAttribute('style'), transform: i ? getComputedStyle(i).transform : null, h: s.offsetHeight };
    }),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
