#!/usr/bin/env python3
"""Rebuild the main hero atlas from a pinned source revision.

What it does (no new character art is drawn):
  1. Hard alpha: every body pixel is fully opaque or fully transparent.
  2. Removes magenta/purple colour-key fringe (edge -> dark outline,
     interior -> median of its neighbours).
  3. Clears atlas cells that no clip references (chroma-key leftovers).
  4. Splits the baked charge aura out of the recharge loop frames into
     charge-aura.png. Body pixels stay exactly where they were drawn; the
     aura becomes a separate effect layer the renderer can fade and grow.
     The loop body is the clean last intro pose (the crouch), held on the
     baseline; only aura-coloured pixels go to the aura layer.
     Intro frames lose their stray sparks, because the aura layer now
     owns the build-up.
  5. Writes manifest.js with an `aura` reference on every recharge frame.

Usage:  python3 scripts/build_hero_cleanup.py [--rev 3b6655d]
Requires Pillow, numpy and node (to read the JS manifest).
"""
import argparse, io, json, re, subprocess
import numpy as np
from PIL import Image
from validate_hero_atlas import gait_weights, hand_mask, muzzle_checks

DIR = 'assets/hero-animation/'
CELL_W, CELL_H = 64, 96
OUTLINE = (34, 22, 30)
# Fade/grow of the aura layer across the 9 intro frames (stand -> crouch).
INTRO_ALPHA = [0, 0, 0, 0, .22, .42, .62, .8, .93]
INTRO_SCALE = [.55, .55, .55, .55, .6, .68, .77, .86, .94]
# Combat clip trims (frames removed from a clip; their cells are cleared):
# - Kamehameha facing the camera / away: release frames 0-1 are a neutral
#   standing pose between the gather (hands at the belly) and the push, so the
#   pose popped and the beam emerged from the belt with no hands near it.
# - SSJ gather down/up: the last frame turns to a 3/4 side crouch, then the
#   release snaps back to the front/back view.
COMBAT_TRIMS = [
    # (form, action, direction, frames dropped from start, frames dropped from end)
    ('normal', 'beamRelease', 'down', 2, 0), ('normal', 'beamRelease', 'up', 2, 0),
    ('ssj', 'beamRelease', 'down', 2, 0), ('ssj', 'beamRelease', 'up', 2, 0),
    ('ssj', 'beamGather', 'down', 0, 1), ('ssj', 'beamGather', 'up', 0, 1),
]


def form_section(text, form):
    starts = {f: text.index('\n    %s: {\n' % f) for f in ('normal', 'ssj')}
    start = starts[form]
    later = [v for v in starts.values() if v > start]
    return start, (min(later) if later else len(text))


def trim_clip(text, man, form, action, direction, head, tail):
    lo, hi = form_section(text, form)
    a = text.index('\n      %s: {\n' % action, lo, hi)
    d = text.index('\n        %s: {\n' % direction, a, hi)
    f0 = text.index('          frames: [\n', d) + len('          frames: [\n')
    f1 = text.index('          ],\n', f0)
    lines = text[f0:f1].splitlines(keepends=True)
    clip = man['clips'][form][action][direction]
    assert len(lines) == len(clip['frames'])
    keep = lines[head:len(lines) - tail]
    text = text[:f0] + ''.join(keep) + text[f1:]
    clip['frames'] = clip['frames'][head:len(clip['frames']) - tail]
    if 'holdFrame' in clip:
        old = '          holdFrame: %d,\n' % clip['holdFrame']
        at = text.index(old, d)
        clip['holdFrame'] = max(0, clip['holdFrame'] - head)
        text = text[:at] + '          holdFrame: %d,\n' % clip['holdFrame'] + text[at + len(old):]
    return text


# Never shorten the walk cycle below the original 26.2 world px (54.5 atlas px
# at 0.48 scale): a shorter cycle would raise the step cadence.
MIN_STRIDE_CELL_PX = 55
# Side-walk gait data: weights are measured from the drawn feet (see
# validate_hero_atlas.gait_weights); contact poses 0 and 4 are rest frames.
WALK_META = {
    ('normal', 'right'): {'restFrames': [0, 4]},
    ('ssj', 'right'): {'restFrames': [0, 4]},
    ('normal', 'down'): {'restFrames': [0, 3]}, ('normal', 'up'): {'restFrames': [0, 3]},
    ('ssj', 'down'): {'restFrames': [0, 3]}, ('ssj', 'up'): {'restFrames': [0, 3]},
}


def git_bytes(rev, path):
    return subprocess.run(['git', 'show', f'{rev}:{path}'], check=True, capture_output=True).stdout


def load_manifest(text):
    js = text + '\nprocess.stdout.write(JSON.stringify(window.KiHeroManifest));'
    out = subprocess.run(['node', '-e', 'global.window={};' + js], check=True, capture_output=True).stdout
    return json.loads(out)


def cells_of(rect):
    x, y, w, h = rect
    return x, y, w, h


def magenta_mask(a):
    r, g, b, al = (a[..., i] for i in range(4))
    return (al > 0) & (r > 80) & (b > 80) & (g < np.minimum(r, b) * .62)


def hard_alpha(a):
    a = a.copy()
    keep = a[..., 3] >= 128
    a[keep, 3] = 255
    a[~keep] = 0
    return a


def fix_magenta(a):
    a = a.copy()
    for _ in range(4):
        op = a[..., 3] == 255
        mag = magenta_mask(a) & op
        if not mag.any():
            break
        H, W = op.shape
        for y, x in zip(*np.nonzero(mag)):
            ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
            nb_op = op[ys, xs]
            on_edge = not nb_op.all() or y in (0, H - 1) or x in (0, W - 1)
            nb = a[ys, xs][nb_op & ~mag[ys, xs]]
            if on_edge or len(nb) < 3:
                a[y, x, :3] = OUTLINE
            else:
                a[y, x, :3] = np.median(nb[:, :3], 0).astype(int)
    # anything still purple after the passes becomes outline
    a[magenta_mask(a) & (a[..., 3] == 255), :3] = OUTLINE
    return a


def largest_component(m):
    lab = np.zeros(m.shape, int)
    best, best_n, k = 0, 0, 0
    H, W = m.shape
    for y, x in zip(*np.nonzero(m)):
        if lab[y, x]:
            continue
        k += 1
        lab[y, x] = k
        stack, n = [(y, x)], 0
        while stack:
            cy, cx = stack.pop()
            n += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    Y, X = cy + dy, cx + dx
                    if 0 <= Y < H and 0 <= X < W and m[Y, X] and not lab[Y, X]:
                        lab[Y, X] = k
                        stack.append((Y, X))
        if n > best_n:
            best, best_n = k, n
    return lab == best


def orange(a):
    r, g, b, al = (a[..., i] for i in range(4))
    return (al >= 200) & (r > 170) & (g > 60) & (g < r * .62) & (b < 80)


def shift(m, dx, dy):
    out = np.zeros_like(m)
    H, W = m.shape
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
    out[yd, xd] = m[ys, xs]
    return out


def dilate(m, n):
    out = m.copy()
    for _ in range(n):
        g = out.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                g |= shift(out, dx, dy)
        out = g
    return out


def aura_colour(a, form):
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    mn = np.minimum(np.minimum(r, g), b)
    if form == 'normal':   # blue / cyan / blue-white
        return (al > 0) & (((b >= r + 15) & (b > 90)) | ((mn > 170) & (b >= r - 8)))
    # gold / yellow / warm white, but not the orange gi or skin
    return (al > 0) & (((r > 170) & (g > 140) & (g > r * .68) & (b < g)) | (mn > 200))


def despark(c, form):
    """Remove baked aura pixels (sparks, ground glow) from a body frame in place."""
    r, g, b = (c[..., i].astype(int) for i in range(3))
    lum = (r + g + b) / 3
    spark = (c[..., 3] == 255) & aura_colour(c, form) & (lum > 105)
    c[86:] = 0  # nothing below the feet line: that is ground glow
    if form == 'ssj':  # gold hair is aura-coloured: only strip below the shoulders
        spark[:60] = False
    op = (c[..., 3] == 255) & ~spark
    H, W = spark.shape
    for y, x in zip(*np.nonzero(spark)):
        ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
        nb = c[ys, xs][op[ys, xs]]
        if y >= 82 or len(nb) < 4:
            c[y, x] = 0
        else:
            c[y, x, :3] = np.median(nb[:, :3], 0).astype(int)
    r, g, b = (c[..., i].astype(int) for i in range(3))
    op = c[..., 3] == 255
    org = orange(c)
    if form == 'normal':
        # blue streaks over the black hair
        streak = op & (b > r + 30) & (b > 90)
        streak[45:] = False
        c[streak] = 0
        # isolated navy specks sitting on the orange trousers
        bluish = op & (b > r) & (b > g)
        for y, x in zip(*np.nonzero(bluish)):
            ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
            if org[ys, xs].sum() >= 5:
                nb = c[ys, xs][org[ys, xs]]
                c[y, x, :3] = np.median(nb[:, :3], 0).astype(int)
        # small blue clusters below the head are sparks; gi parts are big clusters
        r, g, b = (c[..., i].astype(int) for i in range(3))
        blue = (c[..., 3] == 255) & (b > r + 20) & (b > g)
        blue[:45] = False
        seen = np.zeros_like(blue)
        for y0, x0 in zip(*np.nonzero(blue)):
            if seen[y0, x0]:
                continue
            comp, stack = [], [(y0, x0)]
            seen[y0, x0] = True
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        Y, X = y + dy, x + dx
                        if 0 <= Y < 96 and 0 <= X < 64 and blue[Y, X] and not seen[Y, X]:
                            seen[Y, X] = True
                            stack.append((Y, X))
            if len(comp) > 10:
                continue
            for y, x in comp:
                ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
                ok = (c[ys, xs][..., 3] == 255) & ~blue[ys, xs]
                nb = c[ys, xs][ok]
                if len(nb) >= 3:
                    c[y, x, :3] = np.median(nb[:, :3], 0).astype(int)
                else:
                    c[y, x] = 0
        # thin blue energy lines across the trousers (rows above the boots)
        for _ in range(3):
            r, g, b = (c[..., i].astype(int) for i in range(3))
            org = orange(c)
            line = (c[..., 3] == 255) & (b > r + 25) & (b > g)
            line[:58] = False
            line[78:] = False
            for y, x in zip(*np.nonzero(line)):
                ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
                if org[ys, xs].sum() >= 3:
                    nb = c[ys, xs][org[ys, xs]]
                    c[y, x, :3] = np.median(nb[:, :3], 0).astype(int)
    else:
        # pale gold glow rim on the silhouette below the hair (art edges are dark)
        for _ in range(2):
            r, g, b = (c[..., i].astype(int) for i in range(3))
            op = c[..., 3] == 255
            edge = op & ~(shift(op, 1, 0) & shift(op, -1, 0) & shift(op, 0, 1) & shift(op, 0, -1))
            rim = edge & (g >= r * .86) & (b <= g * .9) & ((r + g + b) / 3 > 150)
            rim[:44] = False
            c[rim] = 0
    keep = largest_component(c[..., 3] == 255)
    c[~keep] = 0


def inpaint(aura, hole):
    """Fill the body-shaped hole in an aura frame from surrounding aura pixels."""
    aura = aura.astype(float)
    filled = aura[..., 3] > 0
    todo = hole & ~filled
    for _ in range(64):
        if not todo.any():
            break
        grow = []
        for y, x in zip(*np.nonzero(todo)):
            ys, xs = slice(max(0, y - 1), y + 2), slice(max(0, x - 1), x + 2)
            nb = aura[ys, xs][filled[ys, xs]]
            if len(nb):
                grow.append((y, x, nb.mean(0)))
        if not grow:
            break
        for y, x, v in grow:
            aura[y, x] = v
            filled[y, x] = True
            todo[y, x] = False
    return np.clip(aura.round(), 0, 255).astype(np.uint8)


def frame_line_pattern(rect):
    x, y, w, h = rect
    return re.compile(r'\{"sheet": "body-atlas\.png", "rect": \[%d, %d, %d, %d\], "durationMs": (\d+), "feet": \[(\d+), (\d+)\]\}' % (x, y, w, h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rev', default='3b6655d', help='source revision of the original atlas + manifest')
    args = ap.parse_args()

    src = np.array(Image.open(io.BytesIO(git_bytes(args.rev, DIR + 'body-atlas.png'))).convert('RGBA')).astype(int)
    manifest_text = git_bytes(args.rev, DIR + 'manifest.js').decode()
    man = load_manifest(manifest_text)

    for trim in COMBAT_TRIMS:
        manifest_text = trim_clip(manifest_text, man, *trim)
    atlas = fix_magenta(hard_alpha(src))

    # 3. clear unreferenced cells
    used = set()
    for form in man['clips'].values():
        for action in form.values():
            for clip in action.values():
                for f in clip['frames']:
                    if f['sheet'] == 'body-atlas.png':
                        used.add((f['rect'][0], f['rect'][1]))
    rows, cols = man['grid']['rows'], man['grid']['columns']
    cleared = 0
    for r in range(rows):
        for cl in range(cols):
            if (cl * CELL_W, r * CELL_H) not in used:
                cell = atlas[r * CELL_H:(r + 1) * CELL_H, cl * CELL_W:(cl + 1) * CELL_W]
                if cell[..., 3].any():
                    cleared += 1
                cell[...] = 0

    # 4. split charge aura
    aura_sheet = np.zeros((2 * CELL_H, 8 * CELL_W, 4), np.uint8)
    aura_refs = {}
    report = {}
    for row, form in enumerate(['normal', 'ssj']):
        clip = man['clips'][form]['recharge']['shared']
        frames, loop_start = clip['frames'], clip['loopStart']
        loop = frames[loop_start:]
        assert len(loop) <= 8
        def cell(f, img):
            x, y, w, h = f['rect']
            return img[y:y + h, x:x + w]
        last_intro = cell(frames[loop_start - 1], atlas)
        body_mask = largest_component(last_intro[..., 3] == 255)
        body_orange = orange(last_intro) & body_mask
        # intro frames: keep only the fighter (sparks belong to the aura layer now)
        for f in frames[:loop_start]:
            c = cell(f, atlas)
            keep = largest_component(c[..., 3] == 255)
            c[~keep] = 0
            despark(c, form)
        refs = []
        clean_body = last_intro.copy()   # already cleaned with the intro frames
        for i, f in enumerate(loop):
            hard = cell(f, atlas)
            soft = cell(f, src)
            aura_col = aura_colour(soft, form)
            bodyish = (soft[..., 3] >= 200) & ~aura_col
            dx, dy = max(((dx, dy) for dx in range(-3, 4) for dy in range(-3, 4)),
                         key=lambda d: ((shift(body_mask, *d) & bodyish).sum() - (shift(body_mask, *d) ^ bodyish).sum() * .5, -abs(d[0]) - abs(d[1])))
            near = dilate(shift(body_mask, dx, dy), 1)
            aura = soft.copy()
            aura[~aura_col | near] = 0
            aura[(aura[..., 3] < 24)] = 0
            # loop body: the clean crouch drawing, held still on the baseline
            hard[...] = clean_body
            aura_sheet[row * CELL_H:(row + 1) * CELL_H, i * CELL_W:(i + 1) * CELL_W] = aura
            refs.append([i * CELL_W, row * CELL_H, CELL_W, CELL_H])
            report.setdefault(form, []).append({'registration': [dx, dy], 'aura_px': int((aura[..., 3] > 0).sum())})
        aura_refs[form] = refs

    atlas = fix_magenta(atlas)  # charge clean-up can create new purple medians
    Image.fromarray(atlas.astype(np.uint8)).save(DIR + 'body-atlas.png', optimize=True)
    Image.fromarray(aura_sheet).save(DIR + 'charge-aura.png', optimize=True)

    # 5. manifest: aura reference on every recharge frame
    text = manifest_text
    for form in ['normal', 'ssj']:
        clip = man['clips'][form]['recharge']['shared']
        loop_start, refs = clip['loopStart'], aura_refs[form]
        for i, f in enumerate(clip['frames']):
            if i < loop_start:
                ref, alpha, scale = refs[i % len(refs)], INTRO_ALPHA[i], INTRO_SCALE[i]
            else:
                ref, alpha, scale = refs[i - loop_start], 1, 1
            aura = '{"sheet": "charge-aura.png", "rect": [%d, %d, %d, %d], "feet": [32, 86], "alpha": %s, "scale": %s}' % (*ref, alpha, scale)
            pat = frame_line_pattern(f['rect'])
            text, n = pat.subn(lambda mm: mm.group(0)[:-1] + ', "aura": ' + aura + '}', text, count=1)
            assert n == 1, (form, i)
    # walk gait metadata (measured from the cleaned atlas)
    for form in ['normal', 'ssj']:
        clip = man['clips'][form]['walk']['right']
        cells = [atlas[f['rect'][1]:f['rect'][1] + 96, f['rect'][0]:f['rect'][0] + 64] for f in clip['frames']]
        WALK_META[(form, 'right')]['gaitWeights'] = gait_weights(cells)
    walk_starts = [m.start() for m in re.finditer(r'\n      walk: \{\n', text)]
    assert len(walk_starts) == 2
    form_order = ['normal', 'ssj'] if text.index('    normal: {') < text.index('    ssj: {') else ['ssj', 'normal']
    for form, start in reversed(list(zip(form_order, walk_starts))):
        for direction in ['right', 'up', 'down']:
            meta = WALK_META[(form, direction)]
            key = '\n        %s: {\n          loop: true,\n' % direction
            at = text.index(key, start) + len(key)
            lines = ''
            if 'gaitWeights' in meta:
                lines += '          gaitWeights: %s,\n          strideCellPx: %d,\n' % (json.dumps(meta['gaitWeights']), max(sum(meta['gaitWeights']), MIN_STRIDE_CELL_PX))
            lines += '          restFrames: %s,\n' % json.dumps(meta['restFrames'])
            text = text[:at] + lines + text[at:]
    # Kamehameha muzzles that sit off the hands move to the nearest hand pixel.
    for form, action, direction, i in muzzle_checks(man):
        f = man['clips'][form][action][direction]['frames'][i]
        x, y, w, h = f['rect']
        ys, xs = np.nonzero(hand_mask(atlas[y:y + h, x:x + w]))
        mx, my = f['muzzle']
        d = np.hypot(xs - mx, ys - my)
        if len(d) and d.min() > 3:
            k = int(np.argmin(d))
            old_line = '"rect": [%d, %d, %d, %d], "durationMs": %d, "feet": [%d, %d], "muzzle": [%d, %d]' % (x, y, w, h, f['durationMs'], *f['feet'], mx, my)
            assert text.count(old_line) == 1, old_line
            text = text.replace(old_line, old_line[:old_line.rindex('[')] + '[%d, %d]' % (xs[k], ys[k]))
            f['muzzle'] = [int(xs[k]), int(ys[k])]

    text = text.replace('"body-and-aura"', '"separate-aura"').replace("'body-and-aura'", "'separate-aura'")
    text = text.replace('effectOwnership: "body-and-aura"', 'effectOwnership: "separate-aura"')
    open(DIR + 'manifest.js', 'w').write(text)
    print(json.dumps({'cleared_cells': cleared, 'aura': report}, indent=1))


if __name__ == '__main__':
    main()
