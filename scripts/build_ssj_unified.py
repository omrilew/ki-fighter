"""Build one production SSJ PNG from canonical movement, action, and transformation sheets.
Each source sheet retains its exact pixels and 4-column frame layout.
No re-scaling, compositing characters, or procedural hand overlays.
"""
from PIL import Image
from pathlib import Path
p=Path('assets')
sources=[
 ('movement','ssj-movement-4x4.png',4),
 ('production','ssj-production-actions-4x4.png',4),
 ('combat','ssj-combat-actions-4x4.png',4),
 ('transformation','ssj-transformation-12.png',3)
]
images=[]
for name,file,rows in sources:
 im=Image.open(p/file).convert('RGBA')
 assert im.width%4==0 and im.height%rows==0,(name,im.size)
 images.append((name,im,rows))
width=max(im.width for _,im,_ in images)
height=sum(im.height for _,im,_ in images)
assert width<=8192 and height<=8192,(width,height)
atlas=Image.new('RGBA',(width,height),(0,0,0,0))
y=0
layout={}
for name,im,rows in images:
 atlas.alpha_composite(im,(0,y))
 layout[name]={'x':0,'y':y,'cellWidth':im.width//4,'cellHeight':im.height//rows,'rows':rows}
 y+=im.height
out=p/'ssj-unified-production.png'
atlas.save(out,optimize=True)
print('Unified atlas:',out,atlas.size,layout)
# JavaScript data-only manifest; the game loads just ONE SSJ image.
manifest=Path('ssj-unified-layout.js')
manifest.write_text('window.KiSsjUnifiedLayout='+repr(layout).replace("'",'"')+';\\n')
