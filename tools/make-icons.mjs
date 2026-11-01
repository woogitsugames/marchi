#!/usr/bin/env node
/**
 * MARCHIA native icon pipeline: hand-drawn SVG -> Android/iOS launchers,
 * splash graphics, and repeatable legibility / circular-mask previews.
 * Usage: npm run icons (staging only) / npm run icons -- --install-native
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArt = path.join(ROOT, 'art');
const stageRoot = path.join(outArt, 'out');
// Safe by default: do not mutate android/ or ios/ unless explicitly requested.
const INSTALL_NATIVE = process.argv.includes('--install-native');
if (process.argv.slice(2).some(arg => arg !== '--install-native')) {
  throw new Error('Unknown icon option. Use --install-native only for an explicit native update.');
}
const targetRoot = INSTALL_NATIVE ? ROOT : stageRoot;
const res = path.join(targetRoot, 'android/app/src/main/res');
const iosAssets = path.join(targetRoot, 'ios/App/App/Assets.xcassets');
const shots = path.join(ROOT, 'docs/shots');
const TORF = '#2b2620';
const PARCHMENT = '#e4dccb';
const CLAY = '#8c4a2f';
const MASTER = path.join(outArt, 'app-icon.svg');
const VARIANTS = [
  { file: 'app-icon-horse.svg', title: 'A - HORSE + CARGO WAGON', sub: 'Side-profile horse, plank-sided cart, ochre pennant' },
  { file: 'app-icon-wheel-seal.svg', title: 'B - WHEEL + WAX SEAL', sub: 'Larger silhouette, single clay accent - CHOSEN' },
];

const svgWrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${body}</svg>`;

function extractGroup(xml, id) {
  // All authored source groups are flat; this keeps adaptive icons source-driven.
  const hit = xml.match(new RegExp(`<g\\s+id="${id}"[^>]*>[\\s\\S]*?<\\/g>`));
  if (!hit) throw new Error(`Missing group ${id}`);
  return hit[0];
}

function extractLayers(source) {
  return {
    motif: extractGroup(source, 'motif'),
    gouges: extractGroup(source, 'gouges'),
    accent: extractGroup(source, 'accent'),
    accentGouges: extractGroup(source, 'accent-gouges'),
  };
}

function foreground(layers, themed = false) {
  if (themed) {
    // Android's themed mode paints the alpha mask: never paint dark gouges,
    // which would otherwise be treated as foreground rather than cutouts.
    return svgWrap(layers.motif.replace('fill="'+PARCHMENT+'"','fill="#ffffff"') +
      layers.accent.replace(/fill="#[0-9a-fA-F]{6}"/, 'fill="#ffffff"'));
  }
  return svgWrap(layers.motif + layers.gouges + layers.accent + layers.accentGouges);
}

async function safeTransform(layers) {
  // Android guarantees an uncropped circle of 66dp in a 108dp adaptive layer.
  // Calculate the scale from actual non-transparent pixels, instead of assuming
  // a fixed bounding box that a later artistic edit might exceed.
  const unscaled = foreground(layers);
  const { data, info } = await sharp(Buffer.from(unscaled)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y*info.width + x)*info.channels+3] < 64) continue;
    xmin=Math.min(xmin,x); xmax=Math.max(xmax,x); ymin=Math.min(ymin,y); ymax=Math.max(ymax,y);
  }
  if (!Number.isFinite(xmin)) throw new Error('Empty icon foreground');
  const cx=(xmin+xmax)/2, cy=(ymin+ymax)/2;
  let farthest=0;
  for (let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
    if (data[(y*info.width+x)*info.channels+3]<64) continue;
    farthest=Math.max(farthest,Math.hypot(x-cx,y-cy));
  }
  // 512 * 33 / 108 = 156.44. Reserve 4 pixels for resampling/edge AA.
  const scale=Math.min(1,(512*33/108-5)/farthest);
  return { transform:`translate(256 256) scale(${scale.toFixed(6)}) translate(${-cx.toFixed(3)} ${-cy.toFixed(3)})`, scale, bbox:[xmin,ymin,xmax,ymax] };
}

async function savePng(svg, size, target, { opaque=false }={}) {
  await mkdir(path.dirname(target), {recursive:true});
  const instance=sharp(Buffer.from(svg),{density:96}).resize(size,size,{fit:'fill',kernel:sharp.kernel.lanczos3});
  if(opaque) instance.flatten({background:TORF}).removeAlpha();
  await instance.png({compressionLevel:9}).toFile(target);
}

async function saveRoundPng(svg, size, target) {
  const square=await sharp(Buffer.from(svg)).resize(size,size).ensureAlpha().toBuffer();
  const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`);
  await mkdir(path.dirname(target),{recursive:true});
  await sharp(square).composite([{input:mask,blend:'dest-in'}]).png({compressionLevel:9}).toFile(target);
}

async function writeJson(file,value) {
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,JSON.stringify(value,null,2)+'\n','utf8');
}

function iosIcons() {
  const combos={
    iphone:{'20':[2,3],'29':[2,3],'40':[2,3],'60':[2,3]},
    ipad:{'20':[1,2],'29':[1,2],'40':[1,2],'76':[1,2],'83.5':[2]},
  };
  const images=[];
  for(const [idiom,set] of Object.entries(combos)) for(const [pt,scales] of Object.entries(set)) for(const scale of scales) {
    images.push({idiom,size:`${pt}x${pt}`,scale:`${scale}x`,filename:`icon-${idiom}-${pt}@${scale}x.png`,px:Number(pt)*scale});
  }
  images.push({idiom:'ios-marketing',size:'1024x1024',scale:'1x',filename:'AppIcon-512@2x.png',px:1024});
  return images;
}

function escaped(value){return value.replaceAll('&','&amp;').replaceAll('<','&lt;');}

async function sheet({file,width,height,title,rows,columns,headHeight=120,sectionHeight=620}) {
  const back=rows.map((row,ri)=>`<rect x="0" y="${headHeight+ri*sectionHeight}" width="${width}" height="${sectionHeight}" fill="${row.bg}"/>`).join('');
  const texts=rows.map((row,ri)=>{
    const y=headHeight+ri*sectionHeight;
    const fg=row.fg;
    return `<text x="48" y="${y+46}" font-family="sans-serif" fill="${fg}" font-size="27" font-weight="700">${escaped(row.label)}</text>`+
      `<path d="M48 ${y+65}H${width-48}" fill="none" stroke="${CLAY}" stroke-width="2"/>`+
      columns.map((c,j)=>`<text x="${c.x}" y="${y+sectionHeight-34}" font-family="sans-serif" text-anchor="middle" fill="${fg}" font-size="22">${escaped(c.label)}</text>`).join('');
  }).join('');
  const frame=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="${TORF}"/>
    <text x="48" y="74" font-family="sans-serif" font-size="36" font-weight="700" fill="${PARCHMENT}">${escaped(title)}</text>
    ${back}${texts}</svg>`;
  const overlays=[];
  for(let ri=0;ri<rows.length;ri++) for(const c of columns) {
    const png=await rows[ri].paint(c.size,c.kind);
    const cy=headHeight+ri*sectionHeight + Math.round((sectionHeight-30)/2);
    overlays.push({input:png,left:Math.round(c.x-c.size/2),top:Math.round(cy-c.size/2)});
  }
  await mkdir(shots,{recursive:true});
  await sharp(Buffer.from(frame)).composite(overlays).png({compressionLevel:9}).toFile(path.join(shots,file));
}

async function roundForPreview(source,layers,size) {
  // Simulate the launcher: foreground with a real Android-size safe transform
  // on Torf, then apply the circular launcher mask.
  const {transform}=await safeTransform(layers);
  const fg=svgWrap(`<g transform="${transform}">${layers.motif+layers.gouges+layers.accent+layers.accentGouges}</g>`);
  const layer=await sharp(Buffer.from(fg)).resize(size,size).png().toBuffer();
  const base=await sharp({create:{width:size,height:size,channels:4,background:TORF}}).png().toBuffer();
  const assembled=await sharp(base).composite([{input:layer}]).png().toBuffer();
  const mask=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff"/></svg>`);
  return sharp(assembled).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
}

async function makePreview(master,layers) {
  const columns=[
    {x:134,size:48,label:'48 x 48 px'},
    {x:365,size:96,label:'96 x 96 px'},
    {x:680,size:192,label:'192 x 192 px'},
    {x:1130,size:512,label:'512 x 512 px'},
  ];
  const paint=async(size)=>sharp(Buffer.from(master)).resize(size,size).png().toBuffer();
  const rows=[
    {label:'LIGHT BACKGROUND  /  NATURAL SIZE',bg:PARCHMENT,fg:TORF,paint},
    {label:'DARK BACKGROUND  /  NATURAL SIZE',bg:'#181511',fg:PARCHMENT,paint},
    {label:'ANDROID ADAPTIVE  /  CIRCULAR MASK + 66/108 SAFE ZONE',bg:'#d2cabb',fg:TORF,
      paint:async(size)=>roundForPreview(master,layers,size)},
  ];
  await sheet({file:'app-icon.png',width:1450,height:2020,title:'MARCHIA  /  APP ICON v3  /  WHEEL + SEAL',rows,columns,sectionHeight:630,headHeight:130});
}

async function makeVariants() {
  const definitions=[];
  for(const variant of VARIANTS) {
    const raw=await readFile(path.join(outArt,variant.file),'utf8');
    definitions.push({...variant,raw,layers:extractLayers(raw)});
  }
  const width=1550,height=980;
  const labels=[{x:120,size:48,label:'48 px'},{x:340,size:96,label:'96 px'},{x:655,size:192,label:'192 px'},
    {x:1030,size:192,label:'Android circle'},{x:1355,size:192,label:'192 px - light'}];
  const tiles=[];
  for(let vi=0;vi<definitions.length;vi++) {
    const entry=definitions[vi];
    const y=210+vi*365;
    for(let j=0;j<labels.length;j++) {
      const col=labels[j];
      let png;
      if(j===3)png=await roundForPreview(entry.raw,entry.layers,col.size);
      else png=await sharp(Buffer.from(entry.raw)).resize(col.size,col.size).png().toBuffer();
      tiles.push({input:png,left:Math.round(col.x-col.size/2),top:Math.round(y-col.size/2)});
    }
  }
  const bg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#e4dccb"/>
    <rect x="0" y="85" width="${width}" height="390" fill="#2b2620"/>
    <rect x="0" y="475" width="${width}" height="365" fill="#181511"/>
    <rect x="1200" y="85" width="330" height="755" fill="#c9c6bb"/>
    <text x="40" y="51" font-family="sans-serif" font-weight="700" font-size="33" fill="#2b2620">MARCHIA / APP ICON v3 - VARIANT COMPARISON</text>
    ${definitions.map((v,i)=>{
      const yy=i===0?118:509;
      return `<text x="40" y="${yy}" fill="#e4dccb" font-family="sans-serif" font-size="23" font-weight="700">${v.title}</text>`+
        `<text x="40" y="${yy+300}" fill="#e4dccb" font-family="sans-serif" font-size="19">${v.sub}</text>`;
    }).join('')}
    ${labels.map(v=>`<text x="${v.x}" y="875" font-family="sans-serif" font-size="19" text-anchor="middle" fill="#2b2620">${v.label}</text>`).join('')}
    <text x="50" y="944" font-family="sans-serif" font-size="22" fill="#8c4a2f" font-weight="700">SELECTED: B / WHEEL + WAX SEAL  -  fewer small details, stronger 48 px silhouette</text>
  </svg>`;
  await sharp(Buffer.from(bg)).composite(tiles).png({compressionLevel:9}).toFile(path.join(shots,'app-icon-variants.png'));
}


/**
 * A source-driven comparison: the v2 baseline is checked in and both rows
 * are re-rendered at real 48/96/192 px plus the Android circular safe zone.
 */
async function makeVersionComparison(v2, v3) {
  const width = 1200, height = 900;
  const positions = [
    { x: 175, size: 48, label: '48 px - native size' },
    { x: 415, size: 96, label: '96 px' },
    { x: 690, size: 192, label: '192 px' },
    { x: 1020, size: 192, label: 'Android circular mask' },
  ];
  const sources = [
    { name: 'v2 - geometric M / clean wheel', svg: v2, y: 285 },
    { name: 'v3 - Grenze Gotisch / woodcut hatching / wax rim', svg: v3, y: 690 },
  ];
  const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#e4dccb"/>
    <rect x="0" y="0" width="${width}" height="90" fill="#2b2620"/>
    <text x="36" y="58" font-family="sans-serif" font-size="34" font-weight="700"
          fill="#e4dccb">MARCHIA / APP ICON / V2 VERSUS V3</text>
    <rect x="20" y="125" width="1160" height="335" rx="8" fill="#d2cabb"/>
    <rect x="20" y="530" width="1160" height="335" rx="8" fill="#d2cabb"/>
    ${sources.map(row => `<text x="40" y="${row.y-115}" font-family="sans-serif"
       font-size="24" font-weight="700" fill="#2b2620">${escaped(row.name)}</text>`).join('')}
    ${sources.map(row => positions.map(pos => `<text x="${pos.x}" y="${row.y+151}"
       font-family="sans-serif" font-size="19" text-anchor="middle" fill="#2b2620">${pos.label}</text>`).join('')).join('')}
  </svg>`;
  const overlays = [];
  for (const row of sources) {
    const layers = extractLayers(row.svg);
    for (let col = 0; col < positions.length; col++) {
      const pos = positions[col];
      const img = col === 3
        ? await roundForPreview(row.svg, layers, pos.size)
        : await sharp(Buffer.from(row.svg)).resize(pos.size, pos.size).png().toBuffer();
      overlays.push({
        input: img,
        left: Math.round(pos.x - pos.size / 2),
        top: Math.round(row.y - pos.size / 2),
      });
    }
  }
  await mkdir(shots, { recursive: true });
  await sharp(Buffer.from(frame)).composite(overlays).png({ compressionLevel: 9 })
    .toFile(path.join(shots, 'app-icon-v2-v3.png'));
}

async function main() {
  const source=await readFile(MASTER,'utf8');
  if(!source.includes('id="background"'))throw new Error('Missing background');
  const layers=extractLayers(source);
  const fit=await safeTransform(layers);
  const wrapped=(body)=>svgWrap(`<g transform="${fit.transform}">${body}</g>`);
  const fg=wrapped(layers.motif+layers.gouges+layers.accent+layers.accentGouges);
  const mono=wrapped(layers.motif.replace('fill="'+PARCHMENT+'"','fill="#ffffff"')+
    layers.accent.replace(/fill="#[0-9a-fA-F]{6}"/,'fill="#ffffff"'));
  const fullSplash=foreground(layers);
  await mkdir(outArt,{recursive:true});
  await writeFile(path.join(outArt,'app-icon-foreground.svg'),fg+'\n');
  await writeFile(path.join(outArt,'app-icon-monochrome.svg'),mono+'\n');
  // Keep the staging directory self-contained for handoff to a native agent.
  await mkdir(stageRoot, {recursive:true});
  await writeFile(path.join(stageRoot,'app-icon-foreground.svg'),fg+'\n');
  await writeFile(path.join(stageRoot,'app-icon-monochrome.svg'),mono+'\n');
  for(const name of ['marchia_launcher_foreground','marchia_splash_icon'])
    await savePng(fg,432,path.join(res,'drawable-nodpi',name+'.png'));
  await savePng(mono,432,path.join(res,'drawable-nodpi/marchia_launcher_monochrome.png'));
  const dpi={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
  for(const [name,size] of Object.entries(dpi)) {
    const dir=path.join(res,`mipmap-${name}`);
    await savePng(source,size,path.join(dir,'ic_launcher.png'));
    await saveRoundPng(source,size,path.join(dir,'ic_launcher_round.png'));
    await rm(path.join(dir,'ic_launcher_foreground.png'),{force:true});
  }
  await rm(path.join(res,'drawable-v24/ic_launcher_foreground.xml'),{force:true});
  const appDir=path.join(iosAssets,'AppIcon.appiconset');
  const appIcons=iosIcons();
  for(const icon of appIcons)await savePng(source,icon.px,path.join(appDir,icon.filename),{opaque:true});
  await writeJson(path.join(appDir,'Contents.json'),{images:appIcons.map(({px,...meta})=>meta),info:{author:'xcode',version:1}});
  const splashDir=path.join(iosAssets,'Splash.imageset');
  const splash=[{idiom:'universal',filename:'splash-1x.png',scale:'1x',px:240},
    {idiom:'universal',filename:'splash-2x.png',scale:'2x',px:480},
    {idiom:'universal',filename:'splash-3x.png',scale:'3x',px:720}];
  for(const item of splash)await savePng(fullSplash,item.px,path.join(splashDir,item.filename));
  await writeJson(path.join(splashDir,'Contents.json'),{images:splash.map(({px,...meta})=>meta),info:{author:'xcode',version:1}});
  for(const old of ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png'])
    await rm(path.join(splashDir,old),{force:true});
  await rm(path.join(res,'drawable/splash.png'),{force:true});
  for(const orientation of ['port','land'])for(const density of Object.keys(dpi))
    await rm(path.join(res,`drawable-${orientation}-${density}/splash.png`),{force:true});
  await makePreview(source,layers);
  await makeVariants();
  await makeVersionComparison(await readFile(path.join(outArt,'app-icon-v2.svg'),'utf8'), source);
  console.log(`MARCHIA icons (${INSTALL_NATIVE ? 'native install' : 'staged in art/out'}): ${Object.keys(dpi).length} Android densities, adaptive/themed, ${appIcons.length} iOS slots, splash, 3 preview sheets; safe scale ${fit.scale.toFixed(3)}.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
