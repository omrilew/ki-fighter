from PIL import Image
from pathlib import Path
import colorsys
p=Path('assets/ssj-transformation-12.png')
src=Image.open(p).convert('RGBA')
assert src.width%4==0 and src.height%3==0
w,h=src.width//4,src.height//3
print('transformation source:',src.size,'frame:',(w,h))
for form in ('gold','blue'):
 out=Image.new('RGBA',src.size)
 for frame in range(12):
  tile=src.crop(((frame%4)*w,(frame//4)*h,(frame%4+1)*w,(frame//4+1)*h))
  pix=tile.load()
  for y in range(h):
   for x in range(w):
    r,g,b,a=pix[x,y]
    hue,sat,val=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    # Select the actual golden transformation flame, not the character,
    # background, skin, or the dark linework.
    golden=(.075<=hue<=.19 and sat>.34 and val>.42 and r>g*1.05 and g>b*1.38)
    # Central silhouette is excluded to prevent duplicated SSJ hair or hands.
    center=(.30*w<x<.70*w and .18*h<y<.94*h)
    if not golden or center:
     pix[x,y]=(0,0,0,0)
    elif form=='blue':
     brightness=max(r,g,b)
     pix[x,y]=(int(brightness*.30),min(255,int(brightness*.79)),brightness,a)
  out.alpha_composite(tile,((frame%4)*w,(frame//4)*h))
 target=Path('assets')/f'transformation-aura-{form}-12.png'
 out.save(target,optimize=True)
 print(target,out.getbbox())
 if out.getbbox() is None:raise RuntimeError('Empty aura extraction')
