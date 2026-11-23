"""Derive matching normal-form walking frames from the approved SSJ atlas.
Only recolor hair pixels in the upper part of each 64x96 cell.
"""
from PIL import Image
src=Image.open("assets/ssj-movement-4x4.png").convert("RGBA")
assert src.size==(256,384),src.size
out=src.copy()
for y in range(src.height):
    local_y=y%96
    if local_y>=45:continue
    for x in range(src.width):
        r,g,b,a=src.getpixel((x,y))
        if a<100:continue
        # Golden highlights: bright and warm; leave skin, dark outlines,
        # eyes and blue undershirt untouched.
        if r>145 and g>105 and b<g*.86 and r>g*.94:
            luminance=(r+g)/2
            if luminance>205:rgb=(78,94,128)
            elif luminance>160:rgb=(46,57,88)
            else:rgb=(25,31,53)
            out.putpixel((x,y),(*rgb,a))
out.save("assets/normal-movement-4x4.png",optimize=True)
