# Ki Fighter — Dragon Ball Z Story Campaign

> Fan-game development outline. Dragon Ball characters, locations, and story belong to their respective rights holders. Use original/placeholder assets during development; review licensing before public distribution.

## Game direction
A connected-world, GBA-style action RPG that retells the main Dragon Ball Z story through exploration, dialogue, training, boss battles, and transformations. Preserve the existing Ki Fighter real-time melee, Ki, dash, flight, Surge, and character progression.

## Chapter 1 — Saiyan Saga
**Opening:** A mysterious warrior lands on Earth and reveals the Saiyan origin of the hero. Players travel between the home village, wilderness, training grounds, and the landing site.

**Quests:** Meet allies; investigate the crash; fight Raditz; train with a mentor; gather allies and supplies; defend Earth against Nappa; duel Vegeta.

**Gameplay milestones:** Dialogue and quest journal, world travel, training challenges, first multi-phase boss, cinematic knockback and Ki beam clashes.

## Chapter 2 — Namek / Frieza Saga
Travel to Namek, explore villages and islands, gather Dragon Balls, evade Frieza's soldiers, confront the Ginyu Force, and face Frieza's escalating forms. Unlock Super Saiyan at the climactic story event.

## Chapter 3 — Android / Cell Saga
Return to an evolving Earth. Investigate android sightings, pursue Androids 17 and 18, train in the Hyperbolic Time Chamber, and participate in the Cell Games. Introduce transformations and stronger team abilities.

## Chapter 4 — Majin Buu Saga
Explore the World Tournament, investigate Babidi, face Majin Vegeta and Buu's forms, train advanced transformations, and conclude with a large-scale final boss encounter.

## Gameplay pillars
- **World:** Connected maps, towns, wilderness, interiors, shortcuts, and story-gated regions.
- **Combat:** Existing strike combos, Ki projectiles and beam, dash, flight and Surge; add telegraphs, guard, beam clashes and phase transitions.
- **Progression:** Character level, stats, unlockable techniques, training rewards and transformation trees.
- **Story:** NPC conversations, quest objectives, journal, cutscenes and boss triggers.
- **Persistence:** Versioned local saves for quest flags, character stats and unlocked regions.
- **Playable cast:** Story-driven character switching with distinct abilities; begin with one fully working character.

## Vertical-slice target: Saiyan Saga prologue
Replace the generic bandit-training fiction with a prologue mission: speak to the village martial-arts mentor, investigate strange fighters in the eastern forest, defeat three scouts, and return to report an incoming threat. Keep the current enemies and combat until dedicated Saiyan assets and boss AI are ready.

### Acceptance criteria
1. Player can travel continuously from village to forest.
2. Mentor interaction starts the prologue quest.
3. Three scouts can be defeated using existing combat.
4. Return interaction completes the quest and awards XP once.
5. Quest and stats survive refresh.
6. Character menu, Ki, dash, flight and mobile controls remain functional.

## Prompt for the next development session

> Continue development of the GitHub repository `omrilew/ki-fighter` on branch `feature/forest-trial-vertical-slice`, PR #1. Build the **Saiyan Saga prologue** into a tested playable GBA-style action RPG slice. Preserve existing combat and character progression. First inspect the current code and PR diff. Implement mentor dialogue, quest stages, three scout encounters, objective markers, persistent progress, and a return-to-village reward. Add automated syntax and smoke tests and test the game in a browser if tools allow. Do not claim browser testing if it was not performed. Keep changes on the PR branch, not `main`. Then propose the next Raditz boss encounter with telegraphed attacks and a clear story transition.
