import * as THREE from 'three';
import { makeNavTexture } from './text.js';

/**
 * 环绕在人物周围的导航
 * - 位置绕 Y 轴公转（透视自然产生大小变化）
 * - 始终朝向相机（billboard），所以背面也能读
 * - 开启 depthTest，被人物身体遮挡时自然消失 —— 这就是"环绕 + 遮挡"
 */
export class OrbitNav {
  constructor(scene, camera, navData, { onSelect, onHover } = {}) {
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
    this.rotation = 0;
    this.scrollRot = 0;
    this.visible = 1;

    const n = navData.length;
    // 高度都压在胸口以下，避免公转到正前方时糊住脸
    const ys = [0.30, 0.02, -0.26, 0.15, -0.14, -0.36];

    navData.forEach((d, i) => {
      const angle = (i / n) * Math.PI * 2;
      const radius = 1.30 + (i % 3) * 0.10;

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
      const h = 0.272;
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
        angle,
        radius,
        y: ys[i % ys.length],
        baseH: h,
        aspect: normal.aspect,
        scale: 1,
        targetScale: 1,
        roll: (i % 2 === 0 ? -1 : 1) * (0.03 + (i % 3) * 0.015),
        hoverMix: 0,
      });
    });

    this._raycaster = new THREE.Raycaster();
    this._q = new THREE.Quaternion();
    this._zAxis = new THREE.Vector3(0, 0, 1);
  }

  setScrollProgress(p) {
    this.scrollRot = p * 1.15;
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v > 0.01;
    this.group.position.y = (1 - v) * 0.4;
  }

  update(t, dt, pointer) {
    this.rotation += dt * 0.075;

    const base = this.rotation + this.scrollRot + pointer.x * 0.42;
    const tilt = pointer.y * 0.10;

    // 以桌面 16:9 为基准做归一化，保证竖屏 / 宽屏比例一致
    const vh = this.camera.aspect
      ? 2 * this.camera.position.z * Math.tan((this.camera.fov * Math.PI) / 360)
      : 2.41;
    const vScale = vh / 2.41;
    // 轨道半径跟着相机距离收缩，保证近景时导航不出画；
    // 但不低于 0.88，否则会缩进人物身体里，遮挡效果就没了。
    const rScale = Math.max(0.88, Math.min(1, vScale));
    const portrait = this.camera.aspect < 0.9;
    let xScale = Math.min(
      portrait ? 1 : 0.86,
      Math.max(portrait ? 0.21 : 0.55, this.camera.aspect / (portrait ? 1.9 : 1.7))
    );

    // 近景时镜头越近，导航越容易横向出画 —— 按可视宽度再收一次。
    // 半径会压扁成竖排，但总比飞出屏幕好。
    const halfTan = Math.tan((this.camera.fov * Math.PI) / 360);
    const halfW = this.camera.position.z * halfTan * (this.camera.aspect || 1.6);
    const maxRadius = 1.40 * rScale;
    xScale = Math.min(xScale, (halfW * 0.94) / maxRadius);
    const zScale = portrait ? 0.55 + 0.45 * xScale : 1;
    const sizeDamp = portrait ? 0.55 : 1;

    for (const it of this.items) {
      const a = it.angle + base;
      const x = Math.sin(a) * it.radius * rScale * xScale;
      const z = Math.cos(a) * it.radius * rScale * zScale;
      const y = it.y * rScale + tilt + Math.sin(t * 0.7 + it.angle * 2) * 0.012;

      it.mesh.position.set(x, y, z);

      // billboard + 自身轻微倾斜（漫画感）
      it.mesh.quaternion.copy(this.camera.quaternion);
      this._q.setFromAxisAngle(this._zAxis, it.roll);
      it.mesh.quaternion.multiply(this._q);

      // 前后大小差异（透视之外再补一点，让"大小变化"更明显）
      const depth = z / it.radius; // -1 后 … 1 前
      const extra = 1 + depth * 0.14;

      const isHover = this.hovered === it;
      it.targetScale = isHover ? 1.12 : 1;
      it.scale += (it.targetScale - it.scale) * Math.min(1, dt * 9);

      const s = it.baseH * vScale * sizeDamp * extra * it.scale;
      it.mesh.scale.set(s * it.aspect, s, 1);

      // hover 反色交叉淡入
      it.hoverMix += ((isHover ? 1 : 0) - it.hoverMix) * Math.min(1, dt * 12);
      const fade = 1 - 0.42 * Math.max(0, -depth);
      it.matN.opacity = (1 - it.hoverMix) * fade * this.visible;
      it.matH.opacity = it.hoverMix * fade * this.visible;
      it.mesh.visible = this.visible > 0.01;
    }
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
