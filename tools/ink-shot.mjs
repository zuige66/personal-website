import { chromium } from 'playwright';
const OUT = process.env.OUT || 'D:/Workplace/person-website/.preview';
const views = process.argv.slice(2);
const list = views.length ? views : ['face', 'face3q'];
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text().slice(0,300)); else if (m.text().startsWith('[head]')) console.log(m.text()); });
for (const v of list) {
  const [name, qs] = v.split('::');
  const url = `http://127.0.0.1:5173/debug.html?${qs || 'ink=1'}&view=${name}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 40000 }).catch(()=>console.log('timeout', name));
  await page.waitForTimeout(600);
  const out = `${OUT}/ink-${name}${qs ? '-' + qs.replace(/[^a-z0-9]/gi,'') : ''}.png`;
  await page.screenshot({ path: out });
  console.log('shot', out);
}
await browser.close();
