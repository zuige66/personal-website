/**
 * 逐帧采样：rAF 直接记录 opacity / panel 位移，排除截图等待造成的时序偏差。
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.URL || 'http://127.0.0.1:5173/';
const OUT = process.env.OUT || 'shots/veil';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  window.__opened = [];
  window.open = (u) => { window.__opened.push(u); return { set opener(_v) {} }; };
});

const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const el = document.querySelector('#projects');
  window.scrollTo(0, Math.round(el.getBoundingClientRect().top + window.scrollY));
});
await page.waitForTimeout(900);

const link = page.locator(process.env.LINK || '#projList a').first();
await link.hover();
await page.waitForTimeout(400);

await page.evaluate(() => {
  window.__log = [];
  const label = document.querySelector('#veilLabel');
  const panel = document.querySelector('.veil__panel');
  window.__t0 = performance.now();
  const tick = () => {
    const cs = getComputedStyle(panel);
    const m = new DOMMatrix(cs.transform);
    window.__log.push([
      Math.round(performance.now() - window.__t0),
      +(+getComputedStyle(label).opacity).toFixed(2),
      Math.round(m.m42),
    ]);
    if (window.__log.length < 130) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

await link.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/mid-600.png` });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/mid-1100.png` });
await page.waitForTimeout(1200);

const log = await page.evaluate(() => window.__log);
// 只打印关键拐点：每 ~6 帧
console.log('t(ms)  labelOpacity  panelTranslateY');
for (let i = 0; i < log.length; i += 6) {
  console.log(String(log[i][0]).padStart(4), String(log[i][1]).padStart(13), String(log[i][2]).padStart(14));
}
console.log('\nopened:', await page.evaluate(() => window.__opened));
await browser.close();
