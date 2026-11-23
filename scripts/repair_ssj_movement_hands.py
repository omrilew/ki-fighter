"""Repair missing hands INSIDE the approved SSJ movement PNG.
The original atlas contains large dark wrist/hand masses. Replace the inner
hand pixels with a shaded skin palette while preserving outlines and alpha.
No runtime overlays or replacement character sprites."""
from pathlib import Path
from PIL import Image
p=Path('assets/ssj-movement-4x4.png')
im=Image.open(p).convert('RGBA')
assert im.size==(256,384),im.size
px=im.load()
# 64x96 cell; coordinates were verified against 5x diagnostic contact sheet.
# Each patch sits inside the existing dark glove silhouette, at the end of
# the connected forearm. Top rows show both fists; rear view shows knuckles.
poses={
 0:[(18,58),(46,58)],
 1:[(18,58),(46,58)],
 2:[(18,58),(46,58)],
 3:[(18,56),(42,56)],
}
palette={
 'outline':(64,35,42,255),
 'shade':(166,85,51,255),
 'mid':(235,143,88,255),
 'light':(255,194,124,255),
}
count=0
for row in range(4):
 for col in range(4):
  for hand,(hx,hy) in enumerate(poses[row]):
   # Tiny clenched-fist pattern, deliberately not a circle/blob.
   # Skin replaces existing pixels only; alpha/silhouette is untouched.
   shape=[
    '  .SSS.  ',
    ' .SMMMS. ',
    '.SMMMMMS.',
    'SMMMLMMMS',
    'SMMMLMMMS',
    'SMMMMMMMS',
    '.SMMMMMS.',
    ' .SSSSS. ',
    '  .....  '
   ]
   for dy,line in enumerate(shape):
    for dx,ch in enumerate(line):
     if ch==' ':continue
     x=col*64+hx+dx-4
     y=row*96+hy+dy-4
     old=px[x,y]
     if old[3]<170:continue
     # Retain any existing orange gi, gold hair, or bright skin.
     r,g,b,a=old
     if r>135 and r>g*1.28 and g>b*1.1:continue
     color=palette['shade' if ch in ('S','s') else 'mid' if ch=='M' else 'light' if ch=='L' else 'outline']
     px[x,y]=color[:3]+(a,)
     count+=1
im.save(p,optimize=True)
print('Edited source SSJ movement hand pixels:',count)
if count<80:raise RuntimeError('Not enough source hand pixels changed; abort')
