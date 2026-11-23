"""Build 24-frame charge loops from the SAME approved in-game fighter atlases.
No new character design, no artificial limb painting, no image scaling."""
from PIL import Image
from pathlib import Path
import math
A=Path('assets')
def build(source,dest):
 src=Image.open(A/source).convert('RGBA')
 assert src.size==(256,384),(source,src.size)
 out=Image.new('RGBA',(64*8,96*3))
 for n in range(24):
  # First six frames ease into the stance, the rest loop with slight effort.
  phase=min(1,n/6)
  t=2*math.pi*((n-6)%18)/18 if n>=6 else 0
  base=src.crop((0,0,64,96)).copy()
  # Source art is retained exactly. A tiny upper-body offset creates natural
  # breathing while the feet and contact shadow remain fixed.
  upper=base.crop((9,18,55,61))
  shift=round(math.sin(t)*1.0*phase)
  if shift:
   # Repaint from original source behind shifted torso, avoiding transparency
   # gaps at edges. No additional limbs or replacement anatomy.
   base.alpha_composite(upper,(9+shift,18))
  # Alternating original approved idle/walk frame for a restrained fist pulse.
  if n>=6 and n%9 in (4,5):
   other=src.crop((64,0,128,96))
   # Preserve head, face, hands and feet from the canonical model.
   cloth=other.crop((24,48,40,72))
   base.alpha_composite(cloth,(24,48))
  out.alpha_composite(base,((n%8)*64,(n//8)*96))
 out.save(A/dest,optimize=True)
 print(dest,out.size)
build('normal-movement-4x4.png','charge-normal-matched-24.png')
build('ssj-movement-4x4.png','charge-ssj-matched-24.png')
