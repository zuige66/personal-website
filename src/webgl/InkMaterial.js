import * as THREE from 'three';

/**
 * 墨线着色器
 * ------------------------------------------------------------
 * 这个模型的资产构成（实测）：
 *   - baseColor : 分岛烘焙的手绘墨色，头发/外套/袍子的笔触都在，但【脸区几乎空白】
 *   - normalMap : 艺术家的细线全部烙在这里（发丝、衣褶、眼眉的浮雕）
 *   - metalRough: 无关紧要
 *
 * 原来的 MeshStandardMaterial 用软光照，把法线图里的细线彻底抹平了 ——
 * 这就是"没有 2D 手绘感"的真正原因，而不是几何不够细。
 *
 * 所以这里做的是「重打光 + 硬分层」：
 *   1) 用导数重建 TBN，把法线图扰动回来（模型没有 tangent）
 *   2) 用掠射光打浮雕 —— 法线图上的每一根笔画都会变成一条硬边阴影
 *   3) 再叠几何曲率线（大形转折：下巴、鼻梁、眼窝）
 *   4) 深度断裂线（发丝压在脸上）
 *   5) 底色做色阶压缩 + 中间调 45° 网点
 */

const vert = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vPosW;

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = viewMatrix * wp;
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  precision highp float;

  uniform vec3  uInk;
  uniform vec3  uPaper;

  uniform sampler2D uMap;
  uniform float uUseMap;
  uniform float uLevelLo;      // 贴图色阶压缩下限
  uniform float uLevelHi;      // 贴图色阶压缩上限

  uniform sampler2D uNormalMap;
  uniform float uUseNormal;
  uniform float uNormalScale;  // 浮雕强度
  uniform vec3  uRakeDir;      // 掠射光方向（世界空间）
  uniform float uRakeLo;       // 浮雕阴影起始
  uniform float uRakeHi;       // 浮雕阴影饱和
  uniform float uRakeGain;     // 浮雕阴影强度

  uniform float uFormAmount;   // 大形光占比
  uniform float uBandLow;      // 暗部 -> 中间调
  uniform float uBandHigh;     // 中间调 -> 亮部

  uniform float uCavLo;        // 几何凹陷起始
  uniform float uCavHi;        // 几何凹陷饱和
  uniform float uCavGain;      // 几何凹陷压暗强度

  uniform float uMapLineGain;  // 法线图梯度线强度（碎片化 UV 上易长缝，默认关）
  uniform float uLineThr;      // 法线梯度提线阈值
  uniform float uLineGain;     // 线强度
  uniform float uDepthThr;     // 深度断裂阈值
  uniform float uRimThr;       // 轮廓线（Fresnel）阈值
  uniform float uDotSize;      // 网点尺寸（CSS 像素）
  uniform float uPixelRatio;
  uniform float uHalftone;     // 网点强度 0..1
  uniform float uToneBias;     // 整体调子偏移
  uniform float uShadowCrush;  // 暗部压成实墨的力度

  uniform sampler2D uFaceTex;  // 脸谱（平面投影贴花）
  uniform float uHasFace;      // 是否启用脸部压平（抑制曲率压暗）
  uniform float uHasDecal;     // 是否叠加脸谱贴花
  uniform vec3  uFaceCenter;   // 脸谱中心（世界空间）
  uniform vec2  uFaceSize;     // 脸谱覆盖的世界尺寸
  uniform float uFaceGain;
  uniform float uSkinLo;       // 皮肤判定（按贴图亮度）
  uniform float uSkinHi;
  uniform float uDbg;

  varying vec3 vNormalW;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec2 vUv;
  varying vec3 vPosW;

  // 45° 旋转的网点
  float screentone(float tone) {
    vec2 sc = gl_FragCoord.xy / (uDotSize * uPixelRatio);
    const float a = 0.785398;
    mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 p = rot * sc;
    vec2 f = fract(p) - 0.5;
    float d = length(f);
    float r = (1.0 - tone) * 0.60;
    float dotMask = 1.0 - smoothstep(r - 0.10, r + 0.10, d);
    return dotMask;
  }

  // 模型没有 tangent，用屏幕导数重建 TBN（同 three 的 getTangentFrame）
  vec3 perturbNormal(vec3 Nw, vec3 Vw) {
    if (uUseNormal < 0.5) return Nw;
    vec3 nT = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    nT.xy *= uNormalScale;
    nT = normalize(nT);

    vec3 dp1 = dFdx(vPosW);
    vec3 dp2 = dFdy(vPosW);
    vec2 duv1 = dFdx(vUv);
    vec2 duv2 = dFdy(vUv);

    vec3 dp2perp = cross(dp2, Nw);
    vec3 dp1perp = cross(Nw, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-12);
    mat3 TBN = mat3(T * invmax, B * invmax, Nw);
    return normalize(TBN * nT);
  }

  void main() {
    vec3 Ng = normalize(vNormalW);
    if (!gl_FrontFacing) Ng = -Ng;
    vec3 Vw = normalize(cameraPosition - vPosW);

    // 法线图扰动后的法线 —— 细线在这里
    vec3 Nm = perturbNormal(Ng, Vw);

    // ---- 1. 底：手绘墨色贴图，色阶压缩 ----
    float texL = 1.0;
    if (uUseMap > 0.5) texL = texture2D(uMap, vUv).r;
    float tone = smoothstep(uLevelLo, uLevelHi, texL);

    // 中间调遮罩：白的地方（皮肤、白袍）保持纯白，只让灰面吃到光影。
    // 参考图里皮肤就是一张白纸 + 几根线，一旦压灰就"糊"了。
    float midMask = smoothstep(0.25, 0.95, 1.0 - tone);

    // ---- 2. 掠射光打浮雕：法线图上每一根笔画都变成硬边阴影 ----
    float rake = dot(Nm, uRakeDir);
    float relief = smoothstep(uRakeLo, uRakeHi, rake);
    // 有下限：最暗压到 0.6，不然整张脸会被打成一团黑
    tone *= mix(1.0, mix(1.0, 0.60 + 0.40 * relief, uRakeGain), midMask);

    // ---- 3. 大形光：保形体，但只占很小的比重 ----
    float ndl = dot(Ng, normalize(uRakeDir + Vw * 0.85));
    float form = 0.66 + 0.34 * smoothstep(uBandLow - 0.10, uBandHigh, ndl);
    tone *= mix(1.0, form, uFormAmount * midMask);

    // ---- 4. 脸谱区域：皮肤判定 + 平面投影 ----
    // 参考图里脸就是一张白纸，只有几根细线。所以脸部区域要关掉曲率压暗，
    // 否则鼻翼、眼窝会被压成一团黑（就是之前"鼻子太黑"的原因）。
    vec2 fuv = vec2(0.0);
    float faceArea = 0.0;
    if (uHasFace > 0.5) {
      vec2 fp = (vPosW.xy - uFaceCenter.xy) / uFaceSize;
      fuv = vec2(fp.x + 0.5, fp.y + 0.5);
      float inside = step(0.0, fuv.x) * step(fuv.x, 1.0) * step(0.0, fuv.y) * step(fuv.y, 1.0);
      float front = smoothstep(0.20, 0.55, abs(Ng.z));
      // 注意：这里不乘皮肤亮度。脸谱已经烘焙进贴图，
      // 眼睛那些线本身就是暗的，再按亮度筛会把五官自己筛掉。
      faceArea = inside * front;
    }

    // ---- 5. 几何曲率：凹陷压暗 + 大形转折线 ----
    float curv = length(dFdx(vNormalV)) + length(dFdy(vNormalV));
    float cavity = smoothstep(uCavLo, uCavHi, curv);
    tone *= 1.0 - cavity * uCavGain * (1.0 - faceArea * 0.92);
    float lineGeo = smoothstep(uLineThr, uLineThr * 1.9, curv) * (1.0 - faceArea * 0.85);

    // ---- 5. 法线图梯度线：把笔画直接当线画 ----
    vec3 nT2 = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
    float nGrad = length(dFdx(nT2.xy)) + length(dFdy(nT2.xy));
    float lineMap = smoothstep(uLineThr * 0.45, uLineThr * 1.15, nGrad) * uMapLineGain;

    // ---- 6. 深度断裂线（发丝压在脸上这类分层）----
    float gZ = (abs(dFdx(vViewPos.z)) + abs(dFdy(vViewPos.z))) / max(0.2, -vViewPos.z);
    float lineZ = smoothstep(uDepthThr, uDepthThr * 2.2, gZ);

    // ---- 7. 轮廓线：视线掠射处出线 ----
    float ndv = clamp(dot(Ng, Vw), 0.0, 1.0);
    float lineRim = smoothstep(1.0 - uRimThr, 1.0 - uRimThr * 0.3, 1.0 - ndv);

    // 脸部区域已经有烘焙好的五官，几何提线会把眼窝压成一团黑 —— 关掉。
    // 只留 Fresnel 剪影线，保证下巴/脸缘还有轮廓。
    float faceLineMul = 1.0 - faceArea * 0.90;
    float line = max(max(lineGeo * faceLineMul, lineMap),
                     max(lineZ * faceLineMul, lineRim * 0.85));
    line = clamp(line * uLineGain, 0.0, 1.0);

    tone = clamp(tone + uToneBias, 0.0, 1.0);

    // ---- 8. 网点：只在中间调出现 ----
    float mid = smoothstep(0.06, 0.26, tone) * (1.0 - smoothstep(0.80, 0.97, tone));
    float dots = screentone(clamp(tone, 0.0, 1.0));
    float halftoned = mix(tone, 1.0 - dots, mid * uHalftone);

    if (uDbg > 2.5) {  // 3: 直接看贴图
      gl_FragColor = vec4(texture2D(uFaceTex, fuv).rgb, 1.0);
      return;
    }
    if (uDbg > 0.5) {
      vec4 fcd = texture2D(uFaceTex, fuv);
      gl_FragColor = vec4(faceArea, fcd.a * faceArea, uHasFace * 0.5, 1.0);
      return;
    }

    vec3 col = mix(uInk, uPaper, halftoned);

    // 深阴影压成实墨，高光彻底留白
    col = mix(uInk, col, smoothstep(0.0, uShadowCrush, tone));
    col = mix(col, uPaper, smoothstep(0.92, 1.0, tone));

    // ---- 脸谱贴花：必须放在"高光留白"之后，否则整张脸会被刷成纯白 ----
    if (uHasDecal > 0.5 && faceArea > 0.001) {
      vec4 fc = texture2D(uFaceTex, fuv);
      float a = fc.a * faceArea * uFaceGain;
      col = mix(col, mix(uInk, uPaper, fc.r), a);
    }

    // 线
    col = mix(col, uInk, line);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 把 #rrggbb 转成"原样输出"的颜色。
 * ShaderMaterial 不走 three 的 colorspace 后处理，所以这里必须存 sRGB 原值，
 * 否则人物身上的"纸色"和页面 CSS 的 --paper 对不上，边缘会出现一圈灰边。
 */
const WHITE_1PX = (() => {
  const d = new Uint8Array([255, 255, 255, 0]);
  const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

function rawColor(input) {
  if (input instanceof THREE.Color) return input.clone();
  if (typeof input === 'number') input = '#' + input.toString(16).padStart(6, '0');
  const hex = String(input).replace('#', '');
  const n = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  return new THREE.Color().setRGB(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
    THREE.LinearSRGBColorSpace
  );
}

export function createInkMaterial({
  map = null,
  normalMap = null,
  ink = '#0a0a0a',
  paper = '#f2f1ec',
  rakeDir = new THREE.Vector3(0.55, 0.42, 0.72).normalize(),
  levelLo = 0.18,
  levelHi = 0.72,
  normalScale = 1.0,
  rakeLo = 0.30,
  rakeHi = 0.72,
  rakeGain = 0.95,
  formAmount = 0.28,
  bandLow = 0.16,
  bandHigh = 0.74,
  cavLo = 0.02,
  cavHi = 0.16,
  cavGain = 0.75,
  mapLineGain = 0.0,
  lineThr = 0.10,
  lineGain = 1.0,
  depthThr = 0.014,
  rimThr = 0.14,
  dotSize = 3.2,
  pixelRatio = 1,
  halftone = 1.0,
  toneBias = 0.0,
  shadowCrush = 0.06,
  faceTex = null,
  faceMask = true,
  faceCenter = new THREE.Vector3(0, 0, 0),
  faceSize = new THREE.Vector2(1, 1),
  faceGain = 1.0,
  skinLo = 0.45,
  skinHi = 0.78,
  dbg = 0,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: rawColor(ink) },
      uPaper: { value: rawColor(paper) },
      uMap: { value: map },
      uUseMap: { value: map ? 1 : 0 },
      uLevelLo: { value: levelLo },
      uLevelHi: { value: levelHi },
      uNormalMap: { value: normalMap },
      uUseNormal: { value: normalMap ? 1 : 0 },
      uNormalScale: { value: normalScale },
      uRakeDir: { value: rakeDir.clone() },
      uRakeLo: { value: rakeLo },
      uRakeHi: { value: rakeHi },
      uRakeGain: { value: rakeGain },
      uFormAmount: { value: formAmount },
      uBandLow: { value: bandLow },
      uBandHigh: { value: bandHigh },
      uCavLo: { value: cavLo },
      uCavHi: { value: cavHi },
      uCavGain: { value: cavGain },
      uMapLineGain: { value: mapLineGain },
      uLineThr: { value: lineThr },
      uLineGain: { value: lineGain },
      uDepthThr: { value: depthThr },
      uRimThr: { value: rimThr },
      uDotSize: { value: dotSize },
      uPixelRatio: { value: pixelRatio },
      uHalftone: { value: halftone },
      uToneBias: { value: toneBias },
      uShadowCrush: { value: shadowCrush },
      uFaceTex: { value: faceTex || WHITE_1PX },
      uHasFace: { value: faceMask ? 1 : 0 },
      uHasDecal: { value: faceTex ? 1 : 0 },
      uFaceCenter: { value: faceCenter.clone() },
      uFaceSize: { value: faceSize.clone() },
      uFaceGain: { value: faceGain },
      uSkinLo: { value: skinLo },
      uSkinHi: { value: skinHi },
      uDbg: { value: dbg },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
  });
}

/** 外轮廓：背面外扩的"描边壳"（碎片化网格上会炸，默认不用） */
export function createOutlineMaterial({
  ink = '#0a0a0a',
  thickness = 0.006,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: rawColor(ink) },
      uThickness: { value: thickness },
    },
    vertexShader: /* glsl */ `
      uniform float uThickness;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        mv.xyz += n * uThickness;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      void main() {
        gl_FragColor = vec4(uInk, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

/**
 * 给整个对象套上墨线材质（并把原来的材质存到 userData 方便回退）
 * @param {THREE.Object3D} root
 * @param {object} opts { ink, outline, thickness, ...inkMaterial 参数 }
 */
export function applyInkToObject(root, opts = {}) {
  const {
    ink = '#0a0a0a',
    paper = '#f2f1ec',
    outline = false,
    thickness = 0.004,
    useMap = true,
    useNormal = true,
    pixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
    ...inkOpts
  } = opts;

  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.isOutline) meshes.push(o);
  });

  const mats = [];
  const shells = [];

  meshes.forEach((o) => {
    const src = o.material;
    const mat = createInkMaterial({
      map: useMap ? src.map : null,
      normalMap: useNormal ? src.normalMap : null,
      ink,
      paper,
      pixelRatio,
      ...inkOpts,
    });
    o.userData.origMaterial = src;
    o.material = mat;
    o.frustumCulled = false;
    mats.push(mat);

    if (outline) {
      const shell = new THREE.Mesh(o.geometry, createOutlineMaterial({ ink, thickness }));
      shell.position.copy(o.position);
      shell.quaternion.copy(o.quaternion);
      shell.scale.copy(o.scale);
      shell.userData.isOutline = true;
      shell.frustumCulled = false;
      shell.renderOrder = -1;
      o.parent.add(shell);
      shells.push(shell);
    }
  });

  return {
    materials: mats,
    shells,
    set(key, value) {
      mats.forEach((m) => {
        if (m.uniforms[key]) m.uniforms[key].value = value;
      });
      shells.forEach((s) => {
        if (key === 'uThickness') s.material.uniforms.uThickness.value = value;
      });
    },
  };
}
