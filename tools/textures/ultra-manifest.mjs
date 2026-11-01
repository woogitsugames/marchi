// Write assets-ultra/manifest.json for the downloadable 4K (ultra) texture pack (D-17, D-18).
// usage: node tools/textures/ultra-manifest.mjs [packVersion]
// Paths are relative to assets-ultra/ (e.g. "textures/meadow/albedo_4096.ktx2"); the runtime
// loader expects the same layout under the base passed to setUltraBase().
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve('assets-ultra');
const version = Number(process.argv[2] ?? 1);
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ktx2')) {
      const buf = fs.readFileSync(p);
      files.push({ path: path.relative(root, p).split(path.sep).join('/'), bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
    }
  }
};
walk(path.join(root, 'textures'));
const totalBytes = files.reduce((n, f) => n + f.bytes, 0);
const manifest = {
  pack: 'marchia-textures-ultra',
  version,
  description: '4096 px KTX2 (Basis ETC1S q255, mips) for the ultra tier: albedo + ORM of the five terrain sets (not Y-flipped, array layers), ORM of four model sets (Y-flipped); models ship no albedo, bark stays 2048, normals stay 1024 in the APK.',
  licence: 'CC0 1.0 (Poly Haven), see docs/ASSETS.md',
  totalBytes,
  files,
};
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`${files.length} files, ${(totalBytes / 1048576).toFixed(1)} MB`);
