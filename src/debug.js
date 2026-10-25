import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'front';
const fit = params.get('fit') !== '0';
const src = params.get('src') || '/character.min.glb';

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

  scene.add(new THREE.Box3Helper(box, 0xff0000));
  scene.add(new THREE.AxesHelper(1.2));

  const R = fit ? 3.4 : 5.4;
  const dirs = {
    front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0],
    top: [0, 1, 0.001], iso: [0.8, 0.5, 1],
  };
  const v = dirs[view] || dirs.front;
  camera.position.set(v[0] * R, v[1] * R, v[2] * R);
  camera.lookAt(0, 0, 0);

  document.getElementById('hud').textContent =
    `view=${view}\nbbox min ${box.min.toArray().map((n) => n.toFixed(2))}\nbbox max ${box.max.toArray().map((n) => n.toFixed(2))}\nsize ${size.toArray().map((n) => n.toFixed(2))}\ncenter ${center.toArray().map((n) => n.toFixed(2))}\nmeshes ${(() => { let c = 0; root.traverse((o) => o.isMesh && c++); return c; })()}`;

  document.body.dataset.ready = '1';
  renderer.render(scene, camera);
});
