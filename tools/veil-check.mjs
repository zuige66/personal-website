/**
 * 外链转场幕布验收：
 *  1. 幕布扫上来时标签在浅底上是否自动反色（看不清的 bug）
 *  2. 点击是否真的开新窗口（当前页不离开）
 *  3. 切回标签页后幕布 / 跟随图是否残留
 */
import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.URL || 'http://127.0.0.1:5174/';
const OUT = process.env.OUT || 'shots/veil';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(1500);

// 滚到项目区
const y = await page.evaluate(() => {
  const el = document.querySelector('#projects');
  return Math.round(el.getBoundingClientRect().top + window.scrollY);
});
await page.evaluate((v) => window.scrollTo(0, v), y);
await page.waitForTimeout(900);

const link = page.locator('#projList a').first();
await link.hover();
await page.waitForTimeout(500);

const before = page.url();
const [popup] = await Promise.all([
  ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null),
  link.click(),
]);

const shots = [];
for (const t of [120, 300, 520, 760]) {
  await page.waitForTimeout(t - (shots.length ? [120, 300, 520, 760][shots.length - 1] : 0));
  const name = `veil-${t}`;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
}

await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/veil-after.png` });

const state = await page.evaluate(() => ({
  veilOn: document.querySelector('#veil').classList.contains('is-on'),
  labelOpacity: getComputedStyle(document.querySelector('#veilLabel')).opacity,
  projFloat: document.querySelector('#projFloat').classList.contains('is-on'),
  stillHere: location.href,
  bodyIsVeil: document.body.classList.contains("is-veil"),
  cursorOpacity: getComputedStyle(document.querySelector(".cursor") || document.body).opacity,
}));

console.log(JSON.stringify({
  popupOpened: !!popup,
  popupUrl: popup ? popup.url() : null,
  stayedOnPage: page.url() === before,
  afterAnimation: state,
}, null, 2));

if (popup) await popup.close();

// 模拟从新标签页切回（关闭 popup 后本页会重新 visible）
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/veil-return.png` });
console.log('return state:', JSON.stringify(await page.evaluate(() => ({
  veilOn: document.querySelector('#veil').classList.contains('is-on'),
  labelOpacity: getComputedStyle(document.querySelector('#veilLabel')).opacity,
  projFloat: document.querySelector('#projFloat').classList.contains('is-on'),
}))));

console.log('\nerrors:', errors.length ? errors.join('\n') : '（无）');
await browser.close();
