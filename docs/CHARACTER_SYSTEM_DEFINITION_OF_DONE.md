# Definition of Done — Playable DBZ Character System

## Release rule
A feature is **not complete** until its implementation, assets, interaction, save compatibility, automated checks, and hands-on browser/mobile verification are complete. No renaming placeholders and calling them finished. Keep PR #1 in draft until verified.

## Milestone 1: Goku / Piccolo / Gohan — complete party
- [ ] Recognizable, original pixel-drawn representations of Goku, Piccolo and Gohan, with consistent scale, feet alignment, and directional idle/walk/hit/attack/charge/flight/KO animation frames
- [ ] Separate character portraits and clear party selection UI; switching works with keyboard and touch
- [ ] Goku: Kamehameha, balanced melee, Kaioken with Ki/stamina cost and visual state
- [ ] Piccolo: Special Beam Cannon, reach-oriented melee, distinct charge and projectile behavior
- [ ] Gohan: Masenko, agile melee, distinct charged attack
- [ ] Character-specific damage, range, timing, Ki cost, hitboxes, cooldown and feedback, with balanced enemy encounters
- [ ] Switching never interrupts an unresolved hit/beam incorrectly; no switching during KO, dialogue, cutscene or paused state
- [ ] Independent levels, XP, stats and unlocks; shared world quest progress; clear active fighter HUD
- [ ] Versioned save migration preserving existing saves; no reset from schema changes
- [ ] Desktop and mobile QA: switch repeatedly while walking, fighting, charging, taking damage, opening character menu, and reloading
- [ ] Automated JS syntax validation, smoke checks for startup and character switching, and visual review of every animation frame
- [ ] Actual browser test evidence and fixed errors before marking milestone complete

## Milestone 2: Saiyan Saga prologue
- [ ] Complete village/forest map and collisions
- [ ] Mentor dialogue and clear quest journal/objective markers
- [ ] Scout enemy AI and working combat for all three fighters
- [ ] Reward only once, persistence after refresh, reliable death/retry
- [ ] Playtest on desktop and mobile

## Milestone 3: Raditz encounter
- [ ] Unique boss art/animation, telegraphed attacks and multiple phases
- [ ] Intro and outcome cutscenes, save checkpoint, balanced challenge
- [ ] Regression test of milestones 1–2

## Continue development prompt
> Work on PR #1 of `omrilew/ki-fighter`. Finish **Milestone 1** end-to-end before proceeding. Do not treat character name changes or shared sprite recolors as completion. Implement recognizable Goku/Piccolo/Gohan assets and complete unique attack behaviors, party UI, persistence and tests. Inspect and fix existing integration bugs. Use real browser/mobile testing where available, and report untested items explicitly. Commit to the existing feature branch only. Keep the PR draft until all acceptance criteria pass.
