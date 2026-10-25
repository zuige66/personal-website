import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

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

    // 取景框：只拍到裙摆，腿和脚留在画面外（模型归一化后 y ∈ [-1, 1]）
    // bottom 卡在裙摆下沿（约 -0.52），让衣摆正好压在页面底边上
    this.frame = { top: 1.11, bottom: -0.545 };

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
    this.camera.position.y = (this.frame.top + this.frame.bottom) / 2;
    this.camera.lookAt(0, this.camera.position.y, 0);
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

    // 材质：原贴图是黑白墨笔触，压低金属度让它像纸上的墨
    root.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      const map = src.map || null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.anisotropy = this.maxAniso;
      }
      o.material = new THREE.MeshStandardMaterial({
        map,
        normalMap: src.normalMap || null,
        metalness: 0.0,
        roughness: 0.92,
        envMapIntensity: 0.4,
        side: THREE.FrontSide,
      });
      if (o.material.normalMap) o.material.normalMap.anisotropy = this.maxAniso;
      o.frustumCulled = false;
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
