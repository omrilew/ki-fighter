"""One-source 64x96 SSJ fighter, 4-frame directional and combat atlas.
Every limb, hair spike, and body piece is drawn as one cohesive silhouette.
Rows: front idle, front walk, rear walk, side walk, punch, kick,
ki launch, hurt, knockdown. Four frames per row. No old sprites used.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math
W,H=64,96
C=dict(out='#262038',hair_dark='#9a5717',hair='#f8bb30',hair_hi='#ffe76b',
skin='#eeb887',skin_sh='#bd7959',orange='#dc671e',orange_hi='#f89c31',
orange_sh='#a7441e',blue='#233f83',blue_hi='#466db0',boot='#542b59',eye='#24304a')
atlas=Image.new('RGBA',(W*4,H*9))
def frame(row,n):
 im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
 face='back' if row==2 else 'side' if row==3 else 'front'
 action=['idle','walk','walk','walk','punch','kick','ki','hurt','ko'][row]
 t=n
 bob=[0,-2,0,1][n] if action=='walk' else [0,-1,0,1][n] if action=='idle' else 0
 if action=='ko':bob=0
 # pixel primitives at a stable baseline, independently articulated limbs
 def poly(pts,fill,outline=True):
  d.polygon(pts,fill=C[fill],outline=C['out'] if outline else None)
 def rect(coords,fill):d.rectangle(coords,fill=C[fill],outline=C['out'],width=2)
 def limb(points,fill,width):
  d.line(points,fill=C['out'],width=width+4,joint='curve')
  d.line(points,fill=C[fill],width=width,joint='curve')
 def hand(x,y):
  d.ellipse((x-4,y-4,x+4,y+4),fill=C['skin'],outline=C['out'],width=2)
  d.line([(x-3,y-3),(x+3,y-3)],fill=C['skin_sh'],width=1)
 if action=='ko':
  # Complete prone sprite, feet remain at y=88
  rect((10,75,53,86),'orange')
  poly([(4,71),(10,62),(21,66),(27,77),(21,85),(9,83)],'hair')
  rect((40,78,58,88),'boot')
  return im
 kick=action=='kick'
 lean=4 if action in ('punch','ki') else 0
 recoil=3*n if action=='hurt' else 0
 cx=32+lean-recoil
 step=[0,3,0,-3][n] if action=='walk' else 0
 leg_y=64+bob
 # legs and feet first; preserve consistent foot contact at y=88
 if kick:
  lift=[0,5,13,4][n]
  limb([(cx-8,leg_y),(cx-11,78)],'orange_sh',9)
  limb([(cx+8,leg_y),(cx+9+lift,79-lift)],'orange',10)
  rect((cx-17,83,cx-5,89),'boot')
  rect((cx+5+lift,76-lift,cx+17+lift,82-lift),'boot')
 else:
  limb([(cx-8,leg_y),(cx-9-step,82+bob)],'orange_sh',11)
  limb([(cx+8,leg_y),(cx+9+step,82+bob)],'orange',11)
  rect((cx-16-step,81+bob,cx-4-step,88),'boot')
  rect((cx+4+step,81+bob,cx+16+step,88),'boot')
 # upper torso as a continuous single outfit
 poly([(cx-15,43+bob),(cx+14,43+bob),(cx+17,64+bob),
       (cx+9,70+bob),(cx-11,70+bob),(cx-17,64+bob)],'orange')
 poly([(cx-8,44+bob),(cx,53+bob),(cx+8,44+bob),(cx+3,43+bob),
       (cx,49+bob),(cx-3,43+bob)],'blue')
 d.line([(cx-12,65+bob),(cx+12,65+bob)],fill=C['blue'],width=5)
 d.line([(cx+9,65+bob),(cx+13,73+bob)],fill=C['blue_hi'],width=3)
 # arms from shoulders to visible wrist/fist
 left=(cx-17,49+bob);right=(cx+17,49+bob)
 if action=='punch':
  hands=[((cx-22,58),(cx+20,56)),((cx-17,51),(cx+28,47)),
         ((cx-15,52),(cx+31,46)),((cx-23,56),(cx+17,54))][n]
 elif action=='ki':
  hands=[((cx-11,59),(cx+11,59)),((cx-6,54),(cx+19,53)),
         ((cx+14,48),(cx+29,48)),((cx+19,47),(cx+32,47))][n]
 elif action=='hurt':
  hands=((cx-19-n,44+n*3),(cx+17+n,48+n*3))
 elif action=='walk':
  hands=((cx-18,59+step),(cx+18,59-step))
 else:hands=((cx-19,59+bob),(cx+19,59+bob))
 for start,end in ((left,hands[0]),(right,hands[1])):
  elbow=((start[0]+end[0])//2,(start[1]+end[1])//2+3)
  limb([start,elbow],'orange',9)
  limb([elbow,end],'skin',6)
  d.line([(elbow[0]-3,elbow[1]),(elbow[0]+3,elbow[1])],fill=C['blue'],width=4)
  hand(*end)
 # neck and full face
 rect((cx-5,37+bob,cx+5,46+bob),'skin_sh')
 d.ellipse((cx-12,21+bob,cx+12,47+bob),fill=C['skin'],outline=C['out'],width=2)
 if face=='back':
  poly([(cx-11,27+bob),(cx-7,43+bob),(cx+7,43+bob),(cx+12,26+bob)],'hair_dark')
 elif face=='side':
  d.line([(cx+3,34+bob),(cx+9,34+bob)],fill=C['eye'],width=2)
  d.point((cx+10,39+bob),fill=C['skin_sh'])
 else:
  d.line([(cx-8,34+bob),(cx-3,35+bob)],fill=C['eye'],width=2)
  d.line([(cx+3,35+bob),(cx+8,34+bob)],fill=C['eye'],width=2)
  d.line([(cx-3,42+bob),(cx+3,42+bob)],fill=C['skin_sh'],width=1)
 # hair silhouette built with 10 integrated spikes; all states share proportions
 spikes=[(-13,26),(-18,12),(-8,17),(-11,3),(-2,12),(2,0),
         (8,13),(15,5),(13,21),(20,15),(13,32),(9,25)]
 poly([(cx+x,y+bob) for x,y in spikes]+[(cx+9,34+bob),(cx-10,34+bob)],'hair_dark')
 inner=[(-11,27),(-14,15),(-7,20),(-8,8),(-1,17),(2,6),
        (6,18),(13,11),(10,25),(16,20),(9,30),(-8,30)]
 poly([(cx+x,y+bob) for x,y in inner]+[(cx-11,27+bob)],'hair')
 for x,y in [(-8,17),(-3,10),(4,14),(10,17)]:
  d.line([(cx+x,y+bob),(cx+x+2,y+9+bob)],fill=C['hair_hi'],width=2)
 return im
for r in range(9):
 for n in range(4):
  atlas.alpha_composite(frame(r,n),(n*W,r*H))
out=Path('assets/ssj-cohesive-4x9.png')
atlas.save(out,optimize=True)
assert atlas.size==(256,864)
for r in range(9):
 assert len({atlas.crop((n*W,r*H,(n+1)*W,(r+1)*H)).tobytes() for n in range(4)})>=2,r
print('Created',out,atlas.size)
