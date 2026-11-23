# Ki Fighter — Character and NPC Production Rules

These instructions apply whenever creating, replacing, animating, or integrating a playable fighter, enemy, boss, mentor, merchant, or other NPC in Ki Fighter. Read this file before changing character art or character rendering. These are **production acceptance rules**, not optional suggestions.

## 1. Art direction and identity
- Original characters only. Maintain a cohesive, detailed GBA-era 2D pixel-art look with a **top-down 3/4 camera**.
- True hard-edged pixels, limited coherent palette (target <=24 main colors per character), deliberate 3-tone shading, strong readable silhouette, no blur, anti-aliasing, photographic gradients, or inconsistent outline thickness.
- Keep one canonical character design sheet specifying hair, face, outfit, proportions, accessories, color palette, and transformation differences. Every animation must depict **the same character**.
- A transformation changes explicitly approved features (e.g., hair, aura, colors), not identity, body scale, costume geometry, or alignment.
- Match the game's existing on-screen character footprint. Do **not** increase sprite size to make a pose fit; adjust the source artwork inside the fixed cell.

## 2. Atlas contract
- Standard fighter source cell: **64x96 pixels**. All frames in a sheet share that exact cell size and have no padding, gridlines, labels, or gaps.
- Use one uniform grid with explicit columns, rows, and frame order documented beside the asset in a manifest. Overall dimensions must equal columns*64 by rows*96.
- Align feet to the same baseline and character center consistently in all frames; keep weapons, fists, hair, and effects inside the cell unless a separately rendered effect is intentionally used.
- Export PNG RGBA with a genuinely transparent background; no magenta/white fringe. Never rely on runtime color-key removal.
- Use nearest-neighbor rendering; do not scale atlas cells independently per action.
- 64x96 is the default **fighter** contract. A noncombatant NPC may use another fixed cell size only if its manifest explicitly declares it and its renderer handles it. Do not silently mix dimensions.
- Keep large beams, auras, projectiles, impacts, and screen effects **out of character atlases**. They are separate effect assets with their own origin and timing.

## 3. Directional animation contract
- Every mobile character needs down/front, up/back, left, and right movement. Horizontal mirroring is permitted only when asymmetry is absent and the result remains visually correct.
- Minimum playable fighter clips: idle, four-direction walk, run/dash, punch, kick, Ki shot, Ki charge, beam charge, beam release/sustain, hurt, knockdown/KO, and transformation if applicable.
- NPCs require idle plus movement in every direction they actually travel, and interaction/talk if they interact. Stationary NPCs need an idle loop and at least one interaction reaction.
- Bosses require telegraph, attack, recovery, hit reaction, and defeat clips in addition to movement.
- Use enough distinct frames to make motion readable. A single held pose must not be represented as a complete animation.
- Each clip declares frame indices, playback rate, whether it loops, facing behavior, action duration, and transitions.

## 4. Poses, anchors, and combat effects
- Keep normal Ki shots and Kamehameha/beam skills as **different states and clips**. Never trigger a beam charge/release pose from an ordinary Ki projectile.
- Declare per-frame local anchors for **feet, center, left hand, right hand, muzzle/beam emission**, and optional head/hitbox. Coordinates are relative to the character's draw origin and respect horizontal mirroring.
- During a beam, the charge orb, emission muzzle, continuous beam, collision geometry, and beam trace must use the same frame-aware origin and facing. Do not reuse anchors from a different atlas or character.
- Charge orb grows between hands; release emerges from hands; beam extends progressively with a moving head; impact and fade are separate, timed visual states.
- Do not simulate a cinematic beam by stretching or repeating an obviously tiled motif. Keep a continuous white-hot core, layered plasma, controlled edge motion, traveling tip, and proportionate impact.
- Effects must not obscure the entire fighter or appear bigger than intended at native game scale.

## 5. NPC implementation
- Each NPC must have a stable ID, role, design reference, atlas manifest, world position, facing, collision footprint, interaction radius, dialogue/behavior state, and animation state machine.
- Render order is based on world-space feet position, so characters pass in front of and behind scenery correctly.
- Collision, interaction point, speech indicator, and shadow must remain aligned with the visible feet and body.
- NPC visual style and scale must match the hero and environment. Do not mix a detailed atlas hero with simplistic vector NPC placeholders in the final production scene.
- Reuse the animation pipeline and asset loader rather than adding another competing draw layer or silently falling back to old character artwork.

## 6. Safe integration and cleanup
1. Inspect existing assets, render paths, input states, and character scale before generating anything.
2. Make a clip/atlas manifest and a contact sheet before integration. Review pose consistency and all four directions.
3. Export and validate every PNG: dimensions, transparency, no bleed, frame count, alignment, and identical silhouette.
4. Integrate the new atlas through **one** authoritative render path. Remove or disable superseded draw layers and stale asset references; do not stack ghosted characters.
5. Keep existing movement, controls, collisions, camera, NPC interactions, and performance unchanged unless the task explicitly changes them.
6. Test normal and transformed forms, each direction, every action, transitions, attacks, damage, KO, and effects. Verify on desktop Chromium and mobile viewport, including screenshots/video of the actual gameplay.
7. Run repository smoke and browser regression checks. Do not claim visually verified or production-ready merely because a commit or static assertion succeeded.
8. Commit on the active feature branch and leave PRs unmerged unless the user explicitly approves merging.

## 7. Acceptance checklist
- [ ] Recognizably the same approved character in every frame and state
- [ ] Correct 3/4 perspective and consistent native display scale
- [ ] Exact cell dimensions, grid manifest, and transparent clean PNG
- [ ] Feet baseline stable; no clipping or jitter
- [ ] All required directions and action clips exist and animate
- [ ] Correct independent Ki, melee, and beam poses
- [ ] Frame-specific hand anchors for charge, projectile, and beam
- [ ] Effects aligned to hands and hit detection, not legacy art offsets
- [ ] One character renderer; no obsolete sprite layers
- [ ] Verified in real gameplay at desktop and mobile sizes
- [ ] Smoke and browser tests pass; screenshots inspected

If an atlas is only a partial pack (e.g., 16 combat frames), label it **partial**. Never call it a complete production character.
