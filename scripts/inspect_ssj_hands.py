from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
a=Path('assets')
im=Image.open(a/'ssj-transformation-12.png').convert('RGBA')
mv=Image.open(a/'ssj-movement-4x4.png').convert('RGBA')
w,h=im.width//4,im.height//3
print('transform',im.size,'cell',w,h,'movement',mv.size)
out=Image.new('RGB',(4*220,4*260),'#27313c')
for n in range(12):
 frame=im.crop(((n%4)*w,(n//4)*h,(n%4+1)*w,(n//4+1)*h))
 frame.thumbnail((200,222),Image.Resampling.NEAREST)
 x=n%4*220+(220-frame.width)//2
 y=n//4*260+20
 out.paste(frame,(x,y),frame)
 ImageDraw.Draw(out).text((n%4*220+6,n//4*260+4),f'Transform frame {n}',fill='white')
for n in range(4):
 frame=mv.crop((n*64,0,n*64+64,96))
 frame=frame.resize((128,192),Image.Resampling.NEAREST)
 x=n*220+46;y=3*260+35
 out.paste(frame,(x,y),frame)
 ImageDraw.Draw(out).text((n*220+6,3*260+4),f'Canonical SSJ {n}',fill='white')
out.save(a/'ssj-hand-diagnostic.png',optimize=True)
