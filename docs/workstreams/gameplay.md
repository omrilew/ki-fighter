# Gameplay systems workstream

## Priorities
1. Make desktop + iPhone gameplay E2E green, inspect screenshots and console errors; fix gameplay regressions.
2. Quest engine: accept, objective, progress, completion, turn-in, reward; explicit stable IDs and once-only grants.
3. Items: invisible equipment, item catalog, collection, deterministic drops, unique/stackable types, equipment slots, movement and XP modifiers, inventory controls.
4. Persistent schema migration; recover safely from invalid saves; character progression and fighter switching.
5. Balance encounters and give each dojo challenger distinct attacks, windups and recovery.
6. Ensure playable branch preview or preview artifact can be accessed without merging PR #1.

## Test cases
- Desktop and mobile smoke, no browser exceptions; actual movement speed with/without weights; XP multiplier exactly once; equip/unequip; drop persistence; no duplicate rewards; quest stage transitions; continue/reload; old saves; combat Ki vs beam; hand alignment and dojo draw order.

Do not modify unapproved story major events. Do not merge PR #1.
