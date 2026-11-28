#!/usr/bin/env python3
"""Seamless pixel-art ground textures for the open world (overworld.js).

One 256x256 tile per ground type, drawn at 2 texels per world pixel, so a
tile covers 128x128 world px (large enough that repeats are hard to spot). Every tile wraps seamlessly (tileable noise and
wrapped stamps). Colours are deliberate GBA-style ramps; detail comes from
blade clusters, pebbles, cracks, ripples and wave lines, not blur.

The game uses each tile as *detail*: the painter multiplies the region
colour (with hillshade, roads, cliffs, foam) by tile / tile-average, so the
existing lighting stays and the texture adds crisp pixel detail.

Output: assets/ground-textures.png (tiles in a row) and
        assets/ground-textures.js (window.KiGroundTextures = {size, order}).
Usage:  python3 scripts/build-ground-textures.py
"""
import json
import numpy as np
from PIL import Image

T = 256
ORDER = ['grass', 'forest', 'pinewood', 'meadow', 'blossom', 'road', 'beach', 'desert',
         'waste', 'rock', 'snow', 'shallow', 'sea', 'deep']


def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def tnoise(rng, cells):
    """Tileable value noise in [0,1] on a TxT grid with `cells` lattice cells per side."""
    g = rng.random((cells, cells))
    t = np.arange(T) * cells / T
    i0 = np.floor(t).astype(int); f = t - i0
    f = f * f * (3 - 2 * f)
    i1 = (i0 + 1) % cells
    a = g[i0][:, i0]; b = g[i0][:, i1]; c = g[i1][:, i0]; d = g[i1][:, i1]
    fy, fx = f[:, None], f[None, :]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def fbm(rng, base=4, octaves=3):
    out = np.zeros((T, T)); amp = 1; tot = 0
    for o in range(octaves):
        out += tnoise(rng, base * 2 ** o) * amp; tot += amp; amp *= .5
    return out / tot


def ramp(field, cols, cuts):
    """Quantise a [0,1] field into a palette (hard pixel bands, no gradients)."""
    out = np.zeros((T, T, 3))
    idx = np.digitize(field, cuts)
    for k, c in enumerate(cols):
        out[idx == k] = hexrgb(c)
    return out


def put(img, x, y, col, rng=None):
    img[y % T, x % T] = hexrgb(col) if isinstance(col, str) else col


def stamp_blade(img, x, y, h, cols, rng):
    lean = rng.choice([-1, 0, 0, 1])
    for k in range(h):
        put(img, x + (lean if k > h // 2 else 0), y - k, cols[min(len(cols) - 1, k * len(cols) // h)])


def grass_like(seed, ramp_cols, blade_cols, flowers=(), flower_rate=0, petals=None, litter=None):
    rng = np.random.default_rng(seed)
    f = fbm(rng, 6, 3) * .7 + tnoise(rng, 32) * .3
    img = ramp(f, ramp_cols, [.38, .5, .62])
    # blade clusters: little tufts of 2-4 px strokes, light tips on the lit side
    for _ in range(2080):
        x, y = rng.integers(0, T, 2)
        stamp_blade(img, x, y, rng.integers(2, 5), blade_cols, rng)
    if litter:
        for _ in range(litter[1] * 4):
            x, y = rng.integers(0, T, 2)
            c = litter[0][rng.integers(0, len(litter[0]))]
            put(img, x, y, c); put(img, x + 1, y, c)
    for _ in range(flower_rate * 4):
        x, y = rng.integers(0, T, 2)
        c = flowers[rng.integers(0, len(flowers))]
        put(img, x, y, c); put(img, x + 1, y, c); put(img, x, y + 1, c); put(img, x + 1, y + 1, c)
        put(img, x, y + 2, '#2c4a26')
    if petals:
        for _ in range(petals[1] * 4):
            x, y = rng.integers(0, T, 2)
            put(img, x, y, petals[0][rng.integers(0, len(petals[0]))])
    return img


def dirt_like(seed, cols, pebble_cols, crack_col, pebbles=140, cracks=10):
    rng = np.random.default_rng(seed)
    f = fbm(rng, 8, 3) * .75 + tnoise(rng, 40) * .25
    img = ramp(f, cols, [.4, .52, .64])
    for _ in range(pebbles * 4):
        x, y = rng.integers(0, T, 2)
        s = rng.integers(1, 3)
        for dy in range(s):
            for dx in range(s + 1):
                put(img, x + dx, y + dy, pebble_cols[0])
        put(img, x, y, pebble_cols[1])                         # lit top-left pixel
        put(img, x + s, y + s, pebble_cols[2])                 # shadow under
    for _ in range(cracks * 4):
        x, y = rng.integers(0, T, 2)
        for _ in range(rng.integers(6, 16)):
            put(img, x, y, crack_col)
            x += rng.choice([-1, 0, 1]); y += rng.choice([0, 1, 1])
    return img


def sand_like(seed, cols, ripple_col, light_col, shells=0):
    rng = np.random.default_rng(seed)
    f = fbm(rng, 6, 3)
    img = ramp(f, cols, [.42, .55, .68])
    # wind ripples: wavy short lines, shadow below and light above
    for _ in range(184):
        x, y = rng.integers(0, T, 2); ln = rng.integers(8, 22)
        for k in range(ln):
            yy = y + int(round(np.sin((x + k) / 5.0) * 1.2))
            put(img, x + k, yy, ripple_col); put(img, x + k, yy - 1, light_col)
    for _ in range(shells * 4):
        x, y = rng.integers(0, T, 2)
        put(img, x, y, '#f4e6d2'); put(img, x + 1, y, '#d8b8a0')
    for _ in range(360):
        x, y = rng.integers(0, T, 2); put(img, x, y, light_col if rng.random() < .5 else cols[0])
    return img


def snow_like(seed):
    rng = np.random.default_rng(seed)
    f = fbm(rng, 5, 3)
    img = ramp(f, ['#d6e1ec', '#dfe8f1', '#e8eff5', '#f1f6fa'], [.38, .52, .66])
    for _ in range(160):                                       # drift lines
        x, y = rng.integers(0, T, 2); ln = rng.integers(10, 26)
        for k in range(ln):
            put(img, x + k, y + int(np.sin((x + k) / 7.0) * 1.5), '#bccbdc')
    for _ in range(280):                                       # sparkle
        x, y = rng.integers(0, T, 2); put(img, x, y, '#ffffff')
    return img


def water_like(seed, cols, line_col, glint_col, lines=60):
    rng = np.random.default_rng(seed)
    f = fbm(rng, 5, 3)
    img = ramp(f, cols, [.4, .55, .7])
    for _ in range(lines * 4):                                 # wave lines: short arcs
        x, y = rng.integers(0, T, 2); ln = rng.integers(5, 12)
        for k in range(ln):
            yy = y - int(round(np.sin(np.pi * k / ln) * 1.6))
            put(img, x + k, yy, line_col)
        put(img, x + ln // 2, y - 2, glint_col)
    return img


TILES = {
    'grass': lambda: grass_like(1, ['#3d6234', '#4a7038', '#557d3e', '#628a45'], ['#33552c', '#4f7a3a', '#7aa452'],
                                flowers=['#f2e27a', '#ffffff'], flower_rate=7),
    'forest': lambda: grass_like(2, ['#29452c', '#314f32', '#3a5a37', '#43643c'], ['#22392a', '#3b5c38', '#55804a'],
                                 litter=(['#5a4a2a', '#6b5530', '#3e5a2e'], 160)),
    'pinewood': lambda: grass_like(3, ['#263f33', '#2d4838', '#35523e', '#3d5c44'], ['#1f3529', '#365742', '#4f7856'],
                                   litter=(['#6a4a2e', '#7a5634', '#4a3a26'], 220)),
    'meadow': lambda: grass_like(4, ['#5a7a3a', '#668641', '#729249', '#7f9e52'], ['#4f6e34', '#6f9246', '#9cc064'],
                                 flowers=['#f6e27a', '#ffffff', '#f0a6c0', '#ffd36b'], flower_rate=30),
    'blossom': lambda: grass_like(5, ['#56763c', '#628244', '#6d8e4b', '#7a9a53'], ['#4b6a36', '#6a8c47', '#94b866'],
                                  petals=(['#f6c4d4', '#f0a6bf', '#ffe0ea'], 130), flower_rate=6, flowers=['#ffffff']),
    'road': lambda: dirt_like(6, ['#8a6c4a', '#977856', '#a48462', '#b0906c'], ['#7a6a58', '#c8b394', '#5a4632'], '#6e543a', 170, 6),
    'beach': lambda: sand_like(7, ['#cfb27a', '#d9bd86', '#e2c892', '#ead29e'], '#c2a46e', '#f2e0b6', shells=14),
    'desert': lambda: sand_like(8, ['#c89c5c', '#d4a868', '#deb474', '#e6c082'], '#b98d50', '#f0d29a'),
    'waste': lambda: dirt_like(9, ['#7e4a30', '#8c5636', '#9a623e', '#a66e46'], ['#6a4a3a', '#c08a66', '#4a2a1c'], '#5a321e', 90, 26),
    'rock': lambda: dirt_like(10, ['#6a6660', '#76726a', '#827d74', '#8e897e'], ['#5c5852', '#b0aca2', '#3e3c38'], '#4e4a44', 200, 18),
    'snow': lambda: snow_like(11),
    'shallow': lambda: water_like(12, ['#3c8e92', '#43969a', '#4a9da0', '#52a4a6'], '#66b2b2', '#9cd6d2', 22),
    'sea': lambda: water_like(13, ['#235f79', '#27657f', '#2b6b85', '#30718b'], '#3b7d96', '#6aa4ba', 22),
    'deep': lambda: water_like(14, ['#183e5c', '#1b4362', '#1e4868', '#224d6e'], '#28567a', '#4f7c9c', 16),
}


def main():
    atlas = np.zeros((T, T * len(ORDER), 3), np.uint8)
    for k, name in enumerate(ORDER):
        atlas[:, k * T:(k + 1) * T] = np.clip(TILES[name](), 0, 255).astype(np.uint8)
    Image.fromarray(atlas).save('assets/ground-textures.png', optimize=True)
    open('assets/ground-textures.js', 'w').write('// Generated by scripts/build-ground-textures.py\nwindow.KiGroundTextures=' +
                                                 json.dumps({'size': T, 'texelsPerPx': 2, 'order': ORDER}) + ';\n')
    print('wrote assets/ground-textures.png', atlas.shape[1], 'x', atlas.shape[0])


if __name__ == '__main__':
    main()
