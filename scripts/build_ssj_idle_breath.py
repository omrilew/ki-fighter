#!/usr/bin/env python3
"""Super Saiyan idle breathing loop.

The SSJ idle used to be a single held pose per direction. This derives two
breathing poses from that same drawing (no new design): A lowers everything
above the belt by 1 px (exhale), B also lowers the head by one more pixel
and lifts the hair tips back up, so the spikes stay crisp while the
shoulders settle. Frames go in free atlas cells; manifest.js gets a 6-frame
loop base, A, B, B, A, base per direction.
Idempotent (always rebuilds from the base frames).
Usage: python3 scripts/build_ssj_idle_breath.py
"""
import re
import numpy as np
from PIL import Image

DIR = 'assets/hero-animation/'
BASE = {'down': (128, 1440), 'right': (576, 1440), 'up': (256, 1536)}
CELLS = {'down': ((0, 12), (1, 12)), 'right': ((2, 12), (3, 12)), 'up': ((4, 12), (5, 12))}
BELT = 54      # rows above this move with the chest
NECK = 36      # rows above this are the head and hair


def lower(block, top, bottom, px=1):
    """Move rows [top, bottom) down by px; the uncovered row becomes transparent."""
    out = block.copy()
    part = block[top:bottom]
    out[top + px:bottom + px] = np.where(part[..., 3:4] > 0, part, out[top + px:bottom + px] * (np.arange(bottom - top)[:, None, None] + top + px >= bottom))
    out[top:top + px] = 0
    return out


def main():
    atlas = np.array(Image.open(DIR + 'body-atlas.png').convert('RGBA'))
    for d, (bx, by) in BASE.items():
        base = atlas[by:by + 96, bx:bx + 64]
        a = lower(base, 0, BELT)
        b = lower(a, 0, NECK + 1)
        for img, (cx, cy) in zip((a, b), CELLS[d]):
            atlas[cy * 96:cy * 96 + 96, cx * 64:cx * 64 + 64] = img
    Image.fromarray(atlas).save(DIR + 'body-atlas.png', optimize=True)

    text = open(DIR + 'manifest.js').read()
    start = text.index('ssj: {')
    idle = text.index('      idle: {', start)
    end = text.index('      punch: {', idle)
    f = lambda x, y, ms: '            {"sheet": "body-atlas.png", "rect": [%d, %d, 64, 96], "durationMs": %d, "feet": [32, 86]},\n' % (x, y, ms)
    block = '      idle: {\n'
    for d, (bx, by) in BASE.items():
        (ax, ay), (bx2, by2) = [(c * 64, r * 96) for c, r in CELLS[d]]
        block += '        %s: {\n          loop: true,\n          effectOwnership: "separate",\n          frames: [\n' % d
        block += f(bx, by, 260) + f(ax, ay, 170) + f(bx2, by2, 220) + f(bx2, by2, 160) + f(ax, ay, 170) + f(bx, by, 240)
        block += '          ],\n        },\n'
    block += '      },\n'
    open(DIR + 'manifest.js', 'w').write(text[:idle] + block + text[end:])
    print('ssj idle: 6-frame breathing loop for', list(BASE))


if __name__ == '__main__':
    main()
