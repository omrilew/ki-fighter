#!/usr/bin/env python3
"""Clean the enemy action sheet (assets/enemy-actions.webp -> enemy-actions-clean.png).

The source was cut from a white background: ~72k semi-transparent pixels,
light pixels along every outline and loose white specks by the feet, which
read as a white halo on dark grass. This makes alpha hard, turns light
outline pixels into the dark outline colour of their neighbours, and drops
tiny specks not attached to the figure. Frames, sizes and poses are unchanged.
Usage: python3 scripts/clean-enemy-actions.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage

SRC, OUT, CELL = 'assets/enemy-actions.webp', 'assets/enemy-actions-clean.png', 128
a = np.array(Image.open(SRC).convert('RGBA')).astype(int)
alpha = a[..., 3] >= 128
rgb = a[..., :3]

# 1. drop specks: in each cell keep components of 12+ px (the figure and its gear)
H, W = alpha.shape
for y in range(0, H, CELL):
    for x in range(0, W, CELL):
        cell = alpha[y:y + CELL, x:x + CELL]
        lab, n = ndimage.label(cell, structure=np.ones((3, 3)))
        if n > 1:
            sizes = ndimage.sum(cell, lab, range(1, n + 1))
            for i, s in enumerate(sizes, 1):
                if s < 12: cell[lab == i] = False

# 2. light or washed-out pixels on the silhouette edge become the dark outline
for _ in range(2):
    pad = np.pad(alpha, 1)
    edge = alpha & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    light = rgb.min(-1) > 150
    bad = edge & light
    if not bad.any(): break
    # darkest opaque neighbour colour, else a neutral dark outline
    for y, x in zip(*np.nonzero(bad)):
        y0, y1, x0, x1 = max(0, y - 1), y + 2, max(0, x - 1), x + 2
        win = rgb[y0:y1, x0:x1][alpha[y0:y1, x0:x1]]
        dark = win[win.sum(1) < 300]
        rgb[y, x] = dark[np.argmin(dark.sum(1))] if len(dark) else (34, 24, 22)
    # a light pixel left alone on the very edge is cut instead
    pad = np.pad(alpha, 1)
    lone = alpha & (rgb.min(-1) > 200) & (sum(np.pad(alpha, 1)[1 + dy:1 + dy + H, 1 + dx:1 + dx + W].astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) <= 3)
    alpha &= ~lone

out = np.zeros((H, W, 4), np.uint8)
out[..., :3] = np.where(alpha[..., None], rgb, 0).clip(0, 255)
out[..., 3] = np.where(alpha, 255, 0)
Image.fromarray(out).save(OUT, optimize=True)
op = out[..., 3] > 0
pad = np.pad(op, 1); edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
print('wrote', OUT, 'light edge px left', int((edge & (out[..., :3].min(-1) > 200)).sum()))
