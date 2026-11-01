// Transport encoding for replay reports (clipboard text). Not part of the sim: the sim emits
// plain JSON (src/sim/replay.ts); this wraps it as "MR1." + base64url(deflate-raw(json)) when
// CompressionStream is available, otherwise passes plain JSON through.
// decodeReportText accepts either form and returns the JSON text (caller then runs parseReportText).

export const CODEC_PREFIX = 'MR1.';
/** Refuse to inflate beyond this (zip-bomb guard); matches REPORT_LIMITS.textBytes. */
export const MAX_DECODED_BYTES = 16 * 1024 * 1024;
const MAX_ENCODED_CHARS = 8 * 1024 * 1024;

export type DecodeResult = { ok: true; json: string } | { ok: false; error: string };

export function compressionAvailable(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

/** Encode report JSON for the clipboard. Falls back to the JSON itself when compression is missing. */
export async function encodeReportText(json: string): Promise<string> {
  if (!compressionAvailable()) return json;
  try {
    const input = new TextEncoder().encode(json);
    const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    return CODEC_PREFIX + toBase64Url(bytes);
  } catch {
    return json;
  }
}

/** Decode clipboard text (plain JSON or MR1.<base64url>) into JSON text. Never throws. */
export async function decodeReportText(text: string): Promise<DecodeResult> {
  const s = typeof text === 'string' ? text.trim() : '';
  if (s.startsWith('{')) {
    return s.length > MAX_DECODED_BYTES ? { ok: false, error: 'report too large' } : { ok: true, json: s };
  }
  if (!s.startsWith(CODEC_PREFIX)) return { ok: false, error: 'unrecognized report format' };
  if (s.length > MAX_ENCODED_CHARS) return { ok: false, error: 'report too large' };
  if (!compressionAvailable()) return { ok: false, error: 'decompression not available' };
  const bytes = fromBase64Url(s.slice(CODEC_PREFIX.length));
  if (!bytes) return { ok: false, error: 'invalid base64url' };
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_DECODED_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: 'report too large' };
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.byteLength; }
    return { ok: true, json: new TextDecoder('utf-8', { fatal: true }).decode(all) };
  } catch {
    return { ok: false, error: 'corrupt compressed data' };
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}
