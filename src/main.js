import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import {
  site, nav, heroWords, works, projects, posts, photos, resume, footerWords,
} from './content.js';
import { HeroScene } from './webgl/HeroScene.js';
import { OrbitNav } from './webgl/OrbitNav.js';
import { HeroWords } from './webgl/HeroWords.js';

gsap.registerPlugin(ScrollTrigger);

if (import.meta.env?.DEV) {
  window.gsap = gsap;
  window.ScrollTrigger = ScrollTrigger;
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;

/* ============================================================
   1. 平滑滚动
   ============================================================ */
const lenis = new Lenis({
  duration: 1.15,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 1.6,
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ============================================================
   2. 内容渲染
   ============================================================ */
function renderContent() {
  // —— 跑马灯 ——
  const tickerWords = [...nav.map((n) => n.label), 'AVAILABLE FOR WORK', ...nav.map((n) => n.jp)];
  const track = $('#tickerTrack');
  track.innerHTML = Array.from({ length: 3 })
    .map(() => tickerWords.map((w) => `<span class="ticker__item">${w}<span class="dot"></span></span>`).join(''))
    .join('');

  // —— 目录遮罩 ——
  $('#indexNav').innerHTML = nav
    .map(
      (n) => `<a href="#${n.id}" data-nav="${n.id}">
        <span class="idx">${n.index}</span>
        <span class="label"><i>${n.label}</i></span>
        <span class="jp">${n.jp}</span>
      </a>`
    )
    .join('');
  $('#indexSocials').innerHTML = site.socials
    .map((s) => `<a href="${s.href}" target="_blank" rel="noopener">${s.label}</a>`)
    .join('');
  $('#indexMail').textContent = site.email;
  $('#indexMail').href = `mailto:${site.email}`;

  // —— hero 兜底导航 ——
  $('#heroFallback').innerHTML = nav
    .map((n) => `<a href="#${n.id}">${n.label}</a>`)
    .join('');

  // —— 作品 ——
  $('#worksTrack').innerHTML = works
    .map(
      (w) => `<article class="work-card" data-cursor="view">
        <div class="work-card__media">
          <img src="${w.image}" alt="${w.title}" loading="lazy" />
          <span class="work-card__idx">${w.index}</span>
        </div>
        <div class="work-card__row">
          <h3 class="work-card__title">${w.title}</h3>
          <span class="work-card__year">${w.year}</span>
        </div>
        <p class="work-card__type">${w.type} · ${w.client}</p>
      </article>`
    )
    .join('');

  // —— 项目 ——
  $('#projList').innerHTML = projects
    .map(
      (p) => `<li><a href="${p.href}" target="_blank" rel="noopener noreferrer">
        <span class="idx">${p.index}</span>
        <span class="name">${p.name}</span>
        <span class="stack">${p.stack}</span>
        <span class="status">${p.year} · ${p.status}</span>
      </a></li>`
    )
    .join('');

  // —— 博客 ——
  $('#blogList').innerHTML = posts
    .map(
      (p) => `<li><a href="${p.href || '#'}" target="_blank" rel="noopener noreferrer">
        <span class="idx">${p.index}</span>
        <span class="title">${p.title}</span>
        <span class="meta"><span>${p.date}</span><span>${p.read}</span></span>
      </a></li>`
    )
    .join('');

  // —— 图片 ——
  $('#photoGrid').innerHTML = photos
    .map(
      (p) => `<figure class="photo-item ${p.span === 'wide' ? 'span-wide' : p.span === 'tall' ? 'span-tall' : ''}">
        <img src="${p.src}" alt="${p.caption}" loading="lazy" />
        <figcaption>${p.caption}</figcaption>
      </figure>`
    )
    .join('');

  // —— 简历 ——
  $('#resumeSummary').textContent = resume.summary;
  $('#timeline').innerHTML = resume.experience
    .map(
      (e) => `<li>
        <span class="period">${e.period}</span>
        <div>
          <p class="role">${e.role}</p>
          <p class="org">${e.org}</p>
          <p class="note">${e.note}</p>
        </div>
      </li>`
    )
    .join('');
  $('#skills').innerHTML = resume.skills
    .map(
      (s) => `<li>
        <div class="row"><span>${s.name}</span><span>${s.level}</span></div>
        <div class="bar"><i data-level="${s.level}"></i></div>
      </li>`
    )
    .join('');
  $('#tools').innerHTML = resume.tools.map((t) => `<li>${t}</li>`).join('');
  $('#edu').textContent = resume.education;

  // —— 关于 ——
  $('#aboutLead').textContent = site.intro;
  $('#aboutRows').innerHTML = [
    `<a href="mailto:${site.email}"><span>EMAIL</span><span>${site.email}</span></a>`,
    `<a href="#" data-nav="contact"><span>LOCATION</span><span>${site.location}</span></a>`,
    ...site.socials.map(
      (s) => `<a href="${s.href}" target="_blank" rel="noopener"><span>${s.label}</span><span>↗</span></a>`
    ),
  ].join('');

  // —— 联系 ——
  $('#contactWords').innerHTML = footerWords
    .map((w) => `<span><i>${w}</i></span>`)
    .join('');
  const mail = $('#contactMail');
  mail.href = `mailto:${site.email}`;
  mail.querySelector('span').textContent = site.email;

  // —— HUD 文案 ——
  $('#heroRole').textContent = site.role;
  document.title = `${site.name} — ${site.role}`;
}

/* ============================================================
   3. 文字工具
   ============================================================ */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const frag = document.createDocumentFragment();
  [...text].forEach((ch) => {
    if (ch === ' ') {
      frag.appendChild(document.createTextNode(' '));
      return;
    }
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = ch;
    frag.appendChild(span);
  });
  el.appendChild(frag);
  return [...el.querySelectorAll('.w')];
}

/* ============================================================
   4. 滚动动效
   ============================================================ */
function buildScrollAnimations() {
  const mm = gsap.matchMedia();

  // —— 宣言：逐字浮现 ——
  const chars = splitChars($('#statementText'));
  gsap.fromTo(
    chars,
    { opacity: 0.12, y: '0.35em' },
    {
      opacity: 1,
      y: 0,
      ease: 'none',
      stagger: 0.6,
      scrollTrigger: {
        trigger: '#statementText',
        start: 'top 82%',
        end: 'bottom 55%',
        scrub: 0.6,
      },
    }
  );

  // —— 作品：横向 pinned ——
  mm.add('(min-width: 761px)', () => {
    const track = $('#worksTrack');
    const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);
    const tween = gsap.to(track, {
      x: () => -getDistance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.works',
        start: 'top top',
        end: () => `+=${getDistance() + window.innerHeight * 0.6}`,
        scrub: 0.8,
        pin: '.works__pin',
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          gsap.set('#worksBar', { width: `${self.progress * 100}%` });
        },
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(track, { x: 0 });
    };
  });

  // —— 区块标题：遮罩上升 ——
  $$('.sec-title').forEach((el) => {
    gsap.from(el, {
      yPercent: 26,
      opacity: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  // —— 列表行：错位淡入 ——
  ['.proj-list li', '.blog-list li', '.timeline li', '.tools li'].forEach((sel) => {
    gsap.from(sel, {
      y: 24,
      opacity: 0,
      duration: 0.9,
      ease: 'power2.out',
      stagger: 0.07,
      scrollTrigger: { trigger: sel, start: 'top 90%' },
    });
  });

  // —— 技能条 ——
  $$('#skills .bar i').forEach((bar, i) => {
    gsap.fromTo(
      bar,
      { width: '0%' },
      {
        width: `${bar.dataset.level}%`,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: '#skills',
          start: 'top 92%',
          end: 'top 45%',
          scrub: 0.8,
        },
      }
    );
  });

  // —— 图片：进场 ——
  $$('.photo-item').forEach((el, i) => {
    gsap.from(el, {
      y: 70,
      opacity: 0,
      clipPath: 'inset(0 0 100% 0)',
      duration: 1.2,
      ease: 'power3.out',
      delay: (i % 4) * 0.07,
      scrollTrigger: { trigger: el, start: 'top 94%' },
    });
  });

  // —— 联系大字：随滚动逐行升起 ——
  const cw = $$('.contact__words span i');
  gsap.set(cw, { yPercent: 112 });
  gsap.to(cw, {
    yPercent: 0,
    ease: 'none',
    stagger: 0.12,
    scrollTrigger: {
      trigger: '.contact',
      start: 'top 92%',
      end: 'top 35%',
      scrub: 0.9,
    },
  });

  // —— 跑马灯随滚动加速 ——
  const tickerTrack = $('#tickerTrack');
  let tickerX = 0;
  const tickerLoop = () => {
    tickerX -= 0.6;
    const half = tickerTrack.scrollWidth / 3;
    if (Math.abs(tickerX) >= half) tickerX += half;
    tickerTrack.style.transform = `translate3d(${tickerX}px,0,0)`;
    requestAnimationFrame(tickerLoop);
  };
  tickerLoop();
}

/* ============================================================
   5. 光标 / 悬浮图
   ============================================================ */
function buildCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const ring = document.createElement('div');
  ring.className = 'cursor';
  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  document.body.append(ring, dot);
  document.body.classList.add('has-cursor');

  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    rx(e.clientX); ry(e.clientY);
    dx(e.clientX); dy(e.clientY);
  });

  const hoverables = 'a, button, .work-card, .photo-item, .proj-list a, .blog-list a';
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest(hoverables)) ring.classList.add('is-hover');
  });
  document.addEventListener('pointerout', (e) => {
    if (e.target.closest(hoverables)) ring.classList.remove('is-hover');
  });
}

/* ============================================================
   6. 外链转场：墨幕扫过 → 新窗口打开 → 幕布自收
   ============================================================ */
function buildVeil() {
  const veil = $('#veil');
  const panel = veil.querySelector('.veil__panel');
  const label = $('#veilLabel');
  const meta = $('#veilMeta');

  let tl = null;
  let busy = false;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 定位与初始态统一由 GSAP 接管（CSS 里的 transform 会和百分比叠加，已移除）
  const layout = () => {
    gsap.set(panel, { yPercent: 102 });
    gsap.set([label, meta], { xPercent: -50, opacity: 0, y: 0 });
    gsap.set(label, { yPercent: -50 });
  };
  layout();

  // 复位：把转场留在 DOM 上的状态全清掉（含 busy 锁）
  const reset = () => {
    tl?.kill();
    tl = null;
    busy = false;
    veil.classList.remove('is-on');
    document.body.classList.remove('is-veil');
    layout();
  };

  // 新窗口打开；被拦截时退回当前页跳转，免得点了没反应
  const openInNewTab = (href) => {
    let win = null;
    try {
      win = window.open(href, '_blank');
    } catch {
      win = null;
    }
    if (!win) {
      window.location.href = href;
      return;
    }
    // 已导航到跨域地址时访问 opener 会抛错，忽略即可，不能影响跳转结果
    try { win.opener = null; } catch { /* noop */ }
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('#blogList a, #projList a');
    if (!a) return;
    if (busy) { e.preventDefault(); return; }
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    // 中键 / ⌘ / Ctrl / Shift / Alt：交给浏览器自己开新标签，不插动画
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();

    if (reducedMotion()) {
      openInNewTab(href);
      return;
    }

    busy = true;
    const toBlog = a.closest('#blogList') !== null;
    label.textContent = toBlog ? 'BLOG →' : 'GITHUB ↗';
    meta.textContent = toBlog ? 'blog.zuiges.com' : 'github.com/zuige66';
    veil.classList.add('is-on');
    document.body.classList.add('is-veil');

    tl = gsap
      .timeline({ onComplete: reset })
      // 1. 墨幕自下而上盖满
      .fromTo(panel, { yPercent: 102 }, { yPercent: 0, duration: 0.46, ease: 'power4.inOut' })
      // 2. 面板完全盖满之后才亮字：先黑屏、再白字，中间不留任何字压在页面上的瞬间
      .fromTo(label, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' }, '+=0.05')
      .fromTo(meta, { opacity: 0 }, { opacity: 0.62, duration: 0.24, ease: 'power2.out' }, '-=0.16')
      // 3. 标签亮到位的同时把新窗口递出去
      .add(() => openInNewTab(href), '-=0.04')
      // 4. 停一拍，幕布上收、标签退场
      .to([label, meta], { opacity: 0, duration: 0.2, ease: 'power2.in' }, '+=0.3')
      .to(panel, { yPercent: -102, duration: 0.46, ease: 'power4.inOut' }, '-=0.1');
  });

  // 从新标签页切回：把幕布和跟随图收干净
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reset();
  });
  // 万一走了当前页跳转，浏览器后退时 bfcache 会把旧 DOM 原样还回来
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reset();
  });
  window.addEventListener('popstate', reset);
}

/* ============================================================
   7. 目录 / 时钟
   ============================================================ */
function buildOverlay() {
  const overlay = $('#indexOverlay');
  const btn = $('#menuBtn');
  let open = false;

  const toggle = (v) => {
    open = v ?? !open;
    overlay.classList.toggle('is-open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    btn.querySelector('span').textContent = open ? 'CLOSE' : 'INDEX';
    if (open) lenis.stop();
    else lenis.start();
  };

  btn.addEventListener('click', () => toggle());
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('a')) toggle(false);
    else if (e.target === overlay || e.target.classList.contains('index-overlay__bg')) toggle(false);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) toggle(false);
  });

  // 所有锚点统一交给 lenis
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (!a) return;
    const id = a.dataset.nav;
    if (id === 'top') {
      lenis.scrollTo(0, { duration: 1.6 });
    } else {
      const target = document.getElementById(id);
      if (target) lenis.scrollTo(target, { duration: 1.6, offset: 0 });
    }
  });

  const clock = $('#clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('en-GB', {
      hour12: false, timeZone: 'Asia/Shanghai',
    });
  };
  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   8. 主流程
   ============================================================ */
async function init() {
  document.body.classList.add('is-loading');
  renderContent();
  buildOverlay();
  buildVeil();
  buildCursor();

  const loaderNum = $('#loaderNum');
  const loaderBar = $('#loaderBar');
  const loaderText = $('#loaderText');

  let glProgress = 0;
  let assetsDone = false;

  const setProgress = (p) => {
    const v = Math.round(p * 100);
    loaderNum.textContent = String(v).padStart(2, '0');
    loaderBar.style.width = `${v}%`;
  };

  // 字体
  loaderText.textContent = '正在铺开纸张';
  setProgress(0.04);
  await Promise.race([
    Promise.all([
      document.fonts.load('400 120px Anton'),
      document.fonts.load('500 20px "Space Grotesk"'),
    ]).then(() => document.fonts.ready),
    new Promise((r) => setTimeout(r, 2600)),
  ]);
  setProgress(0.1);

  // 3D
  let webglOK = true;
  let scene, orbit, words;

  // 模型选择：默认新的 Tripo 全身像；?model=v1 回到旧的半身像
  const MODEL = new URLSearchParams(location.search).get('model') === 'v1' ? 'v1' : 'v2';
  const MODEL_SRC = MODEL === 'v1' ? '/character.min.glb' : '/character-v2.min.glb';
  // 新模型没有 normalMap，靠几何法线给黑布料找回褶皱笔触
  const MODEL_INK =
    MODEL === 'v1'
      ? {}
      : {
          useNormal: false,
          blackLift: 0.55,
          foldLo: 0.50,
          foldHi: 0.72,
          edgeLift: 0.72,
          levelLo: 0.32,
          levelHi: 0.62,
          rakeLo: 0.34,
          rakeHi: 0.74,
          rakeGain: 0.85,
          cavGain: 0.42,
          lineThr: 0.17,
          halftone: 0.40,
          dotSize: 2.8,
        };

  // 人物左右偏转上限 30°：再大就把侧脸和后脑勺露出来，画面也铺太满
  const MAX_YAW = (30 * Math.PI) / 180;
  let yaw = 0;

  // 竖屏（手机）不放环绕导航：画面太窄，六个标签会全叠在脸上，
  // 移动端直接用 HUD 里的 INDEX 目录
  const navAllowed = () => window.innerWidth / window.innerHeight >= 0.9;
  let navFade = 1;
  let orbitScrollFade = 0;   // 0 = 全显，1 = 完全收起

  try {
    const canvas = $('#gl');
    scene = new HeroScene(canvas);
    scene.applyPreset(scene.presets[MODEL]);
    loaderText.textContent = '正在载入代码与骨骼';

    await scene.loadCharacter(MODEL_SRC, (p) => {
      glProgress = p;
      setProgress(0.1 + p * 0.86);
    }, MODEL_INK);

    orbit = new OrbitNav(scene.scene, scene.camera, nav, {
      // v1 是半身像，取景更紧，轨道要收回来，否则标签会顶出画面
      ...(MODEL === 'v1'
        ? { baseSize: 0.075, arc: 1.18, ringR: 0.86, baseY: 0.52, tiltK: 0.06, tiltX: 0.14 }
        : { baseSize: 0.15, arc: 0.90, ringR: 1.42, baseY: 0.46, tiltK: 0.13, tiltX: 0.18 }),
      onHover: (item) => {
        document.body.classList.toggle('cursor-hot', !!item);
        words?.setDim(item ? 0.3 : 1);
      },
    });

    // v2 取景更满：正面的散字会盖住导航，统一挪到人物身后；整体缩小一档
    const wordsCfg =
      MODEL === 'v2'
        ? heroWords.map((w) =>
            // 最大的那句挪到左下角、压到人物身后：它本来是要和人物打架的，
            // 但 v2 取景太满，留在原位会直接把导航糊掉
            w.z > 0 ? { ...w, x: -0.86, y: -0.72, z: -1.35 } : w
          )
        : heroWords;
    words = new HeroWords(scene.scene, scene.camera, wordsCfg, scene.viewportH);
    if (MODEL === 'v2') words.setScale(0.46);

    scene.addUpdater((t, dt, pointer) => {
      // 人物：轻微呼吸 + 跟随指针左右转（夹在 ±41°）
      if (scene.character) {
        const target = pointer.x * MAX_YAW + Math.sin(t * 0.24) * 0.018;
        yaw += (target - yaw) * (1 - Math.exp(-dt * 7));
        yaw = Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw));

        scene.character.position.y = Math.sin(t * 0.8) * 0.012;
        scene.character.rotation.y = yaw;
        scene.character.rotation.x = lerp(scene.character.rotation.x, -pointer.y * 0.035, 0.05);
      }
      orbit.setYaw(yaw);
      // 竖屏直接收起；横屏时按滚动进度淡出
      navFade += ((navAllowed() ? 1 : 0) - navFade) * (1 - Math.exp(-dt * 6));
      orbit.setVisible(navFade * (1 - orbitScrollFade));
      orbit.update(t, dt, pointer);
      words.update(t, pointer);
    });

    scene.start();
    assetsDone = true;

    if (import.meta.env?.DEV) {
      window.__hero = { scene, orbit, words, getYaw: () => yaw };
    }
  } catch (err) {
    console.warn('[webgl] 初始化失败，降级为平面排版', err);
    webglOK = false;
    $('#heroFallback').style.display = 'flex';
  }

  setProgress(1);
  loaderText.textContent = '准备完毕';

  // 入场
  await new Promise((r) => setTimeout(r, 320));

  const tl = gsap.timeline({
    onComplete: () => {
      document.body.classList.remove('is-loading');
      ScrollTrigger.refresh();
    },
  });

  tl.to('.loader__inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.inOut' })
    .to('#loader', {
      clipPath: 'inset(0 0 100% 0)',
      duration: 1.05,
      ease: 'expo.inOut',
    })
    .set('#loader', { display: 'none' })
    .from('.hud', { opacity: 0, y: -10, duration: 0.8, ease: 'power2.out' }, '-=0.5')
    .from('.hero__bottom > *', { opacity: 0, y: 20, duration: 0.9, stagger: 0.1, ease: 'power2.out' }, '-=0.7')
    .from('.hero__frame', { opacity: 0, duration: 1 }, '-=0.9');

  // hero 滚动：镜头推进 + 环绕旋转
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => {
      const p = self.progress;
      orbit?.setScrollProgress(p);
      if (scene) {
        scene.camera.position.z = scene.baseZ * lerp(1, 0.84, p);
      }
      if (words) words.setVisible(1 - Math.max(0, (p - 0.45) / 0.5));
      orbitScrollFade = Math.max(0, (p - 0.3) / 0.45);
      $('#gl').style.opacity = String(1 - Math.max(0, (p - 0.7) / 0.3));
    },
    onLeave: () => scene?.setActive(false),
    onEnterBack: () => scene?.setActive(true),
  });

  buildScrollAnimations();

  // 3D 导航交互
  if (webglOK && orbit) {
    const pointerNDC = { x: 0, y: 0 };
    const hero = $('.hero');

    window.addEventListener('pointermove', (e) => {
      if (window.scrollY > window.innerHeight) return;
      pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerNDC.y = -((e.clientY / window.innerHeight) * 2 - 1);
      const hit = orbit.raycast(pointerNDC);
      orbit.setHover(hit);
    });

    hero.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      const hit = orbit.raycast(pointerNDC);
      if (hit) {
        const target = document.getElementById(hit.data.id);
        if (target) lenis.scrollTo(target, { duration: 1.8 });
      }
    });
  }

  // 窗口尺寸变化后重排 3D 文字
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (words && scene) words.setViewportH(scene.viewportH);
    }, 180);
  });
}

init();
