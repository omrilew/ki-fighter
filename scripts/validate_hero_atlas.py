#!/usr/bin/env python3
"""Pixel-level acceptance checks for the main hero atlas.

Fails (exit 1) on: semi-transparent body pixels, magenta/purple fringe,
bright green stray pixels, junk in unreferenced cells, empty frames, feet
off the baseline, baked aura left on charge bodies, aura overlapping the
body, bad aura references, and side-walk gait weights that do not match the
foot travel measured from the artwork.

Usage: python3 scripts/validate_hero_atlas.py
"""
import json, subprocess, sys
import numpy as np
from PIL import Image

DIR = 'assets/hero-animation/'
errors = []


def fail(msg):
    errors.append(msg)


def manifest():
    js = "global.window={};require('./%smanifest.js');process.stdout.write(JSON.stringify(window.KiHeroManifest))" % DIR
    return json.loads(subprocess.run(['node', '-e', js], check=True, capture_output=True).stdout)


def crop(img, rect):
    x, y, w, h = rect
    return img[y:y + h, x:x + w]


def ground_blobs(cell):
    band = (cell[83:86, :, 3] == 255).any(0)
    blobs, start = [], None
    for x in range(len(band) + 1):
        on = x < len(band) and band[x]
        if on and start is None:
            start = x
        if not on and start is not None:
            blobs.append((start, x - 1))
            start = None
    return blobs


def foot_travel(a, b):
    """Backward (leftward) travel of the planted foot from frame a to b.

    Every ground-contact blob of `a` is slid left by 0..16 px; the blob pair
    with the highest overlap ratio (IoU) is the planted foot.
    """
    best = (0.0, 0)
    for s0, s1 in ground_blobs(a):
        for t0, t1 in ground_blobs(b):
            for d in range(0, 17):
                lo, hi = max(s0 - d, t0), min(s1 - d, t1)
                inter = max(0, hi - lo + 1)
                union = (s1 - s0 + 1) + (t1 - t0 + 1) - inter
                iou = inter / union
                if iou > best[0] + 1e-9:
                    best = (iou, d)
    return best[1]


def gait_weights(cells):
    """Per-frame gait weight = measured foot travel to the next frame, min 4."""
    return [max(foot_travel(cells[i], cells[(i + 1) % len(cells)]), 4) for i in range(len(cells))]


def main():
    m = manifest()
    atlas = np.array(Image.open(DIR + 'body-atlas.png').convert('RGBA')).astype(int)
    aura = np.array(Image.open(DIR + 'charge-aura.png').convert('RGBA')).astype(int)
    cols, rows = m['grid']['columns'], m['grid']['rows']
    if atlas.shape[:2] != (rows * 96, cols * 64):
        fail('atlas size %s does not match grid %dx%d' % (atlas.shape[:2], cols, rows))
    al = atlas[..., 3]
    r, g, b = atlas[..., 0], atlas[..., 1], atlas[..., 2]

    semi = int(((al > 0) & (al < 255)).sum())
    if semi:
        fail('%d semi-transparent pixels in body atlas' % semi)
    mag = int(((al > 0) & (r > 80) & (b > 80) & (g < np.minimum(r, b) * .62)).sum())
    if mag:
        fail('%d magenta/purple fringe pixels' % mag)

    used, frames = set(), []
    for form, actions in m['clips'].items():
        for action, dirs in actions.items():
            for direction, clip in dirs.items():
                for i, f in enumerate(clip['frames']):
                    if f['sheet'] != 'body-atlas.png':
                        continue
                    used.add(tuple(f['rect'][:2]))
                    frames.append((form, action, direction, i, f))
    for row in range(rows):
        for col in range(cols):
            if (col * 64, row * 96) not in used and al[row * 96:(row + 1) * 96, col * 64:(col + 1) * 64].any():
                fail('unreferenced cell col %d row %d is not empty' % (col, row))

    green_total = 0
    for form, action, direction, i, f in frames:
        cell = crop(atlas, f['rect'])
        name = '%s.%s.%s[%d]' % (form, action, direction, i)
        if not (cell[..., 3] == 255).any():
            fail(name + ' is empty')
            continue
        cr, cg, cb = cell[..., 0], cell[..., 1], cell[..., 2]
        green = (cell[..., 3] == 255) & (cg > cr + 40) & (cg > cb + 25) & (cg > 110)
        # SSJ eyes are teal/green; allow a few pixels in the head area only
        allowed = green.copy()
        allowed[:, :] = False
        if form == 'ssj':
            allowed[:60] = green[:60]
        stray = green & ~allowed
        green_total += int(green.sum())
        if stray.any() or green[:60].sum() > 6:
            fail('%s has %d stray green pixels' % (name, int(stray.sum() + max(0, green[:60].sum() - 6))))
        if action in ('walk', 'idle', 'recharge'):
            bottom = np.nonzero((cell[..., 3] == 255).any(1))[0].max()
            if abs(bottom - (f['feet'][1] - 1)) > 1:
                fail('%s lowest pixel row %d is off the feet baseline %d' % (name, bottom, f['feet'][1] - 1))

    # charge bodies: no baked aura, aura layer separate and outside the body
    for form in ['normal', 'ssj']:
        clip = m['clips'][form]['recharge']['shared']
        if clip.get('effectOwnership') != 'separate-aura':
            fail(form + ' recharge still owns its aura')
        prev_alpha = -1
        for i, f in enumerate(clip['frames']):
            body = crop(atlas, f['rect'])
            br, bg, bb = body[..., 0], body[..., 1], body[..., 2]
            lum = (br + bg + bb) / 3
            op = body[..., 3] == 255
            if form == 'normal':
                glow = op & (bb > br + 30) & (lum > 110)
                glow[:45] = False
            else:
                edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
                glow = edge & (bg >= br * .86) & (bb <= bg * .9) & (lum > 150)
                glow[:44] = False
            if glow.sum() > 2:
                fail('%s recharge[%d] body still has %d aura pixels' % (form, i, int(glow.sum())))
            a = f.get('aura')
            if not a:
                fail('%s recharge[%d] has no aura reference' % (form, i))
                continue
            x, y, w, h = a['rect']
            if x < 0 or y < 0 or x + w > aura.shape[1] or y + h > aura.shape[0]:
                fail('%s recharge[%d] aura rect out of bounds' % (form, i))
                continue
            layer = crop(aura, a['rect'])
            if not (layer[..., 3] > 0).any():
                fail('%s recharge[%d] aura frame is empty' % (form, i))
            if i >= clip['loopStart']:
                overlap = int(((layer[..., 3] > 0) & op).sum())
                if overlap > 0.03 * op.sum():
                    fail('%s recharge[%d] aura overlaps body by %d px' % (form, i, overlap))
            if a['alpha'] < prev_alpha - 1e-9:
                fail('%s recharge aura alpha decreases at frame %d' % (form, i))
            prev_alpha = a['alpha']

    # side-walk gait weights must follow the drawn foot travel
    for form in ['normal', 'ssj']:
        clip = m['clips'][form]['walk']['right']
        cells = [crop(atlas, f['rect']) for f in clip['frames']]
        travel = [foot_travel(cells[i], cells[(i + 1) % len(cells)]) for i in range(len(cells))]
        weights = clip.get('gaitWeights')
        if not weights or len(weights) != len(cells):
            fail(form + ' walk.right has no gaitWeights')
            continue
        stride = clip.get('strideCellPx', 0)
        if not (sum(weights) <= stride <= max(55, sum(weights) * 1.2)):
            fail(form + ' walk.right strideCellPx %s inconsistent with gaitWeights' % stride)
        for i, (t, w) in enumerate(zip(travel, weights)):
            if abs(max(t, 4) - w) > 1:
                fail('%s walk.right frame %d weight %d but measured foot travel %d' % (form, i, w, t))
        print('%s walk.right measured travel %s weights %s' % (form, travel, weights))
        for name in ('restFrames',):
            if name not in clip:
                fail(form + ' walk.right missing ' + name)

    print('frames checked: %d, green pixels (SSJ eyes): %d' % (len(frames), green_total))
    if errors:
        print('\n'.join('FAIL ' + e for e in errors))
        sys.exit(1)
    print('Hero atlas pixel validation passed')


if __name__ == '__main__':
    main()
