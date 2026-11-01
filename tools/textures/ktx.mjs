// usage: node ktx.mjs <encoder_index_js> <raw_png_dir> <textures_root>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const [enc, rawDir, outRoot] = process.argv.slice(2);
const { encodeToKTX2 } = await import(enc);
const decoder = async (buf) => {
  const n = Math.round(Math.sqrt(buf.length / 4));
  return { width: n, height: n, data: buf };
};
const only = process.argv[5]; const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.rgba') && (!only || f.includes(only))).sort();
for (const f of files) {
  const [name, map] = f.replace('.rgba', '').split('__');
  const buf = new Uint8Array(fs.readFileSync(path.join(rawDir, f)));
  const kind = map.split('_')[0];
  const base = { generateMipmap: true, isYFlip: true, imageDecoder: decoder, isKTX2File: true };
  const opts = kind === 'normal'
    ? { ...base, isUASTC: true, isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false,
        needSupercompression: true, enableRDO: true, rdoQualityLevel: 4, uastcLDRQualityLevel: 2 }
    : kind === 'albedo'
      ? { ...base, isUASTC: false, qualityLevel: 160, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true }
      : { ...base, isUASTC: false, qualityLevel: 160, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false };
  const t = Date.now();
  const out = await encodeToKTX2(buf, opts);
  const dest = path.join(outRoot, name, map + '.ktx2');
  fs.writeFileSync(dest, out);
  console.log(dest, (out.length / 1024).toFixed(0) + 'KB', (Date.now() - t) + 'ms');
}
