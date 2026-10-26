# 首页 3D 人物与环绕导航

> 对应文件：`src/webgl/HeroScene.js`、`src/webgl/InkMaterial.js`、`src/webgl/OrbitNav.js`、`src/webgl/HeroWords.js`、`src/main.js`
> 资源文件：`public/character.min.glb`（v1）、`public/character-v2.min.glb`（v2）

---

## 1. 两套模型，URL 切换

| 版本 | 文件 | 来源 | 特征 |
|---|---|---|---|
| v1 | `public/character.min.glb` | 早期半身像，五官烘焙进 baseColor，细线烙在 normalMap | 3.0 MB，正面半身 |
| v2（默认） | `public/character-v2.min.glb` | Tripo AI 生成，全身站姿、右手前伸 | 3.74 MB，501,930 三角面 |

```
http://127.0.0.1:5173/?model=v1     # 回到旧半身像
http://127.0.0.1:5173/?model=v2     # 默认
```

`main.js` 里 `MODEL / MODEL_SRC / MODEL_INK / preset / 导航参数` 全部按版本分支，旧模型的表现不受新参数影响。

### v2 资产处理（从 17.9 MB 压到 3.74 MB）

原始文件 `anime+character+3d+model.glb`（Tripo 导出，18.8 MB，未进 git）按顺序处理：

```bash
npx gltf-transform resize 源.glb .qa/v2-1-resize.glb --width 2048 --height 2048
npx gltf-transform webp   .qa/v2-1-resize.glb .qa/v2-2-webp.glb --quality 92
npx gltf-transform weld   .qa/v2-2-webp.glb .qa/v2-3-weld.glb
npx gltf-transform meshopt .qa/v2-3-weld.glb public/character-v2.min.glb --level high
```

没有做减面：`simplify` 会啃掉手指与五官的细节，这个模型的价值恰恰在那只手上。

---

## 2. 墨线着色器：新增「无 normalMap」分支

v1 的手绘细线全部烙在 normalMap 里，所以旧着色器有「用掠射光把法线图打成硬边阴影」这一步。
v2 只有一张 4096 的 baseColor（现在压到 2048 webp），**没有法线图**，黑外套直接塌成一块死黑。

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

v2 的墨线参数（`main.js` 的 `MODEL_INK`）：`levelLo 0.32 / levelHi 0.62 / blackLift 0.55 / edgeLift 0.72 / halftone 0.40`。

---

## 3. 构图预设（`HeroScene.presets`）

相机距离由取景框反推：`z = (top - bottom) / (2 * tan(fov/2))`，所以调 `top/bottom` 就是调镜头远近。

| 字段 | v1 | v2 | 说明 |
|---|---|---|---|
| `top` / `bottom` | 1.10 / 0.10 | 1.05 / -0.62 | 模型归一化后身高 2.0（y ∈ [-1, 1]） |
| `targetX` / `targetY` | 0 / 0.50 | 0.07 / 0.20 | 视线落点，决定画面中心 |
| `camX` / `camLift` | 0 / -0.14 | 0 / -0.10 | 相机水平偏移、相对取景中心下移（仰视） |
| `fovWide` / `fovTall` | 30 / 42 | 30 / 42 | 竖屏换大 fov |
| `zoom` | 1 | 1.14（仅竖屏生效） | 竖屏拉远，避免伸出的手被右边缘切掉 |

v2 的构图来自参考图：**脸在上三分之一、前伸的手占右下前景**。手的顶点在归一化空间是 `x 0.48~0.98, y -0.30~0.27, z 0.80~1.06`，离相机极近，透视会把它放大到约 1.6 倍——这就是参考图那种「手怼脸」的压迫感来源。

---

## 4. 环绕导航（`OrbitNav`）

### 4.1 为什么收在扇区里

人物只左右各转 **30°**（`MAX_YAW`），如果导航绕整圈，大半时间标签在脑后或飞出画面。
所有标签落在同一条**倾斜椭圆轨道**上，轨道摆角夹在 `±0.50 rad`（约 29°）：

- 标签方位角：`-arc ~ +arc`（v2 `arc = 0.90`，v1 `1.18`）
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

| 参数 | v1 | v2 |
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
| 滚动 | 镜头推进到 0.84 倍、轨道翻转、导航与散字淡出 |
| 滚进 02 区块 | 首屏不收到 0，留 `ghostAlpha()` 的淡影继续推远，宣言区滚完之后才归零并 `setActive(false)` 停渲染 |

### 5.1 02 区块的"淡影贯穿"

`ghostAlpha()` 给两档：竖屏（`aspect < 0.9`）0.08，横屏 0.12。竖屏人物几乎占满画面，
同样的不透明度会压住正文，所以压得更淡。

`.statement` 的背景色改成 `transparent`，否则纸色底板会把 canvas 整块盖掉，人物根本穿不过来。
剩下的只是让淡影活过整个宣言区：

```
p < 0.65  →  1 - p * 0.3        （只轻微减弱，保持连续感）
否则      →  0.805 * (1 - (p - 0.65) / 0.35)   （最后 35% 收干净）
```

两段在 `p = 0.65` 处取值都是 0.805，接得上，不会跳。
同时 `camera.position.z` 从 0.84 倍继续推到 1.39 倍，跟首屏末端的推进方向一致。
宣言区一离开就 `opacity = 0` + `setActive(false)`，不再白烧 GPU。

---

## 6. 已知问题 / 待办

- **面数偏大**：50 万三角面单次 draw call，桌面独显无压力，集显/移动端未实测。若卡顿，优先做 `simplify --ratio 0.6`（注意保护手部）。
- **v1 的标签偏小**：旧半身像取景太紧，标签只能压到 0.075，v2 是默认，v1 只作对比用。
- **`public/model-new.glb`**（18 MB）是历史上传的原始模型副本，代码已不引用，可以从仓库删掉省体积。
- v2 无骨骼、无动画，呼吸与转动都是整体变换，幅度需克制，否则手会穿出画面。
