import { chromium } from 'playwright';
import fs from 'fs';

const URL = process.env.URL || 'http://127.0.0.1:5173/';
const OUT = process.env.OUT || 'shots';
const W = Number(process.env.W || 1440);
const H = Number(process.env.H || 900);

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath:
    'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// 等载入层消失
try {
  await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 });
} catch {
  errors.push('[timeout] 载入层未消失');
}
await page.waitForTimeout(2200);

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};

await shot('01-hero');

// 悬停一个导航项，验证 hover 反色
await page.mouse.move(W * 0.72, H * 0.46);
await page.waitForTimeout(700);
await shot('02-hero-hover');

// 逐段滚动截图
const sections = [
  ['03-statement', '.statement', 0],
  ['04-works', '#works', 0.35],
  ['05-projects', '#projects', 0],
  ['06-blog', '#blog', 0],
  ['07-photos', '#photos', 0],
  ['08-resume', '#resume', 0],
  ['09-about', '#about', 0],
  ['10-contact', '#contact', 0],
];

for (const [name, sel, ratio] of sections) {
  const y = await page.evaluate(
    ([s, r]) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const h = el.offsetHeight;
      return Math.round(top + h * r);
    },
    [sel, ratio]
  );
  if (y == null) {
    errors.push(`[missing] ${sel}`);
    continue;
  }
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(1400);
  await shot(name);
}

// 移动端
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await m.goto(URL, { waitUntil: 'domcontentloaded' });
await m.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(() => {});
await m.waitForTimeout(2500);
await m.screenshot({ path: `${OUT}/11-mobile-hero.png` });
console.log('shot 11-mobile-hero');

const metrics = await page.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  worksTrack: document.querySelector('#worksTrack')?.scrollWidth,
  photos: document.querySelectorAll('.photo-item').length,
  canvas: !!document.querySelector('#gl'),
}));

console.log('\n--- metrics ---');
console.log(JSON.stringify(metrics, null, 2));
console.log('\n--- console ---');
console.log(errors.length ? errors.slice(0, 40).join('\n') : '（无报错）');

await browser.close();
