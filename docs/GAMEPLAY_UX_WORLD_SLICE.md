# Gameplay and UX improvement backlog — integration contract

## Immediate release slice
1. Integrate `world-content-kit.js` through the **existing** world renderer, NPC interaction handler and save format. Do not create an extra canvas or sprite draw layer.
2. Spawn 10 seeded village NPCs with visible names only on proximity/focus. NPC interaction chooses nearest eligible actor within its interaction radius; avoid opening dialogue during attacks.
3. Buildings: house, market stall, dojo. Two interiors (home and dojo) need door collision, enter/exit prompts, spawn points, and safe return locations. Use existing world transition infrastructure.
4. Quest `village-first-steps`: speak to trainer → defeat 3 forest scouts → report back. Save progress and grant reward exactly once.
5. HUD: keep one current objective line; show progress `2/3` and distance/direction only when useful. Hide overlapping prompts during menus/cutscenes.
6. Mobile: minimum 44px touch targets, respect safe areas, ensure joystick never overlaps interaction and combat controls; disable world input while dialogue/menu is open.
7. Combat feel: buffered attack input, visible enemy windups, damage flash and knockback, responsive hit confirmation, short recovery windows; do not change player hitbox when effects animate.
8. Navigation: clear objective marker and map legend, distinguish interactable NPCs from decorative NPCs, provide an obvious exit from interiors.
9. Accessibility: readable contrast, keyboard focus visibility, reduced-motion preference for screen shake, optional control hints.

## Definition of done
- Desktop Chromium and mobile viewport playtests recorded; no NPC draw duplication.
- World seed stable across reload; NPC IDs unique.
- Enter and exit both interiors without trapping the player.
- Quest progression persists, cannot double-award rewards, and is independent of character switching.
- Mobile controls usable while quest markers and notifications are displayed.
- All existing combat, save, dojo, inventory and character-switch regression suites pass.
- Keep PR #1 unmerged until user-approved playtest.
