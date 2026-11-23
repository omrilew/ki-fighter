"""Build a fresh, consistent SSJ gameplay sprite atlas from the canonical
base-form anatomy. Preserve all original hands, boots, gi and alpha.
The cinematic transformation is never modified.
No old SSJ movement/combat art is used.
"""
from PIL import Image
from pathlib import Path
import colorsys
A=Path('assets')
base=Image.open(A/'normal-movement-4x4.png').convert('RGBA')
assert base.size==(256,384),base.size
out=base.copy()
px=out.load()
# Hair lives in the upper section of every 64x96 cell. Restrict the mask to
# the head silhouette, protecting navy cuffs, gloves, shirt, and boots.
changed=[0]*16
for row in range(4):
 for col in range(4):
  idx=row*4+col
  for y in range(row*96+15,row*96+52):
   for x in range(col*64+12,col*64+53):
    r,g,b,a=px[x,y]
    if a<110:continue
    lx=x-col*64;ly=y-row*96
    # Central top-of-head ellipse. Dark/blue hair only; orange gi and
    # flesh tones are never candidates.
    head=((lx-32)/20)**2+((ly-33)/20)**2<1
    dark=(max(r,g,b)<140 and b>=r*.76 and g<130)
    if not head or not dark:continue
    h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    if r>g*1.38 and r>95:continue
    # Preserve black outlines and individual pixel shading.
    luminance=max(r,g,b)
    if luminance<34:continue
    if luminance<57:color=(105,70,22)
    elif luminance<83:color=(181,121,28)
    elif luminance<111:color=(239,181,49)
    else:color=(255,226,112)
    px[x,y]=(*color,a);changed[idx]+=1
# Require at least some hair pixels in every frame.
print('Recolored hair pixels per frame:',changed)
if min(changed)<5:raise RuntimeError('Hair mask failed in a frame')
target=A/'ssj-gameplay-clean-4x4.png'
out.save(target,optimize=True)
print('Wrote',target,out.size)
