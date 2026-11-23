"""Clean the approved 4x4 SSJ sheet and derive a matching Normal sheet.

Keep all 64x96 frame boundaries and the in-game rendering scale unchanged.
This is deliberately idempotent: rerunning it must not add artifacts.
"""
from PIL import Image

path = "assets/ssj-movement-4x4.png"
src = Image.open(path).convert("RGBA")
assert src.size == (256, 384), src.size
ssj = src.copy()
for y in range(src.height):
    for x in range(src.width):
        r, g, b, a = src.getpixel((x, y))
        lx, ly = x % 64, y % 96
        if a < 16:
            continue
        # The supplied sheet includes a magenta floor glow and scattered
        # pink sparks, neither of which belongs to a body-only sprite.
        pink = r > 75 and b > 65 and b > g * 1.35 and r > g * 1.5 and b > r * .68
        if pink and (ly < 75 or lx < 20 or lx > 44):
            ssj.putpixel((x, y), (0, 0, 0, 0))
            continue
        # Remove the bright side flames outside the fighter silhouette;
        # golden SSJ hair is preserved above the shoulder line.
        outside = ly >= 32 and ((lx < 23 or lx > 42) if ly < 65 else (lx < 24 or lx > 40))
        flare = r > 145 and g > 95 and b < g * .87 and r > g * .98
        if outside and flare:
            ssj.putpixel((x, y), (0, 0, 0, 0))
ssj.save(path, optimize=True)

normal = ssj.copy()
for y in range(src.height):
    ly = y % 96
    if ly >= 42:
        continue
    for x in range(src.width):
        lx = x % 64
        r, g, b, a = ssj.getpixel((x, y))
        if a < 100:
            continue
        row = y // 96
        face = row in (0, 1) and ly >= 26 and 23 <= lx <= 42
        if face:
            continue
        hair = 10 <= lx <= 53 and (ly <= 31 or (row == 2 and ly <= 40) or (row == 3 and ly <= 36))
        warm = r > 68 and r > b * 1.35 and (r > g * 1.12 or g > b * 1.35)
        if not (hair and warm):
            continue
        lum = (r * 3 + g * 4 + b) / 8
        rgb = (90, 101, 124) if lum > 180 else (54, 65, 87) if lum > 125 else (32, 40, 61) if lum > 80 else (21, 27, 43)
        normal.putpixel((x, y), (*rgb, a))
# Normalize the upper hair spikes to a restrained three-tone navy palette.
# The original atlas mixes pale gray/blue highlight specks with recolored
# amber pixels. Restrict this pass to the upper spikes, safely above the face,
# and leave all facial, shoulder, gi and boot pixels unchanged.
for y in range(normal.height):
    ly = y % 96
    if ly > 22:
        continue
    for x in range(normal.width):
        lx = x % 64
        if not 12 <= lx <= 51:
            continue
        r, g, b, a = normal.getpixel((x, y))
        if a < 100:
            continue
        # Only cool blue-gray hair pixels: preserve near-black outlines.
        cool = b >= r * 1.12 and b >= g * 1.04 and b > 37
        if not cool:
            continue
        lightness = (r + g + b) / 3
        rgb = (76, 88, 111) if lightness > 82 else (46, 56, 77) if lightness > 49 else (27, 34, 52)
        normal.putpixel((x, y), (*rgb, a))

normal.save("assets/normal-movement-4x4.png", optimize=True)
