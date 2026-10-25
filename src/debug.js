import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyInkToObject } from './webgl/InkMaterial.js';
import { createFaceTexture, paintFaceCanvas } from './webgl/facePaint.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'front';
const fit = params.get('fit') !== '0';
const src = params.get('src') || '/character.min.glb';
const useInk = params.get('ink') === '1';

if (params.get('fp') === '1') {
  const c = paintFaceCanvas(900, { grid: params.get('grid') === '1' });
  document.body.innerHTML = '';
  document.body.style.background = '#888';
  c.style.display = 'block';
  document.body.appendChild(c);
  document.body.dataset.ready = '1';
} else {
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf2f1ec);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 100);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));
const d = new THREE.DirectionalLight(0xffffff, 2.4);
d.position.set(2, 3, 4);
scene.add(d);
const d2 = new THREE.DirectionalLight(0xffffff, 1.2);
d2.position.set(-3, 1, -2);
scene.add(d2);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.load(src, (gltf) => {
  const root = gltf.scene;
  scene.add(root);

  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const holder = new THREE.Group();
  scene.remove(root);
  holder.add(root);
  root.position.sub(center);
  holder.scale.setScalar(2.0 / size.y);
  scene.add(holder);

  root.traverse((o) => {
    if (o.isMesh) {
      const m = o.material;
      o.material = new THREE.MeshStandardMaterial({
        map: m.map, normalMap: m.normalMap, metalness: 0, roughness: 0.9,
      });
    }
  });

  if (params.get('tex') === '1') {
    root.traverse((o) => {
      if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ map: o.material.map });
    });
  }

  if (params.get('uv') === '1') {
    // ---- UV 分区图：把几何摊到 UV 空间，用颜色标出高度/朝向 ----
    scene.clear();
    scene.background = new THREE.Color(0x101010);

    const geos = [];
    root.traverse((o) => { if (o.isMesh) geos.push(o); });

    geos.forEach((o) => {
      const g = o.geometry.clone();
      const uvA = g.attributes.uv;
      const posA = g.attributes.position;
      const nrmA = g.attributes.normal;
      const idx = g.index;

      // 每个顶点的世界位置与法线
      const wp = new THREE.Vector3();
      const wn = new THREE.Vector3();
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);

      const pos = new Float32Array(uvA.count * 3);
      const col = new Float32Array(uvA.count * 3);

      const box2 = new THREE.Box3().setFromObject(root);
      const y0 = box2.min.y, y1 = box2.max.y;

      for (let i = 0; i < uvA.count; i++) {
        pos[i * 3] = uvA.getX(i) - 0.5;
        pos[i * 3 + 1] = uvA.getY(i) - 0.5;
        pos[i * 3 + 2] = 0;

        wp.fromBufferAttribute(posA, i).applyMatrix4(o.matrixWorld);
        wn.fromBufferAttribute(nrmA, i).applyMatrix3(nm).normalize();

        const h = (wp.y - y0) / Math.max(1e-6, y1 - y0);
        const front = Math.max(0, wn.z);
        col[i * 3] = h;
        col[i * 3 + 1] = front;
        col[i * 3 + 2] = 0.15;
      }

      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      if (!idx) g.setIndex(null);

      scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        vertexColors: true, side: THREE.DoubleSide,
      })));
    });

    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10, 10);
    cam.position.set(0, 0, 1);
    renderer.render(scene, cam);

    document.getElementById('hud').textContent = 'UV map  R=height  G=front-facing';
    document.body.dataset.ready = '1';
    return;
  }

  if (useInk) {
    const p = new URLSearchParams(location.search);
    const num = (k, d) => (p.get(k) == null ? d : Number(p.get(k)));

    // ---- 脸谱投影框：只取「头顶附近 + 正面朝前」的顶点 ----
    holder.updateWorldMatrix(true, true);
    const hb = new THREE.Box3();
    const tmp = new THREE.Vector3();
    const tn = new THREE.Vector3();
    let maxY = -1e9;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        tmp.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
        if (tmp.y > maxY) maxY = tmp.y;
      }
    });
    const sliceBot = maxY - num('hh', 0.30);
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pa = o.geometry.attributes.position;
      const na = o.geometry.attributes.normal;
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pa.count; i++) {
        tmp.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
        if (tmp.y < sliceBot || tmp.y > maxY) continue;
        tn.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        if (tn.z < num('nz', 0.55)) continue;
        hb.expandByPoint(tmp);
      }
    });

    const hc = hb.getCenter(new THREE.Vector3());
    const hs = hb.getSize(new THREE.Vector3());
    const faceCenter = new THREE.Vector3(
      num('fcx', hc.x), num('fcy', hc.y), num('fcz', hc.z)
    );
    const faceSize = new THREE.Vector2(
      num('fsx', hs.x * num('fsm', 1.0)),
      num('fsy', hs.y * num('fsm', 1.0))
    );

    console.log('[head]', JSON.stringify({ top: maxY, center: hc.toArray().map(n=>+n.toFixed(3)), size: hs.toArray().map(n=>+n.toFixed(3)) }));

    applyInkToObject(holder, {
      faceTex: createFaceTexture(1024, { grid: p.get('grid') === '1' }),
      skinLo: num('skl', 0.45),
      skinHi: num('skh', 0.78),
      dbg: num('dbg', 0),
      faceCenter,
      faceSize,
      useMap: p.get('map') !== '0',
      useNormal: p.get('nrm') !== '0',
      normalScale: num('ns', 1),
      rakeLo: num('rl', 0.30),
      rakeHi: num('rh', 0.72),
      rakeGain: num('rg', 0.95),
      levelLo: num('lo', 0.18),
      levelHi: num('hi', 0.72),
      mapLineGain: num('ml', 0),
      lineThr: num('line', 0.10),
      cavGain: num('cav', 0.75),
      dotSize: num('dot', 3.2),
      halftone: num('ht', 1),
      toneBias: num('bias', 0),
      thickness: Number(p.get('thick') ?? 0.006),
    });
    scene.background = new THREE.Color(0xf2f1ec);
  }

  scene.add(new THREE.Box3Helper(box, 0xff0000));
  scene.add(new THREE.AxesHelper(1.2));

  const R = fit ? 3.4 : 5.4;
  const dirs = {
    front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
    top: [0, 1, 0.001], iso: [0.8, 0.5, 1],
  };
  if (view === 'face' || view === 'face3q') {
    const tgt = new THREE.Vector3(0, 0.74, 0.22);
    const off = view === 'face' ? new THREE.Vector3(0.02, 0.02, 0.62) : new THREE.Vector3(0.34, 0.05, 0.52);
    camera.fov = 32;
    camera.updateProjectionMatrix();
    camera.position.copy(tgt).add(off);
    camera.lookAt(tgt);
  } else {
    const v = dirs[view] || dirs.front;
    camera.position.set(v[0] * R, v[1] * R, v[2] * R);
    camera.lookAt(0, 0, 0);
  }

  document.getElementById('hud').textContent =
    `view=${view}\nbbox min ${box.min.toArray().map((n) => n.toFixed(2))}\nbbox max ${box.max.toArray().map((n) => n.toFixed(2))}\nsize ${size.toArray().map((n) => n.toFixed(2))}\ncenter ${center.toArray().map((n) => n.toFixed(2))}\nmeshes ${(() => { let c = 0; root.traverse((o) => o.isMesh && c++); return c; })()}`;

  document.body.dataset.ready = '1';
  renderer.render(scene, camera);
});
}
