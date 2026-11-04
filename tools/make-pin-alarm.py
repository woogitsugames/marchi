#!/usr/bin/env python3
"""Critical stall pin with its own shape (day 8d, a11y audit F7, D-121).

`pin-red` and `pin-brass` share one round silhouette: for a colour-blind player only brightness told them apart.
`pin-alarm` keeps the red pin's painted disc and stem (scaled to 86 % about the stem tip) and sets it on a wax-seal
rim with 14 lobes, the shape of the alarm seal in the HUD: scalloped = critical, smooth = lesser. Woodcut touches:
a dark outline, one darker cut ring and a short radial cut between lobes. Drawn natively at @2x and @3x from the
existing sprites (4x supersampled, then reduced), so the kit's painted texture stays.
Usage: python3 tools/make-pin-alarm.py  -> public/assets/ui/kit/pin-alarm@2x.png, @3x.png
"""
import math
from PIL import Image, ImageDraw

KIT = 'public/assets/ui/kit/'
WINE, WINE_HI, WAX_DK, CUT = (111, 29, 34, 255), (142, 46, 46, 255), (52, 13, 16, 255), (74, 18, 22, 255)


def lobed(cx, cy, r_in, r_out, lobes, steps=720):
    pts = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        # rounded lobes: |cos| profile, so the bites between lobes are sharp and the lobes round (a pressed seal)
        r = r_in + (r_out - r_in) * abs(math.cos(a * lobes / 2))
        pts.append((cx + r * math.sin(a), cy - r * math.cos(a)))
    return pts


def make(scale):
    src = Image.open(f'{KIT}pin-red@{scale}x.png').convert('RGBA')
    w, h = src.size
    ss = 4
    W, H = w * ss, h * ss
    # the source disc: centre and radius in file px (measured from the @3x sprite, 40 x 48 dp)
    k = scale / 3
    cx0, cy0, tip = 60.5 * k, 58 * k, 137 * k
    f = 0.86
    cy = tip - (tip - cy0) * f
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    S = lambda pts: [(x * ss, y * ss) for x, y in pts]
    r_out = min(cx0, 60 * k) - 0.6 * k
    r_in = r_out - 6.5 * k
    d.polygon(S(lobed(cx0, cy, r_in, r_out, 14)), fill=WAX_DK)
    d.polygon(S(lobed(cx0, cy, r_in - 1.6 * k, r_out - 1.8 * k, 14)), fill=WINE)
    # light catches the upper lobes (painted from above-left like the kit)
    hi = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(hi).polygon(S(lobed(cx0 - 0.8 * k, cy - 1.2 * k, r_in - 3 * k, r_out - 3.2 * k, 14)), fill=WINE_HI)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).ellipse([(cx0 - r_out) * ss, (cy - r_out) * ss, (cx0 + r_out) * ss, (cy + r_out * 0.2) * ss], fill=150)
    layer.alpha_composite(Image.composite(hi, Image.new('RGBA', (W, H), (0, 0, 0, 0)), mask))
    # woodcut cuts: one ring just outside the disc, a short radial cut in each bite between lobes
    rc = 54.5 * k * f + 1.6 * k
    d = ImageDraw.Draw(layer)
    d.ellipse([(cx0 - rc) * ss, (cy - rc) * ss, (cx0 + rc) * ss, (cy + rc) * ss], outline=CUT, width=max(2, round(0.9 * k * ss)))
    for i in range(14):
        a = math.pi * (2 * i + 1) / 14
        x0, y0 = cx0 + (rc + 0.6 * k) * math.sin(a), cy - (rc + 0.6 * k) * math.cos(a)
        x1, y1 = cx0 + (r_in + 0.4 * k) * math.sin(a), cy - (r_in + 0.4 * k) * math.cos(a)
        d.line([(x0 * ss, y0 * ss), (x1 * ss, y1 * ss)], fill=WAX_DK, width=max(2, round(0.8 * k * ss)))
    rim = layer.resize((w, h), Image.LANCZOS)
    # the red pin, 86 % about its stem tip, on top of the rim
    pin = src.resize((round(w * f), round(h * f)), Image.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.alpha_composite(rim)
    ox, oy = round(cx0 - cx0 * f), round(tip - tip * f)
    out.alpha_composite(pin, (ox, oy))
    out.save(f'{KIT}pin-alarm@{scale}x.png', optimize=True)
    return out


if __name__ == '__main__':
    for s in (2, 3):
        im = make(s)
        print(f'pin-alarm@{s}x.png', im.size)
