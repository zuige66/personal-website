import * as THREE from 'three';
import { makeNavTexture } from './text.js';

/**
 * 环绕在人物前方的导航
 * ------------------------------------------------------------
 * 和上一版的差别：
 *   - 不再绕整圈。人物只左右各转 <45°，环绕也收在正面扇区里，
 *     否则项会转到脑后 / 飞出画面，读都读不到。
 *   - 所有项严格落在同一条（略微倾斜的）椭圆轨道上，轨道本身画成虚线。
 *     之前六个标签各自飘在不同高度，看起来像掉在地上的纸片，不像环绕。
 *   - 轨道的倾角让左右两端出现高低差，加上透视的近大远小，
 *     才有一圈东西绕着人转的错觉。
 */
export class OrbitNav {
  /** 轨道摆角上限：既要跟得住手，又不能把最外侧的项甩出扇区 */
  static SWAY_LIMIT = 0.50;

  constructor(
    scene,
    camera,
    navData,
    {
      onSelect,
      onHover,
      arc = 1.05,
      baseSize = 0.272,
      ringR = 1.42,
      baseY = 0.26,
      tiltK = 0.08,
      tiltX = 0.24,
    } = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.data = navData;
    this.onSelect = onSelect;
    this.onHover = onHover;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.geo = new THREE.PlaneGeometry(1, 1);
    this.items = [];
    this.hovered = null;
    this.arc = arc;          // 扇区半张角（弧度）
    this.yaw = 0;            // 人物偏转，由外部喂进来
    this.sway = 0;           // 轨道整体摆角（夹在 SWAY_LIMIT 内）
    this.scrollRot = 0;
    this.visible = 1;

    // 轨道形状：
    //   tiltK —— 绕 Z 轴倾斜，左右有高低差
    //   tiltX —— 绕 X 轴倾斜，近端压低、远端抬高，椭圆才张得开。
    //            没有这一项时环几乎是贴着视平线的两条平行虚线，
    //            看不出"从身后穿过去"。
    this.baseY = baseY;
    this.tiltK = tiltK;
    this.tiltX = tiltX;
    this.ringR = ringR;
    // 竖屏菱形排布的三个可调项：横向半径 / 纵向半径 / 标签高度（都是视口半宽、半高的比例）
    this.portraitFrame = { rx: 0.80, ry: 0.86, size: 0.064 };

    const n = navData.length;

    // 标签的方位角按【投影后的横向位置】均匀分配，而不是按角度均匀。
    // 按角度均匀时 sin() 在两端变平，最外两项会挤在一起（WORKS/PROJECTS 叠字）。
    const sMax = Math.sin(arc);

    navData.forEach((d, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const az = Math.asin(-sMax + 2 * sMax * t);
      // 半径微错开：越靠中间越靠前，纵深更明显
      const radius = this.ringR + ((i * 7) % 3) * 0.045;

      const normal = makeNavTexture({ index: d.index, label: d.label, jp: d.jp, sub: d.en, invert: false });
      const hover = makeNavTexture({ index: d.index, label: d.label, jp: d.jp, sub: d.en, invert: true });

      const matN = new THREE.MeshBasicMaterial({
        map: normal.texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1,
      });
      const matH = new THREE.MeshBasicMaterial({
        map: hover.texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1,
      });

      const mesh = new THREE.Mesh(this.geo, matN);
      const h = baseSize;
      mesh.scale.set(h * normal.aspect, h, 1);
      mesh.renderOrder = 2;
      mesh.userData.itemIndex = i;
      this.group.add(mesh);

      // 反色层叠在同一位置，靠透明度交叉淡入，避免换材质时闪
      const hoverMesh = new THREE.Mesh(this.geo, matH);
      hoverMesh.scale.set(1, 1, 1);
      hoverMesh.renderOrder = 3;
      hoverMesh.material.opacity = 0;
      mesh.add(hoverMesh);

      this.items.push({
        data: d,
        mesh,
        matN,
        matH,
        az,
        radius,
        baseH: h,
        aspect: normal.aspect,
        scale: 1,
        targetScale: 1,
        roll: (i % 2 === 0 ? -1 : 1) * (0.025 + (i % 3) * 0.012),
        hoverMix: 0,
        phase: i * 0.9,
      });
    });

    this.guides = this._buildGuides();
    this.group.add(this.guides);

    this._raycaster = new THREE.Raycaster();
    this._q = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
  }

  /** 轨道上某角度的位置（与 update 里完全同一套公式，保证线穿住标签） */
  _pointAt(a, radius) {
    const sx = Math.sin(a);
    const cz = Math.cos(a);
    return {
      x: sx * radius,
      y: this.baseY + this.tiltK * sx * radius - this.tiltX * cz * radius,
      z: cz * radius,
    };
  }

  /**
   * 轨道线：两条虚线（上沿 / 下沿），画成【整圈闭环】。
   * 之前只画正面一段弧，两端凭空断掉，看起来是"贴在画面上的弧"；
   * 闭合成圈之后，后半圈会从人物身后穿过去（depthTest 挡住），
   * 再从左/右两侧绕回来 —— 这才是"环绕"的完整读法。
   * 背面段用顶点色往纸色插值压淡，省一个 shader，也不至于抢人物。
   */
  _buildGuides() {
    const ROWS = [0.075, -0.075]; // 相对轨道中线的上下沿
    const R = this.ringR;
    const N = 192;                 // 能被 3 整除，虚线接缝对齐
    const pos = [];
    const col = [];
    const ink = new THREE.Color('#0a0a0a');
    const paper = new THREE.Color('#f2f1ec');

    const at = (a, dy) => {
      const p = this._pointAt(a, R);
      return new THREE.Vector3(p.x, p.y + dy, p.z);
    };

    // 正前 = 1，正后 = 0，背面留 0.28 的底，避免整段消失
    const shade = (a) => 0.34 + 0.66 * (0.5 + 0.5 * Math.cos(a));

    for (const dy of ROWS) {
      for (let i = 0; i < N; i++) {
        if (i % 3 === 2) continue; // 2 实 1 虚
        const aA = (i / N) * Math.PI * 2 - Math.PI;
        const aB = ((i + 1) / N) * Math.PI * 2 - Math.PI;
        const pa = at(aA, dy);
        const pb = at(aB, dy);
        pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        const ca = paper.clone().lerp(ink, shade(aA));
        const cb = paper.clone().lerp(ink, shade(aB));
        col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

    const m = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: true,
    });
    const lines = new THREE.LineSegments(g, m);
    lines.renderOrder = 1;
    return lines;
  }

  /** 人物偏转（弧度） */
  setYaw(yaw) {
    this.yaw = yaw;
  }

  setScrollProgress(p) {
    this.scrollRot = p * 0.5;
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v > 0.01;
    this.group.position.y = (1 - v) * 0.4;
  }

  update(t, dt, pointer) {
    // 竖屏走另一套排布：390px 的宽度塞不下横着绕的一圈标签
    if (this.camera.aspect < 0.9) return this._updatePortrait(t, dt, pointer);

    // 摆角 = 指针 + 人物偏转 + 慢呼吸，全部夹在扇区内。
    // 方向是【反的】：鼠标往右 → 轨道往左转。
    // 理由很实际 —— 往右滑是为了把右边的 ABOUT 转进来点得到，
    // 如果轨道跟着指针同向跑，最外侧那两项永远在屏幕边上够不着。
    const target =
      -pointer.x * 0.52 - this.yaw * 0.12 + this.scrollRot + Math.sin(t * 0.33) * 0.05;
    this.sway += (target - this.sway) * Math.min(1, dt * 2.4);
    this.sway = THREE.MathUtils.clamp(this.sway, -OrbitNav.SWAY_LIMIT, OrbitNav.SWAY_LIMIT);

    const tiltY = pointer.y * 0.07;

    // 以桌面 16:9 为基准做归一化，保证竖屏 / 宽屏比例一致
    const vh = this.camera.aspect
      ? 2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360)
      : 2.41;
    const vScale = vh / 2.41;
    const rScale = Math.max(0.9, Math.min(1, vScale));
    const portrait = this.camera.aspect < 0.9;

    // 近景时镜头越近，导航越容易横向出画 —— 按可视宽度再收一次
    let xScale = Math.min(
      portrait ? 1 : 0.95,
      Math.max(portrait ? 0.21 : 0.58, this.camera.aspect / (portrait ? 1.9 : 1.7))
    );
    const halfTan = Math.tan((this.camera.fov * Math.PI) / 360);
    const halfW = this.camera.position.z * halfTan * (this.camera.aspect || 1.6);
    // 按「最外侧那个标签的外沿」反推横向压缩，而不是写死一个常量：
    // 两侧留白 = 半个可视宽 - 标签半宽，否则两端会把字切掉
    const reach = Math.max(0.2, this.ringR * Math.sin(this.arc));
    const labelHalfW = (this.items[0]?.baseH ?? 0.16) * 1.1;
    xScale = Math.min(xScale, Math.max(0.2, (halfW * 0.80 - labelHalfW) / reach));
    const zScale = portrait ? 0.55 + 0.45 * xScale : 1;
    const sizeDamp = portrait ? 0.55 : 1;

    for (const it of this.items) {
      const a = it.az + this.sway;
      const p = this._pointAt(a, it.radius * rScale);
      const x = p.x * xScale;
      const z = p.z * zScale;
      const y =
        p.y +
        tiltY +
        Math.sin(t * 0.62 + it.phase) * 0.011;

      it.mesh.position.set(x, y, z);

      // billboard + 自身轻微倾斜（漫画感）
      it.mesh.quaternion.copy(this.camera.quaternion);
      this._q.setFromAxisAngle(this._zAxis, it.roll);
      it.mesh.quaternion.multiply(this._q);

      // 前后大小差异（透视之外再补一点，让"大小变化"更明显）
      const depth = z / (it.radius * rScale);
      const extra = 1 + depth * 0.16;

      const isHover = this.hovered === it;
      it.targetScale = isHover ? 1.12 : 1;
      it.scale += (it.targetScale - it.scale) * Math.min(1, dt * 9);

      const s = it.baseH * vScale * sizeDamp * extra * it.scale;
      it.mesh.scale.set(s * it.aspect, s, 1);

      // 靠后的项稍微淡一点，暗示"绕到后面去了"
      const fade = 1 - 0.32 * Math.max(0, 1 - depth);
      it.hoverMix += ((isHover ? 1 : 0) - it.hoverMix) * Math.min(1, dt * 12);
      it.matN.opacity = (1 - it.hoverMix) * fade * this.visible;
      it.matH.opacity = it.hoverMix * fade * this.visible;
      it.mesh.visible = this.visible > 0.01;
    }

    // 轨道线跟着同一套压缩参数走
    this.guides.scale.set(xScale, 1, zScale);
    this.guides.position.y = tiltY;
    this.guides.material.opacity = 0.8 * this.visible;
    this.guides.visible = this.visible > 0.01;
  }

  /**
   * 竖屏排布：把环绕从「水平面绕一圈」换成「屏幕平面上的竖椭圆」。
   * 手机上横向只有 390px，六个标签横着排必然叠在一起；
   * 竖着有 844px 可用，四个角各放一块（菱形），字能放大到看得清，
   * 而且不会压在头顶和手心上。z 固定 0，等于没有前后透视差，尺寸统一。
   */
  _updatePortrait(t, dt, pointer) {
    const target =
      -pointer.x * 0.30 - this.yaw * 0.10 + this.scrollRot * 0.6 + Math.sin(t * 0.33) * 0.04;
    this.sway += (target - this.sway) * Math.min(1, dt * 2.4);
    this.sway = THREE.MathUtils.clamp(this.sway, -0.45, 0.45);

    const halfH = this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360);
    const halfW = halfH * (this.camera.aspect || 0.5);
    const { rx, ry, size } = this.portraitFrame;
    const rX = halfW * rx;
    const rY = halfH * ry;
    const h = halfH * size;   // 屏幕上一块标签的高度，跟视口高挂钩，换机型不变
    const tiltY = pointer.y * 0.04;
    const n = this.items.length;

    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      // 从 45° 起、每 90° 一格：四个角，避开正上方（头顶）和正下方（手）
      const a = Math.PI * 0.25 + (i / n) * Math.PI * 2 + this.sway;
      const x = Math.cos(a) * rX;
      const y = Math.sin(a) * rY + tiltY + Math.sin(t * 0.62 + it.phase) * 0.008;

      it.mesh.position.set(x, y, 0);
      it.mesh.quaternion.copy(this.camera.quaternion);
      this._q.setFromAxisAngle(this._zAxis, it.roll);
      it.mesh.quaternion.multiply(this._q);

      const isHover = this.hovered === it;
      it.targetScale = isHover ? 1.12 : 1;
      it.scale += (it.targetScale - it.scale) * Math.min(1, dt * 9);

      const s = h * it.scale;
      it.mesh.scale.set(s * it.aspect, s, 1);

      it.hoverMix += ((isHover ? 1 : 0) - it.hoverMix) * Math.min(1, dt * 12);
      it.matN.opacity = (1 - it.hoverMix) * this.visible;
      it.matH.opacity = it.hoverMix * this.visible;
      it.mesh.visible = this.visible > 0.01;
    }

    // 那圈虚线是水平椭圆，竖屏下跟这套排布对不上，直接藏掉
    this.guides.visible = false;
  }

  /** 返回被指向的导航项 */
  raycast(ndc) {
    if (!this.visible) return null;
    this._raycaster.setFromCamera(ndc, this.camera);
    const meshes = this.items.filter((i) => i.mesh.visible).map((i) => i.mesh);
    const hits = this._raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    return this.items[hits[0].object.userData.itemIndex];
  }

  setHover(item) {
    if (this.hovered === item) return;
    this.hovered = item;
    this.onHover?.(item);
  }
}
