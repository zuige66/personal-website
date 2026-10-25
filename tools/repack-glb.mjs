import fs from 'fs';
import path from 'path';

/**
 * 把烘焙好的 baseColor 图片写回 GLB
 * ------------------------------------------------------------
 * 这个 GLB 的二进制布局很规整：
 *   buffer 0 = [image0 webp][image1 webp][image2 webp][meshopt 流 ×4]
 * 换掉 image0 会改变后续所有 byteOffset，所以整块 buffer 0 按 bufferView
 * 顺序重排一遍（每个都 4 字节对齐），同时同步 EXT_meshopt_compression 里的偏移。
 */

const GLB = process.argv[2] || 'public/character.min.glb';
const IMG = process.argv[3] || '.preview/basecolor-w94.webp';
const OUT = process.argv[4] || GLB;

const buf = fs.readFileSync(GLB);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb');

const total = buf.readUInt32LE(8);
const chunks = [];
let off = 12;
while (off < total) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
  off += 8 + len;
}
const jsonChunk = chunks.find((c) => c.type === 0x4e4f534a);
const binChunk = chunks.find((c) => c.type === 0x004e4942);
if (!jsonChunk || !binChunk) throw new Error('missing chunk');

const json = JSON.parse(jsonChunk.data.toString('utf8'));
const bin = binChunk.data;

console.log('buffers', json.buffers.length, 'bufferViews', json.bufferViews.length);
console.log('images', json.images.map((i) => i.mimeType));

const newImage = fs.readFileSync(IMG);
console.log('new image', IMG, (newImage.length / 1024).toFixed(0) + 'KB');

// buffer 0 里的数据有两类来源：
//   1) 直接挂在 bufferView 上的（三张图）
//   2) 挂在 EXT_meshopt_compression 上的压缩流（顶点/索引）
// 两类都要按原 byteOffset 顺序重排，否则偏移全错。
const segs = [];
json.bufferViews.forEach((v, i) => {
  if (v.buffer === 0) {
    segs.push({ kind: 'bv', i, off: v.byteOffset, len: v.byteLength });
  }
  const ext = v.extensions && v.extensions.EXT_meshopt_compression;
  if (ext && ext.buffer === 0) {
    segs.push({ kind: 'ext', i, off: ext.byteOffset, len: ext.byteLength });
  }
});
segs.sort((a, b) => a.off - b.off);

const parts = [];
let cur = 0;
const align4 = (n) => (4 - (n % 4)) % 4;

for (const sg of segs) {
  const data = sg.kind === 'bv' && sg.i === 0
    ? newImage
    : bin.subarray(sg.off, sg.off + sg.len);

  const pad = align4(cur);
  if (pad) { parts.push(Buffer.alloc(pad)); cur += pad; }

  if (sg.kind === 'bv') {
    const v = json.bufferViews[sg.i];
    v.byteOffset = cur;
    v.byteLength = data.length;
  } else {
    const ext = json.bufferViews[sg.i].extensions.EXT_meshopt_compression;
    ext.byteOffset = cur;
    ext.byteLength = data.length;
  }

  parts.push(Buffer.from(data));
  cur += data.length;
}

const newBin = Buffer.concat(parts);
json.buffers[0].byteLength = newBin.length;
console.log('buffer0', bin.length, '->', newBin.length);

// ---- 重新组装 GLB ----
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
const jpad = align4(jsonBuf.length);
if (jpad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)]);

const bpad = align4(newBin.length);
const binPadded = bpad ? Buffer.concat([newBin, Buffer.alloc(bpad)]) : newBin;

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binPadded.length, 8);

const c1 = Buffer.alloc(8);
c1.writeUInt32LE(jsonBuf.length, 0);
c1.writeUInt32LE(0x4e4f534a, 4);

const c2 = Buffer.alloc(8);
c2.writeUInt32LE(binPadded.length, 0);
c2.writeUInt32LE(0x004e4942, 4);

const out = Buffer.concat([header, c1, jsonBuf, c2, binPadded]);

if (path.resolve(OUT) === path.resolve(GLB)) {
  fs.copyFileSync(GLB, GLB + '.bak');
  console.log('backup ->', GLB + '.bak');
}
fs.writeFileSync(OUT, out);
console.log('wrote', OUT, (out.length / 1024 / 1024).toFixed(2) + 'MB');
