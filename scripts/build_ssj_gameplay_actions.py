"""Generate a distinct 4x4 SSJ action sheet from the canonical body.
All sprites use 64x96 cells and identical foot anchors. The original
cinematic transformation is intentionally not touched.

Rows: 0 punch windup/extend/recoil/guard, 1 Ki focus/aim/launch/hold,
2 hurt stagger frames, 3 knockdown sequence.
"""
from PIL import Image, ImageDraw
from pathlib import Path
A=Path("assets")
source=Image.open(A/"ssj-gameplay-clean-4x4.png").convert("RGBA")
assert source.size==(256,384),source.size
W,H=64,96
atlas=Image.new("RGBA",(W*4,H*4))
INK=(40,34,40,255)
GI=(226,99,26,255)
GI_LIGHT=(255,156,45,255)
CUFF=(28,58,112,255)
SKIN=(247,192,136,255)
SKIN_SHADE=(198,125,87,255)
def arm(d,shoulder,elbow,hand,front=True):
    # Full opaque pixel-art sleeve and forearm, not a translucent overlay.
    # Source artwork remains one composited PNG; runtime draws it once.
    d.line([shoulder,elbow],fill=INK,width=10,joint="curve")
    d.line([shoulder,elbow],fill=GI,width=7,joint="curve")
    d.line([elbow,hand],fill=INK,width=8,joint="curve")
    d.line([elbow,hand],fill=SKIN_SHADE,width=5,joint="curve")
    x,y=hand
    d.rectangle((x-5,y-5,x+5,y+5),fill=INK)
    d.rectangle((x-4,y-4,x+3,y+3),fill=SKIN)
    d.rectangle((x-4,y-5,x+4,y-3),fill=CUFF)
    d.line([(x-2,y-1),(x+2,y-1)],fill=SKIN_SHADE,width=1)
def base(frame=0):
    return source.crop((frame*64,0,(frame+1)*64,96)).copy()
def make_action(row,col):
    # Distinct torso/arm positions in each state. Preserve the source
    # character's head, palette, feet and baseline.
    im=base(0 if row!=2 else col)
    if row==3:
        # Progressive collapse without moving the character's foot anchor.
        if col:
            body=im.crop((12,12,53,85))
            im.paste((0,0,0,0),(12,12,53,85))
            if col==1:
                body=body.rotate(-17,resample=Image.Resampling.NEAREST,expand=True)
                im.alpha_composite(body,(10,21))
            elif col==2:
                body=body.rotate(-42,resample=Image.Resampling.NEAREST,expand=True)
                im.alpha_composite(body,(6,34))
            else:
                body=body.rotate(-80,resample=Image.Resampling.NEAREST,expand=True)
                im.alpha_composite(body,(2,49))
        return im
    d=ImageDraw.Draw(im)
    if row==0:
        poses=[
          ((21,49),(17,43),(25,39),(43,50),(47,45),(42,40)),
          ((21,49),(28,43),(43,40),(43,50),(47,47),(43,44)),
          ((21,49),(32,44),(52,43),(43,50),(46,48),(40,44)),
          ((21,49),(23,43),(29,41),(43,50),(40,43),(35,40))]
    elif row==1:
        poses=[
          ((21,49),(24,43),(30,38),(43,50),(40,43),(34,38)),
          ((21,49),(29,43),(38,42),(43,50),(37,43),(36,42)),
          ((21,49),(33,43),(47,41),(43,50),(47,43),(53,41)),
          ((21,49),(35,44),(51,44),(43,50),(49,44),(55,44))]
    else:
        poses=[
          ((21,49),(22,45),(28,42),(43,50),(41,46),(36,43)),
          ((21,49),(18,45),(23,47),(43,50),(46,47),(50,48)),
          ((21,49),(17,51),(22,56),(43,50),(47,53),(52,56)),
          ((21,49),(24,44),(31,43),(43,50),(39,44),(33,43))]
    p=poses[col]
    arm(d,p[0],p[1],p[2])
    arm(d,p[3],p[4],p[5])
    return im
for row in range(4):
    for col in range(4):
        im=make_action(row,col)
        assert im.getbbox(),(row,col)
        atlas.alpha_composite(im,(col*W,row*H))
out=A/"ssj-gameplay-actions-4x4.png"
atlas.save(out,optimize=True)
print("Built",out,atlas.size,"RGBA, 16 action frames")
