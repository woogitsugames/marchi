// Prebaked model catalogue (D-331): builds every model of `src/render/models/catalogue.ts` and writes the binary
// file the game decodes at startup instead of building them (`src/render/models/baked.ts`). Run by the Vite build
// (`vite.config.ts`, plugin `baked-models`); by hand:
//   npx tsx tools/bake-models.ts <out.bin>           write the file
//   npx tsx tools/bake-models.ts --check <file.bin>  exit 1 unless <file.bin> is what the current code bakes and it
//                                                   decodes and re-encodes to the same bytes
// Needs a fresh process (the model functions cache what they built), so the test runs it as a child.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeAllBaked, encodeBakedModels, installBakedModels, recordModels } from '../src/render/models/baked';
import { buildCatalogue } from '../src/render/models/catalogue';

const args = process.argv.slice(2);
const check = args[0] === '--check';
const file = check ? args[1] : args[0];
if (!file) { console.error('usage: tsx tools/bake-models.ts [--check] <file.bin>'); process.exit(2); }
const t0 = performance.now();
const models = recordModels(buildCatalogue);
const bytes = encodeBakedModels(models);
const ms = performance.now() - t0;
if (!check) {
  writeFileSync(file, bytes);
  console.log(`bake-models: ${models.size} models, ${bytes.length} bytes, ${ms.toFixed(0)} ms -> ${file}`);
} else {
  const disk = new Uint8Array(readFileSync(file));
  const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!same(disk, bytes)) { console.error(`bake-models: ${file} is stale (${disk.length} bytes on disk, ${bytes.length} from the code)`); process.exit(1); }
  installBakedModels(disk.buffer.slice(disk.byteOffset, disk.byteOffset + disk.byteLength));
  const again = encodeBakedModels(decodeAllBaked());
  if (!same(again, bytes)) { console.error('bake-models: decode + encode does not give the same bytes'); process.exit(1); }
  console.log(`bake-models: ${file} matches the code (${models.size} models, ${bytes.length} bytes)`);
}
