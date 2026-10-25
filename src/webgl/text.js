import * as THREE from 'three';

/* ============================================================
   Canvas → Texture 文字工具
   导航标签、背景漫画字都用它生成贴图，
   这样文字才能进入 3D 深度缓冲，被人物的身体真实遮挡。
   ============================================================ */

const cache = new Map();

export const FONT_DISPLAY = 'Anton, "Archivo Black", Impact, sans-serif';
export const FONT_SANS = '"Space Grotesk", "Helvetica Neue", Arial, sans-serif';
export const FONT_JP = '"Yu Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif';

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.ceil(w));
  c.height = Math.max(2, Math.ceil(h));
  return c;
}

function toTexture(canvas, anisotropy = 4) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 单行文字贴图
 * @returns {{texture: THREE.Texture, aspect: number}}
 */
export function makeWordTexture({
  text,
  size = 160,
  family = FONT_DISPLAY,
  weight = 400,
  color = '#0a0a0a',
  stroke = 0,
  strokeColor = '#0a0a0a',
  fill = true,
  skew = 0,          // 倾斜（模拟 italic，Anton 没有斜体）
  tracking = 0,      // 字距（em）
  res = 2,           // 超采样倍数
  pad = 0.06,        // 内边距（相对字号）
}) {
  const key = JSON.stringify(arguments[0]);
  if (cache.has(key)) return cache.get(key);

  const fs = size * res;
  const measure = newCanvas(8, 8).getContext('2d');
  measure.font = `${weight} ${fs}px ${family}`;
  if ('letterSpacing' in measure) measure.letterSpacing = `${tracking * fs}px`;

  const m = measure.measureText(text);
  const tw = m.width;
  const ascent = m.actualBoundingBoxAscent || fs * 0.72;
  const descent = m.actualBoundingBoxDescent || fs * 0.18;

  const padX = fs * pad;
  const padY = fs * pad * 0.6;
  const cw = tw + padX * 2 + fs * Math.abs(skew) * 1.2 + (stroke ? stroke * res * 2 : 0);
  const ch = ascent + descent + padY * 2;

  const canvas = newCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${weight} ${fs}px ${family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking * fs}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.save();
  ctx.translate(padX + fs * Math.abs(skew) * 1.2, padY + ascent);
  if (skew) ctx.transform(1, 0, -skew, 1, 0, 0);

  if (fill) {
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
  }
  if (stroke) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = stroke * res;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
  }
  ctx.restore();

  const out = { texture: toTexture(canvas, 8), aspect: canvas.width / canvas.height, canvas };
  cache.set(key, out);
  return out;
}

/**
 * 导航标签贴图：编号 / 大词 / 日文 + 副标
 * invert = true 时变成黑底白字（hover 状态）
 */
export function makeNavTexture({ index, label, jp, sub, invert = false, res = 2 }) {
  const key = `nav:${index}:${label}:${invert}`;
  if (cache.has(key)) return cache.get(key);

  const fs = 150 * res;      // 主字
  const fsIdx = 30 * res;    // 编号
  const fsSub = 30 * res;    // 副标
  const fsJp = 40 * res;     // 日文

  const m = newCanvas(8, 8).getContext('2d');
  m.font = `400 ${fs}px ${FONT_DISPLAY}`;
  const wMain = m.measureText(label).width;

  m.font = `500 ${fsSub}px ${FONT_SANS}`;
  if ('letterSpacing' in m) m.letterSpacing = `${0.16 * fsSub}px`;
  const wSub = m.measureText(`${index}  ${sub}`).width;

  m.font = `500 ${fsJp}px ${FONT_JP}`;
  const wJp = m.measureText(jp).width;

  const padX = fs * 0.14;
  const padY = fs * 0.12;
  const gap1 = fs * 0.16;   // 主字 → 日文
  const gap2 = fs * 0.12;

  const cw = Math.max(wMain, wSub, wJp) + padX * 2;
  const ch = fsIdx + gap2 * 0.9 + fs * 0.95 + gap1 + fsJp + padY * 2;

  const canvas = newCanvas(cw, ch);
  const ctx = canvas.getContext('2d');

  if (invert) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const inkColor = invert ? '#f2f1ec' : '#0a0a0a';
  const subColor = invert ? 'rgba(242,241,236,0.55)' : 'rgba(10,10,10,0.45)';

  let y = padY + fsIdx * 0.9;

  // 白色描边（halo）：压在深色衣服上也读得清，白底上几乎看不见
  const halo = (txt, x, yPos, align, size) => {
    ctx.save();
    ctx.textAlign = align;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = invert ? '#0a0a0a' : 'rgba(242,241,236,0.95)';
    ctx.lineWidth = size * 0.075;
    ctx.strokeText(txt, x, yPos);
    ctx.strokeText(txt, x, yPos);
    ctx.restore();
  };

  // 编号 + 副标
  ctx.font = `500 ${fsSub}px ${FONT_SANS}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.16 * fsSub}px`;
  ctx.textBaseline = 'alphabetic';
  halo(index, padX, y, 'left', fsSub);
  halo(sub, canvas.width - padX, y, 'right', fsSub);
  ctx.fillStyle = subColor;
  ctx.fillText(index, padX, y);
  ctx.textAlign = 'right';
  ctx.fillText(sub, canvas.width - padX, y);
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // 主字（Anton 天生瘦高，横向略微压缩更漫画）
  y += gap2 + fs * 0.86;
  ctx.save();
  ctx.translate(padX, y);
  ctx.scale(1, 1);
  ctx.font = `400 ${fs}px ${FONT_DISPLAY}`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = invert ? '#0a0a0a' : 'rgba(242,241,236,0.95)';
  ctx.lineWidth = fs * 0.055;
  ctx.strokeText(label, 0, 0);
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle = inkColor;
  ctx.fillText(label, 0, 0);
  ctx.restore();

  // 日文
  y += gap1 + fsJp * 0.9;
  ctx.font = `500 ${fsJp}px ${FONT_JP}`;
  halo(jp, padX, y, 'left', fsJp);
  ctx.fillStyle = inkColor;
  ctx.fillText(jp, padX, y);

  const out = { texture: toTexture(canvas, 8), aspect: canvas.width / canvas.height, canvas };
  cache.set(key, out);
  return out;
}

export function disposeCache() {
  cache.forEach((v) => v.texture.dispose());
  cache.clear();
}
