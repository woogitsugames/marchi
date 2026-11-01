#!/usr/bin/env node
/** Validate native icon outputs including 66/108 Android circular safe zone. */
import path from 'node:path';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const NATIVE=process.argv.includes('--native');
if (process.argv.slice(2).some(arg=>arg!=='--native'))throw new Error('Use --native only to check installed assets');
const outputPrefix=NATIVE?'':'art/out/';
const android=path.join(root,outputPrefix,'android/app/src/main/res');
const ios=path.join(root,outputPrefix,'ios/App/App/Assets.xcassets');
const errors=[];
const required=async(file)=>{try{await access(file);}catch{errors.push(`Missing ${path.relative(root,file)}`);}};
async function png(relative,size,{opaque=false,alpha=false}={}) {
  const file=path.join(root,relative);await required(file);
  try {
    const md=await sharp(file).metadata();
    if(md.width!==size||md.height!==size)errors.push(`${relative}: expected ${size}px, got ${md.width}x${md.height}`);
    if(opaque&&md.hasAlpha)errors.push(`${relative}: iOS app icon must not contain an alpha channel`);
    if(alpha&&!md.hasAlpha)errors.push(`${relative}: foreground missing alpha channel`);
    if(md.format!=='png')errors.push(`${relative}: not a PNG`);
  }catch(error){errors.push(`${relative}: ${error.message}`);}
}
for(const [dpi,px] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192}))
  for(const name of ['ic_launcher.png','ic_launcher_round.png'])await png(`${outputPrefix}android/app/src/main/res/mipmap-${dpi}/${name}`,px);
for(const name of ['marchia_launcher_foreground','marchia_launcher_monochrome','marchia_splash_icon'])
  await png(`${outputPrefix}android/app/src/main/res/drawable-nodpi/${name}.png`,432,{alpha:true});
if(NATIVE)for(const name of ['ic_launcher.xml','ic_launcher_round.xml'])
  await required(path.join(android,`mipmap-anydpi-v26/${name}`));
const appDir=path.join(ios,'AppIcon.appiconset');
const appList=JSON.parse(await readFile(path.join(appDir,'Contents.json'),'utf8')).images;
if(appList.length!==18)errors.push(`Expected 18 iOS app icons; got ${appList.length}`);
for(const img of appList) {
  const px=Number(img.size.split('x')[0])*Number(img.scale.replace('x',''));
  await png(`${outputPrefix}ios/App/App/Assets.xcassets/AppIcon.appiconset/${img.filename}`,px,{opaque:true});
}
const splashDir=path.join(ios,'Splash.imageset');
const splashes=JSON.parse(await readFile(path.join(splashDir,'Contents.json'),'utf8')).images;
for(const img of splashes)await png(`${outputPrefix}ios/App/App/Assets.xcassets/Splash.imageset/${img.filename}`,240*Number(img.scale.replace('x','')),{alpha:true});
for(const [file,w,h] of [['app-icon.png',1450,2020],['app-icon-variants.png',1550,980],['app-icon-v2-v3.png',1200,900]]){
  try{const md=await sharp(path.join(root,'docs/shots',file)).metadata();if(md.width!==w||md.height!==h)errors.push(`${file}: expected ${w}x${h}`);}catch{errors.push(`Missing sheet ${file}`);}
}
for(const name of ['app-icon.svg','app-icon-horse.svg','app-icon-wheel-seal.svg','app-icon-v2.svg','app-icon-foreground.svg','app-icon-monochrome.svg'])
  await required(path.join(root,'art',name));
const raw=await readFile(path.join(root,'art/app-icon.svg'),'utf8');
const chosen=await readFile(path.join(root,'art/app-icon-wheel-seal.svg'),'utf8');
if(raw!==chosen)errors.push('Master app-icon.svg differs from the selected wheel-seal variant');
if(!raw.includes('id="wax-monogram"'))errors.push('Missing Grenze Gotisch path monogram');
if(/<text\\b|font-family=/i.test(raw))errors.push('Master icon must have path outlines only, no runtime fonts');
for(const name of ['app-icon-foreground.svg','app-icon-monochrome.svg'])
  await required(path.join(root,'art/out',name));
const foreground=path.join(android,'drawable-nodpi/marchia_launcher_foreground.png');
const {data,info}=await sharp(foreground).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const safeRadius=info.width*33/108;
for(let y=0;y<info.height;y++){
  let escape=false;
  for(let x=0;x<info.width;x++){
    if(data[(y*info.width+x)*info.channels+3]<=32)continue;
    if(Math.hypot(x+0.5-info.width/2,y+0.5-info.height/2)>safeRadius+1){
      errors.push(`Android adaptive foreground outside safe circle at ${x},${y}`);escape=true;break;
    }
  }
  if(escape)break;
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`OK: ${NATIVE?'installed native':'staged art/out'} icons, Android safe zone, iOS slots, splash, v2/v3 previews.`);
