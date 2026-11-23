from pathlib import Path
from PIL import Image
import colorsys

ASSETS=Path("assets")
FILES=["ssj-movement-4x4.png","ssj-production-actions-4x4.png","ssj-combat-actions-4x4.png"]

def is_skin(r,g,b,a):
    if a<180 or r<135 or g<65 or b<25:return False
    h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
    return .035<=h<=.115 and .24<=s<=.77 and v>.53 and r>g*1.17

for filename in FILES:
    path=ASSETS/filename
    im=Image.open(path).convert("RGBA")
    if im.size!=(256,384):raise RuntimeError(f"Unexpected atlas layout {filename}: {im.size}")
    px=im.load(); touched=0;frames=0
    for row in range(4):
      for col in range(4):
        ox,oy=col*64,row*96
        # Only enhance pixels that are ALREADY skin in the source art.
        # Avoid adding synthetic floating hands to animation frames.
        # Restrict to arms/hand areas, not hair, face, gi or boots.
        candidates=[]
        for y in range(40,73):
          for x in range(9,55):
            if 27<=x<=36:continue
            r,g,b,a=px[ox+x,oy+y]
            if is_skin(r,g,b,a):
              candidates.append((x,y))
        if not candidates:continue
        frames+=1
        # Pixel-level retouch: make existing knuckles legible and maintain
        # the original silhouette and original wrist/arm connections.
        for x,y in candidates:
          r,g,b,a=px[ox+x,oy+y]
          # Skin contrast, with no alteration to alpha or silhouette.
          nr=min(255,r+14);ng=min(255,g+9);nb=min(255,b+5)
          px[ox+x,oy+y]=(nr,ng,nb,a);touched+=1
        # Give the upper/outside knuckle one highlight, only where the
        # existing hand has an adjacent skin pixel.
        for side in (-1,1):
          sidepts=[(x,y) for x,y in candidates if (x<27 if side<0 else x>36)]
          if len(sidepts)<3:continue
          # Closest exposed skin to the outer silhouette, below the shoulders.
          yy=min((y for x,y in sidepts if y>=49),default=None)
          if yy is None:continue
          line=[x for x,y in sidepts if y==yy]
          if not line:continue
          xx=min(line) if side<0 else max(line)
          r,g,b,a=px[ox+xx,oy+yy]
          px[ox+xx,oy+yy]=(min(255,r+23),min(255,g+20),min(255,b+13),a)
    im.save(path,optimize=True)
    print(filename,"retouched source pixels:",touched,"frames with hands/arms:",frames)
    if touched<15:raise RuntimeError(f"Skin detection failed for {filename}; refusing unsafe rewrite")
