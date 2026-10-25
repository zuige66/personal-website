import * as THREE from 'three';

/**
 * 脸谱
 * ------------------------------------------------------------
 * 模型的 baseColor 贴图是「逐三角形打散烘焙」的（几千个碎片，没有一块是脸），
 * 所以五官在烘焙时就被平均掉了 —— 贴图上根本找不到可以下笔的地方。
 *
 * 这里改成「平面投影贴花」：用 Canvas2D 画一张正视图的脸谱，
 * 在着色器里按世界坐标把这张图投影到头部几何上。
 * 好处是不依赖 UV，脸谱会自然贴合曲面，头发挡住的地方也照样被遮挡。
 *
 * 画的时候 y 轴朝下（canvas 习惯），着色器里会翻转。
 */

export const FACE_DEFAULTS = {
  // 五官在脸谱上的相对位置（0..1，相对整张图）
  eyeY: 0.545,
  eyeDx: 0.180,     // 眼心到中线的距离
  eyeW: 0.112,      // 单眼宽度
  eyeH: 0.036,      // 单眼高度
  browY: 0.470,
  browW: 0.148,
  browLift: 0.020,  // 眉毛拱起
  noseY: 0.690,
  mouthY: 0.778,
  mouthW: 0.075,
  tilt: -0.05,      // 整体倾斜（弧度，正=向右倒）
  lineW: 0.0088,    // 主线条粗细（相对图宽）
  irisR: 0.0148,
  pupil: 0.66,
  detail: false,    // 高分辨率才开（下眼睑/高光/双眼皮），烘焙时关掉
};

function eyePath(ctx, S, cx, cy, w, h, dir, o) {
  // dir = +1 外侧在右，-1 外侧在左
  const x0 = cx - (w / 2) * dir; // 内眼角
  const x1 = cx + (w / 2) * dir; // 外眼角
  const up = cy - h * 0.95;
  const dn = cy + h * 0.75;

  ctx.beginPath();
  // 上眼睑：从内眼角拱到外眼角
  ctx.moveTo(x0, cy + h * 0.10);
  ctx.bezierCurveTo(
    cx - w * 0.30 * dir, up,
    cx + w * 0.24 * dir, up - h * 0.06,
    x1, cy - h * 0.18
  );
  // 下眼睑
  ctx.bezierCurveTo(
    cx + w * 0.20 * dir, dn,
    cx - w * 0.24 * dir, dn + h * 0.05,
    x0, cy + h * 0.10
  );
  ctx.closePath();
}

function drawEye(ctx, S, cx, cy, o, dir) {
  const w = S * o.eyeW;
  const h = S * o.eyeH;

  // 眼白：整块实心白。脸的贴图密度很低（一只眼只有二三十个像素），
  // 只有"实心白 + 实心黑瞳 + 粗上睑"这三样能活下来，细线全部会糊掉。
  eyePath(ctx, S, cx, cy, w, h, dir, o);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fill();

  // 虹膜：留出上下白边，不然整只眼就是一团黑
  const ir = S * o.irisR;
  const ix = cx + w * 0.03 * dir;
  const iy = cy - h * 0.06;
  ctx.save();
  eyePath(ctx, S, cx, cy, w, h, dir, o);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(ix, iy, ir, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,10,10,1)';
  ctx.fill();
  // 瞳孔更实一点
  ctx.beginPath();
  ctx.arc(ix, iy, ir * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fill();
  ctx.restore();

  // 上眼睑：最粗的那根线
  const x0 = cx - (w / 2) * dir;
  const x1 = cx + (w / 2) * dir;
  ctx.beginPath();
  ctx.moveTo(x0, cy + h * 0.10);
  ctx.bezierCurveTo(
    cx - w * 0.30 * dir, cy - h * 0.95,
    cx + w * 0.24 * dir, cy - h * 1.01,
    x1, cy - h * 0.18
  );
  ctx.strokeStyle = 'rgba(6,6,6,1)';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = S * o.lineW * 2.6;
  ctx.stroke();

  // 外眼角小勾
  ctx.beginPath();
  ctx.moveTo(x1, cy - h * 0.18);
  ctx.lineTo(x1 + w * 0.09 * dir, cy - h * 0.62);
  ctx.lineWidth = S * o.lineW * 1.6;
  ctx.stroke();

  if (o.detail) {
    // 下眼睑：细线，只画外侧一半
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.30 * dir, cy + h * 0.52);
    ctx.quadraticCurveTo(cx + w * 0.12 * dir, cy + h * 0.80, cx - w * 0.10 * dir, cy + h * 0.66);
    ctx.lineWidth = S * o.lineW * 0.55;
    ctx.stroke();

    // 高光
    ctx.beginPath();
    ctx.ellipse(ix - ir * 0.34, iy - ir * 0.36, ir * 0.26, ir * 0.20, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  }
}

function drawBrow(ctx, S, cx, cy, o, dir) {
  const w = S * o.browW;
  const x0 = cx - (w / 2) * dir;  // 眉尾（外）
  const x1 = cx + (w / 2) * dir;  // 眉头（内）

  ctx.beginPath();
  ctx.moveTo(x0, cy + S * o.browLift * 0.35);
  ctx.quadraticCurveTo(cx + w * 0.06 * dir, cy - S * o.browLift, x1, cy + S * o.browLift * 0.15);
  ctx.strokeStyle = 'rgba(8,8,8,0.92)';
  ctx.lineCap = 'round';
  ctx.lineWidth = S * o.lineW * 0.78;
  ctx.stroke();
}

/**
 * 画一张脸谱
 * @returns {HTMLCanvasElement}
 */
export function paintFaceCanvas(size = 1024, opts = {}) {
  const o = { ...FACE_DEFAULTS, ...opts };
  const S = size;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  ctx.save();
  // 整体绕脸中心旋转，对齐模型头部微微上仰的姿态
  ctx.translate(S / 2, S * (o.eyeY + o.mouthY) / 2);
  ctx.rotate(o.tilt);
  ctx.translate(-S / 2, -S * (o.eyeY + o.mouthY) / 2);

  const cx = S * 0.5;
  const dx = S * o.eyeDx;

  // 眉
  drawBrow(ctx, S, cx - dx, S * o.browY, o, -1);
  drawBrow(ctx, S, cx + dx, S * o.browY, o, 1);

  // 眼
  drawEye(ctx, S, cx - dx, S * o.eyeY, o, -1);
  drawEye(ctx, S, cx + dx, S * o.eyeY, o, 1);

  // 鼻：一小段阴影，不画鼻梁
  ctx.beginPath();
  ctx.moveTo(cx + S * 0.008, S * (o.noseY - 0.045));
  ctx.quadraticCurveTo(cx + S * 0.030, S * (o.noseY - 0.006), cx - S * 0.004, S * o.noseY);
  ctx.strokeStyle = 'rgba(8,8,8,0.55)';
  ctx.lineCap = 'round';
  ctx.lineWidth = S * o.lineW * 0.55;
  ctx.stroke();

  // 鼻底小点
  ctx.beginPath();
  ctx.ellipse(cx - S * 0.006, S * (o.noseY + 0.006), S * 0.010, S * 0.006, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,8,8,0.35)';
  ctx.fill();

  // 唇
  const mw = S * o.mouthW;
  const my = S * o.mouthY;
  ctx.beginPath();
  ctx.moveTo(cx - mw / 2, my);
  ctx.quadraticCurveTo(cx - mw * 0.16, my - S * 0.011, cx + S * 0.004, my - S * 0.008);
  ctx.quadraticCurveTo(cx + mw * 0.20, my - S * 0.006, cx + mw / 2, my + S * 0.004);
  ctx.strokeStyle = 'rgba(8,8,8,0.85)';
  ctx.lineWidth = S * o.lineW * 0.62;
  ctx.stroke();

  // 下唇淡影
  ctx.beginPath();
  ctx.moveTo(cx - mw * 0.34, my + S * 0.016);
  ctx.quadraticCurveTo(cx, my + S * 0.030, cx + mw * 0.34, my + S * 0.012);
  ctx.strokeStyle = 'rgba(8,8,8,0.30)';
  ctx.lineWidth = S * o.lineW * 0.40;
  ctx.stroke();

  ctx.restore();

  if (o.grid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(220,0,0,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.strokeStyle = 'rgba(0,120,255,0.45)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const t = (S * i) / 10;
      ctx.beginPath(); ctx.moveTo(t, 0); ctx.lineTo(t, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, t); ctx.lineTo(S, t); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,0,180,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();
    ctx.restore();
  }

  return c;
}

/** 生成可直接塞进着色器的贴图 */
export function createFaceTexture(size = 1024, opts = {}) {
  const canvas = paintFaceCanvas(size, opts);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
