#!/usr/bin/env python3
"""Remove the remaining purple/pink and soft pixels from the hero art.

body-atlas.png: muted purple pixels left in gi and boot shading by the
  original colour-key are replaced with the median of their non-purple
  neighbours (no new art, same silhouette).
transformation-fit.png: the pink haze in the Super Saiyan transformation
  is recoloured to the gold of the aura, and alpha is made hard (fully
  opaque or transparent), so no soft white/pink film sits on the body.

Idempotent. Usage: python3 scripts/clean_hero_fringe.py
"""
import colorsys
import numpy as np
from PIL import Image

DIR = 'assets/hero-animation/'


def purple_mask(a, min_sat, min_val=0):
    r, g, b = (a[..., i].astype(float) / 255 for i in range(3))
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # pink/magenta/violet: red and blue both clearly above green
    return (a[..., 3] > 0) & (r - g > .12) & (b - g > .12) & (sat > min_sat) & (mx > min_val)


def clean_body():
    path = DIR + 'body-atlas.png'
    a = np.array(Image.open(path).convert('RGBA'))
    ai = a.astype(int)
    validator_rule = (ai[..., 3] > 0) & (ai[..., 0] > 80) & (ai[..., 2] > 80) & (ai[..., 1] < np.minimum(ai[..., 0], ai[..., 2]) * .62)
    bad = purple_mask(a, .2, .42) | validator_rule   # mid-tone purples; the dark outlines stay
    ys, xs = np.nonzero(bad)
    out = a.copy()
    for y, x in zip(ys, xs):
        y0, y1, x0, x1 = max(0, y - 2), y + 3, max(0, x - 2), x + 3
        win, ok = a[y0:y1, x0:x1].reshape(-1, 4), (~bad[y0:y1, x0:x1] & (a[y0:y1, x0:x1, 3] > 0)).reshape(-1)
        if ok.any():
            # the neighbour colour closest to the median, so no new colour is invented
            cand = win[ok][:, :3].astype(int)
            med = np.median(cand, axis=0)
            out[y, x, :3] = cand[np.argmin(((cand - med) ** 2).sum(1))]
        else:
            out[y, x, :3] = (36, 26, 40)
    # Silhouette outline pixels drawn in dark purple read as a violet fringe
    # against grass and sand: make them the neutral dark-brown outline.
    o = out.astype(int)
    op = o[..., 3] > 0
    pad = np.pad(op, 1)
    edge = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    violet = edge & (o[..., 0] - o[..., 1] > 10) & (o[..., 2] - o[..., 1] > 10)
    v = o[..., :3].max(-1)
    shade = np.clip(v, 20, 70)
    out[violet, 0] = shade[violet]
    out[violet, 1] = (shade[violet] * .72).astype(np.uint8)
    out[violet, 2] = (shade[violet] * .7).astype(np.uint8)
    Image.fromarray(out).save(path, optimize=True)
    print('body-atlas: replaced', len(ys), 'purple pixels,', int(violet.sum()), 'violet outline pixels')


def clean_transformation():
    path = DIR + 'transformation-fit.png'
    a = np.array(Image.open(path).convert('RGBA'))
    pink = purple_mask(a, .03) | ((a[..., 0].astype(int) - a[..., 1] > 14) & (a[..., 2].astype(int) - a[..., 1] > 8) & (a[..., 3] > 0))
    n = int(pink.sum())
    for y, x in zip(*np.nonzero(pink)):
        r, g, b = (a[y, x, :3] / 255)
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        nr, ng, nb = colorsys.hsv_to_rgb(.13, min(1, s * 1.1 + .15), min(1, v * 1.02))
        a[y, x, :3] = (round(nr * 255), round(ng * 255), round(nb * 255))
    alpha = a[..., 3]
    soft = int(((alpha > 0) & (alpha < 255)).sum())
    a[..., 3] = np.where(alpha >= 128, 255, 0).astype(np.uint8)
    a[a[..., 3] == 0] = 0
    Image.fromarray(a).save(path, optimize=True)
    print('transformation: recoloured', n, 'pink pixels, hardened', soft, 'soft pixels')


if __name__ == '__main__':
    clean_body()
    clean_transformation()
