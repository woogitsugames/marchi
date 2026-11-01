"""Build shipping PBR textures from Poly Haven 1k JPG downloads.
usage: python3 -I process.py <src_dir> <out_root> <raw_dir>
"""
import sys, os, json
import numpy as np
from PIL import Image

SRC, OUT, RAW = sys.argv[1], sys.argv[2], sys.argv[3]

def hx(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float) / 255

# name: (polyhaven id, terrain?, saturation scale, mean-shift strength, target hex)
SETS = {
    'meadow':          ('sparse_grass',           True,  0.65, 0.50, '#56603f'),
    'mud_track':       ('brown_mud_02',           True,  0.90, 0.30, '#5a4a39'),
    'cobblestone':     ('cobblestone_floor_13',   True,  0.85, 0.25, '#8a8478'),
    'riverbank':       ('river_small_rocks',      True,  0.85, 0.25, '#6a6458'),
    'forest_floor':    ('forest_leaves_03',       True,  0.70, 0.30, '#4a4232'),
    'wood_planks':     ('old_planks_02',          False, 0.85, 0.25, '#6b5a48'),
    'thatch':          ('reed_roof_04',           False, 0.85, 0.30, '#9a8058'),
    'fieldstone_wall': ('old_stone_wall',         False, 0.85, 0.25, '#8a8478'),
    'bark':            ('bark_brown_02',          False, 0.80, 0.25, '#5a5044'),
    'plaster_daub':    ('worn_mossy_plasterwall', False, 0.85, 0.25, '#a9a497'),
}

def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float64) / 255

def thatch_fix(a, crop=96, n=96):
    """Drop the ridge band at the top, then cross-fade to make V seamless."""
    a = a[crop:]
    h = a.shape[0]
    body = a[:h - n].copy()
    w = (np.arange(n) / n)[:, None, None]
    body[:n] = a[h - n:] * (1 - w) + a[:n] * w
    return body

def to_img(a, size):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return im

def renorm(a):
    v = a * 2 - 1
    v /= np.maximum(np.linalg.norm(v, axis=2, keepdims=True), 1e-6)
    return (v + 1) / 2

def sat_stats(a):
    mx, mn = a.max(axis=2), a.min(axis=2)
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return float(s.mean()), float(np.percentile(s, 90))

report = {}
for name, (pid, terrain, sscale, k, target) in SETS.items():
    d = load(f'{SRC}/{pid}_diff.jpg')
    n = load(f'{SRC}/{pid}_nor_gl.jpg')
    arm = load(f'{SRC}/{pid}_arm.jpg')
    if name == 'thatch':
        d, n, arm = thatch_fix(d), renorm(thatch_fix(n)), thatch_fix(arm)
        # flatten the low-frequency top-to-bottom shading so V tiling shows no band
        rm = d.mean(axis=1)                      # (h, 3) per-row mean
        k_ = 81; pad = np.concatenate([rm[-k_:], rm, rm[:k_]])
        ker = np.ones(k_) / k_
        sm = np.stack([np.convolve(pad[:, c], ker, 'same') for c in range(3)], 1)[k_:-k_]
        d = d * (d.reshape(-1, 3).mean(0) / sm)[:, None, :]
    before = (d.reshape(-1, 3).mean(0), sat_stats(d))
    lum = (d * np.array([0.2126, 0.7152, 0.0722])).sum(2, keepdims=True)
    g = lum + sscale * (d - lum)
    g = g + k * (hx(target) - g.reshape(-1, 3).mean(0))
    g = np.clip(g, 0.02, 0.96)  # never pure black / white
    after = (g.reshape(-1, 3).mean(0), sat_stats(g))
    orm = arm.copy(); orm[..., 2] = 0
    od = f'{OUT}/{name}'; os.makedirs(od, exist_ok=True)
    sizes = [1024] + ([512] if terrain else [])
    for s in sizes:
        suf = '' if s == 1024 else f'_{s}'
        to_img(g, s).save(f'{od}/albedo{suf}.jpg', quality=85, optimize=True, progressive=True)
        to_img(n, s).save(f'{od}/normal{suf}.jpg', quality=90, optimize=True, progressive=True)
        to_img(orm, s).save(f'{od}/orm{suf}.jpg', quality=85, optimize=True, progressive=True)
        for m, arr in (('albedo', g), ('normal', n), ('orm', orm)):
            im = to_img(arr, s).convert('RGBA')
            im.save(f'{RAW}/{name}__{m}{suf}.png')
    report[name] = {
        'source': pid, 'terrain': terrain,
        'mean_before': '#%02x%02x%02x' % tuple((before[0] * 255).astype(int)),
        'mean_after': '#%02x%02x%02x' % tuple((after[0] * 255).astype(int)),
        'sat_before': round(before[1][0], 3), 'sat_after': round(after[1][0], 3),
        'sat90_after': round(after[1][1], 3),
    }
print(json.dumps(report, indent=1))
