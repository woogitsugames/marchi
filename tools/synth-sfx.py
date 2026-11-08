#!/usr/bin/env python3
"""Own-synthesis CC0 cues and ambiences for MARCHIA (orders 69, 79, 80; D-350).

Everything here is computed from sines, noise and simple physical models (modal resonators, stick-slip
pulse trains, dispersive chirps, formant-shaped pulse trains) with fixed RNG seeds: no recordings, samples,
sound libraries or instruments. Output: OGG Vorbis + AAC/M4A at 48 kHz (cues mono, loops stereo).

  python3 tools/synth-sfx.py             # render all 9 sounds into public/assets/audio/
  python3 tools/synth-sfx.py --only sfx/ice-crack
  python3 tools/synth-sfx.py --report    # measure the shipped files (LUFS, true peak, band 600-2500 Hz, seams)

Needs numpy and ffmpeg (libvorbis + aac encoders). Loops are synthesized circularly (events wrap around, noise
is shaped in a circular STFT, reverb is a circular convolution), so the last sample flows into the first.
After rendering, update the output hashes in docs/audio-provenance.json (see docs/ASSETS.md, D-350).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 48000
BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'public/assets/audio'
CUE_LUFS = -16.0
LOOP_LUFS = -23.0
TRUE_PEAK = -2.0  # dBTP ceiling before encoding (the codecs add a few tenths)


# --- helpers ----------------------------------------------------------------------------------------

def taxis(dur: float) -> np.ndarray:
    return np.arange(int(round(dur * SR))) / SR


def bp(f: np.ndarray, fc: float, q: float) -> np.ndarray:
    """Magnitude of a 2nd-order resonance (peak 1 at fc)."""
    r = np.maximum(f, 1e-3) / fc
    return 1 / np.sqrt(1 + q * q * (r - 1 / r) ** 2)


def lp(f: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    return 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def hp(f: np.ndarray, fc: float, order: int = 2) -> np.ndarray:
    r = (f / fc) ** order
    return r / np.sqrt(1 + r * r)


def spec_filter(x: np.ndarray, fn, circular: bool = False) -> np.ndarray:
    """Zero-phase magnitude filter in the frequency domain; padded unless the signal is a loop."""
    n = x.shape[-1]
    m = n if circular else n + SR // 2
    f = np.fft.rfftfreq(m, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x, m) * fn(f), m)[..., :n]


def conv(x: np.ndarray, ir: np.ndarray, circular: bool = False) -> np.ndarray:
    n = x.shape[-1]
    m = n if circular else n + len(ir)
    if circular and len(ir) > n:
        ir = ir[:n]
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[..., :n]


def place(buf: np.ndarray, ev: np.ndarray, t0: float, gain: float = 1.0, wrap: bool = False) -> None:
    i = int(round(t0 * SR))
    n = buf.shape[-1]
    if wrap:
        idx = (i + np.arange(len(ev))) % n
        np.add.at(buf, idx, gain * ev)
        return
    k = min(len(ev), n - i)
    if k > 0:
        buf[i:i + k] += gain * ev[:k]


def attack(n: int, ms: float) -> np.ndarray:
    a = np.ones(n)
    k = min(n, max(1, int(ms * SR / 1000)))
    a[:k] = 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    return a


def modes(freqs, decays, amps, dur: float, att_ms: float = 0.6) -> np.ndarray:
    """Struck modal resonator: damped sines starting at zero phase, a short raised-cosine attack."""
    t = taxis(dur)
    y = np.zeros_like(t)
    for f, d, a in zip(freqs, decays, amps):
        y += a * np.exp(-t / d) * np.sin(2 * np.pi * f * t)
    return y * attack(len(t), att_ms)


def burst(rng, dur: float, fn, decay: float) -> np.ndarray:
    t = taxis(dur)
    return spec_filter(rng.standard_normal(len(t)), fn) * np.exp(-t / decay) * attack(len(t), 0.3)


def reverb_ir(rng, rt60: float, dur: float, predelay: float = 0.008, bright: float = 4500) -> np.ndarray:
    """Exponentially decaying noise; the top band decays twice as fast (air and soft walls)."""
    t = taxis(dur)
    lo = spec_filter(rng.standard_normal(len(t)), lambda f: lp(f, bright, 2)) * np.exp(-6.91 * t / rt60)
    hi = spec_filter(rng.standard_normal(len(t)), lambda f: hp(f, bright, 2)) * np.exp(-6.91 * t / (rt60 * 0.5))
    ir = lo + 0.5 * hi
    ir[:int(predelay * SR)] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def wet(x: np.ndarray, ir: np.ndarray, mix: float, circular: bool = False) -> np.ndarray:
    return x + mix * conv(x, ir, circular)


def fade_edges(x: np.ndarray, fin: float = 0.002, fout: float = 0.06) -> np.ndarray:
    n = x.shape[-1]
    w = np.ones(n)
    a, b = int(fin * SR), int(fout * SR)
    w[:a] = 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    w[n - b:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(1, b + 1) / b)
    return x * w


def pulse_train(rate: np.ndarray, rng, jitter: float = 0.2) -> np.ndarray:
    """Stick-slip friction: one impulse per cycle of a time-varying rate (Hz per sample)."""
    phase = np.cumsum(rate / SR)
    idx = np.nonzero(np.diff(np.floor(phase)) > 0)[0] + 1
    y = np.zeros_like(rate)
    y[idx] = np.maximum(0.1, 1 + jitter * rng.standard_normal(len(idx)))
    return y


def drop_chirp(f0: float, f1: float, tau: float, dur: float, decay: float) -> np.ndarray:
    """Dispersive 'pew' of a flexural wave in an ice sheet: the frequency falls from f0 towards f1."""
    t = taxis(dur)
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * attack(len(t), 0.4)


def periodic(n: int, rng, cycles=(1, 2, 3, 5), depth=1.0) -> np.ndarray:
    """Smooth modulation in [-1, 1] that repeats exactly over n samples (integer cycles per loop)."""
    t = np.arange(n) / n
    y = sum(rng.uniform(0.4, 1.0) * np.sin(2 * np.pi * c * t + rng.uniform(0, 2 * np.pi)) for c in cycles)
    return depth * y / np.max(np.abs(y))


def stft_noise(n: int, rng, env, hop: int = 480, size: int = 1920) -> np.ndarray:
    """Circular STFT noise shaping: env(frame_pos 0..1 array, freqs) -> magnitude (frames x bins)."""
    assert n % hop == 0
    frames = n // hop
    x = rng.standard_normal(n)
    idx = (np.arange(frames)[:, None] * hop + np.arange(size)[None, :]) % n
    win = np.hanning(size + 1)[:size]
    spec = np.fft.rfft(x[idx] * np.sqrt(win), axis=1)
    f = np.fft.rfftfreq(size, 1 / SR)
    pos = (np.arange(frames) * hop + size / 2) / n % 1.0
    spec *= env(pos, f)
    y = np.zeros(n)
    np.add.at(y, idx, np.fft.irfft(spec, size, axis=1) * np.sqrt(win))
    return y


def sample_curve(curve: np.ndarray, pos: np.ndarray) -> np.ndarray:
    """Read a per-sample periodic curve at frame positions 0..1."""
    return curve[(pos * len(curve)).astype(int) % len(curve)]


# --- cues (order 69) ---------------------------------------------------------------------------------

def bell(f: float, dur: float, rng, dull: float = 1.0) -> np.ndarray:
    """Bronze bell: hum, prime, minor-third tierce, quint, nominal and upper partials, some as beating doublets."""
    parts = [(0.5, 0.22, 1.6), (1.0, 0.55, 1.1), (1.19, 0.5, 0.9), (1.5, 0.28, 0.7), (2.0, 0.75, 0.6),
             (2.51, 0.3, 0.35), (2.99, 0.22, 0.25), (4.07, 0.12 * dull, 0.15), (5.3, 0.06 * dull, 0.08)]
    fr, dc, am = [], [], []
    for r, a, d in parts:
        fr.append(f * r); dc.append(d); am.append(a)
        if r in (1.0, 1.19, 2.0):  # slightly out-of-round casting: a slow beat
            fr.append(f * r + rng.uniform(1.2, 2.4)); dc.append(d * 0.9); am.append(a * 0.4)
    y = modes(fr, dc, am, dur, att_ms=1.2)
    place(y, burst(rng, 0.03, lambda q: bp(q, 2800, 1.5), 0.006), 0, 0.25)  # clapper on bronze
    return y


def rank_up(rng) -> np.ndarray:
    """ui.rankUp: two solemn bell strokes falling a fourth (D5 -> A4), a little church air; no fanfare."""
    dur = 1.2
    y = np.zeros(int(dur * SR))
    place(y, bell(587.3, dur, rng), 0.005, 1.0)
    place(y, bell(440.0, dur, rng, dull=0.7), 0.47, 0.8)
    y = wet(y, reverb_ir(rng, 1.4, 1.0, 0.02, 3500), 0.22)
    y = spec_filter(y, lambda f: hp(f, 180, 2))
    return fade_edges(y, 0.002, 0.28)


def rank_card(rng) -> np.ndarray:
    """ui.rankCard: one soft knuckle knock on a hollow oak box (soft exciter: no click)."""
    dur = 0.45  # one 400 ms loudness block in both codecs (the OGG decodes 128 samples short, the M4A long)
    y = np.zeros(int(dur * SR))
    k = modes([214, 770, 1185, 1730, 2470], [0.05, 0.09, 0.06, 0.035, 0.018], [0.25, 1.0, 0.6, 0.35, 0.15], 0.4, att_ms=2.0)
    place(k, burst(rng, 0.03, lambda f: bp(f, 1300, 1.2) * lp(f, 2500), 0.004), 0, 0.2)
    place(y, k, 0.005)
    y = wet(y, reverb_ir(rng, 0.35, 0.3, 0.004, 3000), 0.18)
    y = spec_filter(y, lambda f: hp(f, 150, 2) * lp(f, 4000, 2))
    return fade_edges(y, 0.002, 0.12)


def mallet_hit(rng, pitch: float, strength: float) -> np.ndarray:
    """Wooden mallet on a chisel driven into a beam: timber modes + a short tock."""
    fr = np.array([520, 880, 1340, 1950, 2700]) * pitch
    y = modes(fr, [0.075, 0.055, 0.035, 0.024, 0.014], [0.7, 1.0, 0.75, 0.45, 0.25], 0.25, att_ms=0.5)
    place(y, burst(rng, 0.02, lambda f: bp(f, 1800 * pitch, 1.0), 0.003), 0, 0.35)
    return strength * y


def grow(rng) -> np.ndarray:
    """ui.grow: three carpentry blows (mallet on chisel), the last one heaviest and lower: work getting done."""
    dur = 0.95
    y = np.zeros(int(dur * SR))
    for t0, p, s in ((0.005, 1.03, 0.75), (0.26, 0.98, 0.85), (0.52, 0.93, 1.0)):
        place(y, mallet_hit(rng, p * rng.uniform(0.99, 1.01), s), t0)
    y = wet(y, reverb_ir(rng, 0.45, 0.4, 0.006, 3500), 0.2)
    y = spec_filter(y, lambda f: hp(f, 200, 2))
    return fade_edges(y, 0.002, 0.12)


def shop_bell(f: float, dur: float) -> np.ndarray:
    """Small brass shop bell on a spring: inharmonic partials, bright but short."""
    return modes([f, f * 1.6, f * 2.4, f * 2.92, f * 3.6], [0.45, 0.3, 0.2, 0.14, 0.08], [1.0, 0.55, 0.45, 0.3, 0.15], dur, 0.4)


def post_open(rng) -> np.ndarray:
    """event.postOpen: a wooden shutter swung open on a dry hinge (stick-slip creak), its stop, then a small bell."""
    dur = 1.2
    y = np.zeros(int(dur * SR))
    cd = 0.5
    t = taxis(cd)
    rate = 95 + 150 * np.sin(np.pi * t / cd) ** 1.5 + 25 * np.sin(2 * np.pi * 7 * t)
    pulses = pulse_train(rate, rng, 0.25) * np.sin(np.pi * t / cd) ** 0.7
    plate = modes([640, 1040, 1530, 2210, 3100], [0.022, 0.018, 0.015, 0.011, 0.007], [0.6, 1.0, 0.8, 0.5, 0.2], 0.08, 0.2)
    place(y, conv(pulses, plate) * 0.6, 0.005)
    place(y, modes([300, 820, 1260, 1900], [0.04, 0.05, 0.03, 0.02], [0.4, 1.0, 0.6, 0.3], 0.2, 1.0), 0.51, 0.5)  # shutter stop
    place(y, shop_bell(1180, 0.7), 0.6, 0.75)
    place(y, shop_bell(1180 * 1.003, 0.55), 0.77, 0.45)
    y = wet(y, reverb_ir(rng, 0.6, 0.5, 0.01, 4000), 0.2)
    y = spec_filter(y, lambda f: hp(f, 220, 2))
    return fade_edges(y, 0.002, 0.25)


def ice_crack(rng) -> np.ndarray:
    """world.iceCrack: floes cracking against a wooden bridge pier: snaps, falling 'pew' chirps, a pier knock."""
    dur = 1.1
    y = np.zeros(int(dur * SR))
    hits = [(0.005, 1.0, 3200, 700), (0.09, 0.55, 2600, 600), (0.23, 0.75, 3400, 800),
            (0.41, 0.4, 2400, 650), (0.58, 0.5, 3000, 720), (0.74, 0.25, 2200, 600)]
    for t0, a, f0, f1 in hits:
        ev = 0.6 * burst(rng, 0.03, lambda f: hp(f, 900, 2) * lp(f, 5000), 0.004)
        ev = np.pad(ev, (0, int(0.25 * SR)))
        ev[:int(0.2 * SR)] += 0.7 * drop_chirp(f0 * rng.uniform(0.95, 1.05), f1, rng.uniform(0.025, 0.045), 0.2, 0.06)
        ev[:int(0.08 * SR)] += 0.5 * burst(rng, 0.08, lambda f: bp(f, 1100, 0.8), 0.02)
        place(y, ev, t0, a)
    place(y, modes([140, 310, 620], [0.06, 0.05, 0.03], [0.5, 0.6, 0.3], 0.2, 1.5), 0.012, 0.35)  # the pier
    y = wet(y, reverb_ir(rng, 0.9, 0.7, 0.03, 3500), 0.25)  # open river valley, slap off the bank
    y = spec_filter(y, lambda f: hp(f, 110, 2))
    return fade_edges(y, 0.002, 0.2)


# --- trading post (order 80) -------------------------------------------------------------------------

def coin(rng, strength: float) -> np.ndarray:
    f = rng.uniform(2050, 2550)
    y = modes([f, f * 1.58, f * 2.23, f * 2.91], [0.14, 0.09, 0.06, 0.04], [1.0, 0.6, 0.4, 0.2], 0.3, 0.2)
    place(y, modes([f * 0.43], [0.02], [1.0], 0.1, 0.2), 0, 0.3)  # the coin's wobble on the stack
    return strength * y


def post_coins(rng) -> np.ndarray:
    """post.coins: a purse set on the counter, silver counted out coin by coin, the last ones swept up."""
    dur = 1.05
    y = np.zeros(int(dur * SR))
    place(y, modes([180, 410, 760, 1150], [0.05, 0.04, 0.03, 0.02], [0.6, 1.0, 0.6, 0.3], 0.2, 2.5), 0.005, 0.7)  # purse on oak
    place(y, burst(rng, 0.06, lambda f: bp(f, 900, 0.7), 0.015), 0.006, 0.25)
    for t0 in (0.012, 0.03, 0.046):
        place(y, coin(rng, 0.35), t0)
    for t0, s in ((0.24, 0.8), (0.37, 0.75), (0.5, 0.85), (0.62, 0.7)):
        place(y, coin(rng, s), t0 + rng.uniform(-0.01, 0.01))
        place(y, modes([820, 1240], [0.012, 0.009], [1, 0.6], 0.05, 0.3), t0, 0.25)  # coin edge on wood
    sweep = burst(rng, 0.14, lambda f: bp(f, 2600, 1.2), 0.08) * np.sin(np.pi * taxis(0.14) / 0.14)
    place(y, sweep, 0.76, 0.35)
    for t0 in (0.79, 0.84):
        place(y, coin(rng, 0.4), t0)
    y = wet(y, reverb_ir(rng, 0.4, 0.35, 0.005, 5000), 0.15)
    y = spec_filter(y, lambda f: hp(f, 150, 2))
    return fade_edges(y, 0.002, 0.15)


VOWELS = [(750, 1250, 2600), (500, 1800, 2550), (300, 2250, 3000), (500, 900, 2500), (330, 800, 2400), (420, 1600, 2500)]


def syllable(rng, f0a: float, f0b: float, dur: float) -> np.ndarray:
    """Pulse train with a pitch glide, shaped by three formants of a random vowel and a glottal tilt."""
    t = taxis(dur)
    rate = f0a + (f0b - f0a) * t / dur
    src = pulse_train(rate, rng, 0.05) + 0.04 * rng.standard_normal(len(t))
    F = VOWELS[rng.integers(len(VOWELS))]
    s = rng.uniform(0.92, 1.08)
    env = lambda f: (bp(f, F[0] * s, 5) + 0.7 * bp(f, F[1] * s, 8) + 0.35 * bp(f, F[2] * s, 12)) * lp(f, 300, 1) * hp(f, 90, 1)
    y = spec_filter(src, env)
    a = np.sin(np.pi * np.minimum(1, t / dur)) ** 1.5
    return y * a


def market_voice(rng, buf: np.ndarray, start: float) -> None:
    n = buf.shape[-1]
    total = n / SR
    female = rng.random() < 0.45
    base = rng.uniform(185, 235) if female else rng.uniform(95, 140)
    t = start
    while t < start + total:
        k = int(rng.integers(3, 10))
        decl = np.linspace(1.15, 0.9, k)
        for i in range(k):
            d = rng.uniform(0.12, 0.26)
            f0 = base * decl[i] * rng.uniform(0.92, 1.08)
            place(buf, syllable(rng, f0, f0 * rng.uniform(0.94, 1.06), d), t % total, 1.0, wrap=True)
            t += d * 0.85
        t += rng.uniform(0.4, 2.0)


def market(rng) -> np.ndarray:
    """ambient.market: distant crowd at the post — 16 unintelligible formant 'voices', a few knocks, much air."""
    dur = 15.0
    n = int(dur * SR)
    ch = np.zeros((2, n))
    for _ in range(16):
        mono = np.zeros(n)
        market_voice(rng, mono, rng.uniform(0, dur))
        pan = rng.uniform(-0.8, 0.8)
        g = rng.uniform(0.35, 1.0)
        ch[0] += g * np.sqrt((1 - pan) / 2) * mono
        ch[1] += g * np.sqrt((1 + pan) / 2) * mono
    ch /= np.std(ch)
    fx = np.zeros((2, n))
    for t0 in rng.uniform(0, dur, 5):  # far-off mallet and crate knocks
        k = mallet_hit(rng, rng.uniform(0.8, 1.1), rng.uniform(0.6, 1.0))
        pan = rng.uniform(-0.7, 0.7)
        for c, s in ((0, np.sqrt((1 - pan) / 2)), (1, np.sqrt((1 + pan) / 2))):
            place(fx[c], k, t0, s, wrap=True)
    for c in (0, 1):
        place(fx[c], coin(rng, 0.5), rng.uniform(0, dur), 1.0, wrap=True)
    ch += 1.6 * fx / np.max(np.abs(fx))  # knock peaks ~ 4 dB over the crowd's RMS: background, not events
    rumble = stft_noise(n, rng, lambda pos, f: (bp(f, 450, 0.7) * (1 + 0.3 * np.sin(2 * np.pi * 3 * pos))[:, None]))
    ch += 0.04 * rumble / np.std(rumble) * np.std(ch)
    for c in (0, 1):
        ch[c] = 0.45 * ch[c] + conv(ch[c], reverb_ir(rng, 1.6, 1.8, 0.04, 2500), circular=True)
    return spec_filter(ch, lambda f: hp(f, 140, 2) * lp(f, 2000, 2), circular=True)


# --- winter (order 79) -------------------------------------------------------------------------------

def wind_layer(rng, noise_rng, n: int, rush: float = 1.0, whistle: float = 1.0) -> np.ndarray:
    """Wind over open ice: a gusting broadband rush plus two narrow whistles that drift with the gusts.
    `rng` draws the gusts (shared by both channels), `noise_rng` the noise (one per channel)."""
    gust = 0.55 + 0.45 * periodic(n, rng, (1, 2, 3, 5, 7))
    fc1 = 820 * 2 ** (0.45 * periodic(n, rng, (1, 2, 4)))
    fc2 = 1310 * 2 ** (0.35 * periodic(n, rng, (1, 3, 5)))
    w1 = np.maximum(0, periodic(n, rng, (2, 3, 5)))
    w2 = np.maximum(0, periodic(n, rng, (1, 4, 6)))

    def env(pos, f):
        g = sample_curve(gust, pos)[:, None]
        body = rush * (bp(f, 380, 0.6) + 0.35 * bp(f, 1400, 0.8)) * lp(f, 3500, 2) * hp(f, 60, 2)
        ws = whistle * (sample_curve(w1, pos)[:, None] * bp(f, sample_curve(fc1, pos)[:, None], 28) * 1.6
                        + sample_curve(w2, pos)[:, None] * bp(f, sample_curve(fc2, pos)[:, None], 34) * 0.9)
        return g ** 1.6 * body + 2.2 * g ** 2.5 * ws
    return stft_noise(n, noise_rng, env)


def winter_wind(rng) -> np.ndarray:
    """ambient.winterWind: 20 s of wind over the frozen river; two decorrelated channels share the gusts."""
    n = 20 * SR
    seed = int(rng.integers(1 << 30))
    ch = np.stack([wind_layer(np.random.default_rng(seed), np.random.default_rng(seed + 1 + c), n) for c in (0, 1)])
    hiss = np.stack([stft_noise(n, np.random.default_rng(seed + 10 + c), lambda pos, f: hp(f, 4000, 2) * lp(f, 9000, 2)) for c in (0, 1)])
    ch += 0.08 * hiss / np.std(hiss) * np.std(ch)  # dry snow blown over the ice
    return ch


def creak_groan(rng, dur: float) -> np.ndarray:
    """Ice sheet under strain: slow stick-slip pulses through the sheet's low modes."""
    t = taxis(dur)
    rate = rng.uniform(35, 60) + rng.uniform(40, 110) * np.sin(np.pi * t / dur) ** 2 + 8 * np.sin(2 * np.pi * rng.uniform(2, 5) * t)
    pulses = pulse_train(rate, rng, 0.35) * np.sin(np.pi * t / dur) ** 0.8
    sheet = modes([180, 430, 760, 1240, 1900], [0.07, 0.06, 0.045, 0.03, 0.018], [0.6, 1.0, 0.8, 0.5, 0.25], 0.15, 0.5)
    return conv(pulses, sheet)


def ice_creak(rng) -> np.ndarray:
    """ambient.iceCreak: 16 s — strained ice groans, distant singing 'pew' chirps and ticks, a low wind bed."""
    dur = 16.0
    n = int(dur * SR)
    ch = np.zeros((2, n))

    def put(ev, t0, gain, pan):
        for c, s in ((0, np.sqrt((1 - pan) / 2)), (1, np.sqrt((1 + pan) / 2))):
            place(ch[c], ev, t0, gain * s, wrap=True)
    for t0 in (0.8, 4.1, 7.6, 10.2, 13.4):
        d = rng.uniform(0.5, 1.4)
        put(creak_groan(rng, d), t0 + rng.uniform(-0.3, 0.3), rng.uniform(0.5, 1.0), rng.uniform(-0.6, 0.6))
    for t0 in rng.uniform(0, dur, 8):
        ev = drop_chirp(rng.uniform(1800, 2800), rng.uniform(350, 600), rng.uniform(0.06, 0.15), 0.6, rng.uniform(0.12, 0.25))
        put(spec_filter(ev, lambda f: lp(f, 3000, 2)), t0, rng.uniform(0.12, 0.35), rng.uniform(-0.9, 0.9))
    for t0 in rng.uniform(0, dur, 10):
        put(burst(rng, 0.03, lambda f: bp(f, rng.uniform(900, 2000), 1.5), 0.005), t0, rng.uniform(0.1, 0.3), rng.uniform(-0.9, 0.9))
    for c in (0, 1):
        ch[c] = 0.6 * ch[c] + conv(ch[c], reverb_ir(rng, 2.2, 2.4, 0.05, 3000), circular=True)
    bed = np.stack([wind_layer(np.random.default_rng(900), np.random.default_rng(901 + c), n, 1.0, 0.25) for c in (0, 1)])
    bed = spec_filter(bed, lambda f: lp(f, 900, 2), circular=True)
    ch += 0.45 * bed / np.std(bed) * np.std(ch)
    return spec_filter(ch, lambda f: hp(f, 45, 2), circular=True)


# --- catalogue -------------------------------------------------------------------------------------

SOUNDS = {
    # id: (render, seed, kind)
    'sfx/rank-up': (rank_up, 6901, 'cue'),
    'sfx/rank-card': (rank_card, 6902, 'cue'),
    'sfx/grow': (grow, 6903, 'cue'),
    'sfx/post-open': (post_open, 6904, 'cue'),
    'sfx/ice-crack': (ice_crack, 6905, 'cue'),
    'sfx/post-coins': (post_coins, 8001, 'cue'),
    'ambient/winter-wind': (winter_wind, 7901, 'loop'),
    'ambient/ice-creak': (ice_creak, 7902, 'loop'),
    'ambient/market': (market, 8002, 'loop'),
}


def ffmpeg_measure(path_or_data, channels: int = 1) -> dict:
    if isinstance(path_or_data, np.ndarray):
        inp = ['-f', 'f32le', '-ar', str(SR), '-ac', str(channels), '-i', '-']
        data = (path_or_data.T if path_or_data.ndim > 1 else path_or_data).astype('<f4').tobytes()
    else:
        inp, data = ['-i', str(path_or_data)], None
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', *inp, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       input=data, capture_output=True).stderr.decode()
    s = r[r.rfind('Summary:'):]
    i = float(re.search(r'I:\s+(-?[\d.]+|-inf)', s)[1])
    pk = re.search(r'Peak:\s+(-?[\d.]+|-inf)', s)
    return {'lufs': i, 'tp': float(pk[1]) if pk else None}


def limit(x: np.ndarray, ceiling_db: float) -> np.ndarray:
    """Look-ahead peak limiter (2 ms) on the sample peaks of all channels."""
    thr = 10 ** (ceiling_db / 20) * 0.94  # inter-sample margin
    a = np.max(np.abs(np.atleast_2d(x)), axis=0)
    g = np.minimum(1, thr / np.maximum(a, 1e-12))
    w = int(0.002 * SR)
    gp = np.pad(g, (w, w), constant_values=1)
    gmin = np.lib.stride_tricks.sliding_window_view(gp, 2 * w + 1).min(axis=1)
    k = np.hanning(2 * w + 1); k /= k.sum()
    gs = np.convolve(np.pad(gmin, (w, w), mode='edge'), k, mode='valid')
    return x * gs


def master(x: np.ndarray, target: float) -> np.ndarray:
    x = x - np.mean(x, axis=-1, keepdims=True)
    x = x / np.max(np.abs(x)) * 0.5
    ch = 1 if x.ndim == 1 else x.shape[0]
    for _ in range(4):
        m = ffmpeg_measure(x, ch)
        x = x * 10 ** ((target - m['lufs']) / 20)
        m = ffmpeg_measure(x, ch)
        if m['tp'] is not None and m['tp'] > TRUE_PEAK:
            x = limit(x, TRUE_PEAK)
        elif abs(m['lufs'] - target) < 0.15:
            break
    return x


CODECS = {'ogg': lambda loop: ['-c:a', 'libvorbis', '-q:a', '0' if loop else '3'],
          'm4a': lambda loop: ['-c:a', 'aac', '-b:a', '64k' if loop else '96k']}


def encode(sid: str, x: np.ndarray, kind: str, ext: str) -> Path:
    ch = 1 if x.ndim == 1 else x.shape[0]
    data = (x.T if x.ndim > 1 else x).astype('<f4').tobytes()
    dst = (OUT / sid).with_suffix('.' + ext)
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch),
                    '-i', '-', *CODECS[ext](kind == 'loop'), '-ar', str(SR), '-ac', str(ch), '-map_metadata', '-1',
                    '-fflags', '+bitexact', '-flags:a', '+bitexact', str(dst)], input=data, check=True)
    return dst


def decode(path: Path) -> np.ndarray:
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype='<f4').astype(np.float64)


def report(sid: str, kind: str) -> dict:
    ogg = OUT / f'{sid}.ogg'
    x = decode(ogg)
    m = ffmpeg_measure(ogg)
    P = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / SR)
    band = P[(f >= 600) & (f <= 2500)].sum() / P.sum()
    phone = P[f >= 300].sum() / P.sum()
    probe = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels',
                                       '-of', 'json', str(ogg)], capture_output=True, text=True).stdout)
    r = {'id': sid, 'seconds': round(float(probe['format']['duration']), 3), 'sr': int(probe['streams'][0]['sample_rate']),
         'channels': probe['streams'][0]['channels'], 'lufs': m['lufs'], 'true_peak_dbtp': m['tp'],
         'energy_600_2500': round(float(band), 3), 'energy_above_300': round(float(phone), 3),
         'first_sample': round(float(x[0]), 5), 'last_sample': round(float(x[-1]), 5),
         'ogg_bytes': ogg.stat().st_size, 'm4a_bytes': ogg.with_suffix('.m4a').stat().st_size}
    if kind == 'loop':
        d = np.abs(np.diff(x))
        r['wrap_jump_over_p99'] = round(float(abs(x[0] - x[-1]) / np.percentile(d, 99)), 3)
    return r


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', action='append', default=[], help='render only this id (repeatable)')
    ap.add_argument('--report', action='store_true', help='measure the shipped files only')
    a = ap.parse_args()
    ids = a.only or list(SOUNDS)
    for sid in ids:
        if sid not in SOUNDS:
            sys.exit(f'unknown id {sid}')
    if not a.report:
        for sid in ids:
            fn, seed, kind = SOUNDS[sid]
            x = fn(np.random.default_rng(seed))
            target = CUE_LUFS if kind == 'cue' else LOOP_LUFS
            x = master(x, target)
            # ebur128 on a sub-second transient reads the codecs differently (block alignment, pre-echo): each
            # codec file gets its own small gain trim until its decoded file reads the target too
            for ext in CODECS:
                y = x
                for _ in range(3):
                    got = ffmpeg_measure(encode(sid, y, kind, ext))['lufs']
                    if abs(got - target) <= 0.3:
                        break
                    y = y * 10 ** ((target - got) / 20)
            print(f'rendered {sid}', file=sys.stderr)
    print(json.dumps([report(sid, SOUNDS[sid][2]) for sid in ids], indent=1))


if __name__ == '__main__':
    main()
