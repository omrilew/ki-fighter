#!/usr/bin/env python3
"""Raditz enemy sprite: side view, drawn at 64x64 native pixels and doubled
to the 128 px cells of assets/enemy-actions.webp.

A 2D skeleton (hips, knees, feet, shoulders, elbows, fists, head) is posed
per frame; each body part is filled at native resolution with hard-edged
3-tone shading lit from the upper left, then outlined. One design, every
frame, so the character stays consistent.

Frame order matches enemy-actions.webp rows: 0-2 idle, 3-7 walk,
8-12 attack, 13 hurt, 14 knocked out.
Usage: python3 scripts/draw-raditz.py [--preview]
"""
import math
import sys

import numpy as np
from PIL import Image

N = 64
OUT = 'assets/raditz-actions.png'


def hexes(*h):
    return [tuple(int(x[i:i + 2], 16) for i in (1, 3, 5)) for x in h]


C = {
    'hair': hexes('#0b0a0f', '#1e1c24', '#36333f'),
    'skin': hexes('#a35f3c', '#e3a06b', '#f8cf9f'),
    'armor': hexes('#2c2d33', '#4b4d57', '#9a9ea8'),
    'rim': hexes('#7d808b', '#b5b8c2', '#e6e8ee'),
    'strap': hexes('#5e1d12', '#963420', '#c45a34'),
    'suit': hexes('#08080c', '#18181f', '#2c2c36'),
    'boot': hexes('#5e1d12', '#963420', '#c45a34'),
    'cuff': hexes('#2a2b31', '#4f515b', '#80838e'),
    'band': hexes('#6e1414', '#ab2626', '#d84a3c'),
    'lens': hexes('#126b2c', '#2fae4f', '#8ff0a4'),
}
OUTLINE = (12, 10, 14)
EYE = (250, 248, 240)


class Canvas:
    def __init__(self):
        self.col = np.zeros((N, N, 3), np.uint8)
        self.part = np.full((N, N), -1, int)
        self.n = 0

    def fill(self, mask, ramp, light):
        """light: per-pixel 0..2 tone index array (same shape)."""
        self.n += 1
        ys, xs = np.nonzero(mask)
        for y, x in zip(ys, xs):
            self.col[y, x] = C[ramp][int(light[y, x])]
            self.part[y, x] = self.n


YY, XX = np.mgrid[0:N, 0:N] + .5


def seg_dist(a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-6
    t = np.clip(((XX - ax) * dx + (YY - ay) * dy) / L2, 0, 1)
    px, py = ax + dx * t, ay + dy * t
    # signed side (+ = left/upper side of the segment direction)
    side = (dx * (YY - ay) - dy * (XX - ax)) / math.sqrt(L2)
    return np.hypot(XX - px, YY - py), t, side


def limb(cv, a, b, r0, r1, ramp, lit_side=-1):
    d, t, side = seg_dist(a, b)
    r = r0 + (r1 - r0) * t
    mask = d <= r
    # light from the upper left: the side facing (-x,-y) is lit
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    nx, ny = -dy / L, dx / L          # normal on the +side
    facing = -(nx * -.7 + ny * -.7)   # >0 if +side faces away from light
    s = side * (1 if facing < 0 else -1)
    light = np.where(s > r * .25, 2, np.where(s < -r * .35, 0, 1))
    cv.fill(mask, ramp, light)


def ellipse(cv, c, rx, ry, ramp, angle=0.0):
    ca, sa = math.cos(angle), math.sin(angle)
    x, y = XX - c[0], YY - c[1]
    u, v = (x * ca + y * sa) / rx, (-x * sa + y * ca) / ry
    mask = u * u + v * v <= 1
    lit = (u * -.7 + v * -.7)
    light = np.where(lit > .35, 2, np.where(lit < -.35, 0, 1))
    cv.fill(mask, ramp, light)
    return mask


def polygon(cv, pts, ramp, shade=None):
    pts = np.array(pts, float)
    inside = np.zeros((N, N), bool)
    j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]
        xj, yj = pts[j]
        cond = ((yi > YY) != (yj > YY)) & (XX < (xj - xi) * (YY - yi) / ((yj - yi) or 1e-9) + xi)
        inside ^= cond
        j = i
    if shade is None:
        cx, cy = pts.mean(0)
        lit = -(XX - cx) * .7 - (YY - cy) * .7
        span = max(1, np.abs(pts - pts.mean(0)).max())
        shade = np.where(lit > span * .25, 2, np.where(lit < -span * .3, 0, 1))
    cv.fill(inside, ramp, shade)
    return inside


def outline(cv):
    filled = cv.part >= 0
    img = np.zeros((N, N, 4), np.uint8)
    img[filled, :3] = cv.col[filled]
    img[filled, 3] = 255
    pad = np.pad(filled, 1)
    edge = ~filled & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    img[edge, :3] = OUTLINE
    img[edge, 3] = 255
    # inner lines where parts meet (darken the pixel of the later/front part's neighbour)
    p = cv.part
    for dy, dx in ((0, 1), (1, 0)):
        a = p[:N - dy, :N - dx]
        b = p[dy:, dx:]
        diff = (a >= 0) & (b >= 0) & (a != b)
        ys, xs = np.nonzero(diff)
        for y, x in zip(ys, xs):
            # darken the pixel that belongs to the part drawn earlier (behind)
            if a[y, x] < b[y, x]:
                img[y, x, :3] = (img[y, x, :3] * .45).astype(np.uint8)
            else:
                img[y + dy, x + dx, :3] = (img[y + dy, x + dx, :3] * .45).astype(np.uint8)
    return img


# ---------------------------------------------------------------- pose / draw
BASE = dict(
    hip=(30, 37), lean=4,                     # torso lean forward (px at shoulders)
    bknee=(22, 45), bfoot=(16, 55),           # back leg
    fknee=(37, 46), ffoot=(40, 55),           # front leg
    bshoulder=(28, 24), belbow=(23, 29), bfist=(27, 22),   # back arm: guard near the chin
    fshoulder=(36, 25), felbow=(38, 32), ffist=(44, 28),   # front arm: guard forward
    head=(37, 16), tilt=0.0, mane=0.0, ko=False, hurt=False)


def draw(pose):
    P = dict(BASE, **pose)
    cv = Canvas()
    hx, hy = P['head']
    hipx, hipy = P['hip']
    sx = hipx + P['lean']
    chest = (sx + 2, hipy - 9)
    # --- mane: long spiky locks trailing behind (left) from the back of the head
    sway = P['mane']
    locks = [(0, 18, 5.5), (-2, 26, 6), (-4, 32, 6), (-1, 36, 5.5), (-6, 38, 5), (-9, 34, 4.5),
             (-12, 28, 4), (-14, 20, 3.5), (-10, 14, 4)]
    for k, (ox, ln, w) in enumerate(locks):
        top = (hx - 5 + ox * .25, hy - 3 + k * .5)
        tip = (hx - 9 + ox + sway * (1 + k * .25), hy + ln)
        limb(cv, top, tip, w, .4, 'hair')
    # --- back arm (behind body)
    limb(cv, P['bshoulder'], P['belbow'], 3.2, 2.8, 'skin')
    limb(cv, P['belbow'], P['bfist'], 2.8, 2.6, 'skin')
    bf = P['bfist']
    be = P['belbow']
    limb(cv, ((be[0] * .5 + bf[0] * .5), (be[1] * .5 + bf[1] * .5)), ((be[0] * .2 + bf[0] * .8), (be[1] * .2 + bf[1] * .8)), 2.9, 2.9, 'band')
    ellipse(cv, bf, 3.2, 3.0, 'skin')
    # --- back leg
    limb(cv, (hipx - 3, hipy), P['bknee'], 4.2, 3.4, 'skin')
    limb(cv, P['bknee'], P['bfoot'], 3.4, 2.8, 'skin')
    bft = P['bfoot']
    limb(cv, (bft[0] + .5, bft[1] - 5), (bft[0], bft[1] - 1), 3.4, 3.4, 'cuff')
    polygon(cv, [(bft[0] - 4, bft[1] - 3), (bft[0] + 2, bft[1] - 4), (bft[0] + 4, bft[1] + 1), (bft[0] - 6, bft[1] + 1)], 'boot')
    # --- torso: black suit core, red skirt flaps, armour chest, shoulder straps
    polygon(cv, [(hipx - 6, hipy + 2), (hipx + 6, hipy + 2), (sx + 7, hipy - 14), (sx - 5, hipy - 15)], 'suit')
    polygon(cv, [(hipx - 7, hipy - 1), (hipx - 1, hipy - 1), (hipx - 3, hipy + 7), (hipx - 8, hipy + 5)], 'strap')
    polygon(cv, [(hipx + 1, hipy - 1), (hipx + 7, hipy - 1), (hipx + 7, hipy + 6), (hipx + 3, hipy + 8)], 'strap')
    armor = polygon(cv, [(sx - 7, hipy - 3), (sx + 9, hipy - 3), (sx + 11, hipy - 14), (sx + 6, hipy - 18), (sx - 7, hipy - 16)], 'armor')
    # light grey rim along the bottom and front edge of the chest plate
    rim = armor & (((YY > hipy - 5) & (YY < hipy - 2)) | (XX > sx + 7))
    cv.fill(rim, 'rim', np.where(XX < sx, 2, 1))
    # shoulder straps over the shoulder
    polygon(cv, [(sx - 7, hipy - 17), (sx + 4, hipy - 20), (sx + 7, hipy - 15), (sx - 4, hipy - 11)], 'strap')
    polygon(cv, [(sx + 1, hipy - 12), (sx + 10, hipy - 14), (sx + 11, hipy - 11), (sx + 3, hipy - 8)], 'strap')
    # --- front leg
    limb(cv, (hipx + 3, hipy + 1), P['fknee'], 4.4, 3.6, 'skin')
    limb(cv, P['fknee'], P['ffoot'], 3.6, 3.0, 'skin')
    ff = P['ffoot']
    limb(cv, (ff[0] - .5, ff[1] - 5), (ff[0], ff[1] - 1), 3.6, 3.6, 'cuff')
    polygon(cv, [(ff[0] - 3, ff[1] - 4), (ff[0] + 3, ff[1] - 3), (ff[0] + 7, ff[1] + 1), (ff[0] - 4, ff[1] + 1)], 'boot')
    # --- head: skull, jaw, hair crown spikes, face
    ellipse(cv, (hx + 1, hy + 2), 6.6, 7.2, 'skin', P['tilt'])
    polygon(cv, [(hx - 1, hy + 4), (hx + 7, hy + 3), (hx + 6, hy + 9), (hx + 1, hy + 10)], 'skin')
    crown = [(-11, -6), (-9, -12), (-5, -10), (-3, -17), (1, -11), (4, -16), (6, -9), (10, -12), (9, -5), (12, -4), (7, -1)]
    pts = [(hx - 7, hy + 3), (hx - 10, hy - 1)]
    for dx, dy in crown:
        pts.append((hx + dx, hy + dy))
    pts += [(hx + 5, hy - 1), (hx + 2, hy - 2), (hx - 1, hy + 1), (hx - 3, hy + 4)]
    polygon(cv, pts, 'hair')
    # neck
    limb(cv, (sx + 2, hipy - 16), (hx, hy + 6), 2.8, 2.4, 'skin')
    # --- front arm (in front of everything)
    limb(cv, P['fshoulder'], P['felbow'], 3.4, 3.0, 'skin')
    limb(cv, P['felbow'], P['ffist'], 3.0, 2.8, 'skin')
    fe, fx_ = P['felbow'], P['ffist']
    limb(cv, ((fe[0] * .55 + fx_[0] * .45), (fe[1] * .55 + fx_[1] * .45)), ((fe[0] * .25 + fx_[0] * .75), (fe[1] * .25 + fx_[1] * .75)), 3.1, 3.1, 'band')
    ellipse(cv, fx_, 3.4, 3.2, 'skin')
    img = outline(cv)
    # face details at pixel level (after outline): eye, brow, scouter
    ex, ey = int(hx + 4), int(hy + 1)
    if not P['ko']:
        img[ey, ex, :3] = EYE
        img[ey, ex + 1, :3] = OUTLINE
        img[ey - 1, ex - 1:ex + 2, :3] = OUTLINE           # angry brow
        img[ey - 2, ex - 2, :3] = OUTLINE
        img[ey + 4, ex:ex + 2, :3] = C['skin'][0]           # mouth line
    lx, ly = int(hx + 6), int(hy)
    for y in range(ly - 1, ly + 2):
        for x in range(lx, lx + 2):
            img[y, x, :3] = C['lens'][2 if y == ly - 1 else 1]
            img[y, x, 3] = 255
    img[ly - 2, lx - 1:lx + 2, :3] = C['cuff'][2]
    img[ly - 2, lx - 1:lx + 2, 3] = 255
    return img


# ---------------------------------------------------------------- animation
def frames():
    f = []
    # idle: breathing
    for k, b in enumerate((0, 1, 0)):
        f.append(draw(dict(hip=(30, 37 + b), head=(37, 16 + b), bshoulder=(28, 24 + b), fshoulder=(36, 25 + b),
                           bfist=(27, 22 + b), ffist=(44, 28 + b), belbow=(23, 29 + b), felbow=(38, 32 + b), mane=b * .5)))
    # walk: alternate legs, arms swing a little
    walk = [((20, 45), (14, 55), (38, 45), (43, 55)), ((25, 45), (22, 55), (35, 46), (36, 55)),
            ((30, 46), (31, 55), (30, 45), (27, 55)), ((35, 45), (39, 55), (24, 45), (19, 55)),
            ((28, 46), (28, 55), (32, 45), (33, 55))]
    for k, (bk, bf, fk, ff) in enumerate(walk):
        lift = (0, -1, 0, -1, 0)[k]
        f.append(draw(dict(hip=(30, 37 + lift), head=(37, 16 + lift), bknee=bk, bfoot=bf, fknee=fk, ffoot=ff,
                           bshoulder=(28, 24 + lift), fshoulder=(36, 25 + lift), bfist=(27, 22 + lift),
                           ffist=(44 - k % 2, 28 + lift), belbow=(23, 29 + lift), felbow=(38, 32 + lift), mane=-1 + k * .5)))
    # attack: wind-up, lunge, straight punch, hold, return
    attack = [dict(lean=2, ffist=(36, 30), felbow=(33, 31), head=(35, 17)),
              dict(lean=5, hip=(31, 37), ffist=(48, 25), felbow=(41, 27), head=(38, 16), mane=-1.5),
              dict(lean=7, hip=(33, 37), ffist=(55, 23), felbow=(47, 24), head=(40, 16), fknee=(41, 45), ffoot=(46, 55), mane=-3),
              dict(lean=7, hip=(33, 37), ffist=(55, 23), felbow=(47, 24), head=(40, 16), fknee=(41, 45), ffoot=(46, 55), mane=-3.5),
              dict(lean=4, ffist=(46, 27), felbow=(40, 30), mane=-1.5)]
    for a in attack:
        f.append(draw(a))
    # hurt: knocked back, head thrown back
    f.append(draw(dict(lean=-4, hip=(28, 38), head=(31, 17), ffist=(38, 31), felbow=(35, 33), bfist=(20, 30),
                       belbow=(22, 31), mane=3, fknee=(34, 46), ffoot=(37, 55))))
    # knocked out: lying on the ground (drawn rotated)
    ko = draw(dict(ko=True))
    # lie him down head-first behind (rotate the standing figure), then
    # place the body flat on the ground line, centred in the cell
    big = Image.new('RGBA', (N * 2, N * 2))
    big.alpha_composite(Image.fromarray(ko), (N // 2, N // 2))
    lying = big.rotate(90, resample=Image.NEAREST, expand=False)
    box = lying.getbbox()
    lying = lying.crop(box)
    cell = Image.new('RGBA', (N, N))
    cell.alpha_composite(lying, (max(0, (N - lying.width) // 2), 57 - lying.height))
    f.append(np.array(cell))
    return f


def main():
    fr = frames()
    sheet = Image.new('RGBA', (15 * 128, 128), (0, 0, 0, 0))
    for i, img in enumerate(fr):
        sheet.alpha_composite(Image.fromarray(img).resize((128, 128), Image.NEAREST), (i * 128, 0))
    sheet.save(OUT, optimize=True)
    print('wrote', OUT, len(fr), 'frames')
    if '--preview' in sys.argv:
        ref = sheet.crop((0, 0, 5 * 128, 128))
        bg = Image.new('RGBA', ref.size, (20, 20, 110, 255))
        bg.alpha_composite(ref)
        bg.save('/tmp/claude-raditz-preview.png')


if __name__ == '__main__':
    main()
