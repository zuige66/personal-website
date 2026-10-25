/**
 * ============================================================
 *  站点内容 —— 只需要改这个文件
 * ============================================================
 *  所有文字 / 链接 / 图片路径都集中在这里。
 *  图片放到 public/media/ 下面，路径写成 "/media/xxx.jpg"。
 *
 *  标注「待补」的字段是占位内容，等真实信息后替换。
 */

export const site = {
  name: 'zuige',
  alias: 'zuige',
  role: 'Android & Embedded Developer',
  roleCn: '安卓应用 / 嵌入式开发',
  location: 'Guangzhou, China',
  email: 'liruisen2007@163.com',
  since: '2026',
  intro:
    '广东工业大学在读。写安卓应用和系统模块，也写单片机固件——从澎湃 OS 的锁屏音乐模块，到 FreeRTOS 上的巡检机器人。喜欢把想法做成真的能跑起来的东西。',
  socials: [
    { label: 'GitHub', href: 'https://github.com/zuige66' },
    { label: 'Blog', href: 'https://blog.zuiges.com/' },
  ],
};

/** 环绕在 3D 人物周围的导航（顺序 = 环绕顺序） */
export const nav = [
  { id: 'works',    index: '01', label: 'WORKS',    jp: '作品', en: 'Selected Works' },
  { id: 'projects', index: '02', label: 'PROJECTS', jp: '项目', en: 'Open Source' },
  { id: 'blog',     index: '03', label: 'BLOG',     jp: '博客', en: 'Notes & Writing' },
  { id: 'photos',   index: '04', label: 'PHOTOS',   jp: '照片', en: 'Photo Archive' },
  { id: 'resume',   index: '05', label: 'RESUME',   jp: '简历', en: 'Experience' },
  { id: 'about',    index: '06', label: 'ABOUT',    jp: '关于', en: 'About Me' },
];

/** 首页背景散落的漫画字（会与人物产生前后遮挡） */
export const heroWords = [
  { text: 'KEEP BUILDING',  x: -0.68, y: 0.22, z: 0.85, size: 0.175, rot: -13, weight: 900, italic: true,  style: 'solid' },
  { text: 'HELLO WORLD',    x: 0.66,  y: 0.72, z: -1.7, size: 0.058, rot: 9,   weight: 900, italic: false, style: 'solid' },
  { text: '寒风吹',          x: 0.60,  y: 0.34, z: -0.9, size: 0.074, rot: -4,  weight: 700, italic: false, style: 'solid', jp: true },
  { text: '春秋蝉鸣少年归',     x: 0.72,  y: 0.52, z: -1.2, size: 0.026, rot: 6,  weight: 500, italic: false, style: 'solid', jp: true },
  { text: '≡≡运转中',        x: 0.56,  y: -0.64, z: 0.9,  size: 0.044, rot: -6,  weight: 700, italic: false, style: 'solid', jp: true },
  { text: '凌晨四点',         x: 0.38,  y: -0.82, z: -1.8, size: 0.018, rot: -2, weight: 400, italic: false, style: 'ghost', jp: true },
];

/** 作品：横向 pinned 滚动画廊 */
export const works = [
  { index: '01', title: 'HYPER MELOLOCK', year: '2026', type: 'LSPosed 模块',   client: '澎湃 OS 3',  image: '/media/work-melolock.jpg', desc: '锁屏沉浸式音乐覆盖层：把专辑封面变成真正的壁纸，带同步歌词与全屏播放器。' },
  { index: '02', title: 'TODO',           year: '2026', type: 'Android App',    client: '离线优先',   image: '/media/work-todo.jpg', desc: '一句话把事情记下来，日期、时间、提醒由它自己解析。Compose + Room，全程离线。' },
  { index: '03', title: 'BOTHOST',        year: '2026', type: 'Android 上位机', client: 'ESP32',      image: '/media/work-03.svg', desc: '工厂巡检机器人的控制端：TCP 直连下发指令，实时图表、报警分级与自动疏散。' },
  { index: '04', title: 'SMARTCAR',       year: '2025', type: 'STM32 嵌入式',   client: 'FreeRTOS',   image: '/media/work-04.svg', desc: '基于 STM32F103 的智能消防巡检机器人，四路循迹 PID 走线与多级热警告。' },
];

/** 项目：hover 跟随图的列表（年份为估计值，待核对） */
export const projects = [
  { index: '01', name: 'HEXO BLOG',           year: '2026', stack: 'Hexo / Fluid',     status: '维护中',   image: '/media/proj-01.svg', href: 'https://github.com/zuige66/hexo' },
  { index: '02', name: 'ZUIGE66.GITHUB.IO',   year: '2026', stack: 'CSS / GitHub Pages', status: '已上线', image: '/media/proj-02.svg', href: 'https://github.com/zuige66/zuige66.github.io' },
  { index: '03', name: 'TOOTH GROUP NETWORK', year: '2026', stack: 'Python / PyTorch', status: '自用改版', image: '/media/proj-03.svg', href: 'https://github.com/zuige66/ToothGroupNetwork' },
  { index: '04', name: 'QT 3D VIEWER',        year: '2025', stack: 'C++ / OpenMesh',   status: '已完成',   image: '/media/proj-04.svg', href: 'https://github.com/zuige66/Qt3DViewer' },
];

/** 博客：文章同步自 blog.zuiges.com，点列表项直接跳转 */
export const posts = [
  { index: '001', title: 'Todo一句话待办软件',              date: '2026.10.22', tags: ['Android'],          read: '6 min',  image: '/media/banner-todo.png', href: 'https://blog.zuiges.com/2026/10/22/todo-app/',                          excerpt: '用一句话把事情记下来，日期、时间、提醒都由它自己解析——输入框就是唯一入口，全程离线。' },
  { index: '002', title: '她',                              date: '2026.10.20', tags: ['随笔', '青春'],     read: '5 min',  image: '/media/post-02.svg', href: 'https://blog.zuiges.com/2026/10/20/2026-10-20-she/',                    excerpt: '初三，她，借了一个画本给我。后来我们走到一起——缘分，真是奇妙。' },
  { index: '003', title: 'Hermes连接微信',                  date: '2026.10.20', tags: ['AI', '微信机器人'], read: '7 min',  image: '/media/post-03.svg', href: 'https://blog.zuiges.com/2026/10/20/Hermes%E8%BF%9E%E6%8E%A5%E5%BE%AE%E4%BF%A1/', excerpt: '通过腾讯 iLink Bot API 把 Hermes 挂到个人微信：扫一次二维码，发消息自动回复，还能定时推送天气和日程提醒。' },
  { index: '004', title: 'Hyper MeloLock 沉浸式音乐锁屏',   date: '2026.10.09', tags: ['Android', 'LSPosed'], read: '10 min', image: '/media/banner-melolock.png', href: 'https://blog.zuiges.com/2026/10/09/hyper-melolock-lockscreen-cover/',  excerpt: '为澎湃 OS 3 打造锁屏沉浸式音乐覆盖层：把专辑封面变成真正的壁纸，注入 SystemUI 的锁屏视图适配器。' },
  { index: '005', title: '红米Note9Pro刷澎湃OS3+Root',      date: '2026.10.07', tags: ['刷机', 'HyperOS'],  read: '9 min',  image: '/media/post-01.svg', href: 'https://blog.zuiges.com/2026/10/07/redmi-note9-pro-hyperos3-root/',     excerpt: '在 REDMI Note 9 Pro 上从 MIUI 14 线刷到澎湃 OS 3，并确认内核 Root 可以被 SukiSU Ultra 正常识别。' },
  { index: '006', title: '低价购买顶级域名',                date: '2026.10.04', tags: ['域名', '省钱教程'], read: '6 min',  image: '/media/post-02.svg', href: 'https://blog.zuiges.com/2026/10/04/domain-three-sites-server-github-pages/', excerpt: '首年价格只是账单的一部分，续费价、税费、注册资料验证叠在一起。记录用 Google Workspace 土耳其区约 12 元首年注册域名的完整流程。' },
  { index: '007', title: 'Docker的认识与使用',              date: '2026.10.03', tags: ['Docker', '运维'],   read: '8 min',  image: '/media/post-03.svg', href: 'https://blog.zuiges.com/2026/10/03/docker-project-introduction/',       excerpt: '第一次接触 Docker 时，最容易把它想成一台缩小版的虚拟机。这样理解不算完全错，但会错过 Docker 真正有用的地方。' },
  { index: '008', title: 'Tabby 和 MobaXterm 对比',         date: '2026.10.02', tags: ['SSH', '终端'],      read: '7 min',  image: '/media/post-04.svg', href: 'https://blog.zuiges.com/2026/10/02/tabby-vs-mobaxterm-ssh-key-docker/', excerpt: '两者都能通过 SSH 连接 Linux 服务器，也都能保存连接信息、使用密钥、传文件；但实际用下来，手感并不一样。' },
  { index: '009', title: '轻量服务器入门',                  date: '2026.09.23', tags: ['云服务器', 'Linux'], read: '8 min', image: '/media/post-01.svg', href: 'https://blog.zuiges.com/2026/09/23/aliyun-singapore-server-tabby/',     excerpt: '最近开了一台阿里云新加坡轻量应用服务器，系统是 Ubuntu 22.04。第一次连接海外服务器，先确认网络和 SSH 端口。' },
  { index: '010', title: 'Codex Windows 沙盒启动失败及解决办法', date: '2026.09.07', tags: ['Codex', 'Windows'], read: '5 min', image: '/media/post-02.svg', href: 'https://blog.zuiges.com/2026/09/07/codex-windows-sandbox-setup/',    excerpt: '用 Codex 改博客时，受限环境的操作突然失败或卡住：Windows 找不到 codex-windows-sandbox-setup.exe。排查与解决记录。' },
];

/** 图片档案：全部素材都在这里（span: tall=竖占两行 / wide=横占两列 / normal=标准格） */
export const photos = [
  { src: '/media/photo-corridor.jpg',  caption: '光廊 · 广州', span: 'tall' },
  { src: '/media/work-melolock.jpg',   caption: 'MeloLock · 锁屏实拍', span: 'tall' },
  { src: '/media/photo-stadium.jpg',   caption: 'GDUT · 操场夜景', span: 'wide' },
  { src: '/media/banner-melolock.png', caption: 'MeloLock · v0.3.6', span: 'wide' },
  { src: '/media/work-todo.jpg',       caption: 'Todo · 关于页', span: 'tall' },
  { src: '/media/banner-todo.png',     caption: 'Todo · v0.7.2', span: 'wide' },
  { src: '/media/photo-ink.jpg',       caption: '水墨 · 修士立绘', span: 'normal' },
  { src: '/media/photo-bridge.png',    caption: '云桥 · 博客主视觉', span: 'wide' },
];

/** 简历（技能百分比与入学信息为占位，待本人核对） */
export const resume = {
  summary:
    '广东工业大学在读。写安卓应用与系统模块，也写单片机固件——从 LSPosed 模块到 FreeRTOS 巡检机器人，喜欢把想法做成真的能跑起来的东西。',
  experience: [
    { period: '2026 — 至今', role: 'Hyper MeloLock · 作者',           org: '开源项目 / LSPosed',  note: '为澎湃 OS 3 打造锁屏沉浸式音乐覆盖层模块，持续迭代并发版，AGPL-3.0 开源。' },
    { period: '2026 — 至今', role: '巡检机器人 · 上位机与嵌入式',      org: 'BotHost + smartcar',  note: 'STM32 端固件与 Android 上位机：TCP 遥测、实时图表、报警分级与自动疏散。' },
    { period: '2026 — 至今', role: '独立工具开发 · Todo',             org: '开源项目 / Android',  note: '离线优先的自然语言待办 App：规则引擎解析日期时间，精确提醒与桌面小部件。' },
    { period: '20XX — 至今', role: '本科在读 · 专业待补',             org: '广东工业大学',        note: '入学年份与专业信息待补充。' },
  ],
  skills: [
    { name: 'Kotlin / Compose',  level: 85 },
    { name: 'Android 开发',       level: 85 },
    { name: 'C / STM32',         level: 75 },
    { name: 'LSPosed / Hook',    level: 70 },
    { name: 'Linux / Docker',    level: 65 },
  ],
  tools: ['Android Studio', 'STM32CubeMX', 'CLion', 'Docker', 'Git', 'Hexo', 'Linux', 'Tabby / MobaXterm'],
  education: '广东工业大学 · 本科（专业与年份待补）',
};

/** 页脚大字 */
export const footerWords = ['KEEP', 'IT', 'RUNNING'];
