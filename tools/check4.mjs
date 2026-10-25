import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: 'C:/Users/lirui/AppData/Local/ms-playwright/chromium-1200/chrome-win64/chrome.exe',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.body.classList.contains('is-loading'), { timeout: 45000 }).catch(()=>{});
await page.waitForTimeout(500);
const before = await page.evaluate(() => {
  const all = ScrollTrigger.getAll();
  return all.map(t => ({
    trig: (t.trigger?.className || t.trigger?.tagName || '?').toString().slice(0, 24),
    start: Math.round(t.start), end: Math.round(t.end), prog: +t.progress.toFixed(2),
    anim: !!t.animation, dur: t.animation?.duration?.()
  })).filter(t => t.trig.includes('contact') || t.trig.includes('kicker'));
});
console.log('BEFORE JUMP', JSON.stringify(before, null, 1));
await page.evaluate(() => { const el = document.querySelector('#contact'); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY); });
await page.waitForTimeout(2000);
const after = await page.evaluate(() => {
  const i = document.querySelector('.contact__words span i');
  const tw = gsap.getTweensOf(i);
  return {
    inline: i.getAttribute('style'),
    computed: getComputedStyle(i).transform,
    tweens: tw.map(t => ({ prog: t.progress(), dur: t.duration(), paused: t.paused() })),
    trigger: ScrollTrigger.getAll().filter(t => t.trigger?.classList?.contains('contact')).map(t => ({ start: Math.round(t.start), prog: +t.progress.toFixed(3), isActive: t.isActive })),
    total: ScrollTrigger.getAll().length,
  };
});
console.log('AFTER', JSON.stringify(after, null, 1));
await browser.close();
