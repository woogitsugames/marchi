#!/usr/bin/env python3
"""Original CC0 low-key medieval sound-design assets for MARCHIA.

Requires numpy, scipy, soundfile and ffmpeg. Reproducible: fixed RNG seed.
No recordings, samples, instruments, sound libraries or externally-owned audio.
"""
from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

FS = 24000
RNG = np.random.default_rng(1300)
ROOT = Path(__file__).resolve().parent.parent / 'public/assets/audio'
ROOT.mkdir(parents=True, exist_ok=True)


def noise(n: int, low: float | None = None, high: float | None = None) -> np.ndarray:
    x = RNG.standard_normal(n).astype(np.float32)
    if low is None and high is None:
        return x
    if low and high:
        sos = signal.butter(2, (low, high), btype='bandpass', fs=FS, output='sos')
    elif high:
        sos = signal.butter(2, high, btype='lowpass', fs=FS, output='sos')
    else:
        sos = signal.butter(2, low, btype='highpass', fs=FS, output='sos')
    return signal.sosfilt(sos, x).astype(np.float32)


def times(n: int) -> np.ndarray:
    return np.arange(n, dtype=np.float32) / FS


def place(dst: np.ndarray, t: float, event: np.ndarray, amp: float = 1) -> None:
    first = round(t * FS)
    if first >= len(dst):
        return
    src_off = max(0, -first)
    first = max(0, first)
    length = min(len(dst) - first, len(event) - src_off)
    if length > 0:
        dst[first:first + length] += amp * event[src_off:src_off + length]


def envelope(n: int, attack: float, decay: float = 0) -> np.ndarray:
    t = times(n)
    e = np.minimum(1.0, t / max(attack, 0.001))
    if decay:
        e *= np.exp(-t / decay)
    return e


def thunk(f: float = 120, seconds: float = 0.40, rough: float = 0.22) -> np.ndarray:
    n = round(seconds * FS)
    t = times(n)
    fundamental = np.sin(2 * math.pi * (f * t + 19 * t * t) + 0.3) * np.exp(-t * 18)
    texture = noise(n, high=1800) * np.exp(-t * 36)
    low = np.sin(2 * math.pi * 42 * t) * np.exp(-t * 13)
    return (0.55 * fundamental + rough * texture + 0.25 * low).astype(np.float32)


def chirp(duration: float = 0.15, f0: float = 900, f1: float = 1600) -> np.ndarray:
    n = round(duration * FS)
    t = times(n)
    e = np.sin(math.pi * np.linspace(0, 1, n, dtype=np.float32)) ** 2
    phase = 2 * math.pi * (f0 * t + (f1 - f0) / max(0.001, duration) * 0.5 * t * t)
    return (np.sin(phase) * e).astype(np.float32)


def wooden_alert_strike(seed: int, pitch: float, seconds: float = 0.235) -> np.ndarray:
    """A damped wooden clack with a noisy 0.7-1.4 kHz body, not a pitched beep."""
    n = round(seconds * FS)
    t = times(n)
    rng = np.random.default_rng(seed)
    # Per-effect RNG: --only-ui-alerts does not alter unrelated sound assets.
    grain = rng.standard_normal(n).astype(np.float32)
    bandpass = signal.butter(3, (690, 1490), btype='bandpass', fs=FS, output='sos')
    mid = signal.sosfilt(bandpass, grain).astype(np.float32)
    mid /= max(float(np.sqrt(np.mean(mid * mid))), 1e-8)
    # Inharmonic partials evoke an uneven board, not a tuned bell.
    rings = (0.60 * np.sin(2 * math.pi * (pitch * t + 45 * t * t) + 0.4)
             + 0.27 * np.sin(2 * math.pi * (1.37 * pitch * t + 31 * t * t) + 1.9)
             + 0.15 * np.sin(2 * math.pi * (1.68 * pitch * t - 17 * t * t) + 2.8))
    body = (0.72 * mid + 0.28 * rings) * np.exp(-t * 17.0)
    # A little low wood resonance remains; mobile-speaker content dominates.
    wood = 0.09 * np.sin(2 * math.pi * 145 * t + 0.1) * np.exp(-t * 30)
    impact = (body + wood) * (1 - np.exp(-t * 1250))
    return impact.astype(np.float32)


def one_shot(kind: str) -> np.ndarray:
    lengths = {
        'cart-dirt': 4.8, 'cart-cobble': 3.8, 'mill-wheel': 5.5,
        'horse-snort': 1.6, 'bridge-wood': 1.4,
        'load-sack': 0.95, 'unload-sack': 1.15,
        'load-plank': 1.1, 'unload-plank': 1.35,
        'load-log': 1.25, 'unload-log': 1.45,
        'axe': 0.85, 'saw': 1.9, 'oven': 1.3,
        'wax-seal': 1.05, 'stall': 0.54, 'wood': 0.28, 'paper': 0.48, 'error': 0.48,
    }
    duration = lengths[kind]
    n = round(duration * FS)
    t = times(n)
    y = np.zeros(n, dtype=np.float32)
    if kind.startswith('cart-'):
        cobble = kind == 'cart-cobble'
        y += noise(n, high=150 if not cobble else 250) * (0.08 if not cobble else 0.055)
        y += noise(n, low=130, high=760) * (0.06 if not cobble else 0.045)
        wheel_step = 0.32 if cobble else 0.45
        for at in np.arange(0, duration, wheel_step):
            at += float(RNG.normal(0, 0.022))
            place(y, at, thunk(105 if cobble else 78, 0.23, 0.28 if cobble else 0.15), 0.26 if cobble else 0.18)
        y += (np.sin(2 * math.pi * 2.3 * t) + 0.2 * np.sin(2 * math.pi * 6.7 * t)) * 0.02
    elif kind == 'mill-wheel':
        y += noise(n, high=650) * 0.065
        y += noise(n, low=100, high=1750) * 0.024
        for at in np.arange(0.2, duration, 0.58):
            place(y, at, thunk(75, 0.6, 0.1), 0.27)
        y += np.sin(2 * math.pi * 24 * t) * 0.012
    elif kind == 'horse-snort':
        breath = noise(n, low=150, high=1900)
        wave = (np.exp(-((t - 0.3) / 0.16) ** 2) + 0.8 * np.exp(-((t - 0.89) / 0.22) ** 2))
        y = breath * wave * 0.24 + np.sin(2 * math.pi * 92 * t) * wave * 0.026
    elif kind == 'bridge-wood':
        for at, amplitude in ((0.07, 0.6), (0.42, 0.42), (0.80, 0.67), (1.13, 0.38)):
            place(y, at, thunk(82, 0.42, 0.24), amplitude)
    elif 'sack' in kind:
        rub = noise(n, low=150, high=2800)
        y += rub * (0.035 + 0.03 * np.sin(2 * math.pi * 3 * t))
        place(y, 0.40 if kind.startswith('load') else 0.24, thunk(63, 0.5, 0.18), 0.52)
    elif 'plank' in kind:
        place(y, 0.09, thunk(330, 0.68, 0.36), 0.57)
        place(y, 0.40, thunk(245, 0.6, 0.30), 0.38)
        y += noise(n, high=950) * np.exp(-t * 3.8) * 0.04
    elif 'log' in kind:
        place(y, 0.08, thunk(70, 0.9, 0.18), 0.73)
        place(y, 0.49, thunk(59, 0.7, 0.13), 0.34)
        y += noise(n, high=500) * np.exp(-t * 2.4) * 0.025
    elif kind == 'axe':
        place(y, 0.16, thunk(180, 0.66, 0.43), 0.67)
        place(y, 0.18, noise(round(0.11 * FS), low=1000, high=4200) * envelope(round(0.11 * FS), 0.004, 0.035), 0.15)
    elif kind == 'saw':
        scrape = noise(n, low=220, high=3300)
        motion = np.maximum(0, np.sin(2 * math.pi * 1.2 * t)) ** 2
        y = scrape * (motion * 0.11 + 0.012)
        y += np.sin(2 * math.pi * (130 * t + 10 * np.sin(2 * math.pi * 1.2 * t))) * motion * 0.019
    elif kind == 'oven':
        y += noise(n, low=120, high=1700) * 0.021
        for at in (0.17, 0.37, 0.85, 1.10):
            b = noise(round(0.08 * FS), low=600, high=8000) * envelope(round(0.08 * FS), 0.002, 0.019)
            place(y, at, b, 0.20)
    elif kind == 'wax-seal':
        y += noise(n, low=140, high=2200) * np.exp(-((t - 0.18) / 0.25) ** 2) * 0.04
        place(y, 0.53, thunk(120, 0.44, 0.1), 0.37)
    elif kind == 'stall':
        place(y, 0.045, wooden_alert_strike(5901, 870), 0.38)
        place(y, 0.205, wooden_alert_strike(5902, 1040), 0.30)
    elif kind == 'wood':
        place(y, 0.04, thunk(245, 0.22, 0.12), 0.39)
    elif kind == 'paper':
        y += noise(n, low=350, high=3300) * np.exp(-((t - 0.17) / 0.15) ** 2) * 0.09
    elif kind == 'error':
        place(y, 0.045, wooden_alert_strike(5911, 1010), 0.36)
        place(y, 0.145, wooden_alert_strike(5912, 790), 0.27)
    return y


def ambient(kind: str, duration: int) -> np.ndarray:
    n = FS * duration
    t = times(n)
    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    # Brownish long-wave air movement: not a bright white-noise wash.
    low_l = noise(n, high=220)
    low_r = noise(n, high=240)
    distant = np.sin(2 * math.pi * 0.06 * t) * 0.23 + 0.64
    wind = 0.12 if kind != 'rain' else 0.2
    left += low_l * distant * wind
    right += low_r * distant * wind
    if kind == 'morning':
        for at in [2.4, 4.7, 9.1, 13.8, 16.9, 19.1, 23.8, 29.0]:
            if at >= duration: continue
            song = chirp(float(RNG.uniform(0.1, 0.22)), float(RNG.uniform(740, 1400)), float(RNG.uniform(900, 1900)))
            place(left, at, song, 0.011)
            place(right, at + 0.035, song, 0.007)
        # Subtle distant dog: three short muffled bark-like resonance pulses.
        for at in (20.3, 20.9, 22.2):
            place(left, at, thunk(170, 0.32, 0.2), 0.010)
            place(right, at, thunk(170, 0.32, 0.2), 0.008)
    elif kind == 'rain':
        for side in (left, right):
            side += noise(n, low=350, high=6000) * 0.032
            for at in np.arange(0, duration, 0.23):
                at += float(RNG.uniform(-0.14, 0.14))
                b = noise(round(0.025 * FS), low=1700, high=8200) * envelope(round(0.025 * FS), 0.001, 0.005)
                place(side, at, b, 0.016)
    elif kind == 'river':
        for side in (left, right):
            side += noise(n, low=95, high=1900) * 0.10
            side += noise(n, low=1500, high=7500) * 0.018
            side *= (0.83 + 0.12 * np.sin(2 * math.pi * 0.21 * t))
    elif kind == 'evening':
        for at in (8.5, 13.2, 18.0, 28.1, 34.6):
            if at >= duration: continue
            # Short distant jackdaw-like calls, NOT summer insect beds.
            c = chirp(0.25, 560, 390) * 0.020
            place(left, at, c, 0.7)
            place(right, at + 0.045, c, 0.45)
    return np.stack((left, right), axis=1)


def smooth_seam(y: np.ndarray, seconds: float) -> np.ndarray:
    # 20-50 ms cosine entrance/exit fades guarantee no click when AudioBufferSourceNode loops.
    n = min(round(seconds * FS), len(y) // 8)
    if n:
        window = np.sin(np.linspace(0, math.pi / 2, n, dtype=np.float32)) ** 2
        if y.ndim == 2:
            window = window[:, None]
        y[:n] *= window
        y[-n:] *= window[::-1]
    return y


def render(name: str, y: np.ndarray, long: bool = False) -> None:
    dest = ROOT / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    y = np.array(y, dtype=np.float32, copy=True)
    y -= y.mean(axis=0)
    y = smooth_seam(y, 0.065 if long else (0.035 if len(y) > FS else 0.015))
    peak = max(1e-9, float(np.max(np.abs(y))))
    # Target SFX peaks exactly -6 dBFS, ambient normalised to -24 LUFS by ffmpeg.
    if long:
        y *= min(1.0, 0.33 / peak)
    else:
        y *= (10 ** (-6 / 20)) / peak
    temp = dest.with_suffix('.wav')
    wavfile.write(temp, FS, np.clip(y, -1, 1).astype(np.float32))
    channels = 2 if long else 1
    ogg = dest.with_suffix('.ogg')
    m4a = dest.with_suffix('.m4a')
    loudnorm = ['-af', 'loudnorm=I=-24:TP=-3:LRA=9,aresample=24000'] if long else []
    # AAC 24k stereo fallback for WebKit, 15k mono for SFX; Vorbis equivalent.
    for output, codec, kbps in ((ogg, 'libvorbis', '30k' if long else '20k'),
                                (m4a, 'aac', '30k' if long else '20k')):
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(temp),
                        '-ac', str(channels), *loudnorm, '-ar', str(FS), '-c:a', codec, *(['-q:a', '0'] if codec == 'libvorbis' else ['-b:a', kbps]), str(output)],
                       check=True, stdout=subprocess.DEVNULL)
    temp.unlink(missing_ok=True)
    print(f'{name:<22} {ogg.stat().st_size + m4a.stat().st_size:>7} bytes')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--only-ui-alerts', action='store_true',
        help='Safely regenerate just ui/stall and ui/error without touching CC0 field recordings',
    )
    args = parser.parse_args()
    if args.only_ui_alerts:
        for name in ('stall', 'error'):
            render(f'ui/{name}', one_shot(name))
        return
    for kind, dur in [('morning', 36), ('river', 34), ('rain', 32), ('evening', 40)]:
        render(f'ambient/{kind}', ambient(kind, dur), long=True)
    for name in ['cart-dirt', 'cart-cobble', 'horse-snort', 'bridge-wood',
                 'load-sack', 'unload-sack', 'load-plank', 'unload-plank',
                 'load-log', 'unload-log', 'axe', 'saw', 'mill-wheel', 'oven', 'wax-seal']:
        render(f'sfx/{name}', one_shot(name))
    for name in ['stall', 'wood', 'paper', 'error']:
        render(f'ui/{name}', one_shot(name))
    files = list(ROOT.rglob('*.ogg')) + list(ROOT.rglob('*.m4a'))
    total = sum(x.stat().st_size for x in files)
    print(f'TOTAL: {total} bytes ({total / 1024 / 1024:.2f} MiB), {len(files)} files')
    assert total < 4 * 1024 * 1024, 'audio size budget exceeded'


if __name__ == '__main__':
    main()
