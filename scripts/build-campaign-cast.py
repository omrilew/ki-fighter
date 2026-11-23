#!/usr/bin/env python3
"""Render original, hard-edged campaign NPC poses and a contact sheet."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "campaign-cast"

INK = "#161527"
HAIR = {
    "bulma": ("#155460", "#309da1", "#7ad8c9"),
    "raditz": ("#1e1b2d", "#41344f", "#716184"),
    "extra-earth": ("#472b37", "#824d44", "#b87962"),
    "extra-indigo": ("#222742", "#4c5181", "#737ca6"),
    "extra-rust": ("#512b3e", "#86504c", "#ba7565"),
    "extra-sage": ("#3d3640", "#696364", "#a79a87"),
}
CLOTHES = {
    "bulma": ("#682950", "#c64b80", "#ff8cad"),
    "piccolo": ("#38265e", "#714699", "#b682d8"),
    "raditz": ("#28243e", "#565173", "#827e94"),
    "extra-earth": ("#444037", "#79714f", "#afa472"),
    "extra-indigo": ("#282d4b", "#4b6497", "#7694bd"),
    "extra-rust": ("#643044", "#a54a50", "#df8070"),
    "extra-sage": ("#293c39", "#4e7861", "#98b188"),
}
PEOPLE = ("#965c50", "#d58c70", "#ffd5a0")
ALIEN = ("#345142", "#679650", "#afd377")
IVORY = ("#786782", "#b4a6b8", "#f5e8d2")
ARMOR = ("#76523c", "#b68352", "#edbe76")


def palette(id_: str) -> tuple[str, str, str]:
    return CLOTHES[id_]


def render(id_: str, direction: str, action: str, frame: int) -> Image.Image:
    image = Image.new("RGBA", (64, 96))
    draw = ImageDraw.Draw(image)
    left = direction == "left"
    back = direction == "up"
    side = direction in ("left", "right")
    named = not id_.startswith("extra-")
    piccolo = id_ == "piccolo"
    raditz = id_ == "raditz"
    bulma = id_ == "bulma"
    cloth, final, highlight = palette(id_)
    skin_shadow, skin, skin_highlight = ALIEN if piccolo else PEOPLE
    boot = "#322f49" if piccolo or raditz else "#42374e"
    if action in ("idle", "walk", "talk"):
        bob = (0, -1 if action == "walk" else 1, 0, -1)[frame]
        lean = 0
    elif action == "telegraph":
        bob, lean = frame * 2, -frame * 2
    elif action == "attack":
        bob, lean = -2 - frame, 2 + frame * 3
    elif action == "recovery":
        bob, lean = frame, 2 - frame * 2
    elif action == "hurt":
        bob, lean = 2 + frame, -4 + frame
    else:
        bob, lean = 5 + frame * 3, -4 - frame * 3
    if not side:
        lean = round(lean / 2)
    tall = 5 if raditz else 2 if piccolo else 0
    top = 27 - tall + bob
    waist = 65 + bob
    cx = 32 + lean

    def poly(points, color, outline=INK):
        draw.polygon(points, fill=color, outline=outline)

    def line(points, color, width=1):
        draw.line(points, fill=color, width=width)

    # Back layers establish the long-hair and cape silhouettes.
    if raditz:
        hair_dark, hair, hair_light = HAIR[id_]
        poly([(19+lean,top+10),(12+lean,top+15),(15+lean,top+31),(9+lean,top+51),
              (18+lean,top+47),(17+lean,top+58),(26+lean,top+52),(33+lean,top+63),
              (37+lean,top+52),(47+lean,top+60),(48+lean,top+43),(53+lean,top+49),
              (49+lean,top+29),(51+lean,top+19),(46+lean,top+11)],hair_dark)
        line([(19+lean,top+20),(18+lean,top+39),(22+lean,top+43)],hair,2)
        line([(45+lean,top+20),(46+lean,top+37),(43+lean,top+49)],hair,2)
    if piccolo:
        cape_shift = 1 if action == "walk" and frame in (1,3) else 0
        poly([(19+lean,top+22),(43+lean,top+22),(49+cape_shift,waist+7),
              (43,waist+10),(39,waist+8),(33,waist+10),(20,waist+9),(14-cape_shift,waist+5)],IVORY[0])
        poly([(23+lean,top+27),(31+lean,top+29),(29,waist+6),(19,waist+5),(20,waist-1)],IVORY[1],None)
        poly([(38+lean,top+28),(42+lean,top+27),(46,waist+6),(38,waist+7)],IVORY[1],None)

    # Two separately posed legs maintain a stable grounded foot.
    travel = ((0,0),(-2,1),(-1,1),(2,-1))[frame] if action=="walk" else (0,0)
    back_leg = side and not back
    for i,sign in enumerate((-1,1)):
        foot = 32 + sign * (5 if side else 6) + travel[i]
        hip = cx + sign * (4 if side else 6)
        raised = action=="walk" and (frame==1+i*2)
        sole = 86 - (4 if raised else 0)
        color = cloth if back_leg and i==0 else final
        poly([(hip-4,waist-2),(hip+5,waist-1),(foot+4,sole-8),(foot-4,sole-7)],color)
        line([(hip+1,waist+1),(foot+1,sole-10)],highlight if i==1 else cloth,1)
        toe=2 if side else sign
        poly([(foot-4,sole-8),(foot+4,sole-8),(foot+5+toe,sole-3),
              (foot+5+toe,sole),(foot-5,sole)],boot)
        line([(foot-2,sole-6),(foot+3,sole-6)],IVORY[1] if raditz else "#846d88")
        line([(foot-3,sole-1),(foot+3+toe,sole-1)],"#695469")

    shoulder = top+22
    half = 9 if side else 12
    torso = [(cx-half,shoulder+2),(cx-5,shoulder-1),(cx+6,shoulder-1),
             (cx+half,shoulder+4),(cx+8,waist),(cx-8,waist)]
    poly(torso,cloth)
    poly([(cx-half+2,shoulder+4),(cx+5,shoulder+2),(cx+8,shoulder+6),
          (cx+5,waist-3),(cx-6,waist-2)],final,None)
    line([(cx-half+3,shoulder+5),(cx-5,shoulder+4),(cx-6,waist-3)],highlight)
    line([(cx-7,waist-2),(cx+7,waist-2)],"#301d39",2)

    # Distinct torso details survive nearest-neighbor downscaling in the arena.
    if bulma:
        line([(cx-7,shoulder+5),(cx+6,shoulder+5)],"#f8d7bb")
        line([(cx-7,shoulder+6),(cx+6,shoulder+6)],"#722e63")
        line([(cx+1,shoulder+7),(cx+4,waist-4)],"#dcb295",2)
        draw.rectangle((cx+3,waist-5,cx+7,waist),fill="#996856",outline=INK)
        if back:
            draw.rectangle((cx-7,shoulder+3,cx+6,waist-4),fill="#755155",outline=INK)
            line([(cx-5,shoulder+6),(cx+4,shoulder+6)],"#c28e78",2)
    elif raditz:
        poly([(cx-half,shoulder+3),(cx+half,shoulder+3),(cx+7,shoulder+10),
              (cx+5,waist-2),(cx-6,waist-2)],ARMOR[1])
        for y in range(shoulder+9,waist-1,3):
            line([(cx-5,y),(cx+4,y)],ARMOR[0])
        line([(cx-half+2,shoulder+3),(cx+half-2,shoulder+3)],IVORY[2],2)
        poly([(cx-half,shoulder),(cx-half-6,shoulder-2),(cx-half-4,shoulder+6),
              (cx-half,shoulder+8)],ARMOR[2])
        poly([(cx+half,shoulder),(cx+half+6,shoulder-2),(cx+half+4,shoulder+6),
              (cx+half,shoulder+8)],ARMOR[2])
        if back:
            line([(cx,shoulder+6),(cx,waist-3)],ARMOR[0],2)
    elif piccolo:
        line([(cx-8,waist-4),(cx+8,waist-4)],"#484788",3)
        line([(cx-6,waist-5),(cx+4,waist-5)],"#9b86d0")
        if back:
            poly([(cx-half,shoulder+1),(cx+half,shoulder+1),(cx+10,waist+3),
                  (cx-2,waist+6),(cx-11,waist+2)],IVORY[1])
            line([(cx-1,shoulder+3),(cx+1,waist+3)],IVORY[2],2)
    else:
        line([(cx-7,shoulder+6),(cx+6,shoulder+6)],highlight)
        draw.rectangle((cx-4,waist-5,cx+4,waist-3),fill="#ad926d")

    # Facial detail follows the camera angle; the scouter is finished after the profile reflection.
    head_half = 8 if side else 10
    poly([(cx-head_half,top+7),(cx-5,top+1),(cx+6,top+1),(cx+head_half,top+6),
          (cx+head_half-1,top+17),(cx+5,top+21),(cx-5,top+21),(cx-head_half,top+15)],skin_shadow)
    if not back:
        nose = 5 if side else 0
        poly([(cx-head_half+3,top+8),(cx+head_half-1,top+7),(cx+head_half-1,top+14),
              (cx+5+nose//3,top+18),(cx-5,top+18)],skin,None)
        line([(cx+1+nose,top+11),(cx+5+nose,top+11)],INK)
        if not side:
            line([(cx-6,top+11),(cx-2,top+11)],INK)
        line([(cx+nose,top+15),(cx+3+nose,top+15)],skin_highlight)
        if raditz:
            q = cx+4 if side else cx-5
            draw.rectangle((q-3,top+9,q+4,top+13),fill="#17544b",outline=INK)
            line([(q-2,top+10),(q+3,top+10)],"#a8f1a0")
    else:
        line([(cx-7,top+16),(cx+6,top+16)],skin,3)

    if piccolo:
        poly([(cx-head_half-2,top+8),(cx-head_half,top+2),(cx-5,top-1),
              (cx+6,top-1),(cx+head_half+2,top+4),(cx+head_half+2,top+8),
              (cx+3,top+10),(cx-5,top+10)],IVORY[1])
        line([(cx-10,top+5),(cx-5,top+2),(cx+5,top+2),(cx+10,top+5)],IVORY[2],2)
        line([(cx-10,top+8),(cx-3,top+7),(cx+6,top+8)],"#655674")
        if not side:
            poly([(cx-11,top+11),(cx-15,top+8),(cx-13,top+15)],skin)
            poly([(cx+10,top+11),(cx+15,top+8),(cx+13,top+15)],skin)
    else:
        hair_dark,hair,hair_light=HAIR[id_]
        if raditz:
            silhouette=[(cx-12,top+11),(cx-15,top+6),(cx-10,top+7),(cx-13,top-2),
                        (cx-5,top+1),(cx-8,top-7),(cx,top-3),(cx+6,top-8),
                        (cx+6,top-2),(cx+12,top-5),(cx+10,top+1),(cx+16,top+1),
                        (cx+11,top+7),(cx+11,top+13),(cx+6,top+8),(cx+1,top+11)]
        elif bulma:
            silhouette=[(cx-11,top+14),(cx-11,top+5),(cx-7,top),(cx+3,top-2),
                        (cx+9,top+1),(cx+head_half+2,top+6),(cx+9,top+11),
                        (cx+4,top+7),(cx-2,top+10),(cx-5,top+7),(cx-8,top+16)]
        else:
            silhouette=[(cx-10,top+12),(cx-11,top+5),(cx-5,top-1),(cx+4,top-1),
                        (cx+10,top+3),(cx+10,top+10),(cx+4,top+7),(cx-4,top+10)]
        if back:
            silhouette.extend([(cx+7,top+17),(cx-5,top+18),(cx-10,top+15)])
        poly(silhouette,hair_dark)
        poly([(cx-8,top+6),(cx-4,top+2),(cx+4,top+1),(cx+8,top+4),
              (cx+4,top+6),(cx-4,top+8)],hair,None)
        line([(cx-7,top+5),(cx-3,top+3),(cx+3,top+3)],hair_light)
        if bulma:
            tie=cx-9 if not back else cx+5
            poly([(tie,top+3),(tie-5,top+1),(tie-5,top+6),(tie,top+5)],"#e7b16f")
        elif raditz:
            line([(cx-6,top-2),(cx+2,top),(cx+10,top-2)],hair,2)
        elif id_ in ("extra-earth","extra-rust"):
            line([(cx-8,top+8),(cx+8,top+8)],"#ca9e65",2)

    # Arms and items use separate silhouette placement for locomotion and gestures.
    for i,sign in enumerate((-1,1)):
        arm = cx + sign * (half + 1)
        wrist_x = arm + sign
        wrist_y = shoulder + 12 - (2 if action=="walk" and frame==1+i*2 else 0)
        if action=="talk" and frame==1 and i==1:
            wrist_x += 4
            wrist_y -= 8
        if action=="attack" and i==1:
            wrist_x += 5+frame*3
            wrist_y -= 6
        if side and i==0:
            wrist_x=arm-1
        poly([(arm-3,shoulder+3),(arm+3,shoulder+3),(wrist_x+3,wrist_y+3),
              (wrist_x-3,wrist_y+3)],cloth if piccolo else skin_shadow)
        line([(arm+1,shoulder+5),(wrist_x+1,wrist_y+1)],highlight if piccolo else skin,2)
        draw.rectangle((wrist_x-2,wrist_y-1,wrist_x+2,wrist_y+3),fill=skin,outline=INK)
        draw.point((wrist_x+1,wrist_y),fill=skin_highlight)
        if raditz:
            line([(wrist_x-2,wrist_y-3),(wrist_x+2,wrist_y-3)],ARMOR[2],2)
        if piccolo:
            line([(arm,shoulder+7),(wrist_x,wrist_y-2)],"#a66d82")
        if bulma and action=="talk" and frame==1 and i==1 and not back:
            draw.rectangle((wrist_x-3,wrist_y-5,wrist_x+3,wrist_y+2),fill="#4d7365",outline=INK)
            line([(wrist_x-1,wrist_y-3),(wrist_x+1,wrist_y-3)],"#bdedab")

    if piccolo and not back:
        line([(cx-half+1,shoulder+1),(cx-6,shoulder+1)],IVORY[2],2)
        line([(cx+6,shoulder+1),(cx+half,shoulder+3)],IVORY[2],2)
    if not named and id_=="extra-indigo":
        line([(cx-6,waist-1),(cx+6,waist-1)],"#e2c389",2)

    if left:
        # Reflect the profile for the other heading and finish the visible scouter.
        image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if raditz:
            draw=ImageDraw.Draw(image)
            x=26-lean
            draw.rectangle((x,top+9,x+5,top+13),fill="#17544b",outline=INK)
            draw.line((x+1,top+10,x+4,top+10),fill="#a8f1a0")
    return image


def main() -> None:
    cmd = """const c=require('./campaign-cast.js');
    console.log(JSON.stringify({directions:c.directions,layout:c.layout,cell:c.cell,grid:c.grid,
      sprites:c.artOrder.map(c.getSprite)}));"""
    spec = json.loads(subprocess.check_output(["node", "-e", cmd], cwd=ROOT, text=True))
    width,height=spec["cell"]
    columns,rows=spec["grid"]["columns"],spec["grid"]["rows"]
    sheet=Image.new("RGBA",(columns*width,rows*height))
    DEST.mkdir(exist_ok=True,parents=True)
    preview=Image.new("RGB",(7*132,130*3+42),"#1d1c2a")
    preview_ink=ImageDraw.Draw(preview)
    for actor,entry in enumerate(spec["sprites"]):
        for action in entry["clips"]:
            clip=spec["layout"][action]
            for d,direction in enumerate(spec["directions"]):
                previous = None
                for step in range(clip["count"]):
                    frame=render(entry["id"],direction,action,step)
                    x1,y1,x2,y2=frame.getbbox()
                    label=f'{entry["id"]}/{direction}/{action}/{step}'
                    assert x1>0 and y1>0 and x2<width and y2<height,label
                    pixels=frame.tobytes()
                    assert pixels!=previous,label
                    previous=pixels
                    slot=entry["block"]+clip["start"]+d*clip["count"]+step
                    sheet.alpha_composite(frame,(slot%columns*width,slot//columns*height))
                    if action=="idle" and step==0 and direction in ("down","right","up"):
                        row=("down","right","up").index(direction)
                        preview.paste(frame,(actor*132+34,36+row*130),frame)
        preview_ink.text((actor*132+9,13),entry["id"],fill="#f9edd8")
    sheet.save(DEST/"opening-atlas.png",optimize=True)
    (ROOT/"design").mkdir(exist_ok=True)
    preview.save(ROOT/"design"/"campaign-cast-preview.png",optimize=True)


if __name__=="__main__":
    main()
