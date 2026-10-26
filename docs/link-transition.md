# 外链转场幕布

> 对应文件：`src/main.js`（`buildVeil()`）、`src/style.css`（`.veil*` / `.veil-label` / `.veil-meta`）、`index.html`
> 验收脚本：`tools/veil-frames.mjs`（逐帧采样）、`tools/veil-check.mjs`（新窗口与返回态）

点击「项目 / 博客」列表里的外链时，一块墨色面板自下而上盖满屏幕，**盖满之后**中央才压出 `GITHUB ↗` 或 `BLOG →` 大字，约一拍之后幕布上收、新窗口打开。

---

## 1. 行为约定

| 场景 | 行为 |
|---|---|
| 左键点击列表项 | 播转场（黑屏 → 白字 → 上收）→ `window.open(href, '_blank')` 开新窗口，当前页不离开 |
| ⌘ / Ctrl / Shift / Alt / 中键 | 不插动画，交给浏览器默认的新标签行为 |
| `prefers-reduced-motion: reduce` | 跳过动画，直接开新窗口 |
| 弹窗被拦截 | `window.open` 返回 `null`，退回 `location.href` 当前页跳转 |
| 从新标签页切回 | 幕布复位、跟随图收起 |

触发范围是三个选择器：

```js
'#blogList a, #projList a, #aboutRows a[target="_blank"]'
```

前两处是博客与项目列表，第三处是 ABOUT 区的 GITHUB / BLOG 两行。三处都带 `target="_blank" rel="noopener noreferrer"`，保证中键、右键「在新标签页打开」也走新窗口。

ABOUT 区的 EMAIL（`mailto:`）和 LOCATION（锚点）没有 `target`，天然被选择器排除，不会误触发幕布。

文案不再靠 `closest('#blogList')` 判断（ABOUT 区不在那个列表里），改成解析 host：

```js
let host = '';
try { host = new URL(href, location.origin).hostname; } catch { /* 非法 href 按 GitHub 处理 */ }
const toBlog = host.startsWith('blog.');
```

目录遮罩（`#indexSocials`）里的 GitHub / Blog 没接进来：那里点完要同时收遮罩，两套动画叠在一起会打架。

---

## 2. 标签为什么必须放在 `.veil` 外面

反色靠 `mix-blend-mode: difference`：元素 `color: #fff`，与底下的东西逐通道相减——黑底(0) → 白，浅底(0.95) → 接近黑，于是**永远和底色相反**，不需要维护深浅两套颜色。

但混合只发生在同一个层叠上下文里。`.veil` 有 `position: fixed` + `z-index: 190`，自成层叠上下文，标签放在里面就只能和黑色面板混色，永远是白的——浅色页面上直接消失。所以 DOM 结构是：

```html
<div class="veil" id="veil"><div class="veil__panel"></div></div>
<span class="veil-label" id="veilLabel"></span>   <!-- 幕布的兄弟节点，不是子节点 -->
<span class="veil-meta" id="veilMeta"></span>
```

标签自身 `z-index: 191` 挂在 `body` 下，backdrop 就是整页内容 + 面板，`difference` 才生效。

---

## 3. 百分比位移不能写两遍（这是白字看不清的真正原因）

旧版 `.veil__panel` 同时有：

```css
transform: translateY(102%);   /* CSS 里写死 */
```

```js
gsap.set(panel, { yPercent: 102 });   // JS 又叠一次
```

GSAP 解析 CSS transform 得到 `918px`，再叠加 `yPercent: 102`（= 918px），实际位移 1836px——面板永远停在视口下方，**黑幕根本没盖上来**，屏上只有一块白字飘在浅色页面上。`label` 的 `translate(-50%, -50%)` 与 `xPercent/yPercent` 同样叠加，导致居中也偏。

现在 CSS 不写任何 `transform`，位置全部交给 GSAP：

```js
const layout = () => {
  gsap.set(panel, { yPercent: 102 });                  // 视口下方待命
  gsap.set([label, meta], { xPercent: -50, opacity: 0, y: 0 });
  gsap.set(label, { yPercent: -50 });                  // 垂直居中
};
layout();                                              // 初始化 + 每次 reset 都跑
```

判定「面板有没有真的盖满」不要看代码，看 `getComputedStyle(panel).transform` 的 `m42`：屏高 900 时，待命态应该是 `918`，盖满时是 `0`。

---

## 4. 返回主页面后图标残留

两个来源，逐条处理：

| 来源 | 原因 | 处理 |
|---|---|---|
| `veil.is-on` 残留 | bfcache 把离开前的 DOM 原样还回来，类名还在 | `pageshow`（`e.persisted`）+ `popstate` 时 `reset()` |
| `busy` 锁死 | 闭包变量没复位，回来后点链接毫无反应 | `reset()` 里置 `false` |

（早期还有第三个来源：列表 hover 的跟随缩略图 `#projFloat` / `#blogFloat` 只靠 `pointerleave` 收起，
跳转时指针没离开就跳走了。该功能已整体移除，这条也随之消失。）

`reset()` 同时 `tl.kill()` 并重跑 `layout()`，所以动画进行到一半被打断也不会留下半个黑色面板。切回标签页走的是 `visibilitychange`（`visible` 时复位）——新窗口打开会让本页进后台，`rAF` 暂停、动画冻在半路，靠这一步兜底。

---

## 5. 先黑屏、再白字（不要抢时间）

`difference` 的好处是文字压在任何底色上都看得见，副作用是**它也不会消失**——所以一旦让标签提前淡入，就会拍到「半个字压在浅色页面、半个字压在墨幕上」的中间态，看上去很乱。

这里采用严格串行：面板 `yPercent` 走到 `0` 之后，才开始动标签的透明度。

```js
.fromTo(panel, { yPercent: 102 }, { yPercent: 0, duration: 0.46, ease: 'power4.inOut' })
.fromTo(label, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' }, '+=0.05')
```

判定标准很简单：**任何一帧里 `label` 的 `opacity > 0` 时，`panel` 的 `m42` 必须已经是 `0`**。`tools/veil-frames.mjs` 的采样表可以直接对照。

同理，转场期间要收起自定义光标：

```css
body.is-veil .cursor,
body.is-veil .cursor-dot { opacity: 0; }
```

光标 hover 态是直径 62px 的**实心白圆**，又被 `difference` 反成白色，压在墨幕的大字上像一块破洞。`is-veil` 类跟着 `is-on` 一起加、跟着 `reset()` 一起摘。

---

## 6. 验收

```bash
npm run dev
URL=http://127.0.0.1:5173/ node tools/veil-frames.mjs   # 逐帧打印 opacity / panel 位移
URL=http://127.0.0.1:5173/ LINK='#blogList a' node tools/veil-frames.mjs
URL=http://127.0.0.1:5173/ node tools/veil-check.mjs    # 真实点击、新窗口、返回态
```

验线上同一套脚本就能跑，换成 `URL=https://zuiges.com/`。脚本的 `newContext` 开了 `ignoreHTTPSErrors`，否则本地环境下的 Playwright 会以 `ERR_CERT_COMMON_NAME_INVALID` 拒绝加载（同一域名 curl 校验却是通的，属于本地网络/代理的干扰，站点本身证书没问题）。

`veil-frames.mjs` 会把 `window.open` 打桩（否则新窗口一开，页面进后台、动画冻结，抓到的帧全是错位的）。正常时间线：

```
 0–130ms   panel 918 → 待命，标签 opacity 0
~250ms     panel 613，仍在上升
~340ms     panel 60
~440ms     panel 0（盖满），标签仍 opacity 0
~640ms     标签 opacity 0.76（此刻面板已全黑）
~740ms     标签全亮
~1340ms    标签开始淡出
~1760ms    面板上收至 -918
~1860ms    reset，回到 918
```

---

## 附：列表 hover 的图片预览已移除

早先「项目 / 博客」列表在 hover 时，会有一块约 `20vw` 的缩略图跟着鼠标飘，用来看项目截图。实际观感不好——图跟着光标满屏乱飞，反而盖住了正在读的文字，所以整体去掉了。

移除范围：

| 位置 | 内容 |
|---|---|
| `index.html` | `#projFloat` / `#blogFloat` 两个 `div` |
| `src/style.css` | `.proj-float` / `.blog-float` 样式块，以及移动端媒体查询里的 `display: none` |
| `src/main.js` | `buildHoverFloats()` 及其调用；列表模板里的 `data-img`；`buildVeil()` 里只为浮图存在的 `floats` / `dropFloats()` |

`content.js` 里 `projects` / `posts` 的 `image` 字段保留，仅作素材索引，当前没有渲染方。

hover 反馈不受影响：列表项本身有整行黑底反白 + 左右内缩位移（`.proj-list a:hover::before`），信息足够。`public/media/proj-0*.svg` 这几个缩略图现在已无引用。
