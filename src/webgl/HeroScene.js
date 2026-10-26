import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyInkToObject } from './InkMaterial.js';

/**
 * 首页 WebGL 场景：人物 + 环绕导航 + 漫画散字
 */
export class HeroScene {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearAlpha(0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0.08, 4.55);

    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.updaters = [];

    // 取景框：低机位近景（模型归一化后 y ∈ [-1, 1]）
    // 编号跟着用户给的模型走：v1 = 第一张（全身），v2 空缺（第二张已丢），v3 = 第三张（腰以上、手前伸）
    this.presets = {
      v1: {
        top: 1.10, bottom: 0.10,
        camLift: -0.14, lookY: 0.50,
        camX: 0, targetX: 0, targetY: 0.50,
        fovWide: 30, fovTall: 42, zoom: 1,
      },
      v3: {
        top: 1.05, bottom: -0.62,
        camLift: -0.10, lookY: 0.20,
        camX: 0, targetX: 0.07, targetY: 0.20,
        fovWide: 30, fovTall: 42, zoom: 1,
      },
      // 竖屏（aspect < 0.9）：手机屏幕只有 390px 宽，v3 的投影宽度会到 2000px 以上，
      // 等于把人物裁掉八成。这里把取景框撑到 ±1.55，相机退到 z≈4，头发和手都能进画面。
      v3P: {
        top: 1.75, bottom: -1.75,
        camLift: -0.05, lookY: 0.10,
        camX: 0, targetX: 0.02, targetY: 0.10,
        fovWide: 30, fovTall: 42, zoom: 1,
      },
    };
    this.applyPreset(this.presets.v3, false);

    this._setupLights();
    this._setupEnvironment();
    this._bind();

    this.resize();
  }

  _setupLights() {
    const { scene } = this;

    const amb = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(amb);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.9);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.6, 3.2, 4.2);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.9);
    fill.position.set(-4, 1.2, 2.4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 2.0);
    rim.position.set(-1.5, -1.0, -4.0);
    scene.add(rim);

    this.lights = { amb, hemi, key, fill, rim };
  }

  _setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.envMap = pmrem.fromScene(env, 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
  }

  _bind() {
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._onPointer = (e) => {
      this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', this._onPointer, { passive: true });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);

    const p = this.preset;
    this.camera.aspect = w / h;
    // 竖屏时把 fov 拉大一点，避免人物左右被切太狠
    this.camera.fov = w / h < 0.85 ? p.fovTall : p.fovWide;

    // 按取景框反推相机距离，保证「头顶留白 + 画面底边切在腰以下」
    const span = p.top - p.bottom;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    // 竖屏用 vTight 对应拉远；横屏用 zoom
    this.camera.position.z = (span / (2 * halfTan)) * (w / h < 0.85 ? p.zoom : 1);
    this.camera.position.x = p.camX;
    this.camera.position.y = (p.top + p.bottom) / 2 + p.camLift;
    this.camera.lookAt(p.targetX, p.targetY, 0);
    this.camera.updateProjectionMatrix();

    this.frame = { top: p.top, bottom: p.bottom };
    this.baseZ = this.camera.position.z;
    this.viewportH = span;

    // 构图里有相机水平偏移时，画面中心会平移；记下来给导航算可见宽度
    this.frameCenterX = p.targetX;
  }

  /** 切换构图预设（v1 全身站姿 / v3 腰以上手部前景） */
  applyPreset(preset, doResize = true) {
    this.preset = { ...preset };
    if (doResize) this.resize();
  }

  /** 载入人物 */
  async loadCharacter(url, onProgress, inkOpts = {}) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url, (evt) => {
      if (evt.lengthComputable && onProgress) onProgress(evt.loaded / evt.total);
    });

    const root = gltf.scene;

    // 统一尺寸、居中
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const holder = new THREE.Group();
    holder.add(root);
    root.position.sub(center);

    const TARGET_H = 2.0;
    holder.scale.setScalar(TARGET_H / size.y);
    holder.updateWorldMatrix(true, true);

    // 材质：换成墨线着色器
    // 这个模型的细线全烙在 normalMap 里，MeshStandardMaterial 的软光照会把它抹平；
    // InkMaterial 用掠射光重新打浮雕 + 硬分层，才能出 2D 手绘的感觉。
    root.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      if (src.map) {
        src.map.colorSpace = THREE.SRGBColorSpace;
        src.map.anisotropy = this.maxAniso;
      }
      if (src.normalMap) src.normalMap.anisotropy = this.maxAniso;
      o.frustumCulled = false;
    });

    // 脸部区域（世界空间，模型已归一化到高度 2.0、中心在原点）
    // v1 的五官已经用 tools/bake-face.mjs 烘焙进 baseColor 贴图；
    // 这里只是告诉着色器"这块是脸"：关掉几何提线和曲率压暗，
    // 否则眼窝/鼻翼会被压成一团黑，把烘焙好的五官糊掉。
    // v3（Tripo 导出，腰以上）没有烘焙，按几何自动找头部正面那一块。
    const autoFace = this._detectFaceBox(holder, root);
    const faceCenter = inkOpts.faceCenter || autoFace?.center || new THREE.Vector3(0.043, 0.884, 0.11);
    const faceSize = inkOpts.faceSize || autoFace?.size || new THREE.Vector2(0.226, 0.26);

    this.ink = applyInkToObject(root, {
      paper: '#f2f1ec',
      ink: '#0a0a0a',
      useMap: true,
      useNormal: true,
      normalScale: 1.0,
      levelLo: 0.10,
      levelHi: 0.65,
      rakeLo: 0.30,
      rakeHi: 0.72,
      rakeGain: 0.95,
      formAmount: 0.28,
      cavGain: 0.50,
      lineThr: 0.10,
      mapLineGain: 0,
      halftone: 0,
      dotSize: 2.4,
      pixelRatio: this.dpr || 1,
      // 不再用平面投影贴花（会随视角滑动），五官在贴图里
      faceTex: null,
      faceMask: true,
      faceCenter,
      faceSize,
      faceGain: 1,
      ...inkOpts,
    });

    this.character = holder;
    this.characterBaseY = 0;
    this.scene.add(holder);
    return holder;
  }

  /**
   * 从几何里找"脸"：取最高那一段、法线朝前的顶点，求包围盒。
   * 只在没有烘焙贴图的新模型上用；v1 用既有常量，避免取景漂移。
   */
  _detectFaceBox(holder, root) {
    const tmp = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const nm = new THREE.Matrix3();

    let maxY = -Infinity;
    let minY = Infinity;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i += 3) {
        tmp.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
        if (tmp.y > maxY) maxY = tmp.y;
        if (tmp.y < minY) minY = tmp.y;
      }
    });
    if (!Number.isFinite(maxY)) return null;

    // 头部大约占身高 1/8，加上头发给到 22%
    const sliceBottom = maxY - (maxY - minY) * 0.22;
    const headBox = new THREE.Box3();
    const pts = [];

    root.traverse((o) => {
      if (!o.isMesh) return;
      nm.getNormalMatrix(o.matrixWorld);
      const pa = o.geometry.attributes.position;
      const na = o.geometry.attributes.normal;
      for (let i = 0; i < pa.count; i += 2) {
        tmp.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
        if (tmp.y < sliceBottom) continue;
        nrm.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
        if (nrm.z < 0.5) continue;
        headBox.expandByPoint(tmp);
        pts.push(tmp.x, tmp.y, tmp.z);
      }
    });

    if (!pts.length) return null;
    const c = headBox.getCenter(new THREE.Vector3());
    const s = headBox.getSize(new THREE.Vector3());
    return {
      center: new THREE.Vector3(c.x, c.y - s.y * 0.08, c.z + 0.02),
      size: new THREE.Vector2(s.x * 1.05, s.y * 1.1),
    };
  }

  /** 人物左右偏转（弧度），调用方负责夹在 ±45° 内 */
  setYaw(yaw) {
    this.yaw = yaw;
  }

  addUpdater(fn) {
    this.updaters.push(fn);
  }

  /** 滚出首页后停掉渲染，省电也省滚动性能 */
  setActive(v) {
    this.active = v;
  }

  start() {
    this.active = true;
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;

      if (this.active) {
        // 指针缓动
        // 用时间步长而不是固定系数：低帧率时也能在同样时间里追到指针
        this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 6));

        for (let i = 0; i < this.updaters.length; i++) this.updaters[i](t, dt, this.pointerSmooth);

        this.renderer.render(this.scene, this.camera);
      }
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    cancelAnimationFrame(this._raf);
  }
}
