/**
 * 摘掉模型里漂浮的扁平字样（AI 生成时混入的 3D 文字薄片）
 * 判据：连通分量在 z 方向极薄（< 0.04）且位于身体之外的区域
 * 用法：node tools/strip-artifacts.mjs [输出路径]
 */
import fs from 'fs';

const SRC = 'public/character.glb';
const OUT = process.argv[2] || 'public/character.glb';

const buf = fs.readFileSync(SRC);
let off = 12;
let json = null;
let bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
  else if (type === 0x004e4942) bin = Buffer.from(data);
  off += 8 + len + ((4 - (len % 4)) % 4);
}

const prim = json.meshes[0].primitives[0];
const accI = json.accessors[prim.indices];
const bvI = json.bufferViews[accI.bufferView];
const si = (bvI.byteOffset || 0) + (accI.byteOffset || 0);
const N = accI.count;
const idx = new Uint32Array(N);
for (let i = 0; i < N; i++) idx[i] = bin.readUInt32LE(si + i * 4);

const accP = json.accessors[prim.attributes.POSITION];
const bvP = json.bufferViews[accP.bufferView];
const sp = (bvP.byteOffset || 0) + (accP.byteOffset || 0);
const V = accP.count;
const pos = new Float32Array(V * 3);
for (let i = 0; i < V; i++) {
  pos[i * 3] = bin.readFloatLE(sp + i * 12);
  pos[i * 3 + 1] = bin.readFloatLE(sp + i * 12 + 4);
  pos[i * 3 + 2] = bin.readFloatLE(sp + i * 12 + 8);
}

const parent = new Int32Array(V).map((_, i) => i);
const find = (x) => {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
};
for (let i = 0; i < N; i += 3) {
  const a = find(idx[i]);
  const b = find(idx[i + 1]);
  if (a !== b) parent[b] = a;
  const c = find(idx[i + 2]);
  const a2 = find(idx[i]);
  if (a2 !== c) parent[c] = a2;
}

const comp = new Map();
for (let i = 0; i < N; i += 3) {
  const r = find(idx[i]);
  if (!comp.has(r)) comp.set(r, { tris: 0, min: [9, 9, 9], max: [-9, -9, -9] });
  comp.get(r).tris++;
}
for (let v = 0; v < V; v++) {
  const c = comp.get(find(v));
  if (!c) continue;
  for (let k = 0; k < 3; k++) {
    const val = pos[v * 3 + k];
    if (val < c.min[k]) c.min[k] = val;
    if (val > c.max[k]) c.max[k] = val;
  }
}

const drop = new Set();
let droppedTris = 0;
for (const [root, c] of comp) {
  const zExt = c.max[2] - c.min[2];
  const cx = (c.min[0] + c.max[0]) / 2;
  const cy = (c.min[1] + c.max[1]) / 2;
  const flat = zExt < 0.04;
  const outside =
    cx > 0.36 || (cx > 0.16 && cy > 0.38) || (cy > 0.62 && cx < -0.04) || cy < -0.80;
  if (flat && outside) {
    drop.add(root);
    droppedTris += c.tris;
  }
}

console.log(`连通分量 ${comp.size}，判定为杂质 ${drop.size} 个，共 ${droppedTris} 面`);

const kept = [];
for (let i = 0; i < N; i += 3) {
  if (!drop.has(find(idx[i]))) kept.push(idx[i], idx[i + 1], idx[i + 2]);
}
console.log(`保留 ${kept.length / 3} / ${N / 3} 面`);

let idxBuf = Buffer.from(new Uint32Array(kept).buffer);
const pad = (4 - (idxBuf.length % 4)) % 4;
if (pad) idxBuf = Buffer.concat([idxBuf, Buffer.alloc(pad)]);

const binLenBefore = bin.length;
const newBin = Buffer.concat([bin, idxBuf]);

json.bufferViews.push({ buffer: 0, byteOffset: binLenBefore, byteLength: idxBuf.length });
const newBv = json.bufferViews.length - 1;

const idxAcc = json.accessors[prim.indices];
idxAcc.bufferView = newBv;
idxAcc.byteOffset = 0;
idxAcc.count = kept.length;
json.buffers[0].byteLength = newBin.length;

let jsonStr = JSON.stringify(json);
while (jsonStr.length % 4 !== 0) jsonStr += ' ';
const jsonBuf = Buffer.from(jsonStr, 'utf8');

const header = Buffer.alloc(12);
const total = 12 + 8 + jsonBuf.length + 8 + newBin.length;
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);

const jHead = Buffer.alloc(8);
jHead.writeUInt32LE(jsonBuf.length, 0);
jHead.writeUInt32LE(0x4e4f534a, 4);

const bHead = Buffer.alloc(8);
bHead.writeUInt32LE(newBin.length, 0);
bHead.writeUInt32LE(0x004e4942, 4);

fs.writeFileSync(OUT, Buffer.concat([header, jHead, jsonBuf, bHead, newBin]));
console.log('写入', OUT, (total / 1024 / 1024).toFixed(1) + 'MB');
