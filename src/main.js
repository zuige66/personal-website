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
      (p) => `<li><a href="${p.href}" data-img="${p.image}">
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
      (p) => `<li><a href="#" data-img="${p.image}">
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
  $('#footLoc').textContent = site.location.toUpperCase();

  // —— HUD 文案 ——
  $('#heroRole').textContent = site.role;
  $('#heroLoc').textContent = site.location.toUpperCase();
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

  $$('.kicker').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 12,
      duration: 0.8,
      scrollTrigger: { trigger: el, start: 'top 92%' },
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

function buildHoverFloats() {
  const setup = (listSel, floatSel) => {
    const float = $(floatSel);
    const img = float.querySelector('img');
    const mx = gsap.quickTo(float, 'x', { duration: 0.5, ease: 'power3' });
    const my = gsap.quickTo(float, 'y', { duration: 0.5, ease: 'power3' });

    window.addEventListener('pointermove', (e) => {
      mx(e.clientX); my(e.clientY);
    });

    $$(`${listSel} a`).forEach((a) => {
      a.addEventListener('pointerenter', () => {
        img.src = a.dataset.img;
        float.classList.add('is-on');
      });
      a.addEventListener('pointerleave', () => float.classList.remove('is-on'));
    });
  };
  setup('#projList', '#projFloat');
  setup('#blogList', '#blogFloat');
}

/* ============================================================
   6. 目录 / 时钟
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
   7. 主流程
   ============================================================ */
async function init() {
  document.body.classList.add('is-loading');
  renderContent();
  buildOverlay();
  buildCursor();
  buildHoverFloats();

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

  try {
    const canvas = $('#gl');
    scene = new HeroScene(canvas);
    loaderText.textContent = '正在载入墨与骨骼';

    await scene.loadCharacter('/character.min.glb', (p) => {
      glProgress = p;
      setProgress(0.1 + p * 0.86);
    });

    orbit = new OrbitNav(scene.scene, scene.camera, nav, {
      onHover: (item) => {
        document.body.classList.toggle('cursor-hot', !!item);
        words?.setDim(item ? 0.3 : 1);
      },
    });

    words = new HeroWords(scene.scene, scene.camera, heroWords, scene.viewportH);

    scene.addUpdater((t, dt, pointer) => {
      // 人物：轻微呼吸 + 跟随指针
      if (scene.character) {
        scene.character.position.y = Math.sin(t * 0.8) * 0.012;
        scene.character.rotation.y = lerp(scene.character.rotation.y, pointer.x * 0.14, 0.05);
        scene.character.rotation.x = lerp(scene.character.rotation.x, -pointer.y * 0.04, 0.05);
      }
      orbit.update(t, dt, pointer);
      words.update(t, pointer);
    });

    scene.start();
    assetsDone = true;
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
    .from('.hero__side', { opacity: 0, duration: 1, stagger: 0.1 }, '-=0.8')
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
      orbit?.setVisible(1 - Math.max(0, (p - 0.3) / 0.45));
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
