#!/usr/bin/env python3
"""Pixel-art scenery for the open world (overworld.js).

Draws trees, stones and ground details procedurally in the game's detailed
pixel style: clustered leaf clumps lit from the top-left with 4 hard tones,
cast shadows between clumps, a selective dark outline (a darker shade of the
local colour, not black), and hard alpha. Every sprite is drawn at 4 source
pixels per world pixel, standing on its foot anchor at the bottom centre.

Output: assets/scenery-atlas.png and assets/scenery-atlas.json
  {name: {rect:[x,y,w,h], world:[w,h], foot:[x,y], solid: radius in world px}}
Deterministic (fixed seeds). Usage: python3 scripts/build-scenery-atlas.py
"""
import json, math
import numpy as np
from PIL import Image

PX = 4                    # source pixels per world pixel
OUT_PNG = 'assets/scenery-atlas.png'
OUT_JSON = 'assets/scenery-atlas.json'
LIGHT = np.array([-.55, -.7, .45]); LIGHT /= np.linalg.norm(LIGHT)


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ramp(*cols):
    return [hexrgb(c) for c in cols]


class Canvas:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.rgb = np.zeros((h, w, 3), np.uint8)
        s.a = np.zeros((h, w), bool)
        s.tone = np.full((h, w), -1, np.int16)     # tone index for outlining
        s.pal = np.full((h, w), -1, np.int16)      # palette id per pixel
        s.palettes = []

    def put(s, ys, xs, pal_id, tones):
        pal = s.palettes[pal_id]
        ys, xs, tones = np.asarray(ys), np.asarray(xs), np.broadcast_to(np.asarray(tones), np.shape(ys))
        keep = (ys >= 0) & (ys < s.h) & (xs >= 0) & (xs < s.w)
        ys, xs, tones = ys[keep], xs[keep], tones[keep]
        tones = np.clip(tones, 0, len(pal) - 1)
        s.rgb[ys, xs] = np.array(pal)[tones]
        s.a[ys, xs] = True
        s.tone[ys, xs] = tones
        s.pal[ys, xs] = pal_id

    def add_palette(s, pal):
        s.palettes.append(pal); return len(s.palettes) - 1

    def outline(s, inner=False):
        """Edge pixels take the darkest tone of their own palette (selective outline)."""
        a = s.a
        pad = np.pad(a, 1)
        edge = a & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        # only outline solid masses: thin strokes (stems, strands, petals) keep their colour
        count = sum(np.pad(a, 1)[1 + dy:1 + dy + s.h, 1 + dx:1 + dx + s.w].astype(int) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        edge &= count >= 5
        ys, xs = np.nonzero(edge)
        for y, x in zip(ys, xs):
            s.rgb[y, x] = s.palettes[s.pal[y, x]][0]
        # second, softer rim just inside the outline on the shadow side (right and bottom)
        rim = a & ~edge & (count >= 7)
        pad2 = np.pad(edge, 1)
        near = pad2[1:-1, :-2] | pad2[:-2, 1:-1]          # outline pixel to the left or above -> skip (lit side)
        right_or_below = pad2[1:-1, 2:] | pad2[2:, 1:-1]
        for y, x in zip(*np.nonzero(rim & right_or_below & ~near)):
            p = s.palettes[s.pal[y, x]]
            s.rgb[y, x] = p[1]
        if inner:   # thin dark line where a much darker tone meets a light one (clump separation)
            t = s.tone
            for y, x in zip(*np.nonzero(a)):
                if y + 1 < s.h and a[y + 1, x] and s.pal[y, x] == s.pal[y + 1, x] and t[y, x] - t[y + 1, x] >= 3:
                    s.rgb[y + 1, x] = s.palettes[s.pal[y, x]][1]

    def image(s):
        out = np.zeros((s.h, s.w, 4), np.uint8)
        out[..., :3] = s.rgb; out[..., 3] = np.where(s.a, 255, 0)
        return out


def noise2(w, h, scale, rng):
    """Cheap smooth noise: bilinear upsample of a random grid."""
    gw, gh = max(2, int(w / scale) + 2), max(2, int(h / scale) + 2)
    g = rng.random((gh, gw))
    ys = np.linspace(0, gh - 1.001, h); xs = np.linspace(0, gw - 1.001, w)
    y0 = ys.astype(int); x0 = xs.astype(int); fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
    a = g[y0][:, x0]; b = g[y0][:, x0 + 1]; c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def sphere_tone(dx, dy, r, jitter, levels, bias=0.0):
    nx, ny = dx / r, dy / r
    nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
    lum = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    lum = lum * .78 + .38 + jitter + bias
    return np.clip((lum * levels).astype(int), 0, levels - 1)


def clumps(cv, pal_id, blobs, rng, levels, rough=.22, texture=.18, leafy=True):
    """Leaf clumps: list of (cx, cy, r). Drawn back to front (top first, then lower/front)."""
    h, w = cv.h, cv.w
    tex = (noise2(w, h, 5.5, rng) - .5) + .6 * (noise2(w, h, 2.2, rng) - .5) if leafy else np.zeros((h, w))
    edge_n = noise2(w, h, 5, rng) - .5
    yy, xx = np.mgrid[0:h, 0:w]
    order = sorted(blobs, key=lambda b: b[1])
    for i, (cx, cy, r) in enumerate(order):
        d = np.hypot(xx - cx, (yy - cy) * 1.08)
        inside = d < r * (1 + edge_n * rough * 2)
        # leaf-scalloped outline
        ang = np.arctan2(yy - cy, xx - cx)
        inside &= d < r * (1 + .09 * np.sin(ang * 7 + i * 1.7) + edge_n * rough * 2)
        ys, xs = np.nonzero(inside)
        if not len(ys): continue
        t = sphere_tone(xx[ys, xs] - cx, yy[ys, xs] - cy, r, tex[ys, xs] * texture * 2, levels)
        # each clump's lower rim sits in shadow, so clumps read as separate leaf masses
        dd = d[ys, xs] / r
        lower = (yy[ys, xs] > cy + r * .25) & (dd > .78)
        t = np.where(lower, np.maximum(0, t - 1), t)
        cv.put(ys, xs, pal_id, t + 1)
    # cast shadow under clump edges: a pixel directly below a higher clump's lower rim darkens
    return cv


def trunk(cv, pal_id, x, ybot, ytop, wbot, wtop, rng, lean=0.0, marks=None, roots=True):
    for y in range(int(ytop), int(ybot) + 1):
        t = (ybot - y) / max(1, ybot - ytop)
        half = (wbot + (wtop - wbot) * t) / 2
        if roots and t < .08:
            half += (.08 - t) / .08 * wbot * .45
        cx = x + lean * t * (ybot - ytop)
        x0, x1 = int(round(cx - half)), int(round(cx + half))
        for xx in range(x0, x1 + 1):
            u = (xx - cx) / max(1, half)
            tone = 3 if u < -.35 else 2 if u < .25 else 1
            if rng.random() < .12: tone = max(1, tone - 1)
            cv.put(np.array([y]), np.array([xx]), pal_id, np.array([tone]))
        if marks is not None and rng.random() < marks:
            mx = int(cx + (rng.random() - .5) * half * 1.4)
            cv.put(np.array([y]), np.array([mx]), pal_id, np.array([0]))


def branch(cv, pal_id, x, y, ang, length, width, depth, rng):
    if depth == 0 or length < 3: return []
    x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
    steps = int(length * 1.5)
    for k in range(steps + 1):
        t = k / max(1, steps)
        px, py = x + (x2 - x) * t, y + (y2 - y) * t
        wd = width * (1 - t * .45)
        for dx in range(-int(wd / 2), int(wd / 2) + 1):
            tone = 3 if dx < 0 else 2 if dx == 0 else 1
            cv.put(np.array([int(py)]), np.array([int(px + dx)]), pal_id, np.array([tone]))
    tips = [(x2, y2)]
    n = 2 if depth > 1 else 1
    for i in range(n + (1 if rng.random() < .4 else 0)):
        tips += branch(cv, pal_id, x2, y2, ang + (rng.random() - .5) * 1.3 + (-.35 if i == 0 else .35),
                       length * (.62 + rng.random() * .15), max(1, width * .62), depth - 1, rng)
    return tips


def finish(cv, inner=True):
    cv.outline(inner)
    return cv.image()


# ----------------------------------------------------------------- species
def tree_generic(seed, w, h, trunk_pal, leaf_pal, blobs_fn, trunk_h, trunk_w, marks=None, levels=4, texture=.2):
    rng = np.random.default_rng(seed)
    cv = Canvas(w, h)
    tp = cv.add_palette(trunk_pal); lp = cv.add_palette(leaf_pal)
    cx = w // 2
    trunk(cv, tp, cx, h - 2, h - 2 - trunk_h, trunk_w, trunk_w * .55, rng, marks=marks)
    clumps(cv, lp, blobs_fn(rng, cx), rng, levels, texture=texture)
    return finish(cv)


def blob_cloud(rng, cx, top, bottom, width, n, rmin, rmax):
    out = []
    for i in range(n):
        t = i / max(1, n - 1)
        y = top + (bottom - top) * (.25 + .75 * rng.random()) if i else top + rmax * .9
        spread = width * (.35 + .65 * min(1, (y - top) / max(1, bottom - top) * 1.3))
        x = cx + (rng.random() - .5) * spread
        out.append((x, y, rmin + (rmax - rmin) * rng.random()))
    return out


def birch(seed):
    W, H = 120, 236
    def blobs(rng, cx): return blob_cloud(rng, cx, 26, 132, 84, 15, 15, 24)
    return tree_generic(seed, W, H, ramp('#2a2420', '#6f6a60', '#cfc9b8', '#f2eee2'),
                        ramp('#20381c', '#3f6a2a', '#6f9a36', '#a9c85a', '#d8e88a'), blobs, 150, 11, marks=.45, texture=.28)


def cherry(seed):
    W, H = 196, 212
    def blobs(rng, cx): return blob_cloud(rng, cx, 34, 128, 146, 14, 18, 30)
    return tree_generic(seed, W, H, ramp('#231612', '#4a2c20', '#6e4430', '#8e5c40'),
                        ramp('#5a2a3c', '#a04a68', '#d87898', '#f2a6bc', '#ffd8e2'), blobs, 108, 15, texture=.3)


def maple(seed):
    W, H = 196, 216
    def blobs(rng, cx): return blob_cloud(rng, cx, 32, 132, 144, 14, 18, 31)
    return tree_generic(seed, W, H, ramp('#231612', '#4a2c20', '#6e4430', '#8e5c40'),
                        ramp('#4a1a10', '#8e2e16', '#c8521e', '#ec8a2c', '#ffc65a'), blobs, 110, 16, texture=.28)


def poplar(seed):
    W, H = 92, 252
    def blobs(rng, cx):
        return [(cx + (rng.random() - .5) * 20, 26 + i * 15, 17 + 9 * math.sin(math.pi * (i + 1) / 12)) for i in range(11)]
    return tree_generic(seed, W, H, ramp('#231612', '#4a3226', '#6e4a34', '#8e6446'),
                        ramp('#16301e', '#2a5230', '#437a3a', '#6ea44a', '#a4cc6a'), blobs, 70, 11, texture=.25)


def willow(seed):
    rng = np.random.default_rng(seed)
    W, H = 184, 220
    cv = Canvas(W, H)
    tp = cv.add_palette(ramp('#221812', '#46301f', '#6a4a30', '#8a6644'))
    lp = cv.add_palette(ramp('#1a3420', '#305a2c', '#4f823a', '#7cac4e', '#b4d47a'))
    cx = W // 2
    trunk(cv, tp, cx, H - 2, H - 104, 18, 11, rng)
    blobs = blob_cloud(rng, cx, 34, 92, 140, 10, 20, 32)
    clumps(cv, lp, blobs, rng, 4, texture=.22)
    # hanging strands
    for k in range(130):
        x = int(cx + (rng.random() - .5) * 160)
        y0 = int(48 + rng.random() * 46)
        ln = int(46 + rng.random() * 84 * (1 - abs(x - cx) / 120))
        for y in range(y0, min(H - 16, y0 + ln)):
            xx = x + int(math.sin(y / 9 + k) * 1.5)
            tone = 3 + (1 if (y // 3 + k) % 4 == 0 else 0) - (1 if y > y0 + ln * .6 else 0) - (1 if x > cx + 30 else 0)
            cv.put(np.array([y, y]), np.array([xx, xx + 1]), lp, np.array([tone, max(1, tone - 1)]))
    return finish(cv)


def dead_tree(seed):
    rng = np.random.default_rng(seed)
    W, H = 150, 196
    cv = Canvas(W, H)
    p = cv.add_palette(ramp('#1c1410', '#3c2c22', '#5e4836', '#83684e'))
    trunk(cv, p, W // 2, H - 2, H - 80, 16, 10, rng)
    branch(cv, p, W // 2, H - 80, -math.pi / 2 - .15, 46, 9, 4, rng)
    branch(cv, p, W // 2, H - 100, -math.pi / 2 + .7, 34, 6, 3, rng)
    branch(cv, p, W // 2, H - 92, -math.pi / 2 - .9, 30, 6, 3, rng)
    return finish(cv, inner=False)


def palm(seed):
    rng = np.random.default_rng(seed)
    W, H = 176, 244
    cv = Canvas(W, H)
    tp = cv.add_palette(ramp('#2a1c12', '#5c4024', '#8a663c', '#b48e58'))
    lp = cv.add_palette(ramp('#163018', '#2c5a26', '#4a8a34', '#78b44a', '#a8d46a'))
    # curved, ringed trunk
    top = (W // 2 + 22, 64)
    for y in range(H - 2, top[1], -1):
        t = (H - 2 - y) / (H - 2 - top[1])
        cx = W // 2 - 6 + (top[0] - W // 2 + 6) * t * t
        half = 7 - 2.5 * t
        for xx in range(int(cx - half), int(cx + half) + 1):
            u = (xx - cx) / half
            tone = 3 if u < -.3 else 2 if u < .3 else 1
            if (y // 5) % 2 == 0 and abs(u) < .9: tone = max(0, tone - 1)
            cv.put(np.array([y]), np.array([xx]), tp, np.array([tone]))
    # fronds: arcs out of the crown
    for k in range(9):
        ang = -math.pi + k * math.pi / 8 + (rng.random() - .5) * .2
        L = 62 + rng.random() * 20
        for s in range(int(L * 1.6)):
            t = s / (L * 1.6)
            x = top[0] + math.cos(ang) * L * t
            y = top[1] + math.sin(ang) * L * t * .55 + (t * t) * 36
            wd = 7 * math.sin(math.pi * min(1, t * 1.1))
            for d in range(-int(wd), int(wd) + 1):
                yy = int(y + d * .55); xx = int(x - d * .2)
                if 0 <= xx < W and 0 <= yy < H:
                    tone = 3 if d < -1 else 2 if d < 2 else 1
                    if (s + d) % 5 == 0: tone = 1
                    cv.put(np.array([yy]), np.array([xx]), lp, np.array([tone]))
    # coconuts
    for dx in (-5, 3, 9):
        for yy in range(top[1] + 2, top[1] + 9):
            for xx in range(top[0] + dx - 3, top[0] + dx + 4):
                if (xx - top[0] - dx) ** 2 + (yy - top[1] - 5) ** 2 < 12:
                    cv.put(np.array([yy]), np.array([xx]), tp, np.array([1 if xx > top[0] + dx else 2]))
    return finish(cv)


def conifer(seed, snow, tall=False):
    rng = np.random.default_rng(seed)
    W, H = (110, 260) if tall else (128, 236)
    cv = Canvas(W, H)
    tp = cv.add_palette(ramp('#1e1410', '#3e2a1e', '#5e402c', '#7a563a'))
    lp = cv.add_palette(ramp('#0e2224', '#1a3c36', '#2c5c46', '#467e56', '#6ea068') if not snow else
                        ramp('#0e2026', '#1a3a3c', '#2a5650', '#3e7464', '#5e9476'))
    sp = cv.add_palette(ramp('#5a6e80', '#9cb0c2', '#d2e0ea', '#f2f8fc'))
    cx = W // 2
    trunk(cv, tp, cx, H - 2, H - 50, 12, 9, rng)
    tiers = 6 if not tall else 7
    for i in range(tiers):
        t = i / (tiers - 1)
        ytop = 10 + (H - 70) * t * .82
        yb = ytop + 46 + 10 * t
        half = 14 + (W / 2 - 12) * (.25 + .75 * t)
        for y in range(int(ytop), int(yb)):
            u = (y - ytop) / (yb - ytop)
            hw = half * (.15 + .85 * u)
            jag = math.sin(y * 1.9 + i) * 2.2
            for x in range(int(cx - hw - jag), int(cx + hw + jag) + 1):
                if not 0 <= x < W: continue
                side = (x - cx) / max(1, hw)
                tone = 4 if side < -.45 else 3 if side < .05 else 2 if side < .55 else 1
                if u > .82: tone = max(1, tone - 1)            # underside shadow
                if rng.random() < .1: tone = max(1, tone - 1)
                cv.put(np.array([y]), np.array([x]), lp, np.array([tone]))
                if snow and u < .32 + .18 * math.sin(x * .7 + i) and side < .7:
                    cv.put(np.array([y]), np.array([x]), sp, np.array([3 if side < 0 else 2]))
    return finish(cv)


def cactus(seed):
    rng = np.random.default_rng(seed)
    W, H = 92, 140
    cv = Canvas(W, H)
    p = cv.add_palette(ramp('#16301e', '#2c5a30', '#4a8a40', '#7ab65a', '#b0dc84'))
    fl = cv.add_palette(ramp('#6a1a28', '#c03a4a', '#f07a7a', '#ffc0b0'))
    def column(cx, y0, y1, r):
        for y in range(y0, y1):
            rr = r if y > y0 + r else math.sqrt(max(0, r * r - (y0 + r - y) ** 2))
            for x in range(int(cx - rr), int(cx + rr) + 1):
                u = (x - cx) / max(1, r)
                tone = 4 if u < -.5 else 3 if u < 0 else 2 if u < .5 else 1
                if abs(round(u * 3)) % 2 == 1 and abs(u) < .85: tone = max(1, tone - 1)     # ribs
                cv.put(np.array([y]), np.array([x]), p, np.array([tone]))
    cx = W // 2
    column(cx, 12, H - 2, 12)
    # arms: horizontal elbow then up
    for side, ya, top in ((-1, 70, 34), (1, 54, 22)):
        ax = cx + side * 26
        for y in range(ya - 7, ya + 8):
            for x in range(min(cx, ax), max(cx, ax) + 1):
                u = (y - ya) / 7
                cv.put(np.array([y]), np.array([x]), p, np.array([3 if u < -.3 else 2 if u < .4 else 1]))
        column(ax, top, ya + 7, 8)
    for x, y in ((cx - 3, 12), (cx + 25, 22)):
        for dy in range(-3, 3):
            for dx in range(-3, 4):
                if dx * dx + dy * dy < 9: cv.put(np.array([y + dy]), np.array([x + dx]), fl, np.array([2 if dy < 0 else 1]))
    return finish(cv, inner=False)


# ----------------------------------------------------------------- stones
def stone_blob(seed, W, H, pal, blobs, moss=None, crack=True, squash=1.0):
    rng = np.random.default_rng(seed)
    cv = Canvas(W, H)
    p = cv.add_palette(pal)
    mp = cv.add_palette(moss) if moss else None
    yy, xx = np.mgrid[0:H, 0:W]
    tex = noise2(W, H, 4, rng) - .5
    facet = noise2(W, H, 14, rng)
    for (cx, cy, rx, ry) in sorted(blobs, key=lambda b: b[1]):
        d = np.hypot((xx - cx) / rx, (yy - cy) / ry)
        ang = np.arctan2(yy - cy, xx - cx)
        inside = d < 1 + .08 * np.sin(ang * 5 + cx) + tex * .18
        inside &= yy < cy + ry * .55          # flat base
        ys, xs = np.nonzero(inside)
        # faceted lighting: quantised normals give chiselled planes
        nx = np.round((xx[ys, xs] - cx) / rx * 2.2) / 2.2
        ny = np.round((yy[ys, xs] - cy) / ry * 2.2 + (facet[ys, xs] - .5)) / 2.2
        t = sphere_tone(nx * 1.0, ny * 1.0, 1.0, tex[ys, xs] * .25, 4)
        cv.put(ys, xs, p, t + 1)
        if moss:
            m = (yy[ys, xs] < cy - ry * .25 + tex[ys, xs] * ry * .6) & (rng.random(len(ys)) < .85)
            cv.put(ys[m], xs[m], mp, (t[m] + 1).clip(1, 4))
    if crack:
        for k in range(3):
            x, y = rng.integers(W * .3, W * .7), rng.integers(H * .3, H * .7)
            for s in range(int(H * .3)):
                if 0 <= x < W and 0 <= y < H and cv.a[y, x]: cv.rgb[y, x] = pal[0]
                x += rng.integers(-1, 2); y += 1
    return finish(cv, inner=False)


GREY = ramp('#24242a', '#4c4e56', '#7a7c84', '#a8aab0', '#d6d8da')
MOSS = ramp('#1c3218', '#2e5226', '#4a7a32', '#74a446', '#a2c868')
SAND = ramp('#4a2a18', '#8a5430', '#b87a44', '#dca464', '#f4cc8c')
REDROCK = ramp('#3a1a12', '#6e3420', '#9c5230', '#c47848', '#e6a06a')
ICE = ramp('#3a5a74', '#6a94b4', '#a4c8e0', '#d4eaf6', '#ffffff')


def boulder(seed, moss=False):
    blobs = [(64, 70, 44, 36), (40, 84, 26, 20), (92, 86, 24, 18)]
    return stone_blob(seed, 132, 104, GREY, blobs, MOSS if moss else None)


def standing_stone(seed):
    blobs = [(36, 70, 22, 64)]
    img = stone_blob(seed, 72, 140, GREY, blobs, MOSS)
    return img


def hoodoo(seed):
    blobs = [(50, 140, 34, 22), (50, 100, 24, 36), (52, 58, 20, 26), (50, 30, 30, 14)]
    return stone_blob(seed, 104, 164, REDROCK, blobs, crack=False)


def sandstone(seed):
    blobs = [(70, 66, 50, 34), (34, 80, 26, 18), (108, 80, 22, 16)]
    return stone_blob(seed, 140, 100, SAND, blobs)


def ice_rock(seed):
    blobs = [(56, 62, 40, 34), (88, 76, 22, 18)]
    return stone_blob(seed, 120, 96, ICE, blobs, crack=False)


def crystal(seed):
    rng = np.random.default_rng(seed)
    W, H = 96, 112
    cv = Canvas(W, H)
    p = cv.add_palette(ramp('#103a5a', '#1e6e9a', '#3aa8d0', '#7ed8f0', '#e6fbff'))
    g = cv.add_palette(GREY)
    yy, xx = np.mgrid[0:H, 0:W]
    base = (np.hypot((xx - 48) / 40, (yy - 98) / 12) < 1)
    ys, xs = np.nonzero(base); cv.put(ys, xs, g, sphere_tone(xx[ys, xs] - 48, (yy[ys, xs] - 98) * 3, 40, 0, 4) + 1)
    for (cx, ang, L, wd) in ((48, -1.57, 86, 13), (30, -2.1, 56, 10), (66, -1.1, 62, 10), (20, -2.5, 34, 7), (78, -.7, 38, 8)):
        dx, dy = math.cos(ang), math.sin(ang)
        for s in range(int(L)):
            t = s / L
            hw = wd * (1 - max(0, t - .7) / .3)
            px, py = cx + dx * s, 98 + dy * s
            for o in range(-int(hw), int(hw) + 1):
                x, y = int(px - dy * o), int(py + dx * o)
                if 0 <= x < W and 0 <= y < H:
                    tone = 4 if o < -hw * .3 else 3 if o < hw * .2 else 2
                    if t > .85: tone = 4
                    cv.put(np.array([y]), np.array([x]), p, np.array([tone]))
    return finish(cv, inner=False)


# ----------------------------------------------------------------- ground details
def small_plants(kind, seed):
    rng = np.random.default_rng(seed)
    if kind == 'fern':
        W, H = 72, 48
        cv = Canvas(W, H); p = cv.add_palette(ramp('#12301a', '#24522a', '#3e7c36', '#62a446', '#94c862'))
        for k in range(9):
            ang = -math.pi + (k + .5) * math.pi / 9
            L = 26 + rng.random() * 10
            for s in range(int(L)):
                t = s / L
                x = W / 2 + math.cos(ang) * s; y = H - 3 + math.sin(ang) * s * .9 + t * t * 10
                for d in (-2, -1, 0, 1, 2):
                    if abs(d) <= 2 * (1 - t) + .5 and (s + d) % 3:
                        cv.put(np.array([int(y + d * .5)]), np.array([int(x + d * .3)]), p, np.array([3 - (d > 0) + (t < .3)]))
        return finish(cv, inner=False)
    if kind == 'reeds':
        W, H = 64, 72
        cv = Canvas(W, H); p = cv.add_palette(ramp('#2a3a14', '#4a6424', '#6e8c34', '#98b24c', '#c8d47a'))
        b = cv.add_palette(ramp('#2a1a10', '#4e3020', '#74482c', '#9a6440'))
        for k in range(16):
            x0 = 10 + rng.random() * 44; ht = 34 + rng.random() * 32; lean = (rng.random() - .5) * 10
            for s in range(int(ht)):
                t = s / ht
                cv.put(np.array([int(H - 2 - s)]), np.array([int(x0 + lean * t * t)]), p, np.array([2 + (k % 2)]))
            if k % 3 == 0:
                for s in range(7):
                    for d in (0, 1):
                        cv.put(np.array([int(H - 2 - ht + s)]), np.array([int(x0 + lean + d)]), b, np.array([2 - d]))
        return finish(cv, inner=False)
    if kind == 'mushrooms':
        W, H = 64, 44
        cv = Canvas(W, H); cap = cv.add_palette(ramp('#4a0e0e', '#9a1e1e', '#d43a2a', '#f06a4a', '#ffffff'))
        st = cv.add_palette(ramp('#6a5a48', '#b8a88e', '#e2d6bc', '#f8f0dc'))
        for (x, sz) in ((20, 1.0), (40, .75), (52, .55), (30, .5)):
            r = 11 * sz; hgt = 14 * sz
            for y in range(int(H - 2 - hgt), H - 2):
                for xx in range(int(x - r * .3), int(x + r * .3) + 1):
                    cv.put(np.array([y]), np.array([xx]), st, np.array([2 if xx < x else 1]))
            cy = H - 2 - hgt
            for y in range(int(cy - r * .7), int(cy + 2)):
                for xx in range(int(x - r), int(x + r) + 1):
                    if ((xx - x) / r) ** 2 + ((y - cy) / (r * .7)) ** 2 < 1:
                        t = sphere_tone(np.array([xx - x]), np.array([y - cy]), r, 0, 4)[0]
                        cv.put(np.array([y]), np.array([xx]), cap, np.array([t + 1 if t < 3 else 3]))
            for (dx, dy) in ((-.4, -.3), (.3, -.45), (.1, -.1)):
                px, py = int(x + dx * r), int(cy + dy * r)
                cv.put(np.array([py, py, py + 1]), np.array([px, px + 1, px]), cap, np.array([4, 4, 4]))
        return finish(cv, inner=False)
    if kind == 'stump':
        W, H = 64, 44
        cv = Canvas(W, H); p = cv.add_palette(ramp('#231612', '#4a2c20', '#6e4430', '#946040'))
        r = cv.add_palette(ramp('#5a4028', '#a07a50', '#c8a070', '#e8c898'))
        for y in range(16, H - 2):
            for x in range(14, 50):
                u = (x - 32) / 18
                cv.put(np.array([y]), np.array([x + (1 if y > H - 6 and abs(u) > .8 else 0)]), p, np.array([3 if u < -.3 else 2 if u < .3 else 1]))
        for y in range(10, 22):
            for x in range(14, 51):
                d = ((x - 32) / 18) ** 2 + ((y - 16) / 6) ** 2
                if d < 1: cv.put(np.array([y]), np.array([x]), r, np.array([2 if int(math.sqrt(d) * 4) % 2 else 3]))
        return finish(cv, inner=False)
    if kind == 'sunflowers':
        W, H = 72, 92
        cv = Canvas(W, H); st = cv.add_palette(ramp('#163018', '#2c5a26', '#4a8a34', '#78b44a'))
        pt = cv.add_palette(ramp('#6a3a08', '#c07a10', '#f0b420', '#ffe060', '#fff4b0'))
        ce = cv.add_palette(ramp('#1e120a', '#4a2c14', '#6e4420', '#8e5c30'))
        for (x, ht) in ((18, 60), (36, 78), (54, 54)):
            for y in range(H - 2 - ht, H - 2):
                cv.put(np.array([y]), np.array([x]), st, np.array([2]))
                cv.put(np.array([y]), np.array([x + 1]), st, np.array([1]))
            cy = H - 2 - ht
            for a in range(12):
                ang = a * math.pi / 6
                for s in range(4, 11):
                    cv.put(np.array([int(cy + math.sin(ang) * s * .8)]), np.array([int(x + math.cos(ang) * s)]), pt, np.array([3 if s < 8 else 2]))
            for y in range(cy - 4, cy + 5):
                for xx in range(x - 5, x + 6):
                    if (xx - x) ** 2 + (y - cy) ** 2 < 22: cv.put(np.array([y]), np.array([xx]), ce, np.array([2 if (xx + y) % 2 else 1]))
            for sgn in (-1, 1):
                for s in range(9):
                    cv.put(np.array([H - 20 - s // 3]), np.array([x + sgn * s]), st, np.array([3]))
        return finish(cv, inner=False)
    if kind == 'shrub':   # dry desert shrub
        W, H = 64, 40
        cv = Canvas(W, H); p = cv.add_palette(ramp('#3a2a14', '#6a5226', '#94783a', '#bca056', '#e0c87a'))
        for k in range(26):
            ang = -math.pi * rng.random(); L = 10 + rng.random() * 18
            for s in range(int(L)):
                x = 32 + math.cos(ang) * s; y = H - 3 + math.sin(ang) * s * .8
                cv.put(np.array([int(y)]), np.array([int(x)]), p, np.array([2 + (k % 3 == 0)]))
        return finish(cv, inner=False)
    raise ValueError(kind)


# ----------------------------------------------------------------- catalogue
# name: (generator, solid radius in world px for collision at the foot)
SPRITES = {
    'birch': (lambda: birch(11), 3), 'birch2': (lambda: birch(12), 3),
    'cherry': (lambda: cherry(21), 5), 'cherry2': (lambda: cherry(22), 5),
    'maple': (lambda: maple(31), 5), 'maple2': (lambda: maple(32), 5),
    'poplar': (lambda: poplar(41), 4),
    'willow': (lambda: willow(51), 5),
    'deadtree': (lambda: dead_tree(61), 4), 'deadtree2': (lambda: dead_tree(62), 4),
    'palm': (lambda: palm(71), 3),
    'fir': (lambda: conifer(81, False), 4), 'snowfir': (lambda: conifer(82, True), 4),
    'spruce': (lambda: conifer(83, False, True), 4),
    'cactus': (lambda: cactus(91), 4),
    'boulder': (lambda: boulder(101), 13), 'mossboulder': (lambda: boulder(102, True), 13),
    'menhir': (lambda: standing_stone(111), 7),
    'hoodoo': (lambda: hoodoo(121), 10),
    'sandstone': (lambda: sandstone(131), 14),
    'icerock': (lambda: ice_rock(141), 12),
    'crystal': (lambda: crystal(151), 9),
    'fern': (lambda: small_plants('fern', 161), 0),
    'reeds': (lambda: small_plants('reeds', 171), 0),
    'mushrooms': (lambda: small_plants('mushrooms', 181), 0),
    'stump': (lambda: small_plants('stump', 191), 4),
    'sunflowers': (lambda: small_plants('sunflowers', 201), 0),
    'shrub': (lambda: small_plants('shrub', 211), 0),
}


def main():
    imgs = {}
    for name, (fn, _) in SPRITES.items():
        img = fn()
        ys, xs = np.nonzero(img[..., 3])
        img = img[:ys.max() + 1, max(0, xs.min() - 1):xs.max() + 2]          # tight crop, keep foot at bottom
        imgs[name] = img
    # shelf packing
    width = 1536
    x = y = row_h = 0
    rects = {}
    for name, img in sorted(imgs.items(), key=lambda kv: -kv[1].shape[0]):
        h, w = img.shape[:2]
        if x + w > width:
            x, y, row_h = 0, y + row_h + 2, 0
        rects[name] = (x, y, w, h)
        x += w + 2; row_h = max(row_h, h)
    atlas = np.zeros((y + row_h, width, 4), np.uint8)
    meta = {}
    for name, (x, y, w, h) in rects.items():
        atlas[y:y + h, x:x + w] = imgs[name]
        # foot: centre of the lowest opaque row
        bottom = np.nonzero(imgs[name][-1, :, 3])[0]
        fx = int(bottom.mean()) if len(bottom) else w // 2
        meta[name] = {'rect': [x, y, w, h], 'world': [round(w / PX, 2), round(h / PX, 2)],
                      'foot': [fx, h], 'solid': SPRITES[name][1]}
    Image.fromarray(atlas).save(OUT_PNG, optimize=True)
    json.dump(meta, open(OUT_JSON, 'w'), indent=1)
    # the same manifest as a script, so the game needs no extra fetch
    open(OUT_JSON[:-5] + '.js', 'w').write('// Generated by scripts/build-scenery-atlas.py\nwindow.KiSceneryAtlas=' + json.dumps({'px': PX, 'sprites': meta}) + ';\n')
    print('wrote', OUT_PNG, atlas.shape[1], 'x', atlas.shape[0], len(meta), 'sprites')


if __name__ == '__main__':
    main()
