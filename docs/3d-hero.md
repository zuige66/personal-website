# 首页 3D 人物与环绕导航

> 对应文件：`src/webgl/HeroScene.js`、`src/webgl/InkMaterial.js`、`src/webgl/OrbitNav.js`、`src/webgl/HeroWords.js`、`src/main.js`
> 资源文件：`public/character.min.glb`（v1）、`public/character-v3.min.glb`（v3，默认）
> 原始模型与中间产物：`_archive/models/`（不进 git）

---

## 1. 两套模型，URL 切换

编号跟着「用户给的第几张模型」走，所以没有 v2——第二张（后背有东西）拿到手之前先空着。

| 版本 | 文件 | 来源 | 特征 |
|---|---|---|---|
| v1 | `public/character.min.glb` | 第一张，全身站姿（`_archive/models/character-1025-full.glb`），源文件自带 baseColor + normal + metallicRoughness | 3.03 MB，377,351 三角面，**全身 1.89 m** |
| v3（默认） | `public/character-v3.min.glb` | 第三张，`_archive/models/anime+character+3d+model.glb`，腰以上、右手直伸向镜头 | 3.74 MB，501,930 三角面，**半身 0.95 m** |

```
http://127.0.0.1:5173/              # 默认 v3
http://127.0.0.1:5173/?model=v1     # 换成全身那张
```

`public/` 下只留这两份。文件名带 `.min` 表示已经过 resize/webp/meshopt 压缩，
原始导出和中间产物一律放 `_archive/models/`，被 `.gitignore` 忽略，不会进仓库也不会进构建。

`main.js` 里 `MODEL / MODEL_SRC / MODEL_INK / preset / 导航参数` 全部按版本分支，旧模型的表现不受新参数影响。

### 1.1 三个模型分别是谁（容易混，记这里）

| 顺序 | 画面内容 | 本地文件 | 现在干什么用 |
|---|---|---|---|
| 第一个 | 全身站姿，右手前伸，露鞋和裤脚 | `character-1025-full.glb`（19.9 MB，451,462 面）→ `character-clean.glb`（网格清理，436,831 面）→ `character-base.glb`（减面 377,351） | 压成 **v1** `public/character.min.glb` |
| 第二个 | 后背有东西 | **本机已找不到**（`Downloads` / `Desktop` 都没有），估计下载同名被第三个覆盖 | 空着，等拿到再补 `v2` |
| 第三个 | 腰以上，右手直伸向镜头，黑衣长发 | `anime+character+3d+model.glb`（18.79 MB，md5 `bd532146feb4…`），`model-new.glb` 与它逐字节相同 | 压成 **v3**，默认在用 |

以上六个原始文件都在 `_archive/models/`，压缩中间产物在 `_archive/models/pipeline/`。

判断依据不是文件名，而是**网格指纹**：v3 的网格名 `tripo_mesh_256e1a95-…`、501,930 面、293,493 顶点与第三张完全一致；
v1 的 377,351 面、222,141 顶点与 `character-base.glb` 完全一致，后者来自 `character-1025-full.glb`（451,462 面 / 261,501 顶点）。

想确认某份文件是哪张，跑这个就够：

```bash
md5sum _archive/models/anime+character+3d+model.glb _archive/models/model-new.glb   # 都是 bd532146feb4…
npx gltf-transform inspect public/character-v3.min.glb | grep TRIANGLES
```

### v3 资产处理（从 17.9 MiB 压到 3.74 MB）

原始文件 `_archive/models/anime+character+3d+model.glb`（Tripo 导出，18.79 MB，不进 git）按顺序处理：

```bash
npx gltf-transform resize 源.glb _archive/models/pipeline/v3-1-resize.glb --width 2048 --height 2048
npx gltf-transform webp   _archive/models/pipeline/v3-1-resize.glb _archive/models/pipeline/v3-2-webp.glb --quality 92
npx gltf-transform weld   _archive/models/pipeline/v3-2-webp.glb _archive/models/pipeline/v3-3-weld.glb
npx gltf-transform meshopt _archive/models/pipeline/v3-3-weld.glb public/character-v3.min.glb --level high
```

没有做减面：`simplify` 会啃掉手指与五官的细节，这个模型的价值恰恰在那只手上。

---

## 2. 墨线着色器：新增「无 normalMap」分支

v1 的手绘细线全部烙在 normalMap 里，所以旧着色器有「用掠射光把法线图打成硬边阴影」这一步。
v3 只有一张 4096 的 baseColor（现在压到 2048 webp），**没有法线图**，黑外套直接塌成一块死黑。

为此在 `InkMaterial.js` 增加四个 uniform：

| uniform | 作用 |
|---|---|
| `uBlackLift` | 纯黑区域的提亮总强度（0 = 关闭，v1 就是 0） |
| `uFoldLo` / `uFoldHi` | 几何法线朝光的阈值；两值之间算「褶皱朝光面」 |
| `uEdgeLift` | 轮廓/衣缘的 Fresnel 提亮 |

原理：黑色的 `tone = 0`，乘法救不回来，所以用 `max()` 往上抬：

```glsl
float lift = (fold * 0.30 + crest * 0.42 + edge * uEdgeLift) * uBlackLift;
tone = max(tone, lift * darkMask);
```

`crest` 是贴着褶脊的一窄条高光，模拟干笔扫白。

同时修了两个旧 bug：

- **脸区判定**从 `abs(Ng.z)` 改成 `ndv`（视线夹角）。原来用世界 z，人物一转头，脸区遮罩就跟着漂走。
- **网点下限**从 `smoothstep(0.06, 0.26)` 抬到 `smoothstep(0.18, 0.40)`，纯黑外套不再长出一层灰麻点。

v3 的墨线参数（`main.js` 的 `MODEL_INK`）：`levelLo 0.32 / levelHi 0.62 / blackLift 0.55 / edgeLift 0.72 / halftone 0.40`。

---

## 3. 构图预设（`HeroScene.presets`）

相机距离由取景框反推：`z = (top - bottom) / (2 * tan(fov/2))`，所以调 `top/bottom` 就是调镜头远近。

| 字段 | v1 | v3 | 说明 |
|---|---|---|---|
| `top` / `bottom` | 1.10 / 0.10 | 1.05 / -0.62 | 模型归一化后身高 2.0（y ∈ [-1, 1]） |
| `targetX` / `targetY` | 0 / 0.50 | 0.07 / 0.20 | 视线落点，决定画面中心 |
| `camX` / `camLift` | 0 / -0.14 | 0 / -0.10 | 相机水平偏移、相对取景中心下移（仰视） |
| `fovWide` / `fovTall` | 30 / 42 | 30 / 42 | 竖屏换大 fov |
| `zoom` | 1 | 1.14（仅竖屏生效） | 竖屏拉远，避免伸出的手被右边缘切掉 |

v3 的构图来自参考图：**脸在上三分之一、前伸的手占右下前景**。手的顶点在归一化空间是 `x 0.48~0.98, y -0.30~0.27, z 0.80~1.06`，离相机极近，透视会把它放大到约 1.6 倍——这就是参考图那种「手怼脸」的压迫感来源。

---

## 4. 环绕导航（`OrbitNav`）

### 4.1 为什么收在扇区里

人物只左右各转 **30°**（`MAX_YAW`），如果导航绕整圈，大半时间标签在脑后或飞出画面。
所有标签落在同一条**倾斜椭圆轨道**上，轨道摆角夹在 `±0.50 rad`（约 29°）：

- 标签方位角：`-arc ~ +arc`（v3 `arc = 0.90`，v1 `1.18`）
- 轨道摆角：`-pointer.x * 0.52 - yaw * 0.12 + 滚动进度 + 慢呼吸`，夹在 ±0.50

### 4.2 摆角方向是反的

鼠标往右 → 轨道往左转。理由很实际：往右滑是为了把右边的 `ABOUT` 转进来点得到；
如果轨道跟着指针同向跑，最外侧那两项永远贴着屏幕边缘，鼠标也够不着。

### 4.3 轨道形状：两个倾角

```js
_pointAt(a, r) => {
  x: sin(a) * r,
  y: baseY + tiltK * sin(a) * r - tiltX * cos(a) * r,
  z: cos(a) * r,
}
```

- `tiltK`（绕 Z 轴）：左右出现高低差
- `tiltX`（绕 X 轴）：**近端压低、远端抬高**。没有这一项时，环几乎贴着视平线，
  投影后就是两条平行虚线段，看不出「从身后穿过去」

标签与轨道线用**同一个函数**取点，所以标签始终骑在线上。

### 4.4 轨道线是闭环

整圈 192 段虚线，不是正面一段弧——弧的两端会凭空断掉，一看就是「贴在地上的弧」。
闭环之后后半圈被人物挡住，再从两侧绕回来，这才是环绕的完整读法。
背面段用顶点色往纸色插值压淡（`shade(a) = 0.34 + 0.66 * (0.5 + 0.5cos a)`），省一个 shader。

`depthTest: true`，所以从身后经过的部分会被身体真实遮挡。

### 4.5 标签等距分布

方位角不是按角度均匀分的，而是按**投影后的横向位置**均匀分：

```js
const sMax = Math.sin(arc);
const az = Math.asin(-sMax + 2 * sMax * t);
```

按角度均匀时 `sin()` 在两端变平，最外两项会叠成 `WORKPROJECTS`。

### 4.6 横向压缩

```js
const reach = ringR * Math.sin(arc);
const labelHalfW = baseSize * 1.1;
xScale = min(xScale, (halfW * 0.80 - labelHalfW) / reach);
```

保证最外侧标签的外沿不会顶出画面。

### 4.7 各版本参数（`main.js`）

| 参数 | v1 | v3 |
|---|---|---|
| `baseSize` | 0.075 | 0.15 |
| `arc` | 1.18 | 0.90 |
| `ringR` | 0.86 | 1.42 |
| `baseY` | 0.52 | 0.46 |
| `tiltK` | 0.06 | 0.13 |
| `tiltX` | 0.14 | 0.18 |

v1 相机极近（z ≈ 1.87），轨道半径必须收到 0.86，否则标签会贴到镜头前被放大 2~3 倍。

### 4.8 竖屏

`aspect < 0.9` 时 `navFade` 归零，整个环绕收起，用 HUD 的 `INDEX` 目录做导航。
窄屏放六个标签必然全叠在脸上，这是刻意取舍。

---

## 5. 交互

| 行为 | 实现 |
|---|---|
| 人物左右转 | 指针 x → `yaw`，夹在 ±30°，阻尼 `1 - exp(-dt * 7)`（帧率无关） |
| 指针平滑 | `pointerSmooth.lerp(target, 1 - exp(-dt * 6))`，旧代码是固定 0.06，低帧率下追不到 |
| 悬停标签 | `raycast` → 反色贴图交叉淡入 + 放大 1.12 + 压暗背景散字 |
| 点击标签 | 命中项 `data.id` → `lenis.scrollTo` 对应区块 |
| 滚动 | 镜头推进到 0.84 倍、轨道翻转、导航与散字淡出；到 100% 时 `setActive(false)` 停渲染 |

### 5.1 02 区块为什么不做"淡影贯穿"（已回滚）

试过一版：`.statement` 背景改 `transparent`、首屏淡出留 8%~12% 残余、相机继续推远，
让整人物从宣言区背后穿过去。**已回滚**，原因是要么看不见、要么挡字：

- 窗口高度 ≥ 900 时，宣言区滚到视口中间，人物已经只剩 0.1 上下的淡影，纸色文字压得住，效果成立。
- 窗口矮一点（`.statement` 只有 300 多像素、hero 高度超过视口）时，宣言区在 hero
  还没退完（`p ≈ 0.7~0.9`，不透明度还有 0.3~0.75）就已经滑进画面，整条黑衣服直接压住标题。
- 想两头兼顾就得跟着视口高度动态改曲线，收益不值这个复杂度。

结论：`.statement` 保持 `background: var(--paper)`，hero 的 `onUpdate` 用
`1 - max(0, (p - 0.7) / 0.3)` 在首屏末尾收干净，`onLeave` 直接 `setActive(false)`。
真要重做，关键不是透明度，而是**先让 hero 的 pin 高度等于视口高度**，别让两个区块在屏幕上抢位置。

---

## 6. 已知问题 / 待办

- **面数偏大**：50 万三角面单次 draw call，桌面独显无压力，集显/移动端未实测。若卡顿，优先做 `simplify --ratio 0.6`（注意保护手部）。
- **v1 的标签偏小**：v1 是全身像，相机被拉到 z ≈ 1.87（v3 是 3.12），同样的世界尺寸会贴到脸上，
  `baseSize` 只能压到 0.075，视觉上比 v3 小一圈；v1 只作对比用，不追求效果。
- **`public/model-new.glb`**（18 MB）是历史上传的原始模型副本，代码已不引用，可以从仓库删掉省体积。
- v3 无骨骼、无动画，呼吸与转动都是整体变换，幅度需克制，否则手会穿出画面。
