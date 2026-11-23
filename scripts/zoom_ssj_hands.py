from PIL import Image,ImageDraw
from pathlib import Path
im=Image.open('assets/ssj-movement-4x4.png').convert('RGBA')
out=Image.new('RGB',(4*320,4*480),'#26323e')
for row in range(4):
 for col in range(4):
  frame=im.crop((col*64,row*96,col*64+64,row*96+96))
  frame=frame.resize((320,480),Image.Resampling.NEAREST)
  x,y=col*320,row*480
  out.paste(frame,(x,y),frame)
  d=ImageDraw.Draw(out)
  for xx in range(0,64,8):d.line((x+xx*5,y,x+xx*5,y+480),fill='#475361',width=1)
  for yy in range(0,96,8):d.line((x,y+yy*5,x+320,y+yy*5),fill='#475361',width=1)
  d.text((x+5,y+5),f'({row},{col})',fill='white')
out.save('assets/ssj-hand-zoom.png',optimize=True)
