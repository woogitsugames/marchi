#!/usr/bin/env python3
"""Pixel diff of two screenshots (render #5 before/after). Prints one line per pair:
name, differing pixels (any channel), max channel delta, bounding box of the differences.
Usage: python3 tools/render5-diff.py <dirA> <dirB> [names...]  (default: every PNG in dirA)"""
import os
import sys

import numpy as np
from PIL import Image

a_dir, b_dir, *names = sys.argv[1:]
names = names or sorted(f for f in os.listdir(a_dir) if f.endswith('.png'))
for n in names:
    pa, pb = os.path.join(a_dir, n), os.path.join(b_dir, n)
    if not os.path.exists(pb):
        print(f'{n}: missing in {b_dir}')
        continue
    a = np.asarray(Image.open(pa).convert('RGB'), dtype=np.int16)
    b = np.asarray(Image.open(pb).convert('RGB'), dtype=np.int16)
    if a.shape != b.shape:
        print(f'{n}: size {a.shape} vs {b.shape}')
        continue
    d = np.abs(a - b).max(axis=2)
    ys, xs = np.nonzero(d)
    box = f'x{xs.min()}-{xs.max()} y{ys.min()}-{ys.max()}' if len(xs) else '-'
    print(f'{n}: diff_px={len(xs)} ({100 * len(xs) / d.size:.3f} %) max={int(d.max())} >6={int((d > 6).sum())} box={box}')
