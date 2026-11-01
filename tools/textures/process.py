"""Build shipping PBR textures from Poly Haven JPG downloads (see fetch.py).
usage:
  python3 -I process.py <src_dir> <out_root> <raw_dir>              # 1k sources -> 1024 (+512 terrain) JPG + PNG
  python3 -I process.py <src_dir> <out_root> <raw_dir> --tiers      # 4k sources -> 4096 / 2048 albedo+orm, 1024 normals (raw RGBA for ktx.mjs)
  python3 -I process.py <src_dir> <out_root> <raw_dir> --tiers --normals   # only the 1024 tier normals
The --tiers mode writes no JPGs (KTX2 only, see docs/ASSETS.md): raw files are
<raw_dir>/<set>__<map>_<size>.rgba (Y not flipped; ktx.mjs flips at encode time).
Tier normals are 1024 px for high AND ultra (APK budget, D-22); ktx.mjs names them normal.ktx2.
Grading is identical in both modes; thatch crop/cross-fade lengths scale with the source size.
"""
import sys, os, json
import numpy as np
from PIL import Image

SRC, OUT, RAW = sys.argv[1], sys.argv[2], sys.argv[3]
TIERS = '--tiers' in sys.argv[4:]
NORMALS_ONLY = '--normals' in sys.argv[4:]
NORMAL_TIER_SIZE = 1024   # high + ultra normals (D-22: 2048 UASTC normals were 45 MB of the APK)
ONLY = [a for a in sys.argv[4:] if not a.startswith('--')]
# --tiers: sizes per set. Bark stays 2k (thin trunks, never fills the screen).
TIER_SIZES = {'bark': [2048]}
DEFAULT_TIER_SIZES = [4096, 2048]

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
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float32) / 255

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

def write_rgba(im, path):
    with open(path, 'wb') as f:
        f.write(im.convert('RGBA').tobytes())

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
    if ONLY and name not in ONLY:
        continue
    d = load(f'{SRC}/{pid}_diff.jpg')
    n = load(f'{SRC}/{pid}_nor_gl.jpg')
    arm = load(f'{SRC}/{pid}_arm.jpg')
    sc = d.shape[0] / 1024                       # 1 for 1k sources, 4 for 4k
    if name == 'thatch':
        c_ = int(round(96 * sc))
        d, n, arm = thatch_fix(d, c_, c_), renorm(thatch_fix(n, c_, c_)), thatch_fix(arm, c_, c_)
        # flatten the low-frequency top-to-bottom shading so V tiling shows no band
        rm = d.mean(axis=1)                      # (h, 3) per-row mean
        k_ = int(round(81 * sc)) | 1; pad = np.concatenate([rm[-k_:], rm, rm[:k_]])
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
    if TIERS:
        ns = NORMAL_TIER_SIZE                     # one normal size for high + ultra (D-22)
        nim = to_img(n, ns)
        if nim.size[0] < n.shape[1]:              # downsampled normals get shorter: renormalise
            nim = to_img(renorm(np.asarray(nim).astype(np.float32) / 255), ns)
        write_rgba(nim, f'{RAW}/{name}__normal_{ns}.rgba')
        if NORMALS_ONLY:
            print(name, 'normal', ns, flush=True)
            continue
        for s in TIER_SIZES.get(name, DEFAULT_TIER_SIZES):
            write_rgba(to_img(g, s), f'{RAW}/{name}__albedo_{s}.rgba')
            write_rgba(to_img(orm, s), f'{RAW}/{name}__orm_{s}.rgba')
            if s == max(TIER_SIZES.get(name, DEFAULT_TIER_SIZES)):   # preview for the contact sheet
                to_img(g, 1024).save(f'{RAW}/{name}__albedo_preview.jpg', quality=92)
                to_img(g, s).crop((0, 0, 1024, 1024)).save(f'{RAW}/{name}__albedo_crop.png')
        report[name] = {'source': pid, 'src_px': d.shape[1], 'sizes': TIER_SIZES.get(name, DEFAULT_TIER_SIZES),
                        'mean_before': '#%02x%02x%02x' % tuple((before[0] * 255).astype(int)),
                        'mean_after': '#%02x%02x%02x' % tuple((after[0] * 255).astype(int)),
                        'sat_before': round(before[1][0], 3), 'sat_after': round(after[1][0], 3)}
        print(name, report[name], flush=True)
        continue
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
