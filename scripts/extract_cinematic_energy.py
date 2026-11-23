"""Extract ONLY energy from user-supplied cinematic concepts.
Never import the concept fighter: the approved in-game fighter remains canonical.
Creates transparent, evenly gridded energy atlases."""
from PIL import Image
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile
import colorsys
A=Path('assets')
def energy_mask(sheet,cols,rows,cell_w,cell_h):
    out=Image.new('RGBA',(cols*cell_w,rows*cell_h))
    for n in range(cols*rows):
        cx=n%cols;cy=n//cols
        l=round(cx*sheet.width/cols);r=round((cx+1)*sheet.width/cols)
        t=round(cy*sheet.height/rows);b=round((cy+1)*sheet.height/rows)
        tile=sheet.crop((l,t,r,b)).convert('RGBA')
        px=tile.load()
        for y in range(tile.height):
            for x in range(tile.width):
                red,green,blue,alpha=px[x,y]
                # Blue/cyan plasma; rejects skin, clothing, white checkerboard,
                # gold hair and dark outlines. Preserve bright white-hot cores
                # only if adjacent to strongly cyan pixels.
                h,s,v=colorsys.rgb_to_hsv(red/255,green/255,blue/255)
                cyan=(.46<=h<=.64 and s>.21 and blue>red*1.12 and blue>green*.90)
                # Charge concept has blue wristbands and dark blue clothing.
                # Only keep outer aura flames, never the character silhouette.
                if rows==3:
                    nx=x/max(1,tile.width-1)
                    ny=y/max(1,tile.height-1)
                    outer=(nx<.27 or nx>.73 or ny<.13)
                    cyan=cyan and outer
                px[x,y]=(red,green,blue,alpha if cyan else 0)
        # The artwork uses a white/checkered background, now fully transparent.
        # Keep entire frame registration stable; no bounding-box per-frame scaling.
        tile=tile.resize((cell_w,cell_h),Image.Resampling.NEAREST)
        out.alpha_composite(tile,((n%cols)*cell_w,(n//cols)*cell_h))
    return out
with ZipFile(A/'ki_fighters_animation_concepts.zip') as z:
    names=z.namelist()
    for key,output,cols,rows,w,h in [
        ('base_ki_charge_24_concept.png','charge-blue-energy-24.png',8,3,64,96),
        ('kamehameha_ssj_16_concept.png','kamehameha-blue-energy-16.png',8,2,128,96)
    ]:
        matches=[n for n in names if n.endswith(key)]
        if len(matches)!=1:raise RuntimeError((key,matches))
        source=Image.open(BytesIO(z.read(matches[0]))).convert('RGBA')
        result=energy_mask(source,cols,rows,w,h)
        assert result.getbbox(),output+' empty'
        result.save(A/output,optimize=True)
        print(output,result.size,'alpha bounding box:',result.getbbox())
