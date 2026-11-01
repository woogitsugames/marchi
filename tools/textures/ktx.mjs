// Encode raw RGBA dumps from process.py into KTX2 (Basis Universal) next to the JPGs.
// usage: node ktx.mjs <ktx2-encoder dist/node/index.js> <raw_dir> <textures_root> [filter]
//   raw files: <set>__<map>[_<size>].rgba (square, 8-bit RGBA, top row first)
//   output:    <textures_root>/<set>/<map>[_<size>].ktx2
// Encoder: npm `ktx2-encoder@0.5.4` installed in a temp folder (NOT a project dependency).
// 0.6.x (Basis 2.5 WASM) refuses sources above ~12 Mpix, so it cannot encode 4096².
// Settings (docs/ASSETS.md, D-14):
//   1k / 512 (low tier, legacy): albedo + orm ETC1S q160 clevel 2.
//   2k / 4k (high / ultra):      albedo + orm ETC1S q255 clevel 2; normal UASTC level 2,
//                                RDO lambda 3, zstd.  All: mipmaps, Y-flip (matches flipY JPGs).
import fs from 'node:fs';
import path from 'node:path';
const [enc, rawDir, outRoot, only] = process.argv.slice(2);
const { encodeToKTX2 } = await import(enc);
const decoder = async (buf) => {
  const n = Math.round(Math.sqrt(buf.length / 4));
  return { width: n, height: n, data: buf };
};
const files = fs.readdirSync(rawDir).filter((f) => f.endsWith('.rgba') && (!only || f.includes(only))).sort();
for (const f of files) {
  const [name, map] = f.replace('.rgba', '').split('__');
  const buf = new Uint8Array(fs.readFileSync(path.join(rawDir, f)));
  const kind = map.split('_')[0];
  const size = Math.round(Math.sqrt(buf.length / 4));
  const tier = size >= 2048;
  const base = { generateMipmap: true, isYFlip: true, imageDecoder: decoder, isKTX2File: true };
  const q = tier ? 255 : 160;
  const opts = kind === 'normal'
    ? { ...base, isUASTC: true, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false,
        needSupercompression: true, enableRDO: true, rdoQualityLevel: tier ? 3 : 4, uastcLDRQualityLevel: 2 }
    : kind === 'albedo'
      ? { ...base, isUASTC: false, qualityLevel: q, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true }
      : { ...base, isUASTC: false, qualityLevel: q, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false };
  const t = Date.now();
  const out = await encodeToKTX2(buf, opts);
  const dest = path.join(outRoot, name, map + '.ktx2');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  console.log(dest, (out.length / 1024).toFixed(0) + 'KB', (Date.now() - t) + 'ms');
}
