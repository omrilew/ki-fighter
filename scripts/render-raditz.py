#!/usr/bin/env python3
"""Raditz, modelled in 3D (signed distance fields) and rendered to pixel art.

The character is a small set of primitives on a posed skeleton (head, mane,
armour, shoulder guards, bodysuit, armbands, boots). Each frame is ray
marched at 3x resolution with toon shading, downsampled, quantised to a
fixed palette and outlined, then face details are drawn at pixel level.
Usage: python3 scripts/render-raditz.py [--test]
"""
import math
import sys

import numpy as np
from PIL import Image

W, H = 64, 96
SS = 3                     # supersampling
FEET_Y = 88                # campaign baseline
UNIT = 33.0                # pixels per model unit (model is ~2 units tall)

# ----------------------------------------------------------------- palette
PAL = {
    'skin': ['#7a4a35', '#b77a55', '#e0a57a', '#f3c79a'],
    'hair': ['#0b0a10', '#17151f', '#26232f', '#3a3547'],
    'armor': ['#24262e', '#3b3e4a', '#5a5e6e', '#8a8fa0'],
    'pad': ['#3a2416', '#64402a', '#8f6038', '#bf8a55'],
    'suit': ['#141626', '#21253b', '#323a58', '#4a5478'],
    'band': ['#4a0e12', '#7d181c', '#ad2a2a', '#d4524a'],
    'boot': ['#3d2a1c', '#6a4a30', '#9a7248', '#c9a26c'],
    'lens': ['#0e5a28', '#1f9a45', '#55d873', '#b8ffc4'],
    'scout': ['#2a2c34', '#4c4f5c', '#7a7e8c', '#b0b4c0'],
}
MATS = list(PAL)
RGB = {k: np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in v]) for k, v in PAL.items()}
OUTLINE = np.array([16, 12, 20])


# ----------------------------------------------------------------- sdf helpers
def length(v):
    return np.sqrt((v * v).sum(-1))


def sd_sphere(p, c, r):
    return length(p - c) - r


def sd_ellipsoid(p, c, r):
    q = (p - c) / r
    k0 = length(q)
    k1 = length(q / r)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)


def sd_capsule(p, a, b, r):
    pa, ba = p - a, b - a
    h = np.clip((pa * ba).sum(-1) / (ba * ba).sum(), 0, 1)
    rr = r if np.isscalar(r) else r[0] + (r[1] - r[0]) * h
    return length(pa - ba * h[..., None]) - rr


def sd_cone(p, a, b, ra, rb):
    """Rounded cone from a (radius ra) to b (radius rb)."""
    return sd_capsule(p, a, b, (ra, rb))


def sd_box(p, c, half, rot=None, round_=0.02):
    q = p - c
    if rot is not None:
        q = q @ rot
    d = np.abs(q) - half
    return length(np.maximum(d, 0)) + np.minimum(d.max(-1), 0) - round_


def smin(a, b, k=0.04):
    h = np.clip(.5 + .5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


# ----------------------------------------------------------------- the model
def pose_defaults():
    return dict(bob=0.0, lean=0.0, twist=0.0,
                l_shoulder=(0.15, 0.0), r_shoulder=(0.15, 0.0),   # (swing fwd, raise sideways)
                l_elbow=0.35, r_elbow=0.35,
                l_hip=0.0, r_hip=0.0, l_knee=0.1, r_knee=0.1,
                stance=0.0, hair_sway=0.0, body_tilt=0.0)


def build(pose):
    """Return a list of (material, sdf_fn) for the posed character (model space, y up, +z toward viewer)."""
    P = pose
    parts = []
    hip_y = 0.98 + P['bob']
    stance = 0.13 + P['stance']
    # legs
    def leg(side, swing, knee):
        hip = np.array([side * stance, hip_y, 0])
        thigh_dir = np.array([0, -math.cos(swing), math.sin(swing)])
        knee_p = hip + thigh_dir * 0.47
        shin_dir = np.array([0, -math.cos(swing - knee), math.sin(swing - knee)])
        ankle = knee_p + shin_dir * 0.44
        parts.append(('suit', lambda p, a=hip, b=knee_p: sd_cone(p, a, b, .118, .095)))
        parts.append(('suit', lambda p, a=knee_p, b=ankle: sd_cone(p, a, b, .092, .072)))
        foot = ankle + np.array([0, -0.05, 0.06])
        parts.append(('boot', lambda p, a=ankle + np.array([0, .12, 0]), b=foot: sd_cone(p, a, b, .088, .095)))
        parts.append(('boot', lambda p, c=foot + np.array([0, -.03, .05]): sd_ellipsoid(p, c, np.array([.085, .055, .14]))))
    leg(-1, P['l_hip'], P['l_knee'])
    leg(1, P['r_hip'], P['r_knee'])
    # torso: bodysuit core, armour shell, belt-line skirt flaps
    chest = np.array([0, hip_y + 0.42, 0])
    parts.append(('suit', lambda p, c=np.array([0, hip_y + .12, 0]): sd_ellipsoid(p, c, np.array([.21, .17, .14]))))
    parts.append(('armor', lambda p, c=chest: sd_box(p, c, np.array([.2, .22, .13]), round_=.07)))
    parts.append(('armor', lambda p, c=np.array([0, hip_y + .5, .02]): sd_ellipsoid(p, c, np.array([.25, .15, .16]))))
    for side in (-1, 1):
        parts.append(('armor', lambda p, c=np.array([side * .12, hip_y + .02, .07]):
                      sd_box(p, c, np.array([.08, .1, .02]), round_=.02)))
    # shoulders: brown guards
    sh_y = hip_y + 0.62
    for side in (-1, 1):
        parts.append(('pad', lambda p, c=np.array([side * .29, sh_y + .02, 0]):
                      sd_ellipsoid(p, c, np.array([.13, .085, .13]))))
    # arms
    def arm(side, shoulder, elbow):
        swing, raise_ = shoulder
        s = np.array([side * .3, sh_y - .04, 0])
        up_dir = np.array([side * math.sin(raise_ + .12), -math.cos(swing) * math.cos(raise_), math.sin(swing)])
        up_dir /= np.linalg.norm(up_dir)
        e = s + up_dir * .34
        fore = rot_x(-elbow * (1 if True else -1)) @ up_dir if False else None
        bend = np.array([0, math.sin(elbow) * .0, 0])
        fdir = up_dir * math.cos(elbow) + np.array([0, math.sin(elbow) * .25, math.sin(elbow)]) * 1.0
        fdir /= np.linalg.norm(fdir)
        hnd = e + fdir * .31
        parts.append(('skin', lambda p, a=s, b=e: sd_cone(p, a, b, .088, .075)))
        parts.append(('skin', lambda p, a=e, b=hnd: sd_cone(p, a, b, .072, .064)))
        parts.append(('band', lambda p, a=e + fdir * .17, b=e + fdir * .27: sd_cone(p, a, b, .078, .074)))
        parts.append(('band', lambda p, a=s + up_dir * .14, b=s + up_dir * .2: sd_cone(p, a, b, .091, .089)))
        parts.append(('skin', lambda p, c=hnd + fdir * .04: sd_sphere(p, c, .072)))
        return hnd
    hands = (arm(-1, P['l_shoulder'], P['l_elbow']), arm(1, P['r_shoulder'], P['r_elbow']))
    # neck and head
    head_c = np.array([0, sh_y + .3, .02])
    parts.append(('skin', lambda p, a=np.array([0, sh_y - .05, 0]), b=head_c: sd_cone(p, a, b, .08, .07)))
    parts.append(('skin', lambda p, c=head_c: sd_ellipsoid(p, c, np.array([.125, .15, .13]))))
    parts.append(('skin', lambda p, c=head_c + np.array([0, -.08, .03]): sd_ellipsoid(p, c, np.array([.095, .08, .1]))))
    # scouter: lens over his left eye (+x side), earpiece
    parts.append(('scout', lambda p, c=head_c + np.array([.128, .0, -.01]): sd_ellipsoid(p, c, np.array([.03, .05, .05]))))
    parts.append(('lens', lambda p, c=head_c + np.array([.065, .035, .125]): sd_ellipsoid(p, c, np.array([.055, .035, .018]))))
    # hair: crown spikes plus a long mane of tapering locks down the back
    sway = P['hair_sway']
    crown = head_c + np.array([0, .08, -.02])
    for i, (ax, ay, az) in enumerate([(-.3, .9, -.1), (.3, .9, -.1), (0, 1, -.2), (-.6, .6, -.25), (.6, .6, -.25),
                                       (-.15, .85, .3), (.15, .85, .3), (0, .9, .15)]):
        d = np.array([ax, ay, az])
        d /= np.linalg.norm(d)
        parts.append(('hair', lambda p, a=crown, b=crown + d * .22: sd_cone(p, a, b, .1, .015)))
    parts.append(('hair', lambda p, c=head_c + np.array([0, .05, -.03]): sd_ellipsoid(p, c, np.array([.15, .14, .14]))))
    # bangs over the forehead
    for x in (-.07, 0, .07):
        parts.append(('hair', lambda p, a=head_c + np.array([x, .12, .07]), b=head_c + np.array([x * 1.3, .03, .13]):
                      sd_cone(p, a, b, .045, .012)))
    n = 9
    for i in range(n):
        u = i / (n - 1) * 2 - 1
        top = head_c + np.array([u * .1, .02, -.1])
        length_ = 1.05 - .25 * abs(u) - (.06 if i % 2 else 0)
        bottom = top + np.array([u * .22 + sway, -length_, -.12 - .05 * (1 - abs(u))])
        parts.append(('hair', lambda p, a=top, b=bottom: sd_cone(p, a, b, .11 - .02 * abs(u), .015)))
    return parts, head_c, hands


def scene_sdf(parts, p):
    best = np.full(p.shape[:-1], 1e9)
    mat = np.zeros(p.shape[:-1], int)
    for name, fn in parts:
        d = fn(p)
        closer = d < best
        best = np.where(closer, d, best)
        mat = np.where(closer, MATS.index(name), mat)
    return best, mat


def render(pose, yaw=0.0, tilt=0.42, roll=0.0, offset=(0, 0)):
    """Orthographic toon render; yaw 0 = facing the viewer."""
    parts, head_c, hands = build(pose)
    w, h = W * SS, H * SS
    xs = (np.arange(w) + .5) / SS
    ys = (np.arange(h) + .5) / SS
    X, Y = np.meshgrid(xs, ys)
    # screen -> model (feet centre at (32, FEET_Y))
    sx = (X - 32 - offset[0]) / UNIT
    sy = (FEET_Y - Y + offset[1]) / UNIT
    origin = np.stack([sx, sy, np.full_like(sx, 3.0)], -1)
    direction = np.array([0, 0, -1.0])
    # camera rotation: tilt looks down, yaw turns the character, roll tips him over
    R = rot_y(yaw) @ rot_x(-tilt * .0)
    view = rot_x(tilt * .35) @ rot_z(roll)
    M = (R.T @ view.T)
    o = origin @ M.T
    d = direction @ M.T
    t = np.zeros(o.shape[:-1])
    hit = np.zeros(o.shape[:-1], bool)
    for _ in range(70):
        p = o + d * t[..., None]
        dist, _ = scene_sdf(parts, p)
        hit |= dist < 1e-3
        t = np.where(hit, t, t + np.maximum(dist, 2e-3))
        if (t > 6).all():
            break
    p = o + d * t[..., None]
    dist, mat = scene_sdf(parts, p)
    hit = dist < 4e-3
    # normals by central differences
    e = 1.5e-3
    n = np.zeros_like(p)
    for k in range(3):
        dv = np.zeros(3)
        dv[k] = e
        n[..., k] = scene_sdf(parts, p + dv)[0] - scene_sdf(parts, p - dv)[0]
    n /= np.maximum(length(n)[..., None], 1e-9)
    light = np.array([-.55, .65, .55]) @ M.T
    light /= np.linalg.norm(light)
    lam = np.clip((n * light).sum(-1), 0, 1)
    rim = np.clip(1 - np.abs((n * d).sum(-1)), 0, 1) ** 3
    level = np.clip(lam * 3.2 + .35 + rim * .5, 0, 3.99).astype(int)
    # downsample by majority material / mean level
    hs, ws = H, W
    hitd = hit.reshape(hs, SS, ws, SS).mean((1, 3)) >= .5
    matd = np.zeros((hs, ws), int)
    levd = np.zeros((hs, ws), int)
    mats = mat.reshape(hs, SS, ws, SS).transpose(0, 2, 1, 3).reshape(hs, ws, SS * SS)
    levs = level.reshape(hs, SS, ws, SS).transpose(0, 2, 1, 3).reshape(hs, ws, SS * SS)
    hits = hit.reshape(hs, SS, ws, SS).transpose(0, 2, 1, 3).reshape(hs, ws, SS * SS)
    for yy in range(hs):
        for xx in range(ws):
            if not hitd[yy, xx]:
                continue
            m = mats[yy, xx][hits[yy, xx]]
            vals, counts = np.unique(m, return_counts=True)
            mm = vals[counts.argmax()]
            matd[yy, xx] = mm
            levd[yy, xx] = int(round(levs[yy, xx][hits[yy, xx] & (mats[yy, xx] == mm)].mean()))
    img = np.zeros((hs, ws, 4), np.uint8)
    for yy in range(hs):
        for xx in range(ws):
            if hitd[yy, xx]:
                img[yy, xx, :3] = RGB[MATS[matd[yy, xx]]][levd[yy, xx]]
                img[yy, xx, 3] = 255
    # outline: silhouette and boundaries between materials
    out = img.copy()
    for yy in range(hs):
        for xx in range(ws):
            if not hitd[yy, xx]:
                if any(0 <= yy + a < hs and 0 <= xx + b < ws and hitd[yy + a, xx + b] for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out[yy, xx, :3] = OUTLINE
                    out[yy, xx, 3] = 255
            else:
                m = matd[yy, xx]
                for a, b in ((1, 0), (0, 1)):
                    y2, x2 = yy + a, xx + b
                    if y2 < hs and x2 < ws and hitd[y2, x2] and matd[y2, x2] != m and {MATS[m], MATS[matd[y2, x2]]} != {'skin', 'lens'}:
                        darker = (yy, xx) if levd[yy, xx] <= levd[y2, x2] else (y2, x2)
                        out[darker[0], darker[1], :3] = (out[darker[0], darker[1], :3] * .55).astype(np.uint8)
    return out, (matd, hitd)


def main():
    if '--test' in sys.argv:
        tiles = []
        for yaw in (0.0, math.pi / 2, math.pi):
            img, _ = render(pose_defaults(), yaw=yaw)
            tiles.append(img)
        sheet = np.concatenate(tiles, 1)
        Image.fromarray(sheet).save('/tmp/claude-raditz-test.png')
        print('test written')


if __name__ == '__main__':
    main()
