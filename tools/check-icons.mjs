#!/usr/bin/env node
/** Static validation for the generated native icon assets. */
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = path.join(root, 'android/app/src/main/res');
const ios = path.join(root, 'ios/App/App/Assets.xcassets');
const errors = [];
const required = async (file) => { try { await access(file); } catch { errors.push(`Missing ${path.relative(root, file)}`); } };
async function png(relative, size, { opaque = false, alpha = false } = {}) {
  const file = path.join(root, relative);
  await required(file);
  try {
    const md = await sharp(file).metadata();
    if (md.width !== size || md.height !== size) errors.push(`${relative}: wrong dimensions ${md.width}x${md.height}, expected ${size}x${size}`);
    if (opaque && md.hasAlpha) errors.push(`${relative}: iOS app icon must not contain an alpha channel`);
    if (alpha && !md.hasAlpha) errors.push(`${relative}: foreground must have transparency`);
    if (md.format !== 'png') errors.push(`${relative}: not a PNG`);
  } catch (error) { errors.push(`${relative}: ${error.message}`); }
}

for (const [dpi, px] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
    await png(`android/app/src/main/res/mipmap-${dpi}/${name}`, px);
  }
}
for (const name of ['marchia_launcher_foreground', 'marchia_launcher_monochrome', 'marchia_splash_icon']) {
  await png(`android/app/src/main/res/drawable-nodpi/${name}.png`, 432, { alpha: true });
}
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) await required(path.join(android, `mipmap-anydpi-v26/${name}`));

const appDir = path.join(ios, 'AppIcon.appiconset');
const appList = JSON.parse(await readFile(path.join(appDir, 'Contents.json'), 'utf8')).images;
if (appList.length !== 18) errors.push(`Expected 18 iOS asset-catalog entries; got ${appList.length}`);
for (const img of appList) {
  const px = Number(img.size.split('x')[0]) * Number(img.scale.replace('x', ''));
  await png(`ios/App/App/Assets.xcassets/AppIcon.appiconset/${img.filename}`, px, { opaque: true });
}
const splashDir = path.join(ios, 'Splash.imageset');
const splashList = JSON.parse(await readFile(path.join(splashDir, 'Contents.json'), 'utf8')).images;
for (const img of splashList) {
  const px = 240 * Number(img.scale.replace('x', ''));
  await png(`ios/App/App/Assets.xcassets/Splash.imageset/${img.filename}`, px, { alpha: true });
}
try { const md = await sharp(path.join(root, 'docs/shots/app-icon.png')).metadata(); if (md.width !== 1450 || md.height !== 1360) errors.push('Incorrect contact-sheet dimensions'); } catch { errors.push('Missing comparison sheet'); }

// Android adaptive artwork must be inside the circular launcher safe zone:
// 66dp diameter on 108dp canvas (pixel radius = 432 * 33/108).
const layer = path.join(android, 'drawable-nodpi/marchia_launcher_foreground.png');
const { data, info } = await sharp(layer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const safeRadius = info.width * 33 / 108;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const a = data[(y * info.width + x) * info.channels + 3];
    if (a > 32 && Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2) > safeRadius + 1) {
      errors.push(`Android adaptive foreground outside mask-safe circle at ${x},${y}`);
      y = info.height;
      break;
    }
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('OK: launcher assets, Android safe zone, iOS alpha, splash and preview.');
