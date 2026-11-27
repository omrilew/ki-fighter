# NPC / Z-fighter template production brief

Goal: build reusable character templates with consistent GBA pixel art, not random mismatched sprites.

## Asset model
- 64×96 fighter cells; consistent 3/4 perspective, feet baseline and native game scale.
- Character manifest: id, archetype, body, skin palette, hair shape, outfit layers, accessory layers, faction, personality, movement set, combat set, per-frame anchors.
- Seeded generation: stable id + seed reproduces the same look; exclude palette combinations with poor contrast.
- Families: village civilian, dojo disciple, mentor, hostile scout, armored fighter, Saiyan-style warrior, Namekian-style alien, android-style fighter. Names and artwork must be original.
- No character is considered ready without front/back/side walk, idle, talk, hurt and context-specific combat clips.

## Implementation acceptance
- Manifest schema validator, seed repeatability tests, clipping/baseline tests, preview contact sheets, at least 3 distinctive generated NPC designs.
- Integrate one NPC with existing world draw ordering and interaction without extra sprite layers.
- Review under AGENTS.md before claiming production ready.
