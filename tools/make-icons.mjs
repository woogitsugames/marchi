#!/usr/bin/env node
/**
 * MARCHIA native artwork pipeline. No generated artwork, icon packs or fonts.
 * The only vector source is art/app-icon.svg (hand-authored SVG paths).
 * Run from any directory: npm run icons
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(ROOT, 'android/app/src/main/res');
const iosAssets = path.join(ROOT, 'ios/App/App/Assets.xcassets');
const shots = path.join(ROOT, 'docs/shots');
const outArt = path.join(ROOT, 'art');
const TORF = '#2b2620';
const PARCHMENT = '#e4dccb';
const svgFile = path.join(outArt, 'app-icon.svg');

function svgWrap(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${body}</svg>`;
}

function extractGroup(xml, id) {
  // The SVG source intentionally has no nested <g> elements.
  const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<g\\s+id="${safe}"[^>]*>[\\s\\S]*?<\\/g>`));
  if (!match) throw new Error(`Missing <g id="${id}"> in ${svgFile}`);
  return match[0];
}

async function savePng(svg, size, target, { opaque = false } = {}) {
  await mkdir(path.dirname(target), { recursive: true });
  const instance = sharp(Buffer.from(svg), { density: 96 })
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 });
  if (opaque) instance.flatten({ background: TORF }).removeAlpha();
  await instance.png({ compressionLevel: 9 }).toFile(target);
}

async function saveRoundPng(svg, size, target) {
  const square = await sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`);
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(square).composite([{ input: mask, blend: 'dest-in' }]).png({ compressionLevel: 9 }).toFile(target);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function iosIcons() {
  // Full-size iOS (modern and classic) asset catalog slots; no alpha in app icons.
  const combos = {
    iphone: { '20': [2, 3], '29': [2, 3], '40': [2, 3], '60': [2, 3] },
    ipad: { '20': [1, 2], '29': [1, 2], '40': [1, 2], '76': [1, 2], '83.5': [2] },
  };
  const images = [];
  for (const [idiom, set] of Object.entries(combos)) {
    for (const [pt, scales] of Object.entries(set)) {
      for (const scale of scales) {
        const size = Number(pt) * scale;
        images.push({ idiom, size: `${pt}x${pt}`, scale: `${scale}x`, filename: `icon-${idiom}-${pt}@${scale}x.png`, px: size });
      }
    }
  }
  images.push({ idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: 'AppIcon-512@2x.png', px: 1024 });
  return images;
}

function escapeXml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function makeComparison(fullSvg) {
  const width = 1450;
  const height = 1360;
  const iconSizes = [48, 96, 192, 512];
  const centersX = [140, 380, 700, 1115];
  const centersY = [340, 1040];
  const labels = [
    { y: 0, top: '#e4dccb', text: TORF, title: 'JASNE TLO / PERGAMIN' },
    { y: 690, top: '#181511', text: '#e4dccb', title: 'CIEMNE TLO / TORF' },
  ];
  const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#e4dccb"/>
    <rect y="690" width="${width}" height="670" fill="#181511"/>
    <path d="M36 54H1414 M36 744H1414" fill="none" stroke="#b8893a" stroke-width="2"/>
    <text x="48" y="42" fill="${TORF}" font-family="sans-serif" font-size="26" font-weight="700" letter-spacing="3">MARCHIA · IKONA APLIKACJI</text>
    <text x="48" y="731" fill="${PARCHMENT}" font-family="sans-serif" font-size="26" font-weight="700" letter-spacing="3">MARCHIA · IKONA APLIKACJI</text>
    <text x="48" y="87" fill="${TORF}" font-family="sans-serif" font-size="16">JASNE TŁO  •  SKALA NATYWNA</text>
    <text x="48" y="775" fill="${PARCHMENT}" font-family="sans-serif" font-size="16">CIEMNE TŁO  •  SKALA NATYWNA</text>
    ${labels.flatMap((row, ri) => iconSizes.map((size, i) => {
      const cy = centersY[ri];
      const cx = centersX[i];
      const y = ri ? 1325 : 645;
      return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="600" fill="${row.text}">${escapeXml(`${size} × ${size} px`)}</text>`;
    })).join('\n')}
  </svg>`;
  const composites = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < iconSizes.length; i++) {
      const size = iconSizes[i];
      const png = await sharp(Buffer.from(fullSvg)).resize(size, size).png().toBuffer();
      const left = Math.round(centersX[i] - size / 2);
      const top = Math.round(centersY[row] - size / 2);
      // A subtle hairline identifies the square boundary on dark backgrounds.
      if (row === 1) {
        const border = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size + 2}" height="${size + 2}"><rect x="0.5" y="0.5" width="${size + 1}" height="${size + 1}" fill="none" stroke="#4b453c" stroke-width="1"/></svg>`);
        composites.push({ input: border, left: left - 1, top: top - 1 });
      }
      composites.push({ input: png, left, top });
    }
  }
  await mkdir(shots, { recursive: true });
  await sharp(Buffer.from(frameSvg)).composite(composites).png({ compressionLevel: 9 }).toFile(path.join(shots, 'app-icon.png'));
}

async function main() {
  const source = await readFile(svgFile, 'utf8');
  if (!source.includes('id="background"')) throw new Error('Master SVG is missing a background path');
  const motif = extractGroup(source, 'motif');
  const detail = extractGroup(source, 'gouges');
  const fullSvg = source;
  // Circle-safe Android adaptive artwork: the entire mark, including the bridge
  // corners, stays inside the central 66/108-dp safe zone at any mask shape.
  const adaptiveTransform = (content) => `<g transform="translate(256 256) scale(0.71) translate(-257 -285)">${content}</g>`;
  const fullForegroundSvg = svgWrap(motif + detail);
  const foregroundSvg = svgWrap(adaptiveTransform(motif + detail));
  const monochromeSvg = svgWrap(adaptiveTransform(motif.replace('fill="#e4dccb"', 'fill="#ffffff"')));

  // Keep vector derivatives available for designers and platform-specific tooling.
  await writeFile(path.join(outArt, 'app-icon-foreground.svg'), foregroundSvg + '\n');
  await writeFile(path.join(outArt, 'app-icon-monochrome.svg'), monochromeSvg + '\n');

  // Android adaptive layer (108 dp, sized for xxxhdpi, with transparent margins)
  // and Android 13+ themed monochrome layer (system paints the alpha mask).
  await savePng(foregroundSvg, 432, path.join(res, 'drawable-nodpi/marchia_launcher_foreground.png'));
  await savePng(monochromeSvg, 432, path.join(res, 'drawable-nodpi/marchia_launcher_monochrome.png'));
  await savePng(foregroundSvg, 432, path.join(res, 'drawable-nodpi/marchia_splash_icon.png'));

  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [density, size] of Object.entries(densities)) {
    const dir = path.join(res, `mipmap-${density}`);
    await savePng(fullSvg, size, path.join(dir, 'ic_launcher.png'));
    await saveRoundPng(fullSvg, size, path.join(dir, 'ic_launcher_round.png'));
    // Capacitor's original launcher foreground is no longer referenced.
    await rm(path.join(dir, 'ic_launcher_foreground.png'), { force: true });
  }
  await rm(path.join(res, 'drawable-v24/ic_launcher_foreground.xml'), { force: true });

  // Modern + classic iOS app icon slots. Explicit RGB (no alpha channel).
  const appIcons = iosIcons();
  const appIconDir = path.join(iosAssets, 'AppIcon.appiconset');
  for (const item of appIcons) {
    await savePng(fullSvg, item.px, path.join(appIconDir, item.filename), { opaque: true });
  }
  await writeJson(path.join(appIconDir, 'Contents.json'), {
    images: appIcons.map(({ px, ...metadata }) => metadata), info: { author: 'xcode', version: 1 },
  });

  // iOS system LaunchScreen: transparent emblem centered over a native Torf
  // background set in the storyboard (no gigantic 2732px stretched bitmap).
  const splashDir = path.join(iosAssets, 'Splash.imageset');
  const splash = [
    { idiom: 'universal', filename: 'splash-1x.png', scale: '1x', px: 240 },
    { idiom: 'universal', filename: 'splash-2x.png', scale: '2x', px: 480 },
    { idiom: 'universal', filename: 'splash-3x.png', scale: '3x', px: 720 },
  ];
  for (const item of splash) await savePng(fullForegroundSvg, item.px, path.join(splashDir, item.filename));
  await writeJson(path.join(splashDir, 'Contents.json'), {
    images: splash.map(({ px, ...metadata }) => metadata), info: { author: 'xcode', version: 1 },
  });
  for (const old of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    await rm(path.join(splashDir, old), { force: true });
  }
  // Drop original Capacitor splash PNGs, now unused by Theme.SplashScreen.
  await rm(path.join(res, 'drawable/splash.png'), { force: true });
  for (const orientation of ['port', 'land']) {
    for (const density of Object.keys(densities)) {
      await rm(path.join(res, `drawable-${orientation}-${density}/splash.png`), { force: true });
    }
  }

  await makeComparison(fullSvg);
  console.log(`MARCHIA icons: ${Object.keys(densities).length} Android densities, adaptive/themed, ${appIcons.length} iOS slots, splash and preview generated.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
