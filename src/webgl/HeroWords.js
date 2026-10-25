import * as THREE from 'three';
import { makeWordTexture, FONT_DISPLAY, FONT_JP, FONT_SANS } from './text.js';

/**
 * 首页背景散落的漫画字层
 * z > 0 会压在人物前面，z < 0 会被人物遮挡 —— 参考图里那种前后穿插
 */
export class HeroWords {
  constructor(scene, camera, words, viewportH) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.viewportH = viewportH;
    this.items = [];
    this.visible = 1;

    const geo = new THREE.PlaneGeometry(1, 1);

    words.forEach((w, i) => {
      const fam = w.jp ? FONT_JP : w.style === 'sans' ? FONT_SANS : FONT_DISPLAY;
      const { texture, aspect } = makeWordTexture({
        text: w.text,
        size: 170,
        family: fam,
        weight: w.jp ? 700 : 400,
        color: '#0a0a0a',
        fill: w.style !== 'outline',
        stroke: w.style === 'outline' ? 3.2 : 0,
        skew: w.italic ? 0.16 : 0,
        tracking: w.jp ? 0.02 : 0.01,
        res: w.size > 0.3 ? 3 : 2,
      });

      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: w.style === 'ghost' ? 0.45 : 1,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = w.z > 0 ? 3 : 1;
      this.group.add(mesh);

      this.items.push({
        cfg: w,
        mesh,
        mat,
        aspect,
        baseOpacity: w.style === 'ghost' ? 0.45 : 1,
        phase: i * 1.7,
      });
    });

    this.layout();
  }

  layout() {
    const wH = this.viewportH;
    const wW = wH * this.camera.aspect;
    // 竖屏时如果按高度缩放，字会大得离谱；这里取一个"视觉单位"
    const unit = Math.min(wH, wW * 1.15);
    const k = this.scaleK ?? 1;
    this.items.forEach((it) => {
      const { cfg, mesh } = it;
      const h = cfg.size * unit * k;
      mesh.scale.set(h * it.aspect, h, 1);
      // x / y 用「半幅、半高」的比例，±1 = 贴边
      it.basePos = new THREE.Vector3((cfg.x * wW) / 2, (cfg.y * wH) / 2, cfg.z);
      mesh.position.copy(it.basePos);
      mesh.rotation.z = THREE.MathUtils.degToRad(cfg.rot);
    });
  }

  /** 整体缩放散字（人物占画面更多时用来避免糊住脸） */
  setScale(k) {
    this.scaleK = k;
    this.layout();
  }

  setViewportH(h) {
    this.viewportH = h;
    this.layout();
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v > 0.01;
  }

  /** 鼠标指向导航时压暗装饰字，让导航更好读 */
  setDim(v) {
    this.dim = v;
  }

  update(t, pointer) {
    const dim = this.dim ?? 1;
    for (const it of this.items) {
      const p = pointer || { x: 0, y: 0 };
      const d = it.cfg.z;
      it.mesh.position.x = it.basePos.x - p.x * d * 0.055;
      it.mesh.position.y = it.basePos.y + Math.sin(t * 0.5 + it.phase) * 0.006 - p.y * d * 0.03;
      it.mat.opacity = it.baseOpacity * this.visible * dim;
    }
    this.group.visible = this.visible > 0.01;
  }
}
