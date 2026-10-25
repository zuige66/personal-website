import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyInkToObject } from './webgl/InkMaterial.js';
import { paintFaceCanvas } from './webgl/facePaint.js';

/**
 * 把脸谱烘焙进 baseColor 贴图
 * ------------------------------------------------------------
 * 这个模型的 UV 是「逐三角形打散」的：整张图上几千个碎片，没有一块"脸"。
 * 所以不能像正常模型那样往某个矩形区域涂 —— 只能反过来做：
 *
 *   对每个三角形，在 UV 空间光栅化 → 每个像素用重心坐标插值出世界坐标
 *   → 投影到脸谱平面 → 采样脸谱 → 写回贴图
 *
 * 这样五官就"长"在贴图里了，和正常手绘的模型没有区别：
 * 不随视角滑动，也不会像贴纸。
 */

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.get(k) == null ? d : Number(params.get(k)));

// 脸谱投影框（和 HeroScene 保持一致，按 debug 的 face 视图校准出来的）
const FACE_CENTER = new THREE.Vector3(
  num('fcx', 0.043), num('fcy', 0.884), num('fcz', 0.11)
);
const FACE_SIZE = new THREE.Vector2(num('fsx', 0.226), num('fsy', 0.26));

const view = params.get('view') || 'face';
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f1ec);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 100);
scene.add(new THREE.AmbientLight(0xffffff, 1.0));

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const gltf = await loader.loadAsync(params.get('src') || '/character.min.glb');
const root = gltf.scene;

root.updateWorldMatrix(true, true);
const box = new THREE.Box3().setFromObject(root);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());

const holder = new THREE.Group();
holder.add(root);
root.position.sub(center);
holder.scale.setScalar(2.0 / size.y);
scene.add(holder);
holder.updateWorldMatrix(true, true);

// ---- 找到唯一的 mesh 与它的贴图 ----
let mesh = null;
root.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
if (!mesh) throw new Error('no mesh');

const srcMat = mesh.material;
const baseMap = srcMat.map;
const normalMap = srcMat.normalMap;
baseMap.colorSpace = THREE.SRGBColorSpace;
if (normalMap) normalMap.anisotropy = 4;

// 贴图尺寸
const img = baseMap.image;
const TW = img.width;
const TH = img.height;

// 原贴图 → ImageData
const texCanvas = document.createElement('canvas');
texCanvas.width = TW;
texCanvas.height = TH;
const texCtx = texCanvas.getContext('2d', { willReadFrequently: true });
texCtx.drawImage(img, 0, 0, TW, TH);
const texData = texCtx.getImageData(0, 0, TW, TH);

// ---- 脸谱 → ImageData ----
const PLATE = num('plate', 1024);
const plateCanvas = paintFaceCanvas(PLATE, { grid: params.get('grid') === '1' });
const plateCtx = plateCanvas.getContext('2d', { willReadFrequently: true });
const plateData = plateCtx.getImageData(0, 0, PLATE, PLATE);

// ---- 光栅化 ----
const geo = mesh.geometry;
const pos = geo.attributes.position;
const uvA = geo.attributes.uv;
const index = geo.index;
const mw = mesh.matrixWorld;

const wp = new Float32Array(pos.count * 3);
const v = new THREE.Vector3();
for (let i = 0; i < pos.count; i++) {
  v.fromBufferAttribute(pos, i).applyMatrix4(mw);
  wp[i * 3] = v.x;
  wp[i * 3 + 1] = v.y;
  wp[i * 3 + 2] = v.z;
}

const idx = index ? index.array : null;
const triCount = idx ? idx.length / 3 : pos.count / 3;
const get = (i) => (idx ? idx[i] : i);

const skinLo = num('skl', 0.14);   // 皮肤判定（sRGB 归一化亮度）
const skinHi = num('skh', 0.34);
const gain = num('gain', 1);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)));
  return t * t * (3 - 2 * t);
};

let painted = 0;
let covered = 0;

for (let t = 0; t < triCount; t++) {
  const i0 = get(t * 3), i1 = get(t * 3 + 1), i2 = get(t * 3 + 2);

  // UV → 像素（glTF 的 UV 原点在图片左上角）
  const u0 = uvA.getX(i0) * TW, w0 = uvA.getY(i0) * TH;
  const u1 = uvA.getX(i1) * TW, w1 = uvA.getY(i1) * TH;
  const u2 = uvA.getX(i2) * TW, w2 = uvA.getY(i2) * TH;

  const minX = Math.max(0, Math.floor(Math.min(u0, u1, u2)));
  const maxX = Math.min(TW - 1, Math.ceil(Math.max(u0, u1, u2)));
  const minY = Math.max(0, Math.floor(Math.min(w0, w1, w2)));
  const maxY = Math.min(TH - 1, Math.ceil(Math.max(w0, w1, w2)));
  if (maxX < minX || maxY < minY) continue;

  const d = (u1 - u0) * (w2 - w0) - (u2 - u0) * (w1 - w0);
  if (Math.abs(d) < 1e-9) continue;
  const invD = 1 / d;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      // 重心坐标
      const b1 = ((cx - u0) * (w2 - w0) - (u2 - u0) * (cy - w0)) * invD;
      const b2 = ((u1 - u0) * (cy - w0) - (cx - u0) * (w1 - w0)) * invD;
      const b0 = 1 - b1 - b2;
      if (b0 < -1e-4 || b1 < -1e-4 || b2 < -1e-4) continue;

      // 插值世界坐标
      const wx = b0 * wp[i0 * 3] + b1 * wp[i1 * 3] + b2 * wp[i2 * 3];
      const wy = b0 * wp[i0 * 3 + 1] + b1 * wp[i1 * 3 + 1] + b2 * wp[i2 * 3 + 1];

      // 投影到脸谱
      const fx = (wx - FACE_CENTER.x) / FACE_SIZE.x + 0.5;
      const fy = 0.5 - (wy - FACE_CENTER.y) / FACE_SIZE.y; // canvas y 朝下
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue;

      const sx = Math.min(PLATE - 1, Math.max(0, (fx * PLATE) | 0));
      const sy = Math.min(PLATE - 1, Math.max(0, (fy * PLATE) | 0));
      const pi = (sy * PLATE + sx) * 4;
      const pa = plateData.data[pi + 3] / 255;
      if (pa < 0.004) continue;

      const ti = (py * TW + px) * 4;
      const lum = (texData.data[ti] * 0.299 + texData.data[ti + 1] * 0.587 + texData.data[ti + 2] * 0.114) / 255;
      const skin = smoothstep(skinLo, skinHi, lum);

      const a = pa * skin * gain;
      if (a < 0.004) continue;

      covered++;
      // 脸谱是灰度的，直接混进原色
      const pr = plateData.data[pi], pg = plateData.data[pi + 1], pb = plateData.data[pi + 2];
      texData.data[ti] = texData.data[ti] * (1 - a) + pr * a;
      texData.data[ti + 1] = texData.data[ti + 1] * (1 - a) + pg * a;
      texData.data[ti + 2] = texData.data[ti + 2] * (1 - a) + pb * a;
      painted++;
    }
  }
}

texCtx.putImageData(texData, 0, 0);

// ---- 用烘焙后的贴图渲染预览 ----
const bakedTex = new THREE.CanvasTexture(texCanvas);
bakedTex.colorSpace = THREE.SRGBColorSpace;
bakedTex.flipY = baseMap.flipY;
bakedTex.anisotropy = 4;

mesh.material = new THREE.MeshStandardMaterial({ map: bakedTex, normalMap });

if (params.get('raw') === '1') {
  mesh.material = new THREE.MeshBasicMaterial({ map: bakedTex });
} else {
applyInkToObject(root, {
  paper: '#f2f1ec',
  ink: '#0a0a0a',
  useMap: true,
  useNormal: true,
  levelLo: 0.10,
  levelHi: num('hi', 0.65),
  rakeGain: 0.95,
  formAmount: 0.28,
  cavGain: num('cav', 0.50),
  lineThr: 0.10,
  mapLineGain: 0,
  halftone: 0,
  pixelRatio: 1,
  faceMask: true,
  faceTex: null,
  faceCenter: FACE_CENTER,
  faceSize: FACE_SIZE,
});
}

const dirs = {
  front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], iso: [0.8, 0.5, 1],
};
if (view === 'face' || view === 'face3q' || view === 'faceL') {
  const tgt = new THREE.Vector3(0, 0.74, 0.22);
  const off = view === 'face' ? new THREE.Vector3(0.02, 0.02, 0.62)
    : view === 'faceL' ? new THREE.Vector3(-0.30, 0.02, 0.56)
      : new THREE.Vector3(0.34, 0.05, 0.52);
  camera.fov = 32;
  camera.updateProjectionMatrix();
  camera.position.copy(tgt).add(off);
  camera.lookAt(tgt);
} else {
  const d2 = dirs[view] || dirs.front;
  const R = 3.4;
  camera.position.set(d2[0] * R, d2[1] * R, d2[2] * R);
  camera.lookAt(0, 0, 0);
}

renderer.render(scene, camera);

hud.textContent =
  `tex ${TW}x${TH}\nbaked ${painted} texels (${covered} covered)\nview ${view}`;

// 导出给 Node
window.__baked = texCanvas.toDataURL('image/png');
window.__bakedWebp = texCanvas.toDataURL('image/webp', 0.94);
window.__bakedWebp92 = texCanvas.toDataURL('image/webp', 0.90);
document.body.dataset.ready = '1';
