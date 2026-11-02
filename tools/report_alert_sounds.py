#!/usr/bin/env python3
"""Compare MARCHIA phone alerts before/after and update shipped-audio hashes.

Copy the previous four codec files to --before before generating new alerts.
No recorded CC0 source file is touched. Requires ffmpeg, numpy, scipy.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
SOUNDS = ROOT / "public/assets/audio"
PROVENANCE = ROOT / "docs/audio-provenance.json"
REPORT = ROOT / "docs/research/2026-11-02-alert-sounds.md"
BANDS = ((0, 200), (300, 1000), (1000, 4000), (700, 1400))


def inspect(path: Path) -> dict:
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_name,channels,sample_rate",
        "-of", "json", str(path)], text=True))
    stream = probe["streams"][0]
    if stream["channels"] != 1 or int(stream["sample_rate"]) != 24000:
        raise ValueError(f"Expected 24 kHz mono: {path}")
    raw = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(path), "-ac", "1",
        "-ar", "24000", "-f", "f32le", "pipe:1"])
    x = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    if not len(x):
        raise ValueError(f"Empty audio: {path}")
    freqs = np.fft.rfftfreq(len(x), 1 / 24000)
    power = np.abs(np.fft.rfft(x)) ** 2 / len(x) ** 2
    power[1:-1] *= 2
    if len(x) % 2:
        power[-1] *= 2
    if not power.sum():
        raise ValueError(f"Silent audio: {path}")
    bands = [float(100 * power[(freqs >= lo) & (freqs < hi)].sum() / power.sum())
             for lo, hi in BANDS]
    hp = signal.sosfilt(signal.butter(4, 300, btype="highpass",
                                      fs=24000, output="sos"), x)
    phone = 10 * math.log10(max(float(np.mean(hp * hp)), 1e-20))
    ffmpeg = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "ebur128=peak=true", "-f", "null", "-"],
        capture_output=True, text=True, check=True).stderr
    summary = ffmpeg.rsplit("Summary:", 1)[-1]
    match = re.search(r"Integrated loudness:\s*I:\s*(-?[\d.]+) LUFS", summary)
    if not match:
        raise ValueError(f"Integrated loudness unavailable: {path}")
    return {"duration": float(probe["format"]["duration"]),
            "bands": bands, "lufs": float(match.group(1)), "phone": phone}


def update_provenance() -> tuple[int, int]:
    provenance = json.loads(PROVENANCE.read_text(encoding="utf8"))
    files = sorted(p for p in SOUNDS.rglob("*") if p.suffix in (".ogg", ".m4a"))
    hashes = {p.relative_to(SOUNDS).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in files}
    if set(hashes) != set(provenance["output_sha256"]):
        raise ValueError("Audio catalogue membership changed")
    changed = {key for key, sha in hashes.items() if sha != provenance["output_sha256"][key]}
    if not changed <= {
        "ui/stall.ogg", "ui/stall.m4a", "ui/error.ogg", "ui/error.m4a"
    }:
        raise ValueError(f"Unexpected audio changes: {sorted(changed)}")
    size = sum(p.stat().st_size for p in files)
    if len(files) != 72 or size >= 4 * 1024 * 1024:
        raise ValueError(f"Audio budget/catalogue invalid: {len(files)} assets, {size} bytes")
    provenance["output_sha256"] = hashes
    provenance["output_bytes"] = size
    PROVENANCE.write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + "\n",
                          encoding="utf8")
    return len(files), size


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before", type=Path, required=True)
    parser.add_argument("--after", type=Path, default=SOUNDS / "ui")
    parser.add_argument("--update-provenance", action="store_true")
    args = parser.parse_args()
    table = []
    for name, sec in (("stall", 0.54), ("error", 0.48)):
        for codec in ("ogg", "m4a"):
            old = inspect(args.before / f"{name}.{codec}")
            new = inspect(args.after / f"{name}.{codec}")
            if not (abs(new["duration"] - sec) <= 0.02 and new["duration"] <= 0.6
                    and new["bands"][0] < 10 and new["bands"][3] >= 65
                    and -30 <= new["lufs"] <= -16):
                raise ValueError(f"UI sound failed quality limits: {name}.{codec} {new}")
            table.append((name, codec, old, new))
    count, size = update_provenance() if args.update_provenance else (None, None)
    lines = [
        "# Task 59 — alarmy przestoju i błędu: przed / po", "",
        "Pomiar ze zdekodowanych, dostarczanych OGG Vorbis i AAC/M4A (24 kHz mono).",
        "Udział pasma w całkowitej energii: FFT + wzór Parsevala, łącznie z ogonem kodeka.",
        "LUFS-I: FFmpeg ebur128=peak=true. Dla krótkich one-shotów pomiar LUFS jest przybliżony.", "",
        "| Dźwięk | Format | <200 Hz przed → po | 0,3–1 kHz przed → po | 1–4 kHz przed → po | 0,7–1,4 kHz po | LUFS-I przed → po | Czas po |",
        "|---|---|---:|---:|---:|---:|---:|---:|"
    ]
    for name, codec, old, new in table:
        compare = lambda i: f'{old["bands"][i]:.1f}% → {new["bands"][i]:.1f}%'
        lines.append(
            f'| ui/{name} | {codec.upper()} | {compare(0)} | {compare(1)} | {compare(2)} '
            f'| {new["bands"][3]:.1f}% | {old["lufs"]:.1f} → {new["lufs"]:.1f} '
            f'| {new["duration"]:.3f} s |')
    lines += [
        "", "### Model głośnika telefonu: filtr górnoprzepustowy Butterwortha 4. rzędu, 300 Hz", "",
        "| Dźwięk | Format | RMS przed (dBFS) | RMS po (dBFS) | Różnica |",
        "|---|---|---:|---:|---:|"
    ]
    for name, codec, old, new in table:
        lines.append(
            f'| ui/{name} | {codec.upper()} | {old["phone"]:.1f} | {new["phone"]:.1f} '
            f'| {new["phone"] - old["phone"]:+.1f} dB |')
    lines += [
        "", "### Sposób wykonania", "",
        "- Dwa nieregularnie brzmiące drewniane stuknięcia; bez głosu, nagrań i cyfrowego bipu.",
        "- Silna energia 700–1400 Hz, ziarnisty rezonans i delikatny niskotonowy komponent drewna.",
        "- Osobne deterministyczne ziarna RNG dla każdego uderzenia; pipeline mono 24 kHz i normalizacja szczytu UI -6 dBFS bez zmian.",
        "- Bezpieczna komenda: python3 tools/generate_audio.py --only-ui-alerts (nie uruchamiać pełnego generatora po podmianie nagrań CC0).",
        "- Tymczasowy gain stall 0,55 cofnięty do 0,38; ui.error pozostał 0,36.",
        "- Kontrola końcowa: python3 tools/process_audio.py --check."
    ]
    if count is not None:
        lines.append(f"- Zestaw: {count} plików OGG/M4A, {size} B < 4194304 B.")
    lines.append("")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
