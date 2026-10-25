/**
 * 分析 / 清理 GLB：找出互不相连的网格孤岛，去掉漂浮的杂字
 * 用法：
 *   node tools/clean-glb.mjs analyze
 *   node tools/clean-glb.mjs filter <输出路径> [保留的最大岛数量]
 */
import fs from 'fs';

const SRC = 'public/character.glb';

function parseGLB(path) {
  const buf = fs.readFileSync(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error('不是 GLB');
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
  return { json, bin, buf };
}

const CT = { 5121: [1, 'readUInt8'], 5123: [2, 'readUInt16LE'], 5125: [4, 'readUInt32LE'] };

function readIndices(json, bin) {
  const prim = json.meshes[0].primitives[0];
  const acc = json.accessors[prim.indices];
  const bv = json.bufferViews[acc.bufferView];
  const [size, fn] = CT[acc.componentType];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const out = new Uint32Array(acc.count);
  for (let i = 0; i < acc.count; i++) out[i] = bin[fn](start + i * size);
  return { indices: out, acc, prim };
}

function readPositions(json, bin) {
  const prim = json.meshes[0].primitives[0];
  const acc = json.accessors[prim.attributes.POSITION];
  const bv = json.bufferViews[acc.bufferView];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || 12;
  const out = new Float32Array(acc.count * 3);
  for (let i = 0; i < acc.count; i++) {
    out[i * 3] = bin.readFloatLE(start + i * stride);
    out[i * 3 + 1] = bin.readFloatLE(start + i * stride + 4);
    out[i * 3 + 2] = bin.readFloatLE(start + i * stride + 8);
  }
  return out;
}

function components(vertexCount, indices) {
  const parent = new Int32Array(vertexCount).map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < indices.length; i += 3) {
    union(indices[i], indices[i + 1]);
    union(indices[i + 1], indices[i + 2]);
  }
  const map = new Map();
  for (let v = 0; v < vertexCount; v++) {
    const r = find(v);
    if (!map.has(r)) map.set(r, { root: r, verts: 0, tris: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
    const c = map.get(r);
    c.verts++;
  }
  for (let i = 0; i < indices.length; i += 3) {
    map.get(find(indices[i])).tris++;
  }
  return [...map.values()];
}

const { json, bin } = parseGLB(SRC);
const { indices, acc, prim } = readIndices(json, bin);
const pos = readPositions(json, bin);
const vcount = json.accessors[prim.attributes.POSITION].count;

const comps = components(vcount, indices);

// 统计每个分量的包围盒
for (const c of comps) {
  // 这里按顶点粗算
}
const rootOf = new Map();
const parent = new Int32Array(vcount).map((_, i) => i);
const find = (x) => {
  while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
  return x;
};
for (let i = 0; i < indices.length; i += 3) {
  const a = find(indices[i]); const b = find(indices[i + 1]); const c2 = find(indices[i + 2]);
  if (a !== b) parent[b] = a;
  if (a !== c2) parent[c2] = a;
}
for (let v = 0; v < vcount; v++) {
  const r = find(v);
  const c = comps.find((x) => x.root === r);
  if (!c) continue;
  for (let k = 0; k < 3; k++) {
    const val = pos[v * 3 + k];
    if (val < c.min[k]) c.min[k] = val;
    if (val > c.max[k]) c.max[k] = val;
  }
}

comps.sort((a, b) => b.tris - a.tris);
console.log(`总顶点 ${vcount}  三角面 ${indices.length / 3}  连通分量 ${comps.length}`);
comps.forEach((c, i) => {
  if (i > 30 && c.tris < 50) return;
  console.log(
    `#${String(i).padStart(2)} tris=${String(c.tris).padStart(7)} verts=${String(c.verts).padStart(7)}  ` +
      `bbox x[${c.min[0].toFixed(2)},${c.max[0].toFixed(2)}] y[${c.min[1].toFixed(2)},${c.max[1].toFixed(2)}] z[${c.min[2].toFixed(2)},${c.max[2].toFixed(2)}]`
  );
});

const mode = process.argv[2];
if (mode === 'filter') {
  const outPath = process.argv[3] || 'public/character-clean.glb';
  const keepTop = Number(process.argv[4] || 1);
  const keep = new Set(comps.slice(0, keepTop).map((c) => c.root));

  const kept = [];
  for (let i = 0; i < indices.length; i += 3) {
    if (keep.has(find(indices[i]))) kept.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  console.log(`保留 ${kept.length / 3} 面 / 原 ${indices.length / 3} 面`);

  // 追加新的 index bufferView
  const idxArr = new Uint32Array(kept);
  let idxBuf = Buffer.from(idxArr.buffer, idxArr.byteOffset, idxArr.byteLength);
  const pad = (4 - (idxBuf.length % 4)) % 4;
  if (pad) idxBuf = Buffer.concat([idxBuf, Buffer.alloc(pad)]);

  const binLenBefore = bin.length;
  const newBin = Buffer.concat([bin, idxBuf]);

  json.bufferViews.push({
    buffer: 0,
    byteOffset: binLenBefore,
    byteLength: idxBuf.length,
  });
  const newBvIndex = json.bufferViews.length - 1;

  const idxAccessor = json.accessors[prim.indices];
  idxAccessor.bufferView = newBvIndex;
  idxAccessor.byteOffset = 0;
  idxAccessor.count = kept.length;

  json.buffers[0].byteLength = newBin.length;

  // 组装 GLB
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

  fs.writeFileSync(outPath, Buffer.concat([header, jHead, jsonBuf, bHead, newBin]));
  console.log('写入', outPath, (total / 1024 / 1024).toFixed(1) + 'MB');
}
