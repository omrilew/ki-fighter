"""Generate the normal-form movement atlas with a clean dark hairstyle.

The original SSJ hair uses yellow, orange and red shadow pixels. Recolor
all of those shades inside the hair silhouette, not only bright highlights:
otherwise the normal fighter appears to have blue hair with red sparks.
"""
from PIL import Image

src = Image.open("assets/ssj-movement-4x4.png").convert("RGBA")
assert src.size == (256, 384), src.size
out = src.copy()

for y in range(src.height):
    ly = y % 96
    if ly >= 35:
        continue
    for x in range(src.width):
        lx = x % 64
        r, g, b, a = src.getpixel((x, y))
        if a < 100:
            continue
        # Keep the face (skin, eyes, eyebrows) untouched. The back-view
        # hair extends slightly lower than the front-view spikes.
        row = y // 96
        face = row in (0, 1) and ly >= 26 and 23 <= lx <= 42
        if face:
            continue
        # Hair is concentrated above the eyes, between the side spikes.
        # Include darker amber/red shadows that the previous recolor missed.
        in_hair = 10 <= lx <= 53 and (ly <= 29 or (row == 2 and ly <= 34))
        warm = r > 68 and r > b * 1.35 and (r > g * 1.12 or g > b * 1.35)
        if not (in_hair and warm):
            continue
        lum = (r * 3 + g * 4 + b) / 8
        if lum > 180:
            rgb = (90, 101, 124)
        elif lum > 125:
            rgb = (54, 65, 87)
        elif lum > 80:
            rgb = (32, 40, 61)
        else:
            rgb = (21, 27, 43)
        out.putpixel((x, y), (*rgb, a))

out.save("assets/normal-movement-4x4.png", optimize=True)
