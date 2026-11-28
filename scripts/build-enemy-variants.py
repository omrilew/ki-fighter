#!/usr/bin/env python3
"""Regional palette variants of the existing enemies (assets/enemy-actions.webp).

Rows follow enemy-actions.webp (bandit, thug, ninja, soldier, brute); each
variant re-hues clothing and gear and leaves skin untouched, so the
animation, silhouette and pixel art stay identical. Output is a lossless
PNG with hard alpha: assets/enemy-variants.png, one 15x128 px row per
variant, in VARIANTS order.
Usage: python3 scripts/build-enemy-variants.py
"""
import colorsys
import numpy as np
from PIL import Image

SRC = 'assets/enemy-actions.webp'
OUT = 'assets/enemy-variants.png'
CELL, COLS = 128, 15
# name: (source row, hue shift in degrees, saturation scale, value scale,
#        hue window that may change or None for all non-skin colours)
VARIANTS = [
    ('dune-raider', 0, 40, .85, 1.0, None),            # bandit -> olive scarf and gear
    ('rock-brute', 1, 140, 1.1, .95, (.45, .95)),      # thug -> only cool cloth (pants, straps): rust
    ('ravine-stalker', 2, -70, 1.0, 1.0, None),        # ninja -> crimson and violet
    ('ridge-sentry', 3, 175, 1.1, .95, None),          # soldier -> teal armour
    ('sand-reaver', 0, 15, .38, 1.18, None),           # bandit -> bleached sand robes (Sunscar Desert)
    ('frost-guard', 3, 205, .5, 1.15, None),           # soldier -> icy grey-blue (Northern Peaks)
    ('wood-shade', 2, 200, .9, .85, None),             # ninja -> deep teal (Deepwood)
    ('waste-ogre', 4, 60, 1.05, .95, None),            # brute -> brass and rust (Red Wasteland)
    ('reef-pirate', 1, -40, 1.1, 1.0, (.45, .95)),     # thug -> sea blue (islands)
]


def is_skin(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    # warm tans and oranges of skin (incl. saturated shading), not reds or golds
    return .025 < h < .105 and .18 < s < .93 and v > .28


def main():
    src = np.array(Image.open(SRC).convert('RGBA'))
    out = np.zeros((CELL * len(VARIANTS), CELL * COLS, 4), np.uint8)
    for i, (name, row, shift, sat, val, window) in enumerate(VARIANTS):
        block = src[row * CELL:(row + 1) * CELL].copy()
        a = block[..., 3]
        block[..., 3] = np.where(a >= 128, 255, 0)
        ys, xs = np.nonzero(block[..., 3])
        for y, x in zip(ys, xs):
            r, g, b = (int(v) for v in block[y, x, :3])
            if is_skin(r, g, b):
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < .12:          # near-grey outlines and highlights stay put
                continue
            if window and not window[0] <= h <= window[1]:
                continue
            h = (h + shift / 360) % 1
            nr, ng, nb = colorsys.hsv_to_rgb(h, min(1, s * sat), min(1, v * val))
            block[y, x, :3] = (round(nr * 255), round(ng * 255), round(nb * 255))
        block[block[..., 3] == 0] = 0
        out[i * CELL:(i + 1) * CELL] = block
    Image.fromarray(out).save(OUT, optimize=True)
    print('wrote', OUT, [v[0] for v in VARIANTS])


if __name__ == '__main__':
    main()
