#!/usr/bin/env python3
"""Research render #4: combine before/after PNGs from tools/render4-shadows.mjs into labelled JPGs.

Usage:
  python3 tools/render4-compose.py pair <before.png> <after.png> <out.jpg> <caption>
  python3 tools/render4-compose.py crop <before.png> <after.png> <out.jpg> <caption> [win=220]
  python3 tools/render4-compose.py diff <before.png> <after.png>     # prints changed-pixel stats (JSON)

pair: portrait shots side by side, landscape shots stacked; "przed" / "po" labels; long side <= 1600 px.
crop: the win x win window (screen px at DPR 2) with the largest before/after difference, zoomed 2x, side by side.
"""
import json
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
INK, PAPER = (40, 28, 18), (232, 220, 196)


def label(img, text, size):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, size)
    pad = size // 3
    x0, y0, x1, y1 = d.textbbox((0, 0), text, font=f)
    d.rectangle([0, 0, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad], fill=PAPER)
    d.text((pad - x0, pad - y0), text, font=f, fill=INK)


def caption_bar(img, text):
    f = ImageFont.truetype(FONT, 26)
    bar = Image.new('RGB', (img.width, 46), PAPER)
    ImageDraw.Draw(bar).text((12, 8), text, font=f, fill=INK)
    out = Image.new('RGB', (img.width, img.height + bar.height), PAPER)
    out.paste(bar, (0, 0))
    out.paste(img, (0, bar.height))
    return out


def pair(a, b, out, cap):
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    portrait = A.height > A.width
    gap = 8
    if portrait:
        W, H = A.width * 2 + gap, A.height
    else:
        W, H = A.width, A.height * 2 + gap
    img = Image.new('RGB', (W, H), INK)
    for i, (src, t) in enumerate(((A, 'przed'), (B, 'po'))):
        s = src.copy()
        label(s, t, 44)
        img.paste(s, ((A.width + gap) * i, 0) if portrait else (0, (A.height + gap) * i))
    k = 1600 / max(W, H)
    if k < 1:
        img = img.resize((round(W * k), round(H * k)), Image.LANCZOS)
    caption_bar(img, cap).save(out, quality=78, optimize=True, progressive=True)


def diff_map(a, b):
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    return A, B, ImageChops.difference(A, B).convert('L')


def crop(a, b, out, cap, win=220):
    A, B, D = diff_map(a, b)
    # changed-pixel mask (> 6 levels), summed per window on a coarse grid
    m = D.point(lambda v: 1 if v > 6 else 0)
    step = win // 4
    best, bx, by = -1, 0, 0
    W, H = m.size
    # ignore the HUD strips (top and bottom 12 %)
    for y in range(int(H * 0.12), int(H * 0.88) - win, step):
        for x in range(0, W - win, step):
            s = sum(m.crop((x, y, x + win, y + win)).getdata())
            if s > best:
                best, bx, by = s, x, y
    box = (bx, by, bx + win, by + win)
    gap = 8
    z = 2
    img = Image.new('RGB', (win * z * 2 + gap, win * z), INK)
    for i, (src, t) in enumerate(((A, 'przed'), (B, 'po'))):
        c = src.crop(box).resize((win * z, win * z), Image.LANCZOS)
        label(c, t, 36)
        img.paste(c, ((win * z + gap) * i, 0))
    caption_bar(img, f'{cap} (wycinek {box[0] // 2},{box[1] // 2} px, 2x)').save(out, quality=82, optimize=True)
    print(json.dumps({'box': box, 'changed': best}))


def stats(a, b):
    _, _, D = diff_map(a, b)
    h = D.histogram()
    n = sum(h)
    print(json.dumps({'pixels': n, 'gt6': sum(h[7:]), 'gt24': sum(h[25:]), 'pct_gt6': round(100 * sum(h[7:]) / n, 3), 'max': max(i for i, v in enumerate(h) if v)}))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'pair':
        pair(*sys.argv[2:6])
    elif cmd == 'crop':
        crop(*sys.argv[2:6], *(int(v) for v in sys.argv[6:7]))
    else:
        stats(*sys.argv[2:4])
