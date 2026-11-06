// Usage: npx tsx tools/assets-audit.ts
// Literal path presence is an inventory check, not proof of rights or source accuracy.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const assets=join(root,'public/assets');
const document=readFileSync(join(root,'docs/ASSETS.md'),'utf8');
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);}
const all=files(assets).map(p=>relative(root,p).split(sep).join('/')).sort();
const missing=all.filter(path=>!document.includes('`'+path+'`'));
console.log(`Files: ${all.length}; missing exact path entries: ${missing.length}`);
for(const path of missing) console.log(path);
if(missing.length) process.exitCode=1;
