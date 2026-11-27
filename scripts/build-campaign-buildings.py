#!/usr/bin/env python3
"""Generate the campaign building sheet (assets/campaign-buildings.png).

Original buildings in a rounded, retro-futuristic adventure style, drawn as
hard-edged pixel art at 112x112 and upscaled 2x so each cell matches the
224x224 cells of assets/world-props.webp. Deterministic: rerun to rebuild.

Cells (left to right): dome-home, dome-hut, sea-house, round-tower, cliff, pod.
Usage: python3 scripts/build-campaign-buildings.py
"""
import json
import math
import random

import numpy as np
from PIL import Image

N = 112          # authoring resolution per cell
SCALE = 2        # output cell = 224 px, like world-props.webp
OUT = 'assets/campaign-buildings.png'
META = 'assets/campaign-buildings.json'
LIGHT = np.array([-0.55, -0.65, 0.52])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
OUTLINE = (34, 26, 30, 255)


def ramp(*hexes):
    return [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,) for h in hexes]


# 4-tone ramps, dark -> light
WHITE = ramp('#7d8597', '#b9c2cf', '#e4e9ef', '#fbfdff')
CREAM = ramp('#8f7a62', '#c7ae8b', '#e8d5b3', '#fff1d6')
BLUE = ramp('#1c3566', '#2f5ba3', '#4b86d0', '#8cc1f2')
ORANGE = ramp('#7c3214', '#b8561f', '#e0823a', '#f6b46a')
TEAL = ramp('#1f4f55', '#2f7a7c', '#4fa6a0', '#8fd3c2')
RED = ramp('#5e1e22', '#94302f', '#c64c3f', '#e98466')
STONE = ramp('#4b4a4a', '#6f6d68', '#96928a', '#bdb8ac')
WOOD = ramp('#3d2618', '#64412a', '#8e6440', '#b58b5c')
GLASS = ramp('#163049', '#24607f', '#4fa3c1', '#bdf0ff')
GRASS = ramp('#203a24', '#2f5a30', '#4d7d3a', '#7fa64c')


class Canvas:
    def __init__(self):
        self.px = np.zeros((N, N, 4), np.uint8)
        self.mask = np.zeros((N, N), bool)

    def put(self, x, y, color):
        if 0 <= x < N and 0 <= y < N:
            self.px[y, x] = color
            self.mask[y, x] = True

    def tone(self, ramp_, k):
        return ramp_[max(0, min(len(ramp_) - 1, k))]


def shade(nx, ny, nz, bands=4, bias=0.0, x=0, y=0):
    d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + bias
    t = np.clip((d + 0.35) / 1.25 * bands, 0, bands - 1e-6)
    k = int(t)
    # 2x2 ordered dither on the band boundary for smoother hand-pixelled shading
    if t - k > (.25, .75)[(x + y) % 2] and k < bands - 1 and t - k > .55:
        k += 1
    return k


def dome(cv, cx, base, rx, ry, rmp, band=None, band_rows=(), bias=0.0, seams=0, rings=(), grime=True):
    """Upper half-ellipsoid dome sitting on y=base, with panel seams."""
    region = np.zeros((N, N), bool)
    for y in range(int(base - ry), int(base) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            u, v = (x + .5 - cx) / rx, (base - (y + .5)) / ry
            r = u * u + v * v
            if r <= 1 and v >= 0:
                nz = math.sqrt(max(0, 1 - r))
                k = shade(u, -v, nz, bias=bias, x=x, y=y)
                ramp_ = band if band is not None and int(base - y) in band_rows else rmp
                # meridian panel seams
                if seams and v < .93:
                    ang = math.asin(max(-1, min(1, u / max(.05, math.sqrt(max(.0025, 1 - v * v))))))
                    if abs((ang / math.pi * seams) % 1 - .5) > .46:
                        k = max(0, k - 1)
                if int(base - y) in rings:
                    k = max(0, k - 1)
                # grime gathers near the ground
                if grime and base - y < 4 and (x * 7 + y * 3) % 5 < 2:
                    k = max(0, k - 1)
                # specular highlight
                if (u + .42) ** 2 + (v - .62) ** 2 < .012:
                    k = len(ramp_) - 1
                cv.put(x, y, cv.tone(ramp_, k))
                region[y, x] = True
    return region


def box(cv, x0, y0, x1, y1, rmp, face='front', texture=None):
    region = np.zeros((N, N), bool)
    for y in range(y0, y1):
        for x in range(x0, x1):
            k = 2 if face == 'front' else 1
            if x <= x0 + 1:
                k = 3 if face == 'front' else 2
            if x >= x1 - 3:
                k = 1
            if y >= y1 - 2 or y <= y0 + 1:
                k = max(0, k - 1)
            if texture == 'planks' and (y - y0) % 4 == 3:
                k = max(0, k - 1)
            if texture == 'planks' and (y - y0) % 4 == 0 and x % 9 == (y // 4 * 4) % 9:
                k = max(0, k - 1)
            if texture == 'bricks':
                row = (y - y0) // 3
                if (y - y0) % 3 == 2 or (x + (row % 2) * 3) % 6 == 0:
                    k = max(0, k - 1)
                elif (x * 13 + y * 7) % 11 == 0:
                    k = min(3, k + 1)
            cv.put(x, y, cv.tone(rmp, k))
            region[y, x] = True
    return region


def ivy(cv, x0, y0, x1, y1, seed, density=.35):
    rnd = random.Random(seed)
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not cv.mask[y, x]:
                continue
            fall = (y - y0) / max(1, y1 - y0)
            if rnd.random() < density * (1 - fall * .7):
                cv.px[y, x] = GRASS[rnd.choice((1, 2, 2, 3))]


def circle_window(cv, cx, cy, r, frame=WHITE):
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            d = math.hypot(x + .5 - cx - .5, y + .5 - cy - .5)
            if d <= r - .5:
                t = (x - cx) + (y - cy)
                k = 3 if t < -r * .6 else 2 if t < 0 else 1 if t < r * .7 else 0
                cv.put(x, y, GLASS[k])
            elif d <= r + .7:
                cv.put(x, y, frame[1] if (x - cx) + (y - cy) > 0 else frame[3])


def rect_window(cv, x0, y0, w, h, frame=WOOD, lit=False):
    for y in range(y0 - 1, y0 + h + 1):
        for x in range(x0 - 1, x0 + w + 1):
            edge = x in (x0 - 1, x0 + w) or y in (y0 - 1, y0 + h)
            if edge:
                cv.put(x, y, frame[0] if y == y0 + h or x == x0 + w else frame[2])
            else:
                if lit:
                    k = 3 if (x - x0) + (y - y0) < 3 else 2
                    cv.put(x, y, ramp('#7a4a16', '#c8812c', '#f2b54e', '#ffe08a')[k])
                else:
                    k = 3 if (x - x0) + (y - y0) < 3 else 2 if y < y0 + h // 2 else 1
                    cv.put(x, y, GLASS[k])
    if w >= 5:
        for y in range(y0, y0 + h):
            cv.put(x0 + w // 2, y, frame[1])


def door(cv, cx, base, w, h, rmp=WOOD, arch=True):
    x0 = cx - w // 2
    for y in range(base - h, base):
        for x in range(x0, x0 + w):
            if arch:
                top = base - h + (w / 2) - math.sqrt(max(0, (w / 2) ** 2 - (x + .5 - cx) ** 2))
                if y < top:
                    continue
            k = 2 if x < cx else 1
            if x == x0:
                k = 0
            if (x - x0) % 4 == 3:
                k = 0
            cv.put(x, y, rmp[k])
    cv.put(cx + w // 2 - 3, base - h // 2, (236, 196, 92, 255))


def outline(cv):
    m = cv.mask.copy()
    out = cv.px.copy()
    for y in range(N):
        for x in range(N):
            if m[y, x]:
                continue
            if any(0 <= y + dy < N and 0 <= x + dx < N and m[y + dy, x + dx]
                   for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y, x] = OUTLINE
    cv.px = out
    cv.mask = out[..., 3] > 0


def grass_tufts(cv, cx, base, span, seed):
    rnd = random.Random(seed)
    for i in range(int(span / 3)):
        x = int(cx - span / 2 + rnd.random() * span)
        h = 2 + rnd.randint(0, 4)
        for j in range(h):
            col = GRASS[3 if j == h - 1 else 2 if j > h // 2 else 1]
            cv.put(x + (1 if j > h - 2 and i % 2 else 0), base - j, col)
            if j < h - 1:
                cv.put(x + 1, base - j, GRASS[0])
    for i in range(3):
        x = int(cx - span / 2 + rnd.random() * span)
        cv.put(x, base - 1, (238, 226, 160, 255))


def stone_ring(cv, cx, base, rx, h):
    for y in range(base - h, base + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            k = 2 if (x // 4 + y // 3) % 2 else 1
            if y == base - h:
                k = 3
            if y == base:
                k = 0
            if (x % 4 == 0 and y < base) or y == base - h // 2 - 1:
                k = 0
            cv.put(x, y, STONE[k])


# ---------------------------------------------------------------------------
def dome_home():
    """Large white dome residence: panelled shell, blue band, porthole windows."""
    cv = Canvas()
    base = 104
    stone_ring(cv, 56, base, 52, 5)
    dome(cv, 92, base - 5, 17, 22, WHITE, band=BLUE, band_rows=range(7, 11), seams=4, rings=(15,))
    dome(cv, 52, base - 5, 46, 66, WHITE, band=BLUE, band_rows=range(18, 25), seams=7, rings=(40, 54))
    # entrance hood (short barrel) and door
    box(cv, 38, base - 32, 64, base - 5, WHITE)
    dome(cv, 51, base - 32, 15, 9, BLUE, seams=3, grime=False)
    door(cv, 51, base - 5, 16, 23, BLUE, arch=True)
    for y in range(base - 5, base - 1):
        for x in range(42, 61):
            cv.put(x, y, STONE[3 if y == base - 5 else 2])
    circle_window(cv, 22, base - 36, 6)
    circle_window(cv, 78, base - 38, 6)
    circle_window(cv, 50, base - 56, 7)
    circle_window(cv, 95, base - 14, 4)
    # roof vent + antenna with a warm beacon
    box(cv, 63, base - 70, 70, base - 64, STONE)
    # small satellite dish on a mast, with a warm beacon
    for y in range(base - 80, base - 70):
        cv.put(66, y, STONE[1])
    for i in range(7):
        for j in range(3 - abs(i - 3) // 2):
            cv.put(60 + i, base - 84 + j + abs(i - 3) // 2, WHITE[3 if i < 3 else 1])
    cv.put(66, base - 83, STONE[0])
    for dx, dy in ((0, 0), (1, 0)):
        cv.put(70 + dx, base - 74 + dy, (255, 214, 102, 255))
    ivy(cv, 4, base - 22, 22, base - 5, 11, .45)
    outline(cv)
    grass_tufts(cv, 56, base + 1, 104, 1)
    return cv, {'w': 78, 'h': 72, 'solidW': 66, 'solidH': 24}


def dome_hut():
    """Cream dome dwelling with an orange cap, shutters and a stove pipe."""
    cv = Canvas()
    base = 104
    stone_ring(cv, 56, base, 40, 4)
    dome(cv, 56, base - 4, 39, 48, CREAM, band=ORANGE, band_rows=range(34, 49), seams=6, rings=(20,))
    for wx in (27, 76):
        rect_window(cv, wx, base - 30, 9, 8, WOOD, lit=True)
        for y in range(base - 31, base - 21):
            cv.put(wx - 3, y, ORANGE[1 if y % 2 else 2])
            cv.put(wx - 2, y, ORANGE[2])
            cv.put(wx + 10, y, ORANGE[2])
            cv.put(wx + 11, y, ORANGE[1 if y % 2 else 2])
    door(cv, 56, base - 4, 14, 24, WOOD)
    for x in range(47, 66):
        cv.put(x, base - 29, ORANGE[3])
        cv.put(x, base - 28, ORANGE[1])
    box(cv, 72, base - 58, 79, base - 44, STONE, texture='bricks')
    for x in range(71, 81):
        cv.put(x, base - 59, STONE[3])
    for i, (dx, dy) in enumerate(((1, -63), (3, -67), (2, -71))):
        cv.put(75 + dx, base + dy, (200, 200, 196, 255))
        cv.put(76 + dx, base + dy - 1, (226, 226, 222, 255))
    # flower pots by the door
    for px in (38, 70):
        for y in range(base - 8, base - 3):
            for x in range(px, px + 6):
                cv.put(x, y, ORANGE[1 if x == px + 5 else 2])
        for x in range(px - 1, px + 7):
            cv.put(x, base - 9, GRASS[2 if x % 2 else 3])
        cv.put(px + 2, base - 11, (238, 120, 140, 255))
        cv.put(px + 4, base - 10, (250, 232, 150, 255))
    outline(cv)
    grass_tufts(cv, 56, base + 1, 84, 2)
    return cv, {'w': 60, 'h': 58, 'solidW': 52, 'solidH': 22}


def sea_house():
    """Two-storey seaside house: plank walls, terracotta tiles, porch."""
    cv = Canvas()
    base = 106
    for y in range(base - 6, base + 1):
        for x in range(6, 106):
            k = 2 if (x // 6) % 2 else 1
            if y == base - 6:
                k = 3
            if y >= base - 1:
                k = 0
            cv.put(x, y, WOOD[k])
    for x in range(8, 106, 10):
        for y in range(base - 17, base - 6):
            cv.put(x, y, WOOD[1])
            cv.put(x + 1, y, WOOD[2])
    for x in range(6, 106):
        cv.put(x, base - 17, WOOD[3])
        cv.put(x, base - 16, WOOD[1])
    box(cv, 14, base - 48, 98, base - 6, TEAL, texture='planks')
    box(cv, 28, base - 80, 84, base - 50, TEAL, texture='planks')

    def roof(x0, x1, y_eave, height, overhang):
        for i in range(height):
            y = y_eave - i
            inset = int(i * 1.7)
            for x in range(x0 - overhang + inset, x1 + overhang - inset):
                k = 3 if i % 3 == 0 else 2
                if x < x0 - overhang + inset + 3:
                    k = 1
                if x > x1 + overhang - inset - 4:
                    k = 1
                if i == 0:
                    k = 0
                if (x + (i // 3) * 3) % 6 == 0 and i % 3:
                    k = max(0, k - 1)
                cv.put(x, y, RED[k])

    roof(14, 98, base - 48, 9, 6)
    roof(28, 84, base - 80, 17, 6)
    for wx in (22, 80):
        rect_window(cv, wx, base - 40, 12, 11, WHITE)
        for y in range(base - 41, base - 28):
            cv.put(wx - 3, y, BLUE[2]); cv.put(wx - 2, y, BLUE[1])
            cv.put(wx + 13, y, BLUE[2]); cv.put(wx + 14, y, BLUE[1])
        for x in range(wx - 1, wx + 13):
            cv.put(x, base - 28, WOOD[2])
            cv.put(x, base - 29, GRASS[3 if x % 3 else 2])
        cv.put(wx + 3, base - 30, (240, 110, 130, 255))
        cv.put(wx + 8, base - 30, (250, 226, 120, 255))
    rect_window(cv, 38, base - 72, 11, 10, WHITE, lit=True)
    rect_window(cv, 63, base - 72, 11, 10, WHITE, lit=True)
    door(cv, 56, base - 6, 14, 24, WOOD, arch=False)
    for x in range(47, 66):
        cv.put(x, base - 31, RED[2])
        cv.put(x, base - 30, RED[0])
    for a in range(0, 360, 10):
        x = 92 + round(5 * math.cos(math.radians(a)))
        y = base - 20 + round(5 * math.sin(math.radians(a)))
        cv.put(x, y, (244, 244, 236, 255) if (a // 45) % 2 else (214, 64, 52, 255))
    outline(cv)
    return cv, {'w': 84, 'h': 80, 'solidW': 74, 'solidH': 26}


def round_tower():
    """Lookout tower: brick drum, wooden balcony, small blue dome."""
    cv = Canvas()
    base = 106
    cx, rx = 56, 19
    for y in range(base - 72, base):
        for x in range(cx - rx, cx + rx + 1):
            u = (x + .5 - cx) / rx
            nz = math.sqrt(max(0, 1 - u * u))
            k = shade(u, 0, nz, bias=.05, x=x, y=y)
            row = (base - y) // 4
            if (base - y) % 4 == 0 or (int((u + 1) * 9) + row % 2) % 3 == 0 and (base - y) % 4 == 2:
                k = max(0, k - 1)
            cv.put(x, y, STONE[k])
    ivy(cv, cx - rx, base - 40, cx - 4, base, 21, .4)
    for x in range(cx - rx - 7, cx + rx + 8):
        cv.put(x, base - 72, WOOD[3]); cv.put(x, base - 71, WOOD[1]); cv.put(x, base - 70, WOOD[0])
    for x in range(cx - rx - 7, cx + rx + 8, 4):
        for y in range(base - 79, base - 72):
            cv.put(x, y, WOOD[2])
    for x in range(cx - rx - 7, cx + rx + 8):
        cv.put(x, base - 79, WOOD[3])
    dome(cv, cx, base - 80, 17, 20, BLUE, seams=5, grime=False)
    for y in range(base - 106, base - 99):
        cv.put(cx, y, STONE[2])
    for x in range(cx - 1, cx + 5):
        cv.put(x, base - 105, RED[2] if x > cx else STONE[2])
        cv.put(x, base - 104, RED[1] if x > cx else STONE[2])
    circle_window(cv, cx, base - 52, 5)
    rect_window(cv, cx - 4, base - 34, 8, 9, WOOD, lit=True)
    door(cv, cx, base, 12, 17, WOOD)
    outline(cv)
    grass_tufts(cv, cx, base + 1, 56, 4)
    return cv, {'w': 46, 'h': 82, 'solidW': 32, 'solidH': 16}


def cliff():
    """Rock outcrop from overlapping lumpy boulders, lit from the upper left."""
    cv = Canvas()
    base = 104
    rnd = random.Random(31)
    ROCK = ramp('#3a2f2a', '#5c4a3f', '#86705a', '#b19878')
    # (centre x, ground y, radius x, radius y), back to front
    boulders = [(64, base - 6, 26, 56), (38, base - 2, 24, 44), (86, base - 2, 20, 36),
                (54, base, 18, 24), (24, base, 14, 18)]
    for bi, (bx, by, rx, ry) in enumerate(boulders):
        phase = rnd.random() * 6
        for y in range(int(by - ry * 1.1), by + 1):
            for x in range(int(bx - rx * 1.15), int(bx + rx * 1.15) + 1):
                u, v = (x + .5 - bx) / rx, (by - (y + .5)) / ry
                ang = math.atan2(v, u)
                lump = 1 + .09 * math.sin(ang * 5 + phase) + .05 * math.sin(ang * 11 + phase * 2)
                r = math.hypot(u, v * 1.0)
                if v < 0 or r > lump:
                    continue
                nz = math.sqrt(max(0, 1 - (r / lump) ** 2))
                # flattened facets: quantise the normal a little
                fu, fv = round(u * 3) / 3, round(v * 3) / 3
                k = shade(fu, -fv, nz, x=x, y=y)
                if (x * 7 + y * 3 + bi) % 29 == 0:
                    k = max(0, k - 1)
                if v < .08:
                    k = max(0, k - 1)
                cv.put(x, y, ROCK[k])
        # crack line
        cx0 = bx + rnd.randint(-rx // 3, rx // 4)
        y = int(by - ry * .75)
        x = cx0
        while y < by - 2:
            if 0 <= x < N and cv.mask[y, x]:
                cv.put(x, y, ROCK[0])
            y += 1
            x += rnd.choice((-1, 0, 0, 1))
        # moss on the upper surface
        for x in range(int(bx - rx * .7), int(bx + rx * .3)):
            ys = [yy for yy in range(N) if cv.mask[yy, x]]
            if not ys:
                continue
            for d in range(rnd.randint(1, 3)):
                cv.put(x, ys[0] + d, GRASS[3 if d == 0 else 2])
    outline(cv)
    grass_tufts(cv, 56, base + 1, 100, 6)
    return cv, {'w': 54, 'h': 52, 'solidW': 42, 'solidH': 20}


def pod():
    """Crashed space capsule, rendered as a lit 3D model then pixelised.

    Ray-traced at 4x the authoring size (sphere shell, tinted window, metal
    belt, antenna, crater lip), averaged down, quantised to a small palette
    and outlined, so the shading reads as one solid form.
    """
    S = 4
    R = N * S
    yy, xx = np.mgrid[0:R, 0:R].astype(float)
    yy = (yy + .5) / S
    xx = (xx + .5) / S
    cx, cy, r = 56.0, 60.0, 34.0
    tilt = math.radians(28)          # camera looks slightly down (3/4 view)
    # view-space sphere hit
    u = (xx - cx) / r
    v = (yy - cy) / r
    d2 = u * u + v * v
    hit = d2 <= 1
    nzv = np.sqrt(np.clip(1 - d2, 0, 1))
    # view-space normal (x right, y down, z toward camera) -> object space
    nx, ny, nz = u, v, nzv
    oy = ny * math.cos(tilt) - nz * math.sin(tilt)      # object up/down
    oz = ny * math.sin(tilt) + nz * math.cos(tilt)      # object front/back
    ox = nx
    light = np.array([-.5, -.62, .6]); light /= np.linalg.norm(light)
    lam = np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, 1)
    half = light + np.array([0, 0, 1.0]); half /= np.linalg.norm(half)
    spec = np.clip(nx * half[0] + ny * half[1] + nz * half[2], 0, 1) ** 40
    rim = np.clip(1 - nz, 0, 1) ** 3 * np.clip(nx * .7 + ny * .3, 0, 1)   # bounce light
    ao = np.clip(1.05 - np.clip(v, 0, 1) * .45, .55, 1)                                 # darker underside
    shell = np.array([236, 233, 228.0])
    col = shell * (0.58 + 0.48 * lam[..., None]) * ao[..., None] + np.array([60, 80, 110]) * .10
    col += rim[..., None] * np.array([120, 110, 95]) * .35
    # equatorial belt (object-space latitude band), slightly darker metal
    belt = (np.abs(oy - .06) < .065)
    seam = (np.abs(np.abs(oy - .06) - .065) < .012)
    rivet = belt & (np.abs(oy - .06) < .02) & (np.abs(((np.arctan2(ox, oz) * 7) % 1) - .5) < .07)
    metal = np.array([120, 124, 140.0]) * (0.35 + 0.75 * lam[..., None])
    col = np.where(belt[..., None], metal, col)
    col = np.where(seam[..., None], col * .55, col)
    col = np.where(rivet[..., None], np.array([200, 202, 214.0]) * (0.5 + .6 * lam[..., None]), col)
    # panel seams: two meridians and an upper latitude
    mer = (np.abs(ox + .45) < .012) & (oy < -.01) & (oz > 0)
    lat = np.abs(oy + .55) < .012
    col = np.where((mer | lat)[..., None], col * .72, col)
    # large round window on the front, facing the camera and to the right
    wdir = np.array([.46, -.36, .81]); wdir /= np.linalg.norm(wdir)
    cosw = nx * wdir[0] + ny * wdir[1] + nz * wdir[2]   # view space: window faces the viewer
    glass = cosw > .935
    frame = (cosw > .895) & ~glass
    t = np.clip((cosw - .935) / .065, 0, 1)
    gcol = np.array([40, 22, 70.0]) * (0.75 + .5 * t[..., None]) + np.array([190, 60, 110]) * (.45 * (1 - t))[..., None]
    # diagonal reflection streak across the glass
    gx, gy = nx - .37, ny + .29
    refl = glass & (np.abs(gx + gy * .9) < .035) & (np.hypot(gx, gy) < .2)
    gcol = np.where(refl[..., None], np.array([210, 220, 240.0]), gcol)
    col = np.where(glass[..., None], gcol, col)
    col = np.where(frame[..., None], np.array([90, 92, 108.0]) * (0.5 + .7 * lam[..., None]), col)
    col += spec[..., None] * 255 * (~glass)[..., None] * .55
    # antenna stub on top
    ant = (np.abs(xx - (cx + 12)) < 1.1) & (yy > cy - r - 7) & (yy < cy - r + 4) & ~hit
    tip = ((xx - (cx + 12)) ** 2 + (yy - (cy - r - 8)) ** 2) < 2.4
    alpha = hit | ant | tip
    col = np.where(ant[..., None], np.array([110, 110, 120.0]), col)
    col = np.where(tip[..., None], np.array([240, 80, 64.0]), col)
    # crater lip in front hides the lower shell: rough dirt berm
    rnd = np.random.default_rng(9)
    noise = rnd.normal(0, 1, R)
    noise = np.convolve(noise, np.ones(9) / 9, mode='same') * 2.2
    lipx = (xx[0] - cx) / 58
    crest = cy + 20 + 10 * lipx ** 2 + noise
    lip = (np.abs(lipx) < 1)[None, :] & (yy >= crest[None, :]) & (yy <= crest[None, :] + 12 * np.sqrt(np.clip(1 - lipx ** 2, 0, 1))[None, :] + 2)
    depth = np.clip((yy - crest[None, :]) / 12, 0, 1)
    dirt = np.array([168, 128, 88.0]) * (1 - .55 * depth[..., None]) - np.array([10, 10, 6.0]) * (noise[None, :, None] > 1)
    col = np.where(lip[..., None], dirt, col)
    # the crater itself is painted on the ground: no lip sprite, the shell
    # is simply cut where it sinks below the crater floor
    lip = np.zeros_like(lip)
    # hide the shell below the lip
    below = (yy > cy + 22 - 3 * ((xx - cx) / r) ** 2) & hit
    alpha = alpha & ~below
    # downsample (box filter) to authoring size
    col = np.clip(col, 0, 255)
    a4 = alpha.astype(float)
    cs = (col * a4[..., None]).reshape(N, S, N, S, 3).sum((1, 3))
    asum = a4.reshape(N, S, N, S).sum((1, 3))
    small = np.where(asum[..., None] > 0, cs / np.maximum(asum[..., None], 1), 0)
    mask = asum >= S * S * .5
    # quantise to a compact palette (median-cut on the visible pixels)
    img = Image.fromarray(small.astype(np.uint8), 'RGB')
    pal = img.quantize(colors=18, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q = np.array(pal)
    cv = Canvas()
    cv.px[mask, :3] = q[mask]
    cv.px[mask, 3] = 255
    cv.mask = mask.copy()
    outline(cv)
    # pebbles thrown onto the lip
    prng = random.Random(3)
    for i in range(16):
        x = prng.randint(10, 102)
        y = int(cy + 20 + 10 * ((x - cx) / 58) ** 2) + prng.randint(0, 5)
        if 0 <= y < N and cv.mask[y, x]:
            cv.put(x, y, STONE[prng.choice((2, 3))])
            cv.put(x + 1, y, STONE[1])
    return cv, {'w': 52, 'h': 50, 'solidW': 42, 'solidH': 16}

# Plants from assets/forest-detail.webp (x, width, height of the source cell),
# placed at a fraction of the cell width, at a scale; same art as the world.
BUSH, ROCK, GRASS_TUFT, FLOWERS = (452, 100, 80), (554, 75, 55), (631, 50, 45), (745, 50, 40)
PLANTS = {
    'dome-home': [(BUSH, .1, .5), (FLOWERS, .3, .7), (GRASS_TUFT, .62, .7), (BUSH, .9, .55)],
    'dome-hut': [(GRASS_TUFT, .16, .7), (BUSH, .84, .5)],
    'sea-house': [(GRASS_TUFT, .05, .6), (ROCK, .95, .5)],
    'round-tower': [(BUSH, .26, .45), (FLOWERS, .74, .6)],
}


def main():
    forest = Image.open('assets/forest-detail.webp').convert('RGBA')
    builders = [('dome-home', dome_home), ('dome-hut', dome_hut),
                ('sea-house', sea_house), ('round-tower', round_tower),
                ('cliff', cliff), ('pod', pod)]
    sheet = Image.new('RGBA', (len(builders) * N * SCALE, N * SCALE), (0, 0, 0, 0))
    meta = {}
    for i, (name, fn) in enumerate(builders):
        cv, info = fn()
        assert ((cv.px[..., 3] == 0) | (cv.px[..., 3] == 255)).all(), name
        img = Image.fromarray(cv.px).resize((N * SCALE, N * SCALE), Image.NEAREST)
        for (vx, vw, vh), fx, scale in PLANTS.get(name, []):
            plant = forest.crop((vx, 0, vx + vw, vh))
            plant = plant.crop(plant.getbbox())
            plant = plant.resize((int(plant.width * scale), int(plant.height * scale)), Image.NEAREST)
            alpha = plant.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
            plant.putalpha(alpha)
            img.alpha_composite(plant, (int(fx * N * SCALE - plant.width / 2), N * SCALE - plant.height - 2))
        sheet.alpha_composite(img, (i * N * SCALE, 0))
        meta[name] = {'frame': i, 'cell': N * SCALE, **info}
    sheet.save(OUT, optimize=True)
    with open(META, 'w') as f:
        json.dump(meta, f, indent=1)
        f.write('\n')
    print('wrote', OUT, META, list(meta))


if __name__ == '__main__':
    main()
