# SSJ head art — request spec

Status: **open**. The SSJ idle/walk frames still use the older, slimmer SSJ
drawing (different face, body and outfit). Code-generated hair was tried and
rejected; this needs drawn art. When it arrives it is stamped onto the
canonical normal-form frames so body, face and outfit stay identical across
forms.

## What to draw
One SSJ hair piece per view, drawn to sit on the **existing normal-form head**
(same face, same skull size). Hair only; the face is kept, except irises.

| View | Reference frame to draw over | Eye row (atlas px) | Notes |
| --- | --- | --- | --- |
| Front | `normal.idle.down[0]` (atlas cell 0,35) | 40 (eyes x 29–30, 32–33) | Bangs may cover the brow, not the eyes |
| Back | `normal.idle.up[0]` (cell 0,36) | — | Nape stays above row 45 |
| 3/4 right | `normal.idle.right[0]` | 41 (near eye x 34–35) | Mirrored at runtime for left |
| Side right | `normal.walk.right[0]` (cell 0,31) | 40 (eye x 39–40) | Mirrored at runtime for left |
| Charge 3/4 crouch | `normal.recharge.shared[8]` | 47 | Used for the charge loop and transformation |

Also needed: SSJ iris colour for the front, 3/4 and side faces (teal-green,
1–2 px per eye, like the SSJ charge frames).

## Format
- Exactly 64×96 PNG per view, RGBA, the reference frame's cell coordinates
  (draw on top of an exported copy of the reference cell, then delete the
  body so only hair + irises remain).
- Hard pixels only: alpha 0 or 255, no anti-aliasing, no magenta/purple
  fringe, no glow (auras are a separate layer).
- Outline: 1 px dark brown, consistent with the body outline weight.
- Palette: ≤ 6 hair colours, 3-tone shading lit from the upper left, matching
  the gold of the SSJ charge frames.
- Silhouette: upright SSJ spikes, at most 16 px taller than the normal hair;
  the whole figure must stay inside the 64×96 cell.

## Integration (done by code once the art exists)
1. Per frame, register the normal head against the reference frame (head
   moves with walk bob/crouch) and stamp the hair at that offset.
2. Remove the normal black hair outside the face, keep face/chin/neck.
3. Rebuild `ssj.idle.*`, `ssj.walk.*`, `ssj.recharge.shared` from the
   normal clips, so both forms share body art and anchors.
4. Rebuild the transformation from the charge crouch (normal → SSJ hair) so
   it no longer needs `transformation-fit.png`.
5. `scripts/validate_hero_atlas.py` + gameplay capture on desktop and mobile.
