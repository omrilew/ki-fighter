# Ki Fighters — production animation contract

## Non-negotiable visual continuity
- The approved base and SSJ movement atlases are the canonical fighter designs.
- Never replace a fighter with an unrelated generated design for a single action.
- Do not add painted fists, limbs, or hands as canvas overlays.
- Same foot baseline, body scale, palette, hair, clothing and hand anatomy in every frame.
- A new sprite atlas cannot be enabled without an in-game comparison against canonical idle at identical scale.

## Animation pipeline
1. Use a canonical reference pose and consistent 64x96 source frame for fighter-only animation.
2. Draw actual anticipation, action, recovery and idle-return frames; duplicates do not count.
3. Separate fighter-only sheets from energy-only sheets. Do not bake the aura into character frames if a separate aura is rendered.
4. Animate at 12–18 unique drawn frames per second; hold or interpolate timing for smooth playback, not pixel-art geometry.
5. Keep feet anchored while planted; only move feet when explicitly stepping.
6. Validate left, right, up, down, base and SSJ, on both mobile and desktop.
7. Capture start, peak and recovery screenshots, plus a short video, before calling an animation production-ready.

## Action coverage
| Action | Phases | Forms | Priority |
| --- | --- | --- | --- |
| Ki charge | enter, brace, sustain loop, release | base / SSJ | P0 |
| Kamehameha | cup hands, gather, compress, thrust, sustained beam, recoil | base / SSJ | P0 |
| SSJ transform | brace, ignition, explosion, settle | base to SSJ | P0 (preserve approved art) |
| Melee combo | wind-up, strike, impact, follow-through, recover | base / SSJ | P1 |
| Ki blast | gather, fire, recoil, return | base / SSJ | P1 |
| Dash | anticipation, motion, braking | base / SSJ | P1 |
| Hurt / knockback | impact, recoil, recovery | base / SSJ | P1 |
| Walk / idle | 4 directions, foot contact, breathing | base / SSJ | P1 |
| KO / revive | fall, settle, recover | base / SSJ | P2 |

## Kamehameha constraints
- Use a single frame-specific palm anchor for the charge orb and the emitted beam.
- Beam must start narrow at both hands and expand outward, with moving plasma and a bright head.
- Collision geometry and rendered beam direction must match.
- Charging and firing body frames must have matching arms/hands, not detached synthetic overlays.
- Existing beam geometry improvements are provisional until visually tested.

## Acceptance gates
- Asset exists in repo, loads on deployed branch, no console errors.
- Character matches idle silhouette and approximate height frame-to-frame.
- No missing hands or mismatched action character.
- Animation visibly changes at least every few frames; no 24-frame duplicated-idle loops.
- Aura remains behind character and has independently moving flames.
- Tested on actual browser canvas, not just syntax checked.
