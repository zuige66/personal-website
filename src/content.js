/**
 * ============================================================
 *  站点内容 —— 只需要改这个文件
 * ============================================================
 *  所有文字 / 链接 / 图片路径都集中在这里。
 *  图片放到 public/media/ 下面，路径写成 "/media/xxx.jpg"。
 */

export const site = {
  name: 'YAO KONG',
  alias: 'yao*kong',
  role: 'Visual Designer & Creative Developer',
  roleCn: '视觉设计 / 创意开发',
  location: 'Shanghai, China',
  email: 'hello@yaokong.studio',
  since: '2018',
  intro:
    '我在图像、代码与空间之间工作。做视觉识别，也做能跑起来的界面。喜欢把粗糙的笔触交给精确的代码去执行。',
  socials: [
    { label: 'GitHub', href: 'https://github.com/' },
    { label: 'Instagram', href: 'https://instagram.com/' },
    { label: 'Behance', href: 'https://behance.net/' },
    { label: 'X', href: 'https://x.com/' },
  ],
};

/** 环绕在 3D 人物周围的导航（顺序 = 环绕顺序） */
export const nav = [
  { id: 'works',    index: '01', label: 'WORKS',    jp: '作品',   en: 'Selected Works' },
  { id: 'projects', index: '02', label: 'PROJECTS', jp: '項目',   en: 'Side Projects' },
  { id: 'blog',     index: '03', label: 'BLOG',     jp: '日記',   en: 'Notes & Writing' },
  { id: 'photos',   index: '04', label: 'PHOTOS',   jp: '写真',   en: 'Photo Archive' },
  { id: 'resume',   index: '05', label: 'RESUME',   jp: '履歴',   en: 'Experience' },
  { id: 'about',    index: '06', label: 'ABOUT',    jp: '紹介',   en: 'About Me' },
];

/** 首页背景散落的漫画字（会与人物产生前后遮挡） */
export const heroWords = [
  { text: 'FEEL ME',        x: -0.68, y: 0.22, z: 0.85, size: 0.175, rot: -13, weight: 900, italic: true,  style: 'solid' },
  { text: 'I FEEL GOOD',    x: 0.66,  y: 0.72, z: -1.7, size: 0.058, rot: 9,   weight: 900, italic: false, style: 'solid' },
  { text: '感じる',          x: 0.60,  y: 0.34, z: -0.9, size: 0.074, rot: -4,  weight: 700, italic: false, style: 'solid', jp: true },
  { text: '幸せを感じて',      x: 0.72,  y: 0.52, z: -1.2, size: 0.026, rot: 6,  weight: 500, italic: false, style: 'solid', jp: true },
  { text: '≡≡のみ',          x: 0.56,  y: -0.64, z: 0.9,  size: 0.044, rot: -6,  weight: 700, italic: false, style: 'solid', jp: true },
  { text: 'たしかめた',        x: 0.38,  y: -0.82, z: -1.8, size: 0.018, rot: -2, weight: 400, italic: false, style: 'ghost', jp: true },
];

/** 作品：横向 pinned 滚动画廊 */
export const works = [
  { index: '01', title: 'INK / 墨',      year: '2025', type: 'Visual Identity', client: 'MUTE Studio',   image: '/media/work-01.svg', desc: '为一间声音实验室做的黑白识别系统，字形取自毛笔断笔。' },
  { index: '02', title: 'STILL LIFE',    year: '2024', type: 'Art Direction',  client: 'PAPER Mag',     image: '/media/work-02.svg', desc: '静物摄影与排版实验，讨论纸与光的重量。' },
  { index: '03', title: 'NOISE FLOOR',   year: '2024', type: 'Web Experience', client: 'Sony Beta',     image: '/media/work-03.svg', desc: '用 WebGL 把噪音变成可以行走的地形。' },
  { index: '04', title: 'MUTE',          year: '2023', type: 'Brand Film',     client: 'Self-initiated', image: '/media/work-04.svg', desc: '一个关于沉默的短片，全片无对白。' },
  { index: '05', title: 'DRY SEASON',    year: '2023', type: 'Editorial',      client: 'KINFOLK CN',    image: '/media/work-05.svg', desc: '二十四页的干旱季专题，全部在甘肃拍摄。' },
];

/** 项目：hover 跟随图的列表 */
export const projects = [
  { index: '01', name: 'TYPE SCANNER',   year: '2025', stack: 'Rust / WASM',  status: '维护中',  image: '/media/proj-01.svg', href: '#' },
  { index: '02', name: 'SHADER NOTES',   year: '2025', stack: 'GLSL / Three.js', status: '进行中', image: '/media/proj-02.svg', href: '#' },
  { index: '03', name: 'PAPER CMS',      year: '2024', stack: 'Node / SQLite', status: '已完成', image: '/media/proj-03.svg', href: '#' },
  { index: '04', name: 'CLI KANJI',      year: '2023', stack: 'Go',           status: '已完成',  image: '/media/proj-04.svg', href: '#' },
];

/** 博客 */
export const posts = [
  { index: '001', title: '为什么我又重写了一遍自己的网站', date: '2026.09.12', tags: ['设计', '前端'], read: '8 min', image: '/media/post-01.svg', excerpt: '第七次了。每次的理由都不同，但底层原因是同一个：我想让页面像纸一样安静。' },
  { index: '002', title: '把 GLB 塞进网页要付出的代价',   date: '2026.07.03', tags: ['WebGL'],        read: '12 min', image: '/media/post-02.svg', excerpt: '19MB 的模型、26 万顶点，以及一个必须在手机上跑满 60 帧的野心。' },
  { index: '003', title: '墨、网点与屏幕分辨率',         date: '2026.05.21', tags: ['视觉'],         read: '6 min',  image: '/media/post-03.svg', excerpt: '漫画的网点是模拟的妥协，屏幕的像素是数字的固执，它们其实是同一种东西。' },
  { index: '004', title: '滚动不是交互，是节奏',         date: '2026.02.08', tags: ['动效'],         read: '9 min',  image: '/media/post-04.svg', excerpt: 'ScrollTrigger 教会我的事：先决定呼吸，再决定动画。' },
];

/** 图片档案 */
export const photos = [
  { src: '/media/photo-01.svg', caption: 'Shanghai, 2026', span: 'tall' },
  { src: '/media/photo-02.svg', caption: 'Gansu, 2025',    span: 'wide' },
  { src: '/media/photo-03.svg', caption: 'Tokyo, 2025',    span: 'normal' },
  { src: '/media/photo-04.svg', caption: 'Shanghai, 2024', span: 'normal' },
  { src: '/media/photo-05.svg', caption: 'Berlin, 2024',   span: 'tall' },
  { src: '/media/photo-06.svg', caption: 'Shanghai, 2023', span: 'wide' },
  { src: '/media/photo-07.svg', caption: 'Kyoto, 2023',    span: 'normal' },
  { src: '/media/photo-08.svg', caption: 'Shanghai, 2022', span: 'normal' },
];

/** 简历 */
export const resume = {
  summary:
    '十年在视觉与代码的交界处工作。做过品牌、做过片子、也写过跑在生产环境里的前端。相信好的界面应该有点手感。',
  experience: [
    { period: '2023 — 至今', role: 'Independent Designer & Developer', org: 'Self-employed', note: '为文化机构与独立品牌做识别与网站，兼做 WebGL 实验。' },
    { period: '2020 — 2023', role: 'Senior Visual Designer', org: 'MUTE Studio', note: '主导 12 个品牌项目，建立工作室的动态图形规范。' },
    { period: '2018 — 2020', role: 'Front-end Developer', org: 'PAPER Digital', note: '把设计稿变成会呼吸的页面，负责 3 个获奖站点。' },
    { period: '2016 — 2018', role: 'Junior Designer', org: 'Studio Nought', note: '从印刷品开始，学会对齐和留白。' },
  ],
  skills: [
    { name: 'Visual Design',  level: 95 },
    { name: 'Creative Coding', level: 88 },
    { name: 'WebGL / Shader', level: 78 },
    { name: 'Motion',         level: 84 },
    { name: 'Photography',    level: 70 },
  ],
  tools: ['Figma', 'Illustrator', 'After Effects', 'Blender', 'Three.js', 'GSAP', 'TouchDesigner', 'C4D'],
  education: '中国美术学院 · 视觉传达 · 2012—2016',
};

/** 页脚大字 */
export const footerWords = ['LET’S', 'MAKE', 'SOMETHING'];
