# Fighter animation production pipeline

The illustrated overview is a visual reference, **not** a sprite atlas. Do not crop its labeled panels into runtime sprites: backgrounds, inconsistent cell boundaries, and repeated poses make that unreliable.

## Runtime sources (retained)
- `hero-approved.webp`: directional normal/SSJ poses and fallbacks.
- `matching-actions.webp`: walking, melee, dash, hit, charging and SSJ action poses.
- `beam-body.webp`: beam charging and casting.
- `ssj-transformation-12.png`: 12-frame transformation cinematic only.
- `ssj-aura-atlas.svg`: aura effect; rendered behind fighter.
- `hero-approved-effects.webp`, `ki-actions.webp`: combat effects.

## Frame production contract
- Each new sprite must be 64x96 px, transparent RGBA with nearest-neighbor pixel edges.
- Feet anchored at the same point in every frame, with identical body proportions across normal and SSJ.
- Per form: idle 8; walking down/up/left/right 8 each; light combo 6; heavy combo 8; dash 8; dash attack 8; ki cast 10; charge 12; hurt 4; KO 6.
- Transformation: 12 unique poses; effects in a separate transparent atlas.
- Only retire existing art after the replacement passes browser visual review, direction-by-direction gameplay tests, and file reference checks.
- Avoid overlapping character-containing atlases and aura layers.

## Runtime state priority
KO > hurt > beam/Ki > attack > dash > walk > transformation > charge > idle.
