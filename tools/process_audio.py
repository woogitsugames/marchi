#!/usr/bin/env python3
"""Rebuild MARCHIA's verified CC0 field-recording audio using FFmpeg.

Usage:
  python3 tools/process_audio.py --fetch
  python3 tools/process_audio.py --source-dir /path/to/CC0/source/files
  python3 tools/process_audio.py --check

Leaves unverified synthetic SFX unchanged. Python 3.10+, ffmpeg, ffprobe only.
"""
from __future__ import annotations

import argparse
from array import array
import hashlib
import json
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
MANIFEST = BASE / "tools/audio_sources.json"
OUT = BASE / "public/assets/audio"
PROVENANCE = BASE / "docs/audio-provenance.json"
FREESOUND_SOURCES = BASE / "tools/audio-src"
MAX_BYTES = 4 * 1024 * 1024



class FreesoundPage(HTMLParser):
    """Read the CC0 licence and public audio metadata from a sound page."""

    def __init__(self) -> None:
        super().__init__()
        self.preview: str | None = None
        self.cc0_link = False
        self.cc0_label = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "meta" and (
            values.get("property") == "og:audio"
            or values.get("name") == "twitter:player:stream"
        ):
            self.preview = values.get("content") or self.preview
        if tag == "a" and "creativecommons.org/publicdomain/zero/1.0" in (
            values.get("href") or ""
        ):
            self.cc0_link = True

    def handle_data(self, data: str) -> None:
        if "Creative Commons 0" in data:
            self.cc0_label = True


def freesound_preview(source: dict) -> str:
    """Discover the official HQ OGG preview (original files require OAuth).

    All files must be CC0, verified on their individual page. The downloaded
    audio is Freesound's lossy preview, not the original lossless recording.
    """
    page = source["page"]
    sid = source["sound_id"]
    parsed = urlsplit(page)
    if parsed.scheme != "https" or parsed.netloc != "freesound.org":
        raise ValueError(f"Invalid Freesound sound page: {page}")
    if not re.fullmatch(rf"/people/[^/]+/sounds/{sid}/", parsed.path):
        raise ValueError(f"Freesound page/ID mismatch: {page}")
    if source["author"].lower() != parsed.path.split("/")[2].lower():
        raise ValueError(f"Freesound author/page mismatch: {page}")
    request = urllib.request.Request(
        page, headers={"User-Agent": "Mozilla/5.0 (MARCHIA CC0 asset review)"}
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        if urlsplit(response.url).netloc != "freesound.org":
            raise ValueError("Unexpected Freesound page redirect")
        html = response.read(2_000_001)
        if len(html) > 2_000_000:
            raise ValueError("Freesound page exceeded size limit")
    reader = FreesoundPage()
    reader.feed(html.decode("utf-8", errors="replace"))
    if not (reader.cc0_link and reader.cc0_label):
        raise ValueError(f"CC0 not independently confirmed on {page}")
    if not reader.preview or not reader.preview.endswith("-lq.mp3"):
        raise ValueError(f"No public Freesound preview found on {page}")
    p = urlsplit(reader.preview)
    if (p.scheme != "https" or p.netloc != "cdn.freesound.org"
            or p.query or p.fragment or not re.fullmatch(
                rf"/previews/\d+/{sid}_[^/]+-lq\.mp3", p.path
            )):
        raise ValueError(f"Untrusted Freesound preview URL: {reader.preview}")
    return reader.preview[:-7] + "-hq.ogg"


def fetch_freesound(source: dict, dest: Path) -> str:
    url = freesound_preview(source)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".part")
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "MARCHIA-audio-assets/2.0 (CC0)"}
        )
        with urllib.request.urlopen(req, timeout=90) as response, tmp.open("wb") as fh:
            landed = urlsplit(response.url)
            if landed.scheme != "https" or landed.netloc != "cdn.freesound.org":
                raise ValueError(f"Untrusted Freesound CDN redirect: {response.url}")
            total = 0
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > 40 * 1024 * 1024:
                    raise ValueError("Freesound preview exceeded 40 MiB")
                fh.write(chunk)
        if total < 1000:
            raise ValueError(f"Preview looks empty: {url}")
        tmp.replace(dest)
    finally:
        tmp.unlink(missing_ok=True)
    return url


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_manifest(manifest: dict) -> None:
    # pending_tracks: selected but not yet rendered (task 46); validated, not shipped or checked.
    pending = manifest.get("pending_tracks", [])
    ids = [t["id"] for t in manifest["tracks"] + pending]
    retained = manifest.get("synthetic_retained", [])
    if len(ids) + len(retained) != len(set(ids + retained)):
        raise ValueError("Duplicate audio asset ID in manifest")
    if any(not re.fullmatch(r"(?:ambient|sfx|ui)/[a-z0-9][a-z0-9-]*", sid)
           for sid in ids + retained):
        raise ValueError("Invalid audio asset ID/path in manifest")
    for track in manifest["tracks"] + pending:
        if track["kind"] not in ("ambient", "sfx"):
            raise ValueError(f"Invalid kind for {track['id']}")
        if track["source"] not in manifest["sources"]:
            raise ValueError(f"Missing source for {track['id']}")
        if track["seconds"] <= 0 or track.get("start", 0) < 0:
            raise ValueError(f"Invalid timing for {track['id']}")
        if "loop_crossfade" in track and not (
            0 < track["loop_crossfade"] < track["seconds"] / 2
        ):
            raise ValueError(f"Invalid crossfade for {track['id']}")
    for key, source in manifest["sources"].items():
        if source["license"] != "CC0-1.0":
            raise ValueError(f"Non-CC0 audio source: {key}")
        if source.get("provider") == "freesound":
            sid = source["sound_id"]
            if not isinstance(sid, int) or sid <= 0:
                raise ValueError(f"Invalid Freesound ID: {key}")
            if source.get("preview") != "ogg-hq":
                raise ValueError(f"Unsupported Freesound preview quality: {key}")
            if source["filename"] != f"{sid}-hq.ogg":
                raise ValueError(f"Unexpected Freesound filename: {key}")
        elif source.get("provider", "opengameart") != "opengameart":
            raise ValueError(f"Unsupported provider: {key}")


def run(cmd: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        cmd, check=True, text=True,
        stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
        stderr=subprocess.PIPE if capture else None,
    )
    return result.stdout if capture else ""


def ffprobe(path: Path) -> dict:
    data = json.loads(run([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_name,channels:format=duration", "-of", "json", str(path)
    ], capture=True))
    tracks = [s for s in data.get("streams", []) if "channels" in s]
    if not tracks:
        raise ValueError(f"No audio stream: {path}")
    return {
        "duration": float(data["format"]["duration"]),
        "channels": tracks[0]["channels"],
        "codec": tracks[0].get("codec_name", "unknown"),
    }


def fetch(url: str, dest: Path) -> None:
    if not url.startswith("https://opengameart.org/sites/default/files/"):
        raise ValueError(f"Unapproved source URL: {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_size > 1000:
        return
    tmp = dest.with_name(dest.name + ".part")
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "MARCHIA-audio-assets/1.0 (CC0 research)"}
            )
            with urllib.request.urlopen(req, timeout=90) as response, tmp.open("wb") as fh:
                if not response.url.startswith("https://"):
                    raise ValueError("Source redirected to HTTP")
                size = 0
                while block := response.read(1024 * 1024):
                    size += len(block)
                    if size > 150 * 1024 * 1024:
                        raise ValueError("Source exceeded safe download size")
                    fh.write(block)
            if size < 1000:
                raise ValueError("Source download looks empty")
            tmp.replace(dest)
            return
        except Exception:
            tmp.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def source_checksums(
    manifest: dict, source_dir: Path, fetch_missing: bool, tracks: list[dict]
) -> dict[str, dict]:
    records = {}
    used = {t["source"] for t in tracks}
    used |= {e["source"] for t in tracks for e in t.get("extra", [])}
    for key in sorted(used):
        source = manifest["sources"][key]
        provider = source.get("provider", "opengameart")
        # Version Freesound source previews alongside shipped audio in the PR.
        folder = FREESOUND_SOURCES if provider == "freesound" and (
            source_dir == BASE / ".cache/audio-sources"
        ) else source_dir
        file = folder / source["filename"]
        resolved = source.get("url")
        if not file.exists():
            if not fetch_missing:
                raise FileNotFoundError(
                    f"Missing CC0 source {file}; pass --fetch or supply the file"
                )
            print(f"Downloading CC0 sound {key}: {source['page']}", flush=True)
            if provider == "freesound":
                resolved = fetch_freesound(source, file)
            else:
                fetch(source["url"], file)
        probe = ffprobe(file)
        digest = sha256(file)
        if source.get("sha256") and digest != source["sha256"]:
            raise ValueError(f"Source hash mismatch for {key}: {file}")
        records[key] = {
            "file": file, "sha256": digest, "download_url": resolved, **probe
        }
        print(
            f"Source {key}: {file.stat().st_size:,} B, {probe['duration']:.1f} s",
            flush=True,
        )
    return records

def field_loop(track: dict, src: Path, extras: list[tuple[dict, Path]], output: Path) -> None:
    seconds = float(track["seconds"])
    cross = float(track["loop_crossfade"])
    start = float(track.get("start", 0))
    # Output starts at source t=start+cross. The crossfaded tail returns
    # to that same source position, avoiding a click at the buffer loop point.
    filters = [
        "[0:a]aresample=24000,aformat=channel_layouts=stereo,asplit=2[basesrc][headsrc]",
        f"[basesrc]atrim=start={start + cross}:duration={seconds},asetpts=PTS-STARTPTS,"
        f"afade=t=out:st={seconds - cross}:d={cross}[body]",
        f"[headsrc]atrim=start={start}:duration={cross},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d={cross},adelay={round((seconds - cross) * 1000)}:all=1[head]",
        "[body][head]amix=inputs=2:duration=longest:normalize=0[loop]",
    ]
    inputs = ["-i", str(src)]
    current = "loop"
    for ix, (layer, path) in enumerate(extras, start=1):
        inputs += ["-i", str(path)]
        delay = round(float(layer["at"]) * 1000)
        gain = float(layer["gain"])
        filters.append(
            f"[{ix}:a]aresample=24000,aformat=channel_layouts=stereo,"
            f"highpass=f=130,lowpass=f=1600,volume={gain},"
            f"adelay={delay}:all=1[layer{ix}]"
        )
        filters.append(
            f"[{current}][layer{ix}]amix=inputs=2:duration=first:normalize=0[mix{ix}]"
        )
        current = f"mix{ix}"
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
        "-filter_complex", ";".join(filters), "-map", f"[{current}]",
        "-t", str(seconds), "-ar", "24000", "-ac", "2", "-c:a", "pcm_f32le",
        str(output),
    ])


def loudest_window_index(
    samples: array, window: int, step: int = 400, margin: int = 160
) -> int:
    """Return the loudest excerpt, leaving a short fade margin at either end."""
    if window <= 0 or step <= 0 or window > len(samples):
        raise ValueError("Invalid recording/window length")
    margin = min(margin, window // 5)
    prefix = [0.0]
    for sample in samples:
        prefix.append(prefix[-1] + sample * sample)
    last = len(samples) - window
    candidates = range(0, last + 1, step)
    best_start, best_energy = 0, -1.0
    for start in candidates:
        energy = prefix[start + window - margin] - prefix[start + margin]
        if energy > best_energy:
            best_start, best_energy = start, energy
    # Do not discard a particularly good sound near the very end of the file.
    if last % step:
        energy = prefix[last + window - margin] - prefix[last + margin]
        if energy > best_energy:
            best_start, best_energy = last, energy
    if best_energy < 1e-8:
        raise ValueError("Recording is silent in the requested duration")
    return best_start


def loudest_excerpt_start(src: Path, seconds: float) -> float:
    rate = 8000
    decoded = subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(src),
        "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "pipe:1",
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    samples = array("f")
    samples.frombytes(decoded.stdout)
    if sys.byteorder != "little":
        samples.byteswap()
    pos = loudest_window_index(
        samples, round(seconds * rate), step=400, margin=800
    )
    start = pos / rate
    print(f"Auto-selected strongest {seconds:.2f}-s excerpt at "
          f"{start:.3f}s from {src.name}", flush=True)
    return start


def shot(track: dict, src: Path, output: Path) -> None:
    seconds = float(track["seconds"])
    start = (loudest_excerpt_start(src, seconds) if track.get("auto_peak")
             else float(track.get("start", 0)))
    fade_out = max(.1, seconds - .12)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
        "-af", f"atrim=start={start}:duration={seconds},asetpts=PTS-STARTPTS,"
               f"highpass=f=70,lowpass=f=5500,afade=t=in:st=0:d=0.008,"
               f"afade=t=out:st={fade_out}:d=0.12",
        "-ar", "24000", "-ac", "1", "-c:a", "pcm_f32le", str(output)
    ])


def loudnorm_filter(path: Path) -> str:
    # Two-pass EBU R128 instead of an unpredictable one-pass gain.
    proc = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "loudnorm=I=-24:TP=-6:LRA=8:print_format=json",
        "-f", "null", "-"
    ], text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    blobs = re.findall(r'\{\s*"input_i".*?\}', proc.stderr, re.DOTALL)
    if not blobs:
        raise ValueError(f"Cannot measure loudness of {path}")
    m = json.loads(blobs[-1])
    values = [m[k] for k in (
        "input_i", "input_tp", "input_lra", "input_thresh", "target_offset"
    )]
    if any(v in ("inf", "-inf", "nan", "-nan") for v in values):
        raise ValueError(f"Invalid LUFS measurement {m}")
    # loudnorm silently falls back to *dynamic* gain when the linear offset
    # would push the true peak over -6 dBTP. A drifting gain breaks a loop:
    # ambient/evening drifted 26.6 -> 23.9 dB over 30 s, a step at the seam.
    # Keep a constant gain and let a peak limiter catch the few overs instead.
    gain = -24.0 - float(values[0])
    if float(values[1]) + gain > -6.0:
        if abs(gain) > 40:
            raise ValueError(f"Unacceptable loudness correction {gain} dB: {path}")
        return (
            f"volume={gain:.3f}dB,alimiter=limit=0.5012:level=false,"
            "aresample=24000"
        )
    return (
        "loudnorm=I=-24:TP=-6:LRA=8:"
        f"measured_I={values[0]}:measured_TP={values[1]}:"
        f"measured_LRA={values[2]}:measured_thresh={values[3]}:"
        f"offset={values[4]}:linear=true,aresample=24000"
    )


def peak_filter(path: Path) -> str:
    proc = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(path),
        "-af", "volumedetect", "-f", "null", "-"
    ], text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    matches = re.findall(r"max_volume:\s*([-\d.]+) dB", proc.stderr)
    if not matches:
        raise ValueError(f"Cannot measure peak of {path}")
    gain = -6.0 - float(matches[-1])
    if abs(gain) > 40:
        raise ValueError(f"Unacceptable peak correction {gain} dB: {path}")
    return f"volume={gain:.3f}dB,alimiter=limit=0.5012:level=false"


def encode(raw: Path, track: dict, staged: Path) -> None:
    staged.parent.mkdir(parents=True, exist_ok=True)
    channels = 2 if track["kind"] == "ambient" else 1
    af = loudnorm_filter(raw) if channels == 2 else peak_filter(raw)
    for ext, codec, rate in (
        ("ogg", "libvorbis", "40k" if channels == 2 else "28k"),
        ("m4a", "aac", "36k" if channels == 2 else "28k")
    ):
        file = staged.with_suffix("." + ext)
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(raw),
            "-af", af, "-ar", "24000", "-ac", str(channels),
            "-c:a", codec, "-b:a", rate, str(file)
        ])
        meta = ffprobe(file)
        if meta["channels"] != channels or abs(meta["duration"] - track["seconds"]) > .2:
            raise ValueError(f"Wrong audio properties: {file}: {meta}")


def budget_and_channels(
    output_root: Path, tracks: list[dict] | None = None,
    retained: list[str] | None = None
) -> int:
    outputs = list(output_root.rglob("*.ogg")) + list(output_root.rglob("*.m4a"))
    total = sum(p.stat().st_size for p in outputs)
    if total >= MAX_BYTES:
        raise ValueError(f"Audio budget exceeded: {total} >= {MAX_BYTES}")
    if tracks is not None and retained is not None:
        declared = {t["id"] for t in tracks} | set(retained)
        expected = {f"{stem}.{ext}" for stem in declared for ext in ("ogg", "m4a")}
        actual = {p.relative_to(output_root).as_posix() for p in outputs}
        if actual != expected:
            missing = sorted(expected - actual)
            unexpected = sorted(actual - expected)
            raise ValueError(
                f"Audio catalogue mismatch: missing={missing}, unexpected={unexpected}"
            )
    elif len(outputs) != 46:
        raise ValueError(f"Expected 46 codec assets (23 sounds), found {len(outputs)}")
    for stem in {p.with_suffix("") for p in outputs}:
        ogg, m4a = stem.with_suffix(".ogg"), stem.with_suffix(".m4a")
        if not (ogg.is_file() and m4a.is_file()):
            raise ValueError(f"Missing OGG/M4A pair for {stem}")
        for file in (ogg, m4a):
            meta = ffprobe(file)
            expected = 2 if "ambient" in file.parts else 1
            if meta["channels"] != expected:
                raise ValueError(f"Expected {expected} channels: {file}")
    if tracks:
        for track in tracks:
            for ext in ("ogg", "m4a"):
                file = output_root / f"{track['id']}.{ext}"
                meta = ffprobe(file)
                if abs(meta["duration"] - track["seconds"]) > .2:
                    raise ValueError(f"Unexpected length: {file}: {meta}")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true",
                        help="Download missing verified CC0 original recordings")
    parser.add_argument("--check", action="store_true",
                        help="Validate OGG/M4A assets, source hashes and budget")
    parser.add_argument("--only-freesound", action="store_true",
                        help="Render only Freesound SFX; keep shipped ambience")
    parser.add_argument("--track-id", action="append", default=[],
                        help="Render only a named shipped track (repeatable); useful for task 50")
    parser.add_argument("--source-dir", type=Path,
                        default=BASE / ".cache/audio-sources")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    validate_manifest(manifest)
    if args.track_id and args.only_freesound:
        parser.error("--track-id cannot be combined with --only-freesound")
    requested = set(args.track_id)
    shipped = {t["id"] for t in manifest["tracks"]}
    unknown = requested - shipped
    if unknown:
        parser.error(f"Unshipped or unknown --track-id(s): {sorted(unknown)}")
    tracks = [
        t for t in manifest["tracks"]
        if (t["id"] in requested if requested else (
            not args.only_freesound
            or manifest["sources"][t["source"]].get("provider") == "freesound"
        ))
    ]
    if args.check:
        total = budget_and_channels(
            OUT, manifest["tracks"], manifest["synthetic_retained"]
        )
        if PROVENANCE.exists():
            prov = json.loads(PROVENANCE.read_text(encoding="utf-8"))
            if prov.get("output_sha256"):
                for rel, expected in prov["output_sha256"].items():
                    file = OUT / rel
                    if not file.is_file() or sha256(file) != expected:
                        raise ValueError(f"Shipped audio digest mismatch: {rel}")
                actual = {
                    str(p.relative_to(OUT)) for p in OUT.rglob("*")
                    if p.suffix in (".ogg", ".m4a")
                }
                if set(prov["output_sha256"]) != actual:
                    raise ValueError("Output digest catalogue incomplete")
            for key, source in manifest["sources"].items():
                if source.get("provider") != "freesound":
                    continue
                file = FREESOUND_SOURCES / source["filename"]
                expected = prov.get("sources", {}).get(key, {}).get("sha256")
                if expected and (not file.is_file() or sha256(file) != expected):
                    raise ValueError(f"Bundled Freesound source digest mismatch: {key}")
        count = 2 * (len(manifest["tracks"]) + len(manifest["synthetic_retained"]))
        print(f"PASS: {total} B / {MAX_BYTES} B; {count} files; stereo ambient / mono SFX")
        return
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        parser.error("ffmpeg and ffprobe must be installed")
    sources = source_checksums(manifest, args.source_dir, args.fetch, tracks)
    with tempfile.TemporaryDirectory(prefix="marchia-cc0-") as td:
        temp = Path(td)
        staged = temp / "out"
        for track in tracks:
            key = track["source"]
            src = sources[key]["file"]
            meta = sources[key]
            needed = (
                track.get("start", 0) + track["seconds"]
                + track.get("loop_crossfade", 0)
            )
            if meta["duration"] + .01 < needed:
                raise ValueError(
                    f"Source {key} too short: {meta['duration']:.2f} < {needed:.2f}"
                )
            raw = temp / (track["id"].replace("/", "_") + ".wav")
            if track["kind"] == "ambient" or "loop_crossfade" in track:
                layers = [
                    (layer, sources[layer["source"]]["file"])
                    for layer in track.get("extra", [])
                ]
                field_loop(track, src, layers, raw)
            else:
                shot(track, src, raw)
            encode(raw, track, staged / track["id"])
            print(f"Processed {track['id']}: {track['seconds']} s", flush=True)
        # Check the complete shipped budget before replacing a single existing file.
        merged = temp / "merged"
        shutil.copytree(OUT, merged)
        for file in staged.rglob("*"):
            if file.is_file():
                target = merged / file.relative_to(staged)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(file, target)
        total = budget_and_channels(
            merged, manifest["tracks"], manifest["synthetic_retained"]
        )
        for file in staged.rglob("*"):
            if file.is_file():
                dest = OUT / file.relative_to(staged)
                dest.parent.mkdir(parents=True, exist_ok=True)
                file.replace(dest)
        PROVENANCE.parent.mkdir(parents=True, exist_ok=True)
        previous = (
            json.loads(PROVENANCE.read_text(encoding="utf-8"))
            if PROVENANCE.exists() else {}
        )
        source_json = dict(previous.get("sources", {}))
        for key, record in sorted(sources.items()):
            meta = manifest["sources"][key]
            source_json[key] = {
                "sha256": record["sha256"],
                "seconds": round(record["duration"], 4),
                "original": meta.get("url", meta["page"]),
                "page": meta["page"],
                "author": meta["author"],
                "sound_id": meta.get("sound_id"),
                "source_format": (
                    "Freesound public HQ OGG preview"
                    if meta.get("provider") == "freesound" else "original"
                ),
                "preview_url": record["download_url"],
            }
        output_sha256 = {
            str(p.relative_to(OUT)): sha256(p)
            for p in sorted(OUT.rglob("*"))
            if p.suffix in (".ogg", ".m4a")
        }
        PROVENANCE.write_text(
            json.dumps({
                "format_version": 2, "sources": source_json,
                "output_bytes": total,
                "tracks": [t["id"] for t in manifest["tracks"]],
                "output_sha256": output_sha256,
            }, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(
            f"PASS: rendered {len(tracks)} CC0 recordings; "
            f"{len(manifest['tracks'])} verified tracks; {total} B combined"
        )


if __name__ == "__main__":
    main()
