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
    // 参考图的构图是「手怼到镜头前 + 脸在上三分之一」，所以：
    //   - top/bottom 收紧，镜头才能压近
    //   - 相机比视线低一截 → 仰视，前伸的手自然落到下前景
    this.frame = { top: 1.10, bottom: 0.10 };
    this.camLift = -0.14;   // 相机相对取景中心下移
    this.lookY = 0.50;      // 视线高度（> 相机高度 = 仰视）

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

    this.camera.aspect = w / h;
    // 竖屏时把 fov 拉大一点，避免人物左右被切太狠
    this.camera.fov = w / h < 0.85 ? 42 : 30;

    // 按取景框反推相机距离，保证「头顶留白 + 裙摆在画面底边」
    const span = this.frame.top - this.frame.bottom;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camera.position.z = span / (2 * halfTan);
    this.camera.position.y = (this.frame.top + this.frame.bottom) / 2 + this.camLift;
    this.camera.lookAt(0, this.lookY, 0);
    this.camera.updateProjectionMatrix();

    this.baseZ = this.camera.position.z;
    this.viewportH = span;
  }

  /** 载入人物 */
  async loadCharacter(url, onProgress) {
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
    // 五官已经用 tools/bake-face.mjs 烘焙进 baseColor 贴图了，
    // 这里只是告诉着色器"这块是脸"：关掉几何提线和曲率压暗，
    // 否则眼窝/鼻翼会被压成一团黑，把烘焙好的五官糊掉。
    const faceCenter = new THREE.Vector3(0.043, 0.884, 0.11);
    const faceSize = new THREE.Vector2(0.226, 0.26);

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
    });

    this.character = holder;
    this.characterBaseY = 0;
    this.scene.add(holder);
    return holder;
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
        this.pointerSmooth.lerp(this.pointer, 0.06);

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
