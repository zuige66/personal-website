import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type()==='error') console.log('[console]', m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(()=>{});
await page.evaluate(() => {
  const el = document.querySelector('#contact');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
});
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('.contact__words span')];
  const st = window.ScrollTrigger?.getAll?.() ?? [];
  return {
    scrollY: window.scrollY,
    contactTop: document.querySelector('#contact').getBoundingClientRect().top,
    docH: document.documentElement.scrollHeight,
    i0: getComputedStyle(spans[0].querySelector('i')).transform,
    i0rect: spans[0].querySelector('i').getBoundingClientRect().toJSON(),
    spanH: spans[0].offsetHeight,
    triggers: st.length,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
