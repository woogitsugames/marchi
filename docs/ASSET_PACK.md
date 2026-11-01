# 4K texture pack (Ultra) — download, hosting, integration

Per D-17 the APK ships the 2K textures only; the 4096 px albedo + ORM files (`assets-ultra/`, ~59 MB,
18 KTX2 files, see D-20) are downloaded in game when the player picks **Ultra**. The renderer reads
them from whatever base URL is passed to `setUltraBase(url)` (`src/render/textures.ts`); without it,
Ultra falls back to the 2K files. Implementation decision: D-23.

## Code

| File | Role |
| --- | --- |
| `src/platform/assetPack.ts` | Manifest validation, download, SHA-256 check, resume, progress, cancel, delete, versioning. App API: `downloadUltraPack`, `ultraPackBase`, `deleteUltraPack`. No Capacitor / DOM imports. |
| `src/platform/assetPackStores.ts` | `PackStore` backends: native (`@capacitor/filesystem`), web (Cache Storage), memory (tests). Capacitor is imported lazily. |
| `src/platform/assetPackConfig.ts` | Base URL: `VITE_ASSET_PACK_BASE` override > Vite dev server > production placeholder. |
| `public/ultra-pack-sw.js` | Web only: tiny service worker serving `<app>/__ultra-pack/v<N>/…` from Cache Storage. |
| `tests/assetPack.test.ts` | Offline tests with a mocked `fetch` and `MemoryPackStore`. |

### How it works

1. `fetchManifest(base)` downloads `<base>manifest.json` and validates it (relative safe paths only,
   no `..` / absolute / scheme / backslash, non-negative integer sizes summing to `totalBytes`,
   64-char lower-case hex SHA-256, no duplicates, 1 GiB ceiling).
2. `installPack` downloads every file into **its own version folder** (`ultra-pack/v<N>/…` on
   native, cache `marchia-ultra-v<N>` on web). Each file is read fully into memory (2–4 MB),
   size-checked, hashed with `crypto.subtle`, and only then written. The state record
   (`{ pack, installed, pending: { version, completed[] } }`) is updated after every file.
3. **Resume:** files listed in `completed` are skipped; a file present in storage but not listed is
   re-hashed and kept if it matches. A failed / cancelled file restarts from byte 0 (no HTTP Range —
   files are small, and Range would need partial-file bookkeeping on two backends).
4. **Upgrade:** a newer manifest version is downloaded as `pending` next to the installed one. The
   old version stays active until every new file is verified; then `installed` flips and the old
   folder is removed. An abandoned pending version is removed when another version starts.
5. The returned base URL goes to `setUltraBase(url)`:
   - **native:** `Capacitor.convertFileSrc(<Directory.Data>/ultra-pack/v<N>)` →
     `https://localhost/_capacitor_file_/…/`, which the WebView serves to `fetch` / KTX2Loader;
   - **web:** `<app>/__ultra-pack/v<N>/` served from Cache Storage by `ultra-pack-sw.js`. The
     renderer fetches textures by URL, so per-file Object URLs cannot work with a single base. If no
     service worker can control the page (private mode, `file://`, first load timeout of 3 s), the
     store returns the **network base URL** instead: textures still load (browser HTTP cache), just
     not offline. Web is a dev / preview target; the real target is the native app.

Progress events: `{ bytesDone, totalBytes, filesDone, filesTotal, file }`, `bytesDone` never decreases
and ends at `totalBytes`. Errors are `AssetPackError` with `code` ∈ `manifest-invalid | http |
size-mismatch | hash-mismatch | aborted | storage` — the UI maps the code to an i18n string.

### Dev mode (local server)

The Vite dev server serves the repo root, so the pack is already reachable at
`http://<host>:5173/assets-ultra/` (KTX2 as `image/ktx2`, CORS allowed for `https://localhost`).

- **Browser:** `npm run dev`, open the game; in dev builds the base defaults to
  `<page origin>/assets-ultra/`.
- **Android device / emulator:** keep `npm run dev` running, forward the port and build the APK with
  an override:
  ```bash
  adb reverse tcp:5173 tcp:5173
  VITE_ASSET_PACK_BASE=http://localhost:5173/assets-ultra/ npm run apk
  ```
  `http://localhost` is used on purpose: the app page is `https://localhost`, and WebView blocks
  plain-HTTP LAN addresses as mixed content, while `localhost` counts as a secure origin.
- **Any other host:** `VITE_ASSET_PACK_BASE=https://…/ npm run build`.

**Native setup:** `@capacitor/filesystem` was added to `package.json`; run `npx cap sync` before the next
APK / iOS build so the native plugin is registered (not done in this change).

## Hosting options

Requirements: HTTPS, **CORS** (`Access-Control-Allow-Origin: https://localhost` for Android,
`capacitor://localhost` for iOS — the WebView `fetch` is a cross-origin request), stable URLs,
reasonable cache headers, cheap egress for 59 MB × every Ultra player.

| | GitHub Releases | Cloudflare R2 (+ custom domain) | Bunny CDN (Storage + Pull Zone) |
| --- | --- | --- | --- |
| CORS | **No** `Access-Control-Allow-Origin` on release assets (redirect to `objects.githubusercontent.com`) → WebView `fetch` fails unless routed through native HTTP (CapacitorHttp) | Per-bucket CORS rules | Per-zone CORS header option |
| Range requests | Yes | Yes | Yes |
| Cost | Free (fair use; no SLA, rate limits) | Storage ~$0.015/GB-month, **egress free**; 59 MB ≈ $0.001/month | ~$0.01/GB storage, ~$0.01/GB egress EU/NA (1000 downloads ≈ $0.60) |
| Cache headers | Not controllable | Set per object / via Cache Rules | Set per zone / edge rules |
| Custom domain | No | Yes (needs domain on Cloudflare DNS) | Yes |
| Effort | Lowest (upload in CI) | Low (bucket + CORS JSON + `rclone`/`wrangler` upload) | Low (UI or FTP/API upload) |

Recommended layout: one immutable folder per pack version, e.g.
`https://cdn.<domain>/marchia/ultra/v1/` holding `manifest.json` + `textures/…`;
`Cache-Control: public, max-age=31536000, immutable` on the KTX2 files and
`max-age=300` on `manifest.json`. `ASSET_PACK_PROD_BASE` (or `VITE_ASSET_PACK_BASE` in CI) points at
the version folder that matches the build, so a CDN never serves mixed versions; SHA-256 checks catch
any stale edge copy anyway (`hash-mismatch`, retried on the next attempt).

## Play Asset Delivery (alternative)

| | Own download (this module) | Play Asset Delivery (on-demand pack) |
| --- | --- | --- |
| Size limits | None of ours (CDN only) | Per asset pack 1.5 GB, all on-demand + fast-follow packs ≤ 4 GB (check current Play limits) |
| Distribution | Works with sideloaded debug APKs (D-17: debug APKs only for now) | Only via Play (AAB); locally only with `bundletool --local-testing` |
| Offline after install | Yes | Yes |
| iOS parity | Same code (Filesystem + `convertFileSrc`) | None — iOS needs On-Demand Resources / Background Assets separately |
| Effort with Capacitor | Done (TypeScript + one official plugin) | Custom native plugin (Kotlin `AssetPackManager`), Gradle asset-pack module, files read via native paths; no official Capacitor plugin |
| Updates | Any time (new version folder + manifest) | Tied to an app release on Play |
| Hosting cost | CDN egress (cents) | Free (Google) |
| Integrity | Our SHA-256 per file | Play-signed |

## Recommendation

Use the **own download** now (already works with debug APKs, identical on Android / iOS / web) and host
the pack on **Cloudflare R2** behind a custom domain with a CORS rule for `https://localhost` and
`capacitor://localhost` (free egress, cache control, Range). GitHub Releases is unusable from the
WebView without CORS. Re-evaluate Play Asset Delivery only if the game moves to Play-only
distribution and the pack grows far beyond ~100 MB.

## UI integration (paste)

```ts
import { AssetPackError, deleteUltraPack, downloadUltraPack, ultraPackBase } from '../platform/assetPack';
import { setUltraBase } from '../render/textures';

void ultraPackBase().then(setUltraBase); // at startup: installed pack or null (no network)
let download: AbortController | null = null;
async function chooseUltra(bar: HTMLProgressElement, onError: (code: string) => void): Promise<void> {
  download = new AbortController();
  try {
    setUltraBase(await downloadUltraPack({ signal: download.signal, onProgress: (p) => { bar.max = p.totalBytes; bar.value = p.bytesDone; } }));
    // then disposeTextures() + reload the scene textures at quality 'ultra'
  } catch (e) { if (!(e instanceof AssetPackError && e.code === 'aborted')) onError(e instanceof AssetPackError ? e.code : 'http'); }
}
const cancelUltra = (): void => download?.abort();
async function deleteUltra(): Promise<void> { await deleteUltraPack(); setUltraBase(null); }
```
