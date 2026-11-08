#!/usr/bin/env python3
"""Audio mix audit: loudness, loop seams and 1-4 kHz band energy for every shipped sound.

Reads gains from src/audio/sounds.ts (regex, no TS needed), decodes public/assets/audio/**/*.ogg
(and .m4a for seam/padding checks) with ffmpeg, prints JSON. Needs numpy + ffmpeg.
  python3 tools/audio-mix-audit.py > /tmp/mix.json
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

BASE = Path(__file__).resolve().parents[1]
SR = 48000
BUS = {'ambient': 0.55, 'sfx': 0.65, 'ui': 0.7}  # defaults in AudioEngine / app.ts
LOOP_LEVEL = {'ambient.morning': .72, 'ambient.evening': .72, 'ambient.rain': .79, 'ambient.river': .72,
              'cart.dirt': .72, 'cart.cobble': .63, 'work.mill': .85,
              'ambient.winterWind': .72, 'ambient.iceCreak': .72, 'ambient.market': .7}  # max level the bindings/engine pass

def decode(path, mono=True):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1' if mono else '2',
                          '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64)

def ebur(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', str(path), '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True).stderr
    summ = r[r.rfind('Summary:'):]
    g = lambda k: (re.search(k + r':\s+(-?[\d.]+|-inf)', summ) or [None, None])[1]
    return {'lufs_i': float(g('I')), 'lra': float(g('LRA')), 'true_peak_dbtp': float(g('Peak'))}

def db(x): return 20 * np.log10(max(x, 1e-9))

def active_rms(x, win=0.02):
    n = int(SR * win)
    k = len(x) // n
    if k == 0: return db(np.sqrt(np.mean(x ** 2)))
    r = np.sqrt(np.mean(x[:k * n].reshape(k, n) ** 2, axis=1))
    top = r.max()
    sel = r >= top * 10 ** (-25 / 20)  # windows within 25 dB of the loudest = the audible event
    return db(np.sqrt(np.mean(r[sel] ** 2)))

def biquad(x, b, a):
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2 = b; a1, a2 = a[1], a[2]
    for i, v in enumerate(x.tolist()):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, v, y1, o
        y[i] = o
    return y

def k_weight(x):  # ITU-R BS.1770 pre-filter + RLB, coefficients for 48 kHz
    x = biquad(x, (1.53512485958697, -2.69169618940638, 1.19839281085285), (1, -1.69065929318241, 0.73248077421585))
    return biquad(x, (1, -2, 1), (1, -1.99004745483398, 0.99007225036621))

def phone_hp(x, fc=300.0):  # crude small-speaker model: 2nd-order Butterworth high-pass
    w = np.tan(np.pi * fc / SR); k = np.sqrt(2) * w; n = 1 / (1 + k + w * w)
    return biquad(x, (n, -2 * n, n), (1, 2 * (w * w - 1) * n, (1 - k + w * w) * n))

def band_db(x, lo, hi):
    """Mean power spectrum energy (dB re full scale^2) in [lo,hi] Hz over active windows."""
    n = 2048
    if len(x) < n: x = np.pad(x, (0, n - len(x)))
    w = np.hanning(n)
    frames = [x[i:i + n] * w for i in range(0, len(x) - n + 1, n // 2)]
    P = np.array([np.abs(np.fft.rfft(f)) ** 2 for f in frames])
    e = P.sum(axis=1)
    keep = e >= e.max() * 10 ** (-2.5)
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f >= lo) & (f <= hi)
    tot = P[keep].mean(axis=0).sum()
    b = P[keep].mean(axis=0)[band].sum()
    norm = (w ** 2).sum() * n / 2  # Parseval scale to mean-square
    return 10 * np.log10(max(b / norm, 1e-18)), b / max(tot, 1e-30)

def seam(x):
    d = np.abs(np.diff(x))
    jump = abs(x[0] - x[-1])
    p99 = np.percentile(d, 99); med = np.median(d)
    n = int(SR * 0.2)
    a, b = np.sqrt(np.mean(x[-n:] ** 2)), np.sqrt(np.mean(x[:n] ** 2))
    return {'wrap_jump': float(jump), 'diff_p99': float(p99), 'jump_over_p99': float(jump / max(p99, 1e-9)),
            'jump_over_median': float(jump / max(med, 1e-9)), 'tail_head_rms_db': float(db(b) - db(a)),
            'first_sample': float(x[0]), 'last_sample': float(x[-1])}

def probe(path):
    r = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,start_time:stream=sample_rate,channels',
                                   '-of', 'json', str(path)], capture_output=True, text=True).stdout)
    return float(r['format']['duration']), float(r['format'].get('start_time', 0))

src = (BASE / 'src/audio/sounds.ts').read_text()
defs = {}
for m in re.finditer(r"'([\w.]+)':\s*asset\('([\w/-]+)',\s*'(\w+)',\s*([\d.]+)(?:,\s*\{([^}]*)\})?\)", src):
    id_, name, ch, gain, opt = m.groups()
    o = {}
    for k in ('radius', 'cooldown'):
        mm = re.search(k + r':\s*([\d.]+)', opt or '')
        if mm: o[k] = float(mm[1])
    o['loop'] = 'loop: true' in (opt or '')
    defs[id_] = dict(file=name, channel=ch, gain=float(gain), **o)

stall = decode(BASE / 'public/assets/audio/ui/stall.ogg')
res = {}
for id_, d in defs.items():
    ogg = BASE / f"public/assets/audio/{d['file']}.ogg"; m4a = ogg.with_suffix('.m4a')
    x = decode(ogg)
    e = ebur(ogg)
    lvl = LOOP_LEVEL.get(id_, 1.0)
    eff_lin = d['gain'] * BUS[d['channel']] * lvl
    arms = active_rms(x)
    xs = x[:SR * 6]  # filters are slow pure-python; 6 s is plenty for loops
    karms = active_rms(k_weight(xs)) + 0.691
    parms = active_rms(phone_hp(xs))
    b, frac = band_db(x, 1000, 4000)
    r = dict(d, seconds=len(x) / SR, sample_peak_db=db(np.abs(x).max()), rms_db=db(np.sqrt(np.mean(x ** 2))),
             active_rms_db=arms, k_active_db=karms, phone_active_db=parms, eff_gain_db=db(eff_lin), eff_active_rms_db=arms + db(eff_lin), eff_k_db=karms + db(eff_lin), eff_phone_db=parms + db(eff_lin),
             eff_peak_db=db(np.abs(x).max()) + db(eff_lin), band_1_4k_db=b + db(eff_lin), band_1_4k_frac=frac, **e)
    d_ogg, st_ogg = probe(ogg); d_m4a, st_m4a = probe(m4a)
    r.update(dur_ogg=d_ogg, dur_m4a=d_m4a, m4a_start_time=st_m4a)
    if d['loop']: r['seam'] = seam(x); r['seam_m4a'] = seam(decode(m4a))
    res[id_] = r
json.dump(res, sys.stdout, indent=1)
